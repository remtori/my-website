import { env as workerEnv } from 'cloudflare:workers';

/** Cloudflare Worker bindings (see wrangler.jsonc). */
export function getEnv(): Env {
	return workerEnv as Env;
}

/** In dev, an in-memory cache (see `runtime.dev.ts`); in prod, `caches.default`. */
export function getCache(): Cache {
	if (import.meta.env.DEV) {
		return {
			match: (request: Request, init?: CacheQueryOptions) => import('./runtime.dev').then((m) => m.cacheMatch(request, init)),
			put: (request: Request, response: Response) => import('./runtime.dev').then((m) => m.cachePut(request, response)),
			delete: (request: Request, init?: CacheQueryOptions) => import('./runtime.dev').then((m) => m.cacheDelete(request, init)),
		} as Cache;
	}
	return caches.default;
}
