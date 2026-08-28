import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, FolderKanban, Bot, LayoutTemplate, Inbox, Users, Package, Search, Settings, Link2, BarChart3, Database, Globe, ChevronDown, Share2, Megaphone, LineChart, TrendingUp, Newspaper, HardHat, Video, BookOpen, ShoppingBag, PanelLeftClose, PanelLeftOpen, Building2, ShieldCheck, MessageCircle, X } from "lucide-react";
import { Link } from "react-router-dom";

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, type CSSProperties } from "react";
import { useShallow } from "zustand/react/shallow";

import { cn } from "@/lib/utils";
import { resolveAccessibleTextColor } from "@/lib/color-contrast";
import { LEFT_SELECTED_TEXT_FALLBACK } from "@/lib/global-theme-tokens";

import { buildProductModuleCategoryDisplayOrderMap, formatProductModuleCategoryLabel, getCustomerServiceAnimationLabel, getCustomerServiceCategoryExperts, getDefaultProductModuleSecondaryIconName, getDefaultSidebarStyle, getProductModuleCategoryByPath, getProductModuleCategoryMarketingGuide, normalizeProductModuleCategoryOrder, useProductMarketStore, PRODUCT_MODULE_CATEGORIES, ICON_OPTIONS } from "@/lib/product-market-store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { readCustomerServiceMediaPreview, resolveCustomerServiceLocalMaterialReference } from "@/lib/customer-service-media";
import { getCustomerServiceVoicePreset, getDefaultVoiceGenderForAvatar, getDefaultVoiceStyleForAvatar } from "@/lib/customer-service-voice";
import { getCustomerServiceReminderPreset, resolveCustomerServiceReminderStyle } from "@/lib/customer-service-reminder-sound";
import { openCustomerServiceExpertChat } from "@/lib/customer-service-chat-events";
import { Dialog, DraggableDialogContent } from "@/components/ui/dialog";
import { ContentPluginCloseButton } from "@/components/content-plugins/ContentPluginControls";
import { ExpertIdentitySummary } from "@/components/customer-service/ExpertIdentitySummary";
import { CustomerServiceAvatarMedia } from "@/components/customer-service/CustomerServiceAvatarMedia";
import { ProductMarketCategoryIdentityIcon } from "@/components/product-market/ProductMarketCategoryIdentityIcon";
import { PRODUCT_MARKET_SHARED_CATEGORY_CONTRACT } from "@/lib/product-market-category-contract";
import { resolveCustomerServiceExpertProfile } from "@/lib/customer-service-expert-contract";
import { resolveCustomerServiceRuntimeScope, resolveCustomerServiceRuntimeSnapshot } from "@/lib/customer-service-runtime-config";
import { PRODUCT_MARKET_CONFIG_EVENT, relevantProductMarketStorageKeys } from "@/lib/product-market-config";
import { PRODUCT_MARKET_SHARED_STYLE_EVENT } from "@/lib/product-market-shared-style";
import { buildSharedCategoryOwnershipKey, buildSharedModuleOwnershipKey } from "@/lib/shared-ownership-highlight-runtime";
import { FACTORY_PLATFORM_SOCIAL_WORKSPACES } from "@/lib/factory-platform-blueprint";

import {
  DeferredPlatformSettingsDropdown,
  DeferredSidebarProjectVersionCard,
  DeferredSoftwareVersionBadge,
} from "./DeferredShellUtilities";

import { appendSiteIdToPath } from "@/lib/site-admin";

import { resolveCurrentSiteId } from "@/lib/sites";

import { buildConfiguredProductNavItems, isNavPathMatch, type ConfiguredProductNavItem } from "@/lib/product-navigation";
import { PRODUCT_MARKET_NAV_ITEMS, getProductMarketPath, resolveProductMarketNavTab } from "@/lib/product-market-navigation";
import { isDevelopmentStandardOnlyPath } from "@/lib/development-standard-navigation";
import { PRODUCT_MARKET_DISCLOSURE_KEY, ROUTE_OWNED_SIDEBAR_DISCLOSURE_STRATEGY, useRouteOwnedSidebarDisclosure } from "@/hooks/use-route-owned-sidebar-disclosure";

type RoutePreloadModule = typeof import("@/lib/route-preload");
let routePreloadModulePromise: Promise<RoutePreloadModule> | undefined;

function preloadSidebarWorkspaceRoute(path: string) {
  routePreloadModulePromise ??= import("@/lib/route-preload");
  void routePreloadModulePromise.then(({ preloadWorkspaceRouteForPath }) => preloadWorkspaceRouteForPath(path));
}

type NavItem = {
  label: string;
  path: string;
  icon?: React.ElementType;
  children?: { label: string; path: string }[];
};

