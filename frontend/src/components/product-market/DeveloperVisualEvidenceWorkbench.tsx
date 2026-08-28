import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Boxes, Download, Eye, Image as ImageIcon, MonitorSmartphone, Network, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DEVELOPER_DESIGN_INTEGRATION_CONTRACT,
  DEVELOPER_DESIGN_SESSION_EVENT,
  buildDeveloperVisualEvidenceSampleIndex,
  buildDeveloperVisualEvidenceRecord,
  computeDeveloperPageDnaFingerprint,
  inspectDeveloperDesignMappingCoverage,
  inspectDeveloperRuntimeVisualEvidence,
  isDeveloperRuntimeVisualEvidenceSample,
  readDeveloperDesignSession,
  resolveDeveloperVisualEvidenceViewport,
  type DeveloperPageDna,
  type DeveloperDesignScope,
  type DeveloperRuntimeVisualEvidence,
  type DeveloperVisualEvidenceRecord,
} from "@/lib/developer-design-integration";
import type { UpdateDeveloperWorkflowArtifactInput } from "@/lib/developer-workflow-run";

function metricTone(ok: boolean) {
  return ok ? "border-emerald-300/60 bg-emerald-500/5" : "border-amber-300/60 bg-amber-500/5";
}

const VISUAL_EVIDENCE_SAMPLE_STORAGE_PREFIX = "tradepro:developer-visual-evidence-samples:v2";
const VISUAL_EVIDENCE_SAMPLE_LIMIT = 1024;
const VISUAL_EVIDENCE_SAMPLE_CACHE_LIMIT = 12;
const EMPTY_VISUAL_EVIDENCE_SAMPLES: readonly DeveloperRuntimeVisualEvidence[] = [];
const visualEvidenceSampleCache = new Map<string, {
  raw: string;
  values: readonly DeveloperRuntimeVisualEvidence[];
}>();

function buildVisualEvidenceSampleStorageKey(contextKey: string) {
  return `${VISUAL_EVIDENCE_SAMPLE_STORAGE_PREFIX}:${encodeURIComponent(contextKey)}`;
}

function cacheVisualEvidenceSamples(
  storageKey: string,
  raw: string,
  values: readonly DeveloperRuntimeVisualEvidence[],
) {
  visualEvidenceSampleCache.delete(storageKey);
  visualEvidenceSampleCache.set(storageKey, { raw, values });
  while (visualEvidenceSampleCache.size > VISUAL_EVIDENCE_SAMPLE_CACHE_LIMIT) {
    const oldestKey = visualEvidenceSampleCache.keys().next().value;
    if (typeof oldestKey !== "string") break;
    visualEvidenceSampleCache.delete(oldestKey);
  }
}

function readVisualEvidenceSamples(contextKey: string) {
  if (typeof window === "undefined") return [] as DeveloperRuntimeVisualEvidence[];
  const storageKey = buildVisualEvidenceSampleStorageKey(contextKey);
  let raw = "[]";
  try {
    raw = window.sessionStorage.getItem(storageKey) || "[]";
  } catch {
    return [];
  }
  const cached = visualEvidenceSampleCache.get(storageKey);
  if (cached?.raw === raw) {
    cacheVisualEvidenceSamples(storageKey, raw, cached.values);
    return cached.values;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    const values = Array.isArray(parsed)
      ? parsed.filter(isDeveloperRuntimeVisualEvidenceSample).slice(-VISUAL_EVIDENCE_SAMPLE_LIMIT)
      : [];
    cacheVisualEvidenceSamples(storageKey, raw, values);
    return values;
  } catch {
    cacheVisualEvidenceSamples(storageKey, raw, []);
    return [];
  }
}

function writeVisualEvidenceSamples(contextKey: string, samples: readonly DeveloperRuntimeVisualEvidence[]) {
  if (typeof window === "undefined") return;
  const storageKey = buildVisualEvidenceSampleStorageKey(contextKey);
  const values = samples.length <= VISUAL_EVIDENCE_SAMPLE_LIMIT
    ? samples
    : samples.slice(-VISUAL_EVIDENCE_SAMPLE_LIMIT);
  const raw = JSON.stringify(values);
  try {
    window.sessionStorage.setItem(storageKey, raw);
    cacheVisualEvidenceSamples(storageKey, raw, values);
  } catch {
    // Evidence still works in memory when session storage is unavailable.
  }
}

