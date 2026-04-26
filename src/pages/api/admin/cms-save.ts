import type { APIRoute } from 'astro';

import { putObjectText } from '@/lib/s3';

export const POST: APIRoute = async ({ request }) => {
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return Response.redirect(new URL('/admin/cms?err=1', request.url), 302);
	}

	const key = String(form.get('key') ?? '').trim();
	const content = String(form.get('content') ?? '');

	if (!key.startsWith('mdx/') || key.includes('..')) {
		return Response.redirect(new URL('/admin/cms?err=1', request.url), 302);
	}

	try {
		await putObjectText(key, content, 'text/mdx; charset=utf-8');
	} catch {
		return Response.redirect(new URL('/admin/cms?err=1', request.url), 302);
	}

	return Response.redirect(new URL(`/admin/cms/edit?key=${encodeURIComponent(key)}&saved=1`, request.url), 302);
};
