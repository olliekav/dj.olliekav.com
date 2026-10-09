import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Theme } from '../../../shared/api-types.ts';
import type { AdminMix, Api, MixInput } from '../api.ts';
import type { ArtworkFont } from '../artwork.ts';
import type { DownloadOptions } from '../media.ts';
import { downloadTags, publishMix, resolveTheme, slugify, type PublishDeps } from '../publish.ts';
import type { StorageClient, UploadItem } from '../storage.ts';

const theme: Theme = { background: '#2A10A6', foreground: '#EC00A5', accent: '#EC00A5', dark: true };
const themes = { 1: theme };

// Real hashing for version strings; artwork bytes hash to a fixed value
const fakeMedia = () => ({
  sha256File: vi.fn(async (_file: string) => 'src'),
  sha256: vi.fn((value: string | Buffer) =>
    typeof value === 'string' ? createHash('sha256').update(value).digest('hex') : 'artworkhash-0123456789'
  ),
  probeAudio: vi.fn(async (_file: string) => ({ durationMs: 3_600_000, codec: 'pcm_s24le' })),
  encodeStream: vi.fn(async (_input: string, output: string) => output),
  encodeDownload: vi.fn(async (_input: string, output: string, _options?: DownloadOptions) => output),
  generatePeaks: vi.fn(async (_file: string, _duration: number) => ({ version: 1 as const, peaks: [0.5, 1] }))
});

