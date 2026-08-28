import {
  getContentPluginDefinition,
  isKnownContentPluginId,
  type KnownContentPluginId,
} from "@/lib/content-plugin-registry";

export type VisualCardPluginRuntimeKind = "visual" | "control" | "business-capability";
export type VisualCardPluginRuntimeStatus = "applied" | "bound" | "unavailable";

export type VisualCardPluginRuntimeResult = Readonly<{
  pluginId: KnownContentPluginId;
  label: string;
  kind: VisualCardPluginRuntimeKind;
  status: VisualCardPluginRuntimeStatus;
  effective: boolean;
  matchedElementCount: number;
  message: string;
}>;

export type VisualCardPluginRuntimeReport = Readonly<{
  requestedPluginIds: readonly KnownContentPluginId[];
  effectivePluginIds: readonly KnownContentPluginId[];
  unavailablePluginIds: readonly KnownContentPluginId[];
  results: readonly VisualCardPluginRuntimeResult[];
}>;

export type VisualCardPluginRuntimeOptions = Readonly<{
  /** Re-evaluate bindings when the page mounts or removes real controls. */
  observe?: boolean;
  onReportChange?: (report: VisualCardPluginRuntimeReport) => void;
}>;

type RuntimeState = {
  target: HTMLElement;
  document: Document;
  pluginIds: KnownContentPluginId[];
  options: VisualCardPluginRuntimeOptions;
  originalAttributes: Map<string, string | null>;
  report: VisualCardPluginRuntimeReport;
  mutationObserver?: MutationObserver;
  resizeObserver?: ResizeObserver;
  fallbackResizeListener?: () => void;
  reportScheduled: boolean;
  cleared: boolean;
};

const RUNTIME_STYLE_ID = "visual-card-plugin-runtime-styles";
const PLUGIN_SCOPE_BOUNDARY_SELECTOR = [
  "[data-content-plugin-host]",
  "[data-visual-card-runtime-region]",
  "[data-development-standard-frame-region]",
].join(", ");
const SCROLL_OWNER_SELECTOR = "[data-page-list-scroll-owner], [data-product-market-scroll-list]";

const TARGET_RUNTIME_ATTRIBUTES = [
  "data-visual-card-plugin-runtime",
  "data-visual-card-plugin-applied",
  "data-visual-card-plugin-bound",
  "data-visual-card-plugin-effective",
  "data-visual-card-plugin-unavailable",
  "data-visual-card-plugin-responsive-size",
] as const;

const DIRECT_VISUAL_PLUGINS = new Set<KnownContentPluginId>([
  "hover",
  "compact",
  "split",
  "scroll",
  "responsive",
]);

const BUSINESS_CAPABILITY_PLUGINS = new Set<KnownContentPluginId>([
  "search",
  "filter",
  "batch",
  "sort",
  "pagination",
  "empty",
  "save",
  "sync",
  "help",
]);

/**
 * These selectors are capability probes, not alternative implementations.
 * A visual-card plugin may decorate or report a control that the page already
 * owns, but it must never invent a business callback or write business data.
 */
