import { z } from 'zod';
import 'dotenv/config';

const envSchema = z
	.object({
		NODE_ENV: z.preprocess((v) => (v === undefined || v === '' ? 'development' : v), z.enum(['development', 'production', 'test'])),
		PORT: z.coerce.number().int().min(1).max(65535).default(3000),
		DATABASE_URL: z.preprocess((v) => (v === '' || v === undefined ? undefined : v), z.string().url().optional()),
		JWT_SECRET: z.string().min(1),
		ADMIN_USERNAME: z.preprocess((v) => (v === undefined || v === '' ? 'admin' : v), z.string().min(1)),
		ADMIN_PASSWORD: z.preprocess((v) => (v === undefined || v === '' ? 'admin' : v), z.string().min(1)),
		S3_ENDPOINT: z.preprocess((v) => (v === '' || v === undefined ? undefined : v), z.string().optional()),
		S3_BUCKET: z.string().default(''),
		S3_ACCESS_KEY: z.string().default(''),
		S3_SECRET_KEY: z.string().default(''),
	})
	.superRefine((data, ctx) => {
		if (data.NODE_ENV !== 'production') {
			return;
		}
		if (!data.DATABASE_URL) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'DATABASE_URL is required when NODE_ENV is production',
				path: ['DATABASE_URL'],
			});
		}
		if (data.ADMIN_USERNAME === 'admin' && data.ADMIN_PASSWORD === 'admin') {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Set ADMIN_USERNAME and ADMIN_PASSWORD in production',
				path: ['ADMIN_PASSWORD'],
			});
		}
	});

export type Env = z.infer<typeof envSchema>;

function parseEnv(source: NodeJS.ProcessEnv): Env {
	const result = envSchema.safeParse(source);
	if (!result.success) {
		console.error('Invalid environment variables:', result.error.flatten());
		throw new Error('Invalid environment variables');
	}
	return result.data;
}

let _env: Env = parseEnv(process.env);

export function reloadEnv(): void {
	_env = parseEnv(process.env);
}

/** Typed process.env; call `reloadEnv()` after mutating `process.env` in tests. */
export const env = new Proxy({} as Env, {
	get(_, prop: string | symbol) {
		if (typeof prop !== 'string') {
			return undefined;
		}
		return _env[prop as keyof Env];
	},
});
