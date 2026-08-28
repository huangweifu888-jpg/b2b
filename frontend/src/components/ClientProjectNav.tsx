import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, Package, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useProductMarketStore, type ExportableConfig, ICON_OPTIONS, type ProductItem, getProductModuleCategoryByPath } from "@/lib/product-market-store";
import {
  readScopedProductMarketConfig,
} from "@/lib/product-market-config";
import { navItems } from "./Sidebar";
import { appendSiteIdToPath } from "@/lib/site-admin";
import { resolveCurrentSiteId } from "@/lib/sites";
import { buildConfiguredProductNavItems, isNavPathMatch } from "@/lib/product-navigation";
import { PRODUCT_MARKET_NAV_ITEMS } from "@/lib/product-market-navigation";
import { isDevelopmentStandardOnlyPath } from "@/lib/development-standard-navigation";

type Mode = "hq" | "agency";

const copyModes = {
  hq: { title: "客户端", desc: "总部统一管理客户端功能与默认能力。" },
  agency: { title: "客户端", desc: "代理端侧查看和使用客户端项目能力。" },
};

function getInheritedConfig(mode: Mode, siteId?: string | null) {
  if (mode === "hq") return readScopedProductMarketConfig("hq", siteId);
  return readScopedProductMarketConfig("agency", siteId) || readScopedProductMarketConfig("hq", siteId);
}

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return hex;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function withAlpha(color: string, alpha: number) {
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return hexToRgba(trimmed, alpha);
  const match = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (match) return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
  return color;
}

function getColorLuma(color?: string) {
  if (!color) return null;
  const trimmed = color.trim();
  let r: number;
  let g: number;
  let b: number;

  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    r = parseInt(trimmed.slice(1, 3), 16);
    g = parseInt(trimmed.slice(3, 5), 16);
    b = parseInt(trimmed.slice(5, 7), 16);
  } else {
    const match = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
    if (!match) return null;
    r = Number(match[1]);
    g = Number(match[2]);
    b = Number(match[3]);
    const alphaValue = match[4] === undefined ? 1 : Number(match[4]);
    if (alphaValue < 0.65) return null;
  }

  return (r * 299 + g * 587 + b * 114) / 1000;
}

function getReadableTextColor(styleColor: string | undefined, bgColor: string | undefined, fallback: string) {
  if (!styleColor) return fallback;
  const textLuma = getColorLuma(styleColor);
  const bgLuma = getColorLuma(bgColor);
  if (textLuma === null) return styleColor;
  if (bgLuma === null && textLuma < 150) return fallback;
  if (bgLuma !== null && Math.abs(bgLuma - textLuma) < 90) return fallback;
  return styleColor;
}

function withPrefix(path: string, prefix: string) {
  if (path === "/") return prefix;
  return `${prefix}${path}`;
}

function withPrefixAndSite(path: string, prefix: string, siteId?: string | null) {
  return appendSiteIdToPath(withPrefix(path, prefix), siteId);
}

const buildProductNavLabel = (path: string, label: string) => {
  return label.trim().replace(/^\d+\.[^\s]+\s+/, "");
};
const buildProductNavTitle = (path: string, label: string) => {
  const category = getProductModuleCategoryByPath(path);
  const cleanLabel = label.trim().replace(/^\d+\.[^\s]+\s+/, "");
  return category ? `栏目归属：${category.label}，名称：${cleanLabel}` : `名称：${cleanLabel}`;
};

