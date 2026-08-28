import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type PartnerVoiceEvidence = { id: string; evidence_number: string; subject_type: string; subject_id: string; subject_number: string; evidence_type: string; evidence_reference: string; note: string; recorded_by: string; created_at: string };
export type FactoryPartnerAccount = {
  id: string; project_id: number; tenant_id: string; client_id: string; plan_id: string;
  partner_number: string; external_reference: string; legal_name: string;
  partner_type: "distributor" | "dealer" | "service-partner" | "customer";
  country_code: string; territory: string; product_scope: string[];
  account_reference?: string | null; primary_contact_reference: string;
  relationship_evidence_reference: string; agreement_reference?: string | null;
  status: "draft" | "active" | "suspended"; activated_by?: string | null;
  activated_at?: string | null; suspension_reason?: string | null;
  evidence: PartnerVoiceEvidence[]; revision: number; created_at: string; updated_at: string;
};
export type FactoryPartnerAcademyEnrollment = {
  id: string; project_id: number; enrollment_number: string; enrollment_reference: string;
  partner_id: string; partner_number: string; learner_reference: string; course_code: string;
  course_title: string; course_version: string; passing_score: number; planned_completion_at: string;
  status: "enrolled" | "completed" | "certified"; assessment_score?: string | null;
  completion_evidence_reference?: string | null; completed_at?: string | null;
  certification_reference?: string | null; certification_expires_at?: string | null;
  evidence: PartnerVoiceEvidence[]; revision: number; created_at: string; updated_at: string;
};
export type FactoryVoiceCase = {
  id: string; project_id: number; voice_number: string; feedback_reference: string;
  source_type: "nps" | "csat" | "complaint" | "suggestion" | "testimonial";
  partner_id?: string | null; partner_number?: string | null; account_reference: string;
  related_order_id?: string | null; related_order_number?: string | null;
  related_asset_id?: string | null; related_asset_number?: string | null;
  category: string; severity: "low" | "medium" | "high" | "critical";
  score?: number | null; sentiment: string; summary: string;
  lifecycle_status: "received" | "triaged" | "action-in-progress" | "resolved" | "customer-confirmed" | "closed";
  triage_reference?: string | null; owner?: string | null; due_at?: string | null;
  root_cause?: string | null; action_plan?: string | null; action_reference?: string | null;
  resolution_reference?: string | null; resolution_note?: string | null;
  customer_confirmation_reference?: string | null; closed_at?: string | null;
  advocacy_status: "not-eligible" | "eligible" | "invited" | "authorized" | "published";
  advocacy_invitation_reference?: string | null; advocacy_consent_reference?: string | null;
  advocacy_consent_scope?: string | null; advocacy_consent_expires_at?: string | null;
  case_study_reference?: string | null; publication_channel?: string | null;
  evidence: PartnerVoiceEvidence[]; milestones: Array<Record<string, unknown>>;
  revision: number; created_at: string; updated_at: string;
};
export type PartnerVoiceWorkspace = {
  partners: FactoryPartnerAccount[]; enrollments: FactoryPartnerAcademyEnrollment[];
  voices: FactoryVoiceCase[];
  eligible_accounts: Array<{ account_reference: string; latest_order_id?: string | null; latest_order_number?: string | null; asset_id?: string | null; asset_number?: string | null }>;
  metrics: { nps_responses: number; promoters: number; detractors: number; nps: number | null };
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
    throw new Error(typeof body.detail === "string" ? body.detail : `伙伴与客户之声请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}
const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/partner-voice`;
const post = <T>(path: string, payload: Record<string, unknown>) => request<T>(path, { method: "POST", body: JSON.stringify(payload) });

export const listPartnerVoiceWorkspace = (projectId: number) => request<PartnerVoiceWorkspace>(base(projectId));
export const createPartnerAccount = (projectId: number, payload: Record<string, unknown>) => post<FactoryPartnerAccount>(`${base(projectId)}/partners`, payload);
export const activatePartnerAccount = (projectId: number, id: string, payload: Record<string, unknown>) => post<FactoryPartnerAccount>(`${base(projectId)}/partners/${encodeURIComponent(id)}/activate`, payload);
export const enrollPartnerAcademy = (projectId: number, payload: Record<string, unknown>) => post<FactoryPartnerAcademyEnrollment>(`${base(projectId)}/academy`, payload);
export const completePartnerAcademy = (projectId: number, id: string, payload: Record<string, unknown>) => post<FactoryPartnerAcademyEnrollment>(`${base(projectId)}/academy/${encodeURIComponent(id)}/complete`, payload);
export const certifyPartnerAcademy = (projectId: number, id: string, payload: Record<string, unknown>) => post<FactoryPartnerAcademyEnrollment>(`${base(projectId)}/academy/${encodeURIComponent(id)}/certify`, payload);
export const createVoiceCase = (projectId: number, payload: Record<string, unknown>) => post<FactoryVoiceCase>(`${base(projectId)}/voices`, payload);
export const triageVoiceCase = (projectId: number, id: string, payload: Record<string, unknown>) => post<FactoryVoiceCase>(`${base(projectId)}/voices/${encodeURIComponent(id)}/triage`, payload);
export const startVoiceAction = (projectId: number, id: string, payload: Record<string, unknown>) => post<FactoryVoiceCase>(`${base(projectId)}/voices/${encodeURIComponent(id)}/start-action`, payload);
export const resolveVoiceCase = (projectId: number, id: string, payload: Record<string, unknown>) => post<FactoryVoiceCase>(`${base(projectId)}/voices/${encodeURIComponent(id)}/resolve`, payload);
export const confirmVoiceCase = (projectId: number, id: string, payload: Record<string, unknown>) => post<FactoryVoiceCase>(`${base(projectId)}/voices/${encodeURIComponent(id)}/confirm`, payload);
export const closeVoiceCase = (projectId: number, id: string, payload: Record<string, unknown>) => post<FactoryVoiceCase>(`${base(projectId)}/voices/${encodeURIComponent(id)}/close`, payload);
export const inviteVoiceAdvocacy = (projectId: number, id: string, payload: Record<string, unknown>) => post<FactoryVoiceCase>(`${base(projectId)}/voices/${encodeURIComponent(id)}/advocacy-invite`, payload);
export const authorizeVoiceAdvocacy = (projectId: number, id: string, payload: Record<string, unknown>) => post<FactoryVoiceCase>(`${base(projectId)}/voices/${encodeURIComponent(id)}/advocacy-authorize`, payload);
export const publishVoiceAdvocacy = (projectId: number, id: string, payload: Record<string, unknown>) => post<FactoryVoiceCase>(`${base(projectId)}/voices/${encodeURIComponent(id)}/advocacy-publish`, payload);
