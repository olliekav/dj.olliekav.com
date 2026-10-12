import type { Mix } from '../../shared/api-types';
import { fetchMixes } from './api';

// Shared with vite.config.ts's sitemap plugin, which runs in the same process
const CACHE = Symbol.for('ok-sessions.build-mixes');

type Cache = { [CACHE]?: Promise<Mix[] | undefined> };

export const mixesForBuild = (): Promise<Mix[] | undefined> => {
  const apiUrl = (process.env.PRERENDER_API_URL ?? 'https://dj.olliekav.com').replace(/\/$/, '');
  return ((globalThis as Cache)[CACHE] ??= fetchMixes(url => fetch(url, { signal: AbortSignal.timeout(15_000) }), apiUrl).catch(
    (error: unknown) => {
      console.warn(`Building without mixes: couldn't fetch ${apiUrl}/api/mixes`, error);
      return undefined;
    }
  ));
};
