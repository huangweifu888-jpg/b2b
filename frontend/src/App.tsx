import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Component, Suspense, lazy, useEffect, useLayoutEffect, useState, type ComponentType, type ErrorInfo, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { applyGlobalThemeTokens, resolveGlobalThemeTokens } from "@/lib/global-theme-tokens";
import { clearRouteErrorDiagnostic, loadLazyModule, recordRouteErrorDiagnostic, reloadRecoverableRoute } from "@/lib/lazy-module-recovery";
import {
  beginRouteLoadingObservation,
  finishRouteFallbackObservation,
  startRouteFallbackObservation,
} from "@/lib/route-loading-performance";

const lazyPage = <T extends ComponentType<any>>(loader: () => Promise<{ default: T }>) =>
  lazy(() => loadLazyModule(loader, loader.toString()));

const GlobalLocalEnvAlert = lazyPage(() => import("@/components/GlobalLocalEnvAlert"));

// Product Market owns every source workspace's operations, modules, layout,
// and service routes. Use the same one-retry lazy loader as the rest of the
// app so a temporary development chunk mismatch cannot leave those routes on
// the permanent loading fallback.
const ProductMarketPage = lazyPage(() => import("./pages/ProductMarket"));
const AppProductMarketRuntime = lazyPage(() => import("./components/AppProductMarketRuntime"));

const lazyNamedPage = <T extends object, K extends keyof T>(loader: () => Promise<T>, name: K) =>
  lazy(async () => {
    const mod = await loadLazyModule(loader, `${loader.toString()}:${String(name)}`);
    return { default: mod[name] as ComponentType<any> };
  });

// Keep route-only screens out of the application entry chunk. Grouped modules
// share one loader so sibling routes still reuse the same browser request.
const loadAgencyLivePages = () => import("./pages/agency/AgencyLivePages");
const AgencyEnterprisesLive = lazyNamedPage(loadAgencyLivePages, "AgencyEnterprisesLive");
const AgencyPlansLive = lazyNamedPage(loadAgencyLivePages, "AgencyPlansLive");
const AgencySocialContentReviews = lazyPage(() => import("./pages/agency/AgencySocialContentReviews"));

const loadHQLivePages = () => import("./pages/hq/HQLivePages");
const HQAgenciesLive = lazyNamedPage(loadHQLivePages, "HQAgenciesLive");
const HQDomainsLive = lazyNamedPage(loadHQLivePages, "HQDomainsLive");
const HQEnterprisesLive = lazyNamedPage(loadHQLivePages, "HQEnterprisesLive");
const HQPlansLive = lazyNamedPage(loadHQLivePages, "HQPlansLive");
const HQSitesLive = lazyNamedPage(loadHQLivePages, "HQSitesLive");

const loadHQLiveFinancePages = () => import("./pages/hq/HQLiveFinancePages");
const HQAutoRenewLive = lazyNamedPage(loadHQLiveFinancePages, "HQAutoRenewLive");
const HQExpiringLive = lazyNamedPage(loadHQLiveFinancePages, "HQExpiringLive");
const HQInvoicesLive = lazyNamedPage(loadHQLiveFinancePages, "HQInvoicesLive");
const HQOrderAuditLive = lazyNamedPage(loadHQLiveFinancePages, "HQOrderAuditLive");
const HQOrdersLive = lazyNamedPage(loadHQLiveFinancePages, "HQOrdersLive");
const HQRefundsLive = lazyNamedPage(loadHQLiveFinancePages, "HQRefundsLive");
const HQWalletLive = lazyNamedPage(loadHQLiveFinancePages, "HQWalletLive");

const loadHQLiveMarketingPages = () => import("./pages/hq/HQLiveMarketingPages");
const HQAnnouncementsLive = lazyNamedPage(loadHQLiveMarketingPages, "HQAnnouncementsLive");
const HQCsatLive = lazyNamedPage(loadHQLiveMarketingPages, "HQCsatLive");
const HQGroupsLive = lazyNamedPage(loadHQLiveMarketingPages, "HQGroupsLive");
const HQPromotionsLive = lazyNamedPage(loadHQLiveMarketingPages, "HQPromotionsLive");

const loadHQLiveGovernancePages = () => import("./pages/hq/HQLiveGovernancePages");
const HQAlertsLive = lazyNamedPage(loadHQLiveGovernancePages, "HQAlertsLive");
const HQPaymentChannelsLive = lazyNamedPage(loadHQLiveGovernancePages, "HQPaymentChannelsLive");

const loadHQLiveConfigPages = () => import("./pages/hq/HQLiveConfigPages");
const HQEmailConfigLive = lazyNamedPage(loadHQLiveConfigPages, "HQEmailConfigLive");
const HQPlatformConfigLive = lazyNamedPage(loadHQLiveConfigPages, "HQPlatformConfigLive");

const loadHQLiveAuditPages = () => import("./pages/hq/HQLiveAuditPages");
const HQOEMAuditLive = lazyNamedPage(loadHQLiveAuditPages, "HQOEMAuditLive");
const HQRechargeAuditLive = lazyNamedPage(loadHQLiveAuditPages, "HQRechargeAuditLive");

const loadHQLivePackagesPages = () => import("./pages/hq/HQLivePackagesPages");
const HQBoostersLive = lazyNamedPage(loadHQLivePackagesPages, "HQBoostersLive");
const HQCouponsLive = lazyNamedPage(loadHQLivePackagesPages, "HQCouponsLive");
const HQPointsLive = lazyNamedPage(loadHQLivePackagesPages, "HQPointsLive");

