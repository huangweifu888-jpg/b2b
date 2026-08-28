export type PageCssProfile = {
  appliedAt: string;
  /** Monotonic local save time used to resolve global vs page-level CSS. */
  updatedAt?: number;
  /** All frame profiles are authored through 产品市场 → 开发规范. */
  source: "development-standard";
  /** Whether colors track 产品市场 → 版面风格 or intentionally stay fixed. */
  themeBinding?: "live" | "fixed";
  /** Reviewed source for fixed-frame tokens; never includes page content. */
  frameBaseline?: "operations";
  summary: string;
  variables?: Record<string, string>;
  layoutPlugin?: "shared-frame" | "navigation-frame";
  sharedFrame?: Record<
    string,
    { enabled: boolean; background: boolean; text: boolean; capsules: boolean; frame3d: boolean }
  >;
};

import { GLOBAL_FRAME_STYLE_SECTION_KEYS } from "@/lib/layout-frame-contract";
import { isCompletedLayoutLocked, isRouteCompletedLayoutLocked } from "@/lib/page-layout-lock";
import { findPageFactoryPage } from "@/page-factory/page-factory";

type StoredPageCssProfiles = Record<string, { layout?: PageCssProfile }>;
const STORAGE_KEY = "tradepro.page-css-profiles.v1";
// H28023: Page locks protect page-owned structure only.  Earlier releases
// stored a full visual snapshot when a page was locked, which inadvertently
// froze Global Sync tokens such as the right-workspace background.  Keep the
// key solely for one-time cleanup of those legacy snapshots.
const LOCKED_VISUAL_SNAPSHOTS_STORAGE_KEY = "tradepro.locked-page-visual-snapshots.v1";
const GLOBAL_LAYOUT_PROFILE_KEY = "__tradepro_global_layout__";
const RESTORE_POINT_STORAGE_KEY = "tradepro.page-css-restore-points.v1";
const RESTORE_POINT_LIMIT = 20;
export const PAGE_CSS_PROFILE_EVENT = "tradepro:page-css-profile-change";

/**
 * A "global" shared frame belongs to one source workspace, never to the
 * whole browser.  Without this boundary, saving a headquarters palette could
 * recolour the agency-source workbench (and vice versa) because both run in
 * the same local development origin.
 */
type GlobalLayoutScope = "hq" | "agency-source" | "client-source" | "agency" | "client";

function resolveGlobalLayoutScope(pathname?: string): GlobalLayoutScope {
  const currentPath = pathname || (typeof window !== "undefined" ? window.location.pathname : "");
  if (currentPath.startsWith("/zb/agency-source")) return "agency-source";
  if (currentPath.startsWith("/zb/client-source")) return "client-source";
  if (currentPath.startsWith("/zb")) return "hq";
  if (currentPath.startsWith("/dl")) return "agency";
  return "client";
}

function resolveGlobalLayoutProfileKey(pathname?: string) {
  return `${GLOBAL_LAYOUT_PROFILE_KEY}:${resolveGlobalLayoutScope(pathname)}`;
}

const GLOBAL_SURFACE_VARIABLES: Record<string, string> = {
  // These are visual tokens only. Table columns, cards, plugins and business
  // values remain page-owned, while their shared surfaces can follow a source
  // workspace's active Layout Style immediately.
  "--tradepro-shared-table-header-bg": "var(--tradepro-panel-table-bg, #ffffff)",
  "--tradepro-shared-table-header-text": "var(--tradepro-panel-table-text, #0f172a)",
  "--tradepro-shared-table-header-border": "color-mix(in srgb, var(--tradepro-panel-table-text, #0f172a) 16%, transparent)",
  "--tradepro-shared-list-bg": "var(--tradepro-panel-list-bg, #ffffff)",
  "--tradepro-shared-list-text": "var(--tradepro-panel-list-text, #0f172a)",
  "--tradepro-shared-list-border": "color-mix(in srgb, var(--tradepro-panel-list-text, #0f172a) 16%, transparent)",
};

const GLOBAL_SURFACE_VARIABLE_NAMES = new Set(Object.keys(GLOBAL_SURFACE_VARIABLES));

export const REQUIRED_SHARED_FRAME_VARIABLES = Object.freeze([
  "--tradepro-shared-topbar-bg",
  "--tradepro-shared-topbar-text",
  "--tradepro-shared-title-bg",
  "--tradepro-shared-title-text",
  "--tradepro-shared-title-padding",
  "--tradepro-shared-table-header-bg",
  "--tradepro-shared-table-header-text",
  "--tradepro-shared-list-bg",
  "--tradepro-shared-list-text",
  "--tradepro-shared-footer-bg",
  "--tradepro-shared-footer-text",
] as const);

function hydrateGlobalSurfaceProfile(profile?: PageCssProfile) {
  if (!profile) return profile;
  const sharedFrame = {
    ...(profile.sharedFrame || {}),
    tableHeader: {
      enabled: true,
      background: true,
      text: true,
      capsules: false,
      frame3d: false,
    },
    list: {
      enabled: true,
      background: true,
      text: true,
      capsules: false,
      frame3d: false,
    },
  } satisfies NonNullable<PageCssProfile["sharedFrame"]>;
  return {
    ...profile,
    variables: { ...(profile.variables || {}), ...GLOBAL_SURFACE_VARIABLES },
    sharedFrame,
  };
}

export type PageLayoutRestorePoint = {
  id: string;
  scope: "page" | "global";
  routeKey: string;
  createdAt: string;
  /** Undefined deliberately means the prior state had no saved override. */
  profile?: PageCssProfile;
};

