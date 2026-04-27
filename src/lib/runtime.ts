import { env as workerEnv } from 'cloudflare:workers';

/** Cloudflare Worker bindings (see wrangler.jsonc). */
export function getEnv(): Env {
	return workerEnv as Env;
}

/** In dev, an in-memory cache (see `runtime.dev.ts`); in prod, `caches.default`. */
export function getCache(): Cache {
	return caches.default;
}
