import { PRODUCT_MARKET_ROUTE_ITEMS, resolveProductMarketNavTab } from "@/lib/product-market-navigation";
import { FACTORY_PLATFORM_SOCIAL_WORKSPACES } from "@/lib/factory-platform-blueprint";

const COMPANY_INFO_ROUTE_LABELS: Record<string, string> = {
  navigation: "首页设计 → 导航栏自定义",
  profile: "企业资料 → 基本资料",
  banner: "首页设计 → 首页大图",
  recommend: "首页设计 → 产品推荐",
  about: "关于我们 → 公司介绍",
  faq: "关于我们 → FAQ",
  factory: "关于我们 → 工厂生产",
  gallery: "关于我们 → 公司风采",
  exhibition: "新闻中心 → 展会活动",
  service: "服务保障 → 服务保障",
  logistics: "服务保障 → 物流货运",
  im: "客服中心 → IM 客服 / SNS",
  modules: "企业资料 → 自定义模块",
};

const SITE_SETTINGS_ROUTE_LABELS: Record<string, string> = {
  general: "站点设置 → 站点设置",
  modules: "站点设置 → 自定义模块",
  redirect: "站点设置 → 重定向",
  domains: "网址域名",
  "domain-register": "网址域名 → 域名注册",
  "domain-binding": "网址域名 → 绑定解析",
  "domain-transfer": "网址域名 → 域名转出",
};

/**
 * Shared source of truth for developer tools, page cleanup, and page locking.
 * Product Market labels deliberately come from the complete route collection,
 * including planning pages that are entered from the “规范” menu.
 */
export function resolveClientSourceRouteLabel(pathname: string, search = "") {
  const tab = new URLSearchParams(search).get("tab");

  if (pathname.includes("/product-market")) {
    const productTab = resolveProductMarketNavTab(tab);
    if (productTab === "development") return "产品市场 → 开发规范";
    return `产品市场 → ${PRODUCT_MARKET_ROUTE_ITEMS.find((item) => item.tab === productTab)?.label || "运营市场"}`;
  }

  if (pathname.includes("/customers") && tab === "development") return "CRM 管理 → 开发规范";
  if (pathname.includes("/social") && tab === "customer-roadmap") return "社交媒体 → 痛点路线";
  if (pathname.includes("/social")) {
    const workspace = FACTORY_PLATFORM_SOCIAL_WORKSPACES.find((item) => item.tab === (tab || "dashboard"));
    if (workspace) return `社交媒体 → ${workspace.label}`;
  }

  if (pathname.includes("/company-info")) {
    return COMPANY_INFO_ROUTE_LABELS[tab || "navigation"] || "企业资料";
  }

  if (pathname.includes("/site-settings")) {
    return SITE_SETTINGS_ROUTE_LABELS[tab || "general"] || "站点设置";
  }

  if (pathname.includes("/ai-chat")) return "AI 智能 → AI 建站";
  if (pathname.includes("/cpq-quotes")) return "报价合同";
  if (pathname.includes("/fulfillment-orders")) return "全球交付";
  if (pathname.includes("/customer-assets")) return "客户资产";
  if (pathname.includes("/product-passports")) return "产品护照";
  if (pathname.includes("/quality-inspections")) return "质量管理";
  if (pathname.includes("/procurement")) return "供应采购";
  if (pathname.includes("/production-plans")) return "产销计划";
  if (pathname.includes("/manufacturing-execution")) return "制造执行";
  if (pathname.includes("/field-service")) return "服务工单";
  if (pathname.includes("/warranty-rma")) return "质保退货";
  if (pathname.includes("/renewal-growth")) return "续约增长";
  if (pathname.includes("/partner-voice")) return "客户之声";
  if (pathname.includes("/health-cockpit")) return "经营健康驾舱";
  if (pathname.includes("/data-warehouse")) return "经营数据仓库";
  if (pathname.includes("/metric-center")) return "指标语义中心";
  if (pathname.includes("/revenue-profit")) return "归因与利润分析";
  if (pathname.includes("/forecast")) return "经营预测";
  if (pathname.includes("/ai-command")) return "智能战情";
  if (pathname.includes("/erp")) return "经营总台";
  if (pathname.includes("/finance")) return "财务资金";
  if (pathname.includes("/people")) return "人事中心";
  if (pathname.includes("/recruiting")) return "招聘面试";
  if (pathname.includes("/approval-center")) return "审批中心";
  if (pathname.includes("/contract-legal")) return "合同法务";
  if (pathname.includes("/icp-profiles")) return "ICP客户定位";
  if (pathname.includes("/brand-studio")) return "品牌定位与网站风格";
  if (pathname.includes("/digital-assets")) return "AI计划与数字资产";
  if (pathname.includes("/site-management")) return "多站管理";
  if (pathname.includes("/dam-localization")) return "素材本地";
  if (pathname.includes("/knowledge-graph")) return "知识图谱";
  if (pathname.includes("/structured-data")) return "结构数据";
  if (pathname.includes("/channel-feed")) return "商品刊登";
  if (pathname.includes("/identity-resolution")) return "身份合并";
  if (pathname.includes("/account-graph")) return "企业关系";
  if (pathname.includes("/buying-committee")) return "采购画像";
  if (pathname.includes("/customer-timeline")) return "行为轨迹";
  if (pathname.includes("/segments-consent")) return "标签同意";
  if (pathname.includes("/abm")) return "企业定向";
  if (pathname.includes("/creative-center")) return "创意中心";
  if (pathname.includes("/ai-sdr")) return "AI售前";
  if (pathname.includes("/rfq-samples")) return "样品管理";
  if (pathname.includes("/commerce")) return "订货结账";
  if (pathname.includes("/products")) return "产品管理";
  if (pathname.includes("/templates")) return "网站风格";
  if (pathname.includes("/client-source")) return "客户源";
  if (pathname.includes("/agency-source")) return "代理源";
  if (pathname.startsWith("/zb")) return "总部端";
  if (pathname.startsWith("/dl")) return "代理端";
  return "当前页面";
}
