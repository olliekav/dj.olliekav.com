import type { Env } from './env';
import type { Mix, Theme } from '../../../shared/api-types';
import type { MixInput } from './schemas';

export type { Mix };

export interface MixRow {
  id: number;
  slug: string;
  number: number;
  title: string;
  description: string;
  genre: string | null;
  recorded_at: string | null;
  published_at: string | null;
  duration_ms: number;
  audio_m4a_key: string;
  audio_mp3_key: string | null;
  peaks_key: string | null;
  artwork_key: string | null;
  theme_json: string;
  soundcloud_url: string | null;
  status: 'draft' | 'published';
  access: 'free' | 'paid';
  created_at: string;
  updated_at: string;
}

const mediaUrl = (env: Env, key: string | null): string | null =>
  key ? `${env.MEDIA_BASE_URL.replace(/\/$/, '')}/${key}` : null;

export const toMix = (env: Env, row: MixRow): Mix => ({
  id: row.id,
  slug: row.slug,
  number: row.number,
  title: row.title,
  description: row.description,
  genre: row.genre,
  recorded_at: row.recorded_at,
  published_at: row.published_at,
  duration_ms: row.duration_ms,
  audio: {
    m4a: mediaUrl(env, row.audio_m4a_key)!,
    mp3: mediaUrl(env, row.audio_mp3_key)
  },
  peaks_url: mediaUrl(env, row.peaks_key),
  artwork_url: mediaUrl(env, row.artwork_key),
  theme: JSON.parse(row.theme_json) as Theme,
  soundcloud_url: row.soundcloud_url,
  share_url: `${env.SITE_URL.replace(/\/$/, '')}/mixes/${row.slug}`,
  access: row.access,
  updated_at: row.updated_at
});

export const listMixes = async (db: D1Database, { includeDrafts = false } = {}) => {
  const where = includeDrafts ? '' : "WHERE status = 'published'";
  const { results } = await db
    .prepare(`SELECT * FROM mixes ${where} ORDER BY number DESC`)
    .all<MixRow>();
  return results;
};

export const findMix = (db: D1Database, slug: string, { includeDrafts = false } = {}) => {
  const status = includeDrafts ? '' : "AND status = 'published'";
  return db.prepare(`SELECT * FROM mixes WHERE slug = ? ${status}`).bind(slug).first<MixRow>();
};

export const upsertMix = async (db: D1Database, slug: string, input: MixInput) => {
  const publishedAt =
    input.published_at ?? (input.status === 'published' ? new Date().toISOString() : null);

  return db
    .prepare(
      `INSERT INTO mixes (
        slug, number, title, description, genre, recorded_at, published_at, duration_ms,
        audio_m4a_key, audio_mp3_key, peaks_key, artwork_key, theme_json, soundcloud_url, status, access
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
      ON CONFLICT (slug) DO UPDATE SET
        number = excluded.number,
        title = excluded.title,
        description = excluded.description,
        genre = excluded.genre,
        recorded_at = excluded.recorded_at,
        published_at = COALESCE(mixes.published_at, excluded.published_at),
        duration_ms = excluded.duration_ms,
        audio_m4a_key = excluded.audio_m4a_key,
        audio_mp3_key = excluded.audio_mp3_key,
        peaks_key = excluded.peaks_key,
        artwork_key = excluded.artwork_key,
        theme_json = excluded.theme_json,
        soundcloud_url = excluded.soundcloud_url,
        status = excluded.status,
        access = excluded.access,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      RETURNING *`
    )
    .bind(
      slug,
      input.number,
      input.title,
      input.description,
      input.genre ?? null,
      input.recorded_at ?? null,
      publishedAt,
      input.duration_ms,
      input.audio_m4a_key,
      input.audio_mp3_key ?? null,
      input.peaks_key ?? null,
      input.artwork_key ?? null,
      JSON.stringify(input.theme),
      input.soundcloud_url ?? null,
      input.status,
      input.access
    )
    .first<MixRow>();
};
