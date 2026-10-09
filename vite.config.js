import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import netlify from "@netlify/vite-plugin";
import mkcert from 'vite-plugin-mkcert';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		mkcert(),
		// No edge functions in this project, so skip starting Deno to emulate them
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
