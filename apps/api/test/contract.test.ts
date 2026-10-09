import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';
import fixture from '../../../shared/fixtures/mixes.json';
import type { Mix } from '../src/mixes';
import type { MixInput } from '../src/schemas';
import { putMix, request } from './helpers';

const key = (url: string | null) => (url ? new URL(url).pathname.slice(1) : null);

const toInput = (mix: Mix): MixInput => ({
  number: mix.number,
  title: mix.title,
  description: mix.description,
  genre: mix.genre,
  recorded_at: mix.recorded_at,
  published_at: mix.published_at,
  duration_ms: mix.duration_ms,
  audio_m4a_key: key(mix.audio.m4a)!,
  audio_mp3_key: key(mix.audio.mp3),
  peaks_key: key(mix.peaks_url),
  artwork_key: key(mix.artwork_url),
  theme: mix.theme,
  soundcloud_url: mix.soundcloud_url,
  status: 'published',
  access: mix.access
});

// shared/fixtures/mixes.json is the contract the web and native apps test against
it('matches the shared API fixture', async () => {
  const mixes = [...(fixture.mixes as Mix[])].reverse();
  for (const mix of mixes) {
    expect((await putMix(mix.slug, toInput(mix))).status).toBe(200);
  }
  await env.DB.prepare("UPDATE mixes SET updated_at = '2026-10-09T09:00:00.000Z'").run();

  const res = await request('/v1/mixes');
  expect(await res.json()).toEqual(fixture);
});
