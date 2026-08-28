import { getSocialChannelNames } from "./social-channel-contract";

export type SocialRoadmapOwner = "headquarters" | "agency-source" | "client-source" | "shared";

export type SocialPainPoint = {
  id: string;
  pain: string;
  solution: string;
  customerValue: string;
};

export type SocialRoadmapStage = {
  id: string;
  order: number;
  title: string;
  summary: string;
  owner: SocialRoadmapOwner;
  deliverables: readonly string[];
  nextAction: string;
  targetTab?: "accounts" | "create" | "schedule" | "automation" | "analytics" | "settings";
  developmentVerification?: {
    verifiedAt: string;
    note: string;
  };
};

export type SocialMarketTrack = {
  id: "china" | "global";
  title: string;
  scope: string;
  platformExamples: readonly string[];
  priorities: readonly string[];
  conversionPath: string;
  safeguards: readonly string[];
};

export type SocialIntegrationReadinessItem = {
  id: string;
  order: number;
  title: string;
  owner: SocialRoadmapOwner;
  outcome: string;
  note: string;
};

export type SocialCustomerEducationItem = {
  id: string;
  title: string;
  allowed: readonly string[];
  prohibited: readonly string[];
  salesMessage: string;
};

export type SocialServicePackage = {
  id: "entry" | "basic" | "advanced" | "professional";
  title: string;
  priceLabel: string;
  annualPosts: string;
  adBudget: string;
  reporting: string;
  positioning: string;
  includedServices: readonly string[];
};

export type SocialPredevelopmentItem = {
  id: string;
  order: number;
  title: string;
  owner: SocialRoadmapOwner;
  purpose: string;
  implementation: string;
  acceptance: string;
  dependency: string;
  targetTab?: "accounts" | "create" | "schedule" | "automation" | "analytics" | "settings";
};

/**
 * One social capability set serves both markets.  Only channel rules, language,
 * compliance and conversion destinations differ; this prevents two parallel products.
 */
export const SOCIAL_MARKET_TRACKS: readonly SocialMarketTrack[] = [
  {
    id: "china",
    title: "国内中文渠道",
    scope: "面向中国市场，以中文内容、私域承接和本地客户服务为重点。",
    platformExamples: getSocialChannelNames("china"),
    priorities: ["中文品牌词库与敏感词", "短视频与图文平台版本", "评论/私信人工审核", "线索进入电话、微信与 CRM"],
    conversionPath: "内容或互动 → 表单/电话/微信 → 询盘 → CRM 跟进",
    safeguards: ["遵循各平台开放能力与内容规则", "不得代替客户自动点赞、群发或骚扰", "客户账号授权和内容发布保留审核记录"],
  },
  {
    id: "global",
    title: "海外英文渠道",
    scope: "面向海外市场，以英文/多语言本地化、目标国家时区和跨境询盘为重点。",
    platformExamples: getSocialChannelNames("overseas"),
    priorities: ["英文主稿与本地化版本", "国家、语言与时区排期", "OAuth 账号授权与令牌刷新", "线索进入邮箱、表单、WhatsApp Business 与 CRM"],
    conversionPath: "内容或互动 → 落地页/邮箱/WhatsApp Business → 询盘 → CRM 跟进",
    safeguards: ["OAuth 令牌仅由服务端加密保存", "按目标国家配置隐私与同意规则", "发布、评论回复和消息操作遵循平台 API 权限"],
  },
];

/** Must be agreed before a real social platform connection is enabled. */
export const SOCIAL_INTEGRATION_READINESS: readonly SocialIntegrationReadinessItem[] = [
  { id: "channel-capability", order: 1, title: "渠道能力", owner: "headquarters", outcome: "确认每个平台可授权、发布、互动、读取数据和回传线索的官方能力。", note: "没有官方 API 或明确授权范围的能力，不进入自动化承诺。" },
  { id: "channel-priority", order: 2, title: "接入优先", owner: "shared", outcome: "首期只确定国内与海外各一组核心渠道，其他登记为待接入。", note: "避免同时接入全部平台导致账号、内容和测试分散。" },
  { id: "content-localization", order: 3, title: "多语内容", owner: "agency-source", outcome: "建立内容主题、中文稿、英文主稿、平台版本的关联结构。", note: "英文内容必须支持人工本地化，不能把机器翻译直接当成最终稿。" },
  { id: "authorization-boundary", order: 4, title: "授权边界", owner: "headquarters", outcome: "区分总部应用凭据、客户账号授权和代理可见范围。", note: "令牌只在服务端加密保存、可刷新、撤销并留存审计记录。" },
  { id: "approval-rule", order: 5, title: "审批规则", owner: "client-source", outcome: "确定创建、审核、发布各由谁负责，并保留审批结果。", note: "客户源默认人工审核后发布；代理源只下发模板和规则。" },
  { id: "inquiry-ownership", order: 6, title: "询盘归属", owner: "shared", outcome: "定义评论、私信、表单、邮箱、WhatsApp 进入后的客户、计划和负责人归属。", note: "线索进入 CRM 前必须带渠道、账号和内容来源，避免漏跟或归属冲突。" },
  { id: "metric-dictionary", order: 7, title: "指标口径", owner: "headquarters", outcome: "统一曝光、互动、有效线索、询盘、商机、成交和获客成本的定义。", note: "所有数据同时记录渠道、国家、语言、客户、计划与内容版本。" },
  { id: "compliance-risk", order: 8, title: "合规风险", owner: "headquarters", outcome: "配置国内外内容规则、隐私同意、敏感词、数据保留与账号撤销流程。", note: "禁止自动点赞、批量私信、自动加好友等高风险动作。" },
];

/** Customer-facing boundaries used by implementation, onboarding and sales conversations. */
export const SOCIAL_CUSTOMER_EDUCATION: readonly SocialCustomerEducationItem[] = [
  {
    id: "account-security",
    title: "账号与授权安全",
    allowed: ["使用平台官方 OAuth 或官方允许的授权方式连接账号", "随时查看授权范围、断开连接和撤销授权", "由客户确认发布账号与可操作人员"],
    prohibited: ["索取、保存或共享客户的平台密码", "在前端、表格或聊天记录中保存访问令牌", "使用非官方方式绕过平台验证或授权"],
    salesMessage: "我们连接的是客户授权给系统的操作权限，不收集客户密码；客户可随时撤销授权，账号始终归客户自己管理。",
  },
  {
    id: "content-compliance",
    title: "内容与品牌合规",
    allowed: ["复用客户已确认的产品资料、品牌词库与素材", "生成中文、英文和平台适配版本后进入审核", "按国内外市场分别维护敏感词和内容规则"],
    prohibited: ["发布夸大宣传、虚假承诺、侵权素材或未经确认的报价", "把机器翻译或 AI 初稿直接当成最终海外内容", "以客户身份发布未审核内容"],
    salesMessage: "系统帮助更快制作和分发内容，但发布前仍由客户或授权人员确认，确保品牌表达与市场规则一致。",
  },
  {
    id: "interaction-boundary",
    title: "互动与客户尊重",
    allowed: ["识别评论、私信和表单中的高意向客户", "将待处理互动生成询盘或 CRM 跟进任务", "由人工审核后回复客户问题"],
    prohibited: ["自动点赞、自动关注、批量加好友或批量私信", "骚扰式群发、诱导性评论或刷量行为", "未经人工审核自动向客户承诺价格、交期或服务"],
    salesMessage: "平台的价值是让真正有意向的客户不被遗漏，而不是用机器制造打扰；每次对外回复都保留客户决定权。",
  },
  {
    id: "data-privacy",
    title: "线索与隐私保护",
    allowed: ["将已同意联系的线索按渠道、计划和负责人进入 CRM", "查看内容到询盘、商机和成交的归因数据", "按权限让总部、代理和客户只看自己应看的数据"],
    prohibited: ["出售、交换或擅自导出客户线索", "跨客户、跨代理共享私信、电话、邮箱等个人资料", "绕过客户同意规则收集或长期保留个人数据"],
    salesMessage: "每条线索都有来源、归属和处理记录；数据用于服务客户自己的业务，不会成为平台对外交易的资源。",
  },
];

