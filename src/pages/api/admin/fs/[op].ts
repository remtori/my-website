import type { APIRoute } from 'astro';
import { downloadZip } from 'client-zip';

import { rebuildFileIndex } from '@/lib/file-index';
import {
	asStringArray,
	FsError,
	json,
	jsonError,
	parseBucket,
	parseFolderKey,
	parseKey,
	parsePrefix,
	pooledMap,
	readJsonBody,
	wantsJson,
} from '@/lib/fs';
import { getEnv } from '@/lib/runtime';
import {
	abortMultipartUpload,
	completeMultipartUpload,
	copyObject,
	createMultipartUpload,
	deleteObjectInBucket,
	fetchObject,
	listAllObjects,
	listBuckets,
	listPrefixPage,
	objectExists,
	presignUrl,
	putObject,
	type S3UploadedPart,
	uploadMultipartPart,
} from '@/lib/s3';

const EXISTS_MAX = 40;
const DELETE_MAX = 40;
const MOVE_MAX = 20;
const PRESIGN_MAX = 50;
const ZIP_MAX_FILES = 800;
const CONCURRENCY = 6;
const MPU_PART_MAX = 90 * 1024 * 1024;
const MPU_PART_NUMBER_MAX = 10_000;

function asRecord(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new FsError(400, 'Expected a JSON object');
	}
	return value as Record<string, unknown>;
}

function parseUploadId(raw: string | null | undefined): string {
	const uploadId = (raw ?? '').trim();
	if (!uploadId || uploadId.length > 2048 || uploadId.includes('\0')) {
		throw new FsError(400, 'Invalid uploadId');
	}
	return uploadId;
}

function parsePartNumber(raw: string | null | undefined): number {
	const partNumber = Number(raw);
	if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > MPU_PART_NUMBER_MAX) {
		throw new FsError(400, 'Invalid partNumber');
	}
	return partNumber;
}

function parseContentLength(raw: string | null): number | undefined {
	if (raw == null || raw === '') return undefined;
	const contentLength = Number(raw);
	if (!Number.isFinite(contentLength) || contentLength < 0) {
		throw new FsError(400, 'Invalid Content-Length');
	}
	return contentLength;
}

function parseUploadedParts(value: unknown): S3UploadedPart[] {
	if (!Array.isArray(value) || value.length === 0) {
		throw new FsError(400, 'parts must be a non-empty array');
	}
	if (value.length > MPU_PART_NUMBER_MAX) {
		throw new FsError(400, `parts exceeds max of ${MPU_PART_NUMBER_MAX}`);
	}
	return value.map((item) => {
		if (!item || typeof item !== 'object') throw new FsError(400, 'invalid part');
		const rec = item as Record<string, unknown>;
		const rawPart = rec.partNumber;
		const partNumber = parsePartNumber(typeof rawPart === 'number' || typeof rawPart === 'string' ? String(rawPart) : '');
		const etag = typeof rec.etag === 'string' ? rec.etag.trim() : '';
		if (!etag || etag.length > 256) throw new FsError(400, 'invalid part etag');
		return { partNumber, etag };
	});
}

export const GET: APIRoute = async ({ params, request }) => {
	try {
		const op = params.op;
		const url = new URL(request.url);
		if (op === 'buckets') {
			const result = await listBuckets();
			const env = getEnv();
			return json({ ...result, defaultBucket: env.S3_BUCKET });
		}
		if (op === 'list') {
			const bucket = parseBucket(url.searchParams.get('bucket'));
			const prefix = parsePrefix(url.searchParams.get('prefix') ?? '');
			const token = url.searchParams.get('token') ?? undefined;
			const recursive = url.searchParams.get('recursive') === '1';
			const page = await listPrefixPage(bucket, prefix, {
				token: token || undefined,
				delimiter: recursive ? null : '/',
			});
			return json(page);
		}
		if (op === 'get') {
			const bucket = parseBucket(url.searchParams.get('bucket'));
			const key = parseKey(url.searchParams.get('key'));
			const headers: Record<string, string> = {};
			const range = request.headers.get('Range');
			if (range) headers.Range = range;
			const res = await fetchObject(bucket, key, headers);
			if (!res.ok && res.status !== 206) {
				const t = await res.text();
				throw new FsError(res.status, `S3 get failed ${res.status}: ${t.slice(0, 200)}`);
			}
			const out = new Headers();
			const type = res.headers.get('Content-Type');
			if (type) out.set('Content-Type', type);
			const length = res.headers.get('Content-Length');
			if (length) out.set('Content-Length', length);
			const contentRange = res.headers.get('Content-Range');
			if (contentRange) out.set('Content-Range', contentRange);
			out.set('Cache-Control', 'private, no-store');
			out.set('Accept-Ranges', 'bytes');
			return new Response(res.body, { status: res.status, headers: out });
		}
		return json({ error: 'Unknown operation' }, 404);
	} catch (err) {
		return jsonError(err);
	}
};

