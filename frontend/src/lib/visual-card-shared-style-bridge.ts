import {
  parseColorToRgb,
  resolveAccessibleTextColor,
} from "@/lib/color-contrast";
import {
  resolveGlobalThemeTokens,
  type GlobalThemeTokenName,
} from "@/lib/global-theme-tokens";
import {
  DEFAULT_DESIGN_FONT_STACK,
  DEFAULT_DESIGN_FONT_WEIGHT,
  DEFAULT_DESIGN_LETTER_SPACING,
  normalizeLayoutStyle,
  normalizeSidebarStyle,
  type LayoutCustomStyle,
  type SidebarStyle,
} from "@/lib/product-market-store";
import {
  VISUAL_CARD_GLOBAL_REGION_IDS,
  VISUAL_CARD_PAGE_REGION_IDS,
  type VisualCardRegionId,
} from "@/lib/visual-card-layout-contract";

export const VISUAL_CARD_SHARED_STYLE_BRIDGE_VERSION = 1 as const;

export const VISUAL_CARD_SAFE_FONT_FAMILIES = [
  DEFAULT_DESIGN_FONT_STACK,
  "'Noto Serif SC', serif",
] as const;

export const VISUAL_CARD_SAFE_FONT_WEIGHTS = ["300", "400", "700"] as const;
export const VISUAL_CARD_SAFE_LETTER_SPACINGS = ["0em", "0.02em", "0.04em"] as const;

export type VisualCardSafeFontFamily = (typeof VISUAL_CARD_SAFE_FONT_FAMILIES)[number];
export type VisualCardSafeFontWeight = (typeof VISUAL_CARD_SAFE_FONT_WEIGHTS)[number];
export type VisualCardSafeLetterSpacing = (typeof VISUAL_CARD_SAFE_LETTER_SPACINGS)[number];
export type VisualCardSharedCornerRadius = NonNullable<LayoutCustomStyle["frameCornerRadius"]>;
export type VisualCardSharedDensity = NonNullable<LayoutCustomStyle["frameDensity"]>;
export type VisualCardSharedElevation = NonNullable<LayoutCustomStyle["frameElevation"]>;

export type VisualCardGlobalTypography = {
  globalFontFamily?: string;
  globalFontWeight?: string;
  globalLetterSpacing?: string;
};

type LayoutColorField =
  | "contentBgColor"
  | "contentTextColor"
  | "clientTopbarOverrideBgColor"
  | "clientTopbarOverrideTextColor"
  | "clientFooterOverrideBgColor"
  | "clientFooterOverrideTextColor"
  | "clientSecondaryPageBgColor"
  | "clientSecondaryPageTextColor"
  | "clientSecondaryTitleBgColor"
  | "clientSecondaryTitleTextColor"
  | "clientSecondaryListBgColor"
  | "clientSecondaryListTextColor"
  | "clientSecondaryContentBgColor"
  | "clientSecondaryContentTextColor"
  | "clientLargeCardBgColor"
  | "clientLargeCardTextColor"
  | "clientCardBgColor"
  | "clientCardTextColor"
  | "clientFeatureCardBgColor"
  | "clientFeatureCardTextColor";

type LayoutRadiusField =
  | "frameCornerRadius"
  | "tableHeaderCornerRadius"
  | "cardCornerRadius";

type VisualCardTypographyToken =
  | "--tradepro-global-font-family"
  | "--tradepro-global-font-weight"
  | "--tradepro-global-letter-spacing";

export type VisualCardSharedStyleSource =
  | {
      owner: "layoutStyle";
      field: keyof LayoutCustomStyle;
      token: GlobalThemeTokenName | VisualCardTypographyToken;
    }
  | {
      owner: "sidebarStyle";
      field: keyof SidebarStyle;
      token: GlobalThemeTokenName | VisualCardTypographyToken;
    }
  | {
      owner: "globalTypography";
      field: keyof VisualCardGlobalTypography;
      token: VisualCardTypographyToken;
    }
  | {
      owner: "factory-default";
      field: "accessible-color" | "font-family" | "font-weight" | "letter-spacing";
      token: GlobalThemeTokenName | VisualCardTypographyToken;
    };

type ColorSourceCandidate = {
  owner: "layoutStyle" | "sidebarStyle";
  field: LayoutColorField | keyof SidebarStyle;
  value: string | undefined;
};

type RegionStyleContract = {
  applicationScope: "global" | "current-page";
  backgroundToken: GlobalThemeTokenName;
  textToken: GlobalThemeTokenName;
  backgroundField: LayoutColorField;
  textField: LayoutColorField;
  radiusField: LayoutRadiusField;
};

