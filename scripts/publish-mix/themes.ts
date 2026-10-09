import type { Theme } from '../../shared/api-types.ts';
import { contrast, distance, hexToOklch, maxChroma, oklchToHex } from './colour.ts';

// Generates two-colour mix themes in the style of the hand-picked ones: a
// background and a contrasting coloured logo, never repeating another mix's pair.

export type Themes = Record<string, Theme>;

export const RULES = {
  // Contrast range: the originals' lower quartile up to just above their 90th percentile
  minContrast: 3,
  maxContrast: 7,
  // Pairs closer than this (summed OKLab distance of both colours) count as the same combination.
  // Originals sit a median 0.13 from their nearest neighbour; new pairs must beat 75% of them.
  minPairDistance: 0.16,
  // Mixes generated together are held further apart so a new batch looks varied
  minBatchPairDistance: 0.22,
  // Backgrounds must differ from other mixes' backgrounds, and more so within a batch
  minBackgroundDistance: 0.05,
  minBatchBackgroundDistance: 0.09,
  // Logo and background must differ in lightness...
  minLightnessDifference: 0.25,
  // ...and in hue, unless the lightness gap is large or one colour is neutral
  minHueDifference: 70,
  hueExemptLightnessDifference: 0.45,
  neutralChroma: 0.04,
  // One colour of each pair must be this light (OKLab), as in three-quarters of the originals
  minLighterColour: 0.75,
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

const MIN_CHROMA = 0.09;

const sampleColour = (next: () => number, { neutral = false, hue }: { neutral?: boolean; hue?: number } = {}) => {
  const h = hue === undefined ? next() * 360 : (hue + (next() - 0.5) * 50 + 360) % 360;
  if (neutral) {
    // Creams/off-whites or charcoals like the originals, never mid-grey
    const l = next() < 0.5 ? 0.9 + next() * 0.08 : 0.22 + next() * 0.12;
    return oklchToHex({ l, c: Math.min(next() * 0.03, maxChroma(l, h)), h });
  }
  // Sample chroma within what sRGB can show, so no candidates are wasted out of gamut
  const l = 0.3 + next() * 0.65;
  const ceiling = Math.min(0.26, maxChroma(l, h));
  if (ceiling < MIN_CHROMA) {
    return null;
  }
  return oklchToHex({ l, c: MIN_CHROMA + next() * (ceiling - MIN_CHROMA), h });
};

const hueDifference = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** Background and logo read as clearly different colours (not two shades of one), and one is light. */
export const isDistinctPair = ({ background, foreground }: Pick<Theme, 'background' | 'foreground'>) => {
  const bg = hexToOklch(background);
  const fg = hexToOklch(foreground);
  const lightness = Math.abs(bg.l - fg.l);
  if (lightness < RULES.minLightnessDifference || Math.max(bg.l, fg.l) < RULES.minLighterColour) {
    return false;
  }
  const neutral = bg.c < RULES.neutralChroma || fg.c < RULES.neutralChroma;
  return neutral || lightness >= RULES.hueExemptLightnessDifference || hueDifference(bg.h, fg.h) >= RULES.minHueDifference;
};

/** Whether a pair works on its own: readable, coloured and two distinct colours. */
export const isValidPair = (theme: Pick<Theme, 'background' | 'foreground'>) => {
  const ratio = contrast(theme.background, theme.foreground);
  return ratio >= RULES.minContrast && ratio <= RULES.maxContrast && !isPlainLogo(theme.foreground) && isDistinctPair(theme);
};

/**
 * How well a pair stands apart from other mixes, relative to the thresholds:
 * 1 or more means every rule is met; higher is more distinct.
 */
export const distinctness = (theme: Pick<Theme, 'background' | 'foreground'>, others: Theme[], batch: Theme[] = []) => {
  let score = Infinity;
  for (const other of others) {
    score = Math.min(
      score,
      pairDistance(theme, other) / RULES.minPairDistance,
      distance(theme.background, other.background) / RULES.minBackgroundDistance
    );
  }
  for (const other of batch) {
    score = Math.min(
      score,
      pairDistance(theme, other) / RULES.minBatchPairDistance,
      distance(theme.background, other.background) / RULES.minBatchBackgroundDistance
    );
  }
  return score;
};

export const isAcceptable = (theme: Pick<Theme, 'background' | 'foreground'>, others: Theme[], batch: Theme[] = []) =>
  isValidPair(theme) && distinctness(theme, others, batch) >= 1;

const CANDIDATES = 6000;
// A candidate clearing every rule by this margin is taken straight away; pushing for
// maximum distinctness drifts into garish extremes, so that's only the fallback
const COMFORTABLE = 1.1;

/**
 * Generates a theme unlike `others` (and the rest of its `batch`): the first valid
 * candidate with some margin, else the most distinct of a few thousand.
 * Same number and variant always give the same result.
 */
export const generateTheme = (number: number, others: Theme[], variant = 0, batch: Theme[] = []): Theme => {
  const next = random(`ok-sessions:${number}:${variant}`);
  const hue = (number * GOLDEN_ANGLE + variant * 61) % 360;
  let best: { theme: Theme; score: number } | null = null;
  let found = 0;
  for (let attempt = 0; attempt < CANDIDATES * 50 && found < CANDIDATES; attempt++) {
    // Mostly stay in the mix's hue slot, so a batch covers the whole wheel
    const slot = next() < 0.5 ? hue : undefined;
    const neutral = next() < RULES.neutralBackground;
    // A neutral background takes its logo from the hue slot instead
    const background = sampleColour(next, neutral ? { neutral } : { hue: slot });
    const foreground = sampleColour(next, neutral ? { hue: slot } : {});
    if (!background || !foreground || !isValidPair({ background, foreground })) {
      continue;
    }
    found++;
    const theme = toTheme(background, foreground);
    const score = distinctness(theme, others, batch);
    if (score >= COMFORTABLE) {
      return theme;
    }
    if (!best || score > best.score) {
      best = { theme, score };
    }
  }
  if (!best || best.score < 1) {
    throw new Error(`Couldn't find a unique theme for mix #${number}`);
  }
  return best.theme;
};

const BATCH_ATTEMPTS = 8;

/**
 * Regenerates the given mixes in order, each unlike every other mix. Choosing greedily
 * can leave no room for the last few, so a stuck batch starts over with fresh seeds.
 */
export const regenerate = (themes: Themes, numbers: number[], variants: Record<number, number> = {}): Themes => {
  let lastError: unknown;
  for (let attempt = 0; attempt < BATCH_ATTEMPTS; attempt++) {
    const result = { ...themes };
    for (const number of numbers) {
      delete result[number];
    }
    const batch: Theme[] = [];
    try {
      for (const number of numbers) {
        const variant = (variants[number] ?? 0) + attempt * 1_000_003;
        const theme = generateTheme(number, Object.values(result), variant, batch);
        result[number] = theme;
        batch.push(theme);
      }
      return result;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
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
