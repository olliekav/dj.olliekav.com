import { existsSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import type { Theme } from '../../../shared/api-types.ts';
import { artworkSvg, loadArtworkFont, numberPath, renderArtworkJpg } from '../artwork.ts';
import { fakeFont } from './fake-font.ts';

const theme: Theme = { background: '#F2E793', foreground: '#2155E4', accent: '#2155E4', dark: false };

describe('numberPath', () => {
  it('outlines "#" and proportional figures left to right from the template origin', () => {
    const d = numberPath(fakeFont(), 12);
    const moves = [...d.matchAll(/M([\d.]+) ([\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]);
    // Three glyphs, each starting on the baseline, advancing 600 units at 140px + 2.8 tracking
    expect(moves).toEqual([
      [497, 558.5],
      [583.8, 558.5],
      [670.6, 558.5]
    ]);
    // y is flipped: the top of each glyph is above the baseline
    expect(d).toContain('L567 558.5Q574 509.5 567 460.5');
    expect(d).toContain('C553 453.5 511 453.5 497 460.5Z');
  });

  it('rejects invalid numbers and fonts without the glyphs', () => {
    expect(() => numberPath(fakeFont(), -1)).toThrow('Invalid mix number');
    expect(() => numberPath(fakeFont(['numbersign']), 1)).toThrow('missing glyph "one.lf"');
  });
});

describe('artworkSvg', () => {
  it('draws the logo and number in the foreground on the background', () => {
    const svg = artworkSvg(fakeFont(), theme, 7);
    expect(svg).toContain('<rect width="1024" height="1024" fill="#F2E793"/>');
    expect(svg).toContain('<g fill="#2155E4">');
    expect(svg.match(/<path /g)).toHaveLength(3);
  });

  it('draws gradient backgrounds at the CSS angle', () => {
    const svg = artworkSvg(fakeFont(), { ...theme, gradient: { angle: -45, stops: ['#36D1DC', '#5B86E5', '#000000'] } }, 1);
    expect(svg).toContain('<rect width="1024" height="1024" fill="url(#bg)"/>');
    // -45deg runs from bottom right to top left
    expect(svg).toMatch(/x1="0\.85\d*" y1="0\.85\d*" x2="0\.14\d*" y2="0\.14\d*"/);
    expect(svg).toContain('<stop offset="0.5" stop-color="#5B86E5"/>');
  });
});

describe('renderArtworkJpg', () => {
  it('renders a square JPEG at the requested size', async () => {
    const jpg = await renderArtworkJpg(artworkSvg(fakeFont(), theme, 1), 400);
    const meta = await sharp(jpg).metadata();
    expect(meta).toMatchObject({ format: 'jpeg', width: 400, height: 400 });
    const { data } = await sharp(jpg).raw().toBuffer({ resolveWithObject: true });
    // Top-left corner is the background colour
    expect([data[0], data[1], data[2]].map(v => Math.round(v! / 8))).toEqual([0xf2, 0xe7, 0x93].map(v => Math.round(v / 8)));
  });
});

// Pixel-compares against the original SoundCloud artwork when the licensed font is available
const FONT = process.env.ARTWORK_FONT ?? '/Volumes/OllieExternal/Fonts/fonts 2015/FFDINRoundPro/DINRoundPro-Black.otf';

describe.runIf(existsSync(FONT))('with FF DIN Round Pro', () => {
  it('matches the original #131 artwork', async () => {
    const font = await loadArtworkFont(FONT);
    const raw = async (svg: Buffer) => (await sharp(svg).raw().toBuffer({ resolveWithObject: true })).data;
    const ours = await raw(Buffer.from(artworkSvg(font, theme, 131)));
    const original = await raw(readFileSync(new URL('./fixtures/ok-sessions-131.svg', import.meta.url)));
    let differing = 0;
    for (let i = 0; i < ours.length; i++) if (Math.abs(ours[i]! - original[i]!) > 64) differing++;
    expect(differing / ours.length).toBeLessThan(0.001);
  });
});
