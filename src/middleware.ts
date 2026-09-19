import type { MiddlewareHandler } from 'astro';

import { cacheableRequestForUrl } from '@/lib/cache';
import { getCache, getEnv } from '@/lib/runtime';
import { getSessionCookieFromRequest, verifySessionValue } from '@/lib/session';

function cacheablePublicRequest(req: Request): Request {
	return cacheableRequestForUrl(req.url);
}

function isPublicCacheableGet(url: URL, method: string): boolean {
	return method === 'GET' && !url.pathname.startsWith('/admin') && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/_');
}

function withCrossOriginIsolation(response: Response): Response {
	const headers = new Headers(response.headers);
	headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
	headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	headers.set('Cross-Origin-Resource-Policy', 'same-origin');

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

// Every document on this origin is isolated, with no exceptions.
//
// Isolation is fixed when a document is created, and <ClientRouter /> navigates
// client-side — the document is never recreated. So a single non-isolated entry
// point (/admin used to be one) leaves `crossOriginIsolated` false for the whole
// session, including after navigating to /tools/imgconv, whose wasm engine needs
// SharedArrayBuffer. Admin loads nothing cross-origin (S3 objects are proxied
// through /api/admin/fs/get, same-origin), so there is nothing to exempt.

// Matches the edge TTL the zone applied before this was set explicitly, so the
// stored copy keeps behaving as it did. Purging stays manual (see /admin).
const EDGE_TTL_SECONDS = 14400;

function isHtml(response: Response): boolean {
	return (response.headers.get('Content-Type') ?? '').includes('text/html');
}

function withCacheControl(response: Response, value: string): Response {
	const headers = new Headers(response.headers);
	headers.set('Cache-Control', value);

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

// The cross-origin isolation headers and the hashed asset URLs both travel with
// the document, so a browser replaying a stale copy runs the old policy for as
// long as that copy stays fresh. `no-cache` still stores it — it just forces a
// revalidation, so the document can never drift from the headers it needs.
function withDocumentRevalidation(response: Response): Response {
	if (!isHtml(response)) return response;
	return withCacheControl(response, 'no-cache');
}

// The copy kept at the edge keeps a real TTL, otherwise caches.default would
// treat it as immediately stale and every request would fall through to origin.
function forEdgeCache(response: Response): Response {
	if (!isHtml(response)) return response;
	return withCacheControl(response, `public, max-age=${EDGE_TTL_SECONDS}`);
}

function requiresAdminSession(url: URL): boolean {
	if (url.pathname === '/admin/login') {
		return false;
	}
	if (url.pathname.startsWith('/admin')) {
		return true;
	}
	if (url.pathname.startsWith('/api/admin/') && url.pathname !== '/api/admin/login') {
		return true;
	}
	return false;
}

export const onRequest: MiddlewareHandler = async (context, next) => {
	const url = new URL(context.url);

	if (isPublicCacheableGet(url, context.request.method)) {
		const cacheReq = cacheablePublicRequest(context.request);
		const hit = await getCache().match(cacheReq);
		if (hit) {
			// Rebuild with mutable headers — Astro's render loop mutates
			// response headers (e.g. attaching cookies / deleting ROUTE_TYPE_HEADER).
			return withDocumentRevalidation(
				withCrossOriginIsolation(
					new Response(hit.body, {
						status: hit.status,
						statusText: hit.statusText,
						headers: new Headers(hit.headers),
					}),
				),
			);
		}
	}

	if (requiresAdminSession(url)) {
		const env = getEnv();
		const raw = getSessionCookieFromRequest(context.request);
		const ok = await verifySessionValue(raw, env.SESSION_SECRET);
		if (!ok) {
			if (url.pathname.startsWith('/api/admin/')) {
				return withCrossOriginIsolation(
					new Response('Unauthorized', {
						status: 401,
						headers: { 'Content-Type': 'text/plain; charset=utf-8' },
					}),
				);
			}
			return withCrossOriginIsolation(Response.redirect(new URL('/admin/login', url), 302));
		}
	}

	const response = withCrossOriginIsolation(await next());

	if (isPublicCacheableGet(url, context.request.method) && response.ok) {
		const cacheReq = cacheablePublicRequest(context.request);
		await getCache().put(cacheReq, forEdgeCache(response.clone()));
	}

	return withDocumentRevalidation(response);
};
