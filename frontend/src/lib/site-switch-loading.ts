export const SITE_SWITCH_LOADING_STORAGE_KEY = "tradepro.siteSwitchLoading";
export const SITE_SWITCH_LOADING_EVENT_NAME = "site-switch-loading-updated";
export const SITE_SWITCH_LOADING_MIN_MS = 5000;
export const SITE_SWITCH_LOADING_MAX_MS = SITE_SWITCH_LOADING_MIN_MS + 30000;

export type SiteSwitchLoadingEntry = {
  startedAt: number;
  source: "sidebar-plan-switch" | "projects-admin-enter" | "theme-live-switch";
  targetPath: string;
  targetSiteId?: string | null;
  companyName?: string;
  targetThemeKey?: string;
  themeDisplayName?: string;
};

type StartSiteSwitchLoadingPayload = Omit<SiteSwitchLoadingEntry, "startedAt">;

function normalizeSiteId(siteId?: string | null) {
  return siteId?.trim() || "";
}

function getStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function startSiteSwitchLoading(payload: StartSiteSwitchLoadingPayload) {
  const storage = getStorage();
  if (!storage) return;
  try {
    const nextEntry: SiteSwitchLoadingEntry = {
      ...payload,
      startedAt: Date.now(),
      targetSiteId: normalizeSiteId(payload.targetSiteId),
    };
    storage.setItem(SITE_SWITCH_LOADING_STORAGE_KEY, JSON.stringify(nextEntry));
    window.dispatchEvent(new CustomEvent(SITE_SWITCH_LOADING_EVENT_NAME, { detail: nextEntry }));
  } catch {
    // Ignore storage write failures and continue navigation.
  }
}

export function clearSiteSwitchLoading() {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(SITE_SWITCH_LOADING_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(SITE_SWITCH_LOADING_EVENT_NAME, { detail: null }));
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function readSiteSwitchLoading(): SiteSwitchLoadingEntry | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(SITE_SWITCH_LOADING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SiteSwitchLoadingEntry;
    if (!parsed?.startedAt || !parsed.targetPath || !parsed.source) {
      clearSiteSwitchLoading();
      return null;
    }
    if (Date.now() - parsed.startedAt > SITE_SWITCH_LOADING_MAX_MS) {
      clearSiteSwitchLoading();
      return null;
    }
    return parsed;
  } catch {
    clearSiteSwitchLoading();
    return null;
  }
}

export function getSiteSwitchLoadingRemaining(entry: SiteSwitchLoadingEntry | null) {
  if (!entry) return 0;
  return Math.max(0, SITE_SWITCH_LOADING_MIN_MS - (Date.now() - entry.startedAt));
}

export function matchSiteSwitchLoading(pathname: string, siteId?: string | null) {
  const entry = readSiteSwitchLoading();
  if (!entry) return null;
  if (entry.targetPath !== pathname) return null;

  const currentSiteId = normalizeSiteId(siteId);
  const targetSiteId = normalizeSiteId(entry.targetSiteId);
  if (targetSiteId && currentSiteId && targetSiteId !== currentSiteId) {
    return null;
  }

  return entry;
}

export function hasActiveSiteSwitchLoading(pathname?: string | null, siteId?: string | null) {
  const entry = readSiteSwitchLoading();
  if (!entry) return false;
  if (pathname && entry.targetPath !== pathname) return false;

  const currentSiteId = normalizeSiteId(siteId);
  const targetSiteId = normalizeSiteId(entry.targetSiteId);
  if (targetSiteId && currentSiteId && targetSiteId !== currentSiteId) {
    return false;
  }

  return getSiteSwitchLoadingRemaining(entry) > 0;
}

export function hasPendingSiteSwitchLoading() {
  return getSiteSwitchLoadingRemaining(readSiteSwitchLoading()) > 0;
}
