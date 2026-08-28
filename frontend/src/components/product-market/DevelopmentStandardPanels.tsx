import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  inspectRegisteredLayoutPages,
  LAYOUT_SCREENSHOT_REGRESSIONS,
  REGISTERED_LAYOUT_SCAN_TARGETS,
  type RuntimePageFrameScan,
} from "@/lib/layout-screenshot-regressions";
import { DEVELOPMENT_STANDARD_GOVERNANCE } from "@/lib/development-standard-governance";
import {
  PRODUCT_MARKET_TEMPLATE_LIFECYCLE,
  PRODUCT_MARKET_TEMPLATE_LIFECYCLE_CONTRACT_VERSION,
  PRODUCT_MARKET_VERIFIED_DRAFT_BASELINE_CONTRACT,
} from "@/lib/product-market-template-lifecycle-contract";
import { buildLayoutMigrationPlan, diagnoseLayoutMigration } from "@/lib/layout-migration-assistant";
import {
  SHARED_VISUAL_ALLOWED_DIFFERENCES,
  SHARED_VISUAL_PARITY_FACTORS,
  SHARED_VISUAL_REFERENCE_DIFFERENCES,
} from "@/lib/shared-visual-parity-contract";
import {
  listPageCompositionAuditRecords,
  recordPageCompositionAudit,
  restorePageCompositionAudit,
  type PageCompositionAuditRecord,
} from "@/lib/page-composition-audit";

const DEVELOPMENT_STANDARD_OPERATIONS = [
  {
    order: "01",
    title: "页面入口与历史清扫",
    when: "新页面接入、页面结构调整或发现重复外框时。",
    action: "只在“开发规范”登记页面组合；确认无旧页面清扫器、旧布局开发器、私有外框与私有滚条残留。",
    output: "页面只使用共享工作区，业务数据、路由和接口保持原状。",
  },
  {
    order: "02",
    title: "中文编码与规范闸门",
    when: "合并代码、发布候选版本或发现界面文案异常时。",
    action: "运行开发规范验证闸门；编码检查覆盖插件、影响地图、截图回归、迁移和审计恢复模块。",
    output: "中文文案可读，组合、插件、双模式、迁移与恢复契约全部通过。",
  },
  {
    order: "03",
    title: "面板分工维护",
    when: "维护截图、迁移、审计恢复等开发规范能力时。",
    action: "在独立开发规范面板中调整对应能力；产品市场页只负责组合与编排，不复制面板逻辑。",
    output: "面板职责清晰，页面组合与验证契约仍可独立追溯。",
  },
  {
    order: "04",
    title: "审计、备份与定向恢复",
    when: "同步、恢复或回退任一来源端／计划端前。",
    action: "先创建审计与备份记录；仅恢复已选择的页面或来源基线，恢复时合并保留本端自定义与新增数据。",
    output: "可审计、可回退，且不会影响其他下游引用、业务数据、素材或本端新增内容。",
  },
  {
    order: "05",
    title: "真实截图回归",
    when: "共享框架、标题、滚条、尾栏或面板布局变更后。",
    action: "检查默认和窄屏开发规范页，并复核客户源产品市场的运营、栏目、版面、客服四页。",
    output: "主体、标题、尾栏加载正常；旧弹窗桥接为 0；截图和差异结论留档。",
  },
  {
    order: "06",
    title: "发布前模拟与差异确认",
    when: "任何来源模板准备向下游发布前。",
    action: "生成无写入预演报告，核对来源变更、有效变更和保留的下游路径；仅在审批后按链路发布。",
    output: "只允许 A 总部端 → 代理源端 → 代理端与 B 总部端 → 客户源端 → 客户计划／站点；总部端不得绕过来源端直达运行实例，代理源端与客户源端互不发布，任何分支均不得反向发布；业务数据、下游自定义、新增数据和上传素材始终排除。",
  },
] as const;

