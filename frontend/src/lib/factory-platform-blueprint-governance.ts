/**
 * Factory platform governance and audit data.
 *
 * This module is consumed only by the already-lazy Blueprint and Development
 * workbenches. Ordinary shells keep category, navigation and route contracts
 * in factory-platform-blueprint.ts without downloading this governance body.
 */

import {
  FACTORY_PLATFORM_CATEGORY_KEYS,
  type FactoryPlatformAudience,
  type FactoryPlatformCategoryKey,
  type FactoryPlatformPhaseId,
} from "./factory-platform-blueprint";
import { FACTORY_PLATFORM_DEVELOPMENT_PHASES } from "./factory-platform-development-phases";

export {
  FACTORY_PLATFORM_DEVELOPMENT_PHASES,
  type FactoryPlatformDevelopmentPhase,
} from "./factory-platform-development-phases";

export type FactoryPlatformBoundary = {
  id: string;
  title: string;
  systemOfRecord: FactoryPlatformCategoryKey;
  owns: readonly string[];
  consumes: readonly FactoryPlatformCategoryKey[];
  rules: readonly string[];
};

/** Explicit ownership prevents CRM, ERP, CMS and analytics from becoming competing ledgers. */
export const FACTORY_PLATFORM_BUSINESS_BOUNDARIES: readonly FactoryPlatformBoundary[] = [
  { id: "product-three-layers", title: "产品数据三层边界", systemOfRecord: "fulfillment", owns: ["技术规格", "SKU", "BOM", "工艺版本", "工程标准成本", "可用库存"], consumes: ["identity", "content", "recommend"], rules: ["身份层只拥有市场定位和价值主张", "内容层只拥有渠道文案、媒体与翻译", "任何渠道不得复制技术产品主档", "工程标准成本供报价与计划参考，财务实际成本以经营层过账为准"] },
  { id: "order-two-stages", title: "订单成交与履约边界", systemOfRecord: "fulfillment", owns: ["确认订单", "排产", "质检", "库存", "发货与退货"], consumes: ["convert", "operations", "care"], rules: ["承转层拥有询盘、RFQ、样品、报价和成交意向", "确认后的订单行由履约层管理", "变更必须保留版本和审批记录"] },
  { id: "customer-three-layers", title: "客户身份、关系与价值边界", systemOfRecord: "portrait", owns: ["统一客户身份", "行为事件", "标签", "触达同意", "渠道偏好"], consumes: ["deepen", "lead", "convert", "care", "decision"], rules: ["画像层持续接收匿名、潜客、成交与服务事件，不是仅在成交后运行", "深养层拥有跟进、服务、续约和增购流程", "决策层只计算客户利润、LTV和风险", "客户身份不得在CRM与CDP重复编号"] },
  { id: "finance-authority", title: "财务唯一事实来源", systemOfRecord: "operations", owns: ["应收应付", "会计凭证", "财务实际成本", "发票", "正式利润与现金"], consumes: ["convert", "fulfillment", "decision"], rules: ["CRM和订单应用只能展示财务状态", "制造层工程标准成本不得替代财务实际成本", "正式金额以财务过账结果为准", "汇率税率和账期必须版本化"] },
  { id: "analytics-no-writeback", title: "决策层不得取代业务录入", systemOfRecord: "decision", owns: ["跨系统指标", "归因", "预测", "情景模拟"], consumes: ["operations", "fulfillment", "identity", "content", "trust", "recommend", "deepen", "lead", "convert", "portrait", "care"], rules: ["报表不得成为订单或客户的主录入入口", "指标必须带口径、来源和更新时间", "AI建议转为任务后仍由业务系统执行"] },
  { id: "privacy-and-access", title: "租户、隐私与权限边界", systemOfRecord: "operations", owns: ["组织身份", "角色权限", "隐私政策版本", "数据保留策略", "审计日志"], consumes: ["portrait", "deepen", "lead", "convert", "care", "decision"], rules: ["经营层定义政策与权限，画像层记录具体客户的触达同意和渠道偏好", "所有业务记录携带租户上下文", "触达前校验同意和偏好", "跨境和敏感数据按国家包治理"] },
];

export const FACTORY_PLATFORM_FOUNDATION_IDS = [
  "data-foundation",
  "integration-hub",
  "workflow-engine",
  "compliance-guardrail",
  "ai-governance",
  "value-delivery",
] as const;

export type FactoryPlatformFoundationId = (typeof FACTORY_PLATFORM_FOUNDATION_IDS)[number];

export type FactoryPlatformFoundation = {
  id: FactoryPlatformFoundationId;
  sequence: number;
  label: string;
  mission: string;
  capabilities: readonly string[];
  consumers: readonly FactoryPlatformCategoryKey[];
  requiredFromPhase: FactoryPlatformPhaseId;
  exitCriteria: readonly string[];
};

/** Horizontal foundations are shared services, never a 13th business category. */
export const FACTORY_PLATFORM_FOUNDATIONS: readonly FactoryPlatformFoundation[] = [
  { id: "data-foundation", sequence: 1, label: "数据底座", mission: "统一企业、联系人、产品、内容、询盘、订单、批次、发票和回款标识及事件。", capabilities: ["主数据管理", "统一对象ID", "事件总线", "指标与血缘"], consumers: FACTORY_PLATFORM_CATEGORY_KEYS, requiredFromPhase: "revenue-loop", exitCriteria: ["核心对象只有一个权威标识", "跨类事件携带租户、来源和时间", "指标可追到事实记录"] },
  { id: "integration-hub", sequence: 2, label: "集成中台", mission: "以稳定适配层连接ERP、财务、物流、海关、电商、广告和消息平台。", capabilities: ["API网关", "Webhook", "连接器目录", "映射与重试"], consumers: FACTORY_PLATFORM_CATEGORY_KEYS, requiredFromPhase: "revenue-loop", exitCriteria: ["供应商字段不进入核心模型", "连接失败可重试和补偿", "调用具备租户权限和审计"] },
  { id: "workflow-engine", sequence: 3, label: "流程引擎", mission: "统一询盘分配、报价审批、合同审核、采购、质量、退款和招聘等业务流程。", capabilities: ["流程编排", "规则决策", "审批任务", "超时升级"], consumers: FACTORY_PLATFORM_CATEGORY_KEYS, requiredFromPhase: "revenue-loop", exitCriteria: ["流程状态与业务事实分离", "每个任务有负责人和时限", "异常具备补偿或人工接管"] },
  { id: "compliance-guardrail", sequence: 4, label: "合规护栏", mission: "集中治理证照、贸易、隐私、碳数据、产品追溯、保留期限和审计证据。", capabilities: ["证照到期", "贸易规则", "隐私同意", "追溯证据"], consumers: FACTORY_PLATFORM_CATEGORY_KEYS, requiredFromPhase: "manufacturing-loop", exitCriteria: ["规则按国家、产品和版本生效", "高风险动作发布前被阻断", "证据可导出且不可静默覆盖"] },
  { id: "ai-governance", sequence: 5, label: "智能治理", mission: "统一模型、智能体、知识库、权限、人工复核、评测、成本和操作日志。", capabilities: ["模型路由", "事实引用", "人工复核", "评测与成本"], consumers: FACTORY_PLATFORM_CATEGORY_KEYS, requiredFromPhase: "global-intelligence", exitCriteria: ["AI输出可追到授权事实", "正式状态变更必须人工确认", "质量、成本和风险均可度量"] },
  { id: "value-delivery", sequence: 6, label: "价值交付", mission: "统一套餐装配、能力授权、用量、实施、培训、验收、续费和投资回报证据。", capabilities: ["套餐装配", "权益计量", "实施验收", "价值基线"], consumers: FACTORY_PLATFORM_CATEGORY_KEYS, requiredFromPhase: "revenue-loop", exitCriteria: ["套餐不改变业务事实源", "功能开通可追到合同与权限", "续费有上线前后价值证据"] },
];

