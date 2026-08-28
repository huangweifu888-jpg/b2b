import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

import {
  buildDeveloperWorkflowRouteTarget,
  buildDeveloperWorkflowTargetManifestPayload,
  fingerprintDeveloperWorkflowTargetManifest,
} from "../src/lib/developer-workflow-target-manifest.mjs";

const frontendRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(frontendRoot, "..");
const distRoot = resolve(frontendRoot, "dist");
const manifestPath = resolve(distRoot, "manifest.json");
const outputPath = resolve(distRoot, "bundle-budget-report.json");
const optimizationContract = JSON.parse(readFileSync(resolve(repositoryRoot, "shared/contracts/developer-optimization-contract.json"), "utf8"));
const mediaContract = JSON.parse(readFileSync(resolve(repositoryRoot, "shared/contracts/media-optimization-contract.json"), "utf8"));
const routeComposition = optimizationContract.routeComposition;

if (!existsSync(manifestPath)) throw new Error("构建预算失败：dist/manifest.json 不存在，请先运行 npm run analyze");
if (!routeComposition || typeof routeComposition !== "object") throw new Error("构建预算失败：共享合同缺少 routeComposition");
const manifestSource = readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(manifestSource);
const registryPath = resolve(repositoryRoot, routeComposition.registry);
const registrySource = readFileSync(registryPath, "utf8");
const pageRegistry = JSON.parse(registrySource);
const registeredPages = Array.isArray(pageRegistry.pages) ? pageRegistry.pages : [];
const eligibleRegisteredPages = registeredPages
  .filter((page) => page.status === "complete" || page.status === "pilot-complete");
const workflowTargetManifest = buildDeveloperWorkflowTargetManifestPayload(
  eligibleRegisteredPages.map((page) => buildDeveloperWorkflowRouteTarget(page.sourceScope, page.route, page.status)),
);
const uniqueWorkflowTargets = workflowTargetManifest.targets;
const targetManifestFingerprint = fingerprintDeveloperWorkflowTargetManifest(uniqueWorkflowTargets);
const budget = (id) => optimizationContract.budgets.find((item) => item.id === id);
const routeBudget = budget("route-script");
const postPaintBudget = budget("post-paint-script");
const chunkBudget = budget("largest-chunk");
if (!routeBudget || !postPaintBudget || !chunkBudget) throw new Error("构建预算失败：共享合同缺少 route-script、post-paint-script 或 largest-chunk 预算");
const gzipCache = new Map();
const gzipBytes = (file) => {
  if (gzipCache.has(file)) return gzipCache.get(file);
  const path = resolve(distRoot, file);
  const bytes = existsSync(path) ? gzipSync(readFileSync(path), { level: 9 }).byteLength : 0;
  gzipCache.set(file, bytes);
  return bytes;
};
const collectStaticClosure = (key, visited = new Set()) => {
  if (visited.has(key)) return visited;
  visited.add(key);
  for (const dependency of manifest[key]?.imports || []) collectStaticClosure(dependency, visited);
  return visited;
};

const analysisErrors = [];
const manifestEntries = Object.entries(manifest);
const resolveManifestKey = (reference, context) => {
  const normalized = String(reference || "").replaceAll("\\", "/").replace(/^frontend\//u, "").replace(/^\.\//u, "");
  if (manifest[normalized]?.file?.endsWith(".js")) return normalized;
  const bySource = manifestEntries.filter(([, item]) => item?.src === normalized && item?.file?.endsWith(".js"));
  if (bySource.length === 1) return bySource[0][0];
  const stem = basename(normalized).replace(/\.[^.]+$/u, "");
  const byName = manifestEntries.filter(([, item]) => item?.name === stem && item?.file?.endsWith(".js"));
  if (byName.length === 1) return byName[0][0];
  analysisErrors.push({ context, reference: normalized, matches: [...bySource, ...byName].map(([key]) => key) });
  return null;
};
const resolveNamedEntry = (name, context) => {
  const matches = manifestEntries.filter(([, item]) => item?.name === name && item?.file?.endsWith(".js"));
  if (matches.length === 1) return matches[0][0];
  analysisErrors.push({ context, reference: `name:${name}`, matches: matches.map(([key]) => key) });
  return null;
};

const rootEntry = manifest[routeComposition.rootEntry]?.file?.endsWith(".js")
  ? routeComposition.rootEntry
  : resolveManifestKey(routeComposition.rootEntry, "root-entry");
const appEntry = resolveNamedEntry(routeComposition.appEntryName, "app-entry");
const alwaysEntries = (routeComposition.alwaysEntries || []).map((entry) => resolveManifestKey(entry, "always-entry")).filter(Boolean);
const layoutEntries = Object.fromEntries(Object.entries(routeComposition.layoutEntries || {}).map(([scope, entry]) => [
  scope,
  resolveManifestKey(entry, `layout:${scope}`),
]));
const initialLazyEntriesByPageId = routeComposition.initialLazyEntriesByPageId || {};
const deferredLazyEntriesBySourceScope = routeComposition.deferredLazyEntriesBySourceScope || {};
const deferredLazyEntriesByPageId = routeComposition.deferredLazyEntriesByPageId || {};
const registeredPageIds = new Set(registeredPages.map((page) => page.id));
for (const pageId of [...Object.keys(initialLazyEntriesByPageId), ...Object.keys(deferredLazyEntriesByPageId)]) {
  if (!registeredPageIds.has(pageId)) analysisErrors.push({ context: `page-id:${pageId}`, reference: "page-registry", matches: [] });
}
for (const sourceScope of Object.keys(deferredLazyEntriesBySourceScope)) {
  if (!layoutEntries[sourceScope]) analysisErrors.push({ context: `source-scope:${sourceScope}`, reference: "layout-entry", matches: [] });
}
const resolvedDeferredEntriesBySourceScope = Object.fromEntries(Object.entries(deferredLazyEntriesBySourceScope).map(([scope, entries]) => [
  scope,
  entries.map((entry) => resolveManifestKey(entry, `deferred-source:${scope}`)).filter(Boolean),
]));
const developerApplicationEntries = routeComposition.developerApplicationEntries || {};
const developerApplicationDeferredEntries = routeComposition.developerApplicationDeferredEntries || {};
const developerShellEntryReference = routeComposition.developerShellEntry
  || "src/components/product-market/DevelopmentStandardApplyConsole.tsx";
const developerShellManifestKey = resolveManifestKey(developerShellEntryReference, "developer-shell");
const developerShellClosure = developerShellManifestKey
  ? collectStaticClosure(developerShellManifestKey, new Set())
  : new Set();
const developerShellFiles = Array.from(new Set(Array.from(developerShellClosure)
  .map((entry) => manifest[entry]?.file)
  .filter((file) => typeof file === "string" && file.endsWith(".js"))));
const developerShellFileSet = new Set(developerShellFiles);
const developerShell = {
  source: developerShellEntryReference,
  manifestKey: developerShellManifestKey,
  entryFile: developerShellManifestKey ? manifest[developerShellManifestKey]?.file : null,
  closureGzipBytes: developerShellFiles.reduce((total, file) => total + gzipBytes(file), 0),
  files: developerShellFiles,
};
for (const applicationId of Object.keys(developerApplicationDeferredEntries)) {
  if (!developerApplicationEntries[applicationId]) {
    analysisErrors.push({ context: `developer-application:${applicationId}`, reference: "deferred-entry-owner", matches: [] });
  }
}

const routeEntries = registeredPages.map((page) => {
  const context = `${page.sourceScope}:${page.route}`;
  const layoutEntry = layoutEntries[page.sourceScope];
  if (!layoutEntry) analysisErrors.push({ context, reference: `layout:${page.sourceScope}`, matches: [] });
  // The route entry owns its statically imported component closure. A deeper
  // registry `component` may be inlined into that entry and therefore have no
  // manifest key of its own; query-selected lazy panels belong in the explicit
  // initialLazyEntriesByPageId contract instead of being guessed here.
  const routeEntryReference = page.entryComponent || page.component;
  const pageEntries = routeEntryReference ? [resolveManifestKey(routeEntryReference, context)].filter(Boolean) : [];
  const initialLazyEntries = (initialLazyEntriesByPageId[page.id] || [])
    .map((entry) => resolveManifestKey(entry, `${context}:initial-lazy`))
    .filter(Boolean);
  const deferredLazyEntries = [
    ...(resolvedDeferredEntriesBySourceScope[page.sourceScope] || []),
    ...(deferredLazyEntriesByPageId[page.id] || [])
      .map((entry) => resolveManifestKey(entry, `${context}:deferred-lazy`))
      .filter(Boolean),
  ];
  const roots = [rootEntry, appEntry, ...alwaysEntries, layoutEntry, ...pageEntries, ...initialLazyEntries].filter(Boolean);
  const closure = new Set();
  roots.forEach((entry) => collectStaticClosure(entry, closure));
  const files = Array.from(new Set(Array.from(closure)
    .map((entry) => manifest[entry]?.file)
    .filter((file) => typeof file === "string" && file.endsWith(".js"))));
  const initialFileSet = new Set(files);
  const deferredRoots = Array.from(new Set(deferredLazyEntries));
  const deferredClosure = new Set();
  deferredRoots.forEach((entry) => collectStaticClosure(entry, deferredClosure));
  const deferredFiles = Array.from(new Set(Array.from(deferredClosure)
    .map((entry) => manifest[entry]?.file)
    .filter((file) => typeof file === "string" && file.endsWith(".js") && !initialFileSet.has(file))));
  const deferredRootsLoadedInitially = deferredRoots.filter((entry) => initialFileSet.has(manifest[entry]?.file));
  const deferredGzipBytes = deferredFiles.reduce((total, file) => total + gzipBytes(file), 0);
  return {
    key: context,
    pageId: page.id,
    sourceScope: page.sourceScope,
    route: page.route,
    gzipBytes: files.reduce((total, file) => total + gzipBytes(file), 0),
    roots,
    initialLazyRoots: initialLazyEntries,
    deferredLazyRoots: deferredRoots,
    deferredRootsLoadedInitially,
    deferredGzipBytes,
    startupWindowGzipBytes: files.reduce((total, file) => total + gzipBytes(file), 0) + deferredGzipBytes,
    files,
    deferredFiles,
  };
}).sort((left, right) => right.gzipBytes - left.gzipBytes);
const eligiblePageIds = new Set(eligibleRegisteredPages.map((page) => page.id));
const eligibleRouteEntries = routeEntries.filter((entry) => eligiblePageIds.has(entry.pageId));

// Developer applications are intentionally interaction-only. Keep them out of
// every route startup window, but resolve and measure their own dynamic entry
// so a missing split point cannot silently disappear from the evidence.
const interactionApplications = Object.entries(developerApplicationEntries)
  .map(([applicationId, reference]) => {
    const key = resolveManifestKey(reference, `developer-application:${applicationId}`);
    if (!key) return null;
    const closure = collectStaticClosure(key, new Set());
    const files = Array.from(new Set(Array.from(closure)
      .map((entry) => manifest[entry]?.file)
      .filter((file) => typeof file === "string" && file.endsWith(".js"))));
    const incrementalFiles = files.filter((file) => !developerShellFileSet.has(file));
    const loadedBeforeDeferredFileSet = new Set([...developerShellFiles, ...files]);
    const deferredRoots = (developerApplicationDeferredEntries[applicationId] || [])
      .map((entry) => resolveManifestKey(entry, `developer-application:${applicationId}:deferred`))
      .filter(Boolean);
    const deferredClosure = new Set();
    deferredRoots.forEach((entry) => collectStaticClosure(entry, deferredClosure));
    const deferredFiles = Array.from(new Set(Array.from(deferredClosure)
      .map((entry) => manifest[entry]?.file)
      .filter((file) => typeof file === "string" && file.endsWith(".js") && !loadedBeforeDeferredFileSet.has(file))));
    const deferredRootsLoadedInitially = deferredRoots.filter((entry) => loadedBeforeDeferredFileSet.has(manifest[entry]?.file));
    const entryFile = manifest[key]?.file;
    return {
      applicationId,
      source: reference,
      manifestKey: key,
      entryFile,
      isDynamicEntry: manifest[key]?.isDynamicEntry === true,
      directGzipBytes: typeof entryFile === "string" ? gzipBytes(entryFile) : 0,
      closureGzipBytes: files.reduce((total, file) => total + gzipBytes(file), 0),
      incrementalGzipBytes: incrementalFiles.reduce((total, file) => total + gzipBytes(file), 0),
      files,
      incrementalFiles,
      deferredRoots,
      deferredRootsLoadedInitially,
      deferredGzipBytes: deferredFiles.reduce((total, file) => total + gzipBytes(file), 0),
      deferredFiles,
    };
  })
  .filter(Boolean)
  .sort((left, right) => right.closureGzipBytes - left.closureGzipBytes);

const chunks = Array.from(new Set(Object.values(manifest).map((item) => item?.file).filter((file) => typeof file === "string" && file.endsWith(".js"))))
  .map((file) => ({ file, gzipBytes: gzipBytes(file) }))
  .sort((left, right) => right.gzipBytes - left.gzipBytes);

const walkFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  return entry.isDirectory() ? walkFiles(path) : [path];
});
const toDistRelative = (path) => path.slice(distRoot.length + 1).replaceAll("\\", "/");
const evidenceFileNames = new Set(["stats.html", "stats.json", "bundle-budget-report.json", "manifest.json"]);
const distFiles = walkFiles(distRoot).filter((path) => !evidenceFileNames.has(basename(path)));
const referenceCorpus = distFiles
  .filter((path) => [".js", ".css", ".html"].includes(extname(path).toLowerCase()))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");
const mediaRuleByExtension = new Map(Object.values(mediaContract.kinds).flatMap((rule) =>
  rule.acceptedExtensions.map((extension) => [extension, rule])));
const mediaAssets = distFiles
  .map((path) => ({ path, file: toDistRelative(path), extension: extname(path).toLowerCase() }))
  .filter((item) => mediaRuleByExtension.has(item.extension))
  .map((item) => {
    const rule = mediaRuleByExtension.get(item.extension);
    const fileUrl = `/${item.file}`;
    return {
      file: item.file,
      sizeBytes: statSync(item.path).size,
      limitBytes: rule.deliveryBudgetBytes,
      kind: Object.entries(mediaContract.kinds).find(([, candidate]) => candidate === rule)?.[0] || "media",
      referenced: referenceCorpus.includes(fileUrl) || referenceCorpus.includes(item.file),
    };
  })
  .sort((left, right) => right.sizeBytes - left.sizeBytes);

const violations = [];
for (const error of analysisErrors) {
  violations.push({ type: "analysis-incomplete", target: error.context, detail: error });
}
for (const entry of routeEntries) {
  if (entry.gzipBytes > routeBudget.limit * 1024) violations.push({ type: "route-script", target: entry.key, actualBytes: entry.gzipBytes, limitBytes: routeBudget.limit * 1024 });
  if (entry.deferredGzipBytes > postPaintBudget.limit * 1024) violations.push({ type: "post-paint-script", target: entry.key, actualBytes: entry.deferredGzipBytes, limitBytes: postPaintBudget.limit * 1024 });
  if (entry.deferredRootsLoadedInitially.length) violations.push({ type: "deferred-loaded-initially", target: entry.key, roots: entry.deferredRootsLoadedInitially });
}
for (const chunk of chunks) {
  if (chunk.gzipBytes > chunkBudget.limit * 1024) violations.push({ type: "largest-chunk", target: chunk.file, actualBytes: chunk.gzipBytes, limitBytes: chunkBudget.limit * 1024 });
}
for (const application of interactionApplications) {
  if (!application.isDynamicEntry) violations.push({ type: "developer-application-not-dynamic", target: application.applicationId, source: application.source });
  if (application.directGzipBytes > chunkBudget.limit * 1024) violations.push({ type: "developer-application-chunk", target: application.applicationId, actualBytes: application.directGzipBytes, limitBytes: chunkBudget.limit * 1024 });
  if (application.deferredGzipBytes > postPaintBudget.limit * 1024) violations.push({ type: "developer-application-post-paint-script", target: application.applicationId, actualBytes: application.deferredGzipBytes, limitBytes: postPaintBudget.limit * 1024 });
  if (application.deferredRootsLoadedInitially.length) violations.push({ type: "developer-application-deferred-loaded-initially", target: application.applicationId, roots: application.deferredRootsLoadedInitially });
}
for (const asset of mediaAssets) {
  if (asset.sizeBytes > asset.limitBytes) violations.push({ type: "media-delivery", target: asset.file, actualBytes: asset.sizeBytes, limitBytes: asset.limitBytes, referenced: asset.referenced });
}

