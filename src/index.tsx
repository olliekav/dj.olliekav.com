import { LocationProvider, Router, Route, hydrate, prerender as ssr } from 'preact-iso';
import type { Mix } from '../shared/api-types';
import PlayerProvider from './contexts/player-context';

import { NotFound } from './pages/_404';
import './style.css';
import MixPage from './pages/Mix';
import Playlist from './pages/Playlist';
import { mixesForBuild } from './utilities/build-mixes';
import { headFor, mixSlug } from './utilities/seo';

export function App({ mixes }: { mixes?: Mix[] }) {
	return (
		<PlayerProvider initialMixes={mixes} initialSlug={mixSlug(location.pathname)}>
			<LocationProvider>
				<main>
					<Router>
						<Route path="/" component={Playlist} />
						<Route path="/mixes/:slug" component={MixPage} />
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

export async function prerender({ url }: { url: string }) {
	const mixes = await mixesForBuild();
	const { html, links } = await ssr(<App mixes={mixes} />);
	return {
		html,
		links,
		head: headFor(url, mixes ?? []),
		data: mixes && { mixes }
	};
}
