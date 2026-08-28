import { DEVELOPMENT_STANDARD_TEMPLATE } from "@/lib/development-standard-template";
import { SHARED_LAYOUT_STYLE_CARD_REGION_CONTRACT } from "@/lib/shared-card-region-contract";

export type SocialMarketingMarket = "dual" | "china" | "overseas";

export type SocialMarketingRole = "headquarters" | "agency-source" | "client-source" | "client-plan";

export type SocialMarketingStage = {
  id: string;
  order: number;
  title: string;
  purpose: string;
  domesticLogic: string;
  overseasLogic: string;
  operationSteps: readonly string[];
  acceptance: readonly string[];
  owner: SocialMarketingRole;
  target: { kind: "social-tab"; value: string } | { kind: "application"; value: string };
  actionLabel: string;
  progressKeys: readonly SocialMarketingProgressKey[];
};

export type SocialMarketingProgressKey =
  | "plan"
  | "settings"
  | "factory"
  | "accounts"
  | "drafts"
  | "videos"
  | "schedules"
  | "leads"
  | "attribution";

export type SocialMarketingSnapshot = Record<SocialMarketingProgressKey, boolean> & {
  accountCount: number;
  draftCount: number;
  videoCount: number;
  scheduleCount: number;
  leadCount: number;
  attributionCount: number;
};

export const SOCIAL_DEVELOPMENT_STANDARD_TEMPLATE = DEVELOPMENT_STANDARD_TEMPLATE;

export const SOCIAL_MARKETING_MARKET_TRACKS = {
  dual: {
    label: "双市场",
    description: "共享工厂资料和转化漏斗，分别执行国内中文与海外多语言营销。",
    channels: "国内平台 + LinkedIn、YouTube、Meta、TikTok 等海外渠道",
    conversion: "统一进入询盘、样品、报价、验厂和订单归因",
  },
  china: {
    label: "国内市场",
    description: "面向经销商、工程采购和企业采购，强调产能、现货、交付、招商与到厂考察。",
    channels: "微信／视频号、抖音、快手、小红书、B站、知乎",
    conversion: "表单／企业微信／电话 → 询价 → 样品／到厂 → 报价 → 订单",
  },
  overseas: {
    label: "海外市场",
    description: "面向进口商、分销商、品牌商和 OEM／ODM 买家，强调 MOQ、认证、交期和质量控制。",
    channels: "LinkedIn、YouTube、Facebook、Instagram、TikTok、X",
    conversion: "落地页／邮件／WhatsApp → RFQ → 样品 → 报价／验厂 → 订单",
  },
} as const;

