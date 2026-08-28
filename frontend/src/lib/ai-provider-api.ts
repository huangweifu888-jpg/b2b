import { getAPIBaseURL } from "./config";

const fallbackBases = ["http://127.0.0.1:8002", "http://127.0.0.1:8000"];

function getCandidateBases() {
  return Array.from(new Set([...fallbackBases, getAPIBaseURL()].filter(Boolean)));
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const bases = getCandidateBases();
  let lastError: unknown;

  for (const base of bases) {
    try {
      const response = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const detail =
          typeof payload?.detail === "string"
            ? payload.detail
            : typeof payload?.message === "string"
              ? payload.message
              : `${response.status} ${response.statusText}`;
        lastError = new Error(detail);
        continue;
      }
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("AI 服务暂时不可用");
}

export interface ProviderKeyTestPayload {
  provider: string;
  model: string;
  api_key: string;
  base_url?: string;
}

export interface ProviderKeyTestResult {
  success: boolean;
  provider: string;
  model: string;
  message: string;
}

export interface WebsiteBuilderPayload {
  provider: string;
  model: string;
  api_key: string;
  prompt: string;
  base_url?: string;
}

export interface WebsiteBuilderResult {
  content: string;
  provider: string;
  model: string;
}

export interface AssignedAppRunPayload {
  app_key: string;
  prompt: string;
  history?: Array<{ role: string; content: string }>;
  site_id?: string;
  project_id?: number;
  org_id?: number;
}

export interface AssignedAppRunResult {
  content: string;
  provider: string;
  model: string;
  app_key: string;
}

export interface GenAudioPayload {
  text: string;
  model?: string;
  gender?: "male" | "female";
  voice_style_key?: string;
}

export interface GenAudioResult {
  url: string;
  model: string;
  gender: string;
  voice: string;
}

export const aiProviderApi = {
  testKey: (payload: ProviderKeyTestPayload) =>
    postJson<ProviderKeyTestResult>("/api/v1/aihub/providers/test", payload),
  buildWebsite: (payload: WebsiteBuilderPayload) =>
    postJson<WebsiteBuilderResult>("/api/v1/aihub/website-builder", payload),
  runAssignedApp: (payload: AssignedAppRunPayload) =>
    postJson<AssignedAppRunResult>("/api/v1/aihub/assigned-app-run", payload),
  generateAudio: (payload: GenAudioPayload) =>
    postJson<GenAudioResult>("/api/v1/aihub/genaudio", payload),
};
