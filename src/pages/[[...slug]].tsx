import type { GetStaticPaths, GetStaticProps } from 'next';
import { Content } from '~/components/Content';
import { renderMarkdown } from '~/lib/md';
import { readS3FileFromPath, resolvePath, listPaths } from '~/lib/api.server';

export const getStaticProps: GetStaticProps = async ({ params }) => {
	const slug = params!.slug;
	const path = Array.isArray(slug) ? slug.join('/') : '/';

	try {
		const resolvedPath = await resolvePath(path);
		if (!resolvedPath) {
			console.log(`No file found for: ${path}`);
			return { notFound: true };
		}

		const content = await readS3FileFromPath(resolvedPath);
		const { meta, html } = await renderMarkdown(content);

		return {
			props: {
				meta,
				html,
				path: resolvedPath,
			},
			revalidate: 30 * 60,
		};
	} catch (err) {
		console.log(`Error render ${slug} -> ${path}: `, err);
		return { notFound: true, revalidate: 5 * 60 };
	}
};

export const getStaticPaths: GetStaticPaths = async () => {
	const paths = await listPaths();

	console.log('Static Paths: ', paths);

	return {
		paths: paths.map((path) => ({ params: { slug: [path] } })),
		fallback: true,
	};
};

export default Content;
