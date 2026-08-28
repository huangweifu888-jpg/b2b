import fs from "node:fs";
import path from "node:path";

import { build } from "esbuild";

import { prepareDeveloperGlobalFrameAcceptanceArtifactPaths } from "./developer-global-frame-acceptance-artifacts.mjs";

const fail = (check, detail) => {
  throw new Error(`check=${check} | ${detail}`);
};
const requireCheck = (condition, check, detail) => {
  if (!condition) fail(check, detail);
};

const freshArtifactRoot = path.resolve(
  "playwright-report",
  `developer-global-frame-artifact-path-verifier-${process.pid}-${Date.now()}`,
);
requireCheck(!fs.existsSync(freshArtifactRoot), "fresh-artifact-root", `unexpected existing path=${freshArtifactRoot}`);
const freshArtifactPaths = prepareDeveloperGlobalFrameAcceptanceArtifactPaths(freshArtifactRoot);
requireCheck(fs.existsSync(freshArtifactPaths.runRoot), "fresh-artifact-root-created", freshArtifactPaths.runRoot);
requireCheck(
  path.dirname(freshArtifactPaths.candidateEnvelopeFile) !== freshArtifactPaths.playwrightOutputDirectory,
  "candidate-outside-playwright-clean-root",
  JSON.stringify(freshArtifactPaths),
);
fs.writeFileSync(freshArtifactPaths.candidateEnvelopeFile, "fresh-output-directory-probe\n", "utf8");
fs.mkdirSync(freshArtifactPaths.playwrightOutputDirectory, { recursive: true });
fs.rmSync(freshArtifactPaths.playwrightOutputDirectory, { recursive: true, force: true });
requireCheck(fs.existsSync(freshArtifactPaths.candidateEnvelopeFile), "candidate-survives-playwright-clean", freshArtifactPaths.candidateEnvelopeFile);
fs.rmSync(freshArtifactRoot, { recursive: true, force: true });

