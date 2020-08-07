import { main as dtsCreator } from 'typed-scss-modules/dist/lib/main.js';

export default function cssModuleTypes(root) {

	let firstBuild = true;

	return {
		name: 'scss-module-types',
		async buildStart() {
			if (!firstBuild) return;
			firstBuild = false;

			await dtsCreator(root, {
				exportType: 'named',
				exportTypeName: 'ClassNames',
				exportTypeInterface: 'Styles',
			});
		},
		async watchChange(id) {
			if (!id.endsWith('.scss')) {
				return null;
			}

			await dtsCreator(id, {
				exportType: 'named',
				exportTypeName: 'ClassNames',
				exportTypeInterface: 'Styles',
			});
		}
	};
}