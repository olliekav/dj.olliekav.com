import { LocationProvider, Router, Route, hydrate, prerender as ssr } from 'preact-iso';
import type { Mix } from '../shared/api-types';
import PlayerProvider from './contexts/player-context';

import { NotFound } from './pages/_404';
import './style.css';
import Playlist from './pages/Playlist';
import { fetchMixes } from './utilities/api';
import { homeHead, notFoundHead } from './utilities/seo';

export function App({ mixes }: { mixes?: Mix[] }) {
	return (
		<PlayerProvider initialMixes={mixes}>
			<LocationProvider>
				<main>
					<Router>
						<Route path="/" component={Playlist} />
						<Route default component={NotFound} />
					</Router>
				</main>
			</LocationProvider>
		</PlayerProvider>
	);
}

/** The mixes the page was prerendered with. Read before hydrating, which removes the script */
const prerenderedMixes = (): Mix[] | undefined => {
	const script = document.getElementById('prerender-data');
	try {
		return script ? (JSON.parse(script.textContent ?? '') as { mixes?: Mix[] }).mixes : undefined;
	} catch {
		return undefined;
	}
};

if (typeof window !== 'undefined') {
	hydrate(<App mixes={prerenderedMixes()} />, document.getElementById('app')!);

	if (import.meta.env.PROD && 'serviceWorker' in navigator) {
		addEventListener('load', () => {
			navigator.serviceWorker.register('/sw.js').catch(error => console.warn('Service worker failed to register', error));
		});
	}
}

let buildMixes: Promise<Mix[] | undefined> | undefined;

/**
 * The live playlist, rendered into the HTML for search engines. Fetched once per build;
 * without it the page still prerenders, and loads the mixes in the browser.
 */
const mixesForBuild = () => {
	// Only runs in Node at build time
	const apiUrl = (process.env.PRERENDER_API_URL ?? 'https://dj.olliekav.com').replace(/\/$/, '');
	return (buildMixes ??= fetchMixes(url => fetch(url, { signal: AbortSignal.timeout(15_000) }), apiUrl).catch(error => {
		console.warn(`Prerendering without mixes: couldn't fetch ${apiUrl}/api/mixes`, error);
		return undefined;
	}));
};

export async function prerender({ url }: { url: string }) {
	const mixes = await mixesForBuild();
	const { html, links } = await ssr(<App mixes={mixes} />);
	const isHome = url === '/';
	return {
		html,
		links,
		head: isHome ? homeHead(mixes ?? []) : notFoundHead(),
		data: mixes && { mixes }
	};
}
