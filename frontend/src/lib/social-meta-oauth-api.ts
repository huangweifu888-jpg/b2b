import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type SocialMetaOAuthReadiness = {
  provider: "facebook" | "instagram";
  official_flow: "Meta OAuth 2.0";
  external_redirect_started: false;
  requirements: {
    application_active: boolean;
    callback_configured: boolean;
    secrets_backend_configured: boolean;
    client_id_configured: boolean;
    start_enabled: boolean;
    ready: boolean;
  };
  message: string;
};

export const socialMetaOAuthApi = {
  async readiness(projectId: number, provider: "facebook" | "instagram"): Promise<SocialMetaOAuthReadiness> {
    const headers = new Headers();
    const token = authApi.getStoredToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${getAPIBaseURL()}/api/v1/social-meta-oauth/readiness?project_id=${encodeURIComponent(projectId)}&provider=${provider}`, { headers });
    if (!response.ok) throw new Error(`Social Meta OAuth readiness API: ${response.status}`);
    return response.json() as Promise<SocialMetaOAuthReadiness>;
  },
};
