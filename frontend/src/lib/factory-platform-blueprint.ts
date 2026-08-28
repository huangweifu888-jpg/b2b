/**
 * Factory platform blueprint
 *
 * This file is deliberately pure data: it has no browser, store or UI
 * dependency, so the same contract can later be exported to the backend and
 * documentation generators without copying business definitions.
 */

export const FACTORY_PLATFORM_CATEGORY_KEYS = [
  "identity",
  "content",
  "trust",
  "recommend",
  "deepen",
  "portrait",
  "lead",
  "convert",
  "fulfillment",
  "care",
  "decision",
  "operations",
] as const;

export type FactoryPlatformCategoryKey = (typeof FACTORY_PLATFORM_CATEGORY_KEYS)[number];

export const FACTORY_PLATFORM_PHASE_IDS = [
  "revenue-loop",
  "manufacturing-loop",
  "global-intelligence",
] as const;

export type FactoryPlatformPhaseId = (typeof FACTORY_PLATFORM_PHASE_IDS)[number];

export const FACTORY_PLATFORM_AUDIENCES = [
  "factory_owner",
  "executive",
  "marketing",
  "sales",
  "operations",
  "finance",
  "hr",
  "engineering",
  "procurement",
  "production",
  "quality",
  "warehouse",
  "service",
  "it",
  "agency_operator",
] as const;

export type FactoryPlatformAudience = (typeof FACTORY_PLATFORM_AUDIENCES)[number];

export const FACTORY_PLATFORM_MODES = ["domestic", "overseas", "b2b", "b2c"] as const;

export type FactoryPlatformMode = (typeof FACTORY_PLATFORM_MODES)[number];

export const FACTORY_PLATFORM_DELIVERY_STATUSES = ["available", "pilot", "planned"] as const;

export type FactoryPlatformDeliveryStatus = (typeof FACTORY_PLATFORM_DELIVERY_STATUSES)[number];

export type FactoryPlatformApplicationId = `${FactoryPlatformCategoryKey}.${string}`;

/**
 * 02.布场的受保护栏目：这不是新增应用数量，而是六个内容应用对外
 * 交付时必须保留的栏目投影。任何同步、清扫或迁移都不得删除或改名。
 */
export const FACTORY_PLATFORM_CONTENT_PROGRAM_PROTECTION = [
  // Explicit 2026-08 shared-contract migration: / remains the client homepage;
  // content.cms moved to a dedicated governed route without removing the programme.
  { id: "content-site-management", label: "多站管理", applicationId: "content.cms", route: "/site-management" },
  { id: "content-company-profile", label: "企业资料", applicationId: "content.company", route: "/company-info" },
  { id: "content-homepage-design", label: "首页设计", applicationId: "content.homepage", route: "/company-info?tab=navigation" },
  { id: "content-product-center", label: "产品中心", applicationId: "content.product", route: "/products" },
  { id: "content-engineering-cases", label: "工程案例", applicationId: "content.proof", route: "/cases" },
  { id: "content-local-assets", label: "素材本地", applicationId: "content.dam-localization", route: "/dam-localization" },
  { id: "content-service-assurance", label: "服务保障", applicationId: "content.company", route: "/company-info?tab=service" },
  { id: "content-news-center", label: "新闻中心", applicationId: "content.proof", route: "/news" },
  { id: "content-enterprise-video", label: "企业视频", applicationId: "content.proof", route: "/videos" },
  { id: "content-blog-center", label: "博客中心", applicationId: "content.proof", route: "/blog" },
  { id: "content-company-introduction", label: "公司介绍", applicationId: "content.company", route: "/company-info?tab=about" },
  { id: "content-contact-us", label: "联系我们", applicationId: "content.company", route: "/company-info?tab=im" },
] as const satisfies readonly { label: string; applicationId: FactoryPlatformApplicationId; route: string }[];

/**
 * The only sanctioned way to change this fixed programme is an explicit
 * shared-contract migration.  Consumers use this predicate before removing
 * obsolete navigation shadows, so a protected content route can never be
 * mistaken for a retired legacy entry.
 */
export function isFactoryPlatformProtectedContentRoute(route: string) {
  try {
    const candidate = new URL(route.trim(), "https://factory-platform.local");
    return FACTORY_PLATFORM_CONTENT_PROGRAM_PROTECTION.some((program) => {
      const protectedRoute = new URL(program.route, "https://factory-platform.local");
      if (candidate.pathname !== protectedRoute.pathname) return false;

      // A base route (for example /company-info) protects the whole source
      // workspace. A routed programme with a tab protects only its declared
      // tab, while allowing harmless tracking or preview query parameters.
      return [...protectedRoute.searchParams].every(
        ([key, value]) => candidate.searchParams.get(key) === value,
      );
    });
  } catch {
    return false;
  }
}

export interface FactoryPlatformNavigationChild {
  id: string;
  /** Four-character default used by Column Configuration and the sidebar. */
  label: string;
  /** Full planning term retained for tooltips, specifications and later editing. */
  fullLabel: string;
  route: string;
}

export const FACTORY_PLATFORM_SOCIAL_WORKSPACE_CONTRACT_ID = "factory-platform-social-workspace-v2";

export type FactoryPlatformSocialWorkspaceTab =
  | "marketing-playbook"
  | "dashboard"
  | "accounts"
  | "create"
  | "digital-human"
  | "schedule"
  | "automation"
  | "analytics"
  | "settings";

export type FactoryPlatformSocialWorkspace = FactoryPlatformNavigationChild & {
  tab: FactoryPlatformSocialWorkspaceTab;
  applicationId: `deepen.${string}`;
  pageFactoryId: `client-social-${string}`;
  /** Real runtime ownership. HQ and agency source consume governance projections only. */
  runtimeSourceScope: "client_source";
  template: "dashboard" | "form" | "editor" | "workflow";
  markets: readonly ["domestic", "overseas"];
  customerPain: string;
  customerValue: string;
  executionCapabilities: readonly string[];
  executionBoundary: string;
};

/**
 * 05.圈养(深耕) 的唯一业务工作区投影。
 *
 * 六个应用继续拥有业务对象、API 与验收门禁；这九个工作区只负责把真实页面
 * 统一投影到栏目配置、运营市场、左侧栏、页面锁定器、页面工厂与规范生成器。
 * 隐藏的 customer-roadmap 是开发记录，不得进入客户业务导航。
 */