const LIVE_THEME_LAYOUT_VARIABLES: Record<string, string> = {
  "--tradepro-shared-workspace-bg": "var(--tradepro-panel-frame-bg, var(--tradepro-panel-bg, #ffffff))",
  "--tradepro-shared-workspace-text": "var(--tradepro-panel-frame-text, var(--tradepro-panel-text, #0f172a))",
  // The scrollbar track belongs to the right workspace, not to a page card.
  // Keeping it as a live token prevents a Global Sync from leaving an older
  // page-specific (often light or orange) strip alongside the frame.
  "--tradepro-shared-workspace-scroll-track": "var(--tradepro-shared-workspace-bg, var(--tradepro-panel-frame-bg, var(--tradepro-panel-bg, #ffffff)))",
  // The thumb is a global frame control, so it follows the active action
  // colour rather than a route-owned panel palette.
  "--tradepro-shared-scrollbar-thumb": "var(--tradepro-panel-action-bg, #d94a87)",
  "--tradepro-shared-scrollbar-thumb-hover": "color-mix(in srgb, var(--tradepro-panel-action-bg, #d94a87) 82%, var(--tradepro-panel-frame-text, #0f172a))",
  "--tradepro-shared-topbar-bg": "var(--tradepro-client-topbar-bg, var(--tradepro-shell-from, #0f172a))",
  "--tradepro-shared-topbar-text": "var(--tradepro-client-topbar-text, var(--tradepro-shell-text, #ffffff))",
  "--tradepro-shared-topbar-border": "color-mix(in srgb, var(--tradepro-client-topbar-text, var(--tradepro-shell-text, #ffffff)) 18%, transparent)",
  "--tradepro-shared-title-bg": "var(--tradepro-panel-title-bg, #8e2e62)",
  "--tradepro-shared-title-text": "var(--tradepro-panel-title-text, #ffffff)",
  "--tradepro-shared-title-border": "color-mix(in srgb, var(--tradepro-panel-title-text, #ffffff) 22%, transparent)",
  "--tradepro-shared-table-header-bg": "var(--tradepro-panel-table-bg, #ffffff)",
  "--tradepro-shared-table-header-text": "var(--tradepro-panel-table-text, #0f172a)",
  "--tradepro-shared-table-header-border": "color-mix(in srgb, var(--tradepro-panel-table-text, #0f172a) 16%, transparent)",
  "--tradepro-shared-list-bg": "var(--tradepro-panel-list-bg, #ffffff)",
  "--tradepro-shared-list-text": "var(--tradepro-panel-list-text, #0f172a)",
  "--tradepro-shared-list-border": "color-mix(in srgb, var(--tradepro-panel-list-text, #0f172a) 16%, transparent)",
  "--tradepro-shared-footer-bg": "var(--tradepro-client-footer-bg, var(--tradepro-shell-to, #0f172a))",
  "--tradepro-shared-footer-text": "var(--tradepro-client-footer-text, var(--tradepro-shell-text, #ffffff))",
  "--tradepro-shared-footer-border": "color-mix(in srgb, var(--tradepro-client-footer-text, var(--tradepro-shell-text, #ffffff)) 18%, transparent)",
};

// Physical scrollport geometry is part of the Shared Variables shell, not a
// Card/Content decision.  Keep these defaults live even if an old saved
// global profile predates the Operations baseline.  An explicit current
// profile may still override them later in applyPageCssProfiles.
const OPERATIONS_SCROLLPORT_DEFAULTS: Record<string, string> = {
  "--tradepro-shared-list-scrollbar-lane": "14px",
  "--tradepro-shared-list-scroll-top-inset": "0.75rem",
  // The shared table shell never owns bottom runway.  Its one scroll owner
  // always keeps exactly 60px inside the content area, clear of the tailbar.
  "--tradepro-shared-list-scroll-end-space": "3.75rem",
};

/* Shared Variables owns these physical frame measurements.  Keep them in a
   migration map as well as the new-profile defaults: existing Global Sync
   records must learn the values instead of leaving routes to stylesheet
   fallbacks. */
const SHARED_STRUCTURE_VARIABLE_DEFAULTS: Record<string, string> = {
  // The topbar must share the exact physical line with the sidebar brand and
  // version area. The tailbar must share the same line as the sidebar switch
  // and collapse control. These are frame tokens, never page-local spacing.
  "--tradepro-shared-topbar-height": "62px",
  "--tradepro-shared-footer-height": "60px",
  // Sidebar labels remain configured navigation data. Their type scale is
  // shared frame chrome and must therefore survive Global Sync hydration.
  "--tradepro-shared-sidebar-text": "var(--tradepro-shell-text, #fff7fb)",
  "--tradepro-shared-sidebar-muted-text": "color-mix(in srgb, var(--tradepro-shell-text, #fff7fb) 72%, transparent)",
  "--tradepro-shared-sidebar-font-size": "0.8125rem",
  "--tradepro-shared-sidebar-child-font-size": "0.75rem",
  "--tradepro-shared-sidebar-line-height": "1.35",
  "--tradepro-shared-field-bg": "var(--tradepro-shared-workspace-bg, var(--tradepro-panel-bg, #ffffff))",
  "--tradepro-shared-workspace-scroll-track": "var(--tradepro-shared-workspace-bg, var(--tradepro-panel-frame-bg, var(--tradepro-panel-bg, #ffffff)))",
  "--tradepro-shared-scrollbar-thumb": "var(--tradepro-panel-action-bg, #d94a87)",
  "--tradepro-shared-scrollbar-thumb-hover": "color-mix(in srgb, var(--tradepro-panel-action-bg, #d94a87) 82%, var(--tradepro-panel-frame-text, #0f172a))",
  "--tradepro-shared-field-text": "var(--tradepro-shared-workspace-text, var(--tradepro-panel-text, #0f172a))",
  "--tradepro-shared-field-border": "var(--tradepro-shared-frame-border, color-mix(in srgb, var(--tradepro-panel-text, #0f172a) 26%, transparent))",
  "--tradepro-shared-field-height": "2.25rem",
  "--tradepro-shared-field-radius": "0.5rem",
  "--tradepro-shared-field-gap": "0.375rem",
  "--tradepro-shared-field-label-size": "0.75rem",
  "--tradepro-shared-field-label-weight": "600",
  "--tradepro-shared-field-font-size": "0.875rem",
  "--tradepro-shared-field-line-height": "1.35",
  "--tradepro-shared-table-header-edge-inset": "0.75rem",
  // Table-header geometry and typography are shared frame chrome. Persist
  // every value so old Global Sync records do not fall back to invalid CSS
  // declarations and stretch their controls to the full header height.
  "--tradepro-shared-table-header-frame-height": "3.875rem",
  "--tradepro-shared-table-header-height": "var(--tradepro-shared-table-header-frame-height, 3.875rem)",
  "--tradepro-shared-table-header-width": "100%",
  "--tradepro-shared-table-header-justify": "flex-start",
  "--tradepro-shared-table-header-align": "center",
  "--tradepro-shared-table-header-padding": "0.5rem 0.75rem",
  "--tradepro-shared-table-header-gap": "0.375rem",
  "--tradepro-shared-table-header-radius": "0.75rem",
  "--tradepro-shared-table-header-font-family": "var(--tradepro-global-font-family, inherit)",
  "--tradepro-shared-table-header-font-size": "0.875rem",
  "--tradepro-shared-table-header-font-weight": "400",
  "--tradepro-shared-table-header-line-height": "1.5",
  // Operations Market's theme bar and batch-selection bar are sibling
  // workspace controls.  These values are retained by “同步全局”, so HQ,
  // Agency Source and Client Source cannot gradually develop different gaps.
  "--tradepro-shared-operations-band-inline-inset": "0.75rem",
  "--tradepro-shared-operations-band-gap": "0.75rem",
  "--tradepro-shared-operations-band-border": "var(--tradepro-shared-table-header-border, color-mix(in srgb, var(--tradepro-panel-table-text) 16%, transparent))",
  "--tradepro-shared-title-inline-inset": "0px",
  // Title copy must keep the same breathing room from the workspace edge in
  // Headquarters, Agency Source and Client Source.  This used to be an
  // implicit client-only fallback, which left the two upstream sources one
  // token (4px) tighter after a Global Sync.
  "--tradepro-shared-title-padding": "0.875rem 1.25rem",
  // Dedicated and standard project titles share a fixed chrome boundary.
  // Keeping this separate from the old editable `auto` height avoids a
  // shorter title on routes such as 首页大图.
  "--tradepro-shared-title-frame-min-height": "5.3125rem",
  "--tradepro-shared-title-heading-size": "1.25rem",
  "--tradepro-shared-title-heading-line-height": "1.25",
  // Source-market headers continue into the theme band. Their lower corners
  // are therefore a shared straight edge, rather than a source-specific card
  // radius that can reappear after a Global Sync.
  "--tradepro-shared-title-bottom-radius": "0px",
  // The title and optional theme band form one continuous shared frame, with
  // one clear lower boundary before the table/header region.
  "--tradepro-shared-title-divider-width": "3px",
  // Kept independent from local palette text so each source renders one
  // consistent title-and-theme boundary.
  "--tradepro-shared-title-divider-color": "color-mix(in srgb, #2a1020 36%, transparent)",
  // A shared page frame is a structural boundary, not a floating dialog.
  // Dedicated workspaces already render flat, so standard project frames must
  // not retain an old right-side drop shadow.
  "--tradepro-shared-project-frame-shadow": "none",
  "--tradepro-shared-list-edge-inset": "0.75rem",
  "--tradepro-shared-list-gap": "0.75rem",
  "--tradepro-shared-list-padding": "0.75rem",
  "--tradepro-shared-list-scroll-top-inset": "0.75rem",
  "--tradepro-shared-list-scroll-end-space": "3.75rem",
  "--tradepro-shared-list-scrollbar-lane": "14px",
  "--tradepro-shared-list-scrollbar-gutter": "15px",
  // The table shell is one shared frame below a title band.  Keep the
  // physical shell geometry in the source profile so HQ, agency source and
  // client source cannot retain divergent route-local box spacing.
  "--tradepro-shared-table-shell-padding": "0.75rem",
  "--tradepro-shared-table-shell-bottom-radius": "var(--tradepro-layout-frame-radius, 1.5rem)",
  // Product Market is one shared engine across headquarters, agency source,
  // and client source.  Reserve enough width for drag/select/icon controls,
  // the full function title and its status capsule; narrower viewports still
  // fall back to one 100% column through the shared grid min() contract.
  "--tradepro-shared-product-market-card-min-width": "17rem",
  // Content-plugin geometry is shared by navigation and product rows.  Store
  // it with the frame profile so Global Sync also repairs old pages.
  "--tradepro-shared-plugin-control-size": "2rem",
  "--tradepro-shared-plugin-toggle-width": "2.75rem",
  "--tradepro-shared-plugin-icon-width": "5.625rem",
  "--tradepro-shared-plugin-gap": "0.5rem",
  "--tradepro-shared-plugin-section-gap": "1rem",
  // Responsive geometry remains source-scoped. It can rearrange the shared
  // frame, never business data, cards, materials or downstream custom content.
  "--tradepro-shared-responsive-copy-size": "clamp(0.6875rem, 1.2vw, 0.875rem)",
  "--tradepro-shared-responsive-control-gap": "0.5rem",
  "--tradepro-shared-responsive-panel-min": "18rem",
  "--tradepro-shared-action-bg": "var(--tradepro-panel-action-bg, #d94a87)",
  "--tradepro-shared-action-text": "var(--tradepro-panel-action-text, #ffffff)",
  "--tradepro-shared-action-border": "color-mix(in srgb, var(--tradepro-panel-action-text, #ffffff) 40%, transparent)",
};

