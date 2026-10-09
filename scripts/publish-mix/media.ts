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

/** Encodes the streaming rendition: AAC in MP4, faststart so players can seek with range requests. */
export const encodeStream = async (input: string, output: string, deps?: ProcessDeps): Promise<string> => {
  await run(
    'ffmpeg',
    ['-y', '-v', 'error', '-i', input, '-map', '0:a:0', '-map_metadata', '-1', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', output],
    deps
  );
  return output;
};

export interface DownloadOptions extends ProcessDeps {
  /** ffprobe codec of the source; an MP3 is copied rather than re-encoded, which would only lose quality */
  sourceCodec?: string;
  /** JPEG embedded as the cover */
  cover?: string;
  /** ID3 tags, e.g. title, artist, album, track */
  tags?: Record<string, string>;
}

/** Encodes the download rendition: a 320k MP3 with cover art and tags (any existing ones are replaced). */
export const encodeDownload = async (
  input: string,
  output: string,
  { sourceCodec, cover, tags = {}, ...deps }: DownloadOptions = {}
): Promise<string> => {
  const audio = sourceCodec === 'mp3' ? ['-c:a', 'copy'] : ['-c:a', 'libmp3lame', '-b:a', '320k'];
  const art = cover
    ? ['-map', '1:v', '-c:v', 'copy', '-disposition:v', 'attached_pic', '-metadata:s:v', 'title=Cover', '-metadata:s:v', 'comment=Cover (front)']
    : [];
  const metadata = Object.entries(tags).flatMap(([key, value]) => ['-metadata', `${key}=${value}`]);
  await run(
    'ffmpeg',
    [
      '-y', '-v', 'error',
      '-i', input,
      ...(cover ? ['-i', cover] : []),
      '-map', '0:a:0',
      ...audio,
      ...art,
      '-map_metadata', '-1',
      ...metadata,
      '-id3v2_version', '3',
      output
    ],
    deps
  );
  return output;
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
