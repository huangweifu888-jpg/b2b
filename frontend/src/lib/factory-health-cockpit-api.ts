import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type HealthMetric = {
  dimension: string; code: string; label: string; actual: string | null; target: string;
  unit: string; weight: number; status: "healthy" | "attention" | "unavailable";
  numerator: string; denominator: string; source: string;
};
export type HealthSourceWatermark = { source: string; recordCount: number; watermark: string | null };
export type FactoryHealthSnapshot = {
  id: string; project_id: number; snapshot_number: string; snapshot_reference: string;
  period_start: string; period_end: string; overall_score: string; health_grade: "healthy" | "watch" | "critical";
  metric_count: number; available_metric_count: number; alert_count: number;
  dimensions: HealthMetric[]; source_watermarks: HealthSourceWatermark[];
  methodology_version: string; status: "published"; generated_by: string; generated_at: string;
  revision: number; created_at: string;
};
export type FactoryHealthAlert = {
  id: string; project_id: number; alert_number: string; snapshot_id: string; snapshot_number: string;
  dimension: string; metric_code: string; metric_label: string; severity: "medium" | "high" | "critical";
  actual_value: string | null; threshold_value: string; unit: string;
  source_object_type: string; source_reference: string;
  status: "open" | "acknowledged" | "task-assigned" | "pending-verification" | "resolved";
  owner?: string | null; acknowledged_by?: string | null; acknowledged_at?: string | null;
  due_at?: string | null; verified_by?: string | null; verified_at?: string | null;
  revision: number; updated_by?: string | null; created_at: string; updated_at: string;
};
export type FactoryHealthTask = {
  id: string; project_id: number; task_number: string; alert_id: string; alert_number: string;
  owner: string; action_plan: string; due_at: string;
  status: "assigned" | "in-progress" | "completed" | "verified";
  started_at?: string | null; completion_note?: string | null;
  completion_evidence_reference?: string | null; completed_by?: string | null; completed_at?: string | null;
  verified_by?: string | null; verified_at?: string | null; revision: number;
  updated_by?: string | null; created_at: string; updated_at: string;
};
export type FactoryHealthEvidence = {
  id: string; evidence_number: string; subject_type: string; subject_id: string;
  subject_number: string; evidence_type: string; evidence_reference: string;
  note: string; recorded_by: string; created_at: string;
};
export type FactoryHealthWorkspace = {
  snapshots: FactoryHealthSnapshot[]; alerts: FactoryHealthAlert[];
  tasks: FactoryHealthTask[]; evidence: FactoryHealthEvidence[];
  methodology: { version: string; policy: string; metric_codes: string[] };
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
    throw new Error(typeof body.detail === "string" ? body.detail : `经营健康驾舱请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/health-cockpit`;
const post = <T>(path: string, payload: Record<string, unknown>) => request<T>(path, { method: "POST", body: JSON.stringify(payload) });

export const listFactoryHealthWorkspace = (projectId: number) => request<FactoryHealthWorkspace>(base(projectId));
export const refreshFactoryHealthCockpit = (projectId: number, payload: Record<string, unknown>) => post<{ snapshot: FactoryHealthSnapshot; alerts: FactoryHealthAlert[] }>(`${base(projectId)}/refresh`, payload);
export const acknowledgeFactoryHealthAlert = (projectId: number, id: string, payload: Record<string, unknown>) => post<FactoryHealthAlert>(`${base(projectId)}/alerts/${encodeURIComponent(id)}/acknowledge`, payload);
export const createFactoryHealthTask = (projectId: number, id: string, payload: Record<string, unknown>) => post<FactoryHealthTask>(`${base(projectId)}/alerts/${encodeURIComponent(id)}/tasks`, payload);
export const startFactoryHealthTask = (projectId: number, id: string, payload: Record<string, unknown>) => post<FactoryHealthTask>(`${base(projectId)}/tasks/${encodeURIComponent(id)}/start`, payload);
export const completeFactoryHealthTask = (projectId: number, id: string, payload: Record<string, unknown>) => post<FactoryHealthTask>(`${base(projectId)}/tasks/${encodeURIComponent(id)}/complete`, payload);
export const verifyFactoryHealthTask = (projectId: number, id: string, payload: Record<string, unknown>) => post<{ task: FactoryHealthTask; alert: FactoryHealthAlert }>(`${base(projectId)}/tasks/${encodeURIComponent(id)}/verify`, payload);
