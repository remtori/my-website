import { GetServerSideProps } from 'next';
import { Editor } from '~/components/Editor';
import { streamToString } from '~/lib/util.server';

export const getServerSideProps: GetServerSideProps = async (ctx) => {
	const { path } = ctx.query;
	if (typeof path !== 'string') {
		return {
			props: {
				isNewPage: true,
			},
		};
	}

	let pageContent = '';
	// try {
	// 	pageContent = await streamToString(await s3Client.getObject(process.env.S3_BUCKET, path));
	// } catch (err: any) {
	// 	if (err.code !== 'NoSuchKey') throw err;
	// }

	return {
		props: {
			pageContent,
			path,
		},
	};
};

export default Editor;
