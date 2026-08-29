export type S3ObjectInfo = {
	key: string;
	size: number;
	lastModified: string;
};

export type S3ListPage = {
	prefixes: string[];
	objects: S3ObjectInfo[];
	nextToken?: string;
};

export type UploadItem = {
	id: string;
	file: File;
	key: string;
	status: 'pending' | 'uploading' | 'done' | 'error';
	progress: number;
	error?: string;
};

export type Row = {
	id: string;
	kind: 'parent' | 'prefix' | 'object';
	name: string;
	size?: number;
	lastModified?: string;
};
