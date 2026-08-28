import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type WarehouseSource = {
  id: string; project_id: number; source_number: string; source_reference: string;
  source_code: string; source_system: string; source_table: string; domain: string;
  owner: string; purpose: string; retention_days: number; extraction_mode: string;
  schema_contract_reference?: string | null; schema_fingerprint?: string | null;
  status: "draft" | "active"; last_load_run_id?: string | null;
  last_watermark_at?: string | null; last_published_at?: string | null; revision: number;
};
export type WarehouseLoadRun = {
  id: string; run_number: string; load_reference: string; source_id: string;
  source_number: string; source_code: string; status: "extracted" | "validated" | "failed" | "published";
  cutoff_at: string; watermark_from?: string | null; watermark_to?: string | null;
  rows_read: number; rows_accepted: number; rows_rejected: number; reused_fact_count: number;
  quality_score: string; validation_reference?: string | null; validated_by?: string | null;
  publication_reference?: string | null; published_by?: string | null;
  failure_reason?: string | null; revision: number; created_at: string;
};
export type WarehouseFact = {
  id: string; fact_number: string; source_code: string; source_system: string;
  source_table: string; source_object_id: string; source_object_number: string;
  source_revision: number; source_updated_at: string; content_hash: string;
  quality_status: string; payload: Record<string, unknown>;
};
export type WarehouseLineage = {
  id: string; edge_number: string; load_run_id: string; run_number: string;
  fact_id: string; fact_number: string; source_system: string; source_table: string;
  source_object_id: string; source_revision: number; transformation_reference: string;
};
export type WarehouseQualityIssue = {
  id: string; issue_number: string; run_number: string; source_object_number?: string | null;
  rule_code: string; severity: string; description: string; status: string;
};
export type AvailableWarehouseSource = {
  code: string; system: string; table: string; domain: string; fields: string[]; fingerprint: string;
};
export type FactoryDataWarehouseWorkspace = {
  sources: WarehouseSource[]; runs: WarehouseLoadRun[]; facts: WarehouseFact[];
  quality_issues: WarehouseQualityIssue[]; lineage: WarehouseLineage[];
  evidence: Array<Record<string, unknown>>; available_sources: AvailableWarehouseSource[];
  contract: { copy_mode: string; fact_version: string; lineage_required: boolean; credentials_exposed: boolean };
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token = authApi.getStoredToken();
  if (!token && await authApi.restoreLocalDemoSession("hq")) token = authApi.getStoredToken();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  // Local development restarts can invalidate the short-lived demo JWT while
  // the browser still has it. Recover once and replay the same JSON request.
  if (response.status === 401 && await authApi.restoreLocalDemoSession("hq")) {
    const restoredToken = authApi.getStoredToken();
    if (restoredToken) headers.set("Authorization", `Bearer ${restoredToken}`);
    response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `数据仓库请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/data-warehouse`;
const post = <T>(path: string, payload: Record<string, unknown>) => request<T>(path, { method: "POST", body: JSON.stringify(payload) });

export const listFactoryDataWarehouse = (projectId: number) => request<FactoryDataWarehouseWorkspace>(base(projectId));
export const createWarehouseSource = (projectId: number, payload: Record<string, unknown>) => post<WarehouseSource>(`${base(projectId)}/sources`, payload);
export const activateWarehouseSource = (projectId: number, sourceId: string, payload: Record<string, unknown>) => post<WarehouseSource>(`${base(projectId)}/sources/${encodeURIComponent(sourceId)}/activate`, payload);
export const extractWarehouseSource = (projectId: number, sourceId: string, payload: Record<string, unknown>) => post<WarehouseLoadRun>(`${base(projectId)}/sources/${encodeURIComponent(sourceId)}/extract`, payload);
export const validateWarehouseRun = (projectId: number, runId: string, payload: Record<string, unknown>) => post<WarehouseLoadRun>(`${base(projectId)}/runs/${encodeURIComponent(runId)}/validate`, payload);
export const publishWarehouseRun = (projectId: number, runId: string, payload: Record<string, unknown>) => post<{ run: WarehouseLoadRun; source: WarehouseSource }>(`${base(projectId)}/runs/${encodeURIComponent(runId)}/publish`, payload);
