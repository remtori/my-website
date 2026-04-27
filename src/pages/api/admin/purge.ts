import type { APIRoute } from 'astro';

import { getAllContentCacheUrls, purgeCacheUrls } from '@/lib/cache';
import { getCache } from '@/lib/runtime';

export const POST: APIRoute = async ({ request }) => {
	const origin = new URL(request.url).origin;
	const urls = await getAllContentCacheUrls(origin);
	const deleted = await purgeCacheUrls(getCache(), urls);
	return Response.redirect(new URL(`/admin?done=${deleted}`, request.url), 302);
};
