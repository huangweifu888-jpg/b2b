import { clearSiteAIChatMessages } from "./ai-chat-storage";
import { localDevFetch } from "./local-dev";
import { clearSiteProjectVersions } from "./site-project-version";
import { safeRemoveLocalStorage, safeSetLocalStorage } from "./storage-guards";
import { pickCleanText, sanitizeDisplayText } from "./text-sanitizer";
import { clearWebsiteContentState } from "./website-content-storage";

export type PublishedSite = {
  id: string;
  slug: string;
  name: string;
  scope?: "client" | "agency" | "hq" | "client_source" | "agency_source";
  html: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  industry?: string;
  builderState?: Record<string, unknown>;
  agencyId?: number | null;
  agencyCode?: string | null;
  agencyName?: string | null;
  clientId?: number | null;
  clientCode?: string | null;
  clientName?: string | null;
  planId?: number | null;
  planCode?: string | null;
  planName?: string | null;
  urlPath?: string | null;
  publicUrl?: string | null;
  /** Local-only fallback used when a client test page has no released plan yet. */
  isTestPlan?: boolean;
};

const STORAGE_KEY = "ai_builder_published_sites";
const SITES_API_BASE = "/api/v1/local-dev/sites";
export const CLIENT_SOURCE_TEST_PLAN_ID = "site_client_source_test";
let cachedSitesStorageValue: string | null = null;
let cachedSitesSnapshot: PublishedSite[] = [];
let sitesFetchInFlight: Promise<PublishedSite[]> | null = null;

function cloneSitesSnapshot(sites: PublishedSite[]) {
  return sites.map((site) => ({ ...site }));
}

function createClientSourceTestPlan(): PublishedSite {
  return {
    id: CLIENT_SOURCE_TEST_PLAN_ID,
    slug: "client-source-test-plan",
    name: "客户源测试计划",
    scope: "client",
    html: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    agencyCode: "D001",
    agencyName: "本地测试代理",
    clientCode: "K001",
    clientName: "客户源测试",
    planCode: "J001",
    planName: "客户源测试计划",
    isTestPlan: true,
  };
}

function getClientSourceTestPlanIfNeeded(sites = getAllSites()): PublishedSite | null {
  return sites.some((site) => (site.scope || "client") === "client") ? null : createClientSourceTestPlan();
}
const LARGE_HISTORY_PREFIXES = ["client-site-version-history:", "product-market-version-history:"];
const NON_CRITICAL_STORAGE_PREFIXES = ["client-site-version-history:", "product-market-version-history:", "ai-chat:draft-messages:"];
const SITE_SCOPED_STORAGE_PREFIXES = [
  "site-project-version-history:",
  "site-project-version-counter:",
  "site-project-version-current:",
  "ai-chat:site-messages:",
  "tradepro.websiteContentStore:site:",
];
const CURRENT_AGENCY_STORAGE_KEY = "tradepro.currentAgencyCode";
const CURRENT_CLIENT_STORAGE_KEY = "tradepro.currentClientCode";
const SELECTED_PROJECT_SITE_SCOPE_KEYS = [
  "tradepro.selectedProjectSite:client",
  "tradepro.selectedProjectSite:agency",
  "tradepro.selectedProjectSite:hq",
  "tradepro.selectedProjectSite:client_source",
  "tradepro.selectedProjectSite:agency_source",
];

export function getStoredSelectedProjectSite(scope: "client" | "agency" | "hq" | "client_source" | "agency_source") {
  if (typeof window === "undefined") return null;
  try {
    const routeSiteId = new URL(window.location.href).searchParams.get("siteId")?.trim();
    if (routeSiteId) return routeSiteId;
  } catch {
    // Ignore malformed current URL and fall back to persisted selection.
  }
  return window.localStorage.getItem(`tradepro.selectedProjectSite:${scope}`)?.trim() || null;
}

export function resolveCurrentSiteId(
  scope: "client" | "agency" | "hq" | "client_source" | "agency_source",
  search?: string | null
) {
  const resolveClientPlan = (candidate: string | null | undefined) => {
    const sites = getAllSites();
    const normalizedCandidate = candidate?.trim() || null;
    const clientSites = sites.filter((site) => (site.scope || "client") === "client");
    if (normalizedCandidate && clientSites.some((site) => site.id === normalizedCandidate)) {
      return normalizedCandidate;
    }
    const testPlan = getClientSourceTestPlanIfNeeded(sites);
    return testPlan?.id || clientSites[0]?.id || null;
  };

  const normalizedSearch = typeof search === "string" ? search.trim() : "";
  if (normalizedSearch) {
    try {
      const params = new URLSearchParams(normalizedSearch.startsWith("?") ? normalizedSearch.slice(1) : normalizedSearch);
      const routeSiteId = params.get("siteId")?.trim();
      if (routeSiteId) return scope === "client" ? resolveClientPlan(routeSiteId) : routeSiteId;
    } catch {
      // Ignore malformed query string and fall back to persisted selection.
    }
  }
  const storedSiteId = getStoredSelectedProjectSite(scope);
  return scope === "client" ? resolveClientPlan(storedSiteId) : storedSiteId;
}

/**
 * Resolves the backend project ID for the client-source runtime. Client
 * workspaces must never guess a project ID: the first numeric ID is often a
 * historical or inactive plan, which makes the API correctly reject it as an
 * inactive plan. Until the published-site assignment has been loaded this
 * deliberately returns null, so callers can wait instead of guessing.
 */
export function resolveCurrentClientPlanId(search?: string | null) {
  const siteId = resolveCurrentSiteId("client", search);
  const planId = siteId ? getSiteById(siteId)?.planId : null;
  return typeof planId === "number" && Number.isInteger(planId) && planId > 0 ? planId : null;
}

type SitesUpdatedDetail = {
  reason?: "backend-fetch" | "site-save" | "site-delete" | "scope-delete";
  scope?: "client" | "agency" | "hq" | "client_source" | "agency_source";
  siteId?: string;
  siteIds?: string[];
};

function dispatchSitesUpdated(detail: SitesUpdatedDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("sites-updated", { detail }));
}

function getSiteBuilderBlockCount(site: Pick<PublishedSite, "builderState">) {
  if (!site.builderState || typeof site.builderState !== "object") return 0;
  const blocks = (site.builderState as Record<string, unknown>).blocks;
  return Array.isArray(blocks) ? blocks.length : 0;
}

function needsHtmlRepair(site: PublishedSite) {
  const html = typeof site.html === "string" ? site.html.trim() : "";
  if (!html || html.length > 1600) return false;
  if (getSiteBuilderBlockCount(site) <= 0) return false;
  return /^<!DOCTYPE html/i.test(html) || /^<html[\s>]/i.test(html) || /^<head[\s>]/i.test(html);
}

async function repairSiteHtml(site: PublishedSite) {
  if (!needsHtmlRepair(site)) return site;
  try {
    const { buildSiteHtml, normalizeBuilderState } = await import("./ai-site-builder");
    const nextState = normalizeBuilderState(site.builderState);
    const nextHtml = buildSiteHtml(nextState).trim();
    if (!nextHtml || nextHtml.length <= (site.html || "").trim().length) {
      return { ...site, builderState: nextState };
    }
    return { ...site, html: nextHtml, builderState: nextState };
  } catch {
    return site;
  }
}

function buildCompactSitesStorageValue(sites: PublishedSite[]) {
  return JSON.stringify(
    sites.map((site) => ({
      ...site,
      // Never keep a truncated HTML fragment in the main site cache.
      html: "",
    }))
  );
}

function persistSitesToStorage(sites: PublishedSite[]) {
  const saved = safeSetLocalStorage(STORAGE_KEY, JSON.stringify(sites), {
    fallbackValue: buildCompactSitesStorageValue(sites),
    removeKeyOnFailure: true,
  });
  if (saved && typeof window !== "undefined") {
    cachedSitesStorageValue = window.localStorage.getItem(STORAGE_KEY);
    cachedSitesSnapshot = cloneSitesSnapshot(sites);
  }
  return saved;
}

function compactLargeVersionCaches() {
  if (typeof window === "undefined") return;
  LARGE_HISTORY_PREFIXES.forEach((prefix) => {
    Array.from({ length: window.localStorage.length })
      .map((_, index) => window.localStorage.key(index))
      .filter((key): key is string => !!key && key.startsWith(prefix))
      .forEach((key) => {
        try {
          const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
          if (!Array.isArray(parsed)) return;
          const compact = parsed.slice(0, 3).map((entry) => ({
            ...entry,
            aiHtml: undefined,
            config: entry.config?.products ? { products: [] } : entry.config,
          }));
          safeSetLocalStorage(key, JSON.stringify(compact), { compact: true, removeKeyOnFailure: true });
        } catch {
          safeRemoveLocalStorage(key);
        }
      });
  });
}

function clearNonCriticalStorageCaches() {
  if (typeof window === "undefined") return;
  const keys = Array.from({ length: window.localStorage.length })
    .map((_, index) => window.localStorage.key(index))
    .filter((key): key is string => !!key);

  keys.forEach((key) => {
    if (NON_CRITICAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      safeRemoveLocalStorage(key);
    }
  });
}

function clearSiteScopedCaches(site: Pick<PublishedSite, "id" | "scope">) {
  const scope = site.scope || "client";
  clearWebsiteContentState(site.id);
  clearWebsiteContentState(`${scope}:${site.id}`);
}

function pruneOrphanSiteCaches(validSiteIds: string[]) {
  if (typeof window === "undefined") return;
  const valid = new Set(validSiteIds.filter(Boolean));
  const keys = Array.from({ length: window.localStorage.length })
    .map((_, index) => window.localStorage.key(index))
    .filter((key): key is string => !!key);

  keys.forEach((key) => {
    const prefix = SITE_SCOPED_STORAGE_PREFIXES.find((candidate) => key.startsWith(candidate));
    if (!prefix) return;
    const rawSiteId = key.slice(prefix.length).trim();
    const siteId = rawSiteId.includes(":") ? rawSiteId.split(":").pop()?.trim() || rawSiteId : rawSiteId;
    if (siteId && !valid.has(siteId)) {
      safeRemoveLocalStorage(key);
    }
  });

  SELECTED_PROJECT_SITE_SCOPE_KEYS.forEach((key) => {
    const siteId = window.localStorage.getItem(key)?.trim();
    if (siteId && !valid.has(siteId)) {
      safeRemoveLocalStorage(key);
    }
  });
}

function sanitizeSiteRecord(site: PublishedSite): PublishedSite {
  const builderState = site.builderState && typeof site.builderState === "object" ? { ...site.builderState } : site.builderState;
  if (builderState && typeof builderState === "object") {
    const state = builderState as Record<string, unknown>;
    const nextBrandName = sanitizeDisplayText(typeof state.brandName === "string" ? state.brandName : "", "");
    const nextSiteName = sanitizeDisplayText(typeof state.siteName === "string" ? state.siteName : "", "");
    const nextIndustry = sanitizeDisplayText(typeof state.industry === "string" ? state.industry : "", "");
    if (nextBrandName) state.brandName = nextBrandName;
    if (nextSiteName) state.siteName = nextSiteName;
    if (nextIndustry) state.industry = nextIndustry;
  }

  return {
    ...site,
    name: pickCleanText([site.name, typeof builderState === "object" ? ((builderState as Record<string, unknown>).brandName as string) : ""], "未命名站点"),
    industry: sanitizeDisplayText(site.industry, ""),
    builderState,
  };
}

function readNestedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readBuilderValue(builderState: Record<string, unknown> | undefined, key: string) {
  return builderState ? readNestedString(builderState[key]) : null;
}

function getSitePreferenceScore(site: PublishedSite) {
  const blocks =
    site.builderState &&
    typeof site.builderState === "object" &&
    Array.isArray((site.builderState as Record<string, unknown>).blocks)
      ? ((site.builderState as Record<string, unknown>).blocks as unknown[])
      : [];
  return { blockCount: blocks.length, htmlLength: site.html.length, updatedAt: site.updatedAt };
}

function parseSiteTime(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function readCurrentScopeCode(scope: "client" | "agency" | "hq" | "client_source" | "agency_source", type: "client" | "agency") {
  if (typeof window === "undefined") return "";
  try {
    const url = new URL(window.location.href);
    const queryValue = url.searchParams.get(type)?.trim().toUpperCase();
    if (queryValue) return queryValue;
  } catch {
    // ignore url parsing failures in non-browser contexts
  }

  const storageKey = type === "client" ? CURRENT_CLIENT_STORAGE_KEY : CURRENT_AGENCY_STORAGE_KEY;
  const storedValue = window.localStorage.getItem(storageKey)?.trim().toUpperCase() || "";
  if (storedValue) return storedValue;

  if (scope === "client" || scope === "client_source" || scope === "hq") {
    return type === "client" ? storedValue : "";
  }
  return storedValue;
}

function getSiteIdentityKey(site: PublishedSite) {
  const scope = site.scope || "client";
  const agencyCode = (site.agencyCode || "").trim().toUpperCase();
  const clientCode = (site.clientCode || "").trim().toUpperCase();
  const planCode = (site.planCode || "").trim().toUpperCase();

  if (planCode) {
    return `${scope}:plan:${agencyCode}:${clientCode}:${planCode}`;
  }
  if (site.urlPath) {
    return `${scope}:path:${site.urlPath}`;
  }
  if (site.slug) {
    return `${scope}:slug:${site.slug}`;
  }
  return `${scope}:id:${site.id}`;
}

function getSiteCompletenessScore(site: PublishedSite) {
  const builderState = site.builderState && typeof site.builderState === "object" ? (site.builderState as Record<string, unknown>) : null;
  const blocks =
    builderState && Array.isArray(builderState.blocks)
      ? (builderState.blocks as unknown[])
      : [];

  let score = 0;
  if (site.planCode) score += 200;
  if (site.clientCode) score += 80;
  if (site.agencyCode) score += 80;
  if (site.planName) score += 20;
  if (site.urlPath) score += 160;
  if (site.publicUrl) score += 120;
  if (site.publicUrl && /^https?:\/\/127\.0\.0\.1:3003\/sites\//i.test(site.publicUrl)) score -= 100;
  if (site.html.trim()) score += Math.min(site.html.trim().length, 4000) / 10;
  score += blocks.length * 6;
  score += parseSiteTime(site.updatedAt) / 1_000_000_000_000;
  return score;
}

function compareSitesLatestFirst(a: PublishedSite, b: PublishedSite) {
  const updatedDiff = parseSiteTime(b.updatedAt) - parseSiteTime(a.updatedAt);
  if (updatedDiff !== 0) return updatedDiff;
  const createdDiff = parseSiteTime(b.createdAt) - parseSiteTime(a.createdAt);
  if (createdDiff !== 0) return createdDiff;
  const completenessDiff = getSiteCompletenessScore(b) - getSiteCompletenessScore(a);
  if (completenessDiff !== 0) return completenessDiff;
  return b.id.localeCompare(a.id);
}

function parsePlanSequenceValue(planCode?: string | null, planName?: string | null) {
  const codeMatch = String(planCode || "")
    .toUpperCase()
    .match(/J0*([1-9]\d*)/);
  if (codeMatch) {
    return Number(codeMatch[1]) || 0;
  }

  const nameMatch = String(planName || "").match(/计划\s*([1-9]\d*)/);
  if (nameMatch) {
    return Number(nameMatch[1]) || 0;
  }

  return 0;
}

function compareSitesByPlanSequence(a: PublishedSite, b: PublishedSite) {
  const sequenceDiff = parsePlanSequenceValue(a.planCode, a.planName) - parsePlanSequenceValue(b.planCode, b.planName);
  if (sequenceDiff !== 0) return sequenceDiff;

  const createdDiff = parseSiteTime(a.createdAt) - parseSiteTime(b.createdAt);
  if (createdDiff !== 0) return createdDiff;

  const updatedDiff = parseSiteTime(a.updatedAt) - parseSiteTime(b.updatedAt);
  if (updatedDiff !== 0) return updatedDiff;

  return a.id.localeCompare(b.id);
}

function choosePreferredSite(a: PublishedSite, b: PublishedSite) {
  const completenessDiff = getSiteCompletenessScore(b) - getSiteCompletenessScore(a);
  if (completenessDiff !== 0) {
    return completenessDiff > 0 ? b : a;
  }
  return compareSitesLatestFirst(a, b) <= 0 ? a : b;
}

export function sortSitesByCreatedOrder(sites: PublishedSite[]) {
  return [...sites].sort(compareSitesLatestFirst);
}

export function getPreferredSites(sites: PublishedSite[]) {
  const preferredByKey = new Map<string, PublishedSite>();
  sites.forEach((site) => {
    const key = getSiteIdentityKey(site);
    const current = preferredByKey.get(key);
    preferredByKey.set(key, current ? choosePreferredSite(current, site) : site);
  });
  return sortSitesByCreatedOrder([...preferredByKey.values()]);
}

export function getVisibleSitesByScope(scope: "client" | "agency" | "hq" | "client_source" | "agency_source", anchorSiteId?: string | null) {
  const visibleSites = getPreferredSites(getSitesByScope(scope));
  if (!visibleSites.length) return visibleSites;

  const preferredClientCode = readCurrentScopeCode(scope, "client");
  if (preferredClientCode) {
    const sameClientSites = visibleSites.filter((site) => (site.clientCode || "").trim().toUpperCase() === preferredClientCode);
    if (sameClientSites.length) return sameClientSites;
  }

  const preferredAgencyCode = readCurrentScopeCode(scope, "agency");
  if (preferredAgencyCode) {
    const sameAgencySites = visibleSites.filter((site) => (site.agencyCode || "").trim().toUpperCase() === preferredAgencyCode);
    if (sameAgencySites.length) return sameAgencySites;
  }

  const anchorSite = anchorSiteId ? visibleSites.find((site) => site.id === anchorSiteId) || null : null;
  const fallbackAnchor = anchorSite || visibleSites[0];

  if (fallbackAnchor.clientCode) {
    const sameClientSites = visibleSites.filter((site) => site.clientCode === fallbackAnchor.clientCode);
    if (sameClientSites.length) return sameClientSites;
  }

  if (fallbackAnchor.agencyCode) {
    const sameAgencySites = visibleSites.filter((site) => site.agencyCode === fallbackAnchor.agencyCode);
    if (sameAgencySites.length) return sameAgencySites;
  }

  return visibleSites;
}

export function getAllSites(): PublishedSite[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === cachedSitesStorageValue) return cloneSitesSnapshot(cachedSitesSnapshot);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PublishedSite[];
    if (!Array.isArray(parsed)) return [];
    let changed = false;
    const sanitized = parsed.map((site) => {
      const nextSite = sanitizeSiteRecord(site);
      if (JSON.stringify(nextSite) !== JSON.stringify(site)) changed = true;
      return nextSite;
    });
    if (changed) {
      persistSitesToStorage(sanitized);
    } else {
      cachedSitesStorageValue = raw;
      cachedSitesSnapshot = cloneSitesSnapshot(sanitized);
    }
    return cloneSitesSnapshot(sanitized);
  } catch {
    return [];
  }
}

export function fetchAllSitesFromBackend(): Promise<PublishedSite[]> {
  if (sitesFetchInFlight) return sitesFetchInFlight;

  sitesFetchInFlight = (async () => {
    try {
      const response = await localDevFetch(SITES_API_BASE);
      if (!response.ok) return getAllSites();
      const payload = (await response.json()) as { items?: PublishedSite[] };
      const items = Array.isArray(payload.items)
        ? await Promise.all(payload.items.map((site) => repairSiteHtml(sanitizeSiteRecord(site))))
        : [];
      persistSitesToStorage(items);
      // Keep the local test-plan selection while the server has no real client plan.
      // This plan is intentionally never posted to the backend or treated as a release record.
      const testPlan = getClientSourceTestPlanIfNeeded(items);
      pruneOrphanSiteCaches([...items.map((site) => site.id), ...(testPlan ? [testPlan.id] : [])]);
      dispatchSitesUpdated({
        reason: "backend-fetch",
        siteIds: items.map((site) => site.id),
      });
      return items;
    } catch {
      return getAllSites();
    } finally {
      sitesFetchInFlight = null;
    }
  })();

  return sitesFetchInFlight;
}

export function getSitesByScope(scope: "client" | "agency" | "hq" | "client_source" | "agency_source") {
  const sites = getAllSites().filter((site) => (site.scope || "client") === scope);
  if (scope !== "client" || sites.length) return sites;
  return [createClientSourceTestPlan()];
}

export function getSiteSequenceMap(scope: "client" | "agency" | "hq" | "client_source" | "agency_source", sites?: PublishedSite[]) {
  const ordered = [...(sites || getVisibleSitesByScope(scope))].sort(compareSitesByPlanSequence);
  return new Map<string, number>(ordered.map((site, index) => [site.id, index + 1]));
}

export function getSitePublicUrl(
  site: Pick<PublishedSite, "slug" | "urlPath" | "publicUrl">,
  origin = typeof window !== "undefined" ? window.location.origin : ""
) {
  if (site.publicUrl) {
    if (/^https?:\/\/127\.0\.0\.1:3003\/sites\//i.test(site.publicUrl) && site.urlPath) {
      return `http://127.0.0.1:3004${site.urlPath}`;
    }
    return site.publicUrl;
  }
  if (site.urlPath) return `http://127.0.0.1:3004${site.urlPath}`;
  return origin ? `${origin}/sites/${site.slug}` : `/sites/${site.slug}`;
}

export function needsPublishedSiteMigration(
  site: Pick<PublishedSite, "publicUrl" | "urlPath" | "agencyCode" | "clientCode" | "planCode">
) {
  if (!site.agencyCode || !site.clientCode || !site.planCode) return true;
  if (!site.urlPath) return true;
  if (!site.publicUrl) return true;
  return /^https?:\/\/127\.0\.0\.1:3003\/sites\//i.test(site.publicUrl);
}

export function resolveSiteLogoUrl(site: PublishedSite) {
  const builderState = site.builderState as Record<string, unknown> | undefined;
  const directLogo =
    readNestedString(site.thumbnail) ||
    readBuilderValue(builderState, "logoUrl") ||
    readBuilderValue(builderState, "brandLogo") ||
    readBuilderValue(builderState, "brandLogoUrl") ||
    readBuilderValue(builderState, "logo");
  if (directLogo) return directLogo;

  const contact = builderState?.contact;
  const website =
    (contact && typeof contact === "object" ? readNestedString((contact as Record<string, unknown>).website) : null) ||
    readBuilderValue(builderState, "website");

  if (website) {
    const normalized = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    return `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(normalized)}`;
  }

  const imageMatch = site.html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imageMatch?.[1] || null;
}

export function getSiteBySlug(slug: string): PublishedSite | null {
  const matches = getAllSites().filter((site) => site.slug === slug);
  if (!matches.length) return null;
  return (
    matches.sort((a, b) => {
      const scoreA = getSitePreferenceScore(a);
      const scoreB = getSitePreferenceScore(b);
      if (scoreA.blockCount !== scoreB.blockCount) return scoreB.blockCount - scoreA.blockCount;
      if (scoreA.htmlLength !== scoreB.htmlLength) return scoreB.htmlLength - scoreA.htmlLength;
      return scoreB.updatedAt.localeCompare(scoreA.updatedAt);
    })[0] || null
  );
}

export function getSiteById(id: string): PublishedSite | null {
  const sites = getAllSites();
  const site = sites.find((item) => item.id === id);
  if (site) return site;
  return id === CLIENT_SOURCE_TEST_PLAN_ID ? getClientSourceTestPlanIfNeeded(sites) : null;
}

export function saveSite(site: PublishedSite): void {
  const normalizedSite = { ...sanitizeSiteRecord(site), updatedAt: new Date().toISOString() };
  const sites = getAllSites().filter((item) => item.id === site.id || item.slug !== site.slug);
  const index = sites.findIndex((item) => item.id === site.id);
  if (index >= 0) {
    sites[index] = normalizedSite;
  } else {
    sites.push(normalizedSite);
  }

  try {
    persistSitesToStorage(sites);
  } catch {
    compactLargeVersionCaches();
    try {
      persistSitesToStorage(sites);
    } catch {
      clearNonCriticalStorageCaches();
      persistSitesToStorage(sites);
    }
  }
  dispatchSitesUpdated({
    reason: "site-save",
    scope: normalizedSite.scope || "client",
    siteId: normalizedSite.id,
    siteIds: [normalizedSite.id],
  });
}

export async function syncSiteToBackend(site: PublishedSite): Promise<PublishedSite | null> {
  try {
    const normalizedSite = await repairSiteHtml(sanitizeSiteRecord(site));
    const response = await localDevFetch(SITES_API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalizedSite),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { site?: PublishedSite };
    if (payload.site) {
      saveSite(payload.site);
      return payload.site;
    }
    return site;
  } catch {
    return null;
  }
}

export async function fetchSiteFromBackend(slug: string): Promise<PublishedSite | null> {
  try {
    const response = await localDevFetch(`${SITES_API_BASE}/${encodeURIComponent(slug)}`);
    if (!response.ok) return null;
    return repairSiteHtml((await response.json()) as PublishedSite);
  } catch {
    return null;
  }
}

export function deleteSite(id: string): void {
  const allSites = getAllSites();
  const target = allSites.find((site) => site.id === id);
  clearSiteProjectVersions(id);
  clearSiteAIChatMessages(id);
  if (target) {
    clearSiteScopedCaches(target);
  } else {
    clearWebsiteContentState(id);
  }

  const sites = allSites.filter((site) => site.id !== id);
  persistSitesToStorage(sites);
  dispatchSitesUpdated({
    reason: "site-delete",
    scope: target?.scope || "client",
    siteId: id,
    siteIds: [],
  });
}

export async function deleteSiteFromBackend(id: string): Promise<boolean> {
  try {
    const response = await localDevFetch(`${SITES_API_BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
    return response.ok;
  } catch {
    return false;
  }
}

export function deleteSitesByScope(scope: "client" | "agency" | "hq" | "client_source" | "agency_source"): PublishedSite[] {
  const removed = getAllSites().filter((site) => (site.scope || "client") === scope);
  removed.forEach((site) => {
    clearSiteProjectVersions(site.id);
    clearSiteAIChatMessages(site.id);
    clearSiteScopedCaches(site);
  });
  const remaining = getAllSites().filter((site) => (site.scope || "client") !== scope);
  persistSitesToStorage(remaining);
  dispatchSitesUpdated({
    reason: "scope-delete",
    scope,
    siteIds: removed.map((site) => site.id),
  });
  return removed;
}

export async function deleteSitesByScopeFromBackend(scope: "client" | "agency" | "hq" | "client_source" | "agency_source"): Promise<boolean> {
  try {
    const response = await localDevFetch(`${SITES_API_BASE}?scope=${encodeURIComponent(scope)}`, { method: "DELETE" });
    return response.ok;
  } catch {
    return false;
  }
}

export function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return base || `site-${Date.now()}`;
}

export function ensureUniqueSlug(desired: string, excludeId?: string): string {
  const sites = getAllSites().filter((site) => site.id !== excludeId);
  let slug = desired;
  let index = 2;
  while (sites.some((site) => site.slug === slug)) {
    slug = `${desired}-${index}`;
    index += 1;
  }
  return slug;
}

export function extractTitle(html: string): string {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim();
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) return h1Match[1].replace(/<[^>]+>/g, "").trim().slice(0, 50);
  return "未命名网站";
}

export function genId(): string {
  return `site_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
