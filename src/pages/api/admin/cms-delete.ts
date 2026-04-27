import type { APIRoute } from 'astro';

import { getPostRelatedCacheUrls, purgeCacheUrls } from '@/lib/cache';
import { deleteFileIndexEntry } from '@/lib/file-index';
import { getCache } from '@/lib/runtime';
import { deleteObject } from '@/lib/s3';

export const POST: APIRoute = async ({ request }) => {
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return Response.redirect(new URL('/admin?err=1', request.url), 302);
	}

	const key = String(form.get('key') ?? '').trim();

	if (!key.startsWith('mdx/') || key.includes('..')) {
		return Response.redirect(new URL('/admin?err=1', request.url), 302);
	}

	try {
		await deleteObject(key);
	} catch {
		return Response.redirect(new URL('/admin?err=1', request.url), 302);
	}

	// Write-through to KV cache (silent failure)
	await deleteFileIndexEntry(key);

	// Purge affected pages from edge cache
	const origin = new URL(request.url).origin;
	const urls = await getPostRelatedCacheUrls(origin, key);
	await purgeCacheUrls(getCache(), urls);

	return Response.redirect(new URL('/admin?deleted=1', request.url), 302);
};
