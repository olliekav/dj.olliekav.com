import { LocationProvider, Router, Route, hydrate, prerender as ssr } from 'preact-iso';
import PlayerProvider from './contexts/player-context';

import { NotFound } from './pages/_404';
import './style.scss';
import Playlist from './pages/Playlist';

export function App() {
	return (
		<PlayerProvider>
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

if (typeof window !== 'undefined') {
	hydrate(<App />, document.getElementById('app')!);

	// Not in development, where a cached shell would hide changes
	if (import.meta.env.PROD && 'serviceWorker' in navigator) {
		addEventListener('load', () => {
			navigator.serviceWorker.register('/sw.js').catch(error => console.warn('Service worker failed to register', error));
		});
	}
}

export async function prerender(data: Record<string, unknown>) {
	return await ssr(<App {...data} />);
}
