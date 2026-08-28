import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

import type { FactoryAssetServiceTicket, FactoryCustomerAsset } from "@/lib/factory-customer-asset-api";

export type FieldServiceTechnician = {
  id: string; technician_number: string; technician_reference: string; technician_name: string;
  skills: string[]; service_regions: string[]; lifecycle_status: "draft" | "approved";
  approval_reference?: string | null; revision: number;
};
export type FieldServiceEntry = {
  id: string; entry_number: string; visit_id: string; visit_number: string;
  entry_type: "diagnostic" | "labor" | "part"; description: string;
  labor_minutes: number; part_reference?: string | null; quantity: string; unit?: string | null;
  stock_evidence_reference?: string | null; evidence_reference: string;
};
export type FieldServiceVisit = {
  id: string; visit_number: string; service_ticket_id: string; service_ticket_number: string;
  asset_id: string; asset_number: string; account_reference: string;
  technician_id: string; technician_number: string; technician_name: string;
  scheduled_for: string; sla_due_at: string; sla_status: "pending" | "met" | "breached";
  lifecycle_status: "dispatched" | "en-route" | "on-site" | "in-progress" | "completed";
  arrival_location?: string | null; diagnosis_summary?: string | null;
  resolution_reference?: string | null; resolution_note?: string | null;
  customer_signer?: string | null; customer_signoff_reference?: string | null;
  escalation_reference?: string | null; total_labor_minutes: number;
  parts_summary: Array<{ part_reference: string; quantity: string; unit: string; stock_evidence_reference: string }>;
  milestones: Array<Record<string, unknown>>; entries: FieldServiceEntry[]; revision: number;
};
export type FieldServiceWorkspace = {
  assets: FactoryCustomerAsset[]; tickets: FactoryAssetServiceTicket[];
  technicians: FieldServiceTechnician[]; visits: FieldServiceVisit[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token = authApi.getStoredToken();
  if (!token && await authApi.restoreLocalDemoSession("hq")) token = authApi.getStoredToken();
  const headers = new Headers(init?.headers); headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `现场服务请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/field-service`;
export const listFieldServiceWorkspace = (projectId: number) => request<FieldServiceWorkspace>(base(projectId));
export const createFieldServiceTicket = (projectId: number, payload: { asset_id: string; issue_summary: string; severity: FactoryAssetServiceTicket["severity"] }) => request<{ asset: FactoryCustomerAsset; ticket: FactoryAssetServiceTicket }>(`${base(projectId)}/tickets`, { method: "POST", body: JSON.stringify(payload) });
export const createFieldServiceTechnician = (projectId: number, payload: { technician_reference: string; technician_name: string; skills: string[]; service_regions: string[] }) => request<FieldServiceTechnician>(`${base(projectId)}/technicians`, { method: "POST", body: JSON.stringify(payload) });
export const approveFieldServiceTechnician = (projectId: number, technicianId: string, payload: { expected_revision: number; approval_reference: string }) => request<FieldServiceTechnician>(`${base(projectId)}/technicians/${encodeURIComponent(technicianId)}/approve`, { method: "POST", body: JSON.stringify(payload) });
export const dispatchFieldServiceVisit = (projectId: number, ticketId: string, payload: { technician_id: string; scheduled_for: string; escalation_reference?: string }) => request<{ visit: FieldServiceVisit; ticket: FactoryAssetServiceTicket; asset: FactoryCustomerAsset }>(`${base(projectId)}/tickets/${encodeURIComponent(ticketId)}/dispatch`, { method: "POST", body: JSON.stringify(payload) });
export const transitionFieldServiceVisit = (projectId: number, visitId: string, payload: { expected_revision: number; action: "depart" | "arrive" | "start"; evidence_reference: string; arrival_location?: string }) => request<{ visit: FieldServiceVisit; ticket: FactoryAssetServiceTicket; asset: FactoryCustomerAsset }>(`${base(projectId)}/visits/${encodeURIComponent(visitId)}/transition`, { method: "POST", body: JSON.stringify(payload) });
export const addFieldServiceEntry = (projectId: number, visitId: string, payload: { entry_type: "diagnostic" | "labor" | "part"; description: string; evidence_reference: string; labor_minutes?: number; part_reference?: string; quantity?: string; unit?: string; stock_evidence_reference?: string }) => request<{ visit: FieldServiceVisit; entry: FieldServiceEntry }>(`${base(projectId)}/visits/${encodeURIComponent(visitId)}/entries`, { method: "POST", body: JSON.stringify(payload) });
export const completeFieldServiceVisit = (projectId: number, visitId: string, payload: { expected_revision: number; resolution_reference: string; resolution_note: string; customer_signer: string; customer_signoff_reference: string; next_service_due_at: string; escalation_reference?: string }) => request<{ visit: FieldServiceVisit; ticket: FactoryAssetServiceTicket; asset: FactoryCustomerAsset }>(`${base(projectId)}/visits/${encodeURIComponent(visitId)}/complete`, { method: "POST", body: JSON.stringify(payload) });
