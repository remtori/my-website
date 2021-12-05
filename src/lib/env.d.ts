declare module NodeJS {
	interface ProcessEnv {
		S3_API_KEY: string;
		S3_API_SECRET: string;
		S3_API_ENDPOINT: string;
		S3_BUCKET: string;
		S3_OBJECT_PREFIX: string;
		S3_CDN_PREFIX: string;
		FIREBASE_PROJECT_ID: string;
		FIREBASE_CLIENT_EMAIL: string;
		FIREBASE_PRIVATE_KEY: string;
	}
}
