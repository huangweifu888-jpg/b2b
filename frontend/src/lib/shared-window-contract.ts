/** Code-owned window grammar shared by HQ, Agency Source and Client Source. */
export const SHARED_WINDOW_CONTRACT_VERSION = "2026.08.27.1" as const;

/**
 * A resize gesture changes the distance from the window centre to both
 * opposing edges.  This deliberately avoids the desktop-window convention
 * of pinning the edge opposite the pointer: every resizable shared window
 * grows and shrinks symmetrically around its current centre.
 */
export const SHARED_CENTER_SYMMETRIC_RESIZE_CONTRACT = "center-symmetric-four-side-v1" as const;

/**
 * Inline title actions in every shared popup use the same 32px capsule frame,
 * span the title/description copy stack, and share the whole title band's
 * vertical centre with close. Customer-service chat remains the only stacked
 * title-action exception because its compact message surface needs the width.
 */
export const SHARED_WINDOW_TITLE_ACTION_ALIGNMENT_CONTRACT = "shared-title-action-band-center-v3" as const;
export const SHARED_WINDOW_TITLE_ACTION_RAIL_CONTRACT = "shared-window-title-action-rail-v2" as const;
export const SHARED_WINDOW_TITLE_ACTION_INLINE_MODE = "inline" as const;
export const SHARED_WINDOW_TITLE_ACTION_STACKED_MODE = "stacked" as const;
export const SHARED_WINDOW_TITLE_ACTION_STACKED_EXCEPTION = {
  registryId: "customer-service-chat",
  kind: "chat",
  mode: SHARED_WINDOW_TITLE_ACTION_STACKED_MODE,
} as const;

/**
 * Repeated small-card instances stay fully editable, but every large card
 * renders one deterministic marker without page-owned representative wiring.
 * A real shared card surface wins over toolbar/action elements that only carry
 * legacy small-card semantics; pages that have not adopted the surface token
 * fall back to their first semantic small card.
 */
export const SHARED_SMALL_CARD_MARKER_CONTRACT_VERSION = "2026.08.26.2" as const;
export const SHARED_SMALL_CARD_MARKER_POLICY = "first-per-large-card" as const;
export const SHARED_SMALL_CARD_MARKER_POLICY_ATTRIBUTE = "data-development-standard-small-card-marker-policy" as const;
export const SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE = "data-shared-small-card-marker-effective" as const;
export const SHARED_SMALL_CARD_EFFECTIVE_SCOPE_ATTRIBUTE = "data-shared-small-card-marker-scope-effective" as const;
export const SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE = "data-shared-small-card-style-surface-effective" as const;
export const SHARED_SMALL_CARD_DISCOVERY_ADAPTER_ATTRIBUTE = "data-shared-small-card-discovery-adapter" as const;
export const SHARED_SMALL_CARD_ADAPTED_FRAME_ATTRIBUTE = "data-shared-small-card-marker-adapted-frame" as const;
export const SHARED_SMALL_CARD_AUTOMATIC_SCOPE = "automatic-large-card" as const;
export const SHARED_SMALL_CARD_ADAPTER_SCOPE = "automatic-adapter-group" as const;
export const SHARED_SMALL_CARD_DECLARED_SCOPE = "declared-group" as const;
export const SHARED_SMALL_CARD_MARKER_RESOLUTION = "first-real-card-surface-then-first-semantic-card" as const;
export const SHARED_SMALL_CARD_DISCOVERY_ADAPTERS = [
  {
    id: "product-market-layout-style-v1",
    scopeSelectors: [
      '[data-template-config-table-palette="true"][data-product-market-layout-header-mode="palette"]',
    ],
    candidateSelectors: [
      '[data-template-config-table-palette="true"][data-product-market-layout-header-mode="palette"] [data-shared-theme-palette-appearance="layout-chooser"]',
      '[data-layout-unified-settings="global-font"] > :first-child',
      '[data-layout-unified-settings="content-bg"] > [data-layout-fine-preview]',
      '[data-layout-unified-settings="sidebar-style"] > :first-child',
      '[data-layout-unified-settings="product-card-colors"] [data-shared-status-card][data-shared-status-card-source="product-card-colors"]',
      '[data-layout-unified-settings="customer-service-style"] > :nth-child(2)',
    ],
  },
] as const;
export const SHARED_SMALL_CARD_MARKER_ADAPTER_SCOPE_SELECTOR = SHARED_SMALL_CARD_DISCOVERY_ADAPTERS
  .flatMap((adapter) => adapter.scopeSelectors)
  .join(", ");
