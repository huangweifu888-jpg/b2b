import {
  RESPONSIVE_SHELL_FUNCTION_KEY_SELECTOR,
  RESPONSIVE_SHELL_FACTORY_DEFAULT,
  resolveResponsiveShellMode,
  resolveResponsiveShellStage,
  resolveServiceExpertColumnCount,
  resolveResponsiveVerticalStage,
  type ResponsiveShellStage,
  type ResponsiveVerticalStage,
} from "./responsive-shell-contract";
import { GLOBAL_RESPONSIVE_PAGE_FACTORY_DEFAULT } from "./global-responsive-page-contract";
import { ADAPTIVE_STRUCTURE_FACTORY_DEFAULT } from "./adaptive-structure-contract";
import { SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT } from "./shared-adaptive-surface-contract";
import {
  EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT,
  existingWorkspaceBodyMarkerHitAreaMatchesGeometry,
  findExistingWorkspaceBodyMarkerHitArea,
  findExistingWorkspaceBodyMarkerHost,
} from "./layout-frame-contract";

export type ResponsiveLearningIssueId =
  | "horizontal-overflow"
  | "missing-navigation"
  | "navigation-branch-mismatch"
  | "topbar-overflow"
  | "topbar-popover-invalid"
  | "page-tools-invalid"
  | "page-tools-capacity-mismatch"
  | "page-tools-redundant-heading"
  | "page-tools-settings-overflow"
  | "page-tools-batch-style-mismatch"
  | "shared-surface-mismatch"
  | "theme-palette-mismatch"
  | "shared-action-mismatch"
  | "shared-interaction-mismatch"
  | "function-key-height-mismatch"
  | "function-key-frame-mismatch"
  | "semantic-page-tools-missing"
  | "semantic-band-not-collapsed"
  | "footer-capacity-mismatch"
  | "footer-wrap-mismatch"
  | "visual-launcher-overlap"
  | "split-action-order"
  | "hidden-primary-action"
  | "undersized-primary-target"
  | "chrome-budget-exceeded"
  | "content-viewport-starved"
  | "multiple-sticky-bands"
  | "missing-page-host"
  | "page-host-template-mismatch"
  | "page-host-content-overflow"
  | "capacity-layout-mismatch"
  | "premature-capacity-wrap"
  | "adaptive-structure-missing"
  | "adaptive-structure-overflow"
  | "adaptive-choice-grid-mismatch"
  | "mobile-application-frame-missing"
  | "mobile-collection-overflow"
  | "mobile-editor-density-mismatch"
  | "module-editor-capacity-mismatch"
  | "module-category-capacity-mismatch"
  | "product-market-category-contract-mismatch"
  | "layout-section-editor-capacity-mismatch"
  | "service-expert-capacity-mismatch"
  | "mobile-primary-navigation-mismatch"
  | "compressed-readable-text"
  | "floating-service-overlap"
  | "shared-adaptive-surface-missing"
  | "duplicate-live-surface"
  | "live-surface-proxy-active"
  | "live-surface-copy-mismatch"
  | "title-action-capacity-mismatch"
  | "context-marker-placement-mismatch";

export type ResponsiveLearningRecommendationId =
  | "container-capacity-reflow"
  | "semantic-title-live-surface"
  | "complex-editor-single-column"
  | "floating-service-footer-safe-area"
  | "primary-action-continuity"
  | "shared-plugin-parity";

export type ResponsiveLearningObservation = {
  contractVersion: string;
  scope: string;
  route: string;
  width: number;
  height: number;
  stage: ResponsiveShellStage;
  verticalStage: ResponsiveVerticalStage;
  mode: string;
  chromeRatio: number;
  contentRatio: number;
  verticalFocus: boolean;
  topbarDisclosure: "not-applicable" | "collapsed" | "expanded";
  issues: ResponsiveLearningIssueId[];
  recommendations: ResponsiveLearningRecommendationId[];
  measuredAt: string;
};

export function resolveResponsiveLearningRecommendations(issues: Iterable<ResponsiveLearningIssueId>) {
  const recommendations = new Set<ResponsiveLearningRecommendationId>();
  for (const issue of issues) {
    if (issue === "compressed-readable-text" || issue === "semantic-page-tools-missing" || issue === "live-surface-copy-mismatch") {
      recommendations.add("semantic-title-live-surface");
    } else if (issue === "mobile-editor-density-mismatch") {
      recommendations.add("complex-editor-single-column");
    } else if (issue === "floating-service-overlap") {
      recommendations.add("floating-service-footer-safe-area");
    } else if (issue === "hidden-primary-action" || issue === "undersized-primary-target" || issue === "missing-navigation") {
      recommendations.add("primary-action-continuity");
    } else if (issue.includes("overflow") || issue.includes("capacity") || issue.includes("wrap")) {
      recommendations.add("container-capacity-reflow");
    } else {
      recommendations.add("shared-plugin-parity");
    }
  }
  return Array.from(recommendations);
}

function isVisible(element: HTMLElement) {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}

function isVisibleWithinViewport(element: HTMLElement) {
  if (!isVisible(element)) return false;
  const rect = element.getBoundingClientRect();
  return rect.bottom >= 0
    && rect.right >= 0
    && rect.top <= window.innerHeight
    && rect.left <= window.innerWidth;
}

function isIntentionallyCollapsed(element: HTMLElement, width: number, height: number) {
  const independentToolsActive = width <= RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.activationMax
    || height <= RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBreakpoints.focusMax;
  if (element.matches("[data-responsive-nav-trigger]") && width >= RESPONSIVE_SHELL_FACTORY_DEFAULT.breakpoints.desktopMin) return true;
  if (element.matches("[data-responsive-topbar-toggle]") && width >= RESPONSIVE_SHELL_FACTORY_DEFAULT.breakpoints.desktopMin) return true;
  if (element.matches("[data-responsive-toolbar-trigger]") && !independentToolsActive) return true;
  const toolRail = element.closest<HTMLElement>("[data-responsive-independent-tools]");
  const toolsOverflowed = toolRail?.dataset.responsiveToolsOverflowed === "true";
  if (toolsOverflowed && element.matches("[data-responsive-toolbar-trigger='page-context'], [data-responsive-toolbar-trigger='theme']")) return true;
  if (!toolsOverflowed && element.matches("[data-responsive-toolbar-trigger='overflow']")) return true;
  const compactContent = element.closest<HTMLElement>(".client-source-topbar-content");
  if (compactContent && !compactContent.classList.contains("is-expanded")) return true;
  const shellToolsContent = element.closest<HTMLElement>("[data-responsive-topbar-content]");
  const shellToolsTopbar = shellToolsContent?.parentElement?.closest<HTMLElement>("[data-responsive-topbar]");
  if (shellToolsContent && (!isVisible(shellToolsContent) || shellToolsTopbar?.dataset.responsiveShellToolsExpanded !== "true")) return true;
  if (element.closest<HTMLElement>("[data-client-page-footer][data-client-project-footer-hidden='true']")) return true;
  const pageToolsContent = element.closest<HTMLElement>("[data-responsive-page-tools-popover]");
  return Boolean(pageToolsContent && !pageToolsContent.classList.contains("is-expanded"));
}

function normalizeRadius(value: string) {
  return Number.parseFloat(value) || 0;
}

function resolveVisibleTableHeaderEdgeCells(surface: HTMLElement) {
  if (surface.tagName !== "THEAD") return null;
  const cells = Array.from(surface.querySelectorAll<HTMLElement>(":scope > tr > :is(th, td)"))
    .filter(isVisible);
  if (cells.length === 0) return null;
  return { first: cells[0], last: cells[cells.length - 1] };
}

function hasExpectedSharedSurfaceGeometry(surface: HTMLElement) {
  const identity = surface.dataset.responsiveSharedSurface;
  const style = getComputedStyle(surface);
  if (surface.dataset.responsiveSharedSurfacePlugin !== RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedSurfaces.plugin) return false;
  if (identity === "top" || identity === "title-2") {
    return [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomLeftRadius, style.borderBottomRightRadius]
      .every((radius) => normalizeRadius(radius) <= 1);
  }
  if (identity === "title-1") {
    return normalizeRadius(style.borderTopLeftRadius) > 1
      && normalizeRadius(style.borderTopRightRadius) > 1
      && normalizeRadius(style.borderBottomLeftRadius) <= 1
      && normalizeRadius(style.borderBottomRightRadius) <= 1;
  }
  if (identity === "table-header") {
    const edgeCells = resolveVisibleTableHeaderEdgeCells(surface);
    if (edgeCells) {
      const firstStyle = getComputedStyle(edgeCells.first);
      const lastStyle = getComputedStyle(edgeCells.last);
      return normalizeRadius(firstStyle.borderTopLeftRadius) > 1
        && normalizeRadius(firstStyle.borderBottomLeftRadius) > 1
        && normalizeRadius(lastStyle.borderTopRightRadius) > 1
        && normalizeRadius(lastStyle.borderBottomRightRadius) > 1;
    }
    if (surface.tagName === "THEAD") return false;
    return normalizeRadius(style.borderTopLeftRadius) > 1 && normalizeRadius(style.borderBottomLeftRadius) > 1;
  }
  return false;
}

