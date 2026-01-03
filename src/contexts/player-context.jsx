import { createContext } from 'preact';
import { useState, useEffect, useReducer } from 'preact/hooks';
import WaveSurfer from 'wavesurfer.js';
import { isSafari, isMobile } from 'react-device-detect';

import Player from '../components/player';
import Loader from '../components/loader';

export const PlayerContext = createContext(null);

const PlayerProvider = props => {
  const [player, setPlayer] = useReducer(
    (state, newState) => ({...state, ...newState}),
    {
      activeIndex: 0,
      currentTrack: {},
      duration: 0,
      tracks_count: 0,
      hasMounted: false,
      isLoaded: false,
      isPlaying: false,
      tracks: [],
      wavesurferReady: false,
      volume: 0.5,
      userInitiated: false,
      token: null
    }
  );
  const [wavesurfer, setWavesurfer] = useState(undefined);
  const isMobileSafari = isSafari && isMobile;

  useEffect(() => {
    fetchPlaylist();
  }, []);

  const fetchPlaylist = async () => {
    try {
      const response = await fetch('/api/soundcloud');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      setPlayer({
        activeIndex: 0,
        currentTrack: data.tracks[0],
        tracks_count: data.playlist.tracks_count,
        duration: data.tracks[0].duration_ms,
        hasMounted: true,
        isLoaded: true,
        tracks: data.tracks,
        token: data.token
      });
    } catch (error) {
      console.error("Error fetching Netlify function:", error);
    }
  };

  const initWavesurfer = (node) => {
    const wavesurfer = WaveSurfer.create({
      barRadius: 3,
      barWidth: 4,
      cursorWidth: 0,
      container: node,
      height: 60,
      mediaControls: false,
      normalize: true,
      progressColor: 'red'
    });
    setWavesurfer(wavesurfer);
  }

  const playTrackAtIndex = (index, track) => {
    setPlayer({
      activeIndex: index,
      currentTrack: track,
      duration: track.duration_ms,
      isPlaying: false,
      wavesurferReady: false,
      userInitiated: true
    });
  } 

  const setTimers = () => {
    const { userInitiated, isPlaying, tracks, activeIndex } = player;
    
    setPlayer({
      wavesurferReady: true
    });

    wavesurfer.on('finish', () => {
      const nextTrack = tracks[activeIndex+1];
      const i = activeIndex+1;
      if (i < tracks.length) {
        playTrackAtIndex(i, nextTrack);
      }
    });
    
    wavesurfer.on('click', () => {
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
        <div class="content">
          {props.children}
        </div>
        <Player />
      </div>
    </PlayerContext.Provider>
  );
};

export default PlayerProvider;
