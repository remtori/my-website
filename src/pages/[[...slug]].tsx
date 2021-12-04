import type { GetServerSideProps } from 'next';
import { Content } from '~/components/Content';
import { renderMarkdown } from '~/lib/md';
import { readS3FileFromPath, resolvePath } from '~/lib/util.server';

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
	const { slug } = query;
	const path = Array.isArray(slug) ? slug.join('/') : '/';

	try {
		const resolvedPath = await resolvePath(path);
		const content = await readS3FileFromPath(resolvedPath);
		const { meta, html } = await renderMarkdown(content);

		return {
			props: {
				meta,
				html,
				path: resolvePath,
			},
		};
	} catch (err) {
		console.log(`Error render ${slug} -> ${path}: `, err);

		return {
			notFound: true,
		};
	}
};

export default Content;
