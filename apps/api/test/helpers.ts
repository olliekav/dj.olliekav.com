import { exports } from 'cloudflare:workers';
import type { MixInput } from '../src/schemas';

export const ADMIN_TOKEN = 'test-admin-token';
export const DEVICE_ID = '7d5c4a1e-9f0b-4c3e-8a2d-6b1f0e9c8d7a';

export const request = (path: string, init?: RequestInit) =>
  exports.default.fetch(new Request(`https://api.olliekav.com${path}`, init));

export const mixInput = (overrides: Partial<MixInput> = {}): MixInput => ({
  number: 1,
  title: 'OK Sessions #1',
  description: 'House and disco.',
  genre: 'House',
  recorded_at: '2019-03-02',
  published_at: '2019-03-10T12:00:00.000Z',
  duration_ms: 3_600_000,
  audio_m4a_key: 'mixes/ok-sessions-1/audio.m4a',
  audio_mp3_key: 'mixes/ok-sessions-1/audio.mp3',
  peaks_key: 'mixes/ok-sessions-1/peaks.json',
  artwork_key: null,
  theme: { background: '#2A10A6', foreground: '#EC00A5', accent: '#EC00A5', dark: true },
  soundcloud_url: 'https://soundcloud.com/olliekav/ok-sessions-1',
  status: 'published',
  access: 'free',
  ...overrides
});

export const putMix = (slug: string, input: unknown, token = ADMIN_TOKEN) =>
  request(`/v1/admin/mixes/${slug}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(input)
  });

export const postEvent = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });

export const adminGet = (path: string) =>
  request(path, { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } });
