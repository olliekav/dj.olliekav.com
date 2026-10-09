import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Theme } from '../../shared/api-types.ts';
import type { AdminMix, Api, MixInput } from './api.ts';
import { artworkSvg, renderArtworkJpg, type ArtworkFont } from './artwork.ts';
import * as media from './media.ts';
import { exists, uploadOnce, type StorageClient, type UploadItem } from './storage.ts';

// Bump when encoding settings change so new renditions get new keys
export const ENCODING_VERSION = 2;

export const ALBUM = 'OK Sessions';

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
  media?: Pick<typeof media, 'sha256File' | 'sha256' | 'probeAudio' | 'encodeStream' | 'encodeDownload' | 'generatePeaks'>;
  uploadOnce?: typeof uploadOnce;
  exists?: typeof exists;
  /** FF DIN Round Pro Black, for generating artwork from the mix theme */
  artworkFont?: ArtworkFont;
  renderArtwork?: (font: ArtworkFont, theme: Theme, number: number) => Promise<Buffer>;
  /** Artist tag for the MP3 download */
  artist?: string;
}

export const ARTWORK_SIZE = 2000;

const defaultRenderArtwork = (font: ArtworkFont, theme: Theme, number: number) =>
  renderArtworkJpg(artworkSvg(font, theme, number), ARTWORK_SIZE);

/** ID3 tags for the download MP3. */
export const downloadTags = (input: Pick<MixInput, 'title' | 'number' | 'genre' | 'published_at'>, artist?: string) => {
  const tags: Record<string, string> = { title: input.title, album: ALBUM, track: String(input.number) };
  if (artist) {
    tags.artist = artist;
    tags.album_artist = artist;
  }
  if (input.genre) tags.genre = input.genre;
  if (input.published_at) tags.date = input.published_at.slice(0, 4);
  return tags;
};

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
  const { durationMs, codec } = await m.probeAudio(file);

  // Artwork: an explicit file, or generated from the theme when the font is available
  let artwork: UploadItem | null = null;
  if (meta.artwork) {
    const ext = path.extname(meta.artwork).toLowerCase();
    const contentType = artworkTypes[ext];
    if (!contentType) {
      throw new Error(`Unsupported artwork type ${ext}`);
    }
    const body = await readFile(meta.artwork);
    artwork = { bucket, key: `mixes/${slug}/artwork-${m.sha256(body).slice(0, 12)}${ext}`, body, contentType };
  } else if (deps.artworkFont) {
    const body = await (deps.renderArtwork ?? defaultRenderArtwork)(deps.artworkFont, theme, meta.number);
    artwork = { bucket, key: `mixes/${slug}/artwork-${m.sha256(body).slice(0, 12)}.jpg`, body, contentType: 'image/jpeg' };
  }

  const published_at = meta.published_at ?? null;
  const tags = downloadTags({ title, number: meta.number, genre: meta.genre ?? null, published_at }, deps.artist);

  // The stream depends only on the source; the download also carries the cover and tags
  const streamVersion = m.sha256(`${sourceHash}:${ENCODING_VERSION}`).slice(0, 12);
  const downloadVersion = m.sha256(
    `${sourceHash}:${ENCODING_VERSION}:${artwork?.key ?? ''}:${JSON.stringify(tags)}`
  ).slice(0, 12);
  const keys = {
    m4a: `mixes/${slug}/audio-${streamVersion}.m4a`,
    peaks: `mixes/${slug}/peaks-${streamVersion}.json`,
    mp3: `mixes/${slug}/audio-${downloadVersion}.mp3`
  };

  const input: MixInput = {
    number: meta.number,
    title,
    description: meta.description ?? '',
    genre: meta.genre ?? null,
    recorded_at: meta.recorded_at ?? null,
    published_at,
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

  const [hasM4a, hasPeaks, hasMp3] = await Promise.all(
    [keys.m4a, keys.peaks, keys.mp3].map(key => has(client, bucket, key))
  );

  const workDir = await mkdtemp(path.join(tmpdir(), `publish-${slug}-`));
  try {
    if (artwork) {
      await uploadItem(artwork);
    }

    if (hasM4a && hasPeaks) {
      log('  stream already uploaded');
    } else {
      log('  encoding AAC stream…');
      const m4a = await m.encodeStream(file, path.join(workDir, 'audio.m4a'));
      log('  generating waveform peaks…');
      const peaks = await m.generatePeaks(file, durationMs);
      await uploadItem({ bucket, key: keys.m4a, body: m4a, contentType: 'audio/mp4', filename: `${slug}.m4a` });
      await uploadItem({ bucket, key: keys.peaks, body: Buffer.from(JSON.stringify(peaks)), contentType: 'application/json' });
    }

    if (hasMp3) {
      log('  download already uploaded');
    } else {
      log(codec === 'mp3' ? '  tagging MP3 download (audio copied)…' : '  encoding MP3 download…');
      let cover: string | undefined;
      if (artwork?.contentType === 'image/jpeg' && Buffer.isBuffer(artwork.body)) {
        cover = path.join(workDir, 'cover.jpg');
        await writeFile(cover, artwork.body);
      }
      const mp3 = await m.encodeDownload(file, path.join(workDir, 'audio.mp3'), { sourceCodec: codec, cover, tags });
      await uploadItem({
        bucket,
        key: keys.mp3,
        body: mp3,
        contentType: 'audio/mpeg',
        filename: `${slug}.mp3`,
        disposition: 'attachment'
      });
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }

  const mix = await api.putMix(slug, input);
  log(`  ✓ ${draft ? 'saved as draft' : 'published'}: ${mix.share_url}`);
  return { slug, input, uploaded, mix };
};
