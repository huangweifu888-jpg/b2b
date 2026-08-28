import { FACTORY_PLATFORM_CATEGORIES, getFactoryPlatformCategory } from "./factory-platform-blueprint";
import { DEVELOPER_FLOW_IDENTITY_QUERY_KEYS } from "./marketing-playbook-pilot-inspector";
import {
  PRODUCT_MARKET_LOCK_GROUP_ID,
  PRODUCT_MARKET_NAV_ITEMS,
} from "./product-market-navigation";

export type CompletedLayoutLock =
  | "project-dialogs"
  | "navigation-customization"
  | "site-settings-general"
  | "site-settings-redirect"
  | `page:${string}`
  | `tool:${string}`;

type LayoutLockUpdateSource = "project" | "development-standard" | "footer";

/**
 * Page protection deliberately has two levels.  The first level preserves the
 * reviewed frame while still allowing append-only business work.  The second
 * level is a hard stop: no visual command, automatic sync, or save path may
 * write to that route until a person explicitly unlocks it.
 */
export type CompletedPageLockLevel = "open" | "structure" | "hard";

export type CompletedLayoutLockStateSnapshot = {
  direct: boolean;
  effective: boolean;
  inherited: boolean;
};

export type CompletedLayoutLockSnapshotEntry = {
  structure: CompletedLayoutLockStateSnapshot;
  page: CompletedLayoutLockStateSnapshot;
  source: CompletedLayoutLockStateSnapshot;
};

export type CompletedLayoutLockSnapshot = {
  get: (lock: CompletedLayoutLock) => CompletedLayoutLockSnapshotEntry;
};

export function getFactoryPlatformApplicationLayoutLockId(applicationId: string, capabilityIndex?: number): CompletedLayoutLock {
  return `tool:factory-platform:${applicationId}${capabilityIndex === undefined ? "" : `:capability:${capabilityIndex + 1}`}`;
}

export function getFactoryPlatformCategoryLayoutLockId(categoryKey: string): CompletedLayoutLock {
  return `tool:factory-platform-category:${categoryKey}`;
}

const STORAGE_KEY = "tradepro.completed-layout-locks.v1";
const HARD_LOCK_STORAGE_KEY = "tradepro.completed-page-hard-locks.v1";
const SOURCE_LOCK_STORAGE_KEY = "tradepro.completed-source-locks.v1";
const REVISION_STORAGE_KEY = "tradepro.completed-layout-lock-revisions.v1";
const PARENT_STORAGE_KEY = "tradepro.completed-layout-lock-parents.v1";
const MANUAL_LOCK_MIGRATION_KEY = "tradepro.completed-layout-locks.manual-checkbox-v2";
export const PAGE_LAYOUT_LOCK_EVENT = "tradepro:completed-layout-lock-change";
export const REMOVED_LAYOUT_LOCK_IDS: CompletedLayoutLock[] = [
  "project-dialogs",
  // Product Market's root page is now the Operations subpage. Its previous
  // generic route lock was created before the three dedicated subpage locks.
  "page:/product-market",
  "page:/product-market?tab=operations",
];
// A page is protected only after a person explicitly checks it in the page
// locker. Factory defaults would look unlocked in the checkbox tree while
// silently protecting descendants, so they are deliberately retired.
const DEFAULT_LOCKED_LOCKS = new Set<CompletedLayoutLock>();

interface StoredLockRecordCacheEntry {
  raw: string | null;
  value: Record<string, unknown>;
}

const storedLockRecordCache = new Map<string, StoredLockRecordCacheEntry>();

function readStoredLockRecord<T extends object>(key: string): T {
  if (typeof window === "undefined") return {} as T;

  // Read the raw value on every access so a same-tab write or a cross-tab
  // storage event is visible immediately, while unchanged values skip JSON.parse.
  const raw = window.localStorage.getItem(key);
  const cached = storedLockRecordCache.get(key);
  if (cached?.raw === raw) return { ...cached.value } as T;

  let parsed: unknown = {};
  try {
    parsed = JSON.parse(raw || "{}");
  } catch {
    parsed = {};
  }
  const value = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? { ...(parsed as Record<string, unknown>) }
    : {};
  storedLockRecordCache.set(key, { raw, value });
  return { ...value } as T;
}

