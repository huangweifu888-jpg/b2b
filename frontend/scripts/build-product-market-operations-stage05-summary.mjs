import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { fingerprintDeveloperWorkflowValue } from "../src/lib/developer-workflow-target-manifest.mjs";

const frontendRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(frontendRoot, "..");
const outputDirectory = resolve(repositoryRoot, "release/local-performance/artifacts");

export const PRODUCT_MARKET_OPERATIONS_PAGE_IDENTITY = "client_source:/product-market?tab=operations";
export const PRODUCT_MARKET_OPERATIONS_STAGE05_SUMMARY_SCHEMA_VERSION = 1;
export const PRODUCT_MARKET_OPERATIONS_PERFORMANCE_REPORT_SCHEMA_VERSION = 2;
export const PRODUCT_MARKET_OPERATIONS_PERFORMANCE_PROTOCOL = "page-dna-cold-repeat-median-p75-functional-parity";

const measuredMetricIds = Object.freeze([
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
]);

const benchmarkMetricIds = Object.freeze([
  "visualReadyMs",
  "editReadyMs",
  "interactiveReadyMs",
  "domContentLoadedMs",
  "firstContentfulPaintMs",
  "largestContentfulPaintMs",
  "scriptEncodedBytes",
  "totalEncodedBytes",
  "resourceCount",
  "duplicateRequestExcess",
]);

const primarySpeedMetricIds = Object.freeze([
  "visualReadyMs",
  "editReadyMs",
  "domContentLoadedMs",
  "firstContentfulPaintMs",
  "largestContentfulPaintMs",
]);

const comparisonOutcomes = new Set(["improved", "regressed", "unchanged"]);
const phaseIds = Object.freeze(["cold", "repeat"]);
const aggregationIds = Object.freeze(["mean", "median", "p75"]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(`Product Market operations Stage 05 summary: ${message}`);
}

function canonicalFingerprint(value) {
  return fingerprintDeveloperWorkflowValue(value);
}

function normalizeArtifactPath(path) {
  const absolutePath = resolve(path);
  const repositoryPath = relative(repositoryRoot, absolutePath).replaceAll("\\", "/");
  return repositoryPath && !repositoryPath.startsWith("../")
    ? repositoryPath
    : absolutePath.replaceAll("\\", "/");
}

function reportArtifactRef(path, report) {
  return `performance-report:${normalizeArtifactPath(path)}#${report.reportFingerprint}`;
}

function unsignedReport(report) {
  const { reportFingerprint: _reportFingerprint, ...unsigned } = report;
  return unsigned;
}

function assertReportFingerprint(report, label) {
  const actual = cleanString(report.reportFingerprint);
  assertCondition(actual.length > 0, `${label} is missing reportFingerprint`);
  const expected = canonicalFingerprint(unsignedReport(report));
  assertCondition(actual === expected, `${label} reportFingerprint does not match its JSON payload`);
}

function comparableContext(report) {
  return {
    schemaVersion: report.schemaVersion,
    protocol: report.protocol,
    measurementProtocolFingerprint: report.measurementProtocolFingerprint,
    pageIdentity: report.pageIdentity,
    sourceScope: report.sourceScope,
    normalizedRoute: report.normalizedRoute,
    pageFactoryId: report.pageFactoryId,
    targetUrl: report.targetUrl,
    sampleCount: report.sampleCount,
    environment: {
      origin: report.environment?.origin,
      appMode: report.environment?.appMode,
      browserName: report.environment?.browserName,
      browserVersion: report.environment?.browserVersion,
      browserVersionMajor: report.environment?.browserVersionMajor,
      channel: report.environment?.channel,
      navigationProtocol: report.environment?.navigationProtocol,
      viewportId: report.environment?.viewportId,
      viewport: report.environment?.viewport,
      sampleCount: report.environment?.sampleCount,
    },
    governance: {
      pageDnaFingerprint: report.governance?.pageDnaFingerprint,
      targetManifestFingerprint: report.governance?.targetManifestFingerprint,
      contractVersions: report.governance?.contractVersions,
    },
  };
}

function fallbackSignature(sample) {
  return JSON.stringify((sample.fallbackRequests || [])
    .map((failure) => `${failure.method} ${failure.url} ${failure.errorText}`)
    .sort());
}

