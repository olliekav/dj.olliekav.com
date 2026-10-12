import { describe, expect, it } from 'vitest';
import type { Mix } from '../../../shared/api-types';
import fixture from '../../../shared/fixtures/mixes.json';
import { mediaMetadataFor } from '../media-session';

const [withArtwork, withoutArtwork] = fixture.mixes as Mix[];

describe('mediaMetadataFor', () => {
  it('uses the mix title and artwork', () => {
    expect(mediaMetadataFor(withArtwork!)).toEqual({
      title: withArtwork!.title,
      artist: 'O:K',
      album: 'OK Sessions',
      artwork: [{ src: withArtwork!.artwork_url, sizes: '500x500', type: 'image/jpeg' }]
    });
  });

  it('falls back to the app icon without artwork', () => {
    expect(mediaMetadataFor(withoutArtwork!).artwork).toEqual([
      { src: '/assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]);
  });
});
