import { localDevFetch } from "@/lib/local-dev";
import {
  getRequiredSharedOptimizationBudget,
  SHARED_OPTIMIZATION_CONTRACT,
  type OptimizationAuditScope,
  type SharedOptimizationBudgetId,
} from "@/lib/developer-optimization-contract";
import type { DeveloperWorkflowTarget, UpdateDeveloperWorkflowArtifactInput } from "@/lib/developer-workflow-run";
import { MEDIA_OPTIMIZATION_CONTRACT } from "@/lib/media-optimization-contract";
import {
  fingerprintDeveloperWorkflowTargetManifest,
  normalizeDeveloperWorkflowTargetEntries,
  normalizeDeveloperWorkflowTargetIds,
} from "@/lib/developer-workflow-target-manifest.mjs";
import {
  normalizePageFactoryRoute,
  toPageFactorySourceScope,
  type PageFactoryRuntimeScope,
} from "@/page-factory/page-factory";

export type PerformanceAuditPage = {
  path: string;
  label: string;
  route: string;
  sourceScope: "hq" | "agency_source" | "client_source" | string;
  sizeBytes: number;
};

export type PerformanceAuditCommand = {
  id: string;
  status: "passed" | "failed" | "unavailable" | "timed_out";
  exitCode: number | null;
  output: string;
  batchCount?: number;
  targetCount?: number;
};

export type PerformanceAuditDependencyClassification = "closure" | "entry" | "lazy" | "shared";

export type PerformanceAuditDependencyFile = {
  path: string;
  classifications: PerformanceAuditDependencyClassification[];
  entryRoles: ("component" | "entryComponent" | "target" | string)[];
  reachableFrom: string[];
  eagerFrom: string[];
  lazyFrom: string[];
  importedBy: string[];
  lazyImportedBy: string[];
  imports: { path: string; kind: "static" | "dynamic" }[];
};

export type PerformanceAuditDependencyClosure = {
  mode: "registered-page-dependency-closure" | "target-dependency-closure" | string;
  limit: number;
  truncated: boolean;
  fileCount: number;
  edgeCount: number;
  entryCount: number;
  lazyFileCount: number;
  sharedFileCount: number;
  registeredPages: {
    id: string;
    label: string;
    route: string;
    sourceScope: string;
  }[];
  entries: {
    path: string;
    roles: ("component" | "entryComponent" | "target" | string)[];
  }[];
  files: PerformanceAuditDependencyFile[];
  unresolved: {
    importer: string;
    reference: string;
    reason: "not-found" | "limit-exceeded" | "unreadable" | string;
  }[];
  globalPrerequisites: string[];
};

export type PerformanceAuditFile = {
  path: string;
  sizeBytes: number;
  gzipBytes: number;
  lineCount: number;
  importCount: number;
  lazyBoundaryCount: number;
  dependencyClassifications?: PerformanceAuditDependencyClassification[];
  entryRoles?: string[];
  importedBy?: string[];
};

export type PerformanceAuditAsset = {
  path: string;
  sizeBytes: number;
  gzipBytes?: number;
};

export type PerformanceAuditRecommendation = {
  severity: "info" | "medium" | "high";
  target: string;
  message: string;
};

export type PerformanceAuditMediaAsset = {
  assetId: string;
  fileName: string;
  kind: "image" | "video" | "audio";
  mimeType: string;
  sizeBytes: number;
  issues: string[];
  status: "healthy" | "issue";
  path?: string;
  source?: "dependency-closure" | string;
};

export const GLOBAL_PERFORMANCE_AUDIT_REQUIRED_COMMANDS = [
  "source-lock",
  "media-policy",
  "eslint-global",
  "typescript",
  "knip-production",
  "vite-bundle-analysis",
  "bundle-budget",
  "registered-visual-scan",
  "responsive-runtime-matrix",
  "shared-contract",
  "page-factory",
  "responsive-contract",
  "source-stability",
] as const;

