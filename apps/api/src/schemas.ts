import { z } from 'zod';
import { platforms, type Theme as SharedTheme } from '../../../shared/api-types';

const hexColour = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const themeSchema = z.object({
  background: hexColour,
  foreground: hexColour,
  accent: hexColour,
  dark: z.boolean(),
  gradient: z
    .object({
      angle: z.number(),
      stops: z.array(hexColour).min(2)
    })
    .optional()
});

export type Theme = z.infer<typeof themeSchema>;

// Keep the validated shape in step with the shared response type
const _themeMatches: SharedTheme = {} as Theme;
void _themeMatches;

const r2Key = z.string().min(1).max(512).regex(/^[\w\-./]+$/);
const isoDate = z.iso.datetime({ offset: true }).or(z.iso.date());

export const mixInputSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().min(1).max(200),
  description: z.string().max(10_000).default(''),
  genre: z.string().max(100).nullish(),
  recorded_at: isoDate.nullish(),
  published_at: isoDate.nullish(),
  duration_ms: z.number().int().positive(),
  audio_m4a_key: r2Key,
  audio_mp3_key: r2Key.nullish(),
  peaks_key: r2Key.nullish(),
  artwork_key: r2Key.nullish(),
  theme: themeSchema,
  soundcloud_url: z.url().nullish(),
  status: z.enum(['draft', 'published']).default('draft'),
  access: z.enum(['free', 'paid']).default('free')
});

export type MixInput = z.infer<typeof mixInputSchema>;

export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);

export const eventInputSchema = z.object({
  device_id: z.uuid(),
  platform: z.enum(platforms)
});

export const playInputSchema = eventInputSchema.extend({
  completed: z.boolean().optional()
});
