import { adminRouter } from './procedures/admin';
import { authRouter } from './procedures/auth';
import { contactRouter } from './procedures/contact';
import { portfolioRouter } from './procedures/portfolio';
import { postsRouter } from './procedures/posts';
import { router } from './trpc';

export const appRouter = router({
	auth: authRouter,
	posts: postsRouter,
	portfolio: portfolioRouter,
	contact: contactRouter,
	admin: adminRouter,
});

export type AppRouter = typeof appRouter;
