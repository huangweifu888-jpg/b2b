import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

const BASE = "/api/v1/release-rollouts";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = authApi.getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${getAPIBaseURL()}${BASE}${path}`, { ...init, headers });
  if (!response.ok) throw new Error(`发布控制请求失败：${response.status}`);
  return response.json() as Promise<T>;
}

export type ReleaseStage = { stage_key: string; stage_label: string; sequence: number; status: string; note?: string | null };
export type ReleaseRollout = { id: number; version: string; release_role: string; deployment_id: string; manifest_sha256: string; change_summary?: string | null; status: string; current_stage?: string | null; rollback_reason?: string | null; stages: ReleaseStage[] };

export const releaseRolloutsApi = {
  list: async () => (await request<{ items: ReleaseRollout[] }>("")).items,
  create: (payload: { version: string; releaseRole: "hq" | "agency" | "client"; deploymentId: string; manifestSha256: string; changeSummary?: string }) => request<ReleaseRollout>("", { method: "POST", body: JSON.stringify({ version: payload.version, release_role: payload.releaseRole, deployment_id: payload.deploymentId, manifest_sha256: payload.manifestSha256, change_summary: payload.changeSummary || null }) }),
  action: (rolloutId: number, stageKey: string, action: "start" | "approve" | "fail", note?: string) => request<ReleaseRollout>(`/${rolloutId}/action`, { method: "POST", body: JSON.stringify({ stage_key: stageKey, action, note: note || null }) }),
  rollback: (rolloutId: number, reason: string) => request<ReleaseRollout>(`/${rolloutId}/rollback`, { method: "POST", body: JSON.stringify({ reason }) }),
};
