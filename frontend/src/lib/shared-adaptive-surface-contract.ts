export const SHARED_ADAPTIVE_SURFACE_IDS = [
  "top",
  "title-1",
  "title-2",
  "table-header",
  "content",
  "footer",
] as const;

export type SharedAdaptiveSurfaceId = typeof SHARED_ADAPTIVE_SURFACE_IDS[number];

/**
 * One responsive surface contract for HQ, Agency Source and Client Source.
 *
 * Desktop owns the real component tree and business state. Compact layouts
 * may move that same DOM, change density and reflow its children, but they may
 * not reconstruct controls or create a second mobile business state.
 */
export const SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT = {
  id: "desktop-base-shared-adaptive-surfaces-v1",
  version: "2026.08.17.3",
  strategy: "single-live-dom-desktop-base",
  sourceViewport: "desktop",
  surfaces: {
    top: "same-dom-flow",
    "title-1": "same-live-dom-overlay",
    "title-2": "same-live-dom-overlay",
    "table-header": "same-live-dom-overlay",
    content: "same-dom-container-reflow",
    footer: "same-dom-capacity-grid",
  },
  pressure: {
    widthMax: 639,
    heightMax: 650,
    safeInset: 8,
    zIndex: 220,
  },
  interaction: {
    close: ["trigger", "outside-pointer", "escape", "route-change", "viewport-change"],
    preserve: ["hover", "focus-visible", "active", "disabled", "selected", "popover", "tooltip"],
  },
  compactTitleCopy: {
    heading: "always-visible-single-line-ellipsis",
    description: "show-when-title-content-width-after-actions>=580-and-viewport-height>=520",
    actions: "desktop-measured-single-row>horizontal-scroll-last-resort>compact-whole-rail-wrap",
    inlineTitleActionMinimumWidth: 640,
    minimumInlineTitleWidth: 128,
    titleActionGap: 8,
    shortWidePolicy: "height-pressure-never-impersonates-narrow-width",
    zeroWidthPolicy: "reject-and-record-learning-issue",
  },
  compactContextMarker: {
    workspacePlacement: "right-safe-gutter",
    nestedPlacement: "left-frame-start",
    hoverOnly: "suppressed-at-or-below-639",
    explicitAlways: "keep-visible-on-right",
    forbidden: ["cover-title-icon", "cover-title-actions", "left-workspace-overlay"],
  },
  forbidden: [
    "duplicate-business-controls",
    "semantic-action-reconstruction",
    "legacy-compact-projection",
    "mobile-only-business-state",
    "route-specific-responsive-breakpoints",
  ],
  factoryRestore: {
    source: "code-owned-shared-adaptive-surface-contract",
    preserves: ["business-data", "page-content", "materials", "tenant-overrides"],
  },
} as const;
