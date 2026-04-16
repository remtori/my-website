if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
			console.error('[PWA] Service worker registration failed', err);
		});
	});
}
