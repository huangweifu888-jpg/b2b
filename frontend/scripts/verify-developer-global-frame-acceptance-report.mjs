import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED_COMPATIBLE_CHECK_IDS = Object.freeze([
  "route-and-page-identity",
  "three-scope-shell-and-page-contract",
  "published-runtime-version-hash",
  "declared-frame-regions",
  "region-marker-hover-accuracy",
  "unique-scroll-owner-and-scrollability",
  "scrollbar-geometry-and-spacing",
  "no-horizontal-overflow",
  "left-outer-body-marker",
]);
const REQUIRED_ISOLATION_CHECK_IDS = Object.freeze([
  "route-and-page-identity",
  "technical-route-explicit-isolation-and-original-output",
]);
const REQUIRED_CHECK_IDS = Object.freeze([
  ...REQUIRED_COMPATIBLE_CHECK_IDS,
  "technical-route-explicit-isolation-and-original-output",
]);

function fail(check, detail) {
  throw new Error(`check=${check} | ${detail}`);
}

function requireCheck(condition, check, detail) {
  if (!condition) fail(check, detail);
}

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

function sha256File(relativePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(frontendRoot, relativePath))).digest("hex");
}

function collectSourceFiles(directory, relativeBase = directory) {
  const absoluteDirectory = path.join(frontendRoot, directory);
  return fs.readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(relativeBase, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) return collectSourceFiles(relative, relative);
    return /\.(?:css|js|jsx|json|mjs|ts|tsx)$/u.test(entry.name) ? [relative] : [];
  });
}

function sourceBuildDigest() {
  const acceptanceInputs = [
    "e2e/developer-global-frame-all-pages.spec.ts",
    "e2e/support/developer-global-frame-acceptance.ts",
    "e2e/reporters/developer-global-frame-isolation-reporter.mjs",
    "scripts/run-developer-global-frame-acceptance.mjs",
    "scripts/verify-developer-global-frame-acceptance-manifest.mjs",
    "scripts/verify-developer-global-frame-acceptance-report.mjs",
    "scripts/generate-developer-global-frame-final-candidate.mjs",
    "scripts/developer-global-frame-acceptance-artifacts.mjs",
  ];
  const files = [...new Set([...collectSourceFiles("src"), ...acceptanceInputs])].sort();
  return sha256Canonical({
    schemaVersion: 1,
    kind: "developer-global-frame-tested-source-bundle/v1",
    files: files.map((file) => ({ file, sha256: sha256File(file) })),
  });
}

function parseArguments(argv) {
  const options = { report: null, candidateEnvelope: null, allowSkipped: false };
  for (const argument of argv) {
    if (argument === "--allow-skipped") {
      options.allowSkipped = true;
      continue;
    }
    const [key, value] = argument.split("=", 2);
    if (!value) fail("argument", `requires =value: ${argument}`);
    if (key === "--report") options.report = path.resolve(value);
    else if (key === "--candidate-envelope") options.candidateEnvelope = path.resolve(value);
    else fail("argument", `unknown=${key}`);
  }
  requireCheck(Boolean(options.report), "argument", "--report is required");
  requireCheck(Boolean(options.candidateEnvelope), "argument", "--candidate-envelope is required");
  return options;
}

