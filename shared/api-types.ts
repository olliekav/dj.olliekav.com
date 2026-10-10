// Response types for dj.olliekav.com/api, used by the website, functions and native apps.
// shared/fixtures/mixes.json is a sample of MixList.

export interface Theme {
  background: string;
  foreground: string;
  accent: string;
  /** The accent is the foreground (the background is the darker, plainer colour) */
  dark: boolean;
  gradient?: { angle: number; stops: string[] };
}

/** An OK Sessions mix, from the SoundCloud playlist plus its colour theme. */
export interface Mix {
  id: number;
  /** SoundCloud track URN, used to request a stream */
  urn: string;
  /** Position in the playlist, which is the session number */
  number: number;
  slug: string;
  title: string;
  description: string;
  genre: string | null;
  duration_ms: number;
  published_at: string | null;
  /** 500×500 artwork */
  artwork_url: string | null;
  /** Full-size artwork as uploaded */
  artwork_original_url: string | null;
  /** SoundCloud waveform JSON ({ width, height, samples }) */
  waveform_url: string | null;
  /** The track on SoundCloud (attribution link) */
  permalink_url: string;
  playback_count: number | null;
  theme: Theme;
}

export interface MixList {
  mixes: Mix[];
}

/** Response of /api/stream: a short-lived HLS URL (AAC 160k where available) */
export interface Stream {
  url: string;
  format: 'hls_aac_160' | 'hls_mp3_128';
}

/** SoundCloud's waveform JSON */
export interface Waveform {
  width: number;
  height: number;
  samples: number[];
}
