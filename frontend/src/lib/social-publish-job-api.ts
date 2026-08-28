import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

const BASE = "/api/v1/social-publish-jobs";

export type SocialPublishJobRecord = {
  id: string;
  project_id: number;
  content_review_id: string;
  provider: string;
  idempotency_key: string;
  status: "blocked" | "queued" | "dispatched";
  block_reasons: string[];
  scheduled_for?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  external_dispatch_started: false;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = authApi.getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${getAPIBaseURL()}${BASE}${path}`, { ...init, headers });
  if (!response.ok) throw new Error(`Social publish job API: ${response.status}`);
  return response.json() as Promise<T>;
}

export const socialPublishJobApi = {
  list: (projectId: number) => request<{ items: SocialPublishJobRecord[] }>(`?project_id=${encodeURIComponent(projectId)}`),
  create: (payload: { project_id: number; content_review_id: string; provider: string; idempotency_key: string; scheduled_for?: string }) =>
    request<SocialPublishJobRecord>("", { method: "POST", body: JSON.stringify(payload) }),
};
