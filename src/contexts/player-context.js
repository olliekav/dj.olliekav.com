import { h, Component, createContext, createRef } from 'preact';
import { forwardRef } from "preact/compat";
import { useState, useRef, useEffect, useReducer, useCallback } from 'preact/hooks';
import WaveSurfer from 'wavesurfer.js';
import { isSafari, isMobile } from 'react-device-detect';

import Player from '../components/player';
import Loader from '../components/loader';

export const PlayerContext = createContext();

const PlayerProvider = props => {
  const [player, setPlayer] = useReducer(
    (state, newState) => ({...state, ...newState}),
    {
      activeIndex: 0,
      currentTrack: [],
      duration: 0,
      hasMounted: false,
      isLoaded: false,
      isPlaying: false,
      playlist: [],
      wavesurferReady: false,
      volume: 0.5,
      userInitiated: false
    }
  );
  const [wavesurfer, setWavesurfer] = useState(undefined);
  const isMobileSafari = isSafari && isMobile;
  const isDesktopSafari = isSafari && !isMobile;

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
        duration: playlist[0].itunes.duration,
        hasMounted: true,
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
    wavesurfer.backend.ac.resume();
    setWavesurfer(wavesurfer);
  }

  const playTrackAtIndex = (index, track) => {
    const { isPlaying, activeIndex } = player;
    const isCurrentTrack = isPlaying && activeIndex === index;

    // Handle user gestures not propagating in Safari
    if(isDesktopSafari) {
      wavesurfer.play()
      .then(data => wavesurfer.pause())
      .catch(err => reject(err));
    }

    setPlayer({
      activeIndex: index,
      currentTrack: track,
      duration: track.itunes.duration,
      isPlaying: false,
      wavesurferReady: false,
      userInitiated: true
    });
  } 

  const setTimers = () => {
    const { userInitiated, isPlaying, currentTrack, playlist, activeIndex } = player;
    
    setPlayer({
      wavesurferReady: true
    });

    wavesurfer.on('finish', () => {
      const nextTrack = playlist[activeIndex+1];
      const i = activeIndex+1;
      if (i < playlist.length) {
        playTrackAtIndex(i, nextTrack);
      }
    });
    
    wavesurfer.drawer.on('click', (event, progress) => {
      if(!isPlaying) {
        play();
      }
    });

    if (userInitiated && !isMobileSafari) {
      play();
    }
  }

  const play = () => {
    setPlayer({ isPlaying: true });
    wavesurfer.play();
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
      changeVolume,
      playTrackAtIndex,
      playPause,
      setTimers,
      initWavesurfer
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
