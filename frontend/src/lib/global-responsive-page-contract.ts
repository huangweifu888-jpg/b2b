import { RESPONSIVE_CAPACITY_LAYOUT_FACTORY_DEFAULT } from "./responsive-shell-contract";
import { ADAPTIVE_STRUCTURE_FACTORY_DEFAULT } from "./adaptive-structure-contract";
import { SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT } from "./shared-adaptive-surface-contract";
import { SHARED_WINDOW_FACTORY_DEFAULT } from "./shared-window-contract";
import { FACTORY_PLATFORM_SOCIAL_WORKSPACES } from "./factory-platform-blueprint";
import { findPageFactoryPage } from "@/page-factory/page-factory";
import { GLOBAL_RESPONSIVE_PAGE_CONTRACT_VERSION } from "./global-responsive-page-version";

export const GLOBAL_RESPONSIVE_PAGE_TEMPLATE_IDS = [
  "reference",
  "dashboard",
  "list",
  "form",
  "detail",
  "editor",
  "workflow",
] as const;

export type GlobalResponsivePageTemplate = typeof GLOBAL_RESPONSIVE_PAGE_TEMPLATE_IDS[number];

export const GLOBAL_RESPONSIVE_PAGE_FACTORY_DEFAULT = {
  id: "all-pages-responsive-host",
  version: GLOBAL_RESPONSIVE_PAGE_CONTRACT_VERSION,
  strategy: "container-first-semantic-templates",
  ownership: {
    shared: ["shell", "page-host", "density", "flow", "overflow", "interaction-size", "popover-placement"],
    page: ["records", "fields", "columns", "business-actions", "plugins", "saved-content"],
  },
  templates: GLOBAL_RESPONSIVE_PAGE_TEMPLATE_IDS,
  containerStages: [
    { id: "wide", minWidth: 1280 },
    { id: "comfortable", minWidth: 1024 },
    { id: "wrap", minWidth: 640 },
    { id: "compact", minWidth: 0 },
  ],
  priorities: {
    p0: "always-available",
    p1: "remove-secondary-copy-then-icon",
    p2: "move-to-overflow-after-measurement",
    p3: "hide-decoration-first",
  },
  componentPolicies: {
    actions: "container-single-line-shrink-copy-then-wrap",
    titles: "auto-discovered-live-title-surface-with-readable-capacity",
    titleDiscovery: "explicit-actions-or-control-only-sibling-never-business-content",
    forms: "container-auto-fit-two-column-then-single-column",
    grids: "container-auto-fit-safe-card-width",
    tables: "local-scroll-or-semantic-card-not-page-overflow",
    tabs: "local-horizontal-scroll-with-visible-focus",
    dialogs: "viewport-contained-single-column-on-compact",
    editors: "complexity-aware-single-column-before-field-compression",
    moduleEditors: "card-capacity-three-stage-shared-plugin",
    moduleCategories: "desktop-bounded-compact-sticky-tablet-phone-static-shared-plugin",
    serviceExperts: "own-container-222px-compact-card-progressive-unbounded-auto-fit-shared-plugin",
    pageTools: "labelled-first-then-measured-icon-only-then-measured-overflow",
  },
  capacityLayout: RESPONSIVE_CAPACITY_LAYOUT_FACTORY_DEFAULT,
  adaptiveStructure: ADAPTIVE_STRUCTURE_FACTORY_DEFAULT,
  mobileApplication: ADAPTIVE_STRUCTURE_FACTORY_DEFAULT.mobileApplication,
  sharedAdaptiveSurfaces: SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT,
  sharedWindow: SHARED_WINDOW_FACTORY_DEFAULT,
  learning: {
    requireHost: true,
    requireTemplate: true,
    rejectPageOverflow: true,
    rejectCompressedText: true,
    requireStableBusinessContent: true,
    rejectUndersizedInteractiveTargets: true,
  },
  factoryRestore: {
    source: "code-owned-global-responsive-page-contract",
    structureSource: "code-owned-adaptive-structure-contract",
    surfaceSource: "code-owned-shared-adaptive-surface-contract",
    windowSource: "code-owned-shared-window-contract",
    preserves: ["business-data", "page-content", "materials", "tenant-overrides"],
  },
} as const;

const EDITOR_SEGMENTS = new Set([
  "product-market", "company-info", "site-settings", "templates", "social",
  "code-editor", "platform-architecture", "brand-studio", "digital-assets",
]);
const DASHBOARD_SEGMENTS = new Set([
  "", "dashboard", "reports", "performance", "health-cockpit", "forecast",
  "revenue-profit", "metric-center", "ai-cost", "geo-center",
]);
const FORM_SEGMENTS = new Set([
  "account", "oem", "oem-settings", "notify-config", "email-config",
  "platform-config", "site-management", "dam-localization",
]);
const DETAIL_SEGMENTS = new Set([
  "products", "news", "cases", "videos", "blog", "seo", "smart-ads",
]);
const WORKFLOW_SEGMENTS = new Set([
  "ai-chat", "release-rollouts", "template-migrations", "backup-restore-drills",
  "social-content-reviews", "social-publish-delivery", "approval-center",
]);

export function normalizeResponsiveRoute(pathname: string) {
  return pathname.replace(/^\/(?:zb\/agency-source|zb\/client-source|zb|dl|kh)(?=\/|$)/, "") || "/";
}

export function resolveGlobalResponsivePageTemplate(pathname: string, search = ""): GlobalResponsivePageTemplate {
  const factoryPage = findPageFactoryPage(pathname, search);
  if (factoryPage) return factoryPage.template;
  const route = normalizeResponsiveRoute(pathname);
  const segment = route.split("/").filter(Boolean).at(-1) || "";
  if (segment === "product-market") return "reference";
  if (segment === "social") {
    const tab = new URLSearchParams(search).get("tab") || "dashboard";
    return FACTORY_PLATFORM_SOCIAL_WORKSPACES.find((workspace) => workspace.tab === tab)?.template || "dashboard";
  }
  if (EDITOR_SEGMENTS.has(segment)) return "editor";
  if (DASHBOARD_SEGMENTS.has(segment)) return "dashboard";
  if (FORM_SEGMENTS.has(segment)) return "form";
  if (DETAIL_SEGMENTS.has(segment)) return "detail";
  if (WORKFLOW_SEGMENTS.has(segment)) return "workflow";
  return "list";
}

export function resolveGlobalResponsiveContainerStage(width: number) {
  if (width >= 1280) return "wide";
  if (width >= 1024) return "comfortable";
  if (width >= 640) return "wrap";
  return "compact";
}
