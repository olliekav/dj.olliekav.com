import React, { Component } from 'react';
import PlaylistSoundPlayer from './components/PlaylistSoundPlayer';

const clientId = process.env.REACT_APP_SC_CLIENT_ID;
const resolveUrl = process.env.REACT_APP_SC_RESOLVE_URL;

class App extends Component {
  render() {
    return (
      <PlaylistSoundPlayer
      clientId={clientId}
      resolveUrl={resolveUrl}
      onReady={() => console.log('Playlist is loaded!')} />
    );
  }
}

export default App;
