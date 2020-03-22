import { h, Component } from 'preact';
import style from './style';
import Player from '../../components/player';
import Logo from '../../components/logo';
import Loader from '../../components/loader';
import { prettyTime, slugify } from '../../utilities';
import Parser from 'rss-parser';
import ClassNames from 'classnames';
import processString from 'react-process-string';

const CORS_PROXY = "https://cors-anywhere.herokuapp.com/";

export default class Playlist extends Component {
  state = {
    activeIndex: 0,
    audio: new Audio(),
    currentTrack: undefined,
    isPlaying: false,
    isWaveformReady: false,
    modalIsOpen: false,
    modalTrack: '',
    playlist: [],
    volume: 0.5
  };

  componentDidMount() {
    this.loadSoundCloudRSS();
  }

  componentWillUnmount() {

  }

  // update the current time
  loadSoundCloudRSS = async () => {
    const { audio } = this.state;
    let parser = new Parser();
    let feed = await parser.parseURL(CORS_PROXY + 'https://feeds.soundcloud.com/users/soundcloud:users:1394765/sounds.rss');
    console.log(feed);
    let playlist = feed.items.reverse();
    audio.src = playlist[0].enclosure.url;
    this.setState({
      activeIndex: 0,
      currentTrack: playlist[0],
      playlist: playlist
    });
  };

  isWaveformReady = (state) => {
    this.setState({
      isWaveformReady: state
    })
  }

  playTrackAtIndex = (index, track) => {
    const { audio, activeIndex, isPlaying } = this.state;
    audio.src = track.enclosure.url;
    isPlaying && activeIndex === index ? audio.pause() : audio.play();
    this.setState({
      activeIndex: index,
      currentTrack: track,
      isPlaying: true
    });
  }

  renderTrackList() {
    const { activeIndex, playlist } = this.state;
    const tracks = playlist.map((track, i) => {
      const classNames = ClassNames('playlist-track-button', {
        'active-track': activeIndex === i
      });
      const trackTitle = slugify(track.title);
      return (
        <div 
          key={track.id}
          className={'playlist-track ' + trackTitle}>
          <button
            className={classNames}
            onClick={() => this.playTrackAtIndex(i, track)}>
            <Logo className="playlist-track-icon"/>
            <h2 className="playlist-track-title">#{i+1}</h2>
            <span className="playlist-track-time">{track.itunes.duration}</span>
            <span className="playlist-track-genre">{track.genre}</span>
          </button>
        </div>
      );
    });
    return (
      <div className="playlist">{tracks}</div>
    );
  }

  render({ }, { audio, currentTrack, playlist }) {
    if (!playlist.length) {
      return (
        <Loader />
      )
    }
    return (
      <div className="wrapper loaded">
        {this.renderTrackList()}
        <Player
          audio={audio}
          currentTrack={currentTrack}
        />
      </div>
    );
  }
}
