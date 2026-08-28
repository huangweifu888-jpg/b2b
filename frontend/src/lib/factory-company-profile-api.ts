import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type CompanyProfile = { id: string; profile_number: string; profile_key: string; display_name: string; status: string; revision: number };
export type CompanyProfileVersion = { id: string; version_number: string; profile_id: string; profile_number: string; locale: string; manifest_hash: string; status: string; authored_by: string; verified_by: string | null; revision: number };
export type CompanyProfilePublication = { id: string; publication_number: string; profile_id: string; profile_version_id: string; version_number: string; target: string; status: string; available: boolean; consumer_receipt_reference: string | null; revision: number };
export type CompanyProfileWorkspace = { profiles: CompanyProfile[]; versions: CompanyProfileVersion[]; publications: CompanyProfilePublication[]; evidence: Array<{ id: string; evidence_type: string; evidence_reference: string }>; metrics: Record<string, number>; availability: { application_id: "content.company"; status: "pilot" | "available"; release_version: string | null }; contract: Record<string, boolean> };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token = authApi.getStoredToken(); if (!token && await authApi.restoreLocalDemoSession("hq")) token = authApi.getStoredToken();
  const headers = new Headers(init?.headers); headers.set("Content-Type", "application/json"); if (token) headers.set("Authorization", `Bearer ${token}`);
  let response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  if (response.status === 401 && await authApi.restoreLocalDemoSession("hq")) { const restored = authApi.getStoredToken(); if (restored) headers.set("Authorization", `Bearer ${restored}`); response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers }); }
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(typeof body.detail === "string" ? body.detail : `Company profile request failed (${response.status})`); }
  return response.json() as Promise<T>;
}
const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/company-profile`;
const post = <T>(path: string, payload: Record<string, unknown>) => request<T>(path, { method: "POST", body: JSON.stringify(payload) });
export const listCompanyProfileWorkspace = (projectId: number) => request<CompanyProfileWorkspace>(base(projectId));
export const createCompanyProfile = (projectId: number, payload: Record<string, unknown>) => post<CompanyProfile>(`${base(projectId)}/profiles`, payload);
export const draftCompanyProfileVersion = (projectId: number, profileId: string, payload: Record<string, unknown>) => post<CompanyProfileVersion>(`${base(projectId)}/profiles/${profileId}/versions`, payload);
export const verifyCompanyProfileVersion = (projectId: number, versionId: string, payload: Record<string, unknown>) => post<CompanyProfileVersion>(`${base(projectId)}/versions/${versionId}/verify`, payload);
export const prepareCompanyProfilePublication = (projectId: number, versionId: string, payload: Record<string, unknown>) => post<CompanyProfilePublication>(`${base(projectId)}/versions/${versionId}/publications`, payload);
export const approveCompanyProfilePublication = (projectId: number, publicationId: string, payload: Record<string, unknown>) => post<CompanyProfilePublication>(`${base(projectId)}/publications/${publicationId}/approve`, payload);
export const acknowledgeCompanyProfilePublication = (projectId: number, publicationId: string, payload: Record<string, unknown>) => post<CompanyProfilePublication>(`${base(projectId)}/publications/${publicationId}/acknowledge`, payload);
