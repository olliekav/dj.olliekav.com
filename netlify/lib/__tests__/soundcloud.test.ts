// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fixture from '../../../shared/fixtures/mixes.json' with { type: 'json' };
import { createSoundCloud, PLAYLIST_URL, toIsoDate, toMix } from '../soundcloud';
import { json, memoryStore, router, soundcloudRoutes } from './helpers';

const create = (routes = soundcloudRoutes(), store = memoryStore(), now = () => 0) => {
  const fetchFn = router(routes);
  return { fetchFn, store, sc: createSoundCloud({ clientId: 'id', clientSecret: 'secret', store, fetchFn, now }) };
};

const tokenCalls = (fetchFn: ReturnType<typeof router>) =>
  fetchFn.mock.calls.filter(([url]) => String(url).includes('oauth/token')).length;

describe('toIsoDate', () => {
  it.each([
    ['2019/03/10 12:00:00 +0000', '2019-03-10T12:00:00.000Z'],
    ['2019/03/10 12:00:00 +0100', '2019-03-10T11:00:00.000Z'],
    [null, null],
    ['nonsense', null]
  ])('%s → %s', (input, expected) => {
    expect(toIsoDate(input)).toBe(expected);
  });
});

describe('toMix', () => {
  it('uses a fallback theme beyond the known mixes', () => {
    const mix = toMix({ ...fixture.mixes[0]!, duration: 1, created_at: null, artwork_url: null, waveform_url: null, description: null, genre: null }, 9999);
    expect(mix.theme).toMatchObject({ background: '#101010' });
  });
});

describe('mixes', () => {
  it('maps the playlist to mixes numbered by position', async () => {
    const { sc, fetchFn } = create();
    expect({ mixes: await sc.mixes() }).toEqual(fixture);
    expect(String(fetchFn.mock.calls[1]![0])).toBe(`https://api.soundcloud.com/resolve?${new URLSearchParams({ url: PLAYLIST_URL })}`);
    expect(new Headers(fetchFn.mock.calls[1]![1]?.headers).get('authorization')).toBe('OAuth app-token');
  });

  it('follows pagination', async () => {
    const { sc } = create(
      soundcloudRoutes({
        'https://api.soundcloud.com/playlists/42/tracks': () =>
          json({ collection: [{ ...fixture.mixes[0], title: 'A' }], next_href: 'https://api.soundcloud.com/page2' }),
        'https://api.soundcloud.com/page2': () => json({ collection: [{ ...fixture.mixes[0], title: 'B' }], next_href: null })
      })
    );
    expect((await sc.mixes()).map(m => [m.number, m.title])).toEqual([[1, 'A'], [2, 'B']]);
  });

  it('rejects URLs that are not playlists, and API errors', async () => {
    await expect(create(soundcloudRoutes({ 'https://api.soundcloud.com/resolve': () => json({ kind: 'track', id: 1 }) })).sc.mixes()).rejects.toThrow('is not a playlist');
    await expect(create(soundcloudRoutes({ 'https://api.soundcloud.com/resolve': () => json({}, 500) })).sc.mixes()).rejects.toThrow(
      'SoundCloud request failed: 500 https://api.soundcloud.com/resolve'
    );
  });
});

describe('token', () => {
  it('exchanges client credentials once and shares the token through the store', async () => {
    const store = memoryStore();
    const first = create(soundcloudRoutes(), store);
    await first.sc.mixes();
    await first.sc.mixes();
    expect(tokenCalls(first.fetchFn)).toBe(1);
    expect(new Headers(first.fetchFn.mock.calls[0]![1]?.headers).get('authorization')).toBe(`Basic ${btoa('id:secret')}`);
    expect(store.data.get('token')).toEqual({ value: 'app-token', expiresAt: 3_600_000 });

    // A new instance (e.g. a cold start) reuses the stored token
    const second = create(soundcloudRoutes(), store);
    await second.sc.mixes();
    expect(tokenCalls(second.fetchFn)).toBe(0);
  });

  it('refreshes an expiring token', async () => {
    const store = memoryStore({ token: { value: 'old', expiresAt: 30_000 } });
    const { sc, fetchFn } = create(soundcloudRoutes(), store);
    await sc.mixes();
    expect(tokenCalls(fetchFn)).toBe(1);
  });

  it.each([
    [() => new Response('', { status: 401 }), 'token exchange failed: 401'],
    [() => json({}), 'missing access_token']
  ])('reports token failures', async (route, message) => {
    const { sc } = create(soundcloudRoutes({ 'https://secure.soundcloud.com/oauth/token': route }));
    await expect(sc.mixes()).rejects.toThrow(message);
  });
});

describe('stream', () => {
  it('resolves AAC HLS to the signed CDN URL without exposing the token', async () => {
    const { sc, fetchFn } = create();
    expect(await sc.stream('soundcloud:tracks:101')).toEqual({
      url: 'https://cf-hls-media.sndcdn.com/playlist/101.m3u8?Policy=x',
      format: 'hls_aac_160'
    });
    const hlsCall = fetchFn.mock.calls.find(([url]) => String(url).includes('/streams/hls'))!;
    expect(hlsCall[1]?.redirect).toBe('manual');
  });

  it('falls back to MP3 HLS, and to the final URL when not redirected', async () => {
    const { sc } = create(
      soundcloudRoutes({
        'https://api.soundcloud.com/tracks/soundcloud%3Atracks%3A101/streams': () => json({ hls_mp3_128_url: 'https://api.soundcloud.com/mp3' }),
        'https://api.soundcloud.com/mp3': () => {
          const res = new Response('#EXTM3U');
          Object.defineProperty(res, 'url', { value: 'https://cf-hls-media.sndcdn.com/mp3.m3u8' });
          return res;
        }
      })
    );
    expect(await sc.stream('soundcloud:tracks:101')).toEqual({ url: 'https://cf-hls-media.sndcdn.com/mp3.m3u8', format: 'hls_mp3_128' });
  });

  it.each([
    ['no streams', () => json({}), 'No stream available'],
    ['no redirect', () => json({ hls_aac_160_url: 'https://api.soundcloud.com/same' }), 'did not redirect']
  ])('reports %s', async (_label, route, message) => {
    const { sc } = create(
      soundcloudRoutes({
        'https://api.soundcloud.com/tracks/soundcloud%3Atracks%3A101/streams': route,
        'https://api.soundcloud.com/same': () => new Response('', { status: 200 })
      })
    );
    await expect(sc.stream('soundcloud:tracks:101')).rejects.toThrow(message);
  });
});