export const FACTORY_PLATFORM_PRIORITY_PROGRAM_IDS = [
  "smart-quote",
  "product-passport",
  "value-proof",
  "carbon-trade-compliance",
  "customer-assets",
] as const;

export type FactoryPlatformPriorityProgramId = (typeof FACTORY_PLATFORM_PRIORITY_PROGRAM_IDS)[number];

export type FactoryPlatformPriorityProgram = {
  id: FactoryPlatformPriorityProgramId;
  sequence: number;
  label: string;
  categoryKeys: readonly FactoryPlatformCategoryKey[];
  phase: FactoryPlatformPhaseId;
  objective: string;
  capabilities: readonly string[];
  foundationIds: readonly FactoryPlatformFoundationId[];
  customerValue: string;
  exitCriteria: readonly string[];
};

export const FACTORY_PLATFORM_PRIORITY_PROGRAMS: readonly FactoryPlatformPriorityProgram[] = [
  { id: "smart-quote", sequence: 1, label: "智能报价", categoryKeys: ["identity", "convert", "fulfillment", "operations"], phase: "revenue-loop", objective: "用产品配置、价格、MOQ、汇率、运费、毛利和审批形成可转订单的CPQ报价。", capabilities: ["产品选型", "阶梯价格", "毛利校验", "报价转单"], foundationIds: ["data-foundation", "integration-hub", "workflow-engine"], customerValue: "缩短报价时间、减少错价并让销售承诺可制造且可盈利。", exitCriteria: ["报价行关联权威产品版本", "价格和汇率带版本与期限", "审批通过后才能生成合同或订单意向"] },
  { id: "product-passport", sequence: 2, label: "产品护照", categoryKeys: ["identity", "fulfillment", "operations"], phase: "manufacturing-loop", objective: "以产品、材料、供应商、BOM、批次、证照和维修回收数据形成可验证数字身份。", capabilities: ["唯一标识", "批次追溯", "证照资料", "二维码护照"], foundationIds: ["data-foundation", "integration-hub", "compliance-guardrail"], customerValue: "降低跨境资料准备成本，提高产品透明度和市场准入能力。", exitCriteria: ["护照数据可追到权威来源", "访问权限按角色和法规控制", "变更保留版本、签名和审计"] },
  { id: "value-proof", sequence: 3, label: "价值证明", categoryKeys: ["decision", "operations", "care"], phase: "revenue-loop", objective: "记录上线前基线、实施范围、结果周期和指标口径，形成续费与销售证据。", capabilities: ["价值基线", "上线对比", "证据归档", "续费建议"], foundationIds: ["data-foundation", "value-delivery"], customerValue: "让客户持续看见获客、成交、履约、回款和复购的真实改善。", exitCriteria: ["指标具备基线、周期和负责人", "结果可下钻到业务事实", "客户授权后才能用于对外案例"] },
  { id: "carbon-trade-compliance", sequence: 4, label: "碳贸合规", categoryKeys: ["fulfillment", "operations", "decision"], phase: "manufacturing-loop", objective: "按产品和批次汇集原料、能源、运输、排放与贸易资料，支持碳成本和申报准备。", capabilities: ["产品碳账", "供应排放", "碳成本", "申报资料"], foundationIds: ["data-foundation", "integration-hub", "compliance-guardrail"], customerValue: "把临时合规填表转成持续可追溯的数据能力。", exitCriteria: ["排放因子带来源和版本", "批次数据可复核", "申报输出经过合规负责人审批"] },
  { id: "customer-assets", sequence: 5, label: "客户资产", categoryKeys: ["fulfillment", "care", "operations"], phase: "manufacturing-loop", objective: "登记客户实际拥有的设备、项目、序列号、保修、配件和维护关系。", capabilities: ["装机档案", "保修期限", "配件关系", "维护续费"], foundationIds: ["data-foundation", "workflow-engine", "value-delivery"], customerValue: "把一次订单延伸为售后、配件、耗材、维护、续约和增购收入。", exitCriteria: ["客户资产关联确认订单和序列号", "服务记录不覆盖产品和订单事实", "到期行动具备负责人和结果"] },
];

export const FACTORY_PLATFORM_COMMERCIAL_PACKAGE_IDS = ["acquisition", "growth", "operations", "global"] as const;
export type FactoryPlatformCommercialPackageId = (typeof FACTORY_PLATFORM_COMMERCIAL_PACKAGE_IDS)[number];

export type FactoryPlatformCommercialPackage = {
  id: FactoryPlatformCommercialPackageId;
  sequence: number;
  label: string;
  categoryKeys: readonly FactoryPlatformCategoryKey[];
  priorityProgramIds: readonly FactoryPlatformPriorityProgramId[];
  promise: string;
  evidenceRequired: readonly string[];
};

/** Packages assemble permissions and delivery scope; they never become a competing business ledger. */
export const FACTORY_PLATFORM_COMMERCIAL_PACKAGES: readonly FactoryPlatformCommercialPackage[] = [
  { id: "acquisition", sequence: 1, label: "获客版", categoryKeys: ["identity", "content", "trust", "recommend"], priorityProgramIds: [], promise: "建立产品定位、数字阵地、搜索信任和AI推荐基础。", evidenceRequired: ["内容上线周期", "有效收录与可见性", "企业事实完整度"] },
  { id: "growth", sequence: 2, label: "增长版", categoryKeys: ["identity", "content", "trust", "recommend", "deepen", "portrait", "lead", "convert"], priorityProgramIds: ["smart-quote"], promise: "从内容和流量贯通到合法画像、询盘、报价和成交。", evidenceRequired: ["有效询盘率", "响应与报价周期", "询盘到订单转化"] },
  { id: "operations", sequence: 3, label: "经营版", categoryKeys: FACTORY_PLATFORM_CATEGORY_KEYS, priorityProgramIds: ["smart-quote", "value-proof", "customer-assets"], promise: "贯通营销、成交、履约、客户经营、财务和决策。", evidenceRequired: ["订单履约追溯", "毛利与现金口径", "复购与客户价值"] },
  { id: "global", sequence: 4, label: "全球版", categoryKeys: FACTORY_PLATFORM_CATEGORY_KEYS, priorityProgramIds: FACTORY_PLATFORM_PRIORITY_PROGRAM_IDS, promise: "在经营版基础上增加全球内容、产品护照、碳贸合规和智能治理。", evidenceRequired: ["国家与渠道配置包", "产品合规证据", "跨境数据与AI审计"] },
];

