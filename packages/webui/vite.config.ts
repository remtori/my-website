import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type UserConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import type { InlineConfig } from 'vitest/node';

type VitestAwareUserConfig = UserConfig & {
	test?: InlineConfig;
};

export default defineConfig(
	(): VitestAwareUserConfig => ({
		plugins: [
			react(),
			tailwindcss(),
			VitePWA({
				registerType: 'autoUpdate',
				// Static `public/manifest.webmanifest` — Vite 8 Rolldown ignores plugin bundle injection for it.
				manifest: false,
				includeAssets: [
					'favicon.ico',
					'robots.txt',
					'apple-touch-icon.png',
					'manifest.webmanifest',
					'pwa-192x192.png',
					'pwa-512x512.png',
				],
				workbox: {
					globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
					runtimeCaching: [
						{
							urlPattern: /^\/trpc\//i,
							handler: 'NetworkFirst',
							options: { cacheName: 'trpc-cache' },
						},
					],
				},
			}),
		],
		server: {
			proxy: {
				'/trpc': 'http://localhost:3000',
			},
		},
		test: {
			environment: 'jsdom',
			globals: true,
			passWithNoTests: true,
		},
	}),
);
