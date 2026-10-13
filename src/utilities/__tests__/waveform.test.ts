import { describe, expect, it } from 'vitest';
import { barsLayout } from '../waveform';

describe('barsLayout', () => {
  it.each([
    [100, { width: 102, offset: 0 }],
    [104, { width: 102, offset: 2 }],
    [550, { width: 552, offset: 0 }],
    [553, { width: 552, offset: 1.5 }],
    [0, { width: 0, offset: 0 }]
  ])('centres whole bars in %s px', (available, expected) => {
    expect(barsLayout(available)).toEqual(expected);
  });

  it('leaves the same space either side of the bars', () => {
    for (let available = 10; available < 700; available++) {
      const { width, offset } = barsLayout(available);
      const span = width - 2;
      expect(available - offset - span).toBeCloseTo(offset);
    }
  });
});