/**
 * Exact Layout Style field/token ownership for all ten visual regions.
 * Page-owned regions still read these shared values, but the write bridge
 * below deliberately returns a page appearance patch for them.
 */
export const VISUAL_CARD_SHARED_REGION_STYLE_CONTRACT = {
  "total-frame": {
    applicationScope: "global",
    backgroundToken: "--tradepro-panel-bg",
    textToken: "--tradepro-panel-text",
    backgroundField: "contentBgColor",
    textField: "contentTextColor",
    radiusField: "frameCornerRadius",
  },
  topbar: {
    applicationScope: "global",
    backgroundToken: "--tradepro-client-topbar-bg",
    textToken: "--tradepro-client-topbar-text",
    backgroundField: "clientTopbarOverrideBgColor",
    textField: "clientTopbarOverrideTextColor",
    radiusField: "frameCornerRadius",
  },
  workspace: {
    applicationScope: "global",
    backgroundToken: "--tradepro-panel-bg",
    textToken: "--tradepro-panel-text",
    backgroundField: "contentBgColor",
    textField: "contentTextColor",
    radiusField: "frameCornerRadius",
  },
  title: {
    applicationScope: "global",
    backgroundToken: "--tradepro-panel-title-bg",
    textToken: "--tradepro-panel-title-text",
    backgroundField: "clientSecondaryTitleBgColor",
    textField: "clientSecondaryTitleTextColor",
    radiusField: "frameCornerRadius",
  },
  "table-shell": {
    applicationScope: "global",
    backgroundToken: "--tradepro-panel-frame-bg",
    textToken: "--tradepro-panel-frame-text",
    backgroundField: "clientSecondaryPageBgColor",
    textField: "clientSecondaryPageTextColor",
    radiusField: "frameCornerRadius",
  },
  "table-header": {
    applicationScope: "current-page",
    backgroundToken: "--tradepro-panel-table-bg",
    textToken: "--tradepro-panel-table-text",
    backgroundField: "clientSecondaryListBgColor",
    textField: "clientSecondaryListTextColor",
    radiusField: "tableHeaderCornerRadius",
  },
  content: {
    applicationScope: "current-page",
    backgroundToken: "--tradepro-product-market-content-bg",
    textToken: "--tradepro-product-market-content-text",
    backgroundField: "clientSecondaryContentBgColor",
    textField: "clientSecondaryContentTextColor",
    radiusField: "frameCornerRadius",
  },
  "large-card": {
    applicationScope: "current-page",
    backgroundToken: "--tradepro-product-market-large-card-bg",
    textToken: "--tradepro-product-market-large-card-text",
    backgroundField: "clientLargeCardBgColor",
    textField: "clientLargeCardTextColor",
    radiusField: "cardCornerRadius",
  },
  "small-card": {
    applicationScope: "current-page",
    backgroundToken: "--tradepro-panel-card-bg",
    textToken: "--tradepro-panel-card-text",
    backgroundField: "clientFeatureCardBgColor",
    textField: "clientFeatureCardTextColor",
    radiusField: "cardCornerRadius",
  },
  footer: {
    applicationScope: "global",
    backgroundToken: "--tradepro-client-footer-bg",
    textToken: "--tradepro-client-footer-text",
    backgroundField: "clientFooterOverrideBgColor",
    textField: "clientFooterOverrideTextColor",
    radiusField: "frameCornerRadius",
  },
} as const satisfies Record<VisualCardRegionId, RegionStyleContract>;

export type VisualCardResolvedSharedStyle = {
  bridgeVersion: typeof VISUAL_CARD_SHARED_STYLE_BRIDGE_VERSION;
  regionId: VisualCardRegionId;
  applicationScope: "global" | "current-page";
  surfaceOwnerRegionId: VisualCardRegionId;
  editableFields: readonly VisualCardSharedStyleEditField[];
  backgroundColor: string;
  textColor: string;
  contrastAdjusted: boolean;
  cornerRadius: VisualCardSharedCornerRadius;
  cornerRadiusPx: 0 | 12 | 24;
  density: VisualCardSharedDensity;
  spacingPx: 8 | 12 | 16;
  elevation: VisualCardSharedElevation;
  shadow: string;
  fontFamily: VisualCardSafeFontFamily;
  fontWeight: VisualCardSafeFontWeight;
  letterSpacing: VisualCardSafeLetterSpacing;
  source: {
    background: VisualCardSharedStyleSource;
    text: VisualCardSharedStyleSource;
    cornerRadius: VisualCardSharedStyleSource;
    density: VisualCardSharedStyleSource;
    elevation: VisualCardSharedStyleSource;
    fontFamily: VisualCardSharedStyleSource;
    fontWeight: VisualCardSharedStyleSource;
    letterSpacing: VisualCardSharedStyleSource;
  };
};

