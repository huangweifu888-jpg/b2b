import { lazy, Suspense, useEffect, useState } from "react";
import { BookOpenCheck, ChevronDown, Wrench } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Dialog, DialogDescription, DialogTitle, DraggableDialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DEVELOPMENT_STANDARD_CATALOG, getDevelopmentStandardRoute } from "@/lib/development-standard-catalog";
import { FACTORY_PLATFORM_SOCIAL_WORKSPACES } from "@/lib/factory-platform-blueprint";
import { loadLazyModule } from "@/lib/lazy-module-recovery";
import { preloadWorkspaceRouteForPath } from "@/lib/route-preload";
import {
  SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE,
  SHARED_SMALL_CARD_EFFECTIVE_SCOPE_ATTRIBUTE,
  SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE,
  SHARED_SMALL_CARD_MARKER_CONTRACT_VERSION,
  SHARED_SMALL_CARD_MARKER_POLICY,
  SHARED_SMALL_CARD_MARKER_RESOLUTION,
  SHARED_WINDOW_CONTRACT_VERSION,
} from "@/lib/shared-window-contract";
import { cn } from "@/lib/utils";
import {
  consumeDevelopmentConsoleOpenHandoff,
  DEVELOPMENT_CONSOLE_REOPEN_EVENT,
  VISUAL_PAGE_EDITOR_OPEN_EVENT,
  type DevelopmentConsoleReopenDetail,
  type VisualPageEditorOpenDetail,
} from "@/lib/visual-page-editor-events";

type DevelopmentStandardApplyConsoleModule = typeof import(
  "@/components/product-market/DevelopmentStandardApplyConsole"
);

let developmentStandardApplyConsolePromise: Promise<DevelopmentStandardApplyConsoleModule> | undefined;

function loadDevelopmentStandardApplyConsole() {
  if (developmentStandardApplyConsolePromise) return developmentStandardApplyConsolePromise;
  const pending = loadLazyModule(
    () => import("@/components/product-market/DevelopmentStandardApplyConsole"),
    "development-standard-apply-console",
  ).catch((error) => {
    developmentStandardApplyConsolePromise = undefined;
    throw error;
  });
  developmentStandardApplyConsolePromise = pending;
  return pending;
}

function preloadDevelopmentStandardApplyConsole() {
  void loadDevelopmentStandardApplyConsole().catch(() => undefined);
}

const DevelopmentStandardApplyConsole = lazy(async () => ({
  default: (await loadDevelopmentStandardApplyConsole()).DevelopmentStandardApplyConsole,
}));

type DeveloperWorkspaceScope = "hq" | "agency_source" | "client_source" | "agency" | "client";

function resolveDeveloperWorkspaceScope(pathname: string): DeveloperWorkspaceScope {
  if (pathname.startsWith("/zb/agency-source")) return "agency_source";
  if (pathname.startsWith("/zb/client-source")) return "client_source";
  if (pathname.startsWith("/zb")) return "hq";
  if (pathname.startsWith("/dl")) return "agency";
  return "client";
}

const developmentGuideRoutes: Partial<Record<DeveloperWorkspaceScope, string>> = {
  hq: "/zb/product-market?tab=development",
  agency_source: "/zb/agency-source/product-market?tab=development",
  client_source: "/zb/client-source/product-market?tab=development",
};

const developmentGuideCopy: Record<DeveloperWorkspaceScope, { title: string; description: string }> = {
  hq: { title: "总部端开发器", description: "在规范中选择经营模块，再进入开发器维护总部端模板。" },
  agency_source: { title: "代理源开发器", description: "在规范中选择经营模块，再进入开发器维护代理源模板。" },
  client_source: { title: "客户源开发器", description: "在规范中选择经营模块，再进入开发器维护客户源模板。" },
  agency: { title: "代理端已发布规范", description: "代理端只读取代理源已发布的组合方案。" },
  client: { title: "客户端已发布规范", description: "客户端只读取客户源已发布的组合方案。" },
};

/**
 * The legacy Page Cleaner and Layout Developer launchers were intentionally
 * retired.  Source workspaces now enter one documented composition workflow;
 * runtime workspaces remain read-only and never expose source editing tools.
 */
