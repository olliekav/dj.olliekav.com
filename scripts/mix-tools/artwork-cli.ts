#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { artworkSvg, loadArtworkFont, renderArtworkJpg, type ArtworkFont } from './artwork.ts';
import { parseNumbers } from './util.ts';
import type { Themes } from './themes.ts';

const usage = `Usage:
  npm run artwork -- [--only 21-50] [--out <dir>] [--size 2000]   Export JPGs (default: all mixes)
  npm run artwork -- [--only 21-50] --sheet                       One contact-sheet PNG instead

Needs ARTWORK_FONT (path to DINRoundPro-Black.otf) in scripts/publish-mix/.env.`;

/** A grid of artwork thumbnails for reviewing colours. */
export const contactSheet = async (font: ArtworkFont, themes: Themes, numbers: number[], { tile = 160, columns = 10 } = {}) => {
  const gap = 8;
  const tiles = await Promise.all(
    numbers.map(async (n, i) => ({
      input: await sharp(Buffer.from(artworkSvg(font, themes[n]!, n))).resize(tile, tile).png().toBuffer(),
      left: (i % columns) * (tile + gap) + gap,
      top: Math.floor(i / columns) * (tile + gap) + gap
    }))
  );
  const cols = Math.min(columns, numbers.length);
  const rows = Math.ceil(numbers.length / columns);
  return sharp({
    create: { width: cols * (tile + gap) + gap, height: rows * (tile + gap) + gap, channels: 3, background: '#ffffff' }
  })
    .composite(tiles)
    .png()
    .toBuffer();
};

export const main = async (
  argv: string[],
  {
    env = process.env as Record<string, string | undefined>,
    log = console.log,
    loadFont = loadArtworkFont,
    readThemes = async () => readFile(new URL('../../shared/mix-themes.json', import.meta.url), 'utf8')
  } = {}
): Promise<number> => {
  const { values } = parseArgs({
    args: argv,
    options: {
      only: { type: 'string' },
      out: { type: 'string' },
      size: { type: 'string', default: '2000' },
      sheet: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false }
    }
  });
  if (values.help) {
    log(usage);
    return 0;
  }
  if (!env.ARTWORK_FONT) {
    throw new Error('Set ARTWORK_FONT to the path of DINRoundPro-Black.otf (see --help)');
  }

  const font = await loadFont(env.ARTWORK_FONT);
  const themes: Themes = JSON.parse(await readThemes());
  const numbers = values.only
    ? [...parseNumbers(values.only)]
    : Object.keys(themes).map(Number).sort((a, b) => a - b);
  const missing = numbers.filter(n => !themes[n]);
  if (missing.length) {
    throw new Error(`No theme for mix ${missing.map(n => `#${n}`).join(', ')}`);
  }

  const out = values.out ?? path.join(os.homedir(), 'Desktop', 'ok-sessions-artwork');
  await mkdir(out, { recursive: true });

  if (values.sheet) {
    const file = path.join(out, 'contact-sheet.png');
    await writeFile(file, await contactSheet(font, themes, numbers));
    log(`Wrote ${file}`);
    return 0;
  }

  const size = Number.parseInt(values.size, 10);
  for (const n of numbers) {
    const file = path.join(out, `ok-sessions-${n}.jpg`);
    await writeFile(file, await renderArtworkJpg(artworkSvg(font, themes[n]!, n), size));
  }
  log(`Wrote ${numbers.length} artworks (${size}×${size}) to ${out}`);
  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).then(
    code => process.exit(code),
    (error: Error) => {
      console.error(`✗ ${error.message}`);
      process.exit(1);
    }
  );
}