const navItems: NavItem[] = [
  { label: "服务概览", path: "/", icon: LayoutDashboard },
  {
    label: "AI 智能",
    path: "/ai-chat",
    icon: Bot,
    children: [
      { label: "AI 建站", path: "/ai-chat" },
      { label: "智能客服", path: "/ai-customer-service" },
    ],
  },
  { label: "已创建计划", path: "/projects", icon: FolderKanban },
  {
    label: "产品分析",
    path: "/product-analysis",
    icon: LineChart,
    children: [
      { label: "兴趣搜索", path: "/product-analysis?tab=keyword-planner" },
      { label: "趋势分析", path: "/product-analysis?tab=trends" },
      { label: "数据洞察", path: "/product-analysis?tab=data-studio" },
      { label: "全球商机", path: "/product-analysis?tab=market-finder" },
      { label: "市场调查", path: "/product-analysis?tab=global-market" },
    ],
  },
  {
    label: "企业资料",
    path: "/company-info",
    icon: Building2,
    children: [
      { label: "基本资料", path: "/company-info?tab=profile" },
      { label: "自定义模块", path: "/company-info?tab=modules" },
    ],
  },
  {
    label: "首页设计",
    path: "/company-info?tab=navigation",
    icon: LayoutTemplate,
    children: [
      { label: "导航栏自定义", path: "/company-info?tab=navigation" },
      { label: "首页 Banner", path: "/company-info?tab=banner" },
      { label: "产品推荐", path: "/company-info?tab=recommend" },
    ],
  },
  {
    label: "产品管理",
    path: "/products",
    icon: Package,
    children: [
      { label: "产品列表", path: "/products?tab=list" },
      { label: "分类管理", path: "/products?tab=category" },
      { label: "文章管理", path: "/products?tab=article" },
    ],
  },
  {
    label: "新闻中心",
    path: "/news",
    icon: Newspaper,
    children: [
      { label: "新闻明细", path: "/news?tab=list" },
      { label: "新闻分类", path: "/news?tab=category" },
      { label: "新闻模板", path: "/news?tab=template" },
    ],
  },
  {
    label: "工程案例",
    path: "/cases",
    icon: HardHat,
    children: [
      { label: "工程明细", path: "/cases?tab=list" },
      { label: "工程分类", path: "/cases?tab=category" },
      { label: "工程模板", path: "/cases?tab=template" },
    ],
  },
  {
    label: "企业视频",
    path: "/videos",
    icon: Video,
    children: [
      { label: "视频明细", path: "/videos?tab=list" },
      { label: "视频分类", path: "/videos?tab=category" },
      { label: "视频授权同步", path: "/videos?tab=sync" },
    ],
  },
  {
    label: "博客优化",
    path: "/blog",
    icon: BookOpen,
    children: [
      { label: "博客明细", path: "/blog?tab=list" },
      { label: "博客分类", path: "/blog?tab=category" },
      { label: "博客模板", path: "/blog?tab=template" },
    ],
  },
  {
    label: "关于我们",
    path: "/company-info?tab=about",
    icon: Building2,
    children: [
      { label: "公司介绍", path: "/company-info?tab=about" },
      { label: "工厂生产", path: "/company-info?tab=factory" },
      { label: "公司风采", path: "/company-info?tab=gallery" },
    ],
  },
  {
    label: "服务保障",
    path: "/company-info?tab=service",
    icon: ShieldCheck,
    children: [
      { label: "FAQ", path: "/company-info?tab=faq" },
      { label: "展会活动", path: "/company-info?tab=exhibition" },
      { label: "物流货运", path: "/company-info?tab=logistics" },
    ],
  },
  {
    label: "联系我们",
    path: "/company-info?tab=im",
    icon: MessageCircle,
    children: [{ label: "IM 客服", path: "/company-info?tab=im" }],
  },
  {
    label: "SEO 优化",
    path: "/seo",
    icon: Search,
    children: [
      { label: "关键词", path: "/seo?tab=keywords" },
      { label: "排名追踪", path: "/seo?tab=ranking" },
      { label: "SEO 文章", path: "/seo?tab=articles" },
      { label: "审计", path: "/seo?tab=audit" },
      { label: "Meta 管理", path: "/seo?tab=meta" },
      { label: "外链管理", path: "/seo?tab=backlinks" },
      { label: "内链规则", path: "/seo?tab=internal" },
      { label: "死链检测", path: "/seo?tab=deadlinks" },
      { label: "关键词密度", path: "/seo?tab=density" },
      { label: "TDK 模板", path: "/seo?tab=tdk" },
      { label: "关键词挖掘", path: "/seo?tab=mining" },
    ],
  },
  {
    label: "GEO 中心",
    path: "/geo-center",
    icon: Globe,
    children: [
      { label: "优化词", path: "/geo-center?tab=keywords" },
      { label: "文章创作", path: "/geo-center?tab=writing" },
      { label: "创作记录", path: "/geo-center?tab=records" },
      { label: "发布计划", path: "/geo-center?tab=schedule" },
      { label: "发布记录", path: "/geo-center?tab=publish-history" },
      { label: "大模型报表", path: "/geo-center?tab=llm-reports" },
      { label: "权威媒体", path: "/geo-center?tab=authority-media" },
    ],
  },
  {
    label: "社交媒体",
    path: "/social",
    icon: Share2,
    children: FACTORY_PLATFORM_SOCIAL_WORKSPACES.map((workspace) => ({
      label: workspace.label,
      path: workspace.route,
    })),
  },
  {
    label: "智能推广",
    path: "/smart-ads",
    icon: Megaphone,
    children: [
      { label: "推广概览", path: "/smart-ads?tab=overview" },
      { label: "广告平台", path: "/smart-ads?tab=platforms" },
      { label: "推广活动", path: "/smart-ads?tab=campaigns" },
    ],
  },
  {
    label: "数据报表",
    path: "/reports",
    icon: BarChart3,
    children: [
      { label: "流量概况", path: "/reports?tab=overview" },
      { label: "流量来源", path: "/reports?tab=source" },
      { label: "地域分布", path: "/reports?tab=region" },
      { label: "受访页面", path: "/reports?tab=pages" },
      { label: "天访问量", path: "/reports?tab=daily" },
      { label: "访客时间", path: "/reports?tab=time" },
      { label: "访问明细", path: "/reports?tab=details" },
      { label: "浏览占比", path: "/reports?tab=browser" },
      { label: "系统占比", path: "/reports?tab=system" },
      { label: "设备占比", path: "/reports?tab=device" },
      { label: "SEO 明细", path: "/reports?tab=seo" },
      { label: "流量分类", path: "/reports?tab=classification" },
    ],
  },
  {
    label: "询盘管理",
    path: "/inquiries",
    icon: Inbox,
    children: [
      { label: "询盘列表", path: "/inquiries?tab=list" },
      { label: "表单配置", path: "/inquiries?tab=form" },
      { label: "回复模板", path: "/inquiries?tab=template" },
      { label: "分配规则", path: "/inquiries?tab=rules" },
      { label: "垃圾黑名单", path: "/inquiries?tab=blacklist" },
    ],
  },
  {
    label: "CRM 管理",
    path: "/customers",
    icon: Users,
    children: [
      { label: "工作汇总", path: "/customers?tab=summary" },
      { label: "商机数据", path: "/customers?tab=opportunities" },
      { label: "客户公海", path: "/customers?tab=pool" },
      { label: "客户管理", path: "/customers?tab=clients" },
      { label: "邮件管理", path: "/customers?tab=emails" },
      { label: "文件夹管理", path: "/customers?tab=folders" },
      { label: "邮件营销", path: "/customers?tab=marketing" },
    ],
  },
  {
    label: "健康驾舱",
    path: "/health-cockpit",
    icon: BarChart3,
    children: [
      { label: "内容健度", path: "/health-cockpit?tab=content" },
      { label: "宣传健度", path: "/health-cockpit?tab=promotion" },
      { label: "流量健度", path: "/health-cockpit?tab=traffic" },
      { label: "资产健度", path: "/health-cockpit?tab=assets" },
    ],
  },
  { label: "数据仓库", path: "/data-warehouse", icon: Database },
  { label: "指标语义", path: "/metric-center", icon: LineChart },
  { label: "利润分析", path: "/revenue-profit", icon: TrendingUp },
  { label: "网站风格", path: "/templates", icon: LayoutTemplate },
  {
    label: "站点设置",
    path: "/site-settings",
    icon: Settings,
    children: [
      { label: "站点设置", path: "/site-settings?tab=general" },
      { label: "重定向", path: "/site-settings?tab=redirect" },
    ],
  },
  {
    label: "网址域名",
    path: "/site-settings?tab=domains",
    icon: Link2,
    children: [
      { label: "域名注册", path: "/site-settings?tab=domain-register" },
      { label: "绑定解析", path: "/site-settings?tab=domain-binding" },
      { label: "域名转出", path: "/site-settings?tab=domain-transfer" },
    ],
  },
];

const stripProductCategoryPrefix = (label: string) => label.trim().replace(/^\d+\.[^\s]+\s+/, "");
const buildProductMarketNavLabel = (label: string) => stripProductCategoryPrefix(label);
const buildProductMarketCategoryLabel = (label: string) => label;
const buildProductMarketCategoryLabelWithOrder = (orderIndex: number | null, label: string) =>
  formatProductModuleCategoryLabel(orderIndex, label);
const getNavPathCategory = (path: string, assignments?: Record<string, string>) => {
  return getProductModuleCategoryByPath(path, assignments);
};
const getNavCategoryOrder = (categoryOrder?: string[]) => {
  const rawOrder = normalizeProductModuleCategoryOrder(categoryOrder);
  const seen = new Set<string>();
  return rawOrder
    .map((key) => PRODUCT_MODULE_CATEGORIES.find((category) => category.key === key))
    .filter((category): category is (typeof PRODUCT_MODULE_CATEGORIES)[number] => {
      if (!category || seen.has(category.key)) return false;
      seen.add(category.key);
      return true;
    })
    .map((category) => ({ key: category.key, label: category.label }));
};

const getProductNavCategoryTitle = (path: string, label: string, categoryAssignments?: Record<string, string>, categoryOrderIndexMap?: Map<string, number>) => {
  const category = getNavPathCategory(path, categoryAssignments);
  const cleanLabel = stripProductCategoryPrefix(label);
  const labeledCategory = category
    ? buildProductMarketCategoryLabelWithOrder(categoryOrderIndexMap?.get(category.key) ?? null, category.label)
    : null;
  return category
    ? `栏目归属：${labeledCategory}，名称：${cleanLabel}`
    : `名称：${cleanLabel}`;
};

