import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../artwork-cli.ts';
import { fakeFont } from './fake-font.ts';

const themes = {
  1: { background: '#2A10A6', foreground: '#EC00A5', accent: '#EC00A5', dark: true },
  2: { background: '#EC1C24', foreground: '#2A10A6', accent: '#EC1C24', dark: false },
  3: { background: '#28C517', foreground: '#FFF100', accent: '#28C517', dark: false }
};

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'artwork-cli-'));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const run = (argv: string[], env: Record<string, string | undefined> = { ARTWORK_FONT: '/fonts/din.otf' }) => {
  const log = vi.fn();
  const loadFont = vi.fn(async () => fakeFont());
  return { log, loadFont, result: main(argv, { env, log, loadFont, readThemes: async () => JSON.stringify(themes) }) };
};

describe('artwork CLI', () => {
  it('exports JPGs for the selected mixes', async () => {
    const { result, log, loadFont } = run(['--only', '1,3', '--out', dir, '--size', '300']);
    expect(await result).toBe(0);
    expect(loadFont).toHaveBeenCalledWith('/fonts/din.otf');
    expect((await readdir(dir)).sort()).toEqual(['ok-sessions-1.jpg', 'ok-sessions-3.jpg']);
    expect(await sharp(path.join(dir, 'ok-sessions-1.jpg')).metadata()).toMatchObject({ width: 300, format: 'jpeg' });
    expect(log).toHaveBeenCalledWith(`Wrote 2 artworks (300×300) to ${dir}`);
  });

  it('exports every mix by default', async () => {
    await run(['--out', dir, '--size', '64']).result;
    expect((await readdir(dir)).length).toBe(3);
  });

  it('writes a contact sheet', async () => {
    await run(['--sheet', '--out', dir]).result;
    const meta = await sharp(path.join(dir, 'contact-sheet.png')).metadata();
    expect(meta).toMatchObject({ format: 'png', width: 3 * 168 + 8, height: 168 + 8 });
  });

  it('prints usage', async () => {
    const { result, log } = run(['--help'], {});
    expect(await result).toBe(0);
    expect(log.mock.calls[0]![0]).toContain('ARTWORK_FONT');
  });

  it('needs the font and known mixes', async () => {
    await expect(run([], {}).result).rejects.toThrow('Set ARTWORK_FONT');
    await expect(run(['--only', '1,9', '--out', dir]).result).rejects.toThrow('No theme for mix #9');
  });
});