export function DevelopmentStandardGovernancePanel() {
  return (
    <section data-development-standard-governance className="border-t border-current/15 p-3">
      <div className="mb-1 text-sm font-semibold">统一开发治理：总部端、代理源端、客户源端</div>
      <p className="mb-2 text-xs opacity-80">所有新项目均按同一条主线推进：立项 → 来源基线 → 开发验证 → 预演发布 → 运行恢复。三端共享验收标准，但只在自己的来源范围内开发和发布。</p>
      <div data-template-lifecycle-contract={PRODUCT_MARKET_TEMPLATE_LIFECYCLE_CONTRACT_VERSION} className="mb-2 grid gap-2 text-xs md:grid-cols-3">
        <article className="rounded-lg border border-current/20 px-3 py-2"><strong>工厂默认（发布成功后只读）</strong><p className="mt-1 opacity-80">{PRODUCT_MARKET_TEMPLATE_LIFECYCLE.factory.description}</p></article>
        <article className="rounded-lg border border-current/20 px-3 py-2"><strong>源体：保存草稿 → 发布新版 → 全计划 → 工厂默认</strong><p className="mt-1 opacity-80">{PRODUCT_MARKET_TEMPLATE_LIFECYCLE.source.description}</p></article>
        <article className="rounded-lg border border-current/20 px-3 py-2"><strong>运行端：恢复已发布源体</strong><p className="mt-1 opacity-80">{PRODUCT_MARKET_TEMPLATE_LIFECYCLE.runtime.description}</p></article>
      </div>
      <p className="mb-2 rounded-md border border-current/15 px-2 py-1 text-xs font-medium">Product Market 四区发布顺序：{PRODUCT_MARKET_TEMPLATE_LIFECYCLE.release.order.join(" → ")}。只有批次 completed、成功数等于总数且失败数为 0 才能显示完成。</p>
      <p data-template-draft-baseline-contract={PRODUCT_MARKET_VERIFIED_DRAFT_BASELINE_CONTRACT.version} className="mb-2 rounded-lg border border-current/20 px-3 py-2 text-xs opacity-80">
        保存并完成回读校验后，开发器会以该规范化快照重置草稿基线；仅保存之后的新修改才会在离开页面时提示。
      </p>
      <div className="grid gap-2 xl:grid-cols-2">
        {DEVELOPMENT_STANDARD_GOVERNANCE.map((stage) => (
          <article key={stage.phase} data-development-standard-governance-stage={stage.phase} className="rounded-lg border border-current/20 px-3 py-2 text-xs leading-5">
            <h2 className="font-semibold">{stage.phase} {stage.title}</h2>
            <p className="mt-1 opacity-80">作用：{stage.purpose}</p>
            <dl className="mt-2 grid gap-1 md:grid-cols-3">
              <div><dt className="font-medium">总部端</dt><dd className="opacity-80">{stage.hq}</dd></div>
              <div><dt className="font-medium">代理源端</dt><dd className="opacity-80">{stage.agency}</dd></div>
              <div><dt className="font-medium">客户源端</dt><dd className="opacity-80">{stage.customer}</dd></div>
            </dl>
            <p className="mt-2 font-medium">阶段产出／闸门：{stage.gate}</p>
          </article>
        ))}
      </div>
      <p className="mt-2 rounded-md border border-current/15 px-2 py-1 text-xs font-medium">统一发布原则：A 总部端 → 代理源端 → 代理端；B 总部端 → 客户源端 → 客户计划／站点。总部端不得绕过来源端直达运行实例；代理源端与客户源端互不发布；任何分支均不得反向发布。仅沿已审批链路下发，下游自定义、业务数据、新增内容与上传素材始终受保护，不参与覆盖或反向同步。</p>
    </section>
  );
}

