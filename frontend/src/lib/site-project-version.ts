import type { AIBuilderScope } from "./ai-builder-scope";
import type { SiteBuilderState } from "./ai-site-builder";
import { getAPIBaseURL } from "./config";
import { safeRemoveLocalStorage, safeSetLocalStorage } from "./storage-guards";
import { sanitizeDisplayText, sanitizeSummaryText } from "./text-sanitizer";
import { loadVersionBackupBootstrapPayload } from "./version-backup-bootstrap";

export interface SiteProjectVersionEntry {
  id: string;
  siteId: string;
  scope: AIBuilderScope;
  createdAt: string;
  siteName: string;
  builderState: SiteBuilderState;
  html: string;
  summary?: string;
}

const MAX_SITE_HISTORY = 10;
const CURRENT_VERSION_KEY_PREFIX = "site-project-version-current";
const SITE_VERSION_BOOTSTRAP_KEY = "tradepro.siteVersionBackupBootstrap.v1";
const VERSION_API_PATH = "/api/v1/version-backups";
const pendingSiteVersionSyncs = new Set<string>();
const completedSiteVersionSyncs = new Set<string>();

function historyKey(siteId: string) {
  return `site-project-version-history:${siteId}`;
}

function counterKey(siteId: string) {
  return `site-project-version-counter:${siteId}`;
}

function currentVersionKey(siteId: string) {
  return `${CURRENT_VERSION_KEY_PREFIX}:${siteId}`;
}

function versionSortWeight(entry: SiteProjectVersionEntry) {
  const idWeight = Number(entry.id.replace(/\D/g, "") || "0");
  const createdWeight = Number.isFinite(Date.parse(entry.createdAt)) ? Date.parse(entry.createdAt) : 0;
  return Math.max(idWeight, createdWeight);
}

function sortSiteVersions(entries: SiteProjectVersionEntry[]) {
  return [...entries].sort((a, b) => versionSortWeight(b) - versionSortWeight(a));
}

function versionApiBases() {
  return Array.from(new Set(["", getAPIBaseURL(), "http://127.0.0.1:8000", "http://127.0.0.1:8002"]));
}