export const FACTORY_PLATFORM_SOCIAL_WORKSPACES = [
  {
    id: "deepen.social-workspace.marketing-playbook",
    tab: "marketing-playbook",
    label: "营销作战",
    fullLabel: "国内外社交媒体营销作战",
    route: "/social?tab=marketing-playbook",
    applicationId: "deepen.social-matrix",
    pageFactoryId: "client-social-marketing-playbook",
    runtimeSourceScope: "client_source",
    template: "dashboard",
    markets: ["domestic", "overseas"],
    customerPain: "工厂知道要做社媒，却缺少按市场、产品与采购角色拆解的行动路线。",
    customerValue: "把客户痛点、产品利益、内容任务和后续成交证据编排成可复核作战路径。",
    executionCapabilities: ["双市场策略", "工厂营销画像", "痛点利益包装", "九阶段任务派发"],
    executionBoundary: "规划、自检与人工验收可执行；外部渠道动作仍须进入对应审核、授权和回执页面。",
  },
  {
    id: "deepen.social-workspace.dashboard",
    tab: "dashboard",
    label: "运营总览",
    fullLabel: "社交媒体运营总览",
    route: "/social?tab=dashboard",
    applicationId: "deepen.social-matrix",
    pageFactoryId: "client-social-dashboard",
    runtimeSourceScope: "client_source",
    template: "dashboard",
    markets: ["domestic", "overseas"],
    customerPain: "账号、内容、发布与线索分散，负责人无法区分真实回执和本地计划。",
    customerValue: "在同一计划中查看主页资产、任务、线索和数据新鲜度，明确下一步责任。",
    executionCapabilities: ["计划健康度", "主页资产状态", "内容发布漏斗", "运营待办诊断"],
    executionBoundary: "只汇总已有内部记录、官方快照或人工核验快照，不虚构平台实时数据。",
  },
  {
    id: "deepen.social-workspace.accounts",
    tab: "accounts",
    label: "账号连接",
    fullLabel: "国内外社媒账号连接",
    route: "/social?tab=accounts",
    applicationId: "deepen.social-matrix",
    pageFactoryId: "client-social-accounts",
    runtimeSourceScope: "client_source",
    template: "dashboard",
    markets: ["domestic", "overseas"],
    customerPain: "多平台账号归属、授权状态和主页证据无法统一核验。",
    customerValue: "以凭据引用、主页资产、指标快照和异人复核形成可追溯账号矩阵。",
    executionCapabilities: ["授权申请", "主页资产登记", "矩阵核验发布", "授权审计"],
    executionBoundary: "前端不保存密码、Cookie 或令牌；OAuth 换码、同步和外部发布仅在官方连接器就绪后执行。",
  },
  {
    id: "deepen.social-workspace.create",
    tab: "create",
    label: "内容创作",
    fullLabel: "多市场内容创作与本地化",
    route: "/social?tab=create",
    applicationId: "deepen.localized-distribution",
    pageFactoryId: "client-social-create",
    runtimeSourceScope: "client_source",
    template: "form",
    markets: ["domestic", "overseas"],
    customerPain: "同一文案直接翻译后投放不同市场，容易出现术语、文化和商业承诺风险。",
    customerValue: "围绕市场、语言、素材权利与利益表达生成草稿，并经过人工本地化审核。",
    executionCapabilities: ["内容草稿", "多语本地化", "素材权利确认", "审核与版本恢复"],
    executionBoundary: "AI 只辅助草稿；未通过人工审核、账号授权和发布门禁不得外发。",
  },
  {
    id: "deepen.social-workspace.digital-human",
    tab: "digital-human",
    label: "视频创作",
    fullLabel: "视频创作与客户倡导",
    route: "/social?tab=digital-human",
    applicationId: "deepen.influence",
    pageFactoryId: "client-social-digital-human",
    runtimeSourceScope: "client_source",
    template: "editor",
    markets: ["domestic", "overseas"],
    customerPain: "视频生产缺少脚本、素材权利、专家角色和人工验收的统一流程。",
    customerValue: "把视频任务、权利检查与专家／客户倡导项目纳入可审计工作流。",
    executionCapabilities: ["视频脚本任务", "形象与素材登记", "权利人工审核", "倡导项目治理"],
    executionBoundary: "当前执行任务与治理留痕；真实生成、渲染、上传和直播仍需获批服务连接器。",
  },
  {
    id: "deepen.social-workspace.schedule",
    tab: "schedule",
    label: "发布中心",
    fullLabel: "内容日历与发布中心",
    route: "/social?tab=schedule",
    applicationId: "deepen.content-calendar",
    pageFactoryId: "client-social-schedule",
    runtimeSourceScope: "client_source",
    template: "workflow",
    markets: ["domestic", "overseas"],
    customerPain: "内容审核、排期、渠道任务与发布结果之间没有可追踪回执。",
    customerValue: "用版本化日历串联审核、排期、发布任务和渠道回执，避免未经批准直接外发。",
    executionCapabilities: ["内容日历", "审核回执", "发布任务队列", "渠道结果回执"],
    executionBoundary: "内部审核和队列可执行；没有已核验授权的任务必须保持安全阻断。",
  },
  {
    id: "deepen.social-workspace.automation",
    tab: "automation",
    label: "互动转化",
    fullLabel: "互动线索与私域转化",
    route: "/social?tab=automation",
    applicationId: "deepen.community",
    pageFactoryId: "client-social-automation",
    runtimeSourceScope: "client_source",
    template: "dashboard",
    markets: ["domestic", "overseas"],
    customerPain: "评论、私信和社群信号分散，容易漏掉采购意向或产生越权自动回复。",
    customerValue: "按资格规则形成线索待办、人工回复审核和 CRM 交接记录。",
    executionCapabilities: ["互动规则", "线索资格判断", "人工回复审核", "CRM 交接"],
    executionBoundary: "不做未授权自动回复；平台事件订阅和外部 CRM 派发需独立连接器与客户同意。",
  },
  {
    id: "deepen.social-workspace.analytics",
    tab: "analytics",
    label: "数据归因",
    fullLabel: "社交聆听与数据归因",
    route: "/social?tab=analytics",
    applicationId: "deepen.listening",
    pageFactoryId: "client-social-analytics",
    runtimeSourceScope: "client_source",
    template: "dashboard",
    markets: ["domestic", "overseas"],
    customerPain: "只看播放和点赞，无法证明内容、互动、线索与成交之间的关系。",
    customerValue: "区分官方／人工快照，连接公开信号、内容、线索和后续归因证据。",
    executionCapabilities: ["指标快照", "公开信号评估", "内容线索归因", "数据新鲜度"],
    executionBoundary: "不把本地任务当成官方数据；实时聆听、广告账单和成交回传依赖获批数据源。",
  },
  {
    id: "deepen.social-workspace.settings",
    tab: "settings",
    label: "平台设置",
    fullLabel: "社交运营平台设置",
    route: "/social?tab=settings",
    applicationId: "deepen.social-matrix",
    pageFactoryId: "client-social-settings",
    runtimeSourceScope: "client_source",
    template: "form",
    markets: ["domestic", "overseas"],
    customerPain: "市场、语言、审批、同意和数据留存规则在不同计划中容易漂移。",
    customerValue: "把运营默认值、来源包版本和合规边界固化为可发布、可恢复的计划配置。",
    executionCapabilities: ["市场语言设置", "审批模式", "同意与留存", "来源包版本"],
    executionBoundary: "设置只改变当前来源草案或计划默认值，不覆盖账号、内容、线索、数据库或下游自定义。",
  },
] as const satisfies readonly FactoryPlatformSocialWorkspace[];

export function getFactoryPlatformSocialWorkspaceNavigationChildren(applicationId: `deepen.${string}`) {
  return FACTORY_PLATFORM_SOCIAL_WORKSPACES
    .filter((workspace) => workspace.applicationId === applicationId)
    .map(({ id, label, fullLabel, route }) => ({ id, label, fullLabel, route }));
}

export function getFactoryPlatformSocialWorkspaceRuntimeSourceScope(route: string) {
  return FACTORY_PLATFORM_SOCIAL_WORKSPACES.find((workspace) => workspace.route === route)?.runtimeSourceScope;
}

export interface FactoryPlatformApplication<TKey extends FactoryPlatformCategoryKey = FactoryPlatformCategoryKey> {
  id: `${TKey}.${string}`;
  category: TKey;
  label: string;
  /** Four-character primary navigation name shared by all six consumers. */
  navigationLabel: string;
  /** Planned second-level navigation generated from the same blueprint capability list. */
  navigationChildren: readonly FactoryPlatformNavigationChild[];
  value: string;
  phase: FactoryPlatformPhaseId;
  /** Sales-safe maturity: planned routes are blueprints; pilot routes need customer/version evidence before being sold as available. */
  deliveryStatus: FactoryPlatformDeliveryStatus;
  audience: readonly FactoryPlatformAudience[];
  modes: readonly FactoryPlatformMode[];
  /** Existing applications keep their current route; planned applications use the unified blueprint route. */
  route: string;
  capabilities: readonly string[];
  metrics: readonly string[];
}

type AtLeastSix<T> = readonly [T, T, T, T, T, T, ...T[]];

