import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { env } from '@/env';

import { signToken } from '../auth';
import { publicProcedure, router } from '../trpc';

export const authRouter = router({
	login: publicProcedure.input(z.object({ username: z.string(), password: z.string() })).mutation(async ({ input }) => {
		if (input.username !== env.ADMIN_USERNAME || input.password !== env.ADMIN_PASSWORD) {
			throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
		}

		return { token: await signToken({ sub: 'admin' }) };
	}),
});
