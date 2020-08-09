import { h } from 'preact';
import App from './components/App';

type RenderFn = (vNode: preact.ComponentChild) => void;

export function renderHTML(url: string, render: RenderFn) {
	return Promise.resolve(render(<App url={url} />));
}
