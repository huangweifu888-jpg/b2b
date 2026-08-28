/**
 * Shared presentation contract for human-facing sequence numbers.
 *
 * It is deliberately limited to ordinal labels such as 排号、步骤 and display
 * order. Do not use it for quantities, money, percentages, dates, versions or
 * identifiers whose original numeric value is part of their business meaning.
 */
export const DISPLAY_ORDINAL_WIDTH = 2;

export function formatDisplayOrdinal(value: number | null | undefined, fallback = "--"): string {
  if (!Number.isFinite(value)) return fallback;
  const normalized = Math.trunc(value as number);
  if (normalized < 0) return `-${String(Math.abs(normalized)).padStart(DISPLAY_ORDINAL_WIDTH, "0")}`;
  return String(normalized).padStart(DISPLAY_ORDINAL_WIDTH, "0");
}

export function formatDisplayOrdinalPath(values: Array<number | null | undefined>, separator = "."): string {
  return values.map((value) => formatDisplayOrdinal(value)).join(separator);
}
