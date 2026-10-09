import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'preact/hooks';
import type Hls from 'hls.js';
import WaveSurfer from 'wavesurfer.js';
import type { Mix } from '../../shared/api-types';
import Loader from '../components/loader';
import Player from '../components/player';
import { fetchMixes, fetchPeaks, fetchStream } from '../utilities/api';
import { hasNext, hasPrev, initialState, playerReducer, type PlayerState } from './player-state';

const FALLBACK_ACCENT = '#CA46A7';

/**
 * Safari only lets media start from a user gesture, but the stream URL arrives
 * after an async request. Calling play() on the element during the click (muted,
 * then paused straight away) marks it as user-started, so the later play() works.
 */
export const unlockMedia = (media: HTMLMediaElement | null | undefined) => {
  if (!media || !media.paused) {
    return;
  }
  const muted = media.muted;
  media.muted = true;
  media
    .play()
    .catch(() => {})
    .finally(() => {
      media.pause();
      media.muted = muted;
    });
};

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

  // Load the current mix: SoundCloud's waveform, and a fresh stream URL from /api/stream.
  // SoundCloud streams are HLS: played natively where supported, otherwise via hls.js.
  useEffect(() => {
    if (!wavesurfer || !currentMix) {
      return;
    }
    let cancelled = false;
    let hls: Hls | undefined;
    wavesurfer.setOptions({ progressColor: currentMix.theme.accent });

    (async () => {
      const duration = currentMix.duration_ms / 1000;
      const [peaks, stream] = await Promise.all([
        fetchPeaks(currentMix.waveform_url).catch(error => {
          // Without peaks wavesurfer shows a flat line until playback
          console.warn('Error fetching waveform', error);
          return undefined;
        }),
        fetchStream(currentMix)
      ]);
      if (cancelled) {
        return;
      }
      const media = wavesurfer.getMediaElement();
      // Safari and Chrome play HLS natively; Firefox needs hls.js (loaded only then)
      if (!media || media.canPlayType('application/vnd.apple.mpegurl')) {
        await wavesurfer.load(stream.url, peaks, duration);
        return;
      }
      await wavesurfer.load('', peaks ?? [[0]], duration);
      const { default: HlsJs } = await import('hls.js');
      if (cancelled) {
        return;
      }
      hls = new HlsJs();
      hls.loadSource(stream.url);
      hls.attachMedia(media);
    })().catch(error => {
      // A newer load (or teardown) superseded this one
      if (!cancelled && (error as Error).name !== 'AbortError') {
        console.error('Error loading audio', error);
      }
    });

    return () => {
      cancelled = true;
      hls?.destroy();
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

  const value = useMemo<PlayerContextValue>(
    () => ({
      state,
      currentMix,
      wavesurfer,
      attachWaveform,
      playAt: index => {
        if (index === stateRef.current.activeIndex) {
          wavesurfer?.play().catch(() => {});
        } else {
          unlockMedia(wavesurfer?.getMediaElement());
        }
        dispatch({ type: 'select', index });
      },
      next: () => {
        if (hasNext(stateRef.current)) {
          unlockMedia(wavesurfer?.getMediaElement());
          dispatch({ type: 'select', index: stateRef.current.activeIndex + 1 });
        }
      },
      prev: () => {
        if (hasPrev(stateRef.current)) {
          unlockMedia(wavesurfer?.getMediaElement());
          dispatch({ type: 'select', index: stateRef.current.activeIndex - 1 });
        }
      },
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
