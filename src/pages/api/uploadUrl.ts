import { verifyAdmin } from '~/lib/firebase';
import { presignUploadUrl } from '~/lib/s3';
import { NextApiRequest, NextApiResponse } from 'next';
import { isAbsolute, posix } from 'path';

export const config = {
	bodyParser: {
		sizeLimit: '1kb',
	},
};

export default async (request: NextApiRequest, response: NextApiResponse) => {
	if (request.method !== 'POST') return response.status(403).json({ message: 'Method Not Allowed' });

	const { idToken, path } = request.body;
	if (typeof idToken !== 'string' || typeof path !== 'string')
		return response.status(401).json({ message: 'Unauthorized' });

	const isAdmin = await verifyAdmin(idToken);
	if (!isAdmin) return response.status(403).json({ message: 'Forbbiden' });

	if (!isAbsolute(path) || !path.startsWith('/gz')) return response.status(400).json({ message: 'Bad Request' });

	presignUploadUrl(path)
		.then((uploadUrl) =>
			response.status(200).json({
				uploadUrl,
				downloadUrl: posix.join(process.env.S3_CDN_PREFIX!, path),
			})
		)
		.catch((error) => response.status(500).json({ error }));
};
