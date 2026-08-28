import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type ForecastPolicy = { id: string; policy_number: string; policy_reference: string; policy_code: string; owner: string; purpose: string; status: "draft" | "active"; current_version_id?: string | null; current_version_number?: number | null; revision: number };
export type ForecastPolicyVersion = { id: string; version_number_record: string; version_reference: string; policy_id: string; policy_number: string; policy_code: string; version_number: number; label: string; model_type: "weighted-pipeline-capacity-cash"; horizon_days: number; bucket_days: number; demand_growth_percent: string; pipeline_probability_percent: string; collection_percent: string; capacity_buffer_percent: string; procurement_payment_percent: string; policy_fingerprint: string; status: "draft" | "pending-approval" | "published" | "superseded"; change_reason: string; effective_from: string; authored_by: string; submitted_by?: string | null; approved_by?: string | null; revision: number };
export type ForecastRun = { id: string; run_number: string; forecast_reference: string; policy_id: string; policy_version_id: string; policy_version_number: number; policy_fingerprint: string; model_type: string; as_of_at: string; horizon_days: number; bucket_days: number; currency: string; source_count: number; input_fact_count: number; pipeline_demand_value: string; confirmed_order_value: string; required_capacity_units: string; available_capacity_units: string; capacity_gap_units: string; expected_cash_in: string; expected_cash_out: string; net_cash_change: string; forecast_classification: string; status: "calculated" | "published"; calculated_by: string; verified_by?: string | null; revision: number };
export type ForecastInputEdge = { id: string; edge_number: string; forecast_run_id: string; source_code: string; warehouse_load_run_id: string; warehouse_run_number: string; warehouse_fact_id: string; warehouse_fact_number: string; source_object_id: string; source_object_number: string; source_revision: number; content_hash: string };
export type ForecastBucket = { id: string; bucket_number: string; forecast_run_id: string; bucket_index: number; bucket_start: string; bucket_end: string; pipeline_demand_value: string; confirmed_order_value: string; required_capacity_units: string; available_capacity_units: string; expected_cash_in: string; expected_cash_out: string; net_cash_change: string };
export type ForecastSourceReadiness = { source_code: string; ready: boolean; load_run_id?: string | null; run_number?: string | null; published_at?: string | null };
export type ForecastWorkspace = { policies: ForecastPolicy[]; policy_versions: ForecastPolicyVersion[]; forecast_runs: ForecastRun[]; input_edges: ForecastInputEdge[]; buckets: ForecastBucket[]; evidence: Array<Record<string, unknown>>; source_readiness: ForecastSourceReadiness[]; contract: { forecast_classification: string; formal_financial_forecast: boolean; published_warehouse_required: boolean; policy_approval_independent: boolean; run_verification_independent: boolean; historical_recalculation: boolean; authority_writeback: boolean; required_source_codes: string[] } };

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
    throw new Error(typeof body.detail === "string" ? body.detail : `经营预测请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/forecast`;
const post = <T>(path: string, payload: Record<string, unknown>) => request<T>(path, { method: "POST", body: JSON.stringify(payload) });

export const listForecastWorkspace = (projectId: number) => request<ForecastWorkspace>(base(projectId));
export const createForecastPolicy = (projectId: number, payload: Record<string, unknown>) => post<{ policy: ForecastPolicy; version: ForecastPolicyVersion }>(`${base(projectId)}/policies`, payload);
export const createForecastPolicyVersion = (projectId: number, policyId: string, payload: Record<string, unknown>) => post<{ policy: ForecastPolicy; version: ForecastPolicyVersion }>(`${base(projectId)}/policies/${encodeURIComponent(policyId)}/versions`, payload);
export const submitForecastPolicyVersion = (projectId: number, versionId: string, payload: Record<string, unknown>) => post<ForecastPolicyVersion>(`${base(projectId)}/policy-versions/${encodeURIComponent(versionId)}/submit`, payload);
export const approveForecastPolicyVersion = (projectId: number, versionId: string, payload: Record<string, unknown>) => post<{ policy: ForecastPolicy; version: ForecastPolicyVersion; superseded_version?: ForecastPolicyVersion | null }>(`${base(projectId)}/policy-versions/${encodeURIComponent(versionId)}/approve`, payload);
export const calculateForecast = (projectId: number, payload: Record<string, unknown>) => post<{ run: ForecastRun; input_edges: ForecastInputEdge[]; buckets: ForecastBucket[] }>(`${base(projectId)}/runs`, payload);
export const verifyForecast = (projectId: number, runId: string, payload: Record<string, unknown>) => post<ForecastRun>(`${base(projectId)}/runs/${encodeURIComponent(runId)}/verify`, payload);
