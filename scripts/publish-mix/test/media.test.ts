import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPeakReducer,
  generatePeaks,
  PEAK_COUNT,
  probeAudio,
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

describe('probeAudio', () => {
  const probe = (stdout: string) => fakeSpawn({ ffprobe: { stdout } });

  it('reads duration and codec', async () => {
    const { spawnFn } = probe(JSON.stringify({ streams: [{ codec_name: 'mp3' }], format: { duration: '3725.5' } }));
    expect(await probeAudio('mix.mp3', { spawnFn })).toEqual({ durationMs: 3_725_500, codec: 'mp3' });
  });

  it.each([
    ['unreadable durations', JSON.stringify({ streams: [{ codec_name: 'mp3' }], format: { duration: 'N/A' } })],
    ['files without audio', JSON.stringify({ streams: [], format: { duration: '10' } })],
    ['invalid output', 'nope']
  ])('rejects %s', async (_label, stdout) => {
    await expect(probeAudio('mix.wav', { spawnFn: probe(stdout).spawnFn })).rejects.toThrow('Could not read');
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

  it('copies MP3 sources instead of re-encoding', async () => {
    const { spawnFn, calls } = fakeSpawn();
    await transcode('in.mp3', '/tmp/x', { spawnFn, sourceCodec: 'mp3' });
    expect(calls[1]).toEqual(expect.arrayContaining(['-map', '0:a:0', '-c:a', 'copy', '/tmp/x/audio.mp3']));
    expect(calls[1]).not.toContain('libmp3lame');
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
    const { durationMs: duration, codec } = await probeAudio(wav);
    expect(duration).toBe(3000);
    expect(codec).toMatch(/^pcm_/);

    const { m4a, mp3 } = await transcode(wav, dir, { sourceCodec: codec });
    expect(await probeAudio(m4a)).toMatchObject({ codec: 'aac' });
    expect(await probeAudio(mp3)).toMatchObject({ codec: 'mp3' });

    // An MP3 source with cover art is copied: same audio, no image stream
    const sourceMp3 = path.join(dir, 'source.mp3');
    const cover = path.join(dir, 'cover.png');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=16x16', '-frames:v', '1', cover]);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp3, '-i', cover, '-map', '0:a', '-map', '1:v', '-c:a', 'copy', '-c:v', 'png', '-disposition:v', 'attached_pic', sourceMp3]);
    const copyDir = path.join(dir, 'copy');
    await mkdir(copyDir);
    const copied = await transcode(sourceMp3, copyDir, { sourceCodec: 'mp3' });
    expect((await probeAudio(copied.mp3)).durationMs).toBe((await probeAudio(sourceMp3)).durationMs);
    expect(await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', copied.mp3])).toBe('mp3\n');

    const { peaks } = await generatePeaks(wav, duration);
    expect(peaks).toHaveLength(PEAK_COUNT);
    expect(Math.min(...peaks.slice(10, -10))).toBeGreaterThan(0.9);
  }, 30_000);
});
