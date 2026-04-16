import { z } from 'zod';

import { getDb } from '../db/index';
import { contacts } from '../db/schema';
import { publicProcedure, router } from '../trpc';

export const contactRouter = router({
	submit: publicProcedure
		.input(
			z.object({
				name: z.string().min(1),
				email: z.string().email(),
				message: z.string().min(1),
			}),
		)
		.mutation(async ({ input }) => {
			await getDb().insert(contacts).values(input);
			return { ok: true };
		}),
});
