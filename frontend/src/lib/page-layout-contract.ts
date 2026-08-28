import {
  GLOBAL_STYLER_PILOT_FRAME_ACCEPTANCE,
  LAYOUT_QUALITY_BASELINES,
  PRODUCT_MARKET_FRAME_ACCEPTANCE,
} from "@/lib/layout-quality-baselines";

export type PageLayoutContract = {
  id: string;
  route: string;
  /** Source contracts are released with the application; local contracts can
   * be removed from the Quality Center without touching source contracts. */
  registrationSource?: "source" | "local";
  registeredAt?: string;
  /** Fixed chrome remains owned by Shared Variables for every registered page. */
  sharedFrame: readonly ["topbar", "workspace", "title", "footer", "scrollbar"];
  /** Shared visual tokens also cover the table shell, header and content surface. */
  sharedVisualFrame: readonly ["topbar", "workspace", "title", "tableShell", "tableHeader", "content", "footer", "scrollbar"];
  /** Table and business content are never written by a style synchronization. */
  pageOwned: readonly ["tableHeader", "content"];
  /** A lock protects structure writes only; it never blocks global theme reads. */
  lockScope: "structure-only";
  pluginGroups: readonly ["visual", "actions", "status"];
};

const LOCAL_PAGE_LAYOUT_CONTRACTS_KEY = "tradepro.page-layout-contracts.v1";
export const PAGE_LAYOUT_CONTRACT_EVENT = "tradepro:page-layout-contracts";
const SHARED_VISUAL_FRAME = ["topbar", "workspace", "title", "tableShell", "tableHeader", "content", "footer", "scrollbar"] as const;

export const PAGE_LAYOUT_CONTRACTS: readonly PageLayoutContract[] = [
  ...LAYOUT_QUALITY_BASELINES,
  ...PRODUCT_MARKET_FRAME_ACCEPTANCE,
  ...GLOBAL_STYLER_PILOT_FRAME_ACCEPTANCE,
].map((baseline) => ({
  id: baseline.id,
  route: baseline.route,
  sharedFrame: ["topbar", "workspace", "title", "footer", "scrollbar"],
  sharedVisualFrame: SHARED_VISUAL_FRAME,
  pageOwned: ["tableHeader", "content"],
  lockScope: "structure-only",
  pluginGroups: ["visual", "actions", "status"],
}));

function isPageLayoutContract(value: unknown): value is PageLayoutContract {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PageLayoutContract>;
  return typeof candidate.id === "string"
    && typeof candidate.route === "string"
    && Array.isArray(candidate.sharedFrame)
    && Array.isArray(candidate.pageOwned)
    && Array.isArray(candidate.pluginGroups)
    && candidate.lockScope === "structure-only";
}

/** Upgrade browser-local contracts created before the shared visual layer.
 * They retain their page-data boundary and simply inherit the new visual map. */
function normalizePageLayoutContract(value: unknown): PageLayoutContract | undefined {
  if (!isPageLayoutContract(value)) return undefined;
  const candidate = value as Partial<PageLayoutContract>;
  return {
    ...candidate,
    sharedVisualFrame: Array.isArray(candidate.sharedVisualFrame) ? candidate.sharedVisualFrame as PageLayoutContract["sharedVisualFrame"] : SHARED_VISUAL_FRAME,
  } as PageLayoutContract;
}

/** Browser-local registrations make a new route eligible for the shared-frame
 * workflow without placing its table, form, business data or plugins under
 * global ownership.  Source contracts remain the build-time baseline. */
export function getRegisteredPageLayoutContracts(): readonly PageLayoutContract[] {
  if (typeof window === "undefined") return PAGE_LAYOUT_CONTRACTS;
  try {
    const saved = JSON.parse(window.localStorage.getItem(LOCAL_PAGE_LAYOUT_CONTRACTS_KEY) || "[]") as unknown[];
    const local = saved.map(normalizePageLayoutContract).filter((item): item is PageLayoutContract => Boolean(item)).filter((item) => !PAGE_LAYOUT_CONTRACTS.some((base) => base.route === item.route));
    return [...PAGE_LAYOUT_CONTRACTS, ...local];
  } catch {
    return PAGE_LAYOUT_CONTRACTS;
  }
}

export function createPageLayoutContractDraft(route: string): PageLayoutContract {
  const normalizedRoute = route.trim();
  const slug = normalizedRoute.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "") || "page";
  return {
    id: `local-${slug}`,
    route: normalizedRoute,
    registrationSource: "local",
    registeredAt: new Date().toISOString(),
    sharedFrame: ["topbar", "workspace", "title", "footer", "scrollbar"],
    sharedVisualFrame: SHARED_VISUAL_FRAME,
    pageOwned: ["tableHeader", "content"],
    lockScope: "structure-only",
    pluginGroups: ["visual", "actions", "status"],
  };
}

export function isSourcePageLayoutContract(route: string) {
  return PAGE_LAYOUT_CONTRACTS.some((contract) => contract.route === route);
}

/** Removes only a browser-local registration. Source contracts are immutable
 * release baselines and are intentionally never removable from this UI. */
export function unregisterPageLayoutContract(route: string) {
  if (typeof window === "undefined" || isSourcePageLayoutContract(route)) return false;
  const current = getRegisteredPageLayoutContracts();
  const next = current.filter((contract) => contract.route !== route && !isSourcePageLayoutContract(contract.route));
  const removed = next.length !== current.filter((contract) => !isSourcePageLayoutContract(contract.route)).length;
  window.localStorage.setItem(LOCAL_PAGE_LAYOUT_CONTRACTS_KEY, JSON.stringify(next));
  if (removed) window.dispatchEvent(new Event(PAGE_LAYOUT_CONTRACT_EVENT));
  return removed;
}

/** Registers only the fixed-frame contract for this browser.  It never writes
 * page content, configuration, plugin choices, or downstream custom data. */
export function registerPageLayoutContract(route: string): PageLayoutContract {
  const normalizedRoute = route.trim();
  if (!normalizedRoute.startsWith("/")) throw new Error("页面路径必须以 / 开始");
  const existing = getRegisteredPageLayoutContracts().find((contract) => contract.route === normalizedRoute);
  if (existing) return existing;
  const draft = createPageLayoutContractDraft(normalizedRoute);
  if (typeof window === "undefined") return draft;
  const local = getRegisteredPageLayoutContracts().filter((contract) => !PAGE_LAYOUT_CONTRACTS.some((base) => base.route === contract.route));
  window.localStorage.setItem(LOCAL_PAGE_LAYOUT_CONTRACTS_KEY, JSON.stringify([...local, draft]));
  window.dispatchEvent(new Event(PAGE_LAYOUT_CONTRACT_EVENT));
  return draft;
}

export function findPageLayoutContract(route: string) {
  return getRegisteredPageLayoutContracts().find((contract) => contract.route === route);
}
