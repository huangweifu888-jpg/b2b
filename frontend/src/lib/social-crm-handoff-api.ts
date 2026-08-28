import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

const BASE = "/api/v1/social-crm-handoffs";

export type SocialCrmHandoffRecord = {
  id: string;
  project_id: number;
  provider: string;
  contact_reference: string;
  lead_summary: string;
  status: "pending_manual_review" | "approved_for_crm" | "returned" | "dispatched";
  review_required: boolean;
  review_note?: string | null;
  created_at?: string | null;
  reviewed_at?: string | null;
  dispatched_at?: string | null;
  external_dispatch_started: false;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = authApi.getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${getAPIBaseURL()}${BASE}${path}`, { ...init, headers });
  if (!response.ok) throw new Error(`Social CRM handoff API: ${response.status}`);
  return response.json() as Promise<T>;
}

export const socialCrmHandoffApi = {
  list: (projectId: number) => request<{ items: SocialCrmHandoffRecord[] }>(`?project_id=${encodeURIComponent(projectId)}`),
  create: (payload: { project_id: number; provider: string; contact_reference: string; lead_summary: string }) =>
    request<SocialCrmHandoffRecord>("", { method: "POST", body: JSON.stringify(payload) }),
};
