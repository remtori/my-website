const path = require('path');
const { merge } = require('webpack-merge');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const TerserPlugin = require('terser-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HTMLWebpackPlugin = require('html-webpack-plugin');

const LangTypesPlugin = require('./lang-types-plugin');
const ScssModuleTypesPlugin = require('./scss-module-types');
const baseConfig = require('./webpack.base');

const { dev, distDir, srcDir, publicDir } = require('../buildconfig');

module.exports = merge(baseConfig({ isPrerender: false }), {
	entry: {
        main: path.join(srcDir, './index.tsx')
    },
    output: {
        filename: 'assets/js/[name].[contenthash:8].js',
        path: distDir,
        publicPath: '/',
    },
    plugins: ([
        new HTMLWebpackPlugin({
            template: './src/template.ejs',
            minify: {
                collapseWhitespace: true,
                collapseInlineTagWhitespace: true,
                minifyJS: true,
                removeComments: true,
            },
        }),
        new CopyWebpackPlugin({
            patterns: [{ from: publicDir, to: distDir }]
        }),
    ]).concat(
        dev ? [
            new LangTypesPlugin({
                langFile: path.join(publicDir, './content/lang.json'),
                output: path.join(srcDir, './typings/lang.d.ts'),
            }),
            new ScssModuleTypesPlugin(srcDir),
        ] : [
            new BundleAnalyzerPlugin({ analyzerMode: 'static', openAnalyzer: false })
        ]
    ),
    optimization: {
		minimize: !dev,
		minimizer: [
            new TerserPlugin({
                cache: true,
                parallel: true,
            })
        ],
        splitChunks: {
            chunks: 'all'
        }
    },
    devServer: {
        contentBase: publicDir,
        compress: true,
        port: 8000
    }
});