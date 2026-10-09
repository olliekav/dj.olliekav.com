-- Catalogue of mixes. Media keys are R2 object keys, resolved to URLs by the API.
CREATE TABLE mixes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  number INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  genre TEXT,
  recorded_at TEXT,
  published_at TEXT,
  duration_ms INTEGER NOT NULL,
  audio_m4a_key TEXT NOT NULL,
  audio_mp3_key TEXT,
  peaks_key TEXT,
  artwork_key TEXT,
  theme_json TEXT NOT NULL,
  soundcloud_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  access TEXT NOT NULL DEFAULT 'free' CHECK (access IN ('free', 'paid')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX mixes_status_number ON mixes (status, number);

-- One row per (device, mix, kind, time bucket); used only to de-duplicate events.
CREATE TABLE events (
  device_id TEXT NOT NULL,
  mix_id INTEGER NOT NULL REFERENCES mixes (id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (device_id, mix_id, kind, bucket)
) WITHOUT ROWID;

CREATE INDEX events_created_at ON events (created_at);

-- Daily aggregates that the stats endpoint reads.
CREATE TABLE stats_daily (
  mix_id INTEGER NOT NULL REFERENCES mixes (id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  platform TEXT NOT NULL,
  plays INTEGER NOT NULL DEFAULT 0,
  completions INTEGER NOT NULL DEFAULT 0,
  downloads INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (mix_id, day, platform)
) WITHOUT ROWID;