export const SHARED_SMALL_CARD_MARKER_ADAPTER_CANDIDATE_SELECTOR = SHARED_SMALL_CARD_DISCOVERY_ADAPTERS
  .flatMap((adapter) => adapter.candidateSelectors)
  .join(", ");
export const SHARED_LARGE_CARD_REGION_SELECTOR = ':is([data-development-standard-frame-region="large-card"], [data-page-card-size="large"], [data-page-card-role="group"], [data-page-factory-region="large-card"], [data-shared-large-card-surface="true"]):not(:is([data-development-standard-frame-region="small-card"], [data-page-card-size="small"], [data-page-factory-region="small-card"]))' as const;
export const SHARED_SMALL_CARD_MARKER_SEMANTIC_CANDIDATE_SELECTOR = '[data-development-standard-frame-region="small-card"], [data-page-card-size="small"], [data-page-factory-region="small-card"]' as const;
export const SHARED_SMALL_CARD_MARKER_STANDARD_CARD_FALLBACK_SELECTOR = '[data-page-list-item]' as const;
export const SHARED_SMALL_CARD_RUNTIME_EXCLUSION_SELECTOR = '[data-visual-card-editor-dock], [data-development-standard-apply-dialog], [data-development-standard-apply-console]' as const;
export const SHARED_SMALL_CARD_DISCOVERY_MUTATION_ATTRIBUTES = [
  SHARED_SMALL_CARD_MARKER_POLICY_ATTRIBUTE,
  "data-development-standard-frame-region",
  "data-development-standard-apply-dialog",
  "data-development-standard-apply-console",
  "data-visual-card-editor-dock",
  "data-page-card-size",
  "data-page-card-role",
  "data-page-factory-region",
  "data-page-list-item",
  "data-page-list-layout",
  "data-shared-large-card-surface",
  "data-shared-small-card-surface",
  "data-layout-unified-settings",
  "data-layout-fine-preview",
  "data-shared-status-card",
  "data-shared-status-card-source",
  "data-shared-theme-palette-appearance",
  "data-template-config-table-palette",
  "data-product-market-layout-header-mode",
] as const;

/**
 * The Visual developer has a wider refresh responsibility than the marker
 * synchronizer. Besides structural card discovery it snapshots live colours,
 * borders and shadows, so semantic selection/state changes must invalidate
 * its preview even when no node is inserted or removed.
 */
export const SHARED_DEVELOPER_LIVE_PREVIEW_MUTATION_ATTRIBUTES = [
  ...SHARED_SMALL_CARD_DISCOVERY_MUTATION_ATTRIBUTES,
  "aria-current",
  "aria-pressed",
  "aria-selected",
  "data-state",
  "data-selected",
  "data-product-market-batch-selected",
  "data-shared-selection-control",
  "data-shared-theme-palette-state",
] as const;

/**
 * Theme previews are projected through CSS variables on `documentElement`,
 * outside the Product Market workspace observed for component mutations.
 */
export const SHARED_DEVELOPER_LIVE_PREVIEW_DOCUMENT_THEME_MUTATION_ATTRIBUTES = [
  "class",
  "style",
  "data-tradepro-theme-preview",
] as const;
export const SHARED_SMALL_CARD_MARKER_CANDIDATE_SELECTOR = `${SHARED_SMALL_CARD_MARKER_SEMANTIC_CANDIDATE_SELECTOR}, ${SHARED_SMALL_CARD_MARKER_ADAPTER_CANDIDATE_SELECTOR}`;
export const SHARED_SMALL_CARD_CANDIDATE_DISCOVERY_SELECTOR = `${SHARED_SMALL_CARD_MARKER_CANDIDATE_SELECTOR}, ${SHARED_SMALL_CARD_MARKER_STANDARD_CARD_FALLBACK_SELECTOR}`;
export const SHARED_SMALL_CARD_MARKER_AUTOMATIC_SCOPE_SELECTOR = SHARED_LARGE_CARD_REGION_SELECTOR;
export const SHARED_SMALL_CARD_MARKER_DECLARED_SCOPE_SELECTOR = `[${SHARED_SMALL_CARD_MARKER_POLICY_ATTRIBUTE}="${SHARED_SMALL_CARD_MARKER_POLICY}"]` as const;
export const SHARED_SMALL_CARD_MARKER_SCOPE_SELECTOR = `${SHARED_SMALL_CARD_MARKER_AUTOMATIC_SCOPE_SELECTOR}, ${SHARED_SMALL_CARD_MARKER_DECLARED_SCOPE_SELECTOR}, ${SHARED_SMALL_CARD_MARKER_ADAPTER_SCOPE_SELECTOR}`;
export type SharedSmallCardEffectiveMarker = "representative" | "silent";

