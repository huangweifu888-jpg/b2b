import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ellipsis, LayoutPanelTop, ListChecks, Menu, Palette } from "lucide-react";

import {
  RESPONSIVE_SHELL_FACTORY_DEFAULT,
  RESPONSIVE_SHELL_TOOL_LABELS,
} from "@/lib/responsive-shell-contract";
import { SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT } from "@/lib/shared-adaptive-surface-contract";

type SemanticBandId = "page-context" | "theme" | "table-header";
type OpenPanel = SemanticBandId | "overflow";
type ToolLabelMode = "labelled" | "icon-only";

type SemanticAction = {
  element: HTMLElement;
  label: string;
  disabled: boolean;
};

type SemanticBand = {
  id: SemanticBandId;
  element: HTMLElement;
  title: string;
  description: string;
  actions: SemanticAction[];
};

const BAND_SELECTORS: Record<SemanticBandId, string> = {
  "page-context": [
    "[data-responsive-semantic-band='page-context']",
    "[data-responsive-semantic-band='title-1']",
    "[data-responsive-shared-surface='title-1']",
    "[data-page-title]",
    "[data-client-project-context]",
    "[data-shared-layout-section='title'][data-development-standard-frame-region='title']",
  ].join(","),
  theme: [
    "[data-responsive-semantic-band='theme']",
    "[data-responsive-semantic-band='title-2']",
    "[data-responsive-shared-surface='title-2']",
    "[data-development-standard-frame-label='标题 2']",
  ].join(","),
  "table-header": [
    "[data-responsive-semantic-band='table-header']",
    "[data-responsive-shared-surface='table-header']",
    "[data-page-table-header]",
    "[data-product-market-table-header]",
    "[data-shared-layout-section='tableHeader']",
    "[data-development-standard-frame-region='table-header']",
  ].join(","),
};

function isRendered(element: HTMLElement) {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}

function readBandCopy(element: HTMLElement, id: SemanticBandId) {
  const titleElement = element.querySelector<HTMLElement>(
    "[data-responsive-semantic-title], [data-shared-title-heading], h1, h2, h3, .adaptive-work-matrix-section-title",
  );
  const descriptionElement = element.querySelector<HTMLElement>(
    "[data-responsive-semantic-description], [data-shared-title-description], .template-config-title-description, .adaptive-work-matrix-subhead",
  );
  const fallback = (element.innerText || "").replace(/\s+/g, " ").trim();
  return {
    title: (titleElement?.innerText || fallback || RESPONSIVE_SHELL_TOOL_LABELS[id]).replace(/\s+/g, " ").trim().slice(0, 96),
    description: (descriptionElement?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 180),
  };
}

function readBandActions(element: HTMLElement): SemanticAction[] {
  const seen = new Set<string>();
  return Array.from(element.querySelectorAll<HTMLElement>("button, a[href], [role='button']"))
    .filter((action) => !action.matches(".nav-mobile-disclosure, [data-responsive-semantic-proxy-exclude]"))
    .filter((action) => isRendered(action))
    .map((action) => {
      const label = (action.getAttribute("aria-label") || action.getAttribute("title") || action.innerText || "操作")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 48);
      return { element: action, label, disabled: action.matches(":disabled, [aria-disabled='true']") };
    })
    .filter((action) => {
      if (!action.label || seen.has(action.label)) return false;
      seen.add(action.label);
      return true;
    })
    .slice(0, 8);
}

function inferLegacySemanticBand(host: HTMLElement, id: SemanticBandId) {
  if (id === "theme") return null;
  if (id === "table-header") {
    return Array.from(host.querySelectorAll<HTMLElement>("table thead"))
      .find((element) => isRendered(element)) || null;
  }

  const heading = Array.from(host.querySelectorAll<HTMLElement>("h1, h2"))
    .filter((element) => !element.closest("nav, aside, footer, [role='dialog']"))
    .find((element) => isRendered(element));
  if (!heading) return null;

  const maximumBandHeight = Math.max(200, heading.getBoundingClientRect().height * 5);
  let best: HTMLElement = heading;
  let current = heading.parentElement;
  for (let depth = 0; current && current !== host && depth < 4; depth += 1, current = current.parentElement) {
    // Page-factory and direct page-host carriers wrap both the title card and
    // the real dashboard/list content. They are never a title surface, even
    // while an async page is still short enough to fit the legacy budget.
    if (current.parentElement === host || current.matches(
      "[data-page-factory-contract], [data-page-factory-region='content'], [data-page-layout-surface], [data-page-layout-frame]",
    )) break;
    const rect = current.getBoundingClientRect();
    if (rect.height > maximumBandHeight || current.querySelectorAll("h1, h2").length > 1) break;
    best = current;
  }
  return best;
}

