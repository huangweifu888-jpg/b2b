import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { chromium } from "@playwright/test";
import {
  buildDeveloperWorkflowRouteTarget,
  fingerprintDeveloperWorkflowTargetManifest,
  fingerprintDeveloperWorkflowValue,
} from "../src/lib/developer-workflow-target-manifest.mjs";

const frontendRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(frontendRoot, "..");
const requestedTargetTab = (process.env.B2B_PERF_PRODUCT_MARKET_TAB || "operations").trim().toLowerCase();
const benchmarkTargets = Object.freeze({
  operations: Object.freeze({
    tab: "operations",
    artifactPrefix: "product-market-operations-performance",
    pageFactoryId: "client-source-product-market-operations",
    route: "/product-market?tab=operations",
    firstCardSelector: "[data-product-market-card]",
    renderedCardSelector: "[data-product-market-card]",
    visibleGroupsSelector: "[data-product-market-operations-visible-groups]",
    visibleGroupsAttribute: "data-product-market-operations-visible-groups",
    sourceFiles: [],
    manifestEntrySources: [],
  }),
  modules: Object.freeze({
    tab: "modules",
    artifactPrefix: "product-market-modules-performance",
    pageFactoryId: "client-source-product-market-modules",
    route: "/product-market?tab=modules",
    firstCardSelector: '[data-responsive-structure-item="module"]',
    renderedCardSelector: '[data-responsive-structure-item="module"]',
    visibleGroupsSelector: "[data-product-market-category-group]",
    visibleGroupsAttribute: null,
    sourceFiles: [
      "frontend/src/components/product-market/ProductMarketModulesPanel.tsx",
      "frontend/src/components/product-market/ProductMarketModulesPanel.css",
    ],
    manifestEntrySources: ["src/components/product-market/ProductMarketModulesPanel.tsx"],
  }),
  layout: Object.freeze({
    tab: "layout",
    artifactPrefix: "product-market-layout-performance",
    pageFactoryId: "client-source-product-market-layout",
    route: "/product-market?tab=layout",
    firstCardSelector: "[data-layout-unified-settings]",
    renderedCardSelector: "[data-layout-unified-settings]",
    visibleGroupsSelector: "[data-layout-unified-settings]",
    visibleGroupsAttribute: null,
    sourceFiles: [],
    manifestEntrySources: [],
  }),
  service: Object.freeze({
    tab: "service",
    artifactPrefix: "product-market-service-performance",
    pageFactoryId: "client-source-product-market-service",
    route: "/product-market?tab=service",
    firstCardSelector: '[data-responsive-structure-item="service-section"]:not([aria-busy])',
    renderedCardSelector: "[data-customer-service-expert-card], [data-customer-service-reminder-style]",
    visibleGroupsSelector: '[data-responsive-structure-item="service-section"]',
    visibleGroupsAttribute: null,
    preflightVisit: true,
    sourceFiles: [
      "frontend/src/components/product-market/ProductMarketCustomerServiceSection.tsx",
      "frontend/src/index.css",
      "frontend/src/lib/customer-service-media.ts",
      "frontend/src/lib/product-market-customer-service-section-loader.ts",
      "frontend/src/lib/customer-service-reminder-sound.ts",
      "frontend/src/lib/customer-service-voice.ts",
    ],
    manifestEntrySources: ["src/components/product-market/ProductMarketCustomerServiceSection.tsx"],
  }),
});
const benchmarkTarget = benchmarkTargets[requestedTargetTab];
if (!benchmarkTarget) {
  throw new Error(`Unsupported Product Market performance target: ${requestedTargetTab}`);
}
const pageFactoryId = benchmarkTarget.pageFactoryId;
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const pageRegistry = await readJson(resolve(frontendRoot, "src/page-factory/page-registry.json"));
const pageEntry = pageRegistry.pages.find((page) => page.id === pageFactoryId);
if (!pageEntry
  || pageEntry.sourceScope !== "client_source"
  || pageEntry.route !== benchmarkTarget.route
  || pageEntry.component !== "frontend/src/pages/ProductMarket.tsx"
  || pageEntry.entryComponent !== "frontend/src/pages/ProductMarket.tsx") {
  throw new Error(`${pageFactoryId} does not match the registered Product Market ${benchmarkTarget.tab} page contract.`);
}
const visualEvidenceContract = await readJson(resolve(repoRoot, "shared/contracts/visual-evidence-contract.json"));
const pageDnaContract = await readJson(resolve(repoRoot, "shared/contracts/page-dna-contract.json"));
const sharedOptimizationContract = await readJson(resolve(repoRoot, "shared/contracts/developer-optimization-contract.json"));
const mediaOptimizationContract = await readJson(resolve(repoRoot, "shared/contracts/media-optimization-contract.json"));
const viewportId = process.env.B2B_PERF_VIEWPORT_ID || "desktop";
const viewportContract = visualEvidenceContract.viewports.find((candidate) => candidate.id === viewportId);
if (!viewportContract) throw new Error(`Unknown visual-evidence viewport: ${viewportId}`);
const viewport = { width: viewportContract.width, height: viewportContract.height };
const pageIdentity = `${pageEntry.sourceScope}:${pageEntry.route}`;
const targetManifest = [buildDeveloperWorkflowRouteTarget(pageEntry.sourceScope, pageEntry.route, pageEntry.status)];
const targetManifestFingerprint = fingerprintDeveloperWorkflowTargetManifest(targetManifest);
const sourceShellPrefix = { client_source: "/zb/client-source" }[pageEntry.sourceScope];
if (!sourceShellPrefix) throw new Error(`Unsupported source shell: ${pageEntry.sourceScope}`);
const baseUrl = process.env.B2B_PERF_BASE_URL || "http://127.0.0.1:3003";
const targetPath = `${sourceShellPrefix}${pageEntry.route}`;
const targetUrl = new URL(targetPath, baseUrl).href;
const fastMode = ["1", "true"].includes((process.env.B2B_PERF_FAST || "").trim().toLowerCase());
const defaultSampleCount = fastMode ? 2 : 5;
const sampleCount = Math.max(1, Math.min(7, Number.parseInt(process.env.B2B_PERF_SAMPLES || String(defaultSampleCount), 10) || defaultSampleCount));
const samplingMode = fastMode ? "quick" : "full";
const label = (process.env.B2B_PERF_LABEL || "current").replace(/[^a-zA-Z0-9._-]+/gu, "-");
const measuredAt = new Date().toISOString();
const runId = `${label}-${measuredAt.replace(/[:.]/gu, "-")}`;
const outputPath = resolve(
  frontendRoot,
  process.env.B2B_PERF_OUTPUT
    || `../release/local-performance/artifacts/${benchmarkTarget.artifactPrefix}-${runId}.json`,
);
const baselinePath = process.env.B2B_PERF_BASELINE
  ? resolve(frontendRoot, process.env.B2B_PERF_BASELINE)
  : null;
