import { getFileIndex } from './file-index';
import { POSTS_PREFIX, slugFromPostKey } from './s3';

function normalizeCachePathname(pathname: string): string {
	if (pathname === '/index.html') {
		return '/';
	}
	if (pathname.endsWith('/index.html')) {
		return pathname.slice(0, -'index.html'.length);
	}
	if (pathname.endsWith('.html')) {
		const withoutExtension = pathname.slice(0, -'.html'.length);
		return withoutExtension === '' ? '/' : withoutExtension;
	}
	return pathname;
}

export function cacheableRequestForUrl(url: string): Request {
	const u = new URL(url);
	u.hash = '';
	u.pathname = normalizeCachePathname(u.pathname);
	return new Request(u.toString(), {
		method: 'GET',
		headers: new Headers(),
	});
}

export async function purgeCacheUrls(cache: Cache, urls: string[]): Promise<number> {
	let deleted = 0;
	for (const url of urls) {
		try {
			const ok = await cache.delete(cacheableRequestForUrl(url));
			if (ok) deleted++;
		} catch {
			/* ignore */
		}
	}
	return deleted;
}

function pathFromMdxKey(key: string): string | null {
	if (!key.startsWith('mdx/') || !key.endsWith('.mdx')) {
		return null;
	}
	if (key.startsWith(POSTS_PREFIX)) {
		return `/blog/${slugFromPostKey(key)}`;
	}
	return `/${key.slice(4, -4)}`;
}

export async function getAllContentCacheUrls(origin: string): Promise<string[]> {
	const index = await getFileIndex();
	const urls: string[] = [`${origin}/`, `${origin}/blog`, `${origin}/tools`, `${origin}/tools/imgconv`];

	for (const entry of index) {
		const path = pathFromMdxKey(entry.key);
		if (path) {
			urls.push(`${origin}${path}`);
		}
	}

	return [...new Set(urls)];
}

export async function getPostRelatedCacheUrls(origin: string, key: string): Promise<string[]> {
	const urls: string[] = [`${origin}/`, `${origin}/blog`];

	const path = pathFromMdxKey(key);
	if (path) {
		urls.push(`${origin}${path}`);
	}

	return [...new Set(urls)];
}
