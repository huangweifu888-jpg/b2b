import { getAPIBaseURL } from "./config";

export type VersionBackupBootstrapPayload = {
  programVersions?: Record<string, unknown[]>;
  siteVersions?: Record<string, unknown[]>;
};

let bootstrapPayloadPromise: Promise<VersionBackupBootstrapPayload> | null = null;

function versionApiBases() {
  return Array.from(new Set(["", getAPIBaseURL(), "http://127.0.0.1:8000", "http://127.0.0.1:8002"]));
}

async function fetchBootstrapPayload() {
  let lastError: unknown = null;
  for (const base of versionApiBases()) {
    const url = `${base}/api/v1/version-backups/bootstrap`;
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json() as VersionBackupBootstrapPayload;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("版本备份接口暂时不可用");
}

/** One bootstrap read is shared by program and site version hydration. */
export function loadVersionBackupBootstrapPayload() {
  if (!bootstrapPayloadPromise) {
    bootstrapPayloadPromise = fetchBootstrapPayload().catch((error) => {
      bootstrapPayloadPromise = null;
      throw error;
    });
  }
  return bootstrapPayloadPromise;
}