function isSafeSemanticBandCandidate(host: HTMLElement, element: HTMLElement, id: SemanticBandId) {
  if (!isRendered(element)) return false;
  if (id !== "page-context") return true;
  if (element.matches([
    "[data-responsive-semantic-band='page-context']",
    "[data-responsive-semantic-band='title-1']",
    "[data-responsive-shared-surface='title-1']",
    "[data-client-project-context]",
    "[data-shared-layout-section='title'][data-development-standard-frame-region='title']",
  ].join(","))) return true;

  // Some legacy dashboards put `data-page-title` on the page wrapper rather
  // than on the heading band.  Collapsing that wrapper would hide the entire
  // dashboard.  Accept the legacy marker only while it still behaves like a
  // bounded title; otherwise infer the smallest heading-owned band below it.
  const rect = element.getBoundingClientRect();
  const hostHeight = Math.max(host.getBoundingClientRect().height, window.innerHeight);
  return rect.height <= Math.max(220, hostHeight * 0.4);
}

function resolveSemanticBand(host: HTMLElement, id: SemanticBandId, previous?: SemanticBand) {
  if (previous?.element.isConnected && host.contains(previous.element)) {
    const copy = readBandCopy(previous.element, id);
    return { ...previous, ...copy, actions: readBandActions(previous.element) };
  }
  const candidates = Array.from(host.querySelectorAll<HTMLElement>(BAND_SELECTORS[id]));
  const element = candidates.find((candidate) => isSafeSemanticBandCandidate(host, candidate, id))
    || inferLegacySemanticBand(host, id);
  if (!element) return null;
  const copy = readBandCopy(element, id);
  return { id, element, ...copy, actions: readBandActions(element) } satisfies SemanticBand;
}

function bandsSignature(bands: SemanticBand[]) {
  return bands.map((band) => `${band.id}:${band.title}:${band.description}:${band.actions.map((action) => action.label).join("|")}`).join(";");
}

