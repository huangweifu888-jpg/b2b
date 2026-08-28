import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type FactoryPlanningResource = {
  id: string; project_id: number; tenant_id: string; client_id: string; plan_id: string;
  resource_number: string; resource_reference: string; resource_name: string;
  daily_capacity: string; shift_hours: string; efficiency_percent: string;
  calendar_evidence_reference: string; lifecycle_status: "draft" | "approved";
  approval_reference?: string | null; approval_note?: string | null; revision: number;
};
export type FactoryProductionPlan = {
  id: string; project_id: number; tenant_id: string; client_id: string; plan_id: string;
  production_plan_number: string; demand_order_id: string; demand_order_number: string;
  engineering_version_id: string; engineering_number: string; product_reference: string; sku_reference: string;
  demand_quantity: string; resource_id: string; resource_number: string; effective_daily_capacity: string;
  capacity_days: number; planned_start_at: string; planned_end_at: string; due_at: string;
  material_requirements: Array<{ material_reference: string; material_name: string; required_quantity: string; received_quantity: string; shortage_quantity: string; unit: string; receiving_evidence: string[] }>;
  shortages: Array<{ material_reference: string; shortage_quantity: string; unit: string }>;
  material_readiness_status: "ready" | "shortage"; schedule_status: "on-time" | "late";
  lifecycle_status: "draft" | "pending-review" | "approved" | "released";
  review_note?: string | null; approval_reference?: string | null; release_reference?: string | null;
  work_order_intent_reference?: string | null;
  milestones: Array<{ action: string; status: string; evidenceReference: string; occurredAt: string }>;
  revision: number;
};
export type FactoryPlanningEngineering = { id: string; engineering_number: string; engineering_version: string; product_reference: string; sku_reference: string; bom_components: Array<Record<string, unknown>> };
export type FactoryPlanningDemandOrder = { id: string; order_number: string; status: string; lines: Array<Record<string, unknown>> };
export type FactoryPlanningWorkspace = { resources: FactoryPlanningResource[]; production_plans: FactoryProductionPlan[]; released_engineering_versions: FactoryPlanningEngineering[]; eligible_demand_orders: FactoryPlanningDemandOrder[] };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token = authApi.getStoredToken();
  if (!token && await authApi.restoreLocalDemoSession("hq")) token = authApi.getStoredToken();
  const headers = new Headers(init?.headers); headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `产销计划请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/production-plans`;
export const listFactoryProductionPlanning = (projectId: number) => request<FactoryPlanningWorkspace>(base(projectId));
export const createFactoryPlanningResource = (projectId: number, payload: { resource_reference: string; resource_name: string; daily_capacity: string; shift_hours: string; efficiency_percent: string; calendar_evidence_reference: string }) => request<FactoryPlanningResource>(`${base(projectId)}/resources`, { method: "POST", body: JSON.stringify(payload) });
export const approveFactoryPlanningResource = (projectId: number, id: string, payload: { expected_revision: number; approval_reference: string; approval_note: string }) => request<FactoryPlanningResource>(`${base(projectId)}/resources/${encodeURIComponent(id)}/approve`, { method: "POST", body: JSON.stringify(payload) });
export const createFactoryProductionPlan = (projectId: number, payload: { demand_order_id: string; engineering_version_id: string; resource_id: string; due_at: string }) => request<FactoryProductionPlan>(base(projectId), { method: "POST", body: JSON.stringify(payload) });
export const recalculateFactoryProductionPlan = (projectId: number, id: string, payload: { expected_revision: number }) => request<FactoryProductionPlan>(`${base(projectId)}/${encodeURIComponent(id)}/recalculate`, { method: "POST", body: JSON.stringify(payload) });
export const transitionFactoryProductionPlan = (projectId: number, id: string, payload: { expected_revision: number; action: "submit" | "approve" | "release"; note?: string; approval_reference?: string; release_reference?: string }) => request<FactoryProductionPlan>(`${base(projectId)}/${encodeURIComponent(id)}/transition`, { method: "POST", body: JSON.stringify(payload) });
