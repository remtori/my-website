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

export async function uploadFile(path: string, file: Blob): Promise<string> {
	const resp = await fetch(`/api/uploadUrl`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			idToken: `eyJhbGciOiJSUzI1NiIsImtpZCI6IjJlMzZhMWNiZDBiMjE2NjYxOTViZGIxZGZhMDFiNGNkYjAwNzg3OWQiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiUmVtdG9yaSIsInBpY3R1cmUiOiJodHRwczovL2F2YXRhcnMxLmdpdGh1YnVzZXJjb250ZW50LmNvbS91LzQxNDE2NTQ4P3Y9NCIsImxldmVsIjozLCJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vcmVtdG9yaSIsImF1ZCI6InJlbXRvcmkiLCJhdXRoX3RpbWUiOjE2MzcwODA5NTksInVzZXJfaWQiOiJydnprTkNsMDEyYkF4Y3B0R1M0TFpLdGlWN2gxIiwic3ViIjoicnZ6a05DbDAxMmJBeGNwdEdTNExaS3RpVjdoMSIsImlhdCI6MTYzNzQxNzE4OCwiZXhwIjoxNjM3NDIwNzg4LCJlbWFpbCI6Imxxdi5yZW10b3JpQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJnaXRodWIuY29tIjpbIjQxNDE2NTQ4Il0sImVtYWlsIjpbImxxdi5yZW10b3JpQGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6ImdpdGh1Yi5jb20ifX0.JZ5EkySuZriUAJDCRV1VnGo-XluzPFKmuepRKuCfVUeNiM-mgh_E8xyZMaWz0Vrhp4bPLJ0qmifIY-_kpP2lGVFeGuSSBPOTsOMAegdFNXD1qTPdVuP4vpU6jY8FJgtXq5BRue5BI0BCYxDnrm0IkcevCv_q61Dk2kpN1-7hMeIYE38JCUvvNi5wRlhemuQEvBtB5N0Uk7gqwosc1Ga3Cmr0q5QvZNG1mmNuF-w8TGKy3yrRy9wa5gIcpeVoQ4XteaosTuRLFtjDq5Jpxjv5kg3N4vLasyufr1GzQf6k7aOme2KMQa4soHdUCDjnMr6r8aXEhlJ_9xXYeYgJdXR3Zw`,
			path,
		}),
	}).then((r) => r.json());

	if (resp.error) {
		console.log(`UploadFile: ${path} error\n${resp.err}`);
	}

	await fetch(resp.uploadUrl, {
		method: 'PUT',
		headers: {
			'Content-Encoding': 'gzip',
			'Content-Type': mime.contentType(path) || 'application/octet-stream',
		},
		/* @ts-ignore */
		body: file.stream().pipeThrough(new CompressionStream('gzip')),
	})
		.then((r) => r.text())
		.then((resp) => {
			console.log(`UploadFile: ${path}\n${resp}`);
		});

	return resp.downloadUrl as string;
}
