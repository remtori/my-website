import matter from 'gray-matter';

import { getMdxCache } from '../s3';
import { publicProcedure, router } from '../trpc';

const PORTFOLIO_PREFIX = 'mdx/portfolio/';

function slugFromKey(key: string) {
	return key.slice(PORTFOLIO_PREFIX.length).replace(/\.mdx$/, '');
}

export const portfolioRouter = router({
	list: publicProcedure.query(() => {
		return [...getMdxCache().entries()]
			.filter(([key]) => key.startsWith(PORTFOLIO_PREFIX))
			.map(([key, content]) => {
				const { data } = matter(content);
				return { slug: slugFromKey(key), ...data };
			});
	}),
});
