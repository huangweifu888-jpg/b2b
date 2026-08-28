import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

const BASE = "/api/v1/social-workspaces";

export type SocialWorkspaceRecord = {
  project_id: number;
  revision: number;
  state: Record<string, unknown>;
  updated_at?: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = authApi.getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${getAPIBaseURL()}${BASE}${path}`, { ...init, headers });
  if (!response.ok) throw new Error(`Social workspace API: ${response.status}`);
  return response.json() as Promise<T>;
}

export const socialWorkspaceApi = {
  get: (projectId: number) => request<SocialWorkspaceRecord>(`/${encodeURIComponent(projectId)}`),
  put: (projectId: number, payload: { state: Record<string, unknown>; expected_revision?: number }) =>
    request<SocialWorkspaceRecord>(`/${encodeURIComponent(projectId)}`, { method: "PUT", body: JSON.stringify(payload) }),
};