export const SOCIAL_MARKETING_STAGES: readonly SocialMarketingStage[] = [
  {
    id: "market-strategy",
    order: 1,
    title: "市场定位",
    purpose: "先确定市场、目标买家、主推产品和转化目标，避免只追求播放量和粉丝数。",
    domesticLogic: "按经销、工程采购、企业采购区分客户，确定招商、询价、到厂或样品中的首要目标。",
    overseasLogic: "按国家、语言、进口商／分销商／品牌商和 OEM／ODM 身份确定 RFQ、样品与报价目标。",
    operationSteps: ["选择国内、海外或双市场", "确认目标客户身份与区域", "选择主推产品与转化目标", "设置语言、时区和审核方式"],
    acceptance: ["市场范围已保存", "目标客户和主推产品明确", "审批负责人已确定"],
    owner: "client-plan",
    target: { kind: "social-tab", value: "settings" },
    actionLabel: "进入平台设置",
    progressKeys: ["plan", "settings"],
  },
  {
    id: "factory-profile",
    order: 2,
    title: "工厂建档",
    purpose: "建立可被所有渠道复用的工厂资料底座，内容、回复和报价均从已核验资料取用。",
    domesticLogic: "重点准备工厂规模、产能、现货、交付、招商政策、工程案例和到厂路线。",
    overseasLogic: "重点准备 MOQ、交期、认证、质量控制、包装物流、Incoterms 和 OEM／ODM 能力。",
    operationSteps: ["完善企业基本资料", "登记工厂产能与生产流程", "维护认证、产品和案例", "人工核验商业承诺"],
    acceptance: ["企业和工厂资料齐全", "认证与案例可追溯", "禁止夸大或虚假承诺"],
    owner: "client-source",
    target: { kind: "application", value: "/company-info?tab=factory" },
    actionLabel: "进入工厂资料",
    progressKeys: ["plan", "factory"],
  },
  {
    id: "account-connect",
    order: 3,
    title: "账号连接",
    purpose: "把官方主页和当前独立计划绑定，并按平台真实授权能力开放读取、发布或互动功能。",
    domesticLogic: "优先连接能承接企业咨询的核心国内账号；未获官方能力的平台保留人工任务。",
    overseasLogic: "优先连接 LinkedIn、YouTube、Meta 等核心账号，并记录 OAuth 权限、负责人和到期状态。",
    operationSteps: ["选择渠道", "登记主页归属", "发起官方授权", "检查权限和负责人", "确认撤销与到期提醒"],
    acceptance: ["至少一个核心账号归属正确", "不保存密码、Cookie 或明文令牌", "能力等级与实际授权一致"],
    owner: "headquarters",
    target: { kind: "social-tab", value: "accounts" },
    actionLabel: "进入账号连接",
    progressKeys: ["plan", "accounts"],
  },
  {
    id: "content-kit",
    order: 4,
    title: "内容准备",
    purpose: "从工厂资料生成可审核的渠道内容包，保持产品参数、品牌术语和素材授权一致。",
    domesticLogic: "围绕工厂实力、生产过程、价格区间、交付速度、招商政策和工程案例制作中文内容。",
    overseasLogic: "围绕 MOQ、认证、QC、交期、包装物流、应用案例和 OEM／ODM 制作英语或本地化内容。",
    operationSteps: ["选择市场和买家角色", "选择产品与内容目的", "套用工厂内容模板", "完成术语、承诺和素材审核"],
    acceptance: ["至少一条可审核草稿", "市场和渠道已标记", "素材权利与商业承诺已确认"],
    owner: "agency-source",
    target: { kind: "social-tab", value: "create" },
    actionLabel: "进入内容创作",
    progressKeys: ["plan", "drafts"],
  },
  {
    id: "video-production",
    order: 5,
    title: "视频生产",
    purpose: "用工厂可拍摄、可复核的脚本展示产品、生产、质检、包装和视频验厂能力。",
    domesticLogic: "使用产品亮点、生产过程、发货、工程案例和招商答疑等中文短视频模板。",
    overseasLogic: "使用生产线、质量检测、包装物流、OEM／ODM 流程和视频验厂等多语言模板。",
    operationSteps: ["选择视频场景", "生成并人工修改脚本", "设置语言、字幕和品牌", "登记待拍摄或待渲染任务"],
    acceptance: ["至少一个视频任务", "参数与画面可核验", "字幕和素材授权已确认"],
    owner: "client-source",
    target: { kind: "social-tab", value: "digital-human" },
    actionLabel: "进入视频创作",
    progressKeys: ["plan", "videos"],
  },
  {
    id: "publish-calendar",
    order: 6,
    title: "发布运营",
    purpose: "把已批准内容转为按市场、渠道和时区执行的发布任务，失败和人工任务均可追踪。",
    domesticLogic: "按国内工作日、活动和采购周期安排，不能官方发布时生成明确的人工发布待办。",
    overseasLogic: "按目标国家时区和展会／采购季排期，针对各平台生成适配版本。",
    operationSteps: ["选择已审核内容", "设置渠道和发布时间", "确认平台能力与执行方式", "进入发布队列并检查状态"],
    acceptance: ["至少一个发布任务", "未经审核内容不可正式发布", "失败、重试和人工发布都有记录"],
    owner: "client-plan",
    target: { kind: "social-tab", value: "schedule" },
    actionLabel: "进入发布中心",
    progressKeys: ["plan", "schedules"],
  },
  {
    id: "interaction-lead",
    order: 7,
    title: "互动承接",
    purpose: "把评论、私信、表单和沟通渠道转为有归属、有负责人、有时效的客户线索。",
    domesticLogic: "统一承接微信、电话和表单等线索，按经销、采购、工程和到厂意向分类。",
    overseasLogic: "统一承接邮件、WhatsApp、Messenger 和表单等线索，识别公司、国家、职位和采购意向。",
    operationSteps: ["登记互动来源", "识别客户身份与需求", "设置优先级和 SLA", "人工审核后交接 CRM"],
    acceptance: ["至少一条来源明确的线索", "高意向线索有负责人", "默认人工审核，未批准不派发"],
    owner: "client-plan",
    target: { kind: "social-tab", value: "automation" },
    actionLabel: "进入互动转化",
    progressKeys: ["plan", "leads"],
  },
  {
    id: "sample-quotation",
    order: 8,
    title: "样品报价",
    purpose: "将合格线索继续推进到样品、报价、验厂和商机，避免社媒线索停留在聊天记录。",
    domesticLogic: "确认产品、数量、预算、交期、到厂或样品需求，再交给对应内贸销售。",
    overseasLogic: "确认产品、数量、MOQ、目标价、交期、认证、样品和贸易条件，再交给外贸销售。",
    operationSteps: ["补齐采购资格字段", "确认联系同意", "创建 CRM 交接", "跟踪样品、报价和验厂状态"],
    acceptance: ["线索资格字段完整", "交接有审核和负责人", "状态变化有审计记录"],
    owner: "client-plan",
    target: { kind: "social-tab", value: "automation" },
    actionLabel: "进入线索交接",
    progressKeys: ["plan", "leads"],
  },
  {
    id: "order-attribution",
    order: 9,
    title: "订单归因",
    purpose: "把平台、账号、内容、互动、询盘、样品、报价和订单串为同一条可复盘路径。",
    domesticLogic: "以有效询盘、到厂、样品、报价和成交衡量国内渠道，不以单纯播放量代替销售效果。",
    overseasLogic: "以有效 RFQ、样品、报价、验厂和出口订单衡量海外渠道，并按国家和买家身份复盘。",
    operationSteps: ["建立活动追踪链接", "关联内容与线索", "登记样品、报价和订单结果", "按市场和渠道复盘"],
    acceptance: ["至少一个可追踪活动或归因记录", "指标口径可核验", "客户数据只属于当前计划"],
    owner: "client-plan",
    target: { kind: "social-tab", value: "analytics" },
    actionLabel: "进入数据归因",
    progressKeys: ["plan", "attribution"],
  },
] as const;

