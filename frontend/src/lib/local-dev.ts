export type LocalEnvServiceStatus = {
  port: number;
  url: string;
  listening: boolean;
  healthy: boolean;
  status: "running" | "starting" | "stopped";
};

export type LocalEnvStatusResponse = {
  ok: boolean;
  checkedAt: string;
  frontend: LocalEnvServiceStatus;
  backend: LocalEnvServiceStatus;
  website: LocalEnvServiceStatus;
};

const apiCandidates = ["", "http://127.0.0.1:8000", "http://127.0.0.1:8002"];

export function shouldAttemptLocalEnvRecovery(status: LocalEnvStatusResponse | null) {
  if (!status) return true;
  if (status.ok) return false;

  const services = [status.frontend, status.backend, status.website];
  return services.some((service) => service.status !== "running" || !service.listening || !service.healthy);
}

export function getLocalEnvRecoveryAction(status: LocalEnvStatusResponse | null, errorMessage = "") {
  if (!status) {
    return errorMessage ? "restart" : null;
  }

  if (!shouldAttemptLocalEnvRecovery(status)) return null;

  const services = [status.frontend, status.backend, status.website];
  const stoppedCount = services.filter((service) => service.status === "stopped" || !service.listening).length;
  const unhealthyCount = services.filter((service) => service.status === "running" && !service.healthy).length;

  if (stoppedCount === services.length) return "start";
  if (stoppedCount > 0 || unhealthyCount > 0) return "restart";
  return null;
}

export function formatLocalEnvTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function serviceStatusLabel(status: LocalEnvServiceStatus["status"]) {
  if (status === "running") return "\u8fd0\u884c\u4e2d";
  if (status === "starting") return "\u542f\u52a8\u4e2d";
  return "\u672a\u542f\u52a8";
}

export function serviceStatusTone(status: LocalEnvServiceStatus["status"]) {
  if (status === "running") return "text-emerald-600";
  if (status === "starting") return "text-amber-600";
  return "text-rose-600";
}

export async function readLocalEnvStatus() {
  const response = await localDevFetch("/api/v1/local-dev/local-env-status");
  return (await response.json()) as LocalEnvStatusResponse;
}

export async function ensureLocalEnvReady() {
  try {
    return await readLocalEnvStatus();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message || "本地开发环境暂时不可用");
  }
}

export async function localDevFetch(path: string, init?: RequestInit) {
  let lastError: unknown = null;

  for (const base of apiCandidates) {
    const url = base ? `${base}${path}` : path;
    try {
      const response = await fetch(url, init);
      if (response.ok) return response;

      let detail = `${url} returned ${response.status}`;
      try {
        const data = await response.json();
        if (data?.detail) {
          detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
        }
      } catch {
        // Keep the fallback detail when the response body is not JSON.
      }
      lastError = new Error(detail);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("\u672c\u5730\u5f00\u53d1\u63a5\u53e3\u6682\u65f6\u4e0d\u53ef\u7528");
}