const readinessTimeoutMs = 60_000;
const settleMs = 750;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function fingerprintFiles(paths) {
  const entries = [];
  for (const path of [...new Set(paths)].sort()) {
    entries.push({ path: path.replaceAll("\\", "/"), sha256: sha256(await readFile(resolve(repoRoot, path))) });
  }
  return fingerprintDeveloperWorkflowValue(entries);
}

async function inspectBuiltRouteClosure() {
  try {
    const manifest = await readJson(resolve(frontendRoot, "dist/manifest.json"));
    const targetEntrySources = new Set([
      "src/pages/ProductMarket.tsx",
      ...benchmarkTarget.manifestEntrySources,
    ]);
    const rootKeys = Object.entries(manifest)
      .filter(([key, entry]) => targetEntrySources.has(key)
        || entry?.name === "ProductMarket"
        || /^_ProductMarket-[^.]+\.js$/u.test(key))
      .map(([key]) => key);
    if (!rootKeys.length) return null;
    const visited = new Set();
    const pending = [...rootKeys];
    while (pending.length) {
      const key = pending.pop();
      if (!key || visited.has(key)) continue;
      visited.add(key);
      for (const dependency of manifest[key]?.imports || []) pending.push(dependency);
    }
    const files = [];
    for (const key of [...visited].sort()) {
      const entry = manifest[key];
      const outputFiles = [entry?.file, ...(entry?.css || []), ...(entry?.assets || [])].filter(Boolean);
      for (const file of outputFiles) {
        const content = await readFile(resolve(frontendRoot, "dist", file));
        files.push({ key, file, bytes: content.byteLength, sha256: sha256(content) });
      }
    }
    return {
      entryKeys: rootKeys.sort(),
      fileCount: files.length,
      totalBytes: files.reduce((total, file) => total + file.bytes, 0),
      fingerprint: fingerprintDeveloperWorkflowValue(files),
      files,
    };
  } catch {
    return null;
  }
}