export const SOCIAL_PAIN_POINTS: readonly SocialPainPoint[] = [
  {
    id: "accounts",
    pain: "多个平台账号分散，授权状态和可用范围不清楚。",
    solution: "统一渠道连接、授权范围、失效提醒与账号归属。",
    customerValue: "减少重复登录，避免账号失效导致发布中断。",
  },
  {
    id: "content",
    pain: "内容重复制作，品牌口径和多语种表达不一致。",
    solution: "用模板、素材库、AI 辅助与审核流复用内容。",
    customerValue: "更快产出，并保持品牌、产品与报价表达一致。",
  },
  {
    id: "inquiry",
    pain: "评论、私信和表单线索分散，跟进容易遗漏。",
    solution: "把有效互动转成询盘，分配负责人并同步 CRM。",
    customerValue: "每一条高意向咨询都有可追踪的跟进结果。",
  },
  {
    id: "measurement",
    pain: "只看到播放和点赞，无法判断渠道是否带来客户。",
    solution: "统一内容、互动、询盘与成交归因指标。",
    customerValue: "把预算投入到真正带来商机的渠道和内容。",
  },
];

/**
 * Contract-derived defaults for the Facebook & Instagram managed-service
 * offering. They describe a service scope, not a platform API guarantee.
 * A signed order and the customer's authorised accounts remain the source of
 * truth for the actual delivery scope.
 */
export const SOCIAL_SERVICE_PACKAGES: readonly SocialServicePackage[] = [
  {
    id: "entry",
    title: "入门版",
    priceLabel: "¥14,900",
    annualPosts: "50 篇/年",
    adBudget: "不含广告费",
    reporting: "阶段沟通与复盘",
    positioning: "先完成账号、主页与基础内容运营，适合首次建立海外品牌阵地。",
    includedServices: ["Facebook / Instagram 基础搭建协助", "品牌主页信息与 CTA 完善", "内容计划、客户周审与同步发布", "人工互动与询盘承接规则"],
  },
  {
    id: "basic",
    title: "基础版",
    priceLabel: "¥39,900",
    annualPosts: "110 篇/年",
    adBudget: "含税广告费 ¥10,000",
    reporting: "季报 · 1 次复盘/年",
    positioning: "在基础运营上增加首期推广验证，适合需要测试目标市场与受众的客户。",
    includedServices: ["入门版全部服务", "广告账户申请资料准备与审核建议", "受众确认、投放执行与优化", "内容与广告素材协同"],
  },
  {
    id: "advanced",
    title: "进阶版",
    priceLabel: "¥59,900",
    annualPosts: "160 篇/年",
    adBudget: "含税广告费 ¥15,000",
    reporting: "月报 · 2 次复盘/年",
    positioning: "提升内容频次与投放优化节奏，适合已有海外询盘、需要稳定增长的客户。",
    includedServices: ["基础版全部服务", "节日封面与行业社群协同", "更高频内容同步与素材复用", "月度渠道、内容和询盘复盘"],
  },
  {
    id: "professional",
    title: "专业版",
    priceLabel: "¥89,900",
    annualPosts: "210 篇/年",
    adBudget: "含税广告费 ¥20,000",
    reporting: "周报 · 4 次复盘/年",
    positioning: "以持续内容、投放和数据复盘形成完整增长闭环，适合重点海外市场持续经营。",
    includedServices: ["进阶版全部服务", "重点节点与活动协同", "高频数据跟踪与策略调整", "渠道、询盘和成交归因复盘"],
  },
];

/**
 * Pre-development gates.  These items are deliberately completed before any
 * real OAuth, publishing, ad or customer-data connector is enabled.
 */
export const SOCIAL_PREDEVELOPMENT_CHECKLIST: readonly SocialPredevelopmentItem[] = [
  {
    id: "package-rule-version",
    order: 1,
    title: "套餐规则版本",
    owner: "agency-source",
    purpose: "让价格、内容频次、广告额度、报表频率和服务边界由可发布版本管理，而不是写死在客户页面。",
    implementation: "建立套餐版本、启停、适用渠道和升级说明；代理源发布后，客户源只读取已发布版本。",
    acceptance: "四档套餐可追溯版本号，历史订单继续读取原版本，新套餐不改写旧计划。",
    dependency: "先完成后才配置服务订单、升级和续费。",
    targetTab: "settings",
  },
  {
    id: "order-entitlement",
    order: 2,
    title: "订单服务权限",
    owner: "shared",
    purpose: "让客户购买的套餐、服务周期、账号数量和广告服务决定实际可用功能。",
    implementation: "定义订单状态、有效期、账号上限、内容额度、广告资格与冻结规则；功能入口读取权限结果。",
    acceptance: "未开通或到期计划不能进入受限功能，升级、续费和冻结均保留审计记录。",
    dependency: "依赖套餐规则版本；完成后再开放客户实际服务入口。",
    targetTab: "settings",
  },
  {
    id: "platform-capability-matrix",
    order: 3,
    title: "平台能力矩阵",
    owner: "headquarters",
    purpose: "避免把各平台不开放的发布、评论、私信、广告或数据能力误售为自动化功能。",
    implementation: "按平台维护授权、发布、互动、数据、广告、限制原因、审核状态与官方文档版本。",
    acceptance: "每项前台能力均能对应一条已审核的平台能力记录；不支持的能力显示人工流程。",
    dependency: "OAuth、内容发布和广告服务的前置门槛。",
    targetTab: "settings",
  },
  {
    id: "oauth-secret-architecture",
    order: 4,
    title: "授权密钥架构",
    owner: "headquarters",
    purpose: "把总部应用凭据、客户授权令牌和代理可见范围安全分离。",
    implementation: "后端加密保存令牌；设计回调校验、刷新、撤销、失效提醒和审计日志；前端不保存密码或令牌。",
    acceptance: "可完成模拟授权、撤销和过期处理，审计记录包含客户、计划、平台、操作者和时间。",
    dependency: "依赖平台能力矩阵；未验收前不接入真实账号。",
    targetTab: "accounts",
  },
  {
    id: "content-asset-model",
    order: 5,
    title: "内容素材标准",
    owner: "agency-source",
    purpose: "让中文稿、英文主稿、平台适配稿、素材版权和审批版本可追溯、可复用。",
    implementation: "定义主题、语言、平台版本、素材来源、版权声明、产品关联、审批状态与发布时间字段。",
    acceptance: "一份主内容可生成多个渠道版本，任一发布内容都能回查素材、审批和负责人。",
    dependency: "依赖套餐内容额度；完成后才开发批量内容生产。",
    targetTab: "create",
  },
  {
    id: "approval-compliance-template",
    order: 6,
    title: "审批合规模板",
    owner: "client-source",
    purpose: "确保内容、回复和广告在客户确认前不会越过品牌、行业或隐私边界。",
    implementation: "配置创建、审核、发布角色；维护敏感词、行业禁语、广告声明、隐私同意和驳回原因模板。",
    acceptance: "未审批内容不能发布；审批、驳回、再次提交和最终版本都有记录。",
    dependency: "依赖内容素材标准；完成后才接发布接口。",
    targetTab: "schedule",
  },
  {
    id: "advertising-service-boundary",
    order: 7,
    title: "广告服务边界",
    owner: "headquarters",
    purpose: "区分广告费、服务费、充值、创意、受众确认和投放授权，避免套餐误解。",
    implementation: "定义广告资格、预算确认单、受众与创意审核、充值记录、投放状态和优化记录。",
    acceptance: "无客户确认、无资格或不含广告套餐时，投放入口不可执行；每笔预算可对账。",
    dependency: "依赖订单权限与平台能力矩阵；只对含广告服务的套餐开放。",
    targetTab: "analytics",
  },
  {
    id: "lead-data-acceptance",
    order: 8,
    title: "询盘数据验收",
    owner: "shared",
    purpose: "统一线索归属、响应时效、CRM 去向和套餐成效口径，避免只看点赞却无法复盘。",
    implementation: "定义渠道、账号、内容、计划、负责人、同意状态、响应时限、CRM 状态和归因字段。",
    acceptance: "每条有效线索可回查来源并进入负责人队列；套餐报表可显示内容、互动、询盘与复盘结论。",
    dependency: "依赖审批、互动和广告边界；完成后再接 CRM 与数据报表。",
    targetTab: "analytics",
  },
];

