import { trpcServer } from '@hono/trpc-server';
import { Hono } from 'hono';

import { appRouter } from './router';
import { createContext } from './trpc';

export const app = new Hono();

app.use(
	'/trpc/*',
	trpcServer({
		router: appRouter,
		createContext,
	}),
);

app.get('/drive', (c) => {
	return c.redirect('https://drive.google.com/drive/folders/0B9NuyBv-nQkBSEJjUXJ6Xy16aXM?resourcekey=0-ZDVVcBWFpHKhKmvC8OXE4Q&usp=sharing');
});
