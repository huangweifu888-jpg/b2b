import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Bell, Menu, Search, Settings } from "lucide-react";

import AgencySidebar from "./AgencySidebar";
import { DeferredGlobalLocalEnvAlert } from "./DeferredShellUtilities";
import LocalDevLoginButton from "./LocalDevLoginButton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useProductMarketStore, type ExportableConfig } from "@/lib/product-market-store";
import { PRODUCT_MARKET_SHARED_STYLE_EVENT } from "@/lib/product-market-shared-style";
import {
  PRODUCT_MARKET_CONFIG_EVENT,
  readAgencyPlanProductMarketConfig,
  relevantProductMarketStorageKeys,
} from "@/lib/product-market-config";
import { fetchAllSitesFromBackend, getSiteById, resolveCurrentSiteId } from "@/lib/sites";
import { platformApi, type PlatformNode } from "@/lib/platform-api";
import { diffLatest, fetchInstance } from "@/lib/template-snapshot/api";

// Runtime agency plans receive their source through the agency release chain;
// do not merge client-source shared styles into that chain.
const readScopedConfig = (siteId?: string | null) => readAgencyPlanProductMarketConfig(siteId);

type AgencyBrand = { shortName: string; companyName: string; logoUrl?: string; iconName?: string };
type RuntimeTemplateStatus = "loading" | "synced" | "pending" | "uninstalled" | "unbound";

function findOrganizationByCode(nodes: PlatformNode[], code: string): PlatformNode | undefined {
  for (const node of nodes) {
    if (node.code === code) return node;
    const found = findOrganizationByCode(node.children || [], code);
    if (found) return found;
  }
  return undefined;
}

