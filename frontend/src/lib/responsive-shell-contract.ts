import { PRODUCT_MARKET_SHARED_CATEGORY_CONTRACT } from "./product-market-category-contract";

/**
 * Code-owned factory defaults for the three source shells. These values are
 * deliberately not page preferences: a page must never be able to hide both
 * its fixed navigation and the drawer trigger after a local visual save.
 */
export const RESPONSIVE_CAPACITY_LAYOUT_FACTORY_DEFAULT = {
  strategy: "container-capacity-first",
  plugin: "shared-capacity-flow-v1",
  rowPolicy: "single-line>fluid-shrink>secondary-copy-yield>intrinsic-wrap",
  gridPolicy: "auto-fit-by-own-container",
  rowMinimumContent: 112,
  rowGap: 8,
  cardMinimum: 272,
  expertInlineMinimum: 352,
  measurementTolerance: 1,
  moduleEditor: {
    plugin: "shared-module-editor-capacity-v5",
    mediumInlineMinimum: 480,
    twoFieldMinimum: 432,
    extremeStackMaximum: 351,
    desktopSplitMinimum: 1024,
    policy: "one-card-boundary>real-control-affordance>flat-hierarchy-segments>compact-groups>whole-group-wrap>extreme-equal-status-row",
  },
  moduleCategory: {
    plugin: "shared-module-category-capacity-v2",
    inlineFixedMinimum: 352,
    inlineReorderMinimum: 480,
    desktopCompactHeight: 50,
    flow: "normal-document-flow",
    policy: "all-widths-static-flow>desktop-compact-density>intrinsic-height>whole-status-wrap",
  },
  productMarketCategories: {
    plugin: PRODUCT_MARKET_SHARED_CATEGORY_CONTRACT.version,
    identity: PRODUCT_MARKET_SHARED_CATEGORY_CONTRACT.identity,
    orderControl: PRODUCT_MARKET_SHARED_CATEGORY_CONTRACT.orderControl,
    operationsAction: PRODUCT_MARKET_SHARED_CATEGORY_CONTRACT.operationsAction,
    statusPolicy: PRODUCT_MARKET_SHARED_CATEGORY_CONTRACT.statusPolicy,
    actionLayout: PRODUCT_MARKET_SHARED_CATEGORY_CONTRACT.actionLayout,
    projectionPolicy: PRODUCT_MARKET_SHARED_CATEGORY_CONTRACT.projectionPolicy,
    iconPolicy: PRODUCT_MARKET_SHARED_CATEGORY_CONTRACT.iconPolicy,
    ownershipHighlight: PRODUCT_MARKET_SHARED_CATEGORY_CONTRACT.ownershipHighlight,
    ownershipRoles: PRODUCT_MARKET_SHARED_CATEGORY_CONTRACT.ownershipRoles,
    measurementTolerance: 1,
    policy: "column-configuration-source>shared-category-reorder>sidebar+operations-live-projection>category-open-cancel-hide>shared-ownership-highlight>shared-persisted-batch",
  },
  sortableOwnership: {
    plugin: "shared-sortable-ownership-contract-v3",
    controlSize: 32,
    moveRailWidth: 112,
    sortToolbarWidth: 152,
    settingsHeaderMinimum: 50,
    settingsHeaderPadding: 6,
    settingsHeaderInnerHeight: 36,
    settingsContentGap: 12,
    settingsFontSize: 14,
    settingsLineHeight: 20,
    defaultHighlightMix: 24,
    hoverHighlightMix: 56,
    linkedHighlightMix: 8,
    categoryHighlightMix: 10,
    policy: "single-outer-capsule>50-6-36-rhythm>14-20-type>12-content-gap>nearest-sortable-card-or-operations-category>whole-card-hover-or-focus>control-rail-highlight>stable-key-linked-projection>no-navigation-no-scroll-no-persist",
  },
  layoutSectionEditor: {
    plugin: "shared-layout-section-editor-capsule-v2",
    inlineMinimum: 640,
    singleFieldColumnMaximum: 479,
    policy: "one-large-card-capsule>three-separated-semantic-segments>semantic-divider-only>no-inner-shells>capacity-wrap-without-inner-shells",
  },
  serviceExperts: {
    plugin: "shared-service-expert-capacity-v4",
    minimumCardInlineSize: 222,
    gap: 8,
    currentExpertProjection: "selection-card-auto-fit-v1",
    currentExpertBlockSizing: "intrinsic-block-size-no-track-stretch",
    controlEdgeInset: 8,
    controlGap: 8,
    maximumColumns: Number.POSITIVE_INFINITY,
    compactCardMaximum: 239,
    narrowCardMaximum: 287,
    stickyHeaderScrollSafeBlock: "9.5rem",
    policy: "own-content-container>selection-and-current-expert-share-auto-fit-readable-card>=222px>intrinsic-block-size-no-track-stretch>square-avatar-from-shared-launcher-token>label-inclusive-seven-character-copy>eight-pixel-edge-and-column-gap>eight-pixel-inline-control-inset>no-unframed-double-inset>shrink-avatar-and-copy-first>one-column-reflow-only-when-needed>unbounded-columns",
  },
  trackedRows: ["page-actions", "theme-actions", "table-actions", "section-editor", "service-header"],
  trackedGrids: ["dashboard", "list", "form", "detail", "workflow", "service-controls", "service-experts", "layout-controls"],
} as const;