export function DevelopmentStandardOperationsPanel() {
  return (
    <section data-development-standard-operations className="border-t border-current/15 p-3">
      <div className="mb-1 text-sm font-semibold">后续运作流程（本次 6 项）</div>
      <p className="mb-2 text-xs opacity-80">以下是开发规范的长期操作顺序。每次只处理当前来源端，再经审核按模板链向下游推进；不允许反向同步或覆盖下游自定义与新增数据。</p>
      <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
        {DEVELOPMENT_STANDARD_OPERATIONS.map((item) => (
          <article key={item.order} data-development-standard-operation={item.order} className="rounded-lg border border-current/20 px-3 py-2 text-xs leading-5">
            <h2 className="font-semibold">{item.order} {item.title}</h2>
            <p className="mt-1"><span className="font-medium">何时使用：</span>{item.when}</p>
            <p className="opacity-80"><span className="font-medium">操作：</span>{item.action}</p>
            <p className="mt-2 font-medium">输出：{item.output}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ScreenshotRegressionBaselinePanel() {
  const targets = LAYOUT_SCREENSHOT_REGRESSIONS.filter((item) => item.id === "homepage-banner" || item.source === "product-market").slice(0, 10);

  return (
    <section data-screenshot-regression-baseline className="border-t border-current/15 p-3">
      <div className="mb-1 text-sm font-semibold">截图回归基线</div>
      <p className="mb-2 text-xs opacity-80">截图只核对主体、标题、表头、内容、右侧滚条与尾栏；它不读取或写入业务内容、上传素材和下游自定义数据。</p>
      <div className="grid gap-2 text-xs leading-5 md:grid-cols-2 xl:grid-cols-3">
        {targets.map((target) => (
          <article key={target.id} data-screenshot-regression-target={target.id} className="rounded-lg border border-current/20 px-3 py-2">
            <h2 className="font-semibold">{target.label}</h2>
            <p className="mt-1 break-all opacity-80">{target.route}</p>
            <p className="mt-1">区域：{target.regions.join("／")}</p>
          </article>
        ))}
      </div>
      <p className="mt-2 text-xs font-medium">验收输出：只保存截图与差异结论；异常统一回到“开发规范”处理，不回写单页样式。</p>
    </section>
  );
}

export function SharedVisualParityContractPanel() {
  const [scan, setScan] = useState<RuntimePageFrameScan | null>(null);
  const [scanning, setScanning] = useState(false);
  const runScan = async () => {
    setScanning(true);
    try {
      const next = await inspectRegisteredLayoutPages(REGISTERED_LAYOUT_SCAN_TARGETS, 20_000);
      setScan(next);
      if (next.failed) toast.error(`共享契约扫描发现 ${next.failed} 个页面差异。`);
      else toast.success(`共享契约扫描通过：${next.passed} 个登记页面。`);
    } finally {
      setScanning(false);
    }
  };
  return (
    <section data-shared-visual-parity-contract className="border-t border-current/15 p-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">首页大图 ↔ 运营市场 · 共享契约差异学习</span><Button data-shared-visual-run-scan type="button" size="sm" variant="outline" onClick={runScan} disabled={scanning}>{scanning ? "正在扫描…" : `扫描全部 ${REGISTERED_LAYOUT_SCAN_TARGETS.length} 页`}</Button></div>
      <p className="mb-2 text-xs leading-5 opacity-80">只统一视觉和结构不变量；表头栏目、业务字段、记录数量、卡片内容与插件能力仍由页面拥有。以下因素会自动加入所有已登记页面的运行时扫描。</p>
      {scan ? <div data-shared-visual-scan-result data-shared-visual-scan-passed={scan.failed === 0 ? "true" : "false"} className="mb-3 rounded-lg border border-current/20 px-3 py-2 text-xs leading-5"><b>最近扫描：通过 {scan.passed} · 当前未开通 {scan.unavailable} · 差异 {scan.failed}</b>{scan.failed ? <ul className="mt-1 list-disc pl-5">{scan.items.filter((item) => !item.passed && !item.unavailable).map((item) => <li key={item.route}>{item.route}：{item.error || item.parity.issues.map((issue) => issue.label).join("、") || "框架缺失"}</li>)}</ul> : <p className="opacity-80">所有可验页面均通过共享视觉与框架检查；未开通页面不误报为样式差异。</p>}</div> : null}
      <div className="grid gap-2 text-xs leading-5 lg:grid-cols-2 xl:grid-cols-4">
        {SHARED_VISUAL_PARITY_FACTORS.map((factor) => (
          <article key={factor.id} data-shared-visual-parity-factor={factor.id} className="rounded-lg border border-current/20 px-3 py-2">
            <h2 className="font-semibold">{factor.label}</h2>
            <p className="mt-1 opacity-80">{factor.expected}</p>
            <p className="mt-1 font-medium">扫描：全部登记页面</p>
          </article>
        ))}
      </div>
      <div className="mt-3 overflow-x-auto rounded-lg border border-current/20">
        <table data-shared-visual-reference-differences className="w-full min-w-[760px] text-left text-xs leading-5">
          <thead><tr className="border-b border-current/15"><th className="px-3 py-2">因素</th><th className="px-3 py-2">首页大图</th><th className="px-3 py-2">运营市场</th><th className="px-3 py-2">归类／处理</th></tr></thead>
          <tbody>{SHARED_VISUAL_REFERENCE_DIFFERENCES.map((item) => <tr key={item.id} data-shared-visual-reference-difference={item.id} className="border-b border-current/10 last:border-0"><td className="px-3 py-2 font-medium">{item.label}</td><td className="px-3 py-2">{item.banner}</td><td className="px-3 py-2">{item.operations}</td><td className="px-3 py-2"><span className="font-medium">{item.classification}</span> · {item.action}</td></tr>)}</tbody>
        </table>
      </div>
      <details data-shared-visual-allowed-differences className="mt-3 rounded-lg border border-current/20 px-3 py-2 text-xs leading-5">
        <summary className="cursor-pointer font-semibold">允许保留的业务差异（{SHARED_VISUAL_ALLOWED_DIFFERENCES.length}）</summary>
        <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{SHARED_VISUAL_ALLOWED_DIFFERENCES.map((item) => <article key={item.id} className="rounded-md border border-current/15 px-2 py-1.5"><b>{item.reason}</b><p className="opacity-80">首页大图：{item.banner}</p><p className="opacity-80">运营市场：{item.operations}</p></article>)}</div>
      </details>
    </section>
  );
}

export function PageCompositionMigrationPanel({ pathname, search }: { pathname: string; search: string }) {
  const route = `${pathname}${search}`;
  const diagnostic = diagnoseLayoutMigration(route);
  const plan = buildLayoutMigrationPlan(route);

  return (
    <section data-page-composition-migration className="border-t border-current/15 p-3">
      <div className="mb-1 text-sm font-semibold">配置迁移</div>
      <p className="mb-2 text-xs opacity-80">迁移只把固定框架合同从旧结构登记为组合清单；不会复制旧 CSS，不会覆盖表头、内容、业务数据、素材或下游自定义。</p>
      <div className="grid gap-2 text-xs leading-5 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-lg border border-current/20 px-3 py-2"><h2 className="font-semibold">迁移状态</h2><p className="mt-1 opacity-80">{diagnostic.status === "registered" ? "已登记，可进入来源端审核" : "待登记，保持只读"}</p></article>
        <article className="rounded-lg border border-current/20 px-3 py-2"><h2 className="font-semibold">版本方向</h2><p className="mt-1 opacity-80">{plan.from} → {plan.to}</p></article>
        <article className="rounded-lg border border-current/20 px-3 py-2"><h2 className="font-semibold">写入范围</h2><p className="mt-1 opacity-80">仅固定框架合同；其余均为页面所有。</p></article>
        <article className="rounded-lg border border-current/20 px-3 py-2"><h2 className="font-semibold">恢复方式</h2><p className="mt-1 opacity-80">{plan.restore === "remove-local-contract-only" ? "仅移除当前本地合同" : "来源合同由发布记录恢复"}</p></article>
      </div>
      <ol className="mt-2 grid gap-1 text-xs leading-5 md:grid-cols-3">
        {plan.steps.map((step, index) => <li key={step} className="rounded-md border border-current/15 px-2 py-1">{String(index + 1).padStart(2, "0")} {step}</li>)}
      </ol>
    </section>
  );
}

export function PageCompositionAuditAndRecoveryPanel({ pathname, search, readOnly }: { pathname: string; search: string; readOnly: boolean }) {
  const [records, setRecords] = useState<readonly PageCompositionAuditRecord[]>(() => listPageCompositionAuditRecords(pathname, search));
  const refresh = () => setRecords(listPageCompositionAuditRecords(pathname, search));

  const createRecord = () => {
    const record = recordPageCompositionAudit(pathname, search);
    refresh();
    toast.success(`已创建恢复记录：${new Date(record.createdAt).toLocaleString("zh-CN")}`);
  };

  const restore = (record: PageCompositionAuditRecord, scope: "page" | "global") => {
    const restored = restorePageCompositionAudit(record, pathname, search, scope);
    if (restored) toast.success(scope === "page" ? "已恢复当前页面框架快照" : "已恢复当前来源端全局框架快照");
    else toast.error("未找到可用恢复点，或页面已锁定");
  };

  return (
    <section data-page-composition-audit className="border-t border-current/15 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">审计与恢复</div>
          <p className="text-xs opacity-80">创建记录时只保存当前页面与当前来源端框架快照。恢复仅作用于所选快照，不触碰业务数据、素材及下游自定义。</p>
        </div>
        <Button data-page-composition-record-audit type="button" size="sm" onClick={createRecord} disabled={readOnly}>创建恢复记录</Button>
      </div>
      <div className="mt-2 grid gap-2 text-xs leading-5 lg:grid-cols-2">
        {records.length ? records.map((record) => (
          <article key={record.id} data-page-composition-audit-record className="rounded-lg border border-current/20 px-3 py-2">
            <h2 className="font-semibold">{new Date(record.createdAt).toLocaleString("zh-CN")} · {record.workspaceScope}</h2>
            <p className="mt-1 opacity-80">影响：{record.affectedTargets.join("、")}</p>
            <p className="opacity-80">排除：业务数据、下游自定义、新增数据、上传素材。</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button data-page-composition-restore-page type="button" size="sm" variant="outline" onClick={() => restore(record, "page")} disabled={readOnly}>恢复当前页</Button>
              <Button data-page-composition-restore-global type="button" size="sm" variant="outline" onClick={() => restore(record, "global")} disabled={readOnly}>恢复来源全局</Button>
            </div>
          </article>
        )) : <p className="rounded-lg border border-current/20 px-3 py-2 opacity-80">暂无恢复记录。配置确认前请先创建记录；预览模式只读。</p>}
      </div>
    </section>
  );
}