async function loadAcceptanceContract() {
  const executable = await build({
    stdin: {
      contents: [
        'export * from "./e2e/support/developer-global-frame-acceptance.ts";',
        'export * from "./src/lib/developer-global-frame-adapter-resolution.ts";',
        'export * from "./src/lib/developer-global-frame-adapter-registry.ts";',
      ].join("\n"),
      loader: "ts",
      resolveDir: frontendRoot,
      sourcefile: "developer-global-frame-acceptance-report-verifier-entry.ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    logLevel: "silent",
  });
  const bundled = executable.outputFiles[0]?.text;
  requireCheck(Boolean(bundled), "contract-bundle", "esbuild produced no output");
  return import(`data:text/javascript;base64,${Buffer.from(bundled).toString("base64")}`);
}

function adapterRegistryDigest(contract) {
  return sha256Canonical({
    contractVersion: contract.DEVELOPER_GLOBAL_FRAME_ADAPTER_CONTRACT_VERSION,
    explicitAdapters: contract.DEVELOPER_GLOBAL_FRAME_ADAPTER_REGISTRY,
    templateAdapters: contract.DEVELOPER_GLOBAL_FRAME_TEMPLATE_ADAPTER_REGISTRY,
    resolvableTargets: contract.DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS,
  });
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

const options = parseArguments(process.argv.slice(2));
const envelope = JSON.parse(fs.readFileSync(options.candidateEnvelope, "utf8"));
const report = JSON.parse(fs.readFileSync(options.report, "utf8"));
const contract = await loadAcceptanceContract();

requireCheck(envelope.schemaVersion === 2 && envelope.kind === "developer-global-frame-acceptance-candidate/v2", "candidate-envelope", "invalid schema/kind");
requireCheck(report.schemaVersion === 2, "report-schema", `actual=${report.schemaVersion}`);
requireCheck(report.kind === "developer-global-frame-acceptance-report/v2", "report-kind", `actual=${report.kind}`);
requireCheck(report.trustLevel === "untrusted-local", "report-trust", `actual=${report.trustLevel}`);
requireCheck(report.issuer === "local-playwright", "report-issuer", `actual=${report.issuer}`);
requireCheck(typeof report.runId === "string" && report.runId.length > 0, "report-run-id", "missing");
requireCheck(typeof report.issuedAt === "string" && Number.isFinite(Date.parse(report.issuedAt)), "report-issued-at", `actual=${report.issuedAt}`);
for (const forbidden of ["signature", "keyId", "expiresAt", "publicationEligible"]) {
  requireCheck(!(forbidden in report), "untrusted-publication-boundary", `forbidden field=${forbidden}`);
}
requireCheck(stableSerialize(report.candidate) === stableSerialize(envelope.candidate), "candidate-binding", "report candidate differs from runner envelope");
requireCheck(JSON.stringify(report.viewports) === JSON.stringify([1440, 1024, 390]), "report-viewports", `actual=${JSON.stringify(report.viewports)}`);
requireCheck(JSON.stringify(report.requiredCheckIds) === JSON.stringify(REQUIRED_CHECK_IDS), "required-check-ids", `actual=${JSON.stringify(report.requiredCheckIds)}`);

const derivedCandidateHashes = {
  frameSectionHash: sha256Canonical(envelope.developerGlobalFrame),
  sourceBuildDigest: sourceBuildDigest(),
  pageRegistryHash: sha256Canonical(JSON.parse(fs.readFileSync(path.join(frontendRoot, "src/page-factory/page-registry.json"), "utf8"))),
  adapterRegistryHash: adapterRegistryDigest(contract),
  isolationPolicyHash: sha256Canonical([...contract.DEVELOPER_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_IDS]),
  testSpecHash: sha256File("e2e/developer-global-frame-all-pages.spec.ts"),
};
for (const [name, expected] of Object.entries(derivedCandidateHashes)) {
  requireCheck(report.candidate[name] === expected, "candidate-source-hash", `${name} expected=${expected} actual=${report.candidate[name]}`);
}

const expectedCases = envelope.expectedCases;
const caseResults = report.caseResults;
requireCheck(Array.isArray(expectedCases) && expectedCases.length === 603, "expected-case-count", `actual=${expectedCases?.length}`);
requireCheck(Array.isArray(caseResults) && caseResults.length === 603, "report-case-count", `actual=${caseResults?.length}`);
const expectedByCaseId = new Map(expectedCases.map((entry) => [entry.caseId, entry]));
const actualByCaseId = new Map(caseResults.map((entry) => [entry.caseId, entry]));
requireCheck(expectedByCaseId.size === 603, "expected-case-uniqueness", `actual=${expectedByCaseId.size}`);
requireCheck(actualByCaseId.size === 603, "report-case-uniqueness", `actual=${actualByCaseId.size}`);

const pages = new Map();
for (const expected of expectedCases) {
  const actual = actualByCaseId.get(expected.caseId);
  requireCheck(Boolean(actual), "missing-case", `caseId=${expected.caseId}`);
  for (const key of ["pageId", "sourceScope", "route", "viewport", "targetCompatibility", "checksHash"]) {
    requireCheck(actual[key] === expected[key], "case-identity", `caseId=${expected.caseId} | field=${key} | expected=${expected[key]} actual=${actual[key]}`);
  }
  requireCheck(actual.synthetic === false, "synthetic-evidence", `caseId=${expected.caseId}`);
  requireCheck(actual.candidateFrameSectionHash === report.candidate.frameSectionHash, "case-candidate-hash", `caseId=${expected.caseId}`);
  requireCheck(Number.isInteger(actual.retry) && actual.retry >= 0, "case-retry", `caseId=${expected.caseId} | actual=${actual.retry}`);
  const expectedChecks = expected.targetCompatibility === "isolated"
    ? REQUIRED_ISOLATION_CHECK_IDS
    : REQUIRED_COMPATIBLE_CHECK_IDS;
  requireCheck(actual.checksHash === sha256Canonical(expectedChecks), "case-checks-hash", `caseId=${expected.caseId}`);
  requireCheck(["passed", "isolated", "failed", "flaky", "skipped"].includes(actual.status), "case-status", `caseId=${expected.caseId} | actual=${actual.status}`);
  if (expected.targetCompatibility === "isolated" && actual.status !== "skipped") {
    requireCheck(actual.status === "isolated" && actual.isolationAsserted === true, "isolation-assertion", `caseId=${expected.caseId} | status=${actual.status}`);
  }
  if (expected.targetCompatibility === "compatible") {
    requireCheck(actual.status !== "isolated" && actual.isolationAsserted === false, "compatible-isolation-boundary", `caseId=${expected.caseId}`);
    requireCheck(actual.status !== "failed", "compatible-failure", `caseId=${expected.caseId} | failure=${JSON.stringify(actual.failure)}`);
  }
  requireCheck(actual.status !== "failed", "case-failure", `caseId=${expected.caseId} | failure=${JSON.stringify(actual.failure)}`);
  requireCheck(actual.status !== "flaky", "case-flaky", `caseId=${expected.caseId} | retry=${actual.retry}`);
  if (!options.allowSkipped) requireCheck(actual.status !== "skipped", "case-skipped", `caseId=${expected.caseId} | reason=${actual.skipReason}`);
  const list = pages.get(actual.pageId) ?? [];
  list.push(actual);
  pages.set(actual.pageId, list);
}

requireCheck(pages.size === 201, "page-count", `actual=${pages.size}`);
for (const [pageId, cases] of pages) {
  const viewports = cases.map((entry) => entry.viewport).sort();
  requireCheck(cases.length === 3, "missing-or-duplicate-viewport", `pageId=${pageId} | actual=${cases.length}`);
  requireCheck(JSON.stringify(viewports) === JSON.stringify(["1024x768", "1440x900", "390x844"]), "missing-or-duplicate-viewport", `pageId=${pageId} | actual=${viewports.join(",")}`);
}

const isolatedPageIds = [...contract.DEVELOPER_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_IDS].sort();
const compatiblePageIds = [...pages.keys()].filter((pageId) => !isolatedPageIds.includes(pageId)).sort();
requireCheck(isolatedPageIds.length === 5, "isolated-page-count", `actual=${isolatedPageIds.length}`);
requireCheck(compatiblePageIds.length === 196, "compatible-page-count", `actual=${compatiblePageIds.length}`);
requireCheck(JSON.stringify(report.isolatedPageIds) === JSON.stringify(isolatedPageIds), "isolated-page-ids", `actual=${JSON.stringify(report.isolatedPageIds)}`);
requireCheck(JSON.stringify(report.compatiblePageIds) === JSON.stringify(compatiblePageIds), "compatible-page-ids", `actualCount=${report.compatiblePageIds?.length}`);

const scopePageCounts = Object.fromEntries(["hq", "agency_source", "client_source"].map((sourceScope) => [
  sourceScope,
  new Set(caseResults.filter((entry) => entry.sourceScope === sourceScope).map((entry) => entry.pageId)).size,
]));
requireCheck(stableSerialize(scopePageCounts) === stableSerialize({ hq: 66, agency_source: 33, client_source: 102 }), "scope-page-counts", `actual=${JSON.stringify(scopePageCounts)}`);
const recomputedCounts = countStatuses(caseResults);
requireCheck(stableSerialize(report.counts) === stableSerialize(recomputedCounts), "report-counts", `actual=${JSON.stringify(report.counts)} expected=${JSON.stringify(recomputedCounts)}`);
for (const sourceScope of ["hq", "agency_source", "client_source"]) {
  const scoped = caseResults.filter((entry) => entry.sourceScope === sourceScope);
  const expectedSummary = { pages: scopePageCounts[sourceScope], ...countStatuses(scoped) };
  requireCheck(stableSerialize(report.scopeSummary?.[sourceScope]) === stableSerialize(expectedSummary), "scope-summary", `scope=${sourceScope}`);
}

requireCheck(Array.isArray(report.sharedWindowResults) && report.sharedWindowResults.length === 3, "shared-window-results", `actual=${report.sharedWindowResults?.length}`);
for (const result of report.sharedWindowResults) {
  requireCheck(["hq", "agency_source", "client_source"].includes(result.sourceScope), "shared-window-scope", `actual=${result.sourceScope}`);
  requireCheck(result.contractId === envelope.sharedWindowContract.id
    && result.contractVersion === envelope.sharedWindowContract.version
    && JSON.stringify(result.expectedRegistryIds) === JSON.stringify(envelope.sharedWindowContract.registryIds), "shared-window-contract", `scope=${result.sourceScope}`);
  if (!options.allowSkipped) requireCheck(result.status === "passed", "shared-window-status", `scope=${result.sourceScope} | status=${result.status}`);
}

const { reportHash, ...unsignedReport } = report;
requireCheck(typeof reportHash === "string" && reportHash === sha256Canonical(unsignedReport), "report-hash", `actual=${reportHash}`);

console.log([
  "developer global frame acceptance report v2 passed",
  `cases=${caseResults.length}`,
  `passed=${report.counts.passed}`,
  `isolated=${report.counts.isolated}`,
  `skipped=${report.counts.skipped}`,
  `candidate=${report.candidate.frameSectionHash}`,
  "trustLevel=untrusted-local",
].join(" | "));
