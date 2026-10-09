#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createApi } from './api.ts';
import { publishMix, type MixMeta, type PublishDeps, type PublishJob, type Themes } from './publish.ts';
import { createR2Client } from './storage.ts';

const usage = `Usage:
  npm run publish-mix -- <file.wav> --number <n> [options]
  npm run publish-mix -- --batch <manifest.json> [--draft] [--dry-run]

Options:
  --number <n>            Mix number (required for single files)
  --title <title>         Defaults to "OK Sessions #<n>"
  --description <text>    Or --description-file <path>
  --genre <genre>
  --recorded-at <date>    YYYY-MM-DD
  --published-at <date>   ISO date; defaults to now when first published
  --soundcloud-url <url>
  --artwork <file>        PNG/JPEG/WebP
  --bg <#hex> --fg <#hex> [--dark]   Theme override (default: shared/mix-themes.json)
  --draft                 Save without publishing
  --dry-run               Print what would happen without uploading

Environment (.env next to this script):
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
  API_URL, ADMIN_TOKEN, [CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET]`;

export const parseCli = (argv: string[]) => {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      number: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      'description-file': { type: 'string' },
      genre: { type: 'string' },
      'recorded-at': { type: 'string' },
      'published-at': { type: 'string' },
      'soundcloud-url': { type: 'string' },
      artwork: { type: 'string' },
      bg: { type: 'string' },
      fg: { type: 'string' },
      dark: { type: 'boolean', default: false },
      batch: { type: 'string' },
      draft: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false }
    }
  });
  return { values, positionals };
};

type CliValues = ReturnType<typeof parseCli>['values'];

export const metaFromArgs = async (values: Partial<CliValues>): Promise<MixMeta> => {
  const number = Number.parseInt(values.number ?? '', 10);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error('--number must be a positive integer');
  }
  if ((values.bg && !values.fg) || (!values.bg && values.fg)) {
    throw new Error('--bg and --fg must be used together');
  }
  return {
    number,
    title: values.title,
    description: values['description-file']
      ? (await readFile(values['description-file'], 'utf8')).trim()
      : values.description,
    genre: values.genre,
    recorded_at: values['recorded-at'],
    published_at: values['published-at'],
    soundcloud_url: values['soundcloud-url'],
    artwork: values.artwork,
    theme:
      values.bg && values.fg
        ? {
            background: values.bg.toUpperCase(),
            foreground: values.fg.toUpperCase(),
            accent: (values.dark ? values.fg : values.bg).toUpperCase(),
            dark: Boolean(values.dark)
          }
        : undefined
  };
};

type Env = Record<string, string | undefined>;

const requireEnv = (env: Env, name: string): string => {
  if (!env[name]) {
    throw new Error(`Missing ${name} (see --help)`);
  }
  return env[name]!;
};

export const createDeps = (env: Env, { dryRun }: { dryRun: boolean }): Pick<PublishDeps, 'bucket' | 'client' | 'api'> => {
  if (dryRun) {
    return { bucket: env.R2_BUCKET ?? 'dry-run', client: null, api: null };
  }
  return {
    bucket: requireEnv(env, 'R2_BUCKET'),
    client: createR2Client({
      accountId: requireEnv(env, 'R2_ACCOUNT_ID'),
      accessKeyId: requireEnv(env, 'R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv(env, 'R2_SECRET_ACCESS_KEY')
    }),
    api: createApi({
      baseUrl: requireEnv(env, 'API_URL'),
      adminToken: requireEnv(env, 'ADMIN_TOKEN'),
      accessClientId: env.CF_ACCESS_CLIENT_ID,
      accessClientSecret: env.CF_ACCESS_CLIENT_SECRET
    })
  };
};

/** Batch manifests are JSON arrays of { file, number, title?, description?, ... }; paths are relative to the manifest. */
export const readManifest = async (manifestPath: string): Promise<PublishJob[]> => {
  const entries: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!Array.isArray(entries)) {
    throw new Error('Manifest must be a JSON array');
  }
  const dir = path.dirname(manifestPath);
  return entries.map((entry: { file?: string; number?: number; artwork?: string } & Omit<MixMeta, 'number' | 'artwork'>, i) => {
    if (!entry.file || !entry.number) {
      throw new Error(`Manifest entry ${i} needs "file" and "number"`);
    }
    const { file, artwork, number, ...meta } = entry;
    return {
      file: path.resolve(dir, file),
      meta: { ...meta, number, artwork: artwork ? path.resolve(dir, artwork) : undefined }
    };
  });
};

export const main = async (
  argv: string[],
  { env = process.env, log = console.log, publish = publishMix }: { env?: Env; log?: (message: string) => void; publish?: typeof publishMix } = {}
): Promise<number> => {
  const { values, positionals } = parseCli(argv);
  if (values.help || (!values.batch && positionals.length === 0)) {
    log(usage);
    return 0;
  }

  const themes: Themes = JSON.parse(
    await readFile(new URL('../../shared/mix-themes.json', import.meta.url), 'utf8')
  );
  const options = { draft: values.draft, dryRun: values['dry-run'] };
  const deps = { ...createDeps(env, options), themes, log };

  const jobs = values.batch
    ? await readManifest(values.batch)
    : [{ file: positionals[0]!, meta: await metaFromArgs(values) }];

  for (const job of jobs) {
    await publish({ ...job, ...options }, deps);
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