export const FACTORY_PLATFORM_DEVELOPMENT_GATE_IDS = [
  "intake-review",
  "contract-freeze",
  "security-review",
  "implementation",
  "acceptance",
  "release",
  "value-review",
] as const;
export type FactoryPlatformDevelopmentGateId = (typeof FACTORY_PLATFORM_DEVELOPMENT_GATE_IDS)[number];

export type FactoryPlatformDevelopmentGate = {
  id: FactoryPlatformDevelopmentGateId;
  sequence: number;
  label: string;
  purpose: string;
  requiredArtifacts: readonly string[];
  exitCriteria: readonly string[];
};

export const FACTORY_PLATFORM_DEVELOPMENT_GATES: readonly FactoryPlatformDevelopmentGate[] = [
  { id: "intake-review", sequence: 1, label: "立项评审", purpose: "确认客户问题、服务对象、业务负责人、套餐位置和价值指标。", requiredArtifacts: ["问题与用户说明", "业务负责人", "价值基线", "优先级与范围"], exitCriteria: ["问题可验证且不是重复能力", "负责人接受结果指标"] },
  { id: "contract-freeze", sequence: 2, label: "契约冻结", purpose: "冻结输入输出、主数据、上下游、事件、接口和事实源边界。", requiredArtifacts: ["领域对象", "接口与事件", "上下游影响图", "迁移兼容方案"], exitCriteria: ["没有竞争性事实源", "消费者和发布影响已确认"] },
  { id: "security-review", sequence: 3, label: "安全评审", purpose: "确认租户、角色、隐私、跨境、审计、AI和高风险动作控制。", requiredArtifacts: ["权限矩阵", "数据分级", "威胁与合规检查", "审计与保留策略"], exitCriteria: ["越权和跨租户测试通过", "高风险动作有人审和回退"] },
  { id: "implementation", sequence: 4, label: "开发验收", purpose: "按冻结契约完成代码、测试、迁移、监控、文档和三端装配。", requiredArtifacts: ["实现与测试", "迁移和回滚", "监控告警", "三端配置"], exitCriteria: ["自动门禁通过", "失败路径和补偿路径可演练"] },
  { id: "acceptance", sequence: 5, label: "业务验收", purpose: "按真实角色、数据和端到端流程验证功能、性能、口径和证据。", requiredArtifacts: ["验收用例", "真实流程演示", "指标口径", "问题闭环"], exitCriteria: ["业务负责人签字", "关键指标达到试点阈值"] },
  { id: "release", sequence: 6, label: "发布准备", purpose: "完成影响预演、版本、灰度、恢复点、支持责任和销售口径。", requiredArtifacts: ["差异与影响报告", "发布和回滚方案", "试点白名单", "销售能力说明"], exitCriteria: ["来源端到运行端发布链可审计", "未验收能力保持规划或试点"] },
  { id: "value-review", sequence: 7, label: "价值复盘", purpose: "比较上线前后结果，决定推广、优化、降级、续费或停止。", requiredArtifacts: ["价值对比", "客户反馈", "质量成本报告", "下一轮决策"], exitCriteria: ["结果可追到事实和周期", "下一轮负责人和范围明确"] },
];

export const FACTORY_PLATFORM_APPLICATION_CONTRACT_FIELD_IDS = [
  "service-object", "problem", "input-data", "output-result", "upstream", "downstream", "owner", "permissions",
  "success-metrics", "evidence", "package", "billing", "implementation-cycle", "maturity", "acceptance",
] as const;
export type FactoryPlatformApplicationContractFieldId = (typeof FACTORY_PLATFORM_APPLICATION_CONTRACT_FIELD_IDS)[number];

export type FactoryPlatformApplicationContractField = {
  id: FactoryPlatformApplicationContractFieldId;
  label: string;
  requiredAt: FactoryPlatformDevelopmentGateId;
  description: string;
};

export const FACTORY_PLATFORM_APPLICATION_CONTRACT_FIELDS: readonly FactoryPlatformApplicationContractField[] = [
  { id: "service-object", label: "服务对象", requiredAt: "intake-review", description: "明确购买者、使用者、审批者和受影响角色。" },
  { id: "problem", label: "客户问题", requiredAt: "intake-review", description: "写清现状、损失、触发场景和不开发的后果。" },
  { id: "input-data", label: "输入数据", requiredAt: "contract-freeze", description: "列出对象、来源、质量、更新频率和权威系统。" },
  { id: "output-result", label: "输出结果", requiredAt: "contract-freeze", description: "明确状态、事件、文件、任务或指标输出。" },
  { id: "upstream", label: "上游应用", requiredAt: "contract-freeze", description: "声明依赖能力、接口版本和失败处理。" },
  { id: "downstream", label: "下游应用", requiredAt: "contract-freeze", description: "声明消费者、兼容范围和变更影响。" },
  { id: "owner", label: "业务负责", requiredAt: "intake-review", description: "指定业务、产品、技术和上线后的运营责任人。" },
  { id: "permissions", label: "权限范围", requiredAt: "security-review", description: "定义租户、角色、字段、动作、跨境和人工审批边界。" },
  { id: "success-metrics", label: "成功指标", requiredAt: "intake-review", description: "定义基线、目标、周期、口径和指标负责人。" },
  { id: "evidence", label: "客户证据", requiredAt: "acceptance", description: "保存版本、范围、样本、验收和客户授权证明。" },
  { id: "package", label: "所属套餐", requiredAt: "intake-review", description: "声明套餐、增值包和不可用时的降级行为。" },
  { id: "billing", label: "计费方式", requiredAt: "intake-review", description: "说明订阅、用量、席位、交易或实施计费口径。" },
  { id: "implementation-cycle", label: "实施周期", requiredAt: "implementation", description: "定义准备、配置、迁移、培训、试点和验收周期。" },
  { id: "maturity", label: "成熟状态", requiredAt: "release", description: "只允许规划、试点、已具备，并绑定范围和证据。" },
  { id: "acceptance", label: "验收标准", requiredAt: "acceptance", description: "覆盖功能、权限、数据、性能、监控、回退和价值。" },
];

export type FactoryPlatformContinuousDevelopmentStage = {
  id: string;
  sequence: number;
  label: string;
  categoryKeys: readonly FactoryPlatformCategoryKey[];
  foundationIds: readonly FactoryPlatformFoundationId[];
  priorityProgramIds: readonly FactoryPlatformPriorityProgramId[];
  deliverables: readonly string[];
  exitGate: FactoryPlatformDevelopmentGateId;
};

