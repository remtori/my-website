import type { APIRoute } from 'astro';

import { getEnv } from '@/lib/runtime';
import { createSessionValue, sessionCookieHeader, timingSafeStringEqual } from '@/lib/session';

export const POST: APIRoute = async ({ request }) => {
	const env = getEnv();
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return Response.redirect(new URL('/admin/login?err=1', request.url), 302);
	}

	const password = String(form.get('password') ?? '');
	if (!timingSafeStringEqual(password, env.ADMIN_PASSWORD)) {
		return Response.redirect(new URL('/admin/login?err=1', request.url), 302);
	}

	const token = await createSessionValue(env.SESSION_SECRET);
	const secure = new URL(request.url).protocol === 'https:';

	return new Response(null, {
		status: 302,
		headers: {
			Location: '/admin',
			'Set-Cookie': sessionCookieHeader(token, secure),
		},
	});
};
