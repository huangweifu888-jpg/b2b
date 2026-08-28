export type SocialPageBindingStatus = "pending_oauth" | "waiting_server_sync";

/**
 * A customer-selected real page. It is deliberately an intent record until the
 * server has validated an official OAuth callback and selected page asset.
 */
export type SocialPageBinding = {
  id: string;
  connectionId: string;
  platform: string;
  pageName: string;
  pageUrl: string;
  assetReference: string;
  status: SocialPageBindingStatus;
  createdAt: string;
  updatedAt: string;
};

/** The server writes official API data; staff may record a verified official export while a connector is being prepared. */
export type SocialOfficialMetricSnapshot = {
  id: string;
  pageBindingId: string;
  capturedAt: string;
  source: "official_api" | "verified_manual";
  followers?: number;
  impressions?: number;
  engagements?: number;
  views?: number;
  clicks?: number;
};

export type SocialPageSyncPolicy = {
  frequency: "manual" | "daily";
  historyDays: "30" | "90" | "180" | "365";
};

export const DEFAULT_SOCIAL_PAGE_SYNC_POLICY: SocialPageSyncPolicy = {
  frequency: "daily",
  historyDays: "180",
};

export function socialPageBindingStorageKey(siteId?: string | null) {
  return `tradepro.social.page-bindings.${siteId || "default"}`;
}

export function socialOfficialMetricSnapshotStorageKey(siteId?: string | null) {
  return `tradepro.social.official-metric-snapshots.${siteId || "default"}`;
}

export function socialPageSyncPolicyStorageKey(siteId?: string | null) {
  return `tradepro.social.page-sync-policy.${siteId || "default"}`;
}

function readArray<T>(storageKey: string, validate: (value: unknown) => value is T): T[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(validate) : [];
  } catch {
    return [];
  }
}

export function readSocialPageBindings(siteId?: string | null): SocialPageBinding[] {
  return readArray(socialPageBindingStorageKey(siteId), (value): value is SocialPageBinding => {
    if (!value || typeof value !== "object") return false;
    const item = value as Partial<SocialPageBinding>;
    return typeof item.id === "string" && typeof item.connectionId === "string" && typeof item.platform === "string" && typeof item.pageName === "string" && typeof item.pageUrl === "string" && typeof item.assetReference === "string" && (item.status === "pending_oauth" || item.status === "waiting_server_sync") && typeof item.createdAt === "string" && typeof item.updatedAt === "string";
  });
}

export function saveSocialPageBindings(siteId: string | null | undefined, bindings: SocialPageBinding[]) {
  window.localStorage.setItem(socialPageBindingStorageKey(siteId), JSON.stringify(bindings));
}

export function readSocialOfficialMetricSnapshots(siteId?: string | null): SocialOfficialMetricSnapshot[] {
  return readArray(socialOfficialMetricSnapshotStorageKey(siteId), (value): value is SocialOfficialMetricSnapshot => {
    if (!value || typeof value !== "object") return false;
    const item = value as Partial<SocialOfficialMetricSnapshot>;
    return typeof item.id === "string" && typeof item.pageBindingId === "string" && typeof item.capturedAt === "string" && (item.source === "official_api" || item.source === "verified_manual");
  });
}

export function readSocialPageSyncPolicy(siteId?: string | null): SocialPageSyncPolicy {
  try {
    const raw = window.localStorage.getItem(socialPageSyncPolicyStorageKey(siteId));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return DEFAULT_SOCIAL_PAGE_SYNC_POLICY;
    const policy = parsed as Partial<SocialPageSyncPolicy>;
    return {
      frequency: policy.frequency === "manual" ? "manual" : "daily",
      historyDays: policy.historyDays === "30" || policy.historyDays === "90" || policy.historyDays === "365" ? policy.historyDays : "180",
    };
  } catch {
    return DEFAULT_SOCIAL_PAGE_SYNC_POLICY;
  }
}

export function saveSocialPageSyncPolicy(siteId: string | null | undefined, policy: SocialPageSyncPolicy) {
  window.localStorage.setItem(socialPageSyncPolicyStorageKey(siteId), JSON.stringify(policy));
}

export function getLatestOfficialSnapshot(pageBindingId: string, snapshots: readonly SocialOfficialMetricSnapshot[]) {
  return snapshots
    .filter((snapshot) => snapshot.pageBindingId === pageBindingId)
    .sort((left, right) => Date.parse(right.capturedAt) - Date.parse(left.capturedAt))[0] ?? null;
}

export function isApprovedSocialPageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}