function writeStoredLockRecord<T extends object>(key: string, value: T) {
  const snapshot = { ...(value as Record<string, unknown>) };
  const raw = JSON.stringify(snapshot);
  window.localStorage.setItem(key, raw);
  storedLockRecordCache.set(key, { raw, value: snapshot });
}

function readLocks(): Partial<Record<CompletedLayoutLock, boolean>> {
  return readStoredLockRecord(STORAGE_KEY);
}

function readHardLocks(): Partial<Record<CompletedLayoutLock, boolean>> {
  return readStoredLockRecord(HARD_LOCK_STORAGE_KEY);
}

function readSourceLocks(): Partial<Record<CompletedLayoutLock, boolean>> {
  return readStoredLockRecord(SOURCE_LOCK_STORAGE_KEY);
}

function readLockRevisions(): Partial<Record<CompletedLayoutLock, string>> {
  return readStoredLockRecord(REVISION_STORAGE_KEY);
}

function readLockParents(): Partial<Record<CompletedLayoutLock, CompletedLayoutLock>> {
  return readStoredLockRecord(PARENT_STORAGE_KEY);
}

/**
 * Reads the four records needed by the 08 lock tree once, then memoizes all
 * direct and inherited projections for the lifetime of this immutable view.
 * Callers create one snapshot per PAGE_LAYOUT_LOCK_EVENT revision so hundreds
 * of visible lock rows do not each clone and traverse the same records.
 */
export function readCompletedLayoutLockSnapshot(): CompletedLayoutLockSnapshot {
  const structureLocks = readLocks();
  const pageLocks = readHardLocks();
  const sourceLocks = readSourceLocks();
  const parents = readLockParents();
  const structureEffectiveCache = new Map<CompletedLayoutLock, boolean>();
  const pageEffectiveCache = new Map<CompletedLayoutLock, boolean>();
  const sourceEffectiveCache = new Map<CompletedLayoutLock, boolean>();
  const entryCache = new Map<CompletedLayoutLock, CompletedLayoutLockSnapshotEntry>();

  const resolveEffective = (
    lock: CompletedLayoutLock,
    directLocks: Partial<Record<CompletedLayoutLock, boolean>>,
    cache: Map<CompletedLayoutLock, boolean>,
    includeFactoryDefaults: boolean,
    visited = new Set<CompletedLayoutLock>(),
  ): boolean => {
    const cached = cache.get(lock);
    if (cached !== undefined) return cached;
    if (visited.has(lock)) return false;
    visited.add(lock);
    const parent = parents[lock];
    const effective = directLocks[lock] === true
      || (parent
        ? resolveEffective(parent, directLocks, cache, includeFactoryDefaults, visited)
        : includeFactoryDefaults && DEFAULT_LOCKED_LOCKS.has(lock));
    visited.delete(lock);
    cache.set(lock, effective);
    return effective;
  };

  const toState = (direct: boolean, effective: boolean): CompletedLayoutLockStateSnapshot => ({
    direct,
    effective,
    inherited: effective && !direct,
  });

  return {
    get(lock) {
      const cached = entryCache.get(lock);
      if (cached) return cached;
      const structureDirect = structureLocks[lock] === true;
      const pageDirect = pageLocks[lock] === true;
      const sourceDirect = sourceLocks[lock] === true;
      const entry: CompletedLayoutLockSnapshotEntry = {
        structure: toState(
          structureDirect,
          resolveEffective(lock, structureLocks, structureEffectiveCache, true),
        ),
        page: toState(
          pageDirect,
          resolveEffective(lock, pageLocks, pageEffectiveCache, false),
        ),
        source: toState(
          sourceDirect,
          resolveEffective(lock, sourceLocks, sourceEffectiveCache, false),
        ),
      };
      entryCache.set(lock, entry);
      return entry;
    },
  };
}

export function isCompletedLayoutLocked(lock: CompletedLayoutLock) {
  const locks = readLocks();
  const parents = readLockParents();
  const resolveLock = (candidate: CompletedLayoutLock, visited = new Set<CompletedLayoutLock>()): boolean => {
    if (visited.has(candidate)) return false;
    visited.add(candidate);
    if (locks[candidate] === true) return true;
    const parent = parents[candidate];
    if (parent) return resolveLock(parent, visited);
    return DEFAULT_LOCKED_LOCKS.has(candidate);
  };
  return resolveLock(lock);
}

