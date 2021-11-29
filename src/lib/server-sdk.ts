import { Client as S3Client } from 'minio';
import { cert, initializeApp } from 'firebase-admin/app';

export const s3Client = new S3Client({
	endPoint: process.env.S3_API_ENDPOINT,
	accessKey: process.env.S3_API_KEY,
	secretKey: process.env.S3_API_SECRET,
});

export const firebase = initializeApp({
	credential: cert({
		projectId: process.env.FIREBASE_PROJECT_ID,
		clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
		privateKey: process.env.FIREBASE_PRIVATE_KEY,
	}),
});
