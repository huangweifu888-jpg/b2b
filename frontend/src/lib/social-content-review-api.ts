import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

const BASE = "/api/v1/social-content-reviews";

export type SocialContentReviewStatus =
  | "pending_agency_review"
  | "pending_headquarters_review"
  | "approved_for_authorized_publish"
  | "returned";

export type SocialContentReviewRecord = {
  id: string;
  project_id: number;
  title: string;
  content_text: string;
  channels: string[];
  status: SocialContentReviewStatus;
  submitted_by: string;
  review_note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = authApi.getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${getAPIBaseURL()}${BASE}${path}`, { ...init, headers });
  if (!response.ok) throw new Error(`Social content review API: ${response.status}`);
  return response.json() as Promise<T>;
}

export const socialContentReviewApi = {
  list: (projectId?: number) => request<{ items: SocialContentReviewRecord[] }>(projectId ? `?project_id=${encodeURIComponent(projectId)}` : ""),
  create: (payload: { project_id: number; title: string; content_text: string; channels: string[] }) =>
    request<SocialContentReviewRecord>("", { method: "POST", body: JSON.stringify(payload) }),
  action: (reviewId: string, action: "agency_approve" | "headquarters_approve" | "return" | "resubmit", note?: string) =>
    request<SocialContentReviewRecord>(`/${encodeURIComponent(reviewId)}/action`, { method: "POST", body: JSON.stringify({ action, note }) }),
};
