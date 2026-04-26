import type { APIRoute } from 'astro';

import { deleteObject } from '@/lib/s3';

export const POST: APIRoute = async ({ request }) => {
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return Response.redirect(new URL('/admin/cms?err=1', request.url), 302);
	}

	const key = String(form.get('key') ?? '').trim();

	if (!key.startsWith('mdx/') || key.includes('..')) {
		return Response.redirect(new URL('/admin/cms?err=1', request.url), 302);
	}

	try {
		await deleteObject(key);
	} catch {
		return Response.redirect(new URL('/admin/cms?err=1', request.url), 302);
	}

	return Response.redirect(new URL('/admin/cms?deleted=1', request.url), 302);
};
