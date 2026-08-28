export const HQ_SOFTWARE_VERSION = "H38697";
export const HQ_SOFTWARE_VERSION_NUMBER = 38697;
export const HQ_SOURCE_FINGERPRINT = "0b1cde45fed7960ce2f47a09c26a9524fb2ba9bb42e4f406423853154773526a";
export const HQ_SOFTWARE_UPDATE_ID = "2026-08-28-hq-h38697-auto-source-tracker";
export const HQ_SOFTWARE_UPDATE_TITLE = "总部源码自动推进";
export const HQ_SOFTWARE_UPDATE_SUMMARY = "自动检测到 1 个受跟踪源码变动：frontend/scripts/verify-local-env-recovery-contract.mjs。";
export const HQ_SOFTWARE_UPDATE_CREATED_AT = "2026-08-28T10:16:47.774Z";

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
