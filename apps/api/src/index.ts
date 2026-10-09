import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { etag } from 'hono/etag';
import { HTTPException } from 'hono/http-exception';
import type { z } from 'zod';
import type { AppEnv, Env } from './env';
import { findMix, listMixes, toMix, upsertMix } from './mixes';
import {
  eventInputSchema,
  mixInputSchema,
  playInputSchema,
  slugSchema
} from './schemas';
import { getStats, pruneEvents, recordEvent, type EventKind } from './stats';

const CACHE_NAME = 'ok-sessions-api';
const PUBLIC_CACHE_CONTROL = 'public, max-age=60, s-maxage=300';

const app = new Hono<AppEnv>();

app.use(
  '*',
  cors({
    origin: (origin, c) => {
      // Catalogue reads are public; writes are only accepted from our own site (native apps send no Origin)
      if (c.req.method === 'GET' || c.req.method === 'HEAD') {
        return '*';
      }
      const allowed = c.env.ALLOWED_ORIGINS.split(',').map((o: string) => o.trim());
      return allowed.includes(origin) ? origin : null;
    },
    allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86_400
  })
);

const parseJson = async <T extends z.ZodType>(c: Context<AppEnv>, schema: T): Promise<z.infer<T>> => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, {
      res: c.json({ error: 'Invalid request', issues: parsed.error.issues }, 400)
    });
  }
  return parsed.data;
};

const parseSlug = (slug: string) => {
  if (!slugSchema.safeParse(slug).success) {
    throw new HTTPException(404, { message: 'Mix not found' });
  }
  return slug;
};

// Public catalogue

// Cache key ignores query strings so bots can't bust the cache
const cacheKey = (url: string) => {
  const { origin, pathname } = new URL(url);
  return `${origin}${pathname}`;
};

/** Serves a public JSON response from the edge cache, building it on a miss. */
const cachedJson = async (c: Context<AppEnv>, build: () => Promise<unknown>) => {
  const store = await caches.open(CACHE_NAME);
  const key = cacheKey(c.req.url);
  const hit = await store.match(key);
  if (hit) {
    return new Response(hit.body, hit);
  }
  const res = c.json(await build());
  res.headers.set('Cache-Control', PUBLIC_CACHE_CONTROL);
  await store.put(key, res.clone());
  return res;
};

app.get('/v1/mixes', etag(), c =>
  cachedJson(c, async () => {
    const rows = await listMixes(c.env.DB);
    return { mixes: rows.map(row => toMix(c.env, row)) };
  })
);

app.get('/v1/mixes/:slug', etag(), c =>
  cachedJson(c, async () => {
    const row = await findMix(c.env.DB, parseSlug(c.req.param('slug')));
    if (!row) {
      throw new HTTPException(404, { message: 'Mix not found' });
    }
    return { mix: toMix(c.env, row) };
  })
);

// Listening events

const limitEvents = async (c: Context<AppEnv>, deviceId: string) => {
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  const { success } = await c.env.EVENTS_LIMITER.limit({ key: `${ip}:${deviceId}` });
  if (!success) {
    throw new HTTPException(429, { message: 'Too many requests' });
  }
};

const recordFor = async (c: Context<AppEnv>, kinds: EventKind[], input: z.infer<typeof eventInputSchema>) => {
  await limitEvents(c, input.device_id);
  const row = await findMix(c.env.DB, parseSlug(c.req.param('slug') ?? ''));
  if (!row) {
    throw new HTTPException(404, { message: 'Mix not found' });
  }
  const results = await Promise.all(
    kinds.map(kind =>
      recordEvent(c.env.DB, { mixId: row.id, deviceId: input.device_id, platform: input.platform, kind })
    )
  );
  return c.json({ counted: results[0] }, 202);
};

app.post('/v1/mixes/:slug/plays', async c => {
  const input = await parseJson(c, playInputSchema);
  return recordFor(c, input.completed ? ['play', 'completion'] : ['play'], input);
});

app.post('/v1/mixes/:slug/downloads', async c => {
  const input = await parseJson(c, eventInputSchema);
  return recordFor(c, ['download'], input);
});

// Admin (also behind Cloudflare Access in production)

const digest = async (value: string) =>
  crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));

app.use('/v1/admin/*', async (c, next) => {
  const header = c.req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const expected = c.env.ADMIN_TOKEN;
  if (!expected || !token) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  const [a, b] = await Promise.all([digest(token), digest(expected)]);
  if (!crypto.subtle.timingSafeEqual(a, b)) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  await next();
});

app.get('/v1/admin/mixes', async c => {
  const rows = await listMixes(c.env.DB, { includeDrafts: true });
  return c.json({ mixes: rows.map(row => ({ ...toMix(c.env, row), status: row.status })) });
});

app.put('/v1/admin/mixes/:slug', async c => {
  const slug = c.req.param('slug');
  if (!slugSchema.safeParse(slug).success) {
    throw new HTTPException(400, { message: 'Invalid slug' });
  }
  const input = await parseJson(c, mixInputSchema);
  let row;
  try {
    row = await upsertMix(c.env.DB, slug, input);
  } catch (error) {
    if (String(error).includes('UNIQUE constraint failed: mixes.number')) {
      throw new HTTPException(409, { message: `Mix number ${input.number} is already used` });
    }
    throw error;
  }
  await purgePublicCache(c.req.url, slug);
  return c.json({ mix: { ...toMix(c.env, row!), status: row!.status } });
});

app.get('/v1/admin/stats', async c => {
  const day = /^\d{4}-\d{2}-\d{2}$/;
  const from = c.req.query('from');
  const to = c.req.query('to');
  if ((from && !day.test(from)) || (to && !day.test(to))) {
    throw new HTTPException(400, { message: 'from/to must be YYYY-MM-DD' });
  }
  return c.json({ stats: await getStats(c.env.DB, { from, to }) });
});

const purgePublicCache = async (requestUrl: string, slug: string) => {
  const store = await caches.open(CACHE_NAME);
  const { origin } = new URL(requestUrl);
  await Promise.all([
    store.delete(cacheKey(`${origin}/v1/mixes`)),
    store.delete(cacheKey(`${origin}/v1/mixes/${slug}`))
  ]);
};

app.notFound(c => c.json({ error: 'Not found' }, 404));

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    if (error.res) {
      return error.res;
    }
    return c.json({ error: error.message }, error.status);
  }
  console.error(error);
  return c.json({ error: 'Internal error' }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
    await pruneEvents(env.DB);
  }
} satisfies ExportedHandler<Env>;