const targetSourceFingerprint = await fingerprintFiles([
  pageEntry.component,
  pageEntry.entryComponent,
  "frontend/src/components/Sidebar.tsx",
  "frontend/src/components/customer-service/CustomerServiceAvatarMedia.tsx",
  "frontend/src/components/DeferredShellUtilities.tsx",
  "frontend/src/components/DeferredShellRuntimeHosts.tsx",
  "frontend/src/components/ResponsivePageHost.tsx",
  "frontend/src/components/product-market/ProductMarketModuleChildrenList.tsx",
  "frontend/src/components/product-market/ProductMarketModuleEditorDialog.tsx",
  "frontend/src/lib/customer-service-media.ts",
  "frontend/src/lib/post-paint-lazy.ts",
  "frontend/src/lib/product-market-modules-editor-contract.ts",
  "frontend/src/lib/product-market-order-contract.ts",
  "frontend/src/lib/product-market-store.ts",
  "frontend/src/lib/route-preload.ts",
  "frontend/src/page-factory/page-registry.json",
  ...benchmarkTarget.sourceFiles,
  "shared/contracts/page-dna-contract.json",
  "shared/contracts/visual-evidence-contract.json",
  "shared/contracts/developer-optimization-contract.json",
  "shared/contracts/media-optimization-contract.json",
]);
const builtRouteClosure = await inspectBuiltRouteClosure();
const measurementProtocolFingerprint = sha256(await readFile(import.meta.filename));
const softwareVersionSource = await readFile(resolve(frontendRoot, "src/lib/software-version.ts"), "utf8");
const baseHVersion = softwareVersionSource.match(/HQ_SOFTWARE_VERSION\s*=\s*"([^"]+)"/u)?.[1] || "unknown";
const hSourceFingerprint = softwareVersionSource.match(/HQ_SOURCE_FINGERPRINT\s*=\s*"([^"]+)"/u)?.[1] || "unknown";
const contractVersions = {
  pageDna: pageDnaContract.version,
  visualEvidence: visualEvidenceContract.version,
  sharedOptimization: sharedOptimizationContract.version,
  mediaOptimization: mediaOptimizationContract.version,
  pageFactory: pageRegistry.factoryVersion,
};
const pageDnaTargetManifest = {
  scope: "page",
  manifestId: pageIdentity,
  targets: [{
    identityKey: pageIdentity,
    pageFactoryId,
    sourceScope: pageEntry.sourceScope,
    normalizedRoute: pageEntry.route,
    component: pageEntry.component,
    entryComponent: pageEntry.entryComponent,
    template: pageEntry.template,
    lifecycle: pageEntry.status,
  }],
};
const pageDnaFingerprint = sha256(JSON.stringify({
  auditScope: "page",
  identityKey: pageIdentity,
  targetManifest: pageDnaTargetManifest,
  pageFactoryVersion: pageRegistry.factoryVersion,
  sharedOptimizationVersion: sharedOptimizationContract.version,
  mediaContractVersion: mediaOptimizationContract.version,
  visualEvidenceContractVersion: visualEvidenceContract.version,
  sourceFingerprint: hSourceFingerprint,
}));

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
  "reminderCoverResourceCount",
  "reminderCoverEncodedBytes",
  "reminderToneResourceCount",
  "reminderToneEncodedBytes",
  "duplicateRequestExcess",
  "mutationRequestCount",
  "longTaskCount",
  "longTaskTotalMs",
  "maxLongTaskMs",
  "layoutShiftScore",
]);

const primarySpeedMetricIds = Object.freeze([
  "visualReadyMs",
  "editReadyMs",
  "domContentLoadedMs",
  "firstContentfulPaintMs",
  "largestContentfulPaintMs",
]);

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function summarize(samples, aggregate = median) {
  const summary = {};
  for (const metricId of measuredMetricIds) {
    summary[metricId] = aggregate(samples.map((sample) => Number(sample[metricId]) || 0));
  }
  summary.domNodes = aggregate(samples.map((sample) => sample.domNodes));
  summary.renderedCards = aggregate(samples.map((sample) => sample.renderedCards));
  summary.visibleGroups = aggregate(samples.map((sample) => sample.visibleGroups ?? sample.visibleOperationGroups));
  summary.visibleOperationGroups = summary.visibleGroups;
  summary.failedRequestCount = aggregate(samples.map((sample) => sample.failedRequestCount));
  const duplicateResources = new Map();
  for (const sample of samples) {
    for (const item of sample.duplicateResources || []) {
      const current = duplicateResources.get(item.url) || { occurrences: 0, maximumCount: 0 };
      current.occurrences += 1;
      current.maximumCount = Math.max(current.maximumCount, item.count);
      duplicateResources.set(item.url, current);
    }
  }
  summary.duplicateResources = Array.from(duplicateResources.entries())
    .map(([url, counts]) => ({ url, ...counts }))
    .sort((left, right) => right.occurrences - left.occurrences || right.maximumCount - left.maximumCount || left.url.localeCompare(right.url))
    .slice(0, 20);
  return summary;
}

const summarizeP75 = (samples) => summarize(samples, (values) => percentile(values, 0.75));