async function versionApiFetch(path: string, init?: RequestInit) {
  let lastError: unknown = null;
  for (const base of versionApiBases()) {
    const url = base ? `${base}${path}` : path;
    try {
      const response = await fetch(url, init);
      if (response.ok) return response;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("站点版本备份接口暂时不可用");
}

function runInBackground(task: Promise<unknown>) {
  void task.catch(() => undefined);
}

function normalizeSiteVersionEntry(entry: SiteProjectVersionEntry): SiteProjectVersionEntry {
  return {
    ...entry,
    siteName: sanitizeDisplayText(entry.siteName, "未命名站点"),
    summary: sanitizeSummaryText(entry.summary) || undefined,
  };
}

export function formatSiteVersionId(versionId: string) {
  return versionId.replace(/^A(\d+)$/i, "J$1");
}

export function clearSiteProjectVersions(siteId: string) {
  if (typeof window === "undefined") return;
  safeRemoveLocalStorage(historyKey(siteId));
  safeRemoveLocalStorage(counterKey(siteId));
  safeRemoveLocalStorage(currentVersionKey(siteId));
  window.dispatchEvent(new CustomEvent("site-project-version-updated", { detail: { siteId, cleared: true } }));
}

function mergeSiteEntries(siteId: string, entries: SiteProjectVersionEntry[]) {
  const merged = sortSiteVersions([...entries, ...readSiteProjectVersions(siteId)])
    .filter((item) => item?.id && item?.siteId)
    .reduce<SiteProjectVersionEntry[]>((list, item) => {
      if (list.some((entry) => entry.id === item.id)) return list;
      list.push(normalizeSiteVersionEntry(item));
      return list;
    }, [])
    .sort((a, b) => Number(b.id.replace(/\D/g, "") || "0") - Number(a.id.replace(/\D/g, "") || "0"))
    .slice(0, MAX_SITE_HISTORY);

  if (!merged.length) return;
  safeSetLocalStorage(historyKey(siteId), JSON.stringify(merged), { compact: true });
  const maxVersion = merged.reduce((value, item) => Math.max(value, Number(item.id.replace(/\D/g, "") || "0")), 0);
  safeSetLocalStorage(counterKey(siteId), String(maxVersion));
  if (!window.localStorage.getItem(currentVersionKey(siteId))) {
    safeSetLocalStorage(currentVersionKey(siteId), merged[0].id);
  }
}

export async function bootstrapSiteProjectVersionBackups() {
  if (typeof window === "undefined") return;
  if (window.sessionStorage.getItem(SITE_VERSION_BOOTSTRAP_KEY) === "done") return;

  try {
    const payload = await loadVersionBackupBootstrapPayload() as {
      siteVersions?: Record<string, SiteProjectVersionEntry[]>;
    };

    Object.entries(payload.siteVersions || {}).forEach(([siteId, items]) => {
      if (Array.isArray(items) && items.length) {
        mergeSiteEntries(siteId, items);
      }
    });

    const localKeys = Array.from({ length: window.localStorage.length })
      .map((_, index) => window.localStorage.key(index))
      .filter((key): key is string => !!key && key.startsWith("site-project-version-history:"));

    const remoteVersionIds = new Map(
      Object.entries(payload.siteVersions || {}).map(([siteId, entries]) => [
        siteId,
        new Set((Array.isArray(entries) ? entries : []).map((entry) => entry.id)),
      ])
    );
    const missingEntries = localKeys.flatMap((key) => {
      const siteId = key.replace("site-project-version-history:", "");
      const remoteIds = remoteVersionIds.get(siteId) || new Set<string>();
      return readSiteProjectVersions(siteId).filter((entry) => !remoteIds.has(entry.id));
    });
    // A browser may contain many locally cached plans.  Synchronize only
    // entries absent from the server and do it serially to avoid a CORS
    // preflight/write burst that can overload the local development backend.
    for (const entry of missingEntries) {
      await syncSiteVersionToBackend(entry);
    }
    window.sessionStorage.setItem(SITE_VERSION_BOOTSTRAP_KEY, "done");
  } catch {
    // Keep local behavior even if remote backup is unavailable.
  }
}

function syncSiteVersionToBackend(entry: SiteProjectVersionEntry) {
  const syncKey = `${entry.siteId}:${entry.id}`;
  if (pendingSiteVersionSyncs.has(syncKey) || completedSiteVersionSyncs.has(syncKey)) {
    return Promise.resolve(null);
  }
  pendingSiteVersionSyncs.add(syncKey);
  return versionApiFetch(`${VERSION_API_PATH}/site`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(normalizeSiteVersionEntry(entry)),
  })
    .then((response) => {
      completedSiteVersionSyncs.add(syncKey);
      return response;
    })
    .finally(() => pendingSiteVersionSyncs.delete(syncKey));
}

export function readSiteProjectVersions(siteId: string): SiteProjectVersionEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(historyKey(siteId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SiteProjectVersionEntry[];
    if (!Array.isArray(parsed)) return [];

    const filtered = parsed.filter((item) => item?.id && item?.siteId);
    const sanitized = sortSiteVersions(filtered.map(normalizeSiteVersionEntry)).slice(0, MAX_SITE_HISTORY);
    if (JSON.stringify(filtered) !== JSON.stringify(sanitized)) {
      safeSetLocalStorage(historyKey(siteId), JSON.stringify(sanitized), { compact: true });
      const currentId = window.localStorage.getItem(currentVersionKey(siteId));
      if (!currentId || !sanitized.some((item) => item.id === currentId)) {
        safeSetLocalStorage(currentVersionKey(siteId), sanitized[0]?.id || "");
      }
    }
    return sanitized;
  } catch {
    return [];
  }
}

export function getLatestSiteProjectVersion(siteId: string) {
  return readSiteProjectVersions(siteId)[0] ?? null;
}

export function getCurrentSiteProjectVersion(siteId: string) {
  if (typeof window === "undefined") return getLatestSiteProjectVersion(siteId);
  const currentId = window.localStorage.getItem(currentVersionKey(siteId));
  const versions = readSiteProjectVersions(siteId);
  if (!currentId) return versions[0] ?? null;
  return versions.find((item) => item.id === currentId) || versions[0] || null;
}

export function setCurrentSiteProjectVersion(siteId: string, versionId: string) {
  if (typeof window === "undefined") return;
  safeSetLocalStorage(currentVersionKey(siteId), versionId);
  window.dispatchEvent(new CustomEvent("site-project-version-updated", { detail: { siteId, version: versionId, current: true } }));
}

export function createSiteProjectVersion(
  siteId: string,
  scope: AIBuilderScope,
  siteName: string,
  builderState: SiteBuilderState,
  html: string,
  summary?: string,
  options: { force?: boolean } = {}
) {
  if (typeof window === "undefined") return null;

  const existing = readSiteProjectVersions(siteId);
  if (
    !options.force &&
    existing[0] &&
    JSON.stringify(existing[0].builderState) === JSON.stringify(builderState) &&
    existing[0].html === html
  ) {
    return existing[0];
  }

  const nextNumber = Number(window.localStorage.getItem(counterKey(siteId)) || "0") + 1;
  const entry = normalizeSiteVersionEntry({
    id: `J${nextNumber}`,
    siteId,
    scope,
    createdAt: new Date().toISOString(),
    siteName,
    builderState,
    html,
    summary,
  });

  safeSetLocalStorage(counterKey(siteId), String(nextNumber));
  safeSetLocalStorage(
    historyKey(siteId),
    JSON.stringify([entry, ...existing.filter((item) => item.id !== entry.id)].slice(0, MAX_SITE_HISTORY)),
    { compact: true }
  );
  safeSetLocalStorage(currentVersionKey(siteId), entry.id);
  runInBackground(syncSiteVersionToBackend(entry));
  window.dispatchEvent(new CustomEvent("site-project-version-updated", { detail: { siteId, version: entry.id } }));
  return entry;
}

export function restoreSiteProjectVersion(siteId: string, versionId: string) {
  if (typeof window === "undefined") return null;
  const versions = readSiteProjectVersions(siteId);
  const target = versions.find((item) => item.id === versionId);
  if (!target) return null;

  safeSetLocalStorage(currentVersionKey(siteId), versionId);
  window.dispatchEvent(new CustomEvent("site-project-version-updated", { detail: { siteId, version: versionId, restored: true } }));
  return target;
}
