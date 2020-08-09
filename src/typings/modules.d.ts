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

declare module '*.png' {
	const value: string;
	export default value;
}

declare function requestIdleCallback(fn: () => any, options: { timeout: number }): number;
declare function cancelIdleCallback(id: any): void;

declare function require(path: string): any;