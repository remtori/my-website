import type { GetStaticPaths, GetStaticProps } from 'next';
import { Content } from '~/components/Content';

export const getStaticProps: GetStaticProps = async ({ params }) => {
	const slug = params!.slug;
	const content = await import(`@content/blog/${slug}.md`).catch((error) => null);

	return {
		props: {
			meta: content.attributes,
			html: content.html,
			path: `blog/${slug}.md`,
		}
	};
};

export const getStaticPaths: GetStaticPaths = async () => {
	const fs = require('fs');
	const paths: string[] =
		fs.readdirSync(`./content/blog`) // relative to project root
			.map((slug: string) => slug.replace(/\.md$/, ''));

	return {
		paths: paths.map(slug => ({ params: { slug } })),
		fallback: false,
	}
}

export default Content;
