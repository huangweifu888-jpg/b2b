import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type MesOperation = {
  id: string; operation_sequence: number; operation_code: string; operation_name: string;
  work_center_reference: string; input_quantity: string; good_quantity: string; scrap_quantity: string;
  lifecycle_status: "pending" | "in-progress" | "completed"; operator_reference?: string | null;
  revision: number;
};
export type MesDowntime = {
  id: string; downtime_number: string; operation_id: string; operation_code: string;
  reason_code: string; reason_note: string; lifecycle_status: "open" | "resolved";
  duration_minutes?: number | null; revision: number;
};
export type MesWorkOrder = {
  id: string; work_order_number: string; production_plan_id: string; production_plan_number: string;
  work_order_intent_reference: string; demand_order_number: string; engineering_number: string;
  product_reference: string; sku_reference: string; resource_number: string; batch_reference: string;
  target_quantity: string; completed_quantity: string; scrap_quantity: string;
  material_lots: Array<{ material_reference: string; lot_reference: string; issued_quantity: string; source_receiving_reference: string }>;
  lifecycle_status: "draft" | "released" | "in-progress" | "paused" | "ready-to-complete" | "completed";
  current_operation_code?: string | null; completion_reference?: string | null;
  operations: MesOperation[]; downtimes: MesDowntime[]; revision: number;
};
export type MesReleasedPlan = {
  id: string; production_plan_number: string; work_order_intent_reference: string;
  demand_order_number: string; engineering_number: string; product_reference: string; sku_reference: string;
  demand_quantity: string; resource_number: string; already_work_ordered: boolean;
  material_requirements: Array<{ material_reference: string; required_quantity: string; receiving_evidence?: string[] }>;
};
export type MesWorkspace = { released_production_plans: MesReleasedPlan[]; work_orders: MesWorkOrder[] };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token = authApi.getStoredToken();
  if (!token && await authApi.restoreLocalDemoSession("hq")) token = authApi.getStoredToken();
  const headers = new Headers(init?.headers); headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `制造执行请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/manufacturing-execution`;
export const listMesWorkspace = (projectId: number) => request<MesWorkspace>(base(projectId));
export const createMesWorkOrder = (projectId: number, payload: Record<string, unknown>) => request<MesWorkOrder>(base(projectId), { method: "POST", body: JSON.stringify(payload) });
export const transitionMesWorkOrder = (projectId: number, id: string, payload: { expected_revision: number; action: "release" | "complete"; evidence_reference: string }) => request<MesWorkOrder>(`${base(projectId)}/${encodeURIComponent(id)}/transition`, { method: "POST", body: JSON.stringify(payload) });
export const startMesOperation = (projectId: number, id: string, payload: { expected_revision: number; operator_reference: string; evidence_reference: string }) => request<MesWorkOrder>(`${base(projectId)}/operations/${encodeURIComponent(id)}/start`, { method: "POST", body: JSON.stringify(payload) });
export const completeMesOperation = (projectId: number, id: string, payload: { expected_revision: number; good_quantity: string; scrap_quantity: string; evidence_reference: string }) => request<MesWorkOrder>(`${base(projectId)}/operations/${encodeURIComponent(id)}/complete`, { method: "POST", body: JSON.stringify(payload) });
export const openMesDowntime = (projectId: number, id: string, payload: { reason_code: string; reason_note: string }) => request<MesWorkOrder>(`${base(projectId)}/operations/${encodeURIComponent(id)}/downtimes`, { method: "POST", body: JSON.stringify(payload) });
export const resolveMesDowntime = (projectId: number, id: string, payload: { expected_revision: number; resolution_note: string; evidence_reference: string }) => request<MesWorkOrder>(`${base(projectId)}/downtimes/${encodeURIComponent(id)}/resolve`, { method: "POST", body: JSON.stringify(payload) });
