import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type FactoryCustomerSuccessReview = { id: string; review_number: string; asset_id: string; asset_number: string; health_score: number; risk_level: string; success_summary: string; lifecycle_status: "draft" | "reviewed" | "approved" | "handed-off"; revision: number; created_by: string; reviewed_by?: string | null; approved_by?: string | null };
export type FactoryCustomerSuccessHandoff = { id: string; handoff_number: string; review_id: string; status: "pending" | "acknowledged"; revision: number; release_reference: string; receipt_reference?: string | null };
export type FactoryCustomerSuccessWorkspace = { reviews: FactoryCustomerSuccessReview[]; handoffs: FactoryCustomerSuccessHandoff[]; evidence: { review_id: string; event_type: string; reference: string; recorded_by: string }[] };
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token = authApi.getStoredToken();
  if (!token && await authApi.restoreLocalDemoSession("hq")) token = authApi.getStoredToken();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(typeof body.detail === "string" ? body.detail : `客户成功请求失败（${response.status}）`); }
  return response.json() as Promise<T>;
}
const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/customer-success`;
export const listFactoryCustomerSuccess = (projectId: number) => request<FactoryCustomerSuccessWorkspace>(base(projectId));
export const createFactoryCustomerSuccess = (projectId: number, payload: { asset_id: string; success_summary: string }) => request<FactoryCustomerSuccessReview>(base(projectId), { method: "POST", body: JSON.stringify(payload) });
export const reviewFactoryCustomerSuccess = (projectId: number, id: string, payload: { expected_revision: number; reference: string; note: string }) => request<FactoryCustomerSuccessReview>(`${base(projectId)}/${encodeURIComponent(id)}/review`, { method: "POST", body: JSON.stringify(payload) });
export const approveFactoryCustomerSuccess = (projectId: number, id: string, payload: { expected_revision: number; reference: string; note: string }) => request<FactoryCustomerSuccessReview>(`${base(projectId)}/${encodeURIComponent(id)}/approve`, { method: "POST", body: JSON.stringify(payload) });
export const handoffFactoryCustomerSuccess = (projectId: number, id: string, payload: { expected_revision: number; release_reference: string }) => request<{ review: FactoryCustomerSuccessReview; handoff: FactoryCustomerSuccessHandoff }>(`${base(projectId)}/${encodeURIComponent(id)}/handoff`, { method: "POST", body: JSON.stringify(payload) });
export const acknowledgeFactoryCustomerSuccess = (projectId: number, id: string, payload: { expected_revision: number; receipt_reference: string }) => request<FactoryCustomerSuccessHandoff>(`${base(projectId)}/handoffs/${encodeURIComponent(id)}/acknowledge`, { method: "POST", body: JSON.stringify(payload) });
