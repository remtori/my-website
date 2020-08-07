import babel from '@rollup/plugin-babel';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import postcss from 'rollup-plugin-postcss';
import postCSSUrl from 'postcss-url';
import autoprefixer from 'autoprefixer';
import sass from 'node-sass';

import scssModuleTypes from './lib/scss-module-types';
import constsPlugin from './lib/consts-plugin';
import addFilesPlugin from './lib/add-files-plugin';
import langTypes from './lib/lang-types-plugin';
import pkg from './package.json';

function buildConfig({ prerender, watch }) {
	return {
		input: {
			index: prerender ? 'src/prerender.tsx' : 'src/index.tsx'
		},
		output: {
			dir: 'public',
			format: 'cjs',
			sourcemap: !prerender,
			entryFileNames: '[name].js',
			chunkFileNames: '[name]-[hash].js'
		},
		watch: { clearScreen: false },
		plugins: [
			!prerender && scssModuleTypes('src'),
			postcss({
				preprocessor: (content, id) => new Promise((resolve, reject) => {
					sass.render({ file: id }, (err, result) => {
						if (err) {
							return reject(err);
						}

						resolve({ code: result.css.toString() });
					});
				}),
				plugins: [
					autoprefixer,
					postCSSUrl({
						url: 'inline'
					}),
				],
				minimize: true,
				modules: {
					generateScopedName: '[hash:base64:5]'
				},
				namedExports(name) {
					// class-name => className
					return name.replace(/-\w/g, val => val.slice(1).toUpperCase());
				},
				extensions: [ '.scss', '.css' ]
			}),
			langTypes({
				langFile: './public/content/lang.json',
				output: './src/typings/lang.d.ts',
			}),
			constsPlugin({
				version: pkg.version,
				prerender,
				dev: process.env.NODE_ENV === 'development',
			}),
			addFilesPlugin({

			}),
			nodeResolve({
				extensions: [ '.js', '.jsx', '.ts', '.tsx' ],
			}),
			commonjs(),
			babel({
				babelHelpers: 'bundled',
				extensions: [ '.js', '.jsx', '.ts', '.tsx' ],
			}),
		].filter(Boolean)
	};
}

export default function({ watch }) {
	return [
		buildConfig({ watch, prerender: false }),
		buildConfig({ watch, prerender: true }),
	];
}
