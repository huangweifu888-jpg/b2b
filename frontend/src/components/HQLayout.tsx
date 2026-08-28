import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Bell, Crown, HelpCircle, Lock, Menu, Save, Search, Unlock } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import HQSidebar from "./HQSidebar";
import LazyAIServiceWidget from "./LazyAIServiceWidget";
import { DeferredGlobalLocalEnvAlert, DeferredUnifiedActionDialog } from "./DeferredShellUtilities";
import DeferredShellRuntimeHosts from "./DeferredShellRuntimeHosts";
import ResponsivePageHost from "./ResponsivePageHost";
import LocalDevLoginButton from "./LocalDevLoginButton";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useProductMarketStore } from "@/lib/product-market-store";
import { PRODUCT_MARKET_SHARED_STYLE_EVENT } from "@/lib/product-market-shared-style";
import { PRODUCT_MARKET_CONFIG_EVENT, currentProductMarketConfigKey, readHeadquartersProductMarketConfig, relevantProductMarketStorageKeys, writeStoredProductMarketConfig } from "@/lib/product-market-config";
import { buildTopbarSurfaceStyle, withAlpha } from "@/lib/topbar-surface";
import { PageFooterLockControls } from "@/components/PageFooterLockControls";
import { ContentPluginToggle } from "./content-plugins/ContentPluginControls";
import { buildSharedPlatformLayoutLockParents, isCompletedSourceLocked, isRouteCompletedLayoutLocked, isRouteCompletedPageHardLocked, PAGE_LAYOUT_LOCK_EVENT, registerCompletedLayoutLockParents, resolveCompletedLayoutLock, setCompletedLayoutLocked, setCompletedPageHardLocked, setCompletedSourceLocked } from "@/lib/page-layout-lock";
import { syncSourcePageLock } from "@/lib/source-page-lock";
import { useResponsiveNavigationLabel } from "@/hooks/use-responsive-navigation-label";
import { dispatchSharedProjectSyncRequest } from "@/lib/shared-project-sync-contract";

// Headquarters owns its own source palette. Client-source shared settings are
// deliberately not merged here, otherwise a client template update can
// overwrite the headquarters frame before it is published.
const readScopedConfig = () => readHeadquartersProductMarketConfig();

const configSignature = (config: unknown) => {
  try {
    return JSON.stringify(config || null);
  } catch {
    return "";
  }
};

const t = {
  mobileNavTitle: "\u603b\u90e8\u7aef\u5bfc\u822a",
  openNav: "\u6253\u5f00\u5bfc\u822a",
  searchPlaceholder: "\u641c\u7d22\u603b\u90e8\u9875\u9762\u3001\u4e1a\u52a1\u3001\u914d\u7f6e...",
  consoleTitle: "\u603b\u90e8\u63a7\u5236\u53f0",
  consoleDesc: "\u5e73\u53f0\u63a7\u5236\u4e0e\u53d1\u5e03\u5165\u53e3",
  help: "\u5e2e\u52a9\u4e2d\u5fc3",
  notice: "\u901a\u77e5",
  subtitle: "\u603b\u90e8\u7ba1\u7406\u540e\u53f0",
};