const LEGACY_FIXED_PANEL_VARIABLES = [
  "--tradepro-panel-bg",
  "--tradepro-panel-text",
  "--tradepro-panel-title-bg",
  "--tradepro-panel-title-text",
  "--tradepro-panel-action-bg",
  "--tradepro-panel-action-text",
  "--tradepro-panel-card-bg",
  "--tradepro-panel-card-text",
  "--tradepro-panel-table-bg",
  "--tradepro-panel-table-text",
  "--tradepro-panel-list-bg",
  "--tradepro-panel-list-text",
];

/**
 * Profiles saved before H976 stored the active theme's resolved colours.
 * They were created by the default "当前默认设置" path and therefore blocked
 * later theme switches. A page framework must never own the global palette:
 * both legacy and formerly fixed layout profiles are normalized to the live
 * Layout Style tokens. Per-page Card/Content plans still retain structure,
 * card choices and plugins, but cannot freeze another page's workspace.
 */
function migrateLegacyLayoutThemeBinding(profile?: PageCssProfile) {
  if (!profile) return profile;
  const variables = { ...(profile.variables || {}), ...LIVE_THEME_LAYOUT_VARIABLES };
  LEGACY_FIXED_PANEL_VARIABLES.forEach((name) => delete variables[name]);
  return { ...profile, themeBinding: "live" as const, variables };
}

function hydrateSharedStructureVariables(profile?: PageCssProfile) {
  if (!profile) return profile;
  const storedVariables = profile.variables || {};
  if (!storedVariables["--tradepro-shared-topbar-bg"]) return profile;
  const variables = { ...storedVariables };
  // Remove the retired compact-card override instead of stacking another
  // route rule above it. The shared 17rem default is then written back once,
  // leaving no saved 14rem value for HQ, agency source or client source.
  const removedLegacyProductMarketCardWidth = variables["--tradepro-shared-product-market-card-min-width"] === "14rem";
  if (removedLegacyProductMarketCardWidth) delete variables["--tradepro-shared-product-market-card-min-width"];
  const hasMissingVariable = Object.keys(SHARED_STRUCTURE_VARIABLE_DEFAULTS)
    .some((name) => !variables[name]);
  const needsChromeAlignment =
    variables["--tradepro-shared-topbar-height"] === "3.5rem"
    || variables["--tradepro-shared-footer-height"] === "3rem";
  // 0px was the temporary divider-removal experiment. Restore the reviewed
  // three-pixel title-and-theme boundary for saved global profiles as well,
  // otherwise a prior browser record would silently override Shared Variables.
  const needsTitleDividerRestore = variables["--tradepro-shared-title-divider-width"] === "0px";
  if (!hasMissingVariable && !needsChromeAlignment && !needsTitleDividerRestore && !removedLegacyProductMarketCardWidth) return profile;
  return {
    ...profile,
    variables: {
      ...SHARED_STRUCTURE_VARIABLE_DEFAULTS,
      ...variables,
      ...(variables["--tradepro-shared-topbar-height"] === "3.5rem" ? { "--tradepro-shared-topbar-height": "62px" } : {}),
      ...(variables["--tradepro-shared-footer-height"] === "3rem" ? { "--tradepro-shared-footer-height": "60px" } : {}),
      ...(needsTitleDividerRestore ? { "--tradepro-shared-title-divider-width": "3px" } : {}),
    },
  };
}

function hydrateStoredSharedStructureVariables(profiles: StoredPageCssProfiles) {
  let changed = false;
  Object.values(profiles).forEach((entry) => {
    const hydrated = hydrateSharedStructureVariables(entry.layout);
    if (hydrated !== entry.layout) {
      entry.layout = hydrated;
      changed = true;
    }
  });
  return changed;
}

