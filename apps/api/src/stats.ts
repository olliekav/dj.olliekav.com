import type { Platform } from '../../../shared/api-types';

export type { Platform };

export type EventKind = 'play' | 'completion' | 'download';

const MINUTE = 60_000;

// A device can count once per mix and kind within this window
export const dedupeWindowMs: Record<EventKind, number> = {
  play: 30 * MINUTE,
  completion: 30 * MINUTE,
  download: 24 * 60 * MINUTE
};

const column: Record<EventKind, 'plays' | 'completions' | 'downloads'> = {
  play: 'plays',
  completion: 'completions',
  download: 'downloads'
};

export interface RecordEventInput {
  mixId: number;
  deviceId: string;
  platform: Platform;
  kind: EventKind;
  now?: Date;
}

/** Records an event, returning false when it was a duplicate within the window. */
export const recordEvent = async (db: D1Database, input: RecordEventInput): Promise<boolean> => {
  const now = input.now ?? new Date();
  const bucket = Math.floor(now.getTime() / dedupeWindowMs[input.kind]);
  const day = now.toISOString().slice(0, 10);

  const inserted = await db
    .prepare(
      'INSERT OR IGNORE INTO events (device_id, mix_id, kind, bucket, created_at) VALUES (?, ?, ?, ?, ?) RETURNING 1'
    )
    .bind(input.deviceId, input.mixId, input.kind, bucket, now.toISOString())
    .first();

  if (!inserted) {
    return false;
  }

  const col = column[input.kind];
  await db
    .prepare(
      `INSERT INTO stats_daily (mix_id, day, platform, ${col}) VALUES (?, ?, ?, 1)
       ON CONFLICT (mix_id, day, platform) DO UPDATE SET ${col} = ${col} + 1`
    )
    .bind(input.mixId, day, input.platform)
    .run();

  return true;
};

export interface StatsQuery {
  from?: string;
  to?: string;
}

export interface MixStats {
  slug: string;
  number: number;
  title: string;
  plays: number;
  completions: number;
  downloads: number;
  by_platform: Record<string, { plays: number; completions: number; downloads: number }>;
}

export const getStats = async (db: D1Database, { from, to }: StatsQuery = {}) => {
  const { results } = await db
    .prepare(
      `SELECT m.slug, m.number, m.title, s.platform,
              SUM(s.plays) AS plays, SUM(s.completions) AS completions, SUM(s.downloads) AS downloads
       FROM stats_daily s JOIN mixes m ON m.id = s.mix_id
       WHERE (?1 IS NULL OR s.day >= ?1) AND (?2 IS NULL OR s.day <= ?2)
       GROUP BY m.id, s.platform
       ORDER BY m.number DESC, s.platform`
    )
    .bind(from ?? null, to ?? null)
    .all<{
      slug: string;
      number: number;
      title: string;
      platform: string;
      plays: number;
      completions: number;
      downloads: number;
    }>();

  const bySlug = new Map<string, MixStats>();
  for (const row of results) {
    const mix =
      bySlug.get(row.slug) ??
      bySlug
        .set(row.slug, {
          slug: row.slug,
          number: row.number,
          title: row.title,
          plays: 0,
          completions: 0,
          downloads: 0,
          by_platform: {}
        })
        .get(row.slug)!;
    mix.plays += row.plays;
    mix.completions += row.completions;
    mix.downloads += row.downloads;
    mix.by_platform[row.platform] = {
      plays: row.plays,
      completions: row.completions,
      downloads: row.downloads
    };
  }

  return [...bySlug.values()];
};

/** Removes de-duplication rows that can no longer affect any window. */
export const pruneEvents = async (db: D1Database, now = new Date()) => {
  const cutoff = new Date(now.getTime() - 2 * dedupeWindowMs.download).toISOString();
  const { results } = await db
    .prepare('DELETE FROM events WHERE created_at < ? RETURNING 1')
    .bind(cutoff)
    .all();
  return results.length;
};