export default function ResponsiveSemanticPageTools({
  scope,
  disabled = false,
}: {
  scope: string;
  disabled?: boolean;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const labelledRequiredWidthRef = useRef(0);
  const iconRequiredWidthRef = useRef(0);
  const labelledLayoutOverflowRef = useRef(false);
  const measuredViewportWidthRef = useRef(0);
  const bandElementsRef = useRef(new Map<SemanticBandId, HTMLElement>());
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [bands, setBands] = useState<SemanticBand[]>([]);
  const [openPanel, setOpenPanel] = useState<OpenPanel | null>(null);
  const [toolLabelMode, setToolLabelMode] = useState<ToolLabelMode>("labelled");
  const [toolsOverflowed, setToolsOverflowed] = useState(false);
  const [activeShell, setActiveShell] = useState<HTMLElement | null>(null);
  const integratedWithShellTools = target?.matches("[data-responsive-page-tools-slot]") || false;
  const toolSetSignature = bands.map((band) => band.id).join("|");

  useLayoutEffect(() => {
    if (disabled) {
      bandElementsRef.current.clear();
      setTarget(null);
      setBands([]);
      return;
    }
    const pageHost = anchorRef.current?.closest<HTMLElement>("[data-responsive-page-host]");
    const pageShell = pageHost?.closest<HTMLElement>("[data-responsive-shell]");
    if (!pageHost || !pageShell) return;
    setActiveShell(pageShell);

    const nextTarget = pageShell.querySelector<HTMLElement>("[data-responsive-page-tools-slot]")
      || pageShell.querySelector<HTMLElement>("[data-responsive-topbar]");
    setTarget(nextTarget);

    let currentBands: SemanticBand[] = [];
    let currentSignature = "";
    let frame = 0;
    const refresh = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = (["page-context", "theme", "table-header"] as const)
          .map((id) => resolveSemanticBand(pageHost, id, currentBands.find((band) => band.id === id)))
          .filter((band): band is SemanticBand => Boolean(band));
        const signature = bandsSignature(next);
        bandElementsRef.current = new Map(next.map((band) => [band.id, band.element]));
        const ownsSameElements = next.length === currentBands.length
          && next.every((band, index) => band.id === currentBands[index]?.id && band.element === currentBands[index]?.element);
        if (signature === currentSignature && ownsSameElements) return;
        currentSignature = signature;
        currentBands = next;
        setBands(next);
      });
    };
    const observer = new MutationObserver(refresh);
    observer.observe(pageHost, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-responsive-semantic-band", "data-responsive-shared-surface"],
    });
    refresh();
    return () => {
      bandElementsRef.current.clear();
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [disabled, scope]);

  useEffect(() => {
    const activeBands = bands.flatMap(({ id }) => {
      const element = bandElementsRef.current.get(id);
      return element ? [{ id, element }] : [];
    });
    for (const { id, element } of activeBands) {
      const surface = id === "page-context" ? "title-1" : id === "theme" ? "title-2" : "table-header";
      element.dataset.responsiveSemanticBandActive = id;
      element.dataset.responsiveLiveSurface = surface;
      element.dataset.responsiveLiveSurfaceSource = SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.sourceViewport;
      element.dataset.responsiveLiveSurfaceContract = SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.version;
      if (openPanel === id) {
        element.dataset.responsiveLiveSurfaceOpen = "true";
      } else {
        delete element.dataset.responsiveLiveSurfaceOpen;
      }
    }
    return () => {
      for (const { id, element } of activeBands) {
        if (element.dataset.responsiveSemanticBandActive === id) delete element.dataset.responsiveSemanticBandActive;
        delete element.dataset.responsiveLiveSurface;
        delete element.dataset.responsiveLiveSurfaceSource;
        delete element.dataset.responsiveLiveSurfaceContract;
        delete element.dataset.responsiveLiveSurfaceOpen;
      }
    };
  }, [bands, openPanel]);

  useEffect(() => {
    const titleBand = bands.find((band) => band.id === "page-context");
    if (!titleBand) return;

    const clearMeasurement = () => {
      delete titleBand.element.dataset.responsiveLiveTitleLayoutMode;
      delete titleBand.element.dataset.responsiveLiveTitleActionsRequiredWidth;
      delete titleBand.element.dataset.responsiveLiveTitleActionsScroll;
      titleBand.element.style.removeProperty("--responsive-live-title-actions-width");
    };
    if (openPanel !== "page-context") {
      clearMeasurement();
      return;
    }

    let frame = 0;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const layout = titleBand.element.matches("[data-responsive-generated-title-band='true']")
          ? titleBand.element
          : titleBand.element.querySelector<HTMLElement>("[data-responsive-live-title-layout]");
        const actions = titleBand.element.querySelector<HTMLElement>(
          "[data-page-title-actions], [data-responsive-generated-title-actions='true']",
        );
        if (!layout || !actions) {
          titleBand.element.dataset.responsiveLiveTitleLayoutMode = "stacked";
          return;
        }

        const controls = Array.from(actions.children)
          .filter((element): element is HTMLElement => element instanceof HTMLElement && isRendered(element));
        const actionStyle = getComputedStyle(actions);
        const actionGap = Number.parseFloat(actionStyle.columnGap || actionStyle.gap) || 0;
        const requiredWidth = controls.reduce((total, control) => (
          total + Math.max(control.getBoundingClientRect().width, control.scrollWidth)
        ), 0) + Math.max(0, controls.length - 1) * actionGap;
        const policy = SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.compactTitleCopy;
        const layoutWidth = layout.getBoundingClientRect().width;
        const inline = window.innerWidth >= policy.inlineTitleActionMinimumWidth && requiredWidth > 0;
        const availableInlineWidth = Math.max(0, layoutWidth - policy.minimumInlineTitleWidth - policy.titleActionGap);
        const actionsWidth = inline && availableInlineWidth > 0
          ? Math.min(requiredWidth, Math.floor(availableInlineWidth))
          : requiredWidth;
        const scroll = inline && actionsWidth + 0.5 < requiredWidth;

        titleBand.element.dataset.responsiveLiveTitleLayoutMode = inline ? "inline" : "stacked";
        titleBand.element.dataset.responsiveLiveTitleActionsRequiredWidth = `${Math.ceil(requiredWidth)}`;
        titleBand.element.dataset.responsiveLiveTitleActionsScroll = scroll ? "true" : "false";
        titleBand.element.style.setProperty("--responsive-live-title-actions-width", `${Math.ceil(actionsWidth)}px`);
      });
    };

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(titleBand.element);
    window.addEventListener("resize", measure, { passive: true });
    measure();
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
      clearMeasurement();
    };
  }, [bands, openPanel]);

  useLayoutEffect(() => {
    const currentShell = anchorRef.current?.closest<HTMLElement>("[data-responsive-shell]");
    const currentTarget = currentShell?.querySelector<HTMLElement>("[data-responsive-page-tools-slot]")
      || currentShell?.querySelector<HTMLElement>("[data-responsive-topbar]");
    if (!currentTarget) return;
    const topbar = currentTarget.matches("[data-responsive-topbar]")
      ? currentTarget
      : currentTarget.closest<HTMLElement>("[data-responsive-topbar]");
    if (!topbar) return;
    topbar.dataset.responsiveToolsLabelMode = toolLabelMode;
    topbar.dataset.responsiveToolsOverflowed = toolsOverflowed ? "true" : "false";
    let frame = 0;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const rail = rootRef.current;
        if (!rail) return;
        if (measuredViewportWidthRef.current !== window.innerWidth) {
          measuredViewportWidthRef.current = window.innerWidth;
          labelledLayoutOverflowRef.current = false;
        }
        const pressureActive = window.innerWidth <= RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.activationMax
          || window.innerHeight <= RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBreakpoints.focusMax;
        if (!pressureActive) {
          setToolLabelMode("labelled");
          setToolsOverflowed(false);
          return;
        }
        const topbarStyle = getComputedStyle(topbar);
        // Compare the controls with the topbar's stable inner capacity. The
        // rail's width and start edge both change after a density transition,
        // so either one would make the decision oscillate. The topbar box,
        // physical padding and contract safety inset stay invariant while the
        // controls move between labelled, icon-only and overflow modes.
        const topbarRect = topbar.getBoundingClientRect();
        const startPadding = Number.parseFloat(topbarStyle.paddingLeft) || 0;
        const endPadding = Number.parseFloat(topbarStyle.paddingRight) || 0;
        const visibleTopbarWidth = Math.max(0,
          Math.min(topbarRect.right, window.innerWidth) - Math.max(topbarRect.left, 0));
        const available = Math.max(0, Math.floor(
          visibleTopbarWidth
          - startPadding
          - endPadding
          - RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.capacitySafetyInset,
        ));
        rail.dataset.responsiveToolsAvailableWidth = `${available}`;
        topbar.dataset.responsiveToolsAvailableWidth = `${available}`;
        const tolerance = RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.capacityTolerance;
        const revealHysteresis = RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.capacityRevealHysteresis;

        if (toolsOverflowed) {
          rail.dataset.responsiveToolsLabelledLayoutOverflow = labelledLayoutOverflowRef.current ? "true" : "false";
          rail.dataset.responsiveToolsRequiredWidth = `${iconRequiredWidthRef.current}`;
          if (available >= iconRequiredWidthRef.current + revealHysteresis) setToolsOverflowed(false);
          return;
        }

        const triggers = Array.from(topbar.querySelectorAll<HTMLElement>("[data-responsive-toolbar-trigger]:not([data-responsive-toolbar-trigger='overflow']):not([data-responsive-toolbar-trigger='visual'])"))
          .filter(isRendered);
        const gap = Number.parseFloat(topbarStyle.columnGap || topbarStyle.gap) || 0;
        const required = Math.ceil(triggers.reduce((total, trigger) => (
          total + Math.max(trigger.getBoundingClientRect().width, trigger.scrollWidth)
        ), 0) + Math.max(0, triggers.length - 1) * gap);
        const contentLeft = Math.max(topbarRect.left + startPadding, startPadding);
        const contentRight = Math.min(
          topbarRect.right - endPadding,
          window.innerWidth - RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.capacitySafetyInset,
        );
        const renderedEscape = triggers.some((trigger) => {
          const rect = trigger.getBoundingClientRect();
          return rect.left < contentLeft - tolerance || rect.right > contentRight + tolerance;
        });
        const layoutOverflow = renderedEscape || topbar.scrollWidth > topbar.clientWidth + tolerance;
        rail.dataset.responsiveToolsRequiredWidth = `${required}`;

        if (toolLabelMode === "labelled") {
          labelledLayoutOverflowRef.current = layoutOverflow;
          rail.dataset.responsiveToolsLabelledLayoutOverflow = layoutOverflow ? "true" : "false";
          labelledRequiredWidthRef.current = required;
          rail.dataset.responsiveToolsLabelledRequiredWidth = `${required}`;
          topbar.dataset.responsiveToolsLabelledRequiredWidth = `${required}`;
          if (required > available + tolerance || layoutOverflow) setToolLabelMode("icon-only");
          return;
        }

        iconRequiredWidthRef.current = required;
        rail.dataset.responsiveToolsLabelledLayoutOverflow = labelledLayoutOverflowRef.current ? "true" : "false";
        rail.dataset.responsiveToolsIconRequiredWidth = `${required}`;
        topbar.dataset.responsiveToolsIconRequiredWidth = `${required}`;
        if (required > available + tolerance || layoutOverflow) {
          setToolsOverflowed(true);
        } else if (!labelledLayoutOverflowRef.current
          && labelledRequiredWidthRef.current > 0
          && available >= labelledRequiredWidthRef.current + revealHysteresis) {
          setToolLabelMode("labelled");
        }
      });
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    const mutationObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver(measure);
    observer?.observe(topbar);
    if (rootRef.current) observer?.observe(rootRef.current);
    mutationObserver?.observe(topbar, { subtree: true, childList: true, characterData: true });
    window.addEventListener("resize", measure, { passive: true });
    measure();
    const settleTimer = window.setTimeout(measure, 200);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
      mutationObserver?.disconnect();
      delete topbar.dataset.responsiveToolsLabelMode;
      delete topbar.dataset.responsiveToolsOverflowed;
      delete topbar.dataset.responsiveToolsAvailableWidth;
      delete topbar.dataset.responsiveToolsLabelledRequiredWidth;
      delete topbar.dataset.responsiveToolsIconRequiredWidth;
      rootRef.current?.removeAttribute("data-responsive-tools-labelled-layout-overflow");
    };
  }, [bands, target, toolLabelMode, toolsOverflowed]);

  useEffect(() => {
    setOpenPanel(null);
    setToolLabelMode("labelled");
    setToolsOverflowed(false);
    labelledRequiredWidthRef.current = 0;
    iconRequiredWidthRef.current = 0;
    labelledLayoutOverflowRef.current = false;
    measuredViewportWidthRef.current = 0;
  }, [target, disabled, toolSetSignature]);

  useEffect(() => {
    if (!openPanel) return;
    const closeOnPointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || rootRef.current?.contains(event.target)) return;
      if (bands.some((band) => band.element.contains(event.target))) return;
      setOpenPanel(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpenPanel(null);
      window.requestAnimationFrame(() => activeTriggerRef.current?.focus());
    };
    const closeOnResize = () => setOpenPanel(null);
    document.addEventListener("pointerdown", closeOnPointer, true);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnResize, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", closeOnPointer, true);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnResize);
    };
  }, [bands, openPanel]);

  const togglePanel = (panel: OpenPanel, trigger: HTMLButtonElement) => {
    activeTriggerRef.current = trigger;
    setOpenPanel((current) => current === panel ? null : panel);
  };
  const bandById = (id: SemanticBandId) => bands.find((band) => band.id === id);
  const visibleBands = toolsOverflowed ? bands.filter((band) => band.id === "table-header") : bands;
  const navigationLabel = bandById("page-context")?.title || RESPONSIVE_SHELL_TOOL_LABELS.navigation;

  const renderTrigger = (id: SemanticBandId, order: number) => {
    const band = bandById(id);
    if (!band || !visibleBands.includes(band)) return null;
    const Icon = id === "page-context" ? LayoutPanelTop : id === "theme" ? Palette : ListChecks;
    return (
      <button
        type="button"
        data-responsive-toolbar-trigger={id}
        data-responsive-function-key-plugin="shared"
        data-responsive-toolbar-order={order}
        data-responsive-priority={id === "theme" ? "p1" : "p0"}
        aria-label={`${openPanel === id ? "收起" : "展开"}${RESPONSIVE_SHELL_TOOL_LABELS[id]}`}
        aria-expanded={openPanel === id}
        onClick={(event) => togglePanel(id, event.currentTarget)}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span data-responsive-tool-label>{RESPONSIVE_SHELL_TOOL_LABELS[id]}</span>
      </button>
    );
  };

  if (!target || !bands.length) return <span ref={anchorRef} hidden />;

  return (
    <>
      <span ref={anchorRef} hidden />
      {createPortal(
        <div
          ref={rootRef}
          data-responsive-page-tools-standalone
          data-responsive-independent-tools
          data-responsive-semantic-tools="true"
          data-responsive-single-live-source="true"
          data-responsive-tools-capacity-policy={RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.capacityPolicy}
          data-responsive-tools-label-mode={toolLabelMode}
          data-responsive-tools-overflowed={toolsOverflowed ? "true" : "false"}
          data-responsive-page-tools-panel={openPanel || "closed"}
          data-responsive-page-tools-expanded={openPanel ? "true" : "false"}
        >
          {!integratedWithShellTools ? (
            <>
              <button
                type="button"
                data-responsive-page-tools-nav
                data-responsive-toolbar-trigger="navigation"
                data-responsive-function-key-plugin="shared"
                data-responsive-toolbar-order="1"
                aria-label={`打开${navigationLabel}导航`}
                title={navigationLabel}
                data-responsive-navigation-label="page-name"
                onClick={() => activeShell?.querySelector<HTMLButtonElement>("[data-responsive-nav-trigger]")?.click()}
              >
                <Menu className="h-4 w-4" aria-hidden="true" />
                <span data-responsive-tool-label>{navigationLabel}</span>
              </button>
            </>
          ) : null}
          {renderTrigger("page-context", 3)}
          {renderTrigger("theme", 4)}
          {renderTrigger("table-header", 5)}
          <button
            type="button"
            data-responsive-toolbar-trigger="overflow"
            data-responsive-function-key-plugin="shared"
            data-responsive-toolbar-order="6"
            data-responsive-priority="p1"
            aria-expanded={openPanel === "overflow"}
            onClick={(event) => togglePanel("overflow", event.currentTarget)}
          >
            <Ellipsis className="h-4 w-4" aria-hidden="true" />
            <span data-responsive-tool-label>{RESPONSIVE_SHELL_TOOL_LABELS.overflow}</span>
          </button>
          <div
            role="region"
            aria-label="共享页面工具面板"
            data-responsive-page-tools-popover="anchored"
            data-responsive-shared-popover="page-tools"
            data-responsive-shared-popover-plugin="large-interaction-density"
            className={openPanel ? "is-expanded" : ""}
          >
            {openPanel === "overflow" ? (
              <div data-responsive-live-surface-overflow-menu>
                {bands.filter((band) => band.id !== "table-header").map((band) => (
                  <button
                    key={band.id}
                    type="button"
                    data-responsive-live-surface-overflow-target={band.id}
                    data-responsive-shared-action="overflow-surface"
                    data-responsive-shared-action-plugin="large-action-density"
                    onClick={() => setOpenPanel(band.id)}
                  >
                    {RESPONSIVE_SHELL_TOOL_LABELS[band.id]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>,
        target,
      )}
    </>
  );
}