export const FACTORY_PLATFORM_CONTINUOUS_DEVELOPMENT_SEQUENCE: readonly FactoryPlatformContinuousDevelopmentStage[] = [
  { id: "connect-foundations", sequence: 1, label: "打通底座", categoryKeys: ["portrait", "decision", "operations"], foundationIds: ["data-foundation", "integration-hub", "workflow-engine", "value-delivery"], priorityProgramIds: ["value-proof"], deliverables: ["统一对象ID与事件", "租户角色权限", "流程任务与审计", "价值基线"], exitGate: "security-review" },
  { id: "connect-revenue", sequence: 2, label: "打通成交", categoryKeys: ["identity", "convert", "fulfillment", "operations"], foundationIds: ["data-foundation", "integration-hub", "workflow-engine"], priorityProgramIds: ["smart-quote"], deliverables: ["产品选型", "报价审批", "合同订单", "收付款状态"], exitGate: "acceptance" },
  { id: "connect-fulfillment", sequence: 3, label: "打通履约", categoryKeys: ["fulfillment", "care", "operations"], foundationIds: ["data-foundation", "integration-hub", "workflow-engine"], priorityProgramIds: ["customer-assets"], deliverables: ["供应质量", "批次库存", "发运签收", "售后资产"], exitGate: "acceptance" },
  { id: "connect-compliance", sequence: 4, label: "打通合规", categoryKeys: ["identity", "fulfillment", "decision", "operations"], foundationIds: ["data-foundation", "integration-hub", "compliance-guardrail"], priorityProgramIds: ["product-passport", "carbon-trade-compliance"], deliverables: ["产品护照", "证照追溯", "产品碳账", "申报证据"], exitGate: "release" },
  { id: "connect-lifecycle", sequence: 5, label: "打通深养", categoryKeys: ["portrait", "care", "decision"], foundationIds: ["data-foundation", "workflow-engine", "value-delivery"], priorityProgramIds: ["customer-assets", "value-proof"], deliverables: ["客户资产", "服务维护", "续费增购", "客户价值证明"], exitGate: "value-review" },
  { id: "connect-intelligence", sequence: 6, label: "打通智能", categoryKeys: ["recommend", "lead", "convert", "decision"], foundationIds: ["data-foundation", "workflow-engine", "ai-governance"], priorityProgramIds: ["value-proof"], deliverables: ["授权知识", "模型评测", "人工复核", "预测任务闭环"], exitGate: "value-review" },
  { id: "open-ecosystem", sequence: 7, label: "开放生态", categoryKeys: FACTORY_PLATFORM_CATEGORY_KEYS, foundationIds: FACTORY_PLATFORM_FOUNDATION_IDS, priorityProgramIds: FACTORY_PLATFORM_PRIORITY_PROGRAM_IDS, deliverables: ["连接器市场", "开发者契约", "行业方案包", "伙伴认证与分成"], exitGate: "release" },
];

export const FACTORY_PLATFORM_EXECUTION_STATUSES = ["active", "queued", "blocked", "done"] as const;
export type FactoryPlatformExecutionStatus = (typeof FACTORY_PLATFORM_EXECUTION_STATUSES)[number];

export type FactoryPlatformExecutionWorkstream = {
  id: string;
  sequence: number;
  label: string;
  status: FactoryPlatformExecutionStatus;
  currentGate: FactoryPlatformDevelopmentGateId;
  ownerRoles: readonly string[];
  deliverables: readonly string[];
  blockers: readonly string[];
  nextAction: string;
};

/** First governed queue. Only one workstream is active until its gate produces reviewable evidence. */
export const FACTORY_PLATFORM_EXECUTION_WORKSTREAMS: readonly FactoryPlatformExecutionWorkstream[] = [
  { id: "development-control-desk", sequence: 1, label: "执行中台", status: "active", currentGate: "intake-review", ownerRoles: ["总部平台产品负责人", "平台架构负责人"], deliverables: ["工作流队列", "门禁状态", "责任与阻断", "证据索引"], blockers: [], nextAction: "确认执行台持久化模型、权限和首批工作项负责人。" },
  { id: "object-event-contract", sequence: 2, label: "对象事件", status: "queued", currentGate: "intake-review", ownerRoles: ["数据架构负责人", "十二类领域负责人"], deliverables: ["核心对象字典", "事件信封", "事实源边界", "版本兼容"], blockers: ["等待执行台责任人确认"], nextAction: "评审21个核心对象与12个关键事件的事实源和消费者。" },
  { id: "revenue-golden-flow", sequence: 3, label: "成交金链", status: "queued", currentGate: "intake-review", ownerRoles: ["销售产品负责人", "订单履约负责人", "财务负责人"], deliverables: ["产品到询盘", "询盘到报价", "报价到订单", "订单到回款"], blockers: ["依赖统一对象事件契约"], nextAction: "选择一个真实产品、客户和订单样本冻结验收链路。" },
  { id: "implementation-center", sequence: 4, label: "实施中心", status: "queued", currentGate: "intake-review", ownerRoles: ["客户成功负责人", "实施交付负责人"], deliverables: ["准备度评估", "7/30/90天计划", "培训验收", "价值复盘"], blockers: ["依赖成交金链验收模板"], nextAction: "定义首个试点客户的准备清单和30天黄金链目标。" },
  { id: "machinery-industry-pack", sequence: 5, label: "机械行业", status: "queued", currentGate: "intake-review", ownerRoles: ["行业产品负责人", "实施方案负责人"], deliverables: ["机械产品模型", "RFQ与选型", "序列号资产", "配件售后"], blockers: ["依赖对象事件和实施中心"], nextAction: "选择机械设备细分行业并确认标准字段、流程和样板数据。" },
];

export const FACTORY_PLATFORM_CORE_OBJECT_IDS = [
  "organization", "employee", "account", "contact", "product", "sku", "content", "campaign", "inquiry", "opportunity",
  "quote", "contract", "order", "bom", "batch", "inventory", "shipment", "invoice", "payment", "customer-asset", "service-ticket", "product-passport",
] as const;
export type FactoryPlatformCoreObjectId = (typeof FACTORY_PLATFORM_CORE_OBJECT_IDS)[number];

export type FactoryPlatformCoreObject = {
  id: FactoryPlatformCoreObjectId;
  label: string;
  systemOfRecord: FactoryPlatformCategoryKey;
  identityRule: string;
  minimumFields: readonly string[];
};

