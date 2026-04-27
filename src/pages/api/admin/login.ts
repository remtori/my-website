import type { APIRoute } from 'astro';

import { checkKvRateLimit, clientIp } from '@/lib/rate-limit-kv';
import { getEnv } from '@/lib/runtime';
import { createSessionValue, sessionCookieHeader, timingSafeStringEqual } from '@/lib/session';

const LOGIN_RL_PREFIX = 'rl:admin-login';
const LOGIN_RL_MAX = 15;
const LOGIN_RL_WINDOW_SEC = 900;

export const POST: APIRoute = async ({ request }) => {
	const env = getEnv();
	const ip = clientIp(request);
	const limited = await checkKvRateLimit(env.DATA, LOGIN_RL_PREFIX, ip, LOGIN_RL_MAX, LOGIN_RL_WINDOW_SEC);
	if (!limited.ok) {
		return new Response(null, {
			status: 303,
			headers: {
				Location: `/admin/login?err=rate&retry=${String(limited.retryAfterSec)}`,
				'Retry-After': String(limited.retryAfterSec),
			},
		});
	}

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
