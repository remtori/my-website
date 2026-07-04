export interface ArchiveItem {
	slug: string;
	title: string;
	date: string;
	kind: string;
	description: string;
	href: string;
	sourceUrl: string;
}

export const archiveItems: ArchiveItem[] = [
	{
		slug: 'minecrem',
		title: 'MinecRem',
		date: '2016-11-18',
		kind: 'website',
		description: 'A browser tool that turns uploaded images into a Minecraft resource pack.',
		href: '/archive/minecrem/',
		sourceUrl: 'https://editimage.000webhostapp.com/',
	},
];
