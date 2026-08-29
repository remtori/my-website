import type { S3ListPage } from './types';

async function parseJson<T>(res: Response): Promise<T> {
	const data: unknown = await res.json().catch(() => ({}));
	if (!res.ok) {
		const message =
			data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : `HTTP ${res.status}`;
		throw new Error(message);
	}
	return data as T;
}

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };

export const fsApi = {
	async buckets(): Promise<{ buckets: string[]; fallback: boolean; defaultBucket: string }> {
		return parseJson(await fetch('/api/admin/fs/buckets'));
	},

	async list(bucket: string, prefix: string, token?: string, recursive = false): Promise<S3ListPage> {
		const url = new URL('/api/admin/fs/list', window.location.origin);
		url.searchParams.set('bucket', bucket);
		url.searchParams.set('prefix', prefix);
		if (token) url.searchParams.set('token', token);
		if (recursive) url.searchParams.set('recursive', '1');
		return parseJson(await fetch(url));
	},

	async exists(bucket: string, keys: string[]): Promise<string[]> {
		const existing: string[] = [];
		for (let i = 0; i < keys.length; i += 40) {
			const chunk = keys.slice(i, i + 40);
			const data = await parseJson<{ existing: string[] }>(
				await fetch('/api/admin/fs/exists', {
					method: 'POST',
					headers: JSON_HEADERS,
					body: JSON.stringify({ bucket, keys: chunk }),
				}),
			);
			existing.push(...data.existing);
		}
		return existing;
	},

	async presign(
		bucket: string,
		method: 'GET' | 'PUT',
		items: { key: string; filename?: string }[],
	): Promise<{ key: string; url: string }[]> {
		const urls: { key: string; url: string }[] = [];
		for (let i = 0; i < items.length; i += 50) {
			const chunk = items.slice(i, i + 50);
			const data = await parseJson<{ urls: { key: string; url: string }[] }>(
				await fetch('/api/admin/fs/presign', {
					method: 'POST',
					headers: JSON_HEADERS,
					body: JSON.stringify({ bucket, method, items: chunk }),
				}),
			);
			urls.push(...data.urls);
		}
		return urls;
	},

	async deleteKeys(bucket: string, keys: string[]): Promise<void> {
		for (let i = 0; i < keys.length; i += 40) {
			const chunk = keys.slice(i, i + 40);
			await parseJson(
				await fetch('/api/admin/fs/delete', {
					method: 'POST',
					headers: JSON_HEADERS,
					body: JSON.stringify({ bucket, keys: chunk }),
				}),
			);
		}
	},

	async mkdir(bucket: string, key: string): Promise<void> {
		await parseJson(
			await fetch('/api/admin/fs/mkdir', {
				method: 'POST',
				headers: JSON_HEADERS,
				body: JSON.stringify({ bucket, key }),
			}),
		);
	},

	async move(bucket: string, items: { from: string; to: string }[]): Promise<void> {
		for (let i = 0; i < items.length; i += 20) {
			const chunk = items.slice(i, i + 20);
			await parseJson(
				await fetch('/api/admin/fs/move', {
					method: 'POST',
					headers: JSON_HEADERS,
					body: JSON.stringify({ bucket, items: chunk }),
				}),
			);
		}
	},

	async listAllKeys(bucket: string, prefix: string): Promise<string[]> {
		const keys: string[] = [];
		let token: string | undefined;
		do {
			const page = await fsApi.list(bucket, prefix, token, true);
			for (const obj of page.objects) keys.push(obj.key);
			token = page.nextToken;
		} while (token);
		return keys;
	},

	objectUrl(bucket: string, key: string): string {
		const url = new URL('/api/admin/fs/get', window.location.origin);
		url.searchParams.set('bucket', bucket);
		url.searchParams.set('key', key);
		return url.pathname + url.search;
	},

	downloadZip(bucket: string, keys: string[], prefixes: string[]): void {
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '/api/admin/fs/zip';
		form.style.display = 'none';
		const input = document.createElement('input');
		input.name = 'payload';
		input.value = JSON.stringify({ bucket, keys, prefixes });
		form.appendChild(input);
		document.body.appendChild(form);
		form.submit();
		form.remove();
	},
};
