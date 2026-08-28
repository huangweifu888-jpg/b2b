import {
  DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION,
  DEVELOPER_GLOBAL_STYLE_PILOT_PAGE_ID,
  DEVELOPER_GLOBAL_STYLE_REFERENCE_PAGE_ID,
} from "@/lib/developer-global-style-contract";
import { PAGE_FRAME_NON_IDENTITY_QUERY_KEYS } from "@/lib/page-route-identity";
import {
  PAGE_FACTORY_PAGES,
  normalizePageFactoryRoute,
  resolvePageFactoryScope,
  type PageFactoryPage,
  type PageFactoryRegion,
  type PageFactoryTemplate,
} from "@/page-factory/page-factory";

export const DEVELOPER_GLOBAL_FRAME_BLUEPRINT_PAGE_ID = "client-source-product-market-blueprint" as const;
export const DEVELOPER_GLOBAL_FRAME_ADAPTER_CONTRACT_VERSION = DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION;

export type DeveloperGlobalFrameRegisteredRole = "reference" | "pilot" | "consumer";
export type DeveloperGlobalFrameDomAdapterId = "existing-workspace-direct-v1" | "product-market-blueprint-bridge-v1";
export type DeveloperGlobalFrameTemplateAdapterId = `page-factory-${PageFactoryTemplate}-projection-v1`;

export type DeveloperGlobalFrameTemplateAdapterRegistration = {
  id: DeveloperGlobalFrameTemplateAdapterId;
  template: PageFactoryTemplate;
  projection: "canonical-semantic-regions";
  scrollContract: "content-only";
  preservesBusinessDom: true;
};

export type DeveloperGlobalFrameAdapterRegistration = {
  profilePageId: string;
  pageFactoryId: string;
  sourceScope: "client_source";
  route: string;
  role: DeveloperGlobalFrameRegisteredRole;
  supportedContractVersion: typeof DEVELOPER_GLOBAL_FRAME_ADAPTER_CONTRACT_VERSION;
  frameOwner: "existing-workspace";
  domAdapterId: DeveloperGlobalFrameDomAdapterId;
  component: string;
  template: PageFactoryTemplate;
  pageFactoryRequiredRegions: readonly PageFactoryRegion[];
  allowedAdditionalQueryKeys: readonly string[];
  selectors: {
    bridge: string | null;
    title: string;
    tableShell: string;
    tableHeader: string;
    content: string;
  };
};

export type DeveloperGlobalFrameAdapterDescriptor = Pick<
  DeveloperGlobalFrameAdapterRegistration,
  | "profilePageId"
  | "pageFactoryId"
  | "role"
  | "domAdapterId"
  | "allowedAdditionalQueryKeys"
  | "selectors"
>;

/** Developer routing must consume the exact Page Factory frame identity contract. */
export const DEVELOPER_GLOBAL_FRAME_TRANSIENT_QUERY_KEYS = PAGE_FRAME_NON_IDENTITY_QUERY_KEYS;

/**
 * The seven code-owned template projections cover ordinary Page Factory
 * pages.  Explicit DOM registrations below take precedence only where a
 * reviewed workspace needs a narrower canonical-node bridge.
 */
export const DEVELOPER_GLOBAL_FRAME_TEMPLATE_ADAPTER_REGISTRY = Object.freeze([
  "reference",
  "dashboard",
  "list",
  "form",
  "detail",
  "editor",
  "workflow",
].map((template) => Object.freeze({
  id: `page-factory-${template}-projection-v1`,
  template,
  projection: "canonical-semantic-regions",
  scrollContract: "content-only",
  preservesBusinessDom: true,
})) as readonly DeveloperGlobalFrameTemplateAdapterRegistration[]);

/**
 * Explicit adapters own only DOM-specific exceptions. Page identity, route,
 * component, template and regions remain Page Factory-owned and are projected
 * here so a single registry edit updates every developer consumer.
 */
export function buildDeveloperGlobalFrameAdapterRegistration(
  descriptor: DeveloperGlobalFrameAdapterDescriptor,
  pages: readonly PageFactoryPage[] = PAGE_FACTORY_PAGES,
): DeveloperGlobalFrameAdapterRegistration {
  const page = pages.find((candidate) => candidate.id === descriptor.pageFactoryId);
  if (!page) throw new Error(`Page Factory registration missing: ${descriptor.pageFactoryId}`);
  if (page.sourceScope !== "client_source") {
    throw new Error(`Explicit frame adapter must belong to Client Source: ${descriptor.pageFactoryId}`);
  }
  if (page.component !== page.entryComponent) {
    throw new Error(`Existing-workspace adapter requires one canonical component owner: ${descriptor.pageFactoryId}`);
  }
  return Object.freeze({
    ...descriptor,
    sourceScope: page.sourceScope,
    route: page.route,
    supportedContractVersion: DEVELOPER_GLOBAL_FRAME_ADAPTER_CONTRACT_VERSION,
    frameOwner: "existing-workspace",
    component: page.component,
    template: page.template,
    pageFactoryRequiredRegions: Object.freeze([...page.requiredRegions]),
  });
}

/**
 * Code-owned rollout truth. An entry is added only after its real FactoryPage
 * root owns the existing workspace and exposes one canonical title/table/list
 * hierarchy. Page-factory registration alone is deliberately insufficient.
 */
export const DEVELOPER_GLOBAL_FRAME_ADAPTER_DESCRIPTORS = Object.freeze([
  {
    profilePageId: DEVELOPER_GLOBAL_STYLE_REFERENCE_PAGE_ID,
    pageFactoryId: "client-source-product-market-operations",
    role: "reference",
    domAdapterId: "existing-workspace-direct-v1",
    allowedAdditionalQueryKeys: DEVELOPER_GLOBAL_FRAME_TRANSIENT_QUERY_KEYS,
    selectors: {
      bridge: null,
      title: ":scope > [data-product-market-header][data-development-standard-frame-region=\"title\"]",
      tableShell: ":scope > [data-product-market-table-shell][data-development-standard-frame-region=\"table-shell\"]",
      tableHeader: ":scope > [data-product-market-table-header][data-development-standard-frame-region=\"table-header\"]",
      content: ":scope > [data-product-market-scroll-list][data-page-list-scroll-owner][data-development-standard-frame-region=\"content\"]",
    },
  },
  {
    profilePageId: DEVELOPER_GLOBAL_STYLE_PILOT_PAGE_ID,
    pageFactoryId: "client-social-marketing-playbook",
    role: "pilot",
    domAdapterId: "existing-workspace-direct-v1",
    allowedAdditionalQueryKeys: DEVELOPER_GLOBAL_FRAME_TRANSIENT_QUERY_KEYS,
    selectors: {
      bridge: null,
      title: ":scope > [data-social-media-title-header][data-development-standard-frame-region=\"title-1\"]",
      tableShell: ":scope > [data-social-media-table-shell][data-development-standard-frame-region=\"table-shell\"]",
      tableHeader: ":scope > [data-client-project-subnav][data-page-table-header][data-development-standard-frame-region=\"table-header\"]",
      content: ":scope > [data-social-media-content][data-page-list-scroll-owner][data-development-standard-frame-region=\"content\"]",
    },
  },
  {
    profilePageId: DEVELOPER_GLOBAL_FRAME_BLUEPRINT_PAGE_ID,
    pageFactoryId: "client-source-product-market-blueprint",
    role: "consumer",
    domAdapterId: "product-market-blueprint-bridge-v1",
    allowedAdditionalQueryKeys: [...DEVELOPER_GLOBAL_FRAME_TRANSIENT_QUERY_KEYS, "app", "category", "phase"],
    selectors: {
      bridge: ":scope > [data-product-market-maturity-badge-source=\"blueprint-only\"]",
      title: ":scope > [data-factory-platform-blueprint-header][data-development-standard-frame-region=\"title\"]",
      tableShell: ":scope > [data-factory-platform-blueprint][data-development-standard-frame-region=\"table-shell\"]",
      tableHeader: ":scope > [data-development-standard-frame-region=\"table-header\"]",
      content: ":scope > [data-page-list][data-page-list-scroll-owner][data-development-standard-frame-region=\"content\"]",
    },
  },
] satisfies readonly DeveloperGlobalFrameAdapterDescriptor[]);

export const DEVELOPER_GLOBAL_FRAME_ADAPTER_REGISTRY = Object.freeze(
  DEVELOPER_GLOBAL_FRAME_ADAPTER_DESCRIPTORS.map((descriptor) => (
    buildDeveloperGlobalFrameAdapterRegistration(descriptor)
  )),
);

function parseRegisteredRoute(route: string) {
  const [pathname, rawSearch = ""] = route.split("?", 2);
  return { pathname, params: new URLSearchParams(rawSearch) };
}

