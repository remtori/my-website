/**
 * Local dev only: in-memory `Map` emulating `caches.default` (no `node:fs` — runs in the Worker dev runtime).
 */

const store = new Map<string, CachedEntry>();

function cacheKeyHref(request: Request): string {
	const u = new URL(request.url);
	u.hash = '';
	return u.toString();
}

type CachedEntry = {
	status: number;
	statusText: string;
	headers: [string, string][];
	/** Copy of the response body; sliced on `match` so each hit gets an independent `Response`. */
	body: ArrayBuffer;
};

export async function cacheMatch(request: Request, _init?: CacheQueryOptions): Promise<Response | undefined> {
	const key = cacheKeyHref(request);
	const entry = store.get(key);
	if (!entry) {
		return undefined;
	}
	return new Response(entry.body.slice(0), {
		status: entry.status,
		statusText: entry.statusText,
		headers: new Headers(entry.headers),
	});
}

export async function cachePut(request: Request, response: Response): Promise<void> {
	const key = cacheKeyHref(request);
	const body = await response.arrayBuffer();
	const headers: [string, string][] = [];
	response.headers.forEach((value, k) => {
		headers.push([k, value]);
	});
	store.set(key, {
		status: response.status,
		statusText: response.statusText,
		headers,
		body: body.slice(0),
	});
}

export async function cacheDelete(request: Request, _init?: CacheQueryOptions): Promise<boolean> {
	return store.delete(cacheKeyHref(request));
}
