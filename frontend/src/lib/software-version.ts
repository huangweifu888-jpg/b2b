export const HQ_SOFTWARE_VERSION = "H38700";
export const HQ_SOFTWARE_VERSION_NUMBER = 38700;
export const HQ_SOURCE_FINGERPRINT = "753d36a1e2e005eace29408f326ca9f6ab18fbb34bb08eba3755f492a4d083d8";
export const HQ_SOFTWARE_UPDATE_ID = "2026-08-28-hq-h38700-auto-source-tracker";
export const HQ_SOFTWARE_UPDATE_TITLE = "总部源码自动推进";
export const HQ_SOFTWARE_UPDATE_SUMMARY = "自动检测到 5 个受跟踪源码变动：frontend/src/components/AIServiceWidget.tsx、frontend/src/components/customer-service/CustomerServiceAvatarMedia.tsx、frontend/src/components/product-market/ProductMarketCategoryIdentityIcon.tsx、frontend/src/page-factory/phase-two-verification.json、frontend/src/pages/ProductMarket.tsx。";
export const HQ_SOFTWARE_UPDATE_CREATED_AT = "2026-08-28T10:47:27.681Z";

export function parseVersionNumber(value?: string | null) {
  if (!value) return 0;
  const match = String(value).toUpperCase().match(/[A-Z]+(\d+)/);
  return match ? Number(match[1]) || 0 : 0;
}

export function pickNewestVersion(...values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => parseVersionNumber(right) - parseVersionNumber(left))[0];
}