const loadHQLiveAssetPages = () => import("./pages/hq/HQLiveAssetPages");
const HQGalleryLive = lazyNamedPage(loadHQLiveAssetPages, "HQGalleryLive");
const HQTemplatesLive = lazyNamedPage(loadHQLiveAssetPages, "HQTemplatesLive");

const loadHQLiveAdminPages = () => import("./pages/hq/HQLiveAdminPages");
const HQDeptsLive = lazyNamedPage(loadHQLiveAdminPages, "HQDeptsLive");
const HQMembersLive = lazyNamedPage(loadHQLiveAdminPages, "HQMembersLive");
const HQRolesLive = lazyNamedPage(loadHQLiveAdminPages, "HQRolesLive");

const loadHQLiveOpsPages = () => import("./pages/hq/HQLiveOpsPages");
const HQInquiryAutoLive = lazyNamedPage(loadHQLiveOpsPages, "HQInquiryAutoLive");
const HQNotifyConfigLive = lazyNamedPage(loadHQLiveOpsPages, "HQNotifyConfigLive");

const loadHQLiveQaPages = () => import("./pages/hq/HQLiveQaPages");
const HQQaPlansLive = lazyNamedPage(loadHQLiveQaPages, "HQQaPlansLive");
const HQQaTasksLive = lazyNamedPage(loadHQLiveQaPages, "HQQaTasksLive");

const loadHQLiveSeoPages = () => import("./pages/hq/HQLiveSeoPages");
const HQSeoBlogsLive = lazyNamedPage(loadHQLiveSeoPages, "HQSeoBlogsLive");
const HQTdkRulesLive = lazyNamedPage(loadHQLiveSeoPages, "HQTdkRulesLive");

const HQAIVendorsLive = lazyNamedPage(() => import("./pages/hq/HQLiveAIPages"), "HQAIVendorsLive");
const HQAIModelsLive = lazyNamedPage(() => import("./pages/hq/HQLiveAIModelsPage"), "HQAIModelsLive");
const PlatformArchitecturePage = lazyPage(() => import("./pages/hq/PlatformArchitecture"));
const AuditReleaseLogsPage = lazyPage(() => import("./pages/hq/AuditReleaseLogs"));
const BackupRestoreDrillsPage = lazyPage(() => import("./pages/hq/BackupRestoreDrills"));
const HQSocialAuthorization = lazyPage(() => import("./pages/hq/HQSocialAuthorization"));
const HQSocialContentReviews = lazyPage(() => import("./pages/hq/HQSocialContentReviews"));
const HQSocialPublishDelivery = lazyPage(() => import("./pages/hq/HQSocialPublishDelivery"));
const ProductAnalysisPage = lazyPage(() => import("./pages/ProductAnalysis"));
const FactoryIcpProfilesPage = lazyPage(() => import("./pages/FactoryIcpProfiles"));
const FactoryBrandStudioPage = lazyPage(() => import("./pages/FactoryBrandStudio"));
const FactoryDigitalAssetsPage = lazyPage(() => import("./pages/FactoryDigitalAssets"));
const FactorySiteManagementPage = lazyPage(() => import("./pages/FactorySiteManagement"));

const PreviewSitePage = lazyPage(() => import("./pages/PreviewSite"));
const PreviewFramePage = lazyPage(() => import("./pages/PreviewFrame"));
const AdminLayoutPage = lazyPage(() => import("./components/AdminLayout"));
const AgencyLayoutPage = lazyPage(() => import("./components/AgencyLayout"));
const AgencySourceLayoutPage = lazyPage(() => import("./components/AgencySourceLayout"));
const ClientSourceLayoutPage = lazyPage(() => import("./components/ClientSourceLayout"));
const HQLayoutPage = lazyPage(() => import("./components/HQLayout"));
const StandaloneGlobalFramePageHost = lazyPage(() => import("./components/StandaloneGlobalFramePageHost"));
const AuthCallbackPage = lazyPage(() => import("./pages/AuthCallback"));
const AuthErrorPage = lazyPage(() => import("./pages/AuthError"));
const LogoutCallbackPage = lazyPage(() => import("./pages/LogoutCallbackPage"));

const IndexPage = lazyPage(() => import("./pages/Index"));
const ProjectsPage = lazyPage(() => import("./pages/Projects"));
const AIChatPage = lazyPage(() => import("./pages/AIChat"));
const AICustomerServicePage = lazyPage(() => import("./pages/AICustomerService"));
const TemplatesPage = lazyPage(() => import("./pages/Templates"));
const InquiriesPage = lazyPage(() => import("./pages/Inquiries"));
const CustomersPage = lazyPage(() => import("./pages/Customers"));
const FactoryCpqQuotesPage = lazyPage(() => import("./pages/FactoryCpqQuotes"));
const FactoryFulfillmentOrdersPage = lazyPage(() => import("./pages/FactoryFulfillmentOrders"));
const FactoryCustomerAssetsPage = lazyPage(() => import("./pages/FactoryCustomerAssets"));
const FactoryProductPassportsPage = lazyPage(() => import("./pages/FactoryProductPassports"));
const FactoryQualityInspectionsPage = lazyPage(() => import("./pages/FactoryQualityInspections"));
const FactoryProcurementPage = lazyPage(() => import("./pages/FactoryProcurement"));
const FactoryProductionPlanningPage = lazyPage(() => import("./pages/FactoryProductionPlanning"));
const FactoryManufacturingExecutionPage = lazyPage(() => import("./pages/FactoryManufacturingExecution"));
const FactoryFieldServicePage = lazyPage(() => import("./pages/FactoryFieldService"));
const FactoryWarrantyRmaPage = lazyPage(() => import("./pages/FactoryWarrantyRma"));
const FactoryRenewalGrowthPage = lazyPage(() => import("./pages/FactoryRenewalGrowth"));
const FactoryPartnerVoicePage = lazyPage(() => import("./pages/FactoryPartnerVoice"));
const FactoryHealthCockpitPage = lazyPage(() => import("./pages/FactoryHealthCockpit"));
const FactoryDataWarehousePage = lazyPage(() => import("./pages/FactoryDataWarehouse"));
const FactoryMetricSemanticsPage = lazyPage(() => import("./pages/FactoryMetricSemantics"));
const FactoryRevenueProfitPage = lazyPage(() => import("./pages/FactoryRevenueProfit"));
const FactoryForecastPage = lazyPage(() => import("./pages/FactoryForecast"));
const FactoryAiCommandPage = lazyPage(() => import("./pages/FactoryAiCommand"));
const FactoryErpPage = lazyPage(() => import("./pages/FactoryErp"));
const FactoryFinancePage = lazyPage(() => import("./pages/FactoryFinance"));
const FactoryPeoplePage = lazyPage(() => import("./pages/FactoryPeople"));
const FactoryRecruitingPage = lazyPage(() => import("./pages/FactoryRecruiting"));
const FactoryApprovalCenterPage = lazyPage(() => import("./pages/FactoryApprovalCenter"));
const FactoryLegalContractsPage = lazyPage(() => import("./pages/FactoryLegalContracts"));
const FactoryDamLocalizationPage = lazyPage(() => import("./pages/FactoryDamLocalization"));
const FactoryKnowledgeGraphPage = lazyPage(() => import("./pages/FactoryKnowledgeGraph"));
const FactoryStructuredDataPage = lazyPage(() => import("./pages/FactoryStructuredData"));
const FactoryChannelFeedPage = lazyPage(() => import("./pages/FactoryChannelFeed"));
const FactoryIdentityResolutionPage = lazyPage(() => import("./pages/FactoryIdentityResolution"));
const FactoryCdpPage = lazyPage(() => import("./pages/FactoryCdp"));
const FactoryAccountGraphPage = lazyPage(() => import("./pages/FactoryAccountGraph"));
const FactoryBuyingCommitteePage = lazyPage(() => import("./pages/FactoryBuyingCommittee"));
const FactoryCustomerTimelinePage = lazyPage(() => import("./pages/FactoryCustomerTimeline"));
const FactorySegmentsConsentPage = lazyPage(() => import("./pages/FactorySegmentsConsent"));
const FactoryAbmPage = lazyPage(() => import("./pages/FactoryAbm"));
const FactoryCreativeCenterPage = lazyPage(() => import("./pages/FactoryCreativeCenter"));
const FactoryAiSdrPage = lazyPage(() => import("./pages/FactoryAiSdr"));
const FactoryRfqSamplesPage = lazyPage(() => import("./pages/FactoryRfqSamples"));
const FactoryCommercePage = lazyPage(() => import("./pages/FactoryCommerce"));
const ProductsPage = lazyPage(() => import("./pages/Products"));
const SEOPage = lazyPage(() => import("./pages/SEO"));
const GeoCenterPage = lazyPage(() => import("./pages/GeoCenter"));
const NewsCenterPage = lazyPage(() => import("./pages/NewsCenter"));
const CasesPage = lazyPage(() => import("./pages/Cases"));
const VideosPage = lazyPage(() => import("./pages/Videos"));
const BlogOptimizePage = lazyPage(() => import("./pages/BlogOptimize"));
const SocialMediaPage = lazyPage(() => import("./pages/SocialMedia"));
const SmartAdsPage = lazyPage(() => import("./pages/SmartAds"));
const CompanyInfoPage = lazyPage(() => import("./pages/CompanyInfo"));
const SiteSettingsPage = lazyPage(() => import("./pages/SiteSettings"));
const ReportsPage = lazyPage(() => import("./pages/Reports"));
const AccountPage = lazyPage(() => import("./pages/Account"));

const AgencyDashboardPage = lazyPage(() => import("./pages/agency/AgencyDashboard"));
const WorkspacePage = lazyPage(() => import("./pages/agency/Workspace"));
const AgencyCustomersPage = lazyPage(() => import("./pages/agency/AgencyCustomers"));
const AgencySitesPage = lazyPage(() => import("./pages/agency/AgencySites"));
const AgencyOrdersPage = lazyPage(() => import("./pages/agency/AgencyOrders"));
const AgencyReportsPage = lazyPage(() => import("./pages/agency/Reports"));
const PublicPoolPage = lazyPage(() => import("./pages/agency/PublicPool"));
const BusinessDataPage = lazyPage(() => import("./pages/agency/BusinessData"));
const SEOTasksPage = lazyPage(() => import("./pages/agency/SEOTasks"));
const SEOBlogsPage = lazyPage(() => import("./pages/agency/SEOBlogs"));
const MembersPage = lazyPage(() => import("./pages/agency/Members"));
const AgencyRolesPage = lazyPage(() => import("./pages/agency/Roles"));
const QuotasPage = lazyPage(() => import("./pages/agency/Quotas"));
const PerformancePage = lazyPage(() => import("./pages/agency/Performance"));
const WalletPage = lazyPage(() => import("./pages/agency/Wallet"));
const InviteLinksPage = lazyPage(() => import("./pages/agency/InviteLinks"));
const OEMSettingsPage = lazyPage(() => import("./pages/agency/OEMSettings"));
const AgencyVersionCenterPage = lazyPage(() => import("./pages/agency/AgencyVersionCenter"));

const HQDashboardPage = lazyPage(() => import("./pages/hq/HQDashboard"));
const HQCodeEditorPage = lazyPage(() => import("./pages/hq/HQCodeEditor"));
const TemplateSnapshotMigrationsPage = lazyPage(() => import("./pages/hq/TemplateSnapshotMigrations"));
const ReleaseRolloutsPage = lazyPage(() => import("./pages/hq/ReleaseRollouts"));
const AgencySourceReleasesPage = lazyPage(() => import("./pages/hq/AgencySourceReleases"));
const ClientSourceReleasesPage = lazyPage(() => import("./pages/hq/ClientSourceReleases"));
const TenantGovernancePage = lazyPage(() => import("./pages/hq/TenantGovernance"));

const loadHQAIPages = () => import("./pages/hq/HQAIPages");
const HQAIVendorsPage = HQAIVendorsLive;
const HQAIModelsPage = HQAIModelsLive;
const HQAILogsPage = lazyNamedPage(loadHQAIPages, "HQAILogs");
const HQAICostPage = lazyNamedPage(loadHQAIPages, "HQAICost");
const HQAIModelSquarePage = lazyNamedPage(loadHQAIPages, "HQAIModelSquare");

const APP_DISPLAY_TITLE = "TradeHQ Console";

function applyPersistedThemeBeforeRuntime() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  try {
    const pathname = window.location.pathname;
    const scope = pathname.startsWith("/zb") ? "hq" : pathname.startsWith("/dl") ? "agency" : "client";
    const payload = JSON.parse(window.localStorage.getItem(`product-market-storage:${scope}`) || "null") as {
      state?: {
        layoutStyle?: Record<string, string | number | undefined>;
        sidebarStyle?: Record<string, string | undefined>;
        globalFontFamily?: string;
        globalFontWeight?: string;
        globalLetterSpacing?: string;
      };
    } | null;
    const state = payload?.state;
    if (!state?.layoutStyle || !state.sidebarStyle) return;
    const root = document.documentElement;
    applyGlobalThemeTokens(root, resolveGlobalThemeTokens(state.layoutStyle, state.sidebarStyle));
    root.style.setProperty("--tradepro-global-font-family", state.globalFontFamily || '"Noto Sans SC", "Microsoft YaHei", sans-serif');
    root.style.setProperty("--tradepro-global-font-weight", state.globalFontWeight || "400");
    root.style.setProperty("--tradepro-global-letter-spacing", state.globalLetterSpacing || "0.02em");
  } catch {
    // Invalid legacy storage must never block the application shell.
  }
}

applyPersistedThemeBeforeRuntime();

function RouteFallback({
  routeTarget,
  routeVisitKey,
  onRetry,
}: {
  routeTarget: string;
  routeVisitKey: string;
  onRetry: () => void;
}) {
  const [showRecovery, setShowRecovery] = useState(false);
  useEffect(() => {
    setShowRecovery(false);
    const fallbackToken = startRouteFallbackObservation(routeTarget, routeVisitKey);
    const timer = window.setTimeout(() => setShowRecovery(true), 8_000);
    return () => {
      window.clearTimeout(timer);
      finishRouteFallbackObservation(fallbackToken);
    };
  }, [routeTarget, routeVisitKey]);

  return (
    <div
      data-page-route-loading
      aria-busy="true"
      aria-live="polite"
      className="grid min-h-[40vh] place-items-center px-4 py-6 text-center"
    >
      <div className="max-w-md space-y-3">
        <p className="text-sm text-muted-foreground">页面正在加载，请稍候…</p>
        {showRecovery ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium">当前页面加载较慢，可手动重试</p>
            <p className="text-xs leading-5 text-muted-foreground">
              若本地预览或路由模块暂未挂载，请重试；系统不会自动刷新当前页面。
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              重试加载
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AppDocumentTitle() {
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = APP_DISPLAY_TITLE;
    }
  }, []);

  return null;
}


class PageErrorBoundary extends Component<
  { children: ReactNode; routeTarget: string; onRetry: () => void },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page route error isolated:", this.props.routeTarget, error, info);
    recordRouteErrorDiagnostic(error, this.props.routeTarget);
    reloadRecoverableRoute(error, this.props.routeTarget);
  }

  componentDidUpdate(previousProps: Readonly<{ routeTarget: string; children: ReactNode }>) {
    // In development a fixed route can retain its error-boundary state after
    // Fast Refresh.  When the route element itself has been replaced, retry
    // the repaired tree once instead of leaving the user on an old isolation
    // screen.  A recurring render error keeps the same child element and is
    // still safely isolated.
    if ((previousProps.routeTarget !== this.props.routeTarget || previousProps.children !== this.props.children) && this.state.error) {
      this.setState({ error: null });
    }
  }

  private retryCurrentPage = () => {
    if (reloadRecoverableRoute(this.state.error, this.props.routeTarget)) return;
    clearRouteErrorDiagnostic(this.props.routeTarget);
    this.setState({ error: null });
    this.props.onRetry();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <section
        data-page-route-error
        className="m-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm"
      >
        <h2 className="text-base font-semibold">当前页面加载异常已隔离</h2>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          此页面没有影响左侧导航、顶部栏或其他工作区。请重试当前页；若仍失败，请在开发规范查看质量记录。
        </p>
        <p className="mt-2 break-all font-mono text-xs text-amber-800">{this.props.routeTarget}</p>
        {/* Kept out of the visible fallback so end users see a calm recovery
            path, while the quality centre can read the precise render cause. */}
        <p data-page-route-error-diagnostic className="hidden">{this.state.error.message}</p>
        <button
          type="button"
          onClick={this.retryCurrentPage}
          className="mt-4 inline-flex rounded-md border border-amber-700 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
        >
          重试当前页
        </button>
        <span className="ml-2 inline-flex align-middle">
          <Suspense fallback={<span className="inline-flex h-8 w-24" aria-hidden="true" />}>
            <GlobalLocalEnvAlert variant="client" placement="inline" />
          </Suspense>
        </span>
      </section>
    );
  }
}

