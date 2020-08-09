import prerender from 'consts/prerender';

type LazilyHandler = number;

export function lazily(callback: () => void): LazilyHandler {
	if (prerender)
		return 0;

	if (typeof requestIdleCallback === 'function') {
		return requestIdleCallback(callback, { timeout: 10000 });
	}

	return setTimeout(callback, 10000);
}

export function cancelLazily(id: LazilyHandler): void {
	if (typeof cancelIdleCallback === 'function') {
		cancelIdleCallback(id);
	} else {
		clearTimeout(id);
	}
}

