import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  LayoutGrid,
  Building2,
  Users,
  Globe,
  ShoppingCart,
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
  Sparkles,
  Download,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import SoftwareVersionBadge from "./SoftwareVersionBadge";
import SidebarProjectVersionCard from "./SidebarProjectVersionCard";
import { ICON_OPTIONS, useProductMarketStore } from "@/lib/product-market-store";
import { configurePlatformNavigation } from "@/lib/configured-platform-navigation";

type Item = { to: string; label: string; icon: React.ElementType };
type Group = { label: string; items: Item[] };
type AgencyBrand = { shortName: string; logoUrl?: string; iconName?: string };
const EXPANDED_WIDTH = "15rem";
const COLLAPSED_WIDTH = "3.5rem";

const groups: Group[] = [
  {
    label: "首页",
    items: [
      { to: "/dl", label: "仪表盘", icon: LayoutDashboard },
      { to: "/dl/workspace", label: "工作台", icon: LayoutGrid },
    ],
  },
  {
    label: "共业市场",
    items: [
      { to: "/dl/product-market?tab=operations", label: "运营市场", icon: Package },
      { to: "/dl/product-market?tab=modules", label: "栏目配置", icon: LayoutGrid },
      { to: "/dl/product-market?tab=layout", label: "版面风格", icon: Palette },
      { to: "/dl/product-market?tab=service", label: "客服音效", icon: Sparkles },
    ],
  },
  {
    label: "业务",
    items: [
      { to: "/dl/enterprises", label: "外贸企业管理", icon: Building2 },
      { to: "/dl/customers", label: "客户管理", icon: Users },
      { to: "/dl/sites", label: "站点管理", icon: Globe },
      { to: "/dl/orders", label: "订单管理", icon: ShoppingCart },
      { to: "/dl/reports", label: "客户报备", icon: BookmarkCheck },
      { to: "/dl/public-pool", label: "公海池", icon: Waves },
      { to: "/dl/business-data", label: "业务数据", icon: BarChart3 },
      { to: "/dl/social-content-reviews", label: "社交内容初审", icon: ShieldCheck },
      { to: "/dl/seo-tasks", label: "SEO 任务与工具", icon: Target },
      { to: "/dl/seo-blogs", label: "SEO 博客", icon: FileText },
    ],
  },
  {
    label: "团队",
    items: [
      { to: "/dl/members", label: "成员管理", icon: UserCog },
      { to: "/dl/roles", label: "角色管理", icon: ShieldCheck },
      { to: "/dl/quotas", label: "配额管理", icon: Gauge },
      { to: "/dl/performance", label: "绩效统计", icon: Trophy },
    ],
  },
  {
    label: "管理",
    items: [
      { to: "/dl/plans", label: "客户计划", icon: Package },
      { to: "/dl/wallet", label: "钱包管理", icon: Wallet },
      { to: "/dl/invite-links", label: "注册链接", icon: Link2 },
      { to: "/dl/oem-settings", label: "OEM 设置", icon: Palette },
      { to: "/dl/version", label: "版本更新", icon: Download },
    ],
  },
];

