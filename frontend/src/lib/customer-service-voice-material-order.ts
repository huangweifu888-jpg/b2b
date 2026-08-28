import type { MaterialAssetItem } from "./material-assets";
import { formatDisplayOrdinal } from "./display-number-contract";
import { compareNewestLargeSequenceFirst } from "./newest-large-sequence-order-contract";
import { sanitizeDisplayText } from "./text-sanitizer";

type VoiceMaterialOrderItem = Pick<MaterialAssetItem, "assetId" | "fileName" | "createdAt" | "systemManaged">;

export const CUSTOMER_SERVICE_FIXED_VOICE_SEQUENCE_END = 12;
export const CUSTOMER_SERVICE_NEW_VOICE_SEQUENCE_START = 16;

/** Resolve the permanent display sequence stored in the physical filename. */
export function resolveStoredVoiceMaterialSequence(fileName?: string | null): number | undefined {
  const matched = sanitizeDisplayText(fileName, "").trim().match(/^(\d+)[._-]/);
  if (!matched) return undefined;
  const sequence = Number(matched[1]);
  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : undefined;
}

/**
 * User-uploaded voice materials are displayed newest-first by their permanent
 * 16+ filename sequence. Array position never becomes a display sequence.
 */
export function orderUploadedVoiceMaterialsNewestFirst<T extends VoiceMaterialOrderItem>(items: readonly T[]) {
  return [...items].sort((a, b) => compareNewestLargeSequenceFirst(
    { sequence: resolveStoredVoiceMaterialSequence(a.fileName), createdAt: a.createdAt, stableId: a.assetId },
    { sequence: resolveStoredVoiceMaterialSequence(b.fileName), createdAt: b.createdAt, stableId: b.assetId },
  ));
}

/**
 * A single library contains every reusable voice. Its stable filename number
 * is also its library position: protected expert voices stay 01-12 and new
 * materials keep their assigned 16+ numbers even after filtering.
 */
export function orderCustomerServiceVoiceLibrary<T extends VoiceMaterialOrderItem>(items: readonly T[]) {
  return [...items].sort((a, b) => compareNewestLargeSequenceFirst(
    { sequence: resolveStoredVoiceMaterialSequence(a.fileName), createdAt: a.createdAt, stableId: a.assetId },
    { sequence: resolveStoredVoiceMaterialSequence(b.fileName), createdAt: b.createdAt, stableId: b.assetId },
  ));
}

export function formatCustomerServiceVoiceLibraryDisplayFileName(fileName: string | null | undefined, stableSequence: number) {
  const label = sanitizeDisplayText(fileName, "未命名朗音")
    .replace(/^\d+[.．、_-]\s*/, "")
    .trim() || "未命名朗音";
  return `${formatDisplayOrdinal(stableSequence)}.${label}`;
}