/** A hard lock inherits through the same navigation hierarchy as the frame lock. */
export function isCompletedPageHardLocked(lock: CompletedLayoutLock) {
  const hardLocks = readHardLocks();
  const parents = readLockParents();
  const resolveHardLock = (candidate: CompletedLayoutLock, visited = new Set<CompletedLayoutLock>()): boolean => {
    if (visited.has(candidate)) return false;
    visited.add(candidate);
    if (hardLocks[candidate] === true) return true;
    const parent = parents[candidate];
    return parent ? resolveHardLock(parent, visited) : false;
  };
  return resolveHardLock(lock);
}

/** Page lock: protects visual/shared-contract configuration and runtime writes. */
export const isCompletedPageStyleLocked = isCompletedPageHardLocked;

/** Source lock: protects source commands and inherits through the same column tree. */
export function isCompletedSourceLocked(lock: CompletedLayoutLock) {
  const sourceLocks = readSourceLocks();
  const parents = readLockParents();
  const resolve = (candidate: CompletedLayoutLock, visited = new Set<CompletedLayoutLock>()): boolean => {
    if (visited.has(candidate)) return false;
    visited.add(candidate);
    if (sourceLocks[candidate] === true) return true;
    const parent = parents[candidate];
    return parent ? resolve(parent, visited) : false;
  };
  return resolve(lock);
}

export function getCompletedPageLockLevel(lock: CompletedLayoutLock): CompletedPageLockLevel {
  if (isCompletedPageHardLocked(lock)) return "hard";
  return isCompletedLayoutLocked(lock) ? "structure" : "open";
}

/** Returns only the direct selection. False legacy records inherit like an unset value. */
export function getCompletedLayoutLockOverride(lock: CompletedLayoutLock) {
  return readLocks()[lock] === true ? true : undefined;
}

/** Returns only the direct hard-lock selection; undefined means it inherits. */
export function getCompletedPageHardLockOverride(lock: CompletedLayoutLock) {
  return readHardLocks()[lock];
}

export const getCompletedPageStyleLockOverride = getCompletedPageHardLockOverride;
export function getCompletedSourceLockOverride(lock: CompletedLayoutLock) { return readSourceLocks()[lock]; }

export function getCompletedLayoutLockRevision(lock: CompletedLayoutLock) {
  return readLockRevisions()[lock] || "initial";
}

export function setCompletedLayoutLocked(lock: CompletedLayoutLock, locked: boolean, source: LayoutLockUpdateSource = "project") {
  if (typeof window === "undefined") return;
  if (!locked && source !== "development-standard" && source !== "footer") return;

  const locks = readLocks();
  const revisions = readLockRevisions();
  if (locked) {
    locks[lock] = true;
    revisions[lock] = `${Date.now()}`;
  } else {
    delete locks[lock];
    delete revisions[lock];
  }
  writeStoredLockRecord(STORAGE_KEY, locks);
  writeStoredLockRecord(REVISION_STORAGE_KEY, revisions);
  window.dispatchEvent(new CustomEvent(PAGE_LAYOUT_LOCK_EVENT));
}

/**
 * The hard lock is intentionally only removable by the Development Standard
 * console.  Calls from a page, a publish command, or an automatic sync can
 * set the protection but can never silently remove it.
 */
export function setCompletedPageHardLocked(lock: CompletedLayoutLock, locked: boolean, source: LayoutLockUpdateSource = "project") {
  if (typeof window === "undefined") return;
  if (!locked && source !== "development-standard" && source !== "footer") return;

  const hardLocks = readHardLocks();
  if (locked) hardLocks[lock] = true;
  else delete hardLocks[lock];
  writeStoredLockRecord(HARD_LOCK_STORAGE_KEY, hardLocks);
  window.dispatchEvent(new CustomEvent(PAGE_LAYOUT_LOCK_EVENT));
}

export const setCompletedPageStyleLocked = setCompletedPageHardLocked;
export function setCompletedSourceLocked(lock: CompletedLayoutLock, locked: boolean, source: LayoutLockUpdateSource = "project") {
  if (typeof window === "undefined") return;
  if (!locked && source !== "development-standard" && source !== "footer") return;
  const sourceLocks = readSourceLocks();
  if (locked) sourceLocks[lock] = true;
  else delete sourceLocks[lock];
  writeStoredLockRecord(SOURCE_LOCK_STORAGE_KEY, sourceLocks);
  window.dispatchEvent(new CustomEvent(PAGE_LAYOUT_LOCK_EVENT));
}


