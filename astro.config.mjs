// @ts-check

import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join } from 'node:path';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

const require = createRequire(import.meta.url);
const wasmVipsLibDir = dirname(require.resolve('wasm-vips'));
const wasmVipsPublicPath = '/vendor/wasm-vips/';
const wasmVipsFiles = ['vips-es6.js', 'vips.wasm', 'vips-heif.wasm', 'vips-jxl.wasm', 'vips-resvg.wasm'];

function contentTypeFor(file) {
	switch (extname(file)) {
		case '.js':
			return 'text/javascript; charset=utf-8';
		case '.wasm':
			return 'application/wasm';
		default:
			return 'application/octet-stream';
	}
}

function setCrossOriginIsolationHeaders(res) {
	res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
	res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
	res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
}

async function copyWasmVipsAssets(outputRoot) {
	const outputDir = join(outputRoot, 'vendor', 'wasm-vips');
	await mkdir(outputDir, { recursive: true });
	await Promise.all(wasmVipsFiles.map((file) => copyFile(join(wasmVipsLibDir, file), join(outputDir, file))));
}

function wasmVipsRuntimeAssets() {
	return {
		name: 'wasm-vips-runtime-assets',
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				setCrossOriginIsolationHeaders(res);

				const url = new URL(req.url ?? '/', 'http://localhost');
				if (!url.pathname.startsWith(wasmVipsPublicPath)) {
					next();
					return;
				}

				const file = decodeURIComponent(url.pathname.slice(wasmVipsPublicPath.length));
				if (!wasmVipsFiles.includes(file)) {
					next();
					return;
				}

				res.setHeader('Content-Type', contentTypeFor(file));
				readFile(join(wasmVipsLibDir, file)).then((data) => res.end(data), next);
			});
		},
		async writeBundle(options) {
			if (!options.dir?.replaceAll('\\', '/').endsWith('/dist/client')) {
				return;
			}

			await copyWasmVipsAssets(options.dir);
		},
	};
}

export default defineConfig({
	output: 'server',
	adapter: cloudflare({
		imageService: 'compile',
	}),
	vite: {
		plugins: [tailwindcss(), wasmVipsRuntimeAssets()],
	},
});
