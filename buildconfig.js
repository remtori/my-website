const path = require('path');

module.exports = {
	version: require('./package.json').version,
	dev: process.env.NODE_ENV !== 'production',
	// Directory
	publicDir: path.join(__dirname, './public'),
	distDir: path.join(__dirname, './dist'),
	srcDir: path.join(__dirname, './src'),
	cacheDir: path.join(process.env.NETLIFY_BUILD_BASE || __dirname, 'cache'),
};