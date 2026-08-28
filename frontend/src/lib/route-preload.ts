/**
 * 只在用户通过悬浮、聚焦或触摸表达导航意图后预热重页面。
 * 这样既不增加首屏批量下载，也能缩短首次点击常用工作区后的等待时间。
 *
 * 浏览器会缓存动态导入；这里继续保存 Promise，避免同一个侧栏入口被反复
 * 悬浮或聚焦时发出重复的推测请求。失败的预热会释放，正式路由仍可重试。
 */
const routePreloads = new Map<string, Promise<unknown>>();

const PRODUCT_MARKET_MODULES_PRELOAD_KEY = "productMarket:modules";
const PRODUCT_MARKET_SERVICE_PRELOAD_KEY = "productMarket:service";
const PRODUCT_MARKET_DEVELOPMENT_PRELOAD_KEY = "productMarket:development";
const PRODUCT_MARKET_BLUEPRINT_PRELOAD_KEY = "productMarket:blueprint";
const PRODUCT_ANALYSIS_MARKET_RADAR_PRELOAD_KEY = "productAnalysis:market-finder";
const PRODUCT_ANALYSIS_GLOBAL_MARKET_PRELOAD_KEY = "productAnalysis:global-market";
const SOCIAL_CUSTOMER_ROADMAP_PRELOAD_KEY = "socialMedia:customer-roadmap";

const workspaceRouteLoaders = {
  aiChat: () => import("@/pages/AIChat"),
  aiCustomerService: () => import("@/pages/AICustomerService"),
  companyInfo: () => import("@/pages/CompanyInfo"),
  geoCenter: () => import("@/pages/GeoCenter"),
  productMarket: () => import("@/pages/ProductMarket"),
  productAnalysis: () => import("@/pages/ProductAnalysis"),
  projects: () => import("@/pages/Projects"),
  seo: () => import("@/pages/SEO"),
  smartAds: () => import("@/pages/SmartAds"),
  socialMedia: () => import("@/pages/SocialMedia"),
  templates: () => import("@/pages/Templates"),
} as const;

type WorkspaceRouteKey = keyof typeof workspaceRouteLoaders;

const workspaceRouteMatches: ReadonlyArray<readonly [suffix: string, key: WorkspaceRouteKey]> = [
  ["/ai-customer-service", "aiCustomerService"],
  ["/product-analysis", "productAnalysis"],
  ["/product-market", "productMarket"],
  ["/company-info", "companyInfo"],
  ["/smart-ads", "smartAds"],
  ["/geo-center", "geoCenter"],
  ["/templates", "templates"],
  ["/projects", "projects"],
  ["/ai-chat", "aiChat"],
  ["/social", "socialMedia"],
  ["/seo", "seo"],
];

function preloadWorkspaceRoute(key: WorkspaceRouteKey) {
  const existing = routePreloads.get(key);
  if (existing) return existing;

  const pending = workspaceRouteLoaders[key]().catch((error) => {
    // Do not retain a failed speculative request: the normal route loader
    // still owns its guarded retry when the user actually opens the page.
    routePreloads.delete(key);
    throw error;
  });
  routePreloads.set(key, pending);
  return pending;
}

function preloadProductMarketModulesPanel() {
  const existing = routePreloads.get(PRODUCT_MARKET_MODULES_PRELOAD_KEY);
  if (existing) return existing;

  const pending = import("@/components/product-market/ProductMarketModulesPanel").catch((error) => {
    routePreloads.delete(PRODUCT_MARKET_MODULES_PRELOAD_KEY);
    throw error;
  });
  routePreloads.set(PRODUCT_MARKET_MODULES_PRELOAD_KEY, pending);
  return pending;
}

function preloadProductMarketCustomerServiceSectionForRoute() {
  const existing = routePreloads.get(PRODUCT_MARKET_SERVICE_PRELOAD_KEY);
  if (existing) return existing;

  const pending = import("@/lib/product-market-customer-service-section-loader")
    .then(({ loadProductMarketCustomerServiceSection }) => loadProductMarketCustomerServiceSection())
    .catch((error) => {
      routePreloads.delete(PRODUCT_MARKET_SERVICE_PRELOAD_KEY);
      throw error;
    });
  routePreloads.set(PRODUCT_MARKET_SERVICE_PRELOAD_KEY, pending);
  return pending;
}

function preloadProductMarketDevelopmentGuidePanel() {
  const existing = routePreloads.get(PRODUCT_MARKET_DEVELOPMENT_PRELOAD_KEY);
  if (existing) return existing;

  const pending = import("@/components/product-market/ProductMarketDevelopmentGuidePanel").catch((error) => {
    routePreloads.delete(PRODUCT_MARKET_DEVELOPMENT_PRELOAD_KEY);
    throw error;
  });
  routePreloads.set(PRODUCT_MARKET_DEVELOPMENT_PRELOAD_KEY, pending);
  return pending;
}

function preloadProductMarketFactoryPlatformBlueprint() {
  const existing = routePreloads.get(PRODUCT_MARKET_BLUEPRINT_PRELOAD_KEY);
  if (existing) return existing;

  const pending = import("@/components/product-market/FactoryPlatformBlueprint").catch((error) => {
    routePreloads.delete(PRODUCT_MARKET_BLUEPRINT_PRELOAD_KEY);
    throw error;
  });
  routePreloads.set(PRODUCT_MARKET_BLUEPRINT_PRELOAD_KEY, pending);
  return pending;
}

function preloadProductAnalysisPanel(key: "market-finder" | "global-market") {
  const preloadKey = key === "market-finder"
    ? PRODUCT_ANALYSIS_MARKET_RADAR_PRELOAD_KEY
    : PRODUCT_ANALYSIS_GLOBAL_MARKET_PRELOAD_KEY;
  const existing = routePreloads.get(preloadKey);
  if (existing) return existing;

  const pending = (key === "market-finder"
    ? import("@/components/market-radar/MarketRadarWorkspace")
    : import("@/components/competitive-pricing/CompetitivePricingWorkspace")
  ).catch((error) => {
    routePreloads.delete(preloadKey);
    throw error;
  });
  routePreloads.set(preloadKey, pending);
  return pending;
}

function preloadSocialCustomerRoadmapPanel() {
  const existing = routePreloads.get(SOCIAL_CUSTOMER_ROADMAP_PRELOAD_KEY);
  if (existing) return existing;

  const pending = import("@/components/social/SocialCustomerRoadmapTab").catch((error) => {
    routePreloads.delete(SOCIAL_CUSTOMER_ROADMAP_PRELOAD_KEY);
    throw error;
  });
  routePreloads.set(SOCIAL_CUSTOMER_ROADMAP_PRELOAD_KEY, pending);
  return pending;
}

/** Preload only a route family that the user is about to open. */
export function preloadWorkspaceRouteForPath(path: string) {
  const [pathWithQuery] = path.split("#", 1);
  const [rawPathname, rawSearch = ""] = pathWithQuery.split("?", 2);
  const pathname = rawPathname.replace(/\/+$/, "").toLowerCase();
  const match = workspaceRouteMatches.find(([suffix]) => pathname.endsWith(suffix));
  if (!match) return;
  void preloadWorkspaceRoute(match[1]).catch(() => undefined);
  if (
    match[1] === "productMarket"
    && new URLSearchParams(rawSearch).get("tab")?.toLowerCase() === "modules"
  ) {
    void preloadProductMarketModulesPanel().catch(() => undefined);
  }
  if (
    match[1] === "productMarket"
    && new URLSearchParams(rawSearch).get("tab")?.toLowerCase() === "service"
  ) {
    void preloadProductMarketCustomerServiceSectionForRoute().catch(() => undefined);
  }
  if (
    match[1] === "productMarket"
    && new URLSearchParams(rawSearch).get("tab")?.toLowerCase() === "development"
  ) {
    void preloadProductMarketDevelopmentGuidePanel().catch(() => undefined);
  }
  if (
    match[1] === "productMarket"
    && new URLSearchParams(rawSearch).get("tab")?.toLowerCase() === "blueprint"
  ) {
    void preloadProductMarketFactoryPlatformBlueprint().catch(() => undefined);
  }
  if (match[1] === "productAnalysis") {
    const analysisTab = new URLSearchParams(rawSearch).get("tab")?.toLowerCase();
    if (analysisTab === "market-finder" || analysisTab === "global-market") {
      void preloadProductAnalysisPanel(analysisTab).catch(() => undefined);
    }
  }
  if (
    match[1] === "socialMedia"
    && new URLSearchParams(rawSearch).get("tab")?.toLowerCase() === "customer-roadmap"
  ) {
    void preloadSocialCustomerRoadmapPanel().catch(() => undefined);
  }
}
