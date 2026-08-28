import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  Bell,
  CreditCard,
  Gem,
  HelpCircle,
  LogOut,
  Menu,
  Package,
  Search,
  Share2,
  User,
} from "lucide-react";

import Sidebar from "./Sidebar";
import LazyAIServiceWidget from "./LazyAIServiceWidget";
import { DeferredGlobalLocalEnvAlert } from "./DeferredShellUtilities";
import LocalDevLoginButton from "./LocalDevLoginButton";
import SiteSwitchLoadingOverlay from "./SiteSwitchLoadingOverlay";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useProductMarketStore, type ExportableConfig } from "@/lib/product-market-store";
import { PRODUCT_MARKET_SHARED_STYLE_EVENT } from "@/lib/product-market-shared-style";
import {
  PRODUCT_MARKET_CONFIG_EVENT,
  readClientTemplateProductMarketConfig,
  readClientPlanProductMarketConfig,
  relevantProductMarketStorageKeys,
} from "@/lib/product-market-config";
import { buildTopbarSurfaceStyle, withAlpha } from "@/lib/topbar-surface";
import { appendSiteIdToPath } from "@/lib/site-admin";
import { getAllSites, getSiteById, getStoredSelectedProjectSite, resolveCurrentSiteId } from "@/lib/sites";
import { fetchInstance } from "@/lib/template-snapshot/api";
import {
  assertClientPlanRuntimeInstanceBinding,
  resolveClientPlanRuntimeInstanceIdentity,
} from "@/lib/template-snapshot/client-plan-runtime-identity";

function readClientScopedConfig(siteId?: string | null) {
  return readClientPlanProductMarketConfig(siteId);
}

function countTemplateModuleUpdates(siteId?: string | null) {
  if (!siteId) return 0;
  const source = readClientTemplateProductMarketConfig() as { products?: unknown[] } | null;
  const plan = readClientPlanProductMarketConfig(siteId) as { products?: unknown[] } | null;
  const sourceItems = Array.isArray(source?.products) ? source.products : [];
  const planById = new Map((Array.isArray(plan?.products) ? plan.products : []).map((item) => {
    const value = item as Record<string, unknown>;
    return [String(value.id || value.key || ""), JSON.stringify(value)];
  }));
  return sourceItems.filter((item) => {
    const value = item as Record<string, unknown>;
    const key = String(value.id || value.key || "");
    return key && planById.get(key) !== JSON.stringify(value);
  }).length;
}

function getClientBasePath(pathname: string) {
  return pathname.startsWith("/zb/client-source") ? "/zb/client-source" : "/kh";
}

function getClientAccountPath(pathname: string, tab: string, siteId?: string | null) {
  return appendSiteIdToPath(`${getClientBasePath(pathname)}/account?tab=${tab}`, siteId);
}

function shouldSuppressStoredSiteSelection(pathname: string, search: string) {
  try {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    // A customer-list entry selects a concrete client plan. Do not replace
    // that context with a browser-wide remembered site selection.
    if (params.get("client")?.trim() || params.get("plan")?.trim()) return true;
    if (!pathname.endsWith("/ai-chat")) return false;
    if (params.get("siteId")?.trim()) return false;

    return Boolean(
      params.get("planName")?.trim() ||
        params.get("templateId")?.trim() ||
        params.get("source")?.trim()
    );
  } catch {
    return false;
  }
}

