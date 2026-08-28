import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type ImplementationStage = "day-7" | "day-30" | "day-90" | "completed";
export type ImplementationStatus = "active" | "blocked" | "completed";
export type ImplementationGoldenFlow = "revenue" | "manufacturing" | "asset-renewal" | "global-compliance" | "intelligent-action";

export type FactoryImplementationProgram = {
  id: string;
  project_id: number;
  tenant_id: string;
  client_id: string;
  plan_id: string;
  title: string;
  golden_flow: ImplementationGoldenFlow;
  baseline_summary: string;
  target_outcome: string;
  current_stage: ImplementationStage;
  status: ImplementationStatus;
  artifacts: Record<string, string>;
  required_artifacts: string[];
  blockers: string[];
  next_action: string;
  revision: number;
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
    throw new Error(typeof body.detail === "string" ? body.detail : `实施中心请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/implementation-programs`;
export const listFactoryImplementationPrograms = (projectId: number) => request<{ items: FactoryImplementationProgram[] }>(base(projectId));
export const createFactoryImplementationProgram = (projectId: number, payload: { title: string; golden_flow: FactoryImplementationProgram["golden_flow"]; baseline_summary: string; target_outcome: string }) => request<FactoryImplementationProgram>(base(projectId), { method: "POST", body: JSON.stringify(payload) });
export const updateFactoryImplementationProgram = (projectId: number, id: string, payload: { expected_revision: number; artifacts?: Record<string, string>; blockers?: string[]; next_action?: string; status?: "active" | "blocked" }) => request<FactoryImplementationProgram>(`${base(projectId)}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
export const advanceFactoryImplementationProgram = (projectId: number, id: string, expectedRevision: number) => request<FactoryImplementationProgram>(`${base(projectId)}/${encodeURIComponent(id)}/advance`, { method: "POST", body: JSON.stringify({ expected_revision: expectedRevision }) });
