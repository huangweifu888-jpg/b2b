import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { DeveloperPageDna } from "@/lib/developer-design-integration";
import { SHARED_OPTIMIZATION_CONTRACT } from "@/lib/developer-optimization-contract";
import { MEDIA_OPTIMIZATION_CONTRACT, MEDIA_TRANSFER_BUDGETS } from "@/lib/media-optimization-contract";
import {
  inspectMaterialAssetOptimization,
  runMaterialAssetOptimization,
  type MaterialAssetOptimizationReport,
} from "@/lib/material-assets";
import type { PerformanceExperienceScope } from "@/lib/performance-experience-learning";
import {
  inspectLocalRuntimeReadiness,
  inspectGlobalSharedContractHealth,
  inspectSharedContractHealth,
  type SharedContractHealthCheck,
  type SharedContractTargetCoverage,
} from "@/lib/shared-contract-health";
import type {
  DeveloperWorkflowScope,
  UpdateDeveloperWorkflowArtifactInput,
} from "@/lib/developer-workflow-run";

const SHARED_GOVERNANCE_BUDGETS = Object.freeze([
  ...SHARED_OPTIMIZATION_CONTRACT.budgets.map((budget) => Object.freeze({
    ...budget,
    owner: "developer-optimization-contract" as const,
  })),
  ...MEDIA_TRANSFER_BUDGETS,
]);

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

