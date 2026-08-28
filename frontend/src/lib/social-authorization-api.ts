import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

const BASE = "/api/v1/social-authorization";

export type SocialAuthorizationRequestRecord = {
  id: string;
  project_id: number;
  provider: string;
  account_label: string;
  market: "overseas" | "china";
  requested_scopes: string[];
  status: "awaiting_headquarters_app" | "ready_for_oauth" | "cancelled";
  created_at?: string | null;
  cancelled_at?: string | null;
};

export type SocialOAuthApplicationRecord = {
  provider: string;
  status: "draft" | "review" | "active" | "suspended";
  redirect_configured: boolean;
  secret_configured: boolean;
  approved_scopes: string[];
  updated_at?: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = authApi.getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(`${getAPIBaseURL()}${BASE}${path}`, { ...init, headers });
  if (!response.ok) throw new Error(`Social authorization API: ${response.status}`);
  return response.json() as Promise<T>;
}

export const socialAuthorizationApi = {
  listApplications: () => request<{ items: SocialOAuthApplicationRecord[] }>("/applications"),
  saveApplication: (provider: string, payload: { status: SocialOAuthApplicationRecord["status"]; client_id_reference?: string; secret_reference?: string; redirect_uri?: string; approved_scopes?: string[] }) =>
    request<SocialOAuthApplicationRecord>(`/applications/${encodeURIComponent(provider)}`, { method: "PUT", body: JSON.stringify(payload) }),
  listRequests: (projectId: number) => request<{ items: SocialAuthorizationRequestRecord[] }>(`/requests?project_id=${encodeURIComponent(projectId)}`),
  createRequest: (payload: { project_id: number; provider: string; account_label: string; market: "overseas" | "china"; requested_scopes?: string[] }) =>
    request<SocialAuthorizationRequestRecord>("/requests", { method: "POST", body: JSON.stringify(payload) }),
  cancelRequest: (requestId: string, projectId: number) =>
    request<SocialAuthorizationRequestRecord>(`/requests/${encodeURIComponent(requestId)}/cancel?project_id=${encodeURIComponent(projectId)}`, { method: "POST" }),
};
