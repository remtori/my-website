declare module 'consts/version' {
	const value: string;
	export default value;
}

declare module 'consts/prerender' {
	const value: boolean;
	export default value;
}

declare module 'consts/dev' {
	const value: boolean;
	export default value;
}

declare module 'preact-markup' {
	import { h, Component, AnyComponent } from 'preact';

	export default class Markup extends Component<
	{
		markup: string;
		wrap?: boolean;
		type?: 'xml' | 'html';
		trim?: boolean | 'all';
		components?: AnyComponent;
		reviver?: typeof h;
		onError?: (e: Error) => void;
		'allow-scripts'?: boolean;
		'allow-events'?: boolean;
	}
	>
	{
		render();
	}
}

declare module 'highlight.js/lib/highlight.js' {
	export const highlightAuto: (s: string) => ({ value: string });
	export const registerLanguage: (l: string, f: any) => void;
}

declare module '*.png' {
	const value: string;
	export default value;
}

declare function requestIdleCallback(fn: () => any, options: { timeout: number }): number;
declare function cancelIdleCallback(id: any): void;
