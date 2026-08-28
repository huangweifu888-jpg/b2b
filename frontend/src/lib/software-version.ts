export const HQ_SOFTWARE_VERSION = "H38712";
export const HQ_SOFTWARE_VERSION_NUMBER = 38712;
export const HQ_SOURCE_FINGERPRINT = "ecc9f7a030e7c73f0d46891b830b0abeb8420a0cfedfa567008bf0a38cdd9219";
export const HQ_SOFTWARE_UPDATE_ID = "2026-08-28-hq-h38712-auto-source-tracker";
export const HQ_SOFTWARE_UPDATE_TITLE = "总部源码自动推进";
export const HQ_SOFTWARE_UPDATE_SUMMARY = "自动检测到 1 个受跟踪源码变动：frontend/src/page-factory/phase-two-verification.json。";
export const HQ_SOFTWARE_UPDATE_CREATED_AT = "2026-08-28T21:00:04.326Z";

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
