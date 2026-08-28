import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type FactoryExecutionStatus = "active" | "queued" | "blocked" | "done";
export type FactoryDevelopmentGate = "intake-review" | "contract-freeze" | "security-review" | "development-acceptance" | "business-acceptance" | "release-readiness" | "value-review";

export type FactoryExecutionWorkstreamRecord = {
  id: string;
  sequence: number;
  label: string;
  status: FactoryExecutionStatus;
  current_gate: FactoryDevelopmentGate;
  owner_roles: string[];
  deliverables: string[];
  blockers: string[];
  evidence: string[];
  next_action: string;
  revision: number;
  updated_by?: string | null;
  updated_at?: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token = authApi.getStoredToken();
  // The execution desk is a headquarters control plane. Local development may
  // recreate its loopback-only demo session after a backend restart; formal
  // environments still require the normal OIDC session.
  if (!token && await authApi.restoreLocalDemoSession("hq")) {
    token = authApi.getStoredToken();
  }
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `执行台请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

export async function listFactoryExecutionWorkstreams() {
  return request<{ items: FactoryExecutionWorkstreamRecord[] }>("/api/v1/factory-platform/execution/workstreams");
}

export async function updateFactoryExecutionWorkstream(id: string, payload: Omit<Partial<FactoryExecutionWorkstreamRecord>, "id" | "sequence" | "label" | "revision"> & { expected_revision: number }) {
  return request<FactoryExecutionWorkstreamRecord>(`/api/v1/factory-platform/execution/workstreams/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
