import { fsApi } from './api';

export const MPU_PART_SIZE = 80 * 1024 * 1024;
const PART_CONCURRENCY = 2;
const PART_ATTEMPTS = 3;
const RETRY_BASE_MS = 200;
const RETRY_MAX_MS = 2000;

type ActiveMpu = {
	bucket: string;
	key: string;
	uploadId: string;
	controller: AbortController;
};

const activeMpus = new Set<ActiveMpu>();
let partSlots = PART_CONCURRENCY;
const partWaiters: Array<() => void> = [];

function abortError(): DOMException {
	return new DOMException('Aborted', 'AbortError');
}

function isAbortError(err: unknown): boolean {
	return (err instanceof DOMException && err.name === 'AbortError') || (err instanceof Error && err.name === 'AbortError');
}

function keepaliveAbort(bucket: string, key: string, uploadId: string): void {
	void fetch('/api/admin/fs/mpu-abort', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify({ bucket, key, uploadId }),
		credentials: 'same-origin',
		keepalive: true,
	}).catch(() => {
		// page is unloading; ignore
	});
}

export function abortAllUploads(): void {
	for (const rec of activeMpus) {
		rec.controller.abort();
		keepaliveAbort(rec.bucket, rec.key, rec.uploadId);
	}
	activeMpus.clear();
}

if (typeof window !== 'undefined') {
	window.addEventListener('pagehide', abortAllUploads);
}

function acquirePartSlot(signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal.aborted) {
			reject(abortError());
			return;
		}
		if (partSlots > 0) {
			partSlots -= 1;
			resolve();
			return;
		}
		const tryAcquire = () => {
			signal.removeEventListener('abort', onAbort);
			resolve();
		};
		const onAbort = () => {
			const i = partWaiters.indexOf(tryAcquire);
			if (i >= 0) partWaiters.splice(i, 1);
			reject(abortError());
		};
		signal.addEventListener('abort', onAbort, { once: true });
		partWaiters.push(tryAcquire);
	});
}

function releasePartSlot(): void {
	const next = partWaiters.shift();
	if (next) next();
	else partSlots += 1;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal.aborted) {
			reject(abortError());
			return;
		}
		const timer = setTimeout(() => {
			signal.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(timer);
			reject(abortError());
		};
		signal.addEventListener('abort', onAbort, { once: true });
	});
}

function retryDelayMs(attempt: number): number {
	const exp = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (attempt - 1));
	return exp + Math.random() * 100;
}

function xhrError(xhr: XMLHttpRequest): Error {
	try {
		const data: unknown = JSON.parse(xhr.responseText);
		if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
			return new Error(data.error);
		}
	} catch {
		// fall through
	}
	return new Error(xhr.status ? `HTTP ${xhr.status}` : 'Upload failed');
}

function putBlob(
	url: string,
	blob: Blob,
	opts: {
		contentType?: string;
		headers?: Record<string, string>;
		signal: AbortSignal;
		onProgress: (loaded: number) => void;
	},
): Promise<string> {
	return new Promise((resolve, reject) => {
		if (opts.signal.aborted) {
			reject(abortError());
			return;
		}
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', url);
		if (opts.contentType) xhr.setRequestHeader('Content-Type', opts.contentType);
		if (opts.headers) {
			for (const [name, value] of Object.entries(opts.headers)) {
				xhr.setRequestHeader(name, value);
			}
		}
		const onAbort = () => xhr.abort();
		opts.signal.addEventListener('abort', onAbort);
		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable) opts.onProgress(event.loaded);
		};
		xhr.onload = () => {
			opts.signal.removeEventListener('abort', onAbort);
			if (xhr.status >= 200 && xhr.status < 300) {
				resolve(xhr.responseText);
				return;
			}
			reject(xhrError(xhr));
		};
		xhr.onerror = () => {
			opts.signal.removeEventListener('abort', onAbort);
			reject(new Error('Upload failed'));
		};
		xhr.onabort = () => {
			opts.signal.removeEventListener('abort', onAbort);
			reject(abortError());
		};
		xhr.send(blob);
	});
}

