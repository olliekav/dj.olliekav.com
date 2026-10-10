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

/** Browsers may refuse to play (e.g. Safari's autoplay rules); say why rather than fail silently. */
const reportPlayError = (error: unknown) => {
  const { name, message } = error as Error;
  if (name !== 'AbortError') {
    console.warn(`Playback was refused: ${name}: ${message}`);
  }
};

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
  const src = media.currentSrc;
  media.muted = true;
  media
    .play()
    .catch(() => {})
    .finally(() => {
      // Safari can take a while to settle this; by then the next mix may be playing
      if (media.currentSrc === src) {
        media.pause();
      }
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

    const media = wavesurfer.getMediaElement();
    const onMediaError = () => {
      if (media?.error && media.currentSrc) {
        console.error(`Couldn't play the stream (media error ${media.error.code}): ${media.error.message}`);
      }
    };
    media?.addEventListener('error', onMediaError);

    const unsubscribers = [
      () => media?.removeEventListener('error', onMediaError),
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
          wavesurfer.play().catch(reportPlayError);
        }
      })
    ];

    return () => {
      darkMode.removeEventListener('change', applyScheme);
      unsubscribers.forEach(unsubscribe => unsubscribe());
      wavesurfer.destroy();
    };
  }, [wavesurfer]);

  // The stream currently loaded into the media element, if any
  const streamFor = useRef<string | null>(null);

  // Load the current mix's waveform, and once the listener asks to play, a fresh
  // stream URL from /api/stream (each counts towards SoundCloud's daily limit).
  // SoundCloud streams are HLS: played natively where supported, otherwise via hls.js.
  useEffect(() => {
    if (!wavesurfer || !currentMix) {
      return;
    }
    let cancelled = false;
    let hls: Hls | undefined;
    const wantsStream = state.autoplay;
    wavesurfer.setOptions({ progressColor: currentMix.theme.accent });
    dispatch({ type: 'loading' });

    (async () => {
      const duration = currentMix.duration_ms / 1000;
      const [peaks, stream] = await Promise.all([
        fetchPeaks(currentMix.waveform_url).catch(error => {
          // Without peaks wavesurfer shows a flat line
          console.warn('Error fetching waveform', error);
          return undefined;
        }),
        wantsStream ? fetchStream(currentMix) : undefined
      ]);
      if (cancelled) {
        return;
      }
      // Without peaks wavesurfer would fetch and decode the URL itself, which fails for HLS
      const channels = peaks ?? [[0]];
      const media = wavesurfer.getMediaElement();
      if (!stream) {
        // Just the waveform, ready for the listener to press play
        streamFor.current = null;
        await wavesurfer.load('', channels, duration);
        return;
      }
      streamFor.current = currentMix.urn;
      // Safari and Chrome play HLS natively; Firefox needs hls.js (loaded only then)
      if (!media || media.canPlayType('application/vnd.apple.mpegurl')) {
        await wavesurfer.load(stream.url, channels, duration);
        return;
      }
      await wavesurfer.load('', channels, duration);
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
  }, [wavesurfer, currentMix, state.autoplay, state.playRequest]);

  // Start playback when the listener chose this mix. Browsers may block this
  // outside a user gesture (e.g. iOS Safari after an async load); the play
  // button still works and play/pause events keep the UI in sync.
  useEffect(() => {
    if (wavesurfer && state.isReady && state.autoplay) {
      wavesurfer.play().catch(reportPlayError);
    }
  }, [wavesurfer, state.isReady, state.autoplay]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      state,
      currentMix,
      wavesurfer,
      attachWaveform,
      playAt: index => {
        const { activeIndex, mixes } = stateRef.current;
        if (index === activeIndex && streamFor.current === mixes[index]?.urn) {
          wavesurfer?.play().catch(reportPlayError);
          return;
        }
        // Keep Safari's permission from this click for when the stream arrives
        unlockMedia(wavesurfer?.getMediaElement());
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
        const { activeIndex, mixes } = stateRef.current;
        if (streamFor.current !== mixes[activeIndex]?.urn) {
          // No stream yet: fetch one, keeping Safari's permission from this click
          unlockMedia(wavesurfer?.getMediaElement());
          dispatch({ type: 'select', index: activeIndex });
          return;
        }
        wavesurfer?.playPause().catch(reportPlayError);
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
