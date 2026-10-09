import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Theme } from '../../shared/api-types.ts';
import type { AdminMix, Api, MixInput } from './api.ts';
import * as media from './media.ts';
import { exists, uploadOnce, type StorageClient, type UploadItem } from './storage.ts';

// Bump when encoding settings change so new renditions get new keys
export const ENCODING_VERSION = 1;

export type Themes = Record<string, Theme>;

export interface MixMeta {
  number: number;
  title?: string;
  slug?: string;
  description?: string;
  genre?: string | null;
  recorded_at?: string | null;
  published_at?: string | null;
  soundcloud_url?: string | null;
  artwork?: string;
  theme?: Theme;
  access?: MixInput['access'];
}

export interface PublishJob {
  file: string;
  meta: MixMeta;
  draft?: boolean;
  dryRun?: boolean;
}

export interface PublishDeps {
  bucket: string;
  client: StorageClient | null;
  api: Api | null;
  themes: Themes;
  log?: (message: string) => void;
  media?: Pick<typeof media, 'sha256File' | 'sha256' | 'probeDurationMs' | 'transcode' | 'generatePeaks'>;
  uploadOnce?: typeof uploadOnce;
  exists?: typeof exists;
}

export interface PublishResult {
  slug: string;
  input: MixInput;
  uploaded: string[];
  mix?: AdminMix;
}

// Same rules as the website used for titles
export const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

const artworkTypes: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

export const resolveTheme = (meta: Pick<MixMeta, 'number' | 'theme'>, themes: Themes): Theme => {
  const theme = meta.theme ?? themes[String(meta.number)];
  if (!theme) {
    throw new Error(`No theme for mix #${meta.number}: add it to shared/mix-themes.json or pass --bg/--fg`);
  }
  return theme;
};

/**
 * Publishes one mix: encode, generate peaks, upload to R2, register with the API.
 * Keys derive from the source file's hash, so re-running skips work already done.
 */
export const publishMix = async (
  { file, meta, draft = false, dryRun = false }: PublishJob,
  deps: PublishDeps
): Promise<PublishResult> => {
  const { bucket, client, api, themes, log = console.log } = deps;
  const m = deps.media ?? media;
  const upload = deps.uploadOnce ?? uploadOnce;
  const has = deps.exists ?? exists;

  if (!meta.number) {
    throw new Error('A mix number is required');
  }
  const title = meta.title ?? `OK Sessions #${meta.number}`;
  const slug = meta.slug ?? slugify(title);
  const theme = resolveTheme(meta, themes);

  log(`▶ ${title} (${slug})`);
  const sourceHash = await m.sha256File(file);
  const version = m.sha256(`${sourceHash}:${ENCODING_VERSION}`).slice(0, 12);
  const keys = {
    m4a: `mixes/${slug}/audio-${version}.m4a`,
    mp3: `mixes/${slug}/audio-${version}.mp3`,
    peaks: `mixes/${slug}/peaks-${version}.json`
  };
  const durationMs = await m.probeDurationMs(file);

  let artwork: UploadItem | null = null;
  if (meta.artwork) {
    const ext = path.extname(meta.artwork).toLowerCase();
    const contentType = artworkTypes[ext];
    if (!contentType) {
      throw new Error(`Unsupported artwork type ${ext}`);
    }
    const body = await readFile(meta.artwork);
    artwork = { bucket, key: `mixes/${slug}/artwork-${m.sha256(body).slice(0, 12)}${ext}`, body, contentType };
  }

  const input: MixInput = {
    number: meta.number,
    title,
    description: meta.description ?? '',
    genre: meta.genre ?? null,
    recorded_at: meta.recorded_at ?? null,
    published_at: meta.published_at ?? null,
    duration_ms: durationMs,
    audio_m4a_key: keys.m4a,
    audio_mp3_key: keys.mp3,
    peaks_key: keys.peaks,
    artwork_key: artwork?.key ?? null,
    theme,
    soundcloud_url: meta.soundcloud_url ?? null,
    status: draft ? 'draft' : 'published',
    access: meta.access ?? 'free'
  };

  if (dryRun) {
    log('  dry run, nothing uploaded:');
    log(JSON.stringify({ slug, ...input }, null, 2));
    return { slug, input, uploaded: [] };
  }
  if (!client || !api) {
    throw new Error('Storage and API clients are required unless --dry-run is set');
  }

  const uploaded: string[] = [];
  const uploadItem = async (item: UploadItem) => {
    if ((await upload(client, item)).uploaded) {
      uploaded.push(item.key);
    }
  };

  const present = await Promise.all(Object.values(keys).map(key => has(client, bucket, key)));
  if (present.every(Boolean)) {
    log('  audio already uploaded, skipping encode');
  } else {
    const workDir = await mkdtemp(path.join(tmpdir(), `publish-${slug}-`));
    try {
      log('  encoding AAC + MP3…');
      const { m4a, mp3 } = await m.transcode(file, workDir);
      log('  generating waveform peaks…');
      const peaks = await m.generatePeaks(file, durationMs);

      log('  uploading…');
      await uploadItem({ bucket, key: keys.m4a, body: m4a, contentType: 'audio/mp4', filename: `${slug}.m4a` });
      // The MP3 is the download rendition
      await uploadItem({
        bucket,
        key: keys.mp3,
        body: mp3,
        contentType: 'audio/mpeg',
        filename: `${slug}.mp3`,
        disposition: 'attachment'
      });
      await uploadItem({ bucket, key: keys.peaks, body: Buffer.from(JSON.stringify(peaks)), contentType: 'application/json' });
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  if (artwork) {
    await uploadItem(artwork);
  }

  const mix = await api.putMix(slug, input);
  log(`  ✓ ${draft ? 'saved as draft' : 'published'}: ${mix.share_url}`);
  return { slug, input, uploaded, mix };
};
