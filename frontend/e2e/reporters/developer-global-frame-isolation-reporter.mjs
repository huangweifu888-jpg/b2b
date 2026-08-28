import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const FAILURE_IDENTITY = /pageId=([^|\r\n]+)\s*\|\s*route=([^|\r\n]+)\s*\|\s*viewport=([^|\r\n]+)\s*\|\s*check=([^|\r\n]+)/u;
const CASE_ANNOTATION = "developer-global-frame-case-v2";
const ISOLATION_ANNOTATION = "developer-global-frame-isolation-asserted-v2";
const SHARED_WINDOW_ANNOTATION = "developer-global-frame-shared-window-asserted-v2";

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Canonical(value) {
  return crypto.createHash("sha256").update(stableSerialize(value)).digest("hex");
}

function readCandidateEnvelope() {
  const candidateFile = process.env.B2B_GLOBAL_FRAME_ACCEPTANCE_CANDIDATE_FILE?.trim();
  if (!candidateFile) throw new Error("B2B_GLOBAL_FRAME_ACCEPTANCE_CANDIDATE_FILE is required by the v2 reporter");
  const value = JSON.parse(fs.readFileSync(path.resolve(candidateFile), "utf8"));
  if (value.schemaVersion !== 2
    || value.kind !== "developer-global-frame-acceptance-candidate/v2"
    || !Array.isArray(value.expectedCases)
    || value.expectedCases.length !== 603) {
    throw new Error("The v2 candidate envelope does not contain all 603 expected cases");
  }
  return value;
}

function reportPath() {
  const explicit = process.env.B2B_GLOBAL_FRAME_ACCEPTANCE_REPORT?.trim();
  if (explicit) return path.resolve(explicit);
  const outputDirectory = process.env.B2B_GLOBAL_FRAME_ACCEPTANCE_OUTPUT_DIR?.trim();
  if (!outputDirectory) throw new Error("B2B_GLOBAL_FRAME_ACCEPTANCE_OUTPUT_DIR is required by the v2 reporter");
  return path.resolve(outputDirectory, "developer-global-frame-acceptance-report.v2.json");
}

function parseAnnotation(result, type) {
  const annotation = result.annotations.find((candidate) => candidate.type === type);
  return annotation?.description ?? null;
}

function parseCaseAnnotation(result) {
  const serialized = parseAnnotation(result, CASE_ANNOTATION);
  if (!serialized) return null;
  try {
    return JSON.parse(serialized);
  } catch {
    return null;
  }
}

function failureIdentity(message) {
  const failure = message.match(FAILURE_IDENTITY);
  return failure
    ? {
      pageId: failure[1].trim(),
      route: failure[2].trim(),
      viewport: failure[3].trim(),
      check: failure[4].trim(),
    }
    : { pageId: null, route: null, viewport: null, check: "unclassified" };
}

