import { env } from 'cloudflare:workers';
import { createExecutionContext, createScheduledController } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import worker from '../src/index';
import { pruneEvents, recordEvent } from '../src/stats';
import { DEVICE_ID, mixInput, putMix } from './helpers';

const mixId = async () => {
  const res = await putMix('ok-sessions-1', mixInput());
  return (await res.json<{ mix: { id: number } }>()).mix.id;
};

const eventCount = async () =>
  (await env.DB.prepare('SELECT COUNT(*) AS n FROM events').first<{ n: number }>())!.n;

describe('recordEvent', () => {
  it('counts again once the window has passed', async () => {
    const id = await mixId();
    const base = { mixId: id, deviceId: DEVICE_ID, platform: 'ios' as const, kind: 'play' as const };
    expect(await recordEvent(env.DB, { ...base, now: new Date('2026-01-01T10:00:00Z') })).toBe(true);
    expect(await recordEvent(env.DB, { ...base, now: new Date('2026-01-01T10:10:00Z') })).toBe(false);
    expect(await recordEvent(env.DB, { ...base, now: new Date('2026-01-01T10:31:00Z') })).toBe(true);
  });
});

describe('pruneEvents', () => {
  it('removes rows older than two days', async () => {
    const id = await mixId();
    const base = { mixId: id, deviceId: DEVICE_ID, platform: 'ios' as const, kind: 'play' as const };
    await recordEvent(env.DB, { ...base, now: new Date('2026-01-01T10:00:00Z') });
    await recordEvent(env.DB, { ...base, now: new Date('2026-01-04T10:00:00Z') });

    expect(await pruneEvents(env.DB, new Date('2026-01-04T12:00:00Z'))).toBe(1);
    expect(await eventCount()).toBe(1);
  });

  it('runs from the cron trigger', async () => {
    const id = await mixId();
    await recordEvent(env.DB, {
      mixId: id, deviceId: DEVICE_ID, platform: 'ios', kind: 'play', now: new Date('2000-01-01T00:00:00Z')
    });
    await worker.scheduled(createScheduledController(), env, createExecutionContext());
    expect(await eventCount()).toBe(0);
  });
});
