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

const name = 'lang-types';

module.exports = class LangTypesPlugin {

	constructor(options) {
		if (typeof options.langFile !== 'string' || typeof options.output !== 'string') {
			throw new Error(`You need to specify 'langFile' and 'output'`);
		}

		this.langFile = options.langFile;
		this.output = options.output;

		const { defaultLang } = require(this.langFile);
		this.baseLangFile = path.join(path.dirname(this.langFile), `${defaultLang}.json`);
	}

	apply(compiler) {
		let firstBuild = true;
		compiler.hooks.run.tapPromise(name, async () => {
			if (!firstBuild) return;
			firstBuild = false;

			await dtsFromPaths(this.langFile, this.baseLangFile, this.output);
		});

		compiler.hooks.watchRun.tapPromise(name, async () => {
			await dtsFromPaths(this.langFile, this.baseLangFile, this.output);
		});
	}
}