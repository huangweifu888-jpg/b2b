import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, ExternalLink, Factory, RefreshCw, ShieldCheck, TerminalSquare } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import DeveloperRecordPanel from "@/components/product-market/DeveloperRecordPanel";
import { copyTextWithFallback } from "@/lib/browser-utils";
import {
  adaptPhaseTwoVerificationRecords,
  sortDeveloperRecords,
  type DeveloperRecordEntry,
} from "@/lib/developer-record-ledger";
import { loadLazyModule } from "@/lib/lazy-module-recovery";
import { recordPageCompositionAudit } from "@/lib/page-composition-audit";
import { schedulePostPaintIdle } from "@/lib/post-paint-lazy";
import {
  PAGE_FACTORY_COMMANDS,
  PAGE_FACTORY_PAGES,
  PAGE_FACTORY_STANDARD,
  buildPageFactoryCommand,
  findPageFactoryPage,
  inspectPageFactoryDocument,
  type PageFactoryInspection,
  type PageFactoryPage,
} from "@/page-factory/page-factory";

const PILOT_PAGE = PAGE_FACTORY_PAGES.find((page) => page.id === "product-analysis-interest-search")!;
const REGISTRY_PAGE_BATCH_SIZE = 20;
type PageFactoryAuditModule = typeof import("@/page-factory/page-factory-audit");
let pageFactoryAuditModule: PageFactoryAuditModule | undefined;
let pageFactoryAuditModulePromise: Promise<PageFactoryAuditModule> | undefined;
let pageFactoryAuditSourceRecords: readonly DeveloperRecordEntry[] | undefined;

function loadPageFactoryAuditModule() {
  if (pageFactoryAuditModule) return Promise.resolve(pageFactoryAuditModule);
  if (pageFactoryAuditModulePromise) return pageFactoryAuditModulePromise;
  const pending = loadLazyModule(
    () => import("@/page-factory/page-factory-audit"),
    "developer-application:page-factory-audit",
  ).then((module) => {
    pageFactoryAuditModule = module;
    return module;
  });
  pageFactoryAuditModulePromise = pending;
  void pending.catch(() => {
    if (pageFactoryAuditModulePromise === pending) pageFactoryAuditModulePromise = undefined;
  });
  return pending;
}

function statusClass(passed: boolean) {
  return passed ? "border-emerald-500/35 bg-emerald-500/10" : "border-amber-500/35 bg-amber-500/10";
}

