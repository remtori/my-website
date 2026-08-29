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

function skipIsolation(url: URL): boolean {
	return url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/admin');
}

function isolateIfNeeded(url: URL, response: Response): Response {
	if (skipIsolation(url)) return response;
	return withCrossOriginIsolation(response);
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
			return isolateIfNeeded(
				url,
				new Response(hit.body, {
					status: hit.status,
					statusText: hit.statusText,
					headers: new Headers(hit.headers),
				}),
			);
		}
	}

	if (requiresAdminSession(url)) {
		const env = getEnv();
		const raw = getSessionCookieFromRequest(context.request);
		const ok = await verifySessionValue(raw, env.SESSION_SECRET);
		if (!ok) {
			if (url.pathname.startsWith('/api/admin/')) {
				return isolateIfNeeded(
					url,
					new Response('Unauthorized', {
						status: 401,
						headers: { 'Content-Type': 'text/plain; charset=utf-8' },
					}),
				);
			}
			return isolateIfNeeded(url, Response.redirect(new URL('/admin/login', url), 302));
		}
	}

	const response = isolateIfNeeded(url, await next());

	if (isPublicCacheableGet(url, context.request.method) && response.ok) {
		const cacheReq = cacheablePublicRequest(context.request);
		await getCache().put(cacheReq, response.clone());
	}

	return response;
};
