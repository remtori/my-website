const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	trailingSlash: true,
	async rewrites() {
		return [
			{ source: '/admin/:slug*', destination: '/admin/index.html' },
		];
	},
	webpack: (configuration) => {
		configuration.module.rules.push({
			test: /\.md$/,
			loader: path.resolve('./lib/md-loader.js'),
		});

		return configuration;
	},
};

const withBundleAnalyzer = require('@next/bundle-analyzer')({
	enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);
