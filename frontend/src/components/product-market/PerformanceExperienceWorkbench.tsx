import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { SHARED_OPTIMIZATION_CONTRACT } from "@/lib/developer-optimization-contract";
import {
  PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT,
  applyPerformanceExperiencePlanToCurrentRoute,
  getPerformanceExperienceIssueLabel,
  getPerformanceExperienceSnapshot,
  runPerformanceExperienceAudit,
  type PerformanceExperienceAudit,
  type PerformanceExperienceScope,
  type PerformanceExperienceSnapshot,
} from "@/lib/performance-experience-learning";
import {
  DEVELOPER_WORKFLOW_PERFORMANCE_BENCHMARK_METRIC_IDS,
  type DeveloperWorkflowPerformanceBenchmarkMetricId,
  type DeveloperWorkflowPerformanceBenchmarkSummary,
  type DeveloperWorkflowScope,
  type UpdateDeveloperWorkflowArtifactInput,
} from "@/lib/developer-workflow-run";
import {
  buildGlobalPerformanceWorkflowArtifact,
  evaluateGlobalPerformanceAuditCoverage,
  runPerformanceCodeAudit,
  type PerformanceCodeAuditReport,
} from "@/lib/performance-code-audit";

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

const BENCHMARK_METRIC_LABELS: Record<DeveloperWorkflowPerformanceBenchmarkMetricId, string> = {
  visualReadyMs: "首屏可见",
  editReadyMs: "可编辑",
  interactiveReadyMs: "可交互",
  domContentLoadedMs: "DOM 就绪",
  firstContentfulPaintMs: "FCP",
  largestContentfulPaintMs: "LCP",
  scriptEncodedBytes: "脚本编码体积",
  totalEncodedBytes: "资源编码体积",
  resourceCount: "请求数",
  duplicateRequestExcess: "重复请求",
};

const BENCHMARK_OUTCOME_LABELS = {
  improved: "已提升",
  regressed: "有回退",
  unchanged: "基本持平",
  invalid: "对比无效",
} as const;

function formatBenchmarkValue(metricId: DeveloperWorkflowPerformanceBenchmarkMetricId, value: number) {
  if (metricId.endsWith("Bytes")) return `${value < 0 ? "-" : ""}${formatBytes(Math.abs(value))}`;
  const formatted = Number.isInteger(value) ? `${value}` : value.toFixed(1);
  return metricId.endsWith("Ms") ? `${formatted}ms` : formatted;
}

function formatBenchmarkDelta(
  metricId: DeveloperWorkflowPerformanceBenchmarkMetricId,
  delta: number,
  deltaPercent: number | null,
) {
  const signedDelta = `${delta > 0 ? "+" : ""}${formatBenchmarkValue(metricId, delta)}`;
  if (deltaPercent === null) return signedDelta;
  return `${signedDelta} (${deltaPercent > 0 ? "+" : ""}${deltaPercent.toFixed(1)}%)`;
}

