import type { Mix } from '../../shared/api-types';
import type { SoundCloud, TokenStore } from './soundcloud';

// Request handlers, separate from the Netlify entry points so they can be tested.

interface CachedMixes {
  mixes: Mix[];
  fetchedAt: number;
}

// How long the stored playlist is trusted for checking stream requests
const PLAYLIST_TTL_MS = 60 * 60 * 1000;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', ...headers }
  });

export const fetchAndStoreMixes = async (soundcloud: SoundCloud, store: TokenStore, now = Date.now()) => {
  const mixes = await soundcloud.mixes();
  await store.setJSON('mixes', { mixes, fetchedAt: now } satisfies CachedMixes);
  return mixes;
};

export const handleMixes = async ({ soundcloud, store }: { soundcloud: SoundCloud; store: TokenStore }) => {
  try {
    const mixes = await fetchAndStoreMixes(soundcloud, store);
    return json({ mixes }, 200, {
      'cache-control': 'public, max-age=60',
      // Netlify's CDN serves this for 5 minutes, then revalidates in the background
      'netlify-cdn-cache-control': 'public, durable, s-maxage=300, stale-while-revalidate=86400'
    });
  } catch (error) {
    console.error(error);
    return json({ error: "Couldn't load the mixes" }, 502, { 'cache-control': 'no-store' });
  }
};

const URN = /^soundcloud:tracks:\d+$/;

export const handleStream = async (
  request: Request,
  { soundcloud, store, now = Date.now() }: { soundcloud: SoundCloud; store: TokenStore; now?: number }
) => {
  const urn = new URL(request.url).searchParams.get('urn') ?? '';
  if (!URN.test(urn)) {
    return json({ error: 'Expected ?urn=soundcloud:tracks:<id>' }, 400);
  }
  try {
    // Only stream the playlist's own tracks, so this can't spend our quota on anything else
    let cached = (await store.get('mixes', { type: 'json' })) as CachedMixes | null;
    if (!cached || now - cached.fetchedAt > PLAYLIST_TTL_MS || !cached.mixes.some(m => m.urn === urn)) {
      cached = { mixes: await fetchAndStoreMixes(soundcloud, store, now), fetchedAt: now };
    }
    if (!cached.mixes.some(m => m.urn === urn)) {
      return json({ error: 'Not an OK Sessions mix' }, 404);
    }
    // Signed URLs are short-lived and each counts towards SoundCloud's daily stream cap
    return json(await soundcloud.stream(urn), 200, { 'cache-control': 'no-store' });
  } catch (error) {
    console.error(error);
    return json({ error: "Couldn't start the stream" }, 502, { 'cache-control': 'no-store' });
  }
};
