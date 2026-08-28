import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";
import { chromium } from "playwright";

import { prepareDeveloperGlobalFrameAcceptanceArtifactPaths } from "./developer-global-frame-acceptance-artifacts.mjs";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playwrightCli = path.join(frontendRoot, "node_modules", "@playwright", "test", "cli.js");
const spec = "e2e/developer-global-frame-all-pages.spec.ts";
const SHA256 = /^[0-9a-f]{64}$/u;
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
    spec,
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
  const options = {
    shard: null,
    workers: null,
    retries: "1",
    scope: null,
    page: null,
    viewport: null,
    baseUrl: null,
    reporter: "line,e2e/reporters/developer-global-frame-isolation-reporter.mjs",
    candidateSection: null,
    templateId: null,
    frameSectionHash: null,
    baseDraftHash: null,
    sourceBuildDigest: null,
    pageRegistryHash: null,
    adapterRegistryHash: null,
    isolationPolicyHash: null,
    testSpecHash: null,
    list: false,
    printDerivedHashes: false,
  };
  for (const argument of argv) {
    if (argument === "--help" || argument === "-h") return { ...options, help: true };
    if (argument === "--list") {
      options.list = true;
      continue;
    }
    if (argument === "--print-derived-hashes") {
      options.printDerivedHashes = true;
      continue;
    }
    const [key, value] = argument.split("=", 2);
    if (!value) throw new Error(`Argument requires =value: ${argument}`);
    if (key === "--shard") options.shard = value;
    else if (key === "--workers") options.workers = value;
    else if (key === "--retries") options.retries = value;
    else if (key === "--scope") options.scope = value;
    else if (key === "--page") options.page = value;
    else if (key === "--viewport") options.viewport = value;
    else if (key === "--base-url") options.baseUrl = value;
    else if (key === "--reporter") options.reporter = value;
    else if (key === "--candidate-section") options.candidateSection = value;
    else if (key === "--template-id") options.templateId = value;
    else if (key === "--candidate-hash" || key === "--frame-section-hash") options.frameSectionHash = value;
    else if (key === "--base-draft-hash") options.baseDraftHash = value;
    else if (key === "--build-hash" || key === "--source-build-digest") options.sourceBuildDigest = value;
    else if (key === "--registry-hash" || key === "--page-registry-hash") options.pageRegistryHash = value;
    else if (key === "--adapter-hash" || key === "--adapter-registry-hash") options.adapterRegistryHash = value;
    else if (key === "--isolation-hash" || key === "--isolation-policy-hash") options.isolationPolicyHash = value;
    else if (key === "--test-spec-hash") options.testSpecHash = value;
    else throw new Error(`Unknown argument: ${key}`);
  }
  if (options.shard && !/^\d+\/\d+$/u.test(options.shard)) throw new Error("--shard must use current/total, for example 1/12");
  for (const [name, value] of [["workers", options.workers], ["retries", options.retries]]) {
    if (value !== null && (!/^\d+$/u.test(value) || Number(value) < (name === "workers" ? 1 : 0))) {
      throw new Error(`--${name} must be a valid integer`);
    }
  }
  return options;
}

