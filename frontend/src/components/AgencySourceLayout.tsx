import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Bell, CreditCard, HelpCircle, Lock, LogOut, Menu, Package, Save, Search, Share2, Unlock, User } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import AgencySourceSidebar from "./AgencySourceSidebar";
import LazyAIServiceWidget from "./LazyAIServiceWidget";
import DeferredShellRuntimeHosts from "./DeferredShellRuntimeHosts";
import ResponsivePageHost from "./ResponsivePageHost";
import {
  DeferredGlobalLocalEnvAlert,
  DeferredSiteSwitchLoadingOverlay,
  DeferredUnifiedActionDialog,
} from "./DeferredShellUtilities";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useProductMarketStore } from "@/lib/product-market-store";
import { PRODUCT_MARKET_SHARED_STYLE_EVENT } from "@/lib/product-market-shared-style";
import {
  PRODUCT_MARKET_CONFIG_EVENT,
  currentProductMarketConfigKey,
  readAgencyTemplateProductMarketConfig,
  relevantProductMarketStorageKeys,
  writeStoredProductMarketConfig,
} from "@/lib/product-market-config";
import { buildTopbarSurfaceStyle, withAlpha } from "@/lib/topbar-surface";
import { platformApi, type PlatformNode } from "@/lib/platform-api";
import type { AgencySourceBrand } from "./AgencySourceSidebar";
import { PageFooterLockControls } from "@/components/PageFooterLockControls";
import { ContentPluginToggle } from "./content-plugins/ContentPluginControls";
import { buildSharedPlatformLayoutLockParents, isCompletedSourceLocked, isRouteCompletedLayoutLocked, isRouteCompletedPageHardLocked, PAGE_LAYOUT_LOCK_EVENT, registerCompletedLayoutLockParents, resolveCompletedLayoutLock, setCompletedLayoutLocked, setCompletedPageHardLocked, setCompletedSourceLocked } from "@/lib/page-layout-lock";
import { syncSourcePageLock } from "@/lib/source-page-lock";
import { useResponsiveNavigationLabel } from "@/hooks/use-responsive-navigation-label";
import { DEFAULT_AGENCY_SOURCE_AGENCY_CODE } from "@/lib/agency-source-route-context";
import { dispatchSharedProjectSyncRequest } from "@/lib/shared-project-sync-contract";

// Agency source is an independent editable source. It can learn the same
// framework behaviour as client source, but must never inherit client source
// colours or navigation values implicitly.
const readScopedConfig = () => readAgencyTemplateProductMarketConfig();

const t = {
  mobileNavTitle: "\u4ee3\u7406\u6e90\u5bfc\u822a",
  openNav: "\u6253\u5f00\u5bfc\u822a",
  searchPlaceholder: "\u641c\u7d22\u4ee3\u7406\u6e90\u9875\u9762\u3001\u4e1a\u52a1\u3001\u914d\u7f6e...",
  templateCenter: "\u4ee3\u7406\u6e90\u6a21\u677f\u4e2d\u5fc3",
  templateName: "\u4ee3\u7406\u6e90\u6a21\u677f",
  templateDesc: "\u603b\u90e8\u552f\u4e00\u6e90\u4f53",
  help: "\u5e2e\u52a9\u4e2d\u5fc3",
  notice: "\u901a\u77e5",
  accountDesc: "\u603b\u90e8\u4ee3\u7406\u7aef\u6a21\u677f\u6e90",
  accountTitle: "\u4ee3\u7406\u6e90\u8d26\u6237",
  credits: "\u79ef\u5206\u6d88\u8d39",
  social: "\u793e\u5a92\u8d26\u53f7",
  plans: "\u6a21\u677f\u8ba1\u5212",
  profile: "\u4e2a\u4eba\u8d44\u6599",
  logout: "\u9000\u51fa\u767b\u5f55",
};

function getAgencySourceAccountPath(tab: string) {
  return `/zb/agency-source/account?tab=${tab}`;
}

function flattenOrganizations(nodes: PlatformNode[]): PlatformNode[] {
  return nodes.flatMap((node) => [node, ...flattenOrganizations(node.children || [])]);
}