/** Removes a child-page override so its effective state follows the parent again. */
export function clearCompletedLayoutLockOverride(lock: CompletedLayoutLock, source: LayoutLockUpdateSource = "development-standard") {
  if (typeof window === "undefined" || source !== "development-standard") return;

  const locks = readLocks();
  const revisions = readLockRevisions();
  delete locks[lock];
  delete revisions[lock];
  writeStoredLockRecord(STORAGE_KEY, locks);
  writeStoredLockRecord(REVISION_STORAGE_KEY, revisions);
  window.dispatchEvent(new CustomEvent(PAGE_LAYOUT_LOCK_EVENT));
}

/** One-time migration: retire all legacy automatic/manual lock records. */
export function clearRemovedLayoutLocks() {
  if (typeof window === "undefined") return;

  if (window.localStorage.getItem(MANUAL_LOCK_MIGRATION_KEY) !== "done") {
    // The previous locker combined two protections and shipped factory defaults.
    // They cannot be distinguished reliably from real choices, so this explicit
    // migration starts the new independent-checkbox model from a clean slate.
    writeStoredLockRecord(STORAGE_KEY, {});
    writeStoredLockRecord(HARD_LOCK_STORAGE_KEY, {});
    writeStoredLockRecord(REVISION_STORAGE_KEY, {});
    window.localStorage.setItem(MANUAL_LOCK_MIGRATION_KEY, "done");
    window.dispatchEvent(new CustomEvent(PAGE_LAYOUT_LOCK_EVENT));
    return;
  }

  const locks = readLocks();
  const hardLocks = readHardLocks();
  const revisions = readLockRevisions();
  const parents = readLockParents();
  let changed = false;
  REMOVED_LAYOUT_LOCK_IDS.forEach((lock) => {
    if (lock in locks) { delete locks[lock]; changed = true; }
    if (lock in hardLocks) { delete hardLocks[lock]; changed = true; }
    if (lock in revisions) { delete revisions[lock]; changed = true; }
    if (lock in parents) { delete parents[lock]; changed = true; }
  });
  if (!changed) return;
  writeStoredLockRecord(STORAGE_KEY, locks);
  writeStoredLockRecord(HARD_LOCK_STORAGE_KEY, hardLocks);
  writeStoredLockRecord(REVISION_STORAGE_KEY, revisions);
  writeStoredLockRecord(PARENT_STORAGE_KEY, parents);
  window.dispatchEvent(new CustomEvent(PAGE_LAYOUT_LOCK_EVENT));
}

/** Registers the current sidebar hierarchy so child routes inherit their parent lock at runtime. */
export function registerCompletedLayoutLockParents(entries: Array<{ id: CompletedLayoutLock; parentId?: CompletedLayoutLock }>) {
  if (typeof window === "undefined") return;

  const parents = readLockParents();
  let changed = false;
  entries.forEach(({ id, parentId }) => {
    if (!parentId || id === parentId) return;
    if (parents[id] !== parentId) {
      parents[id] = parentId;
      changed = true;
    }
  });
  if (changed) {
    writeStoredLockRecord(PARENT_STORAGE_KEY, parents);
    window.dispatchEvent(new CustomEvent(PAGE_LAYOUT_LOCK_EVENT));
  }
}

