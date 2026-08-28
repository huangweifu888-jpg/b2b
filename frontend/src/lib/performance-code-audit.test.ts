import assert from "node:assert/strict";
import test from "node:test";

import {
  GLOBAL_PERFORMANCE_AUDIT_REQUIRED_COMMANDS,
  evaluateGlobalReleaseBundleGate,
  evaluateGlobalPerformanceAuditCoverage,
  resolvePerformanceAuditRoute,
  resolvePerformanceAuditSourceScope,
  type PerformanceCodeAuditReport,
} from "./performance-code-audit";
import { getRequiredSharedOptimizationBudget, SHARED_OPTIMIZATION_CONTRACT } from "./developer-optimization-contract";
import { fingerprintDeveloperWorkflowTargetManifest } from "./developer-workflow-target-manifest.mjs";
import { MEDIA_OPTIMIZATION_CONTRACT } from "./media-optimization-contract";
import { resolvePageFactoryRuntimeScope } from "../page-factory/page-factory";

const TARGETS = [{ id: "a" }, { id: "b" }, { id: "c" }] as const;
const TARGET_IDS = TARGETS.map((target) => target.id);
const TARGET_MANIFEST_FINGERPRINT = fingerprintDeveloperWorkflowTargetManifest(TARGETS);
const STAGE05_BUNDLE_FINGERPRINT = "a".repeat(64);
const reportBudget = (id: Parameters<typeof getRequiredSharedOptimizationBudget>[0]) => {
  const budget = getRequiredSharedOptimizationBudget(id);
  return { warning: budget.warning, limit: budget.limit, unit: budget.unit };
};

test("performance workflow reuses Page Factory scope and route identity across every source shell", () => {
  const cases = [
    ["/zb/product-market", "hq", "hq"],
    ["/zb/agency-source/product-market", "agency-source", "agency_source"],
    ["/dl/product-market", "agency-source", "agency_source"],
    ["/zb/client-source/product-market", "client-source", "client_source"],
    ["/kh/product-market", "client-source", "client_source"],
    ["/product-market", "client-source", "client_source"],
  ] as const;

  for (const [pathname, runtimeScope, sourceScope] of cases) {
    const resolvedRuntimeScope = resolvePageFactoryRuntimeScope(pathname);
    assert.equal(resolvedRuntimeScope, runtimeScope);
    assert.equal(resolvePerformanceAuditSourceScope(resolvedRuntimeScope), sourceScope);
    assert.equal(resolvePerformanceAuditRoute(pathname), "/product-market");
  }

  assert.equal(
    resolvePerformanceAuditRoute("/kh/product-market", "?siteId=temporary&tab=operations"),
    "/product-market?tab=operations",
  );
});

function buildReport(overrides: Partial<PerformanceCodeAuditReport> = {}): PerformanceCodeAuditReport {
  const targetCount = 3;
  return {
    scope: "global",
    targetPath: null,
    generatedAt: "2026-08-27T12:00:00.000Z",
    sourceFingerprintStart: "stable-source",
    sourceFingerprintEnd: "stable-source",
    buildReportPath: "dist/stats.html",
    dependencyClosure: null,
    bundleBudgetReport: {
      generatedAt: "2026-08-27T12:00:00.000Z",
      fingerprint: STAGE05_BUNDLE_FINGERPRINT,
      contractVersion: SHARED_OPTIMIZATION_CONTRACT.version,
      mediaContractVersion: MEDIA_OPTIMIZATION_CONTRACT.version,
      status: "passed",
      routeAnalysis: {
        registeredPages: targetCount,
        analyzedRoutes: targetCount,
        totalRegisteredPages: targetCount,
        totalAnalyzedRoutes: targetCount,
        errors: [],
        targetManifestFingerprint: TARGET_MANIFEST_FINGERPRINT,
        targetIdentities: [...TARGET_IDS],
        targets: [...TARGETS],
      },
      budgets: {
        routeScript: reportBudget("route-script"),
        postPaintScript: reportBudget("post-paint-script"),
        largestChunk: reportBudget("largest-chunk"),
      },
      topRoutes: [],
      topChunks: [],
      violations: [],
    },
    commands: GLOBAL_PERFORMANCE_AUDIT_REQUIRED_COMMANDS.map((id) => ({
      id,
      status: "passed" as const,
      exitCode: 0,
      output: "passed",
    })),
    summary: {
      sourceFiles: 0,
      sourceBytes: 0,
      largeSourceFiles: 0,
      topAssetCount: 0,
      topAssetBytes: 0,
      mediaAssetCount: 0,
      mediaIssueCount: 0,
      mediaBytes: 0,
    },
    files: [],
    assets: [],
    mediaAssets: [],
    recommendations: [],
    ...overrides,
  };
}

test("global coverage remains pending until a target manifest and report exist", () => {
  assert.equal(evaluateGlobalPerformanceAuditCoverage(null, 0, "").status, "pending");
  assert.equal(evaluateGlobalPerformanceAuditCoverage(null, 3, TARGET_MANIFEST_FINGERPRINT).status, "pending");
});

test("global coverage passes only when every registered target and command is covered", () => {
  const result = evaluateGlobalPerformanceAuditCoverage(buildReport(), 3, TARGET_MANIFEST_FINGERPRINT, TARGET_IDS);
  assert.equal(result.status, "passed");
  assert.equal(result.complete, true);
  assert.equal(result.analyzedRoutes, 3);
  assert.deepEqual(result.issues, []);
});