export interface FactoryPlatformCategory<TKey extends FactoryPlatformCategoryKey = FactoryPlatformCategoryKey> {
  order: `${number}`;
  key: TKey;
  label: string;
  title: string;
  value: string;
  phase: FactoryPlatformPhaseId;
  audience: readonly FactoryPlatformAudience[];
  modes: readonly FactoryPlatformMode[];
  applications: AtLeastSix<FactoryPlatformApplication<TKey>>;
}

type FactoryPlatformApplicationDraft<TKey extends FactoryPlatformCategoryKey> =
  Omit<FactoryPlatformApplication<TKey>, "deliveryStatus" | "navigationLabel" | "navigationChildren"> & {
    deliveryStatus?: FactoryPlatformDeliveryStatus;
    navigationChildren?: readonly FactoryPlatformNavigationChild[];
  };

type FactoryPlatformCategoryDraft<TKey extends FactoryPlatformCategoryKey> =
  Omit<FactoryPlatformCategory<TKey>, "applications"> & {
    applications: AtLeastSix<FactoryPlatformApplicationDraft<TKey>>;
  };

const FACTORY_PLATFORM_PRIMARY_NAVIGATION_LABELS: Record<FactoryPlatformApplicationId, string> = {
  "identity.product-intelligence": "产品分析",
  "identity.market-radar": "市场雷达",
  "identity.competitive-pricing": "竞价情报",
  "identity.icp": "客户定位",
  "identity.brand": "品牌风格",
  "identity.digital-assets": "数字资产",
  "content.cms": "多站管理",
  "content.company": "企业资料",
  "content.homepage": "落地设计",
  "content.product": "产品内容",
  "content.proof": "案例视频",
  "content.dam-localization": "素材本地",
  "trust.technical-seo": "技术搜索",
  "trust.keyword-map": "词图规划",
  "trust.onpage": "页面优化",
  "trust.search-share": "排名份额",
  "trust.proof-center": "企业信任",
  "trust.reputation": "口碑公关",
  "recommend.geo-aeo": "智能推荐",
  "recommend.knowledge-graph": "知识图谱",
  "recommend.fact-library": "事实资料",
  "recommend.citation": "引用监测",
  "recommend.structured-data": "结构数据",
  "recommend.channel-feed": "商品刊登",
  "deepen.social-matrix": "社媒矩阵",
  "deepen.content-calendar": "内容日历",
  "deepen.localized-distribution": "本地分发",
  "deepen.listening": "社交聆听",
  "deepen.community": "私域社群",
  "deepen.influence": "直播倡导",
  "portrait.cdp": "客户数据",
  "portrait.identity-resolution": "身份合并",
  "portrait.account-graph": "企业关系",
  "portrait.buying-committee": "采购画像",
  "portrait.timeline": "行为轨迹",
  "portrait.segments-consent": "标签同意",
  "lead.ad-accounts": "广告账户",
  "lead.audience": "受众营销",
  "lead.abm": "企业定向",
  "lead.creative": "创意中心",
  "lead.experiments": "投放实验",
  "lead.budget-attribution": "预算归因",
  "convert.inquiry": "渠道询盘",
  "convert.ai-sdr": "智能售前",
  "convert.routing": "线索分配",
  "convert.rfq-sample": "样品管理",
  "convert.cpq-contract": "报价合同",
  "convert.commerce": "订货结账",
  "fulfillment.plm": "产品护照",
  "fulfillment.srm": "供应采购",
  "fulfillment.planning": "产销计划",
  "fulfillment.mes": "制造执行",
  "fulfillment.qms": "质量管理",
  "fulfillment.delivery": "全球交付",
  "care.crm": "客户经营",
  "care.customer-success": "客户资产",
  "care.service-sla": "服务工单",
  "care.warranty-rma": "质保退货",
  "care.renewal-growth": "续约增购",
  "care.partner-voice": "客户之声",
  "decision.cockpit": "健康驾舱",
  "decision.data-warehouse": "数据仓库",
  "decision.metrics": "指标语义",
  "decision.revenue-profit": "利润分析",
  "decision.forecast": "经营预测",
  "decision.ai-command": "智能战情",
  "operations.erp": "经营总台",
  "operations.finance": "财务资金",
  "operations.people": "人事中心",
  "operations.recruiting": "招聘面试",
  "operations.approvals": "审批中心",
  "operations.contracts": "合同法务",
};

export function buildFactoryPlatformFourCharacterLabel(value: string) {
  const clean = value
    .replace(/[A-Za-z]+(?:[&/+.-][A-Za-z]+)*/gu, "")
    .replace(/[（）()【】[\]·：:，,。.!！?？\s]/gu, "")
    .replace(/[与及和]/gu, "");
  const source = clean || value.replace(/\s+/gu, "");
  return Array.from(source).slice(0, 4).join("");
}

function appendFactoryPlatformCapabilityRoute(route: string, capabilityIndex: number) {
  return `${route}${route.includes("?") ? "&" : "?"}capability=${capabilityIndex + 1}`;
}

function defineCategory<const TKey extends FactoryPlatformCategoryKey>(
  category: FactoryPlatformCategoryDraft<TKey>,
): FactoryPlatformCategory<TKey> {
  return {
    ...category,
    applications: category.applications.map((application) => ({
      ...application,
      navigationLabel: FACTORY_PLATFORM_PRIMARY_NAVIGATION_LABELS[application.id]
        || buildFactoryPlatformFourCharacterLabel(application.label),
      navigationChildren: application.navigationChildren ?? application.capabilities.map((capability, capabilityIndex) => ({
        id: `${application.id}.capability.${capabilityIndex + 1}`,
        label: buildFactoryPlatformFourCharacterLabel(capability),
        fullLabel: capability,
        route: appendFactoryPlatformCapabilityRoute(application.route, capabilityIndex),
      })),
      deliveryStatus: application.deliveryStatus
        ?? (application.route.includes("tab=blueprint") ? "planned" : "pilot"),
    })) as unknown as AtLeastSix<FactoryPlatformApplication<TKey>>,
  };
}

const ALL_MODES = FACTORY_PLATFORM_MODES;

