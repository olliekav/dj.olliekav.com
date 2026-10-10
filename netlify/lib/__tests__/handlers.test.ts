// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import fixture from '../../../shared/fixtures/mixes.json' with { type: 'json' };
import { handleMixes, handleStream } from '../handlers';
import { createSoundCloud } from '../soundcloud';
import { json, memoryStore, router, soundcloudRoutes } from './helpers';

const setup = (routes = soundcloudRoutes(), store = memoryStore()) => {
  const fetchFn = router(routes);
  const soundcloud = createSoundCloud({ clientId: 'id', clientSecret: 's', store, fetchFn, now: () => 0 });
  return { fetchFn, store, soundcloud };
};

const streamRequest = (urn: string) => new Request(`https://dj.olliekav.com/api/stream?urn=${encodeURIComponent(urn)}`);

describe('handleMixes', () => {
  it('returns the mixes with CDN caching and stores them for stream checks', async () => {
    const { soundcloud, store } = setup();
    const res = await handleMixes({ soundcloud, store });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(fixture);
    expect(res.headers.get('netlify-cdn-cache-control')).toContain('s-maxage=300');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(store.data.get('mixes')).toMatchObject({ mixes: fixture.mixes });
  });

  it('returns a 502 when SoundCloud fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { soundcloud, store } = setup(soundcloudRoutes({ 'https://api.soundcloud.com/resolve': () => json({}, 503) }));
    const res = await handleMixes({ soundcloud, store });
    expect(res.status).toBe(502);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('handleStream', () => {
  it('streams playlist tracks, uncached', async () => {
    const { soundcloud, store } = setup();
    const res = await handleStream(streamRequest('soundcloud:tracks:101'), { soundcloud, store, now: 0 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://cf-hls-media.sndcdn.com/playlist/101.m3u8?Policy=x', format: 'hls_aac_160' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('uses the stored playlist instead of asking SoundCloud again', async () => {
    const store = memoryStore({ mixes: { mixes: fixture.mixes, fetchedAt: 0 } });
    const { soundcloud, fetchFn } = setup(soundcloudRoutes(), store);
    await handleStream(streamRequest('soundcloud:tracks:101'), { soundcloud, store, now: 1000 });
    expect(fetchFn.mock.calls.some(([url]) => String(url).includes('/resolve'))).toBe(false);
  });

  it('refreshes a stale playlist, or one missing the track', async () => {
    const store = memoryStore({ mixes: { mixes: [], fetchedAt: 0 } });
    const { soundcloud, fetchFn } = setup(soundcloudRoutes(), store);
    const res = await handleStream(streamRequest('soundcloud:tracks:101'), { soundcloud, store, now: 1000 });
    expect(res.status).toBe(200);
    expect(fetchFn.mock.calls.some(([url]) => String(url).includes('/resolve'))).toBe(true);
  });

  it('refuses tracks outside the playlist and malformed URNs', async () => {
    const { soundcloud, store } = setup();
    expect((await handleStream(streamRequest('soundcloud:tracks:999'), { soundcloud, store })).status).toBe(404);
    expect((await handleStream(streamRequest('nope'), { soundcloud, store })).status).toBe(400);
    expect((await handleStream(new Request('https://x/api/stream'), { soundcloud, store })).status).toBe(400);
  });

  it('returns a 502 when SoundCloud fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { soundcloud, store } = setup(
      soundcloudRoutes({ 'https://api.soundcloud.com/tracks/soundcloud%3Atracks%3A101/streams': () => json({}, 500) })
    );
    expect((await handleStream(streamRequest('soundcloud:tracks:101'), { soundcloud, store })).status).toBe(502);
  });
});
