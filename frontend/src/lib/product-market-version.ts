import type { ExportableConfig } from "./product-market-store";
import { getAPIBaseURL } from "./config";
import { safeRemoveLocalStorage, safeSetLocalStorage } from "./storage-guards";
import { sanitizeDisplayText, sanitizeSummaryText } from "./text-sanitizer";
import { loadVersionBackupBootstrapPayload } from "./version-backup-bootstrap";

export type ProductMarketScope = "hq" | "agency" | "client" | "agency_source" | "client_source";

export interface ProductMarketVersionEntry {
  id: string;
  scope: ProductMarketScope;
  createdAt: string;
  config: ExportableConfig;
  source?: string;
  title?: string;
  summary?: string;
  aiHtml?: string;
}

export interface ProductMarketVersionOptions {
  force?: boolean;
  source?: string;
  title?: string;
  summary?: string;
  aiHtml?: string;
  fixedId?: string;
  createdAt?: string;
}

const MAX_HISTORY = 10;
const COUNTER_KEY = "product-market-version-counter";
const HISTORY_KEY = "product-market-version-history";
const BUILD_VERSION_KEY = "tradepro.buildVersion";
const CLIENT_COUNTER_KEY = "client-site-version-counter";
const CLIENT_HISTORY_KEY = "client-site-version-history";
const CLIENT_VERSION_KEY = "tradepro.clientSiteVersion";
const VERSION_BACKUP_BOOTSTRAP_KEY = "tradepro.versionBackupBootstrap.v1";
const VERSION_API_PATH = "/api/v1/version-backups";
const REMOTE_PROGRAM_VERSION_SCOPES: ProductMarketScope[] = ["hq"];
const pendingProgramVersionSyncs = new Set<string>();
const completedProgramVersionSyncs = new Set<string>();

export function buildVersionStorageKey(scope: ProductMarketScope) {
  return `${BUILD_VERSION_KEY}:${scope}`;
}

export function ensureProductMarketVersionCounter(scope: ProductMarketScope, minValue: number) {
  const current = readCounter(scope);
  if (current < minValue) {
    writeCounter(scope, minValue);
  }
}

export function clientVersionStorageKey(scope: ProductMarketScope) {
  return `${CLIENT_VERSION_KEY}:${scope}`;
}

export const scopeVersionLabels: Record<ProductMarketScope, string> = {
  hq: "\u603b\u90e8\u7aef",
  agency_source: "\u4ee3\u7406\u6e90",
  agency: "\u4ee3\u7406\u7aef",
  client_source: "\u5ba2\u6237\u6e90",
  client: "\u5ba2\u6237\u7aef",
};

function counterKey(scope: ProductMarketScope) {
  return `${COUNTER_KEY}:${scope}`;
}

function historyKey(scope: ProductMarketScope) {
  return `${HISTORY_KEY}:${scope}`;
}

function clientCounterKey(scope: ProductMarketScope) {
  return `${CLIENT_COUNTER_KEY}:${scope}`;
}

function clientHistoryKey(scope: ProductMarketScope) {
  return `${CLIENT_HISTORY_KEY}:${scope}`;
}

function normalizeVersionEntry(entry: ProductMarketVersionEntry): ProductMarketVersionEntry {
  return {
    ...entry,
    title: sanitizeDisplayText(entry.title, "") || undefined,
    source: sanitizeDisplayText(entry.source, "") || undefined,
    summary: sanitizeSummaryText(entry.summary) || undefined,
    aiHtml: entry.aiHtml ? entry.aiHtml.slice(0, 1200) : undefined,
  };
}

function readCounter(scope: ProductMarketScope) {
  if (typeof window === "undefined") return 0;
  const value = Number(window.localStorage.getItem(counterKey(scope)) || "0");
  return Number.isFinite(value) ? value : 0;
}

function writeCounter(scope: ProductMarketScope, value: number) {
  if (typeof window === "undefined") return;
  safeSetLocalStorage(counterKey(scope), String(value));
}

function safeSetStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    safeSetLocalStorage(key, value);
  } catch {
    try {
      const parsed = JSON.parse(value) as ProductMarketVersionEntry[];
      const compact = parsed.slice(0, 5).map((entry) => ({
        ...normalizeVersionEntry(entry),
        config: { ...entry.config, products: entry.config.products.slice(0, 8) },
      }));
      safeSetLocalStorage(key, JSON.stringify(compact), { compact: true });
    } catch {
      safeRemoveLocalStorage(key);
    }
  }
}

function readClientCounter(scope: ProductMarketScope) {
  if (typeof window === "undefined") return 0;
  const value = Number(window.localStorage.getItem(clientCounterKey(scope)) || "0");
  return Number.isFinite(value) ? value : 0;
}

function writeClientCounter(scope: ProductMarketScope, value: number) {
  if (typeof window === "undefined") return;
  safeSetLocalStorage(clientCounterKey(scope), String(value));
}

function sanitizeEntries(entries: ProductMarketVersionEntry[]) {
  return entries.map(normalizeVersionEntry);
}

export function readProductMarketVersions(scope: ProductMarketScope): ProductMarketVersionEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(historyKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProductMarketVersionEntry[];
    if (!Array.isArray(parsed)) return [];
    const filtered = parsed.filter((item) => item?.id && item?.config?.products && item.source !== "ai-chat");
    const sanitized = sanitizeEntries(filtered);
    if (JSON.stringify(filtered) !== JSON.stringify(sanitized)) {
      writeProductMarketVersions(scope, sanitized);
    }
    return sanitized;
  } catch {
    return [];
  }
}

export function readClientSiteVersions(scope: ProductMarketScope): ProductMarketVersionEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(clientHistoryKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProductMarketVersionEntry[];
    if (!Array.isArray(parsed)) return [];
    const filtered = parsed.filter((item) => item?.id && item?.config?.products);
    const sanitized = sanitizeEntries(filtered);
    if (JSON.stringify(filtered) !== JSON.stringify(sanitized)) {
      writeClientSiteVersions(scope, sanitized);
    }
    return sanitized;
  } catch {
    return [];
  }
}

function writeProductMarketVersions(scope: ProductMarketScope, entries: ProductMarketVersionEntry[]) {
  if (typeof window === "undefined") return;
  safeSetStorage(historyKey(scope), JSON.stringify(entries.slice(0, MAX_HISTORY).map(normalizeVersionEntry)));
}

function writeClientSiteVersions(scope: ProductMarketScope, entries: ProductMarketVersionEntry[]) {
  if (typeof window === "undefined") return;
  safeSetStorage(
    clientHistoryKey(scope),
    JSON.stringify(entries.slice(0, MAX_HISTORY).map(normalizeVersionEntry))
  );
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
  throw lastError || new Error("\u7248\u672c\u5907\u4efd\u63a5\u53e3\u6682\u65f6\u4e0d\u53ef\u7528");
}

function runInBackground(task: Promise<unknown>) {
  void task.catch(() => undefined);
}

function mergeProgramEntries(scope: ProductMarketScope, entries: ProductMarketVersionEntry[]) {
  const merged = [...entries, ...readProductMarketVersions(scope)]
    .filter((item) => item?.id && item?.config?.products)
    .reduce<ProductMarketVersionEntry[]>((list, item) => {
      if (list.some((entry) => entry.id === item.id)) return list;
      list.push(normalizeVersionEntry(item));
      return list;
    }, [])
    .sort((a, b) => Number(b.id.replace(/\D/g, "") || "0") - Number(a.id.replace(/\D/g, "") || "0"))
    .slice(0, MAX_HISTORY);

  if (!merged.length) return;
  writeProductMarketVersions(scope, merged);
  const maxVersion = merged.reduce((value, item) => Math.max(value, Number(item.id.replace(/\D/g, "") || "0")), 0);
  writeCounter(scope, maxVersion);
  if (!window.localStorage.getItem(buildVersionStorageKey(scope))) {
    safeSetLocalStorage(buildVersionStorageKey(scope), merged[0].id);
  }
  if (scope === "hq") {
    safeSetLocalStorage(BUILD_VERSION_KEY, merged[0].id);
  }
  // Same-window localStorage writes do not emit a storage event.  Notify the
  // version badge after the remote bootstrap so it can replace its initial
  // one-entry fallback with the complete retained history immediately.
  window.dispatchEvent(
    new CustomEvent("product-market-version-updated", { detail: { scope, version: merged[0].id } })
  );
}

export async function bootstrapProductMarketVersionBackups() {
  if (typeof window === "undefined") return;
  if (window.sessionStorage.getItem(VERSION_BACKUP_BOOTSTRAP_KEY) === "done") return;

  try {
    const payload = await loadVersionBackupBootstrapPayload() as {
      programVersions?: Partial<Record<ProductMarketScope, ProductMarketVersionEntry[]>>;
    };

    REMOTE_PROGRAM_VERSION_SCOPES.forEach((scope) => {
      const remoteEntries = Array.isArray(payload.programVersions?.[scope]) ? payload.programVersions?.[scope] || [] : [];
      mergeProgramEntries(scope, remoteEntries);
    });

    const syncTasks = REMOTE_PROGRAM_VERSION_SCOPES.flatMap((scope) => {
      const remoteIds = new Set((payload.programVersions?.[scope] || []).map((entry) => entry.id));
      return readProductMarketVersions(scope)
        .filter((entry) => !remoteIds.has(entry.id))
        .map((entry) =>
        versionApiFetch(`${VERSION_API_PATH}/program`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        })
      );
    });
    await Promise.allSettled(syncTasks);
    window.sessionStorage.setItem(VERSION_BACKUP_BOOTSTRAP_KEY, "done");
  } catch {
    // Keep local behavior even if backup bootstrap is unavailable.
  }
}

export function restoreProductMarketVersion(scope: ProductMarketScope, versionId: string) {
  if (typeof window === "undefined") return null;
  const entry = readProductMarketVersions(scope).find((item) => item.id === versionId);
  if (!entry) return null;

  safeSetLocalStorage(buildVersionStorageKey(scope), entry.id);
  if (scope === "hq") {
    safeSetLocalStorage(BUILD_VERSION_KEY, entry.id);
  }

  window.dispatchEvent(new CustomEvent("product-market-version-updated", { detail: { scope, version: entry.id } }));
  return entry;
}

function syncProgramVersionToBackend(entry: ProductMarketVersionEntry) {
  if (!REMOTE_PROGRAM_VERSION_SCOPES.includes(entry.scope)) {
    return Promise.resolve(null);
  }
  const syncKey = `${entry.scope}:${entry.id}`;
  if (pendingProgramVersionSyncs.has(syncKey) || completedProgramVersionSyncs.has(syncKey)) {
    return Promise.resolve(null);
  }
  pendingProgramVersionSyncs.add(syncKey);
  return versionApiFetch(`${VERSION_API_PATH}/program`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(normalizeVersionEntry(entry)),
  })
    .then((response) => {
      completedProgramVersionSyncs.add(syncKey);
      return response;
    })
    .finally(() => pendingProgramVersionSyncs.delete(syncKey));
}

export function createProductMarketVersion(
  scope: ProductMarketScope,
  config: ExportableConfig,
  options: ProductMarketVersionOptions = {}
) {
  if (typeof window === "undefined" || !config?.products) return null;
  const existing = readProductMarketVersions(scope);
  const fixedVersionId = options.fixedId?.trim() || "";
  const fixedVersionNumber = Number(fixedVersionId.replace(/\D/g, "") || "0");
  const existingFixedEntry = fixedVersionId ? existing.find((item) => item.id === fixedVersionId) || null : null;
  const hasSameLatestConfig = existing[0] && JSON.stringify(existing[0].config) === JSON.stringify(config);
  const hasSameFixedConfig =
    existingFixedEntry && JSON.stringify(existingFixedEntry.config) === JSON.stringify(config);

  if (!options.force && ((fixedVersionId && hasSameFixedConfig) || (!fixedVersionId && hasSameLatestConfig))) {
    const resolvedVersionId = fixedVersionId || existing[0]?.id || existingFixedEntry?.id || "";
    if (resolvedVersionId) {
      safeSetLocalStorage(BUILD_VERSION_KEY, resolvedVersionId);
      safeSetLocalStorage(buildVersionStorageKey(scope), resolvedVersionId);
      const matchedEntry = existing.find((item) => item.id === resolvedVersionId) || existing[0] || existingFixedEntry;
      if (matchedEntry) {
        runInBackground(syncProgramVersionToBackend(matchedEntry));
        window.dispatchEvent(
          new CustomEvent("product-market-version-updated", { detail: { scope, version: matchedEntry.id } })
        );
        return matchedEntry;
      }
    }
    safeSetLocalStorage(BUILD_VERSION_KEY, existing[0].id);
    return existing[0];
  }

  const nextNumber = fixedVersionId ? fixedVersionNumber : readCounter(scope) + 1;
  const entry = normalizeVersionEntry({
    id: fixedVersionId || `H${nextNumber}`,
    scope,
    createdAt: options.createdAt || new Date().toISOString(),
    config,
    source: options.source,
    title: options.title,
    summary: options.summary,
    aiHtml: options.aiHtml,
  });

  writeCounter(scope, Math.max(readCounter(scope), nextNumber));
  writeProductMarketVersions(scope, [entry, ...existing.filter((item) => item.id !== entry.id)]);
  safeSetLocalStorage(BUILD_VERSION_KEY, entry.id);
  safeSetLocalStorage(buildVersionStorageKey(scope), entry.id);
  runInBackground(syncProgramVersionToBackend(entry));
  window.dispatchEvent(new CustomEvent("product-market-version-updated", { detail: { scope, version: entry.id } }));
  return entry;
}

export function getLatestProductMarketVersion(scope: ProductMarketScope) {
  return readProductMarketVersions(scope)[0] ?? null;
}

export function getCurrentProductMarketVersion(scope: ProductMarketScope) {
  if (typeof window === "undefined") return getLatestProductMarketVersion(scope);
  const stored = window.localStorage.getItem(buildVersionStorageKey(scope));
  const latest = getLatestProductMarketVersion(scope);
  if (!stored) return latest;
  return readProductMarketVersions(scope).find((item) => item.id === stored) || latest;
}

export function createClientSiteVersion(
  scope: ProductMarketScope,
  config: ExportableConfig,
  options: ProductMarketVersionOptions = {}
) {
  if (typeof window === "undefined" || !config?.products) return null;
  const existing = readClientSiteVersions(scope);
  if (!options.force && existing[0] && JSON.stringify(existing[0].config) === JSON.stringify(config)) {
    safeSetLocalStorage(CLIENT_VERSION_KEY, existing[0].id);
    return existing[0];
  }

  const nextNumber = readClientCounter(scope) + 1;
  const entry = normalizeVersionEntry({
    id: `A${nextNumber}`,
    scope,
    createdAt: new Date().toISOString(),
    config,
    source: options.source,
    title: options.title,
    summary: options.summary,
    aiHtml: options.aiHtml,
  });

  writeClientCounter(scope, nextNumber);
  writeClientSiteVersions(scope, [entry, ...existing.filter((item) => item.id !== entry.id)]);
  safeSetLocalStorage(CLIENT_VERSION_KEY, entry.id);
  safeSetLocalStorage(clientVersionStorageKey(scope), entry.id);
  window.dispatchEvent(new CustomEvent("client-site-version-updated", { detail: { scope, version: entry.id } }));
  return entry;
}

export function getLatestClientSiteVersion(scope: ProductMarketScope) {
  return readClientSiteVersions(scope)[0] ?? null;
}

export function getCurrentClientSiteVersion(scope: ProductMarketScope) {
  if (typeof window === "undefined") return getLatestClientSiteVersion(scope);
  const stored = window.localStorage.getItem(clientVersionStorageKey(scope));
  const latest = getLatestClientSiteVersion(scope);
  if (!stored) return latest;
  return readClientSiteVersions(scope).find((item) => item.id === stored) || latest;
}
