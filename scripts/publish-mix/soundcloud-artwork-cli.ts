#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { artworkSvg, loadArtworkFont, renderArtworkJpg } from './artwork.ts';
import { parseNumbers, toIsoDate } from './import-soundcloud.ts';
import { encodeDownload, probeAudio } from './media.ts';
import { downloadTags } from './publish.ts';
import { REDIRECT_URI, signIn } from './soundcloud-auth.ts';
import { createSoundCloud, PLAYLIST_URL, type SoundCloudClient } from './soundcloud.ts';
import type { Themes } from './themes.ts';

const usage = `Usage:
  npm run soundcloud-artwork -- [--only 21-50] [--dry-run] [--size 2000]
  npm run soundcloud-artwork -- --mp3s [--only 21-50] [--out <dir>]

Default: replaces the artwork on each OK Sessions track on SoundCloud with the generated
one (numbered by playlist position). Needs SoundCloud Pro, and ${REDIRECT_URI}
added as a redirect URI on your SoundCloud app.

--mp3s: downloads each original instead and saves it re-tagged with the new artwork
(audio untouched), for "Replace file" on SoundCloud. Needs downloads enabled.

Env: SOUNDCLOUD_CLIENT_ID, SOUNDCLOUD_CLIENT_SECRET, ARTWORK_FONT, ARTIST.`;

/** The mix number in a title like "OK Sessions #12", if any. */
export const titleNumber = (title: string) => {
  const match = /#\s*(\d+)/.exec(title);
  return match ? Number(match[1]) : null;
};

export const main = async (
  argv: string[],
  {
    env = process.env as Record<string, string | undefined>,
    log = console.log,
    loadFont = loadArtworkFont,
    readThemes = async () => readFile(new URL('../../shared/mix-themes.json', import.meta.url), 'utf8'),
    soundcloud,
    authenticate = signIn,
    render = renderArtworkJpg,
    retag = encodeDownload,
    probe = probeAudio
  }: {
    env?: Record<string, string | undefined>;
    log?: (message: string) => void;
    loadFont?: typeof loadArtworkFont;
    readThemes?: () => Promise<string>;
    soundcloud?: SoundCloudClient;
    authenticate?: typeof signIn;
    render?: typeof renderArtworkJpg;
    retag?: typeof encodeDownload;
    probe?: typeof probeAudio;
  } = {}
): Promise<number> => {
  const { values } = parseArgs({
    args: argv,
    options: {
      only: { type: 'string' },
      size: { type: 'string', default: '2000' },
      mp3s: { type: 'boolean', default: false },
      out: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false }
    }
  });
  if (values.help) {
    log(usage);
    return 0;
  }
  const required = (name: string) => {
    const value = env[name];
    if (!value) throw new Error(`Missing ${name} (see --help)`);
    return value;
  };
  const clientId = required('SOUNDCLOUD_CLIENT_ID');
  const clientSecret = required('SOUNDCLOUD_CLIENT_SECRET');
  const font = await loadFont(required('ARTWORK_FONT'));
  const themes: Themes = JSON.parse(await readThemes());
  const only = values.only ? parseNumbers(values.only) : undefined;
  const size = Number.parseInt(values.size, 10);

  const sc = soundcloud ?? createSoundCloud({ clientId, clientSecret });
  const tracks = await sc.playlistTracks(PLAYLIST_URL);
  log(`Found ${tracks.length} tracks in the playlist`);

  // Check numbering before touching anything: the artwork number must match the track
  const plan = tracks
    .map((track, i) => ({ track, number: i + 1 }))
    .filter(({ number }) => !only || only.has(number));
  const problems = plan.flatMap(({ track, number }) => {
    const titled = titleNumber(track.title);
    if (titled !== null && titled !== number) return [`"${track.title}" is at position ${number}`];
    if (!themes[number]) return [`no theme for #${number}`];
    return [];
  });
  if (problems.length) {
    throw new Error(`Not updating anything:\n  ${problems.join('\n  ')}`);
  }

  if (values['dry-run']) {
    for (const { track, number } of plan) log(`• #${number} ${track.title}`);
    log(`Would update ${plan.length} artworks`);
    return 0;
  }

  if (values.mp3s) {
    return exportMp3s({ plan, sc, font, themes, size, out: values.out, artist: env.ARTIST, log, render, retag, probe });
  }

  const token = await authenticate({ clientId, clientSecret, log });
  const failed: string[] = [];
  for (const { track, number } of plan) {
    try {
      const jpeg = await render(artworkSvg(font, themes[number]!, number), size);
      await sc.updateArtwork(track.urn, jpeg, token);
      log(`✓ #${number} ${track.title}`);
    } catch (error) {
      log(`✗ #${number} ${track.title}: ${(error as Error).message}`);
      failed.push(`#${number}`);
    }
  }
  log(`\nUpdated ${plan.length - failed.length} of ${plan.length}${failed.length ? `; failed: ${failed.join(', ')}` : ''}`);
  return failed.length ? 1 : 0;
};

/** Downloads each original and saves it with the new cover and tags; the audio is copied untouched. */
const exportMp3s = async ({
  plan,
  sc,
  font,
  themes,
  size,
  out = path.join(os.homedir(), 'Desktop', 'ok-sessions-mp3'),
  artist,
  log,
  render,
  retag,
  probe
}: {
  plan: { track: SoundCloudTrackRef; number: number }[];
  sc: SoundCloudClient;
  font: Awaited<ReturnType<typeof loadArtworkFont>>;
  themes: Themes;
  size: number;
  out?: string;
  artist?: string;
  log: (message: string) => void;
  render: typeof renderArtworkJpg;
  retag: typeof encodeDownload;
  probe: typeof probeAudio;
}) => {
  await mkdir(out, { recursive: true });
  const work = await mkdtemp(path.join(os.tmpdir(), 'soundcloud-mp3s-'));
  const failed: string[] = [];
  try {
    for (const { track, number } of plan) {
      const source = path.join(work, `source-${number}`);
      const cover = path.join(work, `cover-${number}.jpg`);
      try {
        if (!track.downloadable) throw new Error('downloads are disabled on SoundCloud');
        await sc.downloadOriginal(track, source);
        const { codec } = await probe(source);
        await writeFile(cover, await render(artworkSvg(font, themes[number]!, number), size));
        const tags = downloadTags(
          { title: track.title, number, genre: track.genre || null, published_at: toIsoDate(track.created_at) },
          artist
        );
        const dest = path.join(out, `ok-sessions-${number}.mp3`);
        await retag(source, dest, { sourceCodec: codec, cover, tags });
        log(`✓ #${number} ${track.title}${codec === 'mp3' ? '' : ' (encoded to 320k MP3; the original was not an MP3)'}`);
      } catch (error) {
        log(`✗ #${number} ${track.title}: ${(error as Error).message}`);
        failed.push(`#${number}`);
      } finally {
        await rm(source, { force: true });
        await rm(cover, { force: true });
      }
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  log(`\nSaved ${plan.length - failed.length} of ${plan.length} to ${out}${failed.length ? `; failed: ${failed.join(', ')}` : ''}`);
  return failed.length ? 1 : 0;
};

type SoundCloudTrackRef = Awaited<ReturnType<SoundCloudClient['playlistTracks']>>[number];

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).then(
    code => process.exit(code),
    (error: Error) => {
      console.error(`✗ ${error.message}`);
      process.exit(1);
    }
  );
}
