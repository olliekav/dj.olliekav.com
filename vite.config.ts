import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import netlify from '@netlify/vite-plugin';
import mkcert from 'vite-plugin-mkcert';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		mkcert(),
		// Runs the /api functions locally; no edge functions, so skip starting Deno
		netlify({ edgeFunctions: { enabled: false } }),
		preact({
			prerender: {
				enabled: true,
				renderTarget: '#app',
				additionalPrerenderRoutes: ['/404'],
				previewMiddlewareEnabled: true,
				previewMiddlewareFallback: '/404',
			},
		}),
	],
});
