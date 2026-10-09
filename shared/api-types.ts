// Response types for the OK Sessions API, shared by the Worker and the website.
// shared/fixtures/mixes.json is a sample of MixList.

export interface Theme {
  background: string;
  foreground: string;
  accent: string;
  /** The background is dark, so the foreground is used for accents */
  dark: boolean;
  gradient?: { angle: number; stops: string[] };
}

export interface Mix {
  id: number;
  slug: string;
  number: number;
  title: string;
  description: string;
  genre: string | null;
  recorded_at: string | null;
  published_at: string | null;
  duration_ms: number;
  audio: { m4a: string; mp3: string | null };
  peaks_url: string | null;
  artwork_url: string | null;
  theme: Theme;
  soundcloud_url: string | null;
  share_url: string;
  access: 'free' | 'paid';
  updated_at: string;
}

export interface MixList {
  mixes: Mix[];
}

/** Body of shared/peaks: normalised 0–1 amplitudes */
export interface Peaks {
  version: 1;
  peaks: number[];
}

export const platforms = ['web', 'ios', 'android', 'carplay', 'android-auto'] as const;
export type Platform = (typeof platforms)[number];
