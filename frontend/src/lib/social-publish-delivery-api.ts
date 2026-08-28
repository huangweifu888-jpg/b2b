import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

const BASE = "/api/v1/social-publish-delivery";

export type SocialPublishDeliveryReadiness = {
  database_configured: boolean;
  callback_base_configured: boolean;
  secrets_backend_configured: boolean;
  worker_enabled: boolean;
  execution_enabled: boolean;
  connector_implemented: boolean;
  ready_for_external_publish: boolean;
  mode: "external_publish_enabled" | "safe_local_or_staging_mode";
  message: string;
};

export type SocialPublishDeliveryChecklistItem = { id: string; title: string; owner: string; detail: string };

async function request<T>(path: string): Promise<T> {
  const headers = new Headers();
  const token = authApi.getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${getAPIBaseURL()}${BASE}${path}`, { headers });
  if (!response.ok) throw new Error(`Social publish delivery API: ${response.status}`);
  return response.json() as Promise<T>;
}

export const socialPublishDeliveryApi = {
  readiness: () => request<SocialPublishDeliveryReadiness>("/readiness"),
  checklist: () => request<{ items: SocialPublishDeliveryChecklistItem[] }>("/checklist"),
};
