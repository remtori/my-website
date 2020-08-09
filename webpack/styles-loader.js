const ExtractCssPlugin = require('extract-css-chunks-webpack-plugin');

const config = require('../buildconfig');

module.exports = function styleLoader({ useCssModule }) {
    return ([
        {
            loader: ExtractCssPlugin.loader,
        },
        {
            loader: 'css-loader',
            options: {
                importLoaders: 2,
                modules: useCssModule && (
                    config.dev
                        ? { localIdentName: '[local]__[hash:base64:4]' }
                        : { localIdentName: '[hash:base64:8]' }
                ),
                sourceMap: true,
            }
        },
        {
            loader: 'postcss-loader',
            options: {
                plugins: function () {
                    return [
                        require('autoprefixer'),
                        require('postcss-url'),
                    ];
                },
                sourceMap: true,
            }
        },
        {
            loader: 'sass-loader',
            options: {
                sassOptions: {
                    includePaths: [ config.srcDir ]
                },
                sourceMap: true,
            }
        }
    ]).filter(Boolean);
}
