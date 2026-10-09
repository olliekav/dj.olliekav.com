import { describe, expect, it, vi } from 'vitest';
import originals from '../../../shared/mix-themes.json' with { type: 'json' };
import { main } from '../themes-cli.ts';

const run = async (argv: string[]) => {
  const log = vi.fn();
  const write = vi.fn(async (_json: string) => {});
  const code = await main(argv, { log, read: async () => JSON.stringify(originals), write, rand: () => 0.5 });
  const written = write.mock.calls[0] ? JSON.parse(write.mock.calls[0][0]) : undefined;
  return { code, log, written, output: log.mock.calls.map(c => c[0]).join('\n') };
};

describe('themes CLI', () => {
  it('prints usage', async () => {
    const { code, output, written } = await run([]);
    expect(code).toBe(0);
    expect(output).toContain('--generate 21-50');
    expect(written).toBeUndefined();
  });

  it('generates themes deterministically and keeps the file sorted', async () => {
    const a = await run(['--generate', '21-22']);
    const b = await run(['--generate', '21-22']);
    expect(a.written).toEqual(b.written);
    expect(Object.keys(a.written).map(Number)).toEqual(Object.keys(originals).map(Number).sort((x, y) => x - y));
    expect(a.written['21']).not.toEqual((originals as Record<string, unknown>)['21']);
    expect(a.written['20']).toEqual((originals as Record<string, unknown>)['20']);
    expect(a.output).toMatch(/^#21 #[0-9A-F]{6} \/ #[0-9A-F]{6}\n#22 /);
  });

  it('re-rolls with a new variant', async () => {
    const generated = await run(['--generate', '27']);
    const rerolled = await run(['--reroll', '27']);
    expect(rerolled.written['27']).not.toEqual(generated.written['27']);
  });

  it('checks for similar pairs', async () => {
    const { output } = await run(['--check']);
    expect(output).toMatch(/\d+ similar pairs$/);
    expect(output).toContain('#10 ~ #106');
  });
});