export type GlobalPerformanceAuditCoverage = {
  status: "pending" | "passed" | "blocked";
  complete: boolean;
  targetCount: number;
  registeredPages: number;
  analyzedRoutes: number;
  analysisErrors: number;
  mediaIssues: number;
  bundleFingerprint: string | null;
  targetManifestFingerprint: string | null;
  requiredCommandIds: readonly string[];
  failedCommandIds: string[];
  issues: string[];
};

export type PerformanceCodeAuditReport = {
  scope: OptimizationAuditScope;
  targetPath: string | null;
  generatedAt: string;
  sourceFingerprintStart?: string | null;
  sourceFingerprintEnd?: string | null;
  buildReportPath: string | null;
  dependencyClosure: PerformanceAuditDependencyClosure | null;
  bundleBudgetReport: {
    generatedAt: string;
    fingerprint: string;
    contractVersion: string;
    mediaContractVersion: string;
    status: "passed" | "failed";
    routeAnalysis: {
      registeredPages: number;
      analyzedRoutes: number;
      totalRegisteredPages: number;
      totalAnalyzedRoutes: number;
      errors: unknown[];
      targetManifestFingerprint: string;
      targetIdentities: string[];
      targets: DeveloperWorkflowTarget[];
    };
    budgets: {
      routeScript: { warning: number; limit: number; unit: string };
      postPaintScript: { warning: number; limit: number; unit: string };
      largestChunk: { warning: number; limit: number; unit: string };
    };
    topRoutes: {
      key: string;
      pageId: string;
      route: string;
      gzipBytes: number;
      deferredGzipBytes?: number;
      startupWindowGzipBytes?: number;
      files: string[];
      deferredFiles?: string[];
    }[];
    topStartupWindowRoutes?: {
      key: string;
      pageId: string;
      route: string;
      gzipBytes: number;
      deferredGzipBytes?: number;
      startupWindowGzipBytes?: number;
      files: string[];
      deferredFiles?: string[];
    }[];
    developerShell?: {
      source: string;
      manifestKey: string | null;
      entryFile: string | null;
      closureGzipBytes: number;
      files: string[];
    };
    interactionApplications?: {
      applicationId: string;
      source: string;
      entryFile: string;
      isDynamicEntry: boolean;
      directGzipBytes: number;
      closureGzipBytes: number;
      incrementalGzipBytes?: number;
      files: string[];
      incrementalFiles?: string[];
      deferredGzipBytes?: number;
      deferredFiles?: string[];
    }[];
    topChunks: { file: string; gzipBytes: number }[];
    violations: { type: string; target: string; actualBytes: number; limitBytes: number }[];
  } | null;
  commands: PerformanceAuditCommand[];
  summary: {
    sourceFiles: number;
    sourceBytes: number;
    largeSourceFiles: number;
    topAssetCount: number;
    topAssetBytes: number;
    mediaAssetCount: number;
    mediaIssueCount: number;
    mediaBytes: number;
  };
  files: PerformanceAuditFile[];
  assets: PerformanceAuditAsset[];
  mediaAssets: PerformanceAuditMediaAsset[];
  recommendations: PerformanceAuditRecommendation[];
};

export type PerformanceAuditTargetManifestInspection = {
  reportedFingerprint: string | null;
  recomputedFingerprint: string | null;
  targetIds: string[];
  expectedTargetIds: string[];
  issues: string[];
};

export type GlobalReleaseBundleGate = {
  status: "passed" | "blocked";
  complete: boolean;
  bundleFingerprint: string | null;
  targetManifestFingerprint: string | null;
  stage05BundleFingerprint: string | null;
  issues: string[];
};

type PerformanceAuditRouteAnalysis = NonNullable<PerformanceCodeAuditReport["bundleBudgetReport"]>["routeAnalysis"];

