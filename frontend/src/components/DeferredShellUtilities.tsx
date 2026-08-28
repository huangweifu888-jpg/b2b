import { lazy, Suspense, useEffect, useState, type ComponentProps, type ReactNode } from "react";

import {
  hasPendingSiteSwitchLoading,
  SITE_SWITCH_LOADING_EVENT_NAME,
} from "@/lib/site-switch-loading";
import { usePostPaintReady } from "@/lib/post-paint-lazy";

type GlobalLocalEnvAlertProps = ComponentProps<(typeof import("./GlobalLocalEnvAlert"))["default"]>;
type ExternalDevtoolsMenuProps = ComponentProps<(typeof import("./ExternalDevtoolsMenu"))["default"]>;
type PlatformSettingsDropdownProps = ComponentProps<(typeof import("./PlatformSettingsDropdown"))["default"]>;
type SoftwareVersionBadgeProps = ComponentProps<(typeof import("./SoftwareVersionBadge"))["default"]>;
type SidebarProjectVersionCardProps = ComponentProps<(typeof import("./SidebarProjectVersionCard"))["default"]>;
type UnifiedActionDialogProps = ComponentProps<(typeof import("./UnifiedActionDialog"))["default"]>;

const LazyGlobalLocalEnvAlert = lazy(() => import("./GlobalLocalEnvAlert"));
const LazyExternalDevtoolsMenu = lazy(() => import("./ExternalDevtoolsMenu"));
const LazyPlatformSettingsDropdown = lazy(() => import("./PlatformSettingsDropdown"));
const LazySoftwareVersionBadge = lazy(() => import("./SoftwareVersionBadge"));
const LazySidebarProjectVersionCard = lazy(() => import("./SidebarProjectVersionCard"));
const LazySiteSwitchLoadingOverlay = lazy(() => import("./SiteSwitchLoadingOverlay"));
const LazyUnifiedActionDialog = lazy(() => import("./UnifiedActionDialog"));

function PostPaintBoundary({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const ready = usePostPaintReady();
  return ready ? <>{children}</> : <>{fallback}</>;
}

/**
 * Shell utilities stay available on every source shell without competing with
 * navigation and page content in the synchronous route bundle. Each wrapper
 * preserves the existing component API while loading in an independent chunk.
 */
export function DeferredGlobalLocalEnvAlert(props: GlobalLocalEnvAlertProps) {
  return <PostPaintBoundary><Suspense fallback={null}><LazyGlobalLocalEnvAlert {...props} /></Suspense></PostPaintBoundary>;
}

export function DeferredExternalDevtoolsMenu(props: ExternalDevtoolsMenuProps) {
  const placeholder = <span data-deferred-shell-placeholder="external-devtools" aria-hidden="true" className={props.compact ? "inline-block h-8 w-8 shrink-0" : "inline-block h-8 w-full shrink-0"} />;
  return <PostPaintBoundary fallback={placeholder}><Suspense fallback={placeholder}><LazyExternalDevtoolsMenu {...props} /></Suspense></PostPaintBoundary>;
}

export function DeferredPlatformSettingsDropdown(props: PlatformSettingsDropdownProps) {
  const placeholder = <span data-deferred-shell-placeholder="platform-settings" aria-hidden="true" className={props.compact ? "inline-block h-8 w-8 shrink-0" : "inline-block h-8 w-full shrink-0"} />;
  return <PostPaintBoundary fallback={placeholder}><Suspense fallback={placeholder}><LazyPlatformSettingsDropdown {...props} /></Suspense></PostPaintBoundary>;
}

export function DeferredSoftwareVersionBadge(props: SoftwareVersionBadgeProps) {
  const placeholder = <span data-deferred-shell-placeholder="software-version" aria-hidden="true" className="inline-block h-6 min-w-16 shrink-0" />;
  return <PostPaintBoundary fallback={placeholder}><Suspense fallback={placeholder}><LazySoftwareVersionBadge {...props} /></Suspense></PostPaintBoundary>;
}

export function DeferredSidebarProjectVersionCard(props: SidebarProjectVersionCardProps) {
  const placeholder = <span data-deferred-shell-placeholder="project-version" aria-hidden="true" className="block h-10 w-full shrink-0" />;
  return <PostPaintBoundary fallback={placeholder}><Suspense fallback={placeholder}><LazySidebarProjectVersionCard {...props} /></Suspense></PostPaintBoundary>;
}

export function DeferredSiteSwitchLoadingOverlay() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => setActive(hasPendingSiteSwitchLoading());
    sync();
    window.addEventListener(SITE_SWITCH_LOADING_EVENT_NAME, sync);
    return () => window.removeEventListener(SITE_SWITCH_LOADING_EVENT_NAME, sync);
  }, []);

  return active ? <Suspense fallback={null}><LazySiteSwitchLoadingOverlay /></Suspense> : null;
}

export function DeferredUnifiedActionDialog(props: UnifiedActionDialogProps) {
  if (!props.open) return null;
  return <Suspense fallback={null}><LazyUnifiedActionDialog {...props} /></Suspense>;
}
