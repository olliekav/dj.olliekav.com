import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';

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

export interface DownloadOptions extends ProcessDeps {
  /** ffprobe codec of the source; an MP3 is copied rather than re-encoded, which would only lose quality */
  sourceCodec?: string;
  /** JPEG embedded as the cover */
  cover?: string;
  /** ID3 tags, e.g. title, artist, album, track */
  tags?: Record<string, string>;
}

/** Writes a 320k MP3 with cover art and tags (any existing ones are replaced); an MP3 source is copied, not re-encoded. */
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
