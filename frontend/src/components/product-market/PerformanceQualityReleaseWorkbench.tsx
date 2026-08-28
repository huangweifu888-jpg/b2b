import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  SHARED_OPTIMIZATION_CONTRACT,
  type OptimizationAuditScope,
} from "@/lib/developer-optimization-contract";
import {
  evaluateGlobalReleaseBundleGate,
  listPerformanceAuditPages,
  resolvePerformanceAuditRoute,
  resolvePerformanceAuditSourceScope,
  runPerformanceCodeAudit,
  type GlobalReleaseBundleGate,
  type PerformanceAuditPage,
  type PerformanceCodeAuditReport,
} from "@/lib/performance-code-audit";
import {
  validateDeveloperPrEvidence,
  verifyDeveloperPrEvidenceWithGithub,
  type DeveloperPrEvidence,
  type DeveloperPrEvidenceContext,
} from "@/lib/developer-pr-evidence";
import type { PerformanceExperienceScope } from "@/lib/performance-experience-learning";
import type { UpdateDeveloperWorkflowArtifactInput } from "@/lib/developer-workflow-run";
import { MEDIA_OPTIMIZATION_CONTRACT } from "@/lib/media-optimization-contract";
import { RESPONSIVE_SHELL_FACTORY_DEFAULT } from "@/lib/responsive-shell-contract";

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function statusLabel(status: string) {
  if (status === "passed") return "通过";
  if (status === "timed_out") return "超时";
  if (status === "unavailable") return "不可用";
  return "发现问题";
}

const QUALITY_GATE_LABELS: Record<string, string> = {
  "source-lock": "源码锁",
  eslint: "ESLint",
  typescript: "TypeScript",
  knip: "Knip 废代码",
  "bundle-budget": "构建包预算",
  "media-policy": "媒体上传与交付",
  responsive: "大小屏响应式",
  "shared-contract": "共享契约",
  "page-factory": "页面工厂",
  "github-pr": "GitHub PR 审查",
};

const QUALITY_GATE_COMMANDS: Record<string, readonly string[]> = {
  "source-lock": ["source-lock"],
  eslint: ["eslint-page", "eslint-global"],
  typescript: ["typescript"],
  knip: ["knip-production"],
  "bundle-budget": ["bundle-budget"],
  "media-policy": ["media-policy"],
  responsive: ["responsive-runtime-matrix", "responsive-contract"],
  "shared-contract": ["shared-contract"],
  "page-factory": ["page-factory"],
};

const EMPTY_WORKFLOW_TARGET_IDS: readonly string[] = [];

type GlobalReleaseBundleExpectation = {
  targetManifestFingerprint: string;
  targetIds: readonly string[];
  stage05BundleFingerprint: string;
};

const DEPENDENCY_CLASSIFICATION_LABELS: Record<string, string> = {
  closure: "闭包",
  entry: "入口",
  lazy: "懒加载",
  shared: "共享",
};

const DEPENDENCY_ENTRY_ROLE_LABELS: Record<string, string> = {
  component: "页面实现",
  entryComponent: "路由入口",
  target: "指定入口",
};

type PageClosureEvidence = {
  fingerprint: string;
  coverage: {
    status: "complete" | "truncated" | "unresolved" | "incomplete";
    complete: boolean;
    closureFiles: number;
    evidenceFiles: number;
    reportedSourceFiles: number;
    edges: number;
    entries: number;
    lazyFiles: number;
    sharedFiles: number;
    unresolved: number;
    limit: number;
    truncated: boolean;
  };
};

function fingerprintPageClosure(value: string) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64-${hash.toString(16).padStart(16, "0")}`;
}

function compareStableText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function buildPageClosureEvidence(report: PerformanceCodeAuditReport | null): PageClosureEvidence | null {
  if (!report || report.scope !== "page" || !report.dependencyClosure) return null;
  const closure = report.dependencyClosure;
  const sourceMetrics = new Map(report.files.map((file) => [file.path, {
    sizeBytes: file.sizeBytes,
    gzipBytes: file.gzipBytes,
    lineCount: file.lineCount,
    importCount: file.importCount,
    lazyBoundaryCount: file.lazyBoundaryCount,
  }]));
  const canonicalEvidence = {
    schemaVersion: 1,
    targetPath: report.targetPath,
    mode: closure.mode,
    limit: closure.limit,
    truncated: closure.truncated,
    fileCount: closure.fileCount,
    edgeCount: closure.edgeCount,
    entries: [...closure.entries]
      .map((entry) => ({ path: entry.path, roles: [...entry.roles].sort() }))
      .sort((left, right) => compareStableText(left.path, right.path)),
    files: [...closure.files]
      .map((file) => ({
        path: file.path,
        classifications: [...file.classifications].sort(),
        entryRoles: [...file.entryRoles].sort(),
        imports: [...file.imports]
          .map((entry) => ({ path: entry.path, kind: entry.kind }))
          .sort((left, right) => compareStableText(`${left.path}:${left.kind}`, `${right.path}:${right.kind}`)),
        metrics: sourceMetrics.get(file.path) ?? null,
      }))
      .sort((left, right) => compareStableText(left.path, right.path)),
    unresolved: [...closure.unresolved]
      .map((item) => ({ importer: item.importer, reference: item.reference, reason: item.reason }))
      .sort((left, right) => compareStableText(`${left.importer}:${left.reference}:${left.reason}`, `${right.importer}:${right.reference}:${right.reason}`)),
  };
  const evidenceFiles = closure.files.length;
  const complete = !closure.truncated
    && closure.unresolved.length === 0
    && evidenceFiles === closure.fileCount
    && report.summary.sourceFiles === closure.fileCount;
  const status: PageClosureEvidence["coverage"]["status"] = closure.truncated
    ? "truncated"
    : closure.unresolved.length
      ? "unresolved"
      : complete
        ? "complete"
        : "incomplete";
  return {
    fingerprint: fingerprintPageClosure(JSON.stringify(canonicalEvidence)),
    coverage: {
      status,
      complete,
      closureFiles: closure.fileCount,
      evidenceFiles,
      reportedSourceFiles: report.summary.sourceFiles,
      edges: closure.edgeCount,
      entries: closure.entryCount,
      lazyFiles: closure.lazyFileCount,
      sharedFiles: closure.sharedFileCount,
      unresolved: closure.unresolved.length,
      limit: closure.limit,
      truncated: closure.truncated,
    },
  };
}

function qualityGateState(
  gate: string,
  report: PerformanceCodeAuditReport | null,
  prEvidence: DeveloperPrEvidence | null = null,
  globalBundleGate: GlobalReleaseBundleGate | null = null,
) {
  if (gate === "github-pr") {
    return prEvidence
      ? ({ status: "passed", label: `${prEvidence.checks.length} 项检查通过` } as const)
      : ({ status: "external", label: "待 PR" } as const);
  }
  if (!report) return { status: "pending", label: "待执行" } as const;
  if (gate === "bundle-budget" && globalBundleGate && !globalBundleGate.complete) {
    return { status: "issue", label: "全局证据不完整" } as const;
  }
  if (gate === "media-policy" && report.summary.mediaIssueCount > 0) {
    return { status: "issue", label: `${report.summary.mediaIssueCount} 项素材问题` } as const;
  }
  if (gate === "bundle-budget" && report.bundleBudgetReport?.status === "failed") {
    return { status: "issue", label: `${report.bundleBudgetReport.violations.length} 项超限` } as const;
  }
  const ids = QUALITY_GATE_COMMANDS[gate] || [];
  const commands = report.commands.filter((item) => ids.includes(item.id));
  if (!commands.length) return { status: "not-run", label: "本范围未运行" } as const;
  const failed = commands.find((command) => command.status !== "passed");
  return failed
    ? ({ status: "issue", label: statusLabel(failed.status) } as const)
    : ({ status: "passed", label: commands.length > 1 ? `${commands.length} 项通过` : "通过" } as const);
}

function buildQualityWorkflowArtifact(
  report: PerformanceCodeAuditReport,
  prEvidence: DeveloperPrEvidence | null = null,
  expectedPageTargetPath: string | null = null,
  workflowContext: DeveloperPrEvidenceContext | null = null,
  globalBundleExpectation: GlobalReleaseBundleExpectation | null = null,
): UpdateDeveloperWorkflowArtifactInput<"06"> {
  const extendedReport = report as PerformanceCodeAuditReport & {
    releaseVersion?: unknown;
    artifactRefs?: unknown;
  };
  const githubPr = prEvidence?.prUrl ?? null;
  const releaseVersion = typeof extendedReport.releaseVersion === "string" && extendedReport.releaseVersion.trim()
    ? extendedReport.releaseVersion.trim()
    : null;
  const reportArtifactRefs = Array.isArray(extendedReport.artifactRefs)
    ? extendedReport.artifactRefs.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim())
    : [];
  const closureEvidence = buildPageClosureEvidence(report);
  const pageTargetMatches = report.scope !== "page"
    || Boolean(expectedPageTargetPath && report.targetPath === expectedPageTargetPath);
  const closureCoverageRef = closureEvidence
    ? `dependency-closure-coverage:${closureEvidence.coverage.status}:${closureEvidence.coverage.closureFiles}-files:${closureEvidence.coverage.edges}-edges:${closureEvidence.coverage.unresolved}-unresolved`
    : null;
  const globalBundleGate = report.scope === "global"
    ? evaluateGlobalReleaseBundleGate(
        report,
        globalBundleExpectation?.targetManifestFingerprint ?? "",
        globalBundleExpectation?.targetIds ?? EMPTY_WORKFLOW_TARGET_IDS,
        globalBundleExpectation?.stage05BundleFingerprint ?? "",
      )
    : null;
  const artifactRefs = [...new Set([
    ...reportArtifactRefs,
    ...(report.buildReportPath ? [`frontend/${report.buildReportPath}`] : []),
    ...(report.bundleBudgetReport?.fingerprint ? [`bundle-budget:${report.bundleBudgetReport.fingerprint}`] : []),
    ...(closureEvidence ? [`dependency-closure:${closureEvidence.fingerprint}`] : []),
    ...(closureCoverageRef ? [closureCoverageRef] : []),
    ...(githubPr ? [githubPr] : []),
    ...(prEvidence ? [`github-pr-evidence:${prEvidence.evidenceFingerprint}`] : []),
  ])];
  const gateResults = [
    ...SHARED_OPTIMIZATION_CONTRACT.gates.map((gate) => ({
      id: gate,
      ...qualityGateState(gate, report, prEvidence, globalBundleGate),
    })),
    ...(report.scope === "page" ? [{
      id: "page-target-identity",
      status: pageTargetMatches ? "passed" : "issue",
      label: pageTargetMatches ? "页面身份一致" : "报告属于其他页面",
    } as const] : []),
    ...(closureEvidence ? [{
      id: "dependency-closure",
      status: closureEvidence.coverage.complete ? "passed" : "issue",
      label: closureEvidence.coverage.complete ? "闭包完整" : `闭包覆盖 ${closureEvidence.coverage.status}`,
    } as const] : []),
  ];
  const blockedGateIds = gateResults.filter((gate) => gate.status === "issue").map((gate) => gate.id);
  const pendingGateIds = gateResults.filter((gate) => gate.status !== "passed" && gate.status !== "issue").map((gate) => gate.id);
  const passedGateIds = gateResults.filter((gate) => gate.status === "passed").map((gate) => gate.id);
  const status = blockedGateIds.length ? "blocked" : pendingGateIds.length ? "pending" : "passed";
  const message = blockedGateIds.length
    ? `质量门禁阻断：${blockedGateIds.join("、")}。`
    : pendingGateIds.length
      ? `等待门禁证据：${pendingGateIds.join("、")}。`
      : "全部本地与 GitHub PR 门禁均已通过。";
  return {
    status,
    payload: {
      gateIds: gateResults.map((gate) => gate.id),
      githubPr,
      githubHeadSha: prEvidence?.headSha ?? null,
      githubChecks: prEvidence?.checks ?? [],
      githubReviewDecision: prEvidence?.reviewDecision ?? null,
      prEvidenceFingerprint: prEvidence?.evidenceFingerprint ?? null,
      workflowRunId: workflowContext?.workflowRunId ?? null,
      workflowContractVersion: workflowContext?.contractVersion ?? null,
      workflowScopeIdentity: workflowContext?.scopeIdentity ?? null,
      workflowSourceFingerprint: workflowContext?.sourceFingerprint ?? null,
      workflowTargetManifestFingerprint: workflowContext?.targetManifestFingerprint ?? null,
      verificationExpiresAt: prEvidence?.expiresAt ?? null,
      releaseVersion,
      artifactRefs,
      passedGateIds,
      pendingGateIds,
      blockedGateIds,
      gateResults,
      reportGeneratedAt: report.generatedAt,
      reportScope: report.scope,
      targetPath: report.targetPath,
      bundleFingerprint: report.bundleBudgetReport?.fingerprint ?? null,
      globalBundleIssues: globalBundleGate?.issues ?? [],
      stage05BundleFingerprint: globalBundleGate?.stage05BundleFingerprint ?? null,
      bundleTargetManifestFingerprint: globalBundleGate?.targetManifestFingerprint ?? null,
      ...(closureEvidence ? {
        closureFingerprint: closureEvidence.fingerprint,
        closureCoverage: closureEvidence.coverage,
        closureEntries: report.dependencyClosure?.entries ?? [],
      } : {}),
    },
    artifactRefs,
    message,
    recordedAt: prEvidence?.capturedAt ?? report.generatedAt,
  };
}

export default function PerformanceQualityReleaseWorkbench({
  pathname,
  search = "",
  scope,
  workflowScope,
  onWorkflowScopeChange,
  onWorkflowArtifact,
  initialReport = null,
  onAuditReport,
  initialPrEvidence = null,
  onPrEvidence,
  workflowRunId = "",
  workflowScopeIdentity = "",
  workflowContractVersion = "",
  workflowSourceFingerprint = "",
  workflowTargetManifestFingerprint = "",
  workflowTargetIds = EMPTY_WORKFLOW_TARGET_IDS,
  workflowStage05BundleFingerprint = "",
  workflowNormalizedRoute = "",
}: {
  pathname: string;
  search?: string;
  scope: PerformanceExperienceScope;
  workflowScope?: OptimizationAuditScope;
  onWorkflowScopeChange?: (scope: OptimizationAuditScope) => void;
  onWorkflowArtifact?: (input: UpdateDeveloperWorkflowArtifactInput<"06">) => void;
  initialReport?: PerformanceCodeAuditReport | null;
  onAuditReport?: (report: PerformanceCodeAuditReport) => void;
  initialPrEvidence?: DeveloperPrEvidence | null;
  onPrEvidence?: (evidence: DeveloperPrEvidence | null) => void;
  workflowRunId?: string;
  workflowScopeIdentity?: string;
  workflowContractVersion?: string;
  workflowSourceFingerprint?: string;
  workflowTargetManifestFingerprint?: string;
  workflowTargetIds?: readonly string[];
  workflowStage05BundleFingerprint?: string;
  workflowNormalizedRoute?: string;
}) {
  const [fallbackAuditScope, setFallbackAuditScope] = useState<OptimizationAuditScope>("page");
  const auditScope = workflowScope ?? fallbackAuditScope;
  const [pages, setPages] = useState<PerformanceAuditPage[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [runBuild, setRunBuild] = useState(() => workflowScope === "global");
  const [running, setRunning] = useState(false);
  const reusableInitialReport = initialReport?.scope === auditScope ? initialReport : null;
  const [report, setReport] = useState<PerformanceCodeAuditReport | null>(reusableInitialReport);
  const [error, setError] = useState("");
  const prEvidenceContext = useMemo<DeveloperPrEvidenceContext | null>(() => (
    workflowRunId && workflowScopeIdentity && workflowContractVersion && workflowSourceFingerprint && workflowTargetManifestFingerprint
      ? {
          workflowRunId,
          contractVersion: workflowContractVersion,
          scopeIdentity: workflowScopeIdentity,
          sourceFingerprint: workflowSourceFingerprint,
          targetManifestFingerprint: workflowTargetManifestFingerprint,
        }
      : null
  ), [workflowContractVersion, workflowRunId, workflowScopeIdentity, workflowSourceFingerprint, workflowTargetManifestFingerprint]);
  const [prUrlInput, setPrUrlInput] = useState(initialPrEvidence?.prUrl ?? "");
  const [prEvidence, setPrEvidence] = useState<DeveloperPrEvidence | null>(initialPrEvidence);
  const [prEvidenceError, setPrEvidenceError] = useState("");
  const [prEvidenceVerifying, setPrEvidenceVerifying] = useState(false);
  const auditRequestIdRef = useRef(0);
  const prRequestIdRef = useRef(0);

  const currentSourceScope = resolvePerformanceAuditSourceScope(scope);
  const currentRoute = workflowNormalizedRoute || resolvePerformanceAuditRoute(pathname, search);
  const currentPage = useMemo(() => pages.find((page) => page.sourceScope === currentSourceScope && page.route === currentRoute), [currentRoute, currentSourceScope, pages]);
  const selectablePages = useMemo(() => workflowScope === undefined ? pages : currentPage ? [currentPage] : [], [currentPage, pages, workflowScope]);
  const expectedPageTargetPath = auditScope === "page" ? currentPage?.path ?? "" : null;
  const globalBundleExpectation = useMemo<GlobalReleaseBundleExpectation>(() => ({
    targetManifestFingerprint: workflowTargetManifestFingerprint,
    targetIds: workflowTargetIds,
    stage05BundleFingerprint: workflowStage05BundleFingerprint,
  }), [workflowStage05BundleFingerprint, workflowTargetIds, workflowTargetManifestFingerprint]);
  const buildWorkflowArtifact = useCallback((
    nextReport: PerformanceCodeAuditReport,
    evidence: DeveloperPrEvidence | null,
  ) => buildQualityWorkflowArtifact(
    nextReport,
    evidence,
    expectedPageTargetPath,
    prEvidenceContext,
    globalBundleExpectation,
  ), [expectedPageTargetPath, globalBundleExpectation, prEvidenceContext]);
  const globalReleaseBundleGate = useMemo(() => report?.scope === "global"
    ? evaluateGlobalReleaseBundleGate(
        report,
        globalBundleExpectation.targetManifestFingerprint,
        globalBundleExpectation.targetIds,
        globalBundleExpectation.stage05BundleFingerprint,
      )
    : null, [globalBundleExpectation, report]);
  const maxFileSize = useMemo(() => Math.max(...(report?.files.map((item) => item.sizeBytes) || []), 1), [report]);
  const maxMediaSize = useMemo(() => Math.max(...(report?.mediaAssets.map((item) => item.sizeBytes) || []), 1), [report]);
  const maxBundleRouteSize = useMemo(() => Math.max(...((report?.bundleBudgetReport?.topStartupWindowRoutes || report?.bundleBudgetReport?.topRoutes || []).map((item) => item.startupWindowGzipBytes || item.gzipBytes)), 1), [report]);
  const pageClosure = report?.scope === "page" ? report.dependencyClosure : null;
  const pageClosureEvidence = useMemo(() => buildPageClosureEvidence(report), [report]);
  const visibleClosureFiles = useMemo(() => {
    if (!pageClosure) return [];
    const priority = (classifications: readonly string[]) => classifications.includes("entry")
      ? 0
      : classifications.includes("lazy")
        ? 1
        : classifications.includes("shared")
          ? 2
          : 3;
    return [...pageClosure.files]
      .sort((left, right) => priority(left.classifications) - priority(right.classifications) || compareStableText(left.path, right.path))
      .slice(0, 10);
  }, [pageClosure]);
  const auditContextKey = `${workflowRunId}:${workflowScopeIdentity}:${workflowSourceFingerprint}:${workflowContractVersion}:${workflowTargetManifestFingerprint}:${workflowStage05BundleFingerprint}:${auditScope}:${currentSourceScope}:${currentRoute}:${auditScope === "page" ? selectedPath : "*"}:${auditScope === "global" && runBuild ? "build" : "no-build"}`;
  const auditContextRef = useRef(auditContextKey);
  useLayoutEffect(() => {
    auditContextRef.current = auditContextKey;
    auditRequestIdRef.current += 1;
    prRequestIdRef.current += 1;
  }, [auditContextKey]);

  const clearStaleReport = useCallback(() => {
    auditRequestIdRef.current += 1;
    setRunning(false);
    setReport(null);
    setError("");
  }, []);

  const setAuditScope = (nextScope: OptimizationAuditScope) => {
    if (workflowScope === undefined) setFallbackAuditScope(nextScope);
    onWorkflowScopeChange?.(nextScope);
    clearStaleReport();
  };

  useEffect(() => {
    if (auditScope === "global") {
      setPages([]);
      setSelectedPath("");
      return undefined;
    }
    let cancelled = false;
    void listPerformanceAuditPages()
      .then(({ items }) => {
        if (cancelled) return;
        setPages(items);
        const current = items.find((page) => page.sourceScope === currentSourceScope && page.route === currentRoute);
        setSelectedPath(current?.path || (workflowScope === undefined ? items.find((page) => page.sourceScope === currentSourceScope)?.path || items[0]?.path : "") || "");
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => { cancelled = true; };
  }, [auditScope, currentRoute, currentSourceScope, workflowScope]);

  const selectedAuditTarget = auditScope === "page" ? selectedPath : "*";
  useEffect(() => {
    auditRequestIdRef.current += 1;
    setRunning(false);
    setReport(reusableInitialReport);
    setError("");
  }, [auditScope, currentRoute, currentSourceScope, reusableInitialReport, selectedAuditTarget]);

  useEffect(() => {
    prRequestIdRef.current += 1;
    if (!prEvidenceContext) {
      setPrEvidence(null);
      setPrUrlInput("");
      setPrEvidenceError("");
      setPrEvidenceVerifying(false);
      return;
    }
    const validated = initialPrEvidence
      ? validateDeveloperPrEvidence(initialPrEvidence, prEvidenceContext).evidence
      : null;
    setPrEvidence(validated);
    setPrUrlInput(validated?.prUrl ?? "");
    setPrEvidenceError("");
    setPrEvidenceVerifying(false);
  }, [initialPrEvidence, prEvidenceContext]);

  useEffect(() => {
    if (!prEvidence) return undefined;
    const expiresIn = Date.parse(prEvidence.expiresAt) - Date.now();
    const expireEvidence = () => {
      prRequestIdRef.current += 1;
      setPrEvidence(null);
      setPrEvidenceVerifying(false);
      setPrEvidenceError("GitHub PR 实时证据已过期，请重新核验。");
      onPrEvidence?.(null);
      if (report) onWorkflowArtifact?.(buildWorkflowArtifact(report, null));
    };
    if (expiresIn <= 0) {
      expireEvidence();
      return undefined;
    }
    const timeoutId = window.setTimeout(expireEvidence, expiresIn + 25);
    return () => window.clearTimeout(timeoutId);
  }, [buildWorkflowArtifact, onPrEvidence, onWorkflowArtifact, prEvidence, report]);

  useEffect(() => {
    if (!initialReport || initialReport.scope !== auditScope) return;
    setReport(initialReport);
    setError("");
    if (auditScope === "global") setRunBuild(Boolean(initialReport.buildReportPath));
    onWorkflowArtifact?.(buildWorkflowArtifact(initialReport, prEvidence));
  }, [auditScope, buildWorkflowArtifact, initialReport, onWorkflowArtifact, prEvidence]);

  const runAudit = async () => {
    if (auditScope === "page" && !selectedPath) {
      toast.error("请先选择一个登记页面。");
      return;
    }
    const requestId = auditRequestIdRef.current + 1;
    auditRequestIdRef.current = requestId;
    const requestContextKey = auditContextKey;
    setRunning(true);
    setError("");
    try {
      const nextReport = await runPerformanceCodeAudit({
        scope: auditScope,
        targetPath: auditScope === "page" ? selectedPath : undefined,
        runBuild: auditScope === "global" && runBuild,
      });
      if (auditRequestIdRef.current !== requestId || auditContextRef.current !== requestContextKey) return;
      setReport(nextReport);
      onAuditReport?.(nextReport);
      onWorkflowArtifact?.(buildWorkflowArtifact(nextReport, prEvidence));
      const findings = nextReport.commands.filter((item) => item.status !== "passed").length + nextReport.recommendations.filter((item) => item.severity !== "info").length;
      toast.success(findings ? `审计完成，形成 ${findings} 项复核任务。` : "审计完成，当前范围未发现阻断问题。");
    } catch (reason) {
      if (auditRequestIdRef.current !== requestId || auditContextRef.current !== requestContextKey) return;
      const message = reason instanceof Error ? reason.message : String(reason);
      setError(message);
      toast.error(message);
    } finally {
      if (auditRequestIdRef.current === requestId && auditContextRef.current === requestContextKey) setRunning(false);
    }
  };

  const verifyPrEvidence = async () => {
    if (!prEvidenceContext) {
      setPrEvidenceError("统一流程上下文尚未就绪，不能核验 PR 证据。");
      return;
    }
    const requestId = prRequestIdRef.current + 1;
    const requestContextKey = auditContextKey;
    prRequestIdRef.current = requestId;
    setPrEvidenceVerifying(true);
    setPrEvidenceError("");
    try {
      const evidence = await verifyDeveloperPrEvidenceWithGithub(prUrlInput, prEvidenceContext);
      if (prRequestIdRef.current !== requestId || auditContextRef.current !== requestContextKey) return;
      setPrEvidence(evidence);
      onPrEvidence?.(evidence);
      if (report) onWorkflowArtifact?.(buildWorkflowArtifact(report, evidence));
      toast.success("GitHub 已实时确认 PR、审批与必需 CI 检查。 ");
    } catch (reason) {
      if (prRequestIdRef.current !== requestId || auditContextRef.current !== requestContextKey) return;
      const message = reason instanceof Error ? reason.message : String(reason);
      setPrEvidence(null);
      onPrEvidence?.(null);
      setPrEvidenceError(message);
      if (report) onWorkflowArtifact?.(buildWorkflowArtifact(report, null));
      toast.error(message);
    } finally {
      if (prRequestIdRef.current === requestId && auditContextRef.current === requestContextKey) setPrEvidenceVerifying(false);
    }
  };

  const changePrUrl = (value: string) => {
    setPrUrlInput(value);
    setPrEvidenceError("");
    if (!prEvidence) return;
    setPrEvidence(null);
    onPrEvidence?.(null);
    if (report) onWorkflowArtifact?.(buildWorkflowArtifact(report, null));
  };

  return (
    <section data-performance-quality-release-workbench data-developer-workflow-scope={auditScope} className="flex h-full min-h-0 w-full flex-col overflow-hidden p-4">
      <div className="flex shrink-0 flex-wrap items-end gap-2 border-b border-current/15 pb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">代码、构建与 PR 审计</h3>
          <p className="mt-1 text-[11px] opacity-70">全局运行 Knip、ESLint 和可选构建；页面模式只检查登记源码。所有结果只生成复核任务。</p>
        </div>
        <div className="flex items-center gap-1">
          <Button data-developer-workflow-scope-option="page" aria-pressed={auditScope === "page"} size="sm" variant={auditScope === "page" ? "default" : "outline"} className="h-8" onClick={() => setAuditScope("page")}>当前/指定页面</Button>
          <Button data-developer-workflow-scope-option="global" aria-pressed={auditScope === "global"} size="sm" variant={auditScope === "global" ? "default" : "outline"} className="h-8" onClick={() => setAuditScope("global")}>全局</Button>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-current/10 py-3">
        {auditScope === "page" ? (
          <>
            <select aria-label="选择页面源码" value={selectedPath} disabled={workflowScope !== undefined} onChange={(event) => { setSelectedPath(event.currentTarget.value); clearStaleReport(); }} className="h-8 min-w-0 flex-1 rounded-md border border-current/25 bg-transparent px-2 text-xs disabled:opacity-60">
              {selectablePages.map((page) => <option key={`${page.sourceScope}:${page.route}:${page.path}`} value={page.path}>{page.label} · {page.sourceScope} · {page.path}</option>)}
            </select>
            <Button size="sm" variant="outline" className="h-8" disabled={!currentPage} onClick={() => { if (!currentPage) return; setSelectedPath(currentPage.path); clearStaleReport(); }}>定位当前页</Button>
          </>
        ) : (
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={runBuild} onChange={(event) => { setRunBuild(event.currentTarget.checked); clearStaleReport(); }} />
            同时生成生产构建包可视化报告
          </label>
        )}
        <Button size="sm" className="h-8" disabled={running} onClick={() => void runAudit()}>{running ? "正在检查…" : "一键执行检查"}</Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pt-3" aria-live="polite">
        <section
          data-media-optimization-policy={MEDIA_OPTIMIZATION_CONTRACT.policy}
          data-media-optimization-contract-version={MEDIA_OPTIMIZATION_CONTRACT.version}
          data-media-original-retention={MEDIA_OPTIMIZATION_CONTRACT.storageLifecycle.originalRetention}
          data-media-avatar-first-paint={MEDIA_OPTIMIZATION_CONTRACT.delivery.avatarFirstPaint.id}
          data-media-avatar-never-empty={String(MEDIA_OPTIMIZATION_CONTRACT.delivery.avatarFirstPaint.neverEmpty)}
          className="mb-5 space-y-3"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div><h4 className="text-xs font-semibold">媒体上传与交付规则</h4><p className="mt-1 text-[10px] opacity-60">前端预检、后端签名校验与素材审计共读 v{MEDIA_OPTIMIZATION_CONTRACT.version}</p></div>
            <span className="text-[10px] opacity-60">原件临时 · SHA-256 去重 · 派生缓存可重建</span>
          </div>
          <p className="text-[10px] leading-5 opacity-65">
            专家头像交付：本地头像先显示，保存图片解码成功后再替换；失败回到本地头像，最终使用矢量图，任何阶段都不留空。
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.entries(MEDIA_OPTIMIZATION_CONTRACT.kinds) as ["image" | "video" | "audio", (typeof MEDIA_OPTIMIZATION_CONTRACT.kinds)["image"]][]).map(([kind, rule]) => (
              <div key={kind} className="min-w-0 border-b border-current/15 pb-2 text-[10px]">
                <div className="flex items-center justify-between gap-2"><strong>{rule.label}</strong><span>{formatBytes(rule.maxUploadBytes)} 上限</span></div>
                <p className="mt-1 break-words opacity-65">{rule.acceptedExtensions.join(" · ")}</p>
                <p className="mt-1 opacity-65">推荐 ≤ {formatBytes(rule.warningBytes)} · 交付预算 {formatBytes(rule.deliveryBudgetBytes)}</p>
              </div>
            ))}
          </div>
          <div data-responsive-verification-matrix className="flex flex-wrap items-center gap-1 text-[10px]">
            <strong className="mr-1">响应式矩阵</strong>
            {RESPONSIVE_SHELL_FACTORY_DEFAULT.verificationWidths.map((width) => <span key={width} className="rounded border border-current/15 px-1.5 py-0.5 opacity-70">{width}px</span>)}
          </div>
        </section>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        {!report && !error ? <p className="text-xs opacity-65">选择范围后点击“一键执行检查”。先给结论，再展开命令证据。</p> : null}
        {report ? (
          <div className="space-y-5" data-performance-code-audit-report data-audit-scope={report.scope}>
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              {[
                ["源码文件", `${report.summary.sourceFiles}`],
                ["源码体积", formatBytes(report.summary.sourceBytes)],
                ["大模块", `${report.summary.largeSourceFiles}`],
                ["大资源样本", formatBytes(report.summary.topAssetBytes)],
                ["素材总数", `${report.summary.mediaAssetCount}`],
                ["素材待优化", `${report.summary.mediaIssueCount}`],
              ].map(([label, value]) => <div key={label} className="border-b border-current/15 pb-2"><dt className="text-[10px] opacity-60">{label}</dt><dd className="mt-1 text-sm font-semibold">{value}</dd></div>)}
            </dl>

            {pageClosure && pageClosureEvidence ? (
              <section
                data-page-dependency-closure
                data-status={pageClosureEvidence.coverage.status}
                data-fingerprint={pageClosureEvidence.fingerprint}
                data-truncated={pageClosure.truncated ? "true" : "false"}
                className="space-y-3 border-y border-current/15 py-3"
              >
                <div className="flex min-w-0 flex-wrap items-end justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold">当前页完整依赖闭包</h4>
                    <p className="mt-1 truncate text-[10px] opacity-55" title={pageClosureEvidence.fingerprint}>
                      指纹 {pageClosureEvidence.fingerprint} · {pageClosure.mode === "registered-page-dependency-closure" ? "页面注册表双入口" : "指定入口"}
                    </p>
                  </div>
                  <strong className={pageClosureEvidence.coverage.complete ? "text-[10px] text-emerald-600" : "text-[10px] text-destructive"}>
                    {pageClosureEvidence.coverage.complete ? "闭包证据完整" : pageClosure.truncated ? "闭包已截断" : "闭包需复核"}
                  </strong>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 xl:grid-cols-6">
                  {[
                    ["闭包文件", pageClosure.fileCount],
                    ["依赖边", pageClosure.edgeCount],
                    ["懒加载", pageClosure.lazyFileCount],
                    ["共享文件", pageClosure.sharedFileCount],
                    ["未解析", pageClosure.unresolved.length],
                    ["匹配页面", pageClosure.registeredPages.length],
                  ].map(([label, value]) => (
                    <div key={label} className="border-b border-current/10 pb-1.5">
                      <dt className="text-[9px] opacity-55">{label}</dt>
                      <dd className="mt-0.5 text-xs font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div data-page-dependency-entries className="grid gap-1 sm:grid-cols-2">
                  {pageClosure.entries.map((entry) => (
                    <div key={entry.path} data-page-dependency-entry={entry.roles.join(",")} className="flex min-w-0 items-center gap-2 rounded border border-current/10 px-2 py-1.5 text-[10px]">
                      <strong className="shrink-0">{entry.roles.map((role) => DEPENDENCY_ENTRY_ROLE_LABELS[role] || role).join(" / ")}</strong>
                      <span className="min-w-0 flex-1 truncate opacity-65" title={entry.path}>{entry.path}</span>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between gap-2 text-[10px]">
                    <strong>优先依赖样本</strong>
                    <span className="opacity-50">先入口、再懒加载与共享模块 · 显示 {visibleClosureFiles.length}/{pageClosure.fileCount}</span>
                  </div>
                  <div className="grid gap-x-4 sm:grid-cols-2">
                    {visibleClosureFiles.map((file) => (
                      <div key={file.path} data-page-dependency-file={file.path} data-closure-classifications={file.classifications.join(",")} className="min-w-0 border-b border-current/10 py-1.5 text-[10px]">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="min-w-0 flex-1 truncate" title={file.path}>{file.path}</span>
                          <span className="shrink-0 opacity-50">被 {file.importedBy.length} 个模块引用</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {file.classifications.map((classification) => (
                            <span key={classification} className="rounded border border-current/15 px-1 py-0.5 opacity-65">
                              {DEPENDENCY_CLASSIFICATION_LABELS[classification] || classification}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {pageClosure.truncated ? (
                  <p role="alert" className="text-[10px] text-destructive">依赖闭包达到 {pageClosure.limit} 个文件上限；当前证据不能作为完整页面覆盖，应先拆分页面或提高受控上限。</p>
                ) : null}
                {pageClosure.unresolved.length ? (
                  <details data-page-dependency-unresolved className="text-[10px] text-destructive">
                    <summary className="cursor-pointer font-semibold">{pageClosure.unresolved.length} 个本地依赖未解析</summary>
                    <ul className="mt-1 space-y-1">
                      {pageClosure.unresolved.slice(0, 6).map((item, index) => (
                        <li key={`${item.importer}:${item.reference}:${index}`} className="break-all">{item.importer} → {item.reference || "读取失败"} · {item.reason}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </section>
            ) : null}

            <section data-performance-quality-gates>
              <div className="flex items-center justify-between gap-2"><h4 className="text-xs font-semibold">统一质量门禁</h4><span className="text-[10px] opacity-60">GitHub PR 为外部最终门，不伪装成本地通过</span></div>
              <div className="mt-2 grid gap-x-4 sm:grid-cols-2 xl:grid-cols-4">
                {SHARED_OPTIMIZATION_CONTRACT.gates.map((gate) => {
                  const state = qualityGateState(gate, report, prEvidence, globalReleaseBundleGate);
                  return (
                    <div key={gate} data-performance-quality-gate={gate} data-status={state.status} className="flex items-center justify-between gap-2 border-b border-current/10 py-2 text-[11px]">
                      <span>{QUALITY_GATE_LABELS[gate] || gate}</span>
                      <strong className={state.status === "issue" ? "text-destructive" : "opacity-65"}>{state.label}</strong>
                    </div>
                  );
                })}
              </div>
            </section>

            <section data-github-pr-evidence-verify data-status={prEvidence ? "passed" : prEvidenceError ? "issue" : "pending"} className="space-y-2 border-y border-current/15 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold">GitHub PR / CI 证据</h4>
                  <p className="mt-1 text-[10px] opacity-60">后端通过已认证 GitHub CLI 只读核验真实 PR、审批、head SHA 与共享契约规定的 CI；浏览器自填 JSON 永不放行。</p>
                </div>
                <Button type="button" size="sm" variant="outline" className="h-8" disabled={!prEvidenceContext || !prUrlInput.trim() || prEvidenceVerifying} onClick={() => void verifyPrEvidence()}>{prEvidenceVerifying ? "GitHub 核验中…" : "实时核验"}</Button>
              </div>
              <input
                aria-label="GitHub pull request URL"
                value={prUrlInput}
                onChange={(event) => changePrUrl(event.currentTarget.value)}
                placeholder="https://github.com/组织/仓库/pull/123"
                className="h-9 w-full rounded-md border border-current/20 bg-transparent px-2 font-mono text-[10px]"
              />
              <p className="text-[10px] opacity-55">可信门禁同时要求：Git 与 GitHub CLI 已安装、已执行 <code>gh auth login</code>、origin 指向该仓库、工作树干净，并且本地 HEAD 与 PR head 完全一致。</p>
              <p className="text-[10px] opacity-55">首次使用需在本机安装 GitHub CLI 并完成 <code>gh auth login</code>；核验只读，不会修改 PR。</p>
              {prEvidence ? <p className="text-[10px] text-emerald-600">GitHub 实时确认 · {prEvidence.repository} #{prEvidence.prNumber} · {prEvidence.checks.length} 项检查 · {prEvidence.headSha.slice(0, 12)}</p> : null}
              {prEvidenceError ? <p role="alert" className="text-[10px] text-destructive">{prEvidenceError}</p> : null}
            </section>

            <section>
              <h4 className="text-xs font-semibold">检查结果</h4>
              <div className="mt-2 space-y-2">
                {report.commands.map((command) => (
                  <details key={command.id} className="border-b border-current/10 pb-2">
                    <summary className="cursor-pointer text-[11px] font-medium">{command.id} · {statusLabel(command.status)}</summary>
                    <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-[10px] opacity-70">{command.output}</pre>
                  </details>
                ))}
              </div>
            </section>

            <section>
              <h4 className="text-xs font-semibold">优先优化任务</h4>
              <ol className="mt-2 space-y-2">
                {report.recommendations.map((item, index) => (
                  <li key={`${item.target}:${index}`} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2 text-[11px]">
                    <span className="font-semibold opacity-55">{String(index + 1).padStart(2, "0")}</span>
                    <div><strong>{item.target}</strong><p className="mt-0.5 leading-5 opacity-75">{item.message}</p></div>
                  </li>
                ))}
              </ol>
            </section>

            {report.mediaAssets.length ? (
              <section data-media-optimization-audit>
                <h4 className="text-xs font-semibold">素材体积与格式可视化</h4>
                <div className="mt-2 space-y-2">
                  {report.mediaAssets.slice(0, 12).map((asset) => (
                    <div key={asset.assetId} className="min-w-0 border-b border-current/10 pb-2 text-[10px]">
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate" title={asset.fileName}>{asset.fileName}</span>
                        <span>{formatBytes(asset.sizeBytes)}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full bg-current/10"><div className={asset.issues.length ? "h-full bg-destructive/70" : "h-full bg-current/55"} style={{ width: `${Math.max(2, (asset.sizeBytes / maxMediaSize) * 100)}%` }} /></div>
                      <p className={asset.issues.length ? "mt-1 break-words text-destructive" : "mt-1 opacity-55"}>{asset.issues.length ? asset.issues.join(" · ") : "符合共享规则"}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {report.bundleBudgetReport ? (
              <section data-bundle-budget-report data-status={report.bundleBudgetReport.status}>
                <div className="flex min-w-0 flex-wrap items-end justify-between gap-2">
                  <div><h4 className="text-xs font-semibold">构建包预算证据</h4><p className="mt-1 max-w-full truncate text-[10px] opacity-55" title={report.bundleBudgetReport.fingerprint}>指纹 {report.bundleBudgetReport.fingerprint.slice(0, 16)} · {report.bundleBudgetReport.generatedAt}</p></div>
                  <strong className={report.bundleBudgetReport.status === "failed" ? "text-xs text-destructive" : "text-xs opacity-65"}>{report.bundleBudgetReport.status === "failed" ? `${report.bundleBudgetReport.violations.length} 项超限` : "预算通过"}</strong>
                </div>
                <div className="mt-2 space-y-2">
                  {(report.bundleBudgetReport.topStartupWindowRoutes || report.bundleBudgetReport.topRoutes).slice(0, 8).map((entry) => {
                    const initialLimitBytes = report.bundleBudgetReport!.budgets.routeScript.limit * 1024;
                    const postPaintLimitBytes = report.bundleBudgetReport!.budgets.postPaintScript.limit * 1024;
                    const deferredBytes = entry.deferredGzipBytes || 0;
                    const startupWindowBytes = entry.startupWindowGzipBytes || entry.gzipBytes + deferredBytes;
                    const overLimit = entry.gzipBytes > initialLimitBytes || deferredBytes > postPaintLimitBytes;
                    return (
                      <div key={entry.key} data-bundle-route-initial-bytes={entry.gzipBytes} data-bundle-route-post-paint-bytes={deferredBytes} className="min-w-0 text-[10px]">
                        <div className="flex min-w-0 items-center justify-between gap-2"><span className="min-w-0 flex-1 truncate" title={entry.key}>{entry.key}</span><span className={overLimit ? "shrink-0 text-destructive" : "shrink-0"}>首屏 {formatBytes(entry.gzipBytes)} · 首帧后 {formatBytes(deferredBytes)}</span></div>
                        <div className="mt-1 flex h-1.5 w-full overflow-hidden bg-current/10"><div className={entry.gzipBytes > initialLimitBytes ? "h-full bg-destructive/70" : "h-full bg-current/55"} style={{ width: `${Math.max(2, (entry.gzipBytes / maxBundleRouteSize) * 100)}%` }} /><div className={deferredBytes > postPaintLimitBytes ? "h-full bg-destructive/70" : "h-full bg-sky-500/70"} style={{ width: `${Math.max(deferredBytes ? 2 : 0, (deferredBytes / maxBundleRouteSize) * 100)}%` }} /></div>
                        <p className="mt-0.5 opacity-50">启动窗口合计 {formatBytes(startupWindowBytes)}，两段分别受共享预算约束</p>
                      </div>
                    );
                  })}
                </div>
                {report.bundleBudgetReport.interactionApplications?.length ? (
                  <div data-bundle-interaction-applications className="mt-3 border-t border-current/10 pt-2">
                    <div className="mb-1 text-[10px] font-semibold">交互后按需应用</div>
                    {report.bundleBudgetReport.developerShell ? (
                      <p data-bundle-developer-shell className="mb-1 text-[10px] opacity-55">
                        计算基线：已加载开发器壳层 {formatBytes(report.bundleBudgetReport.developerShell.closureGzipBytes)}
                      </p>
                    ) : null}
                    <div className="grid gap-1 sm:grid-cols-2">
                      {report.bundleBudgetReport.interactionApplications.map((application) => {
                        const deferredBytes = application.deferredGzipBytes || 0;
                        const firstOpenAdditionalBytes = typeof application.incrementalGzipBytes === "number"
                          ? application.incrementalGzipBytes + deferredBytes
                          : null;
                        return (
                          <div key={application.applicationId} data-bundle-interaction-application={application.applicationId} className="min-w-0 rounded border border-current/10 px-2 py-1 text-[10px]">
                            <div className="flex min-w-0 items-center justify-between gap-2">
                              <span className="min-w-0 truncate" title={application.source}>{application.applicationId}</span>
                              <span className="shrink-0">首次打开新增 {firstOpenAdditionalBytes === null ? "待重建报告" : formatBytes(firstOpenAdditionalBytes)} · 完整闭包 {formatBytes(application.closureGzipBytes)}</span>
                            </div>
                            <p className="mt-0.5 opacity-50">入口 {formatBytes(application.directGzipBytes)} · 应用新增 {typeof application.incrementalGzipBytes === "number" ? formatBytes(application.incrementalGzipBytes) : "待重建报告"} · 首帧后 {formatBytes(deferredBytes)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            <section>
              <h4 className="text-xs font-semibold">体积可视化</h4>
              <div className="mt-2 space-y-2">
                {report.files.slice(0, 8).map((file) => {
                  return <div key={file.path} className="flex min-w-0 flex-wrap items-center gap-2 text-[10px]"><span className="min-w-0 flex-1 truncate" title={file.path}>{file.path}</span><span className="shrink-0 text-right">{formatBytes(file.sizeBytes)}</span><div className="h-2 w-full bg-current/10"><div className="h-full bg-current/55" style={{ width: `${Math.max(2, (file.sizeBytes / maxFileSize) * 100)}%` }} /></div></div>;
                })}
              </div>
              {report.buildReportPath ? <p className="mt-2 text-[10px] opacity-65">完整构建树：frontend/{report.buildReportPath}</p> : null}
            </section>
          </div>
        ) : null}
      </div>
    </section>
  );
}
