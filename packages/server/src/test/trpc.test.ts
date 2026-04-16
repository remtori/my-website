import './env-setup';
import { afterEach, describe, expect, it, vi } from 'vitest';

type VerifyTokenImpl = (token: string) => Promise<{ sub?: string }>;

async function loadCreateContext(verifyTokenImpl: VerifyTokenImpl) {
	vi.resetModules();
	vi.doMock('../auth', () => ({
		verifyToken: verifyTokenImpl,
	}));

	const mod = await import('../trpc');
	return mod.createContext;
}

function createAuthRequest(token: string) {
	return new Request('http://localhost/trpc', {
		headers: { Authorization: `Bearer ${token}` },
	});
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.unmock('../auth');
});

describe('createContext auth handling', () => {
	it('sets isAdmin true for a valid admin token', async () => {
		const createContext = await loadCreateContext(async () => ({ sub: 'admin' }));

		const context = await createContext({ req: createAuthRequest('valid-admin-token') });

		expect(context.isAdmin).toBe(true);
	});

	it('sets isAdmin false for a valid non-admin token', async () => {
		const createContext = await loadCreateContext(async () => ({ sub: 'user-123' }));

		const context = await createContext({ req: createAuthRequest('valid-user-token') });

		expect(context.isAdmin).toBe(false);
	});

	it('downgrades to isAdmin false for an invalid token', async () => {
		const createContext = await loadCreateContext(async () => {
			const error = new Error('jwt invalid');
			(error as Error & { code?: string }).code = 'ERR_JWT_INVALID';
			throw error;
		});

		const context = await createContext({ req: createAuthRequest('invalid-token') });

		expect(context.isAdmin).toBe(false);
	});

	it('rethrows unexpected verifier/system errors', async () => {
		const expectedError = new Error('database unavailable');
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const createContext = await loadCreateContext(async () => {
			throw expectedError;
		});

		await expect(createContext({ req: createAuthRequest('any-token') })).rejects.toBe(expectedError);
		expect(consoleErrorSpy).toHaveBeenCalled();
	});
});
