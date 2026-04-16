import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

import { env } from '@/env';

export function createS3Client() {
	return new S3Client({
		endpoint: env.S3_ENDPOINT,
		region: 'auto',
		credentials: {
			accessKeyId: env.S3_ACCESS_KEY,
			secretAccessKey: env.S3_SECRET_KEY,
		},
		forcePathStyle: true,
	});
}

const mdxCache = new Map<string, string>();

export function getMdxCache() {
	return mdxCache;
}

async function fetchAllMdxFromS3() {
	const client = createS3Client();
	const bucket = env.S3_BUCKET;
	const keys: string[] = [];
	let continuationToken: string | undefined;

	do {
		const listed = await client.send(
			new ListObjectsV2Command({
				Bucket: bucket,
				Prefix: 'mdx/',
				ContinuationToken: continuationToken,
			}),
		);

		for (const item of listed.Contents ?? []) {
			if (item.Key?.endsWith('.mdx')) {
				keys.push(item.Key);
			}
		}

		continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
	} while (continuationToken);

	await Promise.all(
		keys.map(async (key) => {
			const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
			const body = await object.Body?.transformToString('utf-8');
			if (body !== undefined) {
				mdxCache.set(key, body);
			}
		}),
	);
}

export async function initMdxCache() {
	await fetchAllMdxFromS3();
}

export async function refreshMdxCache() {
	mdxCache.clear();
	await fetchAllMdxFromS3();
}
