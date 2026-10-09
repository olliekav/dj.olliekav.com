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
