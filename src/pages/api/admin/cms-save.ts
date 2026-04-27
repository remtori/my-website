import type { APIRoute } from 'astro';

import { upsertFileIndexEntry } from '@/lib/file-index';
import { putObjectText } from '@/lib/s3';

function slugify(str: string): string {
	return str
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export const POST: APIRoute = async ({ request }) => {
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return Response.redirect(new URL('/admin/cms?err=1', request.url), 302);
	}

	let key = String(form.get('key') ?? '').trim();
	const title = String(form.get('title') ?? '').trim();
	const type = String(form.get('type') ?? '').trim();
	const content = String(form.get('content') ?? '');

	// Derive key from title/type if not provided (new object flow)
	if (!key) {
		if (!title) {
			return Response.redirect(new URL('/admin/cms?err=1', request.url), 302);
		}
		const slug = slugify(title);
		if (type === 'blog') {
			const date = new Date().toISOString().slice(0, 10);
			key = `mdx/blogs/${date}-${slug}.mdx`;
		} else {
			key = `mdx/${slug}.mdx`;
		}
	}

	if (!key.startsWith('mdx/') || key.includes('..')) {
		return Response.redirect(new URL('/admin/cms?err=1', request.url), 302);
	}

	// Collision check: if this looks like a new object (no pre-existing key in form),
	// verify it doesn't already exist in the index.
	const isNew = !String(form.get('key') ?? '').trim();
	if (isNew) {
		const { getFileIndex } = await import('@/lib/file-index');
		const index = await getFileIndex();
		if (index.some((e) => e.key === key)) {
			return Response.redirect(new URL('/admin/cms?collision=1', request.url), 302);
		}
	}

	try {
		await putObjectText(key, content, 'text/mdx; charset=utf-8');
	} catch {
		return Response.redirect(new URL('/admin/cms?err=1', request.url), 302);
	}

	// Write-through to KV cache (silent failure)
	await upsertFileIndexEntry(key, content);

	return Response.redirect(new URL(`/admin/cms/edit?key=${encodeURIComponent(key)}&saved=1`, request.url), 302);
};
