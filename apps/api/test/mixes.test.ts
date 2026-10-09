import { describe, expect, it } from 'vitest';
import { mixInput, putMix, request } from './helpers';

describe('GET /v1/mixes', () => {
  it('returns an empty list when nothing is published', async () => {
    const res = await request('/v1/mixes');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mixes: [] });
  });

  it('lists published mixes newest first with resolved media URLs', async () => {
    await putMix('ok-sessions-1', mixInput());
    await putMix('ok-sessions-2', mixInput({
      number: 2,
      title: 'OK Sessions #2',
      audio_m4a_key: 'mixes/ok-sessions-2/audio.m4a',
      audio_mp3_key: null,
      peaks_key: null,
      artwork_key: 'mixes/ok-sessions-2/artwork.png'
    }));
    await putMix('ok-sessions-3', mixInput({ number: 3, status: 'draft' }));

    const res = await request('/v1/mixes');
    const body = await res.json<{ mixes: any[] }>();

    expect(body.mixes.map((m: { slug: string }) => m.slug)).toEqual(['ok-sessions-2', 'ok-sessions-1']);
    expect(body.mixes[1]).toMatchObject({
      number: 1,
      title: 'OK Sessions #1',
      audio: {
        m4a: 'https://media.olliekav.com/mixes/ok-sessions-1/audio.m4a',
        mp3: 'https://media.olliekav.com/mixes/ok-sessions-1/audio.mp3'
      },
      peaks_url: 'https://media.olliekav.com/mixes/ok-sessions-1/peaks.json',
      artwork_url: null,
      theme: { background: '#2A10A6', dark: true },
      share_url: 'https://dj.olliekav.com/mixes/ok-sessions-1',
      access: 'free'
    });
    expect(body.mixes[0]).toMatchObject({
      audio: { mp3: null },
      peaks_url: null,
      artwork_url: 'https://media.olliekav.com/mixes/ok-sessions-2/artwork.png'
    });
    expect(body.mixes[0]).not.toHaveProperty('status');
  });

  it('sets public cache headers and an ETag', async () => {
    await putMix('ok-sessions-1', mixInput());
    const res = await request('/v1/mixes');
    expect(res.headers.get('cache-control')).toBe('public, max-age=60, s-maxage=300');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');

    const tag = res.headers.get('etag');
    expect(tag).toBeTruthy();
    const cached = await request('/v1/mixes', { headers: { 'if-none-match': tag! } });
    expect(cached.status).toBe(304);
  });

  it('refreshes the cached list when a mix is published', async () => {
    await request('/v1/mixes');
    await putMix('ok-sessions-1', mixInput());
    const body = await (await request('/v1/mixes')).json<{ mixes: unknown[] }>();
    expect(body.mixes).toHaveLength(1);
  });
});

describe('GET /v1/mixes/:slug', () => {
  it('returns a published mix', async () => {
    await putMix('ok-sessions-1', mixInput());
    const res = await request('/v1/mixes/ok-sessions-1');
    expect(res.status).toBe(200);
    expect((await res.json<{ mix: { slug: string } }>()).mix.slug).toBe('ok-sessions-1');
  });

  it('hides drafts', async () => {
    await putMix('ok-sessions-1', mixInput({ status: 'draft' }));
    const res = await request('/v1/mixes/ok-sessions-1');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Mix not found' });
  });

  it('404s on malformed slugs', async () => {
    expect((await request('/v1/mixes/NOT_A_SLUG')).status).toBe(404);
  });
});

it('returns JSON for unknown routes', async () => {
  const res = await request('/nope');
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: 'Not found' });
});

it('serves repeat reads from the edge cache, ignoring query strings', async () => {
  await putMix('ok-sessions-1', mixInput());
  await request('/v1/mixes');
  // Bypass the purge by writing straight to D1
  const { env } = await import('cloudflare:workers');
  await env.DB.prepare("UPDATE mixes SET title = 'Changed'").run();
  const body = await (await request('/v1/mixes?bust=1')).json<{ mixes: { title: string }[] }>();
  expect(body.mixes[0]!.title).toBe('OK Sessions #1');
});

it('only exports handlers from the entry module (workerd rejects other exports)', async () => {
  const entry = await import('../src/index');
  expect(Object.keys(entry)).toEqual(['default']);
});
