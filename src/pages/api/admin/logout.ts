import type { APIRoute } from 'astro';

import { SESSION_COOKIE } from '@/lib/session';

export const POST: APIRoute = async ({ request }) => {
	const secure = new URL(request.url).protocol === 'https:';
	const sec = secure ? '; Secure' : '';
	return new Response(null, {
		status: 302,
		headers: {
			Location: '/admin/login',
			'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${sec}`,
		},
	});
};
