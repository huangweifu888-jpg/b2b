export const HQ_SOFTWARE_VERSION = "H38696";
export const HQ_SOFTWARE_VERSION_NUMBER = 38696;
export const HQ_SOURCE_FINGERPRINT = "db856e9defc9a4518949eeeca43ae18c3f11c2ce2ec67cbdb81c0ca4482afc47";
export const HQ_SOFTWARE_UPDATE_ID = "2026-08-28-hq-h38696-auto-source-tracker";
export const HQ_SOFTWARE_UPDATE_TITLE = "总部源码自动推进";
export const HQ_SOFTWARE_UPDATE_SUMMARY = "自动检测到 1 个受跟踪源码变动：backend/routers/local_dev.py。";
export const HQ_SOFTWARE_UPDATE_CREATED_AT = "2026-08-28T10:06:19.050Z";

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
