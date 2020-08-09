const path = require('path');
const { merge } = require('webpack-merge');
const baseConfig = require('./webpack.base');

const { srcDir, distDir } = require('../buildconfig');

module.exports = merge(baseConfig({ isPrerender: true }), {
	externals: {
		preact: 'preact',
	},
	entry: {
		bundle: path.join(srcDir, './prerender.tsx')
	},
	output: {
		filename: '[name].js',
		path: path.join(distDir, './prerender'),
		libraryTarget: 'commonjs2',
		publicPath: '/',
	},
	optimization: {
		splitChunks: false
	},
	target: 'node'
});