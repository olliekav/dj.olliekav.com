import { describe, expect, it } from 'vitest';
import type { Theme } from '../../../shared/api-types.ts';
import originals from '../../../shared/mix-themes.json' with { type: 'json' };
import { contrast } from '../colour.ts';
import { findClashes, generateTheme, isAcceptable, pairDistance, random, regenerate, RULES, toTheme } from '../themes.ts';

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
    ['a plain white logo', '#1F4FCC', '#FFFFFF'],
    ['a plain black logo', '#FFD84D', '#000000']
  ])('rejects %s', (_label, background, foreground) => {
    expect(isAcceptable({ background, foreground }, [])).toBe(false);
  });

  it('rejects pairs too close to another mix', () => {
    expect(isAcceptable({ background: '#2B11A7', foreground: '#EB01A4' }, [t('#2A10A6', '#EC00A5')])).toBe(false);
    expect(isAcceptable({ background: '#2B11A7', foreground: '#EB01A4' }, [])).toBe(true);
  });
});

describe('generateTheme', () => {
  it('is deterministic and varies by variant', () => {
    expect(generateTheme(21, [])).toEqual(generateTheme(21, []));
    expect(generateTheme(21, [], 1)).not.toEqual(generateTheme(21, []));
  });

  it('gives up when no unique theme is possible', () => {
    const minContrast = RULES.minContrast;
    RULES.minContrast = 22; // above the maximum possible ratio
    try {
      expect(() => generateTheme(1, [])).toThrow("Couldn't find a unique theme for mix #1");
    } finally {
      RULES.minContrast = minContrast;
    }
  });
});

describe('regenerate', () => {
  const numbers = Array.from({ length: 30 }, (_, i) => 21 + i);
  const result = regenerate(themes, numbers);

  it('replaces only the requested mixes', () => {
    for (const [n, theme] of Object.entries(themes)) {
      if (!numbers.includes(Number(n))) expect(result[n]).toEqual(theme);
    }
  });

  it('keeps every new pair unique, readable and coloured', () => {
    const clashes = findClashes(result).filter(([a, b]) => numbers.includes(+a) || numbers.includes(+b));
    expect(clashes).toEqual([]);
    for (const n of numbers) {
      const theme = result[n]!;
      expect(theme.gradient).toBeUndefined();
      const ratio = contrast(theme.background, theme.foreground);
      expect(ratio).toBeGreaterThanOrEqual(RULES.minContrast);
      expect(ratio).toBeLessThanOrEqual(RULES.maxContrast);
    }
  });

  it('is stable for the same input, and honours variants', () => {
    expect(regenerate(themes, numbers)).toEqual(result);
    const rerolled = regenerate(result, [27], { 27: 5 });
    expect(rerolled[27]).not.toEqual(result[27]);
    expect(rerolled[28]).toEqual(result[28]);
  });
});
