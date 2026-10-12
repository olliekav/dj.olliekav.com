import { describe, expect, it } from 'vitest';
import type { Mix } from '../../../shared/api-types';
import fixture from '../../../shared/fixtures/mixes.json';
import { homeHead, isoDuration, notFoundHead, playlistJsonLd, scriptJson, SITE_URL } from '../seo';

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
      url: 'https://soundcloud.com/olliekav/ok-sessions-1',
      duration: 'PT1H',
      genre: 'House',
      datePublished: '2019-03-10'
    });
    expect(ld.track[1]).not.toHaveProperty('genre');
    expect(ld.track[1]).not.toHaveProperty('image');
  });
});

describe('scriptJson', () => {
  it("can't close the script it's inlined in", () => {
    const json = scriptJson({ title: '</script><script>alert(1)</script>' });
    expect(json).not.toContain('<');
    expect(JSON.parse(json)).toEqual({ title: '</script><script>alert(1)</script>' });
  });
});
