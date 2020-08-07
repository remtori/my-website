import fs from 'fs-extra';

export default function addFilesPlugin(files) {
	let fileReadPromises;

	return {
		name: 'add-files-plugin',
		buildStart() {
			fileReadPromises = new Map();

			for (const inputPath of Object.keys(files)) {
				fileReadPromises.set(inputPath, fs.readFile(inputPath));
			}
		},
		async generateBundle(options, bundle) {
			for (const [inputPath, outputPath] of Object.entries(files)) {
				bundle[outputPath] = {
					fileName: outputPath,
					isAsset: true,
					source: await fileReadPromises.get(inputPath)
				};
			}
		}
	};
  }