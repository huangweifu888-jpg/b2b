import {
  DEVELOPER_GLOBAL_FRAME_ADAPTER_CONTRACT_VERSION,
  DEVELOPER_GLOBAL_FRAME_ADAPTER_REGISTRY,
  DEVELOPER_GLOBAL_FRAME_TEMPLATE_ADAPTER_REGISTRY,
  DEVELOPER_GLOBAL_FRAME_TRANSIENT_QUERY_KEYS,
  findDeveloperGlobalFrameAdapterForRoute,
  type DeveloperGlobalFrameAdapterRegistration,
  type DeveloperGlobalFrameTemplateAdapterRegistration,
} from "@/lib/developer-global-frame-adapter-registry";
import {
  PAGE_FACTORY_PAGES,
  normalizePageFactoryRoute,
  pageFactoryRouteMatches,
  resolvePageFactoryScope,
  type PageFactoryPage,
  type PageFactoryScope,
} from "@/page-factory/page-factory";

export type DeveloperGlobalFrameAdapterResolution = {
  pageRegistration: PageFactoryPage;
  pageFactoryId: string;
  sourceScope: PageFactoryScope;
  route: string;
  template: PageFactoryPage["template"];
  lifecycle: "complete" | "pilot-complete";
  strategy: "explicit-exception" | "template-projection";
  adapterId: DeveloperGlobalFrameAdapterRegistration["domAdapterId"] | DeveloperGlobalFrameTemplateAdapterRegistration["id"];
  explicitRegistration: DeveloperGlobalFrameAdapterRegistration | null;
  templateRegistration: DeveloperGlobalFrameTemplateAdapterRegistration;
};

export type DeveloperGlobalFrameAdapterCoverage = {
  totalRegistered: number;
  eligible: number;
  resolved: number;
  explicit: number;
  templateProjected: number;
  coveragePercent: number;
  byScope: Record<PageFactoryScope, { eligible: number; resolved: number }>;
  byTemplate: Record<PageFactoryPage["template"], { eligible: number; resolved: number }>;
  issues: string[];
};

export type DeveloperGlobalFrameResolvableTargetRegistration = {
  profilePageId: string;
  pageFactoryId: string;
  sourceScope: PageFactoryScope;
  role: "reference" | "pilot" | "consumer";
  lifecycle: "complete" | "pilot-complete";
  strategy: DeveloperGlobalFrameAdapterResolution["strategy"];
  adapterId: DeveloperGlobalFrameAdapterResolution["adapterId"];
  supportedContractVersion: typeof DEVELOPER_GLOBAL_FRAME_ADAPTER_CONTRACT_VERSION;
};

const ELIGIBLE_LIFECYCLES = new Set<PageFactoryPage["status"]>(["complete", "pilot-complete"]);

/**
 * Registered technical/control-flow pages remain resolvable and auditable,
 * but must never receive the business workspace frame. They either redirect,
 * render inside another page, or are public surfaces outside the three-source
 * authenticated application shells.
 */
export const DEVELOPER_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_IDS = Object.freeze([
  "auth-callback",
  "auth-error",
  "client-logout-callback",
  "client-preview-frame",
  "client-preview-site",
] as const);

const DEVELOPER_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_ID_SET = new Set<string>(
  DEVELOPER_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_IDS,
);

export function isDeveloperGlobalFrameIntentionalIsolationPageId(pageFactoryId: string) {
  return DEVELOPER_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_ID_SET.has(pageFactoryId);
}

function isEligiblePage(page: PageFactoryPage): page is PageFactoryPage & { status: "complete" | "pilot-complete" } {
  return ELIGIBLE_LIFECYCLES.has(page.status);
}

function findTemplateRegistration(template: PageFactoryPage["template"]) {
  return DEVELOPER_GLOBAL_FRAME_TEMPLATE_ADAPTER_REGISTRY.find((entry) => entry.template === template) ?? null;
}

export function resolveDeveloperGlobalFrameAdapterForPage(
  page: PageFactoryPage,
): DeveloperGlobalFrameAdapterResolution | null {
  if (!isEligiblePage(page)) return null;
  const templateRegistration = findTemplateRegistration(page.template);
  if (!templateRegistration) return null;
  const explicitRegistration = DEVELOPER_GLOBAL_FRAME_ADAPTER_REGISTRY.find((entry) => entry.pageFactoryId === page.id) ?? null;
  if (explicitRegistration && (explicitRegistration.sourceScope !== page.sourceScope || explicitRegistration.route !== page.route)) return null;
  return {
    pageRegistration: page,
    pageFactoryId: page.id,
    sourceScope: page.sourceScope,
    route: page.route,
    template: page.template,
    lifecycle: page.status,
    strategy: explicitRegistration ? "explicit-exception" : "template-projection",
    adapterId: explicitRegistration?.domAdapterId ?? templateRegistration.id,
    explicitRegistration,
    templateRegistration,
  };
}

function normalizeResolutionRoute(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  for (const key of DEVELOPER_GLOBAL_FRAME_TRANSIENT_QUERY_KEYS) params.delete(key);
  params.sort();
  return normalizePageFactoryRoute(pathname, params.toString());
}

/**
 * Resolves one and only one registered page identity. Unknown query identity,
 * route ambiguity, lifecycle gaps and source-scope mismatches all fail closed.
 */
