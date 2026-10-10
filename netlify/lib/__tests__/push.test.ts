// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import tracks from '../../../shared/fixtures/soundcloud-tracks.json' with { type: 'json' };
import { createAPNs, type APNsResponse } from '../apns';
import { handleDevices, notifyNewMixes } from '../push';
import { createSoundCloud } from '../soundcloud';
import { fakeTransport, json, memoryStore, router, soundcloudRoutes, testKey } from './helpers';

const TOKEN = 'ab'.repeat(32);
const OTHER = 'cd'.repeat(32);

const devices = (method: string, body: unknown) =>
  new Request('https://dj.olliekav.com/api/devices', {
    method,
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });

describe('handleDevices', () => {
  it('registers and unregisters a device token', async () => {
    const store = memoryStore();
    const added = await handleDevices(devices('POST', { token: TOKEN.toUpperCase(), platform: 'ios' }), { store, now: 0 });
    expect(added.status).toBe(204);
    expect(store.data.get(`devices/${TOKEN}`)).toEqual({ platform: 'ios', registeredAt: '1970-01-01T00:00:00.000Z' });

    const removed = await handleDevices(devices('DELETE', { token: TOKEN }), { store });
    expect(removed.status).toBe(204);
    expect(store.data.has(`devices/${TOKEN}`)).toBe(false);
  });

  it('refuses anything that is not a hex token from iOS', async () => {
    const store = memoryStore();
    const status = async (method: string, body: unknown) => (await handleDevices(devices(method, body), { store })).status;
    expect(await status('POST', { token: 'abc', platform: 'ios' })).toBe(400);
    expect(await status('POST', { token: 'z'.repeat(64), platform: 'ios' })).toBe(400);
    expect(await status('POST', { token: TOKEN, platform: 'android' })).toBe(400);
    expect(await status('POST', { token: TOKEN })).toBe(400);
    expect(await status('POST', { token: 12, platform: 'ios' })).toBe(400);
    expect(await status('POST', 'not json')).toBe(400);
    expect(await status('POST', 'null')).toBe(400);
    expect(await status('POST', { token: TOKEN, platform: 'ios', padding: 'x'.repeat(2000) })).toBe(413);
    expect(await status('PUT', { token: TOKEN, platform: 'ios' })).toBe(405);
    expect(store.setJSON).not.toHaveBeenCalled();
  });

  it('returns a 502 when the store fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = memoryStore();
    vi.mocked(store.setJSON).mockRejectedValueOnce(new Error('blobs down'));
    expect((await handleDevices(devices('POST', { token: TOKEN, platform: 'ios' }), { store })).status).toBe(502);
  });
});

