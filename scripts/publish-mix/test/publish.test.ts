import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Theme } from '../../../shared/api-types.ts';
import type { AdminMix, Api, MixInput } from '../api.ts';
import { publishMix, resolveTheme, slugify, type PublishDeps } from '../publish.ts';
import type { StorageClient, UploadItem } from '../storage.ts';

const theme: Theme = { background: '#2A10A6', foreground: '#EC00A5', accent: '#EC00A5', dark: true };
const themes = { 1: theme };

// The fake sha256 of `source-hash:1`, truncated to 12 characters
const version = 'hash-of-sour';

const fakeMedia = () => ({
  sha256File: vi.fn(async (_file: string) => 'source-hash'),
  sha256: vi.fn((value: string | Buffer) => (typeof value === 'string' ? `hash-of-${value}` : 'artworkhash-0123456789')),
  probeDurationMs: vi.fn(async (_file: string) => 3_600_000),
  transcode: vi.fn(async (_file: string, dir: string) => ({ m4a: `${dir}/audio.m4a`, mp3: `${dir}/audio.mp3` })),
  generatePeaks: vi.fn(async (_file: string, _duration: number) => ({ version: 1 as const, peaks: [0.5, 1] }))
});

const fakeApi = () => ({
  putMix: vi.fn(async (slug: string, _input: MixInput) => ({ share_url: `https://dj.olliekav.com/mixes/${slug}` }) as AdminMix)
});

const setup = (overrides: Partial<PublishDeps> = {}) => {
  const media = fakeMedia();
  const api = fakeApi();
  const uploadOnce = vi.fn(async (_client: StorageClient, { key }: UploadItem) => ({ key, uploaded: true }));
  const exists = vi.fn(async (_client: StorageClient, _bucket: string, _key: string) => false);
  const deps = {
    bucket: 'bucket',
    client: {} as StorageClient,
    themes,
    log: vi.fn(),
    media,
    exists,
    uploadOnce,
    api: api as Api,
    ...overrides
  };
  return { deps, media, api, uploadOnce, exists };
};

describe('slugify', () => {
  it('matches the website', () => {
    expect(slugify('OK Sessions #12')).toBe('ok-sessions-12');
    expect(slugify('  Hello -- World! ')).toBe('hello-world');
  });
});

describe('resolveTheme', () => {
  it('prefers explicit themes, then shared themes', () => {
    const custom = { ...theme, background: '#000000' };
    expect(resolveTheme({ number: 1, theme: custom }, themes)).toBe(custom);
    expect(resolveTheme({ number: 1 }, themes)).toBe(theme);
    expect(() => resolveTheme({ number: 999 }, themes)).toThrow('No theme for mix #999');
  });
});

describe('publishMix', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'publish-test-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('encodes, uploads with content-addressed keys and registers the mix', async () => {
    const { deps, media, api, uploadOnce } = setup();
    const result = await publishMix(
      { file: 'mix.wav', meta: { number: 1, genre: 'House', soundcloud_url: 'https://soundcloud.com/x' } },
      deps
    );

    const prefix = 'mixes/ok-sessions-1';
    expect(media.sha256).toHaveBeenCalledWith('source-hash:1');
    expect(result.uploaded).toEqual([
      `${prefix}/audio-${version}.m4a`,
      `${prefix}/audio-${version}.mp3`,
      `${prefix}/peaks-${version}.json`
    ]);
    const items = uploadOnce.mock.calls.map(([, item]) => item);
    expect(items.map(item => item.contentType)).toEqual(['audio/mp4', 'audio/mpeg', 'application/json']);
    expect(items[1]).toMatchObject({ disposition: 'attachment', filename: 'ok-sessions-1.mp3' });
    expect(JSON.parse(String(items[2]!.body))).toEqual({ version: 1, peaks: [0.5, 1] });
    expect(api.putMix).toHaveBeenCalledWith('ok-sessions-1', {
      number: 1,
      title: 'OK Sessions #1',
      description: '',
      genre: 'House',
      recorded_at: null,
      published_at: null,
      duration_ms: 3_600_000,
      audio_m4a_key: `${prefix}/audio-${version}.m4a`,
      audio_mp3_key: `${prefix}/audio-${version}.mp3`,
      peaks_key: `${prefix}/peaks-${version}.json`,
      artwork_key: null,
      theme,
      soundcloud_url: 'https://soundcloud.com/x',
      status: 'published',
      access: 'free'
    });
  });

  it('skips encoding when the renditions already exist', async () => {
    const { deps, media, api } = setup({ exists: vi.fn(async () => true) });
    const result = await publishMix({ file: 'mix.wav', meta: { number: 1 }, draft: true }, deps);
    expect(media.transcode).not.toHaveBeenCalled();
    expect(result.uploaded).toEqual([]);
    expect(api.putMix.mock.calls[0]![1].status).toBe('draft');
  });

  it('does not report uploads that were already present', async () => {
    const { deps } = setup({ uploadOnce: vi.fn(async (_c, { key }) => ({ key, uploaded: false })) });
    expect((await publishMix({ file: 'mix.wav', meta: { number: 1 } }, deps)).uploaded).toEqual([]);
  });

  it('uploads artwork', async () => {
    const artwork = path.join(dir, 'cover.PNG');
    await writeFile(artwork, 'png');
    const { deps, api, uploadOnce } = setup();
    const result = await publishMix({ file: 'mix.wav', meta: { number: 1, artwork } }, deps);
    const key = 'mixes/ok-sessions-1/artwork-artworkhash-.png';
    expect(result.uploaded.at(-1)).toBe(key);
    expect(uploadOnce.mock.calls.at(-1)![1].contentType).toBe('image/png');
    expect(api.putMix.mock.calls[0]![1].artwork_key).toBe(key);
  });

  it('rejects unsupported artwork', async () => {
    const { deps } = setup();
    await expect(publishMix({ file: 'mix.wav', meta: { number: 1, artwork: 'cover.gif' } }, deps)).rejects.toThrow(
      'Unsupported artwork type .gif'
    );
  });

  it('requires a number', async () => {
    const { deps } = setup();
    await expect(publishMix({ file: 'mix.wav', meta: { number: 0 } }, deps)).rejects.toThrow('A mix number is required');
  });

  it('prints the plan on a dry run without side effects', async () => {
    const { deps, uploadOnce } = setup({ api: null, client: null });
    const result = await publishMix(
      { file: 'mix.wav', meta: { number: 1, title: 'Custom Name', slug: 'custom' }, dryRun: true },
      deps
    );
    expect(result.slug).toBe('custom');
    expect(uploadOnce).not.toHaveBeenCalled();
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('"audio_m4a_key": "mixes/custom/audio-'));
  });

  it('needs clients for a real run', async () => {
    const { deps } = setup({ api: null });
    await expect(publishMix({ file: 'mix.wav', meta: { number: 1 } }, deps)).rejects.toThrow('--dry-run');
  });

  it('cleans up and does not register when encoding fails', async () => {
    const { deps, media, api } = setup();
    media.transcode.mockRejectedValue(new Error('encode failed'));
    await expect(publishMix({ file: 'mix.wav', meta: { number: 1 } }, deps)).rejects.toThrow('encode failed');
    expect(api.putMix).not.toHaveBeenCalled();
  });

  it('uses the real media and storage modules by default', async () => {
    const { deps } = setup({ media: undefined, exists: undefined });
    await expect(publishMix({ file: path.join(dir, 'missing.wav'), meta: { number: 1 } }, deps)).rejects.toThrow();
  });
});
