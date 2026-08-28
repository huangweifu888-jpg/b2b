export const HQ_SOFTWARE_VERSION = "H38701";
export const HQ_SOFTWARE_VERSION_NUMBER = 38701;
export const HQ_SOURCE_FINGERPRINT = "c234acdf09bc693266cde9020bcbc9f5dbed071085e4c8c590c64deb40e0ff47";
export const HQ_SOFTWARE_UPDATE_ID = "2026-08-28-hq-h38701-auto-source-tracker";
export const HQ_SOFTWARE_UPDATE_TITLE = "总部源码自动推进";
export const HQ_SOFTWARE_UPDATE_SUMMARY = "自动检测到 2 个受跟踪源码变动：frontend/src/components/customer-service/CustomerServiceAvatarMedia.tsx、frontend/src/page-factory/phase-two-verification.json。";
export const HQ_SOFTWARE_UPDATE_CREATED_AT = "2026-08-28T10:58:38.218Z";

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
