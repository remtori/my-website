import './env-setup';
import { SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { reloadEnv } from '@/env';

import { signToken, verifyToken } from '../auth';

const TEST_SECRET = 'test-secret-at-least-32-chars-long';
const encoder = new TextEncoder();
let originalJwtSecret: string | undefined;

describe('JWT auth', () => {
	beforeAll(() => {
		originalJwtSecret = process.env.JWT_SECRET;
		process.env.JWT_SECRET = TEST_SECRET;
		reloadEnv();
	});

	afterAll(() => {
		if (originalJwtSecret === undefined) {
			delete process.env.JWT_SECRET;
		} else {
			process.env.JWT_SECRET = originalJwtSecret;
		}
		reloadEnv();
	});

	it('signToken returns a non-empty string', async () => {
		const token = await signToken({ sub: 'admin' });
		expect(typeof token).toBe('string');
		expect(token.length).toBeGreaterThan(0);
	});

	it('verifyToken accepts a valid token', async () => {
		const token = await signToken({ sub: 'admin' });
		const payload = await verifyToken(token);
		expect(payload.sub).toBe('admin');
	});

	it('verifyToken rejects an invalid token', async () => {
		await expect(verifyToken('not.a.valid.token')).rejects.toThrow();
	});

	it('verifyToken rejects tokens signed with a non-HS256 algorithm', async () => {
		const token = await new SignJWT({ sub: 'admin' })
			.setProtectedHeader({ alg: 'HS512' })
			.setIssuedAt()
			.setExpirationTime('7d')
			.sign(encoder.encode(TEST_SECRET));

		await expect(verifyToken(token)).rejects.toThrow();
	});
});
