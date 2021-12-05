import { GetServerSideProps } from 'next';
import { Editor } from '~/components/Editor';
import { readS3FileFromPath, resolvePath } from '~/lib/util.server';

export const getServerSideProps: GetServerSideProps = async (ctx) => {
	let { path } = ctx.query;
	if (typeof path !== 'string') {
		return {
			props: {
				isNewPage: true,
				pageContent: '',
			},
		};
	}

	let pageContent = '';
	try {
		pageContent = await readS3FileFromPath(path);
		// console.log(`Edit ${path}:\n${pageContent}`);
	} catch (e) {
		console.log(`Error fetch ${path}:`, e);
	}

	return {
		props: {
			pageContent,
			path,
		},
	};
};

export default Editor;