function PageBoundary({ children, stableRemountKey }: { children: ReactNode; stableRemountKey?: string }) {
  const location = useLocation();
  const routeTarget = `${location.pathname}${location.search}${location.hash}`;
  const routeRemountTarget = stableRemountKey ?? (() => {
    // Product Market owns four views behind one route and one draft state.
    // Treating the display-only `tab` query as an error-boundary identity used
    // to unmount the complete workspace on every tab click, forcing the source
    // contract, experts and material library to initialize again. Keep every
    // other query parameter in the identity because site/draft handoffs still
    // represent a genuinely different data target.
    if (!location.pathname.endsWith("/product-market")) return routeTarget;
    const params = new URLSearchParams(location.search);
    params.delete("tab");
    const search = params.toString();
    return `${location.pathname}${search ? `?${search}` : ""}${location.hash}`;
  })();
  const [retryNonce, setRetryNonce] = useState(0);

  useLayoutEffect(() => {
    beginRouteLoadingObservation(routeTarget, location.key);
  }, [location.key, routeTarget]);

  useEffect(() => {
    setRetryNonce(0);
  }, [routeRemountTarget]);

  useEffect(() => {
    clearRouteErrorDiagnostic(routeTarget);
  }, [routeTarget]);

  const retryCurrentPage = () => setRetryNonce((value) => value + 1);

  useEffect(() => {
    const retryFromDiagnostic = (event: Event) => {
      const requestedTarget = (event as CustomEvent<{ target?: string }>).detail?.target;
      if (requestedTarget && requestedTarget !== routeTarget) return;
      clearRouteErrorDiagnostic(routeTarget);
      retryCurrentPage();
    };
    window.addEventListener("tradepro:retry-isolated-route", retryFromDiagnostic);
    return () => window.removeEventListener("tradepro:retry-isolated-route", retryFromDiagnostic);
  }, [routeTarget]);

  return (
    <PageErrorBoundary key={`${routeRemountTarget}:${retryNonce}`} routeTarget={routeTarget} onRetry={retryCurrentPage}>
      <Suspense fallback={<RouteFallback routeTarget={routeTarget} routeVisitKey={location.key} onRetry={retryCurrentPage} />}>{children}</Suspense>
    </PageErrorBoundary>
  );
}

function page(element: ReactNode) {
  return <PageBoundary>{element}</PageBoundary>;
}

function layoutPage(element: ReactNode, layoutIdentity: string) {
  return <PageBoundary stableRemountKey={`layout:${layoutIdentity}`}>{element}</PageBoundary>;
}

function PrefixRedirect({ from, to }: { from: string; to: string }) {
  const location = useLocation();
  const suffix = location.pathname.slice(from.length);
  return <Navigate to={`${to}${suffix}${location.search}${location.hash}`} replace />;
}

