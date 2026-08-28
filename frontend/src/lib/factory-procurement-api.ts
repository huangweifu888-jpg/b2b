import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type FactorySupplier = {
  id: string; project_id: number; tenant_id: string; client_id: string; plan_id: string;
  supplier_number: string; supplier_reference: string; legal_name: string; country_code: string; currency: string;
  standard_lead_time_days: number; qualified_materials: string[]; qualification_evidence_reference: string;
  risk_level: "low" | "medium" | "high"; lifecycle_status: "draft" | "approved" | "suspended";
  approval_reference?: string | null; approval_note?: string | null; revision: number;
};
export type FactoryPurchaseOrder = {
  id: string; project_id: number; tenant_id: string; client_id: string; plan_id: string;
  purchase_order_number: string; supplier_id: string; supplier_number: string; supplier_reference: string;
  demand_order_id: string; demand_order_number: string; engineering_version_id: string; engineering_number: string;
  product_reference: string; sku_reference: string; currency: string;
  lines: Array<{ line_number: number; material_reference: string; material_name: string; required_quantity: string; unit: string; unit_price: string; line_total: string }>;
  subtotal: string; needed_by: string; lifecycle_status: "draft" | "pending-approval" | "approved" | "issued" | "acknowledged" | "received";
  review_note?: string | null; approval_reference?: string | null; issue_document_reference?: string | null;
  acknowledgement_reference?: string | null; promised_delivery_at?: string | null; receiving_reference?: string | null;
  received_quantities: Array<{ material_reference: string; received_quantity: string }>;
  milestones: Array<{ action: string; status: string; evidenceReference: string; occurredAt: string }>;
  revision: number;
};
export type FactoryProcurementEngineering = { id: string; engineering_number: string; product_reference: string; sku_reference: string; engineering_version: string; bom_components: Array<Record<string, unknown>> };
export type FactoryProcurementDemandOrder = { id: string; order_number: string; status: string; lines: Array<Record<string, unknown>> };
export type FactoryProcurementWorkspace = { suppliers: FactorySupplier[]; purchase_orders: FactoryPurchaseOrder[]; released_engineering_versions: FactoryProcurementEngineering[]; eligible_demand_orders: FactoryProcurementDemandOrder[] };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token = authApi.getStoredToken();
  if (!token && await authApi.restoreLocalDemoSession("hq")) token = authApi.getStoredToken();
  const headers = new Headers(init?.headers); headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `供应采购请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/procurement`;
export const listFactoryProcurement = (projectId: number) => request<FactoryProcurementWorkspace>(base(projectId));
export const createFactorySupplier = (projectId: number, payload: { supplier_reference: string; legal_name: string; country_code: string; currency: string; standard_lead_time_days: number; qualified_materials: string[]; qualification_evidence_reference: string; risk_level: FactorySupplier["risk_level"] }) => request<FactorySupplier>(`${base(projectId)}/suppliers`, { method: "POST", body: JSON.stringify(payload) });
export const approveFactorySupplier = (projectId: number, id: string, payload: { expected_revision: number; approval_reference: string; approval_note: string }) => request<FactorySupplier>(`${base(projectId)}/suppliers/${encodeURIComponent(id)}/approve`, { method: "POST", body: JSON.stringify(payload) });
export const createFactoryPurchaseOrder = (projectId: number, payload: { supplier_id: string; demand_order_id: string; engineering_version_id: string; needed_by: string; unit_prices: Array<{ material_reference: string; unit_price: string }> }) => request<FactoryPurchaseOrder>(`${base(projectId)}/purchase-orders`, { method: "POST", body: JSON.stringify(payload) });
export const transitionFactoryPurchaseOrder = (projectId: number, id: string, payload: { expected_revision: number; action: "submit" | "approve" | "issue" | "acknowledge" | "receive"; note?: string; approval_reference?: string; issue_document_reference?: string; acknowledgement_reference?: string; promised_delivery_at?: string; receiving_reference?: string; received_quantities?: Array<{ material_reference: string; received_quantity: string }> }) => request<FactoryPurchaseOrder>(`${base(projectId)}/purchase-orders/${encodeURIComponent(id)}/transition`, { method: "POST", body: JSON.stringify(payload) });
