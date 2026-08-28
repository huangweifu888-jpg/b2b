import type {
  CardColors,
  CustomProductItem,
  CustomerServiceAvatarOverride,
  CustomerServiceSectionConfig,
  CustomThemeData,
  ExportableConfig,
  LayoutSectionConfig,
  LayoutCustomStyle,
  ProductCustomStyle,
  SidebarStyle,
  ThemePresetKey,
} from "@/lib/product-market-store";
import {
  CS_AVATAR_PRESETS as CUSTOMER_SERVICE_PRESETS,
  DEFAULT_FEMALE_VOICE_OVERRIDE_ID,
  DEFAULT_MALE_VOICE_OVERRIDE_ID,
  getDefaultSidebarStyle,
  normalizeLayoutStyle,
  normalizeSidebarStyle,
} from "@/lib/product-market-store";
import {
  CUSTOMER_SERVICE_VOICE_PRESETS,
  DEFAULT_CUSTOMER_SERVICE_VOICE_RATE,
  getCustomerServiceVoicePreset,
  getDefaultVoiceGenderForAvatar,
} from "@/lib/customer-service-voice";
import {
  cloneVisualCardLayout,
  type VisualCardLayoutConfig,
} from "@/lib/visual-card-layout-contract";
import { resolveRotatedPlanDefaultsForSite } from "./product-market-theme-rotation";
import { safeRemoveLocalStorage, safeSetLocalStorage } from "./storage-guards";

export const PRODUCT_MARKET_SHARED_STYLE_KEY_PREFIX = "product-market-shared-style";
export const PRODUCT_MARKET_SHARED_STYLE_KEY = `${PRODUCT_MARKET_SHARED_STYLE_KEY_PREFIX}:global`;
export const PRODUCT_MARKET_SHARED_STYLE_EVENT = "product-market-shared-style-updated";

type SharedStyleProductChild = {
  label: string;
  path: string;
  status: ExportableConfig["products"][number]["status"];
  customLabel?: string;
  customStyle?: ProductCustomStyle;
};

type SharedStyleProduct = {
  label: string;
  path: string;
  status: ExportableConfig["products"][number]["status"];
  customLabel?: string;
  customStyle?: ProductCustomStyle;
  children?: SharedStyleProductChild[];
};

type SharedStyleConfig = {
  layoutStyle: LayoutCustomStyle;
  visualCardLayout?: VisualCardLayoutConfig;
  layoutSections?: LayoutSectionConfig[];
  customerServiceSections?: CustomerServiceSectionConfig[];
  activeTheme: ThemePresetKey | string;
  customThemes?: CustomThemeData[];
  builtinThemeOverrides?: Record<string, CustomThemeData>;
  sidebarStyle?: SidebarStyle;
  globalFontFamily?: string;
  globalFontWeight?: string;
  globalLetterSpacing?: string;
  customDefaultPaths?: string[];
  productOrder?: string[];
  customProducts?: CustomProductItem[];
  soundEnabled?: boolean;
  soundVolume?: number;
  soundStyle?: string;
  csAvatarId?: string;
  csEnabled?: boolean;
  csAvatarOverrides?: Record<string, CustomerServiceAvatarOverride>;
  csVoiceEnabled?: boolean;
  csVoiceGender?: "female" | "male";
  csVoiceRate?: number;
  products: SharedStyleProduct[];
};

export function cloneThemeMap(map?: Record<string, CustomThemeData>) {
  if (!map) return {};
  return Object.fromEntries(
    Object.entries(map).map(([key, theme]) => [
      key,
      {
        ...theme,
        layout: { ...theme.layout },
        sidebar: { ...theme.sidebar },
        cardActive: { ...theme.cardActive } as CardColors,
        cardInactive: { ...theme.cardInactive } as CardColors,
        cardHidden: { ...theme.cardHidden } as CardColors,
      },
    ])
  );
}

export function cloneThemes(themes?: CustomThemeData[]) {
  return (themes || []).map((theme) => ({
    ...theme,
    layout: { ...theme.layout },
    sidebar: { ...theme.sidebar },
    cardActive: { ...theme.cardActive },
    cardInactive: { ...theme.cardInactive },
    cardHidden: { ...theme.cardHidden },
  }));
}

export function cloneAvatarOverrides(overrides?: Record<string, CustomerServiceAvatarOverride>) {
  if (!overrides) return {};
  return Object.fromEntries(
    Object.entries(overrides).map(([key, value]) => [
      key,
      {
        ...value,
        soundAssetsByStyle: value.soundAssetsByStyle
          ? Object.fromEntries(
              Object.entries(value.soundAssetsByStyle).map(([assetKey, assetValue]) => [
                assetKey,
                {
                  ...assetValue,
                },
              ])
            )
          : undefined,
        voiceAssetsByStyle: value.voiceAssetsByStyle
          ? Object.fromEntries(
              Object.entries(value.voiceAssetsByStyle).map(([assetKey, assetValue]) => [
                assetKey,
                {
                  ...assetValue,
                },
              ])
            )
          : undefined,
        materialHistory: value.materialHistory?.map((item) => ({ ...item })),
      },
    ])
  );
}

function mergeCustomerServiceAssetMap<
  T extends Record<string, { assetId?: string; mimeType?: string; fileName?: string }> | undefined,
>(sharedMap: T, localMap: T): T {
  if (!sharedMap && !localMap) return undefined as T;
  const merged = Object.fromEntries(
    Array.from(new Set([...Object.keys(sharedMap || {}), ...Object.keys(localMap || {})])).map((key) => [
      key,
      {
        ...(sharedMap?.[key] || {}),
        ...(localMap?.[key] || {}),
      },
    ])
  );
  return merged as T;
}

function mergeAvatarOverride(
  sharedOverride?: CustomerServiceAvatarOverride,
  localOverride?: CustomerServiceAvatarOverride
) {
  if (!sharedOverride && !localOverride) return undefined;
  return {
    ...(sharedOverride || {}),
    ...(localOverride || {}),
    soundAssetsByStyle: mergeCustomerServiceAssetMap(sharedOverride?.soundAssetsByStyle, localOverride?.soundAssetsByStyle),
    voiceAssetsByStyle: mergeCustomerServiceAssetMap(sharedOverride?.voiceAssetsByStyle, localOverride?.voiceAssetsByStyle),
  } satisfies CustomerServiceAvatarOverride;
}

function mergeAvatarOverrides(
  sharedOverrides?: Record<string, CustomerServiceAvatarOverride>,
  localOverrides?: Record<string, CustomerServiceAvatarOverride>
) {
  return Object.fromEntries(
    Array.from(new Set([...Object.keys(sharedOverrides || {}), ...Object.keys(localOverrides || {})]))
      .map((key) => [key, mergeAvatarOverride(sharedOverrides?.[key], localOverrides?.[key])] as const)
      .filter((entry): entry is [string, CustomerServiceAvatarOverride] => Boolean(entry[1]))
  );
}

export function cloneLayoutSections(sections?: LayoutSectionConfig[]) {
  return (sections || []).map((section) => ({
    ...section,
  }));
}

export function cloneCustomerServiceSections(sections?: CustomerServiceSectionConfig[]) {
  return (sections || []).map((section) => ({
    ...section,
  }));
}

export function cloneCustomProducts(products?: CustomProductItem[]) {
  return (products || []).map((product) => ({
    ...product,
    children: product.children?.map((child) => ({
      ...child,
    })),
  }));
}

export function cloneSharedProducts(products?: ExportableConfig["products"] | SharedStyleProduct[]) {
  return (products || []).map((product) => ({
    label: product.label,
    path: product.path,
    status: product.status,
    customLabel: product.customLabel,
    customStyle: product.customStyle ? { ...product.customStyle } : undefined,
    children: product.children?.map((child) => ({
      label: child.label,
      path: child.path,
      status: child.status,
      customLabel: child.customLabel,
      customStyle: child.customStyle ? { ...child.customStyle } : undefined,
    })),
  }));
}

function normalizeSiteId(siteId?: string | null) {
  return siteId?.trim() || "";
}

function buildLegacySiteSharedStyleStorageKey(siteId?: string | null) {
  const normalizedSiteId = normalizeSiteId(siteId);
  return normalizedSiteId ? `${PRODUCT_MARKET_SHARED_STYLE_KEY_PREFIX}:site:${normalizedSiteId}` : "";
}

function migrateLegacySiteSharedStyle(siteId?: string | null) {
  if (typeof window === "undefined") return;
  const legacyKey = buildLegacySiteSharedStyleStorageKey(siteId);
  if (!legacyKey) return;

  try {
    const legacyRaw = window.localStorage.getItem(legacyKey);
    if (!legacyRaw) return;
    const hasGlobalShared = Boolean(window.localStorage.getItem(PRODUCT_MARKET_SHARED_STYLE_KEY));
    if (!hasGlobalShared) {
      safeSetLocalStorage(PRODUCT_MARKET_SHARED_STYLE_KEY, legacyRaw, { compact: true });
    }
    safeRemoveLocalStorage(legacyKey);
  } catch {
    // Keep the live chain usable even if legacy cleanup fails.
  }
}

function hasNonEmptyAvatarOverrides(overrides?: Record<string, CustomerServiceAvatarOverride>) {
  return Object.values(overrides || {}).some((value) => {
    if (!value) return false;
    return Boolean(
      value.mediaAssetId ||
      value.imageDataUrl ||
      value.mediaMimeType ||
      value.mediaKind ||
      value.soundStyle ||
      value.soundAssetId ||
      value.soundAssetMimeType ||
      value.soundAssetFileName ||
      (value.soundAssetsByStyle && Object.keys(value.soundAssetsByStyle).length > 0) ||
      value.animationStyle ||
      value.displayName ||
      value.greetingText ||
      value.voiceEnabled !== undefined ||
      value.voiceGender ||
      value.voiceStyleKey ||
      value.femaleVoiceAssetId ||
      value.femaleVoiceAssetMimeType ||
      value.femaleVoiceAssetFileName ||
      value.maleVoiceAssetId ||
      value.maleVoiceAssetMimeType ||
      value.maleVoiceAssetFileName ||
      (value.voiceAssetsByStyle && Object.keys(value.voiceAssetsByStyle).length > 0) ||
      (typeof value.voiceRate === "number" && Math.abs(value.voiceRate - 1) > 0.001)
    );
  });
}

function hasLocalCustomerServiceCustomization(config: ExportableConfig) {
  const defaultAvatarId = CUSTOMER_SERVICE_PRESETS[0]?.id || "pro-female";
  return Boolean(
    (config.csAvatarId && config.csAvatarId !== defaultAvatarId) ||
      config.csEnabled === false ||
      config.soundEnabled === false ||
      (typeof config.soundVolume === "number" && Math.abs(config.soundVolume - 0.5) > 0.001) ||
      (config.soundStyle && config.soundStyle !== "crisp") ||
      config.csVoiceEnabled === true ||
      (config.csVoiceGender && config.csVoiceGender !== "female") ||
      (typeof config.csVoiceRate === "number" && Math.abs(config.csVoiceRate - DEFAULT_CUSTOMER_SERVICE_VOICE_RATE) > 0.001) ||
      hasNonEmptyAvatarOverrides(config.csAvatarOverrides)
  );
}

