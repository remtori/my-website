const CACHE_NAME = 'remtori-shell-v2';
const PRECACHE_ASSETS = [
	'/favicon.ico',
	'/manifest.webmanifest',
	'/apple-touch-icon.png',
	'/android-chrome-192x192.png',
	'/android-chrome-512x512.png',
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll(PRECACHE_ASSETS))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
			.then(() => self.clients.claim()),
	);
});

function isApiRequest(url) {
	return url.pathname.startsWith('/api/');
}

function shouldCacheResponse(response) {
	return response.status === 200 && response.type !== 'opaque';
}

function fetchAndUpdateCache(request) {
	return fetch(request).then((response) => {
		if (shouldCacheResponse(response)) {
			const clone = response.clone();
			caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
		}
		return response;
	});
}

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Only handle same-origin requests
	if (url.origin !== self.location.origin) {
		return;
	}

	if (request.method !== 'GET' || isApiRequest(url)) {
		// Network-only for mutations and API requests.
		return;
	}

	event.respondWith(fetchAndUpdateCache(request).catch(() => caches.match(request)));
});
