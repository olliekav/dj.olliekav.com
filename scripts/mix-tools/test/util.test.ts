import { describe, expect, it } from 'vitest';
import { downloadTags, parseNumbers, toIsoDate } from '../util.ts';

describe('parseNumbers', () => {
  it('parses lists and ranges', () => {
    expect([...parseNumbers('1, 3,5-7')]).toEqual([1, 3, 5, 6, 7]);
  });

  it.each(['a', '5-3', '1-'])('rejects %s', value => {
    expect(() => parseNumbers(value)).toThrow();
  });
});

describe('toIsoDate', () => {
  it.each([
    ['2019/03/10 12:00:00 +0000', '2019-03-10T12:00:00.000Z'],
    ['2019/03/10 12:00:00 +0100', '2019-03-10T11:00:00.000Z'],
    [null, null],
    ['not a date', null]
  ])('converts %s', (input, expected) => {
    expect(toIsoDate(input)).toBe(expected);
  });
});

describe('downloadTags', () => {
  it('tags title, album, track, artist, genre and year', () => {
    expect(downloadTags({ title: 'OK Sessions #7', number: 7, genre: 'House', published_at: '2019-03-10T12:00:00.000Z' }, 'O:K')).toEqual({
      title: 'OK Sessions #7',
      album: 'OK Sessions',
      track: '7',
      artist: 'O:K',
      album_artist: 'O:K',
      genre: 'House',
      date: '2019'
    });
  });

  it('omits unknown fields', () => {
    expect(downloadTags({ title: 'T', number: 1, genre: null, published_at: null })).toEqual({ title: 'T', album: 'OK Sessions', track: '1' });
  });
});
