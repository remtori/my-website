import { s3Client, auth, firestore } from './server-sdk';
import { posix } from 'path';

export const getPermLevel = (idToken: string) =>
	auth()
		.verifyIdToken(idToken)
		.then((decodedIdToken) => firestore().doc(`data/perm/${decodedIdToken.uid}/permLevel`).get())
		.then((perm) => Number(perm.data()) ?? 0);

const PRESIGN_URL_EXPIRE_TIME = 8 * 60 * 60;

export const presignUploadUrl = (path: string) =>
	s3Client.presignedPutObject(process.env.S3_BUCKET, path, PRESIGN_URL_EXPIRE_TIME);

export const s3PathToUrl = (path: string) => {
	const prefix = process.env.S3_CDN_PREFIX;
	path = path.startsWith('/') ? path.slice(1) : path;
	return prefix.endsWith('/') ? prefix + path : prefix + '/' + path;
};

export const readS3FileFromPath = (resolvedPath: string): Promise<string> =>
	fetch(s3PathToUrl(resolvedPath)).then((resp) => resp.text());

export const resolvePath = async (path: string): Promise<string | undefined> => {
	path = posix.join(process.env.S3_OBJECT_PREFIX, path);

	if (path.endsWith('.md')) return path;

	if (path.endsWith('/')) path = path.slice(0, -1);

	return await new Promise((resolve, reject) => {
		const stream = s3Client.listObjectsV2(process.env.S3_BUCKET, path, true);
		stream.on('data', (item) => {
			if (!item.prefix) {
				if (item.name === path + '.md' || item.name === path + '/index.md') {
					resolve(item.name);
					stream.destroy();
				}
			}
		});

		stream.on('end', () => resolve(undefined));
		stream.on('error', reject);
	});
};

export const listPaths = (): Promise<string[]> => new Promise((resolve, reject) => {
	const out: string[] = [];
	const stream = s3Client.listObjectsV2(process.env.S3_BUCKET, process.env.S3_OBJECT_PREFIX, true);

	stream.on('data', (item) => {
		if (item.prefix) // Folder
			return;

		const parts = posix.parse(item.name);
		if (parts.ext !== '.md')
			return;

		let dir = parts.dir.slice(process.env.S3_OBJECT_PREFIX.length);
		if (dir[0] !== '/')
			dir = '/' + dir;

		if (parts.name === 'index') {
			out.push(dir);
		} else {
			out.push(posix.join(dir, parts.base));
		}
	});

	stream.on('end', () => resolve(out));
	stream.on('error', reject);
})

