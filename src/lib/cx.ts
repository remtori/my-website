export default function cx(...args: any[]): string {
	let out = '';
	// tslint:disable-next-line: prefer-for-of
	for (let i = 0; i < args.length; i++) {
		const x = args[i];
		if (out) out += ' ';
		if (x) out += x;
	}
	return out;
}
