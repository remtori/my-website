const VirtualModulesPlugin = require('webpack-virtual-modules');

module.exports = function constsPlugin(consts) {

	const options = {};
	Object.entries(consts).forEach(([ key, value ]) => {
		options[`node_modules/consts/${key}.js`] = `module.exports = ${JSON.stringify(value)}`
	});

	return new VirtualModulesPlugin(options);
}
