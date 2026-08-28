import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type FactoryIndustryPackInstallation = {
  id: string; project_id: number; tenant_id: string; client_id: string; plan_id: string;
  pack_id: "machinery"; segment: "industrial-pump-valve"; package_version: number;
  configuration: Record<string, string>; evidence: Record<string, string>;
  required_configuration: string[]; required_evidence: string[];
  status: "draft" | "validated" | "published"; revision: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token = authApi.getStoredToken();
  if (!token && await authApi.restoreLocalDemoSession("hq")) token = authApi.getStoredToken();
  const headers = new Headers(init?.headers); headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${getAPIBaseURL()}${path}`, { ...init, headers });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(typeof body.detail === "string" ? body.detail : `行业包请求失败（${response.status}）`); }
  return response.json() as Promise<T>;
}

const base = (projectId: number) => `/api/v1/factory-platform/projects/${projectId}/industry-packs`;
export const listFactoryIndustryPacks = (projectId: number) => request<{ items: FactoryIndustryPackInstallation[] }>(base(projectId));
export const createFactoryMachineryPack = (projectId: number) => request<FactoryIndustryPackInstallation>(base(projectId), { method: "POST", body: JSON.stringify({ segment: "industrial-pump-valve" }) });
export const updateFactoryIndustryPack = (projectId: number, id: string, payload: { expected_revision: number; configuration: Record<string, string>; evidence: Record<string, string> }) => request<FactoryIndustryPackInstallation>(`${base(projectId)}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
export const validateFactoryIndustryPack = (projectId: number, id: string, expectedRevision: number) => request<FactoryIndustryPackInstallation>(`${base(projectId)}/${encodeURIComponent(id)}/validate`, { method: "POST", body: JSON.stringify({ expected_revision: expectedRevision }) });
export const publishFactoryIndustryPack = (projectId: number, id: string, expectedRevision: number) => request<FactoryIndustryPackInstallation>(`${base(projectId)}/${encodeURIComponent(id)}/publish`, { method: "POST", body: JSON.stringify({ expected_revision: expectedRevision }) });