function runStatus(command, args, environment) {
  const result = spawnSync(command, args, {
    cwd: frontendRoot,
    env: environment,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function runRequired(command, args, environment) {
  const status = runStatus(command, args, environment);
  if (status !== 0) process.exit(status);
}

async function loadAcceptanceContract() {
  const executable = await build({
    stdin: {
      contents: [
        'export * from "./e2e/support/developer-global-frame-acceptance.ts";',
        'export * from "./src/lib/developer-global-frame-adapter-resolution.ts";',
        'export * from "./src/lib/developer-global-frame-adapter-registry.ts";',
        'export * from "./src/lib/developer-global-frame-draft.ts";',
      ].join("\n"),
      loader: "ts",
      resolveDir: frontendRoot,
      sourcefile: "developer-global-frame-acceptance-runner-entry.ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    logLevel: "silent",
  });
  const bundled = executable.outputFiles[0]?.text;
  if (!bundled) throw new Error("Unable to bundle the acceptance contract");
  return import(`data:text/javascript;base64,${Buffer.from(bundled).toString("base64")}`);
}

function assertHash(name, value) {
  if (!value || !SHA256.test(value)) throw new Error(`${name} must be an exact lowercase sha256 digest`);
  return value;
}

function readCandidateSection(candidatePath) {
  if (!candidatePath) throw new Error("--candidate-section=<json-file> is required; synthetic sections are forbidden");
  const resolved = path.resolve(frontendRoot, candidatePath);
  const value = JSON.parse(fs.readFileSync(resolved, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("--candidate-section must contain the raw developer_global_frame object");
  }
  return { resolved, section: value };
}

function selectExpectedCase(entry, options) {
  const scopes = options.scope?.split(",").map((value) => value.trim()).filter(Boolean) ?? null;
  const pages = options.page?.split(",").map((value) => value.trim()).filter(Boolean) ?? null;
  const widths = options.viewport?.split(",").map((value) => Number.parseInt(value.split("x", 1)[0], 10)) ?? null;
  return (!scopes || scopes.includes(entry.sourceScope))
    && (!pages || pages.some((filter) => entry.pageId === filter || entry.runtimeRoute.includes(filter)))
    && (!widths || widths.includes(entry.viewport.width));
}

function adapterRegistryDigest(contract) {
  return sha256Canonical({
    contractVersion: contract.DEVELOPER_GLOBAL_FRAME_ADAPTER_CONTRACT_VERSION,
    explicitAdapters: contract.DEVELOPER_GLOBAL_FRAME_ADAPTER_REGISTRY,
    templateAdapters: contract.DEVELOPER_GLOBAL_FRAME_TEMPLATE_ADAPTER_REGISTRY,
    resolvableTargets: contract.DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS,
  });
}

function validateCandidateTargetMatrix(section, contract, isolationPageIds) {
  const isolationSet = new Set(isolationPageIds);
  const targets = new Map(section.target_matrix.map((target) => [target.page_id, target]));
  if (targets.size !== 201 || section.target_matrix.length !== 201) {
    throw new Error(`candidate target_matrix must contain 201 unique targets; actual=${section.target_matrix.length}/${targets.size}`);
  }
  for (const entry of contract.GLOBAL_FRAME_ACCEPTANCE_CASES) {
    const explicit = contract.ACCEPTANCE_EXPLICIT_GLOBAL_FRAME_TARGETS[entry.pageId];
    const profilePageId = explicit?.profilePageId ?? entry.pageId;
    const target = targets.get(profilePageId);
    const expectedCompatibility = isolationSet.has(entry.pageId) ? "isolated" : "compatible";
    if (!target
      || target.source_scope !== entry.sourceScope
      || target.compatibility !== expectedCompatibility
      || target.reads_profile_version !== section.profile_version) {
      throw new Error([
        `candidate target mismatch for pageId=${entry.pageId}`,
        `profilePageId=${profilePageId}`,
        `expected=${entry.sourceScope}/${expectedCompatibility}/${section.profile_version}`,
        `actual=${target ? `${target.source_scope}/${target.compatibility}/${target.reads_profile_version}` : "missing"}`,
      ].join(" | "));
    }
  }
}

async function prewarmAcceptanceRoutes({ baseUrl, routes, candidate, section, outputDirectory }) {
  const evidenceFile = path.join(outputDirectory, "developer-global-frame-route-prewarm.v1.json");
  const evidence = {
    schemaVersion: 1,
    kind: "developer-global-frame-route-prewarm/v1",
    baseUrl: baseUrl || null,
    candidateFrameSectionHash: candidate.frameSectionHash,
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: baseUrl ? "running" : "skipped-no-external-server",
    routeCount: routes.length,
    results: [],
  };
  const persist = () => fs.writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  if (!baseUrl) {
    evidence.completedAt = new Date().toISOString();
    persist();
    return;
  }

  const browser = await chromium.launch({
    channel: process.env.B2B_E2E_CHANNEL === "chrome" || (process.platform === "win32" && !process.env.CI)
      ? "chrome"
      : undefined,
    headless: true,
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route("**/api/**", (route) => route.abort("blockedbyclient"));
    await context.route(`**/api/template-snapshot/templates/${candidate.templateId}`, (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        template_id: candidate.templateId,
        owner_scope: "client_source",
        latest_version: section.profile_version,
        published_config_hash: candidate.frameSectionHash,
        is_published: true,
        config_json: { developer_global_frame: section },
      }),
    }));
    for (const route of routes) {
      const page = await context.newPage();
      const startedAt = Date.now();
      const result = { route, status: "running", durationMs: 0, responseStatus: null, error: null };
      evidence.results.push(result);
      try {
        const response = await page.goto(new URL(route, baseUrl).href, {
          waitUntil: "domcontentloaded",
          timeout: 90_000,
        });
        result.responseStatus = response?.status() ?? null;
        if (result.responseStatus !== null && result.responseStatus >= 500) {
          throw new Error(`route returned HTTP ${result.responseStatus}`);
        }
        await page.locator("[data-page-route-loading]").waitFor({ state: "detached", timeout: 90_000 });
        result.status = "ready";
      } catch (error) {
        result.status = "failed";
        result.error = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        result.durationMs = Date.now() - startedAt;
        persist();
        await page.close();
      }
    }
    await context.close();
    evidence.status = "ready";
  } catch (error) {
    evidence.status = "failed";
    throw error;
  } finally {
    evidence.completedAt = new Date().toISOString();
    persist();
    await browser.close();
  }
}

const options = parseArguments(process.argv.slice(2));
if (options.help) {
  console.log(`Developer global frame final acceptance

Runs the zero-omission static gate, then the exact candidate across 201 pages x 3 viewports.
The resulting v2 report is always untrusted-local and cannot enter the publication chain.

Required candidate binding:
  --template-id=id                     trusted job template; local default uses contract template
  --candidate-section=file.json       raw developer_global_frame section
  --frame-section-hash=sha256         canonical JSON hash of that section
  --base-draft-hash=sha256
  --source-build-digest=sha256       optional assertion; otherwise derived from the tested source bundle
  --page-registry-hash=sha256
  --adapter-registry-hash=sha256
  --isolation-policy-hash=sha256
  --test-spec-hash=sha256

Aliases: --candidate-hash, --build-hash, --registry-hash, --adapter-hash, --isolation-hash.
Use --print-derived-hashes with --candidate-section to obtain all locally derivable hashes.

Execution options:
  --shard=current/total
  --workers=number
  --retries=number          default: 1
  --scope=hq,agency_source,client_source
  --page=pageId-or-route-fragment[,pageId-or-route-fragment...]
  --viewport=1440,1024,390
  --base-url=http://host:port
  --reporter=value          default: line + v2 canonical reporter
  --list
`);
  process.exit(0);
}

const contract = await loadAcceptanceContract();
const { section } = readCandidateSection(options.candidateSection);
const sectionValidation = contract.validateDeveloperGlobalFrameSection(section);
if (!sectionValidation.valid) {
  throw new Error(`candidate developer_global_frame failed strict validation: ${sectionValidation.issues.join("; ")}`);
}
const intentionalIsolationPageIds = [...contract.DEVELOPER_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_IDS];
if (intentionalIsolationPageIds.length !== 5) throw new Error(`intentional isolation policy must contain 5 pages; actual=${intentionalIsolationPageIds.length}`);
validateCandidateTargetMatrix(section, contract, intentionalIsolationPageIds);

function deriveAcceptanceHashes() {
  return {
    frameSectionHash: sha256Canonical(section),
    sourceBuildDigest: sourceBuildDigest(),
    pageRegistryHash: sha256Canonical(JSON.parse(fs.readFileSync(path.join(frontendRoot, "src/page-factory/page-registry.json"), "utf8"))),
    adapterRegistryHash: adapterRegistryDigest(contract),
    isolationPolicyHash: sha256Canonical(intentionalIsolationPageIds),
    testSpecHash: sha256File(spec),
  };
}

const derivedHashes = deriveAcceptanceHashes();
if (options.printDerivedHashes) {
  console.log(JSON.stringify(derivedHashes, null, 2));
  process.exit(0);
}

const suppliedHashes = {
  frameSectionHash: assertHash("--frame-section-hash", options.frameSectionHash),
  baseDraftHash: assertHash("--base-draft-hash", options.baseDraftHash),
  sourceBuildDigest: options.sourceBuildDigest
    ? assertHash("--source-build-digest", options.sourceBuildDigest)
    : derivedHashes.sourceBuildDigest,
  pageRegistryHash: assertHash("--page-registry-hash", options.pageRegistryHash),
  adapterRegistryHash: assertHash("--adapter-registry-hash", options.adapterRegistryHash),
  isolationPolicyHash: assertHash("--isolation-policy-hash", options.isolationPolicyHash),
  testSpecHash: assertHash("--test-spec-hash", options.testSpecHash),
};
for (const [name, actual] of Object.entries(derivedHashes)) {
  if (suppliedHashes[name] !== actual) {
    throw new Error(`${name} does not bind the current candidate/source | supplied=${suppliedHashes[name]} | actual=${actual}`);
  }
}

const nodeDirectory = path.dirname(process.execPath);
const environment = {
  ...process.env,
  PATH: `${nodeDirectory}${path.delimiter}${process.env.PATH || ""}`,
};
environment.B2B_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_IDS = intentionalIsolationPageIds.join(",");
if (options.scope) environment.B2B_GLOBAL_FRAME_SCOPE = options.scope;
if (options.page) environment.B2B_GLOBAL_FRAME_PAGE = options.page;
if (options.viewport) environment.B2B_GLOBAL_FRAME_VIEWPORT = options.viewport;
if (options.baseUrl) environment.B2B_E2E_BASE_URL = options.baseUrl;

const verboseReportBaseId = [
  options.scope || "all-scopes",
  options.page || "all-pages",
  options.viewport || "all-viewports",
  options.shard ? `shard-${options.shard.replace("/", "-of-")}` : "unsharded",
].join("_")
  .replace(/[^a-zA-Z0-9_-]+/gu, "-")
  .replace(/^-+|-+$/gu, "") || "acceptance";
const maxReportBaseIdLength = 96;
const reportBaseId = verboseReportBaseId.length <= maxReportBaseIdLength
  ? verboseReportBaseId
  : `${verboseReportBaseId.slice(0, 72)}--${crypto.createHash("sha256").update(verboseReportBaseId).digest("hex").slice(0, 16)}`;
const runToken = [
  new Date().toISOString().replace(/[^0-9TZ]+/gu, "-"),
  `pid-${process.pid}`,
  crypto.randomBytes(4).toString("hex"),
].join("_");
const runId = `${reportBaseId}__${runToken}`;
const outputDirectory = path.join(
  frontendRoot,
  "playwright-report",
  "developer-global-frame-artifacts",
  reportBaseId,
  runToken,
);
const {
  playwrightOutputDirectory,
  reportFile,
  candidateEnvelopeFile,
} = prepareDeveloperGlobalFrameAcceptanceArtifactPaths(outputDirectory);

const isolationSet = new Set(intentionalIsolationPageIds);
const expectedCases = contract.GLOBAL_FRAME_ACCEPTANCE_PAGE_VIEWPORT_CASES.map((entry) => {
  const targetCompatibility = isolationSet.has(entry.pageId) ? "isolated" : "compatible";
  const checkIds = targetCompatibility === "isolated" ? REQUIRED_ISOLATION_CHECK_IDS : REQUIRED_COMPATIBLE_CHECK_IDS;
  return {
    caseId: `${entry.pageId}@${entry.viewport.width}x${entry.viewport.height}`,
    pageId: entry.pageId,
    sourceScope: entry.sourceScope,
    route: entry.runtimeRoute,
    viewport: `${entry.viewport.width}x${entry.viewport.height}`,
    targetCompatibility,
    checksHash: sha256Canonical(checkIds),
    selected: selectExpectedCase(entry, options),
  };
});
if (expectedCases.length !== 603 || new Set(expectedCases.map((entry) => entry.caseId)).size !== 603) {
  throw new Error(`acceptance manifest must contain 603 unique cases; actual=${expectedCases.length}`);
}

const candidate = {
  templateId: options.templateId || contract.ACCEPTANCE_DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
  contractVersion: section.contract_version,
  baseDraftHash: suppliedHashes.baseDraftHash,
  frameSectionHash: suppliedHashes.frameSectionHash,
  visualDraftId: section.recovery.draft_id,
  recoveryPointId: section.recovery.recovery_point_id,
  sourceBuildDigest: suppliedHashes.sourceBuildDigest,
  pageRegistryHash: suppliedHashes.pageRegistryHash,
  adapterRegistryHash: suppliedHashes.adapterRegistryHash,
  isolationPolicyHash: suppliedHashes.isolationPolicyHash,
  testSpecHash: suppliedHashes.testSpecHash,
};
fs.writeFileSync(candidateEnvelopeFile, `${JSON.stringify({
  schemaVersion: 2,
  kind: "developer-global-frame-acceptance-candidate/v2",
  candidate,
  developerGlobalFrame: section,
  expectedCases,
  requiredCheckIds: REQUIRED_CHECK_IDS,
  sharedWindowContract: contract.ACCEPTANCE_SHARED_WINDOW_CONTRACT,
}, null, 2)}\n`, "utf8");

environment.B2B_GLOBAL_FRAME_ACCEPTANCE_RUN_ID = runId;
environment.B2B_GLOBAL_FRAME_ACCEPTANCE_REPORT_ID = runId;
environment.B2B_GLOBAL_FRAME_ACCEPTANCE_OUTPUT_DIR = outputDirectory;
environment.B2B_GLOBAL_FRAME_ACCEPTANCE_REPORT = reportFile;
environment.B2B_GLOBAL_FRAME_ACCEPTANCE_CANDIDATE_FILE = candidateEnvelopeFile;

runRequired(process.execPath, [
  "scripts/guard-source-page-locks.mjs",
  "--",
  spec,
  "e2e/support/developer-global-frame-acceptance.ts",
  "e2e/reporters/developer-global-frame-isolation-reporter.mjs",
  "scripts/run-developer-global-frame-acceptance.mjs",
  "scripts/verify-developer-global-frame-acceptance-manifest.mjs",
  "scripts/verify-developer-global-frame-acceptance-report.mjs",
  "scripts/generate-developer-global-frame-final-candidate.mjs",
  "scripts/developer-global-frame-acceptance-artifacts.mjs",
  "e2e/fixtures/developer-global-frame-final-candidate.json",
], environment);
runRequired(process.execPath, ["scripts/verify-developer-global-frame-acceptance-manifest.mjs"], environment);

const playwrightArguments = [
  playwrightCli,
  "test",
  spec,
  `--retries=${options.retries}`,
  `--reporter=${options.reporter}`,
  `--output=${playwrightOutputDirectory}`,
];
if (options.shard) playwrightArguments.push(`--shard=${options.shard}`);
if (options.workers) playwrightArguments.push(`--workers=${options.workers}`);
if (options.list) playwrightArguments.push("--list");

if (!options.list) {
  const selectedRoutes = contract.GLOBAL_FRAME_ACCEPTANCE_PAGE_VIEWPORT_CASES
    .filter((entry) => selectExpectedCase(entry, options))
    .map((entry) => entry.runtimeRoute);
  const uniqueRuntimeRoutes = [...new Set(selectedRoutes)];
  console.log(`developer global frame route prewarm | routes=${uniqueRuntimeRoutes.length}`);
  await prewarmAcceptanceRoutes({
    baseUrl: options.baseUrl,
    routes: uniqueRuntimeRoutes,
    candidate,
    section,
    outputDirectory,
  });
}

console.log([
  "developer global frame browser acceptance v2",
  options.shard ? `shard=${options.shard}` : "shard=all",
  options.scope ? `scope=${options.scope}` : "scope=all",
  options.page ? `page=${options.page}` : "page=all-201",
  options.viewport ? `viewport=${options.viewport}` : "viewport=1440/1024/390",
  `candidate=${candidate.frameSectionHash}`,
  "trustLevel=untrusted-local",
  `retries=${options.retries}`,
  `output=${path.relative(frontendRoot, outputDirectory)}`,
].join(" | "));
const playwrightStatus = runStatus(process.execPath, playwrightArguments, environment);
if (options.list) process.exit(playwrightStatus);

const partialRun = Boolean(options.scope || options.page || options.viewport || options.shard);
const verifierArguments = [
  "scripts/verify-developer-global-frame-acceptance-report.mjs",
  `--report=${reportFile}`,
  `--candidate-envelope=${candidateEnvelopeFile}`,
];
if (partialRun) verifierArguments.push("--allow-skipped");
const reportStatus = runStatus(process.execPath, verifierArguments, environment);
const postRunDerivedHashes = deriveAcceptanceHashes();
const driftedHashFields = Object.keys(derivedHashes).filter(
  (field) => postRunDerivedHashes[field] !== derivedHashes[field],
);
if (driftedHashFields.length > 0) {
  fs.writeFileSync(path.join(outputDirectory, "developer-global-frame-source-drift.json"), `${JSON.stringify({
    schemaVersion: 1,
    kind: "developer-global-frame-source-drift/v1",
    detectedAt: new Date().toISOString(),
    driftedHashFields,
    before: derivedHashes,
    after: postRunDerivedHashes,
  }, null, 2)}\n`, "utf8");
  console.error(`candidate-source-hash changed during acceptance: ${driftedHashFields.join(",")}`);
}
process.exit(playwrightStatus || reportStatus || driftedHashFields.length > 0 ? 1 : 0);