test("global coverage blocks target drift, analysis gaps, media issues and failed commands", () => {
  const base = buildReport();
  const report = buildReport({
    bundleBudgetReport: {
      ...base.bundleBudgetReport!,
      routeAnalysis: {
        registeredPages: 4,
        analyzedRoutes: 2,
        totalRegisteredPages: 5,
        totalAnalyzedRoutes: 5,
        errors: [{ context: "missing" }],
        targetManifestFingerprint: "wrong-manifest",
        targetIdentities: ["a", "b"],
        targets: [{ id: "a" }, { id: "b" }],
      },
      violations: [{ type: "route-script", target: "page", actualBytes: 2, limitBytes: 1 }],
    },
    commands: base.commands.map((command) => command.id === "typescript" ? { ...command, status: "failed" as const } : command),
    summary: { ...base.summary, mediaIssueCount: 1 },
  });
  const result = evaluateGlobalPerformanceAuditCoverage(report, 3, TARGET_MANIFEST_FINGERPRINT, TARGET_IDS);
  assert.equal(result.status, "blocked");
  assert.equal(result.complete, false);
  assert.ok(result.issues.includes("registered-target-count-mismatch"));
  assert.ok(result.issues.includes("analyzed-target-count-mismatch"));
  assert.ok(result.issues.includes("target-manifest-fingerprint-mismatch"));
  assert.ok(result.issues.includes("target-manifest-integrity-mismatch"));
  assert.ok(result.issues.includes("target-identities-mismatch"));
  assert.ok(result.issues.includes("target-identity-count-mismatch"));
  assert.ok(result.issues.includes("route-analysis-incomplete"));
  assert.ok(result.issues.includes("bundle-budget-violations"));
  assert.ok(result.issues.includes("media-policy-issues"));
  assert.ok(result.issues.includes("required-command-not-passed:typescript"));
});

test("global coverage recomputes report evidence and rejects same-count identity substitution", () => {
  const tampered = buildReport();
  tampered.bundleBudgetReport!.routeAnalysis.targets = [{ id: "a" }, { id: "b" }, { id: "x" }];
  tampered.bundleBudgetReport!.routeAnalysis.targetIdentities = ["a", "b", "x"];
  const result = evaluateGlobalPerformanceAuditCoverage(
    tampered,
    TARGET_IDS.length,
    TARGET_MANIFEST_FINGERPRINT,
    TARGET_IDS,
  );
  assert.equal(result.status, "blocked");
  assert.ok(result.issues.includes("target-manifest-integrity-mismatch"));
  assert.ok(result.issues.includes("target-identities-mismatch"));
  assert.equal(result.issues.includes("target-identity-count-mismatch"), false);
});

test("global release bundle gate requires a present and passed bundle report", () => {
  const noReport = evaluateGlobalReleaseBundleGate(
    null,
    TARGET_MANIFEST_FINGERPRINT,
    TARGET_IDS,
    STAGE05_BUNDLE_FINGERPRINT,
  );
  assert.equal(noReport.status, "blocked");
  assert.ok(noReport.issues.includes("global-release-report-unavailable"));
  assert.ok(noReport.issues.includes("bundle-budget-report-unavailable"));

  const noBundle = evaluateGlobalReleaseBundleGate(
    buildReport({ bundleBudgetReport: null }),
    TARGET_MANIFEST_FINGERPRINT,
    TARGET_IDS,
    STAGE05_BUNDLE_FINGERPRINT,
  );
  assert.equal(noBundle.status, "blocked");
  assert.ok(noBundle.issues.includes("bundle-budget-report-unavailable"));

  const failedBundleReport = buildReport();
  failedBundleReport.bundleBudgetReport!.status = "failed";
  const failedBundle = evaluateGlobalReleaseBundleGate(
    failedBundleReport,
    TARGET_MANIFEST_FINGERPRINT,
    TARGET_IDS,
    STAGE05_BUNDLE_FINGERPRINT,
  );
  assert.equal(failedBundle.status, "blocked");
  assert.ok(failedBundle.issues.includes("bundle-budget-report-not-passed"));
});

test("global release bundle gate recomputes targets and rejects same-count substitution", () => {
  const report = buildReport();
  report.bundleBudgetReport!.routeAnalysis.targets = [{ id: "a" }, { id: "b" }, { id: "x" }];
  report.bundleBudgetReport!.routeAnalysis.targetIdentities = ["a", "b", "x"];
  const result = evaluateGlobalReleaseBundleGate(
    report,
    TARGET_MANIFEST_FINGERPRINT,
    TARGET_IDS,
    STAGE05_BUNDLE_FINGERPRINT,
  );
  assert.equal(result.status, "blocked");
  assert.ok(result.issues.includes("target-manifest-integrity-mismatch"));
  assert.ok(result.issues.includes("target-identities-mismatch"));
});

test("global release bundle gate binds stage 06 to the stage 05 bundle fingerprint", () => {
  const matched = evaluateGlobalReleaseBundleGate(
    buildReport(),
    TARGET_MANIFEST_FINGERPRINT,
    TARGET_IDS,
    STAGE05_BUNDLE_FINGERPRINT,
  );
  assert.equal(matched.status, "passed");
  assert.deepEqual(matched.issues, []);

  const report = buildReport();
  report.bundleBudgetReport!.fingerprint = "b".repeat(64);
  const mismatched = evaluateGlobalReleaseBundleGate(
    report,
    TARGET_MANIFEST_FINGERPRINT,
    TARGET_IDS,
    STAGE05_BUNDLE_FINGERPRINT,
  );
  assert.equal(mismatched.status, "blocked");
  assert.ok(mismatched.issues.includes("stage05-bundle-fingerprint-mismatch"));
});
