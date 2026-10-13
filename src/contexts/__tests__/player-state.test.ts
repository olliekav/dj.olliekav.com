import { describe, expect, it } from 'vitest';
import type { Mix } from '../../../shared/api-types';
import fixture from '../../../shared/fixtures/mixes.json';
import { hasNext, hasPrev, initialState, playerReducer, stateWith, type PlayerState } from '../player-state';

const mixes: Mix[] = [...fixture.mixes, { ...fixture.mixes[0]!, id: 103, number: 3 }];
const loaded = playerReducer(initialState, { type: 'loaded', mixes });

describe('playerReducer', () => {
  it('loads mixes without autoplaying', () => {
    expect(loaded).toMatchObject({ status: 'loaded', activeIndex: 0, autoplay: false });
    expect(playerReducer(initialState, { type: 'failed' }).status).toBe('error');
  });

  it('starts loaded with prerendered mixes', () => {
    expect(stateWith(mixes)).toMatchObject({ status: 'loaded', mixes, activeIndex: 0 });
    expect(stateWith(undefined)).toBe(initialState);
    expect(stateWith([])).toBe(initialState);
  });

  it('starts on the mix whose page it is', () => {
    expect(stateWith(mixes, 'ok-sessions-2').activeIndex).toBe(1);
    expect(stateWith(mixes, 'nope').activeIndex).toBe(0);
  });

  it('cues a mix without playing it', () => {
    expect(playerReducer({ ...loaded, isReady: true }, { type: 'cue', index: 1 })).toMatchObject({
      activeIndex: 1,
      isReady: false,
      autoplay: false
    });
  });

  it("doesn't cue over a mix the listener chose, or an unknown one", () => {
    const chosen = playerReducer(loaded, { type: 'select', index: 2 });
    expect(playerReducer(chosen, { type: 'cue', index: 1 })).toBe(chosen);
    expect(playerReducer(loaded, { type: 'cue', index: 0 })).toBe(loaded);
    expect(playerReducer(loaded, { type: 'cue', index: 5 })).toBe(loaded);
  });

  it('refreshes prerendered mixes, keeping the current mix and its object', () => {
    const current = { ...loaded, activeIndex: 1 };
    const newMix = { ...mixes[0]!, id: 104, number: 4 };
    const fresh = [newMix, ...mixes.map(mix => ({ ...mix, playback_count: 9999 }))];
    const refreshed = playerReducer(current, { type: 'refreshed', mixes: fresh });
    expect(refreshed.activeIndex).toBe(2);
    expect(refreshed.mixes[2]).toBe(mixes[1]);
    expect(refreshed.mixes[1]!.playback_count).toBe(9999);
    expect(refreshed.mixes).toHaveLength(4);
  });

  it('starts from the top when the current mix is gone from the refresh', () => {
    const refreshed = playerReducer({ ...loaded, activeIndex: 2 }, { type: 'refreshed', mixes: mixes.slice(0, 2) });
    expect(refreshed).toMatchObject({ activeIndex: 0, mixes: mixes.slice(0, 2) });
  });

  it('keeps showing prerendered mixes when the refresh fails', () => {
    expect(playerReducer(loaded, { type: 'failed' })).toBe(loaded);
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

  it('keeps the loaded audio when the current mix is selected again, counting the request', () => {
    const ready: PlayerState = { ...loaded, isReady: true };
    const again = playerReducer(ready, { type: 'select', index: 0 });
    expect(again).toMatchObject({ isReady: true, autoplay: true, playRequest: 1 });
    expect(playerReducer(again, { type: 'select', index: 0 }).playRequest).toBe(2);
  });

  it('ignores out of range selections', () => {
    expect(playerReducer(loaded, { type: 'select', index: 3 })).toBe(loaded);
    expect(playerReducer(loaded, { type: 'select', index: -1 })).toBe(loaded);
  });

  it('tracks readiness, playback and clamped volume', () => {
    expect(playerReducer(loaded, { type: 'ready' }).isReady).toBe(true);
    expect(playerReducer({ ...loaded, isReady: true }, { type: 'loading' }).isReady).toBe(false);
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

describe('unlockMedia', () => {
  it('plays muted and pauses straight away, restoring the mute state', async () => {
    const { unlockMedia } = await import('../player-context');
    const calls: string[] = [];
    const media = {
      paused: true,
      muted: false,
      currentSrc: 'a.m3u8',
      play: () => {
        calls.push(`play muted=${media.muted}`);
        return Promise.reject(new Error('no source'));
      },
      pause: () => calls.push('pause')
    };
    unlockMedia(media as unknown as HTMLMediaElement);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(calls).toEqual(['play muted=true', 'pause']);
    expect(media.muted).toBe(false);
  });

  it("doesn't pause a mix that started while it was settling", async () => {
    const { unlockMedia } = await import('../player-context');
    const calls: string[] = [];
    const media = {
      paused: true,
      muted: false,
      currentSrc: 'a.m3u8',
      play: () => {
        media.currentSrc = 'b.m3u8';
        return Promise.resolve();
      },
      pause: () => calls.push('pause')
    };
    unlockMedia(media as unknown as HTMLMediaElement);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(calls).toEqual([]);
    expect(media.muted).toBe(false);
  });

  it('leaves playing or missing elements alone', async () => {
    const { unlockMedia } = await import('../player-context');
    const media = { paused: false, play: () => { throw new Error('should not play'); } };
    expect(() => unlockMedia(media as unknown as HTMLMediaElement)).not.toThrow();
    expect(() => unlockMedia(null)).not.toThrow();
  });
});
