import { h, Component, createContext, createRef } from 'preact';
import { forwardRef } from "preact/compat";
import { useState, useRef, useEffect, useReducer, useCallback } from 'preact/hooks';
import WaveSurfer from 'wavesurfer.js';

import Player from '../components/player';
import Loader from '../components/loader';

export const PlayerContext = createContext();

const PlayerProvider = props => {
  const [player, setPlayer] = useReducer(
    (state, newState) => ({...state, ...newState}),
    {
      activeIndex: 0,
      currentTrack: [],
      currentTime: 0,
      duration: 0,
      isLoaded: false,
      isPlaying: false,
      playlist: [],
      wavesurferReady: false,
      volume: 0.5
    }
  );
  const [wavesurfer, setWavesurfer] = useState(undefined);

  useEffect(() => {
    getPlaylist();
  }, []);

  const getPlaylist = async () => {
    const response = await fetch('./.netlify/functions/node-fetch');
    if(response.ok) {
      const feed = await response.json();
      const playlist = feed.feed.reverse();
      setPlayer({
        activeIndex: 0,
        currentTrack: playlist[0],
        isLoaded: true,
        playlist: playlist
      });
    }
  };

  const initWavesurfer = (node) => {
    const wavesurfer = WaveSurfer.create({
      backend: 'MediaElement',
      barRadius: 3,
      barWidth: 4,
      cursorWidth: 0,
      closeAudioContext: true,
      container: node,
      height: 60,
      mediaControls: false,
      normalize: true,
      progressColor: 'red',
      responsive: true
    });
    setWavesurfer(wavesurfer);
  }

  const playTrackAtIndex = (index, track) => {
    const { isPlaying, activeIndex } = player;
    const isCurrentTrack = isPlaying && activeIndex === index;

    setPlayer({
      activeIndex: index,
      currentTime: 0,
      currentTrack: track,
      duration: 0,
      isPlaying: false,
      wavesurferReady: false
    });
  }

  const setTimers = () => {
    setPlayer({
      currentTime: wavesurfer.getCurrentTime(),
      duration: wavesurfer.getDuration(),
      wavesurferReady: true
    });
    wavesurfer.on('audioprocess', updateTimer);
    wavesurfer.on('seek', updateTimer);
  }

  const updateTimer = () => {
    setPlayer({
      currentTime: wavesurfer.getCurrentTime()
    });
  }

  const playPause = () => {
    const { isPlaying } = player;
    setPlayer({ isPlaying: !isPlaying });
    wavesurfer.playPause();
  }

  const changeVolume = (value) => {
    setPlayer({ volume: value });
    wavesurfer.setVolume(value);
  }

  if (!player.isLoaded) {
    return (
      <Loader />
    )
  }

  return (
    <PlayerContext.Provider value={{
      player,
      wavesurfer,
      setWavesurfer,
      changeVolume: changeVolume,
      playTrackAtIndex: playTrackAtIndex,
      playPause: playPause,
      setTimers: setTimers,
      initWavesurfer: initWavesurfer
    }}>
      <div class="wrapper loaded">
        <main class="main">
          {props.children}
        </main>
        <Player />
      </div>
    </PlayerContext.Provider>
  );
};

export default PlayerProvider;