function getOrganizationSetting(node: PlatformNode, key: string) {
  const value = node.settings?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function getOrganizationTimestamp(node: PlatformNode) {
  const timestamp = new Date(node.updated_at || node.created_at || 0).valueOf();
  return Number.isFinite(timestamp) ? timestamp : node.id;
}

export default function AgencySourceLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationLabel = useResponsiveNavigationLabel({ routeKey: `${location.pathname}${location.search}` });
  const { layoutStyle, sidebarStyle, moduleIconVisibility, setModuleIconVisibility } = useProductMarketStore(useShallow((state) => ({
    layoutStyle: state.layoutStyle,
    sidebarStyle: state.sidebarStyle,
    moduleIconVisibility: state.moduleIconVisibility,
    setModuleIconVisibility: state.setModuleIconVisibility,
  })));
  const [ready, setReady] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [pageLayoutLocked, setPageLayoutLocked] = useState(() => isRouteCompletedLayoutLocked(location.pathname, location.search));
  const [pageSourceLocked, setPageSourceLocked] = useState(() => isRouteCompletedPageHardLocked(location.pathname, location.search));
  const [pageCodeLocked, setPageCodeLocked] = useState(() => {
    const lock = resolveCompletedLayoutLock(location.pathname, location.search);
    return Boolean(lock && isCompletedSourceLocked(lock));
  });
  const [agencyBrand, setAgencyBrand] = useState<AgencySourceBrand | null>(null);
  const appliedConfigSignatureRef = useRef("");
  const isProductMarketPage = location.pathname === "/zb/agency-source/product-market";
  const isProductMarketModulesPage = isProductMarketPage && new URLSearchParams(location.search).get("tab") === "modules";
  const currentLayoutLock = resolveCompletedLayoutLock(location.pathname, location.search);
  const persistModuleIconVisibility = (visibility: Partial<typeof moduleIconVisibility>) => {
    setModuleIconVisibility(visibility);
    writeStoredProductMarketConfig(currentProductMarketConfigKey("agency_source"), useProductMarketStore.getState().exportConfig());
  };

  const requestedAgencyCode = (() => {
    try { return new URLSearchParams(location.search).get("agency")?.trim() || ""; } catch { return ""; }
  })();

  useEffect(() => {
    let active = true;
    void platformApi.tree()
      .then((response) => {
        if (!active) return;
        const agencies = flattenOrganizations(response.items || [])
          .filter((node) => node.org_type === "agency")
          .sort((left, right) => getOrganizationTimestamp(right) - getOrganizationTimestamp(left));
        const agency = requestedAgencyCode
          ? agencies.find((node) => node.code === requestedAgencyCode)
          : agencies.find((node) => node.code === DEFAULT_AGENCY_SOURCE_AGENCY_CODE) || agencies[0];
        if (!agency) { setAgencyBrand(null); return; }
        const companyName = agency.name || agency.code;
        setAgencyBrand({
          companyName,
          shortName: getOrganizationSetting(agency, "companyShortName") || companyName,
          logoUrl: getOrganizationSetting(agency, "companyLogoUrl") || undefined,
          iconName: getOrganizationSetting(agency, "companyLogoIcon") || undefined,
        });
      })
      .catch(() => { if (active) setAgencyBrand(null); });
    return () => { active = false; };
  }, [requestedAgencyCode]);

  useLayoutEffect(() => {
    try {
      const config = readScopedConfig();
      const { resetToFactory, importConfig } = useProductMarketStore.getState();
      appliedConfigSignatureRef.current = JSON.stringify(config || null);
      resetToFactory();
      if (config) importConfig(config);
    } catch (error) {
      console.warn("Agency source layout bootstrap failed, using defaults:", error);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    const refreshConfig = (event?: Event) => {
      if (event instanceof StorageEvent) {
        if (!event.key || !relevantProductMarketStorageKeys(null).includes(event.key)) return;
      }
      try {
        const config = readScopedConfig();
        const nextSignature = JSON.stringify(config || null);
        if (config && nextSignature !== appliedConfigSignatureRef.current) {
          appliedConfigSignatureRef.current = nextSignature;
          useProductMarketStore.getState().importConfig(config);
        }
      } catch (error) {
        console.warn("Agency source layout live config refresh failed:", error);
      }
    };

    window.addEventListener(PRODUCT_MARKET_SHARED_STYLE_EVENT, refreshConfig);
    window.addEventListener(PRODUCT_MARKET_CONFIG_EVENT, refreshConfig);
    window.addEventListener("storage", refreshConfig);
    return () => {
      window.removeEventListener(PRODUCT_MARKET_SHARED_STYLE_EVENT, refreshConfig);
      window.removeEventListener(PRODUCT_MARKET_CONFIG_EVENT, refreshConfig);
      window.removeEventListener("storage", refreshConfig);
    };
  }, []);

  useEffect(() => {
    registerCompletedLayoutLockParents(buildSharedPlatformLayoutLockParents());
  }, []);

  useEffect(() => {
    const refreshLayoutLock = () => {
      setPageLayoutLocked(isRouteCompletedLayoutLocked(location.pathname, location.search));
      setPageSourceLocked(isRouteCompletedPageHardLocked(location.pathname, location.search));
      setPageCodeLocked(Boolean(currentLayoutLock && isCompletedSourceLocked(currentLayoutLock)));
    };
    refreshLayoutLock();
    window.addEventListener(PAGE_LAYOUT_LOCK_EVENT, refreshLayoutLock);
    return () => window.removeEventListener(PAGE_LAYOUT_LOCK_EVENT, refreshLayoutLock);
  }, [location.pathname, location.search]);

  const syncCurrentSourcePage = async () => {
    const saved = await dispatchSharedProjectSyncRequest({
      pathname: location.pathname,
      search: location.search,
    });
    if (!saved) {
      throw new Error("保存未完成：页面配置尚未通过本地与服务端回读验证，请重试。");
    }
    const syncStorageKey = `tradepro.agency-source-sync.${location.pathname}${location.search}`;
    window.localStorage.setItem(syncStorageKey, new Date().toLocaleString("zh-CN"));
  };

  const toggleCurrentSourceLayoutLock = () => {
    if (!currentLayoutLock) return;
    setCompletedLayoutLocked(currentLayoutLock, !pageLayoutLocked, "footer");
  };

  const toggleCurrentSourceCodeLock = async () => {
    if (!currentLayoutLock) return;
    const nextLocked = !pageCodeLocked;
    try {
      await syncSourcePageLock(currentLayoutLock, nextLocked);
      setCompletedSourceLocked(currentLayoutLock, nextLocked, "footer");
    } catch {
      // The footer state stays unchanged when local source protection cannot register.
    }
  };

  const toggleCurrentSourcePageLock = () => {
    if (!currentLayoutLock) return;
    setCompletedPageHardLocked(currentLayoutLock, !pageSourceLocked, "footer");
  };

  if (!ready) {
    return <div className="app-shell bg-slate-50" />;
  }

  const headerBgColor = layoutStyle.clientTopbarOverrideBgColor || sidebarStyle.bgFrom || layoutStyle.clientTopbarBgColor || "#0f172a";
  const headerTextColor = layoutStyle.clientTopbarOverrideTextColor || sidebarStyle.textColor || layoutStyle.clientTopbarTextColor || "#e2e8f0";
  const workspaceBgColor = layoutStyle.clientSecondaryPageBgColor || layoutStyle.contentBgColor || "#f8fafc";
  const workspaceTextColor = layoutStyle.clientSecondaryPageTextColor || layoutStyle.contentTextColor || "#0f172a";
  const topbarBorderColor = withAlpha(headerTextColor, 0.18);
  const topbarSurfaceBg = withAlpha(headerTextColor, 0.06);
  const topbarMutedTextColor = withAlpha(headerTextColor, 0.72);
  const topbarSubtleTextColor = withAlpha(headerTextColor, 0.5);
  const topbarSurfaceStyle = buildTopbarSurfaceStyle(headerTextColor);

  return (
    <div
      className="app-shell flex overflow-hidden lg:h-screen"
      data-platform-frame-scope="agency-source"
      data-responsive-shell="agency-source"
      style={{ backgroundColor: "var(--tradepro-shared-workspace-bg, " + workspaceBgColor + ")", color: "var(--tradepro-shared-workspace-text, " + workspaceTextColor + ")" }}
    >
        <div data-responsive-desktop-nav className="hidden lg:block">
          <AgencySourceSidebar brand={agencyBrand} />
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" data-responsive-drawer="agency-source" className="app-mobile-sheet">
          <SheetHeader className="app-mobile-sheet-header border-slate-200">
            <SheetTitle className="text-base">{t.mobileNavTitle}</SheetTitle>
          </SheetHeader>
          <SheetBody className="app-mobile-sheet-body bg-slate-900">
            <AgencySourceSidebar brand={agencyBrand} />
          </SheetBody>
        </SheetContent>
      </Sheet>

      <div className="app-page flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header data-responsive-topbar data-responsive-shared-surface="top" data-responsive-shared-surface-plugin="large-band-density" data-responsive-shared-action-scope="true" className="app-topbar" style={{ backgroundColor: headerBgColor, color: headerTextColor, borderColor: topbarBorderColor }}>
          {!location.pathname.includes("product-market") ? <button
              className="app-toolbar-icon-btn shrink-0 lg:hidden"
              data-responsive-nav-trigger
              data-responsive-function-key-plugin="shared"
              data-responsive-priority="p0"
              style={topbarSurfaceStyle}
              aria-label={`打开${navigationLabel}导航`}
              title={navigationLabel}
              data-responsive-navigation-label="page-name"
              onClick={() => setMobileNavOpen(true)}
              type="button"
            ><Menu className="h-4 w-4" /><span data-responsive-tool-label>{navigationLabel}</span></button> : null}
          <div data-responsive-topbar-content data-responsive-shared-popover="top-tools" data-responsive-shared-popover-plugin="large-interaction-density" className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
            <div data-responsive-priority="p0" data-responsive-region="search" className="relative min-w-0 w-full lg:max-w-[420px] lg:flex-1">
              <button
                className="app-toolbar-icon-btn absolute left-0 top-1/2 -translate-y-1/2 lg:hidden"
                data-responsive-nav-trigger
                data-responsive-function-key-plugin="shared"
                data-responsive-priority="p0"
                style={{ borderColor: topbarBorderColor, color: headerTextColor, backgroundColor: topbarSurfaceBg }}
                aria-label={t.openNav}
                onClick={() => setMobileNavOpen(true)}
                type="button"
              >
                <Menu className="h-4 w-4" />
              </button>
              <Search className="pointer-events-none absolute left-11 top-1/2 h-4 w-4 -translate-y-1/2 lg:left-3" style={{ color: topbarSubtleTextColor }} />
              <Input
                placeholder={t.searchPlaceholder}
                className="h-9 pl-17 placeholder:opacity-60 lg:pl-9"
                style={{ borderColor: topbarBorderColor, backgroundColor: topbarSurfaceBg, color: headerTextColor }}
              />
            </div>

            <div data-source-topbar-actions data-responsive-sequence="business-order" className="flex w-full min-w-0 flex-nowrap items-center justify-end gap-2 overflow-hidden lg:ml-auto lg:w-auto lg:flex-none">
              <button
                onClick={() => navigate(getAgencySourceAccountPath("plan"))}
                data-responsive-priority="p1"
                data-responsive-compact="icon-label"
                className="app-toolbar-chip h-9 w-[148px] shrink-0 gap-1.5 whitespace-nowrap px-2 py-1.5 transition-colors"
                style={topbarSurfaceStyle}
                title={t.templateCenter}
              >
                <div className="flex h-5 w-5 items-center justify-center rounded text-white" style={{ background: "linear-gradient(135deg, #8b5cf6, #c026d3)" }}>
                  <Package className="h-3 w-3" />
                </div>
                <div data-responsive-copy="group" className="min-w-0 flex-1 whitespace-nowrap text-left">
                  <div className="text-[10px] font-semibold leading-tight" style={{ color: headerTextColor }} title={agencyBrand?.companyName || t.templateName}>{agencyBrand?.companyName || t.templateName}</div>
                  <div data-responsive-copy="secondary" className="text-[9px] leading-tight" style={{ color: topbarMutedTextColor }}>{t.templateDesc}</div>
                </div>
              </button>
              <button data-responsive-priority="p2" data-responsive-compact="icon-only" className="app-toolbar-icon-btn shrink-0" style={topbarSurfaceStyle} type="button" aria-label={t.help}>
                <HelpCircle className="h-4 w-4" />
              </button>
              <button data-responsive-priority="p1" data-responsive-compact="icon-only" className="app-toolbar-icon-btn relative shrink-0" style={topbarSurfaceStyle} type="button" aria-label={t.notice}>
                <Bell className="h-4 w-4" />
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger data-responsive-priority="p1" data-responsive-compact="icon-only" className="app-toolbar-chip h-9 w-[134px] shrink-0 gap-2 whitespace-nowrap px-2 py-1" style={topbarSurfaceStyle}>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-semibold text-white">
                    AS
                  </div>
                  <div data-responsive-copy="group" className="hidden min-w-0 flex-1 whitespace-nowrap text-left sm:block">
                    <div className="text-xs font-medium" style={{ color: headerTextColor }}>Agency Source</div>
                    <div data-responsive-copy="secondary" className="text-[10px]" style={{ color: topbarMutedTextColor }}>{t.accountDesc}</div>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>{t.accountTitle}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(getAgencySourceAccountPath("credits"))}>
                    <CreditCard className="mr-2 h-3.5 w-3.5 text-slate-500" />
                    {t.credits}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(getAgencySourceAccountPath("social"))}>
                    <Share2 className="mr-2 h-3.5 w-3.5 text-slate-500" />
                    {t.social}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(getAgencySourceAccountPath("plan"))}>
                    <Package className="mr-2 h-3.5 w-3.5 text-slate-500" />
                    {t.plans}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(getAgencySourceAccountPath("profile"))}>
                    <User className="mr-2 h-3.5 w-3.5 text-slate-500" />
                    {t.profile}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <HelpCircle className="mr-2 h-3.5 w-3.5 text-slate-500" />
                    {t.help}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600">
                    <LogOut className="mr-2 h-3.5 w-3.5" />
                    {t.logout}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <DeferredGlobalLocalEnvAlert variant="agency" />
        <DeferredShellRuntimeHosts pathname={location.pathname} search={location.search} sourceScope="agency_source" />

        <main className="app-main-roomy" style={{ backgroundColor: "var(--tradepro-shared-workspace-bg, " + workspaceBgColor + ")", color: "var(--tradepro-shared-workspace-text, " + workspaceTextColor + ")" }}>
          <ResponsivePageHost scope="agency-source"><Outlet /></ResponsivePageHost>
        </main>
        <footer data-platform-global-footer data-source-page-footer data-page-layout-footer data-development-standard-frame-region="footer" data-development-standard-frame-label="尾栏" className="platform-global-footer">
          <span>代理源 · 共享变量全局框架</span>
          <span className="platform-global-footer-status">顶部 · 主体 · 标题 · 表头 · 内容 · 尾栏</span>
          <div data-source-project-footer-copy>
            {currentLayoutLock ? <PageFooterLockControls
              sourceLocked={pageCodeLocked}
              pageLocked={pageSourceLocked}
              columnLocked={pageLayoutLocked}
              onToggleSource={() => { void toggleCurrentSourceCodeLock(); }}
              onTogglePage={toggleCurrentSourcePageLock}
              onToggleColumn={toggleCurrentSourceLayoutLock}
            /> : null}
            {isProductMarketModulesPage ? (
              <div className="source-product-module-icon-controls" data-product-module-icon-controls>
                <ContentPluginToggle label="分类图标" checked={moduleIconVisibility.category} onCheckedChange={(category) => persistModuleIconVisibility({ category })} />
                <ContentPluginToggle label="一级图标" checked={moduleIconVisibility.primary} onCheckedChange={(primary) => persistModuleIconVisibility({ primary })} />
                <ContentPluginToggle label="二级图标" checked={moduleIconVisibility.secondary} onCheckedChange={(secondary) => persistModuleIconVisibility({ secondary })} />
              </div>
            ) : null}
          </div>
          {isProductMarketPage ? <div data-footer-primary-actions>
            <div data-responsive-visual-launcher-slot />
            <button type="button" data-source-project-action data-responsive-priority="p0" aria-label="保存并同步" onClick={() => setSyncDialogOpen(true)}>
            <Save aria-hidden="true" />
            <span data-save-sync-label>保存</span>
            </button>
          </div> : null}
        </footer>
        <DeferredUnifiedActionDialog
          open={syncDialogOpen}
          onOpenChange={setSyncDialogOpen}
          title="保存并同步代理源设置"
          description="将当前代理源页面的配置写入代理源模板，并生成可由代理端同步的最新版本。"
          confirmLabel="确认保存并同步"
          busyLabel="正在保存并同步"
          onConfirm={syncCurrentSourcePage}
        />
        <DeferredSiteSwitchLoadingOverlay />
        <LazyAIServiceWidget />
      </div>
    </div>
  );
}