function clientRoutes(prefix = "") {
  const routePath = (path: string) => (path === "/" ? prefix || "/" : `${prefix}${path}`);

  return (
    <>
      <Route path={routePath("/product-market")} element={page(<ProductMarketPage />)} />
      <Route path={routePath("/")} element={page(<IndexPage />)} />
      <Route path={routePath("/projects")} element={page(<ProjectsPage />)} />
      <Route path={routePath("/ai-chat")} element={page(<AIChatPage />)} />
      <Route path={routePath("/ai-customer-service")} element={page(<AICustomerServicePage />)} />
      <Route path={routePath("/company-info")} element={page(<CompanyInfoPage />)} />
      <Route path={routePath("/templates")} element={page(<TemplatesPage />)} />
      <Route path={routePath("/inquiries")} element={page(<InquiriesPage />)} />
      <Route path={routePath("/customers")} element={page(<CustomersPage />)} />
      <Route path={routePath("/cpq-quotes")} element={page(<FactoryCpqQuotesPage />)} />
      <Route path={routePath("/fulfillment-orders")} element={page(<FactoryFulfillmentOrdersPage />)} />
      <Route path={routePath("/customer-assets")} element={page(<FactoryCustomerAssetsPage />)} />
      <Route path={routePath("/product-passports")} element={page(<FactoryProductPassportsPage />)} />
      <Route path={routePath("/quality-inspections")} element={page(<FactoryQualityInspectionsPage />)} />
      <Route path={routePath("/procurement")} element={page(<FactoryProcurementPage />)} />
      <Route path={routePath("/production-plans")} element={page(<FactoryProductionPlanningPage />)} />
      <Route path={routePath("/manufacturing-execution")} element={page(<FactoryManufacturingExecutionPage />)} />
      <Route path={routePath("/field-service")} element={page(<FactoryFieldServicePage />)} />
      <Route path={routePath("/warranty-rma")} element={page(<FactoryWarrantyRmaPage />)} />
      <Route path={routePath("/renewal-growth")} element={page(<FactoryRenewalGrowthPage />)} />
      <Route path={routePath("/partner-voice")} element={page(<FactoryPartnerVoicePage />)} />
      <Route path={routePath("/health-cockpit")} element={page(<FactoryHealthCockpitPage />)} />
      <Route path={routePath("/data-warehouse")} element={page(<FactoryDataWarehousePage />)} />
      <Route path={routePath("/metric-center")} element={page(<FactoryMetricSemanticsPage />)} />
      <Route path={routePath("/revenue-profit")} element={page(<FactoryRevenueProfitPage />)} />
      <Route path={routePath("/forecast")} element={page(<FactoryForecastPage />)} />
      <Route path={routePath("/ai-command")} element={page(<FactoryAiCommandPage />)} />
      <Route path={routePath("/erp")} element={page(<FactoryErpPage />)} />
      <Route path={routePath("/finance")} element={page(<FactoryFinancePage />)} />
      <Route path={routePath("/people")} element={page(<FactoryPeoplePage />)} />
      <Route path={routePath("/recruiting")} element={page(<FactoryRecruitingPage />)} />
      <Route path={routePath("/approval-center")} element={page(<FactoryApprovalCenterPage />)} />
      <Route path={routePath("/contract-legal")} element={page(<FactoryLegalContractsPage />)} />
      <Route path={routePath("/icp-profiles")} element={page(<FactoryIcpProfilesPage />)} />
      <Route path={routePath("/brand-studio")} element={page(<FactoryBrandStudioPage />)} />
      <Route path={routePath("/digital-assets")} element={page(<FactoryDigitalAssetsPage />)} />
      <Route path={routePath("/site-management")} element={page(<FactorySiteManagementPage />)} />
      <Route path={routePath("/dam-localization")} element={page(<FactoryDamLocalizationPage />)} />
      <Route path={routePath("/knowledge-graph")} element={page(<FactoryKnowledgeGraphPage />)} />
      <Route path={routePath("/structured-data")} element={page(<FactoryStructuredDataPage />)} />
      <Route path={routePath("/channel-feed")} element={page(<FactoryChannelFeedPage />)} />
      <Route path={routePath("/identity-resolution")} element={page(<FactoryIdentityResolutionPage />)} />
      <Route path={routePath("/customer-data-platform")} element={page(<FactoryCdpPage />)} />
      <Route path={routePath("/account-graph")} element={page(<FactoryAccountGraphPage />)} />
      <Route path={routePath("/buying-committee")} element={page(<FactoryBuyingCommitteePage />)} />
      <Route path={routePath("/customer-timeline")} element={page(<FactoryCustomerTimelinePage />)} />
      <Route path={routePath("/segments-consent")} element={page(<FactorySegmentsConsentPage />)} />
      <Route path={routePath("/abm")} element={page(<FactoryAbmPage />)} />
      <Route path={routePath("/creative-center")} element={page(<FactoryCreativeCenterPage />)} />
      <Route path={routePath("/ai-sdr")} element={page(<FactoryAiSdrPage />)} />
      <Route path={routePath("/rfq-samples")} element={page(<FactoryRfqSamplesPage />)} />
      <Route path={routePath("/commerce")} element={page(<FactoryCommercePage />)} />
      <Route path={routePath("/products")} element={page(<ProductsPage />)} />
      <Route path={routePath("/news")} element={page(<NewsCenterPage />)} />
      <Route path={routePath("/cases")} element={page(<CasesPage />)} />
      <Route path={routePath("/videos")} element={page(<VideosPage />)} />
      <Route path={routePath("/blog")} element={page(<BlogOptimizePage />)} />
      <Route path={routePath("/seo")} element={page(<SEOPage />)} />
      <Route path={routePath("/geo-center")} element={page(<GeoCenterPage />)} />
      <Route path={routePath("/social")} element={page(<SocialMediaPage />)} />
      <Route path={routePath("/smart-ads")} element={page(<SmartAdsPage />)} />
      <Route path={routePath("/product-analysis")} element={page(<ProductAnalysisPage />)} />
      <Route path={routePath("/site-settings")} element={page(<SiteSettingsPage />)} />
      <Route path={routePath("/reports")} element={page(<ReportsPage />)} />
      <Route path={routePath("/account")} element={page(<AccountPage />)} />
    </>
  );
}

