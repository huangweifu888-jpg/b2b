import fs from "node:fs";

import { build } from "esbuild";

const read = (path) => fs.readFileSync(path, "utf8");
const registrySource = read("src/lib/developer-global-frame-adapter-registry.ts");
const builderSource = read("src/lib/developer-global-frame-draft.ts");
const resolutionSource = read("src/lib/developer-global-frame-adapter-resolution.ts");
const runtimeSource = read("src/lib/developer-global-frame-runtime.ts");
const hostSource = read("src/components/developer-platform/DeveloperGlobalFrameRuntimeHost.tsx");
const publishedEventSource = read("src/lib/developer-global-frame-published-event.ts");
const releaseSource = read("src/pages/hq/ClientSourceReleases.tsx");
const layoutSource = read("src/components/ClientSourceLayout.tsx");
const consoleSource = read("src/components/product-market/DevelopmentStandardApplyConsole.tsx");
const templateTypesSource = read("src/lib/template-snapshot/types.ts");
const runtimeCss = read("src/developer-global-frame-runtime.css");
const sharedFrameCss = read("src/shared-existing-workspace-frame.css");
const blueprintSource = read("src/components/product-market/FactoryPlatformBlueprint.tsx");
const coordinatorSource = read("src/lib/developer-global-frame-release-coordinator.ts");
const atomicEvidenceApiSource = read("src/lib/template-snapshot/api.ts");
const workflowBridgeSource = read("src/components/developer-platform/DeveloperGlobalFrameWorkflowCoordinatorBridge.tsx");
const standaloneHostSource = read("src/components/StandaloneGlobalFramePageHost.tsx");
const responsivePageHostCoreSource = read("src/components/ResponsivePageHost.tsx");
const responsivePageHostRuntimeSource = read("src/components/ResponsivePageHostRuntime.tsx");
const responsivePageHostSource = `${responsivePageHostCoreSource}\n${responsivePageHostRuntimeSource}`;
const deferredShellRuntimeHostsSource = read("src/components/DeferredShellRuntimeHosts.tsx");
const shellRuntimeHostsSource = read("src/components/ShellRuntimeHosts.tsx");
const visualResponsiveBootstrapSource = read("src/components/VisualResponsiveBootstrap.tsx");
const factoryPageSource = read("src/page-factory/FactoryPage.tsx");
const factoryPageCss = read("src/page-factory/page-factory.css");
const sharedRegionContractSource = read("src/lib/shared-card-region-contract.ts");
const allPagesAcceptanceSource = read("e2e/developer-global-frame-all-pages.spec.ts");

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

