export type NewestLargeSequenceOrderKey = {
  sequence?: number | null;
  createdAt?: string | number | null;
  stableId?: string | null;
};

function normalizeSequence(value: number | null | undefined) {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : undefined;
}

function normalizeCreatedAt(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

/**
 * Shared library/history order: the larger persistent number represents the
 * newer record and is therefore displayed first. Equal or missing numbers
 * fall back to the newest timestamp, then a deterministic descending id.
 */
export function compareNewestLargeSequenceFirst(
  left: NewestLargeSequenceOrderKey,
  right: NewestLargeSequenceOrderKey,
) {
  const leftSequence = normalizeSequence(left.sequence);
  const rightSequence = normalizeSequence(right.sequence);
  if (leftSequence !== undefined || rightSequence !== undefined) {
    if (leftSequence === undefined) return 1;
    if (rightSequence === undefined) return -1;
    const sequenceDiff = rightSequence - leftSequence;
    if (sequenceDiff !== 0) return sequenceDiff;
  }

  const createdAtDiff = normalizeCreatedAt(right.createdAt) - normalizeCreatedAt(left.createdAt);
  if (createdAtDiff !== 0) return createdAtDiff;

  return String(right.stableId || "").localeCompare(String(left.stableId || ""), "zh-CN", {
    numeric: true,
    sensitivity: "base",
  });
}