/**
 * Delivery-readiness gates that follow the engineering gates.  They protect
 * the customer onboarding and operating process before a plan goes live.
 */
export const SOCIAL_LAUNCH_READINESS_CHECKLIST: readonly SocialPredevelopmentItem[] = [
  {
    id: "client-onboarding-questionnaire",
    order: 1,
    title: "客户开通问卷",
    owner: "client-source",
    purpose: "一次收齐市场、语言、产品、品牌、账号、联系人、审批人、预算与目标，减少反复补资料。",
    implementation: "建立可保存的开通问卷，按套餐显示必填项，并把确认结果写入计划资料而非聊天记录。",
    acceptance: "新计划可生成一份完整开通资料；缺少关键信息时不能进入账号授权和发布阶段。",
    dependency: "依赖套餐规则和订单权限。",
    targetTab: "settings",
  },
  {
    id: "role-sla",
    order: 2,
    title: "角色与 SLA",
    owner: "shared",
    purpose: "明确客户、代理和总部对内容审核、询盘响应、账号异常与升级问题的责任和时效。",
    implementation: "为创建、审核、发布、互动、询盘和异常处理定义负责人、响应时限、升级路径和通知规则。",
    acceptance: "每个服务动作可找到唯一负责人；超时会进入待升级队列并留下处理记录。",
    dependency: "依赖订单服务权限和客户开通资料。",
    targetTab: "automation",
  },
  {
    id: "asset-rights-register",
    order: 3,
    title: "素材版权档案",
    owner: "agency-source",
    purpose: "让图片、视频、音乐、商标和第三方素材的来源、授权期限与使用市场可核验。",
    implementation: "素材库增加来源、权利人、许可范围、到期日、地区和禁止用途字段，并在发布前校验。",
    acceptance: "任一发布素材可回查版权依据；到期或范围不符素材不可进入待发布内容。",
    dependency: "依赖内容素材标准。",
    targetTab: "create",
  },
  {
    id: "sandbox-kill-switch",
    order: 4,
    title: "沙盒与紧急停用",
    owner: "headquarters",
    purpose: "先用测试账号验证授权、发布、撤销和异常处理；风险发生时可立即停止对外动作。",
    implementation: "准备沙盒账号、模拟令牌、发布测试记录，以及发布、互动、广告三类独立停用开关。",
    acceptance: "可完成授权、失败、撤销和恢复演练；紧急停用后没有新的对外请求被发送。",
    dependency: "依赖平台能力矩阵和授权密钥架构。",
    targetTab: "accounts",
  },
  {
    id: "data-retention-export",
    order: 5,
    title: "数据保留与导出",
    owner: "headquarters",
    purpose: "明确询盘、私信、审批、授权和报表数据保存多久、谁可导出、客户注销后如何处理。",
    implementation: "建立数据分类、保留期限、导出审批、访问日志、客户删除与代理隔离规则。",
    acceptance: "每类数据都有保留和删除策略；导出必须验证权限并产生审计记录。",
    dependency: "依赖询盘数据验收与角色 SLA。",
    targetTab: "analytics",
  },
  {
    id: "go-live-acceptance",
    order: 6,
    title: "上线验收清单",
    owner: "shared",
    purpose: "按套餐逐项确认账号、内容、审批、发布、询盘和报表是否可用，再进入正式服务期。",
    implementation: "生成套餐驱动的验收清单，区分已验证、人工待办、风险豁免和不适用项目。",
    acceptance: "客户、代理和总部确认后才切换正式服务状态；验收报告可回查对应套餐版本。",
    dependency: "依赖全部前期开发门槛与服务交付路线。",
    targetTab: "analytics",
  },
];

/**
 * Operational improvements are non-blocking for the first local prototype,
 * but become mandatory before running a recurring managed-service business.
 */
export const SOCIAL_OPERATION_READINESS_CHECKLIST: readonly SocialPredevelopmentItem[] = [
  {
    id: "service-contract-change-log",
    order: 1,
    title: "合同与变更留痕",
    owner: "shared",
    purpose: "让套餐外需求、追加账号、预算变更、暂停和恢复服务都有客户确认依据。",
    implementation: "建立服务单、变更单、确认人、确认时间、生效范围和附件引用；任何范围变化先确认再执行。",
    acceptance: "可回查当前计划的原始套餐、所有变更及客户确认；未确认变更不能影响服务权限。",
    dependency: "依赖套餐规则版本、订单服务权限和客户开通资料。",
    targetTab: "settings",
  },
  {
    id: "delivery-worklog",
    order: 2,
    title: "交付工时与日志",
    owner: "agency-source",
    purpose: "量化策划、内容、审核、发布、互动和复盘的实际投入，为分佣、报价和续费提供依据。",
    implementation: "按计划、套餐、服务动作和负责人记录工时、交付物链接、状态和客户反馈。",
    acceptance: "每个周期可汇总已交付工作与未完成事项，并能比较套餐承诺和实际投入。",
    dependency: "依赖角色 SLA 和套餐交付顺序。",
    targetTab: "schedule",
  },
  {
    id: "client-training-knowledge-base",
    order: 3,
    title: "客户培训与知识库",
    owner: "client-source",
    purpose: "让客户能独立完成授权、审核、素材提交、风险识别和数据查看，减少重复沟通。",
    implementation: "按角色提供开通、账号安全、内容审核、素材版权、询盘处理和常见异常的操作指引。",
    acceptance: "客户可在计划内完成核心操作；每条指引具有版本、适用套餐和更新日期。",
    dependency: "依赖审批合规模板、素材版权档案和上线验收清单。",
    targetTab: "settings",
  },
  {
    id: "health-alerts",
    order: 4,
    title: "异常预警与健康度",
    owner: "headquarters",
    purpose: "把授权失效、审核积压、询盘超时、发布失败和预算异常变成可分派、可处理的服务风险。",
    implementation: "定义健康指标、阈值、通知对象、升级时限、停用条件和处理结果；后端上线后接入任务与消息服务。",
    acceptance: "测试数据可触发授权、审核、询盘、发布和预算五类告警，并记录负责人和关闭原因。",
    dependency: "依赖授权密钥架构、角色 SLA、广告边界和询盘数据验收。",
    targetTab: "analytics",
  },
  {
    id: "renewal-review-report",
    order: 5,
    title: "验收报告与续费建议",
    owner: "shared",
    purpose: "在服务期结束前汇总套餐履约、内容、询盘、风险和优化结论，支持续费、升级或暂停决策。",
    implementation: "生成按套餐版本汇总的交付报告，展示完成项、待办、豁免、数据口径、续费建议和确认记录。",
    acceptance: "客户、代理和总部能查看同一份可追溯报告，续费或升级不会覆盖原服务周期数据。",
    dependency: "依赖上线验收、交付日志、健康度和数据归因。",
    targetTab: "analytics",
  },
];

export const SOCIAL_OWNER_LABELS: Record<SocialRoadmapOwner, string> = {
  headquarters: "总部端",
  "agency-source": "代理源",
  "client-source": "客户源",
  shared: "三端协同",
};