const getProductNavDescriptionTitle = (description?: string) => {
  const normalized = description?.trim();
  return normalized || undefined;
};

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getClientRoutePrefix(pathname: string) {
  if (pathname.startsWith("/zb/client-source")) return "/zb/client-source";
  if (pathname.startsWith("/zb/agency-source")) return "/zb/agency-source";
  if (pathname.startsWith("/zb/kh")) return "/zb/kh";
  if (pathname.startsWith("/dl/kh")) return "/dl/kh";
  return "/kh";
}

function getSidebarScope(pathname: string): "client" | "agency" | "hq" | "client_source" | "agency_source" {
  if (pathname.startsWith("/zb/client-source")) return "client_source";
  if (pathname.startsWith("/zb/agency-source")) return "agency_source";
  if (pathname.startsWith("/zb/kh")) return "hq";
  if (pathname.startsWith("/dl/kh")) return "agency";
  return "client";
}

function withClientRoutePrefix(path: string, prefix: string) {
  const [pathname, rawSearch] = path.split("?");
  const targetPath = pathname === "/" ? prefix : `${prefix}${pathname}`;
  return `${targetPath}${rawSearch ? `?${rawSearch}` : ""}`;
}

function withClientRoutePrefixAndSite(path: string, prefix: string, siteId?: string | null) {
  return appendSiteIdToPath(withClientRoutePrefix(path, prefix), siteId);
}

function isChildActive(childPath: string, pathname: string, search: string) {
  return isNavPathMatch(childPath, pathname, search);
}

function isClientPathActive(path: string, pathname: string, search: string, prefix: string) {
  return isChildActive(withClientRoutePrefix(path, prefix), pathname, search) || isChildActive(path, pathname, search);
}

function AnimatedCollapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const animationFrame = useRef<number | null>(null);
  const [renderChildren, setRenderChildren] = useState(open);
  const [height, setHeight] = useState<number | undefined>(open ? undefined : 0);

  useEffect(() => {
    if (animationFrame.current !== null) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }

    if (open && !renderChildren) {
      setRenderChildren(true);
      return;
    }

    if (open && renderChildren && ref.current) {
      setHeight(0);
      animationFrame.current = requestAnimationFrame(() => {
        setHeight(ref.current?.scrollHeight || 0);
      });
    } else if (!open && renderChildren && ref.current) {
      setHeight(ref.current.scrollHeight);
      animationFrame.current = requestAnimationFrame(() => setHeight(0));
    } else if (!open) {
      setHeight(0);
    }

    return () => {
      if (animationFrame.current !== null) {
        cancelAnimationFrame(animationFrame.current);
        animationFrame.current = null;
      }
    };
  }, [open, renderChildren]);

  const handleTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== "height") return;
    if (open) {
      setHeight(undefined);
    } else {
      setRenderChildren(false);
    }
  };

  return (
    <div
      style={{
        height: height === undefined ? "auto" : height,
        overflow: "hidden",
        transition: "height 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease",
        opacity: open ? 1 : 0,
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      <div ref={ref}>{renderChildren ? children : null}</div>
    </div>
  );
}

function FadeText({ show, children, className }: { show: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn("inline-block overflow-hidden whitespace-nowrap", className)}
      style={{
        opacity: show ? 1 : 0,
        maxWidth: show ? "12rem" : "0px",
        transition: show ? "max-width 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease 0.15s" : "opacity 0.15s ease, max-width 0.2s cubic-bezier(0.4, 0, 0.2, 1) 0.1s",
      }}
    >
      {children}
    </span>
  );
}

export { navItems };