export default function HQLayout() {
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
  const appliedConfigSignatureRef = useRef("");
  const isCentralStyleSettingsPage = location.pathname === "/zb/kh-style-settings" || location.pathname === "/zb/dl-style-settings";
  const isProductMarketPage = location.pathname === "/zb/product-market";
  const isProductMarketModulesPage = isProductMarketPage && new URLSearchParams(location.search).get("tab") === "modules";
  const currentLayoutLock = resolveCompletedLayoutLock(location.pathname, location.search);
  const persistModuleIconVisibility = (visibility: Partial<typeof moduleIconVisibility>) => {
    setModuleIconVisibility(visibility);
    writeStoredProductMarketConfig(currentProductMarketConfigKey("hq"), useProductMarketStore.getState().exportConfig());
  };

  useLayoutEffect(() => {
    try {
      const { resetToFactory, importConfig } = useProductMarketStore.getState();
      const config = readScopedConfig();
      appliedConfigSignatureRef.current = configSignature(config);
      resetToFactory();
      if (config) importConfig(config);
    } catch (error) {
      console.warn("HQ layout config bootstrap failed, using defaults:", error);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (isCentralStyleSettingsPage) return;

    const refreshConfig = (event?: Event) => {
      if (event instanceof StorageEvent) {
        if (!event.key || !relevantProductMarketStorageKeys().includes(event.key)) return;
      }
      try {
        const config = readScopedConfig();
        const nextSignature = configSignature(config);
        if (config && nextSignature !== appliedConfigSignatureRef.current) {
          appliedConfigSignatureRef.current = nextSignature;
          useProductMarketStore.getState().importConfig(config);
        }
      } catch (error) {
        console.warn("HQ layout live config refresh failed:", error);
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
  }, [isCentralStyleSettingsPage]);

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
    const syncStorageKey = `tradepro.hq-source-sync.${location.pathname}${location.search}`;
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
    return <div className="app-shell bg-slate-100" />;
  }

  const headerBgColor = layoutStyle.clientTopbarOverrideBgColor || sidebarStyle.bgFrom || layoutStyle.clientTopbarBgColor || "#022c22";
  const headerTextColor = layoutStyle.clientTopbarOverrideTextColor || sidebarStyle.textColor || layoutStyle.clientTopbarTextColor || "#ecfdf5";
  const workspaceBgColor = layoutStyle.clientSecondaryPageBgColor || layoutStyle.contentBgColor || "#f8fafc";
  const workspaceTextColor = layoutStyle.clientSecondaryPageTextColor || layoutStyle.contentTextColor || "#0f172a";
  const topbarBorderColor = withAlpha(headerTextColor, 0.14);
  const topbarSurfaceBg = withAlpha(headerTextColor, 0.06);
  const topbarMutedTextColor = withAlpha(headerTextColor, 0.72);
  const topbarSubtleTextColor = withAlpha(headerTextColor, 0.5);
  const topbarSurfaceStyle = buildTopbarSurfaceStyle(headerTextColor);

  return (
    <div
      className="app-shell performance-safe flex overflow-hidden lg:h-screen"
      data-platform-frame-scope="hq"
      data-responsive-shell="hq"
      style={{ backgroundColor: "var(--tradepro-shared-workspace-bg, " + workspaceBgColor + ")", color: "var(--tradepro-shared-workspace-text, " + workspaceTextColor + ")" }}
    >
      <div data-responsive-desktop-nav className="hidden lg:block">
        <HQSidebar />
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <SheetContent side="left" data-responsive-drawer="hq" className="app-mobile-sheet">
          <SheetHeader className="app-mobile-sheet-header border-slate-200">
            <SheetTitle className="text-base">{t.mobileNavTitle}</SheetTitle>
          </SheetHeader>
          <SheetBody className="app-mobile-sheet-body bg-emerald-950">
            <HQSidebar />
          </SheetBody>
        </SheetContent>
      </Sheet>

      <div className="app-page flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className="app-topbar"
          data-responsive-topbar
          data-responsive-shared-surface="top"
          data-responsive-shared-surface-plugin="large-band-density"
          data-responsive-shared-action-scope="true"
          data-responsive-reference-tools={location.pathname.includes("product-market") ? "true" : "false"}
          style={{
            backgroundColor: headerBgColor,
            color: headerTextColor,
            borderColor: topbarBorderColor,
          }}
        >
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
                style={topbarSurfaceStyle}
                aria-label={t.openNav}
                onClick={() => setMobileNavOpen(true)}
                type="button"
              >
                <Menu className="h-4 w-4" />
              </button>
              <Search
                className="pointer-events-none absolute left-11 top-1/2 h-4 w-4 -translate-y-1/2 lg:left-3"
                style={{ color: topbarSubtleTextColor }}
              />
              <Input
                placeholder={t.searchPlaceholder}
                className="h-9 pl-17 placeholder:opacity-60 lg:pl-9"
                style={{
                  borderColor: topbarBorderColor,
                  backgroundColor: topbarSurfaceBg,
                  color: headerTextColor,
                }}
              />
            </div>

            <div data-source-topbar-actions data-responsive-sequence="business-order" className="flex w-full min-w-0 flex-nowrap items-center justify-end gap-2 overflow-hidden lg:ml-auto lg:w-auto lg:flex-none">
              <button
                type="button"
                data-responsive-priority="p1"
                data-responsive-compact="icon-label"
                className="app-toolbar-chip h-9 w-[148px] shrink-0 gap-1.5 whitespace-nowrap px-2 py-1.5"
                style={topbarSurfaceStyle}
                title={t.consoleTitle}
              >
                <div className="flex h-5 w-5 items-center justify-center rounded text-white" style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
                  <Crown className="h-3 w-3" />
                </div>
                <div data-responsive-copy="group" className="min-w-0 flex-1 whitespace-nowrap text-left">
                  <div className="text-[10px] font-semibold leading-tight" style={{ color: headerTextColor }}>{t.consoleTitle}</div>
                  <div data-responsive-copy="secondary" className="text-[9px] leading-tight" style={{ color: topbarMutedTextColor }}>{t.consoleDesc}</div>
                </div>
              </button>
              <button data-responsive-priority="p2" data-responsive-compact="icon-only" className="app-toolbar-icon-btn shrink-0" style={topbarSurfaceStyle} type="button" aria-label={t.help}>
                <HelpCircle className="h-4 w-4" />
              </button>
              <button data-responsive-priority="p1" data-responsive-compact="icon-only" className="app-toolbar-icon-btn relative shrink-0" style={topbarSurfaceStyle} type="button" aria-label={t.notice}>
                <Bell className="h-4 w-4" />
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
              </button>
              <div data-responsive-priority="p3" className="contents"><LocalDevLoginButton scope="hq" style={topbarSurfaceStyle} /></div>
              <div data-responsive-priority="p3" className="app-toolbar-chip h-9 w-[134px] shrink-0 gap-2 whitespace-nowrap px-2 py-1" style={topbarSurfaceStyle}>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-xs font-semibold text-white">
                  HQ
                </div>
                <div data-responsive-copy="group" className="hidden min-w-0 flex-1 whitespace-nowrap text-left sm:block">
                  <div className="truncate text-xs font-medium">Trade HQ</div>
                  <div data-responsive-copy="secondary" className="truncate text-[10px]" style={{ color: topbarMutedTextColor }}>
                    {t.subtitle}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <DeferredGlobalLocalEnvAlert variant="hq" />
        <DeferredShellRuntimeHosts pathname={location.pathname} search={location.search} sourceScope="hq" />

        <main className="app-main-roomy" style={{ backgroundColor: "var(--tradepro-shared-workspace-bg, " + workspaceBgColor + ")", color: "var(--tradepro-shared-workspace-text, " + workspaceTextColor + ")" }}>
          <ResponsivePageHost scope="hq"><Outlet /></ResponsivePageHost>
        </main>
        <footer data-platform-global-footer data-source-page-footer data-page-layout-footer data-development-standard-frame-region="footer" data-development-standard-frame-label="尾栏" className="platform-global-footer">
          <span>总部端 · 共享变量全局框架</span>
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
          title="保存并同步总部端设置"
          description="将当前总部端页面的配置写入总部端模板源，并立即应用到总部端全局框架。"
          confirmLabel="确认保存并同步"
          busyLabel="正在保存并同步"
          onConfirm={syncCurrentSourcePage}
        />
        <LazyAIServiceWidget />
      </div>
    </div>
  );
}
