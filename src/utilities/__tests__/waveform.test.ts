import { describe, expect, it } from 'vitest';
import { BAR_WIDTH, barsLayout } from '../waveform';

const GAP = BAR_WIDTH / 2;
const SLOT = BAR_WIDTH + GAP;

describe('barsLayout', () => {
  it('sizes the container to whole bars', () => {
    for (let available = SLOT; available < 700; available++) {
      expect(barsLayout(available).width % SLOT).toBe(0);
    }
  });

  it('leaves the same space either side of the bars', () => {
    for (let available = SLOT; available < 700; available++) {
      const { width, offset } = barsLayout(available);
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThan(SLOT);
      expect(available - offset - (width - GAP)).toBeCloseTo(offset);
    }
  });

  it('draws nothing without room for a bar', () => {
    expect(barsLayout(0)).toEqual({ width: 0, offset: 0 });
  });
});
