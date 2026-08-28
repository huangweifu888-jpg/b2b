export const HQ_SOFTWARE_VERSION = "H38694";
export const HQ_SOFTWARE_VERSION_NUMBER = 38694;
export const HQ_SOURCE_FINGERPRINT = "d2d0fbb21b87a76ae3b783b57d08961bedd13ea68a0870fbe6b6eb542f73165f";
export const HQ_SOFTWARE_UPDATE_ID = "2026-08-28-hq-h38694-auto-source-tracker";
export const HQ_SOFTWARE_UPDATE_TITLE = "总部源码自动推进";
export const HQ_SOFTWARE_UPDATE_SUMMARY = "自动检测到 2 个受跟踪源码变动：backend/requirements.lock.txt、frontend/package.json。";
export const HQ_SOFTWARE_UPDATE_CREATED_AT = "2026-08-28T09:30:57.898Z";

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