export default function AgencySidebar({ brand }: { brand?: AgencyBrand | null }) {
  const location = useLocation();
  const products = useProductMarketStore((state) => state.products);
  const productOrder = useProductMarketStore((state) => state.productOrder);
  const BrandIcon = ICON_OPTIONS.find((option) => option.name === brand?.iconName)?.icon || Sparkles;
  const configuredGroups = useMemo(
    () => groups
      .map((group) => ({ ...group, items: configurePlatformNavigation(group.items, "/dl", products, productOrder) }))
      .filter((group) => group.items.length > 0),
    [products, productOrder]
  );
  const brandName = brand?.shortName || "TradeAgency";
  const agencyCode = new URLSearchParams(location.search).get("agency")?.trim();
  const [collapsed, setCollapsed] = useState(false);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  // Keep the shared-market branch closed until the operator asks for its
  // secondary pages; other agency navigation groups remain unchanged.
  const [sharedMarketExpanded, setSharedMarketExpanded] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    document.documentElement.style.setProperty("--app-sidebar-visible-width", collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH);
  }, [collapsed]);
  const isEffectivelyExpanded = !collapsed || hoverExpanded;
  const toggleCollapsed = () => {
    setCollapsed((current) => !current);
    setHoverExpanded(false);
  };
  const handleMouseEnter = () => {
    if (!collapsed) return;
    clearTimeout(hoverTimeout.current);
    setHoverExpanded(true);
  };
  const handleMouseLeave = () => {
    if (!collapsed) return;
    hoverTimeout.current = setTimeout(() => setHoverExpanded(false), 300);
  };
  const withAgencyContext = (to: string) => {
    if (!agencyCode) return to;
    const [pathname, rawSearch = ""] = to.split("?");
    const params = new URLSearchParams(rawSearch);
    params.set("agency", agencyCode);
    return `${pathname}?${params.toString()}`;
  };
  return (
    <>
      {collapsed ? <div style={{ width: COLLAPSED_WIDTH, minWidth: COLLAPSED_WIDTH, flexShrink: 0 }} /> : null}
    <aside
      className="flex h-screen shrink-0 flex-col overflow-hidden bg-slate-900 text-slate-300 transition-[width] duration-200"
      style={{
        width: isEffectivelyExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
        minWidth: isEffectivelyExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
        ...(collapsed
          ? { position: "absolute" as const, left: 0, top: 0, zIndex: 50, height: "100vh", boxShadow: hoverExpanded ? "4px 0 24px rgba(0,0,0,0.3)" : undefined }
          : { position: "relative" as const }),
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div data-platform-sidebar-header className="flex h-[62px] shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
            {brand?.logoUrl ? <img src={brand.logoUrl} alt="" className="h-full w-full object-contain bg-white p-0.5" /> : <BrandIcon className="h-5 w-5 text-white" />}
          </div>
          {isEffectivelyExpanded ? <div>
            <div className="flex items-center gap-1.5">
              <div className="max-w-[7.5rem] truncate text-sm font-bold text-white" title={brandName}>{brandName}</div>
            </div>
            <div className="text-[10px] text-slate-400">代理端管理平台</div>
          </div> : null}
        </div>
        {isEffectivelyExpanded ? <SoftwareVersionBadge tone="dark" /> : null}
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {configuredGroups.map((group) => {
          const isSharedMarket = group.label === "共业市场";
          const showGroupItems = !isSharedMarket || sharedMarketExpanded;
          return (
          <div key={group.label} className="mb-2">
            {isSharedMarket && isEffectivelyExpanded ? (
              <button
                type="button"
                onClick={() => setSharedMarketExpanded((current) => !current)}
                aria-expanded={sharedMarketExpanded}
                className="flex w-full items-center justify-between px-4 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-300"
              >
                <span>{group.label}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${sharedMarketExpanded ? "rotate-180" : ""}`} />
              </button>
            ) : isEffectivelyExpanded ? <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{group.label}</div> : null}
            {showGroupItems ? group.items.map((item) => {
              const Icon = item.icon;
              if (item.status === "inactive") {
                return (
                  <div key={item.to} title="该功能未开通，请联系总部在代理源开发工具 → 运营市场开通" className={`flex cursor-not-allowed items-center gap-2.5 py-2 text-sm text-slate-400 opacity-40 ${!isEffectivelyExpanded ? "justify-center px-0" : "px-4"}`}>
                    <Icon className="h-4 w-4 shrink-0" />
                    {isEffectivelyExpanded ? item.label : null}
                  </div>
                );
              }
              return (
                <NavLink
                  key={item.to}
                  to={withAgencyContext(item.to)}
                  end={item.to === "/dl"}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 py-2 text-sm transition-colors ${!isEffectivelyExpanded ? "justify-center px-0" : "px-4"} ${
                      isActive
                        ? "border-l-2 border-violet-500 bg-gradient-to-r from-violet-600/20 to-fuchsia-600/10 text-white"
                        : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {isEffectivelyExpanded ? item.label : null}
                </NavLink>
              );
            }) : null}
          </div>
        );
        })}
      </nav>

      <div data-platform-sidebar-tailbar className="flex shrink-0 items-center gap-1.5 border-t border-slate-800 px-1.5 py-2">
        <button
          type="button"
          data-sidebar-collapse-control
          onClick={toggleCollapsed}
          title={collapsed ? "展开左栏" : "收起左栏"}
          aria-label={collapsed ? "展开左栏" : "收起左栏"}
          className={`flex h-9 w-full shrink-0 items-center justify-start gap-2.5 rounded-md px-4 text-sm font-medium text-slate-300 transition-all duration-200 hover:bg-white/10 ${!isEffectivelyExpanded ? "justify-center px-0" : ""}`}
        >
          {collapsed && !hoverExpanded ? <PanelLeftOpen className="h-4 w-4 shrink-0" /> : <PanelLeftClose className="h-4 w-4 shrink-0" />}
          {isEffectivelyExpanded ? <span>收起左栏</span> : null}
        </button>
      </div>
    </aside>
    </>
  );
}
