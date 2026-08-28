import { PRODUCT_MARKET_NAV_ITEMS } from "@/lib/product-market-navigation";

/** Shared route map for the Layout Developer quality center and build gates. */
export const LAYOUT_QUALITY_BASELINES = [
  { id: "homepage-banner", label: "首页大图", route: "/zb/client-source/company-info?tab=banner", focus: "普通业务页框架、真实列表、内容插件与尾栏" },
  { id: "product-recommend", label: "产品推荐", route: "/zb/client-source/company-info?tab=recommend", focus: "卡片内容区、响应式网格与页面操作" },
  { id: "domain-register", label: "域名注册", route: "/zb/client-source/site-settings?tab=domain-register", focus: "表单列表、左右内容列与共享框架" },
  { id: "domain-binding", label: "绑定解析", route: "/zb/client-source/site-settings?tab=domain-binding", focus: "表单列表、状态提示与页面滚动" },
  { id: "domain-transfer", label: "域名转出", route: "/zb/client-source/site-settings?tab=domain-transfer", focus: "表单列表、操作按钮与尾栏" },
  { id: "crm-summary", label: "CRM 工作汇总", route: "/zb/client-source/customers?tab=summary", focus: "业务卡片、统计内容与共享列表合同" },
] as const;

/** The first Global Styler canary has its own DOM/geometry gate. Register it
 * as a reviewed source frame without silently enrolling the other Social
 * Media tabs or adding them to the ordinary-page screenshot queue. */
export const GLOBAL_STYLER_PILOT_FRAME_ACCEPTANCE = [{
  id: "client-social-marketing-playbook",
  label: "社交媒体 → 营销作战",
  route: "/zb/client-source/social?tab=marketing-playbook",
  focus: "运营市场参考框架、五个真实语义区、唯一滚动源与共享左右边界",
}] as const;

/** Product Market is the reviewed shared-frame source.  Keep it adjacent to
 * (but distinct from) the six ordinary-page baselines so both kinds of page
 * are validated without pretending that table/card content is globally owned. */
const CLIENT_SOURCE_PRODUCT_MARKET_FRAME_ACCEPTANCE = PRODUCT_MARKET_NAV_ITEMS.map(({ tab, label }) => ({
  id: `product-market-${tab}`,
  label: `产品市场 → ${label}`,
  route: `/zb/client-source/product-market?tab=${tab}`,
  focus: "共享主体外框、标题边距、右侧滚条与尾栏合同",
}));

// Headquarters and Agency Source use the same reviewed frame as Client
// Source, but their catalogues and release chains are independent.  Keep
// their development-tool routes in the quality queue so shared-frame fixes
// are learned and verified across every editable source.
const ADDITIONAL_PRODUCT_MARKET_SOURCE_WORKSPACES = [
  { id: "hq", label: "\u603b\u90e8\u7aef\u5f00\u53d1\u5de5\u5177 \u00b7 \u4e8b\u4e1a\u5e02\u573a", routePrefix: "/zb" },
  { id: "agency-source", label: "\u4ee3\u7406\u6e90\u5f00\u53d1\u5de5\u5177 \u00b7 \u5171\u4e1a\u5e02\u573a", routePrefix: "/zb/agency-source" },
] as const;

const ADDITIONAL_PRODUCT_MARKET_FRAME_ACCEPTANCE = ADDITIONAL_PRODUCT_MARKET_SOURCE_WORKSPACES.flatMap((workspace) =>
  PRODUCT_MARKET_NAV_ITEMS.map(({ tab, label }) => ({
    id: `${workspace.id}-product-market-${tab}`,
    label: `${workspace.label} \u2192 ${label}`,
    route: `${workspace.routePrefix}/product-market?tab=${tab}`,
    focus: "\u5171\u4eab\u4e3b\u4f53\u5916\u6846\u3001\u6807\u9898\u8fb9\u8ddd\u3001\u53f3\u4fa7\u6eda\u52a8\u680f\u4e0e\u5c3e\u680f\u5408\u540c",
  }))
);

export const PRODUCT_MARKET_FRAME_ACCEPTANCE = [
  ...CLIENT_SOURCE_PRODUCT_MARKET_FRAME_ACCEPTANCE,
  ...ADDITIONAL_PRODUCT_MARKET_FRAME_ACCEPTANCE,
] as const;