export const FACTORY_PLATFORM_CORE_OBJECTS: readonly FactoryPlatformCoreObject[] = [
  { id: "organization", label: "组织", systemOfRecord: "operations", identityRule: "租户内组织编码唯一，跨租户禁止复用内部ID。", minimumFields: ["tenantId", "organizationId", "name", "status", "version"] },
  { id: "employee", label: "员工", systemOfRecord: "operations", identityRule: "员工ID与组织、任职周期绑定。", minimumFields: ["tenantId", "employeeId", "organizationId", "status", "version"] },
  { id: "account", label: "企业客户", systemOfRecord: "portrait", identityRule: "企业主体按登记标识、域名和人工合并记录统一。", minimumFields: ["tenantId", "accountId", "name", "country", "status"] },
  { id: "contact", label: "联系人", systemOfRecord: "portrait", identityRule: "联系人身份与触达同意分开版本化。", minimumFields: ["tenantId", "contactId", "accountId", "consentStatus", "version"] },
  { id: "product", label: "产品", systemOfRecord: "fulfillment", identityRule: "产品族和工程版本使用稳定产品ID。", minimumFields: ["tenantId", "productId", "name", "engineeringVersion", "status"] },
  { id: "sku", label: "规格单元", systemOfRecord: "fulfillment", identityRule: "SKU由产品版本和可交易规格组合唯一确定。", minimumFields: ["tenantId", "skuId", "productId", "specification", "status"] },
  { id: "content", label: "内容资产", systemOfRecord: "content", identityRule: "内容ID与语言、渠道和发布版本分离。", minimumFields: ["tenantId", "contentId", "locale", "sourceVersion", "status"] },
  { id: "campaign", label: "营销活动", systemOfRecord: "lead", identityRule: "活动ID统一连接渠道、预算、素材和归因窗口。", minimumFields: ["tenantId", "campaignId", "channel", "budget", "status"] },
  { id: "inquiry", label: "询盘", systemOfRecord: "convert", identityRule: "每个来源请求生成一次询盘ID并保留原始载荷摘要。", minimumFields: ["tenantId", "inquiryId", "accountId", "source", "status"] },
  { id: "opportunity", label: "商机", systemOfRecord: "care", identityRule: "商机围绕企业客户、需求和责任团队建立。", minimumFields: ["tenantId", "opportunityId", "accountId", "ownerId", "stage"] },
  { id: "quote", label: "报价", systemOfRecord: "convert", identityRule: "报价主键稳定，修订使用版本号。", minimumFields: ["tenantId", "quoteId", "opportunityId", "currency", "version"] },
  { id: "contract", label: "合同", systemOfRecord: "operations", identityRule: "合同ID连接签署版本、交易对象和审批记录。", minimumFields: ["tenantId", "contractId", "accountId", "signedVersion", "status"] },
  { id: "order", label: "确认订单", systemOfRecord: "fulfillment", identityRule: "只有履约层或外部权威OMS可生成确认订单ID。", minimumFields: ["tenantId", "orderId", "accountId", "currency", "status"] },
  { id: "bom", label: "物料清单", systemOfRecord: "fulfillment", identityRule: "BOM按产品、工厂、生效时间和工程版本唯一。", minimumFields: ["tenantId", "bomId", "productId", "engineeringVersion", "effectiveAt"] },
  { id: "batch", label: "生产批次", systemOfRecord: "fulfillment", identityRule: "批次ID关联工单、产品版本和工厂。", minimumFields: ["tenantId", "batchId", "productId", "plantId", "status"] },
  { id: "inventory", label: "库存", systemOfRecord: "fulfillment", identityRule: "库存余额由SKU、仓库、批次和库存状态确定。", minimumFields: ["tenantId", "inventoryId", "skuId", "warehouseId", "quantity"] },
  { id: "shipment", label: "发运", systemOfRecord: "fulfillment", identityRule: "发运ID关联订单行、承运商和原始回执。", minimumFields: ["tenantId", "shipmentId", "orderId", "carrier", "status"] },
  { id: "invoice", label: "发票", systemOfRecord: "operations", identityRule: "发票ID与财务过账及法定号码关联。", minimumFields: ["tenantId", "invoiceId", "orderId", "currency", "status"] },
  { id: "payment", label: "回款", systemOfRecord: "operations", identityRule: "回款ID来自财务或支付权威回执。", minimumFields: ["tenantId", "paymentId", "invoiceId", "amount", "status"] },
  { id: "customer-asset", label: "客户资产", systemOfRecord: "care", identityRule: "客户资产由确认订单、序列号和安装位置唯一关联。", minimumFields: ["tenantId", "assetId", "accountId", "orderId", "serialNumber"] },
  { id: "service-ticket", label: "服务工单", systemOfRecord: "care", identityRule: "工单ID连接客户资产、问题、SLA和责任人。", minimumFields: ["tenantId", "ticketId", "assetId", "ownerId", "status"] },
  { id: "product-passport", label: "产品护照", systemOfRecord: "fulfillment", identityRule: "护照由租户、已发布工程版本和权威交付批次唯一确定，证书与客户资产只按稳定ID引用。", minimumFields: ["tenantId", "passportId", "productId", "skuId", "engineeringVersionId", "batchId", "traceDigest", "status"] },
];

export const FACTORY_PLATFORM_EVENT_REQUIRED_FIELDS = ["eventId", "tenantId", "eventType", "occurredAt", "source", "subjectId", "version", "correlationId"] as const;

export const FACTORY_PLATFORM_CORE_EVENT_IDS = [
  "inquiry-created", "quote-submitted", "quote-accepted", "order-confirmed", "production-completed", "quality-released",
  "shipment-delivered", "invoice-issued", "payment-received", "customer-asset-created", "service-resolved", "warranty-expiring",
  "engineering-version-released", "product-passport-published",
] as const;
export type FactoryPlatformCoreEventId = (typeof FACTORY_PLATFORM_CORE_EVENT_IDS)[number];

export type FactoryPlatformCoreEvent = {
  id: FactoryPlatformCoreEventId;
  label: string;
  subject: FactoryPlatformCoreObjectId;
  producer: FactoryPlatformCategoryKey;
  consumers: readonly FactoryPlatformCategoryKey[];
  requiredFields: readonly string[];
};

export const FACTORY_PLATFORM_CORE_EVENTS: readonly FactoryPlatformCoreEvent[] = [
  { id: "inquiry-created", label: "询盘创建", subject: "inquiry", producer: "convert", consumers: ["portrait", "care", "decision"], requiredFields: FACTORY_PLATFORM_EVENT_REQUIRED_FIELDS },
  { id: "quote-submitted", label: "报价提交", subject: "quote", producer: "convert", consumers: ["care", "fulfillment", "decision"], requiredFields: FACTORY_PLATFORM_EVENT_REQUIRED_FIELDS },
  { id: "quote-accepted", label: "报价接受", subject: "quote", producer: "convert", consumers: ["fulfillment", "operations", "decision"], requiredFields: FACTORY_PLATFORM_EVENT_REQUIRED_FIELDS },
  { id: "order-confirmed", label: "订单确认", subject: "order", producer: "fulfillment", consumers: ["care", "operations", "decision"], requiredFields: FACTORY_PLATFORM_EVENT_REQUIRED_FIELDS },
  { id: "production-completed", label: "生产完成", subject: "batch", producer: "fulfillment", consumers: ["operations", "decision"], requiredFields: FACTORY_PLATFORM_EVENT_REQUIRED_FIELDS },
  { id: "quality-released", label: "质量放行", subject: "batch", producer: "fulfillment", consumers: ["care", "operations", "decision"], requiredFields: FACTORY_PLATFORM_EVENT_REQUIRED_FIELDS },
  { id: "shipment-delivered", label: "货物签收", subject: "shipment", producer: "fulfillment", consumers: ["care", "operations", "decision"], requiredFields: FACTORY_PLATFORM_EVENT_REQUIRED_FIELDS },
  { id: "invoice-issued", label: "发票开具", subject: "invoice", producer: "operations", consumers: ["care", "decision"], requiredFields: FACTORY_PLATFORM_EVENT_REQUIRED_FIELDS },
  { id: "payment-received", label: "回款完成", subject: "payment", producer: "operations", consumers: ["care", "decision"], requiredFields: FACTORY_PLATFORM_EVENT_REQUIRED_FIELDS },
  { id: "customer-asset-created", label: "资产建档", subject: "customer-asset", producer: "care", consumers: ["fulfillment", "operations", "decision"], requiredFields: FACTORY_PLATFORM_EVENT_REQUIRED_FIELDS },
  { id: "service-resolved", label: "服务完成", subject: "service-ticket", producer: "care", consumers: ["fulfillment", "decision"], requiredFields: FACTORY_PLATFORM_EVENT_REQUIRED_FIELDS },
  { id: "warranty-expiring", label: "保修到期", subject: "customer-asset", producer: "care", consumers: ["convert", "decision"], requiredFields: FACTORY_PLATFORM_EVENT_REQUIRED_FIELDS },
  { id: "engineering-version-released", label: "工程版本发布", subject: "product", producer: "fulfillment", consumers: ["content", "convert", "operations", "decision"], requiredFields: FACTORY_PLATFORM_EVENT_REQUIRED_FIELDS },
  { id: "product-passport-published", label: "产品护照发布", subject: "product-passport", producer: "fulfillment", consumers: ["content", "care", "operations", "decision"], requiredFields: FACTORY_PLATFORM_EVENT_REQUIRED_FIELDS },
];

