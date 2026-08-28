import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { PRODUCT_MARKET_DISCLOSURE_KEY, ROUTE_OWNED_SIDEBAR_DISCLOSURE_STRATEGY, useRouteOwnedSidebarDisclosure } from "@/hooks/use-route-owned-sidebar-disclosure";
import {
  Activity,
  AlertTriangle,
  Bell,
  Briefcase,
  Building2,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Coins,
  CreditCard,
  Crown,
  Cpu,
  DollarSign,
  FileEdit,
  FileText,
  FolderTree,
  Globe,
  History,
  ImageIcon,
  Layers,
  LayoutDashboard,
  Link2,
  ListChecks,
  Mail as MailIcon,
  Megaphone,
  MessageSquare,
  Network,
  Package,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Rocket,
  Send,
  Settings,
  ShieldCheck,
  ShoppingCart,
  ShoppingBag,
  SmilePlus,
  Sparkles,
  Store,
  Tag,
  Target as TargetIcon,
  Ticket,
  Undo2,
  Upload,
  Users,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { configurePlatformNavigation, isPlatformProductMarketItemActive } from "@/lib/configured-platform-navigation";
import { buildSourceWorkspaceCategoryDisplayOrderMap, buildSourceWorkspaceCategoryOrderMap, formatProductModuleCategoryLabel, ICON_OPTIONS, SOURCE_WORKSPACE_GROUPS, useProductMarketStore } from "@/lib/product-market-store";
import {
  DeferredPlatformSettingsDropdown,
  DeferredSidebarProjectVersionCard,
  DeferredSoftwareVersionBadge,
} from "./DeferredShellUtilities";

type Item = { to: string; label: string; icon: React.ElementType };
type Group = { label: string; categoryKey?: string; items: Item[] };

const productMarketItems: Item[] = [
  { to: "/zb/product-market?tab=operations", label: "运营市场", icon: Package },
  { to: "/zb/product-market?tab=modules", label: "栏目配置", icon: ListChecks },
  { to: "/zb/product-market?tab=layout", label: "版面风格", icon: Palette },
  { to: "/zb/product-market?tab=service", label: "客服音效", icon: Bell },
];

const t = {
  overview: "\u6982\u89c8",
  dashboard: "\u4eea\u8868\u76d8",
  account: "\u8d26\u53f7\u7ba1\u7406",
  members: "\u5e73\u53f0\u6210\u5458\u5217\u8868",
  roles: "\u89d2\u8272\u7ba1\u7406",
  departments: "\u90e8\u95e8\u7ba1\u7406",
  agencies: "\u4ee3\u7406\u5546\u7ba1\u7406",
  agencyList: "\u4ee3\u7406\u5546\u5217\u8868",
  agencyRelease: "\u4ee3\u7406\u6e90\u53d1\u5e03",
  rechargeAudit: "\u5145\u503c\u5ba1\u6838",
  oemAudit: "OEM \u5ba1\u6838",
  enterprise: "\u5916\u8d38\u4f01\u4e1a",
  enterpriseList: "\u4f01\u4e1a\u5217\u8868",
  sites: "\u7ad9\u70b9\u7ba1\u7406",
  siteList: "\u7ad9\u70b9\u5217\u8868",
  domains: "\u57df\u540d\u7ba1\u7406",
  assets: "\u7d20\u6750\u7ba1\u7406",
  templates: "\u6a21\u677f\u5e93",
  gallery: "\u56fe\u5e93",
  aiService: "AI \u670d\u52a1",
  aiCenter: "\u6a21\u578b\u4e2d\u5fc3",
  aiAssign: "\u6a21\u578b\u5206\u914d",
  aiLogs: "\u8c03\u7528\u65e5\u5fd7",
  aiCost: "\u6210\u672c\u770b\u677f",
  aiMarket: "\u6a21\u578b\u5e02\u573a",
  finance: "\u8d44\u91d1\u7ba1\u7406",
  wallet: "\u94b1\u5305\u7ba1\u7406",
  plansAndPoints: "\u5957\u9910\u4e0e\u79ef\u5206",
  plans: "\u4f01\u4e1a\u8ba1\u5212",
  boosters: "\u52a0\u6cb9\u5305\u7ba1\u7406",
  coupons: "\u5151\u6362\u7801\u7ba1\u7406",
  points: "\u79ef\u5206\u914d\u7f6e",
  orders: "\u8ba2\u5355\u7ba1\u7406",
  orderList: "\u8ba2\u5355\u5217\u8868",
  orderAudit: "\u8ba2\u5355\u5ba1\u6838",
  autoRenew: "\u81ea\u52a8\u7eed\u8d39",
  refunds: "\u9000\u6b3e\u7ba1\u7406",
  invoices: "\u53d1\u7968\u7ba1\u7406",
  operations: "\u8fd0\u8425\u63a8\u5e7f",
  announcements: "\u516c\u544a\u7ba1\u7406",
  promotions: "\u4fc3\u9500\u6d3b\u52a8",
  groups: "\u5206\u7ec4\u7ba1\u7406",
  csat: "\u5ba2\u6237\u6ee1\u610f\u5ea6",
  qaPlans: "\u95ee\u7b54\u8ba1\u5212",
  qaTasks: "\u95ee\u7b54\u4efb\u52a1",
  inquiryAuto: "\u8be2\u76d8\u81ea\u52a8\u5316",
  seoTasks: "SEO \u4efb\u52a1",
  seoBlogs: "SEO \u5f15\u6d41\u535a\u5ba2",
  notices: "\u901a\u77e5\u7ba1\u7406",
  noticeConfig: "\u901a\u77e5\u914d\u7f6e",
  emailConfig: "\u90ae\u4ef6\u914d\u7f6e",
  expiry: "\u5230\u671f\u63d0\u9192",
  platform: "\u5e73\u53f0\u8bbe\u7f6e",
  developerTools: "\u603b\u90e8\u7aef\u5f00\u53d1\u5de5\u5177",
  productMarket: "\u4ea7\u54c1\u5e02\u573a",
  operationsMarket: "\u8fd0\u8425\u5e02\u573a",
  moduleConfiguration: "\u680f\u76ee\u914d\u7f6e",
  layoutStyle: "\u7248\u9762\u98ce\u683c",
  serviceSound: "\u5ba2\u670d\u97f3\u6548",
  clientSettings: "\u5ba2\u6237\u7aef\u8bbe\u7f6e",
  materialAssets: "\u7d20\u6750\u8d44\u6e90",
  architecture: "\u5e73\u53f0\u67b6\u6784",
  platformConfig: "\u5e73\u53f0\u914d\u7f6e",
  socialAuthorization: "\u793e\u4ea4\u6388\u6743",
  socialContentReviews: "\u793e\u4ea4\u5ba1\u6838",
  socialPublishDelivery: "\u53d1\u5e03\u90e8\u7f72",
  payments: "\u652f\u4ed8\u6e20\u9053",
  alerts: "\u544a\u8b66\u89c4\u5219",
  templateSource: "\u6a21\u677f\u6e90",
  agencySource: "\u4ee3\u7406\u6e90",
  clientSource: "\u5ba2\u6237\u6e90",
  audit: "\u5ba1\u8ba1",
  auditLogs: "\u64cd\u4f5c\u65e5\u5fd7",
  tenantGovernance: "\u79df\u6237\u6cbb\u7406",
  openEditor: "源码与部署中心",
  sidebarTitle: "\u603b\u90e8\u7ba1\u7406\u540e\u53f0",
  expandSidebar: "\u5c55\u5f00\u5de6\u680f",
  collapseSidebar: "\u6536\u8d77\u5de6\u680f",
};

const groups: Group[] = [
  {
    label: t.overview,
    items: [{ to: "/zb", label: t.dashboard, icon: LayoutDashboard }],
  },
  {
    label: t.account,
    items: [
      { to: "/zb/members", label: t.members, icon: Users },
      { to: "/zb/roles", label: t.roles, icon: ShieldCheck },
      { to: "/zb/depts", label: t.departments, icon: Network },
    ],
  },
  {
    label: t.agencies,
    items: [
      { to: "/zb/agencies", label: t.agencyList, icon: Briefcase },
      { to: "/zb/agency-source/releases", label: t.agencyRelease, icon: Send },
      { to: "/zb/recharge-audit", label: t.rechargeAudit, icon: Upload },
      { to: "/zb/oem-audit", label: t.oemAudit, icon: Palette },
    ],
  },
  {
    label: t.enterprise,
    items: [{ to: "/zb/enterprises", label: t.enterpriseList, icon: Building2 }],
  },
  {
    label: t.sites,
    items: [
      { to: "/zb/sites", label: t.siteList, icon: Globe },
      { to: "/zb/domains", label: t.domains, icon: Link2 },
    ],
  },
  {
    label: t.assets,
    items: [
      { to: "/zb/templates", label: t.templates, icon: Layers },
      { to: "/zb/gallery", label: t.gallery, icon: ImageIcon },
    ],
  },
  {
    label: t.aiService,
    items: [
      { to: "/zb/ai-vendors", label: t.aiCenter, icon: Sparkles },
      { to: "/zb/ai-models", label: t.aiAssign, icon: Cpu },
      { to: "/zb/ai-logs", label: t.aiLogs, icon: Activity },
      { to: "/zb/ai-cost", label: t.aiCost, icon: DollarSign },
      { to: "/zb/ai-square", label: t.aiMarket, icon: Store },
    ],
  },
  {
    label: t.finance,
    items: [{ to: "/zb/wallet", label: t.wallet, icon: Wallet }],
  },
  {
    label: t.plansAndPoints,
    items: [
      { to: "/zb/plans", label: t.plans, icon: Package },
      { to: "/zb/boosters", label: t.boosters, icon: Rocket },
      { to: "/zb/coupons", label: t.coupons, icon: Ticket },
      { to: "/zb/points", label: t.points, icon: Coins },
    ],
  },
  {
    label: t.orders,
    items: [
      { to: "/zb/orders", label: t.orderList, icon: ShoppingCart },
      { to: "/zb/order-audit", label: t.orderAudit, icon: ClipboardCheck },
      { to: "/zb/auto-renew", label: t.autoRenew, icon: RefreshCw },
      { to: "/zb/refunds", label: t.refunds, icon: Undo2 },
      { to: "/zb/invoices", label: t.invoices, icon: FileText },
    ],
  },
  {
    label: t.operations,
    items: [
      { to: "/zb/announcements", label: t.announcements, icon: Megaphone },
      { to: "/zb/promotions", label: t.promotions, icon: Tag },
      { to: "/zb/groups", label: t.groups, icon: FolderTree },
      { to: "/zb/csat", label: t.csat, icon: SmilePlus },
      { to: "/zb/qa-plans", label: t.qaPlans, icon: MessageSquare },
      { to: "/zb/qa-tasks", label: t.qaTasks, icon: ListChecks },
      { to: "/zb/inquiry-auto", label: t.inquiryAuto, icon: MailIcon },
    ],
  },
  {
    label: t.seoTasks,
    items: [
      { to: "/zb/tdk-rules", label: "TDK " + t.platformConfig.replace("\u5e73\u53f0", "\u89c4\u5219"), icon: TargetIcon },
      { to: "/zb/seo-blogs", label: t.seoBlogs, icon: FileEdit },
    ],
  },
  {
    label: t.notices,
    items: [
      { to: "/zb/notify-config", label: t.noticeConfig, icon: Bell },
      { to: "/zb/email-config", label: t.emailConfig, icon: Send },
      { to: "/zb/expiring", label: t.expiry, icon: Clock },
    ],
  },
  {
    label: t.platform,
    items: [
      { to: "/zb/kh-style-settings", label: t.clientSettings, icon: Globe },
      { to: "/zb/material-assets", label: t.materialAssets, icon: FolderTree },
      { to: "/zb/platform-architecture", label: t.architecture, icon: Network },
      { to: "/zb/platform-config", label: t.platformConfig, icon: Settings },
      { to: "/zb/social-authorization", label: t.socialAuthorization, icon: ShieldCheck },
      { to: "/zb/social-content-reviews", label: t.socialContentReviews, icon: ClipboardCheck },
      { to: "/zb/social-publish-delivery", label: t.socialPublishDelivery, icon: Send },
      { to: "/zb/payment-channels", label: t.payments, icon: CreditCard },
      { to: "/zb/alerts", label: t.alerts, icon: AlertTriangle },
    ],
  },
  {
    label: `${t.developerTools} · ${t.productMarket}`,
    items: [
      { to: "/zb/product-market?tab=operations", label: t.operationsMarket, icon: Package },
      { to: "/zb/product-market?tab=modules", label: t.moduleConfiguration, icon: ListChecks },
      { to: "/zb/product-market?tab=layout", label: t.layoutStyle, icon: Palette },
      { to: "/zb/product-market?tab=service", label: t.serviceSound, icon: Bell },
    ],
  },
  {
    label: t.templateSource,
    items: [
      { to: "/zb/agency-source", label: t.agencySource, icon: Sparkles },
      { to: "/zb/client-source", label: t.clientSource, icon: Globe },
    ],
  },
  {
    label: t.audit,
    items: [
      { to: "/zb/audit-logs", label: t.auditLogs, icon: History },
      { to: "/zb/tenant-governance", label: t.tenantGovernance, icon: ShieldCheck },
    ],
  },
];

const HQ_SOURCE_GROUPS = SOURCE_WORKSPACE_GROUPS.hq || [];
const HQ_CATEGORY_KEY_BY_LABEL: Record<string, string> = Object.fromEntries(
  HQ_SOURCE_GROUPS.map((group) => [group.label, group.key]),
);
const HQ_SOURCE_CATEGORY_KEYS = HQ_SOURCE_GROUPS.map((group) => group.key);

const EXPANDED_WIDTH = "15rem";
const COLLAPSED_WIDTH = "3.5rem";

export default function HQSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>();
  const productMarketLabel = "事业市场";
  const products = useProductMarketStore((state) => state.products);
  const productOrder = useProductMarketStore((state) => state.productOrder);
  const moduleIconVisibility = useProductMarketStore((state) => state.moduleIconVisibility);
  const moduleCategoryStyles = useProductMarketStore((state) => state.moduleCategoryStyles);
  const moduleCategoryOrder = useProductMarketStore((state) => state.moduleCategoryOrder);
  const sidebarStyle = useProductMarketStore((state) => state.sidebarStyle);
  // Hovering a theme swatch previews the same root tokens used by Client
  // Source.  Keep HQ's inline shell styles token-backed too, otherwise its
  // sidebar waits for a committed store update and appears not to preview.
  const sidebarBackground = `linear-gradient(180deg, var(--tradepro-shell-from, ${sidebarStyle.bgFrom || "#022c22"}), var(--tradepro-shell-via, ${sidebarStyle.bgVia || sidebarStyle.bgFrom || "#064e3b"}), var(--tradepro-shell-to, ${sidebarStyle.bgTo || sidebarStyle.bgVia || "#065f46"}))`;
  const sidebarTextColor = `var(--tradepro-shell-text, ${sidebarStyle.textColor || "#ecfdf5"})`;
  const sidebarHighlight = `var(--tradepro-shell-highlight, ${sidebarStyle.activeHighlight || "#34d399"})`;
  const sidebarBorder = `var(--tradepro-shell-border, ${sidebarStyle.borderColor || sidebarStyle.activeHighlight || "#34d399"})`;
  const sidebarActiveText = `var(--tradepro-shell-active-text, ${sidebarStyle.textColor || "#ecfdf5"})`;
  const sidebarSoftBorder = `color-mix(in srgb, ${sidebarBorder} 60%, transparent)`;
  const categoryOrderIndexMap = useMemo(
    () => buildSourceWorkspaceCategoryDisplayOrderMap(moduleCategoryOrder, HQ_SOURCE_CATEGORY_KEYS),
    [moduleCategoryOrder]
  );
  const categoryOrderMap = useMemo(
    () => buildSourceWorkspaceCategoryOrderMap(moduleCategoryOrder, HQ_SOURCE_CATEGORY_KEYS),
    [moduleCategoryOrder]
  );
  const configuredProductMarketItems = useMemo(
    () => configurePlatformNavigation(productMarketItems, "/zb", products, productOrder),
    [products, productOrder]
  );
  const configuredGroups = useMemo(
    () => groups
      .filter((group) => !group.items.some((item) => item.to.startsWith("/zb/product-market?")))
      .map((group) => ({
        ...group,
        categoryKey: HQ_CATEGORY_KEY_BY_LABEL[group.label],
        items: configurePlatformNavigation(group.items, "/zb", products, productOrder),
      }))
      .filter((group) => group.items.length > 0)
      .sort((left, right) =>
        (categoryOrderMap.get(left.categoryKey) ?? Number.MAX_SAFE_INTEGER)
        - (categoryOrderMap.get(right.categoryKey) ?? Number.MAX_SAFE_INTEGER)
      ),
    [categoryOrderMap, products, productOrder]
  );
  const productMarketRouteActive = location.pathname === "/zb/product-market";
  const { isDisclosureOpen, toggleDisclosure } = useRouteOwnedSidebarDisclosure(
    productMarketRouteActive ? PRODUCT_MARKET_DISCLOSURE_KEY : null,
  );
  const productMarketExpanded = isDisclosureOpen(PRODUCT_MARKET_DISCLOSURE_KEY);
  const renderCategoryIcon = (categoryKey?: string, FallbackIcon?: React.ElementType) => {
    if (!moduleIconVisibility.category || !categoryKey) return null;
    const categoryStyle = moduleCategoryStyles[categoryKey];
    if (categoryStyle?.customIconUrl) {
      return <img data-source-nav-category-icon src={categoryStyle.customIconUrl} alt="" className="h-3 w-3 shrink-0 rounded object-contain" />;
    }
    const CategoryIcon = ICON_OPTIONS.find((option) => option.name === categoryStyle?.iconName)?.icon || FallbackIcon;
    return CategoryIcon ? <CategoryIcon data-source-nav-category-icon className="h-3 w-3 shrink-0" /> : null;
  };

  useEffect(() => {
    document.documentElement.style.setProperty("--app-sidebar-visible-width", collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH);
  }, [collapsed]);

  const isEffectivelyExpanded = !collapsed || hoverExpanded;
  const handleMouseEnter = () => {
    if (!collapsed) return;
    clearTimeout(hoverTimeout.current);
    setHoverExpanded(true);
  };
  const handleMouseLeave = () => {
    if (!collapsed) return;
    hoverTimeout.current = setTimeout(() => setHoverExpanded(false), 300);
  };

  return (
    <>
      {collapsed ? <div style={{ width: COLLAPSED_WIDTH, minWidth: COLLAPSED_WIDTH, flexShrink: 0 }} /> : null}
    <aside
      data-sidebar-shell
      data-shared-sidebar-disclosure-contract={ROUTE_OWNED_SIDEBAR_DISCLOSURE_STRATEGY}
      className="flex h-screen shrink-0 flex-col overflow-hidden border-r border-emerald-900/60 bg-emerald-950 text-emerald-100"
      style={{
        width: isEffectivelyExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
        minWidth: isEffectivelyExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
        background: sidebarBackground,
        color: sidebarTextColor,
        borderColor: sidebarBorder,
        transition: isEffectivelyExpanded
          ? "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
          : "width 0.25s cubic-bezier(0.4, 0, 0.2, 1) 0.1s, min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1) 0.1s",
        ...(collapsed
          ? { position: "absolute" as const, left: 0, top: 0, zIndex: 50, height: "100vh", boxShadow: hoverExpanded ? "4px 0 24px rgba(0,0,0,0.3)" : undefined }
          : { position: "relative" as const }),
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div data-platform-sidebar-header className="flex h-[62px] shrink-0 items-center justify-between gap-2 border-b px-3" style={{ borderColor: sidebarSoftBorder }}>
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500">
            <Crown className="h-5 w-5 text-white" />
          </div>
          {isEffectivelyExpanded ? (
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white">Trade HQ</div>
              <div className="text-[10px] text-emerald-300">{t.sidebarTitle}</div>
            </div>
          ) : null}
        </div>
        {isEffectivelyExpanded ? (
          <div className="ml-auto flex shrink-0 items-center">
            <DeferredSoftwareVersionBadge tone="dark" />
          </div>
        ) : null}
      </div>

      <div className="shrink-0 space-y-2 border-b px-2 py-2" style={{ borderColor: sidebarSoftBorder }}>
        <DeferredPlatformSettingsDropdown compact={!isEffectivelyExpanded} variant="dark" mode="source" />
        {isEffectivelyExpanded ? (
          <NavLink
            to="/zb/code-editor"
            title={t.openEditor}
            className={({ isActive }) =>
              cn(
                "flex h-11 items-center justify-center rounded-md border border-white/10 bg-white/5 px-2.5 text-[11px] font-medium transition-colors",
                isActive ? "text-white" : "text-emerald-100 hover:bg-white/10 hover:text-white"
              )
            }
          >
            <span className="truncate">{t.openEditor}</span>
          </NavLink>
        ) : null}
      </div>

      <div className="shrink-0 border-b px-1.5 py-2" style={{ borderColor: sidebarSoftBorder }}>
        <button
          type="button"
          onClick={() => toggleDisclosure(PRODUCT_MARKET_DISCLOSURE_KEY)}
          aria-expanded={productMarketExpanded}
          data-shared-sidebar-disclosure={PRODUCT_MARKET_DISCLOSURE_KEY}
          data-shared-sidebar-route-active={productMarketRouteActive ? "true" : "false"}
          title={productMarketLabel}
          className={cn(
            "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
            !isEffectivelyExpanded && "justify-center px-0"
          )}
        >
          <span className="flex min-w-0 items-center gap-2.5" style={{ color: sidebarTextColor }}>
            <ShoppingBag className="h-4 w-4 shrink-0" />
            {isEffectivelyExpanded ? <span className="truncate">{productMarketLabel}</span> : null}
          </span>
          {isEffectivelyExpanded ? <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", productMarketExpanded && "rotate-180")} /> : null}
        </button>
        {productMarketExpanded && isEffectivelyExpanded ? (
          <div className="ml-7 mt-0.5 space-y-0.5 border-l-2 pl-2" style={{ borderColor: sidebarSoftBorder }}>
            {configuredProductMarketItems.map((item) => {
              const Icon = moduleIconVisibility.secondary ? item.icon : () => null;
              const isCurrentMarketItem = isPlatformProductMarketItemActive(item.to, location.pathname, location.search);
              if (item.status === "inactive") {
                return <div key={item.to} title="该功能未开通，请在总部端开发工具 → 运营市场开通" className="flex cursor-not-allowed items-center gap-2 px-2 py-1.5 text-xs text-emerald-200/50"><Icon className="h-3.5 w-3.5 shrink-0" />{item.label}</div>;
              }
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={item.description || item.label}
                  data-source-nav-level="child"
                  data-product-market-module-description={item.description}
                  data-product-market-module-description-source={item.description ? "modules" : undefined}
                  data-shared-sidebar-disclosure-child={PRODUCT_MARKET_DISCLOSURE_KEY}
                  aria-current={isCurrentMarketItem ? "page" : undefined}
                  className="relative flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-all duration-300 hover:translate-x-0.5 hover:scale-[1.04]"
                  style={isCurrentMarketItem
                    ? {
                        backgroundColor: sidebarBorder,
                        color: sidebarActiveText,
                        borderLeft: `2px solid ${sidebarHighlight}`,
                        marginLeft: "-2px",
                        paddingLeft: "14px",
                      }
                    : { color: `color-mix(in srgb, ${sidebarTextColor} 82%, transparent)` }}
                >
                  {moduleIconVisibility.secondary
                    ? item.customIconUrl
                      ? <img data-source-nav-secondary-icon src={item.customIconUrl} alt="" className="h-3.5 w-3.5 shrink-0 rounded object-contain" />
                      : <Icon data-source-nav-secondary-icon className="h-3.5 w-3.5 shrink-0" />
                    : null}
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>

      <nav className="sidebar-scroll-surface min-h-0 flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto px-1.5 py-2">
        {configuredGroups.map((group) => (
          <div key={group.label} data-source-nav-category-key={group.categoryKey} className="mb-1.5">
            {isEffectivelyExpanded ? (
              <div className="flex items-center gap-1.5 px-4 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: sidebarTextColor }}>{renderCategoryIcon(group.categoryKey, group.items[0]?.icon)}<span data-source-nav-category-label>{formatProductModuleCategoryLabel(group.categoryKey ? categoryOrderIndexMap.get(group.categoryKey) : null, group.label)}</span></div>
            ) : null}
            {group.items.map((item) => {
              const Icon = item.icon;
              if (item.status === "inactive") {
                return (
                  <div
                    key={item.to}
                    title={item.description ? `${item.description}；该功能未开通，请在总部端开发工具 → 运营市场开通` : "该功能未开通，请在总部端开发工具 → 运营市场开通"}
                    data-sidebar-nav-level="top"
                    data-product-market-module-description={item.description}
                    data-product-market-module-description-source={item.description ? "modules" : undefined}
                    className={cn("flex cursor-not-allowed items-center py-2 text-sm opacity-40", !isEffectivelyExpanded ? "justify-center px-0" : "gap-2.5 px-4")}
                  >
                    {moduleIconVisibility.primary && item.customIconUrl ? <img data-source-nav-primary-icon src={item.customIconUrl} alt="" className="h-4 w-4 shrink-0 rounded object-contain" /> : moduleIconVisibility.primary ? <Icon data-source-nav-primary-icon className="h-4 w-4 shrink-0" /> : null}
                    {isEffectivelyExpanded ? item.label : null}
                  </div>
                );
              }
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/zb"}
                  title={item.description || item.label}
                  data-sidebar-primary-project="true"
                  data-sidebar-nav-level="top"
                  data-product-market-module-description={item.description}
                  data-product-market-module-description-source={item.description ? "modules" : undefined}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center py-2 text-sm transition-colors",
                      !isEffectivelyExpanded ? "justify-center px-0" : "gap-2.5 px-4",
                      isActive ? "border-l-2" : ""
                    )
                  }
                  style={({ isActive }) => isActive
                    ? { borderLeftColor: sidebarHighlight, backgroundColor: sidebarBorder, color: sidebarActiveText }
                    : { color: sidebarTextColor }}
                >
                  {moduleIconVisibility.primary && item.customIconUrl ? <img data-source-nav-primary-icon src={item.customIconUrl} alt="" className="h-4 w-4 shrink-0 rounded object-contain" /> : moduleIconVisibility.primary ? <Icon data-source-nav-primary-icon className="h-4 w-4 shrink-0" /> : null}
                  {isEffectivelyExpanded ? item.label : null}
                </NavLink>
              );
            })}
          </div>
        ))}
        {isEffectivelyExpanded ? (
          <div className="px-2 pb-2 pt-1">
            <DeferredSidebarProjectVersionCard variant="dark" />
          </div>
        ) : null}
      </nav>

      <div data-platform-sidebar-tailbar className="flex shrink-0 items-center gap-1.5 border-t border-emerald-800/60 px-1.5 py-2">
        <button
          type="button"
          data-sidebar-collapse-control
          onClick={() => {
            setCollapsed((value) => !value);
            setHoverExpanded(false);
          }}
          className={cn(
            "flex h-9 w-full shrink-0 items-center justify-start gap-2.5 rounded-md px-4 text-sm font-medium transition-all duration-200 hover:bg-white/10",
            !isEffectivelyExpanded && "justify-center px-0"
          )}
          title={collapsed ? t.expandSidebar : t.collapseSidebar}
          aria-label={collapsed ? t.expandSidebar : t.collapseSidebar}
        >
          {collapsed && !hoverExpanded ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" />
          ) : <PanelLeftClose className="h-4 w-4 shrink-0" />}
          {isEffectivelyExpanded ? <span>{t.collapseSidebar}</span> : null}
        </button>
      </div>
    </aside>
    </>
  );
}
