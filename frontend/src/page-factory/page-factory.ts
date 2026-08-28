import standardData from "./page-factory-standard.json";
import registryData from "./page-registry.json";
import commandData from "./page-command-catalog.json";
import { normalizePageFrameSearch } from "@/lib/page-route-identity";

export type PageFactoryScope = "hq" | "agency_source" | "client_source";
export type PageFactoryRuntimeScope = "hq" | "agency-source" | "client-source";
export type PageFactoryTemplate = "reference" | "dashboard" | "list" | "form" | "detail" | "editor" | "workflow";
export type PageFactoryFrameOwner = "factory-shell" | "existing-workspace";
export type PageFactoryRegion = typeof PAGE_FACTORY_STANDARD.regions[number];

export type PageFactoryPage = {
  id: string;
  label: string;
  route: string;
  component: string;
  entryComponent: string;
  template: PageFactoryTemplate;
  sourceScope: PageFactoryScope;
  governanceScopes: PageFactoryScope[];
  requiredRegions: PageFactoryRegion[];
  capabilities: string[];
  status: "planned" | "adopting" | "pilot-complete" | "complete";
  regionStrategy?: "explicit" | "runtime-auto";
  factoryDefaultVersion: string;
};

export type PageFactoryInspection = {
  page: PageFactoryPage | null;
  normalizedRoute: string;
  checkedAt: string;
  passed: boolean;
  regions: Array<{ id: PageFactoryRegion; present: boolean; selector: string }>;
  capabilities: Array<{ id: string; present: boolean }>;
};

export type PageFactoryInventoryRisk = "low" | "review" | "high";

export type PageFactoryInventory = {
  schemaVersion: 1;
  phase: "page-factory-phase-2";
  mode: "read-only-census";
  sourceOfTruth: string;
  inventoryVersion: string;
  routingAudit: {
    literalRouteDeclarations: number;
    mappedRouteDeclarations: number;
    unmappedRouteTargets: Array<{ path: string; component: string }>;
    expectedRouteIdentities: number;
    registeredRouteIdentities: number;
    routeIdentityCoveragePercent: number;
    unregisteredRouteIdentities: Array<{ sourceScope: PageFactoryScope; route: string; source: string; component: string }>;
    ownershipMismatches: Array<{ sourceScope: PageFactoryScope; route: string; source: string; component: string; registeredOwners: string[] }>;
    registryRouteIdentities: number;
    queryVariantIdentities: number;
    dynamicRouteIdentities: number;
  };
  baselineDiff: {
    status: "missing" | "unchanged" | "changed";
    baselineVersion: string | null;
    currentFingerprint: string;
    addedPageIds: string[];
    removedPageIds: string[];
    riskChangedPageIds: string[];
  };
  phaseProgress: {
    phase: "page-factory-phase-2";
    version: string;
    completedPercent: number;
    steps: Array<{ id: string; label: string; weight: number; complete: boolean }>;
  };
  planSummary: {
    eligibleRouteEntries: number;
    plannedRouteEntries: number;
    unplannedPageIds: string[];
    duplicatePageIds: string[];
    complete: boolean;
  };
  totals: {
    pageFiles: number;
    registered: number;
    completed: number;
    unregistered: number;
    coveragePercent: number;
    routeEntries: number;
    supportFiles: number;
    registeredRouteEntries: number;
    completedRouteEntries: number;
    routeCoveragePercent: number;
    risk: Record<PageFactoryInventoryRisk, number>;
    routeRisk: Record<PageFactoryInventoryRisk, number>;
  };
  guardrails: string[];
  batches: Array<{
    id: string;
    label: string;
    mode: "review-only";
    risk: PageFactoryInventoryRisk;
    candidateCount: number;
    waveSize: number;
    candidatePageIds: string[];
    waves: Array<{ id: string; mode: "single-page-authorized"; candidatePageIds: string[] }>;
    entryCriteria: string[];
    exitCriteria: string[];
  }>;
  pages: Array<{
    id: string;
    source: string;
    scopeHint: string;
    routeEntry: boolean;
    routeHints: string[];
    registered: boolean;
    completed: boolean;
    risk: PageFactoryInventoryRisk;
    reason: string;
    analysis: {
      lineCount: number;
      analyzedLineCount: number;
      linkedSources: string[];
      riskScore: number;
      riskSignals: string[];
      factoryContractPresent: boolean;
    };
    adoption: "registered" | "review-only";
  }>;
};

export type PageFactoryVerification = {
  schemaVersion: 1;
  factoryVersion: string;
  recordedAt: string | null;
  governancePercent: number;
  routeCoveragePercent: number;
  status: "pending" | "passed" | "failed";
  summary: string;
  checks: Array<{
    id: string;
    label: string;
    status: "pending" | "passed" | "failed";
    result: string;
  }>;
  latestProductMarketRuntimeVersionConsistencyRetestRevision: {
    recordedAt: string;
    factoryVersion: string;
    targetHVersion: string;
    completionPercent: number;
    governancePercent: number;
    routeCoveragePercent: number;
    scope: string;
    result: string;
    validation: string;
    risks: string;
  };
};

export const PAGE_FACTORY_STANDARD = Object.freeze(standardData);
export const PAGE_FACTORY_PAGES = Object.freeze(registryData.pages) as readonly PageFactoryPage[];
export const PAGE_FACTORY_COMMANDS = Object.freeze(commandData.commands.map((command) => Object.freeze(command)));