/**
 * Global Sync is intentionally limited to frame chrome.  Older global
 * records could retain page columns, card plugins or table/list plans because
 * they were generated from the full page profile.  Normalize them on read so
 * a pre-existing record cannot overwrite a page-owned Card/Content design.
 */
function sanitizeGlobalChromeProfile(profile?: PageCssProfile) {
  if (!profile) return profile;
  const variables = { ...(profile.variables || {}) };
  Object.keys(variables).forEach((name) => {
    if (
      name.startsWith("--tradepro-page-")
      || (name.startsWith("--tradepro-shared-table-header-") && !GLOBAL_SURFACE_VARIABLE_NAMES.has(name))
      || (name.startsWith("--tradepro-shared-list-")
        && name !== "--tradepro-shared-list-edge-inset"
        && !GLOBAL_SURFACE_VARIABLE_NAMES.has(name)
        && !name.startsWith("--tradepro-shared-list-scroll-"))
      || name.startsWith("--tradepro-panel-table-")
      || name.startsWith("--tradepro-panel-card-")
      || name.startsWith("--tradepro-panel-list-")
    ) {
      delete variables[name];
    }
  });
  const chromeSections = new Set<string>([...GLOBAL_FRAME_STYLE_SECTION_KEYS, "tableHeader", "list"]);
  const sharedFrame = Object.fromEntries(
    Object.entries(profile.sharedFrame || {}).filter(([section]) => chromeSections.has(section)),
  ) as PageCssProfile["sharedFrame"];
  return hydrateGlobalSurfaceProfile({
    ...profile,
    // The layout plugin is part of a page plan, never a cross-page frame token.
    layoutPlugin: undefined,
    variables,
    sharedFrame,
  });
}

const PAGE_CONTENT_VARIABLE_PREFIXES = [
  "--tradepro-page-",
  "--tradepro-shared-",
  "--tradepro-panel-",
] as const;

/**
 * Content Design persists only structural presentation tokens. Business
 * values, form fields, records and downstream-created content never enter
 * this profile, so copying a plan cannot overwrite them.
 */
function sanitizePageContentProfile(profile: PageCssProfile): PageCssProfile {
  const variables = Object.fromEntries(
    Object.entries(profile.variables || {}).filter(([name]) =>
      PAGE_CONTENT_VARIABLE_PREFIXES.some((prefix) => name.startsWith(prefix)),
    ),
  );
  return { ...profile, variables };
}

function buildDefaultProductMarketLayoutProfile(pathname: string): PageCssProfile | undefined {
  if (!pathname.endsWith("/product-market")) return undefined;

  return {
    appliedAt: "built-in",
    updatedAt: 0,
    source: "development-standard",
    themeBinding: "live",
    // 运营市场 is the reviewed source of truth for the shared shell. This
    // metadata must never turn a global update into a table/card overwrite.
    frameBaseline: "operations",
    summary: "运营市场主框架基线：同步全局只共享主体、顶部、标题、右侧滚动栏与尾栏。",
    layoutPlugin: "navigation-frame",
    variables: {
      "--tradepro-shared-topbar-bg": "var(--tradepro-client-topbar-bg, var(--tradepro-shell-from))",
      "--tradepro-shared-topbar-text": "var(--tradepro-client-topbar-text, var(--tradepro-shell-text))",
      "--tradepro-shared-title-bg": "var(--tradepro-panel-title-bg)",
      "--tradepro-shared-title-text": "var(--tradepro-panel-title-text)",
      "--tradepro-shared-table-header-bg": "var(--tradepro-panel-table-bg)",
      "--tradepro-shared-table-header-text": "var(--tradepro-panel-table-text)",
      "--tradepro-shared-list-bg": "var(--tradepro-panel-list-bg)",
      "--tradepro-shared-list-text": "var(--tradepro-panel-list-text)",
      "--tradepro-shared-footer-bg": "var(--tradepro-client-footer-bg, var(--tradepro-shell-to))",
      "--tradepro-shared-footer-text": "var(--tradepro-client-footer-text, var(--tradepro-shell-text))",
      // Every one of the Product Market tabs, Navigation Customization, and
      // Site Settings consumes this same structural trio. Persist it in the
      // default profile rather than relying on a stylesheet fallback so a
      // Global Sync is inspectable and reproducible on every route.
      "--tradepro-shared-workspace-bg": "var(--tradepro-panel-frame-bg, var(--tradepro-panel-bg, #ffffff))",
      "--tradepro-shared-workspace-text": "var(--tradepro-panel-frame-text, var(--tradepro-panel-text, #0f172a))",
      "--tradepro-shared-workspace-scroll-track": "var(--tradepro-shared-workspace-bg, var(--tradepro-panel-frame-bg, var(--tradepro-panel-bg, #ffffff)))",
      "--tradepro-shared-scrollbar-thumb": "var(--tradepro-panel-action-bg, #d94a87)",
      "--tradepro-shared-scrollbar-thumb-hover": "color-mix(in srgb, var(--tradepro-panel-action-bg, #d94a87) 82%, var(--tradepro-panel-frame-text, #0f172a))",
      "--tradepro-shared-sidebar-text": "var(--tradepro-shell-text, #fff7fb)",
      "--tradepro-shared-sidebar-muted-text": "color-mix(in srgb, var(--tradepro-shell-text, #fff7fb) 72%, transparent)",
      "--tradepro-shared-sidebar-font-size": "0.8125rem",
      "--tradepro-shared-sidebar-child-font-size": "0.75rem",
      "--tradepro-shared-sidebar-line-height": "1.35",
      "--tradepro-shared-field-bg": "var(--tradepro-shared-workspace-bg, var(--tradepro-panel-bg, #ffffff))",
      "--tradepro-shared-field-text": "var(--tradepro-shared-workspace-text, var(--tradepro-panel-text, #0f172a))",
      "--tradepro-shared-field-border": "var(--tradepro-shared-frame-border, color-mix(in srgb, var(--tradepro-panel-text, #0f172a) 26%, transparent))",
      "--tradepro-shared-field-height": "2.25rem",
      "--tradepro-shared-field-radius": "0.5rem",
      "--tradepro-shared-field-gap": "0.375rem",
      "--tradepro-shared-field-label-size": "0.75rem",
      "--tradepro-shared-field-label-weight": "600",
      "--tradepro-shared-field-font-size": "0.875rem",
      "--tradepro-shared-field-line-height": "1.35",
      "--tradepro-shared-frame-border": "color-mix(in srgb, var(--tradepro-panel-text) 26%, transparent)",
      "--tradepro-shared-topbar-height": "62px",
      "--tradepro-shared-footer-height": "60px",
      "--tradepro-shared-frame-gap": "0.75rem",
      "--tradepro-shared-shell-inline-gap": "1.5rem",
      "--tradepro-shared-title-to-card-gap": "0.75rem",
      "--tradepro-shared-title-description-gap": "0.5rem",
      "--tradepro-shared-title-path-font-size": "1.25rem",
      "--tradepro-shared-title-path-line-height": "1.25",
  "--tradepro-shared-title-description-font-size": "0.75rem",
  "--tradepro-shared-title-description-line-height": "1.25rem",
  // A title belongs to the shared workspace edge.  Route wrappers may add
  // their own card gutters below it, but must never shift or overflow the
  // title frame itself.
  "--tradepro-shared-title-inline-inset": "0px",
  "--tradepro-shared-title-padding": "0.875rem 1.25rem",
  "--tradepro-shared-title-frame-min-height": "5.3125rem",
  "--tradepro-shared-title-heading-size": "1.25rem",
  "--tradepro-shared-title-heading-line-height": "1.25",
  "--tradepro-shared-title-icon-size": "1.375rem",
  "--tradepro-shared-title-bottom-radius": "0px",
  "--tradepro-shared-title-divider-width": "3px",
  "--tradepro-shared-title-divider-color": "color-mix(in srgb, #2a1020 36%, transparent)",
  "--tradepro-shared-project-frame-shadow": "none",
  "--tradepro-shared-content-gutter": "0.75rem",
      "--tradepro-shared-card-edge-inset": "0.75rem",
      "--tradepro-shared-table-header-edge-inset": "0.75rem",
      "--tradepro-shared-table-header-frame-height": "3.875rem",
      "--tradepro-shared-table-header-height": "var(--tradepro-shared-table-header-frame-height, 3.875rem)",
      "--tradepro-shared-table-header-width": "100%",
      "--tradepro-shared-table-header-justify": "flex-start",
      "--tradepro-shared-table-header-align": "center",
      "--tradepro-shared-table-header-padding": "0.5rem 0.75rem",
      "--tradepro-shared-table-header-gap": "0.375rem",
      "--tradepro-shared-table-header-radius": "0.75rem",
      "--tradepro-shared-table-header-font-family": "var(--tradepro-global-font-family, inherit)",
      "--tradepro-shared-table-header-font-size": "0.875rem",
      "--tradepro-shared-table-header-font-weight": "400",
      "--tradepro-shared-table-header-line-height": "1.5",
      "--tradepro-shared-operations-band-inline-inset": "0.75rem",
      "--tradepro-shared-operations-band-gap": "0.75rem",
      "--tradepro-shared-operations-band-border": "var(--tradepro-shared-table-header-border, color-mix(in srgb, var(--tradepro-panel-table-text) 16%, transparent))",
      "--tradepro-shared-list-edge-inset": "0.75rem",
      "--tradepro-shared-list-gap": "0.75rem",
      "--tradepro-shared-list-padding": "0.75rem",
      "--tradepro-shared-list-width": "100%",
      "--tradepro-shared-list-height": "100%",
      "--tradepro-shared-list-columns": "4",
      "--tradepro-shared-product-market-card-min-width": "17rem",
      "--tradepro-shared-list-scroll-top-inset": "0.75rem",
      "--tradepro-shared-list-scrollbar-lane": "14px",
      // Chromium reserves a 15px stable gutter for a 14px painted scrollbar.
      // Keep the physical reservation explicit so page-level headers and cards
      // can align without browser-specific one-pixel corrections.
      "--tradepro-shared-list-scrollbar-gutter": "15px",
      "--tradepro-shared-list-scroll-end-space": "3.75rem",
      "--tradepro-shared-plugin-control-size": "2rem",
      "--tradepro-shared-plugin-toggle-width": "2.75rem",
      "--tradepro-shared-plugin-icon-width": "5.625rem",
      "--tradepro-shared-plugin-gap": "0.5rem",
      "--tradepro-shared-plugin-section-gap": "1rem",
    },
    sharedFrame: {
      topbar: { enabled: true, background: true, text: true, capsules: false, frame3d: false },
      title: { enabled: true, background: true, text: true, capsules: false, frame3d: true },
      tableHeader: { enabled: true, background: true, text: true, capsules: true, frame3d: true },
      list: { enabled: true, background: true, text: true, capsules: true, frame3d: false },
      footer: { enabled: true, background: true, text: true, capsules: true, frame3d: false },
    },
  };
}

