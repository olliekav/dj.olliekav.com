import { beforeAll, describe, expect, it } from 'vitest';
import type { Theme } from '../../../shared/api-types.ts';
import originals from '../../../shared/mix-themes.json' with { type: 'json' };
import { contrast } from '../colour.ts';
import {
  distinctness,
  findClashes,
  generateTheme,
  isAcceptable,
  isDistinctPair,
  pairDistance,
  random,
  regenerate,
  RULES,
  toTheme
} from '../themes.ts';
import { distance, hexToOklch } from '../colour.ts';

const themes: Record<string, Theme> = originals;
const t = (background: string, foreground: string) => toTheme(background, foreground);

describe('random', () => {
  it('is deterministic per seed', () => {
    const a = random('x');
    const b = random('x');
    const c = random('y');
    const first = a();
    expect(first).toBe(b());
    expect(first).not.toBe(c());
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
  });
});

describe('pairDistance', () => {
  it('treats swapped colours as the same combination', () => {
    expect(pairDistance(t('#2A10A6', '#EC00A5'), t('#EC00A5', '#2A10A6'))).toBe(0);
    expect(pairDistance(t('#2A10A6', '#EC00A5'), t('#FFF100', '#000000'))).toBeGreaterThan(0.8);
  });
});

describe('toTheme', () => {
  it('uses the more colourful colour as the accent', () => {
    expect(toTheme('#333333', '#08F9A9')).toMatchObject({ accent: '#08F9A9', dark: true });
    expect(toTheme('#EC1C24', '#FFFFFF')).toMatchObject({ accent: '#EC1C24', dark: false });
  });
});

describe('isAcceptable', () => {
  it.each([
    ['too little contrast', '#777777', '#7A7A80'],
    ['too much contrast', '#FFFF00', '#000044'],
    ['two shades of one colour', '#1E5E12', '#5FD34A'],
    ['a plain white logo', '#1F4FCC', '#FFFFFF'],
    ['a plain black logo', '#FFD84D', '#000000']
  ])('rejects %s', (_label, background, foreground) => {
    expect(isAcceptable({ background, foreground }, [])).toBe(false);
  });

  it('rejects pairs too close to another mix, or to the rest of the batch', () => {
    const pair = { background: '#3F2D8F', foreground: '#E8B040' };
    expect(isAcceptable(pair, [t('#3E2C8E', '#E9B141')])).toBe(false);
    expect(isAcceptable(pair, [])).toBe(true);
    // Shares a background with another mix
    expect(isAcceptable(pair, [t('#402E90', '#FF6A00')])).toBe(false);
    // Fine against the originals, too close within a batch
    const nearby = t('#013B92', '#B88D3A');
    expect(isAcceptable(pair, [nearby])).toBe(true);
    expect(isAcceptable(pair, [], [nearby])).toBe(false);
  });
});

describe('isDistinctPair', () => {
  it.each([
    ['two shades of green', '#1E5E12', '#5FD34A', false],
    ['similar lightness', '#B05C2A', '#4F9AA0', false],
    ['different hue and lightness', '#3F2D8F', '#E8B040', true],
    ['a neutral background', '#EDEBE8', '#A445A1', true],
    ['a large lightness gap in one hue', '#0B3D0B', '#C8FAC0', true]
  ])('%s → %s', (_label, background, foreground, expected) => {
    expect(isDistinctPair({ background, foreground })).toBe(expected);
  });
});

describe('distinctness', () => {
  it('is relative to the thresholds and Infinity with nothing to compare', () => {
    const pair = t('#2A10A6', '#EC00A5');
    expect(distinctness(pair, [])).toBe(Infinity);
    expect(distinctness(pair, [pair])).toBe(0);
  });
});

describe('generateTheme', () => {
  it('is deterministic and varies by variant', () => {
    expect(generateTheme(21, [])).toEqual(generateTheme(21, []));
    expect(generateTheme(21, [], 1)).not.toEqual(generateTheme(21, []));
  });

  it('gives up when no unique theme is possible', () => {
    const minBackgroundDistance = RULES.minBackgroundDistance;
    RULES.minBackgroundDistance = 10; // further than any two colours can be
    try {
      expect(() => generateTheme(1, [t('#3F2D8F', '#E8B040')])).toThrow("Couldn't find a unique theme for mix #1");
    } finally {
      RULES.minBackgroundDistance = minBackgroundDistance;
    }
  }, 30_000);
});

describe('regenerate', () => {
  const numbers = Array.from({ length: 30 }, (_, i) => 21 + i);
  let result: Record<string, Theme>;
  beforeAll(() => {
    result = regenerate(themes, numbers);
  }, 120_000);

  it('replaces only the requested mixes', () => {
    for (const [n, theme] of Object.entries(themes)) {
      if (!numbers.includes(Number(n))) expect(result[n]).toEqual(theme);
    }
  });

  it('keeps every new pair readable, distinct and unlike every other mix', () => {
    const clashes = findClashes(result).filter(([a, b]) => numbers.includes(+a) || numbers.includes(+b));
    expect(clashes).toEqual([]);
    const batch = numbers.map(n => result[n]!);
    for (const [i, theme] of batch.entries()) {
      expect(theme.gradient).toBeUndefined();
      expect(isDistinctPair(theme)).toBe(true);
      const ratio = contrast(theme.background, theme.foreground);
      expect(ratio).toBeGreaterThanOrEqual(RULES.minContrast);
      expect(ratio).toBeLessThanOrEqual(RULES.maxContrast);
      for (const other of batch.slice(i + 1)) {
        expect(pairDistance(theme, other)).toBeGreaterThanOrEqual(RULES.minBatchPairDistance);
        expect(distance(theme.background, other.background)).toBeGreaterThanOrEqual(RULES.minBatchBackgroundDistance);
      }
    }
  });

  it('covers the colour wheel', () => {
    const hues = numbers.map(n => hexToOklch(result[n]!.background)).filter(c => c.c > 0.04).map(c => Math.floor(c.h / 60));
    expect(new Set(hues).size).toBe(6);
  });

  it('is deterministic, and re-rolls only the requested mix', () => {
    expect(regenerate(themes, [21, 22])).toEqual(regenerate(themes, [21, 22]));
    const rerolled = regenerate(result, [27], { 27: 5 });
    expect(rerolled[27]).not.toEqual(result[27]);
    expect(rerolled[28]).toEqual(result[28]);
  });
});
