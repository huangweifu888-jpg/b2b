import {
  FACTORY_PLATFORM_CATEGORIES,
  FACTORY_PLATFORM_SOCIAL_WORKSPACE_CONTRACT_ID,
  FACTORY_PLATFORM_SOCIAL_WORKSPACES,
} from "@/lib/factory-platform-blueprint";
import {
  FACTORY_PLATFORM_BUSINESS_BOUNDARIES,
  FACTORY_PLATFORM_APPLICATION_CONTRACT_FIELDS,
  FACTORY_PLATFORM_COMMERCIAL_PACKAGES,
  FACTORY_PLATFORM_CONTINUOUS_DEVELOPMENT_SEQUENCE,
  FACTORY_PLATFORM_CORE_EVENTS,
  FACTORY_PLATFORM_CORE_OBJECTS,
  FACTORY_PLATFORM_COUNTRY_PACKS,
  FACTORY_PLATFORM_DEVELOPMENT_GATES,
  FACTORY_PLATFORM_DEVELOPMENT_PHASES,
  FACTORY_PLATFORM_DIFFERENTIATORS,
  FACTORY_PLATFORM_ENDPOINT_RESPONSIBILITIES,
  FACTORY_PLATFORM_EXECUTION_WORKSTREAMS,
  FACTORY_PLATFORM_FOUNDATIONS,
  FACTORY_PLATFORM_GOLDEN_FLOWS,
  FACTORY_PLATFORM_IMPLEMENTATION_STAGES,
  FACTORY_PLATFORM_INDUSTRY_PACKS,
  FACTORY_PLATFORM_OPERATING_LOOP,
  FACTORY_PLATFORM_PORTABILITY_RULES,
  FACTORY_PLATFORM_PRIORITY_PROGRAMS,
  FACTORY_PLATFORM_SALES_VALUE_PROPOSITIONS,
} from "@/lib/factory-platform-blueprint-governance";

const PHASE_LABELS = {
  "revenue-loop": "P0 · 收入闭环",
  "manufacturing-loop": "P1 · 制造履约闭环",
  "global-intelligence": "P2 · 全球智能增长",
} as const;

const MODE_LABELS = {
  domestic: "国内",
  overseas: "海外",
  b2b: "B2B",
  b2c: "B2C",
} as const;

const DELIVERY_STATUS_LABELS = {
  available: "已具备（须有当前版本与验收证据）",
  pilot: "试点（按客户版本和范围验证）",
  planned: "规划（不得作为现成功能承诺）",
} as const;

const PUBLISH_TARGET_LABELS: Record<string, string> = {
  hq: "总部端",
  agency_source: "代理源端",
  client_source: "客户源端",
  agency_instance: "所属代理端",
  client_plan: "所属客户计划/站点",
};

const AUDIENCE_LABELS: Record<string, string> = {
  factory_owner: "工厂老板",
  executive: "经营管理层",
  marketing: "市场",
  sales: "销售",
  operations: "运营",
  finance: "财务",
  hr: "人力资源",
  engineering: "研发工程",
  procurement: "采购",
  production: "生产",
  quality: "质量",
  warehouse: "仓储",
  service: "客户服务",
  it: "IT",
  agency_operator: "代理运营",
};

const safeCell = (value: string) => value.replaceAll("|", "／").replaceAll("\n", " ");
const joinList = (values: readonly string[]) => values.join("、");
const foundationLabel = (id: string) => FACTORY_PLATFORM_FOUNDATIONS.find((item) => item.id === id)?.label || id;
const priorityProgramLabel = (id: string) => FACTORY_PLATFORM_PRIORITY_PROGRAMS.find((item) => item.id === id)?.label || id;
const developmentGateLabel = (id: string) => FACTORY_PLATFORM_DEVELOPMENT_GATES.find((item) => item.id === id)?.label || id;
const coreObjectLabel = (id: string) => FACTORY_PLATFORM_CORE_OBJECTS.find((item) => item.id === id)?.label || id;