export function resolveCompletedLayoutLock(pathname: string, search = ""): CompletedLayoutLock | null {
  if (pathname.endsWith("/company-info")) {
    const tab = new URLSearchParams(search).get("tab") || "navigation";
    // Navigation Customization keeps its established dedicated record.  Every
    // other 首页设计 / 企业资料 child route still owns a real page frame and
    // footer, so it needs its own lock record rather than silently omitting
    // the lock control (Banner and Product Recommendation used to hit null).
    return tab === "navigation" ? "navigation-customization" : (`page:/company-info?tab=${tab}` as CompletedLayoutLock);
  }

  if (pathname.endsWith("/site-settings")) {
    const tab = new URLSearchParams(search).get("tab") || "general";
    if (tab === "redirect") return "site-settings-redirect";
    if (tab === "general") return "site-settings-general";
    return `page:/site-settings?tab=${tab}`;
  }

  if (pathname.endsWith("/product-market")) {
    const productMarketParams = new URLSearchParams(search);
    const tab = productMarketParams.get("tab") || "operations";
    if (tab === "operations" || tab === "modules" || tab === "layout" || tab === "service") {
      return `tool:product-market:${tab}`;
    }
    if (tab === "blueprint") {
      const category = getFactoryPlatformCategory(productMarketParams.get("category"));
      const requestedApplication = productMarketParams.get("app");
      const application = category?.applications.find((item) => item.id.split(".").slice(1).join(".") === requestedApplication);
      if (application) {
        const capability = Number(productMarketParams.get("capability"));
        return getFactoryPlatformApplicationLayoutLockId(
          application.id,
          Number.isInteger(capability) && capability > 0 ? capability - 1 : undefined,
        );
      }
      return "tool:product-market:blueprint";
    }
    // Do not fall through to the legacy generic page:/product-market record.
    return "tool:product-market:operations";
  }

  const params = new URLSearchParams(search);
  params.delete("siteId");
  for (const key of DEVELOPER_FLOW_IDENTITY_QUERY_KEYS) params.delete(key);
  for (const key of ["projectPageName", "developmentApply", "developmentDraft", "visualCardLayout", "createTask"]) {
    params.delete(key);
  }
  params.sort();
  const relativePath = pathname.replace(/^\/(?:(?:zb|dl)\/(?:client-source|agency-source)|kh)\b/, "") || "/";
  const normalizedSearch = params.toString();
  return `page:${relativePath}${normalizedSearch ? `?${normalizedSearch}` : ""}`;
}

/**
 * Shared semantic inheritance for the 12 categories, 72 applications and
 * their real route leaves.  Parent applications deliberately use tool IDs;
 * route leaves keep canonical page IDs so a primary application route may
 * also appear as one of its explicit secondary workspaces without collapsing
 * the two lock levels into the same record.
 */
export function buildFactoryPlatformLayoutLockParents(): Array<{ id: CompletedLayoutLock; parentId?: CompletedLayoutLock }> {
  return FACTORY_PLATFORM_CATEGORIES.flatMap((category) => {
    const categoryId = getFactoryPlatformCategoryLayoutLockId(category.key);
    return category.applications.flatMap((application) => {
      const applicationId = getFactoryPlatformApplicationLayoutLockId(application.id);
      const routeLocks = [...new Set([application.route, ...application.navigationChildren.map((child) => child.route)])]
        .map((route) => {
          const [pathname, search = ""] = route.split("?");
          return resolveCompletedLayoutLock(pathname, search ? `?${search}` : "");
        })
        .filter((id): id is CompletedLayoutLock => Boolean(id) && id !== applicationId);
      return [
        { id: applicationId, parentId: categoryId },
        ...routeLocks.map((id) => ({ id, parentId: applicationId })),
      ];
    });
  });
}

/** Shared Product Market hierarchy used by all three source shells. */
export function buildProductMarketLayoutLockParents(): Array<{ id: CompletedLayoutLock; parentId: CompletedLayoutLock }> {
  return PRODUCT_MARKET_NAV_ITEMS.map(({ tab }) => ({
    id: `tool:product-market:${tab}`,
    parentId: PRODUCT_MARKET_LOCK_GROUP_ID,
  }));
}

/** Static lock inheritance registered identically by headquarters, agency and client source. */
export function buildSharedPlatformLayoutLockParents(): Array<{ id: CompletedLayoutLock; parentId?: CompletedLayoutLock }> {
  return [
    ...buildProductMarketLayoutLockParents(),
    ...buildFactoryPlatformLayoutLockParents(),
  ];
}

export function isRouteCompletedLayoutLocked(pathname: string, search = "") {
  const lock = resolveCompletedLayoutLock(pathname, search);
  return lock ? isCompletedLayoutLocked(lock) : false;
}

export function isRouteCompletedPageHardLocked(pathname: string, search = "") {
  const lock = resolveCompletedLayoutLock(pathname, search);
  return lock ? isCompletedPageHardLocked(lock) : false;
}
