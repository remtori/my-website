import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';

import { env } from '@/env';

import { app } from './app';
import { getPort, startup } from './startup';

// Serve built webui in production only — Vite dev server handles this in dev
if (env.NODE_ENV === 'production') {
	app.use('/*', serveStatic({ root: '../webui/dist' }));
	app.get('/*', serveStatic({ path: '../webui/dist/index.html' }));
}

const port = getPort();

await startup();
console.log(`Server running on port ${port}`);

serve({ fetch: app.fetch, port });