function buildDefaultSharedFrameProfile(
  layoutPlugin: "shared-frame" | "navigation-frame",
  summary: string,
): PageCssProfile | undefined {
  const baseProfile = buildDefaultProductMarketLayoutProfile("/product-market");
  if (!baseProfile) return undefined;
  return {
    ...baseProfile,
    summary,
    layoutPlugin,
  };
}

function buildDefaultProjectLayoutProfile(pathname: string, search = ""): PageCssProfile | undefined {
  if (pathname.endsWith("/product-market")) return buildDefaultProductMarketLayoutProfile(pathname);

  if (pathname.endsWith("/social")) {
    return buildDefaultSharedFrameProfile(
      "shared-frame",
      "社交媒体九个业务工作区默认接入同步全局共用框架。",
    );
  }

  const tab = new URLSearchParams(search).get("tab");
  if (pathname.endsWith("/company-info")) {
    const companyInfoSummaries: Record<string, string> = {
      navigation: "导航栏自定义默认接入同步全局共用框架。",
      banner: "首页 Banner 默认接入同步全局共用框架。",
      recommend: "产品推荐默认接入同步全局共用框架。",
      // 自定模块与首页大图共用表头、列表滚动容器和内容插件合同；必须
      // 接入同一默认框架，否则路由切换后会回落到旧的 16px 表格样式。
      modules: "自定模块默认接入首页大图同一套同步全局共用框架。",
    };
    if (tab && companyInfoSummaries[tab]) {
      return buildDefaultSharedFrameProfile("navigation-frame", companyInfoSummaries[tab]);
    }
  }

  if (pathname.endsWith("/site-settings")) {
    return buildDefaultSharedFrameProfile("shared-frame", "站点设置默认接入同步全局共用框架。");
  }

  if (pathname.endsWith("/customers") && (!tab || tab === "summary")) {
    return buildDefaultSharedFrameProfile("shared-frame", "CRM 工作汇总默认接入同步全局共用框架。");
  }

  const factoryPage = findPageFactoryPage(pathname, search);
  if (factoryPage && (factoryPage.status === "complete" || factoryPage.status === "pilot-complete")) {
    return buildDefaultSharedFrameProfile(
      "shared-frame",
      `页面工厂 ${factoryPage.factoryDefaultVersion}：${factoryPage.label} 自动接入三端普通项目页共享框架。`,
    );
  }

  return undefined;
}

export function resolvePageCssProfileKey(pathname: string, search = "") {
  return `${pathname || "/"}${search || ""}`;
}

function resolvePageCssProfileScopeKey(pathname: string, search = "") {
  const params = new URLSearchParams(search);
  params.delete("tab");
  const normalizedSearch = params.toString();
  return `${pathname || "/"}${normalizedSearch ? `?${normalizedSearch}` : ""}`;
}

/**
 * A tab identifies an actual page in the client workspace.  Shared Variables
 * has its own explicit global profile, so Card/Content plans must never use a
 * tab-less fallback: doing so would make a Banner or domain plan reappear on
 * its sibling page after refresh, apply or restore.
 */
function mayUseRouteScopeProfile(search = "") {
  return !new URLSearchParams(search).has("tab");
}

