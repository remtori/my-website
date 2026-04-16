import './env-setup';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as s3 from '@/s3';

import { initDb } from '../db/index';
import { appRouter } from '../router';

const createCaller = appRouter.createCaller;

beforeAll(async () => {
	await initDb();
});

beforeEach(() => {
	s3.getMdxCache().clear();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('auth.login', () => {
	it('returns token on valid credentials', async () => {
		const caller = createCaller({ isAdmin: false });
		const result = await caller.auth.login({ username: 'admin', password: 'secret' });
		expect(typeof result.token).toBe('string');
		expect(result.token.length).toBeGreaterThan(0);
	});

	it('throws UNAUTHORIZED on wrong password', async () => {
		const caller = createCaller({ isAdmin: false });
		await expect(caller.auth.login({ username: 'admin', password: 'wrong' })).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
		});
	});
});

describe('posts.list', () => {
	it('returns an array (empty when cache is empty)', async () => {
		const caller = createCaller({ isAdmin: false });
		const result = await caller.posts.list();
		expect(Array.isArray(result)).toBe(true);
	});
});

describe('posts.bySlug', () => {
	it('throws NOT_FOUND for unknown slug', async () => {
		const caller = createCaller({ isAdmin: false });
		await expect(caller.posts.bySlug({ slug: 'nonexistent' })).rejects.toMatchObject({
			code: 'NOT_FOUND',
		});
	});

	it('returns post when slug exists in cache', async () => {
		s3.getMdxCache().set('mdx/posts/hello.mdx', '---\ntitle: Hello\n---\nContent here');
		const caller = createCaller({ isAdmin: false });
		const result = await caller.posts.bySlug({ slug: 'hello' });
		expect(result.slug).toBe('hello');
		expect(result.frontmatter).toMatchObject({ title: 'Hello' });
		expect(result.content).toContain('Content here');
	});
});

describe('portfolio.list', () => {
	it('returns only mdx/portfolio items', async () => {
		s3.getMdxCache().set('mdx/portfolio/demo.mdx', '---\ntitle: Demo\n---\nPortfolio content');
		s3.getMdxCache().set('mdx/posts/not-portfolio.mdx', '---\ntitle: Post\n---\nPost content');
		const caller = createCaller({ isAdmin: false });
		const result = await caller.portfolio.list();
		expect(result.find((item) => item.slug === 'demo')).toBeDefined();
		expect(result.find((item) => item.slug === 'not-portfolio')).toBeUndefined();
	});
});

describe('contact.submit', () => {
	it('stores a contact submission', async () => {
		const caller = createCaller({ isAdmin: false });
		const result = await caller.contact.submit({
			name: 'Bob',
			email: 'bob@example.com',
			message: 'Hi there',
		});
		expect(result.ok).toBe(true);
	});
});

describe('admin procedures', () => {
	it('admin.refresh throws UNAUTHORIZED for non-admin', async () => {
		const caller = createCaller({ isAdmin: false });
		await expect(caller.admin.refresh()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
	});

	it('admin.refresh returns ok and calls refreshMdxCache once for admin', async () => {
		const spy = vi.spyOn(s3, 'refreshMdxCache').mockImplementation(async () => {});
		const caller = createCaller({ isAdmin: true });

		const result = await caller.admin.refresh();

		expect(result).toEqual({ ok: true });
		expect(spy).toHaveBeenCalledTimes(1);
	});
});
