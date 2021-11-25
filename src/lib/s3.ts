import { Client } from 'minio';

const PRESIGN_URL_EXPIRE_TIME = 8 * 60 * 60;

export const s3Client = new Client({
	endPoint: process.env.S3_API_ENDPOINT!,
	accessKey: process.env.S3_API_KEY!,
	secretKey: process.env.S3_API_SECRET!,
});

export const presignUploadUrl = (path: string) =>
	s3Client.presignedPutObject(process.env.S3_BUCKET as string, path, PRESIGN_URL_EXPIRE_TIME);
