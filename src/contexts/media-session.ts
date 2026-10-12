import { useEffect } from 'preact/hooks';
import type { Mix } from '../../shared/api-types';
import type { PlayerContextValue } from './player-context';
import { hasNext, hasPrev } from './player-state';

const FALLBACK_ARTWORK: MediaImage = { src: '/assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' };
const SKIP_SECONDS = 15;

export const mediaMetadataFor = (mix: Mix): MediaMetadataInit => ({
  title: mix.title,
  artist: 'O:K',
  album: 'OK Sessions',
  artwork: mix.artwork_url ? [{ src: mix.artwork_url, sizes: '500x500', type: 'image/jpeg' }] : [FALLBACK_ARTWORK]
});

const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch {}
};

export const useMediaSession = ({ state, currentMix, wavesurfer, togglePlay, next, prev }: PlayerContextValue) => {
  const supported = typeof navigator !== 'undefined' && 'mediaSession' in navigator;

  useEffect(() => {
    if (supported && currentMix) {
      navigator.mediaSession.metadata = new MediaMetadata(mediaMetadataFor(currentMix));
    }
  }, [supported, currentMix]);

  useEffect(() => {
    if (supported) {
      navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';
    }
  }, [supported, state.isPlaying]);

  const canPrev = hasPrev(state);
  const canNext = hasNext(state);
  useEffect(() => {
    if (!supported) {
      return;
    }
    const handlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
      ['play', () => !state.isPlaying && togglePlay()],
      ['pause', () => state.isPlaying && togglePlay()],
      ['previoustrack', canPrev ? prev : null],
      ['nexttrack', canNext ? next : null],
      ['seekto', details => details.seekTime !== undefined && wavesurfer?.setTime(details.seekTime)],
      ['seekbackward', details => wavesurfer?.skip(-(details.seekOffset ?? SKIP_SECONDS))],
      ['seekforward', details => wavesurfer?.skip(details.seekOffset ?? SKIP_SECONDS)]
    ];
    handlers.forEach(([action, handler]) => setHandler(action, handler));
    return () => handlers.forEach(([action]) => setHandler(action, null));
  }, [supported, state.isPlaying, canPrev, canNext, wavesurfer, togglePlay, next, prev]);

  useEffect(() => {
    if (!supported || !wavesurfer) {
      return;
    }
    const updatePosition = () => {
      const duration = wavesurfer.getDuration();
      if (!Number.isFinite(duration) || duration <= 0) {
        return;
      }
      try {
        navigator.mediaSession.setPositionState({
          duration,
          position: Math.min(wavesurfer.getCurrentTime(), duration),
          playbackRate: 1
        });
      } catch {}
    };
    const unsubscribers = [
      wavesurfer.on('ready', updatePosition),
      wavesurfer.on('play', updatePosition),
      wavesurfer.on('pause', updatePosition),
      wavesurfer.on('seeking', updatePosition)
    ];
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [supported, wavesurfer]);
};
