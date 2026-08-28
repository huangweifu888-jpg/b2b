import { useLayoutEffect, useRef } from "react";
import { Lock, Unlock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT } from "@/lib/shared-adaptive-surface-contract";

type PageFooterLockControlsProps = {
  sourceLocked: boolean;
  pageLocked: boolean;
  columnLocked: boolean;
  onToggleSource: () => void;
  onTogglePage: () => void;
  onToggleColumn: () => void;
  compact?: boolean;
};

const controls = [
  {
    id: "source",
    attribute: "data-source-code-lock",
    unlocked: "源码解",
    locked: "源码锁",
  },
  {
    id: "page",
    attribute: "data-page-style-lock",
    unlocked: "页面解",
    locked: "页面锁",
  },
  {
    id: "column",
    attribute: "data-column-lock",
    unlocked: "栏目解",
    locked: "栏目锁",
  },
] as const;

export function PageFooterLockControls({
  sourceLocked,
  pageLocked,
  columnLocked,
  onToggleSource,
  onTogglePage,
  onToggleColumn,
  compact = false,
}: PageFooterLockControlsProps) {
  const controlsRef = useRef<HTMLDivElement>(null);
  const lockedById = { source: sourceLocked, page: pageLocked, column: columnLocked };
  const toggleById = { source: onToggleSource, page: onTogglePage, column: onToggleColumn };

  useLayoutEffect(() => {
    const controlsElement = controlsRef.current;
    const footer = controlsElement?.closest<HTMLElement>("[data-page-layout-footer]");
    const copy = controlsElement?.parentElement;
    const primaryActions = footer?.querySelector<HTMLElement>("[data-footer-primary-actions]");
    if (!controlsElement || !footer || !copy) return;

    let frame = 0;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const mobileApplicationActive = window.innerWidth <= 639
          && document.documentElement.dataset.responsiveMobileArchitecture === "shared-mobile-app-frame-v1";
        if (mobileApplicationActive) {
          // The mobile application frame owns five equal primary cells. Each
          // lock therefore has a stable labelled cell instead of competing
          // with Visual and Save through desktop inline-width measurement.
          footer.dataset.responsiveFooterFlow = "inline";
          footer.dataset.responsiveMobileApplication = "true";
          controlsElement.dataset.responsiveFooterLockDensity = "labelled";
          controlsElement.dataset.responsiveFooterLockLabelledOverflow = "false";
          const footerInlineSize = footer.clientWidth;
          controlsElement.dataset.responsiveFooterLockAvailableWidth = (footerInlineSize * 0.6).toFixed(1);
          controlsElement.dataset.responsiveFooterLockRequiredWidth = (footerInlineSize * 0.6).toFixed(1);
          footer.dataset.responsiveFooterRequiredWidth = footerInlineSize.toFixed(1);
          footer.dataset.responsiveFooterAvailableWidth = footerInlineSize.toFixed(1);
          return;
        }
        delete footer.dataset.responsiveMobileApplication;
        // Capacity has one shared sequence on every page: keep labels, collapse
        // labels only when necessary, then wrap the footer only after the
        // icon-only rail still cannot fit beside Visual + Save.
        footer.dataset.responsiveFooterFlow = "inline";
        controlsElement.dataset.responsiveFooterLockDensity = "labelled";
        const footerStyle = getComputedStyle(footer);
        const gap = Number.parseFloat(footerStyle.columnGap || footerStyle.gap) || 0;
        const footerInlineSize = footer.clientWidth
          - (Number.parseFloat(footerStyle.paddingLeft) || 0)
          - (Number.parseFloat(footerStyle.paddingRight) || 0);
        // HQ and Agency pages can legitimately have no Visual/Save rail. They
        // still use the same footer-capacity sequence; an absent primary rail
        // simply contributes zero width instead of disabling measurement.
        const primaryRequired = primaryActions?.scrollWidth || 0;
        const available = Math.max(0, footerInlineSize - primaryRequired - gap);
        const required = copy.scrollWidth;
        const tolerance = 0.5;
        controlsElement.dataset.responsiveFooterLockAvailableWidth = available.toFixed(1);
        controlsElement.dataset.responsiveFooterLockRequiredWidth = required.toFixed(1);
        // The labelled state itself can push the primary rail beyond the
        // footer. Treat that physical overflow as insufficient capacity too.
        const labelsFit = required <= available + tolerance;
        controlsElement.dataset.responsiveFooterLockLabelledOverflow = labelsFit ? "false" : "true";
        if (labelsFit) {
          controlsElement.dataset.responsiveFooterLockDensity = "labelled";
          footer.dataset.responsiveFooterFlow = "inline";
          footer.dataset.responsiveFooterRequiredWidth = (required + primaryRequired + gap).toFixed(1);
          footer.dataset.responsiveFooterAvailableWidth = footerInlineSize.toFixed(1);
        } else {
          controlsElement.dataset.responsiveFooterLockDensity = "icon-only";
          // Read after the density attribute is applied so the decision uses
          // the actual icon-only plugin width, not the previous labelled rail.
          void controlsElement.offsetWidth;
          const iconRequired = controlsElement.scrollWidth;
          const iconFits = iconRequired <= available + tolerance;
          controlsElement.dataset.responsiveFooterLockIconRequiredWidth = iconRequired.toFixed(1);
          footer.dataset.responsiveFooterFlow = iconFits ? "inline" : "wrapped";
          footer.dataset.responsiveFooterRequiredWidth = (iconRequired + primaryRequired + gap).toFixed(1);
          footer.dataset.responsiveFooterAvailableWidth = footerInlineSize.toFixed(1);
        }
      });
    };

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    resizeObserver?.observe(footer);
    if (primaryActions) resizeObserver?.observe(primaryActions);
    window.addEventListener("resize", measure, { passive: true });
    void document.fonts?.ready.then(measure);
    measure();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      resizeObserver?.disconnect();
      delete footer.dataset.responsiveFooterFlow;
      delete footer.dataset.responsiveMobileApplication;
    };
  }, []);

  return (
    <div
      ref={controlsRef}
      data-page-lock-footer-controls
      data-shared-window-footer-locks
      data-shared-adaptive-surface="footer-controls"
      data-shared-adaptive-surface-source="desktop"
      data-shared-adaptive-surface-contract={SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.version}
      data-responsive-footer-lock-density="labelled"
      className="flex min-w-0 flex-wrap items-center gap-1"
    >
      {controls.map((control) => {
        const locked = lockedById[control.id];
        const attributes = { [control.attribute]: true };
        return (
          <Button
            key={control.id}
            type="button"
            variant="outline"
            onClick={toggleById[control.id]}
            aria-label={locked ? control.locked : control.unlocked}
            className={`template-config-footer-lock h-8 ${compact ? "px-3 text-xs" : "px-4 text-xs sm:text-sm"} font-semibold`}
            data-state={locked ? "locked" : "unlocked"}
            data-responsive-footer-lock-control={control.id}
            {...attributes}
          >
            {locked ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : <Unlock className="h-3.5 w-3.5" aria-hidden="true" />}
            <span data-page-lock-label>{locked ? control.locked : control.unlocked}</span>
          </Button>
        );
      })}
    </div>
  );
}
