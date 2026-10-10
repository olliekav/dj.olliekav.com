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

export const ALBUM = 'OK Sessions';

/** ID3 tags for a mix's MP3. */
export const downloadTags = (
  input: { title: string; number: number; genre: string | null; published_at: string | null },
  artist?: string
) => {
  const tags: Record<string, string> = { title: input.title, album: ALBUM, track: String(input.number) };
  if (artist) {
    tags.artist = artist;
    tags.album_artist = artist;
  }
  if (input.genre) tags.genre = input.genre;
  if (input.published_at) tags.date = input.published_at.slice(0, 4);
  return tags;
};
