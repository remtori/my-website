declare type ContentMeta = {
	layout: 'content';
	title: string;
	description: string;
	tags: string;
	thumbnail: string;
	date: Date;
};

declare module '*.md' {
	const out: {
		attributes: ContentMeta;
		html: string;
	};

	export default out;
}
