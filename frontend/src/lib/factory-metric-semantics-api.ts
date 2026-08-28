import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type MetricDefinition = {
  id: string; definition_number: string; definition_reference: string; metric_code: string;
  domain: string; owner: string; purpose: string; status: "draft" | "active";
  current_version_id?: string | null; current_version_number?: number | null; revision: number;
};
export type MetricVersion = {
  id: string; version_number_record: string; version_reference: string; definition_id: string;
  definition_number: string; metric_code: string; version_number: number; label: string;
  description: string; unit: string; aggregation: string; value_field?: string | null;
  numerator_field?: string | null; denominator_field?: string | null;
  filter_field?: string | null; filter_operator?: string | null; filter_value?: string | null;
  dimensions: string[]; source_id: string; source_code: string;
  source_schema_fingerprint: string; formula_hash: string;
  status: "draft" | "pending-approval" | "published" | "superseded";
  change_reason: string; effective_from: string; authored_by: string;
  submitted_by?: string | null; approved_by?: string | null; revision: number;
};
export type MetricEvaluationRun = {
  id: string; run_number: string; evaluation_reference: string; definition_id: string;
  metric_version_id: string; metric_version_number: number; metric_code: string;
  warehouse_load_run_id: string; warehouse_run_number: string; source_code: string;
  source_watermark_at?: string | null; status: "evaluated" | "published";
  fact_count: number; lineage_count: number; numerator_value: string;
  denominator_value: string; metric_value: string; observation_count: number;
  evaluated_by: string; verified_by?: string | null; revision: number;
};
export type MetricObservation = {
  id: string; observation_number: string; evaluation_run_id: string; run_number: string;
  metric_code: string; dimension_key: string; dimensions: Record<string, unknown>;
  fact_count: number; numerator_value: string; denominator_value: string; metric_value: string;
};
export type MetricWarehouseSource = {
  id: string; source_number: string; source_code: string; source_system: string;
  source_table: string; schema_fingerprint: string; fields: string[];
};
export type MetricWarehouseRun = {
  id: string; run_number: string; source_id: string; source_code: string; status: "published";
  rows_accepted: number; quality_score: string; watermark_to?: string | null; schema_fingerprint: string;
};
export type MetricSemanticsWorkspace = {
  definitions: MetricDefinition[]; versions: MetricVersion[];
  evaluation_runs: MetricEvaluationRun[]; observations: MetricObservation[];
  evidence: Array<Record<string, unknown>>; warehouse_sources: MetricWarehouseSource[];
  warehouse_runs: MetricWarehouseRun[];
  contract: { formula_mode: string; allowed_aggregations: string[]; historical_recalculation: boolean;
    approval_independent: boolean; evaluation_verification_independent: boolean; warehouse_publication_required: boolean };
};

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
    throw new Error(typeof body.detail === "string" ? body.detail : `指标语义请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/metric-center`;
const post = <T>(path: string, payload: Record<string, unknown>) => request<T>(path, { method: "POST", body: JSON.stringify(payload) });

export const listMetricSemanticsWorkspace = (projectId: number) => request<MetricSemanticsWorkspace>(base(projectId));
export const createMetricDefinition = (projectId: number, payload: Record<string, unknown>) => post<{ definition: MetricDefinition; version: MetricVersion }>(`${base(projectId)}/definitions`, payload);
export const createMetricVersion = (projectId: number, definitionId: string, payload: Record<string, unknown>) => post<{ definition: MetricDefinition; version: MetricVersion }>(`${base(projectId)}/definitions/${encodeURIComponent(definitionId)}/versions`, payload);
export const submitMetricVersion = (projectId: number, versionId: string, payload: Record<string, unknown>) => post<MetricVersion>(`${base(projectId)}/versions/${encodeURIComponent(versionId)}/submit`, payload);
export const approveMetricVersion = (projectId: number, versionId: string, payload: Record<string, unknown>) => post<{ definition: MetricDefinition; version: MetricVersion; superseded_version?: MetricVersion | null }>(`${base(projectId)}/versions/${encodeURIComponent(versionId)}/approve`, payload);
export const evaluateMetricVersion = (projectId: number, versionId: string, payload: Record<string, unknown>) => post<{ run: MetricEvaluationRun; observations: MetricObservation[] }>(`${base(projectId)}/versions/${encodeURIComponent(versionId)}/evaluate`, payload);
export const verifyMetricEvaluation = (projectId: number, runId: string, payload: Record<string, unknown>) => post<MetricEvaluationRun>(`${base(projectId)}/evaluation-runs/${encodeURIComponent(runId)}/verify`, payload);
