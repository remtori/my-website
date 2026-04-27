export type Tool = {
	name: string;
	desc: string;
	href: string;
	popular?: boolean;
};

export const tools: Tool[] = [
	{ name: 'imgconv', desc: 'image converter', href: '', popular: true },
	{ name: 'icogen', desc: 'icon generator', href: '' },
	{ name: 'jsonfmt', desc: 'json formatter', href: '', popular: true },
	{ name: 'b64', desc: 'base64 codec', href: '', popular: true },
	{ name: 'hash', desc: 'text hasher', href: '', popular: true },
	{ name: 'slug', desc: 'slugify text', href: '' },
	{ name: 'uuid', desc: 'uuid generator', href: '', popular: true },
	{ name: 'diff', desc: 'text diff', href: '' },
	{ name: 'regex', desc: 'regex tester', href: '' },
	{ name: 'color', desc: 'color tools', href: '' },
	{ name: 'cron', desc: 'cron parser', href: '' },
	{ name: 'qr', desc: 'qr encoder', href: '' },
];
