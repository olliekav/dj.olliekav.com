import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeps, main, metaFromArgs, readManifest } from '../cli.ts';
import { exportManifest, toManifest } from '../export-soundcloud.ts';
import type { publishMix } from '../publish.ts';
import { jsonResponse, mockFetch } from './helpers.ts';

const fakePublish = () => vi.fn<typeof publishMix>(async ({ meta }) => ({ slug: String(meta.number), input: {} as never, uploaded: [] }));

const env = {
  R2_ACCOUNT_ID: 'acct',
  R2_ACCESS_KEY_ID: 'a',
  R2_SECRET_ACCESS_KEY: 'b',
  R2_BUCKET: 'bucket',
  API_URL: 'https://api.olliekav.com',
  ADMIN_TOKEN: 't'
};

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'cli-test-'));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe('metaFromArgs', () => {
  it('maps flags to mix metadata', async () => {
    const descriptionFile = path.join(dir, 'desc.txt');
    await writeFile(descriptionFile, ' Tracklist… \n');
    const meta = await metaFromArgs({
      number: '7',
      title: 'Seven',
      'description-file': descriptionFile,
      genre: 'Disco',
      'recorded-at': '2020-01-01',
      'soundcloud-url': 'https://soundcloud.com/x',
      bg: '#0f97ff',
      fg: '#87ffed',
      dark: true
    });
    expect(meta.theme?.accent).toBe('#87FFED');
    expect(meta).toMatchObject({
      number: 7,
      title: 'Seven',
      description: 'Tracklist…',
      genre: 'Disco',
      recorded_at: '2020-01-01',
      theme: { background: '#0F97FF', foreground: '#87FFED', accent: '#87FFED', dark: true }
    });
  });

  it('uses the background as accent for light themes', async () => {
    const meta = await metaFromArgs({ number: '1', bg: '#111111', fg: '#eeeeee', dark: false, description: 'd' });
    expect(meta.theme?.accent).toBe('#111111');
    expect(meta.description).toBe('d');
  });

  it('validates the number and theme pair', async () => {
    await expect(metaFromArgs({ number: 'abc' })).rejects.toThrow('--number');
    await expect(metaFromArgs({})).rejects.toThrow('--number');
    await expect(metaFromArgs({ number: '1', bg: '#000000' })).rejects.toThrow('--bg and --fg');
  });
});

describe('createDeps', () => {
  it('needs no credentials for dry runs', () => {
    expect(createDeps({}, { dryRun: true })).toEqual({ bucket: 'dry-run', client: null, api: null });
  });

  it('builds clients from the environment', () => {
    const deps = createDeps(env, { dryRun: false });
    expect(deps.bucket).toBe('bucket');
    expect(typeof deps.client?.send).toBe('function');
    expect(typeof deps.api?.putMix).toBe('function');
  });

  it('reports missing variables', () => {
    expect(() => createDeps({ ...env, ADMIN_TOKEN: '' }, { dryRun: false })).toThrow('Missing ADMIN_TOKEN');
  });
});

describe('readManifest', () => {
  it('resolves paths relative to the manifest', async () => {
    const manifest = path.join(dir, 'manifest.json');
    await writeFile(manifest, JSON.stringify([{ file: 'one.wav', number: 1, artwork: 'one.png', title: 'One' }, { file: '/abs/two.wav', number: 2 }]));
    expect(await readManifest(manifest)).toEqual([
      { file: path.join(dir, 'one.wav'), meta: { number: 1, title: 'One', artwork: path.join(dir, 'one.png') } },
      { file: '/abs/two.wav', meta: { number: 2, artwork: undefined } }
    ]);
  });

  it('validates entries', async () => {
    const manifest = path.join(dir, 'manifest.json');
    await writeFile(manifest, JSON.stringify({}));
    await expect(readManifest(manifest)).rejects.toThrow('JSON array');
    await writeFile(manifest, JSON.stringify([{ number: 1 }]));
    await expect(readManifest(manifest)).rejects.toThrow('entry 0');
  });
});

describe('main', () => {
  it('prints usage', async () => {
    const log = vi.fn();
    expect(await main([], { env, log })).toBe(0);
    expect(log.mock.calls[0]?.[0]).toContain('Usage:');
  });

  it('publishes a single file with shared themes', async () => {
    const publish = fakePublish();
    await main(['mix.wav', '--number', '3', '--dry-run'], { env: {}, log: vi.fn(), publish });
    const [job, deps] = publish.mock.calls[0]!;
    expect(job).toMatchObject({ file: 'mix.wav', meta: { number: 3 }, dryRun: true, draft: false });
    expect(deps.themes['3']?.background).toBe('#28C517');
  });

  it('publishes every manifest entry', async () => {
    const manifest = path.join(dir, 'manifest.json');
    await writeFile(manifest, JSON.stringify([{ file: 'a.wav', number: 1 }, { file: 'b.wav', number: 2 }]));
    const publish = fakePublish();
    await main(['--batch', manifest, '--draft'], { env, log: vi.fn(), publish });
    expect(publish.mock.calls.map(([job]) => [job.meta.number, job.draft])).toEqual([[1, true], [2, true]]);
  });
});

describe('export-soundcloud', () => {
  const data = {
    tracks: [
      { title: 'OK Sessions #1', description: 'd', genre: '', permalink_url: 'https://soundcloud.com/1', created_at: '2019-01-01' },
      { title: 'OK Sessions #2', permalink_url: 'https://soundcloud.com/2' }
    ]
  };

  it('numbers tracks in playlist order', () => {
    expect(toManifest(data)).toEqual([
      { file: null, number: 1, title: 'OK Sessions #1', description: 'd', genre: null, recorded_at: null, published_at: '2019-01-01', soundcloud_url: 'https://soundcloud.com/1' },
      { file: null, number: 2, title: 'OK Sessions #2', description: '', genre: null, recorded_at: null, published_at: null, soundcloud_url: 'https://soundcloud.com/2' }
    ]);
  });

  it('writes the manifest', async () => {
    const out = path.join(dir, 'm.json');
    const fetchFn = mockFetch(() => jsonResponse(200, data));
    expect(await exportManifest({ url: 'https://x', out, fetchFn })).toBe(2);
  });

  it('fails on HTTP errors', async () => {
    const fetchFn = mockFetch(() => jsonResponse(500, {}));
    await expect(exportManifest({ url: 'https://x', out: path.join(dir, 'm.json'), fetchFn })).rejects.toThrow('500');
  });
});
