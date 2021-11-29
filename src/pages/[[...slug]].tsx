import { Content } from '~/components/Content';
import { renderMarkdown } from '~/lib/md';
import type { GetServerSideProps } from 'next';
import { readS3FileFromPath } from '~/lib/util.server';

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
	const { slug } = query;
	const path = Array.isArray(slug) ? slug.join('/') : '/';

	try {
		const content = await readS3FileFromPath(path);
		const { meta, html } = await renderMarkdown(content);

		return {
			props: {
				meta,
				html,
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