function compareMetrics(baseline, candidate) {
  const metrics = {};
  const improvedMetricIds = [];
  const regressedMetricIds = [];
  const unchangedMetricIds = [];
  for (const metricId of measuredMetricIds) {
    const before = Number(baseline?.[metricId]) || 0;
    const after = Number(candidate?.[metricId]) || 0;
    const delta = after - before;
    const deltaPercent = before > 0 ? Number(((delta / before) * 100).toFixed(1)) : null;
    const tolerance = metricId === "layoutShiftScore"
      ? 0.01
      : metricId.endsWith("Bytes")
        ? Math.max(2_048, before * 0.05)
        : metricId.endsWith("Ms")
          ? Math.max(20, before * 0.05)
          : metricId === "resourceCount"
            ? Math.max(2, before * 0.03)
            : 0;
    const status = delta < -tolerance ? "improved" : delta > tolerance ? "regressed" : "unchanged";
    metrics[metricId] = { before, after, delta, deltaPercent, status };
    if (status === "improved") improvedMetricIds.push(metricId);
    else if (status === "regressed") regressedMetricIds.push(metricId);
    else unchangedMetricIds.push(metricId);
  }
  const primaryImprovedMetricIds = primarySpeedMetricIds.filter((metricId) => metrics[metricId]?.status === "improved");
  const primaryRegressedMetricIds = primarySpeedMetricIds.filter((metricId) => metrics[metricId]?.status === "regressed");
  const verdict = primaryRegressedMetricIds.length > 0
    ? "regressed"
    : primaryImprovedMetricIds.length > 0
      ? "improved"
      : "unchanged";
  return {
    verdict,
    metrics,
    improvedMetricIds,
    regressedMetricIds,
    unchangedMetricIds,
    primaryImprovedMetricIds,
    primaryRegressedMetricIds,
  };
}

function fallbackSignature(sample) {
  const signatures = new Set((sample.fallbackRequests || []).map((failure) => {
    try {
      const url = new URL(failure.url);
      return `${failure.method} ${url.origin}${url.pathname} ${failure.errorText}`;
    } catch {
      return `${failure.method} ${failure.url} ${failure.errorText}`;
    }
  }));
  return JSON.stringify([...signatures].sort());
}

function inspectFunctionalParity(baselinePhase, candidatePhase) {
  const issues = [];
  const expected = {
    renderedCards: baselinePhase.median.renderedCards,
    visibleGroups: baselinePhase.median.visibleGroups ?? baselinePhase.median.visibleOperationGroups,
    fallbackRequestSignature: fallbackSignature(baselinePhase.samples[0] || {}),
  };
  const inspectSamples = (phaseLabel, phase) => {
    for (const [index, sample] of phase.samples.entries()) {
      if (!(sample.workspaceReadyMs > 0)) issues.push(`${phaseLabel}[${index}]:workspace-not-ready`);
      if (!(sample.hydratedReadyMs > 0)) issues.push(`${phaseLabel}[${index}]:hydration-not-ready`);
      if (!(sample.firstCardReadyMs > 0)) issues.push(`${phaseLabel}[${index}]:first-card-not-ready`);
      if (sample.failedRequestCount !== 0) issues.push(`${phaseLabel}[${index}]:failed-requests=${sample.failedRequestCount}`);
      if (fallbackSignature(sample) !== expected.fallbackRequestSignature) {
        issues.push(`${phaseLabel}[${index}]:fallback-environment-drift`);
      }
      if (phaseLabel === "candidate" && sample.mutationRequestCount !== 0) {
        issues.push(`${phaseLabel}[${index}]:passive-mutations=${sample.mutationRequestCount}`);
      }
      if (sample.renderedCards !== expected.renderedCards) {
        issues.push(`${phaseLabel}[${index}]:rendered-cards=${sample.renderedCards},expected=${expected.renderedCards}`);
      }
      const visibleGroups = sample.visibleGroups ?? sample.visibleOperationGroups;
      if (visibleGroups !== expected.visibleGroups) {
        issues.push(`${phaseLabel}[${index}]:visible-groups=${visibleGroups},expected=${expected.visibleGroups}`);
      }
    }
  };
  inspectSamples("baseline", baselinePhase);
  inspectSamples("candidate", candidatePhase);
  return {
    status: issues.length ? "failed" : "passed",
    expected,
    issues,
  };
}

function comparisonEnvironmentIssues(baseline, candidate) {
  const checks = [
    ["schemaVersion", baseline.schemaVersion, candidate.schemaVersion],
    ["protocol", baseline.protocol, candidate.protocol],
    ["measurementProtocolFingerprint", baseline.measurementProtocolFingerprint, candidate.measurementProtocolFingerprint],
    ["pageIdentity", baseline.pageIdentity, candidate.pageIdentity],
    ["targetManifestFingerprint", baseline.governance?.targetManifestFingerprint, candidate.governance?.targetManifestFingerprint],
    ["pageDnaFingerprint", baseline.governance?.pageDnaFingerprint, candidate.governance?.pageDnaFingerprint],
    ["contractVersions", JSON.stringify(baseline.governance?.contractVersions), JSON.stringify(candidate.governance?.contractVersions)],
    ["origin", baseline.environment?.origin, candidate.environment?.origin],
    ["appMode", baseline.environment?.appMode, candidate.environment?.appMode],
    ["browserName", baseline.environment?.browserName, candidate.environment?.browserName],
    ["browserVersionMajor", baseline.environment?.browserVersionMajor, candidate.environment?.browserVersionMajor],
    ["channel", baseline.environment?.channel, candidate.environment?.channel],
    ["viewportId", baseline.environment?.viewportId, candidate.environment?.viewportId],
    ["viewport", JSON.stringify(baseline.environment?.viewport), JSON.stringify(candidate.environment?.viewport)],
    ["sampleCount", baseline.sampleCount, candidate.sampleCount],
  ];
  return checks
    .filter(([, before, after]) => before !== after)
    .map(([field, before, after]) => `${field}:${String(before)}!=${String(after)}`);
}

