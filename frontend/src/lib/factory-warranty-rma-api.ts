import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

import type { FactoryAssetServiceTicket, FactoryCustomerAsset } from "@/lib/factory-customer-asset-api";

export type WarrantyRmaEvidence = {
  id: string; evidence_number: string; evidence_type: string;
  evidence_reference: string; note: string; recorded_by: string; created_at: string;
};
export type WarrantyRmaCase = {
  id: string; rma_number: string; claim_reference: string;
  asset_id: string; asset_number: string; service_ticket_id: string; service_ticket_number: string;
  order_id: string; order_number: string; account_reference: string;
  product_reference: string; sku_reference: string; serial_number: string;
  warranty_until: string; eligibility_status: "unchecked" | "eligible" | "expired";
  claim_summary: string; requested_remedy: "repair" | "replace" | "refund";
  lifecycle_status: "draft" | "pending-review" | "authorized" | "return-in-transit" | "received" | "inspected" | "disposition-approved" | "closed";
  authorization_reference?: string | null; goodwill_reference?: string | null;
  return_shipment_reference?: string | null; warehouse_receipt_reference?: string | null;
  inspection_reference?: string | null; inspection_result?: string | null;
  quality_evidence_reference?: string | null; disposition?: string | null;
  responsibility?: string | null; currency: string; estimated_parts_cost: string;
  estimated_labor_cost: string; estimated_logistics_cost: string; estimated_total_cost: string;
  remedy_evidence_reference?: string | null; customer_acknowledgement_reference?: string | null;
  milestones: Array<Record<string, unknown>>; evidence: WarrantyRmaEvidence[]; revision: number;
};
export type WarrantyRmaWorkspace = {
  assets: FactoryCustomerAsset[]; resolved_tickets: FactoryAssetServiceTicket[]; cases: WarrantyRmaCase[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token = authApi.getStoredToken();
  if (!token && await authApi.restoreLocalDemoSession("hq")) token = authApi.getStoredToken();
  const headers = new Headers(init?.headers); headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `质保退货请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/warranty-rma`;
export const listWarrantyRmaWorkspace = (projectId: number) => request<WarrantyRmaWorkspace>(base(projectId));
export const createWarrantyRmaCase = (projectId: number, payload: { asset_id: string; service_ticket_id: string; claim_reference: string; claim_summary: string; requested_remedy: "repair" | "replace" | "refund" }) => request<WarrantyRmaCase>(base(projectId), { method: "POST", body: JSON.stringify(payload) });
export const submitWarrantyRmaCase = (projectId: number, id: string, payload: { expected_revision: number; submission_reference: string }) => request<WarrantyRmaCase>(`${base(projectId)}/${encodeURIComponent(id)}/submit`, { method: "POST", body: JSON.stringify(payload) });
export const authorizeWarrantyRmaCase = (projectId: number, id: string, payload: { expected_revision: number; authorization_reference: string; return_instructions: string; goodwill_reference?: string }) => request<WarrantyRmaCase>(`${base(projectId)}/${encodeURIComponent(id)}/authorize`, { method: "POST", body: JSON.stringify(payload) });
export const shipWarrantyRmaReturn = (projectId: number, id: string, payload: { expected_revision: number; return_shipment_reference: string }) => request<WarrantyRmaCase>(`${base(projectId)}/${encodeURIComponent(id)}/ship`, { method: "POST", body: JSON.stringify(payload) });
export const receiveWarrantyRmaReturn = (projectId: number, id: string, payload: { expected_revision: number; warehouse_receipt_reference: string; received_condition: string }) => request<WarrantyRmaCase>(`${base(projectId)}/${encodeURIComponent(id)}/receive`, { method: "POST", body: JSON.stringify(payload) });
export const inspectWarrantyRmaReturn = (projectId: number, id: string, payload: { expected_revision: number; inspection_reference: string; inspection_result: "manufacturing-defect" | "customer-damage" | "logistics-damage" | "no-fault-found"; inspection_note: string; quality_evidence_reference?: string }) => request<WarrantyRmaCase>(`${base(projectId)}/${encodeURIComponent(id)}/inspect`, { method: "POST", body: JSON.stringify(payload) });
export const approveWarrantyRmaDisposition = (projectId: number, id: string, payload: { expected_revision: number; disposition: "repair" | "replace" | "refund" | "reject" | "scrap"; responsibility: "manufacturer" | "customer" | "logistics" | "supplier"; disposition_approval_reference: string; currency: string; estimated_parts_cost: string; estimated_labor_cost: string; estimated_logistics_cost: string; finance_followup_reference?: string; supplier_recovery_reference?: string }) => request<WarrantyRmaCase>(`${base(projectId)}/${encodeURIComponent(id)}/disposition`, { method: "POST", body: JSON.stringify(payload) });
export const closeWarrantyRmaCase = (projectId: number, id: string, payload: { expected_revision: number; remedy_evidence_reference: string; customer_acknowledgement_reference: string }) => request<WarrantyRmaCase>(`${base(projectId)}/${encodeURIComponent(id)}/close`, { method: "POST", body: JSON.stringify(payload) });
