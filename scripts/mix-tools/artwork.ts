import { readFile } from 'node:fs/promises';
import opentype from 'opentype.js';
import sharp from 'sharp';
import type { Theme } from '../../shared/api-types.ts';

// Mix artwork: the OK logo and "#<number>" in the mix's foreground colour on its
// background, matching the SoundCloud artwork template (1024×1024 design units).

const CANVAS = 1024;

// Measured from the original artwork: FF DIN Round Pro Black, 140px, proportional
// lining figures, left-aligned beside the chevron
const NUMBER = { x: 497, baseline: 558.5, size: 140, tracking: 2.8 };

const RING =
  'M512 962C263.87 962 62 760.13 62 512C62 263.87 263.87 62 512 62C760.13 62 962 263.87 962 512C962 760.13 760.13 962 512 962ZM512 154.44C314.84 154.44 154.44 314.84 154.44 512C154.44 709.16 314.84 869.56 512 869.56C709.16 869.56 869.56 709.16 869.56 512C869.56 314.84 709.16 154.44 512 154.44Z';
const CHEVRON =
  'M511.26 715.481C499.43 715.481 487.6 710.971 478.58 701.941L321.32 544.681C312.65 536.011 307.78 524.261 307.78 512.001C307.78 499.741 312.65 487.981 321.32 479.321L478.58 322.061C496.63 304.011 525.89 304.011 543.95 322.061C562 340.111 562 369.381 543.95 387.431L419.37 512.011L543.95 636.591C562 654.641 562 683.911 543.95 701.961C534.93 710.981 523.09 715.501 511.27 715.501L511.26 715.481Z';

const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

export type ArtworkFont = opentype.Font;

export const loadArtworkFont = async (file: string): Promise<ArtworkFont> => {
  const bytes = await readFile(file);
  return opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
};

const glyphCache = new WeakMap<ArtworkFont, Map<string, opentype.Glyph>>();

const glyphNamed = (font: ArtworkFont, name: string): opentype.Glyph => {
  let byName = glyphCache.get(font);
  if (!byName) {
    byName = new Map();
    for (let i = 0; i < font.glyphs.length; i++) {
      const glyph = font.glyphs.get(i);
      if (glyph.name) byName.set(glyph.name, glyph);
    }
    glyphCache.set(font, byName);
  }
  const glyph = byName.get(name);
  if (!glyph) {
    throw new Error(`Font is missing glyph "${name}" (expected FF DIN Round Pro Black)`);
  }
  return glyph;
};

const fixed = (n: number) => String(Math.round(n * 100) / 100);

/** Converts a glyph outline (font units, y up) to SVG path data at (x, baseline), y down. */
const glyphPathData = (glyph: opentype.Glyph, x: number, baseline: number, scale: number): string => {
  const px = (v: number) => fixed(x + v * scale);
  const py = (v: number) => fixed(baseline - v * scale);
  return glyph.path.commands
    .map(c => {
      switch (c.type) {
        case 'M':
        case 'L':
          return `${c.type}${px(c.x)} ${py(c.y)}`;
        case 'Q':
          return `Q${px(c.x1)} ${py(c.y1)} ${px(c.x)} ${py(c.y)}`;
        case 'C':
          return `C${px(c.x1)} ${py(c.y1)} ${px(c.x2)} ${py(c.y2)} ${px(c.x)} ${py(c.y)}`;
        default:
          return 'Z';
      }
    })
    .join('');
};

/** Outlines "#<number>" as SVG path data, so rendering doesn't need the font installed. */
export const numberPath = (font: ArtworkFont, number: number): string => {
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`Invalid mix number ${number}`);
  }
  const scale = NUMBER.size / font.unitsPerEm;
  const names = ['numbersign', ...String(number).split('').map(d => `${DIGITS[Number(d)]}.lf`)];
  let x = NUMBER.x;
  const parts: string[] = [];
  for (const name of names) {
    const glyph = glyphNamed(font, name);
    parts.push(glyphPathData(glyph, x, NUMBER.baseline, scale));
    x += (glyph.advanceWidth ?? 0) * scale + NUMBER.tracking;
  }
  return parts.join('');
};

const background = (theme: Theme) => {
  if (!theme.gradient) {
    return { defs: '', fill: theme.background };
  }
  // CSS linear-gradient(-45deg) runs from bottom right to top left
  const radians = ((theme.gradient.angle - 90) * Math.PI) / 180;
  const dx = Math.cos(radians) / 2;
  const dy = Math.sin(radians) / 2;
  const stops = theme.gradient.stops
    .map((colour, i, all) => `<stop offset="${i / (all.length - 1)}" stop-color="${colour}"/>`)
    .join('');
  return {
    defs: `<defs><linearGradient id="bg" x1="${0.5 - dx}" y1="${0.5 - dy}" x2="${0.5 + dx}" y2="${0.5 + dy}">${stops}</linearGradient></defs>`,
    fill: 'url(#bg)'
  };
};

export const artworkSvg = (font: ArtworkFont, theme: Theme, number: number): string => {
  const bg = background(theme);
  return [
    `<svg width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}" xmlns="http://www.w3.org/2000/svg">`,
    bg.defs,
    `<rect width="${CANVAS}" height="${CANVAS}" fill="${bg.fill}"/>`,
    `<g fill="${theme.foreground}">`,
    `<path d="${RING}"/>`,
    `<path d="${CHEVRON}"/>`,
    `<path d="${numberPath(font, number)}"/>`,
    '</g>',
    '</svg>'
  ].join('');
};

/** Renders artwork as a square JPEG (SoundCloud and app artwork). */
export const renderArtworkJpg = (svg: string, size = 2000): Promise<Buffer> =>
  sharp(Buffer.from(svg), { density: (72 * size) / CANVAS })
    .resize(size, size)
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
