import type { Mix, Stream, Theme } from '../../shared/api-types';
import themes from '../../shared/mix-themes.json' with { type: 'json' };

// SoundCloud is the source of truth for the mixes: the OK Sessions playlist, in order.
// Only the server talks to SoundCloud, so the app's credentials never reach clients.

export const PLAYLIST_URL = 'https://soundcloud.com/olliekav/sets/ok-sessions';
const API = 'https://api.soundcloud.com';

export interface SoundCloudTrack {
  id: number;
  urn: string;
  title: string;
  description: string | null;
  genre: string | null;
  duration: number;
  created_at: string | null;
  artwork_url: string | null;
  waveform_url: string | null;
  permalink_url: string;
  playback_count?: number | null;
  streamable?: boolean;
}

/** Minimal key-value store (Netlify Blobs in production) for sharing the token across instances. */
export interface TokenStore {
  get(key: string, options: { type: 'json' }): Promise<unknown>;
  setJSON(key: string, value: unknown): Promise<unknown>;
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

export interface SoundCloudOptions {
  clientId: string;
  clientSecret: string;
  store: TokenStore;
  fetchFn?: typeof fetch;
  now?: () => number;
}

const FALLBACK_THEME: Theme = { background: '#101010', foreground: '#FFFFFF', accent: '#CA46A7', dark: false };
const themeFor = (number: number): Theme => (themes as Record<string, Theme>)[number] ?? FALLBACK_THEME;

/** SoundCloud dates look like "2019/03/10 12:00:00 +0000". */
export const toIsoDate = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const date = new Date(
    value.replace(/^(\d{4})\/(\d{2})\/(\d{2}) /, '$1-$2-$3T').replace(/ ([+-]\d{2})(\d{2})$/, '$1:$2')
  );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

// Artwork URLs end in -large.jpg (100×100); other sizes swap the suffix
const artworkSize = (url: string | null, size: string) => (url ? url.replace(/-large(\.\w+)$/, `-${size}$1`) : null);

export const toMix = (track: SoundCloudTrack, number: number): Mix => ({
  id: track.id,
  urn: track.urn,
  number,
  slug: `ok-sessions-${number}`,
  title: track.title,
  description: track.description ?? '',
  genre: track.genre || null,
  duration_ms: track.duration,
  published_at: toIsoDate(track.created_at),
  artwork_url: artworkSize(track.artwork_url, 't500x500'),
  artwork_original_url: artworkSize(track.artwork_url, 'original'),
  waveform_url: track.waveform_url ? track.waveform_url.replace(/\.png$/, '.json') : null,
  permalink_url: track.permalink_url,
  playback_count: track.playback_count ?? null,
  theme: themeFor(number)
});

export const createSoundCloud = ({ clientId, clientSecret, store, fetchFn = fetch, now = Date.now }: SoundCloudOptions) => {
  let token: CachedToken | null = null;

  // Token exchanges are capped at 50 per 12h, so the token is shared via the store
  const getToken = async () => {
    const fresh = (t: CachedToken | null): t is CachedToken => !!t && t.expiresAt > now() + 60_000;
    if (fresh(token)) return token.value;
    const stored = (await store.get('token', { type: 'json' })) as CachedToken | null;
    if (fresh(stored)) {
      token = stored;
      return stored.value;
    }

    const res = await fetchFn('https://secure.soundcloud.com/oauth/token', {
      method: 'POST',
      headers: {
        accept: 'application/json; charset=utf-8',
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString()
    });
    if (!res.ok) {
      throw new Error(`SoundCloud token exchange failed: ${res.status}`);
    }
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token || !data.expires_in) {
      throw new Error('SoundCloud token response missing access_token/expires_in');
    }
    token = { value: data.access_token, expiresAt: now() + data.expires_in * 1000 };
    await store.setJSON('token', token);
    return token.value;
  };

  const get = async (url: string, init: RequestInit = {}) => {
    const res = await fetchFn(url, {
      ...init,
      headers: { accept: 'application/json; charset=utf-8', authorization: `OAuth ${await getToken()}` }
    });
    if (!res.ok && !(init.redirect === 'manual' && res.status >= 300 && res.status < 400)) {
      throw new Error(`SoundCloud request failed: ${res.status} ${url.split('?')[0]}`);
    }
    return res;
  };

  const playlistTracks = async (playlistUrl = PLAYLIST_URL): Promise<SoundCloudTrack[]> => {
    const resolved = (await (await get(`${API}/resolve?${new URLSearchParams({ url: playlistUrl })}`)).json()) as {
      id?: number;
      kind?: string;
    };
    if (!resolved.id || resolved.kind !== 'playlist') {
      throw new Error(`${playlistUrl} is not a playlist`);
    }
    const tracks: SoundCloudTrack[] = [];
    let next: string | null =
      `${API}/playlists/${resolved.id}/tracks?${new URLSearchParams({ limit: '200', linked_partitioning: 'true' })}`;
    for (let page = 0; next && page < 25; page++) {
      const body = (await (await get(next)).json()) as { collection: SoundCloudTrack[]; next_href: string | null };
      tracks.push(...body.collection);
      next = body.next_href;
    }
    return tracks;
  };

  return {
    playlistTracks,

    async mixes(playlistUrl?: string): Promise<Mix[]> {
      return (await playlistTracks(playlistUrl)).map((track, i) => toMix(track, i + 1));
    },

    /** Resolves a track's HLS stream to a short-lived signed CDN URL. */
    async stream(urn: string): Promise<Stream> {
      const streams = (await (await get(`${API}/tracks/${encodeURIComponent(urn)}/streams`)).json()) as {
        hls_aac_160_url?: string;
        hls_mp3_128_url?: string;
      };
      const [format, url] = streams.hls_aac_160_url
        ? (['hls_aac_160', streams.hls_aac_160_url] as const)
        : streams.hls_mp3_128_url
          ? (['hls_mp3_128', streams.hls_mp3_128_url] as const)
          : [];
      if (!format || !url) {
        throw new Error(`No stream available for ${urn}`);
      }
      // The API URL needs our token; it redirects to a signed URL that doesn't
      const res = await get(url, { redirect: 'manual' });
      const location = res.headers.get('location') ?? (res.ok && res.url && res.url !== url ? res.url : null);
      if (!location) {
        throw new Error(`SoundCloud did not redirect the stream for ${urn}`);
      }
      return { url: new URL(location, url).href, format };
    }
  };
};

export type SoundCloud = ReturnType<typeof createSoundCloud>;
