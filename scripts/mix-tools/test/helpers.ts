import { EventEmitter } from 'node:events';
import { vi } from 'vitest';
import type { SpawnFn } from '../media.ts';

interface FakeResponse {
  stdout?: Buffer | string | Array<Buffer | string>;
  stderr?: string;
  code?: number;
  error?: Error;
}

/** A spawn() stand-in: records calls and emits the given stdout/exit code. */
export const fakeSpawn = (responses: Record<string, FakeResponse> = {}) => {
  const calls: string[][] = [];
  const spawnFn: SpawnFn = (command, args) => {
    calls.push([command, ...args]);
    const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter() });
    const { stdout = '', stderr = '', code = 0, error } = responses[command] ?? {};
    queueMicrotask(() => {
      if (error) {
        child.emit('error', error);
        return;
      }
      for (const chunk of ([] as Array<Buffer | string>).concat(stdout)) {
        if (chunk.length) child.stdout.emit('data', Buffer.from(chunk));
      }
      if (stderr) child.stderr.emit('data', Buffer.from(stderr));
      child.emit('close', code);
    });
    return child as unknown as ReturnType<SpawnFn>;
  };
  return { spawnFn, calls };
};

export const jsonResponse = (status: number, body?: unknown) =>
  new Response(body === undefined ? 'not json' : JSON.stringify(body), { status, statusText: 'Status' });

export const mockFetch = (response: () => Response) => vi.fn<typeof fetch>(async () => response());
