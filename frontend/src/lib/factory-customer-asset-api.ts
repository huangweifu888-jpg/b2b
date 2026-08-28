import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type FactoryCustomerAsset = {
  id: string; project_id: number; tenant_id: string; client_id: string; plan_id: string;
  asset_number: string; order_id: string; order_number: string; account_reference: string;
  product_reference: string; sku_reference: string; serial_number: string; installation_location: string;
  installed_at: string; warranty_until: string; next_service_due_at: string; status: string;
  renewal_status: string; renewal_owner?: string | null; renewal_action?: string | null;
  service_count: number; last_service_at?: string | null; emitted_events: Array<Record<string, unknown>>; revision: number;
};
export type FactoryAssetServiceTicket = {
  id: string; project_id: number; ticket_number: string; asset_id: string; asset_number: string;
  issue_summary: string; severity: "critical" | "high" | "medium" | "low"; status: "open" | "scheduled" | "in-progress" | "resolved";
  sla_due_at: string; assigned_to?: string | null; scheduled_for?: string | null;
  resolution_reference?: string | null; resolution_note?: string | null; emitted_events: Array<Record<string, unknown>>; revision: number;
};
export type FactoryAssetEligibleOrder = { id: string; order_number: string; account_reference: string; lines: Array<Record<string, unknown>> };
export type FactoryCustomerAssetWorkspace = { assets: FactoryCustomerAsset[]; tickets: FactoryAssetServiceTicket[]; eligible_orders: FactoryAssetEligibleOrder[] };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token = authApi.getStoredToken();
  if (!token && await authApi.restoreLocalDemoSession("hq")) token = authApi.getStoredToken();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `客户资产请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/customer-assets`;
export const listFactoryCustomerAssets = (projectId: number) => request<FactoryCustomerAssetWorkspace>(base(projectId));
export const registerFactoryCustomerAsset = (projectId: number, payload: { order_id: string; product_reference: string; sku_reference: string; serial_number: string; installation_location: string; installed_at: string; warranty_until: string; next_service_due_at: string }) => request<FactoryCustomerAsset>(base(projectId), { method: "POST", body: JSON.stringify(payload) });
export const createFactoryAssetServiceTicket = (projectId: number, assetId: string, payload: { issue_summary: string; severity: FactoryAssetServiceTicket["severity"] }) => request<{ asset: FactoryCustomerAsset; ticket: FactoryAssetServiceTicket }>(`${base(projectId)}/${encodeURIComponent(assetId)}/tickets`, { method: "POST", body: JSON.stringify(payload) });
export const transitionFactoryAssetServiceTicket = (projectId: number, ticketId: string, payload: { expected_revision: number; action: "schedule" | "start" | "resolve"; assigned_to?: string; scheduled_for?: string; resolution_reference?: string; resolution_note?: string; next_service_due_at?: string }) => request<{ asset: FactoryCustomerAsset; ticket: FactoryAssetServiceTicket }>(`${base(projectId)}/tickets/${encodeURIComponent(ticketId)}/transition`, { method: "POST", body: JSON.stringify(payload) });
export const flagFactoryCustomerAssetWarranty = (projectId: number, assetId: string, payload: { expected_revision: number; renewal_owner: string; renewal_action: string }) => request<FactoryCustomerAsset>(`${base(projectId)}/${encodeURIComponent(assetId)}/warranty-action`, { method: "POST", body: JSON.stringify(payload) });