const COLLAPSED_WIDTH = "3.5rem";
const EXPANDED_WIDTH = "15rem";
// Source or site switches can replace the shell. Keep this outside Sidebar so
// the sidebar thumb survives only those real boundary changes.
const sidebarScrollMemory = new Map<string, number>();

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [categoryExpertAvatarPreviews, setCategoryExpertAvatarPreviews] = useState<Record<string, { url: string; kind: "image" | "video" }>>({});
  const [selectedCategoryExpertId, setSelectedCategoryExpertId] = useState<string | null>(null);
  const [expertDialogScale, setExpertDialogScale] = useState({ avatar: "108px", copy: "13px", name: "15px", gap: "8px" });
  const [expertDialogElement, setExpertDialogElement] = useState<HTMLDivElement | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>();
  const navScrollRef = useRef<HTMLElement | null>(null);
  const navScrollTopRef = useRef(0);
  const {
    products,
    syncProducts,
    sidebarStyle,
    globalFontFamily,
    globalFontWeight,
    globalLetterSpacing,
    customProducts,
    productOrder,
    moduleCategoryOrder,
    moduleCategoryStyles,
    moduleCategoryAssignments,
    moduleIconVisibility,
    csAvatarOverrides,
    soundStyle,
    csVoiceGender,
    csVoiceRate,
  } = useProductMarketStore(useShallow((state) => ({
    products: state.products,
    syncProducts: state.syncProducts,
    sidebarStyle: state.sidebarStyle,
    globalFontFamily: state.globalFontFamily,
    globalFontWeight: state.globalFontWeight,
    globalLetterSpacing: state.globalLetterSpacing,
    customProducts: state.customProducts,
    productOrder: state.productOrder,
    moduleCategoryOrder: state.moduleCategoryOrder,
    moduleCategoryStyles: state.moduleCategoryStyles,
    moduleCategoryAssignments: state.moduleCategoryAssignments,
    moduleIconVisibility: state.moduleIconVisibility,
    csAvatarOverrides: state.csAvatarOverrides,
    soundStyle: state.soundStyle,
    csVoiceGender: state.csVoiceGender,
    csVoiceRate: state.csVoiceRate,
  })));
  const location = useLocation();
  const isEffectivelyExpanded = !collapsed || hoverExpanded;
  const sidebarScope = useMemo(() => getSidebarScope(location.pathname), [location.pathname]);
  const isSourceSidebar = sidebarScope === "client_source" || sidebarScope === "agency_source";
  const clientRoutePrefix = getClientRoutePrefix(location.pathname);
  const sidebarScrollMemoryKey = `${sidebarScope}:${clientRoutePrefix}`;
  const currentSiteId = useMemo(() => resolveCurrentSiteId(sidebarScope, location.search), [location.search, sidebarScope]);
  const [customerServiceRuntimeRevision, setCustomerServiceRuntimeRevision] = useState(0);
  useEffect(() => {
    const scopedKeys = new Set(relevantProductMarketStorageKeys(currentSiteId));
    const refreshRuntimeConfig = (event?: Event) => {
      if (event instanceof StorageEvent && event.key && !scopedKeys.has(event.key)) return;
      setCustomerServiceRuntimeRevision((revision) => revision + 1);
    };
    window.addEventListener("storage", refreshRuntimeConfig);
    window.addEventListener(PRODUCT_MARKET_SHARED_STYLE_EVENT, refreshRuntimeConfig);
    window.addEventListener(PRODUCT_MARKET_CONFIG_EVENT, refreshRuntimeConfig);
    return () => {
      window.removeEventListener("storage", refreshRuntimeConfig);
      window.removeEventListener(PRODUCT_MARKET_SHARED_STYLE_EVENT, refreshRuntimeConfig);
      window.removeEventListener(PRODUCT_MARKET_CONFIG_EVENT, refreshRuntimeConfig);
    };
  }, [currentSiteId]);
  const liveCustomerServiceConfig = useMemo(
    () => useProductMarketStore.getState().exportConfig(),
    [csAvatarOverrides, csVoiceGender, csVoiceRate, moduleCategoryOrder, moduleCategoryStyles, soundStyle],
  );
  const customerServiceRuntimeScope = resolveCustomerServiceRuntimeScope(location.pathname);
  const customerServiceRuntimePathname = customerServiceRuntimeScope === "client_source"
    ? "/zb/client-source"
    : customerServiceRuntimeScope === "agency_source"
      ? "/zb/agency-source"
      : customerServiceRuntimeScope === "hq"
        ? "/zb"
        : customerServiceRuntimeScope === "agency"
          ? "/dl"
          : location.pathname.startsWith("/kh/product-market")
            ? "/kh/product-market"
            : "/kh";
  const customerServiceRuntime = useMemo(
    () => resolveCustomerServiceRuntimeSnapshot({
      pathname: customerServiceRuntimePathname,
      currentSiteId,
      liveStoreConfig: liveCustomerServiceConfig,
    }),
    [currentSiteId, customerServiceRuntimePathname, customerServiceRuntimeRevision, liveCustomerServiceConfig],
  );
  const runtimeCustomerServiceConfig = customerServiceRuntime.runtimeConfig;
  const runtimeAvatarOverrides = customerServiceRuntime.avatarOverrides;

  useLayoutEffect(() => {
    if (!selectedCategoryExpertId || !expertDialogElement) return;
    const dialog = expertDialogElement;
    const updateScale = () => {
      const { width, height } = dialog.getBoundingClientRect();
      // The stored avatar can be 250×250, but the popup is a resizable
      // viewer.  Keep its safe proportional bounds and remove the former
      // 240px display ceiling so a larger dialog can show it at a larger size.
      const avatar = Math.round(Math.max(80, Math.min(width * 0.3, height * 0.44)));
      const copy = Math.round(Math.max(12, Math.min(20, width * 0.028, avatar * 0.16)));
      const name = Math.round(Math.max(14, Math.min(24, width * 0.038, avatar * 0.22)));
      const gap = Math.round(Math.max(8, Math.min(16, width * 0.02)));
      const next = { avatar: `${avatar}px`, copy: `${copy}px`, name: `${name}px`, gap: `${gap}px` };
      setExpertDialogScale((current) => current.avatar === next.avatar && current.copy === next.copy && current.name === next.name && current.gap === next.gap ? current : next);
    };
    const observer = new ResizeObserver(updateScale);
    observer.observe(dialog);
    updateScale();
    return () => observer.disconnect();
  }, [selectedCategoryExpertId, expertDialogElement]);
  const productMarketSubview = resolveProductMarketNavTab(new URLSearchParams(location.search).get("tab"));
  const productMarketRouteActive = location.pathname.endsWith("/product-market");
  const configuredItems = useMemo(() => {
    const usesFactoryBlueprintCatalog = sidebarScope === "client" || sidebarScope === "client_source";
    const factoryBlueprintItems: NavItem[] = products.map((product) => ({
      label: product.label,
      path: product.path,
      icon: product.icon,
      children: product.children?.map((child) => ({ label: child.label, path: child.path })),
    }));
    const baseItems = usesFactoryBlueprintCatalog ? factoryBlueprintItems : navItems;
    const basePaths = new Set(baseItems.map((item) => item.path));
    const plannedBaseItems: NavItem[] = products
      .filter((product) => product.deliveryStatus === "planned" && !basePaths.has(product.path))
      .map((product) => ({
        label: product.label,
        path: product.path,
        icon: product.icon,
      }));

    const configured = buildConfiguredProductNavItems(
      [...baseItems, ...plannedBaseItems],
      products,
      customProducts,
      productOrder,
    ).map((item) => item.product?.deliveryStatus === "planned"
      ? { ...item, disabled: true }
      : item);
    return configured;
  }, [products, customProducts, productOrder, sidebarScope]);
  const navCategoryOrder = useMemo(() => getNavCategoryOrder(moduleCategoryOrder), [moduleCategoryOrder]);
  const categoryOrderIndexMap = useMemo(
    () => buildProductModuleCategoryDisplayOrderMap(moduleCategoryOrder),
    [moduleCategoryOrder]
  );
  const groupedConfiguredItems = useMemo(() => {
    const grouped = navCategoryOrder.map((category) => ({
      key: category.key,
      label: category.label,
      items: [] as ConfiguredProductNavItem[],
    }));
    const groupedMap = new Map(grouped.map((group) => [group.key, group] as const));
    const uncategorizedItems: ConfiguredProductNavItem[] = [];

    for (const item of configuredItems) {
      const category = getNavPathCategory(item.path, moduleCategoryAssignments);
      if (!category) {
        uncategorizedItems.push(item);
        continue;
      }

      const target = groupedMap.get(category.key);
      if (target) {
        target.items.push(item);
      } else {
        uncategorizedItems.push(item);
      }
    }

    // The shared footer switch follows the common convention: on shows all
    // 01–12 category names; off hides only an empty category. Active and
    // inactive items both count as existing and keep their heading visible.
    const groupsWithUncategorized = !uncategorizedItems.length ? grouped : [
      ...grouped,
      {
        key: "uncategorized",
        label: "未分类",
        items: uncategorizedItems,
      },
    ];
    return moduleIconVisibility.showEmptyCategoryNames
      ? groupsWithUncategorized
      : groupsWithUncategorized.filter((group) => group.key === "uncategorized" || group.items.length > 0);
  }, [configuredItems, moduleCategoryAssignments, moduleIconVisibility.showEmptyCategoryNames, navCategoryOrder]);

  const categoryExperts = useMemo(
    () => getCustomerServiceCategoryExperts(
      runtimeCustomerServiceConfig.moduleCategoryOrder || moduleCategoryOrder,
      runtimeCustomerServiceConfig.moduleCategoryStyles || moduleCategoryStyles,
    ),
    [moduleCategoryOrder, moduleCategoryStyles, runtimeCustomerServiceConfig.moduleCategoryOrder, runtimeCustomerServiceConfig.moduleCategoryStyles]
  );
  const categoryExpertAvatarLoadPlan = useMemo(
    () => categoryExperts
      .map((expert) => ({
        id: expert.id,
        override: runtimeAvatarOverrides[expert.id],
        materialReference: resolveCustomerServiceLocalMaterialReference(
          runtimeAvatarOverrides[expert.id]?.mediaAssetId,
        ),
      }))
      .filter(({ override, materialReference }) => Boolean(
        materialReference && !override?.imageDataUrl
      )),
    [categoryExperts, runtimeAvatarOverrides]
  );
  const selectedCategoryExpert = categoryExperts.find((expert) => expert.id === selectedCategoryExpertId) || null;
  const selectedCategoryExpertOverride = selectedCategoryExpert ? runtimeAvatarOverrides[selectedCategoryExpert.id] : undefined;
  const selectedCategoryExpertAvatarSource = selectedCategoryExpert
    ? selectedCategoryExpertOverride?.imageDataUrl
      || categoryExpertAvatarPreviews[selectedCategoryExpert.id]?.url
    : undefined;
  const selectedCategoryExpertAvatarKind = selectedCategoryExpert
    ? categoryExpertAvatarPreviews[selectedCategoryExpert.id]?.kind
      || (selectedCategoryExpertOverride?.mediaMimeType?.startsWith("video/") ? "video" : "image")
    : "image";
  const selectedCategoryExpertProfile = selectedCategoryExpert
    ? resolveCustomerServiceExpertProfile(selectedCategoryExpert, selectedCategoryExpertOverride)
    : null;
  const selectedCategoryExpertName = selectedCategoryExpertProfile?.customerServiceName || "专家";
  const selectedCategoryExpertVoiceGender = selectedCategoryExpertOverride?.voiceGender
    || (selectedCategoryExpert
      ? getDefaultVoiceGenderForAvatar(selectedCategoryExpert.id)
      : runtimeCustomerServiceConfig.csVoiceGender || csVoiceGender || "female");
  const selectedCategoryExpertVoice = selectedCategoryExpert
    ? getCustomerServiceVoicePreset(
      selectedCategoryExpertOverride?.voiceStyleKey || getDefaultVoiceStyleForAvatar(selectedCategoryExpert.id),
      selectedCategoryExpertVoiceGender,
    ).label
    : "未设置";
  const selectedCategoryExpertReminder = selectedCategoryExpert
    ? getCustomerServiceReminderPreset(resolveCustomerServiceReminderStyle(
      selectedCategoryExpert.id,
      selectedCategoryExpertOverride?.soundStyle,
      runtimeCustomerServiceConfig.soundStyle || soundStyle,
    ))?.label || "未设置"
    : "未设置";

  useEffect(() => {
    let active = true;
    // A replacement material must never keep showing the previous asset while
    // its new preview is loading or after that read fails. Clear immediately;
    // every projection paints its bundled expert portrait in the meantime.
    setCategoryExpertAvatarPreviews((current) => (
      Object.keys(current).length > 0 ? {} : current
    ));

    void (async () => {
      const settledPreviews = await Promise.allSettled(categoryExpertAvatarLoadPlan.map(async ({ id, materialReference }) => {
        if (!materialReference) return null;
        const preview = await readCustomerServiceMediaPreview(materialReference);
        const media = preview?.media;
        if (!preview || !media || (media.kind !== "image" && media.kind !== "video")) return null;
        return [id, { url: preview.url, kind: media.kind }] as const;
      }));
      if (!active) return;

      const nextPreviews: Record<string, { url: string; kind: "image" | "video" }> = {};
      settledPreviews.forEach((result) => {
        // One failed asset keeps its normal category icon without blocking the remaining previews.
        if (result.status !== "fulfilled" || !result.value) return;
        const [id, preview] = result.value;
        nextPreviews[id] = preview;
      });
      setCategoryExpertAvatarPreviews((current) => {
        const currentIds = Object.keys(current);
        const nextIds = Object.keys(nextPreviews);
        const changed = currentIds.length !== nextIds.length || nextIds.some((id) => (
          current[id]?.url !== nextPreviews[id]?.url || current[id]?.kind !== nextPreviews[id]?.kind
        ));
        return changed ? nextPreviews : current;
      });
    })();

    return () => {
      active = false;
    };
  }, [categoryExpertAvatarLoadPlan]);

  const getChildStatus = useCallback(
    (parentPath: string, childPath: string) => {
      const product = products.find((p) => p.path === parentPath);
      if (!product?.children) return "active";
      const child = product.children.find((c) => c.path === childPath);
      return child?.status || "active";
    },
    [products]
  );

  const isParentActive = useCallback(
    (item: NavItem) => {
      if (!item.children) return false;
      return item.children.some((c) => isClientPathActive(c.path, location.pathname, location.search, clientRoutePrefix));
    },
    [clientRoutePrefix, location.pathname, location.search]
  );

  const activeDisclosureKey = productMarketRouteActive
    ? PRODUCT_MARKET_DISCLOSURE_KEY
    : configuredItems.find((item) => item.children?.length && isParentActive(item))?.path ?? null;
  const { isDisclosureOpen, toggleDisclosure } = useRouteOwnedSidebarDisclosure(activeDisclosureKey);
  const productMarketExpanded = isDisclosureOpen(PRODUCT_MARKET_DISCLOSURE_KEY);

  useEffect(() => {
    const sidebarItems = navItems.filter((item) => item.icon).map((item) => ({ label: item.label, path: item.path, icon: item.icon! }));
    syncProducts(sidebarItems);
  }, [syncProducts]);

  useLayoutEffect(() => {
    const nav = navScrollRef.current;
    if (!nav) return;
    const savedScrollTop = sidebarScrollMemory.get(sidebarScrollMemoryKey) ?? navScrollTopRef.current;
    navScrollTopRef.current = savedScrollTop;
    // Restore once when the sidebar remounts. Reapplying this value after
    // animation or during scroll makes the thumb fight the user's drag.
    if (navScrollRef.current === nav && nav.isConnected) {
      nav.scrollTop = savedScrollTop;
    }
  }, [sidebarScrollMemoryKey]);

  const preserveSidebarScroll = useCallback(() => {
    const scrollTop = navScrollRef.current?.scrollTop ?? navScrollTopRef.current;
    navScrollTopRef.current = scrollTop;
    sidebarScrollMemory.set(sidebarScrollMemoryKey, scrollTop);
  }, [sidebarScrollMemoryKey]);

  const defaultSidebarStyle = getDefaultSidebarStyle();
  const ss = {
    ...defaultSidebarStyle,
    ...sidebarStyle,
    bgFrom: sidebarStyle.bgFrom?.trim() || defaultSidebarStyle.bgFrom,
    bgVia: sidebarStyle.bgVia?.trim() || defaultSidebarStyle.bgVia,
    bgTo: sidebarStyle.bgTo?.trim() || defaultSidebarStyle.bgTo,
    textColor: sidebarStyle.textColor?.trim() || defaultSidebarStyle.textColor,
    activeHighlight: sidebarStyle.activeHighlight?.trim() || defaultSidebarStyle.activeHighlight,
    borderColor: sidebarStyle.borderColor?.trim() || defaultSidebarStyle.borderColor,
    fontFamily: sidebarStyle.fontFamily?.trim() || defaultSidebarStyle.fontFamily,
    fontWeight: sidebarStyle.fontWeight?.trim() || defaultSidebarStyle.fontWeight,
    letterSpacing: sidebarStyle.letterSpacing?.trim() || defaultSidebarStyle.letterSpacing,
  };
  const hl = ss.activeHighlight || "#0ea5e9";
  const activeSurface = `var(--tradepro-shell-border, ${ss.borderColor || hl})`;
  const activeText = `var(--tradepro-shell-active-text, ${resolveAccessibleTextColor(ss.borderColor || hl, hl, "#000000", LEFT_SELECTED_TEXT_FALLBACK)})`;

  const handleMouseEnter = () => {
    if (collapsed) {
      clearTimeout(hoverTimeout.current);
      setHoverExpanded(true);
    }
  };

  const handleMouseLeave = () => {
    if (collapsed) {
      hoverTimeout.current = setTimeout(() => setHoverExpanded(false), 300);
    }
  };

  useEffect(() => {
    document.documentElement.style.setProperty("--app-sidebar-visible-width", collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH);
  }, [collapsed]);

  return (
    <>
      {collapsed && (
        <div
          style={{
            width: COLLAPSED_WIDTH,
            minWidth: COLLAPSED_WIDTH,
            flexShrink: 0,
          }}
        />
      )}
      <aside
        className="flex h-screen shrink-0 flex-col overflow-hidden"
        data-sidebar-shell
        data-shared-sidebar-disclosure-contract={ROUTE_OWNED_SIDEBAR_DISCLOSURE_STRATEGY}
        style={{
          width: isEffectivelyExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
          minWidth: isEffectivelyExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
          transition: isEffectivelyExpanded
            ? "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
            : "width 0.25s cubic-bezier(0.4, 0, 0.2, 1) 0.1s, min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1) 0.1s",
          background: `linear-gradient(to bottom, ${ss.bgFrom}, ${ss.bgVia}, ${ss.bgTo})`,
          backgroundColor: ss.bgFrom,
          backgroundImage: `linear-gradient(to bottom, ${ss.bgFrom}, ${ss.bgVia}, ${ss.bgTo})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: "100% 100%",
          color: ss.textColor,
          borderRight: `1px solid ${ss.borderColor}40`,
          fontFamily: globalFontFamily || ss.fontFamily || "system-ui, sans-serif",
          fontWeight: globalFontWeight || ss.fontWeight || "400",
          letterSpacing: globalLetterSpacing || ss.letterSpacing || "0.02em",
          ...(collapsed
            ? {
                position: "absolute" as const,
                left: 0,
                top: 0,
                zIndex: 50,
                height: "100vh",
                boxShadow: hoverExpanded ? "4px 0 24px rgba(0,0,0,0.3)" : undefined,
              }
            : {
                position: "relative" as const,
              }),
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex h-[62px] shrink-0 items-center justify-between gap-2 px-3" style={{ borderBottom: `1px solid ${ss.borderColor}50` }}>
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-lg" style={{ background: `linear-gradient(135deg, ${hl}, ${ss.bgFrom})` }}>
              <Globe className="h-4 w-4 text-white" />
            </div>
            <FadeText show={isEffectivelyExpanded}>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold" style={{ color: "#ffffff" }}>
                  Trade Pro
                </div>
                <div className="text-[10px]" style={{ color: `${ss.textColor}cc` }}>
                  B2B 独立站平台
                </div>
              </div>
            </FadeText>
          </div>
          {isEffectivelyExpanded ? (
            <div className="ml-auto flex shrink-0 items-center">
              <DeferredSoftwareVersionBadge tone="dark" />
            </div>
          ) : null}
        </div>

        <div className="space-y-2 px-2 py-2" style={{ borderBottom: `1px solid ${ss.borderColor}40` }}>
          {isSourceSidebar ? <DeferredPlatformSettingsDropdown compact={!isEffectivelyExpanded} variant="dark" mode="source" showDevtools={false} /> : null}
          <DeferredSidebarProjectVersionCard scope={sidebarScope} compact={true} showRestoreActions={false} />
        </div>

        <nav
          ref={navScrollRef}
          onScroll={(event) => {
            const nav = event.currentTarget;
            navScrollTopRef.current = nav.scrollTop;
            sidebarScrollMemory.set(sidebarScrollMemoryKey, nav.scrollTop);
          }}
          className="sidebar-scroll-surface min-h-0 flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto px-1.5 py-2"
        >
          <div>
            <button
              type="button"
              onClick={() => toggleDisclosure(PRODUCT_MARKET_DISCLOSURE_KEY)}
              aria-expanded={productMarketExpanded}
              data-shared-sidebar-disclosure={PRODUCT_MARKET_DISCLOSURE_KEY}
              data-shared-sidebar-route-active={productMarketRouteActive ? "true" : "false"}
              className={cn(
                "group flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-all duration-300 hover:translate-x-0.5 hover:scale-[1.03]",
                !isEffectivelyExpanded && "justify-center px-0",
                productMarketRouteActive && "border-l-2 font-medium"
              )}
              style={productMarketRouteActive
                ? { background: activeSurface, color: activeText, borderColor: hl }
                : { color: `${ss.textColor}dd` }}
              title="产品市场"
            >
              <div className={cn("flex items-center gap-2", !isEffectivelyExpanded && "justify-center")}>
                <ShoppingBag className="h-4 w-4 shrink-0" />
                <FadeText show={isEffectivelyExpanded}>产品市场</FadeText>
              </div>
              <FadeText show={isEffectivelyExpanded}>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", productMarketExpanded && "rotate-180")} />
              </FadeText>
            </button>
            <AnimatedCollapse open={productMarketExpanded && isEffectivelyExpanded}>
              <div className="ml-7 mt-0.5 space-y-0.5 pl-2" style={{ borderLeft: `2px solid ${ss.borderColor}30` }}>
              {PRODUCT_MARKET_NAV_ITEMS.map(({ tab, label }) => {
                const active = productMarketRouteActive && productMarketSubview === tab;
                return <Link
                  key={tab}
                  to={withClientRoutePrefixAndSite(getProductMarketPath(tab), clientRoutePrefix, currentSiteId)}
                  onPointerEnter={() => preloadSidebarWorkspaceRoute(getProductMarketPath(tab))}
                  onPointerDown={() => preloadSidebarWorkspaceRoute(getProductMarketPath(tab))}
                  onFocus={() => preloadSidebarWorkspaceRoute(getProductMarketPath(tab))}
                  onClick={preserveSidebarScroll}
                  data-sidebar-nav-label
                  data-sidebar-nav-level="child"
                  data-shared-sidebar-disclosure-child={PRODUCT_MARKET_DISCLOSURE_KEY}
                  aria-current={active ? "page" : undefined}
                  className={cn("relative block rounded-md px-3 py-1.5 text-xs transition-all duration-300 hover:translate-x-0.5 hover:scale-[1.04]", active && "font-medium")}
                  style={active ? { color: activeText, backgroundColor: activeSurface, borderLeft: `2px solid ${hl}`, marginLeft: "-2px", paddingLeft: "14px" } : { color: `${ss.textColor}cc` }}
                >{label}</Link>;
              })}
              </div>
            </AnimatedCollapse>
          </div>

          <div style={{ borderBottom: `1px solid ${ss.borderColor}40`, margin: "6px 0" }} />

            {groupedConfiguredItems.map((group, groupIndex) => {
              const marketingGuide = getProductModuleCategoryMarketingGuide(group.key);
              const sharedCategoryOrder = categoryOrderIndexMap.get(group.key) ?? groupIndex + 1;
              const sharedCategoryLabel = group.key === "uncategorized"
                ? group.label
                : buildProductMarketCategoryLabelWithOrder(sharedCategoryOrder, group.label);
              return (
            <div key={group.key} data-source-nav-category-empty={group.items.length === 0 ? "true" : "false"}>
              {isEffectivelyExpanded ? (
                <div
                  data-source-nav-category-heading
                  data-shared-product-market-category-contract={PRODUCT_MARKET_SHARED_CATEGORY_CONTRACT.version}
                  data-shared-product-market-category-source="sidebar"
                  data-shared-product-market-category-key={group.key}
                  data-shared-product-market-category-order={String(sharedCategoryOrder).padStart(2, "0")}
                  data-shared-product-market-category-label={sharedCategoryLabel}
                  data-shared-ownership-key={buildSharedCategoryOwnershipKey(group.key)}
                  data-shared-category-key={group.key}
                  data-shared-ownership-source="sidebar"
                  data-shared-ownership-category-target
                  className="mb-0.5 flex items-center gap-1 px-2 text-[10px] tracking-wide"
                >
                  <TooltipProvider delayDuration={160}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                  <span data-source-nav-category-label data-source-nav-category-marketing-guide={marketingGuide ? group.key : undefined} tabIndex={marketingGuide ? 0 : undefined} className={`flex min-w-0 items-center gap-1 truncate${marketingGuide ? " cursor-help" : ""}`}>
                  <ProductMarketCategoryIdentityIcon
                    categoryKey={group.key}
                    categoryLabel={group.label}
                    categoryOrder={runtimeCustomerServiceConfig.moduleCategoryOrder || moduleCategoryOrder}
                    avatarPreviews={categoryExpertAvatarPreviews}
                    avatarOverrides={runtimeAvatarOverrides}
                    visible={moduleIconVisibility.category}
                    interactive
                    onActivate={setSelectedCategoryExpertId}
                    displaySize="sidebar-20"
                    className="transition-transform hover:scale-110 focus:outline-none focus:ring-1"
                  />
                  {sharedCategoryLabel}
                  </span>
                      </TooltipTrigger>
                      {marketingGuide ? <TooltipContent side="right" sideOffset={12} collisionPadding={16} align="start" className="!z-[2147483647] max-w-[min(22rem,calc(100vw-2rem))] border px-3 py-2 text-xs leading-5" style={{ backgroundColor: ss.bgFrom, color: ss.textColor, borderColor: ss.borderColor, pointerEvents: "none" }}><strong className="block text-sm">{marketingGuide.headline}</strong><span className="mt-1 block">痛点：{marketingGuide.pain}</span><span className="block">价值：{marketingGuide.value}</span><span className="block">行动：{marketingGuide.action}</span></TooltipContent> : null}
                    </Tooltip>
                  </TooltipProvider>
                  <span data-source-nav-category-divider className="h-px flex-1 border-t" />
                </div>
              ) : null}
              {group.items.map((item) => {
                const defaultPrimaryIconName = getDefaultProductModuleSecondaryIconName(item.path, item.label);
                const Icon = ICON_OPTIONS.find((option) => option.name === (item.product?.customStyle?.iconName || defaultPrimaryIconName))?.icon || item.icon;
              const hasChildren = !!item.children?.length;
                const isOpen = isDisclosureOpen(item.path);
                const isDisabled = !!item.disabled;
                const isPlanned = item.product?.deliveryStatus === "planned";
                const productStyle = item.product?.customStyle || {};
                const navItemLabel = buildProductMarketNavLabel(item.label);
                const navItemTitle = getProductNavCategoryTitle(
                  item.product?.path ?? item.path,
                  navItemLabel,
                  moduleCategoryAssignments,
                  categoryOrderIndexMap
                );
                const moduleDescription = item.product?.description?.trim() || undefined;
                const moduleDescriptionTitle = getProductNavDescriptionTitle(moduleDescription);
                const primaryNavTitle = moduleDescriptionTitle || navItemTitle;

                return (
                  <div key={item.path}>
                    {isDisabled ? (
                      <div
                        data-sidebar-nav-label
                        data-sidebar-nav-level="top"
                        data-shared-ownership-key={buildSharedModuleOwnershipKey(item.product?.path ?? item.path)}
                        data-shared-category-key={group.key}
                        data-shared-ownership-source="sidebar"
                        data-product-market-module-description={moduleDescription}
                        data-product-market-module-description-source={moduleDescription ? "modules" : undefined}
                        data-sidebar-delivery-status={isPlanned ? "planned" : undefined}
                        aria-disabled="true"
                        className={cn("cursor-not-allowed rounded-md px-3 py-2 text-sm", isPlanned ? "opacity-65" : "opacity-40", !isEffectivelyExpanded ? "flex justify-center px-0" : "flex items-center justify-between")}
                        title={isPlanned
                          ? `${primaryNavTitle}；平台蓝图规划中，暂未上线`
                          : moduleDescriptionTitle
                            ? `${moduleDescriptionTitle}；该功能未开通，请到产品市场开通`
                            : "该功能未开通，请到产品市场开通"}
                        style={{ color: ss.textColor }}
                      >
                        <div className={cn("flex items-center gap-2", !isEffectivelyExpanded && "justify-center")}>
                          {moduleIconVisibility.primary && productStyle.customIconUrl ? (
                            <img src={productStyle.customIconUrl} alt="" className="h-4 w-4 shrink-0 rounded object-contain" />
                          ) : moduleIconVisibility.primary ? (
                            Icon && <Icon className="h-4 w-4 shrink-0" />
                          ) : null}
                          <FadeText show={isEffectivelyExpanded}>
                            {navItemLabel}
                            {isPlanned ? (
                              <span data-sidebar-planned-badge className="ml-1 rounded border border-current/40 px-1 py-0.5 text-[9px] leading-none">
                                规划
                              </span>
                            ) : null}
                          </FadeText>
                        </div>
                        {hasChildren && (
                          <FadeText show={isEffectivelyExpanded}>
                            <ChevronDown className="h-3.5 w-3.5" />
                          </FadeText>
                        )}
                      </div>
                    ) : (
                      <>
                        <NavLink
                          to={withClientRoutePrefixAndSite(item.path, clientRoutePrefix, currentSiteId)}
                          end={item.path === "/"}
                          data-sidebar-nav-label
                          data-sidebar-nav-level="top"
                          data-shared-ownership-key={buildSharedModuleOwnershipKey(item.product?.path ?? item.path)}
                          data-shared-category-key={group.key}
                          data-shared-ownership-source="sidebar"
                          data-product-market-module-description={moduleDescription}
                          data-product-market-module-description-source={moduleDescription ? "modules" : undefined}
                          data-sidebar-primary-project={!hasChildren ? "true" : undefined}
                          data-shared-sidebar-disclosure={hasChildren ? item.path : undefined}
                          data-shared-sidebar-route-active={hasChildren ? (isParentActive(item) ? "true" : "false") : undefined}
                          aria-expanded={hasChildren ? isOpen : undefined}
                          onPointerEnter={hasChildren ? undefined : () => preloadSidebarWorkspaceRoute(item.path)}
                          onPointerDown={hasChildren ? undefined : () => preloadSidebarWorkspaceRoute(item.path)}
                          onFocus={hasChildren ? undefined : () => preloadSidebarWorkspaceRoute(item.path)}
                          onClick={(event) => {
                            preserveSidebarScroll();
                            if (hasChildren) {
                              event.preventDefault();
                              toggleDisclosure(item.path);
                            }
                          }}
                          className={({ isActive }) => {
                            const parentActive = hasChildren && isParentActive(item);
                            return cn(
                              "group flex items-center justify-between rounded-md px-3 py-2 text-sm transition-all duration-300 hover:translate-x-0.5 hover:scale-[1.03]",
                              !isEffectivelyExpanded && "justify-center px-0",
                              (isActive && !hasChildren) || parentActive ? "border-l-2 font-medium" : ""
                            );
                          }}
                          style={({ isActive }) => {
                            const parentActive = hasChildren && isParentActive(item);
                            if ((isActive && !hasChildren) || parentActive) {
                              return {
                                background: activeSurface,
                                color: activeText,
                                borderColor: hl,
                                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                              };
                            }
                            return { color: `${ss.textColor}e6`, transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" };
                          }}
                          title={isDisabled ? "该功能未开通，请到产品市场开通" : primaryNavTitle}
                        >
                          <div className={cn("flex items-center gap-2", !isEffectivelyExpanded && "justify-center")}>
                            {moduleIconVisibility.primary && productStyle.customIconUrl ? (
                              <img src={productStyle.customIconUrl} alt="" className="h-4 w-4 shrink-0 rounded object-contain" />
                            ) : moduleIconVisibility.primary ? (
                              Icon && <Icon className="h-4 w-4 shrink-0" />
                            ) : null}
                            <FadeText show={isEffectivelyExpanded}>{navItemLabel}</FadeText>
                          </div>
                          <FadeText show={isEffectivelyExpanded && hasChildren}>
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", isOpen && "rotate-180")} />
                          </FadeText>
                        </NavLink>
                        {hasChildren && (
                          <AnimatedCollapse open={!!isOpen && isEffectivelyExpanded}>
                            <div className="ml-7 mt-0.5 space-y-0.5 pl-2" style={{ borderLeft: `2px solid ${ss.borderColor}30` }}>
                                {item.children!
                              .filter((child) => !isDevelopmentStandardOnlyPath(child.path) && child.status !== "hidden" && getChildStatus(item.path, child.path) !== "hidden")
                              .map((child) => {
                                const childLabel = buildProductMarketNavLabel(child.label);
                                const childCustomIconUrl = child.customStyle?.customIconUrl;
                                const childIconName = child.customStyle?.iconName || getDefaultProductModuleSecondaryIconName(child.path, child.customLabel || child.label);
                                const ChildIcon = ICON_OPTIONS.find((option) => option.name === childIconName)?.icon;
                                const childTitle = getProductNavCategoryTitle(
                                  child.path,
                                  child.label,
                                  moduleCategoryAssignments,
                                  categoryOrderIndexMap
                                );
                                const childActive = isClientPathActive(child.path, location.pathname, location.search, clientRoutePrefix);
                                return (
                                  <NavLink
                                    key={child.path}
                                    to={withClientRoutePrefixAndSite(child.path, clientRoutePrefix, currentSiteId)}
                                    onPointerEnter={() => preloadSidebarWorkspaceRoute(child.path)}
                                    onPointerDown={() => preloadSidebarWorkspaceRoute(child.path)}
                                    onFocus={() => preloadSidebarWorkspaceRoute(child.path)}
                                    onClick={preserveSidebarScroll}
                                    data-sidebar-nav-label
                                    data-sidebar-nav-level="child"
                                    data-shared-ownership-key={buildSharedModuleOwnershipKey(child.path)}
                                    data-shared-category-key={group.key}
                                    data-shared-ownership-source="sidebar"
                                    data-shared-sidebar-disclosure-child={item.path}
                                    className={cn("relative block rounded-md px-3 py-1.5 text-xs transition-all duration-300 hover:translate-x-0.5 hover:scale-[1.04]", childActive ? "font-medium" : "")}
                                    style={
                                      childActive
                                        ? {
                                            color: activeText,
                                            backgroundColor: activeSurface,
                                            borderLeft: `2px solid ${hl}`,
                                            marginLeft: "-2px",
                                            paddingLeft: "14px",
                                          }
                                        : { color: `${ss.textColor}b3` }
                                    }
                                    title={childTitle}
                                  >
                                    <span className="inline-flex items-center gap-1.5">
                                      {moduleIconVisibility.secondary && childCustomIconUrl ? (
                                        <img src={childCustomIconUrl} alt="" className="h-3 w-3 shrink-0 rounded object-contain" />
                                      ) : moduleIconVisibility.secondary && ChildIcon ? (
                                        <ChildIcon className="h-3 w-3 shrink-0" />
                                      ) : null}
                                      {childLabel}
                                    </span>
                                  </NavLink>
                                );
                              })}
                            </div>
                          </AnimatedCollapse>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
              );
            })}
        </nav>

        <div data-platform-sidebar-tailbar className="flex items-center gap-1.5 pb-2 pl-[21px] pr-1.5 pt-2" style={{ borderTop: `1px solid ${ss.borderColor}50` }}>
          <button
            data-sidebar-collapse-control
            onClick={() => {
              setCollapsed((prev) => !prev);
              setHoverExpanded(false);
            }}
            className={cn(
              "flex h-9 w-full shrink-0 items-center justify-start gap-2 rounded-md px-3 text-sm font-medium transition-all duration-200 hover:bg-white/10",
              !isEffectivelyExpanded && "justify-center px-0"
            )}
            style={{ color: `${ss.textColor}cc` }}
            title={collapsed ? "展开左栏" : "收起左栏"}
            aria-label={collapsed ? "展开左栏" : "收起左栏"}
          >
            {collapsed && !hoverExpanded ? (
              <PanelLeftOpen className="h-4 w-4 shrink-0" />
            ) : (
              <PanelLeftClose className="h-4 w-4 shrink-0" />
            )}
            {isEffectivelyExpanded ? <span>收起左栏</span> : null}
          </button>
        </div>
      </aside>

      <Dialog open={Boolean(selectedCategoryExpert)} onOpenChange={(open) => !open && setSelectedCategoryExpertId(null)}>
        <DraggableDialogContent
          ref={setExpertDialogElement}
          data-sidebar-category-expert-dialog
          data-shared-sidebar-expert-dialog="true"
          data-shared-expert-popup-responsive="true"
          showCloseButton={false}
          resizable
          responsiveExpertProfile
          minWidth={360}
          minHeight={280}
          data-shared-dialog-contract="expert-profile"
          data-shared-window-kind="profile"
          className="shared-sidebar-expert-dialog tradepro-dialog-surface max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] grid-rows-[minmax(0,1fr)_auto] gap-0 overflow-hidden border p-0"
          style={{
            "--tradepro-expert-popup-avatar-size": expertDialogScale.avatar,
            "--tradepro-expert-popup-copy-size": expertDialogScale.copy,
            "--tradepro-expert-popup-name-size": expertDialogScale.name,
            "--tradepro-expert-popup-gap": expertDialogScale.gap,
          } as CSSProperties}
        >
          {selectedCategoryExpert ? (
            <>
              <ContentPluginCloseButton
                data-shared-dialog-close="true"
                data-dialog-close
                data-development-standard-close
                data-shared-window-close="true"
                data-shared-window-title-action="close"
                onClick={() => setSelectedCategoryExpertId(null)}
                className="shared-sidebar-expert-close z-40 h-8 w-8 shrink-0"
                title="关闭窗口"
                aria-label="关闭窗口"
              >
                <X className="h-4 w-4" />
              </ContentPluginCloseButton>
              <div data-drag-handle className="shared-sidebar-expert-content">
                <ExpertIdentitySummary
                  variant="editor"
                  showFrameMarker
                  expertId={selectedCategoryExpert.id}
                  projection="sidebar-expert-dialog"
                  data={{
                    name: selectedCategoryExpertProfile?.assignmentLabel || selectedCategoryExpert.name,
                    customerServiceName: selectedCategoryExpertName,
                    title: selectedCategoryExpertProfile?.title || "专业",
                    gender: selectedCategoryExpertVoiceGender === "male" ? "男声" : "女声",
                    animation: getCustomerServiceAnimationLabel(selectedCategoryExpertOverride?.animationStyle),
                    reminder: selectedCategoryExpertReminder,
                    voice: selectedCategoryExpertVoice,
                    greeting: selectedCategoryExpertProfile?.greetingDisplay || "未设置",
                  }}
                  avatar={
                    <div className="shared-expert-identity-avatar-media">
                      <CustomerServiceAvatarMedia
                        sourceUrl={selectedCategoryExpertAvatarSource}
                        sourceKind={selectedCategoryExpertAvatarKind}
                        fallbackUrl={selectedCategoryExpert.defaultAvatarUrl}
                        alt={`${selectedCategoryExpertName}头像`}
                        fallback={<Users className="h-16 w-16" style={{ color: selectedCategoryExpert.color }} />}
                      />
                    </div>
                  }
                />
              </div>
              <footer
                data-shared-window-region="footer"
                data-dialog-resize-safe-area
                className="shared-sidebar-expert-footer"
              >
                <button
                  type="button"
                  data-sidebar-contact-expert={selectedCategoryExpert.id}
                  data-content-plugin-control="contact-expert"
                  onClick={() => {
                    openCustomerServiceExpertChat(selectedCategoryExpert.id);
                    setSelectedCategoryExpertId(null);
                  }}
                  className="shared-sidebar-contact-expert inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
                >
                  <MessageCircle className="h-4 w-4" />
                  联系专家
                </button>
              </footer>
            </>
          ) : null}
        </DraggableDialogContent>
      </Dialog>
    </>
  );
}
