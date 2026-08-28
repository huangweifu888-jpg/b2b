import { useEffect } from "react";
import {
  RESPONSIVE_SHELL_FACTORY_DEFAULT,
  VISUAL_RESPONSIVE_RUNTIME_STATE_EVENT,
  createVisualResponsiveRuntimeOwnerId,
  resolveResponsiveShellMode,
  resolveResponsiveShellScale,
  resolveResponsiveShellStage,
  resolveResponsiveVerticalStage,
  type VisualResponsiveRuntimeScope,
} from "@/lib/responsive-shell-contract";
import {
  collectResponsiveLearningObservation,
  persistResponsiveFactorySnapshot,
  recordResponsiveLearningObservation,
} from "@/lib/responsive-shell-learning";
import {
  schedulePerformanceExperienceAudit,
  startPerformanceExperienceLearning,
} from "@/lib/performance-experience-learning";
import {
  SHARED_SMALL_CARD_CANDIDATE_DISCOVERY_SELECTOR,
  SHARED_SMALL_CARD_DISCOVERY_MUTATION_ATTRIBUTES,
  SHARED_SMALL_CARD_MARKER_SCOPE_SELECTOR,
  synchronizeSharedSmallCardMarkerPolicies,
} from "@/lib/shared-window-contract";

export type VisualResponsiveContractScope = VisualResponsiveRuntimeScope;

/**
 * Three-shell responsive contract. CSS owns layout; this host exposes the
 * code-owned factory defaults to HQ, Agency Source and Client Source.
 */
