const ExtractCssPlugin = require('extract-css-chunks-webpack-plugin');

const config = require('../buildconfig');

module.exports = function styleLoader({ useCssModule, isPrerender }) {
    return ([
        !isPrerender && {
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
            }
        },
        {
            loader: 'sass-loader',
            options: {
                sassOptions: {
                    includePaths: [ config.srcDir ]
                },
            }
        }
    ]).filter(Boolean);
}