const fingerprint = createHash("sha256")
  .update(manifestSource)
  .update(registrySource)
  .update(JSON.stringify(routeComposition))
  .update(optimizationContract.version)
  .update(mediaContract.version)
  .digest("hex");
const report = {
  generatedAt: new Date().toISOString(),
  fingerprint,
  contractVersion: optimizationContract.version,
  mediaContractVersion: mediaContract.version,
  status: violations.length ? "failed" : "passed",
  budgets: { routeScript: routeBudget, postPaintScript: postPaintBudget, largestChunk: chunkBudget },
  routeAnalysis: {
    registeredPages: eligibleRegisteredPages.length,
    analyzedRoutes: eligibleRouteEntries.length,
    totalRegisteredPages: registeredPages.length,
    totalAnalyzedRoutes: routeEntries.length,
    errors: analysisErrors,
    targetManifestFingerprint,
    targetIdentities: uniqueWorkflowTargets.map((target) => target.id),
    targets: uniqueWorkflowTargets,
  },
  topRoutes: routeEntries.slice(0, 40),
  topStartupWindowRoutes: [...routeEntries].sort((left, right) => right.startupWindowGzipBytes - left.startupWindowGzipBytes).slice(0, 40),
  developerShell,
  interactionApplications,
  topChunks: chunks.slice(0, 12),
  topMediaAssets: mediaAssets.slice(0, 40),
  unreferencedPublicMedia: mediaAssets.filter((asset) => !asset.referenced),
  violations,
};
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
if (violations.length) {
  console.error(`构建预算发现 ${violations.length} 项超限或分析不完整，证据已写入 dist/bundle-budget-report.json。`);
  process.exit(1);
}
console.log(`构建预算通过：${routeEntries.length} 条登记路由、${chunks.length} 个脚本块与 ${mediaAssets.length} 个公开媒体均在共享上限内。`);
