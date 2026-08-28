export const HQ_SOFTWARE_VERSION = "H38702";
export const HQ_SOFTWARE_VERSION_NUMBER = 38702;
export const HQ_SOURCE_FINGERPRINT = "1bf4541c364b9da3e0c830bc7ff63c76352b8349334057eafd54aa2b5ba56568";
export const HQ_SOFTWARE_UPDATE_ID = "2026-08-28-hq-h38702-auto-source-tracker";
export const HQ_SOFTWARE_UPDATE_TITLE = "总部源码自动推进";
export const HQ_SOFTWARE_UPDATE_SUMMARY = "自动检测到 4 个受跟踪源码变动：frontend/src/lib/developer-design-integration.ts、frontend/src/lib/developer-optimization-contract.ts、frontend/src/lib/media-optimization-contract.ts、frontend/src/page-factory/phase-two-verification.json。";
export const HQ_SOFTWARE_UPDATE_CREATED_AT = "2026-08-28T11:17:59.909Z";

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