function readOrganizationSetting(node: PlatformNode, key: string) {
  const value = node.settings?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export default function AgencyLayout() {
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [agencyBrand, setAgencyBrand] = useState<AgencyBrand | null>(null);
  const [runtimeTemplateConfig, setRuntimeTemplateConfig] = useState<ExportableConfig | null>(null);
  const [availableUpdateCount, setAvailableUpdateCount] = useState(0);
  const [runtimeTemplateStatus, setRuntimeTemplateStatus] = useState<RuntimeTemplateStatus>("loading");
  const appliedConfigSignatureRef = useRef("");
  const navigate = useNavigate();
  const currentSiteId = useMemo(() => resolveCurrentSiteId("agency", location.search), [location.search]);
  const agencyCode = useMemo(() => {
    try { return new URLSearchParams(location.search).get("agency")?.trim() || ""; } catch { return ""; }
  }, [location.search]);

  // A runtime link can be opened from a client plan with only `siteId`.
  // Resolve and retain that plan's direct agency code so the correct agency
  // source snapshot (rather than an unscoped local fallback) is installed.
  useEffect(() => {
    if (agencyCode || !currentSiteId) return;
    let active = true;
    const attachAgencyContext = (code?: string | null) => {
      const normalizedCode = code?.trim();
      if (!active || !normalizedCode) return;
      const params = new URLSearchParams(location.search);
      params.set("agency", normalizedCode);
      navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true });
    };

    const cachedSite = getSiteById(currentSiteId);
    if (cachedSite?.agencyCode) {
      attachAgencyContext(cachedSite.agencyCode);
    } else {
      void fetchAllSitesFromBackend().then((sites) => {
        attachAgencyContext(sites.find((site) => site.id === currentSiteId)?.agencyCode);
      });
    }
    return () => { active = false; };
  }, [agencyCode, currentSiteId, location.pathname, location.search, navigate]);

  useEffect(() => {
    let active = true;
    if (!agencyCode) {
      setAgencyBrand(null);
      return () => { active = false; };
    }
    void platformApi.tree()
      .then((response) => {
        if (!active) return;
        const agency = findOrganizationByCode(response.items || [], agencyCode);
        if (!agency) { setAgencyBrand(null); return; }
        const shortName = readOrganizationSetting(agency, "companyShortName") || agency.name || agency.code;
        setAgencyBrand({
          shortName,
          companyName: agency.name || shortName,
          logoUrl: readOrganizationSetting(agency, "companyLogoUrl") || undefined,
          iconName: readOrganizationSetting(agency, "companyLogoIcon") || undefined,
        });
      })
      .catch(() => { if (active) setAgencyBrand(null); });
    return () => { active = false; };
  }, [agencyCode]);

  useEffect(() => {
    let active = true;
    const loadRuntimeTemplate = async () => {
      if (!agencyCode) {
        if (active) {
          setRuntimeTemplateConfig(null);
          setAvailableUpdateCount(0);
          setRuntimeTemplateStatus("unbound");
        }
        return;
      }
      try {
        const instance = await fetchInstance(`agency-runtime-${agencyCode}`) as Record<string, unknown>;
        const config = instance.snapshot_config_json;
        const hasRuntimeSnapshot = Boolean(config && typeof config === "object");
        if (active) setRuntimeTemplateConfig(hasRuntimeSnapshot ? config as ExportableConfig : null);
        try {
          const diff = await diffLatest(`agency-runtime-${agencyCode}`);
          const count = Array.isArray(diff.entries) ? diff.entries.length : 0;
          if (active) {
            setAvailableUpdateCount(count);
            setRuntimeTemplateStatus(hasRuntimeSnapshot ? (count > 0 ? "pending" : "synced") : "uninstalled");
          }
        } catch {
          if (active) {
            setAvailableUpdateCount(0);
            setRuntimeTemplateStatus(hasRuntimeSnapshot ? "synced" : "uninstalled");
          }
        }
      } catch {
        // Before the first headquarters deployment, retain the source/local fallback
        // but never label that fallback as a successfully installed release.
        if (active) setRuntimeTemplateConfig(null);
        if (active) setAvailableUpdateCount(0);
        if (active) setRuntimeTemplateStatus("uninstalled");
      }
    };
    void loadRuntimeTemplate();
    const refresh = () => { void loadRuntimeTemplate(); };
    window.addEventListener("agency-runtime-template-synced", refresh);
    return () => { active = false; window.removeEventListener("agency-runtime-template-synced", refresh); };
  }, [agencyCode]);

  useLayoutEffect(() => {
    try {
      const { resetToFactory, importConfig } = useProductMarketStore.getState();
      const config = runtimeTemplateConfig || readScopedConfig(currentSiteId);
      appliedConfigSignatureRef.current = JSON.stringify(config || null);
      resetToFactory();
      if (config) importConfig(config);
    } catch (error) {
      console.warn("Agency layout config bootstrap failed, using defaults:", error);
    } finally {
      setReady(true);
    }
  }, [currentSiteId, runtimeTemplateConfig]);

  useEffect(() => {
    const refreshConfig = (event?: Event) => {
      if (runtimeTemplateConfig) return;
      if (event instanceof StorageEvent) {
        if (!event.key || !relevantProductMarketStorageKeys(currentSiteId).includes(event.key)) return;
      }
      try {
        const config = readScopedConfig(currentSiteId);
        const nextSignature = JSON.stringify(config || null);
        if (config && nextSignature !== appliedConfigSignatureRef.current) {
          appliedConfigSignatureRef.current = nextSignature;
          useProductMarketStore.getState().importConfig(config);
        }
      } catch (error) {
        console.warn("Agency layout live config refresh failed:", error);
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
  }, [currentSiteId, runtimeTemplateConfig]);

  if (!ready) {
    return <div className="app-shell bg-slate-50" />;
  }

  return (
    <div
      className="app-shell flex overflow-hidden bg-slate-50 lg:h-screen"
      data-platform-frame-scope="agency"
    >
      <div className="hidden lg:block">
        <AgencySidebar brand={agencyBrand} />
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="app-mobile-sheet">
          <SheetHeader className="app-mobile-sheet-header border-slate-200">
            <SheetTitle className="text-base">代理端导航</SheetTitle>
          </SheetHeader>
          <SheetBody className="app-mobile-sheet-body bg-slate-900">
            <AgencySidebar brand={agencyBrand} />
          </SheetBody>
        </SheetContent>
      </Sheet>

      <div className="app-page flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="app-topbar border-slate-200 bg-white">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3 lg:flex-1">
              <button
                className="app-toolbar-icon-btn border-slate-200 text-slate-600 lg:hidden"
                aria-label="打开导航"
                onClick={() => setMobileNavOpen(true)}
                type="button"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="relative min-w-0 w-full lg:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="搜索企业客户、站点、订单..."
                  className="h-9 border-slate-200 bg-slate-50 pl-9 shadow-none"
                />
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
              <Badge variant="outline" className="max-w-[12rem] truncate text-xs" title={agencyBrand?.companyName || "代理端"}>
                {agencyBrand?.companyName || "代理端"}
              </Badge>
              {availableUpdateCount > 0 ? <button type="button" onClick={() => navigate(`/dl/version?agency=${encodeURIComponent(agencyCode)}`)} className="rounded-md bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-700 ring-1 ring-sky-200 hover:bg-sky-100">有 {availableUpdateCount} 项更新</button> : null}
              <button className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                <Bell className="h-4 w-4" />
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
              </button>
              <button className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                <Settings className="h-4 w-4" />
              </button>
              <LocalDevLoginButton
                scope="agency"
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
              />
              <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white">
                  A
                </div>
                <div className="hidden text-xs sm:block">
                  <div className="font-medium text-slate-900">Admin</div>
                  <div className="text-slate-500">超级管理员</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <DeferredGlobalLocalEnvAlert variant="agency" />

        <main data-agency-runtime-main className="app-main-roomy">
          <Outlet />
        </main>
        <footer data-platform-global-footer data-page-layout-footer data-agency-runtime-footer className="platform-global-footer">
          <span>{agencyBrand?.shortName || agencyBrand?.companyName || "代理端"} · 代理源运行时</span>
          <div data-responsive-visual-launcher-slot />
          <span className="platform-global-footer-status">
            {runtimeTemplateStatus === "loading"
              ? "正在检查代理源版本"
              : runtimeTemplateStatus === "unbound"
                ? "未绑定代理版本上下文"
                : runtimeTemplateStatus === "uninstalled"
                  ? "未安装代理源版本"
                  : availableUpdateCount > 0
                    ? `待同步 ${availableUpdateCount} 项更新`
                    : "代理源已同步"}
          </span>
        </footer>
      </div>
    </div>
  );
}