function isSiteSettingsRoute(pathname: string) {
  return pathname.includes("/site-settings");
}

function isNavigationCustomizationRoute(pathname: string, search = "") {
  return pathname.endsWith("/company-info") && new URLSearchParams(search).get("tab") === "navigation";
}

function isCompanyInfoSharedWorkspaceRoute(pathname: string, search = "") {
  if (!pathname.endsWith("/company-info")) return false;
  return ["navigation", "banner", "recommend", "modules"].includes(new URLSearchParams(search).get("tab") || "");
}

function readProfiles(): StoredPageCssProfiles {
  if (typeof window === "undefined") return {};

  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function writeProfiles(profiles: StoredPageCssProfiles) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  window.dispatchEvent(new CustomEvent(PAGE_CSS_PROFILE_EVENT));
}

export function readPageCssProfiles(pathname: string, search = "") {
  return readProfiles()[resolvePageCssProfileKey(pathname, search)] || {};
}

/** Exposes only the reviewed Shared Variables profile for conflict reporting.
 * It is read-only: page workbenches can explain a local override without
 * gaining another path to write global configuration. */
export function readGlobalPageLayoutCssProfile(pathname?: string) {
  const profiles = readProfiles();
  const scope = resolveGlobalLayoutScope(pathname);
  const scopedProfile = profiles[resolveGlobalLayoutProfileKey(pathname)]?.layout;
  // Existing client-source records used one browser-wide key. Keep that
  // record as a read-only fallback until the corresponding source saves its
  // next Global Sync, so upgrades never make a previously styled page flash
  // back to defaults.
  return scopedProfile || (scope === "client" || scope === "client-source" ? profiles[GLOBAL_LAYOUT_PROFILE_KEY]?.layout : undefined);
}

/**
 * Returns the profile that is actually controlling a route after the current
 * page, route scope and global chrome profiles have been merged.  The layout
 * developer uses this to keep its live preview and parameters honest after an
 * apply, restore or global synchronization action.
 */
export function readEffectivePageLayoutCssProfile(pathname: string, search = "") {
  return resolveLayoutProfile(readProfiles(), pathname, search) || buildDefaultProjectLayoutProfile(pathname, search);
}

function resolveLayoutProfile(profiles: StoredPageCssProfiles, pathname: string, search = "") {
  const key = resolvePageCssProfileKey(pathname, search);
  // H968 tightens the shared title path-to-description rhythm from the old
  // system default 10px to 8px. Apply the compatibility upgrade before
  // resolving either a global or legacy route profile, otherwise a previously
  // saved Navigation Customization profile can keep overriding Global Sync.
  const tightenLegacyTitleDescriptionGap = (profile?: PageCssProfile) =>
    profile?.variables?.["--tradepro-shared-title-description-gap"] === "0.625rem"
      ? {
        ...profile,
        variables: {
          ...profile.variables,
          "--tradepro-shared-title-description-gap": "0.5rem",
        },
      }
      : profile;
  const normalizeProfile = (profile?: PageCssProfile) => hydrateSharedStructureVariables(
    migrateLegacyLayoutThemeBinding(tightenLegacyTitleDescriptionGap(profile))
  );
  const exactProfile = normalizeProfile(profiles[key]?.layout);
  const scopeKey = resolvePageCssProfileScopeKey(pathname, search);
  const scopedProfile = mayUseRouteScopeProfile(search)
    ? normalizeProfile(profiles[scopeKey]?.layout)
    : undefined;
  const sourceScope = resolveGlobalLayoutScope(pathname);
  const globalProfile = sanitizeGlobalChromeProfile(
    normalizeProfile(
      profiles[resolveGlobalLayoutProfileKey(pathname)]?.layout
      || (sourceScope === "client" || sourceScope === "client-source" ? profiles[GLOBAL_LAYOUT_PROFILE_KEY]?.layout : undefined),
    ),
  );

  // The shared-variable action publishes common chrome plus the universal
  // scrollport contract. Merge those into page plans without replacing the
  // table/list/card rules owned by Card/Content Design.
  const isGlobalChromeOnly = Boolean(globalProfile) &&
    !Object.keys(globalProfile?.variables || {}).some(
      (name) =>
        (name.startsWith("--tradepro-shared-table-header-") && !GLOBAL_SURFACE_VARIABLE_NAMES.has(name)) ||
        (name.startsWith("--tradepro-shared-list-")
          && name !== "--tradepro-shared-list-edge-inset"
          && !GLOBAL_SURFACE_VARIABLE_NAMES.has(name)
          && !name.startsWith("--tradepro-shared-list-scroll-"))
    );
  const mergeGlobalChrome = (pageProfile?: PageCssProfile) => {
    if (!globalProfile) return pageProfile;
    if (!pageProfile || !isGlobalChromeOnly) return globalProfile;
    return {
      ...pageProfile,
      ...globalProfile,
      layoutPlugin: pageProfile.layoutPlugin || globalProfile.layoutPlugin,
      variables: { ...(pageProfile.variables || {}), ...(globalProfile.variables || {}) },
      sharedFrame: { ...(pageProfile.sharedFrame || {}), ...(globalProfile.sharedFrame || {}) },
    };
  };

  // A global apply must reach every existing project page.  Older per-page
  // plans predate the revision field, so they are treated as older than the
  // newly saved global plan.  A page plan saved afterwards remains a genuine
  // explicit override for that one route.
  const pageProfile = exactProfile || scopedProfile;
  if (isGlobalChromeOnly) return mergeGlobalChrome(pageProfile);

  if (globalProfile && (globalProfile.updatedAt ?? Number.MAX_SAFE_INTEGER) >= (pageProfile?.updatedAt ?? 0)) {
    return globalProfile;
  }

  if (exactProfile) return exactProfile;

  if (scopedProfile && mayUseRouteScopeProfile(search)) {
    return scopedProfile;
  }
  if (globalProfile) return globalProfile;

  // Backward compatibility for complete-frame profiles saved before scope sharing.
  if (!mayUseRouteScopeProfile(search)) return exactProfile;

  return Object.entries(profiles).find(([candidateKey, candidate]) => {
    const separatorIndex = candidateKey.indexOf("?");
    const candidatePathname = separatorIndex === -1 ? candidateKey : candidateKey.slice(0, separatorIndex);
    const candidateSearch = separatorIndex === -1 ? "" : candidateKey.slice(separatorIndex);
    return (
      candidatePathname === (pathname || "/") &&
      resolvePageCssProfileScopeKey(candidatePathname, candidateSearch) === scopeKey &&
      candidate.layout?.layoutPlugin === "navigation-frame"
    );
  })?.[1].layout || exactProfile;
}

function clearLegacyLockedPageVisualSnapshots() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LOCKED_VISUAL_SNAPSHOTS_STORAGE_KEY);
}

function readRestorePoints(): PageLayoutRestorePoint[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RESTORE_POINT_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((point): point is PageLayoutRestorePoint => Boolean(
      point && typeof point === "object" && (point.scope === "page" || point.scope === "global") && typeof point.routeKey === "string",
    ));
  } catch {
    return [];
  }
}

