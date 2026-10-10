import { generateKeyPairSync } from 'node:crypto';
import { vi } from 'vitest';
import tracks from '../../../shared/fixtures/soundcloud-tracks.json' with { type: 'json' };
import type { APNsResponse } from '../apns';
import type { PushStore } from '../push';

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

export const memoryStore = (initial: Record<string, unknown> = {}) => {
  const data = new Map(Object.entries(initial));
  const store: PushStore & { data: Map<string, unknown> } = {
    data,
    get: vi.fn(async (key: string) => data.get(key) ?? null),
    setJSON: vi.fn(async (key: string, value: unknown) => {
      data.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      data.delete(key);
    }),
    list: vi.fn(async ({ prefix }: { prefix: string }) => ({
      blobs: [...data.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key }))
    }))
  };
  return store;
};

type Route = (url: string, init?: RequestInit) => Response;

/** A fetch stand-in routing by URL prefix (longest wins). */
export const router = (routes: Record<string, Route>) =>
  vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    const match = Object.keys(routes)
      .sort((a, b) => b.length - a.length)
      .find(prefix => url.startsWith(prefix));
    if (!match) throw new Error(`Unexpected request ${url}`);
    return routes[match]!(url, init);
  });

/** SoundCloud with a token, a playlist of the fixture tracks, and a stream. */
export const soundcloudRoutes = (overrides: Record<string, Route> = {}) => ({
  'https://secure.soundcloud.com/oauth/token': () => json({ access_token: 'app-token', expires_in: 3600 }),
  'https://api.soundcloud.com/resolve': () => json({ id: 42, kind: 'playlist' }),
  'https://api.soundcloud.com/playlists/42/tracks': () => json({ collection: tracks, next_href: null }),
  'https://api.soundcloud.com/tracks/soundcloud%3Atracks%3A101/streams': () =>
    json({ hls_aac_160_url: 'https://api.soundcloud.com/tracks/101/streams/hls?aac', hls_mp3_128_url: 'https://api.soundcloud.com/x' }),
  'https://api.soundcloud.com/tracks/101/streams/hls': () =>
    new Response(null, { status: 302, headers: { location: 'https://cf-hls-media.sndcdn.com/playlist/101.m3u8?Policy=x' } }),
  ...overrides
});

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
export const testPublicKey = publicKey;

/** An APNs-style .p8 key (P-256, PKCS #8) */
export const testKey = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

/** A transport answering each request in turn, recording what was sent. */
export const fakeTransport = (...responses: (APNsResponse | Error)[]) => {
  const sent: { path: string; headers: Record<string, string>; body: unknown }[] = [];
  const transport = {
    sent,
    send: vi.fn(async (path: string, headers: Record<string, string>, body: string) => {
      sent.push({ path, headers, body: JSON.parse(body) });
      const response = responses.length > 1 ? responses.shift()! : responses[0] ?? { status: 200, body: '' };
      if (response instanceof Error) throw response;
      return response;
    }),
    close: vi.fn()
  };
  return transport;
};
