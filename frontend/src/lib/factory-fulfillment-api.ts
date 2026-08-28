import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type FactoryFulfillmentStatus = "pending-validation" | "rejected" | "confirmed" | "allocated" | "in-production" | "production-completed" | "quality-released" | "shipped" | "delivered";
export type FactoryFulfillmentOrder = {
  id: string; project_id: number; tenant_id: string; client_id: string; plan_id: string;
  order_number: string; quote_id: string; quote_number: string; order_intent_id: string;
  account_reference: string; currency: string; exchange_rate: string; lines: Array<Record<string, unknown>>;
  order_total: string; status: FactoryFulfillmentStatus; authority_source: string;
  validation: Record<string, unknown>; fulfillment_evidence: Array<Record<string, unknown>>;
  emitted_events: Array<Record<string, unknown>>; confirmed_by?: string | null; confirmed_at?: string | null;
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
    throw new Error(typeof body.detail === "string" ? body.detail : `履约请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/fulfillment-orders`;
export const listFactoryFulfillmentOrders = (projectId: number) => request<{ items: FactoryFulfillmentOrder[] }>(base(projectId));
export const registerFactoryOrderIntent = (projectId: number, orderIntentId: string) => request<FactoryFulfillmentOrder>(base(projectId), { method: "POST", body: JSON.stringify({ order_intent_id: orderIntentId }) });
export const decideFactoryFulfillmentOrder = (projectId: number, id: string, payload: { expected_revision: number; action: "confirm" | "reject"; product: boolean; payment: boolean; inventory: boolean; capacity: boolean; note: string }) => request<FactoryFulfillmentOrder>(`${base(projectId)}/${encodeURIComponent(id)}/decision`, { method: "POST", body: JSON.stringify(payload) });
export const advanceFactoryFulfillmentOrder = (projectId: number, id: string, payload: { expected_revision: number; action: "allocate" | "start-production" | "complete-production" | "release-quality" | "ship" | "deliver"; evidence_reference: string; note: string }) => request<FactoryFulfillmentOrder>(`${base(projectId)}/${encodeURIComponent(id)}/advance`, { method: "POST", body: JSON.stringify(payload) });