const executable = await build({
  stdin: {
    contents: [
      'export * from "./src/lib/developer-global-frame-adapter-registry.ts";',
      'export * from "./src/lib/developer-global-frame-adapter-resolution.ts";',
      'export * from "./src/lib/developer-global-frame-draft.ts";',
      'export * from "./src/lib/developer-global-frame-runtime.ts";',
      'export * from "./src/lib/developer-global-style-contract.ts";',
      'export * from "./src/lib/page-route-identity.ts";',
      'export * from "./src/page-factory/page-factory.ts";',
      'export * from "./src/lib/shared-card-region-contract.ts";',
    ].join("\n"),
    loader: "ts",
    resolveDir: process.cwd(),
    sourcefile: "developer-global-frame-runtime-verifier-entry.ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  logLevel: "silent",
});
const bundled = executable.outputFiles[0]?.text;
requireCondition(bundled, "无法构建 developer global frame runtime 行为夹具。");
const contract = await import(`data:text/javascript;base64,${Buffer.from(bundled).toString("base64")}`);

const semanticCard = (attributes) => ({
  getAttribute: (name) => attributes[name] ?? null,
});
for (const [label, attributes, groupedCardCount, expected] of [
  ["developer semantic wins", {
    "data-development-standard-frame-region": "small-card",
    "data-page-factory-region": "large-card",
    "data-page-card-size": "large",
    "data-shared-large-card-surface": "true",
  }, 1, "small-card"],
  ["page-factory semantic wins", {
    "data-page-factory-region": "small-card",
    "data-page-card-size": "large",
    "data-shared-large-card-surface": "true",
  }, 1, "small-card"],
  ["page-card-size semantic wins", {
    "data-page-card-size": "small",
    "data-shared-large-card-surface": "true",
  }, 1, "small-card"],
  ["shared small surface wins", { "data-shared-small-card-surface": "true" }, 1, "small-card"],
  ["shared large surface wins", { "data-shared-large-card-surface": "true" }, 4, "large-card"],
  ["grouped fallback is small", {}, 2, "small-card"],
  ["ungrouped fallback is large", {}, 1, "large-card"],
]) {
  requireCondition(
    contract.resolveSharedLayoutStyleCardRegion(semanticCard(attributes), groupedCardCount) === expected,
    `shared card region resolver failed: ${label}`,
  );
}

const registryValidation = contract.validateDeveloperGlobalFrameAdapterRegistry();
requireCondition(registryValidation.valid, `adapter registry 无效：${registryValidation.issues.join("；")}`);
const coverage = contract.inspectDeveloperGlobalFrameAdapterCoverage();
requireCondition(coverage.resolved === 201 && coverage.eligible === 201 && coverage.coveragePercent === 100, `runtime adapter coverage must be 201/201, received ${coverage.resolved}/${coverage.eligible}`);
requireCondition(coverage.explicit === 3 && coverage.templateProjected === 198, "runtime adapter strategy split must remain 3 explicit + 198 template projections");
requireCondition(contract.DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS.length === 201, "runtime target registry must retain every Page Factory identity");
requireCondition(new Set(contract.DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS.map((entry) => entry.sourceScope)).size === 3, "runtime target registry must preserve HQ/Agency/Client scopes");
requireCondition(resolutionSource.includes("DEVELOPER_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_IDS"), "runtime adapter resolution lacks durable technical-route isolation identities");
requireCondition(
  contract.DEVELOPER_GLOBAL_FRAME_TRANSIENT_QUERY_KEYS === contract.PAGE_FRAME_NON_IDENTITY_QUERY_KEYS,
  "Developer Global Frame and Page Factory must share one route identity key object",
);
const requiredRuntimeContextKeys = [
  "agentPath", "agent_path",
  "tenantId", "tenant_id", "tenant",
  "clientId", "client_id", "client",
  "planId", "plan_id", "plan",
  "siteId", "site_id",
];
requireCondition(
  requiredRuntimeContextKeys.every((key) => contract.PAGE_FRAME_NON_IDENTITY_QUERY_KEYS.includes(key)),
  "The central route identity contract is missing a tenant/agent/client/plan/site context alias",
);
for (const routeCase of [
  { pathname: "/zb/product-market", sourceScope: "hq", pageFactoryId: "hq-product-market-operations" },
  { pathname: "/zb/agency-source/product-market", sourceScope: "agency_source", pageFactoryId: "agency-source-product-market-operations" },
  { pathname: "/zb/client-source/product-market", sourceScope: "client_source", pageFactoryId: "client-source-product-market-operations" },
]) {
  for (const key of contract.PAGE_FRAME_NON_IDENTITY_QUERY_KEYS) {
    const params = new URLSearchParams({ tab: "operations", [key]: "route-context-fixture" });
    const search = `?${params.toString()}`;
    const factoryPage = contract.findPageFactoryPage(routeCase.pathname, search);
    const developerResolution = contract.resolveDeveloperGlobalFrameAdapterForRoute(
      routeCase.pathname,
      search,
      routeCase.sourceScope,
    );
    requireCondition(
      factoryPage?.id === routeCase.pageFactoryId && developerResolution?.pageFactoryId === routeCase.pageFactoryId,
      `route identity split for ${routeCase.sourceScope}.${key}: factory=${factoryPage?.id || "null"}; developer=${developerResolution?.pageFactoryId || "null"}`,
    );
  }
}
const unknownIdentitySearch = "?tab=operations&unknownPageIdentity=route-context-fixture";
requireCondition(
  contract.findPageFactoryPage("/zb/client-source/product-market", unknownIdentitySearch) === null
    && contract.resolveDeveloperGlobalFrameAdapterForRoute(
      "/zb/client-source/product-market",
      unknownIdentitySearch,
      "client_source",
    ) === null,
  "Unknown query identity must fail closed in both Page Factory and Developer Global Frame",
);

const now = new Date().toISOString();
const canaryDraft = {
  contractVersion: contract.DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION,
  id: "runtime-canary-fixture",
  mode: "canary-profile",
  workspaceScope: "client_source",
  pathname: "/zb/client-source/product-market",
  search: "?tab=operations",
  appearance: {
    frameInsets: { top: 12, right: 0, bottom: 60, left: 12 },
    componentStyles: {},
    sharedStylePatch: { layoutStyle: {}, globalTypography: {} },
  },
  visualAuditId: "runtime-audit-fixture",
  recoveryPointId: "runtime-recovery-fixture",
  baselineOnly: false,
  savedAt: now,
};
const section = contract.buildDeveloperGlobalFrameSection({
  profileVersion: "1.0.0",
  sourceScope: "client_source",
  canaryDraft,
  recoveryDraftId: "runtime-draft-fixture",
  pilotVerificationId: "runtime-pilot-fixture",
  pilotVerifiedAt: now,
  pilotChecks: contract.DEVELOPER_GLOBAL_STYLE_PILOT_CHECK_IDS,
});
requireCondition(contract.validateDeveloperGlobalFrameSection(section).valid, "registry-built published section 未通过严格校验。");
requireCondition(section.adapters.length === 201 && section.target_matrix.length === 201, "published section must persist the complete 201-page target graph");
requireCondition(section.target_matrix.filter((target) => target.compatibility === "compatible").length === 196, "published section must admit all 196 business pages");
requireCondition(section.target_matrix.filter((target) => target.compatibility === "isolated").length === 5, "published section must isolate the five technical/control-flow routes");
requireCondition(contract.bumpDeveloperGlobalFrameProfileVersionIfCurrent("1.0.0", "1.0.0") === "1.0.1", "current immutable profile did not auto-bump patch");
requireCondition(contract.bumpDeveloperGlobalFrameProfileVersionIfCurrent("v1.2.3", "v1.2.3") === "v1.2.4", "v-prefixed immutable profile did not preserve prefix while bumping");
requireCondition(contract.bumpDeveloperGlobalFrameProfileVersionIfCurrent("release-7", "release-7") === "release-7", "non-semver latest version must not be rewritten");
requireCondition(contract.bumpDeveloperGlobalFrameProfileVersionIfCurrent("1.0.2", "1.0.1") === "1.0.2", "non-current candidate version must not be rewritten");

const consumer = contract.findDeveloperGlobalFrameAdapterForRoute(
  "/zb/client-source/product-market",
  "?tab=blueprint&category=content&phase=build",
);
requireCondition(consumer?.pageFactoryId === "client-source-product-market-blueprint", "Blueprint route 未解析到显式 consumer adapter。");
requireCondition(contract.resolveDeveloperGlobalFrameRuntimeApplication(section, consumer)?.registration === consumer, "已登记 consumer 未能消费匹配版本的 published profile。");
requireCondition(contract.findDeveloperGlobalFrameAdapterForRoute("/zb/client-source/reports", "") === null, "未登记页面被错误解析为 runtime target。");
requireCondition(contract.resolveDeveloperGlobalFrameAdapterForRoute("/zb/client-source/reports", "", "client_source")?.strategy === "template-projection", "registered business routes must resolve through the Page Factory template projection");

const nextImmutableVersion = structuredClone(section);
nextImmutableVersion.profile_version = "1.0.1";
for (const adapter of nextImmutableVersion.adapters) adapter.reads_profile_version = "1.0.1";
for (const target of nextImmutableVersion.target_matrix) target.reads_profile_version = "1.0.1";
requireCondition(contract.validateDeveloperGlobalFrameSection(nextImmutableVersion).valid, "same-contract profile 1.0.1 should remain valid without a code change");
requireCondition(contract.resolveDeveloperGlobalFrameRuntimeApplication(nextImmutableVersion, consumer) !== null, "same-contract profile 1.0.1 was incorrectly rejected");

const laterSection = contract.buildDeveloperGlobalFrameSection({
  profileVersion: "2.3.4",
  sourceScope: "client_source",
  canaryDraft,
  recoveryDraftId: "runtime-draft-later-fixture",
  pilotVerificationId: "runtime-pilot-later-fixture",
  pilotVerifiedAt: now,
  pilotChecks: contract.DEVELOPER_GLOBAL_STYLE_PILOT_CHECK_IDS,
});
requireCondition(laterSection.adapters.every((adapter) => adapter.reads_profile_version === "2.3.4"), "builder did not bind adapters to immutable profile 2.3.4");
requireCondition(laterSection.target_matrix.every((target) => target.reads_profile_version === "2.3.4"), "builder did not bind targets to immutable profile 2.3.4");
requireCondition(contract.validateDeveloperGlobalFrameSection(laterSection).valid, "same-contract profile 2.3.4 should pass strict validation");
requireCondition(contract.resolveDeveloperGlobalFrameRuntimeApplication(laterSection, consumer) !== null, "same-contract profile 2.3.4 was incorrectly rejected");

const incompatibleContract = structuredClone(laterSection);
incompatibleContract.contract_version = "2.0.0";
requireCondition(contract.resolveDeveloperGlobalFrameRuntimeApplication(incompatibleContract, consumer) === null, "incompatible contract version did not fail closed");
const mismatchedTargetVersion = structuredClone(laterSection);
mismatchedTargetVersion.target_matrix[2].reads_profile_version = "2.3.3";
requireCondition(contract.resolveDeveloperGlobalFrameRuntimeApplication(mismatchedTargetVersion, consumer) === null, "target/profile version mismatch did not fail closed");
const forgedTarget = structuredClone(section);
forgedTarget.target_matrix[2].page_id = "client-dashboard";
requireCondition(contract.resolveDeveloperGlobalFrameRuntimeApplication(forgedTarget, consumer) === null, "伪造 target matrix 没有 fail closed。");

requireCondition(registrySource.includes('domAdapterId: "product-market-blueprint-bridge-v1"'), "Blueprint 未绑定显式 bridge adapter。");
requireCondition(blueprintSource.includes("data-factory-platform-blueprint-header") && blueprintSource.includes("data-factory-platform-blueprint") && blueprintSource.includes("data-page-list-scroll-owner"), "Blueprint 源码缺少 adapter 所需的真实 canonical nodes。");
requireCondition(runtimeSource.includes("scrollOwners.length !== 1") && runtimeSource.includes("content.hasAttribute(\"data-page-list-scroll-owner\")"), "runtime 未阻断多滚动源或伪 content。");
requireCondition(runtimeSource.includes("findExistingWorkspaceBodyMarkerHost") && runtimeSource.includes("bodyMarkerHost"), "runtime 未把 workspace 标注专属变量桥接到主体外框宿主。");
requireCondition(runtimeSource.includes("variablesForWorkspaceMarkerHost") && runtimeSource.includes("elements.bodyMarkerHost"), "runtime 主体外框标注桥缺少窄范围变量。");
requireCondition(!runtimeSource.includes("EXISTING_WORKSPACE_BODY_MARKER_HOST_ATTRIBUTE"), "published runtime 不得写入会被 Visual Dock 清理的临时标记。");
requireCondition(runtimeCss.includes('data-developer-global-frame-adapter="product-market-blueprint-bridge-v1"') && runtimeCss.includes("min-height: 0 !important") && runtimeCss.includes("3.75rem") && runtimeCss.includes("overflow-y: auto !important"), "Blueprint adapter 未闭合高度链与 table-inner-60 语义。");
const annotationEnabledRule = runtimeCss.match(/\[data-developer-global-frame-annotation-visible="true"\]::after\s*\{([^}]*)\}/u)?.[1] ?? "";
requireCondition(annotationEnabledRule.includes("--developer-global-frame-runtime-annotation-font-size"), "runtime annotation font variable is not wired to the element-scoped token");
requireCondition(annotationEnabledRule.includes("--developer-global-frame-runtime-annotation-offset"), "runtime annotation offset variable is not wired to the element-scoped token");
for (const forbidden of ["content:", "display:", "visibility:", "opacity:"]) {
  requireCondition(!annotationEnabledRule.includes(forbidden), `published runtime must not force normal-state annotations visible: ${forbidden}`);
}
requireCondition(/annotation-visible="false"\]::after\s*\{[^}]*display:\s*none\s*!important/u.test(runtimeCss), "annotation_visible=false must remain hidden");
requireCondition(sharedFrameCss.includes("data-visual-card-editor-open") && sharedFrameCss.includes('data-developer-global-frame-runtime-region="workspace"') && sharedFrameCss.includes('data-developer-global-frame-runtime-region="content"'), "shared editor-open state must reveal exactly the five runtime canonical annotations, including bridged consumers");
requireCondition(runtimeSource.includes("DEVELOPER_GLOBAL_FRAME_ANNOTATION_REGIONS.has(region)"), "topbar/footer must not receive runtime annotation visibility state");

