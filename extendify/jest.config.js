const defaultConfig = require('@wordpress/scripts/config/jest-unit.config.js');
const webpackConfig = require('./webpack.config.js');

// Extract aliases from webpack config
const webpackAliases = webpackConfig.resolve.alias || {};

// Convert webpack aliases to Jest moduleNameMapper format
// Webpack uses @ prefix with paths, Jest needs regex patterns
const convertAliasesToModuleNameMapper = (aliases) => {
	return Object.entries(aliases).reduce((moduleNameMapper, [alias, path]) => {
		// Convert webpack alias to Jest moduleNameMapper format
		// e.g., @library -> ^@library/(.*)$
		const aliasKey = `^${alias}/(.*)$`;

		// Convert absolute path to relative path that Jest expects
		// Remove any __dirname references and ensure path ends with /$1
		const aliasPath = path.replace(/.*?(?=src)/, '<rootDir>/') + '/$1';

		moduleNameMapper[aliasKey] = aliasPath;
		return moduleNameMapper;
	}, {});
};

// Create Jest moduleNameMapper from webpack aliases
const aliasesModuleNameMapper =
	convertAliasesToModuleNameMapper(webpackAliases);

// Special case for @constants which doesn't have a trailing slash in imports
if (webpackAliases['@constants']) {
	const constantsPath = webpackAliases['@constants'].replace(
		/.*?(?=src)/,
		'<rootDir>/',
	);
	aliasesModuleNameMapper['^@constants$'] = constantsPath;
}

module.exports = {
	...defaultConfig,
	moduleNameMapper: {
		...defaultConfig.moduleNameMapper,
		...aliasesModuleNameMapper,
	},
	setupFiles: ['<rootDir>/jest.setup.js'],
};
