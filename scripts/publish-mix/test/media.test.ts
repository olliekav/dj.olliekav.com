import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPeakReducer,
  generatePeaks,
  PEAK_COUNT,
  probeDurationMs,
  run,
  sha256,
  sha256File,
  transcode
} from '../media.ts';
import { fakeSpawn } from './helpers.ts';

const pcm = (values: number[]) => {
  const buf = Buffer.alloc(values.length * 2);
  values.forEach((v, i) => buf.writeInt16LE(v, i * 2));
  return buf;
};

describe('createPeakReducer', () => {
  it('takes the max absolute sample per bucket and normalises', () => {
    const reducer = createPeakReducer(8, 4);
    reducer.push(pcm([100, -400, 50, 200, -800, 0, 10, 20]));
    expect(reducer.finish()).toEqual([0.5, 0.25, 1, 0.025]);
  });

  it('handles samples split across chunks', () => {
    const reducer = createPeakReducer(2, 2);
    const bytes = pcm([1000, -2000]);
    reducer.push(bytes.subarray(0, 1));
    reducer.push(bytes.subarray(1, 3));
    reducer.push(bytes.subarray(3));
    expect(reducer.finish()).toEqual([0.5, 1]);
  });

  it('clamps overflow into the last bucket and survives silence', () => {
    const reducer = createPeakReducer(2, 2);
    reducer.push(pcm([0, 0, 0, 0]));
    expect(reducer.finish()).toEqual([0, 0]);
  });
});

describe('run', () => {
  it('resolves stdout on success', async () => {
    const { spawnFn } = fakeSpawn({ echo: { stdout: ['he', 'llo'] } });
    expect(await run('echo', [], { spawnFn })).toBe('hello');
  });

  it('rejects with stderr on failure', async () => {
    const { spawnFn } = fakeSpawn({ ffmpeg: { code: 1, stderr: 'bad input' } });
    await expect(run('ffmpeg', [], { spawnFn })).rejects.toThrow('ffmpeg exited with 1: bad input');
  });

  it('rejects when the command is missing', async () => {
    const { spawnFn } = fakeSpawn({ nope: { error: new Error('ENOENT') } });
    await expect(run('nope', [], { spawnFn })).rejects.toThrow('ENOENT');
  });
});

describe('probeDurationMs', () => {
  it('parses ffprobe seconds', async () => {
    const { spawnFn } = fakeSpawn({ ffprobe: { stdout: '3725.5\n' } });
    expect(await probeDurationMs('mix.wav', { spawnFn })).toBe(3_725_500);
  });

  it('rejects unreadable durations', async () => {
    const { spawnFn } = fakeSpawn({ ffprobe: { stdout: 'N/A' } });
    await expect(probeDurationMs('mix.wav', { spawnFn })).rejects.toThrow('Could not read duration');
  });
});

describe('transcode', () => {
  it('encodes faststart AAC and 320k MP3', async () => {
    const { spawnFn, calls } = fakeSpawn();
    const out = await transcode('in.wav', '/tmp/x', { spawnFn });
    expect(out).toEqual({ m4a: '/tmp/x/audio.m4a', mp3: '/tmp/x/audio.mp3' });
    expect(calls[0]).toEqual(expect.arrayContaining(['aac', '256k', '+faststart', '/tmp/x/audio.m4a']));
    expect(calls[1]).toEqual(expect.arrayContaining(['libmp3lame', '320k', '/tmp/x/audio.mp3']));
  });
});

describe('generatePeaks', () => {
  it('reduces ffmpeg PCM output', async () => {
    const { spawnFn } = fakeSpawn({ ffmpeg: { stdout: [pcm([16384, -32768])] } });
    const result = await generatePeaks('in.wav', 1, { spawnFn });
    expect(result.version).toBe(1);
    expect(result.peaks).toHaveLength(PEAK_COUNT);
    expect(Math.max(...result.peaks)).toBe(1);
  });

  it('rejects on ffmpeg failure', async () => {
    const { spawnFn } = fakeSpawn({ ffmpeg: { code: 1, stderr: 'boom' } });
    await expect(generatePeaks('in.wav', 1000, { spawnFn })).rejects.toThrow('boom');
  });

  it('rejects when ffmpeg cannot start', async () => {
    const { spawnFn } = fakeSpawn({ ffmpeg: { error: new Error('ENOENT') } });
    await expect(generatePeaks('in.wav', 1000, { spawnFn })).rejects.toThrow('ENOENT');
  });
});

describe('hashing', () => {
  it('hashes buffers and files identically', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hash-'));
    const file = path.join(dir, 'a.txt');
    await writeFile(file, 'ok sessions');
    expect(await sha256File(file)).toBe(sha256('ok sessions'));
    await rm(dir, { recursive: true });
  });

  it('rejects missing files', async () => {
    await expect(sha256File('/definitely/missing')).rejects.toThrow();
  });
});

// Exercises the real ffmpeg pipeline on a generated 3-second tone
const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe.runIf(hasFfmpeg)('with real ffmpeg', () => {
  let dir: string;
  let wav: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'media-'));
    wav = path.join(dir, 'tone.wav');
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-ac', '2', wav]);
  });

  afterAll(() => rm(dir, { recursive: true, force: true }));

  it('probes, transcodes and generates peaks', async () => {
    const duration = await probeDurationMs(wav);
    expect(duration).toBe(3000);

    const { m4a, mp3 } = await transcode(wav, dir);
    expect(await probeDurationMs(m4a)).toBeGreaterThan(2900);
    expect(await probeDurationMs(mp3)).toBeGreaterThan(2900);

    const { peaks } = await generatePeaks(wav, duration);
    expect(peaks).toHaveLength(PEAK_COUNT);
    expect(Math.min(...peaks.slice(10, -10))).toBeGreaterThan(0.9);
  }, 30_000);
});
