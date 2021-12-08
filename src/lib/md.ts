import headMatter from 'gray-matter';
import Markdown from 'markdown-it';
import highlightjs from 'markdown-it-highlightjs';

const processor = Markdown()
	.use(highlightjs, {});

export async function renderMarkdown(markdown: string): Promise<{ meta: Record<string, any>; html: string }> {
	const { data, content } = headMatter(markdown);
	const result = await processor.render(content);

	return { meta: data, html: result.toString() };
}
