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
  encodeDownload,
  encodeStream
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

describe('encodeStream', () => {
  it('encodes faststart AAC without source metadata', async () => {
    const { spawnFn, calls } = fakeSpawn();
    expect(await encodeStream('in.wav', '/tmp/x/audio.m4a', { spawnFn })).toBe('/tmp/x/audio.m4a');
    expect(calls[0]).toEqual(
      expect.arrayContaining(['-map', '0:a:0', '-map_metadata', '-1', 'aac', '256k', '+faststart', '/tmp/x/audio.m4a'])
    );
  });
});

describe('encodeDownload', () => {
  it('encodes a 320k MP3 with tags', async () => {
    const { spawnFn, calls } = fakeSpawn();
    await encodeDownload('in.wav', '/tmp/x/audio.mp3', { spawnFn, tags: { title: 'OK Sessions #1', track: '1' } });
    const args = calls[0]!;
    expect(args).toEqual(expect.arrayContaining(['libmp3lame', '320k', '-id3v2_version', '3', '/tmp/x/audio.mp3']));
    expect(args.join(' ')).toContain('-metadata title=OK Sessions #1 -metadata track=1');
    expect(args).not.toContain('attached_pic');
  });

  it('copies MP3 audio and embeds the cover', async () => {
    const { spawnFn, calls } = fakeSpawn();
    await encodeDownload('in.mp3', '/tmp/x/audio.mp3', { spawnFn, sourceCodec: 'mp3', cover: '/tmp/x/cover.jpg' });
    const args = calls[0]!.join(' ');
    expect(args).toContain('-i in.mp3 -i /tmp/x/cover.jpg -map 0:a:0 -c:a copy -map 1:v -c:v copy -disposition:v attached_pic');
    expect(args).not.toContain('libmp3lame');
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

  it('probes, encodes, tags and generates peaks', async () => {
    const { durationMs: duration, codec } = await probeAudio(wav);
    expect(duration).toBe(3000);
    expect(codec).toMatch(/^pcm_/);

    const m4a = await encodeStream(wav, path.join(dir, 'audio.m4a'));
    expect(await probeAudio(m4a)).toMatchObject({ codec: 'aac' });

    const cover = path.join(dir, 'cover.jpg');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=64x64', '-frames:v', '1', cover]);
    const mp3 = await encodeDownload(wav, path.join(dir, 'audio.mp3'), {
      sourceCodec: codec,
      cover,
      tags: { title: 'OK Sessions #1', album: 'OK Sessions', track: '1' }
    });
    const probe = JSON.parse(
      await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name:stream_disposition=attached_pic:format_tags', '-of', 'json', mp3])
    );
    expect(probe.streams.map((s: { codec_name: string }) => s.codec_name)).toEqual(['mp3', 'mjpeg']);
    expect(probe.streams[1].disposition.attached_pic).toBe(1);
    expect(probe.format.tags).toMatchObject({ title: 'OK Sessions #1', album: 'OK Sessions', track: '1' });

    // Re-tagging an MP3 copies the audio frames untouched and replaces old tags and art
    const retagged = await encodeDownload(mp3, path.join(dir, 'retagged.mp3'), { sourceCodec: 'mp3', tags: { title: 'New' } });
    const again = JSON.parse(
      await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,bit_rate:format_tags', '-of', 'json', retagged])
    );
    expect(again.streams.map((s: { codec_name: string }) => s.codec_name)).toEqual(['mp3']);
    expect(again.format.tags.title).toBe('New');
    expect(again.format.tags.album).toBeUndefined();
    expect((await probeAudio(retagged)).durationMs).toBe((await probeAudio(mp3)).durationMs);

    const { peaks } = await generatePeaks(wav, duration);
    expect(peaks).toHaveLength(PEAK_COUNT);
    expect(Math.min(...peaks.slice(10, -10))).toBeGreaterThan(0.9);
  }, 30_000);
});
