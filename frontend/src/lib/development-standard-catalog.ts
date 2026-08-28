export type DevelopmentStandardCatalogId =
  | "market"
  | "identity"
  | "content"
  | "trust"
  | "recommend"
  | "deepen"
  | "portrait"
  | "lead"
  | "convert"
  | "fulfillment"
  | "care"
  | "decision"
  | "operations";

export type DevelopmentStandardCatalogItem = {
  id: DevelopmentStandardCatalogId;
  order: string;
  label: string;
  title: string;
  state: "ready" | "linked" | "planned";
  description: string;
};

/**
 * The market standard plus twelve business standards are the stable operating taxonomy for every source
 * workspace. "planned" means the module has a reserved standard page and
 * structure, but no operating playbook is asserted before evidence exists.
 */
export const DEVELOPMENT_STANDARD_CATALOG: readonly DevelopmentStandardCatalogItem[] = [
  { id: "market", order: "市场", label: "市场", title: "市场 > 规范", state: "ready", description: "对应产品市场的开发规范、页面组合、验证、审计与单向发布。" },
  { id: "identity", order: "01", label: "蓄势(身份)", title: "01. 蓄势(身份) > 规范", state: "planned", description: "规范模块已建立，等待沉淀身份、账户、品牌与接入的经营流程。" },
  { id: "content", order: "02", label: "布场(内容)", title: "02. 布场(内容) > 规范", state: "planned", description: "规范模块已建立，等待沉淀内容生产、页面布场与素材治理流程。" },
  { id: "trust", order: "03", label: "营搜(信任)", title: "03. 营搜(信任) > 规范", state: "planned", description: "规范模块已建立，等待沉淀搜索、信任资产与验证流程。" },
  { id: "recommend", order: "04", label: "占新(推荐)", title: "04. 占新(推荐) > 规范", state: "planned", description: "规范模块已建立，等待沉淀推荐、地域策略与效果归因流程。" },
  { id: "deepen", order: "05", label: "圈养(深耕)", title: "05. 圈养(深耕) > 规范", state: "linked", description: "复用统一开发规范模板；六个业务一级应用共同拥有九个社媒二级工作区，连接痛点路线、内部治理、官方连接器门禁和真实操作页面。" },
  { id: "portrait", order: "06", label: "锁客(画像)", title: "06. 锁客(画像) > 规范", state: "planned", description: "规范模块已建立，等待沉淀用户画像、分层和触达流程。" },
  { id: "lead", order: "07", label: "精投(截流)", title: "07. 精投(截流) > 规范", state: "planned", description: "规范模块已建立，等待沉淀投放、线索截流与预算控制流程。" },
  { id: "convert", order: "08", label: "承转(转化)", title: "08. 承转(转化) > 规范", state: "planned", description: "规范模块已建立，等待沉淀询盘承接、转化与归因流程。" },
  { id: "fulfillment", order: "09", label: "强链(履约)", title: "09. 强链(履约) > 规范", state: "planned", description: "规范产品工程、供应采购、计划生产、质量、仓储与全球交付，确保订单可兑现且可追溯。" },
  { id: "care", order: "10", label: "深养(伴护)", title: "10. 深养(伴护) > 规范", state: "planned", description: "规范模块已建立，等待沉淀客户伴护、服务和留存流程。" },
  { id: "decision", order: "11", label: "驭数(决策)", title: "11. 驭数(决策) > 规范", state: "planned", description: "规范模块已建立，等待沉淀数据决策、经营复盘与优化流程。" },
  { id: "operations", order: "12", label: "固本(经营)", title: "12. 固本(经营) > 规范", state: "planned", description: "规范ERP、财务、人事、招聘面试、审批、合同与主数据，确保经营、利润和现金事实同源。" },
];

export function getDevelopmentStandardCatalogItem(value: string | null | undefined) {
  return DEVELOPMENT_STANDARD_CATALOG.find((item) => item.id === value) || DEVELOPMENT_STANDARD_CATALOG[0];
}

export function getDevelopmentStandardRoute(guideRoute: string, id: DevelopmentStandardCatalogId) {
  return id === "market" ? guideRoute : `${guideRoute}&standard=${id}`;
}
