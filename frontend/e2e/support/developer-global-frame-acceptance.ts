import { SHARED_WINDOW_CONTRACT_VERSION, SHARED_WINDOW_REGISTRY } from "../../src/lib/shared-window-contract";
import pageFactoryStandardData from "../../src/page-factory/page-factory-standard.json" with { type: "json" };
import pageRegistryData from "../../src/page-factory/page-registry.json" with { type: "json" };

export type PageFactoryScope = "hq" | "agency_source" | "client_source";
export type PageFactoryTemplate = "reference" | "dashboard" | "list" | "form" | "detail" | "editor" | "workflow";
export type PageFactoryRegion = "top" | "body" | "title-1" | "title-2" | "table-shell" | "table-header" | "content" | "large-card" | "small-card" | "footer" | "scrollbar";
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

export const ACCEPTANCE_PAGE_FACTORY_PAGES = Object.freeze(pageRegistryData.pages) as readonly PageFactoryPage[];
export const ACCEPTANCE_PAGE_FACTORY_STANDARD = Object.freeze(pageFactoryStandardData);

export const ACCEPTANCE_DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID = "client-source-global" as const;
export const ACCEPTANCE_DEVELOPER_GLOBAL_FRAME_CONTRACT_VERSION = "1.0.0" as const;
export const ACCEPTANCE_DEVELOPER_GLOBAL_FRAME_REGIONS = [
  "topbar",
  "workspace",
  "title",
  "table-shell",
  "table-header",
  "content",
  "footer",
  "scrollbar",
] as const;
export const ACCEPTANCE_DEVELOPER_GLOBAL_FRAME_PILOT_CHECK_IDS = [
  "workspace-annotation",
  "table-shell-annotation",
  "spacing-parity",
  "right-edge-parity",
] as const;

export const ACCEPTANCE_EXPLICIT_GLOBAL_FRAME_TARGETS = Object.freeze({
  "client-source-product-market-operations": {
    profilePageId: "product-market:operations",
    role: "reference",
  },
  "client-social-marketing-playbook": {
    profilePageId: "client-source:social:marketing-playbook",
    role: "pilot",
  },
  "client-source-product-market-blueprint": {
    profilePageId: "client-source-product-market-blueprint",
    role: "consumer",
  },
} as const);

export const ACCEPTANCE_SHARED_WINDOW_CONTRACT = Object.freeze({
  id: "three-source-shared-window-contract",
  version: SHARED_WINDOW_CONTRACT_VERSION,
  registryIds: SHARED_WINDOW_REGISTRY.map((entry) => entry.id),
} as const);

export const DEVELOPER_GLOBAL_FRAME_ISOLATION_PAGE_IDS_ENV =
  "B2B_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_IDS" as const;

/** The runner injects the bundled production policy; no second E2E list exists. */
export function readDeveloperGlobalFrameIntentionalIsolationPageIds(
  environment: Record<string, string | undefined> = process.env,
) {
  const serialized = environment[DEVELOPER_GLOBAL_FRAME_ISOLATION_PAGE_IDS_ENV]?.trim();
  if (!serialized) {
    throw new Error(
      `${DEVELOPER_GLOBAL_FRAME_ISOLATION_PAGE_IDS_ENV} is required; run scripts/run-developer-global-frame-acceptance.mjs`,
    );
  }
  const ids = serialized.split(",").map((pageId) => pageId.trim()).filter(Boolean);
  if (new Set(ids).size !== ids.length) throw new Error("Intentional isolation page ids must be unique");
  return Object.freeze(ids);
}

export const DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_PAGE_COUNT = 201 as const;

export const DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_VIEWPORTS = [
  { id: "desktop-1440", width: 1440, height: 900 },
  { id: "compact-1024", width: 1024, height: 768 },
  { id: "mobile-390", width: 390, height: 844 },
] as const;

export type DeveloperGlobalFrameAcceptanceViewport =
  (typeof DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_VIEWPORTS)[number];

export type DeveloperGlobalFrameAcceptanceCase = {
  page: PageFactoryPage;
  pageId: string;
  registeredRoute: string;
  runtimeRoute: string;
  sourceScope: PageFactoryScope;
  responsiveShellScope: "hq" | "agency-source" | "client-source";
};

export type DeveloperGlobalFramePageViewportAcceptanceCase =
  DeveloperGlobalFrameAcceptanceCase & {
    viewport: DeveloperGlobalFrameAcceptanceViewport;
  };

const SOURCE_PREFIX: Record<PageFactoryScope, string> = {
  hq: "/zb",
  agency_source: "/zb/agency-source",
  client_source: "/zb/client-source",
};

const RESPONSIVE_SHELL_SCOPE: Record<
  PageFactoryScope,
  DeveloperGlobalFrameAcceptanceCase["responsiveShellScope"]
> = {
  hq: "hq",
  agency_source: "agency-source",
  client_source: "client-source",
};

/**
 * These pages are deliberately registered as client-source identities but are
 * mounted at public/root routes rather than below the Client Source shell.
 * Keeping the exceptions here makes the 201-page browser census exercise the
 * route the application really serves instead of a synthetic prefixed route.
 */