export const POST: APIRoute = async ({ params, request }) => {
	try {
		const op = params.op;
		if (op === 'rebuild-index') {
			const entries = await rebuildFileIndex();
			if (wantsJson(request)) {
				return json({ ok: true, count: entries.length });
			}
			return Response.redirect(new URL(`/admin?rebuilt=${entries.length}`, request.url), 302);
		}

		const body = asRecord(await readJsonBody(request));
		const bucket = parseBucket(typeof body.bucket === 'string' ? body.bucket : '');

		if (op === 'exists') {
			const keys = asStringArray(body.keys, EXISTS_MAX, 'keys').map(parseKey);
			const existing: string[] = [];
			await pooledMap(keys, CONCURRENCY, async (key) => {
				if (await objectExists(bucket, key)) existing.push(key);
			});
			return json({ existing });
		}

		if (op === 'presign') {
			if (body.method !== 'GET') throw new FsError(400, 'method must be GET');
			if (!Array.isArray(body.items)) throw new FsError(400, 'items must be an array');
			if (body.items.length > PRESIGN_MAX) throw new FsError(400, `items exceeds max of ${PRESIGN_MAX}`);
			const urls: { key: string; url: string }[] = [];
			for (const item of body.items) {
				if (!item || typeof item !== 'object') throw new FsError(400, 'invalid item');
				const rec = item as Record<string, unknown>;
				const key = parseKey(typeof rec.key === 'string' ? rec.key : '');
				const filename = typeof rec.filename === 'string' ? rec.filename : undefined;
				urls.push({ key, url: await presignUrl(bucket, key, 'GET', { filename }) });
			}
			return json({ urls });
		}

		if (op === 'delete') {
			const keys = asStringArray(body.keys, DELETE_MAX, 'keys').map(parseKey);
			await pooledMap(keys, CONCURRENCY, (key) => deleteObjectInBucket(bucket, key));
			return json({ deleted: keys.length });
		}

		if (op === 'mkdir') {
			const key = parseFolderKey(typeof body.key === 'string' ? body.key : '');
			await putObject(bucket, key, '', 'application/x-directory');
			return json({ ok: true, key });
		}

		if (op === 'move') {
			if (!Array.isArray(body.items)) throw new FsError(400, 'items must be an array');
			if (body.items.length > MOVE_MAX) throw new FsError(400, `items exceeds max of ${MOVE_MAX}`);
			const items: { from: string; to: string }[] = body.items.map((item) => {
				if (!item || typeof item !== 'object') throw new FsError(400, 'invalid item');
				const rec = item as Record<string, unknown>;
				return {
					from: parseKey(typeof rec.from === 'string' ? rec.from : ''),
					to: parseKey(typeof rec.to === 'string' ? rec.to : ''),
				};
			});
			for (const { from, to } of items) {
				if (from === to) continue;
				await copyObject(bucket, from, to);
				await deleteObjectInBucket(bucket, from);
			}
			return json({ moved: items.length });
		}

		if (op === 'mpu-create') {
			const key = parseKey(typeof body.key === 'string' ? body.key : '');
			const contentType =
				typeof body.contentType === 'string' && body.contentType.trim() ? body.contentType : 'application/octet-stream';
			const uploadId = await createMultipartUpload(bucket, key, contentType);
			return json({ uploadId });
		}

		if (op === 'mpu-complete') {
			const key = parseKey(typeof body.key === 'string' ? body.key : '');
			const uploadId = parseUploadId(typeof body.uploadId === 'string' ? body.uploadId : '');
			const parts = parseUploadedParts(body.parts);
			await completeMultipartUpload(bucket, key, uploadId, parts);
			return json({ ok: true, key });
		}

		if (op === 'mpu-abort') {
			const key = parseKey(typeof body.key === 'string' ? body.key : '');
			const uploadId = parseUploadId(typeof body.uploadId === 'string' ? body.uploadId : '');
			await abortMultipartUpload(bucket, key, uploadId);
			return json({ ok: true });
		}

		if (op === 'zip') {
			const keys = asStringArray(body.keys ?? [], 500, 'keys').map(parseKey);
			const prefixes = asStringArray(body.prefixes ?? [], 50, 'prefixes').map(parsePrefix);
			const seen = new Set<string>(keys);
			for (const prefix of prefixes) {
				if (!prefix) continue;
				const listed = await listAllObjects(bucket, prefix);
				for (const obj of listed) {
					if (!obj.key.endsWith('/')) seen.add(obj.key);
				}
			}
			const allKeys = [...seen];
			if (allKeys.length === 0) throw new FsError(400, 'Nothing to zip');
			if (allKeys.length > ZIP_MAX_FILES) {
				throw new FsError(400, `Too many files to zip (max ${ZIP_MAX_FILES})`);
			}
			async function* files() {
				for (const key of allKeys) {
					const res = await fetchObject(bucket, key);
					if (!res.ok || !res.body) continue;
					yield { name: key, input: res.body, lastModified: new Date() };
				}
			}
			const zip = downloadZip(files());
			const headers = new Headers(zip.headers);
			headers.set('Content-Disposition', `attachment; filename="${bucket}-files.zip"`);
			headers.set('Cache-Control', 'private, no-store');
			return new Response(zip.body, { status: 200, headers });
		}

		return json({ error: 'Unknown operation' }, 404);
	} catch (err) {
		return jsonError(err);
	}
};

export const PUT: APIRoute = async ({ params, request }) => {
	try {
		const url = new URL(request.url);
		const bucket = parseBucket(url.searchParams.get('bucket'));
		const key = parseKey(url.searchParams.get('key'));
		const contentLength = parseContentLength(request.headers.get('Content-Length'));

		if (params.op === 'mpu-part') {
			if (contentLength == null) {
				throw new FsError(400, 'Content-Length required');
			}
			if (contentLength > MPU_PART_MAX) {
				throw new FsError(413, `Part exceeds max of ${MPU_PART_MAX} bytes`);
			}
			const uploadId = parseUploadId(request.headers.get('X-Upload-Id'));
			const partNumber = parsePartNumber(url.searchParams.get('partNumber'));
			const etag = await uploadMultipartPart(bucket, key, uploadId, partNumber, request.body ?? '', {
				contentLength,
			});
			return json({ etag, partNumber });
		}

		if (params.op !== 'put') {
			return json({ error: 'Unknown operation' }, 404);
		}
		const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
		await putObject(bucket, key, request.body ?? '', contentType, { contentLength });
		return json({ ok: true, key });
	} catch (err) {
		return jsonError(err);
	}
};