export const SOCIAL_OWNER_DESCRIPTIONS: Record<SocialRoadmapOwner, string> = {
  headquarters: "管理平台能力、渠道规则、应用凭据与安全审计，不处理客户个人授权。",
  "agency-source": "沉淀可复用的行业模板、服务流程和升级包，向下游代理端同步。",
  "client-source": "绑定实际账号、选择内容与审批发布，处理本客户的互动、询盘和数据。",
  shared: "总部定义边界，代理源交付模板，客户源在本项目内实际使用。",
};

export const SOCIAL_DEVELOPMENT_STAGES: readonly SocialRoadmapStage[] = [
  {
    id: "service-intake",
    order: 1,
    title: "需求沟通与服务准入",
    summary: "先确认目标市场、客户画像、品牌调性、产品亮点、预算和套餐边界，再进入任何账号或内容操作。",
    owner: "shared",
    deliverables: ["套餐选择与服务范围", "目标市场与内容调性", "平台能力与合规边界", "客户审批负责人"],
    nextAction: "在痛点路线选择套餐，并完成接入准备清单中的渠道、授权和审批项。",
    targetTab: "settings",
    developmentVerification: { verifiedAt: "2026-07-31", note: "四档套餐、交付范围确认与未签约不自动开通保护已完成本地验证。" },
  },
  {
    id: "account-page-setup",
    order: 2,
    title: "账号、主页与授权搭建",
    summary: "按客户授权完成 Facebook、Instagram 账号与主页基础信息、CTA 和 Messenger 承接；平台不保存客户密码。",
    owner: "client-source",
    deliverables: ["账号连接与授权范围", "主页品牌信息与链接", "CTA 与线索承接入口", "撤销与审计记录"],
    nextAction: "在账号连接完成实际授权；未具备官方能力时仅记录待接入，不承诺自动化。",
    targetTab: "accounts",
    developmentVerification: { verifiedAt: "2026-07-31", note: "授权申请、Meta OAuth 安全就绪检查与未授权默认阻断已完成本地验证。" },
  },
  {
    id: "brand-material-playbook",
    order: 3,
    title: "品牌素材与服务模板",
    summary: "客户提交产品、卖点、图片和业务资料；代理源将它们整理为可审核、可同步的行业服务模板。",
    owner: "agency-source",
    deliverables: ["产品与素材清单", "中英文品牌词库", "行业内容包", "套餐交付与审核规则"],
    nextAction: "在代理源沉淀模板并发布版本；客户源只选择和使用已发布的模板。",
    developmentVerification: { verifiedAt: "2026-07-31", note: "当前独立计划的内容模板保存、套用和渠道范围校验已完成本地验证。" },
  },
  {
    id: "content-review-publish",
    order: 4,
    title: "内容策划、周审与发布",
    summary: "按套餐内容频次制作中文/英文与平台适配稿，客户审核后再发布，并同步 Facebook 与 Instagram 的允许内容。",
    owner: "client-source",
    deliverables: ["季度内容方案", "每周待审内容", "发布排期", "内容版本与审批记录"],
    nextAction: "从客户源内容创作建立第一批待审内容，再在发布中心安排已批准任务。",
    targetTab: "create",
    developmentVerification: { verifiedAt: "2026-07-31", note: "内容草稿、审核交接与受控发布队列界面已完成本地验证；外部发布保持关闭。" },
  },
  {
    id: "interaction-inquiry-loop",
    order: 5,
    title: "互动、社群与询盘承接",
    summary: "识别高意向评论、私信、表单和 Messenger 线索，人工确认后生成询盘与 CRM 跟进；不做刷量或骚扰式自动化。",
    owner: "client-source",
    deliverables: ["互动分级", "社群与活动协同", "询盘创建", "负责人和时效规则"],
    nextAction: "启用人工审核的互动规则，确认每条线索的客户、计划和负责人归属。",
    targetTab: "automation",
    developmentVerification: { verifiedAt: "2026-07-31", note: "线索来源关联、默认人工审核与 CRM 自动交接开关已完成本地验证。" },
  },
  {
    id: "ads-attribution-review",
    order: 6,
    title: "投放、归因与成效复盘",
    summary: "含广告套餐在客户确认预算、受众和创意后执行投放；所有套餐都以内容、互动、询盘与成交数据进行复盘。",
    owner: "shared",
    deliverables: ["广告资料与预算确认", "内容至询盘归因", "套餐对应报表频次", "续费与优化建议"],
    nextAction: "在数据归因查看渠道表现；广告投放仅在客户确认且套餐包含时进入执行。",
    targetTab: "analytics",
    developmentVerification: { verifiedAt: "2026-07-31", note: "内容到线索的本地可追溯归因已完成验证；官方平台数据仍等待 OAuth 回传。" },
  },
  {
    id: "plan-workspace-governance",
    order: 7,
    title: "计划工作区与版本协作",
    summary: "把市场、语言、审批、时区和插件开关保存到当前独立计划的共享工作区，并用版本校验避免多人覆盖配置。",
    owner: "client-source",
    deliverables: ["计划级运营设置", "共享工作区版本号", "配置变更审计", "冲突后刷新机制"],
    nextAction: "在平台设置确认本计划的市场、语言、审批和 CRM 自动交接开关；多人同时修改时先刷新再保存。",
    targetTab: "settings",
    developmentVerification: { verifiedAt: "2026-07-31", note: "计划工作区版本校验、敏感字段拦截和租户隔离测试已通过。" },
  },
  {
    id: "meta-oauth-readiness",
    order: 8,
    title: "官方授权与连接准入",
    summary: "总部配置并审核 Meta 应用、回调地址和服务端密钥引用；客户只在官方页面完成 Facebook、Instagram 等账号授权。",
    owner: "headquarters",
    deliverables: ["官方应用审核", "OAuth 回调校验", "账号授权范围", "撤销与失效处理"],
    nextAction: "总部先检查授权就绪状态；未具备官方应用、回调域名和密钥保管条件时，不启动真实 OAuth。",
    targetTab: "accounts",
    developmentVerification: { verifiedAt: "2026-07-31", note: "Meta OAuth 就绪状态和默认禁用保护已完成本地验证。" },
  },
  {
    id: "publish-review-queue",
    order: 9,
    title: "发布队列与审核保护",
    summary: "所有内容先进入可追踪的发布队列；审核、幂等编号和账号状态同时满足后，才允许服务端执行一次正式发布。",
    owner: "client-source",
    deliverables: ["内容审核记录", "发布队列", "重复发布保护", "失败重试依据"],
    nextAction: "在发布中心确认内容审核结果和发布时间；真实发布前由总部启用已审核的队列执行服务。",
    targetTab: "schedule",
    developmentVerification: { verifiedAt: "2026-07-31", note: "发布审核、幂等保护和外部执行默认关闭已通过专项测试。" },
  },
  {
    id: "credential-audit-revocation",
    order: 10,
    title: "密钥引用与撤销审计",
    summary: "平台令牌只保存为服务端密钥库引用，不进入浏览器、表格或页面；每次登记、撤销和状态变化都保留审计记录。",
    owner: "headquarters",
    deliverables: ["密钥库引用", "权限范围记录", "撤销申请", "安全审计日志"],
    nextAction: "总部把已审核的凭据写入密钥库后登记引用；客户和代理只查看状态，不提交密码、Cookie 或访问令牌。",
    targetTab: "settings",
    developmentVerification: { verifiedAt: "2026-07-31", note: "密钥引用格式校验、撤销申请和审计脱敏已通过专项测试。" },
  },
  {
    id: "crm-handoff-control",
    order: 11,
    title: "CRM 线索交接控制",
    summary: "高意向互动形成带来源和归属的线索交接记录。CRM 自动交接插件关闭时必须人工审核；开启时进入受控自动派发队列。",
    owner: "shared",
    deliverables: ["线索来源与归属", "人工审核状态", "CRM 自动交接插件", "派发与处理审计"],
    nextAction: "客户在平台设置选择人工审核或自动交接；总部仅在 CRM 连接通过审核后启用实际派发。",
    targetTab: "automation",
    developmentVerification: { verifiedAt: "2026-07-31", note: "人工审核、CRM 自动交接插件和外部派发保护已通过专项测试。" },
  },
  {
    id: "compliance-retention-observability",
    order: 12,
    title: "数据留存与合规监控",
    summary: "按计划设置数据留存期限、删除申请和总部审批；同时通过能力矩阵清楚展示每个平台当前真实可用与待接入能力。",
    owner: "headquarters",
    deliverables: ["留存期限", "删除审批流程", "平台能力矩阵", "运行就绪状态"],
    nextAction: "总部确认留存天数、删除审批责任人与监控就绪状态；未完成平台审核的能力必须保持“待接入”。",
    targetTab: "settings",
    developmentVerification: { verifiedAt: "2026-07-31", note: "数据留存、删除审批、能力矩阵和运行就绪状态已通过专项测试。" },
  },
  {
    id: "campaign-link-attribution",
    order: 13,
    title: "活动链接与转化归因",
    summary: "为每次内容、广告和落地页生成可审核的渠道链接与 UTM 规则，连接内容、访问、表单、询盘和 CRM 结果。",
    owner: "shared",
    deliverables: ["渠道链接规则", "UTM 参数模板", "落地页来源记录", "内容到商机漏斗"],
    nextAction: "总部先统一 UTM 命名与数据口径；客户源只从已批准的链接模板创建活动，避免手工参数混乱。",
    targetTab: "analytics",
    developmentVerification: { verifiedAt: "2026-07-31", note: "HTTPS 活动链接生成、UTM 规则与计划级本地保存已通过验证；访问数据回传保持待接入。" },
  },
  {
    id: "localization-quality-gate",
    order: 14,
    title: "多语本地化质量关",
    summary: "把中文主稿、英文主稿和各渠道版本建立可追溯关系，并由人工完成品牌术语、敏感表达和最终校审。",
    owner: "agency-source",
    deliverables: ["品牌术语库", "中文与英文版本关联", "地区化校审清单", "禁止直译提示"],
    nextAction: "代理源先发布行业术语和校审模板；客户源生成内容后必须选择目标市场并完成相应校审。",
    targetTab: "create",
    developmentVerification: { verifiedAt: "2026-07-31", note: "术语、市场表达与商业承诺三项人工确认关已接入提交审核前校验。" },
  },
  {
    id: "unified-inbox-sla",
    order: 15,
    title: "统一收件与响应时效",
    summary: "将获批平台的评论、私信、表单和邮件线索汇总为人工待办，按负责人、优先级和响应时限避免漏回客户。",
    owner: "client-source",
    deliverables: ["统一收件箱", "人工回复草稿", "负责人分配", "首次响应 SLA"],
    nextAction: "总部先确认各平台官方互动接口；客户源仅在已授权渠道接收消息，所有对外回复继续保留人工审核。",
    targetTab: "automation",
    developmentVerification: { verifiedAt: "2026-07-31", note: "人工录入互动待办、渠道来源与响应优先级显示已通过本地验证；外部消息接收保持待接入。" },
  },
  {
    id: "lead-scoring-opportunity",
    order: 16,
    title: "线索评分与商机分级",
    summary: "依据客户人工确认的互动意向、来源内容、市场和产品兴趣，提供透明的线索优先级与下一步建议。",
    owner: "shared",
    deliverables: ["可解释评分规则", "高意向提醒", "商机阶段映射", "人工覆盖与审计"],
    nextAction: "总部定义评分口径和禁用自动决定的边界；客户或代理可人工调整优先级，但不能让算法自动承诺报价或交期。",
    targetTab: "automation",
    developmentVerification: { verifiedAt: "2026-07-31", note: "基于来源、意向词与摘要长度的透明评分、优先级与 SLA 提示已通过本地验证。" },
  },
  {
    id: "account-health-alerts",
    order: 17,
    title: "账号健康与权限预警",
    summary: "持续检查授权将过期、主页权限变化、发布失败和渠道能力调整，并在影响运营前创建处理待办。",
    owner: "headquarters",
    deliverables: ["授权有效期提醒", "权限变更告警", "发布失败待办", "渠道健康总览"],
    nextAction: "先接入总部服务端监控与审计；客户源只查看状态和处理指引，不读取或保存令牌。",
    targetTab: "accounts",
    developmentVerification: { verifiedAt: "2026-07-31", note: "已登记账号的待授权健康状态与安全边界说明已完成本地验证；真实令牌监控保持待接入。" },
  },
  {
    id: "executive-report-renewal",
    order: 18,
    title: "经营报告与续费建议",
    summary: "按套餐约定频次生成客户可读的内容、线索、商机和服务报告，并基于已确认数据提出续费或优化建议。",
    owner: "agency-source",
    deliverables: ["套餐报表模板", "客户成果摘要", "预算与渠道建议", "续费服务记录"],
    nextAction: "代理源先发布套餐报表模板；总部统一指标口径，客户源只展示已授权且可核验的数据。",
    targetTab: "analytics",
    developmentVerification: { verifiedAt: "2026-07-31", note: "按当前套餐生成本地报告提纲并汇总可核验任务数据已通过验证；官方数据保持待回传。" },
  },
  {
    id: "consent-privacy-control",
    order: 19,
    title: "同意与隐私管理",
    summary: "让每条线索的联系同意、用途、保存期限与删除申请都有记录，避免把社交互动或客户资料用于未获同意的用途。",
    owner: "headquarters",
    deliverables: ["联系同意记录", "数据用途说明", "删除申请工单", "留存与导出审计"],
    nextAction: "总部先定义国内外隐私规则与最短必要字段；客户源只能在获得同意后创建可联系线索。",
    targetTab: "settings",
    developmentVerification: { verifiedAt: "2026-07-31", note: "计划级联系同意开关与默认留存期限设置已完成本地验证。" },
  },
  {
    id: "asset-rights-expiry",
    order: 20,
    title: "素材版权与授权到期",
    summary: "为图片、视频、音乐、案例和客户标识记录来源、使用范围、授权凭据与到期时间，防止素材被错误复用。",
    owner: "agency-source",
    deliverables: ["素材来源登记", "授权范围", "到期提醒", "客户案例使用确认"],
    nextAction: "代理源先建立行业素材授权模板；客户源上传或引用素材时必须选择来源和允许渠道。",
    targetTab: "create",
    developmentVerification: { verifiedAt: "2026-07-31", note: "素材名称、来源凭据、到期日期与当前渠道范围登记已完成本地验证。" },
  },
  {
    id: "controlled-experiment",
    order: 21,
    title: "内容与落地页 A/B 测试",
    summary: "以明确目标、单一变量和足够样本比较标题、CTA、语言或落地页版本，避免凭感觉改变内容策略。",
    owner: "shared",
    deliverables: ["实验假设", "对照版本", "样本与停止规则", "已核验结论"],
    nextAction: "总部先统一实验口径；客户源只对已审核内容创建实验，未获得真实数据前不输出效果结论。",
    targetTab: "analytics",
    developmentVerification: { verifiedAt: "2026-07-31", note: "A/B 测试规则入口与未接入真实数据时的安全提示已完成本地验证。" },
  },
  {
    id: "sales-funnel-sla",
    order: 22,
    title: "销售漏斗与 SLA 看板",
    summary: "把线索、询盘、商机、报价与成交按负责人与时效串成漏斗，优先发现无人处理、即将超时的客户机会。",
    owner: "client-source",
    deliverables: ["漏斗阶段", "负责人", "响应时效", "超时预警"],
    nextAction: "先由总部定义 CRM 阶段映射；客户源只展示本客户计划的人工确认记录，不能自动更改成交状态。",
    targetTab: "automation",
    developmentVerification: { verifiedAt: "2026-07-31", note: "内容、排期与线索的本地漏斗摘要及线索 SLA 提示已完成本地验证。" },
  },
  {
    id: "service-delivery-collaboration",
    order: 23,
    title: "服务交付与客户协同",
    summary: "按套餐显示应交付内容、客户待确认事项、责任人与剩余额度，让客户清楚知道本月服务正在推进什么。",
    owner: "agency-source",
    deliverables: ["月度交付清单", "客户确认待办", "服务额度", "责任人和进度"],
    nextAction: "代理源先发布套餐交付模板；客户源按计划读取，不允许手动把未交付内容标记为完成。",
    targetTab: "settings",
    developmentVerification: { verifiedAt: "2026-07-31", note: "当前套餐、约定内容与交付协同结构已完成本地验证；订单服务保持待接入。" },
  },
  {
    id: "customer-outcome-center",
    order: 24,
    title: "客户成果与续费中心",
    summary: "用客户可读的方式汇总已核验内容、线索处理、风险、报告和下一周期建议，支持透明复盘与续费沟通。",
    owner: "shared",
    deliverables: ["成果摘要", "风险与待办", "报告归档", "下周期建议"],
    nextAction: "总部统一成果口径；代理源提供套餐模板，客户源只呈现可核验数据与人工确认的建议。",
    targetTab: "analytics",
    developmentVerification: { verifiedAt: "2026-07-31", note: "客户成果基础摘要与报告提纲已完成本地验证；外部数据保持待回传。" },
  },
  {
    id: "approval-version-rollback",
    order: 25,
    title: "审批版本与一键回退",
    summary: "保留内容、素材、规则和套餐调整的版本说明，使客户与服务人员能确认差异并在误改后回到已批准版本。",
    owner: "shared",
    deliverables: ["版本编号", "修改说明", "审核快照", "受控回退记录"],
    nextAction: "总部统一版本与回退权限；客户源只能查看、提交审核或请求回退，不能覆盖已发布历史。",
    targetTab: "create",
    developmentVerification: { verifiedAt: "2026-07-31", note: "内容草稿正文、历史版本恢复至编辑区及重新审核保护已完成本地验证。" },
  },
  {
    id: "budget-quota-guardrails",
    order: 26,
    title: "预算额度与成本预警",
    summary: "按套餐和客户确认预算显示内容额度、广告额度与使用风险，在临近上限时提醒人工复核，避免超额服务。",
    owner: "agency-source",
    deliverables: ["套餐额度", "预算上限", "使用进度", "超额审批"],
    nextAction: "代理源先发布套餐额度模板；广告消耗必须来自官方或人工对账，未接入前只能显示计划额度。",
    targetTab: "analytics",
    developmentVerification: { verifiedAt: "2026-07-31", note: "套餐计划额度、内容交付摘要与未接入账单时不计算实际消耗的保护已完成验证。" },
  },
  {
    id: "incident-response-center",
    order: 27,
    title: "异常与应急处理中心",
    summary: "把授权失效、发布失败、账号限制、客户投诉和数据异常登记为可分派、可跟踪、可复盘的应急事件。",
    owner: "headquarters",
    deliverables: ["事件登记", "分级与责任人", "处理时限", "复盘与预防措施"],
    nextAction: "总部先定义事件等级与升级路径；客户源可上报问题，但账号限制和密钥类事件必须由总部处理。",
    targetTab: "accounts",
    developmentVerification: { verifiedAt: "2026-07-31", note: "P1–P3 异常分级、人工上报要求与不自动提交平台操作的边界已完成验证。" },
  },
  {
    id: "customer-success-renewal-risk",
    order: 28,
    title: "客户满意与续费风险",
    summary: "以客户确认、交付进度、风险事项和续费时间形成客户成功状态，提前安排沟通而不是到期才发现问题。",
    owner: "shared",
    deliverables: ["客户反馈", "续费日期", "风险原因", "改善行动"],
    nextAction: "代理源先定义满意度和续费风险口径；客户源只记录本计划的人工反馈，不自动推断客户意愿。",
    targetTab: "analytics",
    developmentVerification: { verifiedAt: "2026-07-31", note: "满意度待确认、续费风险待人工评估与成果摘要结构已完成本地验证。" },
  },
  {
    id: "multi-agency-service-quality",
    order: 29,
    title: "多代理服务质量看板",
    summary: "总部按代理、客户和计划查看交付时效、风险与续费状态；代理只能读取自身授权范围，不能看到其他代理或客户的资料。",
    owner: "headquarters",
    deliverables: ["代理服务摘要", "交付时效", "风险分级", "范围隔离"],
    nextAction: "总部先统一服务质量口径；本地阶段只展示当前计划的示例结构，正式汇总必须由后端租户权限筛选。",
    targetTab: "analytics",
    developmentVerification: { verifiedAt: "2026-07-31", note: "当前计划的交付、线索和风险摘要以及总部汇总待范围隔离提示已完成本地验证。" },
  },
  {
    id: "permission-rule-simulator",
    order: 30,
    title: "规则与权限模拟器",
    summary: "在正式开通前模拟总部、代理与客户对查看、编辑、发布、导出和撤销等动作的许可结果，提前发现越权配置。",
    owner: "headquarters",
    deliverables: ["角色动作矩阵", "范围模拟", "拒绝原因", "上线前检查记录"],
    nextAction: "总部维护正式角色和权限规则；模拟器只能解释预期结果，真实权限仍由后端每次请求校验。",
    targetTab: "settings",
    developmentVerification: { verifiedAt: "2026-07-31", note: "总部、代理、客户的典型动作模拟及跨客户、密钥操作拒绝说明已完成本地验证。" },
  },
  {
    id: "backup-recovery-drill",
    order: 31,
    title: "灾备与恢复演练",
    summary: "以演练清单验证数据、素材、版本和通知链路是否可恢复，记录目标恢复时间与演练结果，不直接操作正式备份。",
    owner: "headquarters",
    deliverables: ["恢复范围清单", "演练步骤", "恢复目标", "问题与改进记录"],
    nextAction: "正式环境由总部运维在隔离环境演练；本地页面只保存演练计划，不能执行删除、还原或覆盖数据。",
    targetTab: "settings",
    developmentVerification: { verifiedAt: "2026-07-31", note: "恢复范围、隔离环境步骤与不执行真实还原的保护提示已完成本地验证。" },
  },
  {
    id: "official-page-asset-binding",
    order: 32,
    title: "真实主页资产绑定",
    summary: "客户在官方 OAuth 授权完成后，从自己有权限的主页、企业号或频道中选择实际运营资产；后台仅保存受控的资产标识、展示资料和授权状态，不保存密码、Cookie 或访问令牌。",
    owner: "client-source",
    deliverables: ["授权主页选择器", "头像、名称与原主页链接", "资产负责人和所属计划", "授权范围与撤销记录"],
    nextAction: "总部先完成对应平台应用审核、回调域名和密钥库配置；客户再在“账号连接”授权并选择要同步的真实主页。未获官方授权的账号只显示“待接入”。",
    targetTab: "accounts",
    developmentVerification: { verifiedAt: "2026-07-31", note: "主页资产现已按项目、代理路径、租户、客户和计划写入后端，并保留 HTTPS 校验、授权申请关联与审计；正式资产选择仍须服务端校验官方 OAuth 回调。" },
  },
  {
    id: "official-metrics-snapshot-pipeline",
    order: 33,
    title: "官方数据快照同步",
    summary: "由服务端定时读取已获授权的官方接口，将粉丝、曝光、互动、播放、点击等可用指标按日保存为租户隔离的数据快照；不采用网页抓取、模拟登录或伪造数据。",
    owner: "headquarters",
    deliverables: ["平台能力矩阵", "按日指标快照", "同步任务与失败重试", "租户、客户、计划三级隔离"],
    nextAction: "总部为每个平台确认允许读取的字段、频率、审核要求和数据留存；先从 Meta、YouTube、LinkedIn、TikTok 等已具备官方接口的平台逐个接入。",
    targetTab: "settings",
    developmentVerification: { verifiedAt: "2026-07-31", note: "同步策略、后端指标快照、人工核验官方导出数据和同步申请已可操作；浏览器不直连平台，定时官方 API 连接器仍待总部凭据与平台审核。" },
  },
  {
    id: "data-freshness-account-health",
    order: 34,
    title: "数据新鲜与账号健康",
    summary: "在每个真实主页上显示最近成功同步时间、数据延迟、授权临期、权限变更和接口异常，让客户分清“真实数据”“等待同步”和“待接入”，避免误判。",
    owner: "headquarters",
    deliverables: ["数据新鲜度标签", "授权与权限预警", "同步失败待办", "人工处理与审计记录"],
    nextAction: "先在运营总览和账号连接增加统一的“数据截至时间”标识；发生授权失效或接口限制时自动生成待办，不自动修改账号或发布内容。",
    targetTab: "accounts",
    developmentVerification: { verifiedAt: "2026-07-31", note: "驾驶舱现显示官方接口或人工核验的来源与截至时间，空数据保持待同步；真实令牌临期、权限变更和自动失败重试仍待连接器服务。" },
  },
  {
    id: "real-page-operations-cockpit",
    order: 35,
    title: "主页运营驾驶舱",
    summary: "把已授权主页的粉丝总量与增长、曝光、互动、播放、内容发布量和询盘数汇总到运营总览；客户可在 7、30、90 天范围内比较真实运营结果。",
    owner: "client-source",
    deliverables: ["主页概览卡", "粉丝与互动趋势", "内容表现排行", "按主页筛选与原主页跳转"],
    nextAction: "先定义跨平台统一指标口径，再按平台能力显示可用字段；不支持的字段明确标为“平台未授权/待接入”，不能以零值代替。",
    targetTab: "analytics",
    developmentVerification: { verifiedAt: "2026-07-31", note: "主页驾驶舱已读取后端快照、原主页跳转与空数据保护；人工核验数据会明确标识来源，自动官方指标仍需已审核连接器写入。" },
  },
  {
    id: "growth-diagnosis-content-guidance",
    order: 36,
    title: "增长诊断与内容建议",
    summary: "根据真实快照识别增长最快内容、低互动内容、建议发布时间和可复用主题，为客户生成下一周期的人工可审核选题建议，而非自动承诺效果。",
    owner: "agency-source",
    deliverables: ["内容表现对比", "增长异常提示", "下周期选题建议", "人工审核与采纳记录"],
    nextAction: "代理源先沉淀行业诊断模板和建议话术；客户源查看本计划的真实数据后，选择建议并进入内容创作审核流程。",
    targetTab: "create",
    developmentVerification: { verifiedAt: "2026-07-31", note: "增长诊断工作台已读取主页资产、数据来源、快照与本地交付量，并保留人工复核步骤；没有数据快照时不会产生增长结论。" },
  },
  {
    id: "page-to-lead-attribution-reporting",
    order: 37,
    title: "主页线索归因报告",
    summary: "把真实主页、内容链接、UTM、表单或已授权互动来源与 CRM 人工审核线索关联，形成“主页—内容—访问—询盘—商机”的可追溯报告。",
    owner: "shared",
    deliverables: ["主页来源字段", "内容到线索链路", "人工审核 CRM 交接", "客户月度成果报告"],
    nextAction: "总部统一来源编码与 CRM 映射；代理源发布报告模板；客户源只展示已授权、可核验且经人工确认的线索结果。",
    targetTab: "analytics",
    developmentVerification: { verifiedAt: "2026-07-31", note: "主页资产、数据快照、内容、UTM 与人工审核线索现可组成计划级报告；真实访问、表单和 CRM 商机回传仍待正式连接。" },
  },
  {
    id: "hq-social-governance-package",
    order: 38,
    title: "总部治理与发布边界",
    summary: "总部端统一控制平台能力、数据安全、审核底线和来源发布规则；不把客户主页、账号、内容、线索、数据快照或凭据写入来源模板。",
    owner: "headquarters",
    deliverables: ["平台能力与合规边界", "来源包审核规则", "发布、回退与审计", "密钥只在服务端引用"],
    nextAction: "总部先在代理源或客户源维护运营包，再进入对应发布中心提交审核；外部 OAuth 应用、回调和密钥仍由总部服务端单独管理。",
    targetTab: "settings",
    developmentVerification: { verifiedAt: "2026-07-31", note: "已复用总部模板快照的审核、影响预览、选择安装、备份和回退机制；来源包只携带安全的运营默认值。" },
  },
  {
    id: "agency-source-package-release",
    order: 39,
    title: "代理源服务包发布",
    summary: "代理源保存可复用的服务范围、渠道、默认审核和说明，并在“代理源发布中心”按版本审核发布给代理端。",
    owner: "agency-source",
    deliverables: ["代理源运营包", "版本说明与审核", "目标代理影响预览", "可审计灰度与回退"],
    nextAction: "在代理源的“平台设置”保存运营包，再打开代理源发布中心提交版本；发布前先查看目标代理的配置差异。",
    targetTab: "settings",
    developmentVerification: { verifiedAt: "2026-07-31", note: "代理源发布已将 socialOperations 运营包写入现有模板版本，继续沿用两阶段审核和批次下发。" },
  },
  {
    id: "agency-runtime-selective-install",
    order: 40,
    title: "代理端选择安装更新",
    summary: "代理端只能查看总部已发布版本、预览差异并选择安装受管配置；商标、简称、客户、订单和经营数据不被来源更新覆盖。",
    owner: "agency-source",
    deliverables: ["版本差异列表", "按类别选择安装", "安装前快照备份", "来源运营包继承状态"],
    nextAction: "代理进入代理端版本中心，先检查更新与影响差异，再选择社交运营相关配置安装；安装后在平台设置确认来源运营包。",
    targetTab: "settings",
    developmentVerification: { verifiedAt: "2026-07-31", note: "代理端版本中心已复用模板快照的选择安装、备份与回退；运行端可读取已安装来源包并选择应用运营默认值。" },
  },
  {
    id: "client-source-package-release",
    order: 41,
    title: "客户源运营包发布",
    summary: "客户源维护客户端可继承的市场、语言、审核、CRM 默认值和渠道范围，并按审核版本提供给每个客户端独立计划。",
    owner: "client-source",
    deliverables: ["客户源运营包", "两次审核版本", "独立计划影响预览", "计划级回退"],
    nextAction: "在客户源的“平台设置”保存运营包，再打开客户源发布中心提交审核；批准后由每个客户端计划自行决定同步。",
    targetTab: "settings",
    developmentVerification: { verifiedAt: "2026-07-31", note: "客户源发布已把 socialOperations 运营包随通用模板版本保存，继续使用两次审核、计划预览和选择性回退。" },
  },
  {
    id: "client-plan-effective-operations",
    order: 42,
    title: "独立计划继承并生效",
    summary: "客户端先安装客户源最新模板，再在计划的平台设置中应用来源运营默认值；账号、主页、内容、素材、线索、CRM 和真实数据始终只归当前独立计划。",
    owner: "client-source",
    deliverables: ["来源包继承提示", "一键应用默认值", "计划级覆盖保存", "经营数据不被覆盖"],
    nextAction: "客户端在版本中心完成手动同步后，进入社交媒体 → 平台设置，核对来源包并点击“应用来源默认值”；随后才开始本计划账号授权和数据运营。",
    targetTab: "settings",
    developmentVerification: { verifiedAt: "2026-07-31", note: "客户端运行端已读取模板实例中的运营包，并只应用市场、语言、审核和 CRM 默认值；计划经营数据保持隔离。" },
  },
  {
    id: "unified-development-standard-template",
    order: 43,
    title: "统一开发规范模板",
    summary: "把规范编号、目的、角色、前置条件、步骤、入口、验收、证据、风险、状态和版本沉淀为一套可复用模板，经营模块只填写实例内容。",
    owner: "headquarters",
    deliverables: ["统一规范字段", "共享页面组合", "验收与证据结构", "单向发布边界"],
    nextAction: "从开发器的“规范”选择 05.圈养(深耕)，使用统一模板维护社交媒体规范实例。",
    targetTab: "customer-roadmap",
    developmentVerification: { verifiedAt: "2026-08-01", note: "统一规范模板已进入开发规范工作台，并由共享变量、内容设计和发布边界共同约束。" },
  },
  {
    id: "customer-marketing-playbook",
    order: 44,
    title: "客户营销作战页面",
    summary: "把内部开发路线与客户操作路线分开；客户先读营销逻辑，再按步骤进入真实功能页面完成操作。",
    owner: "client-source",
    deliverables: ["营销逻辑", "操作步骤", "真实导航入口", "完成状态"],
    nextAction: "进入社交媒体 → 营销作战，按阶段卡条从市场定位开始执行。",
    targetTab: "marketing-playbook",
    developmentVerification: { verifiedAt: "2026-08-01", note: "营销作战二级栏目、九阶段卡条、操作按钮和返回内部路线入口已完成。" },
  },
  {
    id: "domestic-overseas-market-engine",
    order: 45,
    title: "国内海外双市场引擎",
    summary: "共享工厂资料与销售漏斗，同时按国内采购／经销和海外进口／分销／OEM 买家使用不同渠道、内容和转化话术。",
    owner: "shared",
    deliverables: ["双市场切换", "渠道建议", "差异化营销逻辑", "统一转化漏斗"],
    nextAction: "在营销作战选择国内、海外或双市场，再到平台设置保存本计划的实际市场范围。",
    targetTab: "marketing-playbook",
    developmentVerification: { verifiedAt: "2026-08-01", note: "双市场视图和每阶段国内／海外差异说明已接入，视图按独立计划保存。" },
  },
  {
    id: "factory-marketing-profile",
    order: 46,
    title: "工厂营销资料底座",
    summary: "把产能、MOQ、交期、认证、质量控制、包装物流、案例和 OEM／ODM 能力作为内容与销售承诺的统一事实来源。",
    owner: "client-source",
    deliverables: ["工厂资料入口", "事实核验", "国内内容输入", "海外内容输入"],
    nextAction: "从营销作战进入企业资料 → 工厂生产，完善资料后由业务人工验收。",
    targetTab: "marketing-playbook",
    developmentVerification: { verifiedAt: "2026-08-01", note: "营销作战已打通工厂资料导航，并将人工核验状态与当前计划隔离保存。" },
  },
  {
    id: "platform-capability-levels",
    order: 47,
    title: "平台能力等级与安全边界",
    summary: "按链接登记、官方读取、指标、发布、互动和 CRM 交接展示平台真实能力；未获批准的按钮保持不可承诺或人工任务。",
    owner: "headquarters",
    deliverables: ["能力等级", "OAuth 范围", "人工任务降级", "凭据安全"],
    nextAction: "进入账号连接核对平台、授权方式、负责人和实际能力，再决定是否进入自动执行。",
    targetTab: "accounts",
    developmentVerification: { verifiedAt: "2026-08-01", note: "账号目录、OAuth 就绪保护、服务端密钥引用和未授权默认阻断均已接入。" },
  },
  {
    id: "factory-content-production-loop",
    order: 48,
    title: "工厂内容与视频生产线",
    summary: "按市场、买家、产品和转化目标创建内容与视频，并在发布前完成术语、承诺、素材权利和人工审批。",
    owner: "agency-source",
    deliverables: ["工厂内容模板", "多语言版本", "视频任务", "审批记录"],
    nextAction: "从营销作战进入内容创作和视频创作，生成第一批可审核任务。",
    targetTab: "create",
    developmentVerification: { verifiedAt: "2026-08-01", note: "内容草稿、模板、素材权利、多语言质量关、视频任务和发布审核链路已可操作。" },
  },
  {
    id: "qualified-b2b-lead-flow",
    order: 49,
    title: "B2B 询盘资格识别",
    summary: "把渠道互动转成带国家、公司、角色、产品、数量、交期和联系同意的线索，再按优先级与 SLA 交给销售。",
    owner: "client-source",
    deliverables: ["来源关联", "线索评分", "响应 SLA", "人工审核"],
    nextAction: "进入互动转化登记一条真实或测试线索，确认来源、优先级、负责人和审核状态。",
    targetTab: "automation",
    developmentVerification: { verifiedAt: "2026-08-01", note: "线索来源、透明评分、SLA、默认人工审核和 CRM 交接控制面已接入；外部 CRM 派发保持连接器阻断。" },
  },
  {
    id: "sample-quote-opportunity-flow",
    order: 50,
    title: "样品报价与商机交接",
    summary: "合格线索经人工审核后进入 CRM 交接，继续跟踪样品、报价、验厂和商机状态，避免停留在社交聊天记录。",
    owner: "client-source",
    deliverables: ["资格字段", "CRM 交接", "人工批准", "处理审计"],
    nextAction: "在互动转化补齐采购条件并提交 CRM 审核；真实 CRM 未接通时保持待派发。",
    targetTab: "automation",
    developmentVerification: { verifiedAt: "2026-08-01", note: "CRM 交接记录、人工批准／拒绝、自动派发开关和外部未连接保护已完成。" },
  },
  {
    id: "factory-order-attribution",
    order: 51,
    title: "工厂订单转化归因",
    summary: "用平台、账号、内容、活动链接、线索、样品、报价和订单形成可追溯链路，国内外分别复盘但使用统一指标口径。",
    owner: "shared",
    deliverables: ["活动链接", "内容到线索", "销售漏斗", "渠道经营报告"],
    nextAction: "进入数据归因建立活动链接，并把已核验线索与内容来源关联。",
    targetTab: "analytics",
    developmentVerification: { verifiedAt: "2026-08-01", note: "活动链接、内容线索关联、本地漏斗、官方指标快照和客户成果摘要已可使用。" },
  },
  {
    id: "marketing-playbook-release-chain",
    order: 52,
    title: "规范与营销作战下发链",
    summary: "统一规范和营销作战版本随社交运营包向下游发布；客户端计划只继承模板与默认值，真实经营数据始终留在计划。",
    owner: "shared",
    deliverables: ["规范模板版本", "营销阶段清单", "来源包发布", "计划数据保护"],
    nextAction: "来源端保存运营包并按现有发布中心审核下发；客户端计划选择安装后进入营销作战执行。",
    targetTab: "settings",
    developmentVerification: { verifiedAt: "2026-08-01", note: "社交来源包已携带规范模板与营销作战版本信息，并继续复用现有两阶段审核和选择安装链路。" },
  },
];

export function socialRoadmapStorageKey(siteId?: string | null) {
  return `tradepro.social-roadmap.progress.${siteId || "default"}`;
}

export function socialRoadmapPendingStorageKey(siteId?: string | null) {
  return `tradepro.social-roadmap.pending.${siteId || "default"}`;
}

export function socialReadinessStorageKey(siteId?: string | null) {
  return `tradepro.social-readiness.progress.${siteId || "default"}`;
}

export function socialServicePackageStorageKey(siteId?: string | null) {
  return `tradepro.social-service-package.${siteId || "default"}`;
}

/** Pre-contract scope confirmation. This value is not an order entitlement. */
export function socialServiceEnrollmentStorageKey(siteId?: string | null) {
  return `tradepro.social-service-enrollment.${siteId || "default"}`;
}

export function socialPredevelopmentStorageKey(siteId?: string | null) {
  return `tradepro.social-predevelopment.progress.${siteId || "default"}`;
}

export function socialLaunchReadinessStorageKey(siteId?: string | null) {
  return `tradepro.social-launch-readiness.progress.${siteId || "default"}`;
}

export function socialOperationReadinessStorageKey(siteId?: string | null) {
  return `tradepro.social-operation-readiness.progress.${siteId || "default"}`;
}