function compareOptimizationPhase(baseline, candidate, phase, environmentIssues) {
  const metrics = compareMetrics(baseline[phase].median, candidate[phase].median);
  const functionalParity = inspectFunctionalParity(baseline[phase], candidate[phase]);
  const valid = environmentIssues.length === 0 && functionalParity.status === "passed";
  return {
    ...metrics,
    verdict: valid ? metrics.verdict : "invalid",
    environmentIssues,
    functionalParity,
  };
}

function inspectResponsiveParity(baseline, candidate) {
  const issues = [];
  const baselineById = new Map((baseline.responsiveCoverage || []).map((result) => [result.id, result]));
  for (const expectedViewport of visualEvidenceContract.viewports) {
    const before = baselineById.get(expectedViewport.id);
    const after = (candidate.responsiveCoverage || []).find((result) => result.id === expectedViewport.id);
    if (!before || !after) {
      issues.push(`${expectedViewport.id}:missing-coverage`);
      continue;
    }
    if (before.width !== expectedViewport.width || before.height !== expectedViewport.height
      || after.width !== expectedViewport.width || after.height !== expectedViewport.height) {
      issues.push(`${expectedViewport.id}:viewport-contract-mismatch`);
    }
    const baselineBlockingIssues = (before.issues || []).filter((issue) => !issue.startsWith("passive-mutations="));
    if (baselineBlockingIssues.length) issues.push(`${expectedViewport.id}:baseline-${baselineBlockingIssues.join("+")}`);
    if (after.status !== "passed") issues.push(`${expectedViewport.id}:candidate-${after.status}`);
    if (after.renderedCards !== before.renderedCards) issues.push(`${expectedViewport.id}:rendered-card-mismatch`);
    if ((after.visibleGroups ?? after.visibleOperationGroups) !== (before.visibleGroups ?? before.visibleOperationGroups)) {
      issues.push(`${expectedViewport.id}:visible-group-mismatch`);
    }
    if (after.fallbackRequestSignature !== before.fallbackRequestSignature) {
      issues.push(`${expectedViewport.id}:fallback-environment-drift`);
    }
  }
  return { status: issues.length ? "failed" : "passed", issues };
}

function buildOptimizationComparison(baseline, candidate) {
  const environmentIssues = comparisonEnvironmentIssues(baseline, candidate);
  const cold = compareOptimizationPhase(baseline, candidate, "cold", environmentIssues);
  const repeat = compareOptimizationPhase(baseline, candidate, "repeat", environmentIssues);
  const responsiveParity = inspectResponsiveParity(baseline, candidate);
  const verdicts = [cold.verdict, repeat.verdict];
  const verdict = responsiveParity.status !== "passed" || verdicts.includes("invalid")
    ? "invalid"
    : verdicts.includes("regressed")
      ? "regressed"
      : verdicts.includes("improved")
        ? "improved"
        : "unchanged";
  return {
    verdict,
    baselineRunId: baseline.runId,
    candidateRunId: candidate.runId,
    baselineReportFingerprint: baseline.reportFingerprint || null,
    baselineTargetSourceFingerprint: baseline.governance?.targetSourceFingerprint || null,
    candidateTargetSourceFingerprint: candidate.governance?.targetSourceFingerprint || null,
    baselineRouteClosureFingerprint: baseline.governance?.builtRouteClosure?.fingerprint || null,
    candidateRouteClosureFingerprint: candidate.governance?.builtRouteClosure?.fingerprint || null,
    responsiveParity,
    cold,
    repeat,
  };
}

async function installPerformanceObservers(page) {
  await page.addInitScript(() => {
    const state = {
      largestContentfulPaintMs: 0,
      layoutShiftScore: 0,
      longTasks: [],
    };
    Object.defineProperty(window, "__productMarketOperationsPerformance", {
      value: state,
      configurable: true,
    });
    if (typeof PerformanceObserver === "undefined") return;
    if (PerformanceObserver.supportedEntryTypes.includes("largest-contentful-paint")) {
      const observer = new PerformanceObserver((list) => {
        const latest = list.getEntries().at(-1);
        if (latest) state.largestContentfulPaintMs = Math.round(latest.startTime);
      });
      observer.observe({ type: "largest-contentful-paint", buffered: true });
    }
    if (PerformanceObserver.supportedEntryTypes.includes("layout-shift")) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) state.layoutShiftScore += entry.value;
        }
      });
      observer.observe({ type: "layout-shift", buffered: true });
    }
    if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      const observer = new PerformanceObserver((list) => {
        state.longTasks.push(...list.getEntries().map((entry) => ({
          startTime: entry.startTime,
          duration: entry.duration,
        })));
      });
      observer.observe({ type: "longtask", buffered: true });
    }
  });
}