const FACTORY_PLATFORM_CATEGORY_DEFINITIONS = [
  defineCategory({
    order: "12",
    key: "operations",
    label: "固本(经营)",
    title: "企业经营与治理底座",
    value: "统一组织、资金、合同和经营主数据，让增长结果最终回到利润与现金流。",
    phase: "revenue-loop",
    audience: ["factory_owner", "executive", "finance", "hr", "operations", "it"],
    modes: ALL_MODES,
    applications: [
      {
        id: "operations.erp",
        category: "operations",
        label: "经营总台",
        value: "统一公司、工厂、项目、订单和成本中心，形成经营事实底账。",
        phase: "revenue-loop",
        audience: ["factory_owner", "executive", "operations", "finance"],
        modes: ALL_MODES,
        route: "/erp",
        deliveryStatus: "available",
        capabilities: ["多组织经营账", "订单项目核算", "成本与利润中心"],
        metrics: ["订单毛利", "经营结账周期"],
      },
      {
        id: "operations.finance",
        category: "operations",
        label: "财务资金",
        value: "贯通应收应付、预算、收付款、多币种和现金流，避免业务财务两张账。",
        phase: "revenue-loop",
        audience: ["factory_owner", "finance", "executive"],
        modes: ALL_MODES,
        route: "/finance",
        deliveryStatus: "available",
        capabilities: ["应收应付", "预算与费用", "多币种资金"],
        metrics: ["现金转换周期", "预算偏差率"],
      },
      {
        id: "operations.people",
        category: "operations",
        label: "人事中心",
        value: "把组织、员工、合同、绩效和培训连接到岗位产能与人效。",
        phase: "manufacturing-loop",
        audience: ["factory_owner", "hr", "executive"],
        modes: ALL_MODES,
        route: "/people",
        deliveryStatus: "available",
        capabilities: ["组织员工档案", "绩效与培训", "薪酬考勤接口"],
        metrics: ["人均产值", "关键岗位稳定率"],
      },
      {
        id: "operations.recruiting",
        category: "operations",
        label: "招聘面试",
        value: "用结构化岗位、人才库和人工复核的AI面试缩短关键人才到岗周期。",
        phase: "manufacturing-loop",
        audience: ["hr", "executive"],
        modes: ALL_MODES,
        route: "/recruiting",
        deliveryStatus: "available",
        capabilities: ["ATS人才库", "结构化面试评分", "Offer与入职交接"],
        metrics: ["招聘周期", "试用期通过率"],
      },
      {
        id: "operations.approvals",
        category: "operations",
        label: "审批中心",
        value: "把费用、采购、报价、用印和例外处理纳入可审计流程。",
        phase: "revenue-loop",
        audience: ["executive", "operations", "finance", "hr"],
        modes: ALL_MODES,
        route: "/approval-center",
        deliveryStatus: "available",
        capabilities: ["流程设计器", "移动审批", "授权与审计"],
        metrics: ["审批时长", "超期事项率"],
      },
      {
        id: "operations.contracts",
        category: "operations",
        label: "合同法务",
        value: "统一合同履约、税票、客户、产品和供应商编码，保护全链路数据一致性。",
        phase: "revenue-loop",
        audience: ["executive", "finance", "sales", "procurement", "it"],
        modes: ALL_MODES,
        route: "/contract-legal",
        deliveryStatus: "available",
        capabilities: ["合同生命周期", "税票与用印", "主数据和系统集成"],
        metrics: ["合同履约率", "主数据重复率"],
      },
    ],
  }),
  defineCategory({
    order: "09",
    key: "fulfillment",
    label: "强链(履约)",
    title: "供应、制造与全球交付链",
    value: "把成交订单变成可计划、可追溯、准时且合格交付的产品。",
    phase: "manufacturing-loop",
    audience: ["factory_owner", "operations", "engineering", "procurement", "production", "quality", "warehouse"],
    modes: ALL_MODES,
    applications: [
      {
        id: "fulfillment.plm",
        category: "fulfillment",
        label: "产品护照",
        value: "统一工程版本、规格、BOM、供应商、批次、证书和客户资产追溯，保证卖的、造的、交的与证据一致。",
        phase: "manufacturing-loop",
        audience: ["engineering", "production", "quality"],
        modes: ALL_MODES,
        route: "/product-passports",
        capabilities: ["工程版本与BOM", "供应批次追溯", "证书与数字护照"],
        metrics: ["BOM准确率", "批次追溯率", "护照发布率"],
        deliveryStatus: "available",
      },
      {
        id: "fulfillment.srm",
        category: "fulfillment",
        label: "供应采购",
        value: "从供应商准入、工程BOM需求、采购审批、正式下单到独立收货证据统一协同，不把供应商承诺当作到货事实。",
        phase: "manufacturing-loop",
        audience: ["procurement", "quality", "finance"],
        modes: ALL_MODES,
        route: "/procurement",
        capabilities: ["供应商准入", "BOM采购订单", "承诺与收货分离"],
        metrics: ["采购准交率", "准入覆盖率", "收货证据完整率"],
        deliveryStatus: "available",
      },
      {
        id: "fulfillment.planning",
        category: "fulfillment",
        label: "产销计划",
        value: "把确认订单、工程BOM、真实采购收货与有限产能联动成可兑现计划，缺料或延期时禁止释放。",
        phase: "manufacturing-loop",
        audience: ["operations", "procurement", "production", "sales"],
        modes: ALL_MODES,
        route: "/production-plans",
        capabilities: ["订单需求协同", "MRP缺料计算", "有限产能排程"],
        metrics: ["计划达成率", "缺料清零率", "准时可释放率"],
        deliveryStatus: "available",
      },
      {
        id: "fulfillment.mes",
        category: "fulfillment",
        label: "制造执行",
        value: "让工单、派工、报工、在制品和设备状态实时进入订单履约链。",
        phase: "manufacturing-loop",
        audience: ["production", "operations", "engineering"],
        modes: ALL_MODES,
        route: "/manufacturing-execution",
        capabilities: ["计划转制造工单", "物料批次谱系", "顺序报工与停机恢复"],
        metrics: ["工单达成率", "一次良品率", "停机恢复时长"],
        deliveryStatus: "available",
      },
      {
        id: "fulfillment.qms",
        category: "fulfillment",
        label: "质量管理",
        value: "以订单、工单和批次为权威来源，贯通五项检验、NCR、CAPA与批准放行，形成客户可验证的质量证据。",
        phase: "manufacturing-loop",
        audience: ["quality", "production", "procurement", "service"],
        modes: ALL_MODES,
        route: "/quality-inspections",
        capabilities: ["五项检验", "NCR与CAPA", "批次质量放行"],
        metrics: ["一次合格率", "异常闭环周期", "放行可追溯率"],
        deliveryStatus: "available",
      },
      {
        id: "fulfillment.delivery",
        category: "fulfillment",
        label: "全球交付",
        value: "统一订单、库存、批次、包装、订舱、物流和退货，缩短从成交到回款的距离。",
        phase: "manufacturing-loop",
        audience: ["operations", "warehouse", "sales", "service", "finance"],
        modes: ALL_MODES,
        route: "/fulfillment-orders",
        capabilities: ["订单履约", "仓储批次", "全球物流与RMA"],
        metrics: ["准时足量交付率", "库存周转天数"],
        deliveryStatus: "available",
      },
    ],
  }),
  defineCategory({
    order: "01",
    key: "identity",
    label: "蓄势(身份)",
    title: "产品、市场与品牌身份",
    value: "先回答卖什么、卖给谁和为何购买，再投入内容与流量。",
    phase: "revenue-loop",
    audience: ["factory_owner", "executive", "marketing", "sales"],
    modes: ALL_MODES,
    applications: [
      { id: "identity.product-intelligence", category: "identity", label: "产品分析", value: "发现有利润和增长空间的产品机会。", phase: "revenue-loop", audience: ["factory_owner", "marketing"], modes: ALL_MODES, route: "/product-analysis", capabilities: ["关键词需求", "趋势洞察", "产品机会评分"], metrics: ["机会产品数", "选品命中率"], deliveryStatus: "available" },
      { id: "identity.market-radar", category: "identity", label: "全球市场机会雷达", value: "按国家、行业、渠道和需求识别进入优先级。", phase: "revenue-loop", audience: ["executive", "marketing", "sales"], modes: ALL_MODES, route: "/product-analysis?tab=market-finder", capabilities: ["国家机会", "行业容量", "进入门槛"], metrics: ["市场机会分", "新市场收入"], deliveryStatus: "available" },
      { id: "identity.competitive-pricing", category: "identity", label: "竞品价格情报", value: "持续比较竞品、价格带、卖点和渠道动作。", phase: "global-intelligence", audience: ["marketing", "sales"], modes: ALL_MODES, route: "/product-analysis?tab=global-market", capabilities: ["竞品监测", "价格带分析", "差异机会"], metrics: ["价格竞争力", "竞品覆盖率"], deliveryStatus: "available" },
      { id: "identity.icp", category: "identity", label: "ICP客户定位", value: "以不可变客群标准、权威业务证据和可解释评分统一获客、内容与销售。", phase: "revenue-loop", audience: ["marketing", "sales"], modes: ALL_MODES, route: "/icp-profiles", capabilities: ["企业ICP", "购买委员会", "证据评分"], metrics: ["ICP线索占比", "目标客群成交率"], deliveryStatus: "available" },
      { id: "identity.brand", category: "identity", label: "品牌定位与网站风格", value: "把产品价值转成可复用的品牌主张、视觉和语气。", phase: "revenue-loop", audience: ["factory_owner", "marketing"], modes: ALL_MODES, route: "/brand-studio", capabilities: ["价值主张", "品牌与VI", "网站风格"], metrics: ["品牌一致率", "品牌搜索量"], deliveryStatus: "available" },
      { id: "identity.digital-assets", category: "identity", label: "AI计划与数字资产", value: "集中管理AI建站计划、域名和品牌数字资产。", phase: "revenue-loop", audience: ["marketing", "it", "agency_operator"], modes: ALL_MODES, route: "/digital-assets", capabilities: ["AI建站计划", "域名资产", "品牌助手"], metrics: ["上线周期", "资产完整率"], deliveryStatus: "available" },
    ],
  }),
  defineCategory({
    order: "02",
    key: "content",
    label: "布场(内容)",
    title: "全球内容与数字阵地",
    value: "将企业、产品和信任证据变成多站点、多语言、可复用的销售内容。",
    phase: "revenue-loop",
    audience: ["marketing", "sales", "agency_operator"],
    modes: ALL_MODES,
    applications: [
      { id: "content.cms", category: "content", label: "多站点CMS", value: "统一国内外官网、品牌站和活动站的内容发布。", phase: "revenue-loop", audience: ["marketing", "agency_operator"], modes: ALL_MODES, route: "/site-management", capabilities: ["多站管理", "多语言", "版本发布"], metrics: ["发布周期", "站点覆盖率"], deliveryStatus: "available" },
      { id: "content.company", category: "content", label: "企业资料中心", value: "让公司能力、工厂、团队和资质保持同源。", phase: "revenue-loop", audience: ["marketing", "sales"], modes: ALL_MODES, route: "/company-info", capabilities: ["企业资料", "公司介绍", "服务保障", "联系我们", "资质证书"], metrics: ["资料完整率", "内容复用率"], deliveryStatus: "available" },
      { id: "content.homepage", category: "content", label: "首页与落地页设计器", value: "按市场和人群快速组合高转化页面。", phase: "revenue-loop", audience: ["marketing", "agency_operator"], modes: ALL_MODES, route: "/company-info?tab=navigation", capabilities: ["首页设计", "行业区块", "转化组件"], metrics: ["页面上线时长", "页面转化率"], deliveryStatus: "available" },
      { id: "content.product", category: "content", label: "产品内容中心", value: "将产品事实转成渠道可用的图文、规格与问答。", phase: "revenue-loop", audience: ["marketing", "sales", "engineering"], modes: ALL_MODES, route: "/products", capabilities: ["产品中心", "规格参数", "渠道版本"], metrics: ["内容完整率", "渠道上架时长"], deliveryStatus: "available" },
      { id: "content.proof", category: "content", label: "案例新闻与视频", value: "用工程案例、新闻、博客和视频持续证明交付能力。", phase: "revenue-loop", audience: ["marketing", "sales"], modes: ALL_MODES, route: "/cases", capabilities: ["工程案例", "新闻中心", "企业视频", "博客中心"], metrics: ["证据内容数", "内容助攻商机额"], deliveryStatus: "available" },
      { id: "content.dam-localization", category: "content", label: "DAM素材与本地化", value: "以版权范围、不可变术语、异人质量复核和区域评估发布国家内容包。", phase: "global-intelligence", deliveryStatus: "available", audience: ["marketing", "agency_operator"], modes: ALL_MODES, route: "/dam-localization", capabilities: ["素材本地", "翻译术语库", "国家内容包"], metrics: ["素材复用率", "本地化周期"] },
    ],
  }),
  defineCategory({
    order: "03",
    key: "trust",
    label: "营搜(信任)",
    title: "搜索可见与可信证明",
    value: "让买家搜索得到、看得懂并验证工厂值得合作。",
    phase: "revenue-loop",
    audience: ["marketing", "sales"],
    modes: ALL_MODES,
    applications: [
      { id: "trust.technical-seo", category: "trust", label: "技术SEO", value: "持续修复抓取、索引、性能和站点健康问题。", phase: "revenue-loop", audience: ["marketing", "it"], modes: ALL_MODES, route: "/seo?tab=audit", capabilities: ["站点审计", "索引诊断", "性能治理"], metrics: ["可索引页面率", "自然流量"], deliveryStatus: "available" },
      { id: "trust.keyword-map", category: "trust", label: "关键词主题地图", value: "按产品、痛点和采购阶段规划搜索内容。", phase: "revenue-loop", audience: ["marketing", "sales"], modes: ALL_MODES, route: "/seo?tab=keywords", capabilities: ["关键词挖掘", "主题聚类", "意图映射"], metrics: ["关键词覆盖率", "有效搜索访问"], deliveryStatus: "available" },
      { id: "trust.onpage", category: "trust", label: "页面SEO助手", value: "统一TDK、内链、结构和内容质量规则。", phase: "revenue-loop", audience: ["marketing"], modes: ALL_MODES, route: "/seo?tab=meta", capabilities: ["TDK模板", "内链建议", "内容评分"], metrics: ["优化完成率", "索引增长率"], deliveryStatus: "available" },
      { id: "trust.search-share", category: "trust", label: "排名与搜索份额", value: "同时跟踪排名、竞品和品牌搜索份额。", phase: "global-intelligence", audience: ["marketing", "executive"], modes: ALL_MODES, route: "/seo?tab=ranking", capabilities: ["排名追踪", "竞品份额", "地域搜索"], metrics: ["搜索份额", "Top10关键词数"], deliveryStatus: "available" },
      { id: "trust.proof-center", category: "trust", label: "企业信任中心", value: "集中呈现认证、检测、保障、产能和交付证明。", phase: "revenue-loop", audience: ["marketing", "sales", "quality"], modes: ALL_MODES, route: "/company-info?tab=service", capabilities: ["认证证书", "检测报告", "服务保障"], metrics: ["信任资产完整率", "信任页转化率"], deliveryStatus: "available" },
      { id: "trust.reputation", category: "trust", label: "口碑与数字公关", value: "管理评价、媒体、外链和负面舆情。", phase: "global-intelligence", audience: ["marketing", "service"], modes: ALL_MODES, route: "/seo?tab=backlinks", capabilities: ["评价管理", "数字公关", "舆情预警"], metrics: ["正向口碑率", "高质量引用数"], deliveryStatus: "available" },
    ],
  }),
  defineCategory({
    order: "04",
    key: "recommend",
    label: "占新(推荐)",
    title: "AI搜索与平台推荐",
    value: "让产品事实进入AI答案、知识图谱和国内外平台推荐流。",
    phase: "global-intelligence",
    audience: ["marketing", "sales", "it"],
    modes: ALL_MODES,
    applications: [
      { id: "recommend.geo-aeo", category: "recommend", label: "GEO/AEO中心", value: "围绕买家问题生产可被AI理解和引用的答案。", phase: "global-intelligence", audience: ["marketing"], modes: ALL_MODES, route: "/geo-center", capabilities: ["问题地图", "答案工程", "发布计划"], metrics: ["AI可见率", "答案覆盖率"], deliveryStatus: "available" },
      { id: "recommend.knowledge-graph", category: "recommend", label: "企业知识图谱", value: "以权威来源指纹、异人验证和不可变版本连接企业、产品、能力、证书、案例和市场实体。", phase: "global-intelligence", audience: ["marketing", "it", "engineering"], modes: ALL_MODES, route: "/knowledge-graph", capabilities: ["实体关系", "产品能力图", "事实溯源"], metrics: ["实体完整率", "事实复用率"], deliveryStatus: "available" },
      { id: "recommend.fact-library", category: "recommend", label: "AI可读事实库", value: "把权威产品与企业事实变成可验证的问答素材。", phase: "global-intelligence", audience: ["marketing", "sales", "quality"], modes: ALL_MODES, route: "/geo-center?tab=writing", capabilities: ["事实卡片", "产品问答", "证据引用"], metrics: ["事实覆盖率", "答案采用率"], deliveryStatus: "available" },
      { id: "recommend.citation", category: "recommend", label: "AI引用监测", value: "以范围化、可复核的观察监测品牌在不同模型、问题和国家中的出现与引用。", phase: "global-intelligence", audience: ["marketing", "executive"], modes: ALL_MODES, route: "/geo-center?tab=llm-reports", capabilities: ["模型监测", "引用来源", "竞品对比"], metrics: ["AI引用率", "AI推荐份额"], deliveryStatus: "available" },
      { id: "recommend.structured-data", category: "recommend", label: "结构化数据中心", value: "从已发布企业知识图谱生成经异人验证、规则校验、不可变哈希发布和渠道确认的机器可读表达。", phase: "global-intelligence", audience: ["marketing", "it"], modes: ALL_MODES, route: "/structured-data", capabilities: ["Schema映射", "数据校验", "发布监测"], metrics: ["有效结构化数据率", "富结果覆盖率"], deliveryStatus: "available" },
      { id: "recommend.channel-feed", category: "recommend", label: "商品Feed与平台刊登", value: "以不可变结构化商品事实、渠道凭证引用、权威价格库存边界、异人验证和渠道回执同步搜索、商城与行业平台。", phase: "global-intelligence", audience: ["marketing", "operations"], modes: ALL_MODES, route: "/channel-feed", capabilities: ["商品Feed", "平台刊登", "库存价格同步"], metrics: ["渠道覆盖率", "刊登错误率"], deliveryStatus: "available" },
    ],
  }),
  defineCategory({
    order: "05",
    key: "deepen",
    label: "圈养(深耕)",
    title: "社交影响与私域深耕",
    value: "持续经营社交触点、专家影响力和可重复触达的私域关系。",
    phase: "revenue-loop",
    audience: ["marketing", "sales", "service"],
    modes: ALL_MODES,
    applications: [
      { id: "deepen.social-matrix", category: "deepen", label: "国内外社媒矩阵", value: "集中登记、核验和治理国内外社交账号、主页资产与授权证据。", phase: "revenue-loop", audience: ["marketing", "agency_operator"], modes: ALL_MODES, route: "/social?tab=accounts", capabilities: ["授权申请", "主页资产", "矩阵治理", "运营规则"], metrics: ["有效账号数", "渠道覆盖率"], navigationChildren: getFactoryPlatformSocialWorkspaceNavigationChildren("deepen.social-matrix"), deliveryStatus: "available" },
      { id: "deepen.content-calendar", category: "deepen", label: "内容日历", value: "按市场、产品和客户痛点编排经审核的持续内容与发布任务。", phase: "revenue-loop", audience: ["marketing", "sales"], modes: ALL_MODES, route: "/social?tab=schedule", capabilities: ["选题规划", "协作审核", "发布队列与回执"], metrics: ["准时发布率", "内容产能"], navigationChildren: getFactoryPlatformSocialWorkspaceNavigationChildren("deepen.content-calendar"), deliveryStatus: "available" },
      { id: "deepen.localized-distribution", category: "deepen", label: "AI本地化分发", value: "针对语言、平台和文化形成草稿并通过人工本地化与商业承诺审核。", phase: "global-intelligence", audience: ["marketing"], modes: ALL_MODES, route: "/social?tab=create", capabilities: ["文案适配", "多语言版本", "本地化审核"], metrics: ["本地化周期", "内容互动率"], navigationChildren: getFactoryPlatformSocialWorkspaceNavigationChildren("deepen.localized-distribution"), deliveryStatus: "available" },
      { id: "deepen.listening", category: "deepen", label: "社交聆听", value: "以公开来源或已核验快照评估品牌、竞品、需求和购买信号。", phase: "global-intelligence", audience: ["marketing", "sales", "service"], modes: ALL_MODES, route: "/social?tab=analytics", capabilities: ["公开信号评估", "意向信号", "人工分流"], metrics: ["意向信号数", "响应时长"], navigationChildren: getFactoryPlatformSocialWorkspaceNavigationChildren("deepen.listening"), deliveryStatus: "available" },
      { id: "deepen.community", category: "deepen", label: "私域社群", value: "以互动规则、线索资格、人工复核和 CRM 交接沉淀长期关系。", phase: "revenue-loop", audience: ["marketing", "sales", "service"], modes: ALL_MODES, route: "/social?tab=automation", capabilities: ["社群分层", "线索待办", "人工复核与交接"], metrics: ["活跃成员率", "社群转化额"], navigationChildren: getFactoryPlatformSocialWorkspaceNavigationChildren("deepen.community"), deliveryStatus: "available" },
      { id: "deepen.influence", category: "deepen", label: "KOL直播与客户倡导", value: "联合专家、客户和员工，以任务、素材权利和人工验收生产可信口碑内容。", phase: "global-intelligence", audience: ["marketing", "sales"], modes: ALL_MODES, route: "/social?tab=digital-human", capabilities: ["视频任务", "素材权利", "客户倡导治理"], metrics: ["影响触达量", "社交助攻收入"], navigationChildren: getFactoryPlatformSocialWorkspaceNavigationChildren("deepen.influence"), deliveryStatus: "available" },
    ],
  }),
  defineCategory({
    order: "07",
    key: "lead",
    label: "精投(截流)",
    title: "精准投放与需求截流",
    value: "只为目标市场和高意向人群购买流量，并能追到收入结果。",
    phase: "revenue-loop",
    audience: ["marketing", "sales", "finance"],
    modes: ALL_MODES,
    applications: [
      { id: "lead.ad-accounts", category: "lead", label: "全球广告账户中心", value: "统一国内外广告账户、权限、资产和合规。", phase: "revenue-loop", audience: ["marketing", "agency_operator"], modes: ALL_MODES, route: "/smart-ads?tab=platforms", capabilities: ["账户连接", "资产治理", "异常预警"], metrics: ["可用账户率", "异常恢复时长"], deliveryStatus: "available" },
      { id: "lead.audience", category: "lead", label: "受众与再营销", value: "用统一画像构建排除、相似和再营销人群。", phase: "revenue-loop", audience: ["marketing", "sales"], modes: ALL_MODES, route: "/smart-ads?tab=campaigns", capabilities: ["受众同步", "再营销", "频次控制"], metrics: ["受众匹配率", "再营销转化率"], deliveryStatus: "available" },
      { id: "lead.abm", category: "lead", label: "企业定向", value: "从有效同意分群与完整采购委员会固定目标企业，按角色编排异人批准的营销销售剧本，发布不可变计划并由CRM、营销、广告和销售回执。", phase: "revenue-loop", audience: ["marketing", "sales"], modes: ["domestic", "overseas", "b2b"], route: "/abm", capabilities: ["目标企业", "角色剧本", "销售协同"], metrics: ["目标企业数", "角色覆盖率", "激活回执率"], deliveryStatus: "available" },
      { id: "lead.creative", category: "lead", label: "创意中心", value: "以已发布ABM采购角色与权利合规国家内容包生成可追溯创意，AI仅辅助并强制人工异人审核，发布不可变版本与渠道回执。", phase: "global-intelligence", audience: ["marketing"], modes: ALL_MODES, route: "/creative-center", capabilities: ["角色创意", "人工审核", "素材版本"], metrics: ["批准创意数", "角色覆盖率", "渠道回执率"], deliveryStatus: "available" },
      { id: "lead.experiments", category: "lead", label: "投放实验中心", value: "持续验证素材、受众、页面和报价组合。", phase: "global-intelligence", audience: ["marketing", "sales"], modes: ALL_MODES, route: "/smart-ads?tab=compare", capabilities: ["A/B实验", "增量评估", "胜出策略"], metrics: ["实验胜率", "增量转化"], deliveryStatus: "available" },
      { id: "lead.budget-attribution", category: "lead", label: "预算出价与归因", value: "把预算从点击指标转向合格线索、毛利和回款。", phase: "global-intelligence", audience: ["marketing", "finance", "executive"], modes: ALL_MODES, route: "/smart-ads?tab=overview", capabilities: ["预算优化", "无效流量防护", "收入归因"], metrics: ["获客成本", "广告毛利回报"], deliveryStatus: "available" },
    ],
  }),
  defineCategory({
    order: "08",
    key: "convert",
    label: "承转(转化)",
    title: "询盘、报价与成交转化",
    value: "把每个访问、询问和样品机会转成可跟踪的合同与订单。",
    phase: "revenue-loop",
    audience: ["sales", "marketing", "operations", "finance"],
    modes: ALL_MODES,
    applications: [
      { id: "convert.inquiry", category: "convert", label: "全渠道询盘", value: "统一网站、邮件、社媒、商城和平台询盘。", phase: "revenue-loop", audience: ["sales", "marketing"], modes: ALL_MODES, route: "/inquiries", capabilities: ["询盘聚合", "去重反垃圾", "来源追踪"], metrics: ["有效询盘数", "首次响应时长"], deliveryStatus: "available" },
      { id: "convert.ai-sdr", category: "convert", label: "AI售前", value: "固定已独立验证的ICP适配证据，在人工控制下完成补全、初筛、回复建议与销售回执。", phase: "global-intelligence", audience: ["sales", "marketing"], modes: ALL_MODES, route: "/ai-sdr", capabilities: ["证据补全", "人工初筛", "销售交接"], metrics: ["人工复核率", "合格线索率", "交接回执率"], deliveryStatus: "available" },
      { id: "convert.routing", category: "convert", label: "线索评分与分配", value: "按ICP、地区、产品、意向和产能把机会交给正确人员。", phase: "revenue-loop", audience: ["sales", "marketing"], modes: ALL_MODES, route: "/inquiries?tab=rules", capabilities: ["线索评分", "分配路由", "SLA升级"], metrics: ["分配时长", "MQL转SQL率"], deliveryStatus: "available" },
      { id: "convert.rfq-sample", category: "convert", label: "样品管理", value: "固定权威询盘版本，以异人审核完成技术澄清、样品成本与范围审批、发运证据、客户反馈和销售回执。", phase: "revenue-loop", audience: ["sales", "engineering", "operations"], modes: ["domestic", "overseas", "b2b"], route: "/rfq-samples", capabilities: ["询盘版本固定", "需求独立审核", "样品审批发运", "反馈销售回执"], metrics: ["需求审核率", "已发运样品", "样品通过数", "反馈回执率"], deliveryStatus: "available" },
      { id: "convert.cpq-contract", category: "convert", label: "CPQ报价与电子合同", value: "结合成本、MOQ、交期、币种和权限快速生成可执行报价。", phase: "revenue-loop", audience: ["sales", "finance", "operations"], modes: ALL_MODES, route: "/cpq-quotes", capabilities: ["配置定价", "报价审批", "电子合同"], metrics: ["报价周期", "报价胜率"], deliveryStatus: "available" },
      { id: "convert.commerce", category: "convert", label: "订货结账", value: "统一承接已接受B2B报价或带权威价格库存引用的B2C商品，以条款、支付异人核验和OMS权威回执完成交易闭环。", phase: "manufacturing-loop", audience: ["sales", "operations", "finance"], modes: ALL_MODES, route: "/commerce", capabilities: ["双模式结账", "条款独立审核", "支付证据核验", "OMS订单回执"], metrics: ["B2B订货数", "B2C结账数", "条款审核率", "订单确认率"], deliveryStatus: "available" },
    ],
  }),
  defineCategory({
    order: "06",
    key: "portrait",
    label: "锁客(画像)",
    title: "统一客户身份与购买画像",
    value: "把匿名访问、联系人、企业、采购角色和交易行为合并成可用画像。",
    phase: "revenue-loop",
    audience: ["marketing", "sales", "service", "it"],
    modes: ALL_MODES,
    applications: [
      { id: "portrait.cdp", category: "portrait", label: "CDP客户数据平台", value: "以同账户、已发布的身份、客户旅程与同意分群版本组合可回执的数据产品，不复制原始标识或改写来源。", phase: "revenue-loop", audience: ["marketing", "sales", "it"], modes: ALL_MODES, route: "/customer-data-platform", capabilities: ["版本产品", "客户档案", "受控激活"], metrics: ["客户覆盖率", "回执完整率"], deliveryStatus: "available" },
      { id: "portrait.identity-resolution", category: "portrait", label: "身份合并", value: "在明确同意与用途边界内，以不可逆哈希、来源指纹、异人核验和人工裁决合并账户、联系人、邮箱与设备，发布可回执的黄金客户档案。", phase: "global-intelligence", audience: ["marketing", "sales", "it"], modes: ALL_MODES, route: "/identity-resolution", capabilities: ["身份匹配", "去重合并", "冲突审计"], metrics: ["身份匹配率", "重复客户率"], deliveryStatus: "available" },
      { id: "portrait.account-graph", category: "portrait", label: "B2B企业关系图", value: "以法务主体、黄金账户、已同意联系人、CPQ商机和履约订单为权威节点，异人核验企业层级、联系人、渠道与交易关系并发布不可变版本。", phase: "global-intelligence", audience: ["sales", "service"], modes: ["domestic", "overseas", "b2b"], route: "/account-graph", capabilities: ["企业层级", "关联联系人", "渠道关系"], metrics: ["关系完整率", "账户覆盖深度"], deliveryStatus: "available" },
      { id: "portrait.buying-committee", category: "portrait", label: "采购画像", value: "固定真实CPQ商机、已启用ICP采购角色与已授权联系人，通过成员及影响路径异人核验，形成可回执的多线程决策委员会。", phase: "global-intelligence", audience: ["sales", "marketing"], modes: ["domestic", "overseas", "b2b"], route: "/buying-committee", capabilities: ["角色覆盖", "影响路径", "多线程决策"], metrics: ["关键角色覆盖率", "多线程商机率", "下游回执率"], deliveryStatus: "available" },
      { id: "portrait.timeline", category: "portrait", label: "行为轨迹", value: "按真实发生时间串联内容触点、询盘、报价、订单与服务五类权威事件，以修订指纹、异人核验和不可变版本形成可回执客户旅程。", phase: "revenue-loop", audience: ["marketing", "sales", "service"], modes: ALL_MODES, route: "/customer-timeline", capabilities: ["行为轨迹", "关键节点", "来源归因"], metrics: ["行为可追溯率", "高意向事件数", "下游回执率"], deliveryStatus: "available" },
      { id: "portrait.segments-consent", category: "portrait", label: "标签同意", value: "基于有效同意、已核验身份和不可变客户时间线，以确定性规则、异人核验和版本回执管理动态分群与触达资格；撤回同意即刻排除。", phase: "revenue-loop", audience: ["marketing", "service", "it"], modes: ALL_MODES, route: "/segments-consent", capabilities: ["动态标签", "同意资格", "分群回执"], metrics: ["有效分群数", "同意资格率", "下游回执率"], deliveryStatus: "available" },
    ],
  }),
  defineCategory({
    order: "10",
    key: "care",
    label: "深养(伴护)",
    title: "客户成功与长期价值",
    value: "从首次成交延伸到交付服务、复购、续约、增购和客户倡导。",
    phase: "revenue-loop",
    audience: ["sales", "service", "operations", "factory_owner"],
    modes: ALL_MODES,
    applications: [
      { id: "care.crm", category: "care", label: "CRM客户经营台", value: "统一客户、联系人、商机、任务和沟通记录。", phase: "revenue-loop", audience: ["sales", "service"], modes: ALL_MODES, route: "/customers", capabilities: ["客户商机", "跟进任务", "沟通协作"], metrics: ["商机推进率", "销售周期"], deliveryStatus: "available" },
      { id: "care.customer-success", category: "care", label: "客户资产与成功中心", value: "以装机资产、保修、服务结果和续费行动持续经营客户价值。", phase: "manufacturing-loop", audience: ["service", "sales", "executive"], modes: ALL_MODES, route: "/customer-assets", capabilities: ["装机档案", "资产健康", "服务续费"], metrics: ["资产覆盖率", "服务解决率", "续费行动率"], deliveryStatus: "available" },
      { id: "care.service-sla", category: "care", label: "现场服务与SLA", value: "以客户装机资产为权威入口，贯通技能授权、派工、到场、诊断、工时、备件凭证、客户签收和SLA升级。", phase: "manufacturing-loop", audience: ["service", "quality", "operations"], modes: ALL_MODES, route: "/field-service", capabilities: ["技能派工", "现场服务留证", "客户签收与SLA"], metrics: ["首次解决率", "SLA达成率", "客户签收率"], deliveryStatus: "available" },
      { id: "care.warranty-rma", category: "care", label: "质保退货与RMA", value: "以已解决服务工单为入口，分离质保资格、退回授权、运输、独立收货、QMS检验、责任处置、预计成本与客户确认。", phase: "manufacturing-loop", audience: ["service", "quality", "finance"], modes: ALL_MODES, route: "/warranty-rma", capabilities: ["质保资格与授权", "退回收货与QMS检验", "处置成本与客户确认"], metrics: ["RMA闭环周期", "质保成本率", "客户确认率"], deliveryStatus: "available" },
      { id: "care.renewal-growth", category: "care", label: "续约复购与增购", value: "以装机资产、服务、质保RMA和客户确认形成健康评估与增长建议，经独立审批后交由CPQ报价、OMS确认订单。", phase: "global-intelligence", audience: ["sales", "service", "marketing"], modes: ALL_MODES, route: "/renewal-growth", capabilities: ["资产健康与续约风险", "复购增购建议审批", "CPQ与OMS成交验证"], metrics: ["复购率", "净收入留存率", "建议成交率"], deliveryStatus: "available" },
      { id: "care.partner-voice", category: "care", label: "经销商与客户之声", value: "以经销商关系证据、客户订单与装机资产为入口，贯通伙伴审批、客户学院、VOC/NPS整改、客户确认和授权倡导。", phase: "revenue-loop", audience: ["sales", "service", "marketing"], modes: ALL_MODES, route: "/partner-voice", capabilities: ["伙伴准入与学院", "VOC与NPS闭环", "授权客户倡导"], metrics: ["伙伴活跃率", "NPS", "反馈闭环率"], deliveryStatus: "available" },
    ],
  }),
  defineCategory({
    order: "11",
    key: "decision",
    label: "驭数(决策)",
    title: "统一指标与经营决策",
    value: "把营销、销售、制造、客户和财务事实变成可行动的经营判断。",
    phase: "revenue-loop",
    audience: ["factory_owner", "executive", "finance", "operations"],
    modes: ALL_MODES,
    applications: [
      { id: "decision.cockpit", category: "decision", label: "健康驾舱", value: "只读汇总报价、订单、质量、资产、服务、VOC、回款和伙伴权威事实，生成可审计健康快照，异常必须经责任任务和独立验证闭环。", phase: "revenue-loop", audience: ["factory_owner", "executive"], modes: ALL_MODES, route: "/health-cockpit", capabilities: ["跨系统经营健康快照", "权威来源与异常下钻", "责任任务与独立验证"], metrics: ["加权健康分", "数据覆盖率", "异常闭环率"], deliveryStatus: "available" },
      { id: "decision.data-warehouse", category: "decision", label: "经营数据仓库", value: "只读复制各权威业务系统事实，以来源ID和修订号固化不可变版本；每次装载都必须保留批次血缘、通过质量校验并由独立角色发布。", phase: "revenue-loop", audience: ["it", "executive", "finance"], modes: ALL_MODES, route: "/data-warehouse", capabilities: ["受控来源与模式审批", "不可变事实版本与批次血缘", "质量阻断与独立发布"], metrics: ["装载新鲜度", "质量通过率", "血缘覆盖率"], deliveryStatus: "available" },
      { id: "decision.metrics", category: "decision", label: "指标语义中心", value: "把稳定指标身份、不可变口径版本和已发布仓库事实绑定起来，经过独立审批、计算与复核后形成可追溯经营指标，历史结果不被新口径静默重算。", phase: "revenue-loop", audience: ["executive", "finance", "it"], modes: ALL_MODES, route: "/metric-center", capabilities: ["声明式指标口径", "口径版本审批", "仓库血缘计算", "独立复核发布"], metrics: ["口径复用率", "血缘覆盖率", "独立复核率"], deliveryStatus: "available" },
      { id: "decision.revenue-profit", category: "decision", label: "归因与利润分析", value: "把有同意证据的营销触点与已发布回款、报价收入和成本事实进行独立验证绑定，按不可变归因策略计算渠道管理贡献；结果明确不冒充正式财务利润。", phase: "global-intelligence", audience: ["executive", "finance", "marketing", "sales"], modes: ALL_MODES, route: "/revenue-profit", capabilities: ["多触点收入归因", "回款成本事实绑定", "渠道贡献分摊", "独立复核发布"], metrics: ["管理贡献利润", "渠道贡献率", "获客投入回收"], deliveryStatus: "available" },
      { id: "decision.forecast", category: "decision", label: "需求产能与现金预测", value: "固定已发布报价、订单、回款、产能资源、生产计划和采购事实的修订与血缘，按独立审批的假设版本形成需求、产能和现金滚动分桶；结果由独立角色复核发布，不冒充正式财务预测且不回写权威系统。", phase: "global-intelligence", audience: ["executive", "finance", "operations", "sales"], modes: ALL_MODES, route: "/forecast", capabilities: ["六类事实快照", "需求与产能预测", "现金流入流出预测", "独立复核发布"], metrics: ["预测准确率", "产能缺口", "预计净现金变化", "计划响应时长"], deliveryStatus: "available" },
      { id: "decision.ai-command", category: "decision", label: "AI问数与战情中心", value: "以授权数据回答经营问题、模拟方案并把建议转成责任任务。", phase: "global-intelligence", audience: ["factory_owner", "executive", "operations"], modes: ALL_MODES, route: "/ai-command", capabilities: ["自然语言问数", "情景模拟", "风险预警与任务"], metrics: ["决策周期", "建议采纳闭环率"], deliveryStatus: "available" },
    ],
  }),
] as const;

