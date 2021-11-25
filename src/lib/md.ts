import headMatter from 'gray-matter';
import { remark } from 'remark';
import remarkHtml from 'remark-html';
import remarkPrism from 'remark-prism';

const processor = remark()
	.use(remarkHtml, { sanitize: false }) // Required to work with remark-prism
	.use(remarkPrism, {
		plugins: ['diff-highlight', 'line-numbers'],
	});

export async function renderMarkdown(markdown: string): Promise<{ meta: Record<string, any>; html: string }> {
	const { data, content } = headMatter(markdown);
	const result = await processor.process(content);

	return { meta: data, html: result.toString() };
}
