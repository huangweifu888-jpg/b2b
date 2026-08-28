export const WCAG_TEXT_MIN_CONTRAST = 4.5;
export const WCAG_NON_TEXT_MIN_CONTRAST = 3;

export type RgbColor = { r: number; g: number; b: number };

export function parseColorToRgb(value?: string | null): RgbColor | null {
  const color = value?.trim();
  if (!color) return null;

  const shortHex = color.match(/^#([\da-f]{3})$/i);
  if (shortHex) {
    const [r, g, b] = shortHex[1]
      .split("")
      .map((channel) => Number.parseInt(channel + channel, 16));
    return { r, g, b };
  }

  const fullHex = color.match(/^#([\da-f]{6})$/i);
  if (fullHex) {
    return {
      r: Number.parseInt(fullHex[1].slice(0, 2), 16),
      g: Number.parseInt(fullHex[1].slice(2, 4), 16),
      b: Number.parseInt(fullHex[1].slice(4, 6), 16),
    };
  }

  const rgb = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) return null;
  return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
}

export function getRelativeLuminance(color?: string | null) {
  const rgb = parseColorToRgb(color);
  if (!rgb) return null;
  const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function getContrastRatio(background?: string | null, foreground?: string | null) {
  const backgroundLuminance = getRelativeLuminance(background);
  const foregroundLuminance = getRelativeLuminance(foreground);
  if (backgroundLuminance === null || foregroundLuminance === null) return null;
  return (
    (Math.max(backgroundLuminance, foregroundLuminance) + 0.05) /
    (Math.min(backgroundLuminance, foregroundLuminance) + 0.05)
  );
}

export function getBestContrastingTextColor(
  background: string | undefined | null,
  dark = "#0F172A",
  light = "#F8FAFC"
) {
  const darkContrast = getContrastRatio(background, dark) ?? 0;
  const lightContrast = getContrastRatio(background, light) ?? 0;
  return lightContrast > darkContrast ? light : dark;
}

/** Preserve a configured foreground only when it meets the shared WCAG gate. */
export function resolveAccessibleTextColor(
  background: string | undefined | null,
  preferredText: string | undefined | null,
  dark = "#0F172A",
  light = "#F8FAFC",
  minimumContrast = WCAG_TEXT_MIN_CONTRAST
) {
  const preferredContrast = getContrastRatio(background, preferredText);
  if (preferredText && preferredContrast !== null && preferredContrast >= minimumContrast) {
    return preferredText;
  }
  return getBestContrastingTextColor(background, dark, light);
}
