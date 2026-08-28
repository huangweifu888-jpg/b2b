import type { MaterialAssetItem } from "./material-assets";
import { formatDisplayOrdinal } from "./display-number-contract";
import { compareNewestLargeSequenceFirst } from "./newest-large-sequence-order-contract";
import { sanitizeDisplayText } from "./text-sanitizer";

type AvatarMaterialOrderItem = Pick<MaterialAssetItem, "assetId" | "fileName" | "createdAt">;

export const CUSTOMER_SERVICE_FIXED_EXPERT_SEQUENCE_END = 12;
export const CUSTOMER_SERVICE_RESERVED_AVATAR_SEQUENCE_END = 15;
export const CUSTOMER_SERVICE_NEW_AVATAR_SEQUENCE_START = 16;

/**
 * The numeric filename prefix is the persistent material identity. It must
 * survive sorting and filtering, so callers must never derive this number
 * from the current array index.
 */
export function resolveStoredAvatarMaterialSequence(fileName?: string | null): number | undefined {
  const matched = sanitizeDisplayText(fileName, "").trim().match(/^(\d+)[._-]/);
  if (!matched) return undefined;
  const sequence = Number(matched[1]);
  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : undefined;
}

/**
 * New avatar uploads use persistent filename sequences beginning at 16. The
 * larger sequence is newer, while experts 01-12 and reserved avatars 13-15
 * keep their identities permanently.
 */
export function orderUploadedAvatarMaterialsNewestFirst<T extends AvatarMaterialOrderItem>(items: readonly T[]) {
  return [...items].sort((a, b) => compareNewestLargeSequenceFirst(
    { sequence: resolveStoredAvatarMaterialSequence(a.fileName), createdAt: a.createdAt, stableId: a.assetId },
    { sequence: resolveStoredAvatarMaterialSequence(b.fileName), createdAt: b.createdAt, stableId: b.assetId },
  ));
}

export function formatUploadedAvatarDisplayFileName(fileName: string | null | undefined, stableSequence: number) {
  const label = sanitizeDisplayText(fileName, "未命名头像")
    .replace(/^\d+[.．、_-]\s*/, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]\d{2,4}$/, "")
    .trim() || "未命名头像";
  return `${formatDisplayOrdinal(stableSequence)}.${label}`;
}
