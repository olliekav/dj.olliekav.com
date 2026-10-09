import { describe, expect, it } from 'vitest';
import { contrast, distance, hexToOklch, hexToRgb, oklchToHex, rgbToHex } from '../colour.ts';

describe('colour', () => {
  it('converts hex and RGB', () => {
    expect(hexToRgb('#FF8000')).toEqual([1, 128 / 255, 0]);
    expect(rgbToHex([1, 0.5, -1])).toBe('#FF8000');
  });

  it('round-trips through OKLCH', () => {
    for (const hex of ['#2A10A6', '#EC00A5', '#FFFFFF', '#000000', '#48FFE8']) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex);
    }
    expect(hexToOklch('#FFFFFF').l).toBeCloseTo(1, 3);
    expect(hexToOklch('#808080').c).toBeCloseTo(0, 3);
  });

  it('returns null outside sRGB', () => {
    expect(oklchToHex({ l: 0.5, c: 0.5, h: 150 })).toBeNull();
  });

  it('measures perceptual distance and WCAG contrast', () => {
    expect(distance('#000000', '#000000')).toBe(0);
    expect(distance('#000000', '#FFFFFF')).toBeCloseTo(1, 3);
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#FFFFFF', '#777777')).toBeCloseTo(4.48, 2);
  });
});