export function collectResponsiveLearningObservation(
  scope: string,
  width: number,
  height = window.innerHeight,
): ResponsiveLearningObservation {
  const issues = new Set<ResponsiveLearningIssueId>();
  const shell = document.querySelector<HTMLElement>(`[data-responsive-shell="${scope}"]`) || document.querySelector<HTMLElement>("[data-responsive-shell]");
  if (shell && shell.scrollWidth > shell.clientWidth + 1) issues.add("horizontal-overflow");
  if (document.documentElement.dataset.responsiveSidebarNavigationPolicy !== RESPONSIVE_SHELL_FACTORY_DEFAULT.sidebarNavigation.strategy) {
    issues.add("navigation-branch-mismatch");
  }
  const sidebarDisclosure = shell?.querySelector<HTMLElement>("[data-shared-sidebar-disclosure-contract]");
  if (sidebarDisclosure
    && sidebarDisclosure.dataset.sharedSidebarDisclosureContract !== RESPONSIVE_SHELL_FACTORY_DEFAULT.sidebarNavigation.strategy) {
    issues.add("navigation-branch-mismatch");
  }
  const pageHost = shell?.querySelector<HTMLElement>("[data-responsive-page-host]") || null;
  if (!pageHost) issues.add("missing-page-host");
  else {
    if (!pageHost.dataset.responsivePageTemplate || !pageHost.dataset.responsivePageContainerStage) {
      issues.add("page-host-template-mismatch");
    }
    if (pageHost.scrollWidth > pageHost.clientWidth + 1) issues.add("page-host-content-overflow");
    if (pageHost.dataset.responsiveCapacityLayout !== RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.plugin
      || document.documentElement.dataset.responsiveCapacityLayoutPolicy !== RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.strategy) {
      issues.add("capacity-layout-mismatch");
    }
    if (pageHost.dataset.responsiveAdaptiveStructure !== ADAPTIVE_STRUCTURE_FACTORY_DEFAULT.id
      || pageHost.dataset.responsiveAdaptiveStructureVersion !== ADAPTIVE_STRUCTURE_FACTORY_DEFAULT.version
      || document.documentElement.dataset.responsiveAdaptiveStructure !== ADAPTIVE_STRUCTURE_FACTORY_DEFAULT.version) {
      issues.add("adaptive-structure-missing");
    }
    if (pageHost.dataset.sharedAdaptiveSurfaceContract !== SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.version
      || pageHost.dataset.sharedAdaptiveSurfaceStrategy !== SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.strategy
      || document.documentElement.dataset.sharedAdaptiveSurfaceContract !== SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.version
      || document.documentElement.dataset.sharedAdaptiveSurfaceStrategy !== SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.strategy) {
      issues.add("shared-adaptive-surface-missing");
    }
    const sharedContent = pageHost.matches("[data-shared-adaptive-surface='content'][data-shared-adaptive-surface-source='desktop']")
      ? pageHost
      : pageHost.querySelector<HTMLElement>("[data-shared-adaptive-surface='content'][data-shared-adaptive-surface-source='desktop']");
    const sharedFooter = shell?.querySelector<HTMLElement>("[data-shared-adaptive-surface='footer'][data-shared-adaptive-surface-source='desktop']");
    if (!sharedContent || !sharedFooter) issues.add("shared-adaptive-surface-missing");
  }

  if (document.documentElement.dataset.responsiveTitleActionPolicy !== RESPONSIVE_SHELL_FACTORY_DEFAULT.titleActionCapacity.strategy
    || document.documentElement.dataset.responsiveTitleActionPlugin !== RESPONSIVE_SHELL_FACTORY_DEFAULT.titleActionCapacity.plugin) {
    issues.add("title-action-capacity-mismatch");
  }

  if (document.documentElement.dataset.responsiveContextMarkerPolicy !== RESPONSIVE_SHELL_FACTORY_DEFAULT.contextMarkers.strategy
    || document.documentElement.dataset.responsiveContextMarkerPlugin !== RESPONSIVE_SHELL_FACTORY_DEFAULT.contextMarkers.plugin
    || document.documentElement.dataset.responsiveWorkspaceMarkerPlacement !== RESPONSIVE_SHELL_FACTORY_DEFAULT.contextMarkers.workspacePlacement) {
    issues.add("context-marker-placement-mismatch");
  }

  const workspaceMarker = pageHost?.querySelector<HTMLElement>(
    EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector,
  );
  if (workspaceMarker) {
    const markerHost = findExistingWorkspaceBodyMarkerHost(workspaceMarker);
    const markerHitArea = findExistingWorkspaceBodyMarkerHitArea(workspaceMarker);
    const markerStyle = markerHost ? getComputedStyle(markerHost, "::after") : null;
    const markerHitAreaStyle = markerHitArea ? getComputedStyle(markerHitArea) : null;
    const markerLeft = Number.parseFloat(markerStyle?.left || "");
    const placementMatches = workspaceMarker.dataset.developmentStandardMarkerPlacement
      === RESPONSIVE_SHELL_FACTORY_DEFAULT.contextMarkers.workspacePlacement;
    const hostGutter = markerHost
      ? workspaceMarker.getBoundingClientRect().left - markerHost.getBoundingClientRect().left
      : 0;
    const hostGutterRequired = width > RESPONSIVE_SHELL_FACTORY_DEFAULT.contextMarkers.compactMaximum
      || workspaceMarker.dataset.developmentStandardMarkerVisibility === "always"
      || markerHost?.dataset.visualCardAnnotationVisibility === "always"
      || markerHost?.dataset.developerGlobalFrameAnnotationVisible === "true";
    // Compact layouts intentionally suppress the workspace marker and do not
    // reserve its pointer gutter.  The remaining inline page padding is normal
    // layout spacing, not evidence that a marker hit area is missing.
    const compactMarkerSuppressed = !hostGutterRequired;
    const markerHitAreaInvalid = markerHitArea
      ? !markerHitAreaStyle
        || (hostGutterRequired && !existingWorkspaceBodyMarkerHitAreaMatchesGeometry(workspaceMarker))
        || (hostGutterRequired
          ? markerHitAreaStyle.pointerEvents === "none" || markerHitAreaStyle.visibility === "hidden"
          : markerHitAreaStyle.pointerEvents !== "none" || markerHitAreaStyle.visibility !== "hidden")
      : !compactMarkerSuppressed;
    if (!placementMatches
      || !markerStyle
      || markerHitAreaInvalid
      || !Number.isFinite(markerLeft)
      || markerLeft < 0
      || (hostGutterRequired
        && hostGutter + RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.measurementTolerance
          < RESPONSIVE_SHELL_FACTORY_DEFAULT.contextMarkers.minimumHostGutter)) {
      issues.add("context-marker-placement-mismatch");
    }
  }

  const titleActionRails = Array.from(pageHost?.querySelectorAll<HTMLElement>("[data-page-title-actions]") || []);
  for (const rail of titleActionRails) {
    const controls = Array.from(rail.children).filter((element): element is HTMLElement => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
    if (!controls.length) continue;
    const railRect = rail.getBoundingClientRect();
    const railStyle = getComputedStyle(rail);
    const gap = Number.parseFloat(railStyle.columnGap || railStyle.gap) || 0;
    const requiredWidth = controls.reduce((total, control) => total + Math.max(control.scrollWidth, control.getBoundingClientRect().width), 0)
      + Math.max(0, controls.length - 1) * gap;
    if (railRect.width <= RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.measurementTolerance) {
      issues.add("title-action-capacity-mismatch");
      break;
    }

    const titleLayout = rail.closest<HTMLElement>("[data-responsive-live-title-layout], [data-product-market-title-main]");
    const titleContent = titleLayout?.querySelector<HTMLElement>("[data-page-title-content], [data-responsive-generated-title-content='true']");
    const layoutWidth = titleLayout?.getBoundingClientRect().width || 0;
    const nonCompactTitleRail = width > RESPONSIVE_SHELL_FACTORY_DEFAULT.titleActionCapacity.compactMaximum;
    const enoughInlineCapacity = nonCompactTitleRail
      && requiredWidth
        + RESPONSIVE_SHELL_FACTORY_DEFAULT.titleActionCapacity.minimumTitleReserve
        + RESPONSIVE_SHELL_FACTORY_DEFAULT.titleActionCapacity.titleActionGap
        <= layoutWidth + RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.measurementTolerance;
    if (nonCompactTitleRail && titleContent) {
      const titleRect = titleContent.getBoundingClientRect();
      const firstControlTop = controls[0].getBoundingClientRect().top;
      const controlsWrap = controls.some((control) => Math.abs(control.getBoundingClientRect().top - firstControlTop) > 2);
      const centerDrift = Math.abs((railRect.top + railRect.bottom) / 2 - (titleRect.top + titleRect.bottom) / 2);
      if (railStyle.flexWrap !== "nowrap" || controlsWrap || (enoughInlineCapacity && centerDrift > 2)) {
        issues.add("title-action-capacity-mismatch");
        break;
      }
    }
  }

  const capacityRows = Array.from(pageHost?.querySelectorAll<HTMLElement>("[data-responsive-capacity-row]") || []).filter(isVisible);
  for (const row of capacityRows) {
    const style = getComputedStyle(row);
    const ownsAdaptiveItemGrid = Boolean(row.closest("[data-responsive-structure-item]"));
    const ownsTitleActionGrid = row.matches("[data-responsive-live-title-layout], [data-product-market-title-main]")
      && Boolean(row.querySelector("[data-page-title-actions]"));
    const ownsTitleActionRail = row.matches("[data-page-title-actions]");
    const validFlow = ownsTitleActionRail
      ? style.display === "flex"
      : ownsAdaptiveItemGrid || ownsTitleActionGrid
        ? style.display === "grid" || (style.display === "flex" && style.flexWrap !== "nowrap")
        : style.display === "flex" && style.flexWrap !== "nowrap";
    const ownsScrollableTitleActionRail = ownsTitleActionRail && row.dataset.responsiveTitleActionScroll === "true";
    if (!validFlow || (!ownsScrollableTitleActionRail && row.scrollWidth > row.clientWidth + 1)) {
      issues.add("capacity-layout-mismatch");
      break;
    }
    const primary = row.querySelector<HTMLElement>("[data-responsive-capacity-primary]");
    if (style.display === "flex" && row.dataset.responsiveCapacityFlow === "wrapped" && primary) {
      const configuredMinimum = style.getPropertyValue("--responsive-capacity-row-min-content").trim();
      const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const configuredMinimumPixels = configuredMinimum.endsWith("rem")
        ? Number.parseFloat(configuredMinimum) * rootFontSize
        : configuredMinimum.endsWith("px")
          ? Number.parseFloat(configuredMinimum)
          : 0;
      const required = primary.scrollWidth
        + Math.max(RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.rowMinimumContent, configuredMinimumPixels || 0)
        + RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.rowGap;
      if (row.clientWidth + RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.measurementTolerance >= required) {
        issues.add("premature-capacity-wrap");
        break;
      }
    }
  }
  const capacityGrids = Array.from(pageHost?.querySelectorAll<HTMLElement>("[data-responsive-capacity-grid]") || []).filter(isVisible);
  if (capacityGrids.some((grid) => getComputedStyle(grid).display !== "grid" || grid.scrollWidth > grid.clientWidth + 1)) {
    issues.add("capacity-layout-mismatch");
  }
  const adaptiveItems = Array.from(pageHost?.querySelectorAll<HTMLElement>("[data-responsive-structure-role='item']") || []).filter(isVisible);
  if (adaptiveItems.some((item) => item.scrollWidth > item.clientWidth + 1)) {
    issues.add("adaptive-structure-overflow");
  }
  const adaptiveChoiceGrids = Array.from(pageHost?.querySelectorAll<HTMLElement>("[data-responsive-structure-role='choice-grid']") || []).filter(isVisible);
  if (adaptiveChoiceGrids.some((grid) => getComputedStyle(grid).display !== "grid" || grid.scrollWidth > grid.clientWidth + 1)) {
    issues.add("adaptive-choice-grid-mismatch");
  }
  const moduleEditorPolicy = RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.moduleEditor;
  const moduleEditorRows = Array.from(pageHost?.querySelectorAll<HTMLElement>("[data-responsive-capacity-row='module-editor']") || []).filter(isVisible);
  for (const moduleEditorRow of moduleEditorRows) {
    const moduleEditor = moduleEditorRow.closest<HTMLElement>("[data-responsive-structure-item='module']");
    if (!moduleEditor) continue;
    const moduleWidth = moduleEditor.getBoundingClientRect().width;
    const operation = moduleEditorRow.querySelector<HTMLElement>(".adaptive-work-matrix-operation-grid");
    const status = moduleEditorRow.querySelector<HTMLElement>("[data-content-plugin-actions='status']");
    const hierarchy = moduleEditorRow.querySelector<HTMLElement>(".adaptive-work-matrix-sort-cell");
    const fields = Array.from(moduleEditorRow.querySelectorAll<HTMLElement>(".product-module-detail-grid input")).filter(isVisible);
    if (!operation || !status || !hierarchy || moduleEditorRow.scrollWidth > moduleEditorRow.clientWidth + 1) {
      issues.add("module-editor-capacity-mismatch");
      break;
    }
    const operationRect = operation.getBoundingClientRect();
    const statusRect = status.getBoundingClientRect();
    const statusStyle = getComputedStyle(status);
    const compactStatusGroup = ["flex", "inline-flex"].includes(statusStyle.display)
      && statusRect.width < operationRect.width - 2;
    const operationChildRects = Array.from(operation.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement && isVisible(child))
      .map((child) => child.getBoundingClientRect());
    const operationSingleLine = operationChildRects.length > 0
      && Math.max(...operationChildRects.map((rect) => rect.top)) - Math.min(...operationChildRects.map((rect) => rect.top)) <= 2;
    if (moduleWidth >= moduleEditorPolicy.mediumInlineMinimum
      && (Math.abs(operationRect.top - hierarchy.getBoundingClientRect().top) > 2 || !compactStatusGroup || !operationSingleLine)) {
      issues.add("module-editor-capacity-mismatch");
      break;
    }
    if (moduleWidth >= moduleEditorPolicy.twoFieldMinimum && fields.length >= 2) {
      const firstField = fields[0].getBoundingClientRect();
      const secondField = fields[1].getBoundingClientRect();
      if (Math.abs(firstField.top - secondField.top) > 2 || Math.abs(firstField.left - secondField.left) < 2) {
        issues.add("module-editor-capacity-mismatch");
        break;
      }
    }
    if (moduleWidth > moduleEditorPolicy.extremeStackMaximum && moduleWidth < moduleEditorPolicy.mediumInlineMinimum
      && !compactStatusGroup) {
      issues.add("module-editor-capacity-mismatch");
      break;
    }
    if (moduleWidth <= moduleEditorPolicy.extremeStackMaximum) {
      const statusButtons = Array.from(status.querySelectorAll<HTMLElement>("button")).filter(isVisible);
      const buttonWidths = statusButtons.map((button) => button.getBoundingClientRect().width);
      const equalButtonWidths = buttonWidths.length === 3 && Math.max(...buttonWidths) - Math.min(...buttonWidths) <= 1;
      if (statusRect.width < operationRect.width - 2 || !equalButtonWidths) {
        issues.add("module-editor-capacity-mismatch");
        break;
      }
    }
  }
  const sortableOwnershipPolicy = RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.sortableOwnership;
  const sortableCards = Array.from(pageHost?.querySelectorAll<HTMLElement>("[data-shared-sortable-card]") || []).filter(isVisible);
  for (const card of sortableCards) {
    const rail = card.querySelector<HTMLElement>("[data-shared-sortable-card-rail]");
    const moveRail = card.querySelector<HTMLElement>("[data-shared-sort-move-rail]");
    const drag = moveRail?.querySelector<HTMLElement>("[data-content-plugin-control='drag']");
    const moveUp = moveRail?.querySelector<HTMLElement>("[data-content-plugin-control='move-up']");
    const moveDown = moveRail?.querySelector<HTMLElement>("[data-content-plugin-control='move-down']");
    const sectionCard = card.matches("[data-responsive-structure-item='layout-section'], [data-responsive-structure-item='service-section']");
    const serviceCard = card.matches("[data-responsive-structure-item='service-section']");
    const categoryCard = card.matches("[data-product-market-category-group][data-shared-product-market-category-source='modules']");
    const railRect = rail?.getBoundingClientRect();
    const moveRailRect = moveRail?.getBoundingClientRect();
    const railStyle = rail ? getComputedStyle(rail) : null;
    const categoryContent = categoryCard
      ? card.querySelector<HTMLElement>(":scope > [data-responsive-mobile-collection]")
      : null;
    const categoryOperationCarrier = categoryCard
      ? rail?.querySelector<HTMLElement>(".product-module-category-operation-grid")
      : null;
    const categoryOperationStyle = categoryOperationCarrier ? getComputedStyle(categoryOperationCarrier) : null;
    const directRailChildren = rail
      ? Array.from(rail.children).filter((child): child is HTMLElement => child instanceof HTMLElement && isVisible(child))
      : [];
    const serviceCapsuleCopy = serviceCard && rail
      ? Array.from(rail.querySelectorAll<HTMLElement>("[data-shared-sortable-capsule-title], [data-shared-sortable-capsule-description]")).filter(isVisible)
      : [];
    const hasSharedDesktopRhythm = window.innerWidth < 1024 || (!sectionCard && !categoryCard) || (
      Math.abs((railRect?.height ?? 0) - sortableOwnershipPolicy.settingsHeaderMinimum) <= 1
      && directRailChildren.length > 0
      && directRailChildren.every((child) => Math.abs(child.getBoundingClientRect().height - sortableOwnershipPolicy.settingsHeaderInnerHeight) <= 1)
      && Math.abs(Number.parseFloat(railStyle?.fontSize || "0") - sortableOwnershipPolicy.settingsFontSize) <= 0.5
      && Math.abs(Number.parseFloat(railStyle?.lineHeight || "0") - sortableOwnershipPolicy.settingsLineHeight) <= 0.5
      && (!serviceCard || (serviceCapsuleCopy.length > 0 && serviceCapsuleCopy.every((node) => {
        const style = getComputedStyle(node);
        return Math.abs(Number.parseFloat(style.fontSize) - sortableOwnershipPolicy.settingsFontSize) <= 0.5
          && Math.abs(Number.parseFloat(style.lineHeight) - sortableOwnershipPolicy.settingsLineHeight) <= 0.5;
      })))
    );
    const hasSingleOuterFrame = rail?.dataset.sharedSortableCapsule === "single"
      && Math.abs((Number.parseFloat(railStyle?.paddingTop || "0")) - sortableOwnershipPolicy.settingsHeaderPadding) <= 0.5
      && Math.abs((Number.parseFloat(railStyle?.borderTopWidth || "0")) - 1) <= 0.5
      && Math.abs((Number.parseFloat(railStyle?.borderTopLeftRadius || "0")) - 12) <= 0.5
      && directRailChildren.every((child) => {
        const childStyle = getComputedStyle(child);
        const semanticLayoutControl = child.matches("[data-layout-section-editor-segment='controls']");
        const semanticDividerCount = [childStyle.borderRightWidth, childStyle.borderBottomWidth]
          .filter((width) => Number.parseFloat(width) > 0).length;
        return Number.parseFloat(childStyle.borderTopWidth) === 0
          && Number.parseFloat(childStyle.borderLeftWidth) === 0
          && Number.parseFloat(childStyle.borderTopLeftRadius) === 0
          && (semanticLayoutControl
            ? semanticDividerCount === 1
            : Number.parseFloat(childStyle.borderRightWidth) === 0
              && Number.parseFloat(childStyle.borderBottomWidth) === 0);
      });
    const hasModuleCategoryContentRhythm = window.innerWidth < 1024 || !categoryCard || (
      Boolean(categoryContent && railRect)
      && Math.abs((categoryContent?.getBoundingClientRect().top ?? 0) - (railRect?.bottom ?? 0) - sortableOwnershipPolicy.settingsContentGap) <= 1
      && categoryOperationStyle?.backgroundColor === "rgba(0, 0, 0, 0)"
      && Number.parseFloat(categoryOperationStyle?.borderTopWidth || "0") === 0
      && Number.parseFloat(categoryOperationStyle?.borderTopLeftRadius || "0") === 0
    );
    if (
      !rail || !moveRail || !drag || !moveUp || !moveDown
      || !hasSharedDesktopRhythm
      || !hasSingleOuterFrame
      || !hasModuleCategoryContentRhythm
      || (sectionCard && (
        Math.abs((moveRailRect?.width ?? 0) - sortableOwnershipPolicy.moveRailWidth) > 1
        || Math.abs((moveRailRect?.height ?? 0) - sortableOwnershipPolicy.controlSize) > 1
      ))
    ) {
      issues.add("shared-sortable-ownership-mismatch");
      break;
    }
  }

  const operationsCategoryCapsules = Array.from(pageHost?.querySelectorAll<HTMLElement>(
    "[data-product-market-category-group][data-shared-product-market-category-source='operations'] > [data-shared-category-capsule='single']",
  ) || []).filter(isVisible);
  for (const rail of operationsCategoryCapsules) {
    const group = rail.parentElement;
    const content = group?.querySelector<HTMLElement>(":scope > [data-product-market-card-grid]");
    const railRect = rail.getBoundingClientRect();
    const railStyle = getComputedStyle(rail);
    const directRailChildren = Array.from(rail.children).filter((child): child is HTMLElement => child instanceof HTMLElement && isVisible(child));
    const hasOperationsProjectionRhythm = window.innerWidth < 1024 || (
      Math.abs(railRect.height - sortableOwnershipPolicy.settingsHeaderMinimum) <= 1
      && Math.abs(Number.parseFloat(railStyle.paddingTop) - sortableOwnershipPolicy.settingsHeaderPadding) <= 0.5
      && Math.abs(Number.parseFloat(railStyle.borderTopWidth) - 1) <= 0.5
      && Math.abs(Number.parseFloat(railStyle.borderTopLeftRadius) - 12) <= 0.5
      && Math.abs(Number.parseFloat(railStyle.fontSize) - sortableOwnershipPolicy.settingsFontSize) <= 0.5
      && Math.abs(Number.parseFloat(railStyle.lineHeight) - sortableOwnershipPolicy.settingsLineHeight) <= 0.5
      && directRailChildren.length > 0
      && directRailChildren.every((child) => Math.abs(child.getBoundingClientRect().height - sortableOwnershipPolicy.settingsHeaderInnerHeight) <= 1)
      && Boolean(content)
      && Math.abs((content?.getBoundingClientRect().top ?? 0) - railRect.bottom - sortableOwnershipPolicy.settingsContentGap) <= 1
    );
    if (!hasOperationsProjectionRhythm) {
      issues.add("shared-sortable-ownership-mismatch");
      break;
    }
  }

  const moduleCategoryPolicy = RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.moduleCategory;
  // `content-visibility: auto` deliberately skips layout for off-screen module
  // groups. Their descendants expose placeholder geometry until scrolled into
  // view, so only learn from category rows that currently own real viewport
  // geometry. The same live DOM is measured again after resize/scroll/mutation.
  const moduleCategoryRows = Array.from(pageHost?.querySelectorAll<HTMLElement>("[data-responsive-capacity-row='module-category']") || []).filter(isVisibleWithinViewport);
  for (const moduleCategoryRow of moduleCategoryRows) {
    const shell = moduleCategoryRow.closest<HTMLElement>(".product-module-category-header-shell");
    const content = shell?.querySelector<HTMLElement>(":scope > .product-module-category-header-card > .product-module-card-content");
    const operation = moduleCategoryRow.querySelector<HTMLElement>(".product-module-category-operation-grid");
    const sortRail = moduleCategoryRow.querySelector<HTMLElement>("[data-shared-product-market-category-sort-rail]");
    const moveRail = moduleCategoryRow.querySelector<HTMLElement>("[data-shared-sort-move-rail]");
    const drag = moduleCategoryRow.querySelector<HTMLElement>("[data-content-plugin-control='drag']");
    const moveUp = moduleCategoryRow.querySelector<HTMLElement>("[data-content-plugin-control='move-up']");
    const moveDown = moduleCategoryRow.querySelector<HTMLElement>("[data-content-plugin-control='move-down']");
    const orderSegment = moduleCategoryRow.querySelector<HTMLElement>("[data-shared-product-market-category-order-segment]");
    const title = moduleCategoryRow.querySelector<HTMLElement>("[data-product-market-module-category-heading]");
    const name = title?.querySelector<HTMLElement>("[data-shared-product-market-category-name]");
    const status = moduleCategoryRow.querySelector<HTMLElement>("[data-content-plugin-actions='status']");
    if (!shell || !content || !operation || !sortRail || !orderSegment || !title || !name || !status) {
      issues.add("module-category-capacity-mismatch");
      break;
    }
    const shellRect = shell.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const operationRect = operation.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    const statusRect = status.getBoundingClientRect();
    const fixed = operation.classList.contains("product-module-category-operation-grid-fixed");
    const directChildren = Array.from(sortRail.children);
    const chainNodes = fixed
      ? [orderSegment, title, status]
      : [moveRail, orderSegment, title, status];
    const chainIndexes = chainNodes.map((node) => directChildren.indexOf(node as Element));
    const chainOrdered = chainIndexes.every((index, position) => index >= 0 && (position === 0 || index > chainIndexes[position - 1]));
    const categoryContractRoot = shell.querySelector<HTMLElement>("[data-shared-product-market-category-order]");
    const categoryRailRect = categoryContractRoot?.getBoundingClientRect();
    const categoryRailStyle = categoryContractRoot ? getComputedStyle(categoryContractRoot) : null;
    const expectedCategoryContentWidth = categoryRailRect
      ? categoryRailRect.width
        - Number.parseFloat(categoryRailStyle?.paddingLeft || "0")
        - Number.parseFloat(categoryRailStyle?.paddingRight || "0")
        - Number.parseFloat(categoryRailStyle?.borderLeftWidth || "0")
        - Number.parseFloat(categoryRailStyle?.borderRightWidth || "0")
      : 0;
    const sharedOrder = categoryContractRoot?.dataset.sharedProductMarketCategoryOrder || "";
    const sharedLabel = categoryContractRoot?.dataset.sharedProductMarketCategoryLabel || "";
    const inlineMinimum = fixed ? moduleCategoryPolicy.inlineFixedMinimum : moduleCategoryPolicy.inlineReorderMinimum;
    const shellPosition = getComputedStyle(shell).position;
    const titleJustification = getComputedStyle(title).justifyContent;
    const operationJustification = getComputedStyle(operation).justifyContent;
    const firstSegmentRect = (fixed ? orderSegment : drag)?.getBoundingClientRect();
    const leftClustered = Boolean(firstSegmentRect)
      && Math.abs((firstSegmentRect?.left ?? 0) - operationRect.left) <= 2
      && statusRect.left >= titleRect.right - 1
      && (!fixed || statusRect.left - titleRect.right <= 12)
      && ["flex-start", "start"].includes(titleJustification)
      && ["flex-start", "start"].includes(operationJustification);
    const containsLiveRow = operationRect.bottom <= shellRect.bottom + 1 && operationRect.top >= shellRect.top - 1;
    if (
      shellRect.width <= 0
      || expectedCategoryContentWidth <= 0
      || Math.abs(contentRect.width - expectedCategoryContentWidth) > 2
      || moduleCategoryRow.scrollWidth > moduleCategoryRow.clientWidth + 1
      || !containsLiveRow
      || titleRect.width <= 0
      || titleRect.height <= 0
      || !chainOrdered
      || (!fixed && (!moveRail || !drag || !moveUp || !moveDown))
      || orderSegment.textContent?.trim() !== sharedOrder
      || sharedLabel !== `${sharedOrder}.${name.textContent?.trim() || ""}`
    ) {
      issues.add("module-category-capacity-mismatch");
      break;
    }
    if (["sticky", "fixed"].includes(shellPosition)) {
      issues.add("module-category-capacity-mismatch");
      break;
    }
    if (shellRect.width >= inlineMinimum && (Math.abs(titleRect.top - statusRect.top) > 2 || !leftClustered)) {
      issues.add("module-category-capacity-mismatch");
      break;
    }
  }
  const productMarketCategoryPolicy = RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.productMarketCategories;
  const sharedProductMarketCategories = Array.from(pageHost?.querySelectorAll<HTMLElement>(
    "[data-product-market-category-group][data-shared-product-market-category-contract]",
  ) || []).filter(isVisible);
  for (const category of sharedProductMarketCategories) {
    const key = category.dataset.sharedProductMarketCategoryKey;
    const order = category.dataset.sharedProductMarketCategoryOrder || "";
    const label = category.dataset.sharedProductMarketCategoryLabel || "";
    const source = category.dataset.sharedProductMarketCategorySource;
    const iconPolicy = category.dataset.sharedProductMarketCategoryIconPolicy;
    const ownershipKey = category.dataset.sharedOwnershipKey;
    const categoryIcons = Array.from(category.querySelectorAll<HTMLElement>("[data-shared-product-market-category-icon]"));
    if (
      category.dataset.sharedProductMarketCategoryContract !== productMarketCategoryPolicy.plugin
      || !key
      || key !== category.dataset.productMarketCategoryKey
      || !/^\d{2}$/u.test(order)
      || (key !== "uncategorized" && !label.startsWith(`${order}.`))
      || ownershipKey !== `category:${key}`
      || !category.hasAttribute("data-shared-ownership-category-target")
      || (iconPolicy === "customer-service-select-expert" && (
        categoryIcons.length !== 1
        || categoryIcons[0].dataset.sharedProductMarketCategoryIcon !== key
        || categoryIcons[0].dataset.sharedProductMarketCategoryIconSource !== "customer-service-select-expert"
      ))
    ) {
      issues.add("product-market-category-contract-mismatch");
      break;
    }
    if (source !== "operations") continue;
    const rail = category.querySelector<HTMLElement>("[data-shared-product-market-category-rail='operations']");
    const statusCluster = rail?.querySelector<HTMLElement>("[data-product-market-category-status-cluster]");
    const categoryLabel = statusCluster?.querySelector<HTMLElement>("[data-product-market-category-label]");
    const statusActions = rail?.querySelector<HTMLElement>("[data-product-market-category-status-actions]");
    const statusGroup = statusActions?.querySelector<HTMLElement>("[data-content-plugin-actions='status']");
    const statusButtons = Array.from(statusGroup?.querySelectorAll<HTMLElement>("button[data-status]") || []);
    const cards = Array.from(category.querySelectorAll<HTMLElement>("[data-product-market-card]")).filter(isVisible);
    const ownershipCardsValid = cards.every((card) => card.dataset.sharedOwnershipKey?.startsWith("module:") && card.dataset.sharedCategoryKey === key);
    const cardStatuses = cards.map((card) => card.dataset.sharedStatusCard || "");
    const uniformStatus = cardStatuses.length > 0 && cardStatuses.every((status) => status === cardStatuses[0])
      ? cardStatuses[0]
      : "";
    const expectedMixed = cards.length > 0 && !uniformStatus;
    const displayedStatus = statusActions?.dataset.productMarketCategoryStatus || "";
    const activeButton = statusButtons.find((button) => button.classList.contains("is-active"));
    if (
      !rail
      || !ownershipCardsValid
      || !statusCluster
      || !categoryLabel
      || !statusActions
      || !statusGroup
      || statusButtons.map((button) => button.dataset.status).join(",") !== "active,inactive,hidden"
      || Number(statusActions.dataset.productMarketCategoryStatusTotal ?? -1) !== cards.length
      || statusActions.dataset.productMarketCategoryStatusMixed !== String(expectedMixed)
      || displayedStatus !== (expectedMixed ? "inactive" : uniformStatus)
      || activeButton?.dataset.status !== displayedStatus
      || categoryLabel.nextElementSibling !== statusActions
      || rail.querySelector("[data-product-market-category-select-all]")
      || rail.scrollWidth > rail.clientWidth + productMarketCategoryPolicy.measurementTolerance
    ) {
      issues.add("product-market-category-contract-mismatch");
      break;
    }
  }
  const layoutSectionEditorPolicy = RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.layoutSectionEditor;
  const layoutSectionEditorRows = Array.from(pageHost?.querySelectorAll<HTMLElement>("[data-shared-layout-section-editor-capsule='single']") || []).filter(isVisible);
  for (const layoutSectionEditorRow of layoutSectionEditorRows) {
    const layoutCard = layoutSectionEditorRow.closest<HTMLElement>("[data-responsive-structure-item='layout-section']");
    const controls = layoutSectionEditorRow.querySelector<HTMLElement>("[data-layout-section-editor-segment='controls']");
    const title = layoutSectionEditorRow.querySelector<HTMLElement>("[data-layout-section-editor-segment='title']");
    const description = layoutSectionEditorRow.querySelector<HTMLElement>("[data-layout-section-editor-segment='description']");
    const inputs = Array.from(layoutSectionEditorRow.querySelectorAll<HTMLInputElement>("input[data-layout-large-card-input='true']")).filter(isVisible);
    if (!layoutCard || !controls || !title || !description || inputs.length !== 2) {
      issues.add("layout-section-editor-capacity-mismatch");
      break;
    }
    const rowStyle = getComputedStyle(layoutSectionEditorRow);
    const controlsStyle = getComputedStyle(controls);
    const inputStyles = inputs.map((input) => getComputedStyle(input));
    const segmentRects = [controls, title, description].map((segment) => segment.getBoundingClientRect());
    const controlsDividerCount = [controlsStyle.borderRightWidth, controlsStyle.borderBottomWidth]
      .filter((width) => Number.parseFloat(width) > 0).length;
    const ownsSingleOuterCapsule = Number.parseFloat(rowStyle.borderTopWidth) > 0
      && Number.parseFloat(rowStyle.borderTopLeftRadius) > 0
      && controlsStyle.borderTopWidth === "0px"
      && controlsStyle.borderLeftWidth === "0px"
      && controlsStyle.borderTopLeftRadius === "0px"
      && controlsDividerCount === 1
      && inputStyles.every((style) => style.borderTopWidth === "0px" && style.borderTopLeftRadius === "0px" && style.backgroundColor === "rgba(0, 0, 0, 0)");
    const layoutWidth = layoutCard.getBoundingClientRect().width;
    const segmentsInline = Math.max(...segmentRects.map((rect) => rect.top)) - Math.min(...segmentRects.map((rect) => rect.top)) <= 2;
    if (
      !ownsSingleOuterCapsule
      || layoutSectionEditorRow.scrollWidth > layoutSectionEditorRow.clientWidth + 1
      || segmentRects.some((rect) => rect.width <= 0 || rect.height <= 0)
      || (layoutWidth >= layoutSectionEditorPolicy.inlineMinimum && !segmentsInline)
    ) {
      issues.add("layout-section-editor-capacity-mismatch");
      break;
    }
  }
  const serviceExpertPolicy = RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.serviceExperts;
  const serviceExpertGrids = Array.from(pageHost?.querySelectorAll<HTMLElement>("[data-responsive-capacity-grid='service-experts']") || []).filter(isVisible);
  for (const grid of serviceExpertGrids) {
    const cards = Array.from(grid.querySelectorAll<HTMLElement>(":scope > [data-responsive-structure-item='expert']")).filter(isVisible);
    if (cards.length === 0) continue;
    const gridRect = grid.getBoundingClientRect();
    const cardRects = cards.map((card) => card.getBoundingClientRect());
    const columnLefts: number[] = [];
    for (const cardRect of cardRects) {
      if (!columnLefts.some((left) => Math.abs(left - cardRect.left) <= 2)) columnLefts.push(cardRect.left);
    }
    const expectedColumns = resolveServiceExpertColumnCount(gridRect.width, cards.length);
    const firstRow = cardRects.filter((cardRect) => Math.abs(cardRect.top - cardRects[0].top) <= 2);
    const equalFirstRowWidths = firstRow.length < 2 || Math.max(...firstRow.map((cardRect) => cardRect.width)) - Math.min(...firstRow.map((cardRect) => cardRect.width)) <= 1;
    if (
      grid.scrollWidth > grid.clientWidth + 1
      || columnLefts.length !== expectedColumns
      || !equalFirstRowWidths
    ) {
      issues.add("service-expert-capacity-mismatch");
      break;
    }
  }
  if (width <= ADAPTIVE_STRUCTURE_FACTORY_DEFAULT.mobileApplication.activationMax) {
    if (pageHost?.dataset.responsiveMobileArchitecture !== ADAPTIVE_STRUCTURE_FACTORY_DEFAULT.mobileApplication.plugin
      || document.documentElement.dataset.responsiveMobileArchitecture !== ADAPTIVE_STRUCTURE_FACTORY_DEFAULT.mobileApplication.plugin) {
      issues.add("mobile-application-frame-missing");
    }
    const mobileCollections = Array.from(pageHost?.querySelectorAll<HTMLElement>("[data-responsive-mobile-collection]") || []).filter(isVisible);
    if (mobileCollections.some((collection) => getComputedStyle(collection).display !== "grid" || collection.scrollWidth > collection.clientWidth + 1)) {
      issues.add("mobile-collection-overflow");
    }
    if (width <= 479) {
      const complexEditors = mobileCollections.filter((collection) => collection.dataset.responsiveCollectionComplexity === "editor");
      if (complexEditors.some((collection) => {
        const visibleItems = Array.from(collection.children).filter((item): item is HTMLElement => item instanceof HTMLElement && isVisible(item));
        return new Set(visibleItems.map((item) => Math.round(item.getBoundingClientRect().left))).size > 1;
      })) issues.add("mobile-editor-density-mismatch");
    }
    const mobileFooter = shell?.querySelector<HTMLElement>("[data-page-layout-footer]");
    if (mobileFooter && isVisible(mobileFooter)) {
      const primaryItems = Array.from(mobileFooter.querySelectorAll<HTMLElement>(
        "[data-responsive-footer-lock-control], [data-visual-card-developer-launcher], [data-source-project-action], [data-client-project-action]",
      )).filter(isVisible);
      const footerInvalid = getComputedStyle(mobileFooter).display !== "grid"
        || mobileFooter.scrollWidth > mobileFooter.clientWidth + 1
        || primaryItems.some((item) => item.getBoundingClientRect().height + 0.5 < ADAPTIVE_STRUCTURE_FACTORY_DEFAULT.density.minimumTouchTarget);
      if (footerInvalid) issues.add("mobile-primary-navigation-mismatch");
    }
  }

  const pageTools = shell?.querySelector<HTMLElement>("[data-responsive-semantic-tools][data-responsive-single-live-source='true']");
  if (pageTools) {
    const batchControls = Array.from(shell?.querySelectorAll<HTMLElement>("[data-responsive-live-surface-open='true'] [data-responsive-batch-action-parity='large-table-header']:not(:disabled)") || []);
    if (batchControls.some((control) => {
      const style = getComputedStyle(control);
      return style.backgroundColor !== control.style.backgroundColor
        || style.color !== control.style.color
        || Math.abs(control.getBoundingClientRect().height - 32) > 1
        || Number.parseFloat(style.fontSize) !== 12
        || style.fontWeight !== "600";
    })) issues.add("page-tools-batch-style-mismatch");

    if (isVisible(pageTools)) {
      const labelMode = pageTools.dataset.responsiveToolsLabelMode;
      const overflowed = pageTools.dataset.responsiveToolsOverflowed === "true";
      const available = Number.parseFloat(pageTools.dataset.responsiveToolsAvailableWidth || "");
      const labelledRequired = Number.parseFloat(pageTools.dataset.responsiveToolsLabelledRequiredWidth || "");
      const iconRequired = Number.parseFloat(pageTools.dataset.responsiveToolsIconRequiredWidth || "");
      const labelledLayoutOverflow = pageTools.dataset.responsiveToolsLabelledLayoutOverflow === "true";
      const directLabels = Array.from(pageTools.querySelectorAll<HTMLElement>(
        "[data-responsive-toolbar-trigger]:not([data-responsive-toolbar-trigger='overflow']) [data-responsive-tool-label]",
      ));
      const allLabelsVisible = directLabels.length > 0 && directLabels.every((label) => getComputedStyle(label).display !== "none");
      const allLabelsHidden = directLabels.length > 0 && directLabels.every((label) => getComputedStyle(label).display === "none");
      const overflowTrigger = pageTools.querySelector<HTMLElement>("[data-responsive-toolbar-trigger='overflow']");
      const tolerance = RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.capacityTolerance;
      const hysteresis = RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.capacityRevealHysteresis;
      const measurementsReady = Number.isFinite(available) && available > 0 && Number.isFinite(labelledRequired) && labelledRequired > 0;
      const capacityMismatch = measurementsReady && (
        (overflowed && (
          labelMode !== "icon-only"
          || !allLabelsHidden
          || !overflowTrigger
          || !isVisible(overflowTrigger)
          || !Number.isFinite(iconRequired)
          || (available >= iconRequired + hysteresis
            && pageTools.scrollWidth <= pageTools.clientWidth + tolerance)
        ))
        || (!overflowed && labelMode === "labelled" && (
          !allLabelsVisible || labelledRequired > available + tolerance
        ))
        || (!overflowed && labelMode === "icon-only" && (
          !allLabelsHidden
          || !Number.isFinite(iconRequired)
          || iconRequired > available + tolerance
          || (!labelledLayoutOverflow && available >= labelledRequired + hysteresis)
        ))
        || (!overflowed && labelMode !== "labelled" && labelMode !== "icon-only")
      );
      if (capacityMismatch) issues.add("page-tools-capacity-mismatch");
    }
  }

  const semanticBands = Array.from(shell?.querySelectorAll<HTMLElement>("[data-responsive-semantic-band-active]") || []);
  const semanticAdapter = shell?.querySelector<HTMLElement>("[data-responsive-semantic-tools][data-responsive-single-live-source='true']");
  const semanticAdapterEnabled = semanticBands.length > 0
    && Boolean(semanticAdapter);
  const semanticPressureActive = width <= RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.activationMax
    || height <= RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBreakpoints.focusMax;
  if (semanticBands.length > 0 && semanticPressureActive && !semanticAdapter) issues.add("semantic-page-tools-missing");
  if (semanticAdapterEnabled && semanticPressureActive && semanticBands.some((band) => {
    if (band.dataset.responsiveLiveSurfaceOpen === "true") return false;
    const style = getComputedStyle(band);
    return style.display !== "none" && style.visibility !== "hidden" && band.getBoundingClientRect().width > 0;
  })) issues.add("semantic-band-not-collapsed");

  const openLiveSurfaces = Array.from(shell?.querySelectorAll<HTMLElement>("[data-responsive-live-surface-open='true']") || []).filter(isVisible);
  if (openLiveSurfaces.length > 1) issues.add("duplicate-live-surface");
  for (const liveSurface of openLiveSurfaces) {
    if (liveSurface.dataset.responsiveLiveSurfaceSource !== SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.sourceViewport
      || liveSurface.dataset.responsiveLiveSurfaceContract !== SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.version) {
      issues.add("shared-adaptive-surface-missing");
    }
    if (shell?.querySelector("[data-responsive-page-tools-projection], [data-responsive-page-tools-section]")) {
      issues.add("live-surface-proxy-active");
    }
    if (liveSurface.dataset.responsiveLiveSurface === "title-1") {
      const heading = liveSurface.querySelector<HTMLElement>(
        "h1, h2, [data-shared-title-heading], [data-responsive-semantic-title], [data-responsive-live-title-heading]",
      );
      const description = liveSurface.querySelector<HTMLElement>(
        "[data-shared-title-description], [data-responsive-semantic-description], [data-responsive-live-title-description]",
      );
      const titleContent = liveSurface.querySelector<HTMLElement>(
        "[data-page-title-content], [data-responsive-generated-title-content='true']",
      );
      const titleContentWidth = titleContent?.getBoundingClientRect().width || 0;
      const titleLayout = liveSurface.matches("[data-responsive-generated-title-band='true']")
        ? liveSurface
        : liveSurface.querySelector<HTMLElement>("[data-responsive-live-title-layout]");
      const titleActions = liveSurface.querySelector<HTMLElement>(
        "[data-page-title-actions], [data-responsive-generated-title-actions='true']",
      );
      const actionControls = Array.from(titleActions?.children || [])
        .filter((element): element is HTMLElement => element instanceof HTMLElement && isVisible(element));
      const actionStyle = titleActions ? getComputedStyle(titleActions) : null;
      const actionGap = Number.parseFloat(actionStyle?.columnGap || actionStyle?.gap || "0") || 0;
      const requiredActionWidth = actionControls.reduce((total, control) => (
        total + Math.max(control.getBoundingClientRect().width, control.scrollWidth)
      ), 0) + Math.max(0, actionControls.length - 1) * actionGap;
      const expectedInline = width >= RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedSurfaces.compactTitleCopy.inlineTitleActionMinimumWidth
        && requiredActionWidth > 0
        && requiredActionWidth
          + RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedSurfaces.compactTitleCopy.minimumInlineTitleWidth
          + RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedSurfaces.compactTitleCopy.titleActionGap
          <= (titleLayout?.getBoundingClientRect().width || 0) + 0.5;
      const actualInline = liveSurface.dataset.responsiveLiveTitleLayoutMode === "inline";
      const actionRows = new Set(actionControls.map((control) => Math.round(control.getBoundingClientRect().y)));
      const headingStyle = heading ? getComputedStyle(heading) : null;
      const shouldShowDescription = titleContentWidth + 0.5 >= RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedSurfaces.compactTitleCopy.descriptionMinimumWidth
        && height >= RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedSurfaces.compactTitleCopy.descriptionMinimumHeight;
      if ((heading && (!isVisible(heading) || headingStyle?.whiteSpace !== "nowrap"))
        || (actionControls.length > 0 && (actualInline !== expectedInline || (actualInline && actionRows.size !== 1)))
        || (description && isVisible(description) !== shouldShowDescription)) {
        issues.add("live-surface-copy-mismatch");
      }
    }
  }

  const visibleSharedSurfaces = Array.from(document.querySelectorAll<HTMLElement>("[data-responsive-shared-surface]")).filter(isVisible);
  if (visibleSharedSurfaces.some((surface) => !hasExpectedSharedSurfaceGeometry(surface))) issues.add("shared-surface-mismatch");
  const rootStyle = getComputedStyle(document.documentElement);
  const expectedTitle2Background = rootStyle.getPropertyValue("--tradepro-panel-title-2-bg").trim();
  const expectedTitle2Text = rootStyle.getPropertyValue("--tradepro-panel-title-2-text").trim();
  const title2Surfaces = visibleSharedSurfaces.filter((surface) =>
    surface.dataset.responsiveSharedSurface === "title-2"
      && !surface.closest("[data-responsive-page-tools-theme-controls]")
  );
  if (
    document.documentElement.dataset.responsiveThemePalettePolicy !== RESPONSIVE_SHELL_FACTORY_DEFAULT.themePalette.strategy
    || !expectedTitle2Background
    || !expectedTitle2Text
    || title2Surfaces.some((surface) => {
      const style = getComputedStyle(surface);
      const probe = document.createElement("span");
      probe.style.cssText = "position:fixed;left:-9999px;visibility:hidden";
      probe.style.backgroundColor = expectedTitle2Background;
      probe.style.color = expectedTitle2Text;
      document.body.appendChild(probe);
      const expected = getComputedStyle(probe);
      const matches = style.backgroundColor === expected.backgroundColor && style.color === expected.color;
      probe.remove();
      return !matches;
    })
  ) issues.add("theme-palette-mismatch");

  const visibleSharedActions = Array.from(document.querySelectorAll<HTMLElement>("[data-responsive-shared-action]")).filter(isVisible);
  if (visibleSharedActions.some((action) => {
    const style = getComputedStyle(action);
    const rect = action.getBoundingClientRect();
    const icon = action.querySelector<HTMLElement>("svg");
    return action.dataset.responsiveSharedActionPlugin !== RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedActions.plugin
      || Math.abs(rect.height - RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedActions.height) > 1
      || Boolean(icon && Math.abs(icon.getBoundingClientRect().width - RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedActions.iconSize) > 1)
      || Math.abs((Number.parseFloat(style.columnGap) || 0) - RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedActions.contentGap) > 0.75
      || !style.transitionProperty.includes("background-color");
  })) issues.add("shared-action-mismatch");

  const compressedHeadings = Array.from(pageHost?.querySelectorAll<HTMLElement>(
    "h1, [data-responsive-semantic-title], [data-shared-title-heading]",
  ) || []).filter(isVisible).filter((heading) => {
    const textLength = (heading.textContent || "").replace(/\s+/g, "").length;
    if (textLength < 4) return false;
    const style = getComputedStyle(heading);
    const fontSize = Number.parseFloat(style.fontSize) || 16;
    return heading.getBoundingClientRect().width + 0.5 < Math.min(96, fontSize * 3);
  });
  if (compressedHeadings.length) issues.add("compressed-readable-text");

  const footerLocks = shell?.querySelector<HTMLElement>("[data-page-lock-footer-controls]");
  if (footerLocks && isVisible(footerLocks)) {
    const density = footerLocks.dataset.responsiveFooterLockDensity;
    const available = Number.parseFloat(footerLocks.dataset.responsiveFooterLockAvailableWidth || "");
    const required = Number.parseFloat(footerLocks.dataset.responsiveFooterLockRequiredWidth || "");
    const tolerance = RESPONSIVE_SHELL_FACTORY_DEFAULT.footerActions.labelCollapseTolerance;
    const buttons = Array.from(footerLocks.querySelectorAll<HTMLElement>("[data-responsive-footer-lock-control]")).filter(isVisible);
    const buttonGapMismatch = buttons.some((button) => Math.abs((Number.parseFloat(getComputedStyle(button).columnGap) || 0) - RESPONSIVE_SHELL_FACTORY_DEFAULT.footerActions.controlContentGap) > 0.75);
    const labelsVisible = buttons.every((button) => {
      const label = button.querySelector<HTMLElement>("[data-page-lock-label]");
      return Boolean(label && getComputedStyle(label).display !== "none");
    });
    const labelledOverflow = footerLocks.dataset.responsiveFooterLockLabelledOverflow === "true";
    const prematureCollapse = density === "icon-only" && Number.isFinite(available) && Number.isFinite(required) && required <= available + tolerance && !labelledOverflow;
    const labelledCapacityOverflow = density === "labelled" && Number.isFinite(available) && Number.isFinite(required) && required > available + tolerance;
    if (buttonGapMismatch || prematureCollapse || labelledCapacityOverflow || (density === "labelled" && !labelsVisible)) issues.add("footer-capacity-mismatch");
  }
  const footer = shell?.querySelector<HTMLElement>("[data-page-layout-footer]");
  if (footer && isVisible(footer)) {
    const flow = footer.dataset.responsiveFooterFlow;
    const footerRequired = Number.parseFloat(footer.dataset.responsiveFooterRequiredWidth || "");
    const footerAvailable = Number.parseFloat(footer.dataset.responsiveFooterAvailableWidth || "");
    const shouldWrap = Number.isFinite(footerRequired) && Number.isFinite(footerAvailable) && footerRequired > footerAvailable + 0.5;
    const wraps = getComputedStyle(footer).flexWrap === "wrap" && footer.getBoundingClientRect().height >= RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.footerReserve;
    if ((flow === "wrapped" && (!shouldWrap || !wraps)) || (flow === "inline" && shouldWrap)) issues.add("footer-wrap-mismatch");
  }

  const floatingServiceWindows = Array.from(document.querySelectorAll<HTMLElement>("[data-shared-floating-service-window='true']")).filter(isVisible);
  const visibleFooters = Array.from(document.querySelectorAll<HTMLElement>("[data-page-layout-footer]")).filter(isVisible);
  for (const floatingWindow of floatingServiceWindows) {
    const floatingRect = floatingWindow.getBoundingClientRect();
    const expectedBottom = RESPONSIVE_SHELL_FACTORY_DEFAULT.floatingService.minimumFooterSafeBottom;
    const overlapsFooter = visibleFooters.some((visibleFooter) => {
      const footerRect = visibleFooter.getBoundingClientRect();
      return floatingRect.left < footerRect.right
        && floatingRect.right > footerRect.left
        && floatingRect.top < footerRect.bottom
        && floatingRect.bottom > footerRect.top;
    });
    if (Number.parseFloat(getComputedStyle(floatingWindow).bottom) + 0.5 < expectedBottom || overlapsFooter) {
      issues.add("floating-service-overlap");
      break;
    }
  }

  const visibleSharedInteractions = Array.from(document.querySelectorAll<HTMLElement>("[data-responsive-shared-popover], [data-responsive-shared-tooltip='true']")).filter(isVisible);
  if (visibleSharedInteractions.some((surface) => {
    const style = getComputedStyle(surface);
    const inlineTopTools = surface.dataset.responsiveSharedPopover === "top-tools"
      && !surface.classList.contains("is-expanded")
      && getComputedStyle(surface).position !== "fixed"
      && getComputedStyle(surface).position !== "absolute";
    return surface.dataset.responsiveSharedPopoverPlugin !== RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedInteractions.plugin
      || (!inlineTopTools && (normalizeRadius(style.borderTopLeftRadius) <= 1 || style.boxShadow === "none"));
  })) issues.add("shared-interaction-mismatch");

  if (shell && width <= RESPONSIVE_SHELL_FACTORY_DEFAULT.breakpoints.drawerMax) {
    const desktopNav = shell.querySelector<HTMLElement>("[data-responsive-desktop-nav]");
    const trigger = Array.from(shell.querySelectorAll<HTMLElement>("[data-responsive-nav-trigger], [data-responsive-page-tools-nav]")).find(isVisible);
    if (desktopNav && getComputedStyle(desktopNav).display === "none" && (!trigger || !isVisible(trigger))) issues.add("missing-navigation");
  }

  const topbar = shell?.querySelector<HTMLElement>("[data-responsive-topbar]");
  const expandedContent = topbar?.querySelector<HTMLElement>(".client-source-topbar-content.is-expanded");
  const topbarPopover = expandedContent?.matches("[data-responsive-topbar-popover='anchored']") ? expandedContent : null;
  const topbarDisclosure: ResponsiveLearningObservation["topbarDisclosure"] = topbar?.dataset.responsiveTopbarDisclosure === "popover"
    ? expandedContent ? "expanded" : "collapsed"
    : "not-applicable";
  if (topbar && expandedContent) {
    const topbarRect = topbar.getBoundingClientRect();
    const contentRect = expandedContent.getBoundingClientRect();
    if (topbarPopover) {
      const style = getComputedStyle(topbarPopover);
      const rootStyle = getComputedStyle(document.documentElement);
      const expectedChromeHeight = Number.parseFloat(rootStyle.getPropertyValue("--responsive-vertical-topbar-height"));
      const chromeHeightMatches = !Number.isFinite(expectedChromeHeight) || Math.abs(topbarRect.height - expectedChromeHeight) <= 1;
      const isAnchored = style.position === "absolute" && contentRect.top >= topbarRect.bottom - 1;
      const isViewportContained = contentRect.left >= -1
        && contentRect.right <= window.innerWidth + 1
        && contentRect.bottom <= window.innerHeight + 1;
      const ownsOverflow = topbarPopover.scrollHeight <= topbarPopover.clientHeight + 1 || ["auto", "scroll"].includes(style.overflowY);
      if (!chromeHeightMatches || !isAnchored || !isViewportContained || !ownsOverflow) issues.add("topbar-popover-invalid");
    } else if (contentRect.bottom > topbarRect.bottom + 1) {
      issues.add("topbar-overflow");
    }
  }

  const actions = topbar?.querySelector<HTMLElement>("[data-source-topbar-actions]");
  const pageToolsPressureActive = width <= RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.activationMax
    || height <= RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBreakpoints.focusMax;
  if (actions && width <= RESPONSIVE_SHELL_FACTORY_DEFAULT.breakpoints.wrapMax && !pageToolsPressureActive) {
    const style = getComputedStyle(actions);
    if (style.display !== "flex" || style.flexWrap === "nowrap") issues.add("split-action-order");
  }

  if (shell) {
    for (const primary of Array.from(shell.querySelectorAll<HTMLElement>("[data-responsive-priority='p0']"))) {
      if (!isVisible(primary)) {
        const collapsedOwner = primary.closest<HTMLElement>("[data-responsive-topbar-content], [data-responsive-page-tools-popover]");
        if ((pageToolsPressureActive && collapsedOwner) || (collapsedOwner && !isVisible(collapsedOwner)) || isIntentionallyCollapsed(primary, width, height)) continue;
        issues.add("hidden-primary-action");
        break;
      }
      const targets = primary.matches("button, input, select, textarea, a[href]")
        ? [primary]
        : Array.from(primary.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href]"));
      if (targets.some((target) => {
        if (!isVisible(target)) return false;
        const rect = target.getBoundingClientRect();
        const minimumHeight = target.dataset.responsiveSharedActionPlugin === RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedActions.plugin
          ? RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedActions.height
          : RESPONSIVE_SHELL_FACTORY_DEFAULT.minimumInteractiveSize;
        return rect.height + 0.5 < minimumHeight;
      })) {
        issues.add("undersized-primary-target");
        break;
      }
    }
  }

  const viewportHeight = Math.max(RESPONSIVE_SHELL_FACTORY_DEFAULT.minimumSupportedHeight, height);
  const firstVisible = (selector: string) => shell
    ? Array.from(shell.querySelectorAll<HTMLElement>(selector)).find(isVisible) || null
    : null;
  const workspace = firstVisible("[data-product-market-workspace], [data-client-project-frame], [data-page-layout-surface]");
  const bands = new Set<HTMLElement>();
  if (topbar && isVisible(topbar)) bands.add(topbar);
  const titleBand = workspace
    ? Array.from(workspace.querySelectorAll<HTMLElement>("[data-product-market-header], [data-page-title], [data-shared-layout-section='title']")).find(isVisible)
    : firstVisible("[data-product-market-header], [data-page-title], [data-shared-layout-section='title']");
  const secondaryTitleBand = workspace?.querySelector<HTMLElement>("[data-product-market-theme-section]") || null;
  const tableHeaderBand = workspace
    ? Array.from(workspace.querySelectorAll<HTMLElement>("[data-product-market-table-header], [data-page-table-header], [data-template-config-service-header='true']")).find(isVisible)
    : firstVisible("[data-product-market-table-header], [data-page-table-header], [data-template-config-service-header='true']");
  if (titleBand && isVisible(titleBand)) bands.add(titleBand);
  if (secondaryTitleBand && isVisible(secondaryTitleBand)) bands.add(secondaryTitleBand);
  if (tableHeaderBand && isVisible(tableHeaderBand)) bands.add(tableHeaderBand);
  const chromeHeight = Array.from(bands).reduce((total, band) => total + band.getBoundingClientRect().height, 0);
  const chromeRatio = chromeHeight / viewportHeight;
  const contentOwner = firstVisible("[data-page-list-scroll-owner], [data-product-market-scroll-list]");
  const contentRatio = contentOwner ? contentOwner.getBoundingClientRect().height / viewportHeight : 1;
  const contentOwnerStyle = contentOwner ? getComputedStyle(contentOwner) : null;
  const contentReservedScrollEndSpace = contentOwnerStyle
    ? Math.min(
        Number.parseFloat(contentOwnerStyle.paddingBottom) || 0,
        Number.parseFloat(contentOwnerStyle.scrollPaddingBottom) || 0,
      )
    : 0;
  const contentNeedsViewport = contentOwner
    ? contentOwner.scrollHeight - contentReservedScrollEndSpace > contentOwner.clientHeight + 1
    : false;
  const verticalStage = resolveResponsiveVerticalStage(viewportHeight);
  const verticalFocus = document.documentElement.dataset.responsiveVerticalFocus === "true";
  if (verticalStage !== "comfortable" && chromeRatio > RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBudget.maximumChromeRatio + 0.01) {
    issues.add("chrome-budget-exceeded");
  }
  const requiredContentRatio = verticalStage === "minimal"
    ? (verticalFocus
        ? RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBudget.minimalFocusedContentRatio
        : RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBudget.minimalContentRatio)
    : (verticalFocus
        ? RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBudget.focusedContentRatio
        : RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBudget.minimumContentRatio);
  if (contentOwner && contentNeedsViewport && verticalStage !== "comfortable" && contentRatio + 0.01 < requiredContentRatio) {
    issues.add("content-viewport-starved");
  }
  const persistentContentBands = [titleBand, secondaryTitleBand, tableHeaderBand].filter((band): band is HTMLElement => Boolean(band && isVisible(band))).filter((band) => {
    const position = getComputedStyle(band).position;
    return position === "sticky" || position === "fixed";
  });
  if (persistentContentBands.length > 1) issues.add("multiple-sticky-bands");

  const pageToolsAdapter = shell?.querySelector<HTMLElement>("[data-responsive-semantic-tools][data-responsive-single-live-source='true']");
  if (pageToolsPressureActive && pageToolsAdapter) {
    const independentTools = shell?.querySelector<HTMLElement>("[data-responsive-independent-tools]");
    const availableToolTriggerIds = new Set(Array.from(independentTools?.querySelectorAll<HTMLElement>("[data-responsive-toolbar-trigger]") || [])
      .map((trigger) => trigger.dataset.responsiveToolbarTrigger || ""));
    const directOrder = RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.triggerOrder.filter((id) =>
      availableToolTriggerIds.has(id)
      && (id !== "navigation" || width < RESPONSIVE_SHELL_FACTORY_DEFAULT.breakpoints.desktopMin)
    );
    const overflowOrder = RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.alwaysVisibleAtOverflow.filter((id) =>
      availableToolTriggerIds.has(id)
      && id !== "visual"
      && (id !== "navigation" || width < RESPONSIVE_SHELL_FACTORY_DEFAULT.breakpoints.desktopMin)
    );
    const toolsOverflowed = independentTools?.dataset.responsiveToolsOverflowed === "true";
    const expectedOrder = toolsOverflowed ? overflowOrder : directOrder;
    const visibleTriggers = Array.from(independentTools?.querySelectorAll<HTMLElement>("[data-responsive-toolbar-trigger]:not([data-responsive-toolbar-trigger='visual'])") || [])
      .filter(isVisible)
      .map((trigger) => trigger.dataset.responsiveToolbarTrigger || "");
    const orderMatches = expectedOrder.length === visibleTriggers.length
      && expectedOrder.every((id, index) => visibleTriggers[index] === id);
    if (!independentTools || !isVisible(independentTools) || !orderMatches) issues.add("page-tools-invalid");
    const openPanels = Array.from(shell?.querySelectorAll<HTMLElement>(
      ".client-source-topbar-content.is-expanded, [data-responsive-page-tools-popover].is-expanded, [data-responsive-topbar][data-responsive-shell-tools-expanded='true'] > [data-responsive-topbar-content]",
    ) || []).filter(isVisible);
    if (openPanels.length > 1) issues.add("page-tools-invalid");
    const expandedPageTools = openPanels[0];
    if (expandedPageTools && isVisible(expandedPageTools)) {
      const rect = expandedPageTools.getBoundingClientRect();
      const footer = shell?.querySelector<HTMLElement>("[data-page-layout-footer]");
      const footerTop = footer && isVisible(footer) ? footer.getBoundingClientRect().top : window.innerHeight;
      const ownsOverflow = expandedPageTools.scrollHeight <= expandedPageTools.clientHeight + 1
        || ["auto", "scroll"].includes(getComputedStyle(expandedPageTools).overflowY);
      if (rect.left < -1 || rect.right > window.innerWidth + 1 || rect.top < -1 || rect.bottom > footerTop + 1 || !ownsOverflow) {
        issues.add("page-tools-invalid");
      }
    }
  }

  const mobileApplicationActive = width <= ADAPTIVE_STRUCTURE_FACTORY_DEFAULT.mobileApplication.activationMax
    && document.documentElement.dataset.responsiveMobileArchitecture === ADAPTIVE_STRUCTURE_FACTORY_DEFAULT.mobileApplication.plugin;
  const functionKeys = Array.from(document.querySelectorAll<HTMLElement>(RESPONSIVE_SHELL_FUNCTION_KEY_SELECTOR))
    .filter(isVisible)
    // Visual is a bottom-navigation item in the mobile application frame; it
    // intentionally follows the 48px touch target instead of the 36px topbar
    // function-key geometry.
    .filter((key) => !(mobileApplicationActive && key.dataset.responsiveToolbarTrigger === "visual"));
  if (functionKeys.length) {
    const expectedHeight = RESPONSIVE_SHELL_FACTORY_DEFAULT.functionKeys.height;
    const tolerance = RESPONSIVE_SHELL_FACTORY_DEFAULT.functionKeys.measurementTolerance;
    const heights = functionKeys.map((key) => key.getBoundingClientRect().height);
    const heightDrift = Math.max(...heights) - Math.min(...heights);
    if (heightDrift > tolerance || heights.some((keyHeight) => Math.abs(keyHeight - expectedHeight) > tolerance)) {
      issues.add("function-key-height-mismatch");
    }
    if (functionKeys.some((key) => key.dataset.responsiveFunctionKeyPlugin !== "shared")) {
      issues.add("function-key-frame-mismatch");
    }
    if (functionKeys.some((key) => Math.abs((Number.parseFloat(getComputedStyle(key).columnGap) || 0) - RESPONSIVE_SHELL_FACTORY_DEFAULT.functionKeys.contentGap) > 0.75)) {
      issues.add("function-key-frame-mismatch");
    }
  }

  const visualLauncher = document.querySelector<HTMLElement>("[data-responsive-visual-launcher]");
  if (visualLauncher && isVisible(visualLauncher)) {
    const launcherStyle = getComputedStyle(visualLauncher);
    if (Number.parseFloat(launcherStyle.borderTopWidth) > 0 || launcherStyle.boxShadow !== "none") {
      issues.add("function-key-frame-mismatch");
    }
    const launcherRect = visualLauncher.getBoundingClientRect();
    const footerSlot = shell?.querySelector<HTMLElement>("[data-responsive-visual-launcher-slot]") || null;
    const saveAction = footerSlot?.parentElement?.querySelector<HTMLElement>(
      ":scope > [data-source-project-action], :scope > [data-client-project-action]",
    ) || shell?.querySelector<HTMLElement>(
      "[data-page-layout-footer] [data-source-project-action], [data-page-layout-footer] [data-client-project-action]",
    ) || null;
    const slotRect = footerSlot?.getBoundingClientRect();
    const slotPrecedesSave = Boolean(footerSlot && saveAction && (footerSlot.compareDocumentPosition(saveAction) & Node.DOCUMENT_POSITION_FOLLOWING));
    const fixedInsideSlot = Boolean(footerSlot && footerSlot.contains(visualLauncher));
    const alignedToSlot = Boolean(slotRect
      && launcherRect.width > 0
      && launcherRect.height > 0
      && launcherRect.width <= slotRect.width + 2
      && launcherRect.height <= slotRect.height + 2
      && Math.abs((launcherRect.left + launcherRect.right) / 2 - (slotRect.left + slotRect.right) / 2) <= 2
      && Math.abs((launcherRect.top + launcherRect.bottom) / 2 - (slotRect.top + slotRect.bottom) / 2) <= 2);
    if (!slotPrecedesSave || !fixedInsideSlot || !alignedToSlot) issues.add("visual-launcher-overlap");
    const protectedTargets = [
      ...Array.from(shell?.querySelectorAll<HTMLElement>("[data-responsive-toolbar-trigger]:not([data-responsive-toolbar-trigger='visual'])") || []),
      shell?.querySelector<HTMLElement>("[data-responsive-topbar-toggle]"),
      shell?.querySelector<HTMLElement>("[data-responsive-page-tools-toggle]"),
      shell?.querySelector<HTMLElement>("[data-responsive-page-tools-nav]"),
    ].filter((element): element is HTMLElement => Boolean(element && isVisible(element)));
    const overlaps = protectedTargets.some((target) => {
      const rect = target.getBoundingClientRect();
      return launcherRect.left < rect.right && launcherRect.right > rect.left && launcherRect.top < rect.bottom && launcherRect.bottom > rect.top;
    });
    if (overlaps) issues.add("visual-launcher-overlap");
  }

  const resolvedIssues = Array.from(issues);
  return {
    contractVersion: RESPONSIVE_SHELL_FACTORY_DEFAULT.version,
    scope,
    route: `${window.location.pathname}${window.location.search}`,
    width: Math.round(width),
    height: Math.round(height),
    stage: resolveResponsiveShellStage(width),
    verticalStage,
    mode: resolveResponsiveShellMode(width),
    chromeRatio: Number(chromeRatio.toFixed(3)),
    contentRatio: Number(contentRatio.toFixed(3)),
    verticalFocus,
    topbarDisclosure,
    issues: resolvedIssues,
    recommendations: resolveResponsiveLearningRecommendations(resolvedIssues),
    measuredAt: new Date().toISOString(),
  };
}

export function persistResponsiveFactorySnapshot() {
  try {
    const key = RESPONSIVE_SHELL_FACTORY_DEFAULT.learning.factorySnapshotKey;
    const current = window.localStorage.getItem(key);
    if (current) {
      const parsed = JSON.parse(current) as { contract?: { version?: string }; pageContract?: { version?: string }; structureContract?: { version?: string }; surfaceContract?: { version?: string } };
      if (parsed.contract?.version === RESPONSIVE_SHELL_FACTORY_DEFAULT.version
        && parsed.pageContract?.version === GLOBAL_RESPONSIVE_PAGE_FACTORY_DEFAULT.version
        && parsed.structureContract?.version === ADAPTIVE_STRUCTURE_FACTORY_DEFAULT.version
        && parsed.surfaceContract?.version === SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.version) return;
    }
    window.localStorage.setItem(key, JSON.stringify({
      savedAt: new Date().toISOString(),
      source: "code-owned-factory-default",
      contract: RESPONSIVE_SHELL_FACTORY_DEFAULT,
      pageContract: GLOBAL_RESPONSIVE_PAGE_FACTORY_DEFAULT,
      structureContract: ADAPTIVE_STRUCTURE_FACTORY_DEFAULT,
      surfaceContract: SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT,
    }));
  } catch {
    // Storage is an audit copy only. The imported code contract remains canonical.
  }
}

export function recordResponsiveLearningObservation(observation: ResponsiveLearningObservation) {
  try {
    const key = RESPONSIVE_SHELL_FACTORY_DEFAULT.learning.storageKey;
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]") as ResponsiveLearningObservation[];
    const records = Array.isArray(parsed) ? parsed : [];
    const signature = (item: ResponsiveLearningObservation) => `${item.contractVersion}|${item.scope}|${item.route}|${item.stage}|${item.verticalStage}|${item.verticalFocus}|${item.topbarDisclosure}|${item.issues.join(",")}|${item.recommendations.join(",")}`;
    if (records.length && signature(records[records.length - 1]) === signature(observation)) return;
    records.push(observation);
    window.localStorage.setItem(key, JSON.stringify(records.slice(-RESPONSIVE_SHELL_FACTORY_DEFAULT.learning.maxRecords)));
    window.dispatchEvent(new CustomEvent("tradepro:responsive-contract-learning", { detail: observation }));
    const recommendationKey = RESPONSIVE_SHELL_FACTORY_DEFAULT.learning.recommendationStorageKey;
    const recommendationRecords = JSON.parse(window.localStorage.getItem(recommendationKey) || "[]") as Array<{
      contractVersion: string;
      scope: string;
      route: string;
      recommendations: ResponsiveLearningRecommendationId[];
      measuredAt: string;
    }>;
    recommendationRecords.push({
      contractVersion: observation.contractVersion,
      scope: observation.scope,
      route: observation.route,
      recommendations: observation.recommendations,
      measuredAt: observation.measuredAt,
    });
    window.localStorage.setItem(recommendationKey, JSON.stringify(recommendationRecords.slice(-RESPONSIVE_SHELL_FACTORY_DEFAULT.learning.maxRecords)));
    window.dispatchEvent(new CustomEvent("tradepro:responsive-auto-recommendation", { detail: observation }));
  } catch {
    // Learning records never block page operation or factory restoration.
  }
}
