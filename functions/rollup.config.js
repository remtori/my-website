import typescript from '@rollup/plugin-typescript';
import pkg from './package.json';

export default {
	input: './src/index.ts',
	output: {
		file: './dist/index.js',
		format: 'cjs'
	},
	plugins: [
		typescript(),
	],
	external: Object.keys(pkg.dependencies)
}
