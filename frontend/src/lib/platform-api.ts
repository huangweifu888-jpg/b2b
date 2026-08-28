import { getAPIBaseURL } from "./config";
import { authApi } from "./auth";

const fallbackBases = ["", "http://127.0.0.1:8000", "http://127.0.0.1:8002"];

// Remove the pre-auth cache once. It may contain another user's tenant tree
// from an older build, so it must not survive the authorization rollout.
if (typeof window !== "undefined") {
  window.localStorage.removeItem("tradepro.platformTreeCache.v1");
}

async function platformFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const runtimeBase = getAPIBaseURL();
  const bases = Array.from(
    new Set([runtimeBase, ...fallbackBases].filter((base): base is string => base !== undefined && base !== null))
  );
  let lastError: unknown;
  let authorizationError: Error | null = null;

  for (const base of bases) {
    const url = base ? `${base}${path}` : path;
    try {
      const headers = new Headers(init?.headers);
      const token = authApi.getStoredToken();
      if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      const response = await fetch(url, { ...init, headers });
      if (!response.ok) {
        const responseError = new Error(`${response.status} ${response.statusText}`);
        if (response.status === 401 || response.status === 403) {
          authorizationError = authorizationError || responseError;
          // Authorization is identity-scoped, not endpoint-scoped. Trying a
          // fallback server after it fails both delays the page and risks
          // bypassing the intended tenant boundary.
          break;
        }
        lastError = responseError;
        continue;
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
    }
  }

  if (authorizationError) {
    throw authorizationError;
  }
  throw lastError instanceof Error ? lastError : new Error("平台接口暂时不可用");
}

async function platformMutationFetch<T>(path: string, init: RequestInit): Promise<T> {
  return platformFetch<T>(path, init);
}

export interface PlatformOverview {
  status: string;
  counts: {
    organizations: number;
    projects: number;
    roles: number;
    memberships: number;
    backups: number;
    aiProviders: number;
  };
  tech_stack: {
    primary_languages: Array<{
      name: string;
      usage: string;
      framework: string;
      responsibility: string[];
    }>;
    supporting_languages: Array<{
      name: string;
      usage: string;
    }>;
  };
  deployment_strategy: string[];
  implemented: string[];
  next: string[];
}

export interface PlatformNode {
  id: number;
  name: string;
  code: string;
  org_type: "hq" | "agency" | "sub_agency" | "client";
  parent_id: number | null;
  parent_code?: string | null;
  root_org_id?: number | null;
  root_agency_id?: number | null;
  agent_level?: number | null;
  agent_level_label?: string;
  lineage_path?: string | null;
  status: string;
  commission_mode?: string | null;
  commission_rate?: number | null;
  first_order_commission_rate?: number | null;
  renewal_commission_rate?: number | null;
  package_commission_rate?: number | null;
  discount_rate?: number | null;
  invite_code?: string | null;
  invite_url?: string | null;
  qr_code_url?: string | null;
  settings?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  children: PlatformNode[];
  projects: Array<{
    id: number;
    client_org_id: number;
    name: string;
    code: string;
    domain?: string | null;
    status: string;
    created_at?: string;
    updated_at?: string;
  }>;
}