export default function VisualResponsiveContract({ scope }: { scope: VisualResponsiveContractScope }) {
  useEffect(() => {
    const root = document.documentElement;
    const ownerId = createVisualResponsiveRuntimeOwnerId("full", scope);
    const stopPerformanceExperienceLearning = startPerformanceExperienceLearning(scope);
    let active = true;
    let runtimeReadyDispatched = false;
    let auditFrame = 0;
    let auditPending = false;
    let stableFramesRemaining = 0;
    let lastObservedWidth = window.innerWidth;
    let lastObservedHeight = window.innerHeight;
    let scrollOwner: HTMLElement | null = null;
    let lastScrollTop = 0;
    let scrollDirection: -1 | 0 | 1 = 0;
    let directionStartTop = 0;
    let hasAuditedScrollPosition = false;
    let verticalFocus = false;
    const measuredTitleActionRails = new Set<HTMLElement>();
    const measuredTitleActionLayouts = new Set<HTMLElement>();
    const setVerticalFocus = (next: boolean) => {
      if (verticalFocus === next) return;
      verticalFocus = next;
      root.setAttribute("data-responsive-vertical-focus", next ? "true" : "false");
      scheduleApply();
    };
    const onContentScroll = () => {
      if (!scrollOwner) return;
      const current = scrollOwner.scrollTop;
      const delta = current - lastScrollTop;
      const nextDirection = delta > 0 ? 1 : delta < 0 ? -1 : scrollDirection;
      if (nextDirection !== scrollDirection) {
        scrollDirection = nextDirection;
        directionStartTop = lastScrollTop;
      }
      const directionTravel = current - directionStartTop;
      const budget = RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBudget;
      root.setAttribute("data-responsive-scroll-direction", scrollDirection > 0 ? "down" : scrollDirection < 0 ? "up" : "idle");
      root.setAttribute("data-responsive-scroll-top", `${Math.round(current)}`);
      if (window.innerHeight > RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBreakpoints.focusMax || current <= budget.resetScrollTop) {
        setVerticalFocus(false);
      } else if (current >= budget.focusScrollTop && scrollDirection === 1 && directionTravel >= budget.focusDirectionDelta) {
        setVerticalFocus(true);
      } else if (scrollDirection === -1 && directionTravel <= -budget.focusDirectionDelta) {
        setVerticalFocus(false);
      }
      lastScrollTop = current;
      if (scrollOwner.querySelector("[data-responsive-capacity-row='module-category']")) scheduleApply();
    };
    const bindScrollOwner = () => {
      const nextOwner = document.querySelector<HTMLElement>(`[data-responsive-shell="${scope}"] [data-page-list-scroll-owner], [data-responsive-shell="${scope}"] [data-product-market-scroll-list]`);
      if (nextOwner === scrollOwner) return;
      scrollOwner?.removeEventListener("scroll", onContentScroll);
      scrollOwner = nextOwner;
      lastScrollTop = nextOwner?.scrollTop || 0;
      directionStartTop = lastScrollTop;
      scrollDirection = 0;
      hasAuditedScrollPosition = false;
      root.setAttribute("data-responsive-scroll-owner", nextOwner ? "bound" : "missing");
      nextOwner?.addEventListener("scroll", onContentScroll, { passive: true });
    };
    const measureTitleActionRails = () => {
      const activeShell = document.querySelector<HTMLElement>(`[data-responsive-shell="${scope}"]`);
      activeShell?.querySelectorAll<HTMLElement>("[data-page-title-actions]").forEach((rail) => {
        const controls = Array.from(rail.children).filter((element): element is HTMLElement => {
          if (!(element instanceof HTMLElement)) return false;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        });
        if (!controls.length) return;
        const railStyle = getComputedStyle(rail);
        const gap = Number.parseFloat(railStyle.columnGap || railStyle.gap) || 0;
        const requiredWidth = Math.ceil(controls.reduce(
          (total, control) => total + Math.max(control.scrollWidth, control.getBoundingClientRect().width),
          0,
        ) + Math.max(0, controls.length - 1) * gap);
        if (requiredWidth <= 0) return;
        const layout = rail.closest<HTMLElement>("[data-responsive-live-title-layout], [data-product-market-title-main]");
        if (!layout) return;
        const policy = RESPONSIVE_SHELL_FACTORY_DEFAULT.titleActionCapacity;
        const inline = window.innerWidth > policy.compactMaximum;
        const layoutWidth = layout.getBoundingClientRect().width;
        const availableInlineWidth = Math.max(0, layoutWidth - policy.minimumTitleReserve - policy.titleActionGap);
        const railWidth = inline && availableInlineWidth > 0
          ? Math.min(requiredWidth, Math.floor(availableInlineWidth))
          : requiredWidth;
        const scroll = inline
          && railWidth + RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.measurementTolerance < requiredWidth;

        rail.dataset.responsiveTitleActionRequiredWidth = `${requiredWidth}`;
        rail.dataset.responsiveTitleActionScroll = scroll ? "true" : "false";
        rail.style.setProperty("--responsive-title-action-rail-width", `${railWidth}px`);
        measuredTitleActionRails.add(rail);
        layout.dataset.responsiveTitleActionFlow = inline ? "inline" : "stacked";
        layout.style.setProperty("--responsive-title-action-rail-width", `${railWidth}px`);
        measuredTitleActionLayouts.add(layout);
      });
    };
    const apply = () => {
      if (!active) return;
      const currentFullOwner = root.dataset.visualResponsiveRuntime === "full"
        && root.dataset.visualResponsiveScope === scope
        ? root.dataset.visualResponsiveRuntimeOwner
        : null;
      if (currentFullOwner && currentFullOwner !== ownerId) return;
      const width = Math.max(RESPONSIVE_SHELL_FACTORY_DEFAULT.minimumSupportedWidth, window.innerWidth);
      const height = Math.max(RESPONSIVE_SHELL_FACTORY_DEFAULT.minimumSupportedHeight, window.innerHeight);
      lastObservedWidth = window.innerWidth;
      lastObservedHeight = window.innerHeight;
      const mode = resolveResponsiveShellMode(width);
      const stage = resolveResponsiveShellStage(width);
      const verticalStage = resolveResponsiveVerticalStage(height);
      const scale = resolveResponsiveShellScale(width);
      // Preserve the visual editor's established compact/small/medium bands
      // while the shell itself uses the stricter 1024px navigation boundary.
      const editorBand = width <= 640 ? "compact" : width <= 900 ? "small" : width <= 1180 ? "medium" : "large";
      root.setAttribute("data-visual-responsive-contract", "true");
      root.setAttribute("data-responsive-shell-contract", RESPONSIVE_SHELL_FACTORY_DEFAULT.version);
      root.setAttribute("data-visual-responsive-mode", mode);
      root.setAttribute("data-visual-responsive-stage", stage);
      root.setAttribute("data-visual-responsive-vertical-stage", verticalStage);
      root.setAttribute("data-visual-responsive-editor-band", editorBand);
      root.setAttribute("data-visual-responsive-scope", scope);
      root.setAttribute("data-responsive-topbar-disclosure-policy", RESPONSIVE_SHELL_FACTORY_DEFAULT.topbarDisclosure.strategy);
      root.setAttribute("data-responsive-sidebar-navigation-policy", RESPONSIVE_SHELL_FACTORY_DEFAULT.sidebarNavigation.strategy);
      root.setAttribute("data-responsive-page-tools-policy", RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.strategy);
      root.setAttribute("data-responsive-page-tools-capacity-policy", RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.capacityPolicy);
      root.setAttribute("data-responsive-toolbar-order-policy", RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.triggerOrder.join(">"));
      root.setAttribute("data-responsive-function-key-policy", RESPONSIVE_SHELL_FACTORY_DEFAULT.functionKeys.strategy);
      root.setAttribute("data-responsive-shared-surface-policy", RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedSurfaces.strategy);
      root.setAttribute("data-responsive-theme-palette-policy", RESPONSIVE_SHELL_FACTORY_DEFAULT.themePalette.strategy);
      root.setAttribute("data-responsive-page-host-policy", RESPONSIVE_SHELL_FACTORY_DEFAULT.pageHost.strategy);
      root.setAttribute("data-responsive-capacity-layout-policy", RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.strategy);
      root.setAttribute("data-responsive-shared-action-policy", RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedActions.strategy);
      root.setAttribute("data-responsive-title-action-policy", RESPONSIVE_SHELL_FACTORY_DEFAULT.titleActionCapacity.strategy);
      root.setAttribute("data-responsive-title-action-plugin", RESPONSIVE_SHELL_FACTORY_DEFAULT.titleActionCapacity.plugin);
      root.setAttribute("data-responsive-context-marker-policy", RESPONSIVE_SHELL_FACTORY_DEFAULT.contextMarkers.strategy);
      root.setAttribute("data-responsive-context-marker-plugin", RESPONSIVE_SHELL_FACTORY_DEFAULT.contextMarkers.plugin);
      root.setAttribute("data-responsive-workspace-marker-placement", RESPONSIVE_SHELL_FACTORY_DEFAULT.contextMarkers.workspacePlacement);
      root.setAttribute("data-responsive-shared-interaction-policy", RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedInteractions.strategy);
      root.setAttribute("data-responsive-visual-launcher-policy", RESPONSIVE_SHELL_FACTORY_DEFAULT.visualLauncher.strategy);
      root.setAttribute("data-responsive-visual-launcher-default-dock", RESPONSIVE_SHELL_FACTORY_DEFAULT.visualLauncher.defaultDock);
      root.setAttribute("data-responsive-footer-action-order", RESPONSIVE_SHELL_FACTORY_DEFAULT.footerActions.order.join(">"));
      root.setAttribute("data-responsive-footer-label-policy", RESPONSIVE_SHELL_FACTORY_DEFAULT.footerActions.labelPolicy);
      if (verticalStage === "comfortable" || verticalStage === "compressed" || document.querySelector("[data-responsive-topbar-expanded='true']")) {
        verticalFocus = false;
      }
      root.setAttribute("data-responsive-vertical-focus", verticalFocus ? "true" : "false");
      root.style.setProperty("--visual-responsive-scale", scale.toFixed(3));
      root.style.setProperty("--visual-responsive-viewport-width", `${width}px`);
      root.style.setProperty("--visual-responsive-viewport-height", `${height}px`);
      root.style.setProperty("--visual-responsive-drawer-max", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.breakpoints.drawerMax}px`);
      root.style.setProperty("--responsive-topbar-popover-gap", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.topbarDisclosure.gap}px`);
      root.style.setProperty("--responsive-topbar-popover-viewport-edge", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.topbarDisclosure.viewportEdge}px`);
      root.style.setProperty("--responsive-page-tools-footer-reserve", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.footerReserve}px`);
      root.style.setProperty("--responsive-shell-control-min", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.minimumInteractiveSize}px`);
      root.style.setProperty("--responsive-function-key-height", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.functionKeys.height}px`);
      root.style.setProperty("--responsive-function-key-compact-width", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.functionKeys.compactWidth}px`);
      root.style.setProperty("--responsive-function-key-labelled-width", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.functionKeys.labelledWidth}px`);
      root.style.setProperty("--responsive-function-key-content-gap", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.functionKeys.contentGap}px`);
      root.style.setProperty("--responsive-shared-action-height", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedActions.height}px`);
      root.style.setProperty("--responsive-shared-action-icon-size", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedActions.iconSize}px`);
      root.style.setProperty("--responsive-shared-action-gap", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedActions.contentGap}px`);
      root.style.setProperty("--responsive-title-action-max-share", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.titleActionCapacity.maximumInlineSharePercent}%`);
      root.style.setProperty("--responsive-title-action-min-title", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.titleActionCapacity.minimumTitleReserve}px`);
      root.style.setProperty("--responsive-title-action-gap", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.titleActionCapacity.titleActionGap}px`);
      root.style.setProperty("--responsive-table-shell-marker-left-inset", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.contextMarkers.tableShellInset}px`);
      root.style.setProperty("--responsive-large-card-marker-top-inset", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.contextMarkers.largeCardTopInset}px`);
      root.style.setProperty("--responsive-workspace-marker-left-inset", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.contextMarkers.leftInset}px`);
      root.style.setProperty("--responsive-workspace-marker-compact-left-inset", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.contextMarkers.compactLeftInset}px`);
      root.style.setProperty("--responsive-workspace-marker-min-host-gutter", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.contextMarkers.minimumHostGutter}px`);
      root.style.setProperty("--responsive-capacity-row-min-content", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.rowMinimumContent}px`);
      root.style.setProperty("--responsive-capacity-row-gap", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.rowGap}px`);
      root.style.setProperty("--responsive-capacity-card-min", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.cardMinimum}px`);
      root.style.setProperty("--responsive-footer-lock-gap", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.footerActions.lockControlGap}px`);
      root.style.setProperty("--responsive-footer-control-content-gap", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.footerActions.controlContentGap}px`);
      root.style.setProperty("--responsive-visual-launcher-footer-slot", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.visualLauncher.footerSlotWidth}px`);
      root.style.setProperty("--responsive-visual-launcher-footer-slot-compact", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.visualLauncher.compactFooterSlotWidth}px`);
      synchronizeSharedSmallCardMarkerPolicies(document);
      const activeShell = document.querySelector<HTMLElement>(`[data-responsive-shell="${scope}"]`);
      const activeFooter = activeShell?.querySelector<HTMLElement>("[data-page-layout-footer]");
      const footerReserve = Math.max(
        RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.footerReserve,
        Math.ceil(activeFooter?.getBoundingClientRect().height || 0),
      );
      root.style.setProperty("--responsive-page-tools-footer-reserve", `${footerReserve}px`);
      bindScrollOwner();
      measureTitleActionRails();
      if (scrollOwner && (verticalStage === "focus" || verticalStage === "minimal")) {
        const current = scrollOwner.scrollTop;
        const delta = current - lastScrollTop;
        const budget = RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBudget;
        if (current <= budget.resetScrollTop) verticalFocus = false;
        else if (delta <= -budget.focusDirectionDelta) verticalFocus = false;
        else if (current >= budget.focusScrollTop && (!hasAuditedScrollPosition || delta >= budget.focusDirectionDelta || verticalFocus)) verticalFocus = true;
        hasAuditedScrollPosition = true;
        lastScrollTop = current;
        root.setAttribute("data-responsive-scroll-direction", delta > 0 ? "down" : delta < 0 ? "up" : "idle");
        root.setAttribute("data-responsive-scroll-top", `${Math.round(current)}`);
        root.setAttribute("data-responsive-vertical-focus", verticalFocus ? "true" : "false");
      }
      const observation = collectResponsiveLearningObservation(scope, width, height);
      root.setAttribute("data-responsive-learning-status", observation.issues.length ? "review" : "healthy");
      root.setAttribute("data-responsive-learning-issues", observation.issues.join(","));
      root.setAttribute("data-responsive-auto-recommendation-status", observation.recommendations.length ? "actionable" : "optimized");
      root.setAttribute("data-responsive-auto-recommendations", observation.recommendations.join(","));
      recordResponsiveLearningObservation(observation);
      schedulePerformanceExperienceAudit(scope);
      root.setAttribute("data-visual-responsive-runtime", "full");
      root.setAttribute("data-visual-responsive-runtime-owner", ownerId);
      if (!runtimeReadyDispatched) {
        runtimeReadyDispatched = true;
        window.dispatchEvent(new CustomEvent(VISUAL_RESPONSIVE_RUNTIME_STATE_EVENT, {
          detail: { scope, ownerId, state: "ready" },
        }));
      }
    };
    const ensureAuditFrame = () => {
      if (!active || auditFrame) return;
      auditFrame = window.requestAnimationFrame(() => {
        auditFrame = 0;
        if (!active) return;
        if (stableFramesRemaining > 0) {
          stableFramesRemaining -= 1;
          if (stableFramesRemaining > 0) {
            ensureAuditFrame();
            return;
          }
        }
        if (!auditPending) return;
        auditPending = false;
        apply();
      });
    };
    const scheduleApply = () => {
      if (!active) return;
      auditPending = true;
      ensureAuditFrame();
    };
    const scheduleStableMarkerApply = () => {
      if (!active) return;
      auditPending = true;
      stableFramesRemaining = 2;
      ensureAuditFrame();
    };
    persistResponsiveFactorySnapshot();
    scheduleApply();
    window.addEventListener("resize", scheduleApply, { passive: true });
    window.addEventListener("tradepro:workspace-marker-layout", scheduleStableMarkerApply);
    window.visualViewport?.addEventListener("resize", scheduleApply, { passive: true });
    const mediaQueries = Array.from(new Set([
      RESPONSIVE_SHELL_FACTORY_DEFAULT.breakpoints.compactMax,
      RESPONSIVE_SHELL_FACTORY_DEFAULT.breakpoints.wrapMax,
      RESPONSIVE_SHELL_FACTORY_DEFAULT.breakpoints.simplifyMax,
      RESPONSIVE_SHELL_FACTORY_DEFAULT.breakpoints.shrinkMax,
    ])).map((breakpoint) => window.matchMedia(`(max-width: ${breakpoint}px)`));
    mediaQueries.forEach((query) => query.addEventListener("change", scheduleApply));
    const heightMediaQueries = Array.from(new Set([
      RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBreakpoints.minimalMax,
      RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBreakpoints.focusMax,
      RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBreakpoints.compressedMax,
    ])).map((breakpoint) => window.matchMedia(`(max-height: ${breakpoint}px)`));
    heightMediaQueries.forEach((query) => query.addEventListener("change", scheduleApply));
    // Modern browsers already expose viewport and element resize signals. Keep
    // polling only as a legacy fallback, and never wake a hidden document.
    const fallbackDimensionAudit = typeof ResizeObserver === "undefined" && !window.visualViewport
      ? window.setInterval(() => {
          if (document.visibilityState !== "visible") return;
          if (window.innerWidth !== lastObservedWidth || window.innerHeight !== lastObservedHeight) scheduleApply();
        }, 1_000)
      : null;
    // SharedPageWorkspace publishes its portal geometry through the shared
    // marker event below; no timeout may wake an otherwise idle page.
    const shell = document.querySelector<HTMLElement>(`[data-responsive-shell="${scope}"]`);
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleApply);
    if (shell && resizeObserver) {
      resizeObserver.observe(shell);
      const topbar = shell.querySelector<HTMLElement>("[data-responsive-topbar]");
      const actions = shell.querySelector<HTMLElement>("[data-source-topbar-actions]");
      if (topbar) resizeObserver.observe(topbar);
      if (actions) resizeObserver.observe(actions);
    }
    const mutationObserver = shell ? new MutationObserver(scheduleApply) : null;
    mutationObserver?.observe(shell!, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "class",
        "aria-expanded",
        "data-responsive-topbar-expanded",
        "data-responsive-shell-tools-expanded",
        "data-responsive-page-tools-panel",
        "data-responsive-tools-overflowed",
        "data-responsive-tools-label-mode",
        "data-responsive-tools-available-width",
        "data-responsive-tools-labelled-required-width",
        "data-responsive-tools-icon-required-width",
        "data-responsive-tools-labelled-layout-overflow",
        "data-responsive-semantic-band-active",
        "data-responsive-live-surface-open",
      ],
    });
    const sharedMarkerMutationSelector = `${SHARED_SMALL_CARD_MARKER_SCOPE_SELECTOR}, ${SHARED_SMALL_CARD_CANDIDATE_DISCOVERY_SELECTOR}`;
    const markerMutationObserver = new MutationObserver((records) => {
      const touchesSharedMarker = records.some((record) => {
        if (record.type === "attributes") return true;
        return [...record.addedNodes, ...record.removedNodes].some((node) => (
          node instanceof Element
          && (node.matches(sharedMarkerMutationSelector) || Boolean(node.querySelector(sharedMarkerMutationSelector)))
        ));
      });
      if (touchesSharedMarker) scheduleApply();
    });
    markerMutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [...SHARED_SMALL_CARD_DISCOVERY_MUTATION_ATTRIBUTES],
    });
    return () => {
      active = false;
      window.cancelAnimationFrame(auditFrame);
      window.removeEventListener("resize", scheduleApply);
      window.removeEventListener("tradepro:workspace-marker-layout", scheduleStableMarkerApply);
      window.visualViewport?.removeEventListener("resize", scheduleApply);
      mediaQueries.forEach((query) => query.removeEventListener("change", scheduleApply));
      heightMediaQueries.forEach((query) => query.removeEventListener("change", scheduleApply));
      if (fallbackDimensionAudit !== null) window.clearInterval(fallbackDimensionAudit);
      scrollOwner?.removeEventListener("scroll", onContentScroll);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      markerMutationObserver.disconnect();
      stopPerformanceExperienceLearning();
      const ownsRuntime = root.dataset.visualResponsiveRuntime === "full"
        && root.dataset.visualResponsiveRuntimeOwner === ownerId
        && root.dataset.visualResponsiveScope === scope;
      if (ownsRuntime) {
      measuredTitleActionRails.forEach((rail) => {
        delete rail.dataset.responsiveTitleActionRequiredWidth;
        delete rail.dataset.responsiveTitleActionScroll;
        rail.style.removeProperty("--responsive-title-action-rail-width");
      });
      measuredTitleActionLayouts.forEach((layout) => {
        delete layout.dataset.responsiveTitleActionFlow;
        layout.style.removeProperty("--responsive-title-action-rail-width");
      });
      root.removeAttribute("data-visual-responsive-runtime");
      root.removeAttribute("data-visual-responsive-runtime-owner");
      root.removeAttribute("data-visual-responsive-contract");
      root.removeAttribute("data-responsive-shell-contract");
      root.removeAttribute("data-visual-responsive-mode");
      root.removeAttribute("data-visual-responsive-stage");
      root.removeAttribute("data-visual-responsive-vertical-stage");
      root.removeAttribute("data-visual-responsive-editor-band");
      root.removeAttribute("data-visual-responsive-scope");
      root.removeAttribute("data-responsive-topbar-disclosure-policy");
      root.removeAttribute("data-responsive-sidebar-navigation-policy");
      root.removeAttribute("data-responsive-page-tools-policy");
      root.removeAttribute("data-responsive-page-tools-capacity-policy");
      root.removeAttribute("data-responsive-toolbar-order-policy");
      root.removeAttribute("data-responsive-function-key-policy");
      root.removeAttribute("data-responsive-shared-surface-policy");
      root.removeAttribute("data-responsive-theme-palette-policy");
      root.removeAttribute("data-responsive-page-host-policy");
      root.removeAttribute("data-responsive-capacity-layout-policy");
      root.removeAttribute("data-responsive-shared-action-policy");
      root.removeAttribute("data-responsive-title-action-policy");
      root.removeAttribute("data-responsive-title-action-plugin");
      root.removeAttribute("data-responsive-context-marker-policy");
      root.removeAttribute("data-responsive-context-marker-plugin");
      root.removeAttribute("data-responsive-workspace-marker-placement");
      root.removeAttribute("data-responsive-shared-interaction-policy");
      root.removeAttribute("data-responsive-visual-launcher-policy");
      root.removeAttribute("data-responsive-visual-launcher-default-dock");
      root.removeAttribute("data-responsive-footer-action-order");
      root.removeAttribute("data-responsive-footer-label-policy");
      root.removeAttribute("data-responsive-learning-status");
      root.removeAttribute("data-responsive-learning-issues");
      root.removeAttribute("data-responsive-auto-recommendation-status");
      root.removeAttribute("data-responsive-auto-recommendations");
      root.removeAttribute("data-responsive-vertical-focus");
      root.removeAttribute("data-responsive-scroll-owner");
      root.removeAttribute("data-responsive-scroll-direction");
      root.removeAttribute("data-responsive-scroll-top");
      root.style.removeProperty("--visual-responsive-scale");
      root.style.removeProperty("--visual-responsive-viewport-width");
      root.style.removeProperty("--visual-responsive-viewport-height");
      root.style.removeProperty("--visual-responsive-drawer-max");
      root.style.removeProperty("--responsive-topbar-popover-gap");
      root.style.removeProperty("--responsive-topbar-popover-viewport-edge");
      root.style.removeProperty("--responsive-page-tools-footer-reserve");
      root.style.removeProperty("--responsive-shell-control-min");
      root.style.removeProperty("--responsive-function-key-height");
      root.style.removeProperty("--responsive-function-key-compact-width");
      root.style.removeProperty("--responsive-function-key-labelled-width");
      root.style.removeProperty("--responsive-function-key-content-gap");
      root.style.removeProperty("--responsive-shared-action-height");
      root.style.removeProperty("--responsive-shared-action-icon-size");
      root.style.removeProperty("--responsive-shared-action-gap");
      root.style.removeProperty("--responsive-title-action-max-share");
      root.style.removeProperty("--responsive-title-action-min-title");
      root.style.removeProperty("--responsive-title-action-gap");
      root.style.removeProperty("--responsive-table-shell-marker-left-inset");
      root.style.removeProperty("--responsive-large-card-marker-top-inset");
      root.style.removeProperty("--responsive-workspace-marker-left-inset");
      root.style.removeProperty("--responsive-workspace-marker-compact-left-inset");
      root.style.removeProperty("--responsive-workspace-marker-min-host-gutter");
      root.style.removeProperty("--responsive-capacity-row-min-content");
      root.style.removeProperty("--responsive-capacity-row-gap");
      root.style.removeProperty("--responsive-capacity-card-min");
      root.style.removeProperty("--responsive-footer-lock-gap");
      root.style.removeProperty("--responsive-footer-control-content-gap");
      root.style.removeProperty("--responsive-visual-launcher-footer-slot");
      root.style.removeProperty("--responsive-visual-launcher-footer-slot-compact");
      }
      if (runtimeReadyDispatched) {
        window.dispatchEvent(new CustomEvent(VISUAL_RESPONSIVE_RUNTIME_STATE_EVENT, {
          detail: { scope, ownerId, state: "released" },
        }));
      }
    };
  }, [scope]);

  return <span data-visual-responsive-contract-host data-visual-responsive-contract-scope={scope} hidden />;
}
