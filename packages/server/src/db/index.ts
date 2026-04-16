import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import type { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import type { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import type { Pool } from 'pg';

import { env } from '@/env';
import { getServerPackageRoot } from '@/package-root';

import * as schema from './schema';

type AppDb = ReturnType<typeof drizzlePg<typeof schema>> | ReturnType<typeof drizzlePglite<typeof schema>>;

let _db: AppDb | undefined;
let _pglite: PGlite | undefined;
let _pool: Pool | undefined;

const migrationsFolder = join(getServerPackageRoot(), 'migrations');

async function closeDb(): Promise<void> {
	if (_pool) {
		await _pool.end();
		_pool = undefined;
	}
	if (_pglite) {
		await _pglite.close();
		_pglite = undefined;
	}
	_db = undefined;
}

export function getDb(): AppDb {
	if (!_db) {
		throw new Error('Database is not initialized. Call initDb() first.');
	}
	return _db;
}

export async function initDb(): Promise<void> {
	if (_db) {
		await closeDb();
	}

	// Non-production path must be guarded by `process.env.NODE_ENV` (not `env.NODE_ENV`)
	// so tsup `define` folds `!== "production"` to `false` and drops PGlite from the bundle.
	if (process.env.NODE_ENV !== 'production') {
		const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
			import('@electric-sql/pglite'),
			import('drizzle-orm/pglite'),
			import('drizzle-orm/pglite/migrator'),
		]);

		if (env.NODE_ENV === 'test') {
			_pglite = new PGlite();
			_db = drizzle(_pglite, { schema });
			await migrate(_db as never, { migrationsFolder });
			return;
		}

		const dataDir = join(getServerPackageRoot(), 'node_modules', '.data');
		mkdirSync(dataDir, { recursive: true });
		_pglite = new PGlite({ dataDir });
		_db = drizzle(_pglite, { schema });
		await migrate(_db as never, { migrationsFolder });
		return;
	}

	const [{ Pool }, { drizzle }, { migrate }] = await Promise.all([
		import('pg'),
		import('drizzle-orm/node-postgres'),
		import('drizzle-orm/node-postgres/migrator'),
	]);

	_pool = new Pool({ connectionString: env.DATABASE_URL });
	_db = drizzle(_pool, { schema });
	await migrate(_db, { migrationsFolder });
}
