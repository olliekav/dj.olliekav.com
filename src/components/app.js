import { h, Component } from 'preact';
import { Router } from 'preact-router';

import Playlist from '../routes/playlist';
import Profile from '../routes/about';

export default class App extends Component {
	
	handleRoute = e => {
		this.currentUrl = e.url;
	};

	render() {
		return (
			<div id="app">
				<Router onChange={this.handleRoute}>
					<Playlist path="/" />
					<Profile path="/about/" />
				</Router>
			</div>
		);
	}
}
