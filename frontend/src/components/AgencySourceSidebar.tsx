import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { PRODUCT_MARKET_DISCLOSURE_KEY, ROUTE_OWNED_SIDEBAR_DISCLOSURE_STRATEGY, useRouteOwnedSidebarDisclosure } from "@/hooks/use-route-owned-sidebar-disclosure";
import {
  LayoutDashboard,
  LayoutGrid,
  Building2,
  ChevronDown,
  Users,
  Globe,
  ShoppingCart,
  ShoppingBag,
  BookmarkCheck,
  Waves,
  BarChart3,
  Target,
  FileText,
  UserCog,
  ShieldCheck,
  Gauge,
  Trophy,
  Package,
  Wallet,
  Link2,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Send,
  ClipboardCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { buildSourceWorkspaceCategoryDisplayOrderMap, buildSourceWorkspaceCategoryOrderMap, formatProductModuleCategoryLabel, ICON_OPTIONS, SOURCE_WORKSPACE_GROUPS, useProductMarketStore } from "@/lib/product-market-store";
import { configurePlatformNavigation, isPlatformProductMarketItemActive } from "@/lib/configured-platform-navigation";
import {
  DeferredPlatformSettingsDropdown,
  DeferredSoftwareVersionBadge,
} from "./DeferredShellUtilities";

type Item = { to: string; label: string; icon: React.ElementType };
type Group = { label: string; categoryKey?: string; items: Item[] };
export type AgencySourceBrand = { shortName: string; companyName: string; logoUrl?: string; iconName?: string };

const productMarketItems: Item[] = [
  { to: "/zb/agency-source/product-market?tab=operations", label: "运营市场", icon: Package },
  { to: "/zb/agency-source/product-market?tab=modules", label: "栏目配置", icon: LayoutGrid },
  { to: "/zb/agency-source/product-market?tab=layout", label: "版面风格", icon: Palette },
  { to: "/zb/agency-source/product-market?tab=service", label: "客服音效", icon: Sparkles },
];

const t = {
  home: "\u9996\u9875",
  dashboard: "\u4eea\u8868\u76d8",
  workspace: "\u5de5\u4f5c\u53f0",
  business: "\u4e1a\u52a1",
  enterprise: "\u5916\u8d38\u4f01\u4e1a\u7ba1\u7406",
  customer: "\u5ba2\u6237\u7ba1\u7406",
  site: "\u7ad9\u70b9\u7ba1\u7406",
  order: "\u8ba2\u5355\u7ba1\u7406",
  report: "\u5ba2\u6237\u62a5\u5907",
  publicPool: "\u516c\u6d77\u6c60",
  businessData: "\u4e1a\u52a1\u6570\u636e",
  seoTasks: "SEO \u4efb\u52a1\u4e0e\u5de5\u5177",
  seoBlogs: "SEO \u535a\u5ba2",
  team: "\u56e2\u961f",
  members: "\u6210\u5458\u7ba1\u7406",
  roles: "\u89d2\u8272\u7ba1\u7406",
  quotas: "\u914d\u989d\u7ba1\u7406",
  performance: "\u7ee9\u6548\u7edf\u8ba1",
  management: "\u7ba1\u7406",
  plans: "\u5ba2\u6237\u8ba1\u5212",
  wallet: "\u94b1\u5305\u7ba1\u7406",
  inviteLinks: "\u6ce8\u518c\u94fe\u63a5",
  oem: "OEM \u8bbe\u7f6e",
  releaseCenter: "\u4ee3\u7406\u6e90\u53d1\u5e03",
  socialContentReviews: "\u793e\u4ea4\u5185\u5bb9\u521d\u5ba1",
  productMarket: "\u5171\u4e1a\u5e02\u573a",
  operationsMarket: "\u8fd0\u8425\u5e02\u573a",
  moduleConfiguration: "\u680f\u76ee\u914d\u7f6e",
  layoutStyle: "\u7248\u9762\u98ce\u683c",
  serviceSound: "\u5ba2\u670d\u97f3\u6548",
  partnerManagement: "\u5408\u4f19\u4eba\u7ba1\u7406",
  partnerList: "\u5408\u4f19\u4eba\u5217\u8868",
  rechargeAudit: "\u5145\u503c\u5ba1\u6838",
  subtitle: "B2B\u8d38\u6613\u5bb6\u5e73\u53f0",
  expandSidebar: "\u5c55\u5f00\u5de6\u680f",
  collapseSidebar: "\u6536\u8d77\u5de6\u680f",
};

const groups: Group[] = [
  {
    label: t.home,
    items: [
      { to: "/zb/agency-source", label: t.dashboard, icon: LayoutDashboard },
      { to: "/zb/agency-source/workspace", label: t.workspace, icon: LayoutGrid },
    ],
  },
  {
    label: t.productMarket,
    items: [
      { to: "/zb/agency-source/product-market?tab=operations", label: t.operationsMarket, icon: Package },
      { to: "/zb/agency-source/product-market?tab=modules", label: t.moduleConfiguration, icon: LayoutGrid },
      { to: "/zb/agency-source/product-market?tab=layout", label: t.layoutStyle, icon: Palette },
      { to: "/zb/agency-source/product-market?tab=service", label: t.serviceSound, icon: Sparkles },
    ],
  },
  {
    label: t.partnerManagement,
    items: [
      { to: "/zb/agency-source/partners", label: t.partnerList, icon: Building2 },
      { to: "/zb/agency-source/recharge-audit", label: t.rechargeAudit, icon: Wallet },
    ],
  },
  {
    label: t.business,
    items: [
      { to: "/zb/agency-source/enterprises", label: t.enterprise, icon: Building2 },
      { to: "/zb/agency-source/customers", label: t.customer, icon: Users },
      { to: "/zb/agency-source/sites", label: t.site, icon: Globe },
      { to: "/zb/agency-source/orders", label: t.order, icon: ShoppingCart },
      { to: "/zb/agency-source/reports", label: t.report, icon: BookmarkCheck },
      { to: "/zb/agency-source/public-pool", label: t.publicPool, icon: Waves },
      { to: "/zb/agency-source/business-data", label: t.businessData, icon: BarChart3 },
      { to: "/zb/agency-source/seo-tasks", label: t.seoTasks, icon: Target },
      { to: "/zb/agency-source/seo-blogs", label: t.seoBlogs, icon: FileText },
    ],
  },
  {
    label: t.team,
    items: [
      { to: "/zb/agency-source/members", label: t.members, icon: UserCog },
      { to: "/zb/agency-source/roles", label: t.roles, icon: ShieldCheck },
      { to: "/zb/agency-source/quotas", label: t.quotas, icon: Gauge },
      { to: "/zb/agency-source/performance", label: t.performance, icon: Trophy },
    ],
  },
  {
    label: t.management,
    items: [
      { to: "/zb/agency-source/plans", label: t.plans, icon: Package },
      { to: "/zb/agency-source/wallet", label: t.wallet, icon: Wallet },
      { to: "/zb/agency-source/invite-links", label: t.inviteLinks, icon: Link2 },
      { to: "/zb/agency-source/oem-settings", label: t.oem, icon: Palette },
      { to: "/zb/agency-source/releases", label: t.releaseCenter, icon: Send },
      { to: "/zb/agency-source/social-content-reviews", label: t.socialContentReviews, icon: ClipboardCheck },
    ],
  },
];

const AGENCY_SOURCE_GROUPS = SOURCE_WORKSPACE_GROUPS.agency_source || [];
const AGENCY_SOURCE_CATEGORY_KEY_BY_LABEL: Record<string, string> = Object.fromEntries(
  AGENCY_SOURCE_GROUPS.map((group) => [group.label, group.key]),
);
const AGENCY_SOURCE_CATEGORY_KEYS = AGENCY_SOURCE_GROUPS.map((group) => group.key);

const EXPANDED_WIDTH = "15rem";
const COLLAPSED_WIDTH = "3.5rem";

export default function AgencySourceSidebar({ brand }: { brand?: AgencySourceBrand | null }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>();
  const products = useProductMarketStore((state) => state.products);
  const productOrder = useProductMarketStore((state) => state.productOrder);
  const moduleIconVisibility = useProductMarketStore((state) => state.moduleIconVisibility);
  const moduleCategoryStyles = useProductMarketStore((state) => state.moduleCategoryStyles);
  const moduleCategoryOrder = useProductMarketStore((state) => state.moduleCategoryOrder);
  const sidebarStyle = useProductMarketStore((state) => state.sidebarStyle);
  // Keep the source sidebar on the shared theme-token path used by Client
  // Source.  A swatch hover only overlays root tokens, so direct stored
  // colours here would otherwise delay the preview until a click commits it.
  const sidebarBackground = `linear-gradient(180deg, var(--tradepro-shell-from, ${sidebarStyle.bgFrom || "#0f172a"}), var(--tradepro-shell-via, ${sidebarStyle.bgVia || sidebarStyle.bgFrom || "#1e293b"}), var(--tradepro-shell-to, ${sidebarStyle.bgTo || sidebarStyle.bgVia || "#334155"}))`;
  const sidebarTextColor = `var(--tradepro-shell-text, ${sidebarStyle.textColor || "#e2e8f0"})`;
  const sidebarHighlight = `var(--tradepro-shell-highlight, ${sidebarStyle.activeHighlight || "#a78bfa"})`;
  const sidebarBorder = `var(--tradepro-shell-border, ${sidebarStyle.borderColor || sidebarStyle.activeHighlight || "#a78bfa"})`;
  const sidebarActiveText = `var(--tradepro-shell-active-text, ${sidebarStyle.textColor || "#e2e8f0"})`;
  const sidebarSoftBorder = `color-mix(in srgb, ${sidebarBorder} 60%, transparent)`;
  const categoryOrderIndexMap = useMemo(
    () => buildSourceWorkspaceCategoryDisplayOrderMap(moduleCategoryOrder, AGENCY_SOURCE_CATEGORY_KEYS),
    [moduleCategoryOrder]
  );
  const categoryOrderMap = useMemo(
    () => buildSourceWorkspaceCategoryOrderMap(moduleCategoryOrder, AGENCY_SOURCE_CATEGORY_KEYS),
    [moduleCategoryOrder]
  );
  const CompanyLogoIcon = ICON_OPTIONS.find((option) => option.name === brand?.iconName)?.icon || Sparkles;
  const configuredProductMarketItems = useMemo(
    () => configurePlatformNavigation(productMarketItems, "/zb/agency-source", products, productOrder),
    [products, productOrder]
  );
  const configuredGroups = useMemo(
    () => groups
      .filter((group) => !group.items.some((item) => item.to.startsWith("/zb/agency-source/product-market?")))
      .map((group) => ({
        ...group,
        categoryKey: AGENCY_SOURCE_CATEGORY_KEY_BY_LABEL[group.label],
        items: configurePlatformNavigation(group.items, "/zb/agency-source", products, productOrder),
      }))
      .filter((group) => group.items.length > 0)
      .sort((left, right) =>
        (categoryOrderMap.get(left.categoryKey) ?? Number.MAX_SAFE_INTEGER)
        - (categoryOrderMap.get(right.categoryKey) ?? Number.MAX_SAFE_INTEGER)
      ),
    [categoryOrderMap, products, productOrder]
  );
  const productMarketRouteActive = location.pathname === "/zb/agency-source/product-market";
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
      className="flex h-screen shrink-0 flex-col overflow-hidden border-r border-slate-800 bg-slate-900 text-slate-300"
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
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
            {brand?.logoUrl ? <img src={brand.logoUrl} alt={`${brand.companyName} 商标`} className="h-full w-full object-contain bg-white p-0.5" /> : <CompanyLogoIcon className="h-5 w-5 text-white" />}
          </div>
          {isEffectivelyExpanded ? (
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white" title={brand?.companyName || "Trade Plus"}>{brand?.shortName || "Trade Plus"}</div>
              <div className="text-[10px] text-slate-400">{t.subtitle}</div>
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
      </div>

      <div className="shrink-0 border-b px-1.5 py-2" style={{ borderColor: sidebarSoftBorder }}>
        <button
          type="button"
          onClick={() => toggleDisclosure(PRODUCT_MARKET_DISCLOSURE_KEY)}
          title={t.productMarket}
          aria-expanded={productMarketExpanded}
          data-shared-sidebar-disclosure={PRODUCT_MARKET_DISCLOSURE_KEY}
          data-shared-sidebar-route-active={productMarketRouteActive ? "true" : "false"}
          className={cn(
            "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
            !isEffectivelyExpanded && "justify-center px-0"
          )}
        >
          <span className="flex min-w-0 items-center gap-2.5" style={{ color: sidebarTextColor }}>
            <ShoppingBag className="h-4 w-4 shrink-0" />
            {isEffectivelyExpanded ? <span className="truncate">{t.productMarket}</span> : null}
          </span>
          {isEffectivelyExpanded ? <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", productMarketExpanded && "rotate-180")} /> : null}
        </button>
        {productMarketExpanded && isEffectivelyExpanded ? (
          <div className="ml-7 mt-0.5 space-y-0.5 border-l-2 pl-2" style={{ borderColor: sidebarSoftBorder }}>
            {configuredProductMarketItems.map((item) => {
              const Icon = moduleIconVisibility.secondary ? item.icon : () => null;
              const isCurrentMarketItem = isPlatformProductMarketItemActive(item.to, location.pathname, location.search);
              if (item.status === "inactive") {
                return <div key={item.to} title="该功能未开通，请在代理源开发工具 → 运营市场开通" className="flex cursor-not-allowed items-center gap-2 px-2 py-1.5 text-xs text-slate-500"><Icon className="h-3.5 w-3.5 shrink-0" />{item.label}</div>;
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
          <div key={group.label} data-source-nav-category-key={group.categoryKey} className="mb-2">
            {isEffectivelyExpanded ? (
              <div className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: sidebarTextColor }}>{renderCategoryIcon(group.categoryKey, group.items[0]?.icon)}<span data-source-nav-category-label>{formatProductModuleCategoryLabel(group.categoryKey ? categoryOrderIndexMap.get(group.categoryKey) : null, group.label)}</span></div>
            ) : null}
            {group.items.map((item) => {
              const Icon = item.icon;
              if (item.status === "inactive") {
                return (
                  <div
                    key={item.to}
                    title={item.description ? `${item.description}；该功能未开通，请在代理源开发工具 → 运营市场开通` : "该功能未开通，请在代理源开发工具 → 运营市场开通"}
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
                  end={item.to === "/zb/agency-source"}
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
      </nav>

      <div data-platform-sidebar-tailbar className="flex shrink-0 items-center gap-1.5 border-t border-slate-800 px-1.5 py-2">
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
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0" />
          )}
          {isEffectivelyExpanded ? <span>{t.collapseSidebar}</span> : null}
        </button>
      </div>
    </aside>
    </>
  );
}
