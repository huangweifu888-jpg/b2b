export const HQ_SOFTWARE_VERSION = "H38692";
export const HQ_SOFTWARE_VERSION_NUMBER = 38692;
export const HQ_SOURCE_FINGERPRINT = "2e8fd3f1af7fcbfeb499fb04632b553ef48eea3f4f7127cf0c94bf57f82ba544";
export const HQ_SOFTWARE_UPDATE_ID = "2026-08-28-hq-h38692-auto-source-tracker";
export const HQ_SOFTWARE_UPDATE_TITLE = "总部源码自动推进";
export const HQ_SOFTWARE_UPDATE_SUMMARY = "自动检测到 5 个受跟踪源码变动：frontend/scripts/verify-performance-governance-workbench-contract.mjs、frontend/scripts/verify-runtime-wakeup-storage-cache-contract.mjs、frontend/src/components/product-market/DevelopmentStandardApplyConsole.tsx、frontend/src/lib/developer-optimization-contract.ts、frontend/src/page-factory/phase-two-verification.json。";
export const HQ_SOFTWARE_UPDATE_CREATED_AT = "2026-08-28T07:34:45.464Z";

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
