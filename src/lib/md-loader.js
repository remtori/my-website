const frontMatter = require('front-matter');
const Markdown = require('markdown-it');
const highlightjs = require('markdown-it-highlightjs');
const { definer: hljsGraphQL } = require('highlightjs-graphql');

const mdProcessor = Markdown()
	.use(highlightjs, {
		auto: false,
		register: {
			'graphql': hljsGraphQL,
		}
	});

const stringify = (src) => JSON.stringify(src).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

module.exports = function (source) {
	if (this.cacheable) this.cacheable();

	let exported = '';
	const addProperty = (key, value) => {
		exported += `\n${key}: ${value},`;
	};

	const fm = frontMatter(source);
	const html = mdProcessor.render(fm.body).toString();

	addProperty('attributes', stringify(fm.attributes));
	addProperty('html', stringify(html));

	return `module.exports = { ${exported} }`;
}