function agencyRoutes(prefix = "") {
  const routePath = (path: string) => (path === "/" ? prefix || "/" : `${prefix}${path}`);

  return (
    <>
      <Route path={routePath("/product-market")} element={page(<ProductMarketPage />)} />
      <Route path={routePath("/")} element={page(<AgencyDashboardPage />)} />
      <Route path={routePath("/workspace")} element={page(<WorkspacePage />)} />
      <Route path={routePath("/enterprises")} element={page(<AgencyEnterprisesLive />)} />
      <Route path={routePath("/customers")} element={page(<AgencyCustomersPage />)} />
      <Route path={routePath("/sites")} element={page(<AgencySitesPage />)} />
      <Route path={routePath("/orders")} element={page(<AgencyOrdersPage />)} />
      <Route path={routePath("/reports")} element={page(<AgencyReportsPage />)} />
      <Route path={routePath("/public-pool")} element={page(<PublicPoolPage />)} />
      <Route path={routePath("/business-data")} element={page(<BusinessDataPage />)} />
      <Route path={routePath("/social-content-reviews")} element={page(<AgencySocialContentReviews />)} />
      <Route path={routePath("/seo-tasks")} element={page(<SEOTasksPage />)} />
      <Route path={routePath("/seo-blogs")} element={page(<SEOBlogsPage />)} />
      <Route path={routePath("/members")} element={page(<MembersPage />)} />
      <Route path={routePath("/roles")} element={page(<AgencyRolesPage />)} />
      <Route path={routePath("/quotas")} element={page(<QuotasPage />)} />
      <Route path={routePath("/performance")} element={page(<PerformancePage />)} />
      <Route path={routePath("/plans")} element={page(<AgencyPlansLive />)} />
      <Route path={routePath("/wallet")} element={page(<WalletPage />)} />
      <Route path={routePath("/invites")} element={page(<InviteLinksPage />)} />
      <Route path={routePath("/invite-links")} element={page(<InviteLinksPage />)} />
      <Route path={routePath("/oem")} element={page(<OEMSettingsPage />)} />
      <Route path={routePath("/oem-settings")} element={page(<OEMSettingsPage />)} />
      <Route path={routePath("/version")} element={page(<AgencyVersionCenterPage />)} />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppDocumentTitle />
      <Suspense fallback={null}><AppProductMarketRuntime /></Suspense>
      <Routes>
        <Route element={layoutPage(<StandaloneGlobalFramePageHost />, "standalone")}>
          <Route path="/auth/callback" element={page(<AuthCallbackPage />)} />
          <Route path="/auth/error" element={page(<AuthErrorPage />)} />
          <Route path="/logout-callback" element={page(<LogoutCallbackPage />)} />
          <Route path="/sites/:slug" element={page(<PreviewSitePage />)} />
          <Route path="/preview-frame" element={page(<PreviewFramePage />)} />
        </Route>

        <Route element={layoutPage(<HQLayoutPage />, "headquarters")}>
          <Route path="/zb" element={page(<HQDashboardPage />)} />
          <Route path="/zb/members" element={page(<HQMembersLive />)} />
          <Route path="/zb/roles" element={page(<HQRolesLive />)} />
          <Route path="/zb/depts" element={page(<HQDeptsLive />)} />
          <Route path="/zb/agencies" element={page(<HQAgenciesLive />)} />
          <Route path="/zb/recharge-audit" element={page(<HQRechargeAuditLive />)} />
          <Route path="/zb/oem-audit" element={page(<HQOEMAuditLive />)} />
          <Route path="/zb/enterprises" element={page(<HQEnterprisesLive />)} />
          <Route path="/zb/sites" element={page(<HQSitesLive />)} />
          <Route path="/zb/domains" element={page(<HQDomainsLive />)} />
          <Route path="/zb/templates" element={page(<HQTemplatesLive />)} />
          <Route path="/zb/template-migrations" element={page(<TemplateSnapshotMigrationsPage />)} />
          <Route path="/zb/release-rollouts" element={page(<ReleaseRolloutsPage />)} />
          <Route path="/zb/gallery" element={page(<HQGalleryLive />)} />
          <Route path="/zb/ai-vendors" element={page(<HQAIVendorsPage />)} />
          <Route path="/zb/ai-models" element={page(<HQAIModelsPage />)} />
          <Route path="/zb/ai-keys" element={page(<HQAIVendorsPage />)} />
          <Route path="/zb/ai-logs" element={page(<HQAILogsPage />)} />
          <Route path="/zb/ai-cost" element={page(<HQAICostPage />)} />
          <Route path="/zb/ai-square" element={page(<HQAIModelSquarePage />)} />
          <Route path="/zb/wallet" element={page(<HQWalletLive />)} />
          <Route path="/zb/plans" element={page(<HQPlansLive />)} />
          <Route path="/zb/boosters" element={page(<HQBoostersLive />)} />
          <Route path="/zb/coupons" element={page(<HQCouponsLive />)} />
          <Route path="/zb/points" element={page(<HQPointsLive />)} />
          <Route path="/zb/orders" element={page(<HQOrdersLive />)} />
          <Route path="/zb/order-audit" element={page(<HQOrderAuditLive />)} />
          <Route path="/zb/auto-renew" element={page(<HQAutoRenewLive />)} />
          <Route path="/zb/refunds" element={page(<HQRefundsLive />)} />
          <Route path="/zb/invoices" element={page(<HQInvoicesLive />)} />
          <Route path="/zb/announcements" element={page(<HQAnnouncementsLive />)} />
          <Route path="/zb/promotions" element={page(<HQPromotionsLive />)} />
          <Route path="/zb/groups" element={page(<HQGroupsLive />)} />
          <Route path="/zb/csat" element={page(<HQCsatLive />)} />
          <Route path="/zb/qa-plans" element={page(<HQQaPlansLive />)} />
          <Route path="/zb/qa-tasks" element={page(<HQQaTasksLive />)} />
          <Route path="/zb/inquiry-auto" element={page(<HQInquiryAutoLive />)} />
          <Route path="/zb/tdk-rules" element={page(<HQTdkRulesLive />)} />
          <Route path="/zb/seo-blogs" element={page(<HQSeoBlogsLive />)} />
          <Route path="/zb/notify-config" element={page(<HQNotifyConfigLive />)} />
          <Route path="/zb/email-config" element={page(<HQEmailConfigLive />)} />
          <Route path="/zb/expiring" element={page(<HQExpiringLive />)} />
          <Route path="/zb/platform-config" element={page(<HQPlatformConfigLive />)} />
          <Route path="/zb/social-authorization" element={page(<HQSocialAuthorization />)} />
          <Route path="/zb/social-content-reviews" element={page(<HQSocialContentReviews />)} />
          <Route path="/zb/social-publish-delivery" element={page(<HQSocialPublishDelivery />)} />
          <Route path="/zb/platform-architecture" element={page(<PlatformArchitecturePage />)} />
          <Route path="/zb/product-market" element={page(<ProductMarketPage />)} />
          <Route path="/zb/kh-style-settings" element={page(<ProductMarketPage />)} />
          <Route path="/zb/material-assets" element={page(<ProductMarketPage />)} />
          <Route path="/zb/client-style-settings" element={page(<ProductMarketPage />)} />
          <Route path="/zb/dl-style-settings" element={page(<ProductMarketPage />)} />
          <Route path="/zb/agency-style-settings" element={page(<ProductMarketPage />)} />
          <Route path="/zb/code-editor" element={page(<HQCodeEditorPage />)} />
          <Route path="/zb/code-editor/:scope" element={page(<HQCodeEditorPage />)} />
          <Route path="/zb/payment-channels" element={page(<HQPaymentChannelsLive />)} />
          <Route path="/zb/alerts" element={page(<HQAlertsLive />)} />
          <Route path="/zb/audit-logs" element={page(<AuditReleaseLogsPage />)} />
          <Route path="/zb/backup-restore-drills" element={page(<BackupRestoreDrillsPage />)} />
          <Route path="/zb/tenant-governance" element={page(<TenantGovernancePage />)} />
        </Route>

        <Route element={layoutPage(<AgencyLayoutPage />, "agency")}>
          <Route path="/dl/product-market" element={page(<ProductMarketPage />)} />
          <Route path="/dl" element={page(<AgencyDashboardPage />)} />
          <Route path="/dl/workspace" element={page(<WorkspacePage />)} />
          <Route path="/dl/enterprises" element={page(<AgencyEnterprisesLive />)} />
          <Route path="/dl/customers" element={page(<AgencyCustomersPage />)} />
          <Route path="/dl/sites" element={page(<AgencySitesPage />)} />
          <Route path="/dl/orders" element={page(<AgencyOrdersPage />)} />
          <Route path="/dl/reports" element={page(<AgencyReportsPage />)} />
          <Route path="/dl/public-pool" element={page(<PublicPoolPage />)} />
          <Route path="/dl/business-data" element={page(<BusinessDataPage />)} />
          <Route path="/dl/seo-tasks" element={page(<SEOTasksPage />)} />
          <Route path="/dl/seo-blogs" element={page(<SEOBlogsPage />)} />
          <Route path="/dl/members" element={page(<MembersPage />)} />
          <Route path="/dl/roles" element={page(<AgencyRolesPage />)} />
          <Route path="/dl/quotas" element={page(<QuotasPage />)} />
          <Route path="/dl/performance" element={page(<PerformancePage />)} />
          <Route path="/dl/plans" element={page(<AgencyPlansLive />)} />
          <Route path="/dl/wallet" element={page(<WalletPage />)} />
          <Route path="/dl/invites" element={page(<InviteLinksPage />)} />
          <Route path="/dl/invite-links" element={page(<InviteLinksPage />)} />
          <Route path="/dl/oem" element={page(<OEMSettingsPage />)} />
          <Route path="/dl/oem-settings" element={page(<OEMSettingsPage />)} />
          <Route path="/dl/version" element={page(<AgencyVersionCenterPage />)} />
        </Route>

        <Route path="/hq" element={<Navigate to="/zb" replace />} />
        <Route path="/hq/*" element={<PrefixRedirect from="/hq" to="/zb" />} />
        <Route path="/zb/kh/*" element={<PrefixRedirect from="/zb/kh" to="/kh" />} />
        <Route element={layoutPage(<AgencySourceLayoutPage />, "agency-source")}>
          <Route path="/zb/agency-source/releases" element={page(<AgencySourceReleasesPage />)} />
          <Route path="/zb/agency-source/partners" element={page(<HQAgenciesLive partnerMode />)} />
          <Route path="/zb/agency-source/recharge-audit" element={page(<HQRechargeAuditLive partnerMode />)} />
          {agencyRoutes("/zb/agency-source")}
        </Route>
        <Route element={layoutPage(<ClientSourceLayoutPage />, "client-source")}><Route path="/zb/client-source/releases" element={page(<ClientSourceReleasesPage />)} />{clientRoutes("/zb/client-source")}</Route>
        <Route path="/agency" element={<Navigate to="/dl" replace />} />
        <Route path="/agency/*" element={<PrefixRedirect from="/agency" to="/dl" />} />
        <Route path="/dl/kh/*" element={<PrefixRedirect from="/dl/kh" to="/kh" />} />
        <Route element={layoutPage(<AdminLayoutPage />, "client-admin")}>
          {clientRoutes("/kh")}
        </Route>
        <Route element={layoutPage(<AdminLayoutPage />, "client-admin")}>
          {clientRoutes()}
        </Route>
      </Routes>
      <Toaster position="top-center" richColors />
    </BrowserRouter>
  );
}