const EXISTING_CAPABILITY_SELECTORS: Partial<Record<KnownContentPluginId, readonly string[]>> = {
  drag: [
    '[data-content-plugin-control="drag"]',
    "[data-product-market-card-drag-handle]",
    '[data-drag-handle][draggable="true"]',
  ],
  order: [
    '[data-content-plugin-control="order"]',
    "[data-content-plugin-order-sequence]",
  ],
  move: [
    '[data-content-plugin-control="move-up"]',
    '[data-content-plugin-control="move-down"]',
  ],
  icon: ['[data-content-plugin-control="icon"]'],
  search: ['[data-content-plugin-control="search"]'],
  filter: [
    '[data-content-plugin-control="filter"]',
    "[data-filter-control]",
  ],
  batch: [
    '[data-content-plugin-actions="batch"]',
    "[data-batch-actions]",
    "[data-product-market-batch-action]",
  ],
  sort: [
    '[data-content-plugin-control="sort"]',
    "[data-sort-control]",
  ],
  help: ['[data-content-plugin-control="help"]'],
  actions: [
    '[data-content-plugin-actions]:not([data-content-plugin-actions="status"])',
    '[data-content-plugin-control="actions"]',
    "[data-page-title-actions]",
    "[data-shared-function-actions]",
    "[data-source-project-action]",
  ],
  pagination: [
    "[data-content-plugin-pagination]",
    "[data-pagination-control]",
  ],
  empty: [
    "[data-content-plugin-empty]",
    "[data-empty-state]",
  ],
  save: [
    '[data-content-plugin-control="save"]',
    "[data-shared-title-save-action]",
  ],
  sync: [
    '[data-content-plugin-control="sync"]',
    "[data-sync-action]",
    "[data-source-project-action]",
    "[data-client-project-action]",
  ],
  statusActions: [
    '[data-content-plugin-actions="status"]',
    '[data-content-plugin-control^="status-"]',
    "[data-product-market-status-control]",
  ],
  status: [
    "[data-content-plugin-status]",
    '[data-content-plugin-control^="status-"]',
    "[data-product-market-status-control]",
    "[data-product-market-maturity-badge]",
    "[data-page-layout-footer-status]",
  ],
  loading: [
    "[data-loading-state]",
    "[data-preview-loading]",
    "[data-site-switch-loading-card]",
  ],
  toggle: ['[data-content-plugin-control="toggle"]'],
  close: ['[data-content-plugin-control="close"]'],
  delete: ['[data-content-plugin-control="delete"]'],
  pin: ['[data-content-plugin-control="pin"]'],
  copy: ['[data-content-plugin-control="copy"]'],
  edit: ['[data-content-plugin-control="edit"]'],
  levelBadge: [
    '[data-content-plugin-control="levelBadge"]',
    "[data-content-plugin-level-badge]",
    "[data-level-badge]",
  ],
  lock: [
    '[data-content-plugin-control="lock"]',
    "[data-layout-lock-control]",
    "[data-page-layout-lock]",
    "[data-nav-layout-lock]",
    "[data-development-standard-page-lock]",
    "[data-template-layout-locked]",
  ],
  version: [
    '[data-content-plugin-control="version"]',
    "[data-content-plugin-version]",
    "[data-release-version]",
  ],
};

const OBSERVED_CAPABILITY_ATTRIBUTES = [
  "data-batch-actions",
  "data-client-project-action",
  "data-content-plugin-actions",
  "data-content-plugin-control",
  "data-content-plugin-empty",
  "data-content-plugin-host",
  "data-content-plugin-level-badge",
  "data-content-plugin-owner-region",
  "data-content-plugin-version",
  "data-development-standard-page-lock",
  "data-empty-state",
  "data-filter-control",
  "data-layout-lock-control",
  "data-level-badge",
  "data-loading-state",
  "data-nav-layout-lock",
  "data-page-layout-lock",
  "data-page-layout-footer-status",
  "data-pagination-control",
  "data-preview-loading",
  "data-product-market-batch-action",
  "data-product-market-maturity-badge",
  "data-product-market-status-control",
  "data-shared-title-save-action",
  "data-site-switch-loading-card",
  "data-sort-control",
  "data-source-project-action",
  "data-state",
  "data-status",
  "data-sync-action",
  "data-template-layout-locked",
  "data-release-version",
  "data-visual-card-runtime-region",
] as const;

