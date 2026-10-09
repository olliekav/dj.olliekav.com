import { describe, expect, it } from 'vitest';
import type { Theme } from '../../../shared/api-types';
import themesJson from '../../../shared/mix-themes.json';
import { themeStyle } from '../theme';

const themes: Record<string, Theme> = themesJson;

describe('themeStyle', () => {
  it('maps solid themes to CSS variables', () => {
    expect(themeStyle(themes['1'])).toEqual({
      '--mix-bg': '#2A10A6',
      '--mix-fg': '#EC00A5',
      '--mix-accent': '#EC00A5'
    });
  });

  it('renders gradients', () => {
    expect(themeStyle(themes['21'])['--mix-bg']).toBe('linear-gradient(-45deg, #36D1DC, #5B86E5)');
  });

  it('handles missing themes', () => {
    expect(themeStyle(undefined)).toEqual({});
  });
});

describe('shared themes', () => {
  it('covers every session with valid colours', () => {
    const hex = /^#[0-9A-F]{6}$/;
    for (const [number, theme] of Object.entries(themes)) {
      expect(Number(number)).toBeGreaterThan(0);
      for (const key of ['background', 'foreground', 'accent'] as const) {
        expect(theme[key], `${number}.${key}`).toMatch(hex);
      }
    }
  });
});