export function PageFactoryWorkbench({
  pathname,
  search,
  sourceLabel,
  readOnly,
  developerRecords = [],
  onSourceRecordsResolved,
  onNavigate,
}: {
  pathname: string;
  search: string;
  sourceLabel: string;
  readOnly: boolean;
  developerRecords?: readonly DeveloperRecordEntry[];
  onSourceRecordsResolved?: (records: readonly DeveloperRecordEntry[]) => void;
  onNavigate: (route: string) => void;
}) {
  const registeredPage = useMemo(() => findPageFactoryPage(pathname, search), [pathname, search]);
  const [selectedPage, setSelectedPage] = useState<PageFactoryPage>(registeredPage || PILOT_PAGE);
  const [inspection, setInspection] = useState<PageFactoryInspection | null>(null);
  const [selectedCommand, setSelectedCommand] = useState("check");
  const [factoryReceipt, setFactoryReceipt] = useState<string | null>(null);
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventoryRisk, setInventoryRisk] = useState<"all" | "low" | "review" | "high">("all");
  const [selectedInventoryTarget, setSelectedInventoryTarget] = useState<{ pageId: string; route: string } | null>(null);
  const [selectedAdoptionTemplate, setSelectedAdoptionTemplate] = useState<PageFactoryPage["template"]>("reference");
  const [visibleRegistryCount, setVisibleRegistryCount] = useState(REGISTRY_PAGE_BATCH_SIZE);
  const [auditModule, setAuditModule] = useState<PageFactoryAuditModule | null>(() => pageFactoryAuditModule ?? null);
  const [auditLoadError, setAuditLoadError] = useState("");
  const [auditLoadAttempt, setAuditLoadAttempt] = useState(0);

  useEffect(() => {
    if (auditModule) return undefined;
    let cancelled = false;
    setAuditLoadError("");
    const cancelPostPaintLoad = schedulePostPaintIdle(() => {
      void loadPageFactoryAuditModule()
        .then((module) => {
          if (!cancelled) setAuditModule(module);
        })
        .catch((error) => {
          if (!cancelled) setAuditLoadError(error instanceof Error ? error.message : String(error));
        });
    }, 600);
    return () => {
      cancelled = true;
      cancelPostPaintLoad();
    };
  }, [auditLoadAttempt, auditModule]);

  const selectRegistryPage = (page: PageFactoryPage) => {
    setSelectedPage(page);
    setInspection(null);
    setFactoryReceipt(null);
  };

  const runInspection = () => {
    const next = inspectPageFactoryDocument(pathname, search);
    if (registeredPage) setSelectedPage(registeredPage);
    setInspection(next);
    setFactoryReceipt(null);
    if (next.passed) toast.success(`“${next.page?.label}”页面工厂检查通过。`);
    else if (!next.page) toast.warning("当前页面尚未进入正式页面工厂注册表，已生成接入线索。");
    else toast.warning("当前页面仍有缺失区域或能力，请查看检查结果。");
  };

  const confirmFactoryDefault = () => {
    if (registeredPage && selectedPage.id !== registeredPage.id) {
      toast.warning("当前登记选择不是正在打开的页面，请先选择当前页面后再确认工厂默认。");
      return;
    }
    const next = inspectPageFactoryDocument(pathname, search);
    setInspection(next);
    if (!next.passed || !next.page || readOnly) {
      toast.warning(readOnly ? "当前来源端只读，不能确认新的工厂默认。" : "必须先通过当前页全部检查，才能确认工厂默认。");
      return;
    }
    const audit = recordPageCompositionAudit(pathname, search);
    const receipt = `${next.page.factoryDefaultVersion} · ${audit.id}`;
    setFactoryReceipt(receipt);
    window.localStorage.setItem(`tradepro.page-factory.receipt.${next.page.id}`, JSON.stringify({
      pageId: next.page.id,
      factoryVersion: next.page.factoryDefaultVersion,
      auditId: audit.id,
      confirmedAt: new Date().toISOString(),
    }));
    toast.success("已确认代码版本为恢复工厂默认；业务数据、素材、租户内容和正式备份未写入快照。");
  };

  const commandText = buildPageFactoryCommand(selectedCommand, selectedPage);
  const selectedMatchesCurrentPage = registeredPage?.id === selectedPage.id;
  const selectedPageInspection = selectedMatchesCurrentPage && inspection?.page?.id === registeredPage?.id
    ? inspection
    : null;
  const currentIsPilot = selectedMatchesCurrentPage && registeredPage?.id === PILOT_PAGE.id;
  const regionResult = selectedPageInspection?.regions ?? selectedPage.requiredRegions.map((id) => ({ id, present: currentIsPilot, selector: "源码登记" }));
  const capabilityResult = selectedPageInspection?.capabilities ?? selectedPage.capabilities.map((id) => ({ id, present: currentIsPilot }));
  const visibleRegistryPages = useMemo(() => {
    const initialPages = PAGE_FACTORY_PAGES.slice(0, visibleRegistryCount);
    return initialPages.some((page) => page.id === selectedPage.id)
      ? initialPages
      : [...initialPages, selectedPage];
  }, [selectedPage, visibleRegistryCount]);
  const registryHasMore = visibleRegistryCount < PAGE_FACTORY_PAGES.length;
  const inventory = auditModule?.PAGE_FACTORY_INVENTORY ?? null;
  const verification = auditModule?.PAGE_FACTORY_VERIFICATION ?? null;
  const coverage = inventory?.totals ?? null;
  const routeAudit = inventory?.routingAudit ?? null;
  const planSummary = inventory?.planSummary ?? null;
  const phaseProgress = inventory?.phaseProgress ?? null;
  const baselineDiff = inventory?.baselineDiff ?? null;
  const latestProductMarketEvidence = verification?.latestProductMarketRuntimeVersionConsistencyRetestRevision ?? null;
  const pageFactorySourceRecords = useMemo(
    () => verification
      ? pageFactoryAuditSourceRecords ??= adaptPhaseTwoVerificationRecords(verification)
      : [],
    [verification],
  );
  const allDeveloperRecords = useMemo(() => sortDeveloperRecords([
    ...new Map([...pageFactorySourceRecords, ...developerRecords].map((record) => [record.recordId, record])).values(),
  ]), [developerRecords, pageFactorySourceRecords]);

  useEffect(() => {
    setSelectedPage(registeredPage || PILOT_PAGE);
    setInspection(null);
    setFactoryReceipt(null);
    setVisibleRegistryCount(REGISTRY_PAGE_BATCH_SIZE);
  }, [pathname, registeredPage, search]);

  useEffect(() => {
    if (!verification) return;
    onSourceRecordsResolved?.(pageFactorySourceRecords);
  }, [onSourceRecordsResolved, pageFactorySourceRecords, verification]);
  const inventoryCandidates = useMemo(() => {
    const normalizedQuery = inventoryQuery.trim().toLowerCase();
    return (inventory?.pages ?? []).filter((page) => {
      if (!page.routeEntry || page.registered) return false;
      if (inventoryRisk !== "all" && page.risk !== inventoryRisk) return false;
      if (!normalizedQuery) return true;
      return [page.id, page.source, page.reason, ...page.routeHints, ...page.analysis.riskSignals]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [inventory, inventoryQuery, inventoryRisk]);

  if (!inventory || !verification || !coverage || !routeAudit || !planSummary || !phaseProgress || !baselineDiff || !latestProductMarketEvidence) {
    return (
      <section
        data-page-factory-workbench
        data-page-factory-version={PAGE_FACTORY_STANDARD.factoryVersion}
        data-page-factory-audit-load-state={auditLoadError ? "failed" : "post-paint-pending"}
        aria-busy={!auditLoadError}
        className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 overflow-hidden p-6 text-center"
      >
        <Factory className="h-6 w-6 opacity-60" />
        <div role="status" aria-live="polite">
          <strong className="text-sm">{auditLoadError ? "治理明细加载失败" : "页面工厂已就绪"}</strong>
          <p className="mt-1 text-[11px] leading-5 opacity-65">
            {auditLoadError
              ? "覆盖率与记录总账暂未载入；可重试，不影响进入 08 最终保护门。"
              : "正在首帧后按需加载覆盖率、普查明细与记录总账，避免和当前页面首屏争抢资源。"}
          </p>
        </div>
        {auditLoadError ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setAuditLoadAttempt((attempt) => attempt + 1)}>
            重试加载治理明细
          </Button>
        ) : null}
      </section>
    );
  }

  const selectedInventoryPage = selectedInventoryTarget
    ? inventory.pages.find((page) => page.id === selectedInventoryTarget.pageId) ?? null
    : null;
  const adoptionPlanCommand = selectedInventoryPage && selectedInventoryTarget
    ? `python tools/page_factory.py adopt --id ${selectedInventoryPage.id} --route ${selectedInventoryTarget.route} --component ${selectedInventoryPage.source} --template ${selectedAdoptionTemplate} --auto-regions`
    : "先从普查明细选择一个页面；系统只生成单页接入计划，不会自动写入。";
  const riskEntries = [
    { id: "low", label: "低风险候选", count: coverage.routeRisk.low },
    { id: "review", label: "需审查", count: coverage.routeRisk.review },
    { id: "high", label: "高风险专项", count: coverage.routeRisk.high },
  ] as const;

  return (
    <section data-page-factory-workbench data-page-factory-version={PAGE_FACTORY_STANDARD.factoryVersion} data-page-factory-selected-page={selectedPage.id} data-page-factory-registered-page={registeredPage?.id || "unregistered"} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div data-page-factory-summary className="grid shrink-0 gap-2 border-b border-current/15 p-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-lg border border-current/15 p-2"><div className="text-[10px] opacity-65">工厂版本</div><div className="mt-1 font-semibold">{PAGE_FACTORY_STANDARD.factoryVersion}</div></div>
        <div className="rounded-lg border border-current/15 p-2"><div className="text-[10px] opacity-65">正式登记</div><div className="mt-1 font-semibold">{PAGE_FACTORY_PAGES.length} 个页面</div></div>
        <div data-page-factory-coverage-summary data-page-factory-coverage-percentage={coverage.routeCoveragePercent} data-page-factory-coverage-scope="route-entry" className="rounded-lg border border-current/15 p-2"><div className="text-[10px] opacity-65">正式完成覆盖率</div><div className="mt-1 font-semibold">{coverage.completedRouteEntries} / {coverage.routeEntries} · {coverage.routeCoveragePercent}%</div><div className="mt-0.5 text-[9px] opacity-60">已登记 {coverage.registeredRouteEntries} · 辅助文件 {coverage.supportFiles}</div></div>
        <div className="rounded-lg border border-current/15 p-2"><div className="text-[10px] opacity-65">三端治理</div><div className="mt-1 font-semibold">总部端 · 代理源 · 客户源</div></div>
        <div className="rounded-lg border border-current/15 p-2"><div className="text-[10px] opacity-65">当前来源</div><div className="mt-1 font-semibold">{sourceLabel}</div></div>
        <div data-page-factory-phase-progress={phaseProgress.completedPercent} data-page-factory-progress-version={phaseProgress.version} className="rounded-lg border border-current/15 p-2"><div className="text-[10px] opacity-65">第二阶段治理完成度</div><div className="mt-1 font-semibold">{phaseProgress.completedPercent}%</div><div className="mt-0.5 text-[9px] opacity-60">版本 {phaseProgress.version}</div></div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(15rem,0.72fr)_minmax(0,1.28fr)]">
        <div className="space-y-3">
          <section className="rounded-xl border border-current/20 p-3">
            <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><Factory className="h-4 w-4" />页面登记</h3><span className="rounded-full border border-current/20 px-2 py-0.5 text-[9px]">源码永久保存</span></div>
            <div className="mt-3 space-y-2">
              {visibleRegistryPages.map((page) => <button key={page.id} type="button" data-page-factory-registry-item={page.id} aria-pressed={selectedPage.id === page.id} onClick={() => selectRegistryPage(page)} className={`w-full rounded-lg border p-2 text-left text-xs ${selectedPage.id === page.id ? "border-current/50 bg-current/10" : "border-current/15"}`}><div className="flex items-center justify-between gap-2"><b>{page.label}</b><span className="rounded-full border border-current/20 px-1.5 py-0.5 text-[9px]">{page.status}</span></div><div className="mt-1 break-all opacity-65">{page.route}</div><div className="mt-1 opacity-65">模板：{page.template} · 默认：{page.factoryDefaultVersion}</div></button>)}
            </div>
            <div data-page-factory-registry-pagination data-page-factory-registry-visible-count={visibleRegistryPages.length} data-page-factory-registry-total={PAGE_FACTORY_PAGES.length} className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-current/10 pt-2">
              <span className="text-[10px] opacity-65">已显示 {visibleRegistryPages.length}/{PAGE_FACTORY_PAGES.length} 个页面</span>
              {registryHasMore ? <div className="flex flex-wrap items-center gap-1.5">
                <Button data-page-factory-registry-load-more type="button" size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => setVisibleRegistryCount((count) => Math.min(count + REGISTRY_PAGE_BATCH_SIZE, PAGE_FACTORY_PAGES.length))}>加载更多</Button>
                <Button data-page-factory-registry-show-all type="button" size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => setVisibleRegistryCount(PAGE_FACTORY_PAGES.length)}>显示全部</Button>
              </div> : null}
            </div>
            <Button data-page-factory-open-pilot type="button" size="sm" variant="outline" className="mt-3 w-full" onClick={() => onNavigate(`/zb/client-source${PILOT_PAGE.route}`)}><ExternalLink className="mr-1.5 h-3.5 w-3.5" />打开兴趣搜索试点</Button>
          </section>

          <section data-page-factory-coverage-center data-page-factory-census-mode={inventory.mode} className="rounded-xl border border-current/20 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="h-4 w-4" />页面工厂覆盖率中心</h3><p className="mt-1 text-[10px] leading-4 opacity-65">第二阶段仅做全平台只读普查、风险分级和分批计划；不会批量接入或改写页面。</p></div><span className="rounded-full border border-current/20 px-2 py-0.5 text-[9px]">{inventory.mode}</span></div>
            <div className="mt-3 rounded-lg border border-current/15 p-2">
              <div className="flex items-center justify-between gap-2 text-[10px]"><b>第二阶段治理进度</b><span>{phaseProgress.completedPercent}% · {phaseProgress.version}</span></div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-current/10"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${phaseProgress.completedPercent}%` }} /></div>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {phaseProgress.steps.map((step) => <div key={step.id} data-page-factory-progress-step={step.id} data-page-factory-progress-step-complete={step.complete} className="flex items-center justify-between rounded border border-current/10 px-1.5 py-1 text-[9px]"><span>{step.label}</span><span>{step.complete ? "完成" : "待完成"} · {step.weight}%</span></div>)}
              </div>
              <div data-page-factory-baseline-status={baselineDiff.status} className="mt-2 text-[9px] leading-4 opacity-65">普查基线：{baselineDiff.status === "unchanged" ? "一致" : baselineDiff.status === "changed" ? "发现变化" : "尚未建立"}；新增 {baselineDiff.addedPageIds.length}、移除 {baselineDiff.removedPageIds.length}、风险变化 {baselineDiff.riskChangedPageIds.length}。</div>
              <div className="mt-1 text-[9px] leading-4 opacity-65">注意：治理完成度是普查工作进度；只有检查通过并保存工厂默认的页面才计入正式覆盖率，目前为 {coverage.completedRouteEntries} / {coverage.routeEntries} · {coverage.routeCoveragePercent}%。</div>
            </div>
            <div
              data-page-factory-verification-record
              data-page-factory-verification-status={verification.status}
              data-page-factory-verification-version={verification.factoryVersion}
              className={`mt-3 rounded-lg border p-2 ${statusClass(verification.status === "passed")}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]"><b>本版本验证记录</b><span>{verification.status === "passed" ? "全部通过" : verification.status === "failed" ? "存在失败" : "验证中"} · {verification.factoryVersion}</span></div>
              <div className="mt-1 text-[9px] leading-4 opacity-65">完成度 {verification.governancePercent}% · 正式覆盖率 {verification.routeCoveragePercent}% · {verification.recordedAt ? new Date(verification.recordedAt).toLocaleString() : "等待最终记录"}</div>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {verification.checks.map((check) => <div key={check.id} data-page-factory-verification-check={check.id} data-page-factory-verification-result={check.status} className="rounded border border-current/10 px-1.5 py-1 text-[9px]"><div className="flex items-center justify-between gap-2"><span>{check.label}</span><b>{check.status === "passed" ? "通过" : check.status === "failed" ? "失败" : "待验证"}</b></div><div className="mt-0.5 opacity-60">{check.result}</div></div>)}
              </div>
              <div className="mt-2 text-[9px] opacity-65">{verification.summary}</div>
            </div>
            <div
              data-page-factory-product-market-evidence
              data-page-factory-product-market-evidence-version={latestProductMarketEvidence.factoryVersion}
              data-page-factory-product-market-evidence-h-version={latestProductMarketEvidence.targetHVersion}
              data-page-factory-product-market-evidence-completion={latestProductMarketEvidence.completionPercent}
              className={`mt-2 rounded-lg border p-2 ${statusClass(latestProductMarketEvidence.completionPercent === 100)}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                <b>产品市场最新一致性证据</b>
                <span>{latestProductMarketEvidence.targetHVersion} · {new Date(latestProductMarketEvidence.recordedAt).toLocaleString()}</span>
              </div>
              <div className="mt-1 text-[9px] leading-4 opacity-65">
                完成度 {latestProductMarketEvidence.completionPercent}% · 治理 {latestProductMarketEvidence.governancePercent}% · 路由覆盖 {latestProductMarketEvidence.routeCoveragePercent}%
              </div>
              <p className="mt-2 text-[9px] leading-4 opacity-75">{latestProductMarketEvidence.result}</p>
              <details className="mt-2 text-[9px] leading-4 opacity-70">
                <summary className="cursor-pointer font-semibold">查看验证范围与风险边界</summary>
                <p className="mt-1">{latestProductMarketEvidence.scope}</p>
                <p className="mt-1">{latestProductMarketEvidence.validation}</p>
                <p className="mt-1">{latestProductMarketEvidence.risks}</p>
              </details>
            </div>
            <div data-page-factory-developer-record-ledger className="mt-3 h-[32rem] min-h-0">
              <DeveloperRecordPanel records={allDeveloperRecords} mode="ledger" />
            </div>
            <div data-page-factory-route-audit={routeAudit.unmappedRouteTargets.length || routeAudit.unregisteredRouteIdentities.length || routeAudit.ownershipMismatches.length ? "review" : "complete"} data-page-factory-route-identity-coverage={routeAudit.routeIdentityCoveragePercent} className="mt-3 rounded-md border border-current/15 px-2 py-1.5 text-[10px]">路由审计：源码归属 {routeAudit.mappedRouteDeclarations} / {routeAudit.literalRouteDeclarations}；实际身份 {routeAudit.registeredRouteIdentities} / {routeAudit.expectedRouteIdentities} · {routeAudit.routeIdentityCoveragePercent}%{routeAudit.unregisteredRouteIdentities.length || routeAudit.ownershipMismatches.length ? `；待补登记 ${routeAudit.unregisteredRouteIdentities.length}、归属冲突 ${routeAudit.ownershipMismatches.length}` : `；全部登记，另含 ${routeAudit.queryVariantIdentities} 个页签身份`}</div>
            <div data-page-factory-plan-status={planSummary.complete ? "complete" : "review"} className="mt-2 rounded-md border border-current/15 px-2 py-1.5 text-[10px]">分批计划：{planSummary.plannedRouteEntries} / {planSummary.eligibleRouteEntries}{planSummary.complete ? "；全部未接入路由已且仅进入一个审查批次" : "；仍有遗漏或重复"}</div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {riskEntries.map((risk) => <div key={risk.id} data-page-factory-risk-count={risk.id} className="rounded-md border border-current/15 p-1.5 text-center"><div className="text-[9px] opacity-65">{risk.label}</div><b className="text-xs">{risk.count}</b></div>)}
            </div>
            <div className="mt-3 space-y-2">
              {inventory.batches.map((batch) => <div key={batch.id} data-page-factory-batch={batch.id} data-page-factory-wave-count={batch.waves.length} className="rounded-md border border-current/15 p-2 text-[10px]"><div className="flex items-center justify-between gap-2"><b>{batch.id} · {batch.label}</b><span className="rounded-full border border-current/20 px-1.5 py-0.5">{batch.candidateCount} 页 / {batch.waves.length} 波</span></div><div className="mt-1 leading-4 opacity-65">每波最多 {batch.waveSize} 页；进入：{batch.entryCriteria[0]}；退出：{batch.exitCriteria.at(-1)}</div></div>)}
            </div>
            <ul className="mt-3 space-y-1 border-t border-current/10 pt-2 text-[10px] leading-4 opacity-65">
              {inventory.guardrails.map((guardrail) => <li key={guardrail}>· {guardrail}</li>)}
            </ul>
          </section>

          <section className="rounded-xl border border-current/20 p-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><TerminalSquare className="h-4 w-4" />可扩展命令</h3>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {PAGE_FACTORY_COMMANDS.map((command) => <button key={command.id} type="button" data-page-factory-command={command.id} onClick={() => setSelectedCommand(command.id)} className={`rounded-md border px-2 py-1.5 text-left text-[11px] ${selectedCommand === command.id ? "border-current/50 bg-current/10" : "border-current/15"}`}><b>{command.label}</b><span className="mt-0.5 block text-[9px] opacity-60">{command.mode}</span></button>)}
            </div>
            <div data-page-factory-command-preview className="mt-2 break-all rounded-md border border-current/15 bg-current/[0.04] p-2 font-mono text-[10px] leading-4">{commandText}</div>
            <Button type="button" size="sm" variant="outline" className="mt-2 w-full" onClick={() => void copyTextWithFallback(commandText).then(() => toast.success("页面工厂命令已复制。"))}>复制命令</Button>
          </section>
        </div>

        <div className="space-y-3">
          <section data-page-factory-inventory-browser className="rounded-xl border border-current/20 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><h3 className="flex items-center gap-2 text-sm font-semibold"><Factory className="h-4 w-4" />全平台普查明细</h3><p className="mt-1 text-[10px] leading-4 opacity-65">筛选候选页面、查看源码风险，再生成单页接入计划。这里不会批量改写页面。</p></div>
              <span className="rounded-full border border-current/20 px-2 py-0.5 text-[9px]">{inventoryCandidates.length} 个候选</span>
            </div>
            <div data-page-factory-inventory-filter className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <input value={inventoryQuery} onChange={(event) => setInventoryQuery(event.target.value)} placeholder="搜索页面、源码、路由或风险信号" className="min-w-0 rounded-md border border-current/20 bg-transparent px-2 py-1.5 text-[11px] outline-none focus:border-current/50" />
              <select value={inventoryRisk} onChange={(event) => setInventoryRisk(event.target.value as typeof inventoryRisk)} className="min-w-0 rounded-md border border-current/20 bg-[var(--background,#fff)] px-2 py-1.5 text-[11px] outline-none focus:border-current/50">
                <option value="all">全部风险</option><option value="low">低风险</option><option value="review">需审查</option><option value="high">高风险</option>
              </select>
            </div>
            <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {inventoryCandidates.map((page) => {
                const selected = selectedInventoryTarget?.pageId === page.id;
                return <div key={page.id} data-page-factory-inventory-item={page.id} data-page-factory-inventory-risk={page.risk} className={`rounded-lg border p-2 ${selected ? "border-current/50 bg-current/[0.07]" : "border-current/15"}`}>
                  <button type="button" className="w-full text-left" onClick={() => setSelectedInventoryTarget({ pageId: page.id, route: page.routeHints[0] || "/" })}>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]"><b className="break-all">{page.id}</b><span className="rounded-full border border-current/20 px-1.5 py-0.5 text-[9px]">{page.risk} · {page.analysis.riskScore} 分</span></div>
                    <div className="mt-1 break-all text-[9px] opacity-65">{page.source} · 入口 {page.analysis.lineCount} 行 · 实际分析 {page.analysis.analyzedLineCount} 行</div>
                    {page.analysis.linkedSources.length ? <div className="mt-1 break-all text-[8px] opacity-55">直接实现：{page.analysis.linkedSources.join("、")}</div> : null}
                    <div className="mt-1 text-[9px] leading-4 opacity-65">{page.reason}</div>
                    {page.analysis.riskSignals.length ? <div className="mt-1 flex flex-wrap gap-1">{page.analysis.riskSignals.map((signal) => <span key={signal} className="rounded border border-current/15 px-1 py-0.5 text-[8px] opacity-70">{signal}</span>)}</div> : null}
                  </button>
                  {selected && page.routeHints.length > 1 ? <select aria-label="选择接入路由" value={selectedInventoryTarget.route} onChange={(event) => setSelectedInventoryTarget({ pageId: page.id, route: event.target.value })} className="mt-2 w-full rounded-md border border-current/20 bg-[var(--background,#fff)] px-2 py-1 text-[10px]">{page.routeHints.map((route) => <option key={route} value={route}>{route}</option>)}</select> : null}
                </div>;
              })}
              {!inventoryCandidates.length ? <div data-page-factory-inventory-empty={coverage.routeCoveragePercent === 100 ? "complete" : "filtered"} className="rounded-md border border-dashed border-current/20 p-3 text-center text-[10px] opacity-60">{coverage.routeCoveragePercent === 100 ? "全部路由源码已完成页面工厂接入，正式覆盖率 100%，当前没有待接入候选。" : "没有符合当前筛选条件的候选页面。"}</div> : null}
            </div>
            <div data-page-factory-adoption-preview className="mt-3 rounded-lg border border-current/15 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-[11px]">单页接入计划（默认只读预览）</b><select aria-label="选择页面模板" value={selectedAdoptionTemplate} onChange={(event) => setSelectedAdoptionTemplate(event.target.value as PageFactoryPage["template"])} className="rounded-md border border-current/20 bg-[var(--background,#fff)] px-2 py-1 text-[10px]"><option value="reference">reference</option><option value="dashboard">dashboard</option><option value="list">list</option><option value="form">form</option><option value="detail">detail</option><option value="editor">editor</option><option value="workflow">workflow</option></select></div>
              <div className="mt-2 break-all rounded-md bg-current/[0.04] p-2 font-mono text-[9px] leading-4">{adoptionPlanCommand}</div>
              <Button type="button" size="sm" variant="outline" className="mt-2 w-full" disabled={!selectedInventoryPage} onClick={() => void copyTextWithFallback(adoptionPlanCommand).then(() => toast.success("单页接入计划命令已复制；未包含 --apply，不会写入。"))}>复制只读计划命令</Button>
            </div>
            <ol data-page-factory-usage-steps className="mt-3 space-y-1 border-t border-current/10 pt-2 text-[10px] leading-4 opacity-70">
              <li>1. 先按风险与关键字筛选，选择一个候选页面和准确路由。</li>
              <li>2. 复制命令并运行；不带 <code>--apply</code> 时只预览接入计划。</li>
              <li>3. 获得单页改造授权后才加 <code>--apply</code>；<code>--auto-regions</code> 只识别当前页真实标题、卡片、表格和滚动区，不改业务数据。</li>
              <li>4. 必须逐页完成 390px 与实际区域检查，全部通过后才能确认工厂默认并推进版本记录。</li>
            </ol>
          </section>

          <section data-page-factory-current-inspection data-page-factory-inspection-state={selectedPageInspection ? "checked" : "idle"} data-page-factory-inspection-page={selectedPageInspection?.page?.id || "none"} className={`rounded-xl border p-3 ${statusClass(Boolean(selectedPageInspection?.passed || currentIsPilot))}`}>
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="h-4 w-4" />当前页面检查</h3><p className="mt-1 text-[11px] opacity-70">{selectedMatchesCurrentPage ? `${selectedPageInspection?.normalizedRoute || `${pathname}${search}`} · ${selectedPageInspection?.checkedAt ? new Date(selectedPageInspection.checkedAt).toLocaleTimeString() : "等待运行"}` : `已选择“${selectedPage.label}”；打开该页面后才能使用当前页检查结果。`}</p></div><Button data-page-factory-run-inspection type="button" size="sm" disabled={Boolean(registeredPage && !selectedMatchesCurrentPage)} onClick={runInspection}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />检查当前页面</Button></div>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {regionResult.map((region) => <div key={region.id} data-page-factory-region-status={region.present ? "passed" : "missing"} className="flex items-center justify-between rounded-md border border-current/15 px-2 py-1.5 text-[11px]"><span>{region.id}</span><span>{region.present ? "已接入" : "缺失"}</span></div>)}
            </div>
          </section>

          <section className="rounded-xl border border-current/20 p-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" />固定能力</h3>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {capabilityResult.map((capability) => <div key={capability.id} data-page-factory-capability-status={capability.present ? "passed" : "missing"} className="flex items-center justify-between rounded-md border border-current/15 px-2 py-1.5 text-[11px]"><span>{capability.id}</span><span className="flex items-center gap-1">{capability.present ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : null}{capability.present ? "已启用" : "待接入"}</span></div>)}
            </div>
            <p className="mt-3 text-[10px] leading-4 opacity-65">恢复工厂默认只覆盖结构、共享样式、CSS插件、区域标注、自适应规则与开发工具；数据库、业务数据、上传素材、租户内容、下游自定义和正式备份始终保留。</p>
          </section>

          <section className="rounded-xl border border-current/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">工厂默认确认</h3><p className="mt-1 text-[10px] opacity-65">只有正式登记且当前页面全部检查通过时才能确认。</p></div><Button data-page-factory-save-default type="button" size="sm" disabled={readOnly || !selectedMatchesCurrentPage} onClick={confirmFactoryDefault}>保存为恢复工厂默认</Button></div>
            <div data-page-factory-receipt className="mt-2 rounded-md border border-current/15 px-2 py-1.5 text-[10px]">{factoryReceipt ? `已建立：${factoryReceipt}` : `代码默认：${selectedPage.factoryDefaultVersion} · 等待当前机器验收记录`}</div>
          </section>
        </div>
      </div>
    </section>
  );
}
