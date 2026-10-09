import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import type { Readable } from 'node:stream';
import type { Peaks } from '../../shared/api-types.ts';

export const PEAK_COUNT = 1000;
const PEAK_SAMPLE_RATE = 8000;

type Child = Pick<ChildProcessByStdio<null, Readable, Readable>, 'stdout' | 'stderr' | 'on'>;
export type SpawnFn = (command: string, args: string[], options: { stdio: ['ignore', 'pipe', 'pipe'] }) => Child;
export interface ProcessDeps {
  spawnFn?: SpawnFn;
}

const defaultSpawn: SpawnFn = (command, args, options) => spawn(command, args, options);

/** Runs a command, resolving with stdout. */
export const run = (command: string, args: string[], { spawnFn = defaultSpawn }: ProcessDeps = {}) =>
  new Promise<string>((resolve, reject) => {
    const child = spawnFn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk));
    child.on('error', reject);
    child.on('close', (code: number | null) => {
      if (code === 0) {
        resolve(Buffer.concat(out).toString());
      } else {
        reject(new Error(`${command} exited with ${code}: ${Buffer.concat(err).toString().slice(-2000)}`));
      }
    });
  });

export interface AudioInfo {
  durationMs: number;
  /** ffprobe codec name of the first audio stream, e.g. "mp3" or "pcm_s24le" */
  codec: string;
}

export const probeAudio = async (file: string, deps?: ProcessDeps): Promise<AudioInfo> => {
  const out = await run(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name:format=duration', '-of', 'json', file],
    deps
  );
  let parsed: { streams?: { codec_name?: string }[]; format?: { duration?: string } };
  try {
    parsed = JSON.parse(out);
  } catch {
    throw new Error(`Could not read ${file}`);
  }
  const seconds = Number.parseFloat(parsed.format?.duration ?? '');
  const codec = parsed.streams?.[0]?.codec_name;
  if (!Number.isFinite(seconds) || seconds <= 0 || !codec) {
    throw new Error(`Could not read duration of ${file}`);
  }
  return { durationMs: Math.round(seconds * 1000), codec };
};

export interface Renditions {
  m4a: string;
  mp3: string;
}

/**
 * Encodes the streaming (AAC in MP4, faststart for range-request seeking) and download (MP3) renditions.
 * An MP3 source is copied rather than re-encoded, which would only lose quality.
 */
export const transcode = async (
  input: string,
  outDir: string,
  { sourceCodec, ...deps }: ProcessDeps & { sourceCodec?: string } = {}
): Promise<Renditions> => {
  const m4a = path.join(outDir, 'audio.m4a');
  const mp3 = path.join(outDir, 'audio.mp3');
  await run(
    'ffmpeg',
    ['-y', '-v', 'error', '-i', input, '-vn', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', m4a],
    deps
  );
  const mp3Codec = sourceCodec === 'mp3' ? ['-c:a', 'copy'] : ['-c:a', 'libmp3lame', '-b:a', '320k'];
  await run('ffmpeg', ['-y', '-v', 'error', '-i', input, '-map', '0:a:0', ...mp3Codec, mp3], deps);
  return { m4a, mp3 };
};

/**
 * Reduces signed 16-bit mono PCM chunks to `count` peaks between 0 and 1.
 * Bucket size comes from the expected sample count so the PCM can be streamed.
 */
export const createPeakReducer = (totalSamples: number, count = PEAK_COUNT) => {
  const peaks = new Float64Array(count);
  const perBucket = Math.max(1, totalSamples / count);
  let index = 0;
  let carry: Buffer | null = null;

  return {
    push(chunk: Buffer) {
      let bytes = chunk;
      if (carry) {
        bytes = Buffer.concat([carry, chunk]);
        carry = null;
      }
      const usable = bytes.length - (bytes.length % 2);
      for (let offset = 0; offset < usable; offset += 2) {
        const bucket = Math.min(count - 1, Math.floor(index / perBucket));
        const value = Math.abs(bytes.readInt16LE(offset)) / 32768;
        if (value > peaks[bucket]!) {
          peaks[bucket] = value;
        }
        index++;
      }
      if (usable < bytes.length) {
        carry = bytes.subarray(usable);
      }
    },
    finish(): number[] {
      const max = Math.max(...peaks) || 1;
      return Array.from(peaks, p => Math.round((p / max) * 1000) / 1000);
    }
  };
};

/** Decodes to low-rate mono PCM via ffmpeg and returns normalised peaks. */
export const generatePeaks = (input: string, durationMs: number, { spawnFn = defaultSpawn }: ProcessDeps = {}) =>
  new Promise<Peaks>((resolve, reject) => {
    const reducer = createPeakReducer(Math.round((durationMs / 1000) * PEAK_SAMPLE_RATE));
    const child = spawnFn(
      'ffmpeg',
      ['-v', 'error', '-i', input, '-vn', '-ac', '1', '-ar', String(PEAK_SAMPLE_RATE), '-f', 's16le', '-'],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    const err: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => reducer.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk));
    child.on('error', reject);
    child.on('close', (code: number | null) => {
      if (code === 0) {
        resolve({ version: 1, peaks: reducer.finish() });
      } else {
        reject(new Error(`ffmpeg exited with ${code}: ${Buffer.concat(err).toString()}`));
      }
    });
  });

export const sha256File = (file: string) =>
  new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(file)
      .on('data', chunk => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });

export const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
