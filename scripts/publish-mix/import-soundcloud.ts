import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { publishMix, type MixMeta, type PublishDeps } from './publish.ts';
import type { SoundCloudClient, SoundCloudTrack } from './soundcloud.ts';

export interface ImportOptions {
  playlistUrl?: string;
  /** Mix numbers to import; all when omitted */
  only?: Set<number>;
  draft?: boolean;
  dryRun?: boolean;
  /** Re-import mixes that were already imported from the same track */
  force?: boolean;
}

export interface ImportDeps extends PublishDeps {
  soundcloud: SoundCloudClient;
  publish?: typeof publishMix;
}

export interface ImportSummary {
  published: number[];
  skipped: number[];
  failed: { number: number; title: string; reason: string }[];
}

/** Parses "1,3,5-8" into mix numbers. */
export const parseNumbers = (value: string): Set<number> => {
  const numbers = new Set<number>();
  for (const part of value.split(',').map(p => p.trim()).filter(Boolean)) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!match) {
      throw new Error(`Invalid mix number or range "${part}"`);
    }
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (end < start) {
      throw new Error(`Invalid range "${part}"`);
    }
    for (let n = start; n <= end; n++) numbers.add(n);
  }
  return numbers;
};

/** SoundCloud dates look like "2019/03/10 12:00:00 +0000". */
export const toIsoDate = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const normalised = value.replace(/^(\d{4})\/(\d{2})\/(\d{2}) /, '$1-$2-$3T').replace(/ ([+-]\d{2})(\d{2})$/, '$1:$2');
  const date = new Date(normalised);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

// Mixes are numbered by their position in the playlist, as on the website
export const toMeta = (track: SoundCloudTrack, number: number): MixMeta => ({
  number,
  slug: `ok-sessions-${number}`,
  title: track.title,
  description: track.description ?? '',
  genre: track.genre || null,
  published_at: toIsoDate(track.created_at),
  soundcloud_url: track.permalink_url
});

/**
 * Downloads each playlist track's original upload and publishes it.
 * Safe to re-run: mixes already imported from the same track are skipped.
 */
export const importFromSoundCloud = async (options: ImportOptions, deps: ImportDeps): Promise<ImportSummary> => {
  const { soundcloud, api, log = console.log } = deps;
  const publish = deps.publish ?? publishMix;
  const summary: ImportSummary = { published: [], skipped: [], failed: [] };

  const tracks = await soundcloud.playlistTracks(options.playlistUrl);
  log(`Found ${tracks.length} tracks in the playlist`);

  const existing = new Map(
    options.dryRun || options.force || !api ? [] : (await api.listMixes()).map(mix => [mix.number, mix])
  );

  const workDir = await mkdtemp(path.join(tmpdir(), 'soundcloud-import-'));
  try {
    for (const [index, track] of tracks.entries()) {
      const number = index + 1;
      if (options.only && !options.only.has(number)) {
        continue;
      }
      const meta = toMeta(track, number);
      const label = `#${number} ${track.title}`;

      if (!track.downloadable) {
        log(`✗ ${label}: downloads are disabled on SoundCloud`);
        summary.failed.push({ number, title: track.title, reason: 'downloads disabled' });
        continue;
      }

      const current = existing.get(number);
      if (current && current.soundcloud_url === track.permalink_url && current.status === (options.draft ? 'draft' : 'published')) {
        log(`↷ ${label}: already imported`);
        summary.skipped.push(number);
        continue;
      }

      if (options.dryRun) {
        log(`• ${label} → ${meta.slug}`);
        continue;
      }

      const file = path.join(workDir, `${meta.slug}.mp3`);
      try {
        log(`⇣ ${label}: downloading original…`);
        await soundcloud.downloadOriginal(track, file);
        await publish({ file, meta, draft: options.draft }, deps);
        summary.published.push(number);
      } catch (error) {
        const reason = (error as Error).message;
        log(`✗ ${label}: ${reason}`);
        summary.failed.push({ number, title: track.title, reason });
      } finally {
        await rm(file, { force: true });
      }
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }

  log(
    `\nDone: ${summary.published.length} published, ${summary.skipped.length} skipped, ${summary.failed.length} failed`
  );
  for (const failure of summary.failed) {
    log(`  #${failure.number} ${failure.title}: ${failure.reason}`);
  }
  return summary;
};
