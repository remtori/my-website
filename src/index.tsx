import { h, render, hydrate } from 'preact';
import App from './components/App';
import dev from 'consts/dev';

import './global.scss';

function init() {
	const entry = document.getElementById('app') as HTMLDivElement;

	if (!dev) {
		hydrate(<App />, entry);
	}

	if (dev) {
		entry.innerText = '';
		render(<App />, entry);
		// @ts-ignore
		require('preact/debug');
	}
}

requestAnimationFrame(init);
