export class FsError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.name = 'FsError';
		this.status = status;
	}
}

const BUCKET_RE = /^[a-zA-Z0-9][a-zA-Z0-9.-]{0,62}$/;

export function parseBucket(raw: string | null | undefined): string {
	const bucket = (raw ?? '').trim();
	if (!BUCKET_RE.test(bucket)) {
		throw new FsError(400, 'Invalid bucket name');
	}
	return bucket;
}

export function parseKey(raw: string | null | undefined): string {
	const key = (raw ?? '').trim();
	if (!key || key.length > 1024 || key.startsWith('/') || key.includes('\0')) {
		throw new FsError(400, 'Invalid object key');
	}
	return key;
}

export function parsePrefix(raw: string | null | undefined): string {
	const prefix = (raw ?? '').trim();
	if (prefix.length > 1024 || prefix.startsWith('/') || prefix.includes('\0')) {
		throw new FsError(400, 'Invalid prefix');
	}
	return prefix;
}

export function parseFolderKey(raw: string | null | undefined): string {
	const key = parseKey(raw);
	return key.endsWith('/') ? key : `${key}/`;
}

export async function readJsonBody(request: Request): Promise<unknown> {
	const ct = request.headers.get('content-type') ?? '';
	if (ct.includes('application/json')) {
		return request.json();
	}
	if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
		const form = await request.formData();
		const payload = form.get('payload');
		if (typeof payload !== 'string' || !payload) {
			throw new FsError(400, 'Missing payload');
		}
		try {
			return JSON.parse(payload);
		} catch {
			throw new FsError(400, 'Invalid payload JSON');
		}
	}
	try {
		return await request.json();
	} catch {
		throw new FsError(400, 'Expected JSON body');
	}
}

export function asStringArray(value: unknown, max: number, label: string): string[] {
	if (!Array.isArray(value)) {
		throw new FsError(400, `${label} must be an array`);
	}
	if (value.length > max) {
		throw new FsError(400, `${label} exceeds max of ${max}`);
	}
	return value.map((v) => {
		if (typeof v !== 'string') {
			throw new FsError(400, `${label} must be strings`);
		}
		return v;
	});
}

export function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' },
	});
}

export function jsonError(err: unknown): Response {
	if (err instanceof FsError) {
		return json({ error: err.message }, err.status);
	}
	const message = err instanceof Error ? err.message : 'Request failed';
	return json({ error: message }, 500);
}

export async function pooledMap<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
	let i = 0;
	const n = Math.min(Math.max(limit, 1), Math.max(items.length, 1));
	await Promise.all(
		Array.from({ length: n }, async () => {
			while (i < items.length) {
				const item = items[i];
				i += 1;
				await fn(item);
			}
		}),
	);
}

export function wantsJson(request: Request): boolean {
	return (request.headers.get('accept') ?? '').includes('application/json');
}
