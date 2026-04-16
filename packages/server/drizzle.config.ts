import { defineConfig } from 'drizzle-kit';

import { env } from '@/env';

export default defineConfig({
	schema: './src/db/schema.ts',
	out: './src/db/migrations',
	dialect: 'postgresql',
	dbCredentials: {
		url: env.DATABASE_URL ?? 'postgresql://my_website:my_website@127.0.0.1:5432/postgres',
	},
});
