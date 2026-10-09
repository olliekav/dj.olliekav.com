import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { renderArtworkJpg } from '../artwork.ts';
import type { DownloadOptions } from '../media.ts';
import { main, titleNumber } from '../soundcloud-artwork-cli.ts';
import type { SoundCloudClient, SoundCloudTrack } from '../soundcloud.ts';
import { fakeFont } from './fake-font.ts';

const theme = { background: '#2A10A6', foreground: '#F4E21A', accent: '#2A10A6', dark: false };
const themes = { 1: theme, 2: theme, 3: theme };
const env = { SOUNDCLOUD_CLIENT_ID: 'id', SOUNDCLOUD_CLIENT_SECRET: 's', ARTWORK_FONT: '/f.otf', ARTIST: 'O:K' };

const track = (n: number, overrides: Partial<SoundCloudTrack> = {}): SoundCloudTrack => ({
  id: n,
  urn: `soundcloud:tracks:${n}`,
  title: `OK Sessions #${n}`,
  description: '',
  genre: 'House',
  permalink_url: `https://soundcloud.com/x/${n}`,
  created_at: '2019/03/10 12:00:00 +0000',
  downloadable: true,
  duration: 1,
  ...overrides
});

let out: string;
beforeEach(async () => {
  out = await mkdtemp(path.join(tmpdir(), 'sc-art-'));
});
afterEach(() => rm(out, { recursive: true, force: true }));

const setup = (tracks: SoundCloudTrack[], extra: Partial<Parameters<typeof main>[1]> = {}) => {
  const soundcloud = {
    playlistTracks: vi.fn<SoundCloudClient['playlistTracks']>(async () => tracks),
    downloadOriginal: vi.fn<SoundCloudClient['downloadOriginal']>(async () => {}),
    updateArtwork: vi.fn<SoundCloudClient['updateArtwork']>(async () => {})
  };
  const authenticate = vi.fn(async () => 'user-token');
  const render = vi.fn<typeof renderArtworkJpg>(async () => Buffer.from('jpeg'));
  const retag = vi.fn(async (_input: string, output: string, _options?: DownloadOptions) => output);
  const probe = vi.fn(async () => ({ durationMs: 1, codec: 'mp3' }));
  const log = vi.fn();
  const run = (argv: string[]) =>
    main(argv, {
      env,
      log,
      loadFont: async () => fakeFont(),
      readThemes: async () => JSON.stringify(themes),
      soundcloud,
      authenticate,
      render,
      retag,
      probe,
      ...extra
    });
  return { soundcloud, authenticate, render, retag, probe, log, run, output: () => log.mock.calls.map(c => c[0]).join('\n') };
};

describe('titleNumber', () => {
  it.each([
    ['OK Sessions #12', 12],
    ['OK Sessions # 3 - Live', 3],
    ['Untitled', null]
  ])('%s → %s', (title, expected) => {
    expect(titleNumber(title)).toBe(expected);
  });
});

describe('soundcloud-artwork CLI', () => {
  it('signs in once and replaces artwork at 2000px', async () => {
    const { run, soundcloud, authenticate, render, output } = setup([track(1), track(2), track(3)]);
    expect(await run(['--only', '2-3'])).toBe(0);
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(render.mock.calls.map(c => c[1])).toEqual([2000, 2000]);
    expect(soundcloud.updateArtwork.mock.calls.map(c => [c[0], c[2]])).toEqual([
      ['soundcloud:tracks:2', 'user-token'],
      ['soundcloud:tracks:3', 'user-token']
    ]);
    expect(output()).toContain('Updated 2 of 2');
  });

  it('refuses to touch anything when titles and positions disagree', async () => {
    const { run, soundcloud, authenticate } = setup([track(1), track(3, { title: 'OK Sessions #3' })]);
    await expect(run([])).rejects.toThrow('"OK Sessions #3" is at position 2');
    expect(authenticate).not.toHaveBeenCalled();
    expect(soundcloud.updateArtwork).not.toHaveBeenCalled();
  });

  it('refuses mixes without a theme', async () => {
    const { run } = setup([track(1), track(2), track(3), track(4)]);
    await expect(run([])).rejects.toThrow('no theme for #4');
  });

  it('lists the plan on a dry run without signing in', async () => {
    const { run, authenticate, output } = setup([track(1), track(2)]);
    expect(await run(['--dry-run'])).toBe(0);
    expect(authenticate).not.toHaveBeenCalled();
    expect(output()).toContain('Would update 2 artworks');
  });

  it('keeps going after a failure and reports it', async () => {
    const { run, soundcloud, output } = setup([track(1), track(2)]);
    soundcloud.updateArtwork.mockRejectedValueOnce(new Error('403'));
    expect(await run([])).toBe(1);
    expect(output()).toContain('✗ #1 OK Sessions #1: 403');
    expect(output()).toContain('Updated 1 of 2; failed: #1');
  });

  it('exports re-tagged MP3s without signing in', async () => {
    const { run, soundcloud, retag, authenticate, output } = setup([track(1), track(2, { downloadable: false }), track(3)]);
    expect(await run(['--mp3s', '--out', out])).toBe(1);
    expect(authenticate).not.toHaveBeenCalled();
    expect(soundcloud.downloadOriginal).toHaveBeenCalledTimes(2);
    const [, dest, options] = retag.mock.calls[0]!;
    expect(dest).toBe(path.join(out, 'ok-sessions-1.mp3'));
    expect(options).toMatchObject({
      sourceCodec: 'mp3',
      tags: { title: 'OK Sessions #1', artist: 'O:K', album: 'OK Sessions', track: '1', genre: 'House', date: '2019' }
    });
    expect(options?.cover).toMatch(/cover-1\.jpg$/);
    expect(output()).toContain('✗ #2 OK Sessions #2: downloads are disabled');
    expect(output()).toContain(`Saved 2 of 3 to ${out}; failed: #2`);
  });

  it('notes when an original had to be encoded', async () => {
    const { run, output } = setup([track(1)], { probe: async () => ({ durationMs: 1, codec: 'pcm_s16le' }) });
    expect(await run(['--mp3s', '--out', out])).toBe(0);
    expect(output()).toContain('encoded to 320k MP3');
  });

  it('needs credentials, and prints usage', async () => {
    const { run } = setup([]);
    expect(await main(['--help'], { log: vi.fn() })).toBe(0);
    await expect(main([], { env: {}, log: vi.fn() })).rejects.toThrow('Missing SOUNDCLOUD_CLIENT_ID');
    void run;
  });
});
