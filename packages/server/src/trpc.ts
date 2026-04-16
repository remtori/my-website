import { initTRPC, TRPCError } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';

import { verifyToken } from './auth';

export type TrpcContext = {
	isAdmin: boolean;
};

function isExpectedTokenValidationError(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false;

	const maybeCode = Reflect.get(error, 'code');
	if (typeof maybeCode === 'string' && maybeCode.startsWith('ERR_JWT_')) return true;

	const maybeName = Reflect.get(error, 'name');
	if (typeof maybeName === 'string' && maybeName.startsWith('JWT')) return true;

	return false;
}

export async function createContext({ req }: FetchCreateContextFnOptions): Promise<TrpcContext> {
	const auth = req.headers.get('Authorization');
	if (auth?.startsWith('Bearer ')) {
		try {
			const payload = await verifyToken(auth.slice(7));
			return { isAdmin: payload.sub === 'admin' };
		} catch (error) {
			if (isExpectedTokenValidationError(error)) {
				// Invalid or expired token — fall through to public context
				return { isAdmin: false };
			}
			console.error('Unexpected token verification failure in createContext', error);
			throw error;
		}
	}
	return { isAdmin: false };
}

const t = initTRPC.context<TrpcContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.isAdmin) throw new TRPCError({ code: 'UNAUTHORIZED' });
	return next({ ctx });
});