function assertSample(sample, label, expectedFunctionality) {
  assertCondition(isRecord(sample), `${label} must be an object`);
  for (const metricId of measuredMetricIds) {
    assertCondition(
      typeof sample[metricId] === "number" && Number.isFinite(sample[metricId]) && sample[metricId] >= 0,
      `${label}.${metricId} must be a finite non-negative number`,
    );
  }
  assertCondition(sample.workspaceReadyMs > 0, `${label} workspace is not ready`);
  assertCondition(sample.hydratedReadyMs > 0, `${label} hydration is not ready`);
  assertCondition(sample.firstCardReadyMs > 0, `${label} first card is not ready`);
  assertCondition(sample.failedRequestCount === 0, `${label} has failed requests`);
  assertCondition(sample.mutationRequestCount === 0, `${label} has passive mutations`);
  assertCondition(sample.documentOverflow === false, `${label} has horizontal overflow`);
  const functionality = {
    renderedCards: sample.renderedCards,
    visibleOperationGroups: sample.visibleOperationGroups,
    fallbackSignature: fallbackSignature(sample),
  };
  if (!expectedFunctionality.value) expectedFunctionality.value = functionality;
  assertCondition(
    canonicalFingerprint(functionality) === canonicalFingerprint(expectedFunctionality.value),
    `${label} does not preserve rendered cards, visible groups, or fallback behavior`,
  );
}

function assertReportShape(entry, expectedFunctionality) {
  const { report, role, label } = entry;
  assertCondition(isRecord(report), `${label} must contain a JSON object`);
  assertCondition(report.schemaVersion === PRODUCT_MARKET_OPERATIONS_PERFORMANCE_REPORT_SCHEMA_VERSION, `${label} must use report schema v2`);
  assertCondition(report.pageIdentity === PRODUCT_MARKET_OPERATIONS_PAGE_IDENTITY, `${label} targets ${String(report.pageIdentity)} instead of ${PRODUCT_MARKET_OPERATIONS_PAGE_IDENTITY}`);
  assertCondition(report.protocol === PRODUCT_MARKET_OPERATIONS_PERFORMANCE_PROTOCOL, `${label} has unsupported protocol ${String(report.protocol)}`);
  assertCondition(report.sourceScope === "client_source", `${label} has invalid sourceScope`);
  assertCondition(report.normalizedRoute === "/product-market?tab=operations", `${label} has invalid normalizedRoute`);
  assertCondition(report.pageFactoryId === "client-source-product-market-operations", `${label} has invalid pageFactoryId`);
  assertCondition(cleanString(report.measurementProtocolFingerprint).length > 0, `${label} is missing measurementProtocolFingerprint`);
  assertCondition(cleanString(report.runId).length > 0, `${label} is missing runId`);
  assertCondition(Number.isFinite(Date.parse(report.measuredAt)), `${label} has an invalid measuredAt`);
  assertCondition(Number.isInteger(report.sampleCount) && report.sampleCount > 0, `${label} has an invalid sampleCount`);
  assertCondition(isRecord(report.environment) && isRecord(report.governance), `${label} is missing environment or governance evidence`);
  assertCondition(cleanString(report.governance.pageDnaFingerprint).length > 0, `${label} is missing page-DNA fingerprint`);
  assertCondition(cleanString(report.governance.targetManifestFingerprint).length > 0, `${label} is missing target-manifest fingerprint`);
  assertCondition(cleanString(report.governance.targetSourceFingerprint).length > 0, `${label} is missing target-source fingerprint`);
  assertCondition(cleanString(report.governance.builtRouteClosure?.fingerprint).length > 0, `${label} is missing built route-closure fingerprint`);
  assertCondition(isRecord(report.governance.contractVersions), `${label} is missing contract versions`);
  assertReportFingerprint(report, label);
  assertCondition(entry.artifactRef.endsWith(`#${report.reportFingerprint}`), `${label} artifactRef does not bind the report fingerprint`);

  for (const phaseId of phaseIds) {
    const phase = report[phaseId];
    assertCondition(isRecord(phase) && Array.isArray(phase.samples), `${label}.${phaseId}.samples is missing`);
    assertCondition(phase.samples.length === report.sampleCount, `${label}.${phaseId} sample count does not match report.sampleCount`);
    phase.samples.forEach((sample, index) => assertSample(sample, `${label}.${phaseId}[${index}]`, expectedFunctionality));
  }
  assertCondition(report.cold.samples.length === report.repeat.samples.length, `${label} cold/repeat sample counts differ`);
  assertCondition(report.repeatComparison?.functionalParity?.status === "passed", `${label} cold/repeat functional parity failed`);
  const recomputedRepeat = compareMetrics(report.cold.median, report.repeat.median);
  assertCondition(report.repeatComparison.verdict === recomputedRepeat.outcome, `${label} repeatComparison verdict does not match its median evidence`);
  assertCondition(Array.isArray(report.responsiveCoverage) && report.responsiveCoverage.length > 0, `${label} is missing responsive coverage`);
  for (const viewport of report.responsiveCoverage) {
    assertCondition(viewport?.status === "passed", `${label} responsive viewport ${String(viewport?.id)} failed`);
  }
  assertCondition(role === "baseline" || role === "candidate", `${label} has an invalid role`);
}

