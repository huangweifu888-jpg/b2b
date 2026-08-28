import { Fragment, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import {
  GLOBAL_RESPONSIVE_PAGE_FACTORY_DEFAULT,
  resolveGlobalResponsiveContainerStage,
  resolveGlobalResponsivePageTemplate,
} from "@/lib/global-responsive-page-contract";
import { ADAPTIVE_STRUCTURE_FACTORY_DEFAULT } from "@/lib/adaptive-structure-contract";
import { SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT } from "@/lib/shared-adaptive-surface-contract";
import { SHARED_WINDOW_FACTORY_DEFAULT, SHARED_WINDOW_REGISTRY } from "@/lib/shared-window-contract";
import { RESPONSIVE_SHELL_FACTORY_DEFAULT } from "@/lib/responsive-shell-contract";
import { schedulePostPaintIdle } from "@/lib/post-paint-lazy";
import "@/page-factory/page-factory.css";
import type { ResponsivePageHostScope } from "./ResponsivePageHostRuntime";

const ResponsivePageHostRuntime = lazy(() => import("./ResponsivePageHostRuntime"));
const ResponsiveSemanticPageTools = lazy(() => import("./ResponsiveSemanticPageTools"));

type TitleOneFallbackState = {
  show: boolean;
  label: string;
};

export type { ResponsivePageHostScope } from "./ResponsivePageHostRuntime";

export default function ResponsivePageHost({ scope, children }: { scope: ResponsivePageHostScope; children: ReactNode }) {
  const location = useLocation();
  const [hostElement, setHostElement] = useState<HTMLDivElement | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [titleOneFallback, setTitleOneFallback] = useState<TitleOneFallbackState>({ show: false, label: "" });
  const template = resolveGlobalResponsivePageTemplate(location.pathname, location.search);
  const titleOneScopeLabel = scope === "hq"
    ? "总部工作台"
    : scope === "agency-source" || scope === "agency"
      ? "代理商工作台"
      : "客户源工作台";

  useLayoutEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const apply = () => {
      root.setAttribute("data-global-responsive-page-contract", GLOBAL_RESPONSIVE_PAGE_FACTORY_DEFAULT.version);
      root.setAttribute("data-global-responsive-page-strategy", GLOBAL_RESPONSIVE_PAGE_FACTORY_DEFAULT.strategy);
      root.setAttribute("data-global-responsive-page-template", template);
      root.setAttribute("data-global-responsive-page-container-stage", resolveGlobalResponsiveContainerStage(window.innerWidth));
      root.setAttribute("data-responsive-capacity-layout-policy", GLOBAL_RESPONSIVE_PAGE_FACTORY_DEFAULT.capacityLayout.strategy);
      root.setAttribute("data-responsive-adaptive-structure", ADAPTIVE_STRUCTURE_FACTORY_DEFAULT.version);
      root.setAttribute("data-responsive-mobile-architecture", ADAPTIVE_STRUCTURE_FACTORY_DEFAULT.mobileApplication.plugin);
      root.setAttribute("data-shared-adaptive-surface-contract", SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.version);
      root.setAttribute("data-shared-adaptive-surface-strategy", SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.strategy);
      root.setAttribute("data-shared-window-contract", SHARED_WINDOW_FACTORY_DEFAULT.version);
      root.setAttribute("data-shared-window-factory-default", SHARED_WINDOW_FACTORY_DEFAULT.id);
      root.setAttribute("data-shared-window-registry", SHARED_WINDOW_REGISTRY.map((window) => window.id).join(","));
    };
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      window.removeEventListener("resize", schedule);
      window.cancelAnimationFrame(frame);
      if (root.dataset.globalResponsivePageTemplate !== template) return;
      for (const attribute of [
        "data-global-responsive-page-contract",
        "data-global-responsive-page-strategy",
        "data-global-responsive-page-template",
        "data-global-responsive-page-container-stage",
        "data-responsive-capacity-layout-policy",
        "data-responsive-adaptive-structure",
        "data-responsive-mobile-architecture",
        "data-shared-adaptive-surface-contract",
        "data-shared-adaptive-surface-strategy",
        "data-shared-window-contract",
        "data-shared-window-factory-default",
        "data-shared-window-registry",
      ]) root.removeAttribute(attribute);
    };
  }, [template]);
  useEffect(() => schedulePostPaintIdle(() => setRuntimeReady(true)), []);
  const handleTitleOneFallbackChange = useCallback((show: boolean, label = "") => {
    setTitleOneFallback((current) => current.show === show && current.label === label
      ? current
      : { show, label });
  }, []);

  return (
    <div
      ref={setHostElement}
      data-responsive-page-host
      data-responsive-page-scope={scope}
      data-responsive-page-route={location.pathname}
      data-responsive-page-template={template}
      data-responsive-page-factory-default={GLOBAL_RESPONSIVE_PAGE_FACTORY_DEFAULT.version}
      data-responsive-capacity-layout={GLOBAL_RESPONSIVE_PAGE_FACTORY_DEFAULT.capacityLayout.plugin}
      data-responsive-adaptive-structure={ADAPTIVE_STRUCTURE_FACTORY_DEFAULT.id}
      data-responsive-adaptive-structure-version={ADAPTIVE_STRUCTURE_FACTORY_DEFAULT.version}
      data-responsive-mobile-architecture={ADAPTIVE_STRUCTURE_FACTORY_DEFAULT.mobileApplication.plugin}
      data-shared-adaptive-surface-contract={SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.version}
      data-shared-adaptive-surface-strategy={SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.strategy}
      data-shared-adaptive-surface="content"
      data-shared-adaptive-surface-source={SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.sourceViewport}
      data-shared-window-contract={SHARED_WINDOW_FACTORY_DEFAULT.version}
      data-shared-window-factory-default={SHARED_WINDOW_FACTORY_DEFAULT.id}
      data-shared-window-registry={SHARED_WINDOW_REGISTRY.map((window) => window.id).join(",")}
      data-responsive-content-ready="false"
    >
      <Fragment key="title-one-fallback">
        {titleOneFallback.show ? <section
          data-responsive-factory-title-one-fallback
          data-responsive-generated-title-band="true"
          data-responsive-semantic-band="page-context"
          data-responsive-shared-surface="title-1"
          data-responsive-shared-surface-plugin={RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedSurfaces.plugin}
          data-page-title
          data-shared-layout-section="title"
          data-development-standard-frame-region="title-1"
          data-development-standard-frame-label="标题1"
          className="flex w-full min-w-0 items-center"
        >
          <div data-responsive-generated-title-content data-responsive-live-title-layout className="min-w-0">
            <div data-shared-title-heading className="truncate font-semibold">{titleOneScopeLabel}</div>
            <div data-shared-title-description className="truncate opacity-80">{titleOneFallback.label}</div>
          </div>
        </section> : null}
      </Fragment>
      <Fragment key="page-content">{children}</Fragment>
      <Fragment key="semantic-tools">{runtimeReady ? (
        <Suspense fallback={null}><ResponsiveSemanticPageTools scope={scope} /></Suspense>
      ) : null}</Fragment>
      <Fragment key="deferred-runtime">{runtimeReady && hostElement ? (
        <Suspense fallback={null}>
          <ResponsivePageHostRuntime
            scope={scope}
            hostElement={hostElement}
            onShowTitleOneFallbackChange={handleTitleOneFallbackChange}
          />
        </Suspense>
      ) : null}</Fragment>
    </div>
  );
}
