import { describe, expect, it } from 'vitest';
import type { Mix } from '../../../shared/api-types';
import fixture from '../../../shared/fixtures/mixes.json';
import {
  headFor,
  homeHead,
  isoDuration,
  mixDescription,
  mixHead,
  mixJsonLd,
  mixPath,
  mixSlug,
  mixTitle,
  notFoundHead,
  playlistJsonLd,
  scriptJson,
  SITE_URL,
  summary
} from '../seo';

const mixes = fixture.mixes as Mix[];
const content = (head: ReturnType<typeof homeHead>, name: string) =>
  [...head.elements].find(el => el.props.property === name || el.props.name === name)?.props.content;

describe('homeHead', () => {
  it('describes the site for search engines and link previews', () => {
    const head = homeHead(mixes);
    expect(head.title).toContain('OK Sessions');
    expect([...head.elements]).toContainEqual({ type: 'link', props: { rel: 'canonical', href: `${SITE_URL}/` } });
    expect(content(head, 'og:url')).toBe(`${SITE_URL}/`);
    expect(content(head, 'twitter:card')).toBe('summary');
  });

  it("shares the newest mix's artwork, or the icon without one", () => {
    expect(content(homeHead(mixes), 'og:image')).toBe(mixes[0]!.artwork_original_url);
    expect(content(homeHead(mixes.slice(1)), 'og:image')).toBe(`${SITE_URL}/assets/icons/icon-512.png`);
    expect(content(homeHead([]), 'og:image')).toBe(`${SITE_URL}/assets/icons/icon-512.png`);
  });
});

describe('notFoundHead', () => {
  it('keeps the 404 page out of search results', () => {
    expect([...notFoundHead().elements]).toContainEqual({ type: 'meta', props: { name: 'robots', content: 'noindex' } });
  });
});

describe('isoDuration', () => {
  it('formats milliseconds as an ISO 8601 duration', () => {
    expect(isoDuration(3_725_000)).toBe('PT1H2M5S');
    expect(isoDuration(3_600_000)).toBe('PT1H');
    expect(isoDuration(90_400)).toBe('PT1M30S');
    expect(isoDuration(0)).toBe('PT0S');
  });
});

describe('playlistJsonLd', () => {
  it('lists every mix as a recording, leaving out missing details', () => {
    const ld = playlistJsonLd(mixes);
    expect(ld).toMatchObject({ '@type': 'MusicPlaylist', numTracks: 2 });
    expect(ld.track[0]).toMatchObject({
      '@type': 'MusicRecording',
      name: 'OK Sessions #1',
      url: `${SITE_URL}/mixes/ok-sessions-1/`,
      sameAs: ['https://soundcloud.com/olliekav/ok-sessions-1'],
      duration: 'PT1H',
      genre: 'House',
      datePublished: '2019-03-10'
    });
    expect(ld.track[1]).not.toHaveProperty('genre');
    expect(ld.track[1]).not.toHaveProperty('image');
  });
});

describe('mix pages', () => {
  it('maps mixes to paths and back', () => {
    expect(mixPath(mixes[0]!)).toBe('/mixes/ok-sessions-1/');
    expect(mixSlug('/mixes/ok-sessions-1/')).toBe('ok-sessions-1');
    expect(mixSlug('/mixes/ok-sessions-1')).toBe('ok-sessions-1');
    expect(mixSlug('/mixes/')).toBeUndefined();
    expect(mixSlug('/mixes/a/b')).toBeUndefined();
    expect(mixSlug('/mixes/%E0%A4%A')).toBeUndefined();
    expect(mixSlug('/')).toBeUndefined();
  });

  it('titles a mix with its number and genre', () => {
    expect(mixTitle(mixes[0]!)).toBe('OK Sessions #1 · House DJ mix by Ollie Kav');
    expect(mixTitle(mixes[1]!)).toBe('OK Sessions #2 · DJ mix by Ollie Kav');
  });
});

describe('summary', () => {
  it('collapses whitespace and cuts long text at a word', () => {
    expect(summary('  a\n\n b  ')).toBe('a b');
    const long = summary('word '.repeat(50));
    expect(long.length).toBeLessThanOrEqual(160);
    expect(long).toMatch(/word…$/);
  });
});

describe('mixDescription', () => {
  it('says what the mix is, then its description on one line', () => {
    const tracklist = { ...mixes[0]!, description: 'Artist - One\nArtist - Two\n\nRecorded live.' };
    expect(mixDescription(tracklist)).toBe(
      'OK Sessions #1: House DJ mix by Ollie Kav. Artist - One, Artist - Two, Recorded live.'
    );
    expect(mixDescription(mixes[1]!)).toBe('OK Sessions #2: DJ mix by Ollie Kav.');
  });
});

describe('mixHead', () => {
  it("describes the mix's page with its artwork", () => {
    const head = mixHead(mixes[0]!);
    expect(head.title).toBe('OK Sessions #1 · House DJ mix by Ollie Kav');
    expect([...head.elements]).toContainEqual({
      type: 'link',
      props: { rel: 'canonical', href: `${SITE_URL}/mixes/ok-sessions-1/` }
    });
    expect(content(head, 'og:type')).toBe('music.song');
    expect(content(head, 'og:image')).toBe(mixes[0]!.artwork_original_url);
    expect(content(head, 'description')).toContain('House and disco.');
    expect(content(head, 'music:release_date')).toBe('2019-03-10');
  });

  it('falls back to the icon without artwork', () => {
    expect(content(mixHead(mixes[1]!), 'og:image')).toBe(`${SITE_URL}/assets/icons/icon-512.png`);
    expect(content(mixHead(mixes[1]!), 'music:release_date')).toBe('2019-04-01');
  });
});

describe('mixJsonLd', () => {
  it('describes the mix as a recording in the playlist', () => {
    expect(mixJsonLd(mixes[0]!)).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'MusicRecording',
      url: `${SITE_URL}/mixes/ok-sessions-1/`,
      description: 'House and disco.\nTracklist: https://dj.olliekav.com',
      image: mixes[0]!.artwork_original_url,
      inPlaylist: { '@type': 'MusicPlaylist', url: `${SITE_URL}/` }
    });
    expect(mixJsonLd(mixes[1]!)).not.toHaveProperty('description');
  });
});

describe('headFor', () => {
  it('picks the head for each prerendered path', () => {
    expect(headFor('/', mixes).title).toBe(homeHead(mixes).title);
    expect(headFor('/mixes/ok-sessions-2', mixes).title).toBe(mixTitle(mixes[1]!));
    expect(headFor('/mixes/nope', mixes)).toEqual(notFoundHead());
    expect(headFor('/404', mixes)).toEqual(notFoundHead());
  });
});

describe('scriptJson', () => {
  it("can't close the script it's inlined in", () => {
    const json = scriptJson({ title: '</script><script>alert(1)</script>' });
    expect(json).not.toContain('<');
    expect(JSON.parse(json)).toEqual({ title: '</script><script>alert(1)</script>' });
  });
});
