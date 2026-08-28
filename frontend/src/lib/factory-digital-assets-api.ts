import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type DigitalAssetPlan = { id: string; plan_number: string; business_goal: string; target_market: string; target_audience: string; site_scope: string; status: string; revision: number };
export type DigitalAssetSuggestion = { id: string; suggestion_number: string; source_plan_id: string; suggestion_type: string; status: string; revision: number };
export type DigitalAssetRegister = { id: string; asset_number: string; source_plan_id: string; asset_kind: string; asset_identifier: string; status: string; registrar_secret_stored: boolean; revision: number };
export type DigitalAssetHandoff = { id: string; handoff_number: string; source_plan_id: string; release_version: string; manifest_hash: string; status: string; available: boolean; revision: number };
export type DigitalAssetWorkspace = { plans: DigitalAssetPlan[]; suggestions: DigitalAssetSuggestion[]; assets: DigitalAssetRegister[]; handoffs: DigitalAssetHandoff[]; evidence: Array<{ id: string; evidence_type: string }>; metrics: Record<string, number>; availability: { application_id: string; status: "pilot" | "available"; release_version: string | null }; contract: Record<string, boolean> };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token = authApi.getStoredToken();
  if (!token && await authApi.restoreLocalDemoSession("hq")) token = authApi.getStoredToken();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  if (response.status === 401 && await authApi.restoreLocalDemoSession("hq")) {
    const restored = authApi.getStoredToken();
    if (restored) headers.set("Authorization", `Bearer ${restored}`);
    response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `Digital assets request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/digital-assets`;
const post = <T>(path: string, payload: Record<string, unknown>) => request<T>(path, { method: "POST", body: JSON.stringify(payload) });
export const listDigitalAssetWorkspace = (projectId: number) => request<DigitalAssetWorkspace>(base(projectId));
export const createDigitalAssetPlan = (projectId: number, payload: Record<string, unknown>) => post<DigitalAssetPlan>(`${base(projectId)}/plans`, payload);
export const generateDigitalAssetSuggestion = (projectId: number, planId: string, payload: Record<string, unknown>) => post<DigitalAssetSuggestion>(`${base(projectId)}/plans/${planId}/suggestions`, payload);
export const reviewDigitalAssetSuggestion = (projectId: number, suggestionId: string, payload: Record<string, unknown>) => post<DigitalAssetSuggestion>(`${base(projectId)}/suggestions/${suggestionId}/review`, payload);
export const registerDigitalAsset = (projectId: number, planId: string, payload: Record<string, unknown>) => post<DigitalAssetRegister>(`${base(projectId)}/plans/${planId}/assets`, payload);
export const approveDigitalAsset = (projectId: number, assetId: string, payload: Record<string, unknown>) => post<DigitalAssetRegister>(`${base(projectId)}/assets/${assetId}/approve`, payload);
export const approveDigitalAssetPlan = (projectId: number, planId: string, payload: Record<string, unknown>) => post<DigitalAssetPlan>(`${base(projectId)}/plans/${planId}/approve`, payload);
export const prepareDigitalAssetHandoff = (projectId: number, planId: string, payload: Record<string, unknown>) => post<DigitalAssetHandoff>(`${base(projectId)}/plans/${planId}/handoffs`, payload);
export const approveDigitalAssetHandoff = (projectId: number, handoffId: string, payload: Record<string, unknown>) => post<DigitalAssetHandoff>(`${base(projectId)}/handoffs/${handoffId}/approve`, payload);