const REGION_FALLBACK_SELECTORS: Record<PageFactoryRegion, string> = {
  top: "[data-responsive-topbar]",
  body: "[data-responsive-page-host]",
  "title-1": "[data-responsive-shared-surface='title-1']",
  "title-2": "[data-page-factory-region='title-2']",
  "table-shell": "[data-page-factory-region='table-shell'], [data-page-layout-frame]",
  "table-header": "[data-page-factory-region='table-header'], [data-page-table-header]",
  content: "[data-page-factory-region='content'], [data-page-list]",
  "large-card": "[data-page-factory-region='large-card'], [data-shared-large-card-surface='true']",
  "small-card": "[data-page-factory-region='small-card'], [data-shared-small-card-surface='true']",
  footer: "[data-page-layout-footer]",
  scrollbar: "[data-page-factory-region='scrollbar'], [data-page-list-scroll-owner]",
};

const SCOPE_PREFIX = /^\/(?:zb\/agency-source|zb\/client-source|zb|dl|kh)(?=\/|$)/;

export const PAGE_FACTORY_RUNTIME_SCOPE_BY_SOURCE = Object.freeze({
  hq: "hq",
  agency_source: "agency-source",
  client_source: "client-source",
} satisfies Record<PageFactoryScope, PageFactoryRuntimeScope>);

const PAGE_FACTORY_SOURCE_SCOPE_BY_RUNTIME = Object.freeze(Object.fromEntries(
  Object.entries(PAGE_FACTORY_RUNTIME_SCOPE_BY_SOURCE).map(([sourceScope, runtimeScope]) => [runtimeScope, sourceScope]),
) as Record<PageFactoryRuntimeScope, PageFactoryScope>);

export function normalizePageFactoryRoute(pathname: string, search = "") {
  const route = pathname.replace(SCOPE_PREFIX, "") || "/";
  const normalizedSearch = normalizePageFrameSearch(pathname, search);
  return `${route}${normalizedSearch ? `?${normalizedSearch}` : ""}`;
}

export function resolvePageFactoryScope(pathname: string): PageFactoryScope {
  if (/^\/(?:zb\/agency-source|dl)(?:\/|$)/.test(pathname)) return "agency_source";
  if (/^\/(?:zb\/client-source|kh)(?:\/|$)/.test(pathname)) return "client_source";
  if (/^\/zb(?:\/|$)/.test(pathname)) return "hq";
  return "client_source";
}

export function toPageFactoryRuntimeScope(scope: PageFactoryScope): PageFactoryRuntimeScope {
  return PAGE_FACTORY_RUNTIME_SCOPE_BY_SOURCE[scope];
}

export function toPageFactorySourceScope(scope: PageFactoryRuntimeScope): PageFactoryScope {
  return PAGE_FACTORY_SOURCE_SCOPE_BY_RUNTIME[scope];
}

export function resolvePageFactoryRuntimeScope(pathname: string): PageFactoryRuntimeScope {
  return toPageFactoryRuntimeScope(resolvePageFactoryScope(pathname));
}

export function findPageFactoryPage(pathname: string, search = "") {
  const route = normalizePageFactoryRoute(pathname, search);
  const sourceScope = resolvePageFactoryScope(pathname);
  return PAGE_FACTORY_PAGES.find((page) => page.sourceScope === sourceScope && pageFactoryRouteMatches(page.route, route)) ?? null;
}

export function pageFactoryRouteMatches(registeredRoute: string, normalizedRoute: string) {
  const [registeredPath, registeredSearch = ""] = registeredRoute.split("?", 2);
  const [currentPath, currentSearch = ""] = normalizedRoute.split("?", 2);
  if (registeredSearch !== currentSearch) return false;
  const pattern = registeredPath
    .split("/")
    .map((segment) => segment.startsWith(":") ? "[^/]+" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("/");
  return new RegExp(`^${pattern}$`).test(currentPath);
}

export function inspectPageFactoryDocument(pathname: string, search = "", root: ParentNode = document): PageFactoryInspection {
  const normalizedRoute = normalizePageFactoryRoute(pathname, search);
  const sourceScope = resolvePageFactoryScope(pathname);
  const page = PAGE_FACTORY_PAGES.find((item) => item.sourceScope === sourceScope && pageFactoryRouteMatches(item.route, normalizedRoute)) ?? null;
  const requiredRegions = page?.requiredRegions ?? PAGE_FACTORY_STANDARD.regions;
  const regions = requiredRegions.map((id) => {
    const selector = `[data-page-factory-region='${id}'], ${REGION_FALLBACK_SELECTORS[id]}`;
    return { id, selector, present: Boolean(root.querySelector(selector)) };
  });
  const capabilities = [
    { id: "responsive-small-screen", present: Boolean(root.querySelector("[data-responsive-page-host]")) },
    { id: "developer", present: Boolean(root.querySelector("[data-responsive-page-tools-slot], [data-responsive-page-tools-standalone]")) },
    { id: "visual-editor", present: Boolean(root.querySelector("[data-visual-card-developer-launcher], [data-responsive-visual-launcher-slot]")) },
    { id: "shared-contract", present: Boolean(root.querySelector("[data-visual-responsive-contract], [data-page-factory-contract]")) },
    { id: "factory-restore", present: Boolean(page?.factoryDefaultVersion) },
    { id: "version-governance", present: page?.factoryDefaultVersion === PAGE_FACTORY_STANDARD.factoryVersion },
  ];
  return {
    page,
    normalizedRoute,
    checkedAt: new Date().toISOString(),
    passed: Boolean(page) && regions.every((region) => region.present) && capabilities.every((capability) => capability.present),
    regions,
    capabilities,
  };
}

export function buildPageFactoryCommand(commandId: string, page?: PageFactoryPage | null) {
  const command = PAGE_FACTORY_COMMANDS.find((item) => item.id === commandId);
  if (!command) return "";
  if (!page) return command.command;
  return command.command
    .replace("<page-id>", page.id)
    .replace("<route>", page.route)
    .replace("<component>", page.component)
    .replace("<template>", page.template);
}