export type VisualCardSharedStyleEdit = {
  backgroundColor?: string;
  textColor?: string;
  cornerRadius?: VisualCardSharedCornerRadius;
  density?: VisualCardSharedDensity;
  elevation?: VisualCardSharedElevation;
  fontFamily?: VisualCardSafeFontFamily;
  fontWeight?: VisualCardSafeFontWeight;
  letterSpacing?: VisualCardSafeLetterSpacing;
};

export type VisualCardSharedStyleEditField = keyof VisualCardSharedStyleEdit;

/**
 * `total-frame` owns global geometry only. Its contextual surface is rendered
 * by `workspace`, so changing frame geometry can never recolour, retype or
 * otherwise take ownership of the body region.
 */
export const VISUAL_CARD_SHARED_STYLE_SURFACE_OWNER = {
  "total-frame": "workspace",
  topbar: "topbar",
  workspace: "workspace",
  title: "title",
  "table-shell": "table-shell",
  "table-header": "table-header",
  content: "content",
  "large-card": "large-card",
  "small-card": "small-card",
  footer: "footer",
} as const satisfies Record<VisualCardRegionId, VisualCardRegionId>;

const ALL_SHARED_STYLE_EDIT_FIELDS = [
  "backgroundColor",
  "textColor",
  "cornerRadius",
  "density",
  "elevation",
  "fontFamily",
  "fontWeight",
  "letterSpacing",
] as const satisfies readonly VisualCardSharedStyleEditField[];

const SURFACE_SHARED_STYLE_EDIT_FIELDS = [
  "backgroundColor",
  "textColor",
] as const satisfies readonly VisualCardSharedStyleEditField[];

const WORKSPACE_SHARED_STYLE_EDIT_FIELDS = [
  "backgroundColor",
  "textColor",
  "fontFamily",
  "fontWeight",
  "letterSpacing",
] as const satisfies readonly VisualCardSharedStyleEditField[];

export const VISUAL_CARD_SHARED_STYLE_EDITABLE_FIELDS = {
  "total-frame": ["cornerRadius", "density", "elevation"],
  topbar: SURFACE_SHARED_STYLE_EDIT_FIELDS,
  workspace: WORKSPACE_SHARED_STYLE_EDIT_FIELDS,
  title: SURFACE_SHARED_STYLE_EDIT_FIELDS,
  "table-shell": SURFACE_SHARED_STYLE_EDIT_FIELDS,
  "table-header": ALL_SHARED_STYLE_EDIT_FIELDS,
  content: ALL_SHARED_STYLE_EDIT_FIELDS,
  "large-card": ALL_SHARED_STYLE_EDIT_FIELDS,
  "small-card": ALL_SHARED_STYLE_EDIT_FIELDS,
  footer: SURFACE_SHARED_STYLE_EDIT_FIELDS,
} as const satisfies Record<VisualCardRegionId, readonly VisualCardSharedStyleEditField[]>;

export type VisualCardPageAppearancePatch = Readonly<{
  regionId: (typeof VISUAL_CARD_PAGE_REGION_IDS)[number];
  backgroundColor?: string;
  textColor?: string;
  cornerRadius?: VisualCardSharedCornerRadius;
  density?: VisualCardSharedDensity;
  elevation?: VisualCardSharedElevation;
  fontFamily?: VisualCardSafeFontFamily;
  fontWeight?: VisualCardSafeFontWeight;
  letterSpacing?: VisualCardSafeLetterSpacing;
}>;

export type VisualCardSharedStylePatchResult = Readonly<{
  regionId: VisualCardRegionId;
  boundary: "global-layout-style" | "current-page-appearance";
  layoutStyle: Partial<LayoutCustomStyle>;
  globalTypography: Partial<VisualCardGlobalTypography>;
  pageAppearance?: VisualCardPageAppearancePatch;
  rejectedFields: readonly (keyof VisualCardSharedStyleEdit)[];
}>;

/**
 * Safe payload carried by the visual editor's existing synchronous apply
 * bridge.  It deliberately contains only Layout Style and global typography;
 * route-owned component overrides continue to travel in VisualCardLayout.
 */
export type VisualCardSharedStyleApplyPatch = Readonly<{
  layoutStyle: Partial<LayoutCustomStyle>;
  globalTypography: Partial<VisualCardGlobalTypography>;
}>;

