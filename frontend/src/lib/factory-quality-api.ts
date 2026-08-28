import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type QualityCheckCode = "appearance" | "dimensions" | "performance" | "safety" | "documentation";
export type FactoryQualityFinding = {
  id: string; finding_number: string; inspection_id: string; check_code: QualityCheckCode;
  severity: "minor" | "major" | "critical"; description: string; affected_quantity: number;
  lifecycle_status: "open" | "closed"; disposition?: "rework" | "scrap" | "use-as-is" | "return-supplier" | null;
  root_cause?: string | null; corrective_action?: string | null; resolution_evidence_reference?: string | null; revision: number;
};
export type FactoryQualityInspection = {
  id: string; project_id: number; tenant_id: string; client_id: string; plan_id: string;
  inspection_number: string; inspection_reference: string; order_id: string; order_number: string;
  product_reference: string; sku_reference: string; work_order_reference: string; batch_reference: string;
  inspection_type: "incoming" | "in-process" | "final"; sample_size: number; accepted_quantity: number; rejected_quantity: number;
  lifecycle_status: "draft" | "in-progress" | "review-required" | "released"; inspector?: string | null;
  check_results: Array<{ check_code: QualityCheckCode; passed: boolean; measured_value: string; evidence_reference: string }>;
  approval_reference?: string | null; release_note?: string | null; emitted_events: Array<Record<string, unknown>>;
  findings: FactoryQualityFinding[]; revision: number;
};
export type FactoryQualityEligibleOrder = {
  id: string; order_number: string; status: string;
  lines: Array<Record<string, unknown>>; fulfillment_evidence: Array<Record<string, unknown>>;
};
export type FactoryQualityWorkspace = { inspections: FactoryQualityInspection[]; eligible_orders: FactoryQualityEligibleOrder[] };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token = authApi.getStoredToken();
  if (!token && await authApi.restoreLocalDemoSession("hq")) token = authApi.getStoredToken();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `质量管理请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/quality-inspections`;
export const listFactoryQualityInspections = (projectId: number) => request<FactoryQualityWorkspace>(base(projectId));
export const createFactoryQualityInspection = (projectId: number, payload: { order_id: string; product_reference: string; sku_reference: string; inspection_reference: string; inspection_type: FactoryQualityInspection["inspection_type"]; sample_size: number }) => request<FactoryQualityInspection>(base(projectId), { method: "POST", body: JSON.stringify(payload) });
export const startFactoryQualityInspection = (projectId: number, id: string, payload: { expected_revision: number; inspector: string }) => request<FactoryQualityInspection>(`${base(projectId)}/${encodeURIComponent(id)}/start`, { method: "POST", body: JSON.stringify(payload) });
export const recordFactoryQualityResults = (projectId: number, id: string, payload: { expected_revision: number; accepted_quantity: number; rejected_quantity: number; check_results: FactoryQualityInspection["check_results"] }) => request<FactoryQualityInspection>(`${base(projectId)}/${encodeURIComponent(id)}/results`, { method: "POST", body: JSON.stringify(payload) });
export const createFactoryQualityFinding = (projectId: number, id: string, payload: { expected_revision: number; check_code: QualityCheckCode; severity: FactoryQualityFinding["severity"]; description: string; affected_quantity: number }) => request<{ inspection: FactoryQualityInspection; finding: FactoryQualityFinding }>(`${base(projectId)}/${encodeURIComponent(id)}/findings`, { method: "POST", body: JSON.stringify(payload) });
export const resolveFactoryQualityFinding = (projectId: number, id: string, payload: { expected_revision: number; expected_inspection_revision: number; disposition: NonNullable<FactoryQualityFinding["disposition"]>; root_cause: string; corrective_action: string; resolution_evidence_reference: string }) => request<{ inspection: FactoryQualityInspection; finding: FactoryQualityFinding }>(`${base(projectId)}/findings/${encodeURIComponent(id)}/resolve`, { method: "POST", body: JSON.stringify(payload) });
export const releaseFactoryQualityInspection = (projectId: number, id: string, payload: { expected_revision: number; approval_reference: string; release_note: string }) => request<FactoryQualityInspection>(`${base(projectId)}/${encodeURIComponent(id)}/release`, { method: "POST", body: JSON.stringify(payload) });
