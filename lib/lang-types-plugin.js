const fs = require('fs-extra');
const path = require('path');

function dtsFromJSON(langJson, baseLangJson) {

	const langCodeDefs = Object.keys(langJson.lang).map(langCode => `\t${langCode}: LangKey;`).join('\n');
	const langKeys = Object.keys(baseLangJson).map(langKey => `'${langKey}'`).join(' | ');

	return `
declare type LangKey = ${langKeys}

declare interface LangDef {
${langCodeDefs}
}

declare interface LangJSON {
	defaultLang: keyof LangDef;
	lang: LangDef;
}
`;

}

async function dtsFromPaths(langPath, baseLangPath, outPath) {
	await fs.writeFile(outPath, dtsFromJSON(
		JSON.parse(await fs.readFile(langPath)),
		JSON.parse(await fs.readFile(baseLangPath)),
	));
}

export default function contentLangType(options) {

	if (typeof options.langFile !== 'string' || typeof options.output !== 'string') {
		throw new Error("You need to specify 'contentDir' and 'output'");
	}

	const watchList = [];
	watchList.push(options.langFile);

	let firstBuild = true;

	return {
		name: 'lang-types',
		async buildStart() {
			if (!firstBuild) return;
			firstBuild = false;

			const textLang = await fs.readFile(options.langFile);
			const { defaultLang } = JSON.parse(textLang);
			const baseLangFile = path.join(path.dirname(options.langFile), `${defaultLang}.json`);

			watchList.push(baseLangFile);
			watchList.forEach(file => this.addWatchFile(file));

			await dtsFromPaths(watchList[0], watchList[1], options.output);
		},
		async watchChange(id) {
			if (watchList.indexOf(id) == -1) return;

			await dtsFromPaths(watchList[0], watchList[1], options.output);
		}
	};
}