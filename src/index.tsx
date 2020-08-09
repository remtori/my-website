import { h, render, hydrate } from 'preact';
import App from './components/App';
import dev from 'consts/dev';

import './global.scss';

function init() {
	const entry = document.getElementById('app') as HTMLDivElement;

	(dev ? render : hydrate)(<App />, entry);
}

requestAnimationFrame(init);
