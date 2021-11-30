import { presignUploadUrl, s3PathToUrl, verifyPermLevel } from '~/lib/util.server';
import { NextApiRequest, NextApiResponse } from 'next';
import { isAbsolute, posix } from 'path';

export const config = {
	bodyParser: {
		sizeLimit: '1kb',
	},
};

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
	if (request.method !== 'POST') return response.status(403).json({ message: 'Method Not Allowed' });

	const { idToken, path } = request.body;
	if (typeof idToken !== 'string' || typeof path !== 'string')
		return response.status(401).json({ message: 'Unauthorized' });

	const canUpload = await verifyPermLevel(idToken, 1);
	if (!canUpload) return response.status(403).json({ message: 'Forbbiden' });

	if (!isAbsolute(path)) return response.status(400).json({ message: 'Bad Request' });

	const s3Path = posix.join(process.env.S3_OBJECT_PREFIX, path);
	await presignUploadUrl(s3Path)
		.then((uploadUrl) =>
			response.status(200).json({
				uploadUrl,
				downloadUrl: s3PathToUrl(s3Path),
			})
		)
		.catch((error) => response.status(500).json({ error, signPath: s3Path }));
}
