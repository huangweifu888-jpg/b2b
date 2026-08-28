import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type FactoryCpqStatus = "draft" | "pending-approval" | "approved" | "rejected" | "sent" | "accepted";
export type FactoryCpqLine = { line_number: number; product_reference: string; sku_reference: string; quantity: string; moq: string; unit_price: string; unit_cost: string; lead_time_days: number; line_total: string };
export type FactoryCpqQuote = {
  id: string; project_id: number; tenant_id: string; client_id: string; plan_id: string;
  quote_number: string; account_reference: string; currency: string; exchange_rate: string;
  valid_until: string; lines: FactoryCpqLine[]; subtotal: string; cost_total: string;
  gross_margin_percent: string; status: FactoryCpqStatus; approval_note?: string | null;
  order_intent_id?: string | null; emitted_events: Array<Record<string, unknown>>; revision: number;
};
export type FactoryCpqCreate = {
  account_reference: string; currency: string; exchange_rate: string; valid_until: string;
  lines: Array<{ product_reference: string; sku_reference: string; quantity: string; moq: string; unit_price: string; unit_cost: string; lead_time_days: number }>;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token = authApi.getStoredToken();
  if (!token && await authApi.restoreLocalDemoSession("hq")) token = authApi.getStoredToken();
  const headers = new Headers(init?.headers); headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(typeof body.detail === "string" ? body.detail : `CPQ请求失败（${response.status}）`); }
  return response.json() as Promise<T>;
}

const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/cpq-quotes`;
export const listFactoryCpqQuotes = (projectId: number) => request<{ items: FactoryCpqQuote[] }>(base(projectId));
export const createFactoryCpqQuote = (projectId: number, payload: FactoryCpqCreate) => request<FactoryCpqQuote>(base(projectId), { method: "POST", body: JSON.stringify(payload) });
export const transitionFactoryCpqQuote = (projectId: number, id: string, payload: { expected_revision: number; action: "submit" | "approve" | "reject" | "send" | "accept"; note?: string }) => request<FactoryCpqQuote>(`${base(projectId)}/${encodeURIComponent(id)}/transition`, { method: "POST", body: JSON.stringify(payload) });
