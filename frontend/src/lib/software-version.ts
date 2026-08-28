export const HQ_SOFTWARE_VERSION = "H38693";
export const HQ_SOFTWARE_VERSION_NUMBER = 38693;
export const HQ_SOURCE_FINGERPRINT = "2db84e033b03a30192b071d34f0bd247d7157caaa245e5dfc5093f23d77541e4";
export const HQ_SOFTWARE_UPDATE_ID = "2026-08-28-hq-h38693-auto-source-tracker";
export const HQ_SOFTWARE_UPDATE_TITLE = "总部源码自动推进";
export const HQ_SOFTWARE_UPDATE_SUMMARY = "自动检测到 22 个受跟踪源码变动：backend/core/database.py、backend/published_sites.json、backend/routers/local_dev.py、backend/routers/version_backups.py、backend/services/aihub.py、frontend/scripts/hq-version-utils.mjs 等。";
export const HQ_SOFTWARE_UPDATE_CREATED_AT = "2026-08-28T09:21:44.360Z";

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