requireCondition(hostSource.includes("value.config_json") && hostSource.includes("publishedSectionCache"), "runtime host 未读取 published config_json 或未缓存同模板请求。");
for (const token of [
  "developerGlobalFramePublishedVersion",
  "developerGlobalFramePublishedHash",
  "developerGlobalFramePublishedHashKind",
  "published_config_hash",
  "published-config-hash",
  "resolveDeveloperGlobalFrameAdapterForRoute(pathname, search, sourceScope)",
]) requireCondition(hostSource.includes(token), `published runtime is missing immutable server version/hash or fail-closed route evidence: ${token}`);
requireCondition(templateTypesSource.includes("is_published?: boolean"), "template response type must expose the published flag");
requireCondition(
  hostSource.includes("value.template_id !== DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID")
    && hostSource.includes('value.owner_scope !== "client_source"')
    && hostSource.includes("value.is_published !== true")
    && hostSource.includes('typeof value.latest_version !== "string"')
    && hostSource.includes("const latestVersion = value.latest_version.trim()")
    && hostSource.includes("section.profile_version !== latestVersion"),
  "runtime host must reject wrongly bound, unpublished, unversioned or version-mismatched config_json",
);
for (const forbidden of ["draft_config_json", "localStorage", "sessionStorage", "mergeDeveloperGlobalFrameDraft", "publishTemplate(", "upsertTemplate("]) {
  requireCondition(!hostSource.includes(forbidden), `runtime host 越界读取或写入：${forbidden}`);
}
requireCondition(hostSource.includes("DEVELOPER_GLOBAL_FRAME_PUBLISHED_CACHE_TTL_MS = 30_000") && hostSource.includes("DEVELOPER_GLOBAL_FRAME_EMPTY_CACHE_TTL_MS = 5_000"), "published profile 缓存未限制成功/空结果 TTL。");
requireCondition(hostSource.includes("inFlight") && hostSource.includes("queuedRefresh") && hostSource.includes('status: "failed"'), "published profile 缓存未合并并发请求或未区分瞬时失败。");
requireCondition(hostSource.includes("lastConsumedNonce") && hostSource.includes("readLatestDeveloperGlobalFramePublishedEvent") && hostSource.includes("consumeDeveloperGlobalFramePublishedInvalidation"), "RuntimeHost 挂载时未消费离线期间的精确发布 nonce。");
requireCondition(hostSource.includes("appliedProfileVersion === application.section.profile_version"), "同一 canonical DOM 上 profile_version 更新不会触发重新应用。");
for (const token of [
  "requireMarkerGeometry: false",
  "const geometryReadyNodes = inspectDeveloperGlobalFrameCanonicalRoot(roots[0], registration)",
  "appliedTopbar === topbars[0]",
  "appliedFooter === footers[0]",
  "const handleWorkspaceMarkerLayout = () =>",
  'window.addEventListener("tradepro:workspace-marker-layout", handleWorkspaceMarkerLayout)',
  'window.removeEventListener("tradepro:workspace-marker-layout", handleWorkspaceMarkerLayout)',
]) requireCondition(hostSource.includes(token), `runtime host marker stabilization is incomplete: ${token}`);
requireCondition(hostSource.includes("cleanupApplication?.()") && hostSource.includes("observer.disconnect()") && hostSource.includes("removePublishedListeners()"), "runtime host 路由切换/卸载未清理变量、observer 或发布监听器。");
requireCondition(publishedEventSource.includes("DEVELOPER_GLOBAL_FRAME_PUBLISHED_STORAGE_KEY") && publishedEventSource.includes("window.dispatchEvent") && publishedEventSource.includes("window.localStorage.setItem"), "published event 未同时支持同页和跨标签页精确失效。");
requireCondition(publishedEventSource.includes("templateId !== DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID") && publishedEventSource.includes("section !== DEVELOPER_GLOBAL_FRAME_SECTION_NAME") && publishedEventSource.includes("nonce"), "published event 未严格校验 template/section/version nonce。");
requireCondition(
  hostSource.includes("DEVELOPER_GLOBAL_FRAME_RETRY_DELAYS_MS = [1_000, 4_000]")
    && hostSource.includes("retryAttempt >= DEVELOPER_GLOBAL_FRAME_RETRY_DELAYS_MS.length")
    && hostSource.includes("scheduleRetry();")
    && hostSource.includes("window.clearTimeout(retryTimer)"),
  "transient published GET failures must use a bounded, cancellable retry schedule",
);
requireCondition(
  hostSource.includes("DEVELOPER_GLOBAL_FRAME_DOM_RETRY_DELAYS_MS = [0, 50, 250, 1_000, 4_000]")
    && hostSource.includes("domRetryAttempt >= DEVELOPER_GLOBAL_FRAME_DOM_RETRY_DELAYS_MS.length")
    && hostSource.includes("scheduleDomRetry();")
    && hostSource.includes("resetDomRetry();"),
  "explicit canonical DOM discovery must retry after layout stabilizes and cancel on success/unmount",
);
const reviewPublishEventIndex = releaseSource.indexOf("dispatchDeveloperGlobalFramePublishedEvent");
const reviewPublishedGateIndex = releaseSource.indexOf('reviewStatus === "published"', reviewPublishEventIndex);
const reviewSectionGateIndex = releaseSource.indexOf("releaseSections[0] === DEVELOPER_GLOBAL_FRAME_SECTION_NAME", reviewPublishEventIndex);
requireCondition(reviewPublishEventIndex >= 0 && reviewPublishedGateIndex >= 0 && reviewSectionGateIndex >= 0, "二审成功未按 published + developer_global_frame 精确发出缓存失效事件。");
requireCondition(!consoleSource.includes("dispatchDeveloperGlobalFramePublishedEvent"), "来源草稿保存误发了 published 失效事件。");
requireCondition(layoutSource.includes("<DeferredShellRuntimeHosts") && layoutSource.includes("const VisualProjectContractHost = lazy"), "ClientSourceLayout 未挂 deferred runtime host 或覆盖了 VisualProjectContractHost lazy 边界。");
for (const [path, scope] of [
  ["src/components/HQLayout.tsx", "hq"],
  ["src/components/AgencySourceLayout.tsx", "agency_source"],
  ["src/components/ClientSourceLayout.tsx", "client_source"],
]) {
  const source = read(path);
  requireCondition(source.includes("DeferredShellRuntimeHosts") && source.includes(`sourceScope="${scope}"`), `${scope} layout is missing its deferred fail-closed published runtime boundary`);
}
for (const token of [
  'const ShellRuntimeHosts = lazy(() => import("./ShellRuntimeHosts"))',
  "schedulePostPaintIdle(() => setReady(true))",
  "<VisualResponsiveBootstrap scope={visualScope} />",
  "<ShellRuntimeHosts pathname={pathname} search={search} sourceScope={sourceScope} />",
]) requireCondition(deferredShellRuntimeHostsSource.includes(token), `deferred shell runtime boundary is incomplete: ${token}`);
for (const token of [
  "DeveloperGlobalFrameRuntimeHost",
  "VisualResponsiveContract",
  "<DeveloperGlobalFrameRuntimeHost pathname={pathname} search={search} sourceScope={sourceScope} />",
  "<VisualResponsiveContract scope={visualScope} />",
]) requireCondition(shellRuntimeHostsSource.includes(token), `shared shell runtime composition is incomplete: ${token}`);
for (const token of [
  "useLayoutEffect(() => {",
  'root.setAttribute("data-visual-responsive-contract", "true")',
  'root.setAttribute("data-responsive-shell-contract", RESPONSIVE_SHELL_FACTORY_DEFAULT.version)',
  'window.addEventListener("resize", schedule, { passive: true })',
]) requireCondition(visualResponsiveBootstrapSource.includes(token), `synchronous visual responsive bootstrap is incomplete: ${token}`);
for (const token of [
  'const ResponsivePageHostRuntime = lazy(() => import("./ResponsivePageHostRuntime"))',
  "schedulePostPaintIdle(() => setRuntimeReady(true))",
  '<Fragment key="page-content">{children}</Fragment>',
  "hostElement={hostElement}",
]) requireCondition(responsivePageHostCoreSource.includes(token), `ResponsivePageHost first-paint boundary is incomplete: ${token}`);
requireCondition(standaloneHostSource.includes("DeveloperGlobalFrameRuntimeHost") && standaloneHostSource.includes("ResponsivePageHost"), "standalone technical routes are not resolved/evidenced by the shared read-only host");

