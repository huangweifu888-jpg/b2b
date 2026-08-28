import { readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");
const customers = read("src/pages/Customers.tsx");
const socialMedia = read("src/pages/SocialMedia.tsx");
const productMarketNavigation = read("src/lib/product-market-navigation.ts");
const externalDevtoolsMenu = read("src/components/ExternalDevtoolsMenu.tsx");
const pageRouteLabel = read("src/lib/page-route-label.ts");
const clientSidebar = read("src/components/Sidebar.tsx");
const hqSidebar = read("src/components/HQSidebar.tsx");
const agencySourceSidebar = read("src/components/AgencySourceSidebar.tsx");
const agencySidebar = read("src/components/AgencySidebar.tsx");
const clientProjectNav = read("src/components/ClientProjectNav.tsx");
const standardNavigation = read("src/lib/development-standard-navigation.ts");

const requireToken = (source, token, message) => {
  if (!source.includes(token)) throw new Error(`${message}: ${token}`);
};

for (const token of [
  "data-crm-development-standard",
  'data-development-standard-hidden-route="crm"',
  'currentTab === "development"',
  "CRM 管理 · B2B 工厂客户开发规范",
  "模板只同步结构与规则",
  "单机到多服务器",
]) {
  requireToken(customers, token, "CRM 开发规范缺少契约");
}

const crmSecondaryNavigation = customers.slice(
  customers.indexOf("<TabsList data-client-project-subnav"),
  customers.indexOf("</TabsList>"),
);
if (crmSecondaryNavigation.includes('value="development"')) {
  throw new Error("CRM 开发规范不得显示在 CRM 二级导航。");
}

const productMarketVisibleNavigation = productMarketNavigation.slice(
  productMarketNavigation.indexOf("PRODUCT_MARKET_NAV_ITEMS"),
  productMarketNavigation.indexOf("] as const;"),
);
if (productMarketVisibleNavigation.includes('tab: "development"')) {
  throw new Error("产品市场开发规范不得显示在产品市场二级导航。");
}
if (productMarketVisibleNavigation.includes('tab: "blueprint"')) {
  throw new Error("平台蓝图不得显示在产品市场业务二级导航。");
}
requireToken(productMarketNavigation, 'if (value === "development") return value;', "产品市场隐藏规范路由不可访问");
requireToken(productMarketNavigation, 'tab: "blueprint", label: "平台蓝图"', "平台蓝图隐藏路由不可访问");

const socialVisibleNavigationStart = socialMedia.indexOf("const TABS = [");
const socialVisibleNavigation = socialMedia.slice(
  socialVisibleNavigationStart,
  socialMedia.indexOf("] as const;", socialVisibleNavigationStart),
);
if (socialVisibleNavigation.includes('key: "customer-roadmap"')) {
  throw new Error("社交媒体痛点路线不得显示在社交媒体二级导航。");
}
if (clientSidebar.includes('/social?tab=customer-roadmap')) {
  throw new Error("社交媒体痛点路线不得显示在客户端或客户源左侧二级导航。");
}
requireToken(socialMedia, 'const DEVELOPMENT_TABS = [', "社交媒体隐藏规范路由缺少声明");
requireToken(socialMedia, 'tab === "customer-roadmap"', "社交媒体隐藏痛点路线不可访问");

for (const [name, source] of [
  ["总部端", hqSidebar],
  ["代理源", agencySourceSidebar],
  ["代理端", agencySidebar],
]) {
  if (source.includes("product-market?tab=development")) {
    throw new Error(`${name}左侧二级导航不得显示产品市场开发规范。`);
  }
}
for (const token of [
  '"/product-market?tab=development"',
  '"/social?tab=customer-roadmap"',
  '"/customers?tab=development"',
  "isDevelopmentStandardOnlyPath",
]) {
  requireToken(standardNavigation, token, "规范专用历史配置过滤契约缺失");
}
requireToken(clientSidebar, "!isDevelopmentStandardOnlyPath(child.path)", "客户端导航未过滤历史规范专用项");
requireToken(clientProjectNav, "!isDevelopmentStandardOnlyPath(child.path)", "嵌入式客户端导航未过滤历史规范专用项");

for (const token of [
  'data-development-standard-quick-item="crm"',
  'data-development-standard-quick-item="platform-blueprint"',
  'replace("tab=development", "tab=blueprint")',
  "/customers?tab=development",
  "/social?tab=customer-roadmap",
  'workspaceScope === "hq" ? "/zb/client-source"',
]) {
  requireToken(externalDevtoolsMenu, token, "规范入口缺少隐藏模块路由");
}

for (const token of [
  'productTab === "development"',
  "PRODUCT_MARKET_ROUTE_ITEMS",
  "产品市场 → ${PRODUCT_MARKET_ROUTE_ITEMS.find",
  "产品市场 → 开发规范",
  "CRM 管理 → 开发规范",
  "社交媒体 → 痛点路线",
]) {
  requireToken(pageRouteLabel, token, "隐藏规范模块缺少统一页面标识");
}

console.log("隐藏开发规范模块验证通过：平台蓝图、CRM、产品市场开发规范、社交媒体痛点路线仅由规范入口访问，均未进入业务二级导航。");