export interface PlatformOrganization {
  id: number;
  name: string;
  code: string;
  org_type: "hq" | "agency" | "sub_agency" | "client";
  parent_id: number | null;
  parent_code?: string | null;
  root_org_id?: number | null;
  root_agency_id?: number | null;
  agent_level?: number | null;
  agent_level_label?: string;
  lineage_path?: string | null;
  status: string;
  commission_mode?: string | null;
  commission_rate?: number | null;
  first_order_commission_rate?: number | null;
  renewal_commission_rate?: number | null;
  package_commission_rate?: number | null;
  discount_rate?: number | null;
  invite_code?: string | null;
  invite_url?: string | null;
  qr_code_url?: string | null;
  settings?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface PlatformProject {
  id: number;
  client_org_id: number;
  name: string;
  code: string;
  domain?: string | null;
  status: string;
  owner_user_id?: string | null;
  settings?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface PlatformRole {
  id: number;
  org_id: number | null;
  scope: string;
  name: string;
  description?: string | null;
  permissions: string[];
  is_system: boolean;
}

export interface PlatformMembership {
  id: number;
  user_id: string;
  email: string;
  name: string;
  org_id: number;
  org_code: string;
  org_name: string;
  org_type: string;
  project_id: number | null;
  project_code: string;
  project_name: string;
  role_id: number | null;
  role_name: string;
  role_scope: string;
  status: string;
  is_default: boolean;
  last_login?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AIProvider {
  id: number;
  org_id: number | null;
  provider_key: string;
  name: string;
  base_url?: string | null;
  default_model?: string | null;
  api_key_env?: string | null;
  is_active: boolean;
  is_default: boolean;
  settings?: Record<string, unknown>;
}

export interface AIAssignment {
  id: number;
  org_id: number | null;
  org_code: string;
  org_name: string;
  org_type: string;
  app_key: string;
  app_name: string;
  category: string;
  scope: string;
  primary_provider_id: number | null;
  primary_provider_key: string;
  primary_provider_name: string;
  primary_model: string;
  backup_provider_id: number | null;
  backup_provider_key: string;
  backup_provider_name: string;
  backup_model: string;
  enabled: boolean;
  sort_order: number;
  settings?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface AIAssignmentResolutionChainEntry {
  org_id: number | null;
  org_code: string;
  org_name: string;
  org_type: string;
  matched: boolean;
}

export interface AIAssignmentResolution {
  app_key: string;
  site_id?: string | null;
  project_id?: number | null;
  org_id?: number | null;
  resolved: boolean;
  matched_assignment_id: number | null;
  matched_org_id: number | null;
  matched_org_code: string;
  matched_org_name: string;
  matched_org_type: string;
  app_name: string;
  primary_provider_id: number | null;
  primary_provider_key: string;
  primary_provider_name: string;
  primary_model: string;
  backup_provider_id: number | null;
  backup_provider_key: string;
  backup_provider_name: string;
  backup_model: string;
  enabled: boolean;
  sort_order: number;
  search_chain: AIAssignmentResolutionChainEntry[];
}

export interface OrganizationCreatePayload {
  name: string;
  org_type: "agency" | "sub_agency" | "client";
  parent_id?: number | null;
  code?: string;
  commission_mode?: string | null;
  commission_rate?: number | null;
  first_order_commission_rate?: number | null;
  renewal_commission_rate?: number | null;
  package_commission_rate?: number | null;
  discount_rate?: number | null;
  invite_code?: string | null;
  company_short_name?: string | null;
  company_logo_url?: string | null;
  company_logo_asset_id?: string | null;
  company_logo_icon?: string | null;
  contact_name?: string | null;
  mobile_phone?: string | null;
  address?: string | null;
  email?: string | null;
  status?: string | null;
}

export interface OrganizationUpdatePayload {
  name?: string;
  commission_mode?: string | null;
  commission_rate?: number | null;
  discount_rate?: number | null;
  invite_code?: string | null;
  company_short_name?: string | null;
  company_logo_url?: string | null;
  company_logo_asset_id?: string | null;
  company_logo_icon?: string | null;
  contact_name?: string | null;
  mobile_phone?: string | null;
  address?: string | null;
  email?: string | null;
  status?: string | null;
  quota_limits?: Partial<Record<"agencies" | "sub_agencies" | "clients" | "plans", number>>;
}

export interface TenantQuotaStatus {
  resource: "agencies" | "sub_agencies" | "clients" | "plans";
  used: number;
  limit: number;
  status: "available" | "warning" | "blocked";
}

export interface TenantHealthFinding {
  code: string;
  severity: "error" | "warning";
  subject_type: string;
  subject_id: string;
  detail: string;
}

export interface TenantHealthReport {
  status: "healthy" | "unhealthy";
  scope_organization_id: number | null;
  totals: { organizations: number; projects: number; runtime_configs: number; template_instances: number };
  findings: TenantHealthFinding[];
  finding_counts: { error: number; warning: number; reported: number; total: number };
}

export interface ProjectCreatePayload {
  client_org_id: number;
  name: string;
  code?: string;
  domain?: string | null;
}

export interface ProjectUpdatePayload {
  name?: string;
  domain?: string | null;
  status?: string;
}

export interface AIAssignmentCreatePayload {
  org_id?: number | null;
  app_key: string;
  app_name: string;
  category?: string | null;
  scope?: string | null;
  primary_provider_id?: number | null;
  primary_model?: string | null;
  backup_provider_id?: number | null;
  backup_model?: string | null;
  enabled?: boolean;
  sort_order?: number;
}

export interface AIAssignmentUpdatePayload {
  app_name?: string;
  category?: string | null;
  scope?: string | null;
  primary_provider_id?: number | null;
  primary_model?: string | null;
  backup_provider_id?: number | null;
  backup_model?: string | null;
  enabled?: boolean;
  sort_order?: number;
}

export const platformApi = {
  overview: () => platformFetch<PlatformOverview>("/api/v1/platform/overview"),
  // Do not persist tenant trees in local storage: a browser account switch must
  // never expose a previous account's organization hierarchy.
  tree: () => platformFetch<{ items: PlatformNode[] }>("/api/v1/platform/tree"),
  organizations: () => platformFetch<{ items: PlatformOrganization[] }>("/api/v1/platform/organizations"),
  nextOrganizationCode: (orgType: "agency" | "sub_agency" | "client", parentId?: number | null) => {
    const query = new URLSearchParams();
    query.set("org_type", orgType);
    if (typeof parentId === "number") query.set("parent_id", String(parentId));
    return platformFetch<{ code: string }>(`/api/v1/platform/organizations/next-code?${query.toString()}`);
  },
  createOrganization: (payload: OrganizationCreatePayload) =>
    platformFetch<PlatformOrganization>("/api/v1/platform/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  projects: () => platformFetch<{ items: PlatformProject[] }>("/api/v1/platform/projects"),
  nextProjectCode: () => platformFetch<{ code: string }>("/api/v1/platform/projects/next-code"),
  createProject: (payload: ProjectCreatePayload) =>
    platformFetch<PlatformProject>("/api/v1/platform/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateOrganization: (organizationId: number, payload: OrganizationUpdatePayload) =>
    platformMutationFetch<PlatformOrganization>(`/api/v1/platform/organizations/${organizationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  organizationQuotaStatus: (organizationId: number) =>
    platformFetch<{ organization_id: number; items: TenantQuotaStatus[] }>(`/api/v1/platform/organizations/${organizationId}/quota-status`),
  tenantHealth: (organizationId?: number | null) => {
    const query = typeof organizationId === "number" ? `?organization_id=${organizationId}` : "";
    return platformFetch<TenantHealthReport>(`/api/v1/platform/tenant-health${query}`);
  },
  updateProject: (projectId: number, payload: ProjectUpdatePayload) =>
    platformFetch<PlatformProject>(`/api/v1/platform/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteProject: (projectId: number) =>
    platformFetch<{ deleted: boolean; project_id: number }>(`/api/v1/platform/projects/${projectId}`, {
      method: "DELETE",
    }),
  roles: () => platformFetch<{ items: PlatformRole[] }>("/api/v1/platform/roles"),
  memberships: () => platformFetch<{ items: PlatformMembership[] }>("/api/v1/platform/memberships"),
  aiProviders: () => platformFetch<{ items: AIProvider[] }>("/api/v1/platform/ai-providers"),
  aiAssignments: () => platformFetch<{ items: AIAssignment[] }>("/api/v1/platform/ai-assignments"),
  resolveAIAssignment: (params: { appKey: string; siteId?: string | null; projectId?: number | null; orgId?: number | null }) => {
    const query = new URLSearchParams();
    query.set("app_key", params.appKey);
    if (params.siteId) query.set("site_id", params.siteId);
    if (typeof params.projectId === "number") query.set("project_id", String(params.projectId));
    if (typeof params.orgId === "number") query.set("org_id", String(params.orgId));
    return platformFetch<AIAssignmentResolution>(`/api/v1/platform/ai-assignments/resolve?${query.toString()}`);
  },
  setDefaultAIProvider: (providerId: number) =>
    platformMutationFetch<{ message: string; provider_id: number }>(`/api/v1/platform/ai-providers/${providerId}/default`, {
      method: "PUT",
    }),
  createAIAssignment: (payload: AIAssignmentCreatePayload) =>
    platformMutationFetch<AIAssignment>("/api/v1/platform/ai-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateAIAssignment: (assignmentId: number, payload: AIAssignmentUpdatePayload) =>
    platformMutationFetch<AIAssignment>(`/api/v1/platform/ai-assignments/${assignmentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteAIAssignment: (assignmentId: number) =>
    platformMutationFetch<{ message: string; assignment_id: number }>(`/api/v1/platform/ai-assignments/${assignmentId}`, {
      method: "DELETE",
    }),
};