function collectMatchingElements(root: ParentNode, selector: string) {
  const matches = Array.from(root.querySelectorAll<HTMLElement>(selector));
  if (root instanceof HTMLElement && root.matches(selector)) matches.unshift(root);
  return Array.from(new Set(matches));
}

function findSharedSmallCardDiscoveryAdapter(element: HTMLElement) {
  return SHARED_SMALL_CARD_DISCOVERY_ADAPTERS.find((adapter) => (
    adapter.candidateSelectors.some((selector) => element.matches(selector))
  )) ?? null;
}

export function isSharedSmallCardMarkerRealSurface(element: HTMLElement) {
  return element.dataset.sharedSmallCardSurface === "true"
    || findSharedSmallCardDiscoveryAdapter(element) !== null;
}

export function isSharedSmallCardStyleSurface(element: HTMLElement) {
  return element.dataset.sharedSmallCardSurface === "true"
    || isSharedSmallCardStandardCardFallback(element)
    || element.matches('[data-page-card-size="small"], [data-page-factory-region="small-card"]');
}

export function isSharedSmallCardRuntimeExcluded(element: HTMLElement) {
  return element.matches(SHARED_SMALL_CARD_RUNTIME_EXCLUSION_SELECTOR)
    || element.closest(SHARED_SMALL_CARD_RUNTIME_EXCLUSION_SELECTOR) !== null;
}

export function isSharedSmallCardStandardCardFallback(element: HTMLElement) {
  return !isSharedSmallCardRuntimeExcluded(element)
    && element.matches(SHARED_SMALL_CARD_MARKER_STANDARD_CARD_FALLBACK_SELECTOR)
    && !element.matches(SHARED_LARGE_CARD_REGION_SELECTOR)
    && element.tagName !== "TR"
    && !element.closest('[data-page-list-layout="table"], table');
}

/**
 * One candidate discovery path for the runtime marker, Visual developer and
 * shared parity scanner.  The list-card fallback preserves the repository's
 * ordinary-page convention without treating table rows as visual cards.
 */
export function collectSharedSmallCardCandidates(root: ParentNode) {
  return Array.from(root.querySelectorAll<HTMLElement>(SHARED_SMALL_CARD_CANDIDATE_DISCOVERY_SELECTOR))
    .filter((element) => (
      !isSharedSmallCardRuntimeExcluded(element)
      && (
        element.matches(SHARED_SMALL_CARD_MARKER_CANDIDATE_SELECTOR)
        || isSharedSmallCardStandardCardFallback(element)
      )
    ));
}

export function findSharedSmallCardMarkerScope(element: HTMLElement) {
  if (isSharedSmallCardRuntimeExcluded(element)) return null;
  return element.closest<HTMLElement>(SHARED_SMALL_CARD_MARKER_AUTOMATIC_SCOPE_SELECTOR)
    ?? element.closest<HTMLElement>(SHARED_SMALL_CARD_MARKER_DECLARED_SCOPE_SELECTOR)
    ?? element.closest<HTMLElement>(SHARED_SMALL_CARD_MARKER_ADAPTER_SCOPE_SELECTOR);
}

export function isSharedSmallCardMarkerCandidate(element: HTMLElement) {
  return !isSharedSmallCardRuntimeExcluded(element)
    && (
      element.matches(SHARED_SMALL_CARD_MARKER_CANDIDATE_SELECTOR)
      || isSharedSmallCardStandardCardFallback(element)
    );
}

export function collectSharedSmallCardMarkerCandidates(scope: HTMLElement) {
  return collectSharedSmallCardCandidates(scope)
    .filter((candidate) => findSharedSmallCardMarkerScope(candidate) === scope);
}

export function resolveSharedSmallCardMarkerRepresentative(scope: HTMLElement) {
  const candidates = collectSharedSmallCardMarkerCandidates(scope);
  return candidates.find(isSharedSmallCardMarkerRealSurface)
    ?? candidates[0]
    ?? null;
}

/**
 * Materialises the shared first-card policy into a read-only runtime marker.
 * Legacy source marker declarations are not trusted for ownership; the page,
 * Visual developer and every shared window consume this deterministic result.
 */