for (const token of [
  '"title-2"',
  '"table-shell"',
  '"table-header"',
  "content",
  '"large-card"',
  '"small-card"',
  '"data-shared-region-token-source"',
  '"data-responsive-shared-surface"',
  '"data-shared-card-token-source"',
]) requireCondition(sharedRegionContractSource.includes(token), `shared Layout Style region resolver is missing: ${token}`);
requireCondition(
  factoryPageSource.includes("resolveSharedLayoutStyleRegionProps")
    && factoryPageSource.includes("resolveAutoTitleRegion")
    && factoryPageSource.includes("cards.forEach((card)")
    && factoryPageSource.includes('resolvedFrameOwner === "factory-shell"'),
  "FactoryPage does not project the shared title/content/card contract to ordinary three-scope pages",
);
requireCondition(
  responsivePageHostSource.includes("resolveSharedLayoutStyleRegionProps")
    && responsivePageHostSource.includes("bindSharedRegionStyle")
    && responsivePageHostSource.includes('candidate.dataset.pageFactoryRuntimeProjection === "true"')
    && responsivePageHostSource.includes("Factory-shell pages own Title 2")
    && responsivePageHostSource.includes("data-responsive-factory-title-one-fallback")
    && responsivePageHostSource.includes('data-development-standard-frame-region="title-1"'),
  "ResponsivePageHost does not project the same shared contract to legacy/template pages",
);
requireCondition(
  responsivePageHostRuntimeSource.includes('frameAdapterResolution?.strategy === "explicit-exception"')
    && responsivePageHostRuntimeSource.includes("explicitAdapterOwnsDeveloperRegion")
    && responsivePageHostRuntimeSource.includes("if (!explicitAdapterOwnsDeveloperRegion)"),
  "ResponsivePageHost must preserve an explicit adapter's authored Developer region identity",
);
for (const [label, source, cleanupToken] of [
  ["FactoryPage", factoryPageSource, "restoreRuntimeProjectedRegionAttribute"],
  ["ResponsivePageHost", responsivePageHostSource, "restoreRuntimeProjectedFactoryAttribute"],
]) {
  requireCondition(
    source.includes("resolveSharedLayoutStyleCardRegion")
      && source.includes(cleanupToken)
      && source.includes('"data-shared-large-card-surface"')
      && source.includes('"data-shared-small-card-surface"')
      && !source.includes(': groupedCardCount(card) > 1 ? "small-card" : "large-card"'),
    `${label} bypasses the shared semantic-first card resolver or retains opposing runtime surfaces`,
  );
}
for (const token of [
  '[data-page-factory-region="title-2"][data-responsive-shared-surface="title-2"]',
  '[data-page-factory-region="content"][data-shared-region-token-source="layout-style"]',
  '[data-page-factory-region="table-shell"][data-page-table-shell="true"]',
  'thead[data-page-factory-region="table-header"][data-page-table-header="true"]',
  ':is(a, button, [role="tab"])',
  'font-size: var(--tradepro-shared-table-header-font-size, 0.875rem) !important',
  '[data-shared-large-card-surface="true"][data-shared-card-token-source="layout-style"]:not([data-shared-status-card-source])',
  'background-color: var(--tradepro-product-market-large-card-bg, var(--tradepro-panel-card-bg, #ffffff)) !important',
  'font-size: var(--tradepro-shared-large-card-font-size, 0.875rem) !important',
  '[data-shared-small-card-surface="true"][data-shared-card-token-source="layout-style"]:not([data-shared-status-card-source])',
  'background-color: var(--tradepro-panel-card-bg, #ffffff) !important',
  'font-size: var(--tradepro-shared-small-card-font-size, 0.75rem) !important',
  'thead[data-page-factory-region="table-header"][data-page-table-header="true"][data-development-standard-frame-region="table-header"]:is(:hover, :focus-within)::after',
  '--responsive-page-padding: clamp(10px, 1.4cqi, 1.5rem) !important',
  '[data-page-factory-runtime-projection="true"][data-page-layout-surface]',
  'padding-inline: max(10px, var(--responsive-page-padding, 10px)) !important',
  '[data-responsive-capacity-row="host-actions"]',
  'container-type: normal !important',
  ':is([data-page-title], [data-client-project-context])',
  'flex-direction: column !important',
  'align-self: stretch !important',
  'transform: none !important',
  '[data-page-factory-region="table-header"][role="tablist"]',
  'block-size: var(--tradepro-shared-table-header-height, 3.875rem)',
  'contain: strict',
  'overflow-y: hidden !important',
]) requireCondition(factoryPageCss.includes(token), `shared factory-region style consumer is missing: ${token}`);
requireCondition(
  allPagesAcceptanceSource.includes("checkSharedRegionStyleProjection")
    && allPagesAcceptanceSource.includes("check=shared-layout-style-region-projection")
    && allPagesAcceptanceSource.includes("body:token-source")
    && allPagesAcceptanceSource.includes("large-card:card-token-source")
    && allPagesAcceptanceSource.includes("small-card:card-token-source"),
  "603-case acceptance does not fail closed on incomplete shared Layout Style region projection",
);

