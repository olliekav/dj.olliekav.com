import { LocationProvider, Router, Route, hydrate, prerender as ssr } from 'preact-iso';
import PlayerProvider from './contexts/player-context';

import { NotFound } from './pages/_404.jsx';
import './style.scss';
import Playlist from './pages/Playlist/index.jsx';

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
	hydrate(<App />, document.getElementById('app'));
}

export async function prerender(data) {
	return await ssr(<App {...data} />);
}
