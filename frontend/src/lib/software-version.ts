export const HQ_SOFTWARE_VERSION = "H38695";
export const HQ_SOFTWARE_VERSION_NUMBER = 38695;
export const HQ_SOURCE_FINGERPRINT = "ac77ce6aee86ebe815c8ada673fe4c40f966d37fbff0e1ecf64432618738170c";
export const HQ_SOFTWARE_UPDATE_ID = "2026-08-28-hq-h38695-auto-source-tracker";
export const HQ_SOFTWARE_UPDATE_TITLE = "总部源码自动推进";
export const HQ_SOFTWARE_UPDATE_SUMMARY = "自动检测到 2 个受跟踪源码变动：frontend/package.json、frontend/scripts/verify-developer-workflow-run.mjs。";
export const HQ_SOFTWARE_UPDATE_CREATED_AT = "2026-08-28T10:01:13.061Z";

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
