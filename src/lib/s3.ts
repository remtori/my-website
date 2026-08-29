import { AwsClient } from 'aws4fetch';

import { getEnv } from './runtime';

export const POSTS_PREFIX = 'mdx/blogs/';

const PRESIGN_EXPIRES_SEC = 900;

function clientForEnv(env: Env): AwsClient {
	return new AwsClient({
		accessKeyId: env.S3_ACCESS_KEY_ID,
		secretAccessKey: env.S3_SECRET_ACCESS_KEY,
		service: 's3',
		region: 'auto',
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

function decodeXml(s: string): string {
	return s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');
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

export async function putObject(bucket: string, key: string, body: BodyInit, contentType: string): Promise<void> {
	const env = getEnv();
	const aws = clientForEnv(env);
	const res = await aws.fetch(objectUrl(env, bucket, key), {
		method: 'PUT',
		body,
		headers: { 'Content-Type': contentType },
	});
	if (!res.ok) {
		const t = await res.text();
		throw new Error(`S3 put failed ${res.status}: ${t.slice(0, 200)}`);
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
