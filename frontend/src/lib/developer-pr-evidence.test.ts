import assert from "node:assert/strict";
import test from "node:test";

import {
  validateDeveloperPrEvidence,
  type DeveloperPrEvidenceContext,
} from "./developer-pr-evidence";

const context: DeveloperPrEvidenceContext = {
  workflowRunId: "workflow-current",
  contractVersion: "2026.08.27.9",
  scopeIdentity: "global:global",
  sourceFingerprint: "a".repeat(64),
  targetManifestFingerprint: "b".repeat(64),
};

function validEvidence() {
  const capturedAt = new Date();
  const expiresAt = new Date(capturedAt.getTime() + 10 * 60 * 1000);
  const consumedAt = new Date(capturedAt.getTime() + 1_000);
  return {
    schemaVersion: 1,
    prUrl: "https://github.com/acme/platform/pull/42",
    repository: "acme/platform",
    prNumber: 42,
    headSha: "abcdef12".repeat(5),
    ...context,
    reviewDecision: "approved",
    checks: [
      { name: "source-lock", status: "passed", appSlug: "github-actions", workflowName: "B2B verification", workflowPath: ".github/workflows/verify.yml", event: "pull_request" },
      { name: "backend-contracts", status: "passed", appSlug: "github-actions", workflowName: "B2B verification", workflowPath: ".github/workflows/verify.yml", event: "pull_request" },
      { name: "frontend-types", status: "passed", url: "https://github.com/acme/platform/actions/runs/1", appSlug: "github-actions", workflowName: "B2B verification", workflowPath: ".github/workflows/verify.yml", event: "pull_request" },
    ],
    capturedAt: capturedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    verificationId: `prv1_${"x".repeat(43)}`,
    consumed: true,
    consumedAt: consumedAt.toISOString(),
    verifiedBy: "github-cli",
  };
}

test("accepts a successful GitHub PR evidence document bound to the workflow", () => {
  const result = validateDeveloperPrEvidence(validEvidence(), context);
  assert.deepEqual(result.issues, []);
  assert.equal(result.evidence?.prUrl, validEvidence().prUrl);
  assert.equal(result.evidence?.evidenceFingerprint.length, 64);
});

test("fails closed for stale workflow fingerprints and non-passing checks", () => {
  const result = validateDeveloperPrEvidence({
    ...validEvidence(),
    sourceFingerprint: "c".repeat(64),
    checks: [
      { name: "source-lock", status: "passed", appSlug: "github-actions", workflowName: "B2B verification", workflowPath: ".github/workflows/verify.yml", event: "pull_request" },
      { name: "backend-contracts", status: "passed", appSlug: "github-actions", workflowName: "B2B verification", workflowPath: ".github/workflows/verify.yml", event: "pull_request" },
      { name: "frontend-types", status: "pending", appSlug: "github-actions", workflowName: "B2B verification", workflowPath: ".github/workflows/verify.yml", event: "pull_request" },
    ],
  }, context);
  assert.equal(result.evidence, null);
  assert.deepEqual(result.issues, ["checks-not-passed", "missing-required-check:frontend-types", "source-fingerprint-mismatch"]);
});

test("requires an approved review and every shared-contract CI check", () => {
  const trustedSourceLockCheck = validEvidence().checks[0];
  const result = validateDeveloperPrEvidence({
    ...validEvidence(),
    reviewDecision: "changes_requested",
    checks: [trustedSourceLockCheck],
  }, context);
  assert.equal(result.evidence, null);
  assert.deepEqual(result.issues, [
    "missing-required-check:backend-contracts",
    "missing-required-check:frontend-types",
    "review-not-approved",
  ]);
});

test("requires a real GitHub pull request URL and trusted backend verifier", () => {
  assert.deepEqual(
    validateDeveloperPrEvidence({ ...validEvidence(), prUrl: "https://example.com/pull/42" }, context).issues,
    ["invalid-github-pr-url", "pr-number-mismatch", "repository-mismatch"],
  );
  assert.deepEqual(validateDeveloperPrEvidence({ ...validEvidence(), verifiedBy: "browser" }, context).issues, ["untrusted-verifier"]);
});

test("rejects a backend response whose repository or PR number does not match the verified URL", () => {
  assert.deepEqual(validateDeveloperPrEvidence({ ...validEvidence(), repository: "other/platform" }, context).issues, ["repository-mismatch"]);
  assert.deepEqual(validateDeveloperPrEvidence({ ...validEvidence(), prNumber: 41 }, context).issues, ["pr-number-mismatch"]);
});

test("rejects expired evidence and evidence rebound to another workflow run", () => {
  const expired = {
    ...validEvidence(),
    capturedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    consumedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    workflowRunId: "workflow-other",
  };
  assert.deepEqual(validateDeveloperPrEvidence(expired, context).issues, ["evidence-expired", "workflow-run-mismatch"]);
});

test("requires one-time consumption and exact trusted workflow provenance", () => {
  const result = validateDeveloperPrEvidence({
    ...validEvidence(),
    consumed: false,
    checks: validEvidence().checks.map((check) => check.name === "frontend-types"
      ? { ...check, workflowPath: ".github/workflows/not-trusted.yml" }
      : check),
  }, context);
  assert.deepEqual(result.issues, ["untrusted-check-provenance:frontend-types", "verification-not-consumed"]);
});
