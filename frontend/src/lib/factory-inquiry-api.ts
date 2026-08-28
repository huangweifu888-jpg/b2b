import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type InquiryStatus = "received" | "qualified" | "routed" | "handed-off";
export type Inquiry = { id: string; inquiry_number: string; source_channel: string; account_reference: string; product_reference: string; country_code: string; requested_quantity?: number | null; payload_summary?: string | null; score: number; status: InquiryStatus; qualified_by?: string | null; qualification_reference?: string | null; revenue_flow_id?: string | null; created_by: string; revision: number };
export type InquiryRule = { id: string; rule_number: string; rule_key: string; rule_name: string; priority: number; conditions_json: Record<string, unknown>; assignee_reference: string; status: "draft" | "approved" | "active"; authored_by: string; approved_by?: string | null; approval_reference?: string | null; activated_by?: string | null; revision: number };
export type InquiryAssignment = { id: string; assignment_number: string; inquiry_id: string; inquiry_number: string; rule_id: string; rule_number: string; assignee_reference: string; status: "pending" | "acknowledged"; routed_by: string; acknowledged_by?: string | null; receipt_reference?: string | null; revision: number };
export type InquiryWorkspace = { inquiries: Inquiry[]; rules: InquiryRule[]; assignments: InquiryAssignment[]; evidence: Array<{ id: string; event_type: string; reference: string }>; metrics: { received_inquiries: number; qualified_inquiries: number; routing_receipt_percent: number }; contract: Record<string, boolean> };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers); headers.set("Content-Type", "application/json");
  const token = authApi.getStoredToken(); if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(typeof body.detail === "string" ? body.detail : `询盘请求失败（${response.status}）`); }
  return response.json() as Promise<T>;
}
const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/inquiries`;
const post = <T>(path: string, payload: Record<string, unknown>) => request<T>(path, { method: "POST", body: JSON.stringify(payload) });
export const listInquiryWorkspace = (projectId: number) => request<InquiryWorkspace>(base(projectId));
export const createInquiry = (projectId: number, payload: Record<string, unknown>) => post<Inquiry>(base(projectId), payload);
export const qualifyInquiry = (projectId: number, inquiryId: string, payload: Record<string, unknown>) => post<Inquiry>(`${base(projectId)}/${encodeURIComponent(inquiryId)}/qualify`, payload);
export const createInquiryRule = (projectId: number, payload: Record<string, unknown>) => post<InquiryRule>(`${base(projectId)}/rules`, payload);
export const approveInquiryRule = (projectId: number, ruleId: string, payload: Record<string, unknown>) => post<InquiryRule>(`${base(projectId)}/rules/${encodeURIComponent(ruleId)}/approve`, payload);
export const activateInquiryRule = (projectId: number, ruleId: string, payload: Record<string, unknown>) => post<InquiryRule>(`${base(projectId)}/rules/${encodeURIComponent(ruleId)}/activate`, payload);
export const routeInquiry = (projectId: number, inquiryId: string, payload: Record<string, unknown>) => post<{ inquiry: Inquiry; assignment: InquiryAssignment }>(`${base(projectId)}/${encodeURIComponent(inquiryId)}/route`, payload);
export const acknowledgeInquiryAssignment = (projectId: number, assignmentId: string, payload: Record<string, unknown>) => post<InquiryAssignment>(`${base(projectId)}/assignments/${encodeURIComponent(assignmentId)}/acknowledge`, payload);
export const handoffInquiryToRevenue = (projectId: number, inquiryId: string, payload: Record<string, unknown>) => post<{ inquiry: Inquiry; revenue_flow: { id: string; correlation_id: string; current_stage: string } }>(`${base(projectId)}/${encodeURIComponent(inquiryId)}/handoff`, payload);
