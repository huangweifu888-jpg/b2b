import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type HomepageDesign = { id: string; design_number: string; design_key: string; display_name: string; status: string; revision: number };
export type HomepageDesignVersion = { id: string; version_number: string; design_id: string; design_number: string; locale: string; manifest_hash: string; status: string; authored_by: string; validated_by: string | null; revision: number };
export type HomepageDesignPublication = { id: string; publication_number: string; design_id: string; design_version_id: string; version_number: string; target: string; status: string; available: boolean; consumer_receipt_reference: string | null; revision: number };
export type HomepageDesignWorkspace = { designs: HomepageDesign[]; versions: HomepageDesignVersion[]; publications: HomepageDesignPublication[]; evidence: Array<{ id: string; evidence_type: string; evidence_reference: string }>; metrics: Record<string, number>; availability: { application_id: "content.homepage"; status: "pilot" | "available"; release_version: string | null }; contract: Record<string, boolean> };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token = authApi.getStoredToken(); if (!token && await authApi.restoreLocalDemoSession("hq")) token = authApi.getStoredToken();
  const headers = new Headers(init?.headers); headers.set("Content-Type", "application/json"); if (token) headers.set("Authorization", `Bearer ${token}`);
  let response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  if (response.status === 401 && await authApi.restoreLocalDemoSession("hq")) { const restored = authApi.getStoredToken(); if (restored) headers.set("Authorization", `Bearer ${restored}`); response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers }); }
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(typeof body.detail === "string" ? body.detail : `Homepage design request failed (${response.status})`); }
  return response.json() as Promise<T>;
}
const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/homepage-design`;
const post = <T>(path: string, payload: Record<string, unknown>) => request<T>(path, { method: "POST", body: JSON.stringify(payload) });
export const listHomepageDesignWorkspace = (projectId: number) => request<HomepageDesignWorkspace>(base(projectId));
export const createHomepageDesign = (projectId: number, payload: Record<string, unknown>) => post<HomepageDesign>(`${base(projectId)}/designs`, payload);
export const draftHomepageDesignVersion = (projectId: number, designId: string, payload: Record<string, unknown>) => post<HomepageDesignVersion>(`${base(projectId)}/designs/${designId}/versions`, payload);
export const validateHomepageDesignVersion = (projectId: number, versionId: string, payload: Record<string, unknown>) => post<HomepageDesignVersion>(`${base(projectId)}/versions/${versionId}/validate`, payload);
export const prepareHomepageDesignPublication = (projectId: number, versionId: string, payload: Record<string, unknown>) => post<HomepageDesignPublication>(`${base(projectId)}/versions/${versionId}/publications`, payload);
export const approveHomepageDesignPublication = (projectId: number, publicationId: string, payload: Record<string, unknown>) => post<HomepageDesignPublication>(`${base(projectId)}/publications/${publicationId}/approve`, payload);
export const acknowledgeHomepageDesignPublication = (projectId: number, publicationId: string, payload: Record<string, unknown>) => post<HomepageDesignPublication>(`${base(projectId)}/publications/${publicationId}/acknowledge`, payload);
