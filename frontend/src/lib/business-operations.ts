import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type ClientPlanProvisionRequest = {
  agencyOrgId: number;
  clientName: string;
  clientCode: string;
  planName: string;
  planCode: string;
};

export async function provisionClientPlan(payload: ClientPlanProvisionRequest) {
  const token = authApi.getStoredToken();
  const response = await fetch(`${getAPIBaseURL()}/api/v1/business-operations/provision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      agency_org_id: payload.agencyOrgId,
      client_name: payload.clientName,
      client_code: payload.clientCode,
      plan_name: payload.planName,
      plan_code: payload.planCode,
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : "客户源计划创建失败");
  }
  return response.json() as Promise<{ client_org_id: number; project_id: number; template_instance_id?: string | null }>;
}