function getVisualEvidenceViewportBucket(sample: DeveloperRuntimeVisualEvidence) {
  return resolveDeveloperVisualEvidenceViewport(sample)?.id
    ?? `custom:${sample.viewportWidth}x${sample.viewportHeight}`;
}

function getVisualEvidenceSampleBucket(sample: DeveloperRuntimeVisualEvidence) {
  return `${sample.targetIdentityKey}:${getVisualEvidenceViewportBucket(sample)}`;
}

type VisualEvidenceSnapshot = {
  contextKey: string;
  values: readonly DeveloperRuntimeVisualEvidence[];
};

export default function DeveloperVisualEvidenceWorkbench({
  workflowScope,
  workflowPageDna,
  runtimeTargetPageDna,
  workflowTargetManifestFingerprint,
  onWorkflowScopeChange,
  onWorkflowArtifact,
  globalBatchRunning = false,
  globalBatchStatus = null,
  onRunGlobalBatch,
}: {
  workflowScope: DeveloperDesignScope;
  workflowPageDna: DeveloperPageDna;
  runtimeTargetPageDna: DeveloperPageDna;
  workflowTargetManifestFingerprint: string;
  onWorkflowScopeChange: (scope: DeveloperDesignScope) => void;
  onWorkflowArtifact?: (input: UpdateDeveloperWorkflowArtifactInput<"04">) => void;
  globalBatchRunning?: boolean;
  globalBatchStatus?: "pending" | "passed" | "failed" | "blocked" | "stale" | null;
  onRunGlobalBatch?: () => Promise<void>;
}) {
  const designScope = workflowScope;
  const pageDna = workflowPageDna;
  const selectDesignScope = onWorkflowScopeChange;
  const targetManifestFingerprint = workflowTargetManifestFingerprint;
  const evidenceContextKey = `${designScope}:${pageDna.identityKey}:${pageDna.sourceFingerprint}:${targetManifestFingerprint}`;
  const activeEvidenceContextRef = useRef(evidenceContextKey);
  useEffect(() => {
    activeEvidenceContextRef.current = evidenceContextKey;
  }, [evidenceContextKey]);
  const [session, setSession] = useState(() => readDeveloperDesignSession(pageDna));
  const [evidenceSnapshot, setEvidenceSnapshot] = useState<VisualEvidenceSnapshot | null>(null);
  const evidenceSnapshotRef = useRef<VisualEvidenceSnapshot | null>(null);
  const pendingEvidenceWriteRef = useRef<VisualEvidenceSnapshot | null>(null);
  const rawEvidenceSamples = evidenceSnapshot?.contextKey === evidenceContextKey
    ? evidenceSnapshot.values
    : EMPTY_VISUAL_EVIDENCE_SAMPLES;
  const evidenceIndex = useMemo(
    () => buildDeveloperVisualEvidenceSampleIndex(pageDna, rawEvidenceSamples),
    [pageDna, rawEvidenceSamples],
  );
  const evidenceSamples = evidenceIndex.samples;
  const evidence = evidenceIndex.latestByTargetIdentity.get(runtimeTargetPageDna.identityKey) ?? null;
  const [workflowRecord, setWorkflowRecord] = useState<DeveloperVisualEvidenceRecord | null>(null);
  const [pageDnaFingerprint, setPageDnaFingerprint] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const workflowArtifactCallbackRef = useRef(onWorkflowArtifact);
  const hasWorkflowArtifactCallback = Boolean(onWorkflowArtifact);

  useEffect(() => {
    workflowArtifactCallbackRef.current = onWorkflowArtifact;
  }, [onWorkflowArtifact]);
  useEffect(() => {
    if (!evidenceSnapshot || pendingEvidenceWriteRef.current !== evidenceSnapshot) return;
    writeVisualEvidenceSamples(evidenceSnapshot.contextKey, evidenceSnapshot.values);
    pendingEvidenceWriteRef.current = null;
  }, [evidenceSnapshot]);
  const coverage = useMemo(
    () => inspectDeveloperDesignMappingCoverage(session.snapshot),
    [session.snapshot],
  );

  const refreshEvidence = useCallback(() => {
    setWorkflowRecord(null);
    const sample = inspectDeveloperRuntimeVisualEvidence(runtimeTargetPageDna, targetManifestFingerprint);
    const current = evidenceSnapshotRef.current;
    const previous = current?.contextKey === evidenceContextKey
      ? current.values
      : readVisualEvidenceSamples(evidenceContextKey);
    const bucket = getVisualEvidenceSampleBucket(sample);
    const values = [...previous.filter((candidate) => getVisualEvidenceSampleBucket(candidate) !== bucket), sample]
      .sort((left, right) => left.checkedAt.localeCompare(right.checkedAt))
      .slice(-VISUAL_EVIDENCE_SAMPLE_LIMIT);
    const nextSnapshot = { contextKey: evidenceContextKey, values };
    evidenceSnapshotRef.current = nextSnapshot;
    pendingEvidenceWriteRef.current = nextSnapshot;
    setEvidenceSnapshot(nextSnapshot);
  }, [evidenceContextKey, runtimeTargetPageDna, targetManifestFingerprint]);

  useEffect(() => {
    setSession(readDeveloperDesignSession(pageDna));
    const storedSamples = readVisualEvidenceSamples(evidenceContextKey);
    const nextSnapshot = { contextKey: evidenceContextKey, values: storedSamples };
    evidenceSnapshotRef.current = nextSnapshot;
    pendingEvidenceWriteRef.current = null;
    setEvidenceSnapshot(nextSnapshot);
    setWorkflowRecord(null);
    setPageDnaFingerprint("");
    setExportStatus("");
    let innerFrame = 0;
    const outerFrame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(refreshEvidence);
    });
    return () => {
      window.cancelAnimationFrame(outerFrame);
      if (innerFrame) window.cancelAnimationFrame(innerFrame);
    };
  }, [evidenceContextKey, pageDna, refreshEvidence]);

  useEffect(() => {
    let active = true;
    void computeDeveloperPageDnaFingerprint(pageDna)
      .then((fingerprint) => { if (active) setPageDnaFingerprint(fingerprint); })
      .catch(() => { if (active) setPageDnaFingerprint(""); });
    return () => { active = false; };
  }, [pageDna]);

  useEffect(() => {
    const refreshSession = () => setSession(readDeveloperDesignSession(pageDna));
    window.addEventListener(DEVELOPER_DESIGN_SESSION_EVENT, refreshSession);
    return () => window.removeEventListener(DEVELOPER_DESIGN_SESSION_EVENT, refreshSession);
  }, [pageDna]);

  useEffect(() => {
    if (!evidenceSamples.length
      || !hasWorkflowArtifactCallback
      || session.identityKey !== pageDna.identityKey
      || session.scope !== designScope) return;
    let active = true;
    const expectedContextKey = evidenceContextKey;
    void buildDeveloperVisualEvidenceRecord(pageDna, session, evidenceSamples).then((record) => {
      if (!active || activeEvidenceContextRef.current !== expectedContextKey) return;
      setWorkflowRecord(record);
      const statusMessage = record.status === "passed"
        ? "三屏、结构、设计映射、媒体与影响证据均已通过。"
        : record.status === "pending"
          ? "可视化证据尚不完整，等待其余视口或设计 revision。"
          : record.status === "stale"
            ? "可视化证据与当前契约或源码指纹不一致。"
            : "可视化证据包含失败检查。";
      workflowArtifactCallbackRef.current?.({
        status: record.status,
        payload: {
          pageDnaFingerprint: record.pageDnaFingerprint,
          viewportIds: record.viewportResults.map((result) => result.id),
          checkIds: record.checkResults.map((result) => result.id),
          artifactRefs: record.artifactRefs,
          scope: designScope,
          evidenceId: record.evidenceId,
          designRevision: record.designRevision,
          viewportResults: record.viewportResults,
          checkResults: record.checkResults,
          sourceFingerprint: record.sourceFingerprint,
          baseHVersion: record.baseHVersion,
          targetManifestFingerprint,
          targetCoverage: record.targetCoverage,
        },
        artifactRefs: record.artifactRefs,
        message: statusMessage,
        recordedAt: record.capturedAt,
      });
    }).catch((error) => {
      if (!active || activeEvidenceContextRef.current !== expectedContextKey) return;
      setWorkflowRecord(null);
      workflowArtifactCallbackRef.current?.({
        status: "failed",
        payload: {
          pageDnaFingerprint: pageDnaFingerprint || "unavailable",
          viewportIds: DEVELOPER_DESIGN_INTEGRATION_CONTRACT.responsiveViewports.map((viewport) => viewport.id),
          checkIds: [],
          artifactRefs: [],
          scope: designScope,
        },
        artifactRefs: [],
        message: error instanceof Error ? error.message : "无法生成可视化证据记录。",
      });
    });
    return () => { active = false; };
  }, [designScope, evidenceContextKey, evidenceSamples, hasWorkflowArtifactCallback, pageDna, pageDnaFingerprint, session, targetManifestFingerprint]);

  const responsiveStatuses = DEVELOPER_DESIGN_INTEGRATION_CONTRACT.responsiveViewports.map((viewport) => {
    const result = evidenceIndex.viewportResults.find((candidate) => candidate.id === viewport.id);
    return {
      ...viewport,
      sampleCount: result?.sampleCount ?? 0,
      coveredTargetCount: result?.coveredTargetCount ?? 0,
      requiredTargetCount: result?.requiredTargetCount ?? pageDna.targetManifest.targets.length,
    };
  });
  const { coveredTargetCount, completeTargetCount } = evidenceIndex.targetCoverage;
  const regionCoverage = evidence?.requiredRegionCount
    ? Math.round((evidence.visibleRegionCount / evidence.requiredRegionCount) * 100)
    : 0;

  const exportEvidence = useCallback(async () => {
    if (!evidence) return;
    try {
      const expectedContextKey = evidenceContextKey;
      const currentRecord = workflowRecord?.identityKey === pageDna.identityKey
        && workflowRecord.scope === designScope
        && workflowRecord.capturedAt === evidenceSamples.at(-1)?.checkedAt
        ? workflowRecord
        : null;
      const record = currentRecord ?? await buildDeveloperVisualEvidenceRecord(pageDna, session, evidenceSamples);
      if (activeEvidenceContextRef.current !== expectedContextKey) return;
      const blob = new Blob([`${JSON.stringify(record, null, 2)}\n`], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "design-visual-evidence.json";
      anchor.click();
      URL.revokeObjectURL(url);
      setExportStatus(`已导出 · ${record.status}`);
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "证据导出失败");
    }
  }, [designScope, evidence, evidenceContextKey, evidenceSamples, pageDna, session, workflowRecord]);

  return (
    <section
      data-developer-visual-evidence-workbench
      data-developer-workflow-scope={designScope}
      data-visual-evidence-sample-count={evidenceSamples.length}
      data-visual-evidence-covered-targets={`${coveredTargetCount}/${pageDna.targetManifest.targets.length}`}
      data-visual-evidence-complete-targets={`${completeTargetCount}/${pageDna.targetManifest.targets.length}`}
      data-visual-evidence-contract-version={DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version}
      data-page-dna-fingerprint={pageDnaFingerprint || "pending"}
      data-visual-evidence-library="native-dom-css-only"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden p-4"
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-current/15 pb-3">
        <div>
          <div className="flex items-center gap-2"><Eye className="size-4" /><strong className="text-sm">可视化证据中心</strong><Badge variant="outline">{designScope === "global" ? "全局覆盖聚合" : "只读实页"}</Badge></div>
          <p className="mt-1 text-[11px] leading-5 opacity-70">{designScope === "global" ? `当前页仅作为代表样本；手工路径需 ${pageDna.targetManifest.targets.length} 个登记目标分别完成三视口，也可运行受控全局批检，用全目标构建清单与三端运行矩阵生成证据。` : "同一份页面 DNA 汇总结构、Figma 映射、响应式、加载、媒体与影响证据；不在业务首屏加载图表库。"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div data-visual-evidence-scope className="flex items-center gap-1 rounded-md border border-current/20 p-1">
            {(["page", "global"] as const).map((scope) => <Button key={scope} data-developer-workflow-scope-option={scope} type="button" size="sm" variant={designScope === scope ? "default" : "ghost"} aria-pressed={designScope === scope} className="h-7 px-2 text-[11px]" onClick={() => selectDesignScope(scope)}>{scope === "page" ? "当前页面" : "全局"}</Button>)}
          </div>
          {designScope === "global" && onRunGlobalBatch ? <Button data-global-visual-performance-batch type="button" size="sm" className="h-8" disabled={globalBatchRunning} onClick={() => void onRunGlobalBatch()}>{globalBatchRunning ? "全局批检中…" : "全局批检 04–05"}</Button> : null}
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={refreshEvidence}><RefreshCw className="mr-1.5 size-3.5" />采集当前视口</Button>
          <Button type="button" size="sm" variant="outline" className="h-8" disabled={!evidence} onClick={() => void exportEvidence()}><Download className="mr-1.5 size-3.5" />导出证据 JSON</Button>
          {exportStatus ? <span role="status" className="text-[10px] opacity-65">{exportStatus}</span> : null}
          {designScope === "global" && globalBatchStatus ? <Badge data-global-batch-status={globalBatchStatus} variant="outline">批检 {globalBatchStatus === "passed" ? "通过" : globalBatchStatus === "blocked" ? "阻断" : "待完成"}</Badge> : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pt-3">
        <div data-visual-evidence-summary className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "页面 DNA", value: designScope === "global" ? `${pageDna.targetManifest.targets.length} 个登记目标` : pageDna.pageFactoryId || "未登记", ok: designScope === "global" ? pageDna.targetManifest.targets.length > 0 : Boolean(pageDna.pageFactoryId) },
            { label: "共享区域", value: evidence ? `${evidence.visibleRegionCount}/${evidence.requiredRegionCount} · ${regionCoverage}%` : "检测中", ok: Boolean(evidence && !evidence.missingRegions.length) },
            { label: "Figma 映射", value: coverage.percent === null ? "待设计快照" : `${coverage.percent}%`, ok: coverage.status === "mapped" },
            { label: "页面横向溢出", value: evidence ? (evidence.documentOverflow ? "发现溢出" : "未发现") : "检测中", ok: Boolean(evidence && !evidence.documentOverflow) },
            { label: "影响范围", value: designScope === "global" ? `${completeTargetCount}/${pageDna.impactTargetCount} 个页面三屏完成` : `${pageDna.impactTargetCount} 个页面`, ok: designScope === "global" ? completeTargetCount === pageDna.impactTargetCount && pageDna.impactTargetCount > 0 : pageDna.impactTargetCount > 0 },
          ].map((metric) => <div key={metric.label} className={`min-w-0 rounded-lg border p-3 ${metricTone(metric.ok)}`}><div className="text-[10px] opacity-60">{metric.label}</div><div className="mt-1 truncate text-xs font-semibold" title={metric.value}>{metric.value}</div></div>)}
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          <section data-visual-structure-map className="rounded-lg border border-current/15 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold"><Boxes className="size-3.5" />结构与影响地图</div>
            <dl className="mt-3 grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-[10px]"><dt className="opacity-60">流程身份</dt><dd className="break-all font-mono">{pageDna.identityKey}</dd><dt className="opacity-60">当前采样目标</dt><dd className="break-all font-mono">{runtimeTargetPageDna.identityKey}</dd><dt className="opacity-60">目标清单指纹</dt><dd className="break-all font-mono" title={targetManifestFingerprint}>{targetManifestFingerprint.slice(0, 20)}</dd><dt className="opacity-60">DNA 指纹</dt><dd className="break-all font-mono" title={pageDnaFingerprint}>{pageDnaFingerprint ? pageDnaFingerprint.slice(0, 20) : "计算中"}</dd><dt className="opacity-60">封存基线</dt><dd>{pageDna.baseHVersion} · {pageDna.sourceFingerprint.slice(0, 12)}</dd><dt className="opacity-60">页面组件</dt><dd className="break-all">{runtimeTargetPageDna.component || "—"}</dd><dt className="opacity-60">入口组件</dt><dd className="break-all">{runtimeTargetPageDna.entryComponent || "—"}</dd><dt className="opacity-60">适配策略</dt><dd>{runtimeTargetPageDna.adapterStrategy} · {runtimeTargetPageDna.adapterId || "—"}</dd><dt className="opacity-60">跨端治理</dt><dd>{pageDna.governanceScopes.join("、") || "—"}</dd><dt className="opacity-60">能力</dt><dd>{pageDna.capabilities.join("、") || "—"}</dd></dl>
            {evidence?.missingRegions.length ? <div className="mt-3 rounded-md border border-amber-300/50 bg-amber-500/5 p-2 text-[10px] leading-5"><b>当前未找到可见共享区域：</b>{evidence.missingRegions.join("、")}</div> : <div className="mt-3 rounded-md border border-emerald-300/50 bg-emerald-500/5 p-2 text-[10px]">已解析当前页面登记的可见共享区域。</div>}
          </section>

          <section data-visual-figma-runtime-diff className="rounded-lg border border-current/15 p-3">
            <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-xs font-semibold"><Eye className="size-3.5" />Figma ↔ 实页语义差异</div><Badge variant="outline">{session.figma ? `revision ${session.figma.revision || "未固定"}` : "未连接"}</Badge></div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]"><div className="rounded border border-current/10 p-2"><b className="block text-base">{coverage.mapped.length}</b>已映射</div><div className="rounded border border-current/10 p-2"><b className="block text-base">{coverage.missing.length}</b>设计缺失</div><div className="rounded border border-current/10 p-2"><b className="block text-base">{coverage.unmapped.length}</b>契约未登记</div></div>
            <div className="mt-3 space-y-2 text-[10px]"><div><b>缺失：</b><span className="opacity-70">{coverage.missing.join("、") || "无"}</span></div><div><b>未映射：</b><span className="opacity-70">{coverage.unmapped.join("、") || "无"}</span></div><div><b>动态遮罩：</b><span className="opacity-70">业务文本和实时数据不做严格像素比较；共享结构、几何、溢出和状态语义必须一致。</span></div></div>
          </section>
        </div>

        <section data-visual-responsive-matrix className="mt-3 rounded-lg border border-current/15 p-3">
          <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-xs font-semibold"><MonitorSmartphone className="size-3.5" />三屏响应式矩阵</div><Badge variant="outline">{completeTargetCount}/{pageDna.targetManifest.targets.length} 目标完成</Badge></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">{responsiveStatuses.map((viewport) => { const complete = viewport.requiredTargetCount > 0 && viewport.coveredTargetCount === viewport.requiredTargetCount; return <div key={viewport.id} className={`rounded-md border p-3 ${complete ? "border-blue-400/60 bg-blue-500/5" : "border-current/15"}`}><div className="flex items-center justify-between gap-2 text-xs font-semibold"><span>{viewport.label}</span><Badge variant="outline">{viewport.width}×{viewport.height}</Badge></div><p className="mt-2 text-[10px] opacity-65">{viewport.coveredTargetCount}/{viewport.requiredTargetCount} 个目标已采样 · {viewport.sampleCount} 个绑定样本；未全覆盖时门禁保持关闭</p></div>; })}</div>
        </section>

        <div className="mt-3 grid gap-3 xl:grid-cols-3">
          <section data-visual-loading-evidence className="rounded-lg border border-current/15 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold"><Activity className="size-3.5" />加载证据</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded border border-current/10 p-2"><b className="block text-base">{evidence?.resourceCount ?? "—"}</b>当前资源记录</div><div className="rounded border border-current/10 p-2"><b className="block text-base">{evidence?.longTaskCount ?? "—"}</b>长任务记录</div></div>
            <p className="mt-3 text-[10px] leading-5 opacity-65">详细瀑布、包体与安全优化继续由“05 优化加载体验”负责；这里仅汇总可视化证据。</p>
          </section>

          <section data-visual-media-map className="rounded-lg border border-current/15 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold"><ImageIcon className="size-3.5" />媒体地图</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded border border-current/10 p-2"><b className="block text-base">{evidence?.imageCount ?? "—"}</b>图片 · lazy {evidence?.lazyImageCount ?? "—"}</div><div className="rounded border border-current/10 p-2"><b className="block text-base">{evidence?.videoCount ?? "—"}</b>视频 · poster {evidence?.posterVideoCount ?? "—"}</div></div>
            <p className="mt-3 text-[10px] opacity-65">图片 async {evidence?.asyncImageCount ?? "—"}；视频 metadata {evidence?.metadataVideoCount ?? "—"}。</p>
          </section>

          <section data-visual-complexity-budgets className="rounded-lg border border-current/15 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold"><Network className="size-3.5" />设计复杂度预算</div>
            <div className="mt-2 space-y-1">{DEVELOPER_DESIGN_INTEGRATION_CONTRACT.designComplexityBudgets.map((budget) => <div key={budget.id} className="flex items-center justify-between gap-3 border-b border-current/10 py-1.5 text-[10px]"><span>{budget.label}</span><b>≤ {budget.limit}</b></div>)}</div>
          </section>
        </div>
      </div>
    </section>
  );
}
