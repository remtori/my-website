/** Fixed-window counter in KV (best-effort; not strictly atomic). */

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export async function checkKvRateLimit(
	kv: KVNamespace,
	keyPrefix: string,
	clientId: string,
	max: number,
	windowSec: number,
): Promise<RateLimitResult> {
	const now = Math.floor(Date.now() / 1000);
	const bucket = Math.floor(now / windowSec);
	const key = `${keyPrefix}:${clientId}:${String(bucket)}`;
	const raw = await kv.get(key);
	let count = raw ? Number.parseInt(raw, 10) : 0;
	if (!Number.isFinite(count) || count < 0) count = 0;
	if (count >= max) {
		const windowEnd = (bucket + 1) * windowSec;
		return { ok: false, retryAfterSec: Math.max(1, windowEnd - now) };
	}
	await kv.put(key, String(count + 1), { expirationTtl: Math.max(60, windowSec * 2) });
	return { ok: true };
}

export function clientIp(request: Request): string {
	return request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown';
}