export const RESPONSIVE_SHELL_TOOL_LABELS = {
  navigation: "左栏",
  "client-tools": "顶部",
  "page-context": "标题1",
  theme: "标题2",
  "table-header": "表头",
  visual: "可视化",
  overflow: "更多",
} as const;

export const RESPONSIVE_SHELL_FUNCTION_KEY_IDS = [
  "navigation",
  "client-tools",
  "page-context",
  "theme",
  "table-header",
  "visual",
] as const;

export const RESPONSIVE_SHELL_FUNCTION_KEY_SELECTOR = RESPONSIVE_SHELL_FUNCTION_KEY_IDS
  .map((id) => `[data-responsive-toolbar-trigger="${id}"]`)
  .join(", ");

export const RESPONSIVE_SHELL_FACTORY_DEFAULT = {
  id: "three-tier-responsive-shell",
  version: "2026.08.18.2",
  minimumSupportedWidth: 240,
  minimumSupportedHeight: 360,
  minimumInteractiveSize: 36,
  functionKeys: {
    strategy: "shared-function-key-plugin",
    ids: RESPONSIVE_SHELL_FUNCTION_KEY_IDS,
    height: 36,
    compactWidth: 36,
    labelledWidth: 88,
    contentGap: 4,
    measurementTolerance: 1,
  },
  sharedSurfaces: {
    strategy: "large-live-surface-with-compact-density",
    plugin: "large-band-density",
    ids: ["top", "title-1", "title-2", "table-header"],
    geometry: {
      top: "square",
      "title-1": "rounded-top-square-bottom-3d",
      "title-2": "square-3d",
      "table-header": "shared-table-radius",
    },
    palette: {
      top: "source-topbar",
      "title-1": "page-title",
      "title-2": "active-theme-panel-and-primary",
      "table-header": "table-header",
    },
    compactTitleCopy: {
      heading: "always-visible-single-line-ellipsis",
      descriptionWidthOwner: "title-content-box-after-action-reserve",
      descriptionMinimumWidth: 580,
      descriptionMinimumHeight: 520,
      actions: "desktop-measured-single-row>horizontal-scroll-last-resort>compact-whole-rail-wrap",
      inlineTitleActionMinimumWidth: 640,
      minimumInlineTitleWidth: 128,
      titleActionGap: 8,
      actionTrackSizing: "measured-intrinsic-content-with-title-reserve",
    },
  },
  titleActionCapacity: {
    strategy: "desktop-measured-single-row-then-compact-whole-rail-wrap",
    plugin: "shared-title-action-capacity-v2",
    compactMaximum: 639,
    maximumInlineSharePercent: 62,
    minimumTitleReserve: 128,
    titleActionGap: 8,
    shortWidePolicy: "keep-inline-and-scroll-last-resort",
    compactPolicy: "stack-whole-action-rail-below-heading",
    overflowPolicy: "horizontal-scroll-only-after-intrinsic-width-cap",
    zeroWidthPolicy: "invalid-learning-observation",
  },
  contextMarkers: {
    strategy: "workspace-left-outer-gutter-nested-context-left",
    plugin: "shared-context-marker-placement-v5",
    workspacePlacement: "body-left-outer-gutter",
    nestedVerticalPlacement: "left-frame-start",
    secondaryTitlePlacement: "left-frame-start",
    secondaryTitleInset: 8,
    tableShellInset: 0,
    largeCardTopInset: 2,
    leftInset: 4,
    compactLeftInset: 0,
    minimumHostGutter: 16,
    compactMaximum: 639,
    compactPolicy: "suppress-hover-only-keep-explicit-always-in-left-gutter",
  },
  themePalette: {
    strategy: "single-source-immutable-factory-preview",
    source: "product-market-theme-palettes",
    runtimeOverride: "forbidden",
    sharedContractRole: "validate-only",
    operationsSwitchSurfaceRole: "primary",
    operationsSwitchTextRole: "onPrimary",
    expandedThemeSurfaceRole: "primary",
    expandedThemeTextRole: "onPrimary",
    title2SurfaceRole: "panel",
    title2PrimaryRole: "action",
    paletteCardSurfaceRole: "panel",
    paletteCardTextRole: "text",
    paletteCardPrimaryRole: "primary",
    paletteCardSecondaryRole: "secondary",
    paletteCardActionRole: "action",
  },
  pageHost: {
    strategy: "container-first-semantic-templates",
    factoryVersion: "2026.08.16.5",
    templates: ["reference", "dashboard", "list", "form", "detail", "editor", "workflow"],
    activation: "every-route-inside-every-registered-shell",
    semanticDiscovery: "explicit-markers>first-visible-page-heading>first-visible-table-head",
    businessDataBoundary: "layout-only-never-records-fields-columns-or-materials",
  },
  capacityLayout: RESPONSIVE_CAPACITY_LAYOUT_FACTORY_DEFAULT,
  adaptiveStructure: {
    strategy: "one-boundary-progressive-disclosure-by-container",
    plugin: "shared-adaptive-structure-v3",
    roles: ["section", "list", "item", "action-rail", "main", "choice-group", "choice-grid", "field-grid", "details"],
    boundaryPolicy: "section>item>optional-details",
    choicePolicy: "auto-fit-equal-width-single-selection-frame",
    legacyAdapter: "semantic-marker-discovery",
  },
  mobileApplication: {
    plugin: "shared-mobile-app-frame-v1",
    activationMax: 639,
    desktopIsolationMin: 640,
    collections: ["function-grid", "record-list", "choice-grid"],
    footer: "context-row-then-five-equal-primary-items",
    desktopPolicy: "preserve-existing-desktop-layout-and-density",
  },
  sharedActions: {
    strategy: "large-action-with-responsive-flow",
    plugin: "large-action-density",
    height: 32,
    iconSize: 16,
    contentGap: 4,
    states: ["default", "hover", "focus-visible", "active", "disabled", "selected"],
  },
  sharedInteractions: {
    strategy: "large-interaction-with-viewport-placement",
    plugin: "large-interaction-density",
    surfaces: ["popover", "tooltip", "dropdown"],
    states: ["open", "closed", "hover", "focus-visible", "active"],
  },
  breakpoints: {
    compactMax: 639,
    wrapMax: 1023,
    drawerMax: 1023,
    simplifyMax: 1180,
    shrinkMax: 1279,
    desktopMin: 1024,
    wideMin: 1280,
  },
  verticalBreakpoints: {
    minimalMax: 519,
    focusMax: 650,
    compressedMax: 799,
  },
  verticalBudget: {
    minimumContentRatio: 0.55,
    focusedContentRatio: 0.60,
    minimalContentRatio: 0.40,
    minimalFocusedContentRatio: 0.50,
    maximumChromeRatio: 0.45,
    focusScrollTop: 48,
    focusDirectionDelta: 6,
    resetScrollTop: 16,
  },
  topbarDisclosure: {
    strategy: "anchored-popover",
    gap: 8,
    viewportEdge: 8,
    closeOn: ["toggle", "escape", "outside-pointer", "route-change", "desktop-transition"],
    scrollOwner: "popover-internal",
  },
  sidebarNavigation: {
    strategy: "route-owned-single-branch",
    activeRoutePolicy: "open-owning-project-on-first-render",
    queryNavigationPolicy: "retain-owning-project-across-secondary-navigation",
    projectSwitchPolicy: "close-previous-and-open-current-project",
    remountPolicy: "derive-initial-open-project-from-url",
    persistencePolicy: "route-state-not-local-preference",
  },
  pageTools: {
    strategy: "independent-trigger-panels",
    activateWhen: ["width<=639", "height<=650"],
    activationMax: 639,
    triggerLabels: RESPONSIVE_SHELL_TOOL_LABELS,
    triggerOrder: ["navigation", "client-tools", "page-context", "theme", "table-header"],
    sections: ["client-tools", "page-context", "theme", "table-header"],
    densityOrder: ["labelled", "icon-only", "overflow"],
    capacityPolicy: "labelled>measured-icon-only>measured-overflow",
    capacitySafetyInset: 8,
    capacityTolerance: 0.5,
    capacityRevealHysteresis: 2,
    overflowSections: ["page-context", "theme"],
    alwaysVisibleAtOverflow: ["navigation", "client-tools", "table-header", "overflow"],
    panelPolicy: "one-open-at-a-time",
    sectionChrome: "content-only",
    settingsFlow: "one-line-shrink-then-wrap",
    settingsWrapPolicy: "intrinsic-after-fluid-shrink",
    batchActionStyle: "large-table-header-parity",
    originalBandPolicy: "same-live-dom-overlay",
    footerReserve: 60,
  },
  footerActions: {
    order: ["locks", "visual", "save-sync"],
    primaryGroup: ["visual", "save-sync"],
    labels: {
      unlocked: ["源码解", "页面解", "栏目解"],
      locked: ["源码锁", "页面锁", "栏目锁"],
      saveSync: "保存",
    },
    strategy: "measured-label-icon-wrap-before-save",
    labelPolicy: "show-until-measured-overflow",
    lockControlGap: 4,
    controlContentGap: 4,
    labelCollapseTolerance: 0.5,
    wrapPolicy: "labelled-inline>icon-inline>icon-wrapped",
  },
  visualLauncher: {
    strategy: "footer-fixed-inline",
    defaultDock: "footer-before-save",
    footerSlotWidth: 88,
    compactFooterSlotWidth: 36,
  },
  floatingService: {
    strategy: "viewport-contained-footer-safe",
    mobileMax: 639,
    minimumFooterSafeBottom: 72,
    viewportMargin: 12,
    mobileFooterSafeBottom: 72,
  },
  priorityPolicy: {
    p0: "Always keep the primary task, navigation continuity and save/publish actions available.",
    p1: "Keep the action, but remove secondary copy and then collapse it to an icon when pressure increases.",
    p2: "Keep as an icon while useful; its explanatory copy yields before any primary action wraps.",
    p3: "Hide or move non-operational decoration and development utilities before functional controls wrap.",
  },
  stages: [
    { id: "wide", maxWidth: null, behavior: "Full frame, labels and supporting copy." },
    { id: "shrink", maxWidth: 1279, behavior: "Fluidly reduce type, gaps, padding, radii and non-critical artwork." },
    { id: "simplify", maxWidth: 1180, behavior: "Remove secondary descriptions and shorten labelled controls." },
    { id: "wrap", maxWidth: 1023, behavior: "Switch navigation to a drawer and wrap actions in business/keyboard order." },
    { id: "compact", maxWidth: 639, behavior: "Keep all labelled triggers while measured capacity fits; collapse the same controls to icons only after pressure is proven, and only then move Title 1 and Title 2 into More if the complete icon row still cannot fit." },
  ],
  verticalStages: [
    { id: "comfortable", maxHeight: null, behavior: "Keep full title context and the normal table header." },
    { id: "compressed", maxHeight: 799, behavior: "Reduce chrome height, padding and secondary descriptions before content space is taken." },
    { id: "focus", maxHeight: 650, behavior: "Expose title, theme and table controls through separate outer triggers while preserving the list and footer." },
    { id: "minimal", maxHeight: 519, behavior: "Tighten each tool panel height budget and retain Navigation, Top, Table Header, footer visual/save/locks and the business-content owner at the 360px operable floor." },
  ],
  verificationWidths: [1920, 1440, 1280, 1180, 1024, 900, 768, 640, 639, 619, 480, 375, 320, 240],
  verificationHeights: [960, 800, 720, 650, 598, 544, 520, 480, 360],
  learning: {
    storageKey: "tradepro.responsive-contract-learning.v1",
    recommendationStorageKey: "tradepro.responsive-auto-recommendation-plan.v1",
    factorySnapshotKey: "tradepro.responsive-factory-default.v1",
    maxRecords: 48,
    promotionPolicy: "observe-propose-verify-approve-version",
    autoRecommendationPolicy: "detect-rank-test-promote-shared-contract",
  },
  rules: [
    "All pages use the shared adaptive structure roles Section, List, Item, Action Rail, Main, Choice Grid, Field Grid and Details; a page declares semantics while the host supplies density and reflow.",
    "A visible item owns one decorative boundary. Nested carriers stay transparent unless they are interactive controls, so compact layouts never become card-inside-card-inside-card.",
    "Information yields by P0 to P3 priority: reduce flexible space first, auto-fit equal controls next, move secondary facts into details after measured pressure, and use one column only as the final readable state.",
    "Rows and card grids use their own rendered container capacity, not a viewport breakpoint: keep one line first, fluidly reduce gaps and padding, remove secondary copy, then wrap only when intrinsic content no longer fits.",
    "Every route inside Headquarters, Agency Source and Client Source is hosted by the same container-first responsive page contract; Operations Market is the reference template, not a route-only exception.",
    "Every standard Title 1, Title 2 and Table Header semantic marker is discovered by one shared live-surface adapter; pages declare meaning while the shell owns compact triggers, overflow and disclosure behaviour.",
    "The global page host classifies dashboard, list, form, detail, editor and workflow pages; it changes density, flow, overflow and placement only, while records, fields, columns, materials and business plugins remain page-owned.",
    "At desktop widths the persistent sidebar is visible and the drawer trigger is hidden.",
    "Below the desktop breakpoint the persistent sidebar is hidden and the drawer trigger remains visible.",
    "A navigation drawer has one full-width sidebar and one body scroll owner; generic dialog sizing never overrides it.",
    "Headquarters, Agency Source and Client Source use one route-owned sidebar disclosure contract: the active project's branch opens on first render, secondary query navigation keeps it open, and switching projects closes the previous branch and opens the current branch.",
    "Below the compact breakpoint secondary toolbar content is disclosed in its business order and wraps as a whole instead of being clipped or split across the bar.",
    "A compact disclosed topbar keeps its factory chrome height and opens an anchored, viewport-contained tool popover with its own scroll owner.",
    "The tool popover closes by its toggle, Escape, an outside pointer, route change or desktop transition; it never shrinks the registered business-content owner.",
    "At the final width or height pressure stage, the top trigger order is Left Sidebar, Top, Title 1, Title 2 and Table Header; every trigger opens its own live-control panel.",
    "Left Sidebar, Top, Title 1, Title 2, Table Header and Visual all read one shared function-key plugin; runtime learning rejects measured height or duplicate-frame drift beyond the factory tolerance.",
    "The compact rail follows one measured density sequence: keep every functional label while the labelled row fits, collapse the same controls to icon-only only after measured pressure, and move Title 1 and Title 2 into More only if the complete icon row still cannot fit; Navigation, Top and Table Header remain directly reachable.",
    "Only one compact tool panel may be open; another trigger, Escape, an outside pointer, route change or resize closes the previous panel.",
    "Compact page-tool panels contain settings only: redundant Current Page, Title 2 Theme and Table Header Batch headings are removed; settings stay on one line while padding, gaps and type shrink, then wrap only when their measured intrinsic content no longer fits.",
    "The compact Table Header panel reuses the large table header batch-action identity, status colors, 32px action height, typography, radius and contrast ring; generic topbar button styling cannot override it.",
    "Top, Title 1, Title 2 and Table Header use the same named surface plugin at every size: compact mode changes density and placement only, never geometry, palette, depth or interaction identity.",
    "Title 2 uses the active theme panel as its low-colour surface and the active theme action as its primary colour; Layout Style palette cards use each factory palette panel plus primary from the same source, including hover preview and factory restore.",
    "Title 1 keeps rounded upper corners, square lower corners and the shared 3D depth; Title 2 and Top remain square; Table Header keeps the shared table radius.",
    "Page actions use the one large-action plugin for 32px height, 16px icons, typography and default, hover, focus, active, disabled and selected states; narrow layouts may wrap but cannot redraw them.",
    "Title action rails keep intrinsic width on wide and short-wide screens; they stack as one complete rail only when measured title reserve plus action width no longer fits, and a zero-width rail is always a learning failure rather than a factory default.",
    "Popovers, tooltips and dropdowns use the one interaction plugin for border, radius, depth, motion, viewport containment, outside-pointer close and Escape focus return.",
    "The visual launcher is a fixed inline footer action immediately before Save and Sync; it has no drag, keyboard movement or persisted position state.",
    "The footer keeps locks first and groups Visual plus Save in a primary action rail; measured capacity keeps lock labels first, changes to icon-only only when required, then wraps the two rails only when icon-only still cannot fit. Every icon-to-label gap is 4px and factory restore preserves this order.",
    "The floating customer-service launcher and panel reserve the shared footer safe area at every width, drag, resize and viewport transition; the measured live footer may only increase that inset, so they may never cover Visual, Save or a lock action.",
    "The runtime recommendation plan converts measured contract issues into ranked shared fixes, records them with the observation and promotes only fixes that pass the complete boundary matrix.",
    "Viewport height has an independent pressure ladder: compress chrome, remove secondary copy, use one-line overflow bands, then enter scroll focus without hiding navigation or primary actions.",
    "At least 55% of a normal short viewport is reserved for the registered content owner; scroll focus targets 60%. At the 360px operable limit the safe floors are 40% initially and 50% in focus.",
    "Business records, materials and page-owned plugin capabilities are never changed by responsive layout.",
    "Column Configuration uses the shared module-editor capacity plugin: a card at 480px or wider keeps operation, status and hierarchy groups inline and its two fields readable in one row; at 1024px or wider the four semantic columns align with the shared table header and category name/status stay left-clustered; 352–479px wraps whole groups; only below 352px does the status group become a full-width equal three-cell row.",
    "Layout Style uses the shared single-capsule section editor: operation controls, title and description remain three separated semantic segments inside one large-card outline; inner inputs never redraw independent rounded shells, and narrow cards stack the same live fields without duplicating them.",
    "Desktop components are the only live source for Top, Title 1, Title 2, Table Header, Content and Footer; compact layouts move and reflow the same DOM and never reconstruct business controls.",
  ],
} as const;

