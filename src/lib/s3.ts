import { AwsClient } from 'aws4fetch';

import { getEnv } from './runtime';

export const POSTS_PREFIX = 'mdx/posts/';

function clientForEnv(env: Env): AwsClient {
	return new AwsClient({
		accessKeyId: env.S3_ACCESS_KEY_ID,
		secretAccessKey: env.S3_SECRET_ACCESS_KEY,
		service: 's3',
		region: 'auto',
	});
}

function bucketRootUrl(env: Env): string {
	const base = env.S3_ENDPOINT.replace(/\/$/, '');
	return `${base}/${env.S3_BUCKET}`;
}

/** Path-style list: GET /bucket?list-type=2&prefix= */
export async function listObjectsWithPrefix(prefix: string): Promise<string[]> {
	const env = getEnv();
	if (!env.S3_ENDPOINT || !env.S3_BUCKET) {
		return [];
	}
	const url = new URL(bucketRootUrl(env));
	url.searchParams.set('list-type', '2');
	url.searchParams.set('prefix', prefix);
	const aws = clientForEnv(env);
	const res = await aws.fetch(url.toString(), { method: 'GET' });
	if (!res.ok) {
		const t = await res.text();
		throw new Error(`S3 list failed ${res.status}: ${t.slice(0, 200)}`);
	}
	const xml = await res.text();
	const keys: string[] = [];
	for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) {
		keys.push(m[1]);
	}
	return keys;
}

export async function listPostKeys(): Promise<string[]> {
	const keys = await listObjectsWithPrefix(POSTS_PREFIX);
	return keys.filter((k) => k.endsWith('.mdx'));
}

export async function getObjectText(key: string): Promise<string> {
	const env = getEnv();
	const url = `${bucketRootUrl(env)}/${key.split('/').map(encodeURIComponent).join('/')}`;
	const aws = clientForEnv(env);
	const res = await aws.fetch(url, { method: 'GET' });
	if (!res.ok) {
		const t = await res.text();
		throw new Error(`S3 get failed ${res.status}: ${t.slice(0, 200)}`);
	}
	return res.text();
}

export async function putObjectText(key: string, body: string, contentType: string): Promise<void> {
	const env = getEnv();
	const url = `${bucketRootUrl(env)}/${key.split('/').map(encodeURIComponent).join('/')}`;
	const aws = clientForEnv(env);
	const res = await aws.fetch(url, {
		method: 'PUT',
		body,
		headers: { 'Content-Type': contentType },
	});
	if (!res.ok) {
		const t = await res.text();
		throw new Error(`S3 put failed ${res.status}: ${t.slice(0, 200)}`);
	}
}

export async function deleteObject(key: string): Promise<void> {
	const env = getEnv();
	const url = `${bucketRootUrl(env)}/${key.split('/').map(encodeURIComponent).join('/')}`;
	const aws = clientForEnv(env);
	const res = await aws.fetch(url, { method: 'DELETE' });
	if (!res.ok && res.status !== 204) {
		const t = await res.text();
		throw new Error(`S3 delete failed ${res.status}: ${t.slice(0, 200)}`);
	}
}

export function slugFromPostKey(key: string): string {
	return key.slice(POSTS_PREFIX.length).replace(/\.mdx$/, '');
}

export function postKeyFromSlug(slug: string): string {
	const safe = slug.replace(/[^a-zA-Z0-9-_]/g, '');
	return `${POSTS_PREFIX}${safe}.mdx`;
}
