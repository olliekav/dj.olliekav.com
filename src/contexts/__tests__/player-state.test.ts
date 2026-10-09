import { describe, expect, it } from 'vitest';
import type { Mix } from '../../../shared/api-types';
import fixture from '../../../shared/fixtures/mixes.json';
import { hasNext, hasPrev, initialState, playerReducer, type PlayerState } from '../player-state';

const mixes = fixture.mixes as Mix[];
const loaded = playerReducer(initialState, { type: 'loaded', mixes });

describe('playerReducer', () => {
  it('loads mixes without autoplaying', () => {
    expect(loaded).toMatchObject({ status: 'loaded', activeIndex: 0, autoplay: false });
    expect(playerReducer(initialState, { type: 'failed' }).status).toBe('error');
  });

  it('selects a mix and resets playback', () => {
    const playing: PlayerState = { ...loaded, isReady: true, isPlaying: true };
    expect(playerReducer(playing, { type: 'select', index: 2 })).toMatchObject({
      activeIndex: 2,
      isReady: false,
      isPlaying: false,
      autoplay: true
    });
  });

  it('keeps the loaded audio when the current mix is selected again', () => {
    const ready: PlayerState = { ...loaded, isReady: true };
    expect(playerReducer(ready, { type: 'select', index: 0 })).toMatchObject({ isReady: true, autoplay: true });
  });

  it('ignores out of range selections', () => {
    expect(playerReducer(loaded, { type: 'select', index: 3 })).toBe(loaded);
    expect(playerReducer(loaded, { type: 'select', index: -1 })).toBe(loaded);
  });

  it('tracks readiness, playback and clamped volume', () => {
    expect(playerReducer(loaded, { type: 'ready' }).isReady).toBe(true);
    expect(playerReducer(loaded, { type: 'playing', isPlaying: true }).isPlaying).toBe(true);
    expect(playerReducer(loaded, { type: 'volume', volume: 2 }).volume).toBe(1);
    expect(playerReducer(loaded, { type: 'volume', volume: -1 }).volume).toBe(0);
  });
});

describe('navigation', () => {
  it('knows when there is a next or previous mix', () => {
    expect([hasPrev(loaded), hasNext(loaded)]).toEqual([false, true]);
    const last = { ...loaded, activeIndex: 2 };
    expect([hasPrev(last), hasNext(last)]).toEqual([true, false]);
  });
});