export default function DeveloperSharedContractWorkbench({
  pathname,
  search,
  scope,
  workflowScope = "page",
  workflowPageDna,
  workflowScopeIdentity,
  workflowTargetManifestFingerprint,
  onWorkflowArtifact,
}: {
  pathname: string;
  search: string;
  scope: PerformanceExperienceScope;
  workflowScope?: DeveloperWorkflowScope;
  workflowPageDna: DeveloperPageDna;
  workflowScopeIdentity: string;
  workflowTargetManifestFingerprint: string;
  onWorkflowArtifact?: (input: UpdateDeveloperWorkflowArtifactInput<"02">) => void;
}) {
  const [checks, setChecks] = useState<readonly SharedContractHealthCheck[]>([]);
  const [targetCoverage, setTargetCoverage] = useState<SharedContractTargetCoverage | null>(null);
  const [checking, setChecking] = useState(false);
  const [mediaReport, setMediaReport] = useState<MaterialAssetOptimizationReport | null>(null);
  const [mediaChecking, setMediaChecking] = useState(false);
  const [mediaApplying, setMediaApplying] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const requestSequenceRef = useRef(0);
  const mediaRequestSequenceRef = useRef(0);
  const inspectionContextKey = JSON.stringify([
    workflowScope,
    workflowScopeIdentity,
    workflowPageDna.sourceFingerprint,
    workflowTargetManifestFingerprint,
    scope,
    pathname,
    search,
  ]);
  const inspectionContextRef = useRef(inspectionContextKey);

  useLayoutEffect(() => {
    inspectionContextRef.current = inspectionContextKey;
    requestSequenceRef.current += 1;
    setChecks([]);
    setTargetCoverage(null);
    setChecking(false);
    mediaRequestSequenceRef.current += 1;
    setMediaReport(null);
    setMediaChecking(false);
    setMediaApplying(false);
    setMediaError("");
  }, [inspectionContextKey]);

  const inspect = useCallback(async () => {
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    const expectedContextKey = inspectionContextKey;
    setChecking(true);
    try {
      const contractReport = workflowScope === "global"
        ? inspectGlobalSharedContractHealth(workflowPageDna)
        : inspectSharedContractHealth({ pathname, search });
      const runtimeCheck = await inspectLocalRuntimeReadiness();
      if (
        requestSequenceRef.current !== requestId
        || inspectionContextRef.current !== expectedContextKey
      ) return;
      const nextChecks = [runtimeCheck, ...contractReport.checks.filter((check) => check.id !== runtimeCheck.id)];
      const passed = nextChecks.every((check) => check.status === "passed");
      setChecks(nextChecks);
      setTargetCoverage(contractReport.targetCoverage ?? null);
      onWorkflowArtifact?.({
        status: passed ? "passed" : "failed",
        payload: {
          contractVersions: {
            optimization: SHARED_OPTIMIZATION_CONTRACT.version,
            media: MEDIA_OPTIMIZATION_CONTRACT.version,
          },
          inheritedFrom: workflowScope === "page" ? "global-shared-contract" : null,
          overrideKeys: [],
          checkIds: nextChecks.map((check) => check.id),
          ...(contractReport.targetCoverage ? { targetCoverage: contractReport.targetCoverage } : {}),
        },
        message: passed
          ? workflowScope === "global"
            ? `全局共享契约覆盖 ${contractReport.targetCoverage?.totalTargets ?? 0} 个唯一、已登记且可解析目标。`
            : "共享契约与本地运行环境检查通过。"
          : `${nextChecks.filter((check) => check.status === "issue").length} 项共享契约检查需要处理。`,
      });
    } catch (reason) {
      if (
        requestSequenceRef.current !== requestId
        || inspectionContextRef.current !== expectedContextKey
      ) return;
      const detail = reason instanceof Error ? reason.message : String(reason);
      setChecks([{
        id: "contract-inspection-error",
        label: "契约检查异常",
        detail,
        status: "issue",
      }]);
      setTargetCoverage(null);
      onWorkflowArtifact?.({
        status: "failed",
        payload: {
          contractVersions: {
            optimization: SHARED_OPTIMIZATION_CONTRACT.version,
            media: MEDIA_OPTIMIZATION_CONTRACT.version,
          },
          inheritedFrom: workflowScope === "page" ? "global-shared-contract" : null,
          overrideKeys: [],
          checkIds: ["contract-inspection-error"],
        },
        message: detail,
      });
    } finally {
      if (
        requestSequenceRef.current === requestId
        && inspectionContextRef.current === expectedContextKey
      ) setChecking(false);
    }
  }, [inspectionContextKey, onWorkflowArtifact, pathname, search, workflowPageDna, workflowScope]);

  useEffect(() => {
    void inspect();
    return () => {
      requestSequenceRef.current += 1;
    };
  }, [inspect]);

  const refreshMediaReport = useCallback(async () => {
    if (workflowScope !== "global") {
      setMediaReport(null);
      setMediaError("");
      return;
    }
    const requestId = mediaRequestSequenceRef.current + 1;
    mediaRequestSequenceRef.current = requestId;
    const expectedContextKey = inspectionContextKey;
    setMediaChecking(true);
    setMediaError("");
    try {
      const report = await inspectMaterialAssetOptimization();
      if (
        mediaRequestSequenceRef.current !== requestId
        || inspectionContextRef.current !== expectedContextKey
      ) return;
      setMediaReport(report);
    } catch (reason) {
      if (
        mediaRequestSequenceRef.current !== requestId
        || inspectionContextRef.current !== expectedContextKey
      ) return;
      setMediaError(reason instanceof Error ? reason.message : String(reason));
      setMediaReport(null);
    } finally {
      if (
        mediaRequestSequenceRef.current === requestId
        && inspectionContextRef.current === expectedContextKey
      ) setMediaChecking(false);
    }
  }, [inspectionContextKey, workflowScope]);

  useEffect(() => {
    void refreshMediaReport();
    return () => {
      mediaRequestSequenceRef.current += 1;
    };
  }, [refreshMediaReport]);

  const applySafeMediaOptimization = useCallback(async () => {
    if (workflowScope !== "global") return;
    const requestId = mediaRequestSequenceRef.current + 1;
    mediaRequestSequenceRef.current = requestId;
    const expectedContextKey = inspectionContextKey;
    setMediaApplying(true);
    setMediaError("");
    try {
      const report = await runMaterialAssetOptimization({
        dryRun: false,
        safeTestAssetsOnly: true,
      });
      if (
        mediaRequestSequenceRef.current !== requestId
        || inspectionContextRef.current !== expectedContextKey
      ) return;
      setMediaReport(report);
    } catch (reason) {
      if (
        mediaRequestSequenceRef.current !== requestId
        || inspectionContextRef.current !== expectedContextKey
      ) return;
      setMediaError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (
        mediaRequestSequenceRef.current === requestId
        && inspectionContextRef.current === expectedContextKey
      ) setMediaApplying(false);
    }
  }, [inspectionContextKey, workflowScope]);

  const issueCount = checks.filter((check) => check.status === "issue").length;

  return (
    <section
      data-developer-shared-contract-workbench
      data-developer-workflow-scope={workflowScope}
      data-shared-optimization-contract={SHARED_OPTIMIZATION_CONTRACT.version}
      data-media-optimization-contract={MEDIA_OPTIMIZATION_CONTRACT.version}
      className="h-full min-h-0 w-full overflow-y-auto p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">统一优化契约</h3>
          <p className="mt-1 text-xs opacity-70">
            全局框架、三个来源端和普通页面共用同一份加载预算与回归规则；页面只提供身份和证据。
          </p>
        </div>
        <div className="flex items-center gap-2 text-right text-[11px]">
          <div className="opacity-65">
            <div>优化 {SHARED_OPTIMIZATION_CONTRACT.version} · 媒体 {MEDIA_OPTIMIZATION_CONTRACT.version}</div>
            <div>{workflowScope === "global" ? `全局 · ${targetCoverage?.totalTargets ?? 0} 个登记目标` : `当前页面 · ${scope} · ${pathname}`}</div>
          </div>
          <Button size="sm" variant="outline" className="h-8" disabled={checking} onClick={() => void inspect()}>
            {checking ? "检查中…" : "重新检查"}
          </Button>
        </div>
      </div>

      <section className="mt-4" data-shared-contract-health-report data-shared-contract-issue-count={issueCount}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{workflowScope === "global" ? "全局目标契约健康" : "当前页面契约健康"}</h3>
          <span className="text-[10px] opacity-65">{checks.length ? `${checks.length - issueCount}/${checks.length} 通过` : "等待检查"}</span>
        </div>
        {workflowScope === "global" && targetCoverage ? (
          <div
            data-shared-contract-global-target-coverage={`${targetCoverage.registeredTargets}/${targetCoverage.totalTargets}`}
            data-target-manifest-fingerprint={targetCoverage.targetManifestFingerprint}
            className="mt-2 grid gap-2 rounded-md border border-current/15 p-2 text-[10px] sm:grid-cols-4"
          >
            <span><b className="block text-xs">{targetCoverage.uniqueTargets}/{targetCoverage.totalTargets}</b>身份唯一</span>
            <span><b className="block text-xs">{targetCoverage.registeredTargets}/{targetCoverage.totalTargets}</b>页面已登记</span>
            <span><b className="block text-xs">{targetCoverage.resolvableTargets}/{targetCoverage.totalTargets}</b>框架可解析</span>
            <span><b className="block text-xs">{targetCoverage.sourceEntryTargets}/{targetCoverage.totalTargets}</b>源码入口完整</span>
          </div>
        ) : null}
        <div className="mt-2 grid gap-x-4 lg:grid-cols-2">
          {checks.map((check) => (
            <article key={check.id} data-shared-contract-health-check={check.id} data-status={check.status} className="border-b border-current/10 py-2">
              <div className="flex items-center justify-between gap-2 text-[11px]"><strong>{check.label}</strong><span className={check.status === "passed" ? "opacity-60" : "font-semibold text-destructive"}>{check.status === "passed" ? "通过" : "需处理"}</span></div>
              <p className="mt-1 text-[10px] leading-4 opacity-70">{check.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {SHARED_OPTIMIZATION_CONTRACT.principles.map((principle) => (
          <article key={principle.id} data-shared-optimization-principle={principle.id} className="border-b border-current/15 pb-3">
            <strong className="text-xs">{principle.label}</strong>
            <p className="mt-1 text-[11px] leading-5 opacity-75">{principle.rule}</p>
          </article>
        ))}
      </div>

      <section
        className="mt-5"
        data-shared-media-resource-contract={MEDIA_OPTIMIZATION_CONTRACT.version}
        data-media-original-retention={MEDIA_OPTIMIZATION_CONTRACT.storageLifecycle.originalRetention}
        data-media-deduplicate-by={MEDIA_OPTIMIZATION_CONTRACT.storageLifecycle.deduplicateBy}
        data-media-avatar-first-paint={MEDIA_OPTIMIZATION_CONTRACT.delivery.avatarFirstPaint.id}
        data-media-avatar-never-empty={String(MEDIA_OPTIMIZATION_CONTRACT.delivery.avatarFirstPaint.neverEmpty)}
        data-media-avatar-saved-image-activation={MEDIA_OPTIMIZATION_CONTRACT.delivery.avatarFirstPaint.savedImageActivation}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">共享媒体资源优化契约</h3>
            <p className="mt-1 text-[11px] leading-5 opacity-70">
              上传原件只作临时输入；优化结果验证成功后仅保存一份正式文件。当前页只继承，全局负责检查与安全测试。
            </p>
          </div>
          <span className="text-[10px] opacity-60">v{MEDIA_OPTIMIZATION_CONTRACT.version}</span>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="border-b border-current/15 pb-2 text-[11px]">
            <strong>原文件生命周期</strong>
            <p className="mt-1 leading-5 opacity-70">仅临时保留；校验成功自动删除，失败继续使用当前版本。</p>
          </article>
          <article className="border-b border-current/15 pb-2 text-[11px]">
            <strong>图片</strong>
            <p className="mt-1 leading-5 opacity-70">PNG/JPEG 自动转 WebP（质量 {Math.round(MEDIA_OPTIMIZATION_CONTRACT.optimization.image.quality * 100)}）；至少节省 {Math.round(MEDIA_OPTIMIZATION_CONTRACT.storageLifecycle.minimumSavingsRatio * 100)}% 才替换。</p>
          </article>
          <article className="border-b border-current/15 pb-2 text-[11px]">
            <strong>视频</strong>
            <p className="mt-1 leading-5 opacity-70">仅接收 MP4/WebM 规范文件；浏览器不执行不可靠转码，服务端转码器就绪后再自动处理。</p>
          </article>
          <article className="border-b border-current/15 pb-2 text-[11px]">
            <strong>动态与结构素材</strong>
            <p className="mt-1 leading-5 opacity-70">{MEDIA_OPTIMIZATION_CONTRACT.optimization.structuredMedia.examples.join("、")} 保持结构，不转成重复位图或视频。</p>
          </article>
        </div>

        <div className="mt-3 grid gap-2 rounded-md border border-current/15 p-3 text-[10px] sm:grid-cols-4">
          <span><b className="block text-xs">SHA-256</b>相同内容只存一份</span>
          <span><b className="block text-xs">可重建缓存</b>缩略图和派生尺寸可清理</span>
          <span><b className="block text-xs">显式保留</b>工程源文件必须单独授权</span>
          <span><b className="block text-xs">解码后替换</b>专家头像始终保留本地首屏兜底</span>
        </div>

        {workflowScope === "global" ? (
          <div className="mt-3" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[10px] opacity-70">
                {mediaChecking
                  ? "正在检查本地素材库…"
                  : mediaReport
                    ? `${mediaReport.summary.compliantCount}/${mediaReport.summary.assetCount} 已符合；${mediaReport.summary.candidateCount} 个可安全优化；预计节省 ${formatBytes(mediaReport.summary.potentialSavedBytes)}`
                    : "等待素材库检查"}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" className="h-8" disabled={mediaChecking || mediaApplying} onClick={() => void refreshMediaReport()}>
                  {mediaChecking ? "检查中…" : "检查素材库"}
                </Button>
                <Button size="sm" className="h-8" disabled={mediaChecking || mediaApplying} onClick={() => void applySafeMediaOptimization()}>
                  {mediaApplying ? "正在安全优化…" : "优化内置测试素材"}
                </Button>
              </div>
            </div>
            {mediaError ? <p className="mt-2 text-[10px] font-medium text-destructive">素材检查失败：{mediaError}</p> : null}
            {mediaReport?.run && !mediaReport.run.dryRun ? (
              <p className="mt-2 text-[10px] font-medium">
                本次完成 {mediaReport.run.optimizedCount} 个，去重复用 {mediaReport.run.deduplicatedCount} 个，实际节省 {formatBytes(mediaReport.run.savedBytes)}；原文件未进入永久资源库。
              </p>
            ) : null}
            {mediaReport?.items.length ? (
              <div className="mt-2 grid gap-x-4 lg:grid-cols-2" data-media-optimization-material-report>
                {mediaReport.items.slice(0, 8).map((item) => (
                  <article key={item.assetId} className="border-b border-current/10 py-2 text-[10px]">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate" title={item.fileName}>{item.fileName}</span>
                      <strong>{item.status === "candidate" ? `可节省 ${formatBytes(item.spaceSavedBytes)}` : item.status === "compliant" ? "符合" : "需处理"}</strong>
                    </div>
                    <p className="mt-1 opacity-65">{formatBytes(item.sizeBytes)} → {formatBytes(item.optimizedSizeBytes)} · {item.optimizationStatus}</p>
                    {item.error ? <p className="mt-1 text-destructive">{item.error}</p> : null}
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-[10px] opacity-70">当前页面继承全局媒体契约，不保存页面级格式副本；切换到“全局”可检查素材库和运行内置素材测试。</p>
        )}
      </section>

      <section className="mt-5" data-shared-performance-budgets>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">共享性能预算</h3>
          <span className="text-[10px] opacity-60">警戒值用于提示，上限用于 PR 门禁</span>
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-[11px]">
            <thead className="border-b border-current/20 opacity-70">
              <tr><th className="py-2 pr-3">指标</th><th className="py-2 pr-3">单位</th><th className="py-2 pr-3">警戒</th><th className="py-2 pr-3">上限</th><th className="py-2">统一处理位置</th></tr>
            </thead>
            <tbody>
              {SHARED_GOVERNANCE_BUDGETS.map((budget) => (
                <tr key={budget.id} data-shared-performance-budget={budget.id} data-shared-performance-budget-owner={budget.owner} className="border-b border-current/10">
                  <td className="py-2 pr-3 font-medium">{budget.label}</td>
                  <td className="py-2 pr-3 opacity-65">{budget.unit}</td>
                  <td className="py-2 pr-3">{budget.warning}</td>
                  <td className="py-2 pr-3 font-semibold">{budget.limit}</td>
                  <td className="py-2 opacity-70">{budget.owner === "media-optimization-contract" ? "媒体契约、上传预检与交付策略" : "共享组件、路由边界或构建配置"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-5" data-shared-quality-gates>
        <h3 className="text-sm font-semibold">统一门禁顺序</h3>
        <ol className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {SHARED_OPTIMIZATION_CONTRACT.gates.map((gate, index) => (
            <li key={gate} className="flex items-center gap-2 border-b border-current/10 py-2 text-[11px]">
              <span className="font-semibold opacity-55">{String(index + 1).padStart(2, "0")}</span>
              <span>{gate}</span>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