export const FACTORY_PLATFORM_GOLDEN_FLOW_IDS = ["revenue", "fulfillment", "asset-renewal", "global-compliance", "governed-ai"] as const;
export type FactoryPlatformGoldenFlowId = (typeof FACTORY_PLATFORM_GOLDEN_FLOW_IDS)[number];

export type FactoryPlatformGoldenFlow = {
  id: FactoryPlatformGoldenFlowId;
  sequence: number;
  label: string;
  objective: string;
  categoryKeys: readonly FactoryPlatformCategoryKey[];
  objectIds: readonly FactoryPlatformCoreObjectId[];
  eventIds: readonly FactoryPlatformCoreEventId[];
  steps: readonly string[];
  exitCriteria: readonly string[];
};

export const FACTORY_PLATFORM_GOLDEN_FLOWS: readonly FactoryPlatformGoldenFlow[] = [
  { id: "revenue", sequence: 1, label: "收入闭环", objective: "从产品事实和内容触点追到询盘、报价、确认订单、发票与回款。", categoryKeys: ["identity", "content", "convert", "fulfillment", "operations", "decision"], objectIds: ["product", "content", "inquiry", "opportunity", "quote", "contract", "order", "invoice", "payment"], eventIds: ["inquiry-created", "quote-submitted", "quote-accepted", "order-confirmed", "invoice-issued", "payment-received"], steps: ["产品与内容", "询盘与商机", "报价与合同", "确认订单", "发票与回款"], exitCriteria: ["每笔回款可追到订单、报价、客户、产品和来源", "销售、履约和财务状态不存在竞争台账"] },
  { id: "fulfillment", sequence: 2, label: "制造履约", objective: "从确认订单追到物料、生产、批次、质量、库存、发运和签收。", categoryKeys: ["convert", "fulfillment", "operations", "decision"], objectIds: ["order", "product", "bom", "batch", "inventory", "shipment"], eventIds: ["order-confirmed", "production-completed", "quality-released", "shipment-delivered"], steps: ["订单确认", "物料计划", "生产批次", "质量放行", "发运签收"], exitCriteria: ["订单行可追到BOM、工单、批次、检验和发运", "异常具备责任、补偿和审计"] },
  { id: "asset-renewal", sequence: 3, label: "资产续费", objective: "从确认订单和序列号建立客户资产，连接服务、维护、到期、续费和增购。", categoryKeys: ["fulfillment", "care", "convert", "decision"], objectIds: ["account", "order", "customer-asset", "service-ticket", "quote"], eventIds: ["order-confirmed", "customer-asset-created", "service-resolved", "warranty-expiring", "quote-submitted"], steps: ["资产建档", "保修维护", "服务闭环", "到期提醒", "续费增购"], exitCriteria: ["客户资产关联订单、产品和序列号", "续费机会可追到服务结果和客户价值"] },
  { id: "global-compliance", sequence: 4, label: "出海合规", objective: "以产品、BOM、批次、证照和排放证据形成产品护照与贸易资料。", categoryKeys: ["identity", "fulfillment", "operations", "decision"], objectIds: ["product", "sku", "bom", "batch", "shipment", "product-passport"], eventIds: ["engineering-version-released", "production-completed", "quality-released", "shipment-delivered", "product-passport-published"], steps: ["产品身份", "材料批次", "质量证照", "碳与贸易", "护照登记"], exitCriteria: ["合规数据可追到来源和版本", "申报与登记经过责任人审批"] },
  { id: "governed-ai", sequence: 5, label: "智能行动", objective: "把AI建议限制在授权事实内，经人工复核转成责任任务并复盘结果。", categoryKeys: ["recommend", "lead", "convert", "decision", "operations"], objectIds: ["content", "campaign", "inquiry", "opportunity", "order"], eventIds: ["inquiry-created", "quote-submitted", "order-confirmed", "payment-received"], steps: ["授权取数", "生成建议", "人工复核", "责任任务", "结果复盘"], exitCriteria: ["输出带事实引用和模型版本", "正式业务状态只由授权人员或权威系统变更"] },
];

export type FactoryPlatformConfigurationPack = {
  id: string;
  label: string;
  scope: string;
  capabilities: readonly string[];
  requiredEvidence: readonly string[];
};

export const FACTORY_PLATFORM_INDUSTRY_PACKS: readonly FactoryPlatformConfigurationPack[] = [
  { id: "machinery", label: "机械设备", scope: "离散制造、项目型设备和配件售后", capabilities: ["参数选型", "RFQ报价", "序列号资产", "配件维护"], requiredEvidence: ["行业对象映射", "真实报价样本", "装机售后链"] },
  { id: "building-materials", label: "建材家居", scope: "规格、项目、渠道和工程交付", capabilities: ["规格组合", "项目报价", "经销协同", "批次交付"], requiredEvidence: ["规格模板", "项目订单", "渠道价格规则"] },
  { id: "electronics", label: "电子电器", scope: "多SKU、认证、序列号和质保", capabilities: ["规格认证", "序列追溯", "质量检验", "质保RMA"], requiredEvidence: ["认证清单", "批次序列追溯", "RMA样本"] },
  { id: "auto-parts", label: "汽摩配件", scope: "车型适配、OE号、批次质量和渠道", capabilities: ["车型适配", "交叉料号", "批次质量", "渠道刊登"], requiredEvidence: ["适配关系", "料号映射", "质量追溯"] },
  { id: "textile", label: "纺织服装", scope: "款色码、面辅料、打样、订单和合规", capabilities: ["款色码", "面料BOM", "样品管理", "产品护照"], requiredEvidence: ["款式模板", "打样订单", "材料合规"] },
  { id: "consumer-goods", label: "消费商品", scope: "品牌、渠道、零售、电商和售后", capabilities: ["商品内容", "渠道Feed", "库存价格", "评价售后"], requiredEvidence: ["渠道商品样本", "库存对账", "售后闭环"] },
];