describe('notifyNewMixes', () => {
  // The fixture playlist has #1 (House) and #2 (no genre)
  const setup = ({
    seen,
    tokens = [TOKEN, OTHER],
    responses = [] as (APNsResponse | Error)[],
    playlist = tracks as unknown[]
  }: { seen?: { id: number; number: number }; tokens?: string[]; responses?: (APNsResponse | Error)[]; playlist?: unknown[] } = {}) => {
    const soundcloudStore = memoryStore();
    const soundcloud = createSoundCloud({
      clientId: 'id',
      clientSecret: 's',
      store: soundcloudStore,
      fetchFn: router(soundcloudRoutes({ 'https://api.soundcloud.com/playlists/42/tracks': () => json({ collection: playlist, next_href: null }) })),
      now: () => 0
    });
    const store = memoryStore({
      ...(seen ? { 'last-seen': seen } : {}),
      ...Object.fromEntries(tokens.map(t => [`devices/${t}`, { platform: 'ios', registeredAt: '' }]))
    });
    const transport = fakeTransport(...responses);
    const apns = createAPNs({ keyId: 'k', teamId: 't', key: testKey, bundleId: 'b', host: 'h', transport });
    const purgeMixes = vi.fn(async () => {});
    return { store, soundcloudStore, transport, purgeMixes, context: { soundcloud, soundcloudStore, store, apns, purgeMixes } };
  };

  it('only records the newest mix on the first run', async () => {
    const { context, store, transport, purgeMixes } = setup();
    expect(await notifyNewMixes(context)).toMatchObject({ announced: [], sent: 0 });
    expect(store.data.get('last-seen')).toEqual({ id: 102, number: 2 });
    expect(transport.send).not.toHaveBeenCalled();
    expect(purgeMixes).not.toHaveBeenCalled();
  });

  it('does nothing when there is no new mix', async () => {
    const { context, store, transport } = setup({ seen: { id: 102, number: 2 } });
    expect(await notifyNewMixes(context)).toMatchObject({ announced: [] });
    expect(transport.send).not.toHaveBeenCalled();
    expect(store.setJSON).not.toHaveBeenCalledWith('last-seen', expect.anything());
  });

  it('notifies every device of a new mix, purges the cached list and records it', async () => {
    const { context, store, soundcloudStore, transport, purgeMixes } = setup({ seen: { id: 101, number: 1 } });
    expect(await notifyNewMixes(context)).toEqual({ announced: [2], sent: 2, removed: 0, unreachable: false });
    expect(transport.sent.map(r => r.path).sort()).toEqual([`/3/device/${OTHER}`, `/3/device/${TOKEN}`].sort());
    expect(transport.sent[0]?.body).toEqual({
      aps: { alert: { title: 'OK Sessions #2 is out', body: 'A new mix from O:K. Tap to listen.' }, sound: 'default' },
      mix: 2
    });
    expect(transport.sent[0]?.headers['apns-collapse-id']).toBe('mix-2');
    expect(purgeMixes).toHaveBeenCalledOnce();
    expect(store.data.get('last-seen')).toEqual({ id: 102, number: 2 });
    // The playlist is cached for /api/stream too
    expect(soundcloudStore.data.get('mixes')).toMatchObject({ mixes: [{ number: 1 }, { number: 2 }] });
  });

  it('names the genre, and announces each new mix in order', async () => {
    const { context, transport } = setup({ seen: { id: 100, number: 0 }, tokens: [TOKEN] });
    expect(await notifyNewMixes(context)).toMatchObject({ announced: [1, 2], sent: 2 });
    expect(transport.sent.map(r => (r.body as { aps: { alert: { body: string } } }).aps.alert.body)).toEqual([
      'A new House mix from O:K. Tap to listen.',
      'A new mix from O:K. Tap to listen.'
    ]);
  });

  it('announces only the newest three if many appear at once', async () => {
    const playlist = Array.from({ length: 6 }, (_, i) => ({ ...tracks[0], id: 200 + i, urn: `soundcloud:tracks:${200 + i}` }));
    const { context } = setup({ seen: { id: 200, number: 1 }, tokens: [TOKEN], playlist });
    expect(await notifyNewMixes(context)).toMatchObject({ announced: [4, 5, 6] });
  });

  it('forgets tokens Apple says are invalid', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { context, store, transport } = setup({
      seen: { id: 100, number: 0 },
      responses: [{ status: 410, body: '{"reason":"Unregistered"}' }, { status: 200, body: '' }]
    });
    const result = await notifyNewMixes(context);
    expect(result).toMatchObject({ removed: 1, sent: 2 });
    const removed = transport.sent[0]!.path.slice('/3/device/'.length);
    expect(store.data.has(`devices/${removed}`)).toBe(false);
    expect(store.data.size).toBe(2); // the other device and last-seen
    // The second mix only went to the remaining device
    expect(transport.send).toHaveBeenCalledTimes(3);
  });

  it('tries again next time if Apple cannot be reached', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { context, store } = setup({ seen: { id: 101, number: 1 }, responses: [new Error('ECONNREFUSED')] });
    expect(await notifyNewMixes(context)).toMatchObject({ announced: [2], sent: 0, unreachable: true });
    expect(store.data.get('last-seen')).toEqual({ id: 101, number: 1 });
  });

  it('records the mix when some devices fail but others get it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { context, store } = setup({
      seen: { id: 101, number: 1 },
      responses: [{ status: 503, body: '' }, { status: 200, body: '' }]
    });
    expect(await notifyNewMixes(context)).toMatchObject({ sent: 1, unreachable: false });
    expect(store.data.get('last-seen')).toEqual({ id: 102, number: 2 });
  });

  it('still notifies when purging the CDN fails, and records with no devices', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { context, store, purgeMixes } = setup({ seen: { id: 101, number: 1 }, tokens: [] });
    purgeMixes.mockRejectedValueOnce(new Error('purge failed'));
    expect(await notifyNewMixes(context)).toMatchObject({ announced: [2], sent: 0, unreachable: false });
    expect(store.data.get('last-seen')).toEqual({ id: 102, number: 2 });
  });

  it('records a re-uploaded or removed newest mix without announcing it', async () => {
    const { context, store, transport } = setup({ seen: { id: 999, number: 3 } });
    expect(await notifyNewMixes(context)).toMatchObject({ announced: [] });
    expect(store.data.get('last-seen')).toEqual({ id: 102, number: 2 });
    expect(transport.send).not.toHaveBeenCalled();
  });

  it('ignores an empty playlist', async () => {
    const { context, store } = setup({ seen: { id: 102, number: 2 }, playlist: [] });
    expect(await notifyNewMixes(context)).toMatchObject({ announced: [] });
    expect(store.data.get('last-seen')).toEqual({ id: 102, number: 2 });
  });
});