export function validateDeveloperGlobalFrameAdapterRegistry(
  pages: readonly PageFactoryPage[] = PAGE_FACTORY_PAGES,
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const profileIds = new Set<string>();
  const factoryIds = new Set<string>();
  for (const registration of DEVELOPER_GLOBAL_FRAME_ADAPTER_REGISTRY) {
    if (profileIds.has(registration.profilePageId)) issues.push(`duplicate profile page: ${registration.profilePageId}`);
    if (factoryIds.has(registration.pageFactoryId)) issues.push(`duplicate page-factory page: ${registration.pageFactoryId}`);
    profileIds.add(registration.profilePageId);
    factoryIds.add(registration.pageFactoryId);
    if (registration.supportedContractVersion !== DEVELOPER_GLOBAL_FRAME_ADAPTER_CONTRACT_VERSION) {
      issues.push(`unsupported adapter contract version: ${registration.profilePageId}`);
    }
    const page = pages.find((candidate) => candidate.id === registration.pageFactoryId);
    if (!page) {
      issues.push(`page-factory registration missing: ${registration.pageFactoryId}`);
      continue;
    }
    if (page.sourceScope !== registration.sourceScope) issues.push(`source scope mismatch: ${registration.pageFactoryId}`);
    if (page.route !== registration.route) issues.push(`route mismatch: ${registration.pageFactoryId}`);
    if (page.component !== registration.component || page.entryComponent !== registration.component) {
      issues.push(`component mismatch: ${registration.pageFactoryId}`);
    }
    if (page.template !== registration.template) issues.push(`template mismatch: ${registration.pageFactoryId}`);
    if (page.status !== "complete" || page.regionStrategy !== "runtime-auto") {
      issues.push(`page-factory lifecycle incomplete: ${registration.pageFactoryId}`);
    }
    for (const region of registration.pageFactoryRequiredRegions) {
      if (!page.requiredRegions.includes(region)) issues.push(`page-factory region missing: ${registration.pageFactoryId}.${region}`);
    }
  }
  const references = DEVELOPER_GLOBAL_FRAME_ADAPTER_REGISTRY.filter((entry) => entry.role === "reference");
  const pilots = DEVELOPER_GLOBAL_FRAME_ADAPTER_REGISTRY.filter((entry) => entry.role === "pilot");
  const consumers = DEVELOPER_GLOBAL_FRAME_ADAPTER_REGISTRY.filter((entry) => entry.role === "consumer");
  if (references.length !== 1 || references[0]?.profilePageId !== DEVELOPER_GLOBAL_STYLE_REFERENCE_PAGE_ID) {
    issues.push("exact operations reference adapter required");
  }
  if (pilots.length !== 1 || pilots[0]?.profilePageId !== DEVELOPER_GLOBAL_STYLE_PILOT_PAGE_ID) {
    issues.push("exact marketing-playbook pilot adapter required");
  }
  if (consumers.length < 1) issues.push("at least one verified consumer adapter required");
  return { valid: issues.length === 0, issues };
}

export function findDeveloperGlobalFrameAdapterByProfilePageId(profilePageId: string) {
  return DEVELOPER_GLOBAL_FRAME_ADAPTER_REGISTRY.find((entry) => entry.profilePageId === profilePageId) ?? null;
}

export function findDeveloperGlobalFrameAdapterForRoute(pathname: string, search = "") {
  const sourceScope = resolvePageFactoryScope(pathname);
  const normalizedPathname = normalizePageFactoryRoute(pathname).split("?", 1)[0];
  const currentParams = new URLSearchParams(search);
  return DEVELOPER_GLOBAL_FRAME_ADAPTER_REGISTRY.find((entry) => {
    if (entry.sourceScope !== sourceScope) return false;
    const registered = parseRegisteredRoute(entry.route);
    if (registered.pathname !== normalizedPathname) return false;
    for (const [key, value] of registered.params) {
      if (currentParams.get(key) !== value) return false;
    }
    const allowed = new Set([...registered.params.keys(), ...entry.allowedAdditionalQueryKeys]);
    return [...currentParams.keys()].every((key) => allowed.has(key));
  }) ?? null;
}

export function buildDeveloperGlobalFrameAdapterRootSelector(registration: DeveloperGlobalFrameAdapterRegistration) {
  return `[data-page-factory-page-id="${registration.pageFactoryId}"][data-page-factory-frame-owner="${registration.frameOwner}"]`;
}
