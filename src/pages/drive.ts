import type { APIRoute } from 'astro';

/** @see previous Node server redirect */
export const GET: APIRoute = async () => {
	return Response.redirect(
		'https://drive.google.com/drive/folders/0B9NuyBv-nQkBSEJjUXJ6Xy16aXM?resourcekey=0-ZDVVcBWFpHKhKmvC8OXE4Q&usp=sharing',
		302,
	);
};