function finalStatus(actual, expected, candidateHash, duplicateTestIds) {
  if (!actual) return { status: "skipped", failure: null, skipReason: expected.selected ? "not-observed" : "not-selected" };
  const errors = [];
  if (!actual.caseAnnotation) errors.push("missing developer-global-frame-case-v2 annotation");
  if (actual.caseAnnotation?.caseId !== expected.caseId
    || actual.caseAnnotation?.pageId !== expected.pageId
    || actual.caseAnnotation?.sourceScope !== expected.sourceScope
    || actual.caseAnnotation?.route !== expected.route
    || actual.caseAnnotation?.viewport !== expected.viewport) {
    errors.push("case identity annotation differs from the canonical manifest");
  }
  if (actual.caseAnnotation?.targetCompatibility !== expected.targetCompatibility) {
    errors.push("target compatibility annotation differs from the canonical manifest");
  }
  if (actual.caseAnnotation?.checksHash !== expected.checksHash) {
    errors.push("checksHash annotation differs from the canonical manifest");
  }
  if (actual.caseAnnotation?.candidateFrameSectionHash !== candidateHash) {
    errors.push("case candidate hash differs from frameSectionHash");
  }
  if (actual.caseAnnotation?.synthetic !== false) errors.push("synthetic acceptance evidence is forbidden");
  if (duplicateTestIds.size > 1) errors.push(`duplicate Playwright tests observed for case: ${[...duplicateTestIds].join(",")}`);
  if (expected.targetCompatibility === "isolated" && !actual.isolationAsserted) {
    errors.push("isolated case did not complete its isolation assertion");
  }
  if (expected.targetCompatibility === "compatible" && actual.isolationAsserted) {
    errors.push("compatible case incorrectly emitted an isolation assertion");
  }
  if (errors.length) {
    return {
      status: "failed",
      failure: { check: "evidence-binding", message: errors.join("; ") },
      skipReason: null,
    };
  }
  if (["failed", "timedOut", "interrupted"].includes(actual.status)) {
    return {
      status: "failed",
      failure: { check: actual.failure.check, message: actual.message || actual.status },
      skipReason: null,
    };
  }
  if (actual.status === "skipped") {
    return { status: "skipped", failure: null, skipReason: "playwright-skipped" };
  }
  if (actual.retry > 0 || actual.attemptStatuses.some((status) => status !== "passed")) {
    return { status: "flaky", failure: null, skipReason: null };
  }
  return {
    status: expected.targetCompatibility === "isolated" ? "isolated" : "passed",
    failure: null,
    skipReason: null,
  };
}

function countStatuses(caseResults) {
  return {
    total: caseResults.length,
    passed: caseResults.filter((entry) => entry.status === "passed").length,
    isolated: caseResults.filter((entry) => entry.status === "isolated").length,
    failed: caseResults.filter((entry) => entry.status === "failed").length,
    flaky: caseResults.filter((entry) => entry.status === "flaky").length,
    skipped: caseResults.filter((entry) => entry.status === "skipped").length,
  };
}

function scopeSummary(caseResults) {
  return Object.fromEntries(["hq", "agency_source", "client_source"].map((sourceScope) => {
    const scoped = caseResults.filter((entry) => entry.sourceScope === sourceScope);
    return [sourceScope, {
      pages: new Set(scoped.map((entry) => entry.pageId)).size,
      ...countStatuses(scoped),
    }];
  }));
}

function sharedWindowResults(caseResults, contract) {
  return ["hq", "agency_source", "client_source"].map((sourceScope) => {
    const applicable = caseResults.filter((entry) =>
      entry.sourceScope === sourceScope && entry.targetCompatibility === "compatible",
    );
    const asserted = applicable.filter((entry) => entry.sharedWindowAsserted).length;
    const skipped = applicable.filter((entry) => entry.status === "skipped").length;
    return {
      sourceScope,
      contractId: contract.id,
      contractVersion: contract.version,
      expectedRegistryIds: [...contract.registryIds],
      applicableCases: applicable.length,
      assertedCases: asserted,
      failedCases: applicable.length - asserted - skipped,
      skippedCases: skipped,
      status: asserted === applicable.length ? "passed" : (skipped > 0 ? "partial" : "failed"),
    };
  });
}

export default class DeveloperGlobalFrameIsolationReporter {
  constructor() {
    this.envelope = readCandidateEnvelope();
    this.expectedByCaseId = new Map(this.envelope.expectedCases.map((entry) => [entry.caseId, entry]));
    this.actualByCaseId = new Map();
    this.testIdsByCaseId = new Map();
    this.totalSelectedTests = 0;
  }

  onBegin(_config, suite) {
    this.totalSelectedTests = suite.allTests().length;
  }