export type ResponsiveShellMode = "compact" | "drawer" | "desktop" | "wide";
export type ResponsiveShellStage = "compact" | "wrap" | "simplify" | "shrink" | "wide";
export type ResponsiveVerticalStage = "minimal" | "focus" | "compressed" | "comfortable";
export type ResponsivePriority = keyof typeof RESPONSIVE_SHELL_FACTORY_DEFAULT.priorityPolicy;

export type VisualResponsiveRuntimeScope = "hq" | "agency-source" | "client-source";
export type VisualResponsiveRuntimeKind = "bootstrap" | "full";
export type VisualResponsiveRuntimeState = "ready" | "released";
export type VisualResponsiveRuntimeStateDetail = {
  scope: VisualResponsiveRuntimeScope;
  ownerId: string;
  state: VisualResponsiveRuntimeState;
};

export const VISUAL_RESPONSIVE_RUNTIME_STATE_EVENT = "tradepro:visual-responsive-runtime-state";

let visualResponsiveOwnerFallbackSequence = 0;

export function createVisualResponsiveRuntimeOwnerId(
  runtime: VisualResponsiveRuntimeKind,
  scope: VisualResponsiveRuntimeScope,
) {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) return `${runtime}:${scope}:${randomId}`;
  visualResponsiveOwnerFallbackSequence += 1;
  return `${runtime}:${scope}:${Date.now().toString(36)}:${visualResponsiveOwnerFallbackSequence.toString(36)}`;
}