async function withRetries<T>(fn: () => Promise<T>, signal: AbortSignal): Promise<T> {
	let last: unknown;
	for (let attempt = 0; attempt < PART_ATTEMPTS; attempt++) {
		if (signal.aborted) throw abortError();
		if (attempt > 0) await sleep(retryDelayMs(attempt), signal);
		try {
			return await fn();
		} catch (err) {
			if (isAbortError(err) || signal.aborted) throw isAbortError(err) ? err : abortError();
			last = err;
		}
	}
	throw last instanceof Error ? last : new Error('Upload failed');
}

async function putFile(bucket: string, key: string, file: File, onProgress: (ratio: number) => void, signal: AbortSignal): Promise<void> {
	await putBlob(fsApi.putUrl(bucket, key), file, {
		contentType: file.type || 'application/octet-stream',
		signal,
		onProgress: (loaded) => {
			if (file.size > 0) onProgress(loaded / file.size);
		},
	});
}

async function uploadParts(
	bucket: string,
	key: string,
	file: File,
	uploadId: string,
	onProgress: (ratio: number) => void,
	controller: AbortController,
): Promise<{ partNumber: number; etag: string }[]> {
	const partCount = Math.ceil(file.size / MPU_PART_SIZE);
	const parts: { partNumber: number; etag: string }[] = new Array(partCount);
	const inflight = new Array<number>(partCount).fill(0);
	let next = 0;
	let fail: unknown;

	const report = () => {
		let loaded = 0;
		for (let i = 0; i < partCount; i++) {
			const start = i * MPU_PART_SIZE;
			const size = Math.min(MPU_PART_SIZE, file.size - start);
			loaded += parts[i] ? size : inflight[i];
		}
		onProgress(file.size > 0 ? loaded / file.size : 1);
	};

	const workers = Array.from({ length: Math.min(PART_CONCURRENCY, partCount) }, async () => {
		while (next < partCount) {
			if (controller.signal.aborted) throw abortError();
			const index = next;
			next += 1;
			const partNumber = index + 1;
			const start = index * MPU_PART_SIZE;
			const blob = file.slice(start, start + MPU_PART_SIZE);
			await acquirePartSlot(controller.signal);
			try {
				const data = await withRetries(async () => {
					const raw = await putBlob(fsApi.mpuPartUrl(bucket, key, partNumber), blob, {
						headers: { 'X-Upload-Id': uploadId },
						signal: controller.signal,
						onProgress: (loaded) => {
							inflight[index] = loaded;
							report();
						},
					});
					const parsed: unknown = JSON.parse(raw);
					if (!parsed || typeof parsed !== 'object' || !('etag' in parsed) || typeof parsed.etag !== 'string') {
						throw new Error('Upload part returned no ETag');
					}
					return parsed.etag;
				}, controller.signal);
				parts[index] = { partNumber, etag: data };
				inflight[index] = 0;
				report();
			} catch (err) {
				if (!isAbortError(err)) fail ??= err;
				controller.abort();
				throw err;
			} finally {
				releasePartSlot();
			}
		}
	});

	await Promise.allSettled(workers);
	if (fail) throw fail instanceof Error ? fail : new Error('Upload failed');
	if (controller.signal.aborted) throw abortError();
	return parts;
}

export async function uploadFile(opts: { bucket: string; key: string; file: File; onProgress: (ratio: number) => void }): Promise<void> {
	const { bucket, key, file, onProgress } = opts;
	const controller = new AbortController();
	if (file.size <= MPU_PART_SIZE) {
		await putFile(bucket, key, file, onProgress, controller.signal);
		return;
	}

	const uploadId = await fsApi.mpuCreate(bucket, key, file.type || 'application/octet-stream');
	const rec: ActiveMpu = { bucket, key, uploadId, controller };
	activeMpus.add(rec);
	try {
		const parts = await uploadParts(bucket, key, file, uploadId, onProgress, controller);
		await fsApi.mpuComplete(bucket, key, uploadId, parts);
		onProgress(1);
	} catch (err) {
		controller.abort();
		try {
			await fsApi.mpuAbort(bucket, key, uploadId);
		} catch {
			// best-effort abort so a failed MPU does not stay open
		}
		if (isAbortError(err) && !activeMpus.has(rec)) {
			throw new Error('Upload cancelled');
		}
		throw err;
	} finally {
		activeMpus.delete(rec);
	}
}