export function synchronizeSharedSmallCardMarkerPolicies(root: ParentNode = document) {
  for (const element of collectMatchingElements(root, `[${SHARED_SMALL_CARD_DISCOVERY_ADAPTER_ATTRIBUTE}]`)) {
    if (findSharedSmallCardDiscoveryAdapter(element)) continue;
    if (
      element.getAttribute(SHARED_SMALL_CARD_ADAPTED_FRAME_ATTRIBUTE) === "true"
      && element.dataset.developmentStandardFrameRegion === "small-card"
    ) {
      element.removeAttribute("data-development-standard-frame-region");
      if (element.dataset.developmentStandardFrameLabel === "小卡片") {
        element.removeAttribute("data-development-standard-frame-label");
      }
    }
    element.removeAttribute(SHARED_SMALL_CARD_ADAPTED_FRAME_ATTRIBUTE);
    element.removeAttribute(SHARED_SMALL_CARD_DISCOVERY_ADAPTER_ATTRIBUTE);
  }
  for (const element of collectMatchingElements(root, SHARED_SMALL_CARD_MARKER_ADAPTER_CANDIDATE_SELECTOR)) {
    const adapter = findSharedSmallCardDiscoveryAdapter(element);
    if (!adapter) continue;
    element.setAttribute(SHARED_SMALL_CARD_DISCOVERY_ADAPTER_ATTRIBUTE, adapter.id);
    if (!element.hasAttribute("data-development-standard-frame-region")) {
      element.setAttribute("data-development-standard-frame-region", "small-card");
      if (!element.hasAttribute("data-development-standard-frame-label")) {
        element.setAttribute("data-development-standard-frame-label", "小卡片");
      }
      element.setAttribute(SHARED_SMALL_CARD_ADAPTED_FRAME_ATTRIBUTE, "true");
    }
  }

  const scopes = collectMatchingElements(root, SHARED_SMALL_CARD_MARKER_SCOPE_SELECTOR);
  const managedCandidates = new Set<HTMLElement>();
  const managedStyleSurfaces = new Set<HTMLElement>();
  const managedScopes = new Set<HTMLElement>();
  let representativeCount = 0;

  for (const scope of scopes) {
    const candidates = collectSharedSmallCardMarkerCandidates(scope);
    if (!candidates.length) continue;
    managedScopes.add(scope);
    const scopeMode = scope.matches(SHARED_SMALL_CARD_MARKER_AUTOMATIC_SCOPE_SELECTOR)
      ? SHARED_SMALL_CARD_AUTOMATIC_SCOPE
      : scope.matches(SHARED_SMALL_CARD_MARKER_DECLARED_SCOPE_SELECTOR)
        ? SHARED_SMALL_CARD_DECLARED_SCOPE
        : SHARED_SMALL_CARD_ADAPTER_SCOPE;
    if (scope.getAttribute(SHARED_SMALL_CARD_EFFECTIVE_SCOPE_ATTRIBUTE) !== scopeMode) {
      scope.setAttribute(SHARED_SMALL_CARD_EFFECTIVE_SCOPE_ATTRIBUTE, scopeMode);
    }
    const representative = resolveSharedSmallCardMarkerRepresentative(scope);
    if (representative) representativeCount += 1;
    for (const candidate of candidates) {
      managedCandidates.add(candidate);
      if (isSharedSmallCardStyleSurface(candidate)) {
        managedStyleSurfaces.add(candidate);
        if (candidate.getAttribute(SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE) !== "true") {
          candidate.setAttribute(SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE, "true");
        }
      } else {
        candidate.removeAttribute(SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE);
      }
      const next: SharedSmallCardEffectiveMarker = candidate === representative ? "representative" : "silent";
      if (candidate.getAttribute(SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE) !== next) {
        candidate.setAttribute(SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE, next);
      }
    }
  }

  const staleCandidates = Array.from(root.querySelectorAll<HTMLElement>(`[${SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE}]`));
  if (root instanceof HTMLElement && root.hasAttribute(SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE)) staleCandidates.unshift(root);
  for (const candidate of staleCandidates) {
    if (!managedCandidates.has(candidate)) candidate.removeAttribute(SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE);
  }

  const staleStyleSurfaces = Array.from(root.querySelectorAll<HTMLElement>(`[${SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE}]`));
  if (root instanceof HTMLElement && root.hasAttribute(SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE)) staleStyleSurfaces.unshift(root);
  for (const candidate of staleStyleSurfaces) {
    if (!managedStyleSurfaces.has(candidate)) candidate.removeAttribute(SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE);
  }

  const staleScopes = Array.from(root.querySelectorAll<HTMLElement>(`[${SHARED_SMALL_CARD_EFFECTIVE_SCOPE_ATTRIBUTE}]`));
  if (root instanceof HTMLElement && root.hasAttribute(SHARED_SMALL_CARD_EFFECTIVE_SCOPE_ATTRIBUTE)) staleScopes.unshift(root);
  for (const scope of staleScopes) {
    if (!managedScopes.has(scope)) scope.removeAttribute(SHARED_SMALL_CARD_EFFECTIVE_SCOPE_ATTRIBUTE);
  }

  return {
    scopeCount: managedScopes.size,
    candidateCount: managedCandidates.size,
    representativeCount,
  } as const;
}

