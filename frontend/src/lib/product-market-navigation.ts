export const PRODUCT_MARKET_NAV_ITEMS = [
  { tab: "operations", label: "运营市场" },
  { tab: "modules", label: "栏目配置" },
  { tab: "layout", label: "版面风格" },
  { tab: "service", label: "客服音效" },
] as const;

/**
 * 平台蓝图是开发规划入口，不是日常业务二级栏目。它保留可访问路由，
 * 但只由顶部“规范”下拉进入，避免左侧导航与规范入口重复。
 */
export const PRODUCT_MARKET_HIDDEN_ROUTE_ITEMS = [
  { tab: "blueprint", label: "平台蓝图" },
] as const;

export const PRODUCT_MARKET_ROUTE_ITEMS = [
  ...PRODUCT_MARKET_NAV_ITEMS,
  ...PRODUCT_MARKET_HIDDEN_ROUTE_ITEMS,
] as const;

export type ProductMarketNavTab = (typeof PRODUCT_MARKET_ROUTE_ITEMS)[number]["tab"];
export type ProductMarketSubview = ProductMarketNavTab | "development";

export const PRODUCT_MARKET_LOCK_GROUP_ID = "tool:product-market:group";

export function getProductMarketPath(tab: ProductMarketNavTab) {
  return `/product-market?tab=${tab}`;
}

/**
 * 产品市场的业务二级导航与隐藏规划页共用同一个路由解析集合。
 * 日常栏目加入 PRODUCT_MARKET_NAV_ITEMS；规范专用页加入隐藏集合。
 */
export function isProductMarketNavTab(value: string | null | undefined): value is ProductMarketNavTab {
  return typeof value === "string" && PRODUCT_MARKET_ROUTE_ITEMS.some((item) => item.tab === value);
}

export function isProductMarketSubview(value: string | null | undefined): value is ProductMarketSubview {
  return value === "development" || isProductMarketNavTab(value);
}

export function resolveProductMarketNavTab(value: string | null | undefined): ProductMarketSubview {
  return isProductMarketSubview(value) ? value : "operations";
}
