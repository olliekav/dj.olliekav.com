import { describe, expect, it, vi } from 'vitest';
import { createPlayTracker } from '../play-tracker';

describe('createPlayTracker', () => {
  it('fires once after the threshold of continuous listening', () => {
    const onPlay = vi.fn();
    const tracker = createPlayTracker(3, onPlay);
    for (let t = 0; t <= 5; t += 0.5) tracker.time(t);
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('ignores seeks and jumps', () => {
    const onPlay = vi.fn();
    const tracker = createPlayTracker(3, onPlay);
    tracker.time(0);
    tracker.time(1);
    tracker.time(60); // jump forward
    tracker.seek();
    tracker.time(120);
    tracker.time(121);
    expect(onPlay).not.toHaveBeenCalled();
    tracker.time(122);
    expect(onPlay).toHaveBeenCalledTimes(1);
  });
});
