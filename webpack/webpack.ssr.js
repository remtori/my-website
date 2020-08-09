const path = require('path');
const { merge } = require('webpack-merge');
const baseConfig = require('./webpack.base');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

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
	plugins: [
		new CleanWebpackPlugin(),
	],
	optimization: {
		splitChunks: false
	},
	target: 'node'
});