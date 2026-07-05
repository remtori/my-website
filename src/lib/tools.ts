export type Tool = {
	name: string;
	desc: string;
	href: string;
	popular?: boolean;
};

export const tools: Tool[] = [{ name: 'imgconv', desc: 'wasm image lab', href: '/tools/imgconv', popular: true }];
