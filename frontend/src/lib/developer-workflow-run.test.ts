import assert from "node:assert/strict";
import test from "node:test";

import {
  DEVELOPER_WORKFLOW_RUN_SCHEMA_VERSION,
  DEVELOPER_WORKFLOW_STAGES,
  buildDeveloperWorkflowScopeIdentity,
  createDeveloperWorkflowRun,
  downgradeExpiredDeveloperWorkflowReleaseEvidence,
  evaluateDeveloperWorkflowNextStep,
  fingerprintDeveloperWorkflowTargetManifest,
  fingerprintDeveloperWorkflowValue,
  getDeveloperWorkflowExecutionContext,
  loadDeveloperWorkflowRun,
  normalizeDeveloperWorkflowPerformanceBenchmarkSummary,
  normalizeDeveloperWorkflowRun,
  normalizeDeveloperWorkflowTargets,
  rebaseDeveloperWorkflowTargets,
  removeDeveloperWorkflowRun,
  saveDeveloperWorkflowRun,
  stableDeveloperWorkflowJson,
  updateDeveloperWorkflowArtifact,
  type DeveloperWorkflowStorage,
  type DeveloperWorkflowPerformanceBenchmarkSummary,
} from "./developer-workflow-run.ts";
import {
  DEVELOPER_WORKFLOW_TARGET_MANIFEST_SCHEMA_VERSION,
  buildDeveloperWorkflowRouteTarget,
} from "./developer-workflow-target-manifest.mjs";

const FIXED_TIME = "2026-08-27T08:00:00.000Z";

function createStageOnePayload(overrides: { excludedTargetIds?: readonly string[] } = {}) {
  return {
    targetIds: ["client-source-product-market-service"],
    loadPlanPolicyVersion: "2026.08.28.2",
    loadPlanProfileId: "client-source-product-market-service",
    loadPlanFingerprint: "load-plan-fingerprint-1",
    ...overrides,
  };
}

