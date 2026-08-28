import {
  DEVELOPER_GLOBAL_FRAME_SECTION_NAME,
  DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
} from "@/lib/developer-global-frame-draft";

export const DEVELOPER_GLOBAL_FRAME_PUBLISHED_EVENT = "tradepro:developer-global-frame-published" as const;
export const DEVELOPER_GLOBAL_FRAME_PUBLISHED_STORAGE_KEY = "tradepro:developer-global-frame-published.v1" as const;

export type DeveloperGlobalFramePublishedEventDetail = {
  templateId: typeof DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID;
  section: typeof DEVELOPER_GLOBAL_FRAME_SECTION_NAME;
  version: string;
  publishedAt: string;
  nonce: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseDeveloperGlobalFramePublishedEventDetail(value: unknown): DeveloperGlobalFramePublishedEventDetail | null {
  if (!isRecord(value)
    || value.templateId !== DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID
    || value.section !== DEVELOPER_GLOBAL_FRAME_SECTION_NAME
    || typeof value.version !== "string"
    || !/^v?\d+\.\d+\.\d+$/u.test(value.version)
    || typeof value.publishedAt !== "string"
    || !Number.isFinite(Date.parse(value.publishedAt))
    || typeof value.nonce !== "string"
    || !value.nonce.trim()) return null;
  return value as DeveloperGlobalFramePublishedEventDetail;
}

export function readDeveloperGlobalFramePublishedStorageEvent(event: StorageEvent) {
  if (event.key !== DEVELOPER_GLOBAL_FRAME_PUBLISHED_STORAGE_KEY || !event.newValue) return null;
  try {
    return parseDeveloperGlobalFramePublishedEventDetail(JSON.parse(event.newValue));
  } catch {
    return null;
  }
}

export function readLatestDeveloperGlobalFramePublishedEvent() {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(DEVELOPER_GLOBAL_FRAME_PUBLISHED_STORAGE_KEY);
    return value ? parseDeveloperGlobalFramePublishedEventDetail(JSON.parse(value)) : null;
  } catch {
    return null;
  }
}

export function dispatchDeveloperGlobalFramePublishedEvent(input: {
  templateId: string;
  section: string;
  version: string;
  publishedAt?: string | null;
}) {
  const publishedAt = input.publishedAt && Number.isFinite(Date.parse(input.publishedAt))
    ? input.publishedAt
    : new Date().toISOString();
  const detail = parseDeveloperGlobalFramePublishedEventDetail({
    templateId: input.templateId,
    section: input.section,
    version: input.version,
    publishedAt,
    nonce: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });
  if (!detail || typeof window === "undefined") return null;
  window.dispatchEvent(new CustomEvent<DeveloperGlobalFramePublishedEventDetail>(
    DEVELOPER_GLOBAL_FRAME_PUBLISHED_EVENT,
    { detail },
  ));
  try {
    window.localStorage.setItem(DEVELOPER_GLOBAL_FRAME_PUBLISHED_STORAGE_KEY, JSON.stringify(detail));
  } catch {
    // Same-tab invalidation already fired; storage is only a cross-tab enhancement.
  }
  return detail;
}