export const FACTORY_PLATFORM_COUNTRY_PACKS: readonly FactoryPlatformConfigurationPack[] = [
  { id: "china", label: "中国市场", scope: "国内B2B/B2C经营", capabilities: ["中文内容", "人民币税价", "国内支付", "电子发票"], requiredEvidence: ["主体与发票配置", "支付对账", "隐私文本"] },
  { id: "eu", label: "欧盟市场", scope: "欧盟成员国市场准入与经营", capabilities: ["多语言欧元", "隐私同意", "产品护照", "碳贸资料"], requiredEvidence: ["目标国清单", "产品法规评估", "数据跨境评估"] },
  { id: "north-america", label: "北美市场", scope: "美国与加拿大市场", capabilities: ["英语法语", "美元加元", "州省税务", "认证与隐私"], requiredEvidence: ["销售地区", "税务连接器", "产品认证清单"] },
  { id: "asean", label: "东盟市场", scope: "东南亚多国渠道", capabilities: ["多语言币种", "渠道电商", "区域物流", "本地支付"], requiredEvidence: ["目标国家", "渠道与支付", "进口资料"] },
  { id: "middle-east", label: "中东市场", scope: "海湾及周边重点市场", capabilities: ["英语阿语", "区域币种", "认证标签", "本地渠道"], requiredEvidence: ["目标国家", "认证标签", "代理渠道规则"] },
];

export type FactoryPlatformImplementationStage = {
  id: "day-7" | "day-30" | "day-90";
  days: 7 | 30 | 90;
  label: string;
  objective: string;
  deliverables: readonly string[];
  exitCriteria: readonly string[];
};

export const FACTORY_PLATFORM_IMPLEMENTATION_STAGES: readonly FactoryPlatformImplementationStage[] = [
  { id: "day-7", days: 7, label: "7天就绪", objective: "完成准备度评估、范围、责任、权限、数据和连接清单。", deliverables: ["准备度评分", "数据清单", "权限角色", "项目计划"], exitCriteria: ["客户负责人确认范围", "关键数据和连接风险可见"] },
  { id: "day-30", days: 30, label: "30天通链", objective: "用真实样本跑通第一条黄金业务链并完成培训。", deliverables: ["黄金链演示", "角色培训", "问题闭环", "试点报告"], exitCriteria: ["端到端流程通过", "客户关键角色可以独立操作"] },
  { id: "day-90", days: 90, label: "90天价值", objective: "形成上线前后价值对比、推广范围和续费扩展计划。", deliverables: ["价值证明", "使用健康", "扩展方案", "续费建议"], exitCriteria: ["指标可追到事实", "客户确认下一阶段决策"] },
];

export type FactoryPlatformPortabilityRule = {
  id: string;
  label: string;
  rule: string;
  evidenceRequired: readonly string[];
};

export const FACTORY_PLATFORM_PORTABILITY_RULES: readonly FactoryPlatformPortabilityRule[] = [
  { id: "business-export", label: "业务导出", rule: "客户可按权限导出客户、产品、订单、服务和财务授权副本。", evidenceRequired: ["导出字段字典", "权限测试", "样例文件"] },
  { id: "asset-export", label: "素材迁移", rule: "客户可迁移自有图片、视频、文档、内容和翻译资产。", evidenceRequired: ["资产清单", "原文件校验", "版权标识"] },
  { id: "api-access", label: "接口开放", rule: "合同范围内提供版本化API和Webhook，不以私有页面作为唯一取数方式。", evidenceRequired: ["接口文档", "版本政策", "限流与审计"] },
  { id: "retention", label: "停用保留", rule: "停用后按合同、法规和客户选择执行只读期、导出期和删除期。", evidenceRequired: ["保留策略", "到期通知", "删除证明"] },
  { id: "no-lock-in", label: "禁止锁定", rule: "不得通过隐藏字段、不可读格式或拒绝合理导出强迫客户续费。", evidenceRequired: ["可读格式", "迁移演练", "退出SLA"] },
  { id: "tenant-deletion", label: "租户清退", rule: "租户退出必须覆盖业务库、对象存储、索引、缓存和授权备份策略。", evidenceRequired: ["清退清单", "审批记录", "完成证明"] },
];

export type FactoryPlatformEndpoint = "hq" | "agency_source" | "client_source";
export type FactoryPlatformRuntimeTarget = "agency_instance" | "client_plan";
export type FactoryPlatformPublishTarget = FactoryPlatformEndpoint | FactoryPlatformRuntimeTarget;

export type FactoryPlatformEndpointResponsibility = {
  endpoint: FactoryPlatformEndpoint;
  label: string;
  mission: string;
  owns: readonly string[];
  mustNot: readonly string[];
  publishesTo: readonly FactoryPlatformPublishTarget[];
  customerValue: string;
};

export const FACTORY_PLATFORM_ENDPOINT_RESPONSIBILITIES: readonly FactoryPlatformEndpointResponsibility[] = [
  { endpoint: "hq", label: "总部端", mission: "定义平台能力、共享契约和可信发布边界。", owns: ["12类应用与字段契约", "套餐版本与国家包", "权限、安全、审计和连接器标准", "发布、灰度、回滚和证据门禁"], mustNot: ["直接篡改客户经营数据", "绕过代理源端或客户源端直达运行实例", "覆盖来源端已批准的本地配置"], publishesTo: ["agency_source", "client_source"], customerValue: "持续获得统一、安全、可升级的平台能力，而不是一次性交付的孤岛软件。" },
  { endpoint: "agency_source", label: "代理源端", mission: "把总部能力组装成代理行业、地区与服务方案。", owns: ["代理行业套装与实施模板", "代理品牌和本地化配置", "连接器映射与服务SLA", "代理端发布前验证"], mustNot: ["复制总部核心实现", "反向覆盖总部契约", "向客户源端或非所属代理端发布", "读取非授权客户数据"], publishesTo: ["agency_instance"], customerValue: "代理服务的客户获得懂行业、能落地且保持持续升级的本地服务。" },
  { endpoint: "client_source", label: "客户源端", mission: "把总部能力组装成客户模板，并承载客户计划的受控发布。", owns: ["客户模板与栏目版面配置", "客户组织权限与计划范围", "运营配置与审批", "客户计划和站点发布前验证"], mustNot: ["修改总部或代理源基线", "向代理源端或非所属客户计划发布", "跨租户共享经营数据", "跳过审批发布高风险配置"], publishesTo: ["client_plan"], customerValue: "工厂在自己的数据和权限边界内使用整套能力，并保留个性化和可迁移性。" },
];

