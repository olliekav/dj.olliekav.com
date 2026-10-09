import { env } from 'cloudflare:workers';
import { describe, expect, it, vi } from 'vitest';
import { DEVICE_ID, adminGet, mixInput, postEvent, putMix } from './helpers';

const OTHER_DEVICE = '0b9f2c6e-3d4a-4f1b-9e8c-2a7d6c5b4e3f';

const stats = async (query = '') =>
  (await (await adminGet(`/v1/admin/stats${query}`)).json<{ stats: any[] }>()).stats;

describe('POST /v1/mixes/:slug/plays', () => {
  it('counts one play per device per window', async () => {
    await putMix('ok-sessions-1', mixInput());

    const first = await postEvent('/v1/mixes/ok-sessions-1/plays', { device_id: DEVICE_ID, platform: 'ios' });
    expect(first.status).toBe(202);
    expect(await first.json()).toEqual({ counted: true });

    const repeat = await postEvent('/v1/mixes/ok-sessions-1/plays', { device_id: DEVICE_ID, platform: 'ios' });
    expect(await repeat.json()).toEqual({ counted: false });

    await postEvent('/v1/mixes/ok-sessions-1/plays', { device_id: OTHER_DEVICE, platform: 'web' });
    await postEvent('/v1/mixes/ok-sessions-1/plays', { device_id: OTHER_DEVICE, platform: 'web', completed: true });

    expect(await stats()).toEqual([
      {
        slug: 'ok-sessions-1',
        number: 1,
        title: 'OK Sessions #1',
        plays: 2,
        completions: 1,
        downloads: 0,
        by_platform: {
          ios: { plays: 1, completions: 0, downloads: 0 },
          web: { plays: 1, completions: 1, downloads: 0 }
        }
      }
    ]);
  });

  it('404s for unknown or draft mixes', async () => {
    await putMix('draft-mix', mixInput({ status: 'draft' }));
    for (const slug of ['missing', 'draft-mix']) {
      const res = await postEvent(`/v1/mixes/${slug}/plays`, { device_id: DEVICE_ID, platform: 'ios' });
      expect(res.status).toBe(404);
    }
  });

  it.each([
    [{ device_id: 'not-a-uuid', platform: 'ios' }],
    [{ device_id: DEVICE_ID, platform: 'windows-phone' }],
    [{ platform: 'ios' }]
  ])('rejects invalid body %j', async body => {
    await putMix('ok-sessions-1', mixInput());
    expect((await postEvent('/v1/mixes/ok-sessions-1/plays', body)).status).toBe(400);
  });

  it('returns 429 when rate limited', async () => {
    await putMix('ok-sessions-1', mixInput());
    const limit = vi.spyOn(env.EVENTS_LIMITER, 'limit').mockResolvedValue({ success: false });
    const res = await postEvent(
      '/v1/mixes/ok-sessions-1/plays',
      { device_id: DEVICE_ID, platform: 'ios' },
      { 'cf-connecting-ip': '203.0.113.7' }
    );
    expect(res.status).toBe(429);
    expect(limit).toHaveBeenCalledWith({ key: `203.0.113.7:${DEVICE_ID}` });
    limit.mockRestore();
  });
});

describe('POST /v1/mixes/:slug/downloads', () => {
  it('counts downloads and filters stats by date', async () => {
    await putMix('ok-sessions-1', mixInput());
    await postEvent('/v1/mixes/ok-sessions-1/downloads', { device_id: DEVICE_ID, platform: 'android' });
    await postEvent('/v1/mixes/ok-sessions-1/downloads', { device_id: DEVICE_ID, platform: 'android' });

    const today = new Date().toISOString().slice(0, 10);
    expect((await stats(`?from=${today}&to=${today}`))[0]).toMatchObject({ downloads: 1, plays: 0 });
    expect(await stats('?to=2000-01-01')).toEqual([]);
  });

  it('rejects malformed date filters', async () => {
    expect((await adminGet('/v1/admin/stats?from=yesterday')).status).toBe(400);
  });
});

describe('CORS', () => {
  it('allows writes from the site', async () => {
    const res = await postEvent('/v1/mixes/x/plays', {}, { origin: 'https://dj.olliekav.com' });
    expect(res.headers.get('access-control-allow-origin')).toBe('https://dj.olliekav.com');
  });

  it('does not allow writes from other sites', async () => {
    const res = await postEvent('/v1/mixes/x/plays', {}, { origin: 'https://evil.example' });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
