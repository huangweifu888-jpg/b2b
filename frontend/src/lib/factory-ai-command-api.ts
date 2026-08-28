import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type AiCommandQuery = { id: string; query_number: string; query_reference: string; question: string; intent: string; answer: string; confidence: string; verified_fact_count: number; engine_version: string; engine_fingerprint: string; classification: string; status: string; requested_by: string; requested_at: string; revision: number };
export type AiCommandCitation = { id: string; citation_number: string; query_id: string; query_number: string; source_type: string; source_id: string; source_number: string; source_revision: number; source_status: string; observed_at: string; content_fingerprint: string };
export type AiCommandScenario = { id: string; scenario_number: string; scenario_reference: string; name: string; base_forecast_run_id: string; base_forecast_run_number: string; base_forecast_revision: number; demand_change_percent: string; capacity_change_percent: string; cash_in_change_percent: string; cash_out_change_percent: string; simulated_order_value: string; simulated_required_capacity: string; simulated_available_capacity: string; simulated_capacity_gap: string; simulated_cash_in: string; simulated_cash_out: string; simulated_net_cash: string; engine_version: string; engine_fingerprint: string; status: string; calculated_by: string; calculated_at: string; revision: number };
export type AiCommandRecommendation = { id: string; recommendation_number: string; query_id?: string | null; scenario_id?: string | null; title: string; rationale: string; target_system: string; owner: string; due_at: string; risk_level: string; status: "pending-approval" | "approved" | "handed-off" | "closed"; authored_by: string; approval_reference?: string | null; approved_by?: string | null; approved_at?: string | null; revision: number };
export type AiCommandHandoff = { id: string; handoff_number: string; recommendation_id: string; recommendation_number: string; target_system: string; handoff_reference: string; execution_reference?: string | null; status: "handed-off" | "closed"; handed_off_by: string; handed_off_at: string; closed_by?: string | null; closed_at?: string | null; revision: number };
export type AiCommandWorkspace = { queries: AiCommandQuery[]; citations: AiCommandCitation[]; scenarios: AiCommandScenario[]; recommendations: AiCommandRecommendation[]; handoffs: AiCommandHandoff[]; evidence: Array<Record<string, unknown>>; readiness: Array<{ source_type: string; ready: boolean; published_count: number }>; contract: { engine: string; external_llm_called: boolean; answers_require_citations: boolean; scenario_writeback: boolean; recommendation_requires_independent_approval: boolean; business_execution_remains_in_target_system: boolean } };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token = authApi.getStoredToken();
  if (!token && await authApi.restoreLocalDemoSession("hq")) token = authApi.getStoredToken();
  const headers = new Headers(init?.headers); headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  if (response.status === 401 && await authApi.restoreLocalDemoSession("hq")) {
    const restored = authApi.getStoredToken(); if (restored) headers.set("Authorization", `Bearer ${restored}`);
    response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `AI战情请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/ai-command`;
const post = <T>(path: string, payload: Record<string, unknown>) => request<T>(path, { method: "POST", body: JSON.stringify(payload) });

export const listAiCommandWorkspace = (projectId: number) => request<AiCommandWorkspace>(base(projectId));
export const askAiCommand = (projectId: number, payload: Record<string, unknown>) => post<{ query: AiCommandQuery; citations: AiCommandCitation[] }>(`${base(projectId)}/queries`, payload);
export const simulateAiCommand = (projectId: number, payload: Record<string, unknown>) => post<AiCommandScenario>(`${base(projectId)}/scenarios`, payload);
export const createAiRecommendation = (projectId: number, payload: Record<string, unknown>) => post<AiCommandRecommendation>(`${base(projectId)}/recommendations`, payload);
export const approveAiRecommendation = (projectId: number, itemId: string, payload: Record<string, unknown>) => post<AiCommandRecommendation>(`${base(projectId)}/recommendations/${encodeURIComponent(itemId)}/approve`, payload);
export const handoffAiRecommendation = (projectId: number, itemId: string, payload: Record<string, unknown>) => post<{ recommendation: AiCommandRecommendation; handoff: AiCommandHandoff }>(`${base(projectId)}/recommendations/${encodeURIComponent(itemId)}/handoff`, payload);
export const closeAiHandoff = (projectId: number, itemId: string, payload: Record<string, unknown>) => post<{ recommendation: AiCommandRecommendation; handoff: AiCommandHandoff }>(`${base(projectId)}/handoffs/${encodeURIComponent(itemId)}/close`, payload);