export default function PerformanceExperienceWorkbench({
  scope,
  readOnly,
  workflowScope = "page",
  workflowRunId = "",
  workflowScopeIdentity = "",
  workflowSourceFingerprint = "",
  workflowContractVersion = "",
  workflowTargetCount = 0,
  workflowTargetManifestFingerprint = "",
  workflowTargetIds = [],
  initialReport = null,
  benchmarkSummary = null,
  onGlobalAuditReport,
  onWorkflowArtifact,
}: {
  scope: PerformanceExperienceScope;
  readOnly: boolean;
  workflowScope?: DeveloperWorkflowScope;
  workflowRunId?: string;
  workflowScopeIdentity?: string;
  workflowSourceFingerprint?: string;
  workflowContractVersion?: string;
  workflowTargetCount?: number;
  workflowTargetManifestFingerprint?: string;
  workflowTargetIds?: readonly string[];
  initialReport?: PerformanceCodeAuditReport | null;
  benchmarkSummary?: DeveloperWorkflowPerformanceBenchmarkSummary | null;
  onGlobalAuditReport?: (report: PerformanceCodeAuditReport) => void;
  onWorkflowArtifact?: (input: UpdateDeveloperWorkflowArtifactInput<"05">) => void;
}) {
  const [snapshot, setSnapshot] = useState<PerformanceExperienceSnapshot>(() => getPerformanceExperienceSnapshot(scope));
  const [globalAuditRunning, setGlobalAuditRunning] = useState(false);
  const reusableInitialReport = workflowScope === "global" && initialReport?.scope === "global" ? initialReport : null;
  const [globalAuditReport, setGlobalAuditReport] = useState<PerformanceCodeAuditReport | null>(reusableInitialReport);
  const [globalAuditError, setGlobalAuditError] = useState("");
  const globalAuditRequestIdRef = useRef(0);
  const globalAuditContextKey = `${workflowRunId}:${workflowScope}:${workflowScopeIdentity}:${workflowSourceFingerprint}:${workflowContractVersion}:${workflowTargetCount}:${workflowTargetManifestFingerprint}:${workflowTargetIds.join("|")}`;
  const globalAuditContextRef = useRef(globalAuditContextKey);
  const latestAudit = snapshot.latestAudit?.route === snapshot.route
    && snapshot.latestAudit.scope === scope
    && snapshot.latestAudit.contractVersion === snapshot.contractVersion
    ? snapshot.latestAudit
    : null;
  const currentLearned = useMemo(
    () => snapshot.learned.filter((entry) => entry.scope === scope && entry.route === snapshot.route).slice(0, 8),
    [scope, snapshot.learned, snapshot.route],
  );
  const recentAuditTrend = useMemo(() => snapshot.auditTrend.slice(-3).reverse(), [snapshot.auditTrend]);
  const isApplied = snapshot.appliedRoutes.includes(snapshot.route);

  const refresh = useCallback(
    () => setSnapshot(getPerformanceExperienceSnapshot(scope)),
    [scope],
  );

  const reportWorkflowAudit = useCallback((audit: PerformanceExperienceAudit) => {
    const globalRepresentativeOnly = workflowScope === "global";
    const pageBlocked = !globalRepresentativeOnly && audit.issues.length > 0;
    const runtimeArtifactRef = `performance-runtime:${scope}:${encodeURIComponent(audit.route)}:${audit.measuredAt}`;
    const artifactRefs = [...new Set([...(benchmarkSummary?.artifactRefs ?? []), runtimeArtifactRef])].sort();
    onWorkflowArtifact?.({
      status: globalRepresentativeOnly ? "pending" : pageBlocked ? "blocked" : "passed",
      payload: {
        metricIds: Object.keys(audit.metrics).sort(),
        budgetViolations: [...audit.issues].sort(),
        artifactRefs,
        sampleRoute: audit.route,
        sampleScope: workflowScope,
        coverageMode: globalRepresentativeOnly ? "representative-route" : "current-page",
        measuredAt: audit.measuredAt,
        ...(benchmarkSummary ? { benchmarkSummary } : {}),
      },
      artifactRefs,
      message: globalRepresentativeOnly
        ? "当前路由代表样本已记录；全局范围仍需批量目标证据，不能用单页样本冒充全局通过。"
        : audit.issues.length
          ? `运行时性能门禁阻断：发现 ${audit.issues.length} 项超阈值问题，请优化后重新检测。`
          : "性能证据已生成，当前样本未发现加载压力。",
    });
  }, [benchmarkSummary, onWorkflowArtifact, scope, workflowScope]);

  useEffect(() => {
    const onLearning = () => refresh();
    window.addEventListener(PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.eventName, onLearning);
    refresh();
    return () => window.removeEventListener(PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.eventName, onLearning);
  }, [refresh]);

  useEffect(() => {
    globalAuditRequestIdRef.current += 1;
    globalAuditContextRef.current = globalAuditContextKey;
    setGlobalAuditRunning(false);
    setGlobalAuditReport(reusableInitialReport);
    setGlobalAuditError("");
  }, [globalAuditContextKey, reusableInitialReport]);

  const detectNow = () => {
    const audit = runPerformanceExperienceAudit(scope, "manual");
    refresh();
    reportWorkflowAudit(audit);
    if (audit.issues.length) toast.error(`发现 ${audit.issues.length} 项加载压力，Stage 05 已阻断。`);
    else toast.success("当前页面未发现新的加载压力。 ");
  };

  const runGlobalAudit = async () => {
    if (workflowScope !== "global") return;
    if (workflowTargetCount <= 0) {
      toast.error("全局目标清单尚未就绪，不能启动批检。 ");
      return;
    }
    const requestId = globalAuditRequestIdRef.current + 1;
    const requestContextKey = globalAuditContextKey;
    globalAuditRequestIdRef.current = requestId;
    setGlobalAuditRunning(true);
    setGlobalAuditError("");
    try {
      const report = await runPerformanceCodeAudit({ scope: "global", runBuild: true });
      if (globalAuditRequestIdRef.current !== requestId || globalAuditContextRef.current !== requestContextKey) return;
      const coverage = evaluateGlobalPerformanceAuditCoverage(report, workflowTargetCount, workflowTargetManifestFingerprint, workflowTargetIds);
      setGlobalAuditReport(report);
      onGlobalAuditReport?.(report);
      onWorkflowArtifact?.(buildGlobalPerformanceWorkflowArtifact(report, workflowTargetCount, workflowTargetManifestFingerprint, workflowTargetIds));
      if (coverage.complete) toast.success(`全局加载批检通过：${coverage.analyzedRoutes}/${coverage.targetCount}。`);
      else toast.error(`全局加载批检发现 ${coverage.issues.length} 项阻断证据。`);
    } catch (reason) {
      if (globalAuditRequestIdRef.current !== requestId || globalAuditContextRef.current !== requestContextKey) return;
      const message = reason instanceof Error ? reason.message : String(reason);
      setGlobalAuditError(message);
      onWorkflowArtifact?.({
        status: "blocked",
        payload: {
          metricIds: [],
          budgetViolations: ["global-audit-request-failed"],
          coverageMode: "registered-target-manifest",
          targetCount: workflowTargetCount,
          error: message,
        },
        message: `全局加载批检失败：${message}`,
      });
      toast.error(message);
    } finally {
      if (globalAuditRequestIdRef.current === requestId && globalAuditContextRef.current === requestContextKey) {
        setGlobalAuditRunning(false);
      }
    }
  };

  const applyNow = () => {
    if (readOnly) return;
    const result = applyPerformanceExperiencePlanToCurrentRoute(scope);
    refresh();
    reportWorkflowAudit(result.audit);
    toast.success(`已把安全加载策略应用到当前页面，处理 ${result.changed} 个离屏媒体。`);
  };

  const metrics = latestAudit?.metrics;
  const metricGroups = [
    {
      id: "route-bundle",
      label: "路由与脚本",
      values: [
        ["真实等待", metrics ? `${metrics.routeFallbackMs}ms` : "待检测"],
        ["路由脚本", metrics ? formatBytes(metrics.routeScriptBytes) : "待检测"],
        ["最大单包", metrics ? formatBytes(metrics.largestRouteScriptBytes) : "待检测"],
        ["页面稳定", metrics ? `${metrics.routeStabilizationMs}ms` : "待检测"],
      ],
    },
    {
      id: "thread-render",
      label: "主线程与渲染",
      values: [
        ["长任务", metrics ? `${metrics.longTaskCount} 个 / ${metrics.longTaskTotalMs}ms` : "待检测"],
        ["最长任务", metrics ? `${metrics.maxLongTaskMs}ms` : "待检测"],
        ["布局偏移", metrics ? metrics.layoutShiftScore.toFixed(3) : "待检测"],
        ["DOM", metrics ? `${metrics.domNodes}` : "待检测"],
      ],
    },
    {
      id: "storage-media",
      label: "存储与媒体",
      values: [
        ["本地存储", metrics ? `${metrics.localStorageEntries} 项 / ${formatBytes(metrics.localStorageBytes)}` : "待检测"],
        ["最大单项", metrics ? formatBytes(metrics.largestLocalStorageEntryBytes) : "待检测"],
        ["超大图片", metrics ? `${metrics.oversizedDecodedImages} 张` : "待检测"],
        ["离屏媒体", metrics ? `${metrics.eagerOffscreenMedia} 个 / 自动播放 ${metrics.offscreenAutoplayMedia}` : "待检测"],
        ["懒加载恢复", metrics ? `重试 ${metrics.lazyLoadRetryCount} / 成功 ${metrics.lazyLoadRecoveryCount} / 失败 ${metrics.lazyLoadFailureCount}` : "待检测"],
        ["重复资源", metrics ? `${metrics.duplicateResourceRequests} 组 / 额外 ${metrics.duplicateRequestExcess} 次` : "待检测"],
        ["大资源", metrics ? `${metrics.largeResourceTransfers} 个` : "待检测"],
      ],
    },
  ] as const;
  const benchmarkPhases = benchmarkSummary ? [
    { id: "cold" as const, label: "冷启动", phase: benchmarkSummary.cold },
    { id: "repeat" as const, label: "重复访问", phase: benchmarkSummary.repeat },
  ] : [];
  const benchmarkFunctionalParity = benchmarkSummary
    && benchmarkPhases.every(({ phase }) => phase.functionalParity.status === "passed")
    ? "passed"
    : "failed";

  return (
    <section
      data-performance-experience-workbench
      data-developer-workflow-scope={workflowScope}
      data-performance-experience-auto-learning="true"
      data-performance-experience-contract={snapshot.contractVersion}
      data-performance-experience-application-learning={snapshot.applicationLearning.applicationPlans.length}
      data-performance-experience-application-learning-version={snapshot.applicationLearning.version}
      data-shared-optimization-contract={SHARED_OPTIMIZATION_CONTRACT.version}
      data-performance-experience-ui="flat"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden p-3 sm:p-4"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-sm">优化加载体验</strong>
            <span data-performance-experience-learning-status className="text-[10px] font-semibold">自动学习：已启用</span>
            <span className="text-[10px] opacity-65">01–08 规则已映射 {snapshot.applicationLearning.applicationPlans.length}/8 · 八步源码复核 · 已学习 {snapshot.learned.length} 项</span>
          </div>
          <p className="mt-1 truncate text-[11px] opacity-70" title={snapshot.route}>{workflowScope === "global" ? "全局代表样本" : "当前页面"}：{snapshot.route}</p>
        </div>
        <button data-performance-experience-native-action="audit" type="button" className="h-8 px-2 text-xs font-medium hover:opacity-70 focus-visible:outline focus-visible:outline-2 disabled:opacity-40" onClick={detectNow}>立即检测</button>
        {workflowScope === "global" ? (
          <button
            data-performance-experience-native-action="global-audit"
            data-global-audit-target-count={workflowTargetCount}
            type="button"
            className="h-8 px-2 text-xs font-medium hover:opacity-70 focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={globalAuditRunning || workflowTargetCount <= 0}
            onClick={() => void runGlobalAudit()}
          >
            {globalAuditRunning ? "全局批检中…" : "全局批检"}
          </button>
        ) : null}
        <button data-performance-experience-native-action="safe-loading" type="button" className="h-8 px-2 text-xs font-medium hover:opacity-70 focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-40" disabled={readOnly} onClick={applyNow}>{isApplied ? "重新应用安全加载" : "应用安全加载"}</button>
      </div>

      {workflowScope === "global" ? (
        <p data-performance-experience-global-audit-status className={globalAuditError ? "mt-2 shrink-0 text-[10px] text-destructive" : "mt-2 shrink-0 text-[10px] opacity-65"}>
          {globalAuditError
            ? `批检失败：${globalAuditError}`
            : globalAuditReport?.bundleBudgetReport
              ? `批检覆盖 ${globalAuditReport.bundleBudgetReport.routeAnalysis.analyzedRoutes}/${workflowTargetCount}，指纹 ${globalAuditReport.bundleBudgetReport.fingerprint.slice(0, 16)}`
              : `正式通过要求构建报告完整覆盖 ${workflowTargetCount || "待解析"} 个全局目标；当前路由检测仅作代表样本。`}
        </p>
      ) : null}

      {benchmarkSummary ? (
        <section
          data-performance-benchmark-comparison
          data-performance-benchmark-outcome={benchmarkSummary.outcome}
          data-performance-benchmark-functional-parity={benchmarkFunctionalParity}
          data-performance-benchmark-artifact-count={benchmarkSummary.artifactRefs.length}
          data-performance-benchmark-baseline-fingerprint={benchmarkSummary.fingerprints.baselineReport}
          data-performance-benchmark-candidate-fingerprint={benchmarkSummary.fingerprints.candidateReport}
          className="mt-3 shrink-0"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <strong className="text-xs">基线 → 优化后</strong>
            <span className="text-[10px] font-semibold">{BENCHMARK_OUTCOME_LABELS[benchmarkSummary.outcome]}</span>
            <span className="text-[10px] opacity-65">
              功能一致性：{benchmarkFunctionalParity === "passed" ? "通过" : "未通过"}
            </span>
            <span className="text-[10px] opacity-55">
              证据 {benchmarkSummary.artifactRefs.length} 项 · 指纹 {benchmarkSummary.fingerprints.baselineReport.slice(0, 10)} → {benchmarkSummary.fingerprints.candidateReport.slice(0, 10)}
            </span>
            {benchmarkSummary.evidenceQuality ? (
              <span
                data-performance-benchmark-evidence-quality
                data-performance-benchmark-aggregation={benchmarkSummary.evidenceQuality.aggregation}
                data-performance-benchmark-confidence={benchmarkSummary.evidenceQuality.confidence}
                className="text-[10px] opacity-65"
              >
                {benchmarkSummary.evidenceQuality.aggregation === "mean" ? "全样本均值" : "样本中位数"}
                {` · 基线 ${benchmarkSummary.evidenceQuality.baselineSamples} / 候选 ${benchmarkSummary.evidenceQuality.candidateSamples} · ${benchmarkSummary.evidenceQuality.runCount} 轮 · ${benchmarkSummary.evidenceQuality.confidence === "stable" ? "稳定" : "有分歧"}`}
              </span>
            ) : null}
          </div>
          {benchmarkSummary.evidenceQuality?.notes.length ? (
            <p data-performance-benchmark-evidence-notes className="mt-1 text-[9px] leading-4 opacity-60">
              {benchmarkSummary.evidenceQuality.notes.join("；")}
            </p>
          ) : null}
          <div className="mt-2 grid gap-3 lg:grid-cols-2">
            {benchmarkPhases.map(({ id, label, phase }) => (
              <article
                key={id}
                data-performance-benchmark-phase={id}
                data-performance-benchmark-phase-outcome={phase.outcome}
                data-performance-benchmark-functional-parity={phase.functionalParity.status}
                className="min-w-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-[11px]">{label}</strong>
                  <span className="text-[10px] opacity-65">{BENCHMARK_OUTCOME_LABELS[phase.outcome]}</span>
                </div>
                <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                  {DEVELOPER_WORKFLOW_PERFORMANCE_BENCHMARK_METRIC_IDS.map((metricId) => {
                    const metric = phase.metrics[metricId];
                    if (!metric) return null;
                    return (
                      <div
                        key={metricId}
                        data-performance-benchmark-metric={metricId}
                        data-performance-benchmark-metric-status={metric.status}
                        className="min-w-0 py-0.5"
                      >
                        <dt className="text-[10px] opacity-60">{BENCHMARK_METRIC_LABELS[metricId]}</dt>
                        <dd className="mt-0.5 truncate text-[11px] font-semibold">
                          {formatBenchmarkValue(metricId, metric.before)} → {formatBenchmarkValue(metricId, metric.after)}
                        </dd>
                        <dd className="truncate text-[9px] opacity-60">
                          Δ {formatBenchmarkDelta(metricId, metric.delta, metric.deltaPercent)}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-3 grid shrink-0 gap-3 lg:grid-cols-3" data-performance-experience-metrics>
        {metricGroups.map((group) => (
          <section key={group.id} data-performance-experience-metric-group={group.id} className="min-w-0 py-1">
            <strong className="text-[11px]">{group.label}</strong>
            <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
              {group.values.map(([label, value]) => (
                <div key={label} className="min-w-0 py-0.5">
                  <dt className="text-[10px] opacity-60">{label}</dt>
                  <dd className="mt-0.5 truncate text-xs font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <div className="mt-3 grid min-h-0 flex-1 gap-3 overflow-y-auto xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
        <div className="min-w-0">
          <section
            data-performance-experience-cleanup-playbook
            data-performance-experience-source-review="advisory"
          >
            <div className="flex items-center justify-between gap-2">
              <div><strong className="text-sm">八步轻量化源码复核</strong><p className="mt-0.5 text-[10px] opacity-65">按顺序判断，发现一处学习一处；规则只给建议，不自动重写源码。</p></div>
              <span className="shrink-0 text-[10px] opacity-60">代码拥有 · 全局共享</span>
            </div>
            <ol className="mt-2 grid gap-x-4 md:grid-cols-2">
              {snapshot.cleanupPlaybook.map((step) => (
                <li
                  key={step.id}
                  data-performance-experience-cleanup-step={step.id}
                  data-performance-experience-cleanup-order={step.order}
                  className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 py-2"
                >
                  <span className="text-[10px] font-semibold opacity-60">{String(step.order).padStart(2, "0")}</span>
                  <div className="min-w-0">
                    <strong className="text-xs">{step.title}</strong>
                    <p className="mt-0.5 text-[11px] leading-5 opacity-75">{step.instruction}</p>
                    <p className="mt-0.5 text-[10px] leading-4 opacity-60">复核：{step.sourceReview}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p data-performance-experience-preserve-boundary className="mt-2 text-[10px] leading-5 opacity-70">
              必须保留：{snapshot.preservedCapabilities.map((item) => item.label).join("、")}。任何清理均需先确认功能与状态所有权。
            </p>
          </section>

          <section data-performance-experience-historical-patterns className="mt-4 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div><strong className="text-sm">已验证优化模板</strong><p className="mt-0.5 text-[10px] opacity-65">历史有效方案已自动写入学习目录，可直接复用到其他页面。</p></div>
              <span className="shrink-0 text-[10px] opacity-60">代码拥有 · 共享契约</span>
            </div>
            <ol className="mt-2 grid gap-x-4 md:grid-cols-2">
              {snapshot.patterns.map((pattern, index) => (
                <li key={pattern.id} data-performance-experience-pattern={pattern.id} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 py-2">
                  <span className="text-[10px] opacity-60">{String(index + 1).padStart(2, "0")}</span>
                  <div><strong className="text-xs">{pattern.title}</strong><p className="mt-0.5 text-[10px] leading-4 opacity-70">{pattern.summary} {pattern.quickApply}</p></div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section data-performance-experience-learned-issues className="min-w-0">
          <div><strong className="text-sm">当前页面自动学习</strong><p className="mt-0.5 text-[10px] opacity-65">发现一处就登记一处；相同问题累计次数，不重复制造规则。</p></div>
          {latestAudit?.issues.length ? (
            <p className="mt-3 text-[11px]">{latestAudit.issues.map((issue) => getPerformanceExperienceIssueLabel(issue)).join("、")}</p>
          ) : <p className="mt-3 text-[11px] opacity-70">当前页面没有新的加载压力；自动学习仍持续启用。</p>}
          {recentAuditTrend.length ? (
            <ol data-performance-experience-route-trend className="mt-3 space-y-1 text-[10px] opacity-65">
              {recentAuditTrend.map((audit) => (
                <li key={`${audit.measuredAt}:${audit.source}`} className="flex items-center justify-between gap-2">
                  <time dateTime={audit.measuredAt}>{new Date(audit.measuredAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
                  <span>{audit.issues.length ? `${audit.issues.length} 项压力` : "健康"}</span>
                </li>
              ))}
            </ol>
          ) : null}
          <div className="mt-3 space-y-3">
            {currentLearned.map((entry) => (
              <article key={entry.id}>
                <div className="flex items-start justify-between gap-2"><strong className="text-xs">{getPerformanceExperienceIssueLabel(entry.issue)}</strong><span className="shrink-0 text-[9px] opacity-60">发现 {entry.count} 次</span></div>
                <p className="mt-1 text-[10px] opacity-70">证据：{entry.evidence}</p>
                <p className="mt-1 text-[10px] leading-4">{entry.recommendation}</p>
              </article>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-4 opacity-60">安全边界：运行时只登记性能证据，并为当前路由应用图片延迟解码、离屏媒体元数据加载等可逆策略；八步法只用于源码复核，不自动删改源码、业务数据、素材、数据库或发布版本。</p>
        </section>
      </div>
    </section>
  );
}