export function resolveDeveloperGlobalFrameAdapterForRoute(
  pathname: string,
  search = "",
  expectedSourceScope?: PageFactoryScope,
): DeveloperGlobalFrameAdapterResolution | null {
  const sourceScope = resolvePageFactoryScope(pathname);
  if (expectedSourceScope && sourceScope !== expectedSourceScope) return null;

  const explicitRegistration = findDeveloperGlobalFrameAdapterForRoute(pathname, search);
  if (explicitRegistration) {
    if (explicitRegistration.sourceScope !== sourceScope) return null;
    const page = PAGE_FACTORY_PAGES.find((candidate) => candidate.id === explicitRegistration.pageFactoryId);
    const resolution = page ? resolveDeveloperGlobalFrameAdapterForPage(page) : null;
    return resolution?.explicitRegistration === explicitRegistration ? resolution : null;
  }

  const normalizedRoute = normalizeResolutionRoute(pathname, search);
  const matches = PAGE_FACTORY_PAGES.filter((page) => page.sourceScope === sourceScope
    && isEligiblePage(page)
    && pageFactoryRouteMatches(page.route, normalizedRoute));
  if (matches.length !== 1) return null;
  return resolveDeveloperGlobalFrameAdapterForPage(matches[0]);
}

export function isDeveloperGlobalFrameCompatibleTarget(
  resolution: DeveloperGlobalFrameAdapterResolution | null,
  compatibleTargetPageIds: readonly string[],
  expectedSourceScope?: PageFactoryScope,
) {
  return Boolean(resolution
    && (!expectedSourceScope || resolution.sourceScope === expectedSourceScope)
    && compatibleTargetPageIds.includes(resolution.pageFactoryId));
}

export function buildDeveloperGlobalFrameResolvableTargetRegistrations(
  pages: readonly PageFactoryPage[] = PAGE_FACTORY_PAGES,
): DeveloperGlobalFrameResolvableTargetRegistration[] {
  return pages.map((page) => {
    const resolution = resolveDeveloperGlobalFrameAdapterForPage(page);
    if (!resolution) return null;
    return {
      profilePageId: resolution.explicitRegistration?.profilePageId ?? resolution.pageFactoryId,
      pageFactoryId: resolution.pageFactoryId,
      sourceScope: resolution.sourceScope,
      role: resolution.explicitRegistration?.role ?? "consumer",
      lifecycle: resolution.lifecycle,
      strategy: resolution.strategy,
      adapterId: resolution.adapterId,
      supportedContractVersion: DEVELOPER_GLOBAL_FRAME_ADAPTER_CONTRACT_VERSION,
    } satisfies DeveloperGlobalFrameResolvableTargetRegistration;
  }).filter((entry): entry is DeveloperGlobalFrameResolvableTargetRegistration => Boolean(entry));
}

export const DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS = Object.freeze(
  buildDeveloperGlobalFrameResolvableTargetRegistrations().map((entry) => Object.freeze(entry)),
);

export function findDeveloperGlobalFrameResolvableTargetByProfilePageId(profilePageId: string) {
  return DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS.find((entry) => entry.profilePageId === profilePageId) ?? null;
}

export function resolveDeveloperGlobalFrameProfilePageId(resolution: DeveloperGlobalFrameAdapterResolution) {
  return resolution.explicitRegistration?.profilePageId ?? resolution.pageFactoryId;
}

function emptyScopeCounts() {
  return {
    hq: { eligible: 0, resolved: 0 },
    agency_source: { eligible: 0, resolved: 0 },
    client_source: { eligible: 0, resolved: 0 },
  } satisfies DeveloperGlobalFrameAdapterCoverage["byScope"];
}

function emptyTemplateCounts() {
  return {
    reference: { eligible: 0, resolved: 0 },
    dashboard: { eligible: 0, resolved: 0 },
    list: { eligible: 0, resolved: 0 },
    form: { eligible: 0, resolved: 0 },
    detail: { eligible: 0, resolved: 0 },
    editor: { eligible: 0, resolved: 0 },
    workflow: { eligible: 0, resolved: 0 },
  } satisfies DeveloperGlobalFrameAdapterCoverage["byTemplate"];
}

export function inspectDeveloperGlobalFrameAdapterCoverage(
  pages: readonly PageFactoryPage[] = PAGE_FACTORY_PAGES,
): DeveloperGlobalFrameAdapterCoverage {
  const issues: string[] = [];
  const byScope = emptyScopeCounts();
  const byTemplate = emptyTemplateCounts();
  const eligiblePages = pages.filter(isEligiblePage);
  const seenPageIds = new Set<string>();
  let resolved = 0;
  let explicit = 0;

  for (const page of eligiblePages) {
    byScope[page.sourceScope].eligible += 1;
    byTemplate[page.template].eligible += 1;
    if (seenPageIds.has(page.id)) issues.push(`duplicate eligible page id: ${page.id}`);
    seenPageIds.add(page.id);
    const resolution = resolveDeveloperGlobalFrameAdapterForPage(page);
    if (!resolution) {
      issues.push(`unresolved eligible page: ${page.id}`);
      continue;
    }
    resolved += 1;
    if (resolution.strategy === "explicit-exception") explicit += 1;
    byScope[page.sourceScope].resolved += 1;
    byTemplate[page.template].resolved += 1;
  }

  return {
    totalRegistered: pages.length,
    eligible: eligiblePages.length,
    resolved,
    explicit,
    templateProjected: resolved - explicit,
    coveragePercent: eligiblePages.length ? Number(((resolved / eligiblePages.length) * 100).toFixed(2)) : 100,
    byScope,
    byTemplate,
    issues,
  };
}
