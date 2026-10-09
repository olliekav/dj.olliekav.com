import { describe, expect, it, vi } from 'vitest';
import type { AdminMix, Api } from '../api.ts';
import { importFromSoundCloud, parseNumbers, toIsoDate, toMeta } from '../import-soundcloud.ts';
import type { publishMix } from '../publish.ts';
import type { SoundCloudClient, SoundCloudTrack } from '../soundcloud.ts';

const track = (n: number, overrides: Partial<SoundCloudTrack> = {}): SoundCloudTrack => ({
  id: n,
  urn: `soundcloud:tracks:${n}`,
  title: `OK Sessions #${n}`,
  description: `Mix ${n}`,
  genre: 'House',
  permalink_url: `https://soundcloud.com/olliekav/ok-sessions-${n}`,
  created_at: '2019/03/10 12:00:00 +0000',
  downloadable: true,
  duration: 1000,
  ...overrides
});

const setup = (tracks: SoundCloudTrack[], existing: Partial<AdminMix>[] = []) => {
  const soundcloud = {
    playlistTracks: vi.fn<SoundCloudClient['playlistTracks']>(async () => tracks),
    downloadOriginal: vi.fn<SoundCloudClient['downloadOriginal']>(async () => {})
  };
  const api = {
    listMixes: vi.fn(async () => existing as AdminMix[]),
    putMix: vi.fn()
  } as unknown as Api;
  const publish = vi.fn<typeof publishMix>(async ({ meta }) => ({ slug: meta.slug!, input: {} as never, uploaded: [] }));
  const log = vi.fn();
  return { soundcloud, api, publish, log, deps: { bucket: 'b', client: null, api, themes: {}, log, soundcloud, publish } };
};

describe('parseNumbers', () => {
  it('parses lists and ranges', () => {
    expect([...parseNumbers('1, 3,5-7')]).toEqual([1, 3, 5, 6, 7]);
  });

  it.each(['a', '5-3', '1-'])('rejects %s', value => {
    expect(() => parseNumbers(value)).toThrow();
  });
});

describe('toIsoDate', () => {
  it.each([
    ['2019/03/10 12:00:00 +0000', '2019-03-10T12:00:00.000Z'],
    ['2019/03/10 12:00:00 +0100', '2019-03-10T11:00:00.000Z'],
    ['2021-06-20T18:00:00Z', '2021-06-20T18:00:00.000Z'],
    [null, null],
    ['not a date', null]
  ])('converts %s', (input, expected) => {
    expect(toIsoDate(input)).toBe(expected);
  });
});

describe('toMeta', () => {
  it('numbers mixes with stable slugs', () => {
    expect(toMeta(track(3, { genre: '', description: null }), 3)).toEqual({
      number: 3,
      slug: 'ok-sessions-3',
      title: 'OK Sessions #3',
      description: '',
      genre: null,
      published_at: '2019-03-10T12:00:00.000Z',
      soundcloud_url: 'https://soundcloud.com/olliekav/ok-sessions-3'
    });
  });
});

describe('importFromSoundCloud', () => {
  it('downloads and publishes each track in playlist order', async () => {
    const { deps, soundcloud, publish } = setup([track(1), track(2)]);
    const summary = await importFromSoundCloud({}, deps);

    expect(summary).toEqual({ published: [1, 2], skipped: [], failed: [] });
    const file = soundcloud.downloadOriginal.mock.calls[0]![1];
    expect(file).toMatch(/ok-sessions-1\.mp3$/);
    expect(publish.mock.calls[0]![0]).toMatchObject({ file, meta: { number: 1, slug: 'ok-sessions-1' } });
    expect(publish.mock.calls[1]![0].meta.number).toBe(2);
  });

  it('skips tracks already imported, unless forced', async () => {
    const existing = [{ number: 1, soundcloud_url: track(1).permalink_url, status: 'published' as const }];
    const { deps, publish } = setup([track(1), track(2)], existing);
    expect(await importFromSoundCloud({}, deps)).toMatchObject({ published: [2], skipped: [1] });
    expect(publish).toHaveBeenCalledTimes(1);

    const forced = setup([track(1)], existing);
    expect(await importFromSoundCloud({ force: true }, forced.deps)).toMatchObject({ published: [1] });
    expect(forced.api.listMixes).not.toHaveBeenCalled();
  });

  it('re-imports drafts when publishing for real', async () => {
    const existing = [{ number: 1, soundcloud_url: track(1).permalink_url, status: 'draft' as const }];
    const { deps } = setup([track(1)], existing);
    expect(await importFromSoundCloud({}, deps)).toMatchObject({ published: [1] });
  });

  it('only imports the requested numbers', async () => {
    const { deps, publish } = setup([track(1), track(2), track(3)]);
    await importFromSoundCloud({ only: new Set([2]) }, deps);
    expect(publish.mock.calls.map(([job]) => job.meta.number)).toEqual([2]);
  });

  it('reports tracks with downloads disabled and keeps going after failures', async () => {
    const { deps, publish, log } = setup([track(1, { downloadable: false }), track(2), track(3)]);
    publish.mockRejectedValueOnce(new Error('encode failed'));
    const summary = await importFromSoundCloud({ draft: true }, deps);

    expect(summary).toEqual({
      published: [3],
      skipped: [],
      failed: [
        { number: 1, title: 'OK Sessions #1', reason: 'downloads disabled' },
        { number: 2, title: 'OK Sessions #2', reason: 'encode failed' }
      ]
    });
    expect(publish.mock.calls[0]![0].draft).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('1 published, 0 skipped, 2 failed'));
  });

  it('lists the plan on a dry run without downloading', async () => {
    const { deps, soundcloud, publish, api, log } = setup([track(1)]);
    await importFromSoundCloud({ dryRun: true, playlistUrl: 'https://soundcloud.com/x/sets/y' }, deps);
    expect(soundcloud.playlistTracks).toHaveBeenCalledWith('https://soundcloud.com/x/sets/y');
    expect(soundcloud.downloadOriginal).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(api.listMixes).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('• #1 OK Sessions #1 → ok-sessions-1');
  });
});
