import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type RevenueStage = "product-selected" | "inquiry-created" | "quote-submitted" | "quote-accepted" | "order-confirmed" | "invoice-issued" | "payment-received";
export type RevenueEventType = Exclude<RevenueStage, "product-selected">;

export type FactoryRevenueRun = {
  id: string;
  project_id: number;
  tenant_id: string;
  client_id: string;
  plan_id: string;
  correlation_id: string;
  product_reference: string;
  account_reference: string;
  currency: string;
  quoted_amount: string;
  ordered_amount: string;
  invoiced_amount: string;
  paid_amount: string;
  current_stage: RevenueStage;
  emitted_events: Array<Record<string, unknown>>;
  revision: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token = authApi.getStoredToken();
  if (!token && await authApi.restoreLocalDemoSession("hq")) token = authApi.getStoredToken();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `成交金链请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/revenue-flow`;
export const listFactoryRevenueRuns = (projectId: number) => request<{ items: FactoryRevenueRun[] }>(base(projectId));
export const createFactoryRevenueRun = (projectId: number, payload: { product_reference: string; account_reference: string; currency: string }) => request<FactoryRevenueRun>(base(projectId), { method: "POST", body: JSON.stringify(payload) });
export const advanceFactoryRevenueRun = (projectId: number, runId: string, payload: { expected_revision: number; event_type: RevenueEventType; amount?: string }) => request<FactoryRevenueRun>(`${base(projectId)}/${encodeURIComponent(runId)}/transition`, { method: "POST", body: JSON.stringify(payload) });
