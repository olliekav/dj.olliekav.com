import type { Theme } from '../../shared/api-types';

/** CSS custom properties for a mix theme, consumed by the `.themed` styles. */
export const themeStyle = (theme: Theme | undefined): Record<string, string> => {
  if (!theme) {
    return {};
  }
  const background = theme.gradient
    ? `linear-gradient(${theme.gradient.angle}deg, ${theme.gradient.stops.join(', ')})`
    : theme.background;
  return {
    '--mix-bg': background,
    '--mix-fg': theme.foreground,
    '--mix-accent': theme.accent
  };
};

/** The accent, unless it matches the background the bar is drawn on: then the foreground */
export const barAccent = (theme: Theme) =>
  theme.accent.toLowerCase() === theme.background.toLowerCase() ? theme.foreground : theme.accent;
