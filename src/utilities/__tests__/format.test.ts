import { describe, expect, it } from 'vitest';
import { linkify, prettyTime } from '../format';

describe('prettyTime', () => {
  it.each([
    [0, '0:00:00'],
    [59.9, '0:00:59'],
    [3725, '1:02:05'],
    [-1, '0:00:00'],
    [Number.NaN, '0:00:00']
  ])('formats %s as %s', (seconds, expected) => {
    expect(prettyTime(seconds)).toBe(expected);
  });
});

describe('linkify', () => {
  it('links URLs and @mentions without HTML', () => {
    expect(linkify('Tracklist: https://dj.olliekav.com/x. Thanks @olliekav!')).toEqual([
      'Tracklist: ',
      { href: 'https://dj.olliekav.com/x', text: 'https://dj.olliekav.com/x' },
      '. Thanks ',
      { href: 'https://soundcloud.com/olliekav', text: '@olliekav' },
      '!'
    ]);
  });

  it('leaves markup and email addresses as text', () => {
    expect(linkify('<img src=x onerror=alert(1)> me@example.com')).toEqual(['<img src=x onerror=alert(1)> me@example.com']);
  });

  it('handles empty text', () => {
    expect(linkify('')).toEqual([]);
  });
});
