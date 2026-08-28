import {
  forwardRef,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import {
  EXISTING_WORKSPACE_BODY_MARKER_HIT_AREA_ATTRIBUTE,
  EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT,
  findExistingWorkspaceBodyMarkerHost,
} from "@/lib/layout-frame-contract";

export type SharedPageWorkspaceProps = Omit<ComponentPropsWithoutRef<"section">, "children"> & {
  children: ReactNode;
};

type BodyMarkerHitAreaLayout = {
  host: HTMLElement;
  left: number;
  top: number;
  width: number;
  height: number;
};

const sameBodyMarkerHitAreaLayout = (
  current: BodyMarkerHitAreaLayout | null,
  next: BodyMarkerHitAreaLayout,
) => Boolean(current
  && current.host === next.host
  && Math.abs(current.left - next.left) < 0.25
  && Math.abs(current.top - next.top) < 0.25
  && Math.abs(current.width - next.width) < 0.25
  && Math.abs(current.height - next.height) < 0.25);

/**
 * The structural page frame used by Operations Market and every page that
 * opts into its shared-variable layout contract.  It deliberately owns only
 * the semantic workspace boundary; callers provide Title, Header and List
 * bands as direct children so their content remains domain-specific.
 */
export const SharedPageWorkspace = forwardRef<HTMLElement, SharedPageWorkspaceProps>(function SharedPageWorkspace(
  { children, className, ...sectionProps },
  ref,
) {
  const workspaceRef = useRef<HTMLElement | null>(null);
  const [bodyMarkerHitArea, setBodyMarkerHitArea] = useState<BodyMarkerHitAreaLayout | null>(null);

  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const host = findExistingWorkspaceBodyMarkerHost(workspace);
    if (!host) return;
    let animationFrame = 0;

    const measure = () => {
      animationFrame = 0;
      const hostRect = host.getBoundingClientRect();
      const workspaceRect = workspace.getBoundingClientRect();
      const width = workspaceRect.left - hostRect.left;
      const height = workspaceRect.height;
      if (!Number.isFinite(width)
        || !Number.isFinite(height)
        || width <= 0
        || height <= 0
        || workspaceRect.top < hostRect.top - 1
        || workspaceRect.bottom > hostRect.bottom + 1) {
        setBodyMarkerHitArea(null);
        return;
      }
      const next = {
        host,
        left: host.scrollLeft,
        top: workspaceRect.top - hostRect.top + host.scrollTop,
        width,
        height,
      } satisfies BodyMarkerHitAreaLayout;
      setBodyMarkerHitArea((current) => sameBodyMarkerHitAreaLayout(current, next) ? current : next);
    };
    const scheduleMeasure = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(measure);
    };
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleMeasure);
    resizeObserver?.observe(host);
    resizeObserver?.observe(workspace);
    host.addEventListener("scroll", scheduleMeasure, { passive: true });
    window.addEventListener("resize", scheduleMeasure, { passive: true });
    window.visualViewport?.addEventListener("resize", scheduleMeasure, { passive: true });
    measure();
    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      host.removeEventListener("scroll", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
      window.visualViewport?.removeEventListener("resize", scheduleMeasure);
      setBodyMarkerHitArea(null);
    };
  }, []);

  const hitAreaStyle = bodyMarkerHitArea ? {
    left: `${bodyMarkerHitArea.left}px`,
    top: `${bodyMarkerHitArea.top}px`,
    width: `${bodyMarkerHitArea.width}px`,
    height: `${bodyMarkerHitArea.height}px`,
  } satisfies CSSProperties : null;

  useLayoutEffect(() => {
    if (!bodyMarkerHitArea) return;
    const animationFrame = window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("tradepro:workspace-marker-layout"));
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [bodyMarkerHitArea]);

  return (
    <>
      <section
        ref={(element) => {
          workspaceRef.current = element;
          if (typeof ref === "function") ref(element);
          else if (ref) ref.current = element;
        }}
        {...sectionProps}
        data-shared-page-workspace
        data-page-layout-frame
        data-development-standard-frame-region="body"
        data-development-standard-frame-label="主体"
        data-development-standard-marker-placement="body-left-outer-gutter"
        className={className}
      >
        {children}
      </section>
      {bodyMarkerHitArea && hitAreaStyle ? createPortal(
        <span
          {...{ [EXISTING_WORKSPACE_BODY_MARKER_HIT_AREA_ATTRIBUTE]: EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.workspaceHitAreaValue }}
          aria-hidden="true"
          style={hitAreaStyle}
        />,
        bodyMarkerHitArea.host,
      ) : null}
    </>
  );
});