const RUNTIME_CSS = `
[data-visual-card-plugin-applied~="hover"] {
  transition: translate 160ms ease, box-shadow 160ms ease, filter 160ms ease;
}
[data-visual-card-plugin-applied~="hover"]:is(:hover, :focus-within):not(:has([data-visual-card-plugin-applied~="hover"]:is(:hover, :focus-within))) {
  translate: 0 -2px;
  box-shadow: 0 12px 28px color-mix(in srgb, var(--tradepro-shared-plugin-accent, #0f172a) 16%, transparent) !important;
  filter: saturate(1.03);
}
[data-visual-card-plugin-applied~="compact"] {
  padding-block: var(--visual-card-plugin-compact-padding-block, 0.375rem) !important;
  padding-inline: var(--visual-card-plugin-compact-padding-inline, var(--tradepro-shared-card-edge-inset, 0.75rem)) !important;
  gap: var(--visual-card-plugin-compact-gap, var(--tradepro-shared-plugin-gap, 0.5rem)) !important;
}
[data-visual-card-plugin-applied~="compact"] :is(button, input, select, textarea) {
  min-height: var(--tradepro-shared-plugin-control-size, 2rem);
}
[data-visual-card-plugin-applied~="split"] {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: var(--tradepro-shared-plugin-section-gap, 1rem) !important;
  align-items: start;
}
[data-visual-card-plugin-applied~="scroll"] {
  min-height: 0 !important;
  max-height: 100%;
  overflow: auto !important;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}
[data-visual-card-runtime-region="table-shell"][data-visual-card-plugin-bound~="scroll"]
  :is([data-page-list-scroll-owner], [data-product-market-scroll-list]) {
  min-height: 0 !important;
  overflow: auto !important;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}
[data-visual-card-plugin-applied~="responsive"] {
  box-sizing: border-box;
  min-inline-size: 0;
  max-inline-size: 100%;
}
[data-visual-card-plugin-applied~="responsive"] > * {
  min-inline-size: 0;
  max-inline-size: 100%;
}
[data-visual-card-plugin-applied~="responsive"][data-visual-card-plugin-responsive-size="compact"][data-visual-card-plugin-applied~="split"] {
  grid-template-columns: minmax(0, 1fr) !important;
}
[data-visual-card-plugin-bound~="drag"] [data-content-plugin-control="drag"] {
  cursor: grab;
  touch-action: none;
}
[data-visual-card-plugin-bound~="drag"] [data-content-plugin-control="drag"]:active {
  cursor: grabbing;
}
[data-visual-card-plugin-bound~="order"] [data-content-plugin-control="order"],
[data-visual-card-plugin-bound~="levelBadge"] :is([data-content-plugin-control="levelBadge"], [data-content-plugin-level-badge], [data-level-badge]),
[data-visual-card-plugin-bound~="version"] :is([data-content-plugin-control="version"], [data-content-plugin-version], [data-release-version]) {
  font-variant-numeric: tabular-nums;
}
[data-visual-card-plugin-bound~="icon"] [data-content-plugin-control="icon"] {
  min-inline-size: var(--tradepro-shared-plugin-icon-width, 5.625rem);
}
[data-visual-card-plugin-bound~="statusActions"] [data-content-plugin-actions="status"] {
  display: inline-flex;
  gap: 0;
  overflow: hidden;
  border-radius: 9999px;
}
[data-visual-card-plugin-bound~="actions"] [data-content-plugin-actions] {
  gap: var(--tradepro-shared-plugin-gap, 0.5rem);
}
[data-visual-card-plugin-bound~="loading"] :is([data-loading-state="true"], [data-preview-loading="true"], [data-site-switch-loading-card]) {
  cursor: progress;
}
[data-visual-card-plugin-bound~="lock"] :is([data-layout-lock-control], [data-page-layout-lock], [data-nav-layout-lock])[data-state="locked"] {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--tradepro-shared-plugin-accent, currentColor) 24%, transparent);
}
@media (prefers-reduced-motion: reduce) {
  [data-visual-card-plugin-applied~="hover"] {
    transition: none;
  }
  [data-visual-card-plugin-applied~="hover"]:is(:hover, :focus-within):not(:has([data-visual-card-plugin-applied~="hover"]:is(:hover, :focus-within))) {
    translate: none;
  }
}
`;

const runtimeStates = new WeakMap<HTMLElement, RuntimeState>();
const runtimeDocumentCounts = new Map<Document, number>();

function normalizePluginIds(pluginIds: readonly KnownContentPluginId[]) {
  const normalized: KnownContentPluginId[] = [];
  pluginIds.forEach((pluginId) => {
    if (!isKnownContentPluginId(pluginId) || normalized.includes(pluginId)) return;
    normalized.push(pluginId);
  });
  return normalized;
}

function snapshotRuntimeAttributes(target: HTMLElement) {
  return new Map(TARGET_RUNTIME_ATTRIBUTES.map((attribute) => [attribute, target.getAttribute(attribute)]));
}

function restoreRuntimeAttributes(state: RuntimeState) {
  state.originalAttributes.forEach((value, attribute) => {
    if (value === null) state.target.removeAttribute(attribute);
    else state.target.setAttribute(attribute, value);
  });
}

