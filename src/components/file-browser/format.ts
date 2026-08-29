export function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
	if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
	return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

export function formatDate(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso || '—';
	return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function basename(key: string): string {
	const trimmed = key.endsWith('/') ? key.slice(0, -1) : key;
	const i = trimmed.lastIndexOf('/');
	return i === -1 ? trimmed : trimmed.slice(i + 1);
}

export function dirname(key: string): string {
	const trimmed = key.endsWith('/') ? key.slice(0, -1) : key;
	const i = trimmed.lastIndexOf('/');
	return i === -1 ? '' : `${trimmed.slice(0, i)}/`;
}

export function parentPrefix(prefix: string): string {
	if (!prefix) return '';
	return dirname(prefix);
}

export function joinPrefix(prefix: string, relativePath: string): string {
	const normalized = relativePath.replaceAll('\\', '/').replace(/^\/+/, '');
	const segments = normalized.split('/').filter((s) => s && s !== '.');
	if (segments.some((s) => s === '..')) {
		throw new Error('Invalid relative path');
	}
	return `${prefix}${segments.join('/')}`;
}

export function relativePathOf(file: File): string {
	const rel = 'webkitRelativePath' in file ? String((file as File & { webkitRelativePath?: string }).webkitRelativePath ?? '') : '';
	return rel.length > 0 ? rel : file.name;
}

export function unique(items: string[]): string[] {
	return [...new Set(items)];
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|ico|bmp)$/i;
const TEXT_EXT = /\.(txt|md|mdx|json|js|cjs|mjs|ts|tsx|jsx|css|html|htm|xml|csv|ya?ml|toml|sh|env|log|astro|map|svg)$/i;

export function isImageKey(key: string): boolean {
	return IMAGE_EXT.test(key);
}

export function isTextKey(key: string): boolean {
	return TEXT_EXT.test(key);
}

export function pathCrumbs(prefix: string): { label: string; prefix: string }[] {
	const parts = prefix.split('/').filter(Boolean);
	const out: { label: string; prefix: string }[] = [];
	let acc = '';
	for (const part of parts) {
		acc += `${part}/`;
		out.push({ label: part, prefix: acc });
	}
	return out;
}
