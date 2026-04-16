import './env-setup';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { contacts } from '../db/schema';

const testDir = dirname(fileURLToPath(import.meta.url));

describe('database schema', () => {
	let pglite: PGlite;
	let db: ReturnType<typeof drizzle>;

	beforeAll(async () => {
		pglite = new PGlite();
		db = drizzle(pglite);
		await migrate(db, { migrationsFolder: join(testDir, '../db/migrations') });
	});

	afterAll(async () => {
		await pglite.close();
	});

	it('inserts and reads a contact', async () => {
		await db.insert(contacts).values({
			name: 'Alice',
			email: 'alice@example.com',
			message: 'Hello',
		});
		const rows = await db.select().from(contacts);
		expect(rows).toHaveLength(1);
		expect(rows[0].name).toBe('Alice');
		expect(rows[0].createdAt).toBeInstanceOf(Date);
	});
});

describe('db lifecycle', () => {
	it('throws when getDb is called before initDb', async () => {
		vi.resetModules();
		const { getDb } = await import('../db/index');
		expect(() => getDb()).toThrow(/initialize|init/i);
	});

	it('reinitializes when initDb is called again', async () => {
		vi.resetModules();
		const { initDb, getDb } = await import('../db/index');
		await initDb();
		await getDb().select().from(contacts);
		await initDb();
		const rows = await getDb().select().from(contacts);
		expect(Array.isArray(rows)).toBe(true);
	});
});
