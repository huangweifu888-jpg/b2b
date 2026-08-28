export const HQ_SOFTWARE_VERSION = "H38698";
export const HQ_SOFTWARE_VERSION_NUMBER = 38698;
export const HQ_SOURCE_FINGERPRINT = "06d523d80b64e76272e95d2b72db6b0bc45838ed51983cce949094e725bfe5d2";
export const HQ_SOFTWARE_UPDATE_ID = "2026-08-28-hq-h38698-auto-source-tracker";
export const HQ_SOFTWARE_UPDATE_TITLE = "总部源码自动推进";
export const HQ_SOFTWARE_UPDATE_SUMMARY = "自动检测到 4 个受跟踪源码变动：frontend/src/components/AIServiceWidget.tsx、frontend/src/components/product-market/ProductMarketCategoryIdentityIcon.tsx、frontend/src/page-factory/phase-two-verification.json、frontend/src/pages/ProductMarket.tsx。";
export const HQ_SOFTWARE_UPDATE_CREATED_AT = "2026-08-28T10:36:48.437Z";

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
