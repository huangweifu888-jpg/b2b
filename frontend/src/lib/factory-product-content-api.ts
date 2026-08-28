import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type ProductContentAsset = { id: string; asset_number: string; product_reference: string; display_name: string; status: string; revision: number };
export type ProductContentVersion = { id: string; version_number: string; asset_id: string; asset_number: string; locale: string; document_hash: string; product_fact_reference: string; status: string; authored_by: string; reviewed_by: string | null; revision: number };
export type ProductContentPublication = { id: string; publication_number: string; asset_id: string; content_version_id: string; version_number: string; target: string; status: string; available: boolean; consumer_receipt_reference: string | null; revision: number };
export type ProductContentWorkspace = { assets: ProductContentAsset[]; versions: ProductContentVersion[]; publications: ProductContentPublication[]; evidence: Array<{ id: string; evidence_type: string; evidence_reference: string }>; metrics: Record<string, number>; availability: { application_id: "content.product"; status: "pilot" | "available"; release_version: string | null }; contract: Record<string, boolean> };
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token = authApi.getStoredToken(); if (!token && await authApi.restoreLocalDemoSession("hq")) token = authApi.getStoredToken();
  const headers = new Headers(init?.headers); headers.set("Content-Type", "application/json"); if (token) headers.set("Authorization", `Bearer ${token}`);
  let response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  if (response.status === 401 && await authApi.restoreLocalDemoSession("hq")) { const restored = authApi.getStoredToken(); if (restored) headers.set("Authorization", `Bearer ${restored}`); response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers }); }
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(typeof body.detail === "string" ? body.detail : `Product content request failed (${response.status})`); }
  return response.json() as Promise<T>;
}
const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/product-content`;
const post = <T>(path: string, payload: Record<string, unknown>) => request<T>(path, { method: "POST", body: JSON.stringify(payload) });
export const listProductContentWorkspace = (projectId: number) => request<ProductContentWorkspace>(base(projectId));
export const createProductContentAsset = (projectId: number, payload: Record<string, unknown>) => post<ProductContentAsset>(`${base(projectId)}/assets`, payload);
export const draftProductContentVersion = (projectId: number, assetId: string, payload: Record<string, unknown>) => post<ProductContentVersion>(`${base(projectId)}/assets/${assetId}/versions`, payload);
export const reviewProductContentVersion = (projectId: number, versionId: string, payload: Record<string, unknown>) => post<ProductContentVersion>(`${base(projectId)}/versions/${versionId}/review`, payload);
export const prepareProductContentPublication = (projectId: number, versionId: string, payload: Record<string, unknown>) => post<ProductContentPublication>(`${base(projectId)}/versions/${versionId}/publications`, payload);
export const approveProductContentPublication = (projectId: number, publicationId: string, payload: Record<string, unknown>) => post<ProductContentPublication>(`${base(projectId)}/publications/${publicationId}/approve`, payload);
export const acknowledgeProductContentPublication = (projectId: number, publicationId: string, payload: Record<string, unknown>) => post<ProductContentPublication>(`${base(projectId)}/publications/${publicationId}/acknowledge`, payload);