class MemoryStorage implements DeveloperWorkflowStorage {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function createPageRun() {
  return createDeveloperWorkflowRun({
    scope: "page",
    sourceScope: "client_source",
    normalizedRoute: "/zb/client-source/product-market?tab=service",
    contractVersion: "2026.08.27.6",
    sourceFingerprint: "source-hash-1",
    targets: [
      { id: "client-source-product-market-service", sourceScope: "client_source", normalizedRoute: "/zb/client-source/product-market?tab=service" },
    ],
    createdAt: FIXED_TIME,
  });
}

function createCompletedPageRun() {
  let run = updateDeveloperWorkflowArtifact(createPageRun(), "01", {
    status: "passed",
    payload: createStageOnePayload(),
    recordedAt: "2026-08-27T08:01:00.000Z",
  });
  run = updateDeveloperWorkflowArtifact(run, "02", {
    status: "passed",
    payload: { contractVersions: { shared: "2026.08.27.6" } },
    recordedAt: "2026-08-27T08:02:00.000Z",
  });
  run = updateDeveloperWorkflowArtifact(run, "03", {
    status: "passed",
    payload: { pageDnaFingerprint: "dna-1", fileKey: "figma-file", nodeId: null, revision: "r1" },
    recordedAt: "2026-08-27T08:03:00.000Z",
  });
  run = updateDeveloperWorkflowArtifact(run, "04", {
    status: "passed",
    payload: { pageDnaFingerprint: "dna-1", viewportIds: ["390", "768", "1440"], checkIds: ["responsive"] },
    recordedAt: "2026-08-27T08:04:00.000Z",
  });
  run = updateDeveloperWorkflowArtifact(run, "05", {
    status: "passed",
    payload: { metricIds: ["route-script"], budgetViolations: [] },
    recordedAt: "2026-08-27T08:05:00.000Z",
  });
  return updateDeveloperWorkflowArtifact(run, "06", {
    status: "passed",
    payload: { gateIds: ["typescript", "bundle-budget"], githubPr: "PR-1" },
    recordedAt: "2026-08-27T08:06:00.000Z",
  });
}

function createPerformanceBenchmarkSummary(
  overrides: Partial<DeveloperWorkflowPerformanceBenchmarkSummary> = {},
): DeveloperWorkflowPerformanceBenchmarkSummary {
  const phase = {
    outcome: "improved" as const,
    functionalParity: { status: "passed" as const, issues: [] },
    metrics: {
      visualReadyMs: { before: 1_200, after: 900, delta: -300, deltaPercent: -25, status: "improved" as const },
      interactiveReadyMs: { before: 1_500, after: 1_050, delta: -450, deltaPercent: -30, status: "improved" as const },
      scriptEncodedBytes: { before: 200_000, after: 160_000, delta: -40_000, deltaPercent: -20, status: "improved" as const },
    },
  };
  return {
    schemaVersion: 1,
    pageIdentity: "client_source:/product-market?tab=operations",
    baselineRunId: "operations-baseline-1",
    candidateRunId: "operations-candidate-1",
    outcome: "improved",
    artifactRefs: ["performance-report:operations-baseline-1", "performance-report:operations-candidate-1"],
    evidenceQuality: {
      aggregation: "mean",
      baselineSamples: 10,
      candidateSamples: 10,
      runCount: 4,
      confidence: "stable",
      notes: [],
    },
    fingerprints: {
      baselineReport: "baseline-report-fingerprint",
      candidateReport: "candidate-report-fingerprint",
      baselineSource: "baseline-source-fingerprint",
      candidateSource: "candidate-source-fingerprint",
      baselineRouteClosure: "baseline-route-closure-fingerprint",
      candidateRouteClosure: "candidate-route-closure-fingerprint",
    },
    cold: phase,
    repeat: phase,
    ...overrides,
  };
}

test("global identity is route-independent while page identity is route-bound", () => {
  const firstGlobal = buildDeveloperWorkflowScopeIdentity({
    scope: "global",
    sourceScope: "client_source",
    normalizedRoute: "/one",
  });
  const secondGlobal = buildDeveloperWorkflowScopeIdentity({
    scope: "global",
    sourceScope: "client_source",
    normalizedRoute: "/two",
  });
  assert.equal(firstGlobal, secondGlobal);
  assert.equal(firstGlobal, "global:client_source");
  assert.equal(firstGlobal.includes("one"), false);

  const firstPage = buildDeveloperWorkflowScopeIdentity({
    scope: "page",
    sourceScope: "client_source",
    normalizedRoute: "/one?b=2&a=1",
  });
  const equivalentPage = buildDeveloperWorkflowScopeIdentity({
    scope: "page",
    sourceScope: "client_source",
    normalizedRoute: "/one?a=1&b=2",
  });
  const secondPage = buildDeveloperWorkflowScopeIdentity({
    scope: "page",
    sourceScope: "client_source",
    normalizedRoute: "/two",
  });
  assert.equal(firstPage, equivalentPage);
  assert.notEqual(firstPage, secondPage);
});

test("canonical JSON and target manifest fingerprint are deterministic", () => {
  assert.equal(stableDeveloperWorkflowJson({ z: 1, a: [3, 2, 1] }), '{"a":[3,2,1],"z":1}');
  assert.match(fingerprintDeveloperWorkflowValue({ value: "stable" }), /^[0-9a-f]{64}$/u);
  assert.equal(
    fingerprintDeveloperWorkflowValue({ a: 1, z: [2, 3] }),
    "b02b902601adda5a264f6d461cafbfa7dc19f8653b98bfb260c885c4d44cedf7",
  );
  const left = fingerprintDeveloperWorkflowTargetManifest([
    { id: "page-b", version: "2" },
    "page-a",
    "page-a",
  ]);
  const right = fingerprintDeveloperWorkflowTargetManifest([
    { id: "page-a" },
    { id: "page-b", version: "2" },
  ]);
  const changed = fingerprintDeveloperWorkflowTargetManifest(["page-a", { id: "page-b", version: "3" }]);
  assert.equal(left, right);
  assert.notEqual(left, changed);
});

test("artifact writes are bound to the execution context that produced them", () => {
  const run = createPageRun();
  const expectedContext = getDeveloperWorkflowExecutionContext(run);
  const accepted = updateDeveloperWorkflowArtifact(run, "01", {
    status: "passed",
    payload: createStageOnePayload(),
    recordedAt: "2026-08-27T08:01:00.000Z",
    expectedContext,
  });
  assert.equal(accepted.artifacts["01"]?.status, "passed");

  const mismatches = [
    { runId: `${expectedContext.runId}-old` },
    { scope: "global" as const },
    { scopeIdentity: "page:client_source:%2Fold" },
    { sourceFingerprint: "old-source" },
    { contractVersion: "old-contract" },
    { targetManifestFingerprint: "old-target-manifest" },
  ];
  for (const mismatch of mismatches) {
    assert.throws(() => updateDeveloperWorkflowArtifact(run, "01", {
      status: "passed",
      payload: createStageOnePayload(),
      recordedAt: "2026-08-27T08:01:00.000Z",
      expectedContext: { ...expectedContext, ...mismatch },
    }), /stage 01 context mismatch/u);
  }
});

test("target manifest uses shared schema, normalized identities and code-unit ordering", () => {
  assert.equal(DEVELOPER_WORKFLOW_TARGET_MANIFEST_SCHEMA_VERSION, DEVELOPER_WORKFLOW_RUN_SCHEMA_VERSION);
  assert.deepEqual(
    normalizeDeveloperWorkflowTargets([{ id: "a" }, { id: "Z" }]).map((target) => target.id),
    ["Z", "a"],
  );
  assert.deepEqual(
    buildDeveloperWorkflowRouteTarget(" client_source ", "/product-market/?z=2&a=1#ignored", "complete"),
    {
      id: "client_source:/product-market?a=1&z=2",
      sourceScope: "client_source",
      normalizedRoute: "/product-market?a=1&z=2",
      version: "complete",
    },
  );
});

test("01-06 artifacts advance in order and complete the run", () => {
  let run = createPageRun();
  assert.deepEqual(evaluateDeveloperWorkflowNextStep(run), {
    complete: false,
    allowed: true,
    nextStage: "01",
    blockingStatus: null,
    reason: "ready",
  });
  assert.throws(() => updateDeveloperWorkflowArtifact(run, "02", {
    status: "passed",
    payload: { contractVersions: { shared: "1" } },
    recordedAt: FIXED_TIME,
  }), /out of order/u);

  run = updateDeveloperWorkflowArtifact(run, "01", {
    status: "passed",
    payload: createStageOnePayload(),
    recordedAt: "2026-08-27T08:01:00.000Z",
  });
  assert.equal(evaluateDeveloperWorkflowNextStep(run).nextStage, "02");

  run = updateDeveloperWorkflowArtifact(run, "02", {
    status: "failed",
    payload: { contractVersions: { shared: "2026.08.27.6" } },
    message: "contract mismatch",
    recordedAt: "2026-08-27T08:02:00.000Z",
  });
  assert.deepEqual(evaluateDeveloperWorkflowNextStep(run), {
    complete: false,
    allowed: false,
    nextStage: "02",
    blockingStatus: "failed",
    reason: "failed",
  });

  run = updateDeveloperWorkflowArtifact(run, "02", {
    status: "passed",
    payload: { contractVersions: { shared: "2026.08.27.6" }, inheritedFrom: "global:client_source" },
    recordedAt: "2026-08-27T08:03:00.000Z",
  });
  run = updateDeveloperWorkflowArtifact(run, "03", {
    status: "passed",
    payload: { pageDnaFingerprint: "dna-1", fileKey: "figma-file", nodeId: null, revision: "r1" },
    recordedAt: "2026-08-27T08:04:00.000Z",
  });
  run = updateDeveloperWorkflowArtifact(run, "04", {
    status: "passed",
    payload: { pageDnaFingerprint: "dna-1", viewportIds: ["390", "768", "1440"], checkIds: ["responsive", "overflow"] },
    recordedAt: "2026-08-27T08:05:00.000Z",
  });
  run = updateDeveloperWorkflowArtifact(run, "05", {
    status: "passed",
    payload: { metricIds: ["route-script"], budgetViolations: [] },
    recordedAt: "2026-08-27T08:06:00.000Z",
  });
  run = updateDeveloperWorkflowArtifact(run, "06", {
    status: "passed",
    payload: { gateIds: ["typescript", "bundle-budget"], githubPr: "PR-1" },
    recordedAt: "2026-08-27T08:07:00.000Z",
  });

  assert.equal(run.status, "passed");
  assert.equal(Object.keys(run.artifacts).length, DEVELOPER_WORKFLOW_STAGES.length);
  assert.deepEqual(evaluateDeveloperWorkflowNextStep(run), {
    complete: true,
    allowed: false,
    nextStage: null,
    blockingStatus: null,
    reason: "complete",
  });
});

test("tampering and target rebases fail closed as stale", () => {
  const stageOne = updateDeveloperWorkflowArtifact(createPageRun(), "01", {
    status: "passed",
    payload: createStageOnePayload(),
    recordedAt: "2026-08-27T08:01:00.000Z",
  });
  const tampered = JSON.parse(JSON.stringify(stageOne));
  tampered.artifacts["01"].payload.targetIds.push("unexpected-page");
  const normalized = normalizeDeveloperWorkflowRun(tampered);
  assert.ok(normalized);
  assert.equal(normalized.status, "stale");
  assert.equal(normalized.artifacts["01"]?.status, "stale");
  assert.ok(normalized.issues.some((issue) => issue.includes("fingerprint-mismatch")));
  assert.equal(evaluateDeveloperWorkflowNextStep(normalized).allowed, false);

  const rebased = rebaseDeveloperWorkflowTargets(
    stageOne,
    ["client-source-product-market-service", "client-source-product-market-layout"],
    "2026-08-27T08:02:00.000Z",
  );
  assert.notEqual(rebased.targetManifestFingerprint, stageOne.targetManifestFingerprint);
  assert.equal(rebased.status, "stale");
  assert.equal(rebased.artifacts["01"]?.status, "stale");
});

test("existing middle and release artifacts cannot bypass stale upstream stages", () => {
  const completed = createCompletedPageRun();
  assert.equal(completed.status, "passed");

  const changedStageOne = updateDeveloperWorkflowArtifact(completed, "01", {
    status: "passed",
    payload: createStageOnePayload({ excludedTargetIds: ["new-isolated-page"] }),
    recordedAt: "2026-08-27T09:00:00.000Z",
  });
  for (const stage of ["02", "03", "04", "05", "06"] as const) {
    assert.equal(changedStageOne.artifacts[stage]?.status, "stale");
  }

  assert.throws(() => updateDeveloperWorkflowArtifact(changedStageOne, "06", {
    status: "passed",
    payload: { gateIds: ["typescript", "bundle-budget"], githubPr: "PR-2" },
    recordedAt: "2026-08-27T09:01:00.000Z",
  }), /stage 06 requires fresh passed stage 02; found stale/u);
  assert.equal(changedStageOne.artifacts["06"]?.status, "stale");

  const repairedStageTwo = updateDeveloperWorkflowArtifact(changedStageOne, "02", {
    status: "passed",
    payload: { contractVersions: { shared: "2026.08.27.6" } },
    recordedAt: "2026-08-27T09:02:00.000Z",
  });
  assert.equal(repairedStageTwo.artifacts["02"]?.status, "passed");
  assert.equal(repairedStageTwo.artifacts["03"]?.status, "stale");

  assert.throws(() => updateDeveloperWorkflowArtifact(repairedStageTwo, "04", {
    status: "passed",
    payload: { pageDnaFingerprint: "dna-2", viewportIds: ["390", "768", "1440"], checkIds: ["responsive"] },
    recordedAt: "2026-08-27T09:03:00.000Z",
  }), /stage 04 requires fresh passed stage 03; found stale/u);
  assert.equal(repairedStageTwo.artifacts["04"]?.status, "stale");
});

test("replaying semantically identical evidence is idempotent while semantic changes stale downstream", () => {
  const completed = createCompletedPageRun();
  const originalStageOneFingerprint = completed.artifacts["01"]?.fingerprint;
  const replayed = updateDeveloperWorkflowArtifact(completed, "01", {
    status: "passed",
    payload: createStageOnePayload(),
    message: "same evidence, refreshed presentation message",
    recordedAt: "2026-08-27T10:00:00.000Z",
  });

  assert.notEqual(replayed.artifacts["01"]?.fingerprint, originalStageOneFingerprint);
  assert.equal(replayed.status, "passed");
  for (const stage of ["02", "03", "04", "05", "06"] as const) {
    assert.equal(replayed.artifacts[stage]?.status, "passed");
  }

  const changedEvidence = updateDeveloperWorkflowArtifact(replayed, "01", {
    status: "passed",
    payload: createStageOnePayload(),
    artifactRefs: ["scope-manifest:revision-2"],
    message: "semantic evidence reference changed",
    recordedAt: "2026-08-27T10:01:00.000Z",
  });
  for (const stage of ["02", "03", "04", "05", "06"] as const) {
    assert.equal(changedEvidence.artifacts[stage]?.status, "stale");
  }
});

test("stage 05 benchmark summary stays compact and semantic changes stale stage 06", () => {
  const completed = createCompletedPageRun();
  const benchmarkSummary = createPerformanceBenchmarkSummary();
  const benchmarkArtifactRefs = [...benchmarkSummary.artifactRefs];
  const withBenchmark = updateDeveloperWorkflowArtifact(completed, "05", {
    status: "passed",
    payload: {
      metricIds: ["visualReadyMs", "interactiveReadyMs", "scriptEncodedBytes"],
      budgetViolations: [],
      artifactRefs: benchmarkArtifactRefs,
      benchmarkSummary,
    },
    artifactRefs: benchmarkArtifactRefs,
    recordedAt: "2026-08-27T11:00:00.000Z",
  });
  assert.equal(withBenchmark.artifacts["05"]?.status, "passed");
  assert.equal(withBenchmark.artifacts["06"]?.status, "stale");

  const normalizedSummary = normalizeDeveloperWorkflowPerformanceBenchmarkSummary({
    ...benchmarkSummary,
    artifactRefs: [benchmarkArtifactRefs[1], benchmarkArtifactRefs[0], benchmarkArtifactRefs[1]],
    cold: {
      ...benchmarkSummary.cold,
      metrics: {
        ...benchmarkSummary.cold.metrics,
        unexpectedMetric: {
          before: 400_000,
          after: 350_000,
          delta: -50_000,
          deltaPercent: -12.5,
          status: "improved",
        },
      },
    },
  });
  assert.ok(normalizedSummary);
  assert.deepEqual(normalizedSummary.artifactRefs, [...benchmarkArtifactRefs].sort());
  assert.equal("unexpectedMetric" in normalizedSummary.cold.metrics, false);
  assert.equal(normalizeDeveloperWorkflowPerformanceBenchmarkSummary({ ...benchmarkSummary, artifactRefs: [] }), null);

  const released = updateDeveloperWorkflowArtifact(withBenchmark, "06", {
    status: "passed",
    payload: { gateIds: ["typescript", "bundle-budget"], githubPr: "PR-2" },
    recordedAt: "2026-08-27T11:01:00.000Z",
  });
  const replayed = updateDeveloperWorkflowArtifact(released, "05", {
    status: "passed",
    payload: {
      metricIds: ["visualReadyMs", "interactiveReadyMs", "scriptEncodedBytes"],
      budgetViolations: [],
      artifactRefs: benchmarkArtifactRefs,
      benchmarkSummary,
    },
    artifactRefs: benchmarkArtifactRefs,
    message: "same benchmark evidence with a refreshed presentation message",
    recordedAt: "2026-08-27T11:02:00.000Z",
  });
  assert.equal(replayed.artifacts["06"]?.status, "passed");

  const changedBenchmarkSummary = createPerformanceBenchmarkSummary({
    outcome: "regressed",
    fingerprints: {
      ...benchmarkSummary.fingerprints,
      candidateReport: "candidate-report-fingerprint-2",
      candidateSource: "candidate-source-fingerprint-2",
    },
    cold: {
      ...benchmarkSummary.cold,
      outcome: "regressed",
      metrics: {
        ...benchmarkSummary.cold.metrics,
        visualReadyMs: { before: 1_200, after: 1_500, delta: 300, deltaPercent: 25, status: "regressed" },
      },
    },
  });
  const changed = updateDeveloperWorkflowArtifact(replayed, "05", {
    status: "passed",
    payload: {
      metricIds: ["visualReadyMs", "interactiveReadyMs", "scriptEncodedBytes"],
      budgetViolations: [],
      artifactRefs: benchmarkArtifactRefs,
      benchmarkSummary: changedBenchmarkSummary,
    },
    artifactRefs: benchmarkArtifactRefs,
    recordedAt: "2026-08-27T11:03:00.000Z",
  });
  assert.equal(changed.artifacts["06"]?.status, "stale");
});

test("stage 05 evidence quality is v1-compatible, bounded, idempotent and semantic", () => {
  const benchmarkSummary = createPerformanceBenchmarkSummary();
  const { evidenceQuality, ...legacySummary } = benchmarkSummary;
  assert.ok(evidenceQuality);
  const normalizedLegacy = normalizeDeveloperWorkflowPerformanceBenchmarkSummary(legacySummary);
  assert.ok(normalizedLegacy);
  assert.equal(normalizedLegacy.schemaVersion, 1);
  assert.equal("evidenceQuality" in normalizedLegacy, false);
  assert.equal(normalizeDeveloperWorkflowPerformanceBenchmarkSummary({
    ...benchmarkSummary,
    evidenceQuality: {
      ...evidenceQuality,
      notes: ["one", "two", "three", "four"],
    },
  }), null);

  const artifactRefs = [...benchmarkSummary.artifactRefs];
  const stage05Payload = {
    metricIds: ["visualReadyMs", "interactiveReadyMs", "scriptEncodedBytes"],
    budgetViolations: [] as string[],
    artifactRefs,
    benchmarkSummary,
  };
  const withEvidenceQuality = updateDeveloperWorkflowArtifact(createCompletedPageRun(), "05", {
    status: "passed",
    payload: stage05Payload,
    artifactRefs,
    recordedAt: "2026-08-27T12:00:00.000Z",
  });
  assert.equal(withEvidenceQuality.artifacts["06"]?.status, "stale");

  const released = updateDeveloperWorkflowArtifact(withEvidenceQuality, "06", {
    status: "passed",
    payload: { gateIds: ["typescript", "bundle-budget"], githubPr: "PR-3" },
    recordedAt: "2026-08-27T12:01:00.000Z",
  });
  const replayed = updateDeveloperWorkflowArtifact(released, "05", {
    status: "passed",
    payload: stage05Payload,
    artifactRefs,
    message: "same evidence-quality payload",
    recordedAt: "2026-08-27T12:02:00.000Z",
  });
  assert.equal(replayed.artifacts["06"]?.status, "passed");

  const changedQualitySummary = createPerformanceBenchmarkSummary({
    evidenceQuality: {
      ...evidenceQuality,
      runCount: 5,
      confidence: "mixed",
      notes: ["independent candidate verdicts disagree"],
    },
  });
  const changedQuality = updateDeveloperWorkflowArtifact(replayed, "05", {
    status: "passed",
    payload: { ...stage05Payload, benchmarkSummary: changedQualitySummary },
    artifactRefs,
    recordedAt: "2026-08-27T12:03:00.000Z",
  });
  assert.equal(changedQuality.artifacts["06"]?.status, "stale");
});

test("expired stage 06 GitHub PR evidence is downgraded outside the workbench lifecycle", () => {
  const liveRelease = updateDeveloperWorkflowArtifact(createCompletedPageRun(), "06", {
    status: "passed",
    payload: {
      gateIds: ["typescript", "bundle-budget", "github-pr"],
      githubPr: "https://github.com/acme/platform/pull/42",
      githubHeadSha: "head-sha-42",
      githubChecks: [{ name: "quality", status: "completed", conclusion: "success" }],
      githubReviewDecision: "approved",
      prEvidenceFingerprint: "pr-evidence-42",
      verificationExpiresAt: "2026-08-27T13:00:00.000Z",
      artifactRefs: [
        "quality-report:local-42",
        "github-pr-evidence:pr-evidence-42",
        "https://github.com/acme/platform/pull/42",
      ],
      passedGateIds: ["typescript", "bundle-budget", "github-pr"],
      pendingGateIds: [],
      blockedGateIds: [],
      gateResults: [{ id: "github-pr", status: "passed" }],
    },
    artifactRefs: [
      "quality-report:local-42",
      "github-pr-evidence:pr-evidence-42",
      "https://github.com/acme/platform/pull/42",
    ],
    recordedAt: "2026-08-27T12:00:00.000Z",
  });

  const stillLive = downgradeExpiredDeveloperWorkflowReleaseEvidence(
    liveRelease,
    Date.parse("2026-08-27T12:59:59.999Z"),
  );
  assert.strictEqual(stillLive, liveRelease);

  const expired = downgradeExpiredDeveloperWorkflowReleaseEvidence(
    liveRelease,
    new Date("2026-08-27T13:00:00.000Z"),
  );
  assert.notStrictEqual(expired, liveRelease);
  assert.equal(liveRelease.artifacts["06"]?.status, "passed");
  assert.equal(expired.status, "pending");
  assert.equal(expired.updatedAt, "2026-08-27T13:00:00.000Z");
  assert.equal(expired.artifacts["06"]?.status, "pending");
  assert.deepEqual(expired.artifacts["06"]?.artifactRefs, ["quality-report:local-42"]);
  assert.deepEqual(expired.artifacts["06"]?.payload.artifactRefs, ["quality-report:local-42"]);
  assert.equal(expired.artifacts["06"]?.payload.githubPr, null);
  assert.equal(expired.artifacts["06"]?.payload.githubHeadSha, null);
  assert.deepEqual(expired.artifacts["06"]?.payload.githubChecks, []);
  assert.equal(expired.artifacts["06"]?.payload.githubReviewDecision, null);
  assert.equal(expired.artifacts["06"]?.payload.prEvidenceFingerprint, null);
  assert.equal(expired.artifacts["06"]?.payload.verificationExpiresAt, null);
  assert.deepEqual(expired.artifacts["06"]?.payload.passedGateIds, []);
  assert.deepEqual(expired.artifacts["06"]?.payload.pendingGateIds, ["github-pr"]);
  assert.deepEqual(expired.artifacts["06"]?.payload.blockedGateIds, []);
  assert.deepEqual(expired.artifacts["06"]?.payload.gateResults, []);
});

test("missing or invalid stage 06 expiry fails closed while non-passed evidence is unchanged", () => {
  for (const verificationExpiresAt of [undefined, null, "", "not-a-timestamp"] as const) {
    const released = updateDeveloperWorkflowArtifact(createCompletedPageRun(), "06", {
      status: "passed",
      payload: {
        gateIds: ["github-pr"],
        githubPr: "https://github.com/acme/platform/pull/43",
        verificationExpiresAt,
        passedGateIds: ["github-pr"],
      },
      recordedAt: "2026-08-27T12:00:00.000Z",
    });
    const downgraded = downgradeExpiredDeveloperWorkflowReleaseEvidence(
      released,
      Date.parse("2026-08-27T12:30:00.000Z"),
    );
    assert.equal(downgraded.artifacts["06"]?.status, "pending");
    assert.deepEqual(downgraded.artifacts["06"]?.payload.pendingGateIds, ["github-pr"]);
  }

  const pending = updateDeveloperWorkflowArtifact(createCompletedPageRun(), "06", {
    status: "pending",
    payload: {
      gateIds: ["github-pr"],
      githubPr: "https://github.com/acme/platform/pull/44",
      verificationExpiresAt: "2026-08-27T12:01:00.000Z",
      pendingGateIds: ["github-pr"],
    },
    recordedAt: "2026-08-27T12:00:00.000Z",
  });
  assert.strictEqual(
    downgradeExpiredDeveloperWorkflowReleaseEvidence(pending, Date.parse("2026-08-27T13:00:00.000Z")),
    pending,
  );
});

test("localStorage helpers round-trip safely and remain SSR-safe", () => {
  const storage = new MemoryStorage();
  const run = createPageRun();
  assert.equal(saveDeveloperWorkflowRun(run, storage), true);
  const loaded = loadDeveloperWorkflowRun(run.scopeIdentity, storage);
  assert.ok(loaded);
  assert.equal(loaded.fingerprint, run.fingerprint);
  assert.equal(loaded.scopeIdentity, run.scopeIdentity);

  const stale = loadDeveloperWorkflowRun(run.scopeIdentity, storage, { expectedSourceFingerprint: "new-source" });
  assert.ok(stale);
  assert.equal(stale.status, "stale");
  assert.ok(stale.issues.includes("source-fingerprint-stale"));

  assert.equal(removeDeveloperWorkflowRun(run.scopeIdentity, storage), true);
  assert.equal(loadDeveloperWorkflowRun(run.scopeIdentity, storage), null);
  assert.equal(saveDeveloperWorkflowRun(run), false);
  assert.equal(loadDeveloperWorkflowRun(run.scopeIdentity), null);
});
