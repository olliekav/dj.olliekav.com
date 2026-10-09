import type { Mix } from '../../shared/api-types';

export interface PlayerState {
  status: 'loading' | 'loaded' | 'error';
  mixes: Mix[];
  activeIndex: number;
  /** The current mix's audio is loaded and can play */
  isReady: boolean;
  isPlaying: boolean;
  volume: number;
  /**
   * The listener has asked to play (picked a mix or pressed play). Until then only the
   * waveform loads: each stream URL counts towards SoundCloud's daily limit.
   */
  autoplay: boolean;
  /** Bumped on every request to play, so a failed stream can be retried */
  playRequest: number;
}

export type PlayerAction =
  | { type: 'loaded'; mixes: Mix[] }
  | { type: 'failed' }
  | { type: 'select'; index: number }
  | { type: 'loading' }
  | { type: 'ready' }
  | { type: 'playing'; isPlaying: boolean }
  | { type: 'volume'; volume: number };

export const initialState: PlayerState = {
  status: 'loading',
  mixes: [],
  activeIndex: 0,
  isReady: false,
  isPlaying: false,
  volume: 0.5,
  autoplay: false,
  playRequest: 0
};

export const playerReducer = (state: PlayerState, action: PlayerAction): PlayerState => {
  switch (action.type) {
    case 'loaded':
      return { ...state, status: 'loaded', mixes: action.mixes, activeIndex: 0 };
    case 'failed':
      return { ...state, status: 'error' };
    case 'select':
      if (action.index < 0 || action.index >= state.mixes.length) {
        return state;
      }
      if (action.index === state.activeIndex) {
        return { ...state, autoplay: true, playRequest: state.playRequest + 1 };
      }
      return {
        ...state,
        activeIndex: action.index,
        isReady: false,
        isPlaying: false,
        autoplay: true,
        playRequest: state.playRequest + 1
      };
    case 'loading':
      return { ...state, isReady: false };
    case 'ready':
      return { ...state, isReady: true };
    case 'playing':
      return { ...state, isPlaying: action.isPlaying };
    case 'volume':
      return { ...state, volume: Math.min(1, Math.max(0, action.volume)) };
  }
};

export const hasNext = (state: PlayerState) => state.activeIndex < state.mixes.length - 1;
export const hasPrev = (state: PlayerState) => state.activeIndex > 0;