function assertCandidateComparison(entry, baselineByRunId) {
  const { report, label } = entry;
  const comparison = report.optimizationComparison;
  assertCondition(isRecord(comparison), `${label} is missing optimizationComparison`);
  assertCondition(comparisonOutcomes.has(comparison.verdict), `${label} has invalid optimization verdict ${String(comparison.verdict)}`);
  const baseline = baselineByRunId.get(comparison.baselineRunId);
  assertCondition(Boolean(baseline), `${label} references baseline run ${String(comparison.baselineRunId)} outside --baseline inputs`);
  assertCondition(comparison.candidateRunId === report.runId, `${label} candidate run binding mismatch`);
  assertCondition(comparison.baselineReportFingerprint === baseline.report.reportFingerprint, `${label} baseline report fingerprint mismatch`);
  assertCondition(comparison.baselineTargetSourceFingerprint === baseline.report.governance.targetSourceFingerprint, `${label} baseline source fingerprint mismatch`);
  assertCondition(comparison.candidateTargetSourceFingerprint === report.governance.targetSourceFingerprint, `${label} candidate source fingerprint mismatch`);
  assertCondition(
    (comparison.baselineRouteClosureFingerprint ?? null) === (baseline.report.governance.builtRouteClosure?.fingerprint ?? null),
    `${label} baseline route-closure fingerprint mismatch`,
  );
  assertCondition(
    (comparison.candidateRouteClosureFingerprint ?? null) === (report.governance.builtRouteClosure?.fingerprint ?? null),
    `${label} candidate route-closure fingerprint mismatch`,
  );
  assertCondition(comparison.responsiveParity?.status === "passed", `${label} responsive parity failed`);
  const recomputedPhases = [];
  for (const phaseId of phaseIds) {
    const phase = comparison[phaseId];
    assertCondition(comparisonOutcomes.has(phase?.verdict), `${label}.${phaseId} has invalid verdict`);
    assertCondition(phase.functionalParity?.status === "passed", `${label}.${phaseId} functional parity failed`);
    assertCondition(Array.isArray(phase.environmentIssues) && phase.environmentIssues.length === 0, `${label}.${phaseId} environment parity failed`);
    const recomputed = compareMetrics(baseline.report[phaseId].median, report[phaseId].median);
    assertCondition(phase.verdict === recomputed.outcome, `${label}.${phaseId} verdict does not match its median evidence`);
    recomputedPhases.push(recomputed);
  }
  assertCondition(comparison.verdict === combinePhaseOutcomes(recomputedPhases), `${label} verdict does not match its phase evidence`);
}

function roundMetric(value) {
  return Number(value.toFixed(3));
}

function aggregateValues(values, aggregation) {
  const sorted = [...values].sort((left, right) => left - right);
  assertCondition(sorted.length > 0, `cannot calculate ${aggregation} without samples`);
  if (aggregation === "mean") return roundMetric(sorted.reduce((total, value) => total + value, 0) / sorted.length);
  if (aggregation === "median") {
    const middle = Math.floor(sorted.length / 2);
    return roundMetric(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
  }
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.75) - 1);
  return roundMetric(sorted[index]);
}

function aggregateSamples(samples, aggregation) {
  return Object.fromEntries(measuredMetricIds.map((metricId) => [
    metricId,
    aggregateValues(samples.map((sample) => sample[metricId]), aggregation),
  ]));
}

function metricTolerance(metricId, before) {
  if (metricId === "layoutShiftScore") return 0.01;
  if (metricId.endsWith("Bytes")) return Math.max(2_048, before * 0.05);
  if (metricId.endsWith("Ms")) return Math.max(20, before * 0.05);
  if (metricId === "resourceCount") return Math.max(2, before * 0.03);
  return 0;
}

function compareMetrics(beforeMetrics, afterMetrics) {
  const metrics = {};
  for (const metricId of measuredMetricIds) {
    const before = beforeMetrics[metricId];
    const after = afterMetrics[metricId];
    const delta = roundMetric(after - before);
    const deltaPercent = before > 0 ? roundMetric((delta / before) * 100) : null;
    const tolerance = metricTolerance(metricId, before);
    const status = delta < -tolerance ? "improved" : delta > tolerance ? "regressed" : "unchanged";
    metrics[metricId] = { before, after, delta, deltaPercent, status };
  }
  const primaryStatuses = primarySpeedMetricIds.map((metricId) => metrics[metricId].status);
  const outcome = primaryStatuses.includes("regressed")
    ? "regressed"
    : primaryStatuses.includes("improved")
      ? "improved"
      : "unchanged";
  return { outcome, metrics };
}

function combinePhaseOutcomes(phases) {
  const outcomes = phases.map((phase) => phase.outcome);
  if (outcomes.includes("regressed")) return "regressed";
  if (outcomes.includes("improved")) return "improved";
  return "unchanged";
}

function buildDistribution(baselineSamples, candidateSamples, aggregation) {
  const distribution = {};
  for (const phaseId of phaseIds) {
    const comparison = compareMetrics(
      aggregateSamples(baselineSamples[phaseId], aggregation),
      aggregateSamples(candidateSamples[phaseId], aggregation),
    );
    distribution[phaseId] = {
      ...comparison,
      functionalParity: { status: "passed", issues: [] },
    };
  }
  distribution.outcome = combinePhaseOutcomes(phaseIds.map((phaseId) => distribution[phaseId]));
  return distribution;
}

function compactPhase(phase) {
  return {
    outcome: phase.outcome,
    functionalParity: phase.functionalParity,
    metrics: Object.fromEntries(benchmarkMetricIds.map((metricId) => [metricId, phase.metrics[metricId]])),
  };
}

function collapseEvidenceValues(values, prefix) {
  const normalized = [...new Set(values.map((value) => cleanString(value)).filter(Boolean))].sort();
  if (!normalized.length) return null;
  if (normalized.length === 1) return normalized[0];
  return canonicalFingerprint({ kind: prefix, values: normalized });
}

function collapseRunIds(entries, prefix) {
  const runIds = entries.map((entry) => entry.report.runId).sort();
  return runIds.length === 1 ? runIds[0] : `${prefix}-set-${canonicalFingerprint(runIds).slice(0, 20)}`;
}

function assertCohortPurity(entries, role) {
  const sourceFingerprints = new Set(entries.map((entry) => entry.report.governance.targetSourceFingerprint));
  const routeClosureFingerprints = new Set(entries.map((entry) => entry.report.governance.builtRouteClosure.fingerprint));
  assertCondition(sourceFingerprints.size === 1, `${role} reports mix target-source fingerprints`);
  assertCondition(routeClosureFingerprints.size === 1, `${role} reports mix built route-closure fingerprints`);
}

function distributionConflictNotes(distributionAnalysis, independentVerdicts) {
  const notes = [];
  const verdicts = [...new Set(independentVerdicts)].sort();
  if (verdicts.length > 1) notes.push(`独立候选轮结论分歧：${verdicts.join(" / ")}`);
  for (const phaseId of phaseIds) {
    const outcomes = aggregationIds.map((aggregation) => distributionAnalysis[aggregation][phaseId].outcome);
    const statusConflict = benchmarkMetricIds.some((metricId) => (
      new Set(aggregationIds.map((aggregation) => distributionAnalysis[aggregation][phaseId].metrics[metricId].status)).size > 1
    ));
    if (new Set(outcomes).size > 1 || statusConflict) {
      notes.push(`${phaseId} 分布分歧：mean=${outcomes[0]}，median=${outcomes[1]}，P75=${outcomes[2]}`);
    }
  }
  return notes.slice(0, 3);
}

function conservativeDistributionOutcome(distributionAnalysis) {
  const outcomes = aggregationIds.map((aggregation) => distributionAnalysis[aggregation].outcome);
  if (outcomes.includes("regressed")) return "regressed";
  if (outcomes.every((outcome) => outcome === "improved")) return "improved";
  return "unchanged";
}

function normalizeEntry(entry, role, index) {
  const report = entry?.report ?? entry;
  const path = cleanString(entry?.path) || `${role}-${index + 1}.json`;
  return {
    role,
    path,
    label: `${role} ${path}`,
    artifactRef: cleanString(entry?.artifactRef) || reportArtifactRef(path, report),
    report,
  };
}

export function buildProductMarketOperationsStage05Evidence({ baselines, candidates }) {
  assertCondition(Array.isArray(baselines) && baselines.length > 0, "at least one --baseline report is required");
  assertCondition(Array.isArray(candidates) && candidates.length > 0, "at least one --candidate report is required");
  const baselineEntries = baselines
    .map((entry, index) => normalizeEntry(entry, "baseline", index))
    .sort((left, right) => compareCodeUnits(left.report.runId, right.report.runId));
  const candidateEntries = candidates
    .map((entry, index) => normalizeEntry(entry, "candidate", index))
    .sort((left, right) => compareCodeUnits(left.report.runId, right.report.runId));
  const allEntries = [...baselineEntries, ...candidateEntries];
  const runIds = allEntries.map((entry) => entry.report?.runId);
  assertCondition(new Set(runIds).size === runIds.length, "runId values must be unique across all inputs");

  const expectedFunctionality = { value: null };
  for (const entry of allEntries) assertReportShape(entry, expectedFunctionality);
  assertCohortPurity(baselineEntries, "baseline");
  assertCohortPurity(candidateEntries, "candidate");
  const expectedContextFingerprint = canonicalFingerprint(comparableContext(allEntries[0].report));
  for (const entry of allEntries.slice(1)) {
    assertCondition(
      canonicalFingerprint(comparableContext(entry.report)) === expectedContextFingerprint,
      `${entry.label} protocol or environment does not match the first baseline`,
    );
  }

  const baselineByRunId = new Map(baselineEntries.map((entry) => [entry.report.runId, entry]));
  for (const entry of candidateEntries) assertCandidateComparison(entry, baselineByRunId);

  const baselineSamples = Object.fromEntries(phaseIds.map((phaseId) => [
    phaseId,
    baselineEntries.flatMap((entry) => entry.report[phaseId].samples),
  ]));
  const candidateSamples = Object.fromEntries(phaseIds.map((phaseId) => [
    phaseId,
    candidateEntries.flatMap((entry) => entry.report[phaseId].samples),
  ]));
  assertCondition(baselineSamples.cold.length === baselineSamples.repeat.length, "merged baseline cold/repeat sample counts differ");
  assertCondition(candidateSamples.cold.length === candidateSamples.repeat.length, "merged candidate cold/repeat sample counts differ");

  const distributionAnalysis = Object.fromEntries(aggregationIds.map((aggregation) => [
    aggregation,
    buildDistribution(baselineSamples, candidateSamples, aggregation),
  ]));
  const independentCandidateVerdicts = candidateEntries.map((entry) => ({
    runId: entry.report.runId,
    baselineRunId: entry.report.optimizationComparison.baselineRunId,
    outcome: entry.report.optimizationComparison.verdict,
  }));
  const notes = distributionConflictNotes(
    distributionAnalysis,
    independentCandidateVerdicts.map((entry) => entry.outcome),
  );
  const confidence = notes.length ? "mixed" : "stable";
  const artifactRefs = [...new Set(allEntries.map((entry) => entry.artifactRef))].sort();
  const meanOutcome = distributionAnalysis.mean.outcome;
  const conservativeOutcome = conservativeDistributionOutcome(distributionAnalysis);
  const benchmarkSummary = {
    schemaVersion: PRODUCT_MARKET_OPERATIONS_STAGE05_SUMMARY_SCHEMA_VERSION,
    pageIdentity: PRODUCT_MARKET_OPERATIONS_PAGE_IDENTITY,
    baselineRunId: collapseRunIds(baselineEntries, "baseline"),
    candidateRunId: collapseRunIds(candidateEntries, "candidate"),
    outcome: meanOutcome,
    artifactRefs,
    evidenceQuality: {
      aggregation: "mean",
      baselineSamples: baselineSamples.cold.length,
      candidateSamples: candidateSamples.cold.length,
      runCount: allEntries.length,
      confidence,
      notes,
    },
    fingerprints: {
      baselineReport: collapseEvidenceValues(baselineEntries.map((entry) => entry.report.reportFingerprint), "baseline-reports"),
      candidateReport: collapseEvidenceValues(candidateEntries.map((entry) => entry.report.reportFingerprint), "candidate-reports"),
      baselineSource: collapseEvidenceValues(baselineEntries.map((entry) => entry.report.governance.targetSourceFingerprint), "baseline-sources"),
      candidateSource: collapseEvidenceValues(candidateEntries.map((entry) => entry.report.governance.targetSourceFingerprint), "candidate-sources"),
      baselineRouteClosure: collapseEvidenceValues(baselineEntries.map((entry) => entry.report.governance.builtRouteClosure?.fingerprint), "baseline-route-closures"),
      candidateRouteClosure: collapseEvidenceValues(candidateEntries.map((entry) => entry.report.governance.builtRouteClosure?.fingerprint), "candidate-route-closures"),
    },
    cold: compactPhase(distributionAnalysis.mean.cold),
    repeat: compactPhase(distributionAnalysis.mean.repeat),
  };
  const generatedAt = new Date(Math.max(...allEntries.map((entry) => Date.parse(entry.report.measuredAt)))).toISOString();
  const evidenceBase = {
    schemaVersion: PRODUCT_MARKET_OPERATIONS_STAGE05_SUMMARY_SCHEMA_VERSION,
    kind: "product-market-operations-stage05-performance-evidence",
    generatedAt,
    pageIdentity: PRODUCT_MARKET_OPERATIONS_PAGE_IDENTITY,
    independentCandidateVerdicts,
    distributionAnalysis,
    overallOutcome: {
      outcome: meanOutcome,
      aggregation: "mean-of-all-samples",
      mean: distributionAnalysis.mean.outcome,
      median: distributionAnalysis.median.outcome,
      p75: distributionAnalysis.p75.outcome,
      hasDistributionConflict: confidence === "mixed",
      conservativeOutcome,
    },
    benchmarkSummary,
  };
  return {
    ...evidenceBase,
    evidenceFingerprint: canonicalFingerprint(evidenceBase),
  };
}

export function parseProductMarketOperationsStage05Arguments(argv) {
  const baselines = [];
  const candidates = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return { help: true, baselines, candidates };
    const match = argument.match(/^--(baseline|candidate)=(.+)$/u);
    if (match) {
      (match[1] === "baseline" ? baselines : candidates).push(match[2]);
      continue;
    }
    if (argument === "--baseline" || argument === "--candidate") {
      const value = argv[index + 1];
      assertCondition(value && !value.startsWith("--"), `${argument} requires a JSON path`);
      (argument === "--baseline" ? baselines : candidates).push(value);
      index += 1;
      continue;
    }
    assertCondition(false, `unknown argument ${argument}`);
  }
  assertCondition(baselines.length > 0, "at least one --baseline report is required");
  assertCondition(candidates.length > 0, "at least one --candidate report is required");
  return { help: false, baselines, candidates };
}

async function readReportEntry(path, role) {
  const absolutePath = resolve(process.cwd(), path);
  let report;
  try {
    report = JSON.parse(await readFile(absolutePath, "utf8"));
  } catch (error) {
    throw new Error(`Product Market operations Stage 05 summary: cannot read ${role} ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return {
    path: absolutePath,
    artifactRef: reportArtifactRef(absolutePath, report),
    report,
  };
}

async function writeEvidence(evidence) {
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = resolve(
    outputDirectory,
    `product-market-operations-stage05-summary-${evidence.evidenceFingerprint.slice(0, 20)}.json`,
  );
  const content = `${JSON.stringify(evidence, null, 2)}\n`;
  try {
    if (await readFile(outputPath, "utf8") === content) return outputPath;
    throw new Error(`existing evidence differs despite identical fingerprint: ${outputPath}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  try {
    await writeFile(temporaryPath, content, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, outputPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
  return outputPath;
}

function usage() {
  return [
    "Usage:",
    "  npm run build:product-market-operations-stage05-summary -- --baseline <report.json> [--baseline <report.json> ...] --candidate <report.json> [--candidate <report.json> ...]",
    "",
    "The command reads only explicit schema-v2 Product Market operations reports and writes deterministic local evidence under ../release/local-performance/artifacts/.",
  ].join("\n");
}

async function main() {
  const options = parseProductMarketOperationsStage05Arguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const baselines = await Promise.all(options.baselines.map((path) => readReportEntry(path, "baseline")));
  const candidates = await Promise.all(options.candidates.map((path) => readReportEntry(path, "candidate")));
  const evidence = buildProductMarketOperationsStage05Evidence({ baselines, candidates });
  const outputPath = await writeEvidence(evidence);
  console.log(JSON.stringify({
    outputPath: normalizeArtifactPath(outputPath),
    evidenceFingerprint: evidence.evidenceFingerprint,
    overallOutcome: evidence.overallOutcome,
    evidenceQuality: evidence.benchmarkSummary.evidenceQuality,
  }, null, 2));
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
