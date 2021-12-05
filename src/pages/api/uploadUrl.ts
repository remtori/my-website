import { presignUploadUrl, s3PathToUrl, getPermLevel } from '~/lib/util.server';
import { NextApiRequest, NextApiResponse } from 'next';
import { isAbsolute } from 'path';

export const config = {
	bodyParser: {
		sizeLimit: '1kb',
	},
};

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
	if (request.method !== 'POST') return response.status(403).json({ error: 403, message: 'Method Not Allowed' });

	const { idToken, path } = request.body;
	if (typeof idToken !== 'string' || typeof path !== 'string')
		return response.status(401).json({ message: 'Unauthorized' });

	if (!isAbsolute(path)) return response.status(400).json({ error: 400, message: 'Bad Request' });

	const s3Path = path[0] === '/' ? path.slice(1) : path;
	const permLevel = await getPermLevel(idToken);
	if (permLevel < 1) {
		return response.status(403).json({ error: 403, message: 'Forbbiden' });
	}

	await presignUploadUrl(s3Path)
		.then((uploadUrl) =>
			response.status(200).json({
				uploadUrl,
				downloadUrl: s3PathToUrl(s3Path),
			})
		)
		.catch((error) => response.status(500).json({ error, message: 'Internal Server Error', signPath: s3Path }));
}
