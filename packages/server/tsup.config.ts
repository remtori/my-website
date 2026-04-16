import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/main.ts'],
	format: ['esm'],
	platform: 'node',
	outDir: 'dist',
	sourcemap: true,
	clean: true,
	bundle: true,
	minify: false,
	define: {
		'process.env.NODE_ENV': '"production"',
	},
});
