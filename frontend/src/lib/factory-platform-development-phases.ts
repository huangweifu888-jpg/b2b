import type {
  FactoryPlatformCategoryKey,
  FactoryPlatformPhaseId,
} from "./factory-platform-blueprint";

export type FactoryPlatformDevelopmentPhase = {
  id: FactoryPlatformPhaseId;
  sequence: 1 | 2 | 3;
  title: string;
  objective: string;
  categoryKeys: readonly FactoryPlatformCategoryKey[];
  deliverables: readonly string[];
  exitCriteria: readonly string[];
};

/** Lightweight phase metadata shared by the Blueprint and Development views. */
export const FACTORY_PLATFORM_DEVELOPMENT_PHASES: readonly FactoryPlatformDevelopmentPhase[] = [
  { id: "revenue-loop", sequence: 1, title: "收入闭环", objective: "先跑通产品与客户主数据、内容获客、询盘报价、订单、收款和经营驾舱。", categoryKeys: ["identity", "content", "trust", "deepen", "portrait", "lead", "convert", "care", "decision", "operations"], deliverables: ["统一客户/产品/订单主键", "网站到询盘到CRM到报价闭环", "ERP Lite与财务状态回传", "核心经营指标与审计"], exitCriteria: ["每笔收入可追到客户、产品、订单和来源", "销售与财务不再维护冲突台账", "三端发布和回滚可验证"] },
  { id: "manufacturing-loop", sequence: 2, title: "制造履约闭环", objective: "把成交计划连接供应、生产、质量、仓储、物流和售后。", categoryKeys: ["convert", "fulfillment", "care", "operations"], deliverables: ["PLM/SRM/APS/MES/QMS骨架", "OMS/WMS/TMS交付链", "批次质量与RMA追溯", "人事招聘合同审批协同"], exitCriteria: ["确认订单可追到物料、工单、批次和发运", "交期、质量、库存和成本指标同源", "异常可自动进入责任任务"] },
  { id: "global-intelligence", sequence: 3, title: "全球智能增长", objective: "在稳定事实数据上扩大GEO、社媒、广告、平台和AI决策能力。", categoryKeys: ["identity", "content", "trust", "recommend", "deepen", "portrait", "lead", "convert", "care", "decision"], deliverables: ["国家包与渠道包", "知识图谱、GEO和商品Feed", "AI预测、问数与情景模拟", "全球合规和产品追溯证据"], exitCriteria: ["国内/海外、B2B/B2C共用同一业务内核", "AI输出可追溯到授权事实", "增长预算可评价到毛利和LTV"] },
];
