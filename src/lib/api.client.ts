import mime from 'mime-types';

export function cx(...args: any[]): string {
	let out = '';
	// tslint:disable-next-line: prefer-for-of
	for (let i = 0; i < args.length; i++) {
		const x = args[i];
		if (out) out += ' ';
		if (x) out += x;
	}
	return out;
}

export const clientImport = (url: string): Promise<void> => new Promise((resolve, reject) => {
	if (document.querySelector(`script[src="${url}"]`))
		return reject();

	const script = document.createElement('script');
	script.onload = () => resolve();
	script.onerror = reject;
	script.src = url;
	document.body.appendChild(script);
});

export async function uploadFile(path: string, data: Blob | string): Promise<string> {
	path = path[0] === '/' ? path : '/' + path;

	const user = await import('./client-sdk').then((m) => m.authUser());
	if (user == null) {
		throw new Error('Unauthorized');
	}

	const idToken = await user.getIdToken();
	const resp = await fetch(`/api/uploadUrl/`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			idToken,
			path,
		}),
	}).then((r) => r.json());

	console.log(`UploadFile: ${path}\n${JSON.stringify(resp)}`);
	if (resp.error) {
		throw new Error(resp.mesage);
	}

	let body = data;
	if (typeof data === 'string') {
		body = await new Response(
			new Blob([data], { type: 'text/plain' })
				.stream()
				/* @ts-ignore */
				.pipeThrough(new CompressionStream('gzip'))
		).blob();
	}

	await fetch(resp.uploadUrl, {
		method: 'PUT',
		headers: {
			'Content-Encoding': 'gzip',
			'Content-Type': mime.lookup(path) || 'application/octet-stream',
		},
		body,
	})
		.then((r) => r.text())
		.then((resp) => {
			console.log(`UploadFile: ${path}\n${resp}`);
		});

	return resp.downloadUrl as string;
}