function HeaderPlanBadge() {
  const { layoutStyle, sidebarStyle } = useProductMarketStore(useShallow((state) => ({
    layoutStyle: state.layoutStyle,
    sidebarStyle: state.sidebarStyle,
  })));
  const highlight = sidebarStyle.activeHighlight || "#0ea5e9";
  const topbarTextColor =
    layoutStyle.clientTopbarTextColor || layoutStyle.headerTextColor || sidebarStyle.textColor || "#0f172a";
  const navigate = useNavigate();
  const location = useLocation();
  const currentSiteId = useMemo(() => resolveCurrentSiteId("client", location.search), [location.search]);
  const chipStyle = buildTopbarSurfaceStyle(topbarTextColor);

  return (
    <button
      onClick={() => navigate(getClientAccountPath(location.pathname, "plan", currentSiteId))}
      className="app-toolbar-chip gap-1.5 py-1.5 transition-colors"
      style={chipStyle}
      title="当前套餐：专业版，剩余积分 12,580"
    >
      <div className="flex h-5 w-5 items-center justify-center rounded text-white" style={{ background: `linear-gradient(135deg, ${highlight}, #1e3a5f)` }}>
        <Gem className="h-3 w-3" />
      </div>
      <div className="text-left [&>div:first-child]:!text-current [&>div:last-child]:!text-current [&>div:last-child]:opacity-70">
        <div className="text-[10px] font-semibold leading-tight text-slate-700">专业版</div>
        <div className="text-[9px] leading-tight text-slate-400">12,580 积分</div>
      </div>
    </button>
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isClientSourceMode = location.pathname.startsWith("/zb/client-source");
  const { layoutStyle, sidebarStyle } = useProductMarketStore(useShallow((state) => ({
    layoutStyle: state.layoutStyle,
    sidebarStyle: state.sidebarStyle,
  })));
  const [ready, setReady] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [templateUpdateCount, setTemplateUpdateCount] = useState(0);
  const [runtimePlanConfig, setRuntimePlanConfig] = useState<ExportableConfig | null>(null);
  const appliedConfigSignatureRef = useRef("");
  const clientPlanCode = useMemo(() => {
    try {
      return new URLSearchParams(location.search).get("plan")?.trim() || "";
    } catch {
      return "";
    }
  }, [location.search]);
  const clientCode = useMemo(() => {
    try {
      return new URLSearchParams(location.search).get("client")?.trim() || "";
    } catch {
      return "";
    }
  }, [location.search]);
  const urlSiteId = useMemo(() => {
    try {
      return new URLSearchParams(location.search).get("siteId")?.trim() || null;
    } catch {
      return null;
    }
  }, [location.search]);
  const suppressStoredSiteSelection = useMemo(
    () => shouldSuppressStoredSiteSelection(location.pathname, location.search),
    [location.pathname, location.search]
  );
  const storedSelectedSiteId = useMemo(() => getStoredSelectedProjectSite("client"), []);
  const currentSiteId = useMemo(() => {
    if (isClientSourceMode) return null;
    if (suppressStoredSiteSelection) {
      return urlSiteId;
    }
    return resolveCurrentSiteId("client", location.search);
  }, [isClientSourceMode, location.search, suppressStoredSiteSelection, urlSiteId]);
  const runtimeSite = useMemo(() => {
    if (currentSiteId) return getSiteById(currentSiteId);
    const normalizedPlanCode = clientPlanCode.trim().toUpperCase();
    const normalizedClientCode = clientCode.trim().toUpperCase();
    if (!normalizedPlanCode) return null;
    const matches = getAllSites().filter((site) => (
      (site.scope || "client") === "client"
      && site.planCode?.trim().toUpperCase() === normalizedPlanCode
      && (!normalizedClientCode || site.clientCode?.trim().toUpperCase() === normalizedClientCode)
    ));
    return matches.length === 1 ? matches[0] : null;
  }, [clientCode, clientPlanCode, currentSiteId]);

  useEffect(() => {
    if (isClientSourceMode) return;
    if (suppressStoredSiteSelection) return;
    if (urlSiteId || !storedSelectedSiteId) return;
    navigate(appendSiteIdToPath(`${location.pathname}${location.search}`, storedSelectedSiteId), { replace: true });
  }, [isClientSourceMode, location.pathname, location.search, navigate, storedSelectedSiteId, suppressStoredSiteSelection, urlSiteId]);

  useEffect(() => {
    let active = true;
    const sitePlanCode = runtimeSite?.planCode?.trim() || "";
    if (isClientSourceMode || !runtimeSite || (!sitePlanCode && !clientPlanCode)) {
      setRuntimePlanConfig(null);
      return () => {
        active = false;
      };
    }

    if (sitePlanCode && clientPlanCode && sitePlanCode.toUpperCase() !== clientPlanCode.toUpperCase()) {
      console.warn("Client runtime plan query does not match the selected site; remote configuration was not loaded.");
      setRuntimePlanConfig(null);
      return () => {
        active = false;
      };
    }

    let identity;
    try {
      identity = resolveClientPlanRuntimeInstanceIdentity({
        planCode: sitePlanCode || clientPlanCode,
        clientId: runtimeSite.clientId,
        planId: runtimeSite.planId,
        allowLegacyPlanCode: true,
      });
    } catch (error) {
      console.warn("Client runtime identity is incomplete; remote configuration was not loaded.", error);
      setRuntimePlanConfig(null);
      return () => {
        active = false;
      };
    }

    void fetchInstance(identity.instanceId)
      .then((instance) => {
        if (!active) return;
        assertClientPlanRuntimeInstanceBinding(identity, instance);
        const record = instance as Record<string, unknown>;
        const config = record.snapshot_config_json ?? record.snapshotConfigJson ?? null;
        setRuntimePlanConfig(config && typeof config === "object" ? (config as ExportableConfig) : null);
      })
      .catch(() => {
        if (active) setRuntimePlanConfig(null);
      });

    return () => {
      active = false;
    };
  }, [clientPlanCode, isClientSourceMode, runtimeSite]);

  useLayoutEffect(() => {
    try {
      const config = isClientSourceMode
        ? readClientTemplateProductMarketConfig()
        : runtimePlanConfig || readClientScopedConfig(currentSiteId);
      const { resetToFactory, importConfig } = useProductMarketStore.getState();
      appliedConfigSignatureRef.current = JSON.stringify(config || null);
      resetToFactory();
      if (config) importConfig(config);
    } catch (error) {
      console.warn("Client layout config bootstrap failed, using defaults:", error);
    } finally {
      setReady(true);
    }
  }, [currentSiteId, isClientSourceMode, runtimePlanConfig]);

  useEffect(() => {
    const refreshTemplateUpdate = () => setTemplateUpdateCount(isClientSourceMode ? 0 : countTemplateModuleUpdates(currentSiteId));
    refreshTemplateUpdate();
    window.addEventListener(PRODUCT_MARKET_CONFIG_EVENT, refreshTemplateUpdate);
    window.addEventListener("storage", refreshTemplateUpdate);
    return () => {
      window.removeEventListener(PRODUCT_MARKET_CONFIG_EVENT, refreshTemplateUpdate);
      window.removeEventListener("storage", refreshTemplateUpdate);
    };
  }, [currentSiteId, isClientSourceMode]);

  useEffect(() => {
    const refreshConfig = (event?: Event) => {
      if (runtimePlanConfig) return;
      if (event instanceof StorageEvent) {
        if (!event.key || !relevantProductMarketStorageKeys(currentSiteId).includes(event.key)) return;
      }
      try {
        const config = isClientSourceMode ? readClientTemplateProductMarketConfig() : readClientScopedConfig(currentSiteId);
        const nextSignature = JSON.stringify(config || null);
        if (config && nextSignature !== appliedConfigSignatureRef.current) {
          appliedConfigSignatureRef.current = nextSignature;
          useProductMarketStore.getState().importConfig(config);
        }
      } catch (error) {
        console.warn("Client layout live config refresh failed:", error);
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
  }, [currentSiteId, isClientSourceMode, runtimePlanConfig]);

  if (!ready) {
    return <div className="app-shell bg-slate-50" />;
  }

  const topbarTextColor =
    layoutStyle.clientTopbarTextColor || layoutStyle.headerTextColor || sidebarStyle.textColor || "#0f172a";
  const topbarBorderColor = withAlpha(topbarTextColor, 0.16);
  const topbarSurfaceBg = withAlpha(topbarTextColor, 0.06);
  const topbarMutedTextColor = withAlpha(topbarTextColor, 0.72);
  const topbarSubtleTextColor = withAlpha(topbarTextColor, 0.5);
  const topbarSurfaceStyle = buildTopbarSurfaceStyle(topbarTextColor);

  return (
    <div
      key={currentSiteId || clientPlanCode || "global"}
      data-client-runtime-shell
      className="app-shell flex overflow-hidden bg-slate-50 lg:h-screen"
    >
      <div className="hidden lg:block">
        <Sidebar key={`${currentSiteId || "global"}-${layoutStyle.clientTopbarBgColor || "topbar"}-${sidebarStyle.bgFrom || "sidebar"}`} />
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="app-mobile-sheet">
          <SheetHeader className="app-mobile-sheet-header border-slate-200">
            <SheetTitle className="text-base">客户端导航</SheetTitle>
          </SheetHeader>
          <SheetBody className="app-mobile-sheet-body bg-slate-50">
            <Sidebar key={`${currentSiteId || "global"}-${layoutStyle.clientTopbarBgColor || "topbar"}-${sidebarStyle.bgFrom || "sidebar"}-mobile`} />
          </SheetBody>
        </SheetContent>
      </Sheet>

      <div data-client-runtime-workspace className="app-page flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className="app-topbar"
          style={{
            backgroundColor: layoutStyle.clientTopbarBgColor || "#ffffff",
            color: topbarTextColor,
            borderColor: topbarBorderColor,
          }}
        >
          <div className="flex min-w-0 w-full flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
            <button
              className="app-toolbar-icon-btn shrink-0 lg:hidden"
              style={{ borderColor: topbarBorderColor, color: topbarTextColor, backgroundColor: topbarSurfaceBg }}
              aria-label="打开导航"
              onClick={() => setMobileNavOpen(true)}
              type="button"
            >
              <Menu className="h-4 w-4" />
            </button>
              <div className="relative min-w-0 w-full lg:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: topbarSubtleTextColor }} />
                <Input
                  placeholder="搜索询盘、客户、产品..."
                  className="h-9 pl-9 placeholder:opacity-60"
                  style={{
                    borderColor: topbarBorderColor,
                    backgroundColor: topbarSurfaceBg,
                    color: topbarTextColor,
                  }}
                />
              </div>

              <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:ml-auto lg:w-auto lg:flex-nowrap lg:justify-end">
                {clientPlanCode ? (
                  <div
                    className="app-toolbar-chip max-w-full gap-1.5 py-1.5 text-xs font-medium"
                    style={topbarSurfaceStyle}
                    title={`当前客户 ${clientCode || "-"}，当前计划 ${clientPlanCode}，已使用客户源运行时快照`}
                  >
                    <span className="text-sky-600">客户 {clientCode || "-"}</span>
                    <span style={{ color: topbarMutedTextColor }}>·</span>
                    <span>计划 {clientPlanCode}</span>
                  </div>
                ) : null}
                <HeaderPlanBadge />
                {templateUpdateCount > 0 ? <button className="app-toolbar-chip gap-1.5 py-1.5" style={topbarSurfaceStyle} title="前往产品市场手动同步客户源模板" onClick={() => navigate(appendSiteIdToPath("/kh/product-market?tab=operations", currentSiteId))}><RefreshCw className="h-3.5 w-3.5" /><span className="text-xs font-medium">{templateUpdateCount} 项模板更新</span></button> : null}
                <button
                  className="app-toolbar-icon-btn"
                  style={topbarSurfaceStyle}
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
                <button
                  className="app-toolbar-icon-btn relative"
                  style={topbarSurfaceStyle}
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
                </button>

                <LocalDevLoginButton scope="client" style={topbarSurfaceStyle} />

                <DropdownMenu>
                  <DropdownMenuTrigger className="app-toolbar-chip gap-2 py-1" style={topbarSurfaceStyle}>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-sky-500 text-xs font-semibold text-white">
                      AD
                    </div>
                    <div className="hidden text-left sm:block">
                      <div className="text-xs font-medium" style={{ color: topbarTextColor }}>Admin</div>
                      <div className="text-[10px]" style={{ color: topbarMutedTextColor }}>admin@tradepro.com</div>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel>我的账户</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate(getClientAccountPath(location.pathname, "credits", currentSiteId))}>
                      <CreditCard className="mr-2 h-3.5 w-3.5 text-slate-500" />
                      积分消费
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(getClientAccountPath(location.pathname, "social", currentSiteId))}>
                      <Share2 className="mr-2 h-3.5 w-3.5 text-slate-500" />
                      社媒账号
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(getClientAccountPath(location.pathname, "plan", currentSiteId))}>
                      <Package className="mr-2 h-3.5 w-3.5 text-slate-500" />
                      套餐管理
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(getClientAccountPath(location.pathname, "profile", currentSiteId))}>
                      <User className="mr-2 h-3.5 w-3.5 text-slate-500" />
                      个人资料
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <HelpCircle className="mr-2 h-3.5 w-3.5 text-slate-500" />
                      帮助中心
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600">
                      <LogOut className="mr-2 h-3.5 w-3.5" />
                      退出登录
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
          </div>
        </header>

        <DeferredGlobalLocalEnvAlert variant="client" />

        <main data-client-runtime-main className="app-main">
          <Outlet />
        </main>
        <footer
          data-client-page-footer
          data-page-layout-footer
          data-client-runtime-footer
          className="shrink-0 items-center justify-between px-4 py-3 text-xs sm:px-6"
        >
          <div data-client-project-footer-copy className="min-w-0 truncate">
            {clientPlanCode ? `客户 ${clientCode || "-"} · 计划 ${clientPlanCode}` : "客户端运行环境"}
          </div>
          <div data-responsive-visual-launcher-slot />
          <div data-page-layout-footer-status className="shrink-0">
            客户源已同步
          </div>
        </footer>
        <SiteSwitchLoadingOverlay />
        <LazyAIServiceWidget />
      </div>
    </div>
  );
}