async function measureVisit(context, phase, clearCache) {
  const page = await context.newPage();
  await installPerformanceObservers(page);
  const client = await context.newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.setCacheDisabled", { cacheDisabled: false });
  if (clearCache) await client.send("Network.clearBrowserCache");
  const failedRequests = [];
  const mutationRequests = [];
  const isBusinessMutation = (request) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) return false;
    try {
      return new URL(request.url()).pathname !== "/api/v1/auth/local/demo-session";
    } catch {
      return true;
    }
  };
  const isExpectedLocalPreviewFallback = (failure) => {
    try {
      const url = new URL(failure.url);
      return url.origin === "http://127.0.0.1:8000" && (
        url.pathname === "/api/v1/auth/local/demo-session"
        || url.pathname === "/api/template-snapshot/templates/client-source-global"
      );
    } catch {
      return false;
    }
  };
  page.on("requestfailed", (request) => failedRequests.push({
    method: request.method(),
    url: request.url(),
    errorText: request.failure()?.errorText || "unknown",
  }));
  page.on("request", (request) => {
    if (isBusinessMutation(request)) mutationRequests.push({ method: request.method(), url: request.url() });
  });

  const startedAt = performance.now();
  const elapsed = () => Math.max(0, Math.round(performance.now() - startedAt));
  const workspaceReady = page.locator("[data-product-market-workspace]").waitFor({ state: "visible", timeout: readinessTimeoutMs }).then(elapsed);
  const hydratedReady = page.locator('[data-product-market-hydrated="true"]').waitFor({ state: "visible", timeout: readinessTimeoutMs }).then(elapsed);
  const firstCardReady = page.locator(benchmarkTarget.firstCardSelector).first().waitFor({ state: "visible", timeout: readinessTimeoutMs }).then(elapsed);
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: readinessTimeoutMs });
  const domContentLoadedMs = elapsed();
  const [workspaceReadyMs, hydratedReadyMs, firstCardReadyMs] = await Promise.all([
    workspaceReady,
    hydratedReady,
    firstCardReady,
  ]);
  await page.waitForTimeout(settleMs);

  const browserMetrics = await page.evaluate((selectors) => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource");
    const paints = performance.getEntriesByType("paint");
    const resourceCounts = new Map();
    let totalEncodedBytes = 0;
    let scriptEncodedBytes = 0;
    let totalTransferBytes = 0;
    let scriptTransferBytes = 0;
    let reminderCoverResourceCount = 0;
    let reminderCoverEncodedBytes = 0;
    let reminderToneResourceCount = 0;
    let reminderToneEncodedBytes = 0;
    for (const entry of resources) {
      resourceCounts.set(entry.name, (resourceCounts.get(entry.name) || 0) + 1);
      const encodedBytes = entry.encodedBodySize || 0;
      const transferBytes = entry.transferSize || 0;
      const scriptResource = entry.initiatorType === "script" || /\.(?:m?js|tsx?)(?:\?|$)/u.test(entry.name);
      totalEncodedBytes += encodedBytes;
      totalTransferBytes += transferBytes;
      if (entry.name.includes("/customer-service/reminder-covers/")) {
        reminderCoverResourceCount += 1;
        reminderCoverEncodedBytes += encodedBytes;
      }
      if (entry.name.includes("/customer-service/reminder-tones/")) {
        reminderToneResourceCount += 1;
        reminderToneEncodedBytes += encodedBytes;
      }
      if (scriptResource) {
        scriptEncodedBytes += encodedBytes;
        scriptTransferBytes += transferBytes;
      }
    }
    const state = window.__productMarketOperationsPerformance || {
      largestContentfulPaintMs: 0,
      layoutShiftScore: 0,
      longTasks: [],
    };
    const longTaskDurations = state.longTasks.map((entry) => entry.duration);
    const visibleGroupsNode = document.querySelector(selectors.visibleGroupsSelector);
    const visibleGroupsAttributeValue = selectors.visibleGroupsAttribute
      ? visibleGroupsNode?.getAttribute(selectors.visibleGroupsAttribute)?.split("/", 1)[0]
      : null;
    const visibleGroups = visibleGroupsAttributeValue
      ? Number.parseInt(visibleGroupsAttributeValue, 10) || 0
      : document.querySelectorAll(selectors.visibleGroupsSelector).length;
    return {
      appMode: resources.some((entry) => entry.name.includes("/@vite/client")) ? "development" : "production-preview",
      navigationProtocol: navigation?.nextHopProtocol || "unknown",
      navigationResponseEndMs: Math.round(navigation?.responseEnd || 0),
      browserDomContentLoadedMs: Math.round(navigation?.domContentLoadedEventEnd || 0),
      loadEventEndMs: Math.round(navigation?.loadEventEnd || 0),
      firstContentfulPaintMs: Math.round(paints.find((entry) => entry.name === "first-contentful-paint")?.startTime || 0),
      largestContentfulPaintMs: state.largestContentfulPaintMs,
      layoutShiftScore: Number(state.layoutShiftScore.toFixed(3)),
      longTaskCount: longTaskDurations.length,
      longTaskTotalMs: Math.round(longTaskDurations.reduce((total, duration) => total + duration, 0)),
      maxLongTaskMs: Math.round(longTaskDurations.reduce((maximum, duration) => Math.max(maximum, duration), 0)),
      totalEncodedBytes,
      scriptEncodedBytes,
      totalTransferBytes,
      scriptTransferBytes,
      resourceCount: resources.length,
      reminderCoverResourceCount,
      reminderCoverEncodedBytes,
      reminderToneResourceCount,
      reminderToneEncodedBytes,
      duplicateResourceGroups: Array.from(resourceCounts.values()).filter((count) => count > 1).length,
      duplicateRequestExcess: Array.from(resourceCounts.values()).reduce((total, count) => total + Math.max(0, count - 1), 0),
      duplicateResources: Array.from(resourceCounts.entries())
        .filter(([, count]) => count > 1)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 20)
        .map(([url, count]) => ({ url, count })),
      documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      domNodes: document.getElementsByTagName("*").length,
      renderedCards: document.querySelectorAll(selectors.renderedCardSelector).length,
      visibleGroups,
      visibleOperationGroups: visibleGroups,
    };
  }, {
    renderedCardSelector: benchmarkTarget.renderedCardSelector,
    visibleGroupsSelector: benchmarkTarget.visibleGroupsSelector,
    visibleGroupsAttribute: benchmarkTarget.visibleGroupsAttribute,
  });

  const expectedFallbackRequests = failedRequests.filter(isExpectedLocalPreviewFallback);
  const unexpectedFailedRequests = failedRequests.filter((failure) => !isExpectedLocalPreviewFallback(failure));

  await page.close();
  return {
    phase,
    domContentLoadedMs,
    workspaceReadyMs,
    hydratedReadyMs,
    firstCardReadyMs,
    visualReadyMs: Math.max(workspaceReadyMs, firstCardReadyMs),
    editReadyMs: hydratedReadyMs,
    interactiveReadyMs: Math.max(workspaceReadyMs, hydratedReadyMs, firstCardReadyMs),
    failedRequestCount: unexpectedFailedRequests.length,
    failedRequests: unexpectedFailedRequests,
    fallbackRequestCount: expectedFallbackRequests.length,
    fallbackRequests: expectedFallbackRequests,
    mutationRequestCount: mutationRequests.length,
    mutationRequests,
    ...browserMetrics,
  };
}