const executable = await build({
  stdin: {
    contents: [
      'export * from "./e2e/support/developer-global-frame-acceptance.ts";',
      'export * from "./src/lib/developer-global-frame-adapter-resolution.ts";',
      'export * from "./src/lib/developer-global-frame-adapter-registry.ts";',
      'export * from "./src/lib/developer-global-frame-draft.ts";',
      'export * from "./src/lib/developer-global-style-contract.ts";',
      'export * from "./src/lib/developer-global-style-session.ts";',
      'export * from "./src/lib/shared-window-contract.ts";',
      'export * from "./src/page-factory/page-factory.ts";',
      'export * from "./src/lib/visual-card-layout-contract.ts";',
    ].join("\n"),
    loader: "ts",
    resolveDir: process.cwd(),
    sourcefile: "developer-global-frame-acceptance-manifest-entry.ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  logLevel: "silent",
});
const bundled = executable.outputFiles[0]?.text;
requireCheck(Boolean(bundled), "manifest-bundle", "esbuild produced no executable output");
const contract = await import(`data:text/javascript;base64,${Buffer.from(bundled).toString("base64")}`);

const pages = contract.PAGE_FACTORY_PAGES;
const cases = contract.GLOBAL_FRAME_ACCEPTANCE_CASES;
const viewportCases = contract.GLOBAL_FRAME_ACCEPTANCE_PAGE_VIEWPORT_CASES;
const viewports = contract.DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_VIEWPORTS;
const expectedCount = contract.DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_PAGE_COUNT;
const technicalIsolatedIds = new Set(contract.DEVELOPER_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_IDS);

requireCheck(expectedCount === 201, "expected-page-count", `expected=${expectedCount}`);
requireCheck(pages.length === expectedCount, "registry-page-count", `expected=${expectedCount} actual=${pages.length}`);
requireCheck(cases.length === expectedCount, "acceptance-page-count", `expected=${expectedCount} actual=${cases.length}`);
requireCheck(viewportCases.length === expectedCount * 3, "acceptance-page-viewport-count", `expected=${expectedCount * 3} actual=${viewportCases.length}`);
requireCheck(JSON.stringify(viewports.map((viewport) => viewport.width)) === JSON.stringify([1440, 1024, 390]), "acceptance-viewports", `actual=${viewports.map((viewport) => viewport.width).join(",")}`);
requireCheck(technicalIsolatedIds.size === 5, "technical-isolated-count", `expected=5 actual=${technicalIsolatedIds.size}`);
requireCheck(expectedCount - technicalIsolatedIds.size === 196, "compatible-target-count", `expected=196 actual=${expectedCount - technicalIsolatedIds.size}`);

const fixture = JSON.parse(fs.readFileSync("e2e/fixtures/developer-global-frame-final-candidate.json", "utf8"));
const fixtureValidation = contract.validateDeveloperGlobalFrameSection(fixture);
requireCheck(fixtureValidation.valid, "candidate-fixture-validation", fixtureValidation.issues.join("; "));
const compatibleTargetPageIds = contract.DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS
  .map((entry) => entry.pageFactoryId)
  .filter((pageId) => !technicalIsolatedIds.has(pageId));
const generatedFixture = contract.buildDeveloperGlobalFrameSection({
  profileVersion: "1.0.0",
  sourceScope: "client_source",
  canaryDraft: {
    appearance: contract.createDeveloperGlobalStyleCanaryAppearance(
      contract.DEFAULT_VISUAL_CARD_LAYOUT_CONFIG,
      { layoutStyle: {}, globalTypography: {} },
    ),
    visualAuditId: "developer-global-frame-final-visual-audit",
    recoveryPointId: "developer-global-frame-final-recovery-point",
  },
  recoveryDraftId: "developer-global-frame-final-visual-draft",
  pilotVerificationId: "developer-global-frame-final-pilot-verification",
  pilotVerifiedAt: "2026-08-23T00:00:00.000Z",
  pilotChecks: contract.DEVELOPER_GLOBAL_STYLE_PILOT_CHECK_IDS,
  compatibleTargetPageIds,
});
requireCheck(JSON.stringify(fixture) === JSON.stringify(generatedFixture), "candidate-fixture-generated", "fixture differs from buildDeveloperGlobalFrameSection output");

const scopeCounts = { hq: 0, agency_source: 0, client_source: 0 };
const seenIds = new Set();
const seenIdentities = new Set();
const knownRegions = new Set(contract.PAGE_FACTORY_STANDARD.regions);
const requiredCapabilities = new Set(contract.PAGE_FACTORY_STANDARD.requiredCapabilities);

for (const entry of cases) {
  const page = entry.page;
  const context = `pageId=${page.id} | route=${entry.runtimeRoute}`;
  requireCheck(!seenIds.has(page.id), "unique-page-id", context);
  seenIds.add(page.id);
  const identity = `${page.sourceScope}:${page.route}`;
  requireCheck(!seenIdentities.has(identity), "unique-source-route", `${context} | identity=${identity}`);
  seenIdentities.add(identity);
  requireCheck(page.status === "complete" || page.status === "pilot-complete", "eligible-lifecycle", `${context} | status=${page.status}`);
  requireCheck(page.requiredRegions.length > 0 && page.requiredRegions.every((region) => knownRegions.has(region)), "declared-regions", context);
  requireCheck(page.requiredRegions.includes("body"), "body-region", context);
  requireCheck(page.requiredRegions.includes("title-1"), "title-1-region", context);
  requireCheck(page.requiredRegions.includes("footer"), "footer-region", context);
  requireCheck(requiredCapabilities.size === page.capabilities.length && page.capabilities.every((capability) => requiredCapabilities.has(capability)), "fixed-capabilities", context);
  requireCheck(
    contract.isDeveloperGlobalFrameIntentionalIsolationPageId(page.id) === technicalIsolatedIds.has(page.id),
    "technical-isolation-policy",
    context,
  );
  if (technicalIsolatedIds.has(page.id)) {
    const runtimePath = new URL(entry.runtimeRoute, "http://acceptance.local").pathname;
    requireCheck(!/^\/zb(?:\/|$)/u.test(runtimePath), "technical-isolated-root-route", context);
  }

  const resolution = contract.resolveDeveloperGlobalFrameAdapterForPage(page);
  requireCheck(Boolean(resolution), "page-adapter-resolution", context);
  requireCheck(resolution?.pageFactoryId === page.id && resolution?.sourceScope === page.sourceScope, "page-adapter-identity", context);
  const url = new URL(entry.runtimeRoute, "http://acceptance.local");
  const routeResolution = contract.resolveDeveloperGlobalFrameAdapterForRoute(url.pathname, url.search, page.sourceScope);
  requireCheck(routeResolution?.pageFactoryId === page.id, "route-adapter-resolution", `${context} | resolved=${routeResolution?.pageFactoryId ?? "null"}`);
  scopeCounts[page.sourceScope] += 1;
}

requireCheck(JSON.stringify(scopeCounts) === JSON.stringify({ hq: 66, agency_source: 33, client_source: 102 }), "three-scope-coverage", `actual=${JSON.stringify(scopeCounts)}`);
for (const pageId of technicalIsolatedIds) {
  requireCheck(seenIds.has(pageId), "technical-isolated-registration", `pageId=${pageId}`);
}
requireCheck(contract.DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS.length === expectedCount, "published-target-registry", `expected=${expectedCount} actual=${contract.DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS.length}`);
requireCheck(contract.ACCEPTANCE_DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID === contract.DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID, "fixture-template-id", `fixture=${contract.ACCEPTANCE_DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID} source=${contract.DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID}`);
requireCheck(contract.ACCEPTANCE_DEVELOPER_GLOBAL_FRAME_CONTRACT_VERSION === contract.DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION, "fixture-contract-version", `fixture=${contract.ACCEPTANCE_DEVELOPER_GLOBAL_FRAME_CONTRACT_VERSION} source=${contract.DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION}`);
requireCheck(JSON.stringify(contract.ACCEPTANCE_DEVELOPER_GLOBAL_FRAME_REGIONS) === JSON.stringify(contract.DEVELOPER_GLOBAL_FRAME_REGIONS), "fixture-regions", "browser fixture regions drifted from source contract");
requireCheck(JSON.stringify(contract.ACCEPTANCE_DEVELOPER_GLOBAL_FRAME_PILOT_CHECK_IDS) === JSON.stringify(contract.DEVELOPER_GLOBAL_STYLE_PILOT_CHECK_IDS), "fixture-pilot-checks", "browser fixture pilot checks drifted from source contract");
requireCheck(contract.ACCEPTANCE_SHARED_WINDOW_CONTRACT.id === contract.SHARED_WINDOW_FACTORY_DEFAULT.id && contract.ACCEPTANCE_SHARED_WINDOW_CONTRACT.version === contract.SHARED_WINDOW_FACTORY_DEFAULT.version, "fixture-window-contract", "browser fixture window contract drifted from source contract");
requireCheck(JSON.stringify(contract.ACCEPTANCE_SHARED_WINDOW_CONTRACT.registryIds) === JSON.stringify(contract.SHARED_WINDOW_REGISTRY.map((entry) => entry.id)), "fixture-window-registry", "browser fixture window registry drifted from source registry");
const sourceExplicitTargets = Object.fromEntries(contract.DEVELOPER_GLOBAL_FRAME_ADAPTER_REGISTRY.map((entry) => [entry.pageFactoryId, { profilePageId: entry.profilePageId, role: entry.role }]));
requireCheck(JSON.stringify(contract.ACCEPTANCE_EXPLICIT_GLOBAL_FRAME_TARGETS) === JSON.stringify(sourceExplicitTargets), "fixture-explicit-targets", "browser fixture explicit adapter identities drifted from source registry");
for (const pageId of seenIds) {
  const count = viewportCases.filter((entry) => entry.pageId === pageId).length;
  requireCheck(count === 3, "per-page-viewport-coverage", `pageId=${pageId} | expected=3 actual=${count}`);
}

const spec = fs.readFileSync("e2e/developer-global-frame-all-pages.spec.ts", "utf8");
const reporter = fs.readFileSync("e2e/reporters/developer-global-frame-isolation-reporter.mjs", "utf8");
const runner = fs.readFileSync("scripts/run-developer-global-frame-acceptance.mjs", "utf8");
const reportVerifier = fs.readFileSync("scripts/verify-developer-global-frame-acceptance-report.mjs", "utf8");
const fixtureGenerator = fs.readFileSync("scripts/generate-developer-global-frame-final-candidate.mjs", "utf8");
for (const token of [
  "selectDeveloperGlobalFrameAcceptanceCases",
  "B2B_GLOBAL_FRAME_ACCEPTANCE_CANDIDATE_FILE",
  "developer-global-frame-case-v2",
  "data-developer-global-frame-published-hash",
  "check=published-runtime-version-hash",
  "check=declared-frame-regions",
  "check=region-marker-hover-accuracy",
  "check=unique-scroll-owner-and-scrollability",
  "check=scrollbar-geometry-and-spacing",
  "check=no-horizontal-overflow",
  "check=left-outer-body-marker",
  "check=technical-route-explicit-isolation-and-original-output",
]) {
  requireCheck(spec.includes(token), "browser-acceptance-token", `missing=${token}`);
}
for (const forbidden of [
  "buildPublishedSection",
  'const PUBLISHED_PROFILE_VERSION = "8.8.8"',
  '"8".repeat(64)',
  "isolated target resolves its adapter but never applies the published runtime",
]) {
  requireCheck(!spec.includes(forbidden), "synthetic-browser-fixture-forbidden", `present=${forbidden}`);
}
for (const token of [
  "schemaVersion: 2",
  'kind: "developer-global-frame-acceptance-report/v2"',
  'trustLevel: "untrusted-local"',
  'issuer: "local-playwright"',
  "caseResults",
  "checksHash",
  "pageId",
  "sourceScope",
  "route",
  "viewport",
  "check",
  "targetCompatibility",
  "sharedWindowResults",
  "reportHash",
  "developer-global-frame-acceptance-report.v2.json",
]) {
  requireCheck(reporter.includes(token), "v2-reporter-token", `missing=${token}`);
}
for (const token of [
  "DEVELOPER_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_IDS",
  "B2B_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_IDS",
  "B2B_GLOBAL_FRAME_ACCEPTANCE_CANDIDATE_FILE",
  "B2B_GLOBAL_FRAME_ACCEPTANCE_OUTPUT_DIR",
  "developer-global-frame-artifacts",
  "developer-global-frame-acceptance-candidate/v2",
  "prepareDeveloperGlobalFrameAcceptanceArtifactPaths",
  "--candidate-section",
  "--frame-section-hash",
  "--base-draft-hash",
  "--source-build-digest",
  "--page-registry-hash",
  "--adapter-registry-hash",
  "--isolation-policy-hash",
  "--test-spec-hash",
  "sourceBuildDigest()",
  "developer-global-frame-tested-source-bundle/v1",
  "--output=",
  "pageId-or-route-fragment[",
]) {
  requireCheck(runner.includes(token), "acceptance-runner-token", `missing=${token}`);
}
for (const token of [
  "buildDeveloperGlobalFrameSection",
  "DEFAULT_VISUAL_CARD_LAYOUT_CONFIG",
  "createDeveloperGlobalStyleCanaryAppearance",
  "compatible=196",
  "isolated=5",
]) {
  requireCheck(fixtureGenerator.includes(token), "candidate-generator-token", `missing=${token}`);
}
for (const token of [
  "missing-or-duplicate-viewport",
  "compatible-failure",
  "isolation-assertion",
  "synthetic-evidence",
  "case-candidate-hash",
  "report-hash",
  "untrusted-publication-boundary",
]) {
  requireCheck(reportVerifier.includes(token), "v2-report-verifier-token", `missing=${token}`);
}

console.log([
  "developer global frame acceptance manifest passed",
  `pages=${cases.length}`,
  `pageViewportCases=${viewportCases.length}`,
  `viewports=${viewports.map((viewport) => viewport.width).join("/")}`,
  `hq=${scopeCounts.hq}`,
  `agency=${scopeCounts.agency_source}`,
  `client=${scopeCounts.client_source}`,
  `compatible=${expectedCount - technicalIsolatedIds.size}`,
  `isolated=${technicalIsolatedIds.size}`,
].join(" | "));