export default function ExternalDevtoolsMenu({
  compact = false,
  variant = "dark",
  placement = "sidebar",
}: {
  compact?: boolean;
  variant?: "light" | "dark";
  placement?: "sidebar" | "footer";
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const workspaceScope = resolveDeveloperWorkspaceScope(location.pathname);
  const guideRoute = developmentGuideRoutes[workspaceScope];
  const copy = developmentGuideCopy[workspaceScope];
  const dark = variant === "dark";
  const [consoleOpen, setConsoleOpen] = useState(false);
  const sourceRoot = guideRoute?.replace("/product-market?tab=development", "");
  const platformBlueprintRoute = guideRoute?.replace("tab=development", "tab=blueprint");
  const clientDevelopmentRoot = workspaceScope === "client_source" ? sourceRoot : workspaceScope === "hq" ? "/zb/client-source" : undefined;
  const painPointRoute = clientDevelopmentRoot ? `${clientDevelopmentRoot}/social?tab=customer-roadmap` : undefined;
  const marketingPlaybookPath = FACTORY_PLATFORM_SOCIAL_WORKSPACES.find((workspace) => workspace.tab === "marketing-playbook")?.route;

  useEffect(() => {
    const handoff = consumeDevelopmentConsoleOpenHandoff(window.sessionStorage, {
      pathname: location.pathname,
      search: location.search,
      workspaceScope,
      applicationScope: "global",
    });
    if (handoff) setConsoleOpen(true);
  }, [location.pathname, location.search, workspaceScope]);
  const marketingPlaybookRoute = clientDevelopmentRoot && marketingPlaybookPath ? `${clientDevelopmentRoot}${marketingPlaybookPath}` : undefined;
  const crmDevelopmentRoute = clientDevelopmentRoot ? `${clientDevelopmentRoot}/customers?tab=development` : undefined;
  const developerLabel = copy.title;
  const sourceLabel = copy.title.replace("开发器", "");

  useEffect(() => {
    const handleVisualEditorOpen = (event: Event) => {
      const detail = (event as CustomEvent<VisualPageEditorOpenDetail>).detail;
      if (detail?.pathname && detail.pathname !== location.pathname) return;
      if (detail?.search && detail.search !== location.search) return;
      if (detail?.workflowOrigin === "global-frame-workbench") return;
      setConsoleOpen(false);
    };
    window.addEventListener(VISUAL_PAGE_EDITOR_OPEN_EVENT, handleVisualEditorOpen);
    return () => window.removeEventListener(VISUAL_PAGE_EDITOR_OPEN_EVENT, handleVisualEditorOpen);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleConsoleReopen = (event: Event) => {
      const detail = (event as CustomEvent<DevelopmentConsoleReopenDetail>).detail;
      if (!detail
        || detail.reason !== "canary-confirmed"
        || detail.applicationScope !== "canary-profile"
        || detail.pathname !== location.pathname
        || detail.search !== location.search
        || detail.workspaceScope !== workspaceScope) return;
      setConsoleOpen(true);
    };
    window.addEventListener(DEVELOPMENT_CONSOLE_REOPEN_EVENT, handleConsoleReopen);
    return () => window.removeEventListener(DEVELOPMENT_CONSOLE_REOPEN_EVENT, handleConsoleReopen);
  }, [location.pathname, location.search, workspaceScope]);

  return (
    <div
      data-developer-tool="development-specification"
      data-developer-workspace-scope={workspaceScope}
      data-footer-developer-tools={placement === "footer" ? "true" : undefined}
      className={cn(
        placement === "footer"
          ? "flex h-9 min-w-0 shrink-0 items-center gap-1 text-left text-xs"
          : "flex min-h-11 items-center gap-2 rounded-md border px-2.5 text-left text-[11px]",
        placement !== "footer" && (dark ? "border-white/10 bg-white/5 text-slate-200" : "border-slate-200 bg-white text-slate-700"),
      )}
    >
      {guideRoute ? <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-development-standard-quick-switch
              data-responsive-footer-developer-tool={placement === "footer" ? "standard" : undefined}
              title="规范：快速切换开发规范模块"
              aria-label="规范：快速切换经营模块"
              className={cn(
                placement === "footer"
                  ? "inline-flex h-9 shrink-0 items-center gap-1 rounded-md border px-2.5 text-xs font-semibold shadow-sm transition-colors"
                  : "inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[10px] font-medium transition-colors",
                dark ? "border-white/15 hover:bg-white/10" : "border-slate-200 hover:bg-slate-50",
              )}
            >
              <BookOpenCheck className="h-3.5 w-3.5" aria-hidden="true" />
              规范 <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel className="text-xs">开发规范模块</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {platformBlueprintRoute ? <>
              <DropdownMenuItem
                data-development-standard-quick-item="platform-blueprint"
                className="items-start gap-2 py-2"
                onPointerEnter={() => preloadWorkspaceRouteForPath(platformBlueprintRoute)}
                onPointerDown={() => preloadWorkspaceRouteForPath(platformBlueprintRoute)}
                onFocus={() => preloadWorkspaceRouteForPath(platformBlueprintRoute)}
                onSelect={() => {
                  preloadWorkspaceRouteForPath(platformBlueprintRoute);
                  navigate(platformBlueprintRoute);
                }}
              >
                <span className="min-w-7 pt-0.5 text-[10px] font-semibold opacity-70">蓝图</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium">平台蓝图</span>
                  <span className="block text-[10px] leading-4 opacity-65">查看经营能力、开发阶段、三端职责与客户价值</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </> : null}
            {crmDevelopmentRoute ? <>
              <DropdownMenuItem
                data-development-standard-quick-item="crm"
                className="items-start gap-2 py-2"
                onSelect={() => navigate(crmDevelopmentRoute)}
              >
                <span className="min-w-7 pt-0.5 text-[10px] font-semibold opacity-70">CRM</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium">CRM 管理 &gt; 开发规范</span>
                  <span className="block text-[10px] leading-4 opacity-65">进入工厂客户经营与多租户规范</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </> : null}
            {painPointRoute && marketingPlaybookRoute ? <>
              <DropdownMenuItem data-development-standard-quick-item="social-roadmap" className="items-start gap-2 py-2" onSelect={() => navigate(painPointRoute)}>
                <span className="min-w-7 pt-0.5 text-[10px] font-semibold opacity-70">06A</span>
                <span className="min-w-0 flex-1"><span className="block text-xs font-medium">社交媒体 &gt; 痛点路线</span><span className="block text-[10px] leading-4 opacity-65">内部开发、验证与上线准备</span></span>
              </DropdownMenuItem>
              <DropdownMenuItem data-development-standard-quick-item="social-marketing" className="items-start gap-2 py-2" onSelect={() => navigate(marketingPlaybookRoute)}>
                <span className="min-w-7 pt-0.5 text-[10px] font-semibold opacity-70">06B</span>
                <span className="min-w-0 flex-1"><span className="block text-xs font-medium">社交媒体 &gt; 营销作战</span><span className="block text-[10px] leading-4 opacity-65">客户营销逻辑与实际操作入口</span></span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </> : null}
            {DEVELOPMENT_STANDARD_CATALOG.map((item) => {
              const developmentStandardRoute = getDevelopmentStandardRoute(guideRoute, item.id);
              return (
              <DropdownMenuItem
                key={item.id}
                data-development-standard-quick-item={item.id}
                className="items-start gap-2 py-2"
                onPointerEnter={() => preloadWorkspaceRouteForPath(developmentStandardRoute)}
                onPointerDown={() => preloadWorkspaceRouteForPath(developmentStandardRoute)}
                onFocus={() => preloadWorkspaceRouteForPath(developmentStandardRoute)}
                onSelect={() => {
                  preloadWorkspaceRouteForPath(developmentStandardRoute);
                  navigate(developmentStandardRoute);
                }}
              >
                <span className="min-w-7 pt-0.5 text-[10px] font-semibold opacity-70">{item.order}</span>
                <span className="min-w-0 flex-1"><span className="block text-xs font-medium">{item.label} &gt; 规范</span><span className="block text-[10px] leading-4 opacity-65">{item.state === "planned" ? "待沉淀流程" : "进入统一开发规范"}</span></span>
              </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          data-development-application-launcher
          data-responsive-footer-developer-tool={placement === "footer" ? "application" : undefined}
          onPointerEnter={preloadDevelopmentStandardApplyConsole}
          onPointerDown={preloadDevelopmentStandardApplyConsole}
          onFocus={preloadDevelopmentStandardApplyConsole}
          onClick={() => {
            preloadDevelopmentStandardApplyConsole();
            setConsoleOpen(true);
          }}
          title={`${developerLabel}：草案、差异、恢复点和对应工具应用`}
          className={cn(
            placement === "footer"
              ? "inline-flex h-9 shrink-0 items-center gap-1 rounded-md border px-2.5 text-xs font-semibold shadow-sm transition-colors"
              : "inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[10px] font-medium transition-colors",
            dark ? "border-white/15 hover:bg-white/10" : "border-slate-200 hover:bg-slate-50",
          )}
        >
          <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
          {developerLabel}
        </button>
      </> : (
        <span title={copy.description} className="shrink-0 text-[10px] opacity-60">只读</span>
      )}
      <Dialog open={consoleOpen} onOpenChange={setConsoleOpen}>
        <DraggableDialogContent
          data-development-standard-apply-dialog
          data-shared-dialog-contract="development-workbench"
          data-shared-window-contract={SHARED_WINDOW_CONTRACT_VERSION}
          data-shared-window-kind="workbench"
          data-shared-window-small-card-marker-policy={SHARED_SMALL_CARD_MARKER_POLICY}
          data-shared-window-small-card-marker-contract={SHARED_SMALL_CARD_MARKER_CONTRACT_VERSION}
          data-shared-window-small-card-marker-scope-attribute={SHARED_SMALL_CARD_EFFECTIVE_SCOPE_ATTRIBUTE}
          data-shared-window-small-card-marker-resolution={SHARED_SMALL_CARD_MARKER_RESOLUTION}
          data-shared-window-small-card-marker-runtime-attribute={SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE}
          data-shared-window-small-card-surface-runtime-attribute={SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE}
          showCloseButton
          resizable
          minWidth={320}
          minHeight={420}
          className="h-[85dvh] max-h-[94dvh] w-[90vw] max-w-[96vw] gap-0 overflow-hidden rounded-none p-0"
        >
          <Suspense fallback={<>
            <DialogTitle className="sr-only">{developerLabel}应用流程</DialogTitle>
            <DialogDescription className="sr-only">正在按需加载当前页面或共享全局的开发流程。</DialogDescription>
            <div data-development-standard-loading-state className="flex h-full items-center justify-center text-xs text-slate-500">正在加载开发流程…</div>
          </>}>
            <DevelopmentStandardApplyConsole pathname={location.pathname} search={location.search} readOnly={!guideRoute} sourceLabel={sourceLabel} />
          </Suspense>
        </DraggableDialogContent>
      </Dialog>
    </div>
  );
}
