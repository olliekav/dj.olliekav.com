import { h, Component } from 'preact';
import { Router } from 'preact-router';
import Player from '../components/player';
import PlayerProvider from '../contexts/player-context';
import Playlist from '../routes/playlist';

export default class App extends Component {
	
	handleRoute = e => {
		this.currentUrl = e.url;
	};

	render() {
		return (
			<div id="app">
				<PlayerProvider>
					<Router onChange={this.handleRoute}>
						<Playlist path="/" />
					</Router>
				</PlayerProvider>
			</div>
		);
	}
}