for (const token of [
  "createDeveloperGlobalFrameReleaseCoordinator",
  "async prepare(",
  "async commitDraft(",
  "releaseRepository.saveDraftAtomic",
  "calculatedHash !== state.artifactHash",
  "result.acceptedArtifactHash !== state.artifactHash",
  "durableEvidence.artifactHash !== state.artifactHash",
  "async requestPublication(",
  "expectedPreflightArtifactHash: state.artifactHash",
  "async startRollout(",
  "buildDeveloperGlobalFrameFactoryDefaultReceipt",
]) requireCondition(coordinatorSource.includes(token), `atomic release coordinator is missing Step 05 evidence token: ${token}`);
const prepareIndex = coordinatorSource.indexOf("async prepare(");
const commitIndex = coordinatorSource.indexOf("async commitDraft(");
const publishIndex = coordinatorSource.indexOf("async requestPublication(");
const rolloutIndex = coordinatorSource.indexOf("async startRollout(");
requireCondition(prepareIndex >= 0 && prepareIndex < commitIndex && commitIndex < publishIndex && publishIndex < rolloutIndex, "Step 05 must preserve prepare -> atomic commit -> second-review publish -> rollout ordering");
for (const token of [
  "mergeDeveloperGlobalFrameDraftWithPreflightEvidence",
  "base_draft_hash",
  "preflight_evidence",
  "artifact_hash",
  "compatible_target_page_ids",
  "isolated_page_ids",
]) requireCondition(atomicEvidenceApiSource.includes(token), `atomic evidence API is missing immutable target evidence: ${token}`);
for (const token of [
  "createDeveloperGlobalFrameReleaseCoordinator",
  "createDeveloperGlobalFrameServerRepository",
  "isDeveloperGlobalFrameIntentionalIsolationPageId",
  "compatibleTargetPageIds",
]) requireCondition(workflowBridgeSource.includes(token), `workflow coordinator bridge is missing the production release chain: ${token}`);

console.log("developer global frame runtime 契约通过：201/201 可解析；196 compatible + 5 isolated；三端与裸路由 host；published server version/hash；原子证据、二审与 rollout 闭环。");
