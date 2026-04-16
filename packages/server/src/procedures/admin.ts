import { refreshMdxCache } from '@/s3';
import { adminProcedure, router } from '@/trpc';

export const adminRouter = router({
	refresh: adminProcedure.mutation(async () => {
		await refreshMdxCache();
		return { ok: true };
	}),
});
