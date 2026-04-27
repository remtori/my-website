import type { APIRoute } from 'astro';

import { deleteFileIndexEntry } from '@/lib/file-index';
import { getEnv } from '@/lib/runtime';
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

	// Write-through to KV cache (silent failure)
	const env = getEnv();
	await deleteFileIndexEntry(env, key);

	return Response.redirect(new URL('/admin/cms?deleted=1', request.url), 302);
};