export type SharedWindowResizeEdge =
  | "north"
  | "south"
  | "east"
  | "west"
  | "north-east"
  | "north-west"
  | "south-east"
  | "south-west";

export type SharedResizableWindowRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type SharedResizeViewportBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type ResolveCenteredWindowResizeOptions = {
  start: SharedResizableWindowRect;
  edge: SharedWindowResizeEdge;
  deltaX: number;
  deltaY: number;
  minWidth: number;
  minHeight: number;
  bounds: SharedResizeViewportBounds;
};

/**
 * Resolves a pointer resize without moving the window centre. Bounds are
 * applied before the result is returned, so callers never need to pin one
 * edge afterwards (which would otherwise break four-side symmetry).
 */
export const resolveCenteredWindowResize = ({
  start,
  edge,
  deltaX,
  deltaY,
  minWidth,
  minHeight,
  bounds,
}: ResolveCenteredWindowResizeOptions): SharedResizableWindowRect => {
  const centerX = start.left + start.width / 2;
  const centerY = start.top + start.height / 2;
  const maxHalfWidth = Math.max(1, Math.min(centerX - bounds.left, bounds.right - centerX));
  const maxHalfHeight = Math.max(1, Math.min(centerY - bounds.top, bounds.bottom - centerY));
  const minHalfWidth = Math.min(Math.max(1, minWidth / 2), maxHalfWidth);
  const minHalfHeight = Math.min(Math.max(1, minHeight / 2), maxHalfHeight);
  let halfWidth = start.width / 2;
  let halfHeight = start.height / 2;

  if (edge.includes("east")) halfWidth += deltaX;
  if (edge.includes("west")) halfWidth -= deltaX;
  if (edge.includes("south")) halfHeight += deltaY;
  if (edge.includes("north")) halfHeight -= deltaY;

  halfWidth = Math.min(maxHalfWidth, Math.max(minHalfWidth, halfWidth));
  halfHeight = Math.min(maxHalfHeight, Math.max(minHalfHeight, halfHeight));

  return {
    left: centerX - halfWidth,
    top: centerY - halfHeight,
    width: halfWidth * 2,
    height: halfHeight * 2,
  };
};

export const SHARED_WINDOW_REGION_IDS = ["topbar", "title", "table-header", "content", "large-card", "small-card", "footer"] as const;
export type SharedWindowRegionId = typeof SHARED_WINDOW_REGION_IDS[number];

export const SHARED_WINDOW_KINDS = ["workbench", "editor", "profile", "chat", "confirm", "loading", "drawer"] as const;
export type SharedWindowKind = typeof SHARED_WINDOW_KINDS[number];
export const SHARED_WINDOW_THEME_PROJECTIONS = ["active-page", "draft-theme-preview"] as const;
export type SharedWindowThemeProjection = typeof SHARED_WINDOW_THEME_PROJECTIONS[number];

/** The factory-owned registry prevents new modal families from becoming private UI islands. */
export const SHARED_WINDOW_REGISTRY = [
  { id: "generic-editor", label: "通用编辑器", kind: "editor" },
  { id: "command-palette", label: "命令面板", kind: "workbench" },
  { id: "development-workbench", label: "开发器／规范", kind: "workbench" },
  { id: "visual-workbench", label: "可视化", kind: "workbench" },
  { id: "material-picker", label: "头像／朗音／素材", kind: "editor" },
  { id: "theme-editor", label: "版面风格编辑", kind: "editor" },
  { id: "hq-version-history", label: "总部 H 版本更新", kind: "editor" },
  { id: "runtime-diagnostic", label: "异常检测", kind: "workbench" },
  { id: "expert-profile", label: "点击专家头像", kind: "profile" },
  { id: "customer-service-chat", label: "客服聊天", kind: "chat" },
  { id: "expert-picker", label: "换专家", kind: "profile" },
  { id: "save-confirmation", label: "保存／发布确认", kind: "confirm" },
  { id: "site-switch-loading", label: "站点切换读条", kind: "loading" },
  { id: "mobile-navigation", label: "移动端导航", kind: "drawer" },
] as const satisfies readonly { id: string; label: string; kind: SharedWindowKind }[];

