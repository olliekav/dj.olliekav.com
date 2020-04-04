import { h, Component, createContext, createRef } from 'preact';
import { forwardRef } from "preact/compat";
import Parser from 'rss-parser';
import WaveSurfer from 'wavesurfer.js';

import Player from '../components/player';
import Loader from '../components/loader';

// const CORS_PROXY = "https://cors-anywhere.herokuapp.com/";

export const PlayerContext = createContext();

class PlayerProvider extends Component {

  constructor() {
    super();
    this.state = {
      activeIndex: 0,
      currentTrack: [],
      currentTime: 0,
      duration: 0,
      isLoaded: false,
      isPlaying: false,
      playlist: [],
      setWaveform: false,
      wavesurfer: undefined,
      volume: 0.5
    };
    
    this.wavesurfer = WaveSurfer.create({
      container: document.createElement('div')
    });

    this.playerRef = createRef();
    this.waveformRef = createRef();
  }

  componentDidMount(){
    this.getPlaylist();
  }

  initWaveSurfer = () => {
    // Re-render the waveform when the dom is ready
    this.wavesurfer = WaveSurfer.create({
      backend: 'MediaElement',
      barRadius: 3,
      barWidth: 2,
      cursorWidth: 0,
      closeAudioContext: true,
      container: this.waveformRef.current,
      height: 60,
      mediaControls: false,
      normalize: true,
      progressColor: 'red',
      responsive: true
    });
    this.setState({
      setWaveform: true
    }, () => {
      this.wavesurfer.on('ready', () => {
        this.setTimers();
      });
    })
  }

  // update the current time
  getPlaylist = async () => {
    const response = await fetch("./.netlify/functions/node-fetch");
    if(response.ok) {
      const feed = await response.json();
      const playlist = feed.feed.reverse();
      this.setState({
        activeIndex: 0,
        currentTrack: playlist[0],
        isLoaded: true,
        playlist: playlist
      }, () => {
        this.initWaveSurfer();
      });
    }
  };

  playTrackAtIndex = (index, track) => {
    const { activeIndex, isPlaying } = this.state;
    const isCurrentTrack = isPlaying && activeIndex === index;

    this.setState({
      activeIndex: index,
      currentTime: 0,
      currentTrack: track,
      duration: 0
    });

    this.wavesurfer.on("ready", () => {
      this.setState({
        duration: this.wavesurfer.getDuration(),
        isPlaying: true
      });
      this.updateTimer();
      this.wavesurfer.playPause();
    });
  }

  setTimers = () => {
    this.setState({
      currentTime: this.wavesurfer.getCurrentTime(),
      duration: this.wavesurfer.getDuration()
    });
    this.wavesurfer.on("audioprocess", this.updateTimer);
    this.wavesurfer.on("seek", this.updateTimer);
  }

  updateTimer = () => {
    this.setState({
      currentTime: this.wavesurfer.getCurrentTime()
    });
  }

  playPause = () => {
    this.setState({ isPlaying: !this.state.isPlaying });
    this.wavesurfer.playPause();
  }

  changeVolume = (value) => {
    this.setState({ volume: value });
    this.wavesurfer.setVolume(value);
  }

  render({ children }, { isLoaded }) {
    if (!isLoaded) {
      return (
        <Loader />
      )
    }
    return (
      <PlayerContext.Provider value={{
        ...this.state,
        changeVolume: this.changeVolume,
        playTrackAtIndex: this.playTrackAtIndex,
        playPause: this.playPause,
        wavesurfer: this.wavesurfer
      }}>
        <div class="wrapper loaded">
          {children}
          <Player
            ref={this.playerRef}
            waveformChildRef={this.waveformRef}
          />
        </div>
      </PlayerContext.Provider>
    );
  }
}

export default PlayerProvider;