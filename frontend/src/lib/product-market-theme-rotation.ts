import {
  currentProductMarketConfigKey,
  defaultProductMarketConfigKey,
  readStoredProductMarketConfig,
  writeStoredProductMarketConfig,
} from "@/lib/product-market-config";
import {
  getFactoryBuiltinThemes,
  useProductMarketStore,
  type ExportableConfig,
  type ThemePresetKey,
} from "@/lib/product-market-store";
import { getSiteById } from "@/lib/sites";

const PENDING_THEME_ROTATION_KEY = "product-market-theme-rotation:pending-plan:v1";

export const PRODUCT_MARKET_AVATAR_ROTATION = [
  "pro-female",
  "cute-female",
  "elegant-female",
  "tech-male",
  "friendly-male",
  "strong-male",
] as const;

export const PRODUCT_MARKET_THEME_ROTATION: ThemePresetKey[] = [
  "rose",
  "orange",
  "indigoGreen",
  "tealRose",
  "limeTea",
  "dark",
  "light",
];

type PendingThemeRotation = Record<string, { sequence: number; themeKey: ThemePresetKey; createdAt: string }>;

export function parsePlanSequenceFromText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (!text) continue;

    const codeMatch = text.toUpperCase().match(/J0*([1-9]\d*)/);
    if (codeMatch) return Number(codeMatch[1]) || 0;

    const planMatch = text.match(/(?:计划|plan)\s*([1-9]\d*)/i);
    if (planMatch) return Number(planMatch[1]) || 0;

    const leadingNumberMatch = text.match(/^([1-9]\d*)[\s.、_-]/);
    if (leadingNumberMatch) return Number(leadingNumberMatch[1]) || 0;
  }
  return 0;
}

export function getThemeKeyForPlanSequence(sequence: number): ThemePresetKey {
  const safeSequence = Math.max(1, Math.floor(sequence || 1));
  return PRODUCT_MARKET_THEME_ROTATION[(safeSequence - 1) % PRODUCT_MARKET_THEME_ROTATION.length];
}

export function getAvatarIdForPlanSequence(sequence: number) {
  const safeSequence = Math.max(1, Math.floor(sequence || 1));
  return PRODUCT_MARKET_AVATAR_ROTATION[(safeSequence - 1) % PRODUCT_MARKET_AVATAR_ROTATION.length] || "pro-female";
}

export function resolveRotatedPlanDefaultsForSite(siteId?: string | null) {
  const normalizedSiteId = String(siteId || "").trim();
  if (!normalizedSiteId) return null;
  const activeSite = getSiteById(normalizedSiteId);
  const sequence = parsePlanSequenceFromText(
    activeSite?.planCode,
    activeSite?.planName,
    activeSite?.name,
    activeSite?.slug,
    normalizedSiteId
  );
  if (sequence <= 0) return null;
  return {
    sequence,
    themeKey: getThemeKeyForPlanSequence(sequence),
    avatarId: getAvatarIdForPlanSequence(sequence),
  };
}

function readPendingThemeRotations(): PendingThemeRotation {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PENDING_THEME_ROTATION_KEY) || "{}") as PendingThemeRotation;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writePendingThemeRotations(data: PendingThemeRotation) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PENDING_THEME_ROTATION_KEY, JSON.stringify(data));
}

export function recordPendingProductMarketTheme(planCode: string | null | undefined, sequence: number) {
  const normalizedPlanCode = String(planCode || "").trim().toUpperCase();
  if (!normalizedPlanCode) return null;
  const themeKey = getThemeKeyForPlanSequence(sequence);
  const pending = readPendingThemeRotations();
  pending[normalizedPlanCode] = {
    sequence: Math.max(1, Math.floor(sequence || 1)),
    themeKey,
    createdAt: new Date().toISOString(),
  };
  writePendingThemeRotations(pending);
  return pending[normalizedPlanCode];
}

function resolvePendingProductMarketTheme(planCode?: string | null) {
  const normalizedPlanCode = String(planCode || "").trim().toUpperCase();
  if (!normalizedPlanCode) return null;
  return readPendingThemeRotations()[normalizedPlanCode] || null;
}

function cloneConfig(config: ExportableConfig): ExportableConfig {
  return JSON.parse(JSON.stringify(config)) as ExportableConfig;
}

function readBaseConfig(siteId?: string | null) {
  return (
    readStoredProductMarketConfig(currentProductMarketConfigKey("client", siteId)) ||
    readStoredProductMarketConfig(defaultProductMarketConfigKey("client", siteId)) ||
    readStoredProductMarketConfig(currentProductMarketConfigKey("client")) ||
    readStoredProductMarketConfig(defaultProductMarketConfigKey("client")) ||
    readStoredProductMarketConfig(currentProductMarketConfigKey("hq")) ||
    readStoredProductMarketConfig(defaultProductMarketConfigKey("hq")) ||
    useProductMarketStore.getState().exportConfig()
  );
}

export function applyProductMarketTheme(config: ExportableConfig, themeKey: ThemePresetKey): ExportableConfig {
  const preset = getFactoryBuiltinThemes().find((theme) => theme.key === themeKey);
  if (!preset) return cloneConfig(config);

  return {
    ...cloneConfig(config),
    layoutStyle: { ...preset.layout },
    sidebarStyle: { ...preset.sidebar },
    globalFontFamily: preset.fontFamily || config.globalFontFamily,
    activeTheme: preset.key,
    layoutCustomized: true,
    products: config.products.map((product) => {
      const colors =
        preset[
          product.status === "active"
            ? "cardActive"
            : product.status === "hidden"
              ? "cardHidden"
              : "cardInactive"
        ];
      return {
        ...product,
        customStyle: {
          ...(product.customStyle || {}),
          bgColor: colors.bg,
          borderColor: colors.border,
          fontColor: colors.font,
          buttonColor: colors.button,
          nameFontColor: colors.nameFont || colors.font,
        },
      };
    }),
  };
}

export function persistRotatingProductMarketThemeForSite(
  siteId: string | null | undefined,
  options: {
    planCode?: string | null;
    planName?: string | null;
    fallbackSequence?: number;
    force?: boolean;
  } = {}
) {
  const normalizedSiteId = String(siteId || "").trim();
  if (!normalizedSiteId) return null;

  const existing =
    readStoredProductMarketConfig(currentProductMarketConfigKey("client", normalizedSiteId)) ||
    readStoredProductMarketConfig(defaultProductMarketConfigKey("client", normalizedSiteId));
  if (existing?.layoutCustomized && !options.force) return existing;

  const pending = resolvePendingProductMarketTheme(options.planCode);
  const sequence =
    pending?.sequence ||
    parsePlanSequenceFromText(options.planCode, options.planName) ||
    Math.max(1, Math.floor(options.fallbackSequence || 1));
  const themeKey = pending?.themeKey || getThemeKeyForPlanSequence(sequence);
  const nextConfig = applyProductMarketTheme(readBaseConfig(normalizedSiteId), themeKey);

  writeStoredProductMarketConfig(currentProductMarketConfigKey("client", normalizedSiteId), nextConfig);
  writeStoredProductMarketConfig(defaultProductMarketConfigKey("client", normalizedSiteId), nextConfig);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("product-market-theme-rotation-applied", {
        detail: { siteId: normalizedSiteId, planCode: options.planCode || null, themeKey, sequence },
      })
    );
  }
  return nextConfig;
}
