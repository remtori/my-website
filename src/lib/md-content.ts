import { splitFrontmatter } from './frontmatter';
import { markdownToHtml } from './markdown';
import { getObjectText } from './s3';

export type MdContentResult = {
	html: string;
	title: string;
	date?: string;
	found: boolean;
};

export async function loadMdFromS3(s3Path: string): Promise<MdContentResult> {
	try {
		const raw = await getObjectText(s3Path);
		const { data, content } = splitFrontmatter(raw);
		const html = await markdownToHtml(content);
		return {
			html,
			title: data.title ? String(data.title) : s3Path,
			date: data.date ? String(data.date) : undefined,
			found: true,
		};
	} catch {
		return { html: '', title: s3Path, found: false };
	}
}
