// Offline support for remtori.com.
//
// Bump VERSION to evict every cache on the next activate. That matters for more
// than freshness: a response cached before a header policy changed would keep
// replaying the old headers, and cross-origin isolation (which /tools/imgconv
// needs for SharedArrayBuffer) rides on those headers. Cached responses keep
// the headers they were stored with, so isolation survives being served from
// here — but only if what is stored is current.
const VERSION = 'v4';

const SHELL_CACHE = `remtori-shell-${VERSION}`;
const ASSET_CACHE = `remtori-assets-${VERSION}`;
const PAGE_CACHE = `remtori-pages-${VERSION}`;
const CURRENT_CACHES = new Set([SHELL_CACHE, ASSET_CACHE, PAGE_CACHE]);

const PRECACHE_ASSETS = [
	'/',
	'/favicon.ico',
	'/manifest.webmanifest',
	'/apple-touch-icon.png',
	'/android-chrome-192x192.png',
	'/android-chrome-512x512.png',
];

// Built by Astro and Vite with a content hash in the filename, so a given URL
// can never change meaning. Safe to serve from cache without revalidating.
function isImmutableAsset(pathname) {
	return pathname.startsWith('/_astro/');
}

// Fixed filenames shipped by the wasm-vips package. Not hashed, so revalidate
// in the background rather than trusting the cache forever.
function isVendorAsset(pathname) {
	return pathname.startsWith('/vendor/');
}

// Authenticated or dynamic: never stored, never served from cache.
function isPrivate(pathname) {
	return pathname.startsWith('/api/') || pathname.startsWith('/admin');
}

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(SHELL_CACHE)
			.then((cache) => cache.addAll(PRECACHE_ASSETS))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((key) => !CURRENT_CACHES.has(key)).map((key) => caches.delete(key))))
			.then(() => self.clients.claim()),
	);
});

function putIfOk(cacheName, request, response) {
	if (response && response.status === 200 && response.type !== 'opaque') {
		const clone = response.clone();
		caches.open(cacheName).then((cache) => cache.put(request, clone));
	}
	return response;
}

// Serve immediately, refresh in the background.
async function staleWhileRevalidate(cacheName, request) {
	const cached = await caches.match(request);
	const network = fetch(request)
		.then((response) => putIfOk(cacheName, request, response))
		.catch(() => undefined);

	return cached ?? (await network) ?? Response.error();
}

async function cacheFirst(cacheName, request) {
	const cached = await caches.match(request);
	if (cached) return cached;

	try {
		return putIfOk(cacheName, request, await fetch(request));
	} catch {
		return Response.error();
	}
}

// Documents change on every deploy and carry the hashed asset URLs, so the
// network wins whenever it is reachable; the cache is the offline fallback.
async function networkFirst(request) {
	try {
		return putIfOk(PAGE_CACHE, request, await fetch(request));
	} catch {
		const cached = await caches.match(request);
		if (cached) return cached;

		const shell = await caches.match('/');
		if (shell) return shell;

		return Response.error();
	}
}

self.addEventListener('fetch', (event) => {
	const { request } = event;

	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;
	if (isPrivate(url.pathname)) return;

	if (request.mode === 'navigate' || request.destination === 'document') {
		event.respondWith(networkFirst(request));
		return;
	}

	if (isImmutableAsset(url.pathname)) {
		event.respondWith(cacheFirst(ASSET_CACHE, request));
		return;
	}

	if (isVendorAsset(url.pathname)) {
		event.respondWith(staleWhileRevalidate(ASSET_CACHE, request));
		return;
	}

	event.respondWith(staleWhileRevalidate(SHELL_CACHE, request));
});
