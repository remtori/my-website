import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { s3Client, firebase } from './server-sdk';
import { posix } from 'path';

export const getPermLevel = (idToken: string) =>
	getAuth(firebase)
		.verifyIdToken(idToken)
		.then((decodedIdToken) => getFirestore(firebase).doc(`data/perm/${decodedIdToken.uid}`).get())
		.then((perm) => Number(perm.get('permLevel')) ?? 0);

const PRESIGN_URL_EXPIRE_TIME = 8 * 60 * 60;

export const presignUploadUrl = (path: string) =>
	s3Client.presignedPutObject(process.env.S3_BUCKET, path, PRESIGN_URL_EXPIRE_TIME);

export const s3PathToUrl = (path: string) => {
	const prefix = process.env.S3_CDN_PREFIX;
	path = path.startsWith('/') ? path.slice(1) : path;
	return prefix.endsWith('/') ? prefix + path : prefix + '/' + path;
};

export const readS3FileFromPath = (resolvedPath: string): Promise<string> =>
	fetch(s3PathToUrl(resolvedPath))
		.then((resp) => new Promise((resolve, reject) => resp.text().then(resp.ok ? resolve : reject)));

export const resolvePath = async (path: string): Promise<string> => {
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

		stream.on('end', () => resolve(path + '/index.md'));
		stream.on('error', reject);
	});
};
