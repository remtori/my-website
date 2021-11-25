declare module 'remark-prism' {
	import { Plugin } from 'unified';

	type Prism = Plugin<[Options?]>;

	type PrismPlugin =
		| 'autolinker'
		| 'command-line'
		| 'data-uri-highlight'
		| 'diff-highlight'
		| 'inline-color'
		| 'keep-markup'
		| 'line-numbers'
		| 'show-invisibles'
		| 'treeview';

	interface Options {
		transformInlineCode?: boolean | undefined;
		plugins?: PrismPlugin[];
	}

	const prism: Prism;
	export default prism;
}
