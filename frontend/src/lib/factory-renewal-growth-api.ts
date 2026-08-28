import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";
import type { FactoryCustomerAsset, FactoryAssetServiceTicket } from "@/lib/factory-customer-asset-api";
import type { FactoryCpqQuote } from "@/lib/factory-cpq-api";
import type { FactoryFulfillmentOrder } from "@/lib/factory-fulfillment-api";

export type FactoryRenewalGrowthStatus = "draft" | "assessed" | "recommended" | "approved" | "cpq-requested" | "quoted" | "won" | "lost";
export type FactoryRenewalMotion = "renewal" | "repurchase" | "upsell";
export type FactoryRenewalGrowthEvidence = {
  id: string; evidence_number: string; opportunity_id: string; opportunity_number: string;
  evidence_type: string; evidence_reference: string; note: string; recorded_by: string; created_at: string;
};
export type FactoryRenewalGrowthOpportunity = {
  id: string; project_id: number; tenant_id: string; client_id: string; plan_id: string;
  opportunity_number: string; opportunity_reference: string; asset_id: string; asset_number: string;
  original_order_id: string; original_order_number: string; account_reference: string;
  current_product_reference: string; current_sku_reference: string; serial_number: string;
  warranty_until: string; service_count_snapshot: number; resolved_service_count: number;
  closed_rma_count: number; manufacturer_fault_count: number; health_score: number; risk_level: "low" | "medium" | "high";
  source_snapshot: Record<string, unknown>; lifecycle_status: FactoryRenewalGrowthStatus;
  motion?: FactoryRenewalMotion | null; owner: string; next_action_at: string;
  value_evidence_reference?: string | null; customer_goal?: string | null;
  customer_confirmation_reference?: string | null; recommendation_reference?: string | null;
  recommended_product_reference?: string | null; recommended_sku_reference?: string | null;
  recommended_quantity?: string | null; currency?: string | null; estimated_unit_price?: string | null;
  estimated_unit_cost?: string | null; estimated_value?: string | null; estimated_margin_percent?: string | null;
  recommendation_rationale?: string | null; approval_reference?: string | null;
  approved_by?: string | null; approved_at?: string | null; cpq_handoff_reference?: string | null;
  cpq_handoff_at?: string | null; quote_id?: string | null; quote_number?: string | null;
  quote_value?: string | null; quote_accepted_at?: string | null; order_id?: string | null;
  order_number?: string | null; actual_value?: string | null; won_at?: string | null;
  loss_reason?: string | null; closed_by?: string | null; closed_at?: string | null;
  milestones: Array<Record<string, unknown>>; evidence: FactoryRenewalGrowthEvidence[];
  revision: number; updated_by?: string | null; created_at: string; updated_at: string;
};
export type FactoryRenewalWorkspace = {
  assets: FactoryCustomerAsset[];
  resolved_tickets: FactoryAssetServiceTicket[];
  closed_rmas: Array<{ id: string; rma_number: string; asset_id: string; inspection_result?: string | null; responsibility?: string | null; estimated_total_cost: string }>;
  quotes: FactoryCpqQuote[];
  orders: FactoryFulfillmentOrder[];
  opportunities: FactoryRenewalGrowthOpportunity[];
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
    throw new Error(typeof body.detail === "string" ? body.detail : `续约增长请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/renewal-growth`;
const action = <T>(projectId: number, id: string, name: string, payload: Record<string, unknown>) => request<T>(`${base(projectId)}/${encodeURIComponent(id)}/${name}`, { method: "POST", body: JSON.stringify(payload) });

export const listFactoryRenewalWorkspace = (projectId: number) => request<FactoryRenewalWorkspace>(base(projectId));
export const createFactoryRenewalOpportunity = (projectId: number, payload: { asset_id: string; opportunity_reference: string; owner: string; next_action_at: string }) => request<FactoryRenewalGrowthOpportunity>(base(projectId), { method: "POST", body: JSON.stringify(payload) });
export const assessFactoryRenewalOpportunity = (projectId: number, id: string, payload: { expected_revision: number; value_evidence_reference: string; value_summary: string }) => action<FactoryRenewalGrowthOpportunity>(projectId, id, "assess", payload);
export const recommendFactoryRenewalOpportunity = (projectId: number, id: string, payload: { expected_revision: number; motion: FactoryRenewalMotion; customer_goal: string; customer_confirmation_reference: string; recommendation_reference: string; recommended_product_reference: string; recommended_sku_reference: string; recommended_quantity: string; currency: string; estimated_unit_price: string; estimated_unit_cost: string; recommendation_rationale: string }) => action<FactoryRenewalGrowthOpportunity>(projectId, id, "recommend", payload);
export const approveFactoryRenewalOpportunity = (projectId: number, id: string, payload: { expected_revision: number; approval_reference: string; approval_note: string }) => action<FactoryRenewalGrowthOpportunity>(projectId, id, "approve", payload);
export const handoffFactoryRenewalToCpq = (projectId: number, id: string, payload: { expected_revision: number; cpq_handoff_reference: string }) => action<FactoryRenewalGrowthOpportunity>(projectId, id, "cpq-handoff", payload);
export const linkFactoryRenewalQuote = (projectId: number, id: string, payload: { expected_revision: number; quote_id: string }) => action<FactoryRenewalGrowthOpportunity>(projectId, id, "link-quote", payload);
export const confirmFactoryRenewalWon = (projectId: number, id: string, payload: { expected_revision: number; order_id: string }) => action<FactoryRenewalGrowthOpportunity>(projectId, id, "confirm-won", payload);
export const closeFactoryRenewalLost = (projectId: number, id: string, payload: { expected_revision: number; loss_reference: string; loss_reason: string }) => action<FactoryRenewalGrowthOpportunity>(projectId, id, "close-lost", payload);