export type FactoryPlatformCategoryRecord = (typeof FACTORY_PLATFORM_CATEGORY_DEFINITIONS)[number];

/**
 * Customer-facing route order. Category keys remain stable while every
 * consumer receives the same identity-to-operations closed-loop sequence.
 */
export const FACTORY_PLATFORM_CATEGORIES: readonly FactoryPlatformCategoryRecord[] =
  FACTORY_PLATFORM_CATEGORY_KEYS.map((key) => {
    const category = FACTORY_PLATFORM_CATEGORY_DEFINITIONS.find((candidate) => candidate.key === key);
    if (!category) throw new Error(`Missing factory platform category definition: ${key}`);
    return category;
  });

export type FactoryPlatformApplicationRecord = FactoryPlatformCategoryRecord["applications"][number];


export function getFactoryPlatformCategory(key: string | null | undefined) {
  return FACTORY_PLATFORM_CATEGORIES.find((category) => category.key === key);
}

export function getFactoryPlatformApplication(id: string | null | undefined) {
  return FACTORY_PLATFORM_CATEGORIES.flatMap((category) => category.applications)
    .find((application) => application.id === id);
}

export function getFactoryPlatformApplicationsByPhase(phase: FactoryPlatformPhaseId) {
  return FACTORY_PLATFORM_CATEGORIES.flatMap((category) => category.applications)
    .filter((application) => application.phase === phase);
}