/**
 * Generate a customer-readable and implementation-readable specification from
 * the same contract used by Product Market.  This prevents the sales story,
 * development order and application catalogue from drifting apart.
 */
export function buildFactoryPlatformSpecificationMarkdown() {
  const lines: string[] = [
    "# 工厂全球经营平台 · 十二大类规范",
    "",
    "> 本说明由产品市场的平台蓝图契约生成。规划能力不等于当前已上线能力；正式交付以版本、范围和验收证据为准。",
    "",
    "## 平台定位",
    "",
    "以产品、客户、订单、内容、资金五类主数据贯通国内/海外、B2B/B2C，形成经营、获客、成交、制造、交付、深养和决策闭环。",
    "",
    "## 共享规划显示与应用状态",
    "",
    "- 十二类分别保存共享“显示规划”开关；关闭只收起客户价值、二级规划、阶段与成熟度说明，不删除任何应用。",
    "- 应用继续使用开通、取消、隐藏三状态；分类可批量设置，应用可独立覆盖。",
    "- 规划显示开关与应用状态进入同一模板/计划快照，供平台蓝图、栏目配置、运营市场、左侧导航、页面锁定器和规范生成链读取。",
    "- 规划显示与交付成熟度相互独立；开启规划不代表已交付，开通应用也不能把“规划/试点”自动升级为“已具备”。",
    "",
    "## 六大横向平台底座",
    "",
    "> 横向底座由十二类共同调用，不新增第13类，也不成为竞争性业务事实源。",
    "",
  ];

  for (const foundation of FACTORY_PLATFORM_FOUNDATIONS) {
    lines.push(
      `### ${foundation.sequence}. ${foundation.label}`,
      "",
      foundation.mission,
      "",
      `公共能力：${joinList(foundation.capabilities)}；从 ${PHASE_LABELS[foundation.requiredFromPhase]} 起强制具备。`,
      "",
      ...foundation.exitCriteria.map((criterion) => `- 验收：${criterion}`),
      "",
    );
  }

  lines.push(
    "## 运作闭环",
    "",
  );

  for (const stage of FACTORY_PLATFORM_OPERATING_LOOP) {
    const category = FACTORY_PLATFORM_CATEGORIES.find((item) => item.key === stage.category);
    const handoff = FACTORY_PLATFORM_CATEGORIES.find((item) => item.key === stage.handoffTo);
    lines.push(`${stage.sequence}. **${category?.order}.${category?.label}**：${stage.input} → ${stage.output} → 交接 ${handoff?.order}.${handoff?.label}`);
  }

  lines.push("", "## 十二大类与应用", "");
  lines.push(
    "> 交付状态口径：蓝图入口默认是“规划”；已有独立入口也只默认是“试点”；只有绑定当前版本、范围、客户与验收证据后，才能显式登记为“已具备”。",
    "",
  );
  for (const category of FACTORY_PLATFORM_CATEGORIES) {
    lines.push(
      `### ${category.order}.${category.label} · ${category.title}`,
      "",
      category.value,
      "",
      `适用模式：${category.modes.map((mode) => MODE_LABELS[mode]).join(" / ")}；主阶段：${PHASE_LABELS[category.phase]}。`,
      "",
      "| 应用全称 | 一级默认 | 二级默认 | 客户价值 | 阶段 | 交付状态 | 适用角色 | 模式 | 核心能力 | 验收指标 | 蓝图/业务入口 |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    );
    for (const application of category.applications) {
      lines.push(
        `| ${safeCell(application.label)} | ${safeCell(application.navigationLabel)} | ${safeCell(application.navigationChildren.map((child) => child.label).join("、"))} | ${safeCell(application.value)} | ${PHASE_LABELS[application.phase]} | ${DELIVERY_STATUS_LABELS[application.deliveryStatus]} | ${safeCell(application.audience.map((audience) => AUDIENCE_LABELS[audience] || audience).join("、"))} | ${safeCell(application.modes.map((mode) => MODE_LABELS[mode]).join(" / "))} | ${safeCell(joinList(application.capabilities))} | ${safeCell(joinList(application.metrics))} | \`${safeCell(application.route)}\` |`,
      );
    }
    lines.push("");
  }

  lines.push(
    "## 05.圈养(深耕) · 社媒九项执行工作区",
    "",
    `> 共享契约：\`${FACTORY_PLATFORM_SOCIAL_WORKSPACE_CONTRACT_ID}\`。九项是六个业务一级应用拥有的真实二级页面，不新增第73个应用；痛点路线只属于开发器。`,
    "",
    "| 顺序 | 二级工作区 | 业务一级归属 | 国内/海外 | 客户痛点 | 客户价值 | 可执行操作 | 外部边界 | 页面工厂 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  FACTORY_PLATFORM_SOCIAL_WORKSPACES.forEach((workspace, index) => {
    const application = FACTORY_PLATFORM_CATEGORIES
      .find((category) => category.key === "deepen")
      ?.applications.find((item) => item.id === workspace.applicationId);
    lines.push(
      `| ${String(index + 1).padStart(2, "0")} | ${workspace.label} | ${application?.navigationLabel || workspace.applicationId} | 国内 / 海外 | ${safeCell(workspace.customerPain)} | ${safeCell(workspace.customerValue)} | ${safeCell(workspace.executionCapabilities.join("、"))} | ${safeCell(workspace.executionBoundary)} | \`${workspace.pageFactoryId}\` · \`${workspace.route}\` |`,
    );
  });
  lines.push("");

  lines.push("## 五个优先专项", "");
  for (const program of FACTORY_PLATFORM_PRIORITY_PROGRAMS) {
    lines.push(
      `### ${program.sequence}. ${program.label}`,
      "",
      `${program.objective} 客户价值：${program.customerValue}`,
      "",
      `涉及类别：${program.categoryKeys.map((key) => FACTORY_PLATFORM_CATEGORIES.find((item) => item.key === key)?.label).filter(Boolean).join("、")}；依赖底座：${program.foundationIds.map(foundationLabel).join("、")}。`,
      "",
      `能力范围：${joinList(program.capabilities)}。`,
      "",
      ...program.exitCriteria.map((criterion) => `- 验收：${criterion}`),
      "",
    );
  }

  lines.push("## 四档商业装配", "", "> 套餐只装配能力、权限和交付范围，不拥有客户、订单、财务等业务事实。", "");
  for (const packageItem of FACTORY_PLATFORM_COMMERCIAL_PACKAGES) {
    lines.push(
      `### ${packageItem.sequence}. ${packageItem.label}`,
      "",
      packageItem.promise,
      "",
      `覆盖类别：${packageItem.categoryKeys.map((key) => FACTORY_PLATFORM_CATEGORIES.find((item) => item.key === key)?.label).filter(Boolean).join("、")}。`,
      "",
      `优先专项：${packageItem.priorityProgramIds.length ? packageItem.priorityProgramIds.map(priorityProgramLabel).join("、") : "无强制增值专项"}。`,
      "",
      `销售证据：${joinList(packageItem.evidenceRequired)}。`,
      "",
    );
  }

  lines.push("## 业务唯一事实源与边界", "");
  for (const boundary of FACTORY_PLATFORM_BUSINESS_BOUNDARIES) {
    const owner = FACTORY_PLATFORM_CATEGORIES.find((item) => item.key === boundary.systemOfRecord);
    lines.push(
      `### ${boundary.title}`,
      "",
      `唯一事实源：${owner?.order}.${owner?.label}；拥有：${joinList(boundary.owns)}。`,
      "",
      `消费/协作类别：${boundary.consumes.map((key) => {
        const category = FACTORY_PLATFORM_CATEGORIES.find((item) => item.key === key);
        return `${category?.order}.${category?.label}`;
      }).join("、")}。`,
      "",
      ...boundary.rules.map((rule) => `- ${rule}`),
      "",
    );
  }

  lines.push("## 开发顺序与出阶段门槛", "");
  for (const phase of FACTORY_PLATFORM_DEVELOPMENT_PHASES) {
    lines.push(
      `### P${phase.sequence - 1} · ${phase.title}`,
      "",
      phase.objective,
      "",
      `覆盖类别：${phase.categoryKeys.map((key) => {
        const category = FACTORY_PLATFORM_CATEGORIES.find((item) => item.key === key);
        return `${category?.order}.${category?.label}`;
      }).join("、")}。`,
      "",
      `交付物：${joinList(phase.deliverables)}。`,
      "",
      ...phase.exitCriteria.map((criterion) => `- 验收：${criterion}`),
      "",
    );
  }

  lines.push("## 应用立项十五字段", "", "任何应用进入开发前必须补齐以下字段；缺失字段不得越过对应门禁。", "");
  lines.push("| 字段 | 最迟门禁 | 规范 |", "| --- | --- | --- |");
  for (const field of FACTORY_PLATFORM_APPLICATION_CONTRACT_FIELDS) {
    lines.push(`| ${field.label} | ${developmentGateLabel(field.requiredAt)} | ${safeCell(field.description)} |`);
  }

  lines.push("", "## 七道持续开发门禁", "");
  for (const gate of FACTORY_PLATFORM_DEVELOPMENT_GATES) {
    lines.push(
      `### ${gate.sequence}. ${gate.label}`,
      "",
      gate.purpose,
      "",
      `必须产物：${joinList(gate.requiredArtifacts)}。`,
      "",
      ...gate.exitCriteria.map((criterion) => `- 放行：${criterion}`),
      "",
    );
  }

  lines.push("## 持续开发七步顺序", "");
  for (const stage of FACTORY_PLATFORM_CONTINUOUS_DEVELOPMENT_SEQUENCE) {
    lines.push(
      `${stage.sequence}. **${stage.label}**：${joinList(stage.deliverables)}；依赖 ${stage.foundationIds.map(foundationLabel).join("、")}；完成后通过“${developmentGateLabel(stage.exitGate)}”。`,
    );
  }
  lines.push("");

  lines.push("## 开发执行台首批队列", "", "> 执行台显示当前门禁、责任、阻断、产物和下一动作；没有证据不得手工跳门。", "");
  lines.push("| 顺序 | 工作流 | 状态 | 当前门禁 | 负责人 | 下一动作 |", "| --- | --- | --- | --- | --- | --- |");
  for (const workstream of FACTORY_PLATFORM_EXECUTION_WORKSTREAMS) {
    lines.push(`| ${workstream.sequence} | ${workstream.label} | ${workstream.status} | ${developmentGateLabel(workstream.currentGate)} | ${safeCell(workstream.ownerRoles.join("、"))} | ${safeCell(workstream.nextAction)} |`);
  }

  lines.push("", "## 五条黄金业务链", "");
  for (const flow of FACTORY_PLATFORM_GOLDEN_FLOWS) {
    lines.push(
      `### ${flow.sequence}. ${flow.label}`,
      "",
      flow.objective,
      "",
      `流程：${flow.steps.join(" → ")}。`,
      "",
      `核心对象：${flow.objectIds.map(coreObjectLabel).join("、")}；关键事件：${flow.eventIds.map((id) => FACTORY_PLATFORM_CORE_EVENTS.find((item) => item.id === id)?.label || id).join("、")}。`,
      "",
      ...flow.exitCriteria.map((criterion) => `- 验收：${criterion}`),
      "",
    );
  }

  lines.push("## 核心对象字典", "", "| 对象 | 唯一事实源 | 身份规则 | 最小字段 |", "| --- | --- | --- | --- |");
  for (const object of FACTORY_PLATFORM_CORE_OBJECTS) {
    lines.push(`| ${object.label} | ${FACTORY_PLATFORM_CATEGORIES.find((item) => item.key === object.systemOfRecord)?.label} | ${safeCell(object.identityRule)} | ${safeCell(object.minimumFields.join("、"))} |`);
  }

  lines.push("", "## 核心事件字典", "", "| 事件 | 主体 | 生产者 | 消费者 |", "| --- | --- | --- | --- |");
  for (const event of FACTORY_PLATFORM_CORE_EVENTS) {
    lines.push(`| ${event.label} | ${coreObjectLabel(event.subject)} | ${FACTORY_PLATFORM_CATEGORIES.find((item) => item.key === event.producer)?.label} | ${event.consumers.map((key) => FACTORY_PLATFORM_CATEGORIES.find((item) => item.key === key)?.label).filter(Boolean).join("、")} |`);
  }

  lines.push("", "## 行业包与国家区域包", "", "> 配置包只能引用核心对象、流程和应用，不得复制或分叉平台实现。", "");
  for (const [title, packs] of [["行业包", FACTORY_PLATFORM_INDUSTRY_PACKS], ["国家区域包", FACTORY_PLATFORM_COUNTRY_PACKS]] as const) {
    lines.push(`### ${title}`, "", "| 配置包 | 适用范围 | 能力 | 上线证据 |", "| --- | --- | --- | --- |");
    for (const pack of packs) {
      lines.push(`| ${pack.label} | ${safeCell(pack.scope)} | ${safeCell(pack.capabilities.join("、"))} | ${safeCell(pack.requiredEvidence.join("、"))} |`);
    }
    lines.push("");
  }

  lines.push("## 客户实施中心", "");
  for (const stage of FACTORY_PLATFORM_IMPLEMENTATION_STAGES) {
    lines.push(`### ${stage.label}`, "", stage.objective, "", `交付：${stage.deliverables.join("、")}。`, "", ...stage.exitCriteria.map((criterion) => `- 验收：${criterion}`), "");
  }

  lines.push("## 数据可迁移与退出", "");
  for (const rule of FACTORY_PLATFORM_PORTABILITY_RULES) {
    lines.push(`- **${rule.label}**：${rule.rule} 证据：${rule.evidenceRequired.join("、")}。`);
  }
  lines.push("");

  lines.push("## 三端职责", "");
  for (const endpoint of FACTORY_PLATFORM_ENDPOINT_RESPONSIBILITIES) {
    const publishTargets = endpoint.publishesTo.map((target) => PUBLISH_TARGET_LABELS[target] || target);
    lines.push(
      `### ${endpoint.label}`,
      "",
      `${endpoint.mission} 客户价值：${endpoint.customerValue}`,
      "",
      `负责：${joinList(endpoint.owns)}。`,
      "",
      `发布到：${publishTargets.length > 0 ? joinList(publishTargets) : "仅本端执行与审计，不向上游反向发布"}。`,
      "",
      ...endpoint.mustNot.map((rule) => `- 禁止：${rule}`),
      "",
    );
  }

  lines.push("## 客户购买理由与验证证据", "");
  for (const proposition of FACTORY_PLATFORM_SALES_VALUE_PROPOSITIONS) {
    lines.push(
      `### ${proposition.value}`,
      "",
      `购买角色：${proposition.buyer.map((audience) => AUDIENCE_LABELS[audience] || audience).join("、")}。`,
      "",
      `客户问题：${proposition.pain}`,
      "",
      `预期结果：${proposition.outcome}`,
      "",
      `需验证的证据类型：${joinList(proposition.proof)}。正式销售使用前必须补充客户/版本、数据基线、统计周期、口径负责人和授权证明。`,
      "",
    );
  }

  lines.push("## 与常见平台的可验证差异", "");
  for (const differentiator of FACTORY_PLATFORM_DIFFERENTIATORS) {
    lines.push(
      `### ${differentiator.title}`,
      "",
      `${differentiator.claim} 对比：${differentiator.contrast}`,
      "",
      `必须提供的证据：${joinList(differentiator.evidenceRequired)}。`,
      "",
    );
  }

  lines.push("---", "", "正式报价、财税、隐私、贸易和AI应用规则需结合客户所在地区及行业，由相应专业人员复核。", "");
  return lines.join("\n");
}

export const FACTORY_PLATFORM_SPECIFICATION_FILE_NAME = "factory-platform-12-category-specification.md";
