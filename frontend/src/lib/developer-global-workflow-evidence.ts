import {
  inspectPerformanceAuditTargetManifest,
  type PerformanceCodeAuditReport,
} from "@/lib/performance-code-audit";
import {
  DEVELOPER_VISUAL_EVIDENCE_VIEWPORTS,
  type DeveloperVisualEvidenceViewportId,
} from "@/lib/developer-design-integration";

export const GLOBAL_VISUAL_AUDIT_REQUIRED_COMMANDS = [
  "source-lock",
  "registered-visual-scan",
  "responsive-runtime-matrix",
  "shared-contract",
  "page-factory",
  "source-stability",
] as const;

export const GLOBAL_VISUAL_AUDIT_VIEWPORT_IDS = Object.freeze(
  DEVELOPER_VISUAL_EVIDENCE_VIEWPORTS.map((viewport) => viewport.id),
) as readonly DeveloperVisualEvidenceViewportId[];

export type GlobalVisualAuditCoverage = {
  status: "pending" | "passed" | "blocked";
  complete: boolean;
  targetCount: number;
  registeredPages: number;
  analyzedRoutes: number;
  analysisErrors: number;
  targetManifestFingerprint: string | null;
  requiredCommandIds: readonly string[];
  failedCommandIds: string[];
  viewportIds: readonly DeveloperVisualEvidenceViewportId[];
  coverageMode: "registered-targets+runtime-representatives";
  issues: string[];
};

export function evaluateGlobalVisualAuditCoverage(
  report: PerformanceCodeAuditReport | null,
  workflowTargetCount: number,
  workflowTargetManifestFingerprint = "",
  expectedTargetIds: readonly string[] = [],
): GlobalVisualAuditCoverage {
  const targetCount = Number.isInteger(workflowTargetCount) && workflowTargetCount > 0
    ? workflowTargetCount
    : 0;
  const base: GlobalVisualAuditCoverage = {
    status: "pending",
    complete: false,
    targetCount,
    registeredPages: 0,
    analyzedRoutes: 0,
    analysisErrors: 0,
    targetManifestFingerprint: report?.bundleBudgetReport?.routeAnalysis.targetManifestFingerprint ?? null,
    requiredCommandIds: GLOBAL_VISUAL_AUDIT_REQUIRED_COMMANDS,
    failedCommandIds: [],
    viewportIds: GLOBAL_VISUAL_AUDIT_VIEWPORT_IDS,
    coverageMode: "registered-targets+runtime-representatives",
    issues: [],
  };
  if (!targetCount || !workflowTargetManifestFingerprint) return { ...base, issues: ["target-manifest-unavailable"] };
  if (!report) return { ...base, issues: ["global-audit-report-unavailable"] };

  const routeAnalysis = report.bundleBudgetReport?.routeAnalysis;
  const registeredPages = routeAnalysis?.registeredPages ?? 0;
  const analyzedRoutes = routeAnalysis?.analyzedRoutes ?? 0;
  const analysisErrors = routeAnalysis?.errors.length ?? 0;
  const commandById = new Map(report.commands.map((command) => [command.id, command]));
  const failedCommandIds = GLOBAL_VISUAL_AUDIT_REQUIRED_COMMANDS.filter(
    (commandId) => commandById.get(commandId)?.status !== "passed",
  );
  const issues: string[] = [];
  if (report.scope !== "global") issues.push("global-audit-scope-mismatch");
  if (!report.sourceFingerprintStart || report.sourceFingerprintStart !== report.sourceFingerprintEnd) issues.push("source-fingerprint-drift");
  if (!report.buildReportPath || !report.bundleBudgetReport) issues.push("production-build-report-unavailable");
  if (registeredPages !== targetCount) issues.push("registered-target-count-mismatch");
  if (analyzedRoutes !== targetCount) issues.push("analyzed-target-count-mismatch");
  if (routeAnalysis?.targetIdentities.length !== targetCount) issues.push("target-identity-count-mismatch");
  if (routeAnalysis) {
    issues.push(...inspectPerformanceAuditTargetManifest(
      routeAnalysis,
      workflowTargetManifestFingerprint,
      expectedTargetIds,
    ).issues);
  }
  if (analysisErrors) issues.push("route-analysis-incomplete");
  failedCommandIds.forEach((commandId) => issues.push(`required-command-not-passed:${commandId}`));

  return {
    ...base,
    status: issues.length ? "blocked" : "passed",
    complete: issues.length === 0,
    registeredPages,
    analyzedRoutes,
    analysisErrors,
    targetManifestFingerprint: routeAnalysis?.targetManifestFingerprint ?? null,
    failedCommandIds: [...failedCommandIds],
    issues: [...new Set(issues)].sort(),
  };
}
