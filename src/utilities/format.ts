const pad = (value: number) => String(value).padStart(2, '0');

/** Formats seconds as H:MM:SS. */
export const prettyTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00:00';
  }
  const total = Math.floor(seconds);
  return `${Math.floor(total / 3600)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
};

export type DescriptionPart = string | { href: string; text: string };

const LINKS = /(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]])|(?<![\w@])@([A-Za-z0-9_-]+)/g;

/** Splits a description into text and links (URLs, and @mentions to SoundCloud profiles). */
export const linkify = (text: string): DescriptionPart[] => {
  const parts: DescriptionPart[] = [];
  let last = 0;
  for (const match of text.matchAll(LINKS)) {
    const [whole, url, username] = match;
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    parts.push(url ? { href: url, text: url } : { href: `https://soundcloud.com/${username}`, text: whole });
    last = match.index + whole.length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return parts;
};