const fakeApi = () => ({
  listMixes: vi.fn(async () => [] as AdminMix[]),
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

const keysOf = (input: MixInput) => [input.audio_m4a_key, input.peaks_key, input.audio_mp3_key];

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

describe('downloadTags', () => {
  it('tags title, album, track, artist, genre and year', () => {
    expect(
      downloadTags({ title: 'OK Sessions #7', number: 7, genre: 'House', published_at: '2019-03-10T12:00:00.000Z' }, 'Ollie')
    ).toEqual({
      title: 'OK Sessions #7',
      album: 'OK Sessions',
      track: '7',
      artist: 'Ollie',
      album_artist: 'Ollie',
      genre: 'House',
      date: '2019'
    });
  });

  it('omits unknown fields', () => {
    expect(downloadTags({ title: 'T', number: 1, genre: null, published_at: null })).toEqual({
      title: 'T',
      album: 'OK Sessions',
      track: '1'
    });
  });
});

describe('publishMix', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'publish-test-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('encodes, uploads with content-addressed keys and registers the mix', async () => {
    const { deps, media, api, uploadOnce } = setup({ artist: 'Ollie' });
    const result = await publishMix(
      { file: 'mix.wav', meta: { number: 1, genre: 'House', soundcloud_url: 'https://soundcloud.com/x' } },
      deps
    );

    const input = api.putMix.mock.calls[0]![1];
    const stream = createHash('sha256').update('src:2').digest('hex').slice(0, 12);
    expect(input.audio_m4a_key).toBe(`mixes/ok-sessions-1/audio-${stream}.m4a`);
    expect(input.peaks_key).toBe(`mixes/ok-sessions-1/peaks-${stream}.json`);
    expect(input.audio_mp3_key).toMatch(/^mixes\/ok-sessions-1\/audio-[0-9a-f]{12}\.mp3$/);
    expect(input.audio_mp3_key).not.toContain(stream);
    expect(result.uploaded).toEqual([input.audio_m4a_key, input.peaks_key, input.audio_mp3_key]);

    const items = uploadOnce.mock.calls.map(([, item]) => item);
    expect(items.map(item => item.contentType)).toEqual(['audio/mp4', 'application/json', 'audio/mpeg']);
    expect(items[2]).toMatchObject({ disposition: 'attachment', filename: 'ok-sessions-1.mp3' });
    expect(JSON.parse(String(items[1]!.body))).toEqual({ version: 1, peaks: [0.5, 1] });

    expect(media.encodeDownload.mock.calls[0]![2]).toEqual({
      sourceCodec: 'pcm_s24le',
      cover: undefined,
      tags: { title: 'OK Sessions #1', album: 'OK Sessions', track: '1', artist: 'Ollie', album_artist: 'Ollie', genre: 'House' }
    });
    expect(input).toMatchObject({
      number: 1,
      title: 'OK Sessions #1',
      description: '',
      genre: 'House',
      recorded_at: null,
      published_at: null,
      duration_ms: 3_600_000,
      artwork_key: null,
      theme,
      soundcloud_url: 'https://soundcloud.com/x',
      status: 'published',
      access: 'free'
    });
  });

  it('copies an MP3 source into the download', async () => {
    const { deps, media } = setup();
    media.probeAudio.mockResolvedValue({ durationMs: 1000, codec: 'mp3' });
    await publishMix({ file: 'mix.mp3', meta: { number: 1 } }, deps);
    expect(media.encodeDownload.mock.calls[0]![2]?.sourceCodec).toBe('mp3');
    expect(deps.log).toHaveBeenCalledWith('  tagging MP3 download (audio copied)…');
  });

  it('generates artwork from the theme and embeds it in the download', async () => {
    const renderArtwork = vi.fn(async () => Buffer.from('jpeg'));
    const font = {} as ArtworkFont;
    const { deps, media, api, uploadOnce } = setup({ artworkFont: font, renderArtwork });
    await publishMix({ file: 'mix.wav', meta: { number: 1 } }, deps);

    expect(renderArtwork).toHaveBeenCalledWith(font, theme, 1);
    const artworkKey = 'mixes/ok-sessions-1/artwork-artworkhash-.jpg';
    expect(uploadOnce.mock.calls[0]![1]).toMatchObject({ key: artworkKey, contentType: 'image/jpeg' });
    expect(api.putMix.mock.calls[0]![1].artwork_key).toBe(artworkKey);
    expect(media.encodeDownload.mock.calls[0]![2]?.cover).toMatch(/cover\.jpg$/);
  });

  it('prefers an explicit artwork file but only embeds JPEGs', async () => {
    const artwork = path.join(dir, 'cover.PNG');
    await writeFile(artwork, 'png');
    const renderArtwork = vi.fn(async () => Buffer.from('jpeg'));
    const { deps, media, uploadOnce } = setup({ artworkFont: {} as ArtworkFont, renderArtwork });
    const result = await publishMix({ file: 'mix.wav', meta: { number: 1, artwork } }, deps);

    expect(renderArtwork).not.toHaveBeenCalled();
    expect(result.uploaded[0]).toBe('mixes/ok-sessions-1/artwork-artworkhash-.png');
    expect(uploadOnce.mock.calls[0]![1].contentType).toBe('image/png');
    expect(media.encodeDownload.mock.calls[0]![2]?.cover).toBeUndefined();
  });

  it('rejects unsupported artwork', async () => {
    const { deps } = setup();
    await expect(publishMix({ file: 'mix.wav', meta: { number: 1, artwork: 'cover.gif' } }, deps)).rejects.toThrow(
      'Unsupported artwork type .gif'
    );
  });

  it('skips encoding what is already uploaded', async () => {
    const { deps, media, api } = setup({ exists: vi.fn(async () => true) });
    const result = await publishMix({ file: 'mix.wav', meta: { number: 1 }, draft: true }, deps);
    expect(media.encodeStream).not.toHaveBeenCalled();
    expect(media.encodeDownload).not.toHaveBeenCalled();
    expect(result.uploaded).toEqual([]);
    expect(api.putMix.mock.calls[0]![1].status).toBe('draft');
  });

  it('re-encodes only the download when the cover or tags change', async () => {
    const { deps, media } = setup();
    deps.exists = vi.fn(async (_c, _b, key: string) => !key.endsWith('.mp3'));
    await publishMix({ file: 'mix.wav', meta: { number: 1 } }, deps);
    expect(media.encodeStream).not.toHaveBeenCalled();
    expect(media.encodeDownload).toHaveBeenCalled();
  });

  it('versions the stream by source and the download by source, cover and tags', async () => {
    const a = await publishMix({ file: 'mix.wav', meta: { number: 1 } }, setup().deps);
    const b = await publishMix({ file: 'mix.wav', meta: { number: 1 } }, setup({ artist: 'Ollie' }).deps);
    const [m4aA, peaksA, mp3A] = keysOf(a.input);
    const [m4aB, peaksB, mp3B] = keysOf(b.input);
    expect([m4aA, peaksA]).toEqual([m4aB, peaksB]);
    expect(mp3A).not.toBe(mp3B);
  });

  it('does not report uploads that were already present', async () => {
    const { deps } = setup({ uploadOnce: vi.fn(async (_c, { key }) => ({ key, uploaded: false })) });
    expect((await publishMix({ file: 'mix.wav', meta: { number: 1 } }, deps)).uploaded).toEqual([]);
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
    media.encodeStream.mockRejectedValue(new Error('encode failed'));
    await expect(publishMix({ file: 'mix.wav', meta: { number: 1 } }, deps)).rejects.toThrow('encode failed');
    expect(api.putMix).not.toHaveBeenCalled();
  });

  it('uses the real media and storage modules by default', async () => {
    const { deps } = setup({ media: undefined, exists: undefined });
    await expect(publishMix({ file: path.join(dir, 'missing.wav'), meta: { number: 1 } }, deps)).rejects.toThrow();
  });
});
