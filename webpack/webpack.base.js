const stylesLoader = require('./styles-loader');
const ExtractCssPlugin = require('extract-css-chunks-webpack-plugin');

const constsPlugin = require('./consts-plugin');
const { dev, version } = require('../buildconfig');

module.exports = ({ isPrerender }) => ({
    mode: dev ? 'development' : 'production',
    resolve: {
        alias: {
            'react': 'preact/compat',
            'react-dom': 'preact/compat'
        },
        extensions: [
            '.ts', '.tsx', '.js', '.jsx',
            '.scss', '.css',
            '.json'
        ]
    },
    module: {
        rules: [
            {
                test: /\.(t|j)sx?$/,
                exclude: /node_modules/,
                loader: 'babel-loader',
            },
            {
                test: m => /\.s(a|c)ss$/.test(m) && !m.endsWith('global.scss'),
                use: stylesLoader({ useCssModule: true, isPrerender })
            },
            {
                test: m => m.endsWith('global.scss') || /\.css$/.test(m),
                use: stylesLoader({ useCssModule: false, isPrerender })
            },
            {
                test: /\.(jpe?g|png|gif|svg)$/i,
                loader: 'url-loader',
            }
        ],
    },
    plugins: ([
        !isPrerender && new ExtractCssPlugin({
            filename: `assets/styles/[name].[contenthash:8].css`,
            chunkFilename: `assets/styles/[name].[contenthash:8].css`
        }),
        constsPlugin({
            dev,
            version,
            prerender: isPrerender
        })
    ]).filter(Boolean)
});