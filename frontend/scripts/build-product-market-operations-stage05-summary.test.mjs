import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCT_MARKET_OPERATIONS_PAGE_IDENTITY,
  buildProductMarketOperationsStage05Evidence,
  parseProductMarketOperationsStage05Arguments,
} from "./build-product-market-operations-stage05-summary.mjs";
import { fingerprintDeveloperWorkflowValue } from "../src/lib/developer-workflow-target-manifest.mjs";

const metricIds = [
  "visualReadyMs",
  "editReadyMs",
  "interactiveReadyMs",
  "domContentLoadedMs",
  "firstContentfulPaintMs",
  "largestContentfulPaintMs",
  "scriptEncodedBytes",
  "totalEncodedBytes",
  "scriptTransferBytes",
  "totalTransferBytes",
  "resourceCount",
  "duplicateRequestExcess",
  "mutationRequestCount",
  "longTaskCount",
  "longTaskTotalMs",
  "maxLongTaskMs",
  "layoutShiftScore",
];

function sample(readyMs) {
  const value = Object.fromEntries(metricIds.map((metricId) => [metricId, readyMs]));
  return {
    ...value,
    visualReadyMs: readyMs,
    editReadyMs: readyMs,
    interactiveReadyMs: readyMs,
    domContentLoadedMs: readyMs,
    firstContentfulPaintMs: readyMs,
    largestContentfulPaintMs: readyMs,
    scriptEncodedBytes: 200_000 + readyMs,
    totalEncodedBytes: 400_000 + readyMs,
    scriptTransferBytes: 100_000 + readyMs,
    totalTransferBytes: 300_000 + readyMs,
    resourceCount: 100,
    duplicateRequestExcess: 2,
    mutationRequestCount: 0,
    longTaskCount: 0,
    longTaskTotalMs: 0,
    maxLongTaskMs: 0,
    layoutShiftScore: 0,
    workspaceReadyMs: readyMs,
    hydratedReadyMs: readyMs,
    firstCardReadyMs: readyMs,
    failedRequestCount: 0,
    failedRequests: [],
    fallbackRequestCount: 0,
    fallbackRequests: [],
    mutationRequests: [],
    documentOverflow: false,
    renderedCards: 2,
    visibleOperationGroups: 2,
  };
}

function phase(values) {
  const samples = values.map(sample);
  const sorted = [...values].sort((left, right) => left - right);
  const medianValue = sorted.length % 2
    ? sorted[Math.floor(sorted.length / 2)]
    : (sorted[(sorted.length / 2) - 1] + sorted[sorted.length / 2]) / 2;
  return { median: sample(medianValue), p75: sample(sorted[Math.ceil(sorted.length * 0.75) - 1]), samples };
}

function signReport(report) {
  const signed = structuredClone(report);
  delete signed.reportFingerprint;
  signed.reportFingerprint = fingerprintDeveloperWorkflowValue(signed);
  return signed;
}

function baseReport(runId, values, measuredAt, sourceFingerprint, routeClosureFingerprint) {
  return {
    schemaVersion: 2,
    protocol: "page-dna-cold-repeat-median-p75-functional-parity",
    measurementProtocolFingerprint: "measurement-protocol-fingerprint",
    runId,
    label: runId,
    measuredAt,
    pageIdentity: PRODUCT_MARKET_OPERATIONS_PAGE_IDENTITY,
    sourceScope: "client_source",
    normalizedRoute: "/product-market?tab=operations",
    pageFactoryId: "client-source-product-market-operations",
    targetUrl: "http://127.0.0.1:3003/zb/client-source/product-market?tab=operations",
    sampleCount: values.length,
    environment: {
      origin: "http://127.0.0.1:3003",
      appMode: "development",
      browserName: "chromium",
      browserVersion: "140.0.0.0",
      browserVersionMajor: "140",
      channel: "chrome",
      navigationProtocol: "http/1.1",
      viewportId: "desktop",
      viewport: { width: 1440, height: 900 },
      sampleCount: values.length,
    },
    governance: {
      pageDnaFingerprint: "page-dna-fingerprint",
      targetManifestFingerprint: "target-manifest-fingerprint",
      contractVersions: { sharedOptimization: "2026.08.28.1" },
      targetSourceFingerprint: sourceFingerprint,
      builtRouteClosure: { fingerprint: routeClosureFingerprint },
    },
    responsiveCoverage: [{ id: "desktop", status: "passed", issues: [] }],
    cold: phase(values),
    repeat: phase(values),
    repeatComparison: { verdict: "unchanged", functionalParity: { status: "passed", issues: [] } },
    optimizationComparison: null,
    baselineRef: null,
  };
}

function candidateReport(runId, values, measuredAt, baseline, verdict) {
  const report = baseReport(runId, values, measuredAt, "candidate-source", "candidate-route-closure");
  report.optimizationComparison = {
    verdict,
    baselineRunId: baseline.runId,
    candidateRunId: report.runId,
    baselineReportFingerprint: baseline.reportFingerprint,
    baselineTargetSourceFingerprint: baseline.governance.targetSourceFingerprint,
    candidateTargetSourceFingerprint: report.governance.targetSourceFingerprint,
    baselineRouteClosureFingerprint: baseline.governance.builtRouteClosure.fingerprint,
    candidateRouteClosureFingerprint: report.governance.builtRouteClosure.fingerprint,
    responsiveParity: { status: "passed", issues: [] },
    cold: { verdict, environmentIssues: [], functionalParity: { status: "passed", issues: [] } },
    repeat: { verdict, environmentIssues: [], functionalParity: { status: "passed", issues: [] } },
  };
  return signReport(report);
}

function fixture() {
  const baselineOne = signReport(baseReport(
    "baseline-1",
    [100, 100],
    "2026-08-28T01:00:00.000Z",
    "baseline-source",
    "baseline-route-closure",
  ));
  const baselineTwo = signReport(baseReport(
    "baseline-2",
    [100, 100],
    "2026-08-28T01:01:00.000Z",
    "baseline-source",
    "baseline-route-closure",
  ));
  const candidateOne = candidateReport(
    "candidate-1",
    [50, 50],
    "2026-08-28T01:02:00.000Z",
    baselineOne,
    "improved",
  );
  const candidateTwo = candidateReport(
    "candidate-2",
    [50, 400],
    "2026-08-28T01:03:00.000Z",
    baselineOne,
    "regressed",
  );
  const wrap = (report, role) => ({
    path: `${role}-${report.runId}.json`,
    artifactRef: `performance-report:${role}-${report.runId}.json#${report.reportFingerprint}`,
    report,
  });
  return {
    baselines: [wrap(baselineOne, "baseline"), wrap(baselineTwo, "baseline")],
    candidates: [wrap(candidateOne, "candidate"), wrap(candidateTwo, "candidate")],
  };
}

function resignEntry(entry) {
  entry.report = signReport(entry.report);
  entry.artifactRef = `performance-report:${entry.path}#${entry.report.reportFingerprint}`;
}

test("repeated baseline/candidate arguments remain ordered and strict", () => {
  assert.deepEqual(parseProductMarketOperationsStage05Arguments([
    "--baseline", "baseline-1.json",
    "--baseline=baseline-2.json",
    "--candidate", "candidate-1.json",
    "--candidate=candidate-2.json",
  ]), {
    help: false,
    baselines: ["baseline-1.json", "baseline-2.json"],
    candidates: ["candidate-1.json", "candidate-2.json"],
  });
  assert.throws(() => parseProductMarketOperationsStage05Arguments(["--baseline", "baseline.json"]), /candidate report is required/u);
  assert.throws(() => parseProductMarketOperationsStage05Arguments(["--unknown"]), /unknown argument/u);
});

test("all samples feed mean Stage 05 evidence while distribution conflict stays visible", () => {
  const inputs = fixture();
  const evidence = buildProductMarketOperationsStage05Evidence(inputs);
  assert.equal(evidence.benchmarkSummary.schemaVersion, 1);
  assert.equal(evidence.benchmarkSummary.evidenceQuality.aggregation, "mean");
  assert.equal(evidence.benchmarkSummary.evidenceQuality.baselineSamples, 4);
  assert.equal(evidence.benchmarkSummary.evidenceQuality.candidateSamples, 4);
  assert.equal(evidence.benchmarkSummary.evidenceQuality.runCount, 4);
  assert.equal(evidence.benchmarkSummary.evidenceQuality.confidence, "mixed");
  assert.ok(evidence.benchmarkSummary.evidenceQuality.notes.length <= 3);
  assert.equal(evidence.benchmarkSummary.cold.metrics.visualReadyMs.before, 100);
  assert.equal(evidence.benchmarkSummary.cold.metrics.visualReadyMs.after, 137.5);
  assert.equal(evidence.distributionAnalysis.mean.cold.outcome, "regressed");
  assert.equal(evidence.distributionAnalysis.median.cold.outcome, "improved");
  assert.equal(evidence.distributionAnalysis.p75.cold.outcome, "improved");
  assert.equal(evidence.overallOutcome.hasDistributionConflict, true);
  assert.equal(evidence.overallOutcome.outcome, "regressed");
  assert.deepEqual(
    evidence.independentCandidateVerdicts.map((entry) => entry.outcome),
    ["improved", "regressed"],
  );
  assert.equal(evidence.benchmarkSummary.artifactRefs.length, 4);
  assert.match(evidence.evidenceFingerprint, /^[0-9a-f]{64}$/u);
  const reordered = buildProductMarketOperationsStage05Evidence({
    baselines: [...inputs.baselines].reverse(),
    candidates: [...inputs.candidates].reverse(),
  });
  assert.equal(reordered.evidenceFingerprint, evidence.evidenceFingerprint);
});

test("protocol, environment, fingerprint and functional parity mismatches fail closed", () => {
  const environmentMismatch = fixture();
  environmentMismatch.candidates[0].report.environment.browserVersion = "141.0.0.0";
  resignEntry(environmentMismatch.candidates[0]);
  assert.throws(
    () => buildProductMarketOperationsStage05Evidence(environmentMismatch),
    /protocol or environment does not match/u,
  );

  const parityMismatch = fixture();
  parityMismatch.candidates[0].report.optimizationComparison.cold.functionalParity.status = "failed";
  resignEntry(parityMismatch.candidates[0]);
  assert.throws(
    () => buildProductMarketOperationsStage05Evidence(parityMismatch),
    /functional parity failed/u,
  );

  const fingerprintMismatch = fixture();
  fingerprintMismatch.candidates[0].report.cold.samples[0].visualReadyMs += 1;
  assert.throws(
    () => buildProductMarketOperationsStage05Evidence(fingerprintMismatch),
    /reportFingerprint does not match/u,
  );

  const mixedBaselineSource = fixture();
  mixedBaselineSource.baselines[1].report.governance.targetSourceFingerprint = "other-baseline-source";
  resignEntry(mixedBaselineSource.baselines[1]);
  assert.throws(
    () => buildProductMarketOperationsStage05Evidence(mixedBaselineSource),
    /baseline reports mix target-source fingerprints/u,
  );
});