const ROOT_CLIENT_ROUTE_PATTERNS = [
  /^\/auth\/(?:callback|error)$/u,
  /^\/logout-callback$/u,
  /^\/preview-frame$/u,
  /^\/sites\/:slug$/u,
];

const DYNAMIC_ROUTE_FIXTURES: Record<string, string> = {
  scope: "acceptance-scope",
  slug: "acceptance-site",
};

function concretePath(pathname: string) {
  return pathname.replace(/:([A-Za-z0-9_]+)/gu, (_match, parameter: string) =>
    encodeURIComponent(DYNAMIC_ROUTE_FIXTURES[parameter] ?? `acceptance-${parameter}`),
  );
}

export function buildDeveloperGlobalFrameAcceptanceRoute(page: PageFactoryPage) {
  const [registeredPath, registeredSearch = ""] = page.route.split("?", 2);
  const rootClientRoute = page.sourceScope === "client_source"
    && ROOT_CLIENT_ROUTE_PATTERNS.some((pattern) => pattern.test(registeredPath));
  const prefix = rootClientRoute ? "" : SOURCE_PREFIX[page.sourceScope];
  const pathname = concretePath(`${prefix}${registeredPath === "/" ? "" : registeredPath}`) || "/";
  const search = new URLSearchParams(registeredSearch);
  if (page.sourceScope === "client_source") search.set("siteId", "global-frame-acceptance");
  const serialized = search.toString();
  return `${pathname}${serialized ? `?${serialized}` : ""}`;
}

export function buildDeveloperGlobalFrameAcceptanceCases(
  pages: readonly PageFactoryPage[] = ACCEPTANCE_PAGE_FACTORY_PAGES,
): DeveloperGlobalFrameAcceptanceCase[] {
  return pages.map((page) => ({
    page,
    pageId: page.id,
    registeredRoute: page.route,
    runtimeRoute: buildDeveloperGlobalFrameAcceptanceRoute(page),
    sourceScope: page.sourceScope,
    responsiveShellScope: RESPONSIVE_SHELL_SCOPE[page.sourceScope],
  }));
}

export const GLOBAL_FRAME_ACCEPTANCE_CASES = Object.freeze(
  buildDeveloperGlobalFrameAcceptanceCases().map((entry) => Object.freeze(entry)),
);

export const GLOBAL_FRAME_ACCEPTANCE_PAGE_VIEWPORT_CASES = Object.freeze(
  GLOBAL_FRAME_ACCEPTANCE_CASES.flatMap((entry) =>
    DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_VIEWPORTS.map((viewport) =>
      Object.freeze({ ...entry, viewport }),
    ),
  ),
);

function parseScopeFilter(value: string | undefined) {
  if (!value) return null;
  const scopes = new Set(value.split(",").map((item) => item.trim()).filter(Boolean));
  const invalid = [...scopes].filter(
    (scope) => !(scope === "hq" || scope === "agency_source" || scope === "client_source"),
  );
  if (invalid.length) throw new Error(`Unsupported B2B_GLOBAL_FRAME_SCOPE: ${invalid.join(", ")}`);
  return scopes as Set<PageFactoryScope>;
}

function parseViewportFilter(value: string | undefined) {
  if (!value) return null;
  const widths = new Set(
    value.split(",").map((item) => Number.parseInt(item.trim().split("x", 1)[0], 10)),
  );
  const supported = new Set(DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_VIEWPORTS.map((viewport) => viewport.width));
  const invalid = [...widths].filter((width) => !supported.has(width as 1440 | 1024 | 390));
  if (invalid.length) throw new Error(`Unsupported B2B_GLOBAL_FRAME_VIEWPORT: ${invalid.join(", ")}`);
  return widths;
}

/**
 * Optional filters are for focused reruns only. The unfiltered exported
 * manifest above always contains all 201 pages x 3 viewports and is checked by
 * the static gate so a CI command cannot silently forget a registry page.
 */
export function selectDeveloperGlobalFrameAcceptanceCases(
  environment: Record<string, string | undefined> = process.env,
) {
  const scopes = parseScopeFilter(environment.B2B_GLOBAL_FRAME_SCOPE);
  const viewportWidths = parseViewportFilter(environment.B2B_GLOBAL_FRAME_VIEWPORT);
  const pageFilters = environment.B2B_GLOBAL_FRAME_PAGE
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return GLOBAL_FRAME_ACCEPTANCE_PAGE_VIEWPORT_CASES.filter((entry) =>
    (!scopes || scopes.has(entry.sourceScope))
    && (!viewportWidths || viewportWidths.has(entry.viewport.width))
    && (!pageFilters?.length || pageFilters.some((pageFilter) =>
      entry.pageId === pageFilter || entry.runtimeRoute.includes(pageFilter)
    )),
  );
}

export function formatDeveloperGlobalFrameAcceptanceFailure(
  entry: DeveloperGlobalFramePageViewportAcceptanceCase,
  check: string,
  detail?: string,
) {
  return [
    `pageId=${entry.pageId}`,
    `route=${entry.runtimeRoute}`,
    `viewport=${entry.viewport.width}x${entry.viewport.height}`,
    `check=${check}`,
    detail ? `detail=${detail}` : "",
  ].filter(Boolean).join(" | ");
}
