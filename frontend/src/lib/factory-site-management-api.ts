import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type SiteSpace = { id: string; site_number: string; site_code: string; site_name: string; channel: string; default_locale: string; status: string; revision: number };
export type SiteContentVersion = { id: string; version_number: string; site_id: string; locale: string; manifest_hash: string; source_reference: string; status: string; authored_by: string; reviewed_by: string | null; revision: number };
export type SitePublication = { id: string; publication_number: string; site_id: string; site_version_id: string; version_number: string; target_environment: string; status: string; available: boolean; consumer_receipt_reference: string | null; revision: number };
export type WebsiteBuildProgram = { id: string; program_number: string; program_key: string; program_name: string; site_id: string | null; site_mode: "b2b" | "b2c" | "hybrid"; market_scope: "china" | "overseas" | "dual"; locales_json: string[]; route_strategy: "subdomain" | "path" | "single"; brief_json: Record<string, string>; status: "draft" | "in-progress" | "verified" | "available"; current_phase: string; created_by: string; activated_by: string | null; activation_reference: string | null; revision: number };
export type WebsiteBuildGate = { id: string; program_id: string; gate_key: string; gate_label: string; status: "pending" | "passed"; evidence_reference: string | null; passed_by: string | null; revision: number };
export type SiteManagementWorkspace = { sites: SiteSpace[]; versions: SiteContentVersion[]; publications: SitePublication[]; website_build_programs: WebsiteBuildProgram[]; website_build_gates: WebsiteBuildGate[]; evidence: Array<{ id: string; evidence_type: string; evidence_reference: string }>; metrics: Record<string, number>; availability: { application_id: string; status: "pilot" | "available"; release_version: string | null }; contract: Record<string, boolean> };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token = authApi.getStoredToken(); if (!token && await authApi.restoreLocalDemoSession("hq")) token = authApi.getStoredToken();
  const headers = new Headers(init?.headers); headers.set("Content-Type", "application/json"); if (token) headers.set("Authorization", `Bearer ${token}`);
  let response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  if (response.status === 401 && await authApi.restoreLocalDemoSession("hq")) { const restored = authApi.getStoredToken(); if (restored) headers.set("Authorization", `Bearer ${restored}`); response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers }); }
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(typeof body.detail === "string" ? body.detail : `Site management request failed (${response.status})`); }
  return response.json() as Promise<T>;
}
const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/site-management`;
const post = <T>(path: string, payload: Record<string, unknown>) => request<T>(path, { method: "POST", body: JSON.stringify(payload) });
export const listSiteManagementWorkspace = (projectId: number) => request<SiteManagementWorkspace>(base(projectId));
export const createSiteSpace = (projectId: number, payload: Record<string, unknown>) => post<SiteSpace>(`${base(projectId)}/sites`, payload);
export const draftSiteContentVersion = (projectId: number, siteId: string, payload: Record<string, unknown>) => post<SiteContentVersion>(`${base(projectId)}/sites/${siteId}/versions`, payload);
export const reviewSiteContentVersion = (projectId: number, versionId: string, payload: Record<string, unknown>) => post<SiteContentVersion>(`${base(projectId)}/versions/${versionId}/review`, payload);
export const prepareSitePublication = (projectId: number, versionId: string, payload: Record<string, unknown>) => post<SitePublication>(`${base(projectId)}/versions/${versionId}/publications`, payload);
export const approveSitePublication = (projectId: number, publicationId: string, payload: Record<string, unknown>) => post<SitePublication>(`${base(projectId)}/publications/${publicationId}/approve`, payload);
export const acknowledgeSitePublication = (projectId: number, publicationId: string, payload: Record<string, unknown>) => post<SitePublication>(`${base(projectId)}/publications/${publicationId}/acknowledge`, payload);
export const createWebsiteBuildProgram = (projectId: number, payload: Record<string, unknown>) => post<WebsiteBuildProgram>(`${base(projectId)}/website-build-programs`, payload);
export const bindWebsiteBuildSite = (projectId: number, programId: string, payload: Record<string, unknown>) => post<WebsiteBuildProgram>(`${base(projectId)}/website-build-programs/${programId}/site`, payload);
export const verifyWebsiteBuildGate = (projectId: number, programId: string, gateKey: string, payload: Record<string, unknown>) => post<WebsiteBuildProgram & { gate: WebsiteBuildGate }>(`${base(projectId)}/website-build-programs/${programId}/gates/${gateKey}/verify`, payload);
export const activateWebsiteBuildProgram = (projectId: number, programId: string, payload: Record<string, unknown>) => post<WebsiteBuildProgram>(`${base(projectId)}/website-build-programs/${programId}/activate`, payload);
