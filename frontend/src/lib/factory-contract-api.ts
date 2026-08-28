import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type FactoryContractStatus = "draft" | "frozen" | "deprecated";

export type FactoryObjectContractRecord = {
  id: string;
  sequence: number;
  label: string;
  system_of_record: string;
  identity_rule: string;
  minimum_fields: string[];
  lifecycle_status: FactoryContractStatus;
  schema_version: number;
  revision: number;
};

export type FactoryEventContractRecord = {
  id: string;
  sequence: number;
  label: string;
  subject_id: string;
  producer: string;
  consumers: string[];
  required_fields: string[];
  compatibility: "backward" | "forward" | "full" | "breaking";
  lifecycle_status: FactoryContractStatus;
  schema_version: number;
  revision: number;
};

export type FactoryContractRegistry = {
  objects: FactoryObjectContractRecord[];
  events: FactoryEventContractRecord[];
  required_event_fields: string[];
  summary: {
    object_count: number;
    event_count: number;
    frozen_object_count: number;
    frozen_event_count: number;
  };
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
    throw new Error(typeof body.detail === "string" ? body.detail : `契约注册表请求失败（${response.status}）`);
  }
  return response.json() as Promise<T>;
}

export const listFactoryContracts = () => request<FactoryContractRegistry>("/api/v1/factory-platform/contracts");

export const freezeFactoryContracts = () => request<FactoryContractRegistry>("/api/v1/factory-platform/contracts/freeze", { method: "POST" });

export const updateFactoryObjectContract = (id: string, payload: Partial<Omit<FactoryObjectContractRecord, "id" | "sequence" | "label" | "revision">> & { expected_revision: number }) =>
  request<FactoryObjectContractRecord>(`/api/v1/factory-platform/contracts/objects/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });

export const updateFactoryEventContract = (id: string, payload: Partial<Omit<FactoryEventContractRecord, "id" | "sequence" | "label" | "revision">> & { expected_revision: number }) =>
  request<FactoryEventContractRecord>(`/api/v1/factory-platform/contracts/events/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
