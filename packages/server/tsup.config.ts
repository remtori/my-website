import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/main.ts'],
	format: ['esm'],
	platform: 'node',
	outDir: 'dist',
	sourcemap: true,
	clean: true,
	bundle: true,
	minify: true,
	tsconfig: 'tsconfig.json',
	define: {
		'process.env.NODE_ENV': '"production"',
	},
});
