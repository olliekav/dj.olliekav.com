import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream } from 'node:stream/web';

// Imports original uploads from SoundCloud via the official download endpoint.
// Only tracks with downloads enabled can be fetched; streams are never captured.

export const PLAYLIST_URL = 'https://soundcloud.com/olliekav/sets/ok-sessions';
const API = 'https://api.soundcloud.com';

export interface SoundCloudTrack {
  id: number;
  urn: string;
  title: string;
  description: string | null;
  genre: string | null;
  permalink_url: string;
  created_at: string | null;
  release_date?: string | null;
  downloadable: boolean;
  duration: number;
}

interface Page<T> {
  collection: T[];
  next_href: string | null;
}

export interface SoundCloudClient {
  playlistTracks(playlistUrl?: string): Promise<SoundCloudTrack[]>;
  downloadOriginal(track: Pick<SoundCloudTrack, 'urn' | 'title'>, dest: string): Promise<void>;
  /** Replaces a track's artwork; needs the owner's token (see soundcloud-auth.ts) and a Pro account */
  updateArtwork(urn: string, jpeg: Buffer, userToken: string): Promise<void>;
}

export const createSoundCloud = ({
  clientId,
  clientSecret,
  fetchFn = fetch,
  now = Date.now
}: {
  clientId: string;
  clientSecret: string;
  fetchFn?: typeof fetch;
  now?: () => number;
}): SoundCloudClient => {
  let token: { value: string; expiresAt: number } | null = null;

  // Tokens are capped at 50 per app per 12h, so reuse one until it nearly expires
  const getToken = async () => {
    if (token && token.expiresAt > now() + 60_000) {
      return token.value;
    }
    const res = await fetchFn('https://secure.soundcloud.com/oauth/token', {
      method: 'POST',
      headers: {
        accept: 'application/json; charset=utf-8',
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString()
    });
    if (!res.ok) {
      throw new Error(`SoundCloud token exchange failed: ${res.status} ${await res.text().catch(() => '')}`);
    }
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token || !data.expires_in) {
      throw new Error('SoundCloud token response missing access_token/expires_in');
    }
    token = { value: data.access_token, expiresAt: now() + data.expires_in * 1000 };
    return token.value;
  };

  const get = async (url: string) => {
    const res = await fetchFn(url, {
      headers: { accept: 'application/json; charset=utf-8', authorization: `OAuth ${await getToken()}` }
    });
    if (!res.ok) {
      throw new Error(`SoundCloud request failed: ${res.status} ${url}`);
    }
    return res;
  };

  return {
    async playlistTracks(playlistUrl = PLAYLIST_URL) {
      const resolved = (await (await get(`${API}/resolve?${new URLSearchParams({ url: playlistUrl })}`)).json()) as {
        id?: number;
        kind?: string;
      };
      if (!resolved.id || resolved.kind !== 'playlist') {
        throw new Error(`${playlistUrl} is not a playlist (kind=${resolved.kind ?? 'unknown'})`);
      }

      const tracks: SoundCloudTrack[] = [];
      let next: string | null =
        `${API}/playlists/${resolved.id}/tracks?${new URLSearchParams({ limit: '200', linked_partitioning: 'true' })}`;
      while (next) {
        const page = (await (await get(next)).json()) as Page<SoundCloudTrack>;
        tracks.push(...page.collection);
        next = page.next_href;
      }
      return tracks;
    },

    async downloadOriginal(track, dest) {
      // Redirects to a short-lived signed URL for the original file
      const res = await get(`${API}/tracks/${encodeURIComponent(track.urn)}/download`);
      if (!res.body) {
        throw new Error(`No file returned for ${track.title}`);
      }
      await pipeline(Readable.fromWeb(res.body as ReadableStream), createWriteStream(dest));
    },

    async updateArtwork(urn, jpeg, userToken) {
      const form = new FormData();
      form.append('track[artwork_data]', new Blob([new Uint8Array(jpeg)], { type: 'image/jpeg' }), 'artwork.jpg');
      const res = await fetchFn(`${API}/tracks/${encodeURIComponent(urn)}`, {
        method: 'PUT',
        headers: { accept: 'application/json; charset=utf-8', authorization: `OAuth ${userToken}` },
        body: form
      });
      if (!res.ok) {
        throw new Error(`Artwork update failed: ${res.status} ${await res.text().catch(() => '')}`.trim());
      }
    }
  };
};
