// One-off: extract per-mix colour schemes from the Playlist SCSS into shared/mix-themes.json
import { readFileSync, writeFileSync } from 'node:fs';

const scss = readFileSync(new URL('../src/pages/Playlist/style.module.scss', import.meta.url), 'utf8');
const pattern = /\.ok-sessions-(\d+)\s*\{\s*@include colour-scheme\((linear-gradient\([^)]*\)|#[0-9a-f]{3,6}),\s*(#[0-9a-f]{3,6})(?:,\s*(true))?\);/gi;
const hex = /#[0-9a-f]{6}|#[0-9a-f]{3}/gi;

const themes = {};
for (const [, number, background, foreground, dark] of scss.matchAll(pattern)) {
  const isDark = dark === 'true';
  const stops = background.match(hex).map(c => c.toUpperCase());
  const theme = {
    background: stops[0],
    foreground: foreground.toUpperCase(),
    dark: isDark,
    // Matches the web's waveform progress colour: the brighter of the pair
    accent: isDark ? foreground.toUpperCase() : stops[0]
  };
  if (stops.length > 1) {
    theme.gradient = { angle: -45, stops };
  }
  themes[number] = theme;
}

writeFileSync(new URL('../shared/mix-themes.json', import.meta.url), JSON.stringify(themes, null, 2) + '\n');
console.log(`Extracted ${Object.keys(themes).length} themes`);