function writeRestorePoints(points: PageLayoutRestorePoint[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RESTORE_POINT_STORAGE_KEY, JSON.stringify(points.slice(0, RESTORE_POINT_LIMIT)));
}

function captureRestorePoint(scope: PageLayoutRestorePoint["scope"], routeKey: string, profile?: PageCssProfile) {
  const point: PageLayoutRestorePoint = {
    id: `${scope}-${Date.now()}`,
    scope,
    routeKey,
    createdAt: new Date().toLocaleString("zh-CN"),
    profile: profile ? { ...profile, variables: { ...(profile.variables || {}) }, sharedFrame: { ...(profile.sharedFrame || {}) } } : undefined,
  };
  writeRestorePoints([point, ...readRestorePoints()]);
  return point;
}

/** Capture the exact prior per-page frame before an explicit apply or restore. */
export function capturePageLayoutRestorePoint(pathname: string, search = "") {
  const profiles = readProfiles();
  const key = resolvePageCssProfileKey(pathname, search);
  return captureRestorePoint("page", key, profiles[key]?.layout);
}

/** Capture the prior global shared frame before Global Sync replaces it. */
export function captureGlobalLayoutRestorePoint(pathname?: string) {
  const profiles = readProfiles();
  const scope = resolveGlobalLayoutScope(pathname);
  const key = resolveGlobalLayoutProfileKey(pathname);
  return captureRestorePoint("global", key, profiles[key]?.layout || (scope === "client" || scope === "client-source" ? profiles[GLOBAL_LAYOUT_PROFILE_KEY]?.layout : undefined));
}

export function hasPageLayoutRestorePoint(pathname: string, search = "") {
  const key = resolvePageCssProfileKey(pathname, search);
  return readRestorePoints().some((point) => point.scope === "page" && point.routeKey === key);
}

export function hasGlobalLayoutRestorePoint(pathname?: string) {
  const key = resolveGlobalLayoutProfileKey(pathname);
  return readRestorePoints().some((point) => point.scope === "global" && point.routeKey === key);
}

/** Restore the newest checkpoint. A blank checkpoint removes the later override. */
export function restoreLatestPageLayoutRestorePoint(pathname: string, search = "") {
  if (isRouteCompletedLayoutLocked(pathname, search)) return false;
  const key = resolvePageCssProfileKey(pathname, search);
  const point = readRestorePoints().find((candidate) => candidate.scope === "page" && candidate.routeKey === key);
  return restorePageLayoutRestorePointById(point?.id || "", pathname, search);
}

/** Restores the selected page checkpoint only; other routes and business data stay untouched. */
export function restorePageLayoutRestorePointById(id: string, pathname: string, search = "") {
  if (isRouteCompletedLayoutLocked(pathname, search)) return false;
  const key = resolvePageCssProfileKey(pathname, search);
  const point = readRestorePoints().find((candidate) => candidate.id === id && candidate.scope === "page" && candidate.routeKey === key);
  if (!point) return false;
  const profiles = readProfiles();
  if (point.profile) profiles[key] = { ...profiles[key], layout: hydrateSharedStructureVariables({ ...point.profile, updatedAt: Date.now() }) };
  else {
    delete profiles[key]?.layout;
    if (profiles[key]) delete profiles[key];
  }
  writeProfiles(profiles);
  return true;
}

export function restoreLatestGlobalLayoutRestorePoint(pathname?: string) {
  const key = resolveGlobalLayoutProfileKey(pathname);
  const point = readRestorePoints().find((candidate) => candidate.scope === "global" && candidate.routeKey === key);
  return restoreGlobalLayoutRestorePointById(point?.id || "", pathname);
}

/** Restores the selected source-scope checkpoint only; no page-owned data is read or written. */
export function restoreGlobalLayoutRestorePointById(id: string, pathname?: string) {
  const key = resolveGlobalLayoutProfileKey(pathname);
  const point = readRestorePoints().find((candidate) => candidate.id === id && candidate.scope === "global" && candidate.routeKey === key);
  if (!point) return false;
  const profiles = readProfiles();
  if (point.profile) profiles[key] = { ...profiles[key], layout: hydrateGlobalSurfaceProfile(hydrateSharedStructureVariables({ ...point.profile, updatedAt: Date.now() })) };
  else delete profiles[key];
  writeProfiles(profiles);
  return true;
}

export function savePageLayoutCssProfile(pathname: string, search: string, profile: PageCssProfile) {
  if (isRouteCompletedLayoutLocked(pathname, search)) return;

  const profiles = readProfiles();
  const key = resolvePageCssProfileKey(pathname, search);
  const pageProfile = hydrateSharedStructureVariables({ ...sanitizePageContentProfile(profile), updatedAt: Date.now() })!;
  profiles[key] = { ...profiles[key], layout: pageProfile };
  const scopeKey = resolvePageCssProfileScopeKey(pathname, search);
  if (mayUseRouteScopeProfile(search) && scopeKey !== key) {
    profiles[scopeKey] = { ...profiles[scopeKey], layout: pageProfile };
  }
  writeProfiles(profiles);
}

export function saveGlobalPageLayoutCssProfile(profile: PageCssProfile, pathname?: string) {
  const profiles = readProfiles();
  const key = resolveGlobalLayoutProfileKey(pathname);
  profiles[key] = {
    ...profiles[key],
    layout: hydrateGlobalSurfaceProfile(hydrateSharedStructureVariables({ ...profile, updatedAt: Date.now() })),
  };
  writeProfiles(profiles);
}

export function removePageLayoutCssProfile(pathname: string, search = "") {
  if (isRouteCompletedLayoutLocked(pathname, search)) return;

  const profiles = readProfiles();
  const key = resolvePageCssProfileKey(pathname, search);
  const removedProfile = profiles[key]?.layout;
  if (!removedProfile) return;
  delete profiles[key].layout;
  delete profiles[key];
  const scopeKey = resolvePageCssProfileScopeKey(pathname, search);
  if (
    mayUseRouteScopeProfile(search) &&
    scopeKey !== key &&
    profiles[scopeKey]?.layout?.appliedAt === removedProfile.appliedAt
  ) {
    delete profiles[scopeKey].layout;
    delete profiles[scopeKey];
  }
  writeProfiles(profiles);
}

export function hasPageLayoutCssProfile(pathname: string, search = "") {
  const profiles = readProfiles();
  const key = resolvePageCssProfileKey(pathname, search);
  const scopeKey = resolvePageCssProfileScopeKey(pathname, search);
  return Boolean(profiles[key]?.layout || (mayUseRouteScopeProfile(search) && profiles[scopeKey]?.layout));
}