function areObjectsEqual(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function detectCustomerServiceCustomizationAgainstSharedSnapshot(
  config: ExportableConfig | null,
  shared: SharedStyleConfig | null
) {
  if (!config) return false;
  if (!shared) return hasLocalCustomerServiceCustomization(config);

  if ((config.soundEnabled ?? true) !== (shared.soundEnabled ?? true)) return true;
  if ((config.soundVolume ?? 0.5) !== (shared.soundVolume ?? 0.5)) return true;
  if ((config.soundStyle || "") !== (shared.soundStyle || "")) return true;
  if ((config.csAvatarId || "") !== (shared.csAvatarId || "")) return true;
  if ((config.csEnabled ?? true) !== (shared.csEnabled ?? true)) return true;
  if ((config.csVoiceEnabled ?? false) !== (shared.csVoiceEnabled ?? false)) return true;
  if ((config.csVoiceGender || "female") !== (shared.csVoiceGender || "female")) return true;
  if ((config.csVoiceRate ?? DEFAULT_CUSTOMER_SERVICE_VOICE_RATE) !== (shared.csVoiceRate ?? DEFAULT_CUSTOMER_SERVICE_VOICE_RATE)) return true;
  if (!areObjectsEqual(cloneCustomerServiceSections(config.customerServiceSections), cloneCustomerServiceSections(shared.customerServiceSections))) return true;
  if (!areObjectsEqual(cloneAvatarOverrides(config.csAvatarOverrides), cloneAvatarOverrides(shared.csAvatarOverrides))) return true;
  return false;
}

export function detectCustomerServiceCustomizationAgainstShared(
  config: ExportableConfig | null,
  siteId?: string | null
) {
  return detectCustomerServiceCustomizationAgainstSharedSnapshot(config, readSharedStyleSettings(siteId));
}

function detectLayoutVisualCustomizationAgainstShared(
  config: ExportableConfig | null,
  siteId?: string | null
) {
  if (!config) return false;
  const shared = readSharedStyleSettings(siteId);
  if (!shared) return Boolean(config.layoutCustomized);

  if (!areObjectsEqual(config.layoutStyle, shared.layoutStyle)) return true;
  if ((config.activeTheme || "") !== (shared.activeTheme || "")) return true;
  if (!areObjectsEqual(config.customThemes || [], cloneThemes(shared.customThemes))) return true;
  if (!areObjectsEqual(config.builtinThemeOverrides || {}, cloneThemeMap(shared.builtinThemeOverrides))) return true;
  if (!areObjectsEqual(config.sidebarStyle || {}, shared.sidebarStyle || {})) return true;
  if ((config.globalFontFamily || "") !== (shared.globalFontFamily || "")) return true;
  if ((config.globalFontWeight || "") !== (shared.globalFontWeight || "")) return true;
  if ((config.globalLetterSpacing || "") !== (shared.globalLetterSpacing || "")) return true;
  return false;
}

function comparableVisualCardLayout(value?: VisualCardLayoutConfig) {
  if (!value) return undefined;
  const normalized = cloneVisualCardLayout(value);
  return {
    schemaVersion: normalized.schemaVersion,
    frameInsets: normalized.frameInsets,
    nodes: normalized.nodes,
    componentStyles: normalized.componentStyles || {},
  };
}

export function detectLayoutStructureCustomizationAgainstShared(
  config: ExportableConfig | null,
  siteId?: string | null
) {
  if (!config) return false;
  const shared = readSharedStyleSettings(siteId);
  if (!shared) return Boolean(config.layoutCustomized);

  if (!areObjectsEqual(cloneLayoutSections(config.layoutSections), cloneLayoutSections(shared.layoutSections))) return true;
  if (!areObjectsEqual(
    comparableVisualCardLayout(config.visualCardLayout),
    comparableVisualCardLayout(shared.visualCardLayout),
  )) return true;
  if (!areObjectsEqual(config.customDefaultPaths || [], shared.customDefaultPaths || [])) return true;
  if (!areObjectsEqual(config.productOrder || [], shared.productOrder || [])) return true;
  if (!areObjectsEqual(cloneCustomProducts(config.customProducts), cloneCustomProducts(shared.customProducts))) return true;
  if (!areObjectsEqual(cloneSharedProducts(config.products), cloneSharedProducts(shared.products))) return true;
  return false;
}

export function detectLayoutCustomizationAgainstShared(
  config: ExportableConfig | null,
  siteId?: string | null
) {
  if (!config) return false;
  const shared = readSharedStyleSettings(siteId);
  if (!shared) return Boolean(config.layoutCustomized);
  return (
    detectLayoutVisualCustomizationAgainstShared(config, siteId) ||
    detectLayoutStructureCustomizationAgainstShared(config, siteId)
  );
}

export function buildSharedStyleStorageKey(siteId?: string | null) {
  if (siteId) {
    migrateLegacySiteSharedStyle(siteId);
  }
  return PRODUCT_MARKET_SHARED_STYLE_KEY;
}

function normalizeSharedVoiceOverride<T extends Record<string, unknown>>(avatarId: string, override: T): T {
  const next = { ...override } as T & {
    voiceGender?: string;
    voiceStyleKey?: string;
    voiceRate?: number;
    voiceAssetId?: string;
    voiceAssetMimeType?: string;
    voiceAssetFileName?: string;
    femaleVoiceAssetId?: string;
    femaleVoiceAssetMimeType?: string;
    femaleVoiceAssetFileName?: string;
    maleVoiceAssetId?: string;
    maleVoiceAssetMimeType?: string;
    maleVoiceAssetFileName?: string;
    voiceAssetsByStyle?: Record<string, unknown>;
  };
  const exactPreset = typeof next.voiceStyleKey === "string"
    ? CUSTOMER_SERVICE_VOICE_PRESETS.find((preset) => preset.key === next.voiceStyleKey)
    : undefined;
  const hasModernVoiceFields = Boolean(
    (typeof next.femaleVoiceAssetId === "string" && next.femaleVoiceAssetId.trim()) ||
    (typeof next.maleVoiceAssetId === "string" && next.maleVoiceAssetId.trim()) ||
    (next.voiceAssetsByStyle && Object.keys(next.voiceAssetsByStyle).length > 0)
  );
  const explicitGender =
    next.voiceGender === "male" || next.voiceGender === "female"
      ? next.voiceGender
      : undefined;
  const resolvedGender = explicitGender || exactPreset?.gender || getDefaultVoiceGenderForAvatar(avatarId);
  if (exactPreset) {
    const resolvedPreset =
      explicitGender && explicitGender !== exactPreset.gender
        ? getCustomerServiceVoicePreset(undefined, explicitGender)
        : getCustomerServiceVoicePreset(exactPreset.key, resolvedGender);
    next.voiceStyleKey = resolvedPreset.key;
    next.voiceGender = resolvedPreset.gender;
    if (typeof next.voiceRate !== "number" || !Number.isFinite(next.voiceRate)) {
      next.voiceRate = resolvedPreset.rate;
    }
  } else if (explicitGender) {
    const resolvedPreset = getCustomerServiceVoicePreset(next.voiceStyleKey, explicitGender);
    next.voiceStyleKey = resolvedPreset.key;
    next.voiceGender = resolvedPreset.gender;
    if (typeof next.voiceRate !== "number" || !Number.isFinite(next.voiceRate)) {
      next.voiceRate = resolvedPreset.rate;
    }
  }
  delete next.voiceAssetId;
  delete next.voiceAssetMimeType;
  delete next.voiceAssetFileName;
  if (avatarId === DEFAULT_FEMALE_VOICE_OVERRIDE_ID || avatarId === DEFAULT_MALE_VOICE_OVERRIDE_ID) {
    delete next.femaleVoiceAssetId;
    delete next.femaleVoiceAssetMimeType;
    delete next.femaleVoiceAssetFileName;
    delete next.maleVoiceAssetId;
    delete next.maleVoiceAssetMimeType;
    delete next.maleVoiceAssetFileName;
  }
  return next;
}

function normalizeSharedStyleConfig(config: SharedStyleConfig): SharedStyleConfig {
  const next: SharedStyleConfig = { ...config };
  next.layoutStyle = normalizeLayoutStyle(next.layoutStyle, next.activeTheme);
  if (next.visualCardLayout && typeof next.visualCardLayout === "object") {
    next.visualCardLayout = cloneVisualCardLayout(next.visualCardLayout);
  } else {
    delete next.visualCardLayout;
  }
  next.sidebarStyle = {
    ...normalizeSidebarStyle(next.sidebarStyle, next.activeTheme),
  };
  next.customThemes = cloneThemes(next.customThemes).map((theme) => ({
    ...theme,
    layout: normalizeLayoutStyle(theme.layout, theme.key),
    sidebar: normalizeSidebarStyle(theme.sidebar, theme.key),
  }));
  next.builtinThemeOverrides = Object.fromEntries(
    Object.entries(cloneThemeMap(next.builtinThemeOverrides)).map(([key, theme]) => [
      key,
      {
        ...theme,
        layout: normalizeLayoutStyle(theme.layout, key),
        sidebar: normalizeSidebarStyle(theme.sidebar, key),
      },
    ])
  );
  if (next.csAvatarOverrides && typeof next.csAvatarOverrides === "object") {
    next.csAvatarOverrides = Object.fromEntries(
      Object.entries(next.csAvatarOverrides).map(([key, value]) => [
        key,
        value && typeof value === "object"
          ? normalizeSharedVoiceOverride(key, value as Record<string, unknown>)
          : value,
      ])
    );
  }
  return next;
}

export function readSharedStyleSettings(siteId?: string | null): SharedStyleConfig | null {
  if (typeof window === "undefined") return null;
  try {
    if (siteId) {
      migrateLegacySiteSharedStyle(siteId);
    }

    const raw = window.localStorage.getItem(PRODUCT_MARKET_SHARED_STYLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SharedStyleConfig;
    if (!parsed?.layoutStyle || !Array.isArray(parsed.products)) return null;
    const normalized = normalizeSharedStyleConfig(parsed);
    if (JSON.stringify(normalized) !== JSON.stringify(parsed)) {
      safeSetLocalStorage(PRODUCT_MARKET_SHARED_STYLE_KEY, JSON.stringify(normalized), { compact: true });
    }
    return normalized;
  } catch {
    return null;
  }
}

export function writeSharedStyleSettings(config: ExportableConfig, siteId?: string | null) {
  if (typeof window === "undefined") return;
  const normalizedSiteId = normalizeSiteId(siteId);
  if (normalizedSiteId) {
    migrateLegacySiteSharedStyle(normalizedSiteId);
  }

  const shared: SharedStyleConfig = {
    layoutStyle: { ...config.layoutStyle },
    visualCardLayout: config.visualCardLayout
      ? cloneVisualCardLayout(config.visualCardLayout)
      : undefined,
    layoutSections: cloneLayoutSections(config.layoutSections),
    customerServiceSections: cloneCustomerServiceSections(config.customerServiceSections),
    activeTheme: config.activeTheme,
    customThemes: cloneThemes(config.customThemes),
    builtinThemeOverrides: cloneThemeMap(config.builtinThemeOverrides),
    sidebarStyle: config.sidebarStyle ? { ...config.sidebarStyle } : undefined,
    globalFontFamily: config.globalFontFamily,
    globalFontWeight: config.globalFontWeight,
    globalLetterSpacing: config.globalLetterSpacing,
    customDefaultPaths: [...(config.customDefaultPaths || [])],
    productOrder: [...(config.productOrder || [])],
    customProducts: cloneCustomProducts(config.customProducts),
    soundEnabled: config.soundEnabled,
    soundVolume: config.soundVolume,
    soundStyle: config.soundStyle,
    csAvatarId: config.csAvatarId,
    csEnabled: config.csEnabled,
    csAvatarOverrides: cloneAvatarOverrides(config.csAvatarOverrides),
    csVoiceEnabled: config.csVoiceEnabled,
    csVoiceGender: config.csVoiceGender,
    csVoiceRate: config.csVoiceRate,
    products: cloneSharedProducts(config.products),
  };

  const normalizedShared = normalizeSharedStyleConfig(shared);
  const saved = safeSetLocalStorage(PRODUCT_MARKET_SHARED_STYLE_KEY, JSON.stringify(normalizedShared), { compact: true });
  if (!saved) {
    throw new Error("shared product-market style save failed");
  }
  window.dispatchEvent(
    new CustomEvent(PRODUCT_MARKET_SHARED_STYLE_EVENT, {
      detail: { source: "shared-style", siteId: normalizedSiteId || null },
    })
  );
}

/**
 * Persist only the visual contract owned by the card editor. This prevents a
 * layout-only sync from replacing products, customer-service media, sounds or
 * other independently managed shared settings with a stale page snapshot.
 */
export function writeSharedVisualContractSettings(config: ExportableConfig, siteId?: string | null) {
  const current = readSharedStyleSettings(siteId);
  if (!current) {
    writeSharedStyleSettings(config, siteId);
    return;
  }
  const normalizedSiteId = normalizeSiteId(siteId);
  const next = normalizeSharedStyleConfig({
    ...current,
    layoutStyle: { ...config.layoutStyle },
    visualCardLayout: config.visualCardLayout
      ? cloneVisualCardLayout(config.visualCardLayout)
      : undefined,
    globalFontFamily: config.globalFontFamily,
    globalFontWeight: config.globalFontWeight,
    globalLetterSpacing: config.globalLetterSpacing,
  });
  const saved = safeSetLocalStorage(PRODUCT_MARKET_SHARED_STYLE_KEY, JSON.stringify(next), { compact: true });
  if (!saved) {
    throw new Error("shared visual contract save failed");
  }
  window.dispatchEvent(
    new CustomEvent(PRODUCT_MARKET_SHARED_STYLE_EVENT, {
      detail: { source: "shared-visual-contract", siteId: normalizedSiteId || null },
    })
  );
}

export function applySharedStyleSettingsToConfig(config: ExportableConfig | null, siteId?: string | null): ExportableConfig | null {
  if (!config) return null;
  const shared = readSharedStyleSettings(siteId);
  if (!shared) return config;
  const rotatedDefaults = resolveRotatedPlanDefaultsForSite(siteId);

  const keepLocalVisualLayout =
    config.layoutCustomized === true && detectLayoutVisualCustomizationAgainstShared(config, siteId);
  const keepLocalLayoutStructure =
    config.layoutStructureCustomized === true && detectLayoutStructureCustomizationAgainstShared(config, siteId);
  const keepLocalCustomerService =
    config.customerServiceCustomized === true && detectCustomerServiceCustomizationAgainstShared(config, siteId);
  const mergedCustomerServiceOverrides = mergeAvatarOverrides(shared.csAvatarOverrides, config.csAvatarOverrides);

  return {
    ...config,
    layoutStyle: keepLocalVisualLayout ? { ...config.layoutStyle } : { ...shared.layoutStyle },
    visualCardLayout: keepLocalLayoutStructure
      ? config.visualCardLayout
        ? cloneVisualCardLayout(config.visualCardLayout)
        : undefined
      : shared.visualCardLayout
        ? cloneVisualCardLayout(shared.visualCardLayout)
        : config.visualCardLayout
          ? cloneVisualCardLayout(config.visualCardLayout)
          : undefined,
    layoutSections: keepLocalLayoutStructure ? cloneLayoutSections(config.layoutSections) : cloneLayoutSections(shared.layoutSections),
    activeTheme: keepLocalVisualLayout ? config.activeTheme : shared.activeTheme,
    customThemes: keepLocalVisualLayout ? config.customThemes : cloneThemes(shared.customThemes),
    builtinThemeOverrides: keepLocalVisualLayout ? config.builtinThemeOverrides : cloneThemeMap(shared.builtinThemeOverrides),
    sidebarStyle: keepLocalVisualLayout
      ? config.sidebarStyle
      : shared.sidebarStyle
        ? { ...shared.sidebarStyle }
        : config.sidebarStyle,
    globalFontFamily: keepLocalVisualLayout ? config.globalFontFamily : (shared.globalFontFamily || config.globalFontFamily),
    globalFontWeight: keepLocalVisualLayout ? config.globalFontWeight : (shared.globalFontWeight || config.globalFontWeight),
    globalLetterSpacing: keepLocalVisualLayout ? config.globalLetterSpacing : (shared.globalLetterSpacing || config.globalLetterSpacing),
    customDefaultPaths: keepLocalLayoutStructure ? config.customDefaultPaths : [...(shared.customDefaultPaths || config.customDefaultPaths || [])],
    productOrder: keepLocalLayoutStructure ? config.productOrder : [...(shared.productOrder || config.productOrder || [])],
    customProducts: keepLocalLayoutStructure ? config.customProducts : cloneCustomProducts(shared.customProducts),
    soundEnabled: keepLocalCustomerService ? config.soundEnabled : (shared.soundEnabled ?? config.soundEnabled),
    soundVolume: keepLocalCustomerService ? config.soundVolume : (shared.soundVolume ?? config.soundVolume),
    soundStyle: keepLocalCustomerService ? config.soundStyle : (shared.soundStyle || config.soundStyle),
    csAvatarId: keepLocalCustomerService
      ? config.csAvatarId
      : (rotatedDefaults?.avatarId || shared.csAvatarId || config.csAvatarId),
    csEnabled: keepLocalCustomerService ? config.csEnabled : (shared.csEnabled ?? config.csEnabled),
    csVoiceEnabled: keepLocalCustomerService ? config.csVoiceEnabled : (shared.csVoiceEnabled ?? config.csVoiceEnabled),
    csVoiceGender: keepLocalCustomerService ? config.csVoiceGender : (shared.csVoiceGender || config.csVoiceGender),
    csVoiceRate: keepLocalCustomerService ? config.csVoiceRate : (shared.csVoiceRate ?? config.csVoiceRate),
    customerServiceSections: keepLocalCustomerService
      ? cloneCustomerServiceSections(config.customerServiceSections)
      : cloneCustomerServiceSections(shared.customerServiceSections),
    csAvatarOverrides: cloneAvatarOverrides(mergedCustomerServiceOverrides),
    products: keepLocalLayoutStructure ? config.products : (cloneSharedProducts(shared.products) as ExportableConfig["products"]),
  };
}
