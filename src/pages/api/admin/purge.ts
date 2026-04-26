import type { APIRoute } from 'astro';

import { getCache } from '@/lib/runtime';

function cacheablePublicRequestForUrl(fullUrl: string): Request {
	const u = new URL(fullUrl);
	u.hash = '';
	return new Request(u.toString(), {
		method: 'GET',
		headers: new Headers(),
	});
}

export const POST: APIRoute = async ({ request }) => {
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return Response.redirect(new URL('/admin/purge?err=1', request.url), 302);
	}

	const raw = String(form.get('urls') ?? '');
	const origin = new URL(request.url).origin;
	const lines = raw
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean);

	let deleted = 0;
	for (const line of lines) {
		const absolute = line.startsWith('http') ? line : `${origin}${line.startsWith('/') ? '' : '/'}${line}`;
		try {
			const ok = await getCache().delete(cacheablePublicRequestForUrl(absolute));
			if (ok) {
				deleted++;
			}
		} catch {
			/* ignore */
		}
	}

	return Response.redirect(new URL(`/admin/purge?done=${deleted}`, request.url), 302);
};