/**
 * Factory values for exactly the visual contract fields owned by the global
 * editor. Optional override colors are intentionally present with an
 * `undefined` value so a previously persisted override can be removed without
 * resetting unrelated Product Market settings.
 */
export function createDefaultVisualCardSharedStyleApplyPatch(): VisualCardSharedStyleApplyPatch {
  const defaults = normalizeLayoutStyle(undefined);
  const layoutStyle: Partial<LayoutCustomStyle> = {
    frameCornerRadius: defaults.frameCornerRadius,
    frameDensity: defaults.frameDensity,
    frameElevation: defaults.frameElevation,
    globalFontWeight: defaults.globalFontWeight,
    globalLetterSpacing: defaults.globalLetterSpacing,
  };
  const editableSurfaceRegions = ["topbar", "workspace", "title", "table-shell", "footer"] as const;
  for (const regionId of editableSurfaceRegions) {
    const contract = VISUAL_CARD_SHARED_REGION_STYLE_CONTRACT[regionId];
    (layoutStyle as Record<LayoutColorField, string | undefined>)[contract.backgroundField] = defaults[contract.backgroundField];
    (layoutStyle as Record<LayoutColorField, string | undefined>)[contract.textField] = defaults[contract.textField];
  }
  return {
    layoutStyle,
    globalTypography: {
      globalFontFamily: DEFAULT_DESIGN_FONT_STACK,
      globalFontWeight: DEFAULT_DESIGN_FONT_WEIGHT,
      globalLetterSpacing: DEFAULT_DESIGN_LETTER_SPACING,
    },
  };
}

const CORNER_RADIUS_PX = { square: 0, soft: 12, round: 24 } as const;
const DENSITY_PX = { compact: 8, standard: 12, relaxed: 16 } as const;
const ELEVATION_SHADOW = {
  flat: "none",
  soft: "0 0.25rem 0.75rem rgb(15 23 42 / 12%)",
  raised: "0 0.625rem 1.5rem rgb(15 23 42 / 18%)",
} as const;

const GLOBAL_REGION_SET = new Set<VisualCardRegionId>(VISUAL_CARD_GLOBAL_REGION_IDS);
const PAGE_REGION_SET = new Set<VisualCardRegionId>(VISUAL_CARD_PAGE_REGION_IDS);

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