async function readBaseline() {
  if (!baselinePath) return null;
  const parsed = JSON.parse(await readFile(baselinePath, "utf8"));
  if (parsed?.schemaVersion !== 2 || parsed?.pageIdentity !== pageIdentity || !parsed?.cold?.median || !parsed?.repeat?.median) {
    throw new Error(`Performance baseline does not match ${pageIdentity}: ${baselinePath}`);
  }
  return parsed;
}

const browserChannel = process.env.B2B_E2E_CHANNEL || (process.platform === "win32" ? "chrome" : undefined);
const browser = await chromium.launch({
  headless: true,
  channel: browserChannel,
});

try {
  const coldSamples = [];
  const repeatSamples = [];
  if (benchmarkTarget.preflightVisit) {
    const preflightContext = await browser.newContext({ viewport });
    await measureVisit(preflightContext, "preflight", true);
    await preflightContext.close();
  }
  for (let index = 0; index < sampleCount; index += 1) {
    const context = await browser.newContext({ viewport });
    coldSamples.push(await measureVisit(context, "cold", true));
    repeatSamples.push(await measureVisit(context, "repeat", false));
    await context.close();
  }
  const coldMedian = summarize(coldSamples);
  const repeatMedian = summarize(repeatSamples);
  const coldP75 = summarizeP75(coldSamples);
  const repeatP75 = summarizeP75(repeatSamples);
  const responsiveSamples = new Map([[viewportId, coldSamples[0]]]);
  for (const contractViewport of visualEvidenceContract.viewports) {
    if (responsiveSamples.has(contractViewport.id)) continue;
    const context = await browser.newContext({
      viewport: { width: contractViewport.width, height: contractViewport.height },
    });
    responsiveSamples.set(
      contractViewport.id,
      await measureVisit(context, `responsive-${contractViewport.id}`, true),
    );
    await context.close();
  }
  const responsiveCoverage = visualEvidenceContract.viewports.map((contractViewport) => {
    const sample = responsiveSamples.get(contractViewport.id);
    const issues = [];
    if (!sample || !(sample.workspaceReadyMs > 0)) issues.push("workspace-not-ready");
    if (!sample || !(sample.hydratedReadyMs > 0)) issues.push("hydration-not-ready");
    if (!sample || !(sample.firstCardReadyMs > 0)) issues.push("first-card-not-ready");
    if (sample?.failedRequestCount !== 0) issues.push(`failed-requests=${sample?.failedRequestCount ?? "missing"}`);
    if (sample?.mutationRequestCount !== 0) issues.push(`passive-mutations=${sample?.mutationRequestCount ?? "missing"}`);
    if (sample?.documentOverflow) issues.push("document-horizontal-overflow");
    if (sample?.renderedCards !== coldMedian.renderedCards) issues.push(`rendered-cards=${sample?.renderedCards ?? "missing"}`);
    if ((sample?.visibleGroups ?? sample?.visibleOperationGroups) !== (coldMedian.visibleGroups ?? coldMedian.visibleOperationGroups)) {
      issues.push(`visible-groups=${sample?.visibleGroups ?? sample?.visibleOperationGroups ?? "missing"}`);
    }
    return {
      id: contractViewport.id,
      width: contractViewport.width,
      height: contractViewport.height,
      status: issues.length ? "failed" : "passed",
      issues,
      renderedCards: sample?.renderedCards ?? 0,
      visibleGroups: sample?.visibleGroups ?? sample?.visibleOperationGroups ?? 0,
      visibleOperationGroups: sample?.visibleOperationGroups ?? 0,
      documentOverflow: sample?.documentOverflow ?? null,
      failedRequestCount: sample?.failedRequestCount ?? null,
      fallbackRequestCount: sample?.fallbackRequestCount ?? null,
      fallbackRequestSignature: fallbackSignature(sample || {}),
      mutationRequestCount: sample?.mutationRequestCount ?? null,
    };
  });
  const baseline = await readBaseline();
  const repeatMetricComparison = compareMetrics(coldMedian, repeatMedian);
  const repeatFunctionalParity = inspectFunctionalParity(
    { median: coldMedian, samples: coldSamples },
    { median: repeatMedian, samples: repeatSamples },
  );
  const report = {
    schemaVersion: 2,
    protocol: "page-dna-cold-repeat-median-p75-functional-parity",
    measurementProtocolFingerprint,
    runId,
    label,
    measuredAt,
    pageIdentity,
    sourceScope: pageEntry.sourceScope,
    normalizedRoute: pageEntry.route,
    pageFactoryId,
    targetTab: benchmarkTarget.tab,
    preflightVisit: benchmarkTarget.preflightVisit === true,
    targetUrl,
    sampleCount,
    samplingMode,
    environment: {
      origin: new URL(baseUrl).origin,
      appMode: coldSamples[0]?.appMode || "unknown",
      browserName: "chromium",
      browserVersion: browser.version(),
      browserVersionMajor: browser.version().split(".", 1)[0],
      channel: browserChannel || "bundled",
      navigationProtocol: coldSamples[0]?.navigationProtocol || "unknown",
      viewportId,
      viewport,
      sampleCount,
      samplingMode,
    },
    governance: {
      pageDnaFingerprint,
      targetManifest,
      targetManifestFingerprint,
      contractVersions,
      baseHVersion,
      hSourceFingerprint,
      targetSourceFingerprint,
      builtRouteClosure,
    },
    responsiveCoverage,
    cold: { median: coldMedian, p75: coldP75, samples: coldSamples },
    repeat: { median: repeatMedian, p75: repeatP75, samples: repeatSamples },
    repeatComparison: {
      ...repeatMetricComparison,
      verdict: repeatFunctionalParity.status === "passed" ? repeatMetricComparison.verdict : "invalid",
      functionalParity: repeatFunctionalParity,
    },
    optimizationComparison: null,
    baselineRef: baselinePath ? baselinePath.replaceAll("\\", "/") : null,
  };
  if (baseline) report.optimizationComparison = buildOptimizationComparison(baseline, report);
  report.reportFingerprint = fingerprintDeveloperWorkflowValue(report);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    outputPath: outputPath.replaceAll("\\", "/"),
    pageIdentity,
    cold: coldMedian,
    repeat: repeatMedian,
    coldP75,
    repeatP75,
    repeatComparison: report.repeatComparison,
    optimizationComparison: report.optimizationComparison,
    reportFingerprint: report.reportFingerprint,
  }, null, 2));
} finally {
  await browser.close();
}
