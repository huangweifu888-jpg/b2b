import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

const BASE = "/api/v1/social-page-assets";

export type SocialPageAssetRecord = {
  id: string;
  project_id: number;
  authorization_request_id?: string | null;
  provider: string;
  display_name: string;
  page_url: string;
  asset_reference: string;
  status: "awaiting_oauth" | "ready_for_sync" | string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type SocialPageMetricSnapshotRecord = {
  id: string;
  project_id: number;
  page_asset_id: string;
  source: "official_api" | "verified_manual";
  captured_at: string;
  followers?: number | null;
  impressions?: number | null;
  engagements?: number | null;
  views?: number | null;
  clicks?: number | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = authApi.getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${getAPIBaseURL()}${BASE}${path}`, { ...init, headers });
  if (!response.ok) throw new Error(`Social page assets API: ${response.status}`);
  return response.json() as Promise<T>;
}

export const socialPageAssetsApi = {
  list: (projectId: number) => request<{ items: SocialPageAssetRecord[] }>(`?project_id=${encodeURIComponent(projectId)}`),
  create: (payload: { project_id: number; provider: string; display_name: string; page_url: string; asset_reference: string; authorization_request_id?: string }) =>
    request<SocialPageAssetRecord>("", { method: "POST", body: JSON.stringify(payload) }),
  listSnapshots: (projectId: number, pageAssetId: string) => request<{ items: SocialPageMetricSnapshotRecord[] }>(`/${encodeURIComponent(pageAssetId)}/snapshots?project_id=${encodeURIComponent(projectId)}`),
  createVerifiedSnapshot: (projectId: number, pageAssetId: string, payload: { captured_at?: string; followers?: number; impressions?: number; engagements?: number; views?: number; clicks?: number }) =>
    request<SocialPageMetricSnapshotRecord>(`/${encodeURIComponent(pageAssetId)}/snapshots?project_id=${encodeURIComponent(projectId)}`, { method: "POST", body: JSON.stringify(payload) }),
  requestSync: (projectId: number, pageAssetId: string) => request<{ id: string; status: string; block_reasons: string[] }>(`/${encodeURIComponent(pageAssetId)}/sync-requests?project_id=${encodeURIComponent(projectId)}`, { method: "POST" }),
};