export const SOCIAL_MARKETING_CARD_REGION_CONTRACT = {
  version: "1.0.0",
  largeCard: {
    ...SHARED_LAYOUT_STYLE_CARD_REGION_CONTRACT.large,
    expectedCount: SOCIAL_MARKETING_STAGES.length + 2,
  },
  smallCard: {
    ...SHARED_LAYOUT_STYLE_CARD_REGION_CONTRACT.small,
    expectedCount: SOCIAL_MARKETING_STAGES.length * 2,
  },
} as const;

const keyFor = (name: string, siteId?: string | null) => `tradepro.social.${name}.${siteId || "default"}`;

function readArray(key: string) {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readSocialMarketingSnapshot(siteId?: string | null): SocialMarketingSnapshot {
  const accountCount = readArray(keyFor("account-connections", siteId)).length;
  const draftCount = readArray(keyFor("content-drafts", siteId)).length;
  const videoCount = readArray(keyFor("video-tasks", siteId)).length;
  const scheduleCount = readArray(keyFor("publish-tasks", siteId)).length;
  const leadCount = readArray(keyFor("lead-tasks", siteId)).length;
  const attributionCount = readArray(keyFor("campaign-links", siteId)).length;
  const settings = window.localStorage.getItem(keyFor("plan-settings", siteId));
  const factoryConfirmed = window.localStorage.getItem(socialMarketingFactoryConfirmationKey(siteId)) === "confirmed";

  return {
    plan: Boolean(siteId),
    settings: Boolean(settings),
    factory: factoryConfirmed,
    accounts: accountCount > 0,
    drafts: draftCount > 0,
    videos: videoCount > 0,
    schedules: scheduleCount > 0,
    leads: leadCount > 0,
    attribution: attributionCount > 0,
    accountCount,
    draftCount,
    videoCount,
    scheduleCount,
    leadCount,
    attributionCount,
  };
}

export function socialMarketingManualStatusKey(siteId?: string | null) {
  return `tradepro.social.marketing-playbook.manual-status.${siteId || "default"}`;
}

export function socialMarketingMarketViewKey(siteId?: string | null) {
  return `tradepro.social.marketing-playbook.market-view.${siteId || "default"}`;
}

export function socialMarketingFactoryConfirmationKey(siteId?: string | null) {
  return `tradepro.social.marketing-playbook.factory-confirmed.${siteId || "default"}`;
}