function sameStringArray(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function inspectPerformanceAuditTargetManifest(
  routeAnalysis: PerformanceAuditRouteAnalysis | null | undefined,
  expectedTargetManifestFingerprint: string,
  expectedTargetIds: readonly string[] = [],
): PerformanceAuditTargetManifestInspection {
  if (!routeAnalysis) {
    return {
      reportedFingerprint: null,
      recomputedFingerprint: null,
      targetIds: [],
      expectedTargetIds: normalizeDeveloperWorkflowTargetIds(expectedTargetIds),
      issues: ["target-manifest-report-unavailable"],
    };
  }
  const targets = normalizeDeveloperWorkflowTargetEntries(routeAnalysis.targets) as DeveloperWorkflowTarget[];
  const targetIds = normalizeDeveloperWorkflowTargetIds(targets.map((target) => target.id));
  const reportedTargetIds = normalizeDeveloperWorkflowTargetIds(routeAnalysis.targetIdentities);
  const normalizedExpectedTargetIds = normalizeDeveloperWorkflowTargetIds(expectedTargetIds);
  const recomputedFingerprint = fingerprintDeveloperWorkflowTargetManifest(targets);
  const issues: string[] = [];
  if (!targets.length) issues.push("target-manifest-targets-unavailable");
  if (routeAnalysis.targetManifestFingerprint !== expectedTargetManifestFingerprint) issues.push("target-manifest-fingerprint-mismatch");
  if (routeAnalysis.targetManifestFingerprint !== recomputedFingerprint) issues.push("target-manifest-integrity-mismatch");
  if (targets.length !== targetIds.length
    || routeAnalysis.targetIdentities.length !== reportedTargetIds.length
    || !sameStringArray(reportedTargetIds, targetIds)) {
    issues.push("target-identities-integrity-mismatch");
  }
  if (normalizedExpectedTargetIds.length && !sameStringArray(targetIds, normalizedExpectedTargetIds)) {
    issues.push("target-identities-mismatch");
  }
  return {
    reportedFingerprint: routeAnalysis.targetManifestFingerprint || null,
    recomputedFingerprint,
    targetIds,
    expectedTargetIds: normalizedExpectedTargetIds,
    issues: [...new Set(issues)].sort(),
  };
}

export function evaluateGlobalReleaseBundleGate(
  report: PerformanceCodeAuditReport | null,
  workflowTargetManifestFingerprint: string,
  expectedTargetIds: readonly string[] = [],
  stage05BundleFingerprint = "",
): GlobalReleaseBundleGate {
  const expectedManifestFingerprint = workflowTargetManifestFingerprint.trim();
  const expectedBundleFingerprint = stage05BundleFingerprint.trim();
  const normalizedExpectedTargetIds = normalizeDeveloperWorkflowTargetIds(expectedTargetIds);
  const bundle = report?.bundleBudgetReport ?? null;
  const routeAnalysis = bundle?.routeAnalysis ?? null;
  const issues: string[] = [];

  if (!report) issues.push("global-release-report-unavailable");
  else if (report.scope !== "global") issues.push("global-release-scope-mismatch");
  if (!expectedManifestFingerprint || !normalizedExpectedTargetIds.length) issues.push("target-manifest-unavailable");
  if (!expectedBundleFingerprint) issues.push("stage05-bundle-fingerprint-unavailable");

  if (!bundle) {
    issues.push("bundle-budget-report-unavailable");
  } else {
    if (bundle.status !== "passed") issues.push("bundle-budget-report-not-passed");
    if (bundle.violations.length) issues.push("bundle-budget-violations");
    if (!bundle.fingerprint.trim()) issues.push("bundle-fingerprint-unavailable");
    if (expectedBundleFingerprint && bundle.fingerprint !== expectedBundleFingerprint) {
      issues.push("stage05-bundle-fingerprint-mismatch");
    }
    issues.push(...inspectPerformanceAuditTargetManifest(
      routeAnalysis,
      expectedManifestFingerprint,
      normalizedExpectedTargetIds,
    ).issues);
  }

  const uniqueIssues = [...new Set(issues)].sort();
  return {
    status: uniqueIssues.length ? "blocked" : "passed",
    complete: uniqueIssues.length === 0,
    bundleFingerprint: bundle?.fingerprint || null,
    targetManifestFingerprint: routeAnalysis?.targetManifestFingerprint || null,
    stage05BundleFingerprint: expectedBundleFingerprint || null,
    issues: uniqueIssues,
  };
}

export function evaluateGlobalPerformanceAuditCoverage(
  report: PerformanceCodeAuditReport | null,
  workflowTargetCount: number,
  workflowTargetManifestFingerprint = "",
  expectedTargetIds: readonly string[] = [],
): GlobalPerformanceAuditCoverage {
  const targetCount = Number.isInteger(workflowTargetCount) && workflowTargetCount > 0
    ? workflowTargetCount
    : 0;
  const pendingBase: GlobalPerformanceAuditCoverage = {
    status: "pending",
    complete: false,
    targetCount,
    registeredPages: 0,
    analyzedRoutes: 0,
    analysisErrors: 0,
    mediaIssues: report?.summary.mediaIssueCount ?? 0,
    bundleFingerprint: report?.bundleBudgetReport?.fingerprint ?? null,
    targetManifestFingerprint: report?.bundleBudgetReport?.routeAnalysis.targetManifestFingerprint ?? null,
    requiredCommandIds: GLOBAL_PERFORMANCE_AUDIT_REQUIRED_COMMANDS,
    failedCommandIds: [],
    issues: [],
  };
  if (!targetCount || !workflowTargetManifestFingerprint) return { ...pendingBase, issues: ["target-manifest-unavailable"] };
  if (!report) return { ...pendingBase, issues: ["global-audit-report-unavailable"] };

  const bundle = report.bundleBudgetReport;
  const registeredPages = bundle?.routeAnalysis.registeredPages ?? 0;
  const analyzedRoutes = bundle?.routeAnalysis.analyzedRoutes ?? 0;
  const analysisErrors = bundle?.routeAnalysis.errors.length ?? 0;
  const commandById = new Map(report.commands.map((command) => [command.id, command]));
  const failedCommandIds = GLOBAL_PERFORMANCE_AUDIT_REQUIRED_COMMANDS.filter(
    (commandId) => commandById.get(commandId)?.status !== "passed",
  );
  const issues: string[] = [];
  if (report.scope !== "global") issues.push("global-audit-scope-mismatch");
  if (!report.sourceFingerprintStart || report.sourceFingerprintStart !== report.sourceFingerprintEnd) issues.push("source-fingerprint-drift");
  if (!report.buildReportPath) issues.push("production-build-report-unavailable");
  if (!bundle) {
    issues.push("bundle-budget-report-unavailable");
  } else {
    const targetManifestInspection = inspectPerformanceAuditTargetManifest(
      bundle.routeAnalysis,
      workflowTargetManifestFingerprint,
      expectedTargetIds,
    );
    if (registeredPages !== targetCount) issues.push("registered-target-count-mismatch");
    if (analyzedRoutes !== targetCount) issues.push("analyzed-target-count-mismatch");
    if (bundle.routeAnalysis.targetIdentities.length !== targetCount) issues.push("target-identity-count-mismatch");
    issues.push(...targetManifestInspection.issues);
    if (analysisErrors) issues.push("route-analysis-incomplete");
    if (bundle.status !== "passed" || bundle.violations.length) issues.push("bundle-budget-violations");
  }
  if (report.summary.mediaIssueCount) issues.push("media-policy-issues");
  failedCommandIds.forEach((commandId) => issues.push(`required-command-not-passed:${commandId}`));

  return {
    status: issues.length ? "blocked" : "passed",
    complete: issues.length === 0,
    targetCount,
    registeredPages,
    analyzedRoutes,
    analysisErrors,
    mediaIssues: report.summary.mediaIssueCount,
    bundleFingerprint: bundle?.fingerprint ?? null,
    targetManifestFingerprint: bundle?.routeAnalysis.targetManifestFingerprint ?? null,
    requiredCommandIds: GLOBAL_PERFORMANCE_AUDIT_REQUIRED_COMMANDS,
    failedCommandIds,
    issues: [...new Set(issues)].sort(),
  };
}

export function buildGlobalPerformanceWorkflowArtifact(
  report: PerformanceCodeAuditReport,
  workflowTargetCount: number,
  workflowTargetManifestFingerprint: string,
  expectedTargetIds: readonly string[] = [],
): UpdateDeveloperWorkflowArtifactInput<"05"> {
  const coverage = evaluateGlobalPerformanceAuditCoverage(
    report,
    workflowTargetCount,
    workflowTargetManifestFingerprint,
    expectedTargetIds,
  );
  const artifactRefs = [...new Set([
    ...(report.buildReportPath ? [`frontend/${report.buildReportPath}`] : []),
    ...(coverage.bundleFingerprint ? [`bundle-budget:${coverage.bundleFingerprint}`] : []),
    `performance-global-coverage:${coverage.analyzedRoutes}/${coverage.targetCount}`,
  ])];
  return {
    status: coverage.status,
    payload: {
      metricIds: ["route-script", "post-paint-script", "largest-chunk", "media-policy"],
      budgetViolations: coverage.issues,
      artifactRefs,
      coverageMode: "registered-target-manifest",
      targetCount: coverage.targetCount,
      registeredPages: coverage.registeredPages,
      analyzedRoutes: coverage.analyzedRoutes,
      analysisErrors: coverage.analysisErrors,
      mediaIssues: coverage.mediaIssues,
      requiredCommandIds: coverage.requiredCommandIds,
      failedCommandIds: coverage.failedCommandIds,
      bundleFingerprint: coverage.bundleFingerprint,
      targetManifestFingerprint: coverage.targetManifestFingerprint,
      reportGeneratedAt: report.generatedAt,
    },
    artifactRefs,
    message: coverage.complete
      ? `全局加载批检通过：${coverage.analyzedRoutes}/${coverage.targetCount} 个登记目标证据完整。`
      : `全局加载批检阻断：${coverage.issues.join("、")}。`,
    recordedAt: report.generatedAt,
  };
}

export async function listPerformanceAuditPages() {
  const response = await localDevFetch("/api/v1/local-dev/performance-audit/catalog");
  return (await response.json()) as { items: PerformanceAuditPage[] };
}

export async function runPerformanceCodeAudit(input: {
  scope: OptimizationAuditScope;
  targetPath?: string;
  runBuild?: boolean;
}) {
  const response = await localDevFetch("/api/v1/local-dev/performance-audit/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const report = (await response.json()) as PerformanceCodeAuditReport;
  const bundle = report.bundleBudgetReport;
  if (bundle) {
    if (bundle.contractVersion !== SHARED_OPTIMIZATION_CONTRACT.version
      || bundle.mediaContractVersion !== MEDIA_OPTIMIZATION_CONTRACT.version) {
      throw new Error("构建包预算证据缺少完整有效的共享预算。");
    }
    const required = [
      ["routeScript", "route-script"],
      ["postPaintScript", "post-paint-script"],
      ["largestChunk", "largest-chunk"],
    ] as const satisfies readonly (readonly [keyof typeof bundle.budgets, SharedOptimizationBudgetId])[];
    if (required.some(([reportKey, budgetId]) => {
      const budget = bundle.budgets?.[reportKey];
      const expected = getRequiredSharedOptimizationBudget(budgetId);
      return !budget
      || !Number.isFinite(budget.warning)
      || !Number.isFinite(budget.limit)
      || budget.warning !== expected.warning
      || budget.limit !== expected.limit
      || budget.unit !== expected.unit;
    })) {
      throw new Error("构建包预算证据缺少完整有效的共享预算。");
    }
  }
  return report;
}

export function resolvePerformanceAuditSourceScope(scope: PageFactoryRuntimeScope) {
  return toPageFactorySourceScope(scope);
}

export function resolvePerformanceAuditRoute(pathname: string, search = "") {
  return normalizePageFactoryRoute(pathname, search);
}
