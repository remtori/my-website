/** Minimal YAML frontmatter (key: value lines); avoids gray-matter's eval in Workers. */
export function splitFrontmatter(raw: string): { data: Record<string, string>; content: string } {
	const trimmed = raw.replace(/^\uFEFF/, '');
	if (!trimmed.startsWith('---')) {
		return { data: {}, content: trimmed };
	}
	const nl = trimmed.indexOf('\n', 3);
	if (nl === -1) {
		return { data: {}, content: trimmed };
	}
	let end = trimmed.indexOf('\n---', nl);
	if (end === -1) {
		end = trimmed.indexOf('\r\n---', nl);
	}
	if (end === -1) {
		return { data: {}, content: trimmed };
	}
	const fmBlock = trimmed.slice(nl + 1, end).trim();
	const body = trimmed.slice(end + 4).replace(/^\r?\n/, '');
	const data: Record<string, string> = {};
	for (const line of fmBlock.split(/\r?\n/)) {
		const m = /^([\w-]+):\s*(.*)$/.exec(line.trim());
		if (m) {
			let v = m[2].trim();
			if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
				v = v.slice(1, -1);
			}
			data[m[1]] = v;
		}
	}
	return { data, content: body };
}