  onTestEnd(test, result) {
    const caseAnnotation = parseCaseAnnotation(result);
    const caseId = caseAnnotation?.caseId ?? null;
    if (!caseId || !this.expectedByCaseId.has(caseId)) return;
    const previous = this.actualByCaseId.get(caseId);
    const message = result.errors.map((error) => error.message || error.value || "unknown error").join("\n").slice(0, 20_000);
    const testIds = this.testIdsByCaseId.get(caseId) ?? new Set();
    testIds.add(test.id);
    this.testIdsByCaseId.set(caseId, testIds);
    this.actualByCaseId.set(caseId, {
      testId: test.id,
      caseAnnotation,
      status: result.status,
      retry: result.retry,
      durationMs: result.duration,
      message: message || null,
      failure: failureIdentity(message),
      attemptStatuses: [...(previous?.attemptStatuses ?? []), result.status],
      isolationAsserted: parseAnnotation(result, ISOLATION_ANNOTATION) === this.envelope.candidate.frameSectionHash,
      sharedWindowAsserted: parseAnnotation(result, SHARED_WINDOW_ANNOTATION) === this.envelope.candidate.frameSectionHash,
    });
  }

  onEnd() {
    if (this.totalSelectedTests === 0) return;
    const candidateHash = this.envelope.candidate.frameSectionHash;
    const caseResults = this.envelope.expectedCases.map((expected) => {
      const actual = this.actualByCaseId.get(expected.caseId) ?? null;
      const duplicateTestIds = this.testIdsByCaseId.get(expected.caseId) ?? new Set();
      const classification = finalStatus(actual, expected, candidateHash, duplicateTestIds);
      return {
        caseId: expected.caseId,
        pageId: expected.pageId,
        sourceScope: expected.sourceScope,
        route: expected.route,
        viewport: expected.viewport,
        targetCompatibility: expected.targetCompatibility,
        status: classification.status,
        checksHash: expected.checksHash,
        retry: actual?.retry ?? 0,
        durationMs: actual?.durationMs ?? 0,
        isolationAsserted: expected.targetCompatibility === "isolated" ? Boolean(actual?.isolationAsserted) : false,
        sharedWindowAsserted: expected.targetCompatibility === "compatible" ? Boolean(actual?.sharedWindowAsserted) : false,
        synthetic: false,
        candidateFrameSectionHash: candidateHash,
        failure: classification.failure,
        skipReason: classification.skipReason,
      };
    });
    const issuedAt = new Date().toISOString();
    const report = {
      schemaVersion: 2,
      kind: "developer-global-frame-acceptance-report/v2",
      trustLevel: "untrusted-local",
      runId: process.env.B2B_GLOBAL_FRAME_ACCEPTANCE_RUN_ID || "missing-run-id",
      issuer: "local-playwright",
      issuedAt,
      candidate: { ...this.envelope.candidate },
      viewports: [1440, 1024, 390],
      requiredCheckIds: [...this.envelope.requiredCheckIds],
      scopeSummary: scopeSummary(caseResults),
      compatiblePageIds: [...new Set(caseResults
        .filter((entry) => entry.targetCompatibility === "compatible")
        .map((entry) => entry.pageId))].sort(),
      isolatedPageIds: [...new Set(caseResults
        .filter((entry) => entry.targetCompatibility === "isolated")
        .map((entry) => entry.pageId))].sort(),
      caseResults,
      sharedWindowResults: sharedWindowResults(caseResults, this.envelope.sharedWindowContract),
      counts: countStatuses(caseResults),
    };
    const signed = { ...report, reportHash: sha256Canonical(report) };
    const output = reportPath();
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(signed, null, 2)}\n`, "utf8");
    console.log([
      "developer global frame acceptance report v2",
      `passed=${signed.counts.passed}`,
      `isolated=${signed.counts.isolated}`,
      `failed=${signed.counts.failed}`,
      `flaky=${signed.counts.flaky}`,
      `skipped=${signed.counts.skipped}`,
      "trustLevel=untrusted-local",
      `file=${output}`,
    ].join(" | "));
  }
}
