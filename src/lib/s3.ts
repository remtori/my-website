import { AwsClient } from 'aws4fetch';

import { getEnv } from './runtime';

export const POSTS_PREFIX = 'mdx/blogs/';

const PRESIGN_EXPIRES_SEC = 900;

function clientForEnv(env: Env, opts?: { retries?: number }): AwsClient {
	return new AwsClient({
		accessKeyId: env.S3_ACCESS_KEY_ID,
		secretAccessKey: env.S3_SECRET_ACCESS_KEY,
		service: 's3',
		region: 'auto',
		retries: opts?.retries,
	});
}

function endpointRoot(env: Env): string {
	return env.S3_ENDPOINT.replace(/\/$/, '');
}

function bucketRootUrl(env: Env, bucket = env.S3_BUCKET): string {
	return `${endpointRoot(env)}/${bucket}`;
}

function objectUrl(env: Env, bucket: string, key: string): string {
	return `${bucketRootUrl(env, bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

function objectQueryUrl(env: Env, bucket: string, key: string, params: Record<string, string>): string {
	const url = new URL(objectUrl(env, bucket, key));
	for (const [name, value] of Object.entries(params)) {
		url.searchParams.set(name, value);
	}
	return url.toString();
}

function decodeXml(s: string): string {
	return s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');
}

function escapeXml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function s3XmlError(xml: string): string | null {
	if (!/<Error[\s>]/i.test(xml)) return null;
	const code = xml.match(/<Code>([^<]+)<\/Code>/);
	const message = xml.match(/<Message>([^<]*)<\/Message>/);
	if (!code) return xml.slice(0, 200);
	const detail = message?.[1] ? `: ${decodeXml(message[1])}` : '';
	return `S3 ${decodeXml(code[1])}${detail}`;
}

export type S3ObjectInfo = {
	key: string;
	size: number;
	lastModified: string;
};

export type S3ListPage = {
	prefixes: string[];
	objects: S3ObjectInfo[];
	nextToken?: string;
};

export type S3UploadedPart = {
	partNumber: number;
	etag: string;
};

export async function listBuckets(): Promise<{ buckets: string[]; fallback: boolean }> {
	const env = getEnv();
	const fallback = env.S3_BUCKET ? [env.S3_BUCKET] : [];
	if (!env.S3_ENDPOINT) {
		return { buckets: fallback, fallback: true };
	}
	try {
		const aws = clientForEnv(env);
		const res = await aws.fetch(`${endpointRoot(env)}/`, { method: 'GET' });
		if (!res.ok) {
			return { buckets: fallback, fallback: true };
		}
		const xml = await res.text();
		const buckets = [...xml.matchAll(/<Bucket>[\s\S]*?<Name>([^<]+)<\/Name>/g)].map((m) => decodeXml(m[1]));
		if (buckets.length === 0) {
			return { buckets: fallback, fallback: true };
		}
		return { buckets, fallback: false };
	} catch {
		return { buckets: fallback, fallback: true };
	}
}

export async function listPrefixPage(
	bucket: string,
	prefix: string,
	opts?: { token?: string; delimiter?: string | null },
): Promise<S3ListPage> {
	const env = getEnv();
	const aws = clientForEnv(env);
	const url = new URL(bucketRootUrl(env, bucket));
	url.searchParams.set('list-type', '2');
	url.searchParams.set('prefix', prefix);
	url.searchParams.set('max-keys', '1000');
	if (opts?.delimiter !== null) {
		url.searchParams.set('delimiter', opts?.delimiter ?? '/');
	}
	if (opts?.token) {
		url.searchParams.set('continuation-token', opts.token);
	}
	const res = await aws.fetch(url.toString(), { method: 'GET' });
	if (!res.ok) {
		const t = await res.text();
		throw new Error(`S3 list failed ${res.status}: ${t.slice(0, 200)}`);
	}
	const xml = await res.text();
	const prefixes = [...xml.matchAll(/<CommonPrefixes>\s*<Prefix>([^<]*)<\/Prefix>/g)].map((m) => decodeXml(m[1]));
	const objects: S3ObjectInfo[] = [];
	for (const block of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
		const inner = block[1];
		const keyMatch = inner.match(/<Key>([^<]*)<\/Key>/);
		if (!keyMatch) continue;
		const key = decodeXml(keyMatch[1]);
		if (key === prefix) continue;
		const sizeMatch = inner.match(/<Size>([^<]*)<\/Size>/);
		const modMatch = inner.match(/<LastModified>([^<]*)<\/LastModified>/);
		objects.push({
			key,
			size: sizeMatch ? Number(sizeMatch[1]) : 0,
			lastModified: modMatch ? decodeXml(modMatch[1]) : '',
		});
	}
	const truncated = xml.includes('<IsTruncated>true</IsTruncated>');
	const tokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
	return {
		prefixes,
		objects,
		nextToken: truncated && tokenMatch ? decodeXml(tokenMatch[1]) : undefined,
	};
}

export async function listAllObjects(bucket: string, prefix: string): Promise<S3ObjectInfo[]> {
	const objects: S3ObjectInfo[] = [];
	let token: string | undefined;
	do {
		const page = await listPrefixPage(bucket, prefix, { token, delimiter: null });
		objects.push(...page.objects);
		token = page.nextToken;
	} while (token);
	return objects;
}

export async function listAllObjectKeys(bucket: string, prefix: string): Promise<string[]> {
	const objects = await listAllObjects(bucket, prefix);
	return objects.map((o) => o.key);
}

/** Path-style list: GET /bucket?list-type=2&prefix= (paginated). */
export async function listObjectsWithPrefix(prefix: string): Promise<string[]> {
	const env = getEnv();
	if (!env.S3_ENDPOINT || !env.S3_BUCKET) {
		return [];
	}
	return listAllObjectKeys(env.S3_BUCKET, prefix);
}

export async function fetchObject(bucket: string, key: string, headers?: HeadersInit): Promise<Response> {
	const env = getEnv();
	const aws = clientForEnv(env);
	return aws.fetch(objectUrl(env, bucket, key), { method: 'GET', headers });
}

export async function getObjectText(key: string): Promise<string> {
	const env = getEnv();
	const res = await fetchObject(env.S3_BUCKET, key);
	if (!res.ok) {
		const t = await res.text();
		throw new Error(`S3 get failed ${res.status}: ${t.slice(0, 200)}`);
	}
	return res.text();
}

function isReadableStream(body: BodyInit): body is ReadableStream<Uint8Array> {
	return typeof body === 'object' && body !== null && 'getReader' in body;
}

export async function putObject(
	bucket: string,
	key: string,
	body: BodyInit,
	contentType: string,
	opts?: { contentLength?: number },
): Promise<void> {
	const env = getEnv();
	const aws = clientForEnv(env, isReadableStream(body) ? { retries: 0 } : undefined);
	const headers: Record<string, string> = { 'Content-Type': contentType };
	if (isReadableStream(body)) {
		// Don't consume the incoming stream just to hash it — S3 accepts UNSIGNED-PAYLOAD on PUT.
		headers['x-amz-content-sha256'] = 'UNSIGNED-PAYLOAD';
	}
	if (opts?.contentLength != null && Number.isFinite(opts.contentLength) && opts.contentLength >= 0) {
		headers['Content-Length'] = String(opts.contentLength);
	}
	const res = await aws.fetch(objectUrl(env, bucket, key), {
		method: 'PUT',
		body,
		headers,
	});
	if (!res.ok) {
		const t = await res.text();
		throw new Error(`S3 put failed ${res.status}: ${t.slice(0, 200)}`);
	}
}

export async function createMultipartUpload(bucket: string, key: string, contentType: string): Promise<string> {
	const env = getEnv();
	const aws = clientForEnv(env);
	const res = await aws.fetch(objectQueryUrl(env, bucket, key, { uploads: '' }), {
		method: 'POST',
		headers: { 'Content-Type': contentType },
	});
	const xml = await res.text();
	if (!res.ok) {
		throw new Error(`S3 create multipart failed ${res.status}: ${xml.slice(0, 200)}`);
	}
	const match = xml.match(/<UploadId>([^<]+)<\/UploadId>/);
	if (!match) {
		throw new Error('S3 create multipart returned no UploadId');
	}
	return decodeXml(match[1]);
}

export async function uploadMultipartPart(
	bucket: string,
	key: string,
	uploadId: string,
	partNumber: number,
	body: BodyInit,
	opts?: { contentLength?: number },
): Promise<string> {
	const env = getEnv();
	const aws = clientForEnv(env, { retries: 0 });
	const headers: Record<string, string> = { 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' };
	if (opts?.contentLength != null && Number.isFinite(opts.contentLength) && opts.contentLength >= 0) {
		headers['Content-Length'] = String(opts.contentLength);
	}
	const res = await aws.fetch(objectQueryUrl(env, bucket, key, { partNumber: String(partNumber), uploadId }), {
		method: 'PUT',
		body,
		headers,
	});
	if (!res.ok) {
		const t = await res.text();
		throw new Error(`S3 upload part failed ${res.status}: ${t.slice(0, 200)}`);
	}
	const etag = res.headers.get('ETag') ?? res.headers.get('etag');
	if (!etag) {
		throw new Error('S3 upload part returned no ETag');
	}
	return etag;
}

export async function completeMultipartUpload(bucket: string, key: string, uploadId: string, parts: S3UploadedPart[]): Promise<void> {
	const env = getEnv();
	const aws = clientForEnv(env);
	const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
	const xml = `<CompleteMultipartUpload>${sorted
		.map((part) => `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${escapeXml(part.etag)}</ETag></Part>`)
		.join('')}</CompleteMultipartUpload>`;
	const res = await aws.fetch(objectQueryUrl(env, bucket, key, { uploadId }), {
		method: 'POST',
		body: xml,
		headers: { 'Content-Type': 'application/xml' },
	});
	const body = await res.text();
	const embedded = s3XmlError(body);
	if (!res.ok || embedded) {
		throw new Error(`S3 complete multipart failed ${res.status}: ${(embedded ?? body).slice(0, 200)}`);
	}
	if (!/<CompleteMultipartUploadResult[\s>]/i.test(body) && !/<ETag>/i.test(body)) {
		throw new Error('S3 complete multipart returned no result');
	}
}

export async function abortMultipartUpload(bucket: string, key: string, uploadId: string): Promise<void> {
	const env = getEnv();
	const aws = clientForEnv(env);
	const res = await aws.fetch(objectQueryUrl(env, bucket, key, { uploadId }), { method: 'DELETE' });
	if (!res.ok && res.status !== 204) {
		const t = await res.text();
		throw new Error(`S3 abort multipart failed ${res.status}: ${t.slice(0, 200)}`);
	}
}

export async function putObjectText(key: string, body: string, contentType: string): Promise<void> {
	const env = getEnv();
	await putObject(env.S3_BUCKET, key, body, contentType);
}

export async function deleteObjectInBucket(bucket: string, key: string): Promise<void> {
	const env = getEnv();
	const aws = clientForEnv(env);
	const res = await aws.fetch(objectUrl(env, bucket, key), { method: 'DELETE' });
	if (!res.ok && res.status !== 204) {
		const t = await res.text();
		throw new Error(`S3 delete failed ${res.status}: ${t.slice(0, 200)}`);
	}
}

export async function deleteObject(key: string): Promise<void> {
	const env = getEnv();
	await deleteObjectInBucket(env.S3_BUCKET, key);
}

export async function copyObject(bucket: string, fromKey: string, toKey: string): Promise<void> {
	const env = getEnv();
	const aws = clientForEnv(env);
	const source = `/${bucket}/${fromKey.split('/').map(encodeURIComponent).join('/')}`;
	const res = await aws.fetch(objectUrl(env, bucket, toKey), {
		method: 'PUT',
		headers: { 'x-amz-copy-source': source },
	});
	if (!res.ok) {
		const t = await res.text();
		throw new Error(`S3 copy failed ${res.status}: ${t.slice(0, 200)}`);
	}
}

export async function objectExists(bucket: string, key: string): Promise<boolean> {
	const env = getEnv();
	const aws = clientForEnv(env);
	const url = objectUrl(env, bucket, key);
	const res = await aws.fetch(url, { method: 'HEAD' });
	if (res.status === 404) return false;
	if (res.ok) return true;
	if (res.status === 405 || res.status === 501) {
		const ranged = await aws.fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
		if (ranged.status === 404) return false;
		return ranged.ok || ranged.status === 206;
	}
	return false;
}

function sanitizeContentDispositionFilename(name: string): string {
	return name.replace(/["\\\r\n]/g, '_');
}

export async function presignUrl(
	bucket: string,
	key: string,
	method: 'GET' | 'PUT',
	opts?: { filename?: string; expiresSec?: number },
): Promise<string> {
	const env = getEnv();
	const aws = clientForEnv(env);
	const url = new URL(objectUrl(env, bucket, key));
	url.searchParams.set('X-Amz-Expires', String(opts?.expiresSec ?? PRESIGN_EXPIRES_SEC));
	if (method === 'GET' && opts?.filename) {
		const ascii = sanitizeContentDispositionFilename(opts.filename);
		url.searchParams.set(
			'response-content-disposition',
			`attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(opts.filename)}`,
		);
	}
	const signed = await aws.sign(url.toString(), { method, aws: { signQuery: true } });
	return signed.url;
}

export function slugFromPostKey(key: string): string {
	return key.slice(POSTS_PREFIX.length).replace(/\.mdx$/, '');
}

export function postKeyFromSlug(slug: string): string {
	const safe = slug.replace(/[^a-zA-Z0-9-_]/g, '');
	return `${POSTS_PREFIX}${safe}.mdx`;
}
