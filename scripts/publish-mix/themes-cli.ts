#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { parseNumbers } from './import-soundcloud.ts';
import { findClashes, regenerate, type Themes } from './themes.ts';

const THEMES_FILE = new URL('../../shared/mix-themes.json', import.meta.url);

const usage = `Usage:
  npm run themes -- --generate 21-50      Generate unique themes for these mixes (deterministic)
  npm run themes -- --reroll 27,33        Pick different colours for these mixes
  npm run themes -- --check               List pairs of mixes with near-identical colours

Writes shared/mix-themes.json. Preview with: npm run artwork -- --only 21-50 --sheet`;

export const main = async (
  argv: string[],
  { log = console.log, read = () => readFile(THEMES_FILE, 'utf8'), write = (json: string) => writeFile(THEMES_FILE, json), rand = Math.random } = {}
): Promise<number> => {
  const { values } = parseArgs({
    args: argv,
    options: {
      generate: { type: 'string' },
      reroll: { type: 'string' },
      check: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false }
    }
  });
  const themes: Themes = JSON.parse(await read());

  if (values.check) {
    const clashes = findClashes(themes);
    for (const [a, b, d] of clashes) log(`#${a} ~ #${b} (${d.toFixed(3)})`);
    log(`${clashes.length} similar pairs`);
    return 0;
  }

  const numbers = values.generate ?? values.reroll;
  if (values.help || !numbers) {
    log(usage);
    return 0;
  }

  const list = [...parseNumbers(numbers)];
  // Re-rolls pick a random variant; the result is saved, so it doesn't need to be reproducible
  const variants = values.reroll ? Object.fromEntries(list.map(n => [n, 1 + Math.floor(rand() * 1_000_000)])) : {};
  const updated = regenerate(themes, list, variants);
  const sorted = Object.fromEntries(Object.entries(updated).sort(([a], [b]) => Number(a) - Number(b)));
  await write(JSON.stringify(sorted, null, 2) + '\n');
  for (const n of list) {
    const t = updated[n]!;
    log(`#${n} ${t.background} / ${t.foreground}`);
  }
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
