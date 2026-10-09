import type { Theme } from '../../shared/api-types.ts';
import { contrast, distance, hexToOklch, oklchToHex } from './colour.ts';

// Generates two-colour mix themes in the style of the hand-picked ones: a
// background and a contrasting coloured logo, never repeating another mix's pair.

export type Themes = Record<string, Theme>;

export const RULES = {
  // Contrast range of the existing pairs (10th percentile to just above the 90th)
  minContrast: 2.4,
  maxContrast: 7,
  // Pairs closer than this (summed OKLab distance of both colours) count as the same combination.
  // Originals sit a median 0.13 from their nearest neighbour; new pairs must beat 75% of them.
  minPairDistance: 0.16,
  // A logo this close to white or black reads as the plain black/white style
  plainLogoChroma: 0.04,
  plainLogoLightness: [0.25, 0.95] as const,
  // Chance of a neutral (cream/grey) background, as in about a third of the originals
  neutralBackground: 0.25
};

/** Deterministic PRNG so the same mix number and variant always gives the same colours. */
export const random = (seed: string) => {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** How different two pairs look; the swapped pair counts as the same combination. */
export const pairDistance = (a: Pick<Theme, 'background' | 'foreground'>, b: Pick<Theme, 'background' | 'foreground'>) =>
  Math.min(
    distance(a.background, b.background) + distance(a.foreground, b.foreground),
    distance(a.background, b.foreground) + distance(a.foreground, b.background)
  );

const isPlainLogo = (hex: string) => {
  const { l, c } = hexToOklch(hex);
  return c < RULES.plainLogoChroma && (l < RULES.plainLogoLightness[0] || l > RULES.plainLogoLightness[1]);
};

/** The waveform/accent colour is the more colourful of the pair. */
export const toTheme = (background: string, foreground: string): Theme => {
  const accentIsForeground = hexToOklch(foreground).c > hexToOklch(background).c;
  return {
    background,
    foreground,
    accent: accentIsForeground ? foreground : background,
    dark: accentIsForeground
  };
};

// Consecutive mixes step around the colour wheel by the golden angle, so a run of
// new themes covers every hue instead of clustering where sRGB has the most room
const GOLDEN_ANGLE = 137.508;

const sampleColour = (next: () => number, { neutral = false, hue }: { neutral?: boolean; hue?: number } = {}) => {
  // Neutrals are creams/off-whites or charcoals like the originals, never mid-grey
  const l = neutral ? (next() < 0.5 ? 0.9 + next() * 0.08 : 0.22 + next() * 0.12) : 0.3 + next() * 0.65;
  const c = neutral ? next() * 0.03 : 0.09 + next() * 0.17;
  const h = hue === undefined ? next() * 360 : (hue + (next() - 0.5) * 50 + 360) % 360;
  return oklchToHex({ l, c, h });
};

export const isAcceptable = (theme: Pick<Theme, 'background' | 'foreground'>, others: Theme[]) => {
  const ratio = contrast(theme.background, theme.foreground);
  if (ratio < RULES.minContrast || ratio > RULES.maxContrast || isPlainLogo(theme.foreground)) {
    return false;
  }
  return others.every(other => pairDistance(theme, other) >= RULES.minPairDistance);
};

/** Generates a theme unlike all `others`. Same number and variant always give the same result. */
export const generateTheme = (number: number, others: Theme[], variant = 0): Theme => {
  const next = random(`ok-sessions:${number}:${variant}`);
  const hue = (number * GOLDEN_ANGLE + variant * 61) % 360;
  for (let attempt = 0; attempt < 20_000; attempt++) {
    const neutral = next() < RULES.neutralBackground;
    // A neutral background takes its logo from the mix's hue slot instead
    const background = sampleColour(next, neutral ? { neutral } : { hue });
    const foreground = sampleColour(next, neutral ? { hue } : {});
    if (background && foreground && isAcceptable({ background, foreground }, others)) {
      return toTheme(background, foreground);
    }
  }
  throw new Error(`Couldn't find a unique theme for mix #${number}`);
};

/** Regenerates the given mixes in order, each unlike every other mix. */
export const regenerate = (themes: Themes, numbers: number[], variants: Record<number, number> = {}): Themes => {
  const result = { ...themes };
  for (const number of numbers) {
    delete result[number];
  }
  for (const number of numbers) {
    result[number] = generateTheme(number, Object.values(result), variants[number] ?? 0);
  }
  return result;
};

/** Pairs that are too similar to another mix, for checking the whole set. */
export const findClashes = (themes: Themes) => {
  const entries = Object.entries(themes);
  const clashes: [string, string, number][] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const d = pairDistance(entries[i]![1], entries[j]![1]);
      if (d < RULES.minPairDistance) clashes.push([entries[i]![0], entries[j]![0], d]);
    }
  }
  return clashes;
};
