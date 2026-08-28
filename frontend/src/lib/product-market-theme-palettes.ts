import paletteData from "./product-market-theme-palettes.json";

export type ProductMarketThemePaletteKey =
  | "rose"
  | "orange"
  | "indigoGreen"
  | "tealRose"
  | "limeTea"
  | "dark"
  | "light";

export type ProductMarketThemePalette = {
  key: ProductMarketThemePaletteKey;
  name: string;
  description: string;
  primary: string;
  secondary: string;
  chrome: string;
  action: string;
  surface: string;
  elevated: string;
  panel: string;
  secondarySurface: string;
  border: string;
  focus: string;
  text: string;
  mutedText: string;
  onPrimary: string;
  onSecondary: string;
  onChrome: string;
  onAction: string;
};

export type ProductMarketFactoryStatusCardColors = {
  bg: string;
  border: string;
  font: string;
  button: string;
  nameFont: string;
};

export type ProductMarketSidebarGradient = {
  bgFrom: string;
  bgVia: string;
  bgTo: string;
};

export type ProductMarketImmutableThemePreview = {
  operationsSwitch: Readonly<{
    background: string;
    text: string;
    border: string;
    focus: string;
    panel: string;
    panelText: string;
  }>;
  layoutChooser: Readonly<{
    background: string;
    text: string;
    border: string;
    primary: string;
    primaryText: string;
    secondary: string;
    action: string;
    focus: string;
  }>;
  expandedThemeStatus: Readonly<{
    background: string;
    text: string;
    border: string;
  }>;
};

function mixHexColor(from: string, to: string, amount: number) {
  const parse = (value: string) => {
    const normalized = value.replace("#", "").trim();
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
    return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16));
  };
  const source = parse(from);
  const target = parse(to);
  if (!source || !target) return from;
  const ratio = Math.max(0, Math.min(1, amount));
  return `#${source.map((channel, index) => Math.round(channel + (target[index] - channel) * ratio).toString(16).padStart(2, "0")).join("")}`;
}

function relativeBrightness(color: string) {
  const normalized = color.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  const channels = [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

/** Every factory palette has a visibly ordered sidebar gradient.  The palette
 * chrome is the middle anchor; the two endpoints are purposefully darker and
 * lighter so a three-stop gradient cannot collapse into a flat fill. */
export function buildProductMarketSidebarGradient(palette: ProductMarketThemePalette): ProductMarketSidebarGradient {
  return {
    bgFrom: mixHexColor(palette.chrome, "#000000", 0.48),
    bgVia: palette.chrome,
    bgTo: mixHexColor(palette.action, "#FFFFFF", 0.28),
  };
}

export function isProductMarketSidebarGradientDeepToLight(gradient: ProductMarketSidebarGradient) {
  const from = relativeBrightness(gradient.bgFrom);
  const via = relativeBrightness(gradient.bgVia);
  const to = relativeBrightness(gradient.bgTo);
  return from !== null && via !== null && to !== null && from < via && via < to;
}

/**
 * Factory status semantics are intentionally stable across all seven palettes:
 * active carries the current palette's main colour, while cancel and hidden
 * retain their universal red and dark-grey meanings.
 */
export const PRODUCT_MARKET_FACTORY_STATUS_SEMANTICS = Object.freeze({
  inactive: Object.freeze({
    bg: "#FEE4E2",
    border: "#FDA29B",
    font: "#8A1C14",
    button: "#D92D20",
    nameFont: "#8A1C14",
  } satisfies ProductMarketFactoryStatusCardColors),
  hidden: Object.freeze({
    bg: "#F3F4F6",
    border: "#D1D5DB",
    font: "#374151",
    button: "#D1D5DB",
    nameFont: "#374151",
  } satisfies ProductMarketFactoryStatusCardColors),
});

export function buildProductMarketFactoryStatusCards(palette: ProductMarketThemePalette) {
  return {
    active: {
      bg: palette.primary,
      border: palette.border,
      font: palette.onPrimary,
      button: palette.action,
      nameFont: palette.onPrimary,
    } satisfies ProductMarketFactoryStatusCardColors,
    inactive: { ...PRODUCT_MARKET_FACTORY_STATUS_SEMANTICS.inactive },
    hidden: { ...PRODUCT_MARKET_FACTORY_STATUS_SEMANTICS.hidden },
  } as const;
}

/**
 * Seven semantic palettes are the only built-in colour source used by the
 * Product Market pages and the three source-level developer consoles.
 */
export const PRODUCT_MARKET_THEME_PALETTES = Object.freeze(
  (paletteData as ProductMarketThemePalette[]).map((palette) => Object.freeze({ ...palette }))
) as readonly Readonly<ProductMarketThemePalette>[];

export const PRODUCT_MARKET_THEME_PALETTE_ORDER = PRODUCT_MARKET_THEME_PALETTES.map(
  ({ key }) => key
) as ProductMarketThemePaletteKey[];

export const PRODUCT_MARKET_THEME_PALETTE_MAP = Object.freeze(
  Object.fromEntries(PRODUCT_MARKET_THEME_PALETTES.map((palette) => [palette.key, palette]))
) as Readonly<Record<ProductMarketThemePaletteKey, Readonly<ProductMarketThemePalette>>>;

/**
 * The three first-glance palette previews are factory-owned and immutable.
 * Global styling, saved drafts and shared visual learning may validate these
 * values, but they must never replace them at runtime.
 */
export const PRODUCT_MARKET_IMMUTABLE_THEME_PREVIEW_MAP = Object.freeze(
  Object.fromEntries(
    PRODUCT_MARKET_THEME_PALETTES.map((palette) => [
      palette.key,
      Object.freeze({
        operationsSwitch: Object.freeze({
          background: palette.primary,
          text: palette.onPrimary,
          border: palette.border,
          focus: palette.action,
          panel: palette.panel,
          panelText: palette.text,
        }),
        layoutChooser: Object.freeze({
          background: palette.panel,
          text: palette.text,
          border: palette.border,
          primary: palette.primary,
          primaryText: palette.onPrimary,
          secondary: palette.secondary,
          action: palette.action,
          focus: palette.focus,
        }),
        expandedThemeStatus: Object.freeze({
          background: palette.primary,
          text: palette.onPrimary,
          border: palette.border,
        }),
      } satisfies ProductMarketImmutableThemePreview),
    ])
  )
) as Readonly<Record<ProductMarketThemePaletteKey, ProductMarketImmutableThemePreview>>;

export function getProductMarketThemePalette(key: ProductMarketThemePaletteKey) {
  return PRODUCT_MARKET_THEME_PALETTE_MAP[key];
}