/** Accepts only parseable RGB/hex values and emits one canonical opaque hex. */
export function normalizeVisualCardSharedColor(value: string | undefined | null) {
  const rgb = parseColorToRgb(value);
  if (!rgb || [rgb.r, rgb.g, rgb.b].some((channel) => !Number.isInteger(channel) || channel < 0 || channel > 255)) {
    return undefined;
  }
  return `#${[rgb.r, rgb.g, rgb.b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

function normalizeOrFallbackColor(value: string | undefined, fallback: string) {
  return normalizeVisualCardSharedColor(value) || fallback;
}

function colorSource(
  candidates: readonly ColorSourceCandidate[],
  token: GlobalThemeTokenName,
): VisualCardSharedStyleSource {
  const selected = candidates.find((candidate) => Boolean(normalizeVisualCardSharedColor(candidate.value)));
  if (!selected) return { owner: "factory-default", field: "accessible-color", token };
  if (selected.owner === "sidebarStyle") {
    return { owner: "sidebarStyle", field: selected.field as keyof SidebarStyle, token };
  }
  return { owner: "layoutStyle", field: selected.field as keyof LayoutCustomStyle, token };
}

function getRegionColorSources(
  regionId: VisualCardRegionId,
  layout: LayoutCustomStyle,
  sidebar: SidebarStyle,
) {
  const contract = VISUAL_CARD_SHARED_REGION_STYLE_CONTRACT[regionId];
  const layoutCandidate = (field: LayoutColorField): ColorSourceCandidate => ({
    owner: "layoutStyle",
    field,
    value: layout[field],
  });
  const sidebarCandidate = (field: keyof SidebarStyle): ColorSourceCandidate => ({
    owner: "sidebarStyle",
    field,
    value: typeof sidebar[field] === "string" ? sidebar[field] : undefined,
  });

  if (regionId === "topbar") {
    return {
      background: colorSource([
        layoutCandidate("clientTopbarOverrideBgColor"),
        sidebarCandidate("bgFrom"),
      ], contract.backgroundToken),
      text: colorSource([
        layoutCandidate("clientTopbarOverrideTextColor"),
        sidebarCandidate("textColor"),
      ], contract.textToken),
    };
  }
  if (regionId === "footer") {
    return {
      background: colorSource([
        layoutCandidate("clientFooterOverrideBgColor"),
        sidebarCandidate("bgTo"),
      ], contract.backgroundToken),
      text: colorSource([
        layoutCandidate("clientFooterOverrideTextColor"),
        sidebarCandidate("textColor"),
      ], contract.textToken),
    };
  }
  if (regionId === "content") {
    return {
      background: colorSource([
        layoutCandidate("clientSecondaryContentBgColor"),
        layoutCandidate("clientSecondaryPageBgColor"),
        layoutCandidate("clientFeatureCardBgColor"),
        layoutCandidate("clientCardBgColor"),
      ], contract.backgroundToken),
      text: colorSource([
        layoutCandidate("clientSecondaryContentTextColor"),
        layoutCandidate("clientSecondaryPageTextColor"),
        layoutCandidate("clientFeatureCardTextColor"),
        layoutCandidate("clientCardTextColor"),
        layoutCandidate("contentTextColor"),
      ], contract.textToken),
    };
  }
  if (regionId === "large-card") {
    return {
      background: colorSource([
        layoutCandidate("clientLargeCardBgColor"),
        layoutCandidate("clientFeatureCardBgColor"),
        layoutCandidate("clientCardBgColor"),
      ], contract.backgroundToken),
      text: colorSource([
        layoutCandidate("clientLargeCardTextColor"),
        layoutCandidate("clientFeatureCardTextColor"),
        layoutCandidate("clientCardTextColor"),
        layoutCandidate("contentTextColor"),
      ], contract.textToken),
    };
  }
  if (regionId === "small-card") {
    return {
      background: colorSource([
        layoutCandidate("clientFeatureCardBgColor"),
        layoutCandidate("clientCardBgColor"),
      ], contract.backgroundToken),
      text: colorSource([
        layoutCandidate("clientFeatureCardTextColor"),
        layoutCandidate("clientCardTextColor"),
        layoutCandidate("contentTextColor"),
      ], contract.textToken),
    };
  }
  if (regionId === "table-shell") {
    return {
      background: colorSource([layoutCandidate("clientSecondaryPageBgColor")], contract.backgroundToken),
      text: colorSource([
        layoutCandidate("clientSecondaryPageTextColor"),
        layoutCandidate("contentTextColor"),
      ], contract.textToken),
    };
  }
  if (regionId === "table-header") {
    return {
      background: colorSource([layoutCandidate("clientSecondaryListBgColor")], contract.backgroundToken),
      text: colorSource([
        layoutCandidate("clientSecondaryListTextColor"),
        layoutCandidate("contentTextColor"),
      ], contract.textToken),
    };
  }
  return {
    background: colorSource([layoutCandidate(contract.backgroundField)], contract.backgroundToken),
    text: colorSource([layoutCandidate(contract.textField)], contract.textToken),
  };
}

type ResolvedVisualCardTypography<T extends string> = {
  value: T;
  source: VisualCardSharedStyleSource;
};

function resolveSafeFontFamily(
  typography: VisualCardGlobalTypography,
  sidebar: SidebarStyle,
): ResolvedVisualCardTypography<VisualCardSafeFontFamily> {
  if (isOneOf(typography.globalFontFamily, VISUAL_CARD_SAFE_FONT_FAMILIES)) {
    return {
      value: typography.globalFontFamily,
      source: { owner: "globalTypography", field: "globalFontFamily", token: "--tradepro-global-font-family" } as const,
    };
  }
  if (isOneOf(sidebar.fontFamily, VISUAL_CARD_SAFE_FONT_FAMILIES)) {
    return {
      value: sidebar.fontFamily,
      source: { owner: "sidebarStyle", field: "fontFamily", token: "--tradepro-global-font-family" } as const,
    };
  }
  return {
    value: DEFAULT_DESIGN_FONT_STACK as VisualCardSafeFontFamily,
    source: { owner: "factory-default", field: "font-family", token: "--tradepro-global-font-family" } as const,
  };
}

function resolveSafeFontWeight(
  typography: VisualCardGlobalTypography,
  layout: LayoutCustomStyle,
  sidebar: SidebarStyle,
): ResolvedVisualCardTypography<VisualCardSafeFontWeight> {
  if (isOneOf(typography.globalFontWeight, VISUAL_CARD_SAFE_FONT_WEIGHTS)) {
    return {
      value: typography.globalFontWeight,
      source: { owner: "globalTypography", field: "globalFontWeight", token: "--tradepro-global-font-weight" } as const,
    };
  }
  if (isOneOf(layout.globalFontWeight, VISUAL_CARD_SAFE_FONT_WEIGHTS)) {
    return {
      value: layout.globalFontWeight,
      source: { owner: "layoutStyle", field: "globalFontWeight", token: "--tradepro-global-font-weight" } as const,
    };
  }
  if (isOneOf(sidebar.fontWeight, VISUAL_CARD_SAFE_FONT_WEIGHTS)) {
    return {
      value: sidebar.fontWeight,
      source: { owner: "sidebarStyle", field: "fontWeight", token: "--tradepro-global-font-weight" } as const,
    };
  }
  return {
    value: DEFAULT_DESIGN_FONT_WEIGHT as VisualCardSafeFontWeight,
    source: { owner: "factory-default", field: "font-weight", token: "--tradepro-global-font-weight" } as const,
  };
}

function resolveSafeLetterSpacing(
  typography: VisualCardGlobalTypography,
  layout: LayoutCustomStyle,
  sidebar: SidebarStyle,
): ResolvedVisualCardTypography<VisualCardSafeLetterSpacing> {
  if (isOneOf(typography.globalLetterSpacing, VISUAL_CARD_SAFE_LETTER_SPACINGS)) {
    return {
      value: typography.globalLetterSpacing,
      source: { owner: "globalTypography", field: "globalLetterSpacing", token: "--tradepro-global-letter-spacing" } as const,
    };
  }
  if (isOneOf(layout.globalLetterSpacing, VISUAL_CARD_SAFE_LETTER_SPACINGS)) {
    return {
      value: layout.globalLetterSpacing,
      source: { owner: "layoutStyle", field: "globalLetterSpacing", token: "--tradepro-global-letter-spacing" } as const,
    };
  }
  if (isOneOf(sidebar.letterSpacing, VISUAL_CARD_SAFE_LETTER_SPACINGS)) {
    return {
      value: sidebar.letterSpacing,
      source: { owner: "sidebarStyle", field: "letterSpacing", token: "--tradepro-global-letter-spacing" } as const,
    };
  }
  return {
    value: DEFAULT_DESIGN_LETTER_SPACING as VisualCardSafeLetterSpacing,
    source: { owner: "factory-default", field: "letter-spacing", token: "--tradepro-global-letter-spacing" } as const,
  };
}

/** Resolves the same effective palette and geometry that the live page uses. */
export function resolveVisualCardSharedRegionStyle(
  regionId: VisualCardRegionId,
  layoutStyle: Partial<LayoutCustomStyle> | null | undefined,
  sidebarStyle: Partial<SidebarStyle> | null | undefined,
  globalTypography: VisualCardGlobalTypography = {},
): VisualCardResolvedSharedStyle {
  const layout = normalizeLayoutStyle(layoutStyle);
  const sidebar = normalizeSidebarStyle(sidebarStyle);
  const tokens = resolveGlobalThemeTokens(layout, sidebar);
  const contract = VISUAL_CARD_SHARED_REGION_STYLE_CONTRACT[regionId];
  const fallbackBackground = regionId === "topbar" || regionId === "footer" ? "#0F172A" : "#FFFFFF";
  const backgroundColor = normalizeOrFallbackColor(tokens[contract.backgroundToken], fallbackBackground);
  const preferredText = normalizeOrFallbackColor(tokens[contract.textToken], "#0F172A");
  const textColor = normalizeOrFallbackColor(
    resolveAccessibleTextColor(backgroundColor, preferredText, "#0F172A", "#F8FAFC"),
    "#0F172A",
  );
  const colorSources = getRegionColorSources(regionId, layout, sidebar);
  const cornerRadius = layout[contract.radiusField] || (contract.radiusField === "frameCornerRadius" ? "round" : "soft");
  const density = layout.frameDensity || "standard";
  const elevation = layout.frameElevation || "flat";
  const fontFamily = resolveSafeFontFamily(globalTypography, sidebar);
  const fontWeight = resolveSafeFontWeight(globalTypography, layout, sidebar);
  const letterSpacing = resolveSafeLetterSpacing(globalTypography, layout, sidebar);

  return {
    bridgeVersion: VISUAL_CARD_SHARED_STYLE_BRIDGE_VERSION,
    regionId,
    applicationScope: contract.applicationScope,
    surfaceOwnerRegionId: VISUAL_CARD_SHARED_STYLE_SURFACE_OWNER[regionId],
    editableFields: VISUAL_CARD_SHARED_STYLE_EDITABLE_FIELDS[regionId],
    backgroundColor,
    textColor,
    contrastAdjusted: textColor !== preferredText,
    cornerRadius,
    cornerRadiusPx: CORNER_RADIUS_PX[cornerRadius],
    density,
    spacingPx: DENSITY_PX[density],
    elevation,
    shadow: ELEVATION_SHADOW[elevation],
    fontFamily: fontFamily.value,
    fontWeight: fontWeight.value,
    letterSpacing: letterSpacing.value,
    source: {
      background: colorSources.background,
      text: colorSources.text,
      cornerRadius: { owner: "layoutStyle", field: contract.radiusField, token: contract.radiusField === "tableHeaderCornerRadius" ? "--tradepro-layout-table-header-radius" : contract.radiusField === "cardCornerRadius" ? "--tradepro-layout-card-radius" : "--tradepro-layout-frame-radius" },
      density: { owner: "layoutStyle", field: "frameDensity", token: "--tradepro-layout-space" },
      elevation: { owner: "layoutStyle", field: "frameElevation", token: "--tradepro-layout-shadow" },
      fontFamily: fontFamily.source,
      fontWeight: fontWeight.source,
      letterSpacing: letterSpacing.source,
    },
  };
}

function assignLayoutColor(
  patch: Partial<LayoutCustomStyle>,
  field: LayoutColorField,
  value: string,
) {
  (patch as Record<LayoutColorField, string>)[field] = value;
}

/**
 * Converts editor input into the smallest safe persistence patch.
 * Global regions may write Layout Style. Page regions are returned as a
 * separate appearance value and therefore cannot leak into Shared Style.
 */
export function buildVisualCardSharedStylePatch(
  regionId: VisualCardRegionId,
  edit: VisualCardSharedStyleEdit,
  currentLayoutStyle: Partial<LayoutCustomStyle> | null | undefined,
  currentSidebarStyle: Partial<SidebarStyle> | null | undefined,
  currentGlobalTypography: VisualCardGlobalTypography = {},
): VisualCardSharedStylePatchResult {
  const currentLayout = normalizeLayoutStyle(currentLayoutStyle);
  const currentResolved = resolveVisualCardSharedRegionStyle(
    regionId,
    currentLayout,
    currentSidebarStyle,
    currentGlobalTypography,
  );
  const contract = VISUAL_CARD_SHARED_REGION_STYLE_CONTRACT[regionId];
  const rejectedFields: (keyof VisualCardSharedStyleEdit)[] = [];
  const editableFields = new Set<VisualCardSharedStyleEditField>(VISUAL_CARD_SHARED_STYLE_EDITABLE_FIELDS[regionId]);
  const canEdit = (field: VisualCardSharedStyleEditField) => editableFields.has(field);
  const rejectField = (field: VisualCardSharedStyleEditField) => {
    if (!rejectedFields.includes(field)) rejectedFields.push(field);
  };
  (Object.keys(edit) as VisualCardSharedStyleEditField[]).forEach((field) => {
    if (edit[field] !== undefined && !canEdit(field)) rejectField(field);
  });

  const normalizedBackground = edit.backgroundColor === undefined || !canEdit("backgroundColor")
    ? undefined
    : normalizeVisualCardSharedColor(edit.backgroundColor);
  const normalizedRequestedText = edit.textColor === undefined || !canEdit("textColor")
    ? undefined
    : normalizeVisualCardSharedColor(edit.textColor);

  if (edit.backgroundColor !== undefined && canEdit("backgroundColor") && !normalizedBackground) rejectField("backgroundColor");
  if (edit.textColor !== undefined && canEdit("textColor") && !normalizedRequestedText) rejectField("textColor");

  const effectiveBackground = normalizedBackground || currentResolved.backgroundColor;
  const preferredText = normalizedRequestedText || currentResolved.textColor;
  const accessibleText = normalizeOrFallbackColor(
    resolveAccessibleTextColor(effectiveBackground, preferredText, "#0F172A", "#F8FAFC"),
    currentResolved.textColor,
  );
  const backgroundChanged = Boolean(normalizedBackground && normalizedBackground !== currentResolved.backgroundColor);
  const textWasRequested = normalizedRequestedText !== undefined;
  const textChanged = accessibleText !== currentResolved.textColor;

  const validCornerRadius = edit.cornerRadius === undefined || (canEdit("cornerRadius") && isOneOf(edit.cornerRadius, ["square", "soft", "round"] as const));
  const validDensity = edit.density === undefined || (canEdit("density") && isOneOf(edit.density, ["compact", "standard", "relaxed"] as const));
  const validElevation = edit.elevation === undefined || (canEdit("elevation") && isOneOf(edit.elevation, ["flat", "soft", "raised"] as const));
  const validFontFamily = edit.fontFamily === undefined || (canEdit("fontFamily") && isOneOf(edit.fontFamily, VISUAL_CARD_SAFE_FONT_FAMILIES));
  const validFontWeight = edit.fontWeight === undefined || (canEdit("fontWeight") && isOneOf(edit.fontWeight, VISUAL_CARD_SAFE_FONT_WEIGHTS));
  const validLetterSpacing = edit.letterSpacing === undefined || (canEdit("letterSpacing") && isOneOf(edit.letterSpacing, VISUAL_CARD_SAFE_LETTER_SPACINGS));
  if (edit.cornerRadius !== undefined && canEdit("cornerRadius") && !validCornerRadius) rejectField("cornerRadius");
  if (edit.density !== undefined && canEdit("density") && !validDensity) rejectField("density");
  if (edit.elevation !== undefined && canEdit("elevation") && !validElevation) rejectField("elevation");
  if (edit.fontFamily !== undefined && canEdit("fontFamily") && !validFontFamily) rejectField("fontFamily");
  if (edit.fontWeight !== undefined && canEdit("fontWeight") && !validFontWeight) rejectField("fontWeight");
  if (edit.letterSpacing !== undefined && canEdit("letterSpacing") && !validLetterSpacing) rejectField("letterSpacing");

  if (GLOBAL_REGION_SET.has(regionId)) {
    const layoutStyle: Partial<LayoutCustomStyle> = {};
    const globalTypography: Partial<VisualCardGlobalTypography> = {};
    if (canEdit("backgroundColor") && backgroundChanged && normalizedBackground) {
      assignLayoutColor(layoutStyle, contract.backgroundField, normalizedBackground);
    }
    if (canEdit("textColor") && (textWasRequested || backgroundChanged) && textChanged) {
      assignLayoutColor(layoutStyle, contract.textField, accessibleText);
    }
    if (validCornerRadius && edit.cornerRadius !== undefined && edit.cornerRadius !== currentResolved.cornerRadius) {
      layoutStyle[contract.radiusField] = edit.cornerRadius;
    }
    if (validDensity && edit.density !== undefined && edit.density !== currentResolved.density) {
      layoutStyle.frameDensity = edit.density;
    }
    if (validElevation && edit.elevation !== undefined && edit.elevation !== currentResolved.elevation) {
      layoutStyle.frameElevation = edit.elevation;
    }
    if (validFontFamily && edit.fontFamily !== undefined && edit.fontFamily !== currentResolved.fontFamily) {
      globalTypography.globalFontFamily = edit.fontFamily;
    }
    if (validFontWeight && edit.fontWeight !== undefined && edit.fontWeight !== currentResolved.fontWeight) {
      globalTypography.globalFontWeight = edit.fontWeight;
      layoutStyle.globalFontWeight = edit.fontWeight;
    }
    if (validLetterSpacing && edit.letterSpacing !== undefined && edit.letterSpacing !== currentResolved.letterSpacing) {
      globalTypography.globalLetterSpacing = edit.letterSpacing;
      layoutStyle.globalLetterSpacing = edit.letterSpacing;
    }
    return {
      regionId,
      boundary: "global-layout-style",
      layoutStyle,
      globalTypography,
      rejectedFields,
    };
  }

  if (!PAGE_REGION_SET.has(regionId)) {
    throw new Error(`Unsupported visual card region: ${regionId}`);
  }

  const pageAppearance: VisualCardPageAppearancePatch = {
    regionId: regionId as VisualCardPageAppearancePatch["regionId"],
    ...(backgroundChanged && normalizedBackground ? { backgroundColor: normalizedBackground } : {}),
    ...((textWasRequested || backgroundChanged) && textChanged ? { textColor: accessibleText } : {}),
    ...(validCornerRadius && edit.cornerRadius !== undefined && edit.cornerRadius !== currentResolved.cornerRadius ? { cornerRadius: edit.cornerRadius } : {}),
    ...(validDensity && edit.density !== undefined && edit.density !== currentResolved.density ? { density: edit.density } : {}),
    ...(validElevation && edit.elevation !== undefined && edit.elevation !== currentResolved.elevation ? { elevation: edit.elevation } : {}),
    ...(validFontFamily && edit.fontFamily !== undefined && edit.fontFamily !== currentResolved.fontFamily ? { fontFamily: edit.fontFamily } : {}),
    ...(validFontWeight && edit.fontWeight !== undefined && edit.fontWeight !== currentResolved.fontWeight ? { fontWeight: edit.fontWeight } : {}),
    ...(validLetterSpacing && edit.letterSpacing !== undefined && edit.letterSpacing !== currentResolved.letterSpacing ? { letterSpacing: edit.letterSpacing } : {}),
  };

  return {
    regionId,
    boundary: "current-page-appearance",
    layoutStyle: {},
    globalTypography: {},
    pageAppearance,
    rejectedFields,
  };
}