export function applyPageCssProfiles(
  pathname: string,
  search: string,
  baseVariables: Record<string, string>,
) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const profiles = readProfiles();
  // H989 compatibility upgrade: write missing shared geometry into existing
  // records once, so applying or syncing a page exposes real Shared Variables
  // rather than relying only on CSS fallback values.
  if (hydrateStoredSharedStructureVariables(profiles)) writeProfiles(profiles);
  const completedLayoutLocked = isRouteCompletedLayoutLocked(pathname, search);
  // A lock may preserve the page's Card/Content save state, but it must never
  // preserve resolved palette values.  Global Sync and Layout Style are live
  // inputs for every route, including the six protected reference pages.
  clearLegacyLockedPageVisualSnapshots();
  const layoutProfile = resolveLayoutProfile(profiles, pathname, search)
    || buildDefaultProjectLayoutProfile(pathname, search);
  const baseVariablesToApply = { ...OPERATIONS_SCROLLPORT_DEFAULTS, ...baseVariables };
  const variables = layoutProfile?.variables || {};
  const appliedVariables = isSiteSettingsRoute(pathname)
    ? Object.fromEntries(
        Object.entries(variables).filter(
          ([name]) => name !== "--tradepro-panel-bg" && name !== "--tradepro-panel-text"
        )
      )
    : variables;
  const sharedFrame = layoutProfile?.sharedFrame || {};
  // These tabs retain the early standard management layout even when an older
  // navigation-frame profile remains in local storage.
  const layoutPlugin = isSiteSettingsRoute(pathname)
    ? "shared-frame"
    : layoutProfile?.layoutPlugin || (isCompanyInfoSharedWorkspaceRoute(pathname, search) ? "navigation-frame" : undefined);

  // A route can switch from a richer profile to the global chrome-only profile
  // during the same session. Remove prior runtime layout tokens first, so a
  // former table/list setting cannot leak into the next page.
  Array.from(root.style)
    .filter((name) => name.startsWith("--tradepro-page-") || name.startsWith("--tradepro-shared-"))
    .forEach((name) => root.style.removeProperty(name));

  Object.entries(baseVariablesToApply).forEach(([name, value]) => root.style.setProperty(name, value));
  Object.entries(appliedVariables).forEach(([name, value]) => root.style.setProperty(name, value));

  if (layoutProfile) {
    root.dataset.tradeproPageLayout = "active";
    root.dataset.tradeproPageLayoutStyle = variables["--tradepro-page-list-style"] || "hybrid";
    root.dataset.tradeproPageTopbarStyle = variables["--tradepro-page-topbar-style"] || "navigation";
    root.dataset.tradeproPageTableStyle = variables["--tradepro-page-table-style"] || "merged";
    // Keep the complete Card/Content selection available to shared CSS.  The
    // first item remains the primary structural choice; later items are
    // additive choices (for example a card grid plus a compact service row).
    // Whitespace-separated values make the stack safe to target with the
    // standard CSS ~= selector without leaking it to another route.
    root.dataset.tradeproPageTableStack = (variables["--tradepro-page-table-stack"] || root.dataset.tradeproPageTableStyle)
      .split(",")
      .filter(Boolean)
      .join(" ");
    root.dataset.tradeproPageListStack = (variables["--tradepro-page-list-stack"] || root.dataset.tradeproPageLayoutStyle)
      .split(",")
      .filter(Boolean)
      .join(" ");
    if (layoutPlugin) root.dataset.tradeproPageLayoutPlugin = layoutPlugin;
    else delete root.dataset.tradeproPageLayoutPlugin;
  } else {
    delete root.dataset.tradeproPageLayout;
    delete root.dataset.tradeproPageLayoutStyle;
    delete root.dataset.tradeproPageTopbarStyle;
    delete root.dataset.tradeproPageTableStyle;
    delete root.dataset.tradeproPageTableStack;
    delete root.dataset.tradeproPageListStack;
    delete root.dataset.tradeproPageLayoutPlugin;
  }

  // Never publish a half-active Shared Variables state. Factory pages receive
  // a complete code-owned profile; legacy/unregistered pages stay untouched
  // until their own contract is ready. Diagnostics and release gates consume
  // the explicit integrity state below.
  const missingSharedFrameVariables = layoutProfile
    ? REQUIRED_SHARED_FRAME_VARIABLES.filter((name) => !root.style.getPropertyValue(name).trim())
    : [];
  if (layoutProfile && missingSharedFrameVariables.length === 0) {
    root.dataset.tradeproPageSharedVariables = "true";
    root.dataset.tradeproPageSharedVariablesIntegrity = "complete";
  } else {
    delete root.dataset.tradeproPageSharedVariables;
    root.dataset.tradeproPageSharedVariablesIntegrity = layoutProfile ? "incomplete" : "not-required";
  }
  if (missingSharedFrameVariables.length) {
    root.dataset.tradeproPageSharedVariablesMissing = missingSharedFrameVariables.join(",");
  } else {
    delete root.dataset.tradeproPageSharedVariablesMissing;
  }

  if (isNavigationCustomizationRoute(pathname, search) && variables["--tradepro-shared-topbar-bg"]) {
    root.dataset.tradeproPageSharedPreviewMode = "markers-only";
  } else {
    delete root.dataset.tradeproPageSharedPreviewMode;
  }

  // Shared Variables owns the visual contract. Table header and content are
  // included as style-only members: their palette and spacing can synchronize,
  // while columns, records and plugins remain page-owned and are never promoted
  // to root-level shared state. The storage key "list" is the legacy runtime
  // name for the contract's visible "content" section.
  const sharedSections = ["topbar", "title", "tableHeader", "list", "footer"];
  sharedSections.forEach((section) => {
    const config = sharedFrame[section];
    const key = `tradeproPageShared${section.charAt(0).toUpperCase()}${section.slice(1)}`;
    if (config?.enabled) {
      root.dataset[key] = "true";
      root.dataset[`${key}Background`] = String(config.background);
      root.dataset[`${key}Text`] = String(config.text);
      root.dataset[`${key}Capsules`] = String(config.capsules);
      root.dataset[`${key}Frame3d`] = String(config.frame3d);
    } else {
      delete root.dataset[key];
      delete root.dataset[`${key}Background`];
      delete root.dataset[`${key}Text`];
      delete root.dataset[`${key}Capsules`];
      delete root.dataset[`${key}Frame3d`];
    }
  });

  // Registered content plugins are page-scoped additions layered over the selected
  // base framework.  Keep their flags explicit so a later route cannot inherit
  // hover, density, split-column, scroll, or individual navigation-control
  // behavior by accident. Keep the legacy combined key only to clear it.
  (["hover", "compact", "split", "scroll", "drag", "move", "toggle", "icon", "delete", "navigation"] as const).forEach((plugin) => {
    const datasetKey = `tradeproPageContentPlugin${plugin.charAt(0).toUpperCase()}${plugin.slice(1)}`;
    if (variables[`--tradepro-page-content-plugin-${plugin}`] === "true") {
      root.dataset[datasetKey] = "true";
    } else {
      delete root.dataset[datasetKey];
    }
  });

  if (completedLayoutLocked) {
    root.dataset.tradeproCompletedLayoutLocked = "true";
  } else {
    delete root.dataset.tradeproCompletedLayoutLocked;
  }

  if (isCompletedLayoutLocked("project-dialogs")) {
    root.dataset.tradeproProjectDialogsLocked = "true";
  } else {
    delete root.dataset.tradeproProjectDialogsLocked;
  }
}
