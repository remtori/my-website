// Generated / augmented for Wrangler; Env matches wrangler bindings.

/** Cloudflare Workers edge cache (extends standard CacheStorage). */
interface CacheStorage {
	readonly default: Cache;
}

interface Env {
	SESSION: KVNamespace;
	ASSETS: Fetcher;
	ADMIN_PASSWORD: string;
	SESSION_SECRET: string;
	S3_ENDPOINT: string;
	S3_BUCKET: string;
	S3_ACCESS_KEY_ID: string;
	S3_SECRET_ACCESS_KEY: string;
}