export function resolveSharedWindowRegistryEntry(id: string | null | undefined) {
  return SHARED_WINDOW_REGISTRY.find((entry) => entry.id === id) ?? null;
}

export function isSharedWindowRegistryBindingValid(id: string | null | undefined, kind: string | null | undefined) {
  const entry = resolveSharedWindowRegistryEntry(id);
  return Boolean(entry && entry.kind === kind);
}

/**
 * All windows consume one token system. Window kind selects behaviour and a
 * valid subset of regions; it never permits a private theme or mobile layout.
 */
export const SHARED_WINDOW_FACTORY_DEFAULT = {
  id: "three-source-shared-window-contract",
  version: SHARED_WINDOW_CONTRACT_VERSION,
  sourceScopes: ["hq", "agency-source", "client-source"],
  regions: SHARED_WINDOW_REGION_IDS,
  registry: SHARED_WINDOW_REGISTRY,
  kinds: {
    workbench: { drag: true, resize: true, compact: "full-screen", regions: ["topbar", "title", "table-header", "content", "large-card", "small-card", "footer"] },
    editor: { drag: true, resize: true, compact: "full-screen", regions: ["title", "content", "large-card", "small-card", "footer"] },
    profile: { drag: true, resize: true, compact: "full-screen", regions: ["title", "content", "large-card", "footer"] },
    chat: { drag: true, resize: true, compact: "safe-bottom-sheet", regions: ["title", "content", "small-card", "footer"] },
    confirm: { drag: false, resize: false, compact: "viewport-contained", regions: ["title", "content", "footer"] },
    loading: { drag: false, resize: false, compact: "viewport-contained", regions: ["title", "content"] },
    drawer: { drag: false, resize: false, compact: "edge-to-edge", regions: ["topbar", "content", "footer"] },
  },
  shared: {
    theme: "page-shared-tokens-only",
    themeProjections: SHARED_WINDOW_THEME_PROJECTIONS,
    registryBinding: "data-shared-dialog-contract-id-kind-match",
    close: "top-right-shared-plugin",
    titleActions: {
      alignment: SHARED_WINDOW_TITLE_ACTION_ALIGNMENT_CONTRACT,
      rail: SHARED_WINDOW_TITLE_ACTION_RAIL_CONTRACT,
      defaultMode: SHARED_WINDOW_TITLE_ACTION_INLINE_MODE,
      actionHeight: "shared-action-height-32px",
      centerReference: "whole-title-band",
      stackedExceptions: [SHARED_WINDOW_TITLE_ACTION_STACKED_EXCEPTION],
    },
    annotations: "visual-mode-only",
    smallCardMarkers: SHARED_SMALL_CARD_MARKER_POLICY,
    smallCardMarkerContractVersion: SHARED_SMALL_CARD_MARKER_CONTRACT_VERSION,
    smallCardMarkerRuntimeAttribute: SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE,
    smallCardMarkerRuntimeScopeAttribute: SHARED_SMALL_CARD_EFFECTIVE_SCOPE_ATTRIBUTE,
    smallCardStyleSurfaceRuntimeAttribute: SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE,
    smallCardMarkerScope: "every-large-card-auto-plus-shared-adapter-and-declared-standalone-groups",
    smallCardMarkerResolution: SHARED_SMALL_CARD_MARKER_RESOLUTION,
    smallCardDiscoveryAdapters: SHARED_SMALL_CARD_DISCOVERY_ADAPTERS,
    smallCardCandidateDiscovery: "development-page-factory-semantic-plus-non-table-non-large-list-card-plus-shared-adapters",
    smallCardMarkerSourceDeclarations: "central-effective-result-is-the-only-marker-ownership-truth",
    footerSafeArea: "reserve-lower-right-resize-handle",
    persistence: "local-window-preference-never-business-data",
    resize: SHARED_CENTER_SYMMETRIC_RESIZE_CONTRACT,
  },
  factoryRestore: {
    source: "code-owned-shared-window-contract",
    preserves: ["business-data", "page-content", "materials", "tenant-overrides", "window-preferences"],
  },
} as const;
