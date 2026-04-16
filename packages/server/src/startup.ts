import { env } from '@/env';

import { initDb } from './db/index';
import { initMdxCache } from './s3';

export function getPort(): number {
	return env.PORT;
}

export async function startup(): Promise<void> {
	await initDb();

	try {
		await initMdxCache();
	} catch (error) {
		console.warn('[startup] continuing without preloaded MDX cache:', error);
	}
}
