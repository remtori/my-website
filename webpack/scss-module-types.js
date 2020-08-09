const { main: dtsCreator } = require('typed-scss-modules/dist/lib/main.js');

const name = 'scss-module-types';

module.exports = class ScssModuleTypes {

	constructor(root) {
		this.root = root;
		this.options = {
			exportType: 'named',
			exportTypeName: 'ClassNames',
			exportTypeInterface: 'Styles',
		};
	}

	apply(compiler) {
		let firstBuild = true;
		compiler.hooks.run.tapPromise(name, async () => {
			if (!firstBuild) return;
			firstBuild = false;

			await dtsCreator(this.root, this.options);
		});

		compiler.hooks.watchRun.tapPromise(name, async () => {
			await dtsCreator(this.root, this.options);
		});
	}
}