import { safeRemoveLocalStorage } from "./storage-guards";

const GLOBAL_STORAGE_KEY = "tradepro.websiteContentStore";
const SITE_STORAGE_PREFIX = "tradepro.websiteContentStore:site:";

export function getWebsiteContentStorageKey(siteId?: string | null) {
  const trimmed = siteId?.trim();
  return trimmed ? `${SITE_STORAGE_PREFIX}${trimmed}` : GLOBAL_STORAGE_KEY;
}

export function getWebsiteContentSessionFallbackKey(storageKey: string) {
  return `${storageKey}.session-fallback`;
}

export function clearWebsiteContentState(siteId?: string | null) {
  const storageKey = getWebsiteContentStorageKey(siteId);
  safeRemoveLocalStorage(storageKey);
  try {
    window.sessionStorage.removeItem(getWebsiteContentSessionFallbackKey(storageKey));
  } catch {
    // Storage cleanup must never block clearing the primary local content.
  }
  window.dispatchEvent(
    new CustomEvent("website-content-updated", {
      detail: { siteId: siteId || null, storageKey, cleared: true },
    }),
  );
}
