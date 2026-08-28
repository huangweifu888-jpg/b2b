import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type AttributionPolicy = { id: string; policy_number: string; policy_reference: string; policy_code: string; owner: string; purpose: string; status: "draft" | "active"; current_version_id?: string | null; current_version_number?: number | null; revision: number };
export type AttributionPolicyVersion = { id: string; version_number_record: string; version_reference: string; policy_id: string; policy_number: string; policy_code: string; version_number: number; label: string; model_type: "first-touch" | "last-touch" | "linear"; lookback_days: number; policy_fingerprint: string; status: "draft" | "pending-approval" | "published" | "superseded"; change_reason: string; effective_from: string; authored_by: string; submitted_by?: string | null; approved_by?: string | null; revision: number };
export type AttributionTouchpoint = { id: string; touchpoint_number: string; external_event_reference: string; correlation_id: string; account_reference: string; channel: string; campaign_reference: string; content_reference?: string | null; occurred_at: string; spend_amount: string; currency: string; consent_reference: string; evidence_fingerprint: string; recorded_by: string };
export type RevenueProfitBinding = { id: string; binding_number: string; binding_reference: string; correlation_id: string; account_reference: string; currency: string; revenue_load_run_id: string; revenue_run_number: string; revenue_fact_id: string; revenue_fact_number: string; revenue_source_revision: number; quote_load_run_id: string; quote_run_number: string; quote_fact_id: string; quote_fact_number: string; quote_source_revision: number; status: "pending-verification" | "verified"; created_by: string; verified_by?: string | null; revision: number };
export type RevenueProfitRun = { id: string; run_number: string; analysis_reference: string; binding_id: string; binding_number: string; policy_id: string; policy_version_id: string; policy_version_number: number; policy_fingerprint: string; model_type: string; correlation_id: string; account_reference: string; currency: string; recognized_revenue: string; governed_sales_cost: string; marketing_spend: string; contribution_margin: string; contribution_margin_percent: string; touchpoint_count: number; profit_classification: string; status: "calculated" | "published"; calculated_by: string; verified_by?: string | null; revision: number };
export type RevenueProfitAllocation = { id: string; allocation_number: string; analysis_run_id: string; run_number: string; touchpoint_id: string; touchpoint_number: string; channel: string; campaign_reference: string; weight: string; attributed_revenue: string; attributed_sales_cost: string; touchpoint_spend: string; attributed_contribution: string };
export type RevenueProfitWarehouseCandidate = { load_run_id: string; run_number: string; source_code: "revenue" | "quotes"; watermark_to?: string | null; fact_id: string; fact_number: string; source_object_number: string; source_revision: number; source_updated_at: string; payload: Record<string, unknown> };
export type RevenueProfitWorkspace = { policies: AttributionPolicy[]; policy_versions: AttributionPolicyVersion[]; touchpoints: AttributionTouchpoint[]; bindings: RevenueProfitBinding[]; analysis_runs: RevenueProfitRun[]; allocations: RevenueProfitAllocation[]; evidence: Array<Record<string, unknown>>; warehouse_candidates: RevenueProfitWarehouseCandidate[]; contract: { profit_classification: string; formal_accounting_profit: boolean; published_warehouse_required: boolean; touchpoint_evidence_required: boolean; policy_approval_independent: boolean; binding_verification_independent: boolean; analysis_verification_independent: boolean; historical_recalculation: boolean } };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token = authApi.getStoredToken();
  if (!token && await authApi.restoreLocalDemoSession("hq")) token = authApi.getStoredToken();
  const headers = new Headers(init?.headers); headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  if (response.status === 401 && await authApi.restoreLocalDemoSession("hq")) {
    const restored = authApi.getStoredToken(); if (restored) headers.set("Authorization", `Bearer ${restored}`);
    response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `归因利润请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/revenue-profit`;
const post = <T>(path: string, payload: Record<string, unknown>) => request<T>(path, { method: "POST", body: JSON.stringify(payload) });

export const listRevenueProfitWorkspace = (projectId: number) => request<RevenueProfitWorkspace>(base(projectId));
export const createAttributionPolicy = (projectId: number, payload: Record<string, unknown>) => post<{ policy: AttributionPolicy; version: AttributionPolicyVersion }>(`${base(projectId)}/policies`, payload);
export const createAttributionPolicyVersion = (projectId: number, policyId: string, payload: Record<string, unknown>) => post<{ policy: AttributionPolicy; version: AttributionPolicyVersion }>(`${base(projectId)}/policies/${encodeURIComponent(policyId)}/versions`, payload);
export const submitAttributionPolicyVersion = (projectId: number, versionId: string, payload: Record<string, unknown>) => post<AttributionPolicyVersion>(`${base(projectId)}/policy-versions/${encodeURIComponent(versionId)}/submit`, payload);
export const approveAttributionPolicyVersion = (projectId: number, versionId: string, payload: Record<string, unknown>) => post<{ policy: AttributionPolicy; version: AttributionPolicyVersion; superseded_version?: AttributionPolicyVersion | null }>(`${base(projectId)}/policy-versions/${encodeURIComponent(versionId)}/approve`, payload);
export const recordAttributionTouchpoint = (projectId: number, payload: Record<string, unknown>) => post<AttributionTouchpoint>(`${base(projectId)}/touchpoints`, payload);
export const createRevenueProfitBinding = (projectId: number, payload: Record<string, unknown>) => post<RevenueProfitBinding>(`${base(projectId)}/bindings`, payload);
export const verifyRevenueProfitBinding = (projectId: number, bindingId: string, payload: Record<string, unknown>) => post<RevenueProfitBinding>(`${base(projectId)}/bindings/${encodeURIComponent(bindingId)}/verify`, payload);
export const calculateRevenueProfit = (projectId: number, payload: Record<string, unknown>) => post<{ run: RevenueProfitRun; allocations: RevenueProfitAllocation[] }>(`${base(projectId)}/analyses`, payload);
export const verifyRevenueProfitAnalysis = (projectId: number, runId: string, payload: Record<string, unknown>) => post<RevenueProfitRun>(`${base(projectId)}/analyses/${encodeURIComponent(runId)}/verify`, payload);
