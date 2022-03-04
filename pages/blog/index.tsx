import type { GetStaticProps } from 'next';
import { Listing } from '~/components/Listing';

type BlogItem = { attributes: ContentMeta; html: string; slug: string };

function importBlogs(): Promise<BlogItem[]> {
	// https://medium.com/@shawnstern/importing-multiple-markdown-files-into-a-react-component-with-webpack-7548559fce6f
	// second flag in require.context function is if subdirectories should be searched
	const markdownFiles = require
		.context('../../content/blog', false, /\.md$/)
		.keys()
		.map(relPath => relPath.substring(2)) // remove ./
		.filter(path => path.indexOf('/') === -1); // remove the absolute path

	return Promise.all(
		markdownFiles.map(async (path: string) => {
			const markdown = await import(`../../content/blog/${path}`);
			return { ...markdown, slug: path.substring(0, path.length - 3) };
		})
	);
}

export const getStaticProps: GetStaticProps = async (ctx) => {
	const blogs = await importBlogs();
	blogs.sort((a, b) => new Date(b.attributes.date).getTime() - new Date(a.attributes.date).getTime());

	return {
		props: {
			list: blogs,
		}
	};
};

export default Listing;
