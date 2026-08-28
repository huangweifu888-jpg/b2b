import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type AuditLogItem = {
  id: number;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  actor_ref?: string | null;
  detail?: Record<string, unknown> | null;
  created_at?: string | null;
};

export async function listAuditLogs(action?: string, limit = 50) {
  const token = authApi.getStoredToken();
  const query = new URLSearchParams({ limit: String(limit) });
  if (action) query.set("action", action);
  const response = await fetch(`${getAPIBaseURL()}/api/v1/audit-logs?${query.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`Audit log request failed: ${response.status}`);
  const body = await response.json() as { items?: AuditLogItem[] };
  return body.items || [];
}
