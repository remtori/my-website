import { env as workerEnv } from 'cloudflare:workers';

/** Cloudflare Worker bindings (see wrangler.jsonc). */
export function getEnv(): Env {
	return workerEnv as Env;
}