export type FactoryPlatformSalesValueProposition = {
  id: string;
  buyer: readonly FactoryPlatformAudience[];
  pain: string;
  value: string;
  outcome: string;
  proof: readonly string[];
};

export const FACTORY_PLATFORM_SALES_VALUE_PROPOSITIONS: readonly FactoryPlatformSalesValueProposition[] = [
  { id: "one-growth-to-cash-loop", buyer: ["factory_owner", "executive", "finance"], pain: "建站、广告、CRM、ERP各自报喜，却没人说清客户为何成交和订单是否赚钱。", value: "用同一客户、产品、订单和财务主键贯通获客到现金。", outcome: "预算围绕毛利和现金配置，而非围绕流量表面指标。", proof: ["收入来源追溯率", "订单毛利对账", "现金转换周期"] },
  { id: "one-kernel-four-modes", buyer: ["factory_owner", "executive", "operations"], pain: "国内、海外、B2B、B2C各建一套系统，商品库存和客户数据不断冲突。", value: "同一业务内核叠加国家包、渠道包和业务模式包。", outcome: "进入新市场时配置差异而不是复制系统。", proof: ["共用主数据比例", "新市场上线周期", "跨渠道库存一致率"] },
  { id: "sell-what-can-be-delivered", buyer: ["sales", "operations", "production", "quality"], pain: "营销承诺、销售报价与工厂产能质量脱节。", value: "把产品事实、CPQ、产能、质量和交付状态放进一条订单链。", outcome: "更快报价、更少错单并提高准时合格交付。", proof: ["报价周期", "订单变更率", "准时足量交付率"] },
  { id: "customer-lifetime-growth", buyer: ["sales", "service", "marketing"], pain: "成交后客户沉睡，售后问题和复购机会散落在个人沟通中。", value: "从CRM、交付、服务到续约增购持续计算客户健康和下一步行动。", outcome: "把一次订单变成复购、增购和客户倡导。", proof: ["复购率", "净收入留存率", "客户终身价值"] },
  { id: "governed-operational-ai", buyer: ["factory_owner", "executive", "it"], pain: "通用AI不了解企业事实，输出无法审计，也不能真正执行。", value: "AI只读取授权事实，在业务流程中给建议并转成有人负责的任务。", outcome: "获得可复核、可执行、可度量的智能，而非孤立聊天工具。", proof: ["回答事实引用率", "人工复核记录", "建议闭环率"] },
  { id: "modular-without-rip-replace", buyer: ["factory_owner", "it", "finance"], pain: "企业既怕一次性替换风险，也怕新增工具继续形成孤岛。", value: "中小工厂可用原生Lite模块，成熟工厂可连接既有ERP、MES和财务。", outcome: "按价值阶段实施，同时坚持统一契约和数据边界。", proof: ["连接器覆盖率", "阶段上线时长", "重复录入下降率"] },
];

export type FactoryPlatformDifferentiator = {
  id: string;
  title: string;
  claim: string;
  contrast: string;
  evidenceRequired: readonly string[];
};

export const FACTORY_PLATFORM_DIFFERENTIATORS: readonly FactoryPlatformDifferentiator[] = [
  { id: "full-value-chain", title: "不是单点工具，而是完整价值链", claim: "12类覆盖经营、身份、获客、成交、制造、交付、深养和决策。", contrast: "建站、广告、CRM或ERP单点平台只优化局部。", evidenceRequired: ["跨类业务流程演示", "统一对象ID", "端到端指标"] },
  { id: "three-endpoint-supply-chain", title: "总部—代理源—客户源的软件供应链", claim: "能力可以标准化、行业化、客户化并保持单向可审计发布。", contrast: "传统项目复制代码后难以持续升级和治理。", evidenceRequired: ["版本记录", "差异预览", "回滚演练"] },
  { id: "four-mode-kernel", title: "国内海外、B2B B2C同一内核", claim: "国家、渠道和交易模式是配置包，不是四套互不相认的系统。", contrast: "多套系统会重复商品、库存、客户和财务事实。", evidenceRequired: ["模式切换样例", "共享主数据", "区域权限策略"] },
  { id: "manufacturing-grounded-growth", title: "增长建立在制造兑现能力上", claim: "营销、报价、产能、质量、物流和售后共用订单履约事实。", contrast: "纯营销平台无法判断承诺是否能制造和盈利。", evidenceRequired: ["CPQ到工单链路", "批次追溯", "订单利润"] },
  { id: "governed-ai", title: "AI进入流程且受数据权限治理", claim: "AI输出带事实来源、人工复核和责任任务闭环。", contrast: "孤立AI助手不能安全改变正式业务状态。", evidenceRequired: ["权限日志", "事实引用", "审批和任务记录"] },
  { id: "evidence-before-superlatives", title: "用客户证据销售，而非空泛唯一性", claim: "每个卖点绑定可演示流程和可量化指标。", contrast: "没有证据的‘唯一、必须、第一’承诺会削弱长期信任。", evidenceRequired: ["基线与上线后对比", "客户授权案例", "指标口径说明"] },
];

export type FactoryPlatformOperatingStage = {
  sequence: number;
  category: FactoryPlatformCategoryKey;
  input: string;
  output: string;
  handoffTo: FactoryPlatformCategoryKey;
};

export const FACTORY_PLATFORM_OPERATING_LOOP: readonly FactoryPlatformOperatingStage[] = [
  { sequence: 1, category: "identity", input: "产品事实与市场机会", output: "目标客户、价值主张和品牌身份", handoffTo: "content" },
  { sequence: 2, category: "content", input: "身份和产品内容", output: "国内外数字阵地", handoffTo: "trust" },
  { sequence: 3, category: "trust", input: "页面和企业证据", output: "搜索可见与可信资产", handoffTo: "recommend" },
  { sequence: 4, category: "recommend", input: "结构化事实与答案", output: "AI和平台推荐覆盖", handoffTo: "deepen" },
  { sequence: 5, category: "deepen", input: "内容与社交触点", output: "持续互动和意向信号", handoffTo: "portrait" },
  { sequence: 6, category: "portrait", input: "匿名、潜客、成交与服务的全触点事件", output: "合规统一画像和购买意图", handoffTo: "lead" },
  { sequence: 7, category: "lead", input: "合规画像、创意和预算", output: "可归因的高意向流量", handoffTo: "convert" },
  { sequence: 8, category: "convert", input: "访问、询盘和需求", output: "报价、合同和待确认订单", handoffTo: "fulfillment" },
  { sequence: 9, category: "fulfillment", input: "待确认订单和交付约束", output: "确认订单、合格产品、物流和收款条件", handoffTo: "care" },
  { sequence: 10, category: "care", input: "客户目标、交付和服务记录", output: "复购、增购、续约与倡导", handoffTo: "decision" },
  { sequence: 11, category: "decision", input: "收入、成本、客户和履约事实", output: "预测、决策和下一轮经营任务", handoffTo: "operations" },
  { sequence: 12, category: "operations", input: "组织、资金、权限与主数据", output: "可经营的企业底座与下一轮经营约束", handoffTo: "identity" },
];