export default function ClientProjectNav({
  mode,
  embeddedVersionCard,
}: {
  mode: Mode;
  embeddedVersionCard?: ReactNode;
}) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [productMarketOpen, setProductMarketOpen] = useState(false);
  const meta = copyModes[mode];
  const prefix = mode === "hq" ? "/zb/kh" : "/dl/kh";
  const currentSiteId = resolveCurrentSiteId(mode === "hq" ? "hq" : "agency", location.search);
  const productMarketSubview = new URLSearchParams(location.search).get("tab") || "operations";
  const productMarketRouteActive = location.pathname === `${prefix}/product-market`;
  const { products, customProducts, productOrder, sidebarStyle, globalFontFamily, globalFontWeight, globalLetterSpacing, importConfig } = useProductMarketStore();

  useEffect(() => {
    const config = getInheritedConfig(mode, currentSiteId);
    if (config) importConfig(config);
  }, [currentSiteId, mode, importConfig]);

  useEffect(() => {
    setOpen(false);
    setExpanded({});
    setProductMarketOpen(false);
  }, [mode]);

  function isTargetActive(target: string) {
    return isNavPathMatch(target, location.pathname, location.search);
  }

  function isParentActive(item: { path: string; children?: { path: string }[] }) {
    if (!item.children?.length) return false;
    return item.children.some((child) => isTargetActive(withPrefix(child.path, prefix)));
  }

  const toggle = (path: string) => {
    if (expanded[path]) {
      setExpanded((prev) => ({ ...prev, [path]: false }));
      return;
    }
    setProductMarketOpen(false);
    setExpanded({ [path]: true });
  };

  const toggleProductMarket = () => {
    if (!productMarketOpen) setExpanded({});
    setProductMarketOpen((value) => !value);
  };

  const configuredItems = useMemo(() => {
    return buildConfiguredProductNavItems(navItems, products, customProducts, productOrder);
  }, [customProducts, productOrder, products]);

  // Keep a direct second-level route inside its parent group, while closing
  // every other group. Manual expand/collapse remains intact on the same route.
  useEffect(() => {
    if (productMarketRouteActive) {
      setExpanded((prev) => Object.keys(prev).length ? {} : prev);
      setProductMarketOpen(true);
      return;
    }
    const activeKey = configuredItems.find((item) => item.children?.length && isParentActive(item))?.path;
    if (!activeKey) return;
    setProductMarketOpen(false);
    setExpanded((prev) => Object.keys(prev).length === 1 && prev[activeKey] ? prev : { [activeKey]: true });
  }, [configuredItems, location.pathname, location.search, productMarketRouteActive]);

  const effectiveSidebarStyle = sidebarStyle;
  const effectiveFontFamily = globalFontFamily;
  const activeHighlight = effectiveSidebarStyle.activeHighlight || (mode === "hq" ? "#34d399" : "#8b5cf6");
  const defaultText = effectiveSidebarStyle.textColor || (mode === "hq" ? "#d1fae5" : "#e2e8f0");

  return (
    <section
      className="mx-2 my-2 overflow-hidden rounded-md border shadow-inner"
      style={{
        background: `linear-gradient(to bottom, ${effectiveSidebarStyle.bgFrom}, ${effectiveSidebarStyle.bgVia}, ${effectiveSidebarStyle.bgTo})`,
        borderColor: withAlpha(effectiveSidebarStyle.borderColor || "#ffffff", 0.35),
        color: defaultText,
        fontFamily: effectiveFontFamily || effectiveSidebarStyle.fontFamily || "system-ui, sans-serif",
        fontWeight: globalFontWeight || effectiveSidebarStyle.fontWeight || "400",
        letterSpacing: globalLetterSpacing || effectiveSidebarStyle.letterSpacing || "0.02em",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        style={{ borderBottom: open ? `1px solid ${withAlpha(effectiveSidebarStyle.borderColor || "#ffffff", 0.2)}` : undefined }}
      >
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold text-white">{meta.title}</div>
          <div className="truncate text-[9px]" style={{ color: `${defaultText}b3` }}>
            {meta.desc}
          </div>
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} style={{ color: `${defaultText}b3` }} />
      </button>

      {open && (
        <div className="space-y-0.5 px-1.5 py-2">
          {embeddedVersionCard ? <div className="pb-2">{embeddedVersionCard}</div> : null}
          <div>
            <button
              type="button"
              onClick={toggleProductMarket}
              aria-expanded={productMarketOpen}
              className={cn("flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors", productMarketRouteActive ? "border-l-2 font-medium" : "hover:opacity-90")}
              style={productMarketRouteActive
                ? { color: activeHighlight, borderColor: activeHighlight, background: `linear-gradient(to right, ${hexToRgba(activeHighlight, 0.25)}, ${hexToRgba(activeHighlight, 0.08)})` }
                : { color: `${defaultText}dd` }}
            >
              <span className="flex min-w-0 items-center gap-2"><ShoppingBag className="h-3.5 w-3.5 shrink-0" /><span className="truncate">产品市场</span></span>
              <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", productMarketOpen && "rotate-180")} />
            </button>
            {productMarketOpen ? <div className="ml-5 mt-0.5 space-y-0.5 border-l pl-2" style={{ borderColor: withAlpha(effectiveSidebarStyle.borderColor || "#ffffff", 0.28) }}>
              {PRODUCT_MARKET_NAV_ITEMS.map(({ tab, label }) => {
                const active = productMarketRouteActive && productMarketSubview === tab;
                return <NavLink
                  key={tab}
                  to={appendSiteIdToPath(`${prefix}/product-market?tab=${tab}`, currentSiteId)}
                  className={cn("block rounded-md px-2.5 py-1 text-[11px] transition-colors", active && "font-medium")}
                  style={active ? { color: activeHighlight, background: `linear-gradient(to right, ${hexToRgba(activeHighlight, 0.22)}, ${hexToRgba(activeHighlight, 0.05)})` } : { color: `${defaultText}cc` }}
                >{label}</NavLink>;
              })}
            </div> : null}
          </div>

          {configuredItems.map((item) => {
            const Icon = item.icon;
            const target = withPrefixAndSite(item.path, prefix, currentSiteId);
            const hasChildren = !!item.children?.length;
            const isOpen = !!expanded[item.path];
            const active = hasChildren
              ? isParentActive(item)
              : item.path === "/"
                ? location.pathname === prefix
                : isTargetActive(target) || location.pathname.startsWith(`${target}/`);
            const productStyle = item.product?.customStyle || {};
            const textColor = getReadableTextColor(productStyle.nameFontColor || productStyle.fontColor, undefined, defaultText);
            const iconColor = getReadableTextColor(productStyle.fontColor || productStyle.nameFontColor, undefined, textColor);
            const navLabel = buildProductNavLabel(item.path, item.label);
            const navTitle = buildProductNavTitle(item.path, navLabel);

            if (item.disabled) {
              return (
                <div key={item.path} className="flex cursor-not-allowed items-center gap-2 rounded-md px-2.5 py-1.5 text-xs opacity-40" style={{ color: textColor }}>
                  {productStyle.customIconUrl ? (
                    <img src={productStyle.customIconUrl} alt="" className="h-3.5 w-3.5 shrink-0 rounded object-contain" />
                  ) : (
                    <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: iconColor }} />
                  )}
                  <span className="truncate" title={productStyle.customIconUrl ? item.label : navTitle}>{navLabel}</span>
                </div>
              );
            }

            return (
              <div key={item.path}>
                <NavLink
                  to={target}
                  end={item.path === "/"}
                  onClick={(event) => {
                    if (hasChildren) {
                      event.preventDefault();
                      toggle(item.path);
                    }
                  }}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors hover:opacity-90",
                    active ? "border-l-2 font-medium" : ""
                  )}
                  style={{
                    color: active ? activeHighlight : withAlpha(textColor, 0.9),
                    borderColor: active ? activeHighlight : undefined,
                    background: active
                      ? `linear-gradient(to right, ${hexToRgba(activeHighlight, 0.25)}, ${hexToRgba(activeHighlight, 0.08)})`
                      : undefined,
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {productStyle.customIconUrl ? (
                      <img src={productStyle.customIconUrl} alt="" className="h-3.5 w-3.5 shrink-0 rounded object-contain" />
                    ) : (
                      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: iconColor }} />
                    )}
                    <span className="truncate" title={navTitle}>
                      {navLabel}
                    </span>
                  </span>
                  {hasChildren && <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", isOpen && "rotate-180")} />}
                </NavLink>
                {hasChildren && isOpen && (
                  <div className="ml-5 mt-0.5 space-y-0.5 border-l pl-2" style={{ borderColor: withAlpha(effectiveSidebarStyle.borderColor || "#ffffff", 0.28) }}>
                    {item.children!
                      .filter((child) => !isDevelopmentStandardOnlyPath(child.path) && item.product?.children?.find((storedChild) => storedChild.path === child.path)?.status !== "hidden")
                      .map((child) => {
                        const childTarget = withPrefixAndSite(child.path, prefix, currentSiteId);
                        const childActive = isTargetActive(childTarget);
                        const storedChild = item.product?.children?.find((entry) => entry.path === child.path);
                        const childStyle = storedChild?.customStyle || {};
                        const childText = child.label;
                        const childTextColor = getReadableTextColor(childStyle.nameFontColor || childStyle.fontColor, undefined, defaultText);
                        return (
                          <NavLink
                            key={child.path}
                            to={childTarget}
                            className={cn("flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] transition-colors hover:opacity-90", childActive ? "font-medium" : "")}
                            style={
                              childActive
                                ? {
                                    color: activeHighlight,
                                    backgroundColor: hexToRgba(activeHighlight, 0.15),
                                    borderLeft: `2px solid ${activeHighlight}`,
                                    marginLeft: "-2px",
                                  }
                                : { color: withAlpha(childTextColor, 0.72) }
                            }
                          >
                            {childStyle.customIconUrl ? (
                              <img src={childStyle.customIconUrl} alt="" className="h-3.5 w-3.5 shrink-0 rounded object-contain" />
                            ) : null}
                            <span className="truncate">{childText}</span>
                          </NavLink>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
