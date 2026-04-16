import { TRPCError } from '@trpc/server';
import matter from 'gray-matter';
import { z } from 'zod';

import { getMdxCache } from '../s3';
import { publicProcedure, router } from '../trpc';

const POSTS_PREFIX = 'mdx/posts/';

function slugFromKey(key: string) {
	return key.slice(POSTS_PREFIX.length).replace(/\.mdx$/, '');
}

export const postsRouter = router({
	list: publicProcedure.query(() => {
		return [...getMdxCache().entries()]
			.filter(([key]) => key.startsWith(POSTS_PREFIX))
			.map(([key, content]) => {
				const { data } = matter(content);
				return { slug: slugFromKey(key), ...data };
			});
	}),

	bySlug: publicProcedure.input(z.object({ slug: z.string() })).query(({ input }) => {
		const raw = getMdxCache().get(`${POSTS_PREFIX}${input.slug}.mdx`);
		if (!raw) {
			throw new TRPCError({ code: 'NOT_FOUND' });
		}

		const { data, content } = matter(raw);
		return { slug: input.slug, frontmatter: data, content };
	}),
});