function installRuntimeStyles(document: Document) {
  const currentCount = runtimeDocumentCounts.get(document) || 0;
  runtimeDocumentCounts.set(document, currentCount + 1);
  if (document.getElementById(RUNTIME_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = RUNTIME_STYLE_ID;
  style.setAttribute("data-visual-card-plugin-runtime-style", "true");
  style.textContent = RUNTIME_CSS;
  (document.head || document.documentElement).appendChild(style);
}

function releaseRuntimeStyles(document: Document) {
  const nextCount = Math.max(0, (runtimeDocumentCounts.get(document) || 0) - 1);
  if (nextCount > 0) {
    runtimeDocumentCounts.set(document, nextCount);
    return;
  }
  runtimeDocumentCounts.delete(document);
  const style = document.getElementById(RUNTIME_STYLE_ID);
  if (style?.getAttribute("data-visual-card-plugin-runtime-style") === "true") style.remove();
}

function getAssociatedPageScope(target: HTMLElement) {
  const roots: HTMLElement[] = [target];
  const regionId = target.getAttribute("data-visual-card-runtime-region");
  if (regionId === "total-frame" || regionId === "footer") {
    const appShell = target.closest<HTMLElement>(".app-shell")
      || target.ownerDocument.querySelector<HTMLElement>("#root");
    if (appShell && appShell !== target) roots.push(appShell);
  }
  return roots;
}

function readTargetRegionId(target: HTMLElement) {
  return target.getAttribute("data-visual-card-runtime-region")
    || target.getAttribute("data-content-plugin-owner-region")
    || target.getAttribute("data-development-standard-frame-region");
}

function belongsToPluginScope(target: HTMLElement, element: Element) {
  const targetRegionId = readTargetRegionId(target);
  const explicitOwner = element.closest<HTMLElement>("[data-content-plugin-owner-region]")
    ?.getAttribute("data-content-plugin-owner-region")
    ?.trim();
  if (explicitOwner) return Boolean(targetRegionId) && explicitOwner === targetRegionId;

  const targetBoundary = target.matches(PLUGIN_SCOPE_BOUNDARY_SELECTOR)
    ? target
    : target.closest<HTMLElement>(PLUGIN_SCOPE_BOUNDARY_SELECTOR);
  const elementBoundary = element.closest<HTMLElement>(PLUGIN_SCOPE_BOUNDARY_SELECTOR);
  return Boolean(targetBoundary) && elementBoundary === targetBoundary;
}

function findCapabilityElements(target: HTMLElement, pluginId: KnownContentPluginId) {
  const selectors = EXISTING_CAPABILITY_SELECTORS[pluginId] || [];
  const matches = new Set<Element>();
  const roots = pluginId === "lock" || pluginId === "version" ? getAssociatedPageScope(target) : [target];
  roots.forEach((root) => {
    selectors.forEach((selector) => {
      try {
        if (root.matches(selector) && belongsToPluginScope(target, root)) matches.add(root);
        root.querySelectorAll(selector).forEach((element) => {
          if (belongsToPluginScope(target, element)) matches.add(element);
        });
      } catch {
        // A browser without one optional selector feature must not break every
        // other plugin. The unsupported probe simply remains unavailable.
      }
    });
  });
  return matches;
}

function isTableSemanticElement(target: HTMLElement) {
  return /^(TABLE|THEAD|TBODY|TFOOT|TR|TH|TD|COLGROUP|COL)$/.test(target.tagName);
}

function findTableShellScrollOwners(target: HTMLElement) {
  const owners = Array.from(target.querySelectorAll<HTMLElement>(SCROLL_OWNER_SELECTOR));
  return owners.filter((owner) => {
    const shellBoundary = owner.closest<HTMLElement>(
      '[data-visual-card-runtime-region="table-shell"], [data-development-standard-frame-region="table-shell"]',
    );
    return !shellBoundary || shellBoundary === target;
  });
}

function evaluateVisualPlugin(target: HTMLElement, pluginId: KnownContentPluginId): VisualCardPluginRuntimeResult {
  const label = getContentPluginDefinition(pluginId).label;
  if ((pluginId === "compact" || pluginId === "split" || pluginId === "scroll") && isTableSemanticElement(target)) {
    return {
      pluginId,
      label,
      kind: "visual",
      status: "unavailable",
      effective: false,
      matchedElementCount: 0,
      message: "当前目标是表格语义元素；为保护列、行与滚动契约，未强行改写其结构。",
    };
  }
  if (pluginId === "scroll") {
    if (target.matches(SCROLL_OWNER_SELECTOR)) {
      return {
        pluginId,
        label,
        kind: "visual",
        status: "applied",
        effective: true,
        matchedElementCount: 1,
        message: "已应用到页面声明的唯一内容滚动承载区。",
      };
    }
    if (readTargetRegionId(target) === "table-shell") {
      const owners = findTableShellScrollOwners(target);
      if (owners.length) {
        return {
          pluginId,
          label,
          kind: "visual",
          status: "bound",
          effective: true,
          matchedElementCount: owners.length,
          message: `表内不创建第二滚动源；已绑定 ${owners.length} 个实际内容滚动承载区。`,
        };
      }
      return {
        pluginId,
        label,
        kind: "visual",
        status: "unavailable",
        effective: false,
        matchedElementCount: 0,
        message: "表内未找到显式 data-page-list-scroll-owner，未创建第二滚动源。",
      };
    }
    return {
      pluginId,
      label,
      kind: "visual",
      status: "unavailable",
      effective: false,
      matchedElementCount: 0,
      message: "当前区域不是显式内容滚动承载区，未强制改写 overflow。",
    };
  }
  if (pluginId === "split" && target.children.length < 2) {
    return {
      pluginId,
      label,
      kind: "visual",
      status: "unavailable",
      effective: false,
      matchedElementCount: target.children.length,
      message: "当前区域不足两个真实子内容，未创建占位列或伪内容。",
    };
  }
  return {
    pluginId,
    label,
    kind: "visual",
    status: "applied",
    effective: true,
    matchedElementCount: 1,
    message: "已直接应用到实际页面区域，并读取共享契约变量。",
  };
}

function evaluateBoundPlugin(target: HTMLElement, pluginId: KnownContentPluginId): VisualCardPluginRuntimeResult {
  const matches = findCapabilityElements(target, pluginId);
  const label = getContentPluginDefinition(pluginId).label;
  const kind: VisualCardPluginRuntimeKind = BUSINESS_CAPABILITY_PLUGINS.has(pluginId)
    ? "business-capability"
    : "control";
  if (!matches.size) {
    return {
      pluginId,
      label,
      kind,
      status: "unavailable",
      effective: false,
      matchedElementCount: 0,
      message: kind === "business-capability"
        ? "当前区域未找到页面已注册的真实业务能力；未创建替代按钮、状态或数据。"
        : "当前区域未找到对应的真实控件或状态；未创建无回调的假控件。",
    };
  }
  return {
    pluginId,
    label,
    kind,
    status: "bound",
    effective: true,
    matchedElementCount: matches.size,
    message: kind === "business-capability"
      ? `已非侵入绑定 ${matches.size} 个页面现有业务能力；数据与回调仍由页面拥有。`
      : `已绑定 ${matches.size} 个真实控件或状态，并复用共享插件样式。`,
  };
}

function buildReport(target: HTMLElement, pluginIds: readonly KnownContentPluginId[]): VisualCardPluginRuntimeReport {
  const results = pluginIds.map((pluginId) => (
    DIRECT_VISUAL_PLUGINS.has(pluginId)
      ? evaluateVisualPlugin(target, pluginId)
      : evaluateBoundPlugin(target, pluginId)
  ));
  return {
    requestedPluginIds: [...pluginIds],
    effectivePluginIds: results.filter((result) => result.effective).map((result) => result.pluginId),
    unavailablePluginIds: results.filter((result) => !result.effective).map((result) => result.pluginId),
    results,
  };
}

function reportSignature(report: VisualCardPluginRuntimeReport) {
  return report.results
    .map((result) => `${result.pluginId}:${result.status}:${result.matchedElementCount}`)
    .join("|");
}

function writeReportAttributes(target: HTMLElement, report: VisualCardPluginRuntimeReport) {
  const applied = report.results.filter((result) => result.status === "applied").map((result) => result.pluginId);
  const bound = report.results.filter((result) => result.status === "bound").map((result) => result.pluginId);
  target.setAttribute("data-visual-card-plugin-runtime", report.requestedPluginIds.join(" "));
  if (applied.length) target.setAttribute("data-visual-card-plugin-applied", applied.join(" "));
  else target.removeAttribute("data-visual-card-plugin-applied");
  if (bound.length) target.setAttribute("data-visual-card-plugin-bound", bound.join(" "));
  else target.removeAttribute("data-visual-card-plugin-bound");
  if (report.effectivePluginIds.length) target.setAttribute("data-visual-card-plugin-effective", report.effectivePluginIds.join(" "));
  else target.removeAttribute("data-visual-card-plugin-effective");
  if (report.unavailablePluginIds.length) target.setAttribute("data-visual-card-plugin-unavailable", report.unavailablePluginIds.join(" "));
  else target.removeAttribute("data-visual-card-plugin-unavailable");
}

function refreshReport(state: RuntimeState) {
  if (state.cleared) return;
  const nextReport = buildReport(state.target, state.pluginIds);
  const changed = reportSignature(nextReport) !== reportSignature(state.report);
  state.report = nextReport;
  writeReportAttributes(state.target, nextReport);
  if (changed) state.options.onReportChange?.(nextReport);
}

function scheduleReportRefresh(state: RuntimeState) {
  if (state.cleared || state.reportScheduled) return;
  state.reportScheduled = true;
  queueMicrotask(() => {
    state.reportScheduled = false;
    refreshReport(state);
  });
}

function updateResponsiveSize(target: HTMLElement) {
  const width = target.getBoundingClientRect().width || target.clientWidth;
  const size = width > 0 && width <= 520 ? "compact" : width > 0 && width <= 960 ? "medium" : "wide";
  target.setAttribute("data-visual-card-plugin-responsive-size", size);
}

function observeResponsiveSize(state: RuntimeState) {
  if (!state.pluginIds.includes("responsive")) return;
  updateResponsiveSize(state.target);
  const view = state.document.defaultView;
  const ResizeObserverConstructor = view?.ResizeObserver;
  if (ResizeObserverConstructor) {
    state.resizeObserver = new ResizeObserverConstructor(() => {
      if (!state.cleared) updateResponsiveSize(state.target);
    });
    state.resizeObserver.observe(state.target);
    return;
  }
  if (!view) return;
  state.fallbackResizeListener = () => {
    if (!state.cleared) updateResponsiveSize(state.target);
  };
  view.addEventListener("resize", state.fallbackResizeListener, { passive: true });
}

function observeCapabilityChanges(state: RuntimeState) {
  if (state.options.observe === false || state.pluginIds.every((pluginId) => DIRECT_VISUAL_PLUGINS.has(pluginId))) return;
  const view = state.document.defaultView;
  const MutationObserverConstructor = view?.MutationObserver;
  if (!MutationObserverConstructor) return;
  state.mutationObserver = new MutationObserverConstructor(() => scheduleReportRefresh(state));
  const observerOptions: MutationObserverInit = {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [...OBSERVED_CAPABILITY_ATTRIBUTES],
  };
  state.mutationObserver.observe(state.target, observerOptions);
  if (state.pluginIds.some((pluginId) => pluginId === "lock" || pluginId === "version")) {
    getAssociatedPageScope(state.target).slice(1).forEach((scope) => state.mutationObserver?.observe(scope, observerOptions));
  }
}

/**
 * Applies only safe visual effects and binds only controls that already exist
 * in the real page. The returned report is suitable for an editor's
 * “已生效 / 当前页面不可用” display.
 */
export function applyVisualCardPluginRuntime(
  target: HTMLElement,
  pluginIds: readonly KnownContentPluginId[],
  options: VisualCardPluginRuntimeOptions = {},
): VisualCardPluginRuntimeReport {
  clearVisualCardPluginRuntime(target);
  const normalizedPluginIds = normalizePluginIds(pluginIds);
  const report = buildReport(target, normalizedPluginIds);
  if (!normalizedPluginIds.length) return report;

  const state: RuntimeState = {
    target,
    document: target.ownerDocument,
    pluginIds: normalizedPluginIds,
    options,
    originalAttributes: snapshotRuntimeAttributes(target),
    report,
    reportScheduled: false,
    cleared: false,
  };
  runtimeStates.set(target, state);
  installRuntimeStyles(state.document);
  writeReportAttributes(target, report);
  observeResponsiveSize(state);
  observeCapabilityChanges(state);
  options.onReportChange?.(report);
  return report;
}

/** Removes every runtime marker, observer, event fallback and injected style. */
export function clearVisualCardPluginRuntime(target: HTMLElement) {
  const state = runtimeStates.get(target);
  if (!state) {
    TARGET_RUNTIME_ATTRIBUTES.forEach((attribute) => target.removeAttribute(attribute));
    return;
  }
  state.cleared = true;
  state.mutationObserver?.disconnect();
  state.resizeObserver?.disconnect();
  const view = state.document.defaultView;
  if (view && state.fallbackResizeListener) view.removeEventListener("resize", state.fallbackResizeListener);
  restoreRuntimeAttributes(state);
  runtimeStates.delete(target);
  releaseRuntimeStyles(state.document);
}

export function getVisualCardPluginRuntimeReport(target: HTMLElement) {
  return runtimeStates.get(target)?.report || null;
}

/** Read-only capability probe used by the editor before a plugin is enabled. */
export function inspectVisualCardPluginRuntime(
  target: HTMLElement,
  pluginIds: readonly KnownContentPluginId[],
) {
  return buildReport(target, normalizePluginIds(pluginIds));
}
