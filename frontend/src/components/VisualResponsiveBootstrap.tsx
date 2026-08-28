import { useLayoutEffect } from "react";

import {
  RESPONSIVE_SHELL_FACTORY_DEFAULT,
  VISUAL_RESPONSIVE_RUNTIME_STATE_EVENT,
  createVisualResponsiveRuntimeOwnerId,
  parseVisualResponsiveRuntimeStateDetail,
  resolveResponsiveShellMode,
  resolveResponsiveShellScale,
  resolveResponsiveShellStage,
  resolveResponsiveVerticalStage,
  type VisualResponsiveRuntimeScope,
} from "@/lib/responsive-shell-contract";

/**
 * Synchronous, measurement-free shell bootstrap. It prevents a first-paint
 * responsive flash while learning, audits, observers and persistence load
 * after the route becomes interactive.
 */
export default function VisualResponsiveBootstrap({ scope }: { scope: VisualResponsiveRuntimeScope }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const ownerId = createVisualResponsiveRuntimeOwnerId("bootstrap", scope);
    let active = true;
    let frame = 0;
    let fullOwnerId: string | null = null;
    let resizeListening = false;
    const hasActiveFullRuntime = () => root.dataset.visualResponsiveRuntime === "full"
      && root.dataset.visualResponsiveScope === scope
      && Boolean(root.dataset.visualResponsiveRuntimeOwner);
    const apply = () => {
      if (!active || fullOwnerId || hasActiveFullRuntime()) return;
      const width = Math.max(RESPONSIVE_SHELL_FACTORY_DEFAULT.minimumSupportedWidth, window.innerWidth);
      const height = Math.max(RESPONSIVE_SHELL_FACTORY_DEFAULT.minimumSupportedHeight, window.innerHeight);
      const verticalStage = resolveResponsiveVerticalStage(height);
      root.setAttribute("data-visual-responsive-contract", "true");
      root.setAttribute("data-responsive-shell-contract", RESPONSIVE_SHELL_FACTORY_DEFAULT.version);
      root.setAttribute("data-visual-responsive-mode", resolveResponsiveShellMode(width));
      root.setAttribute("data-visual-responsive-stage", resolveResponsiveShellStage(width));
      root.setAttribute("data-visual-responsive-vertical-stage", verticalStage);
      root.setAttribute("data-visual-responsive-editor-band", width <= 640 ? "compact" : width <= 900 ? "small" : width <= 1180 ? "medium" : "large");
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
      root.setAttribute("data-responsive-vertical-focus", "false");
      root.style.setProperty("--visual-responsive-scale", resolveResponsiveShellScale(width).toFixed(3));
      root.style.setProperty("--visual-responsive-viewport-width", `${width}px`);
      root.style.setProperty("--visual-responsive-viewport-height", `${height}px`);
      root.style.setProperty("--visual-responsive-drawer-max", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.breakpoints.drawerMax}px`);
      root.style.setProperty("--responsive-shell-control-min", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.minimumInteractiveSize}px`);
      root.style.setProperty("--responsive-page-tools-footer-reserve", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.footerReserve}px`);
      root.style.setProperty("--responsive-capacity-row-min-content", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.rowMinimumContent}px`);
      root.style.setProperty("--responsive-capacity-row-gap", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.rowGap}px`);
      root.style.setProperty("--responsive-capacity-card-min", `${RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.cardMinimum}px`);
      root.setAttribute("data-visual-responsive-runtime", "bootstrap");
      root.setAttribute("data-visual-responsive-runtime-owner", ownerId);
    };
    const schedule = () => {
      if (!active || fullOwnerId || hasActiveFullRuntime()) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(apply);
    };
    const attachResize = () => {
      if (resizeListening) return;
      resizeListening = true;
      window.addEventListener("resize", schedule, { passive: true });
    };
    const detachResize = () => {
      if (!resizeListening) return;
      resizeListening = false;
      window.removeEventListener("resize", schedule);
    };
    const handleRuntimeState = (event: Event) => {
      const detail = parseVisualResponsiveRuntimeStateDetail(event instanceof CustomEvent ? event.detail : null);
      if (!active || !detail || detail.scope !== scope) return;
      if (detail.state === "ready") {
        if (root.dataset.visualResponsiveRuntime !== "full"
          || root.dataset.visualResponsiveRuntimeOwner !== detail.ownerId) return;
        fullOwnerId = detail.ownerId;
        window.cancelAnimationFrame(frame);
        frame = 0;
        detachResize();
        return;
      }
      if (fullOwnerId !== detail.ownerId) return;
      fullOwnerId = null;
      const currentFullOwner = root.dataset.visualResponsiveRuntime === "full"
        ? root.dataset.visualResponsiveRuntimeOwner || null
        : null;
      if (currentFullOwner && currentFullOwner !== detail.ownerId) {
        fullOwnerId = currentFullOwner;
        return;
      }
      apply();
      attachResize();
    };
    window.addEventListener(VISUAL_RESPONSIVE_RUNTIME_STATE_EVENT, handleRuntimeState);
    const currentFullOwner = hasActiveFullRuntime() ? root.dataset.visualResponsiveRuntimeOwner || null : null;
    if (currentFullOwner) fullOwnerId = currentFullOwner;
    else {
      apply();
      attachResize();
    }
    return () => {
      active = false;
      window.removeEventListener(VISUAL_RESPONSIVE_RUNTIME_STATE_EVENT, handleRuntimeState);
      detachResize();
      window.cancelAnimationFrame(frame);
      if (root.dataset.visualResponsiveRuntime !== "bootstrap"
        || root.dataset.visualResponsiveRuntimeOwner !== ownerId) return;
      for (const attribute of [
        "data-visual-responsive-runtime",
        "data-visual-responsive-runtime-owner",
        "data-visual-responsive-contract",
        "data-responsive-shell-contract",
        "data-visual-responsive-mode",
        "data-visual-responsive-stage",
        "data-visual-responsive-vertical-stage",
        "data-visual-responsive-editor-band",
        "data-visual-responsive-scope",
        "data-responsive-topbar-disclosure-policy",
        "data-responsive-sidebar-navigation-policy",
        "data-responsive-page-tools-policy",
        "data-responsive-page-tools-capacity-policy",
        "data-responsive-toolbar-order-policy",
        "data-responsive-function-key-policy",
        "data-responsive-shared-surface-policy",
        "data-responsive-theme-palette-policy",
        "data-responsive-page-host-policy",
        "data-responsive-capacity-layout-policy",
        "data-responsive-shared-action-policy",
        "data-responsive-title-action-policy",
        "data-responsive-title-action-plugin",
        "data-responsive-context-marker-policy",
        "data-responsive-context-marker-plugin",
        "data-responsive-workspace-marker-placement",
        "data-responsive-shared-interaction-policy",
        "data-responsive-visual-launcher-policy",
        "data-responsive-visual-launcher-default-dock",
        "data-responsive-footer-action-order",
        "data-responsive-footer-label-policy",
        "data-responsive-vertical-focus",
      ]) root.removeAttribute(attribute);
      for (const property of [
        "--visual-responsive-scale",
        "--visual-responsive-viewport-width",
        "--visual-responsive-viewport-height",
        "--visual-responsive-drawer-max",
        "--responsive-shell-control-min",
        "--responsive-page-tools-footer-reserve",
        "--responsive-capacity-row-min-content",
        "--responsive-capacity-row-gap",
        "--responsive-capacity-card-min",
      ]) root.style.removeProperty(property);
    };
  }, [scope]);
  return null;
}