export function parseVisualResponsiveRuntimeStateDetail(value: unknown): VisualResponsiveRuntimeStateDetail | null {
  if (!value || typeof value !== "object") return null;
  const detail = value as Partial<VisualResponsiveRuntimeStateDetail>;
  if (detail.scope !== "hq" && detail.scope !== "agency-source" && detail.scope !== "client-source") return null;
  if (typeof detail.ownerId !== "string" || !detail.ownerId) return null;
  if (detail.state !== "ready" && detail.state !== "released") return null;
  return detail as VisualResponsiveRuntimeStateDetail;
}

export function resolveServiceExpertColumnCount(width: number, itemCount = Number.POSITIVE_INFINITY) {
  const policy = RESPONSIVE_CAPACITY_LAYOUT_FACTORY_DEFAULT.serviceExperts;
  const columns = Math.floor((Math.max(0, width) + policy.gap) / (policy.minimumCardInlineSize + policy.gap));
  return Math.max(1, Math.min(columns, policy.maximumColumns, itemCount));
}

export function resolveResponsiveShellMode(width: number): ResponsiveShellMode {
  if (width <= RESPONSIVE_SHELL_FACTORY_DEFAULT.breakpoints.compactMax) return "compact";
  if (width <= RESPONSIVE_SHELL_FACTORY_DEFAULT.breakpoints.drawerMax) return "drawer";
  if (width < RESPONSIVE_SHELL_FACTORY_DEFAULT.breakpoints.wideMin) return "desktop";
  return "wide";
}

export function resolveResponsiveShellScale(width: number) {
  // Keep controls readable on narrow embedded panes; structural reflow, not
  // aggressive shrinking, is responsible for fitting the interface.
  return Math.max(0.875, Math.min(1, width / RESPONSIVE_SHELL_FACTORY_DEFAULT.breakpoints.wideMin));
}

export function resolveResponsiveShellStage(width: number): ResponsiveShellStage {
  if (width <= RESPONSIVE_SHELL_FACTORY_DEFAULT.breakpoints.compactMax) return "compact";
  if (width <= RESPONSIVE_SHELL_FACTORY_DEFAULT.breakpoints.wrapMax) return "wrap";
  if (width <= RESPONSIVE_SHELL_FACTORY_DEFAULT.breakpoints.simplifyMax) return "simplify";
  if (width <= RESPONSIVE_SHELL_FACTORY_DEFAULT.breakpoints.shrinkMax) return "shrink";
  return "wide";
}

export function resolveResponsiveVerticalStage(height: number): ResponsiveVerticalStage {
  if (height <= RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBreakpoints.minimalMax) return "minimal";
  if (height <= RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBreakpoints.focusMax) return "focus";
  if (height <= RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBreakpoints.compressedMax) return "compressed";
  return "comfortable";
}
