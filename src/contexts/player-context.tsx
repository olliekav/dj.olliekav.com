import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'preact/hooks';
import WaveSurfer from 'wavesurfer.js';
import type { Mix } from '../../shared/api-types';
import Loader from '../components/loader';
import Player from '../components/player';
import { fetchMixes, fetchPeaks, reportPlay } from '../utilities/api';
import { createPlayTracker } from '../utilities/play-tracker';
import { hasNext, hasPrev, initialState, playerReducer, type PlayerState } from './player-state';

// Seconds of listening before a play is counted
const PLAY_THRESHOLD = 30;
const FALLBACK_ACCENT = '#CA46A7';

export interface PlayerContextValue {
  state: PlayerState;
  currentMix: Mix | undefined;
  wavesurfer: WaveSurfer | undefined;
  attachWaveform: (node: HTMLElement) => void;
  playAt: (index: number) => void;
  next: () => void;
  prev: () => void;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
}

export const PlayerContext = createContext<PlayerContextValue | null>(null);

export const usePlayer = (): PlayerContextValue => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used inside <PlayerProvider>');
  }
  return context;
};

const PlayerProvider = ({ children }: { children?: ComponentChildren }) => {
  const [state, dispatch] = useReducer(playerReducer, initialState);
  const [wavesurfer, setWavesurfer] = useState<WaveSurfer>();
  const currentMix = state.mixes[state.activeIndex];

  // Event handlers registered once read the latest state through this ref
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    fetchMixes().then(
      mixes => dispatch({ type: 'loaded', mixes }),
      error => {
        console.error('Error fetching mixes:', error);
        dispatch({ type: 'failed' });
      }
    );
  }, []);

  const attachWaveform = useCallback((container: HTMLElement) => {
    setWavesurfer(
      WaveSurfer.create({
        container,
        barRadius: 3,
        barWidth: 4,
        cursorWidth: 0,
        height: 60,
        mediaControls: false,
        normalize: true,
        progressColor: FALLBACK_ACCENT
      })
    );
  }, []);

  // Wire wavesurfer events into state once per instance
  useEffect(() => {
    if (!wavesurfer) {
      return;
    }
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
    const applyScheme = () => wavesurfer.setOptions({ waveColor: darkMode.matches ? '#262626' : '#CCCCCC' });
    applyScheme();
    darkMode.addEventListener('change', applyScheme);

    const unsubscribers = [
      wavesurfer.on('ready', () => dispatch({ type: 'ready' })),
      wavesurfer.on('play', () => dispatch({ type: 'playing', isPlaying: true })),
      wavesurfer.on('pause', () => dispatch({ type: 'playing', isPlaying: false })),
      wavesurfer.on('finish', () => {
        if (hasNext(stateRef.current)) {
          dispatch({ type: 'select', index: stateRef.current.activeIndex + 1 });
        }
      }),
      // Clicking the waveform seeks; start playing too if paused
      wavesurfer.on('interaction', () => {
        if (!wavesurfer.isPlaying()) {
          wavesurfer.play().catch(() => {});
        }
      })
    ];

    return () => {
      darkMode.removeEventListener('change', applyScheme);
      unsubscribers.forEach(unsubscribe => unsubscribe());
      wavesurfer.destroy();
    };
  }, [wavesurfer]);

  // Load the current mix's audio and peaks
  useEffect(() => {
    if (!wavesurfer || !currentMix) {
      return;
    }
    let cancelled = false;
    wavesurfer.setOptions({ progressColor: currentMix.theme.accent });

    (async () => {
      let peaks: number[][] | undefined;
      try {
        peaks = await fetchPeaks(currentMix.peaks_url);
      } catch (error) {
        // Without peaks wavesurfer decodes the waveform from the audio itself
        console.warn('Error fetching peaks', error);
      }
      if (cancelled) {
        return;
      }
      try {
        await wavesurfer.load(currentMix.audio.m4a, peaks, currentMix.duration_ms / 1000);
      } catch (error) {
        // A newer load (or teardown) superseded this one
        if (!cancelled && (error as Error).name !== 'AbortError') {
          console.error('Error loading audio', error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wavesurfer, currentMix]);

  // Start playback when the listener chose this mix. Browsers may block this
  // outside a user gesture (e.g. iOS Safari after an async load); the play
  // button still works and play/pause events keep the UI in sync.
  useEffect(() => {
    if (wavesurfer && state.isReady && state.autoplay) {
      wavesurfer.play().catch(() => {});
    }
  }, [wavesurfer, state.isReady, state.autoplay]);

  // Count a play once per mix after PLAY_THRESHOLD seconds of listening, and completions
  useEffect(() => {
    if (!wavesurfer || !currentMix) {
      return;
    }
    const { slug } = currentMix;
    const tracker = createPlayTracker(PLAY_THRESHOLD, () => reportPlay(slug));
    const unsubscribers = [
      wavesurfer.on('timeupdate', time => tracker.time(time)),
      wavesurfer.on('seeking', () => tracker.seek()),
      wavesurfer.on('finish', () => reportPlay(slug, { completed: true }))
    ];
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [wavesurfer, currentMix]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      state,
      currentMix,
      wavesurfer,
      attachWaveform,
      playAt: index => {
        if (index === stateRef.current.activeIndex) {
          wavesurfer?.play().catch(() => {});
        }
        dispatch({ type: 'select', index });
      },
      next: () => hasNext(stateRef.current) && dispatch({ type: 'select', index: stateRef.current.activeIndex + 1 }),
      prev: () => hasPrev(stateRef.current) && dispatch({ type: 'select', index: stateRef.current.activeIndex - 1 }),
      togglePlay: () => {
        wavesurfer?.playPause().catch(() => {});
      },
      setVolume: volume => {
        dispatch({ type: 'volume', volume });
        wavesurfer?.setVolume(volume);
      }
    }),
    [state, currentMix, wavesurfer, attachWaveform]
  );

  if (state.status === 'loading') {
    return <Loader />;
  }

  if (state.status === 'error') {
    return (
      <section class="error">
        <p>Couldn't load the mixes. Please try again later.</p>
      </section>
    );
  }

  return (
    <PlayerContext.Provider value={value}>
      <div class="wrapper loaded">
        <div class="content">{children}</div>
        <Player />
      </div>
    </PlayerContext.Provider>
  );
};

export default PlayerProvider;
