import assert from "node:assert/strict";
import test from "node:test";

import {
  GLOBAL_VISUAL_AUDIT_REQUIRED_COMMANDS,
  evaluateGlobalVisualAuditCoverage,
} from "./developer-global-workflow-evidence";
import { getRequiredSharedOptimizationBudget, SHARED_OPTIMIZATION_CONTRACT } from "./developer-optimization-contract";
import type { PerformanceCodeAuditReport } from "./performance-code-audit";
import { fingerprintDeveloperWorkflowTargetManifest } from "./developer-workflow-target-manifest.mjs";
import { MEDIA_OPTIMIZATION_CONTRACT } from "./media-optimization-contract";

const TARGETS = [{ id: "a" }, { id: "b" }, { id: "c" }] as const;
const TARGET_IDS = TARGETS.map((target) => target.id);
const TARGET_MANIFEST_FINGERPRINT = fingerprintDeveloperWorkflowTargetManifest(TARGETS);
const reportBudget = (id: Parameters<typeof getRequiredSharedOptimizationBudget>[0]) => {
  const budget = getRequiredSharedOptimizationBudget(id);
  return { warning: budget.warning, limit: budget.limit, unit: budget.unit };
};

function report(): PerformanceCodeAuditReport {
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
      fingerprint: "bundle-fingerprint",
      contractVersion: SHARED_OPTIMIZATION_CONTRACT.version,
      mediaContractVersion: MEDIA_OPTIMIZATION_CONTRACT.version,
      status: "passed",
      routeAnalysis: {
        registeredPages: 3,
        analyzedRoutes: 3,
        totalRegisteredPages: 3,
        totalAnalyzedRoutes: 3,
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
    commands: GLOBAL_VISUAL_AUDIT_REQUIRED_COMMANDS.map((id) => ({
      id,
      status: "passed" as const,
      exitCode: 0,
      output: "passed",
    })),
    summary: {
      sourceFiles: 1,
      sourceBytes: 1,
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
  };
}

test("global visual coverage requires the exact registered target matrix", () => {
  assert.equal(evaluateGlobalVisualAuditCoverage(report(), 3, TARGET_MANIFEST_FINGERPRINT, TARGET_IDS).status, "passed");
  assert.equal(evaluateGlobalVisualAuditCoverage(report(), 0, "").status, "pending");
});

test("global visual coverage blocks incomplete runtime or route evidence", () => {
  const incomplete = report();
  incomplete.bundleBudgetReport!.routeAnalysis.analyzedRoutes = 2;
  incomplete.commands = incomplete.commands.map((command) => command.id === "responsive-runtime-matrix"
    ? { ...command, status: "failed" as const }
    : command);
  incomplete.bundleBudgetReport!.routeAnalysis.targetManifestFingerprint = "wrong-manifest";
  incomplete.bundleBudgetReport!.routeAnalysis.targetIdentities = ["a", "b"];
  incomplete.bundleBudgetReport!.routeAnalysis.targets = [{ id: "a" }, { id: "b" }];
  const result = evaluateGlobalVisualAuditCoverage(incomplete, 3, TARGET_MANIFEST_FINGERPRINT, TARGET_IDS);
  assert.equal(result.status, "blocked");
  assert.deepEqual(result.issues, [
    "analyzed-target-count-mismatch",
    "required-command-not-passed:responsive-runtime-matrix",
    "target-identities-mismatch",
    "target-identity-count-mismatch",
    "target-manifest-fingerprint-mismatch",
    "target-manifest-integrity-mismatch",
  ]);
});

test("global visual coverage rejects report identities that do not match their manifest targets", () => {
  const tampered = report();
  tampered.bundleBudgetReport!.routeAnalysis.targetIdentities = ["a", "b", "x"];
  const result = evaluateGlobalVisualAuditCoverage(tampered, 3, TARGET_MANIFEST_FINGERPRINT, TARGET_IDS);
  assert.equal(result.status, "blocked");
  assert.deepEqual(result.issues, ["target-identities-integrity-mismatch"]);
});
