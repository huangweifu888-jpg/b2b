import fs from "node:fs";

import { build } from "esbuild";

const read = (path) => fs.readFileSync(path, "utf8");
const requireCondition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const executable = await build({
  stdin: {
    contents: [
      'export * from "./src/lib/developer-global-frame-adapter-resolution.ts";',
      'export * from "./src/lib/developer-global-frame-adapter-registry.ts";',
      'export * from "./src/lib/developer-global-frame-draft.ts";',
      'export * from "./src/page-factory/page-factory.ts";',
    ].join("\n"),
    loader: "ts",
    resolveDir: process.cwd(),
    sourcefile: "developer-global-adapter-coverage-entry.ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  logLevel: "silent",
});
const bundled = executable.outputFiles[0]?.text;
requireCondition(bundled, "Cannot build the global adapter coverage fixture.");
const contract = await import(`data:text/javascript;base64,${Buffer.from(bundled).toString("base64")}`);

requireCondition(
  contract.DEVELOPER_GLOBAL_FRAME_ADAPTER_REGISTRY.length === contract.DEVELOPER_GLOBAL_FRAME_ADAPTER_DESCRIPTORS.length,
  "Every explicit adapter descriptor must pass through the canonical Page Factory projection.",
);
const coverage = contract.inspectDeveloperGlobalFrameAdapterCoverage();
requireCondition(coverage.totalRegistered === 201, `Expected 201 registered pages, received ${coverage.totalRegistered}.`);
requireCondition(coverage.eligible === 201, `Expected 201 complete/pilot-complete pages, received ${coverage.eligible}.`);
requireCondition(coverage.resolved === 201 && coverage.coveragePercent === 100, `Adapter coverage is ${coverage.resolved}/${coverage.eligible}.`);
requireCondition(coverage.explicit === 3 && coverage.templateProjected === 198, "Explicit/template projection split must remain 3/198.");
requireCondition(coverage.issues.length === 0, `Adapter coverage issues: ${coverage.issues.join("; ")}`);
requireCondition(contract.DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS.length === 201, "The durable release registry must contain all 201 resolvable pages.");
requireCondition(JSON.stringify(coverage.byScope) === JSON.stringify({
  hq: { eligible: 66, resolved: 66 },
  agency_source: { eligible: 33, resolved: 33 },
  client_source: { eligible: 102, resolved: 102 },
}), "Three-source adapter coverage is not symmetric with the Page Factory registry.");
requireCondition(JSON.stringify(Object.fromEntries(Object.entries(coverage.byTemplate).map(([key, value]) => [key, value.resolved]))) === JSON.stringify({
  reference: 28,
  dashboard: 103,
  list: 35,
  form: 16,
  detail: 1,
  editor: 6,
  workflow: 12,
}), "All seven Page Factory templates must resolve to a code-owned projection.");

const prefixes = { hq: "/zb", agency_source: "/zb/agency-source", client_source: "/zb/client-source" };
const standalonePageIds = new Set(["auth-callback", "auth-error", "client-logout-callback", "client-preview-frame", "client-preview-site"]);
for (const page of contract.PAGE_FACTORY_PAGES) {
  const [registeredPath, registeredSearch = ""] = page.route.split("?", 2);
  const concretePath = registeredPath.replace(/:[^/]+/gu, "adapter-fixture");
  const routePrefix = standalonePageIds.has(page.id) ? "" : prefixes[page.sourceScope];
  const pathname = `${routePrefix}${concretePath === "/" ? "" : concretePath}` || "/";
  const params = new URLSearchParams(registeredSearch);
  params.set("siteId", "adapter-coverage-site");
  params.set("developmentApply", "coverage");
  const resolution = contract.resolveDeveloperGlobalFrameAdapterForRoute(pathname, `?${params}`, page.sourceScope);
  requireCondition(resolution?.pageFactoryId === page.id, `Route did not resolve to ${page.id}: ${pathname}?${params}`);
  requireCondition(resolution?.pageRegistration === page, `Resolution did not retain the canonical Page Factory object: ${page.id}`);
  const wrongScope = page.sourceScope === "hq" ? "client_source" : "hq";
  requireCondition(contract.resolveDeveloperGlobalFrameAdapterForRoute(pathname, `?${params}`, wrongScope) === null, `Scope mismatch did not fail closed: ${page.id}`);
}

const canonicalOperations = contract.PAGE_FACTORY_PAGES.find((page) => page.id === "client-source-product-market-operations");
requireCondition(canonicalOperations, "Cannot locate the explicit operations adapter fixture.");
const derivedFixturePage = {
  ...canonicalOperations,
  route: "/product-market?tab=derived-fixture",
  component: "frontend/src/pages/DerivedFixture.tsx",
  entryComponent: "frontend/src/pages/DerivedFixture.tsx",
  template: "detail",
  requiredRegions: ["top", "body", "title-1", "content", "footer"],
};
const derivedFixture = contract.buildDeveloperGlobalFrameAdapterRegistration({
  profilePageId: "derived-fixture",
  pageFactoryId: derivedFixturePage.id,
  role: "consumer",
  domAdapterId: "existing-workspace-direct-v1",
  allowedAdditionalQueryKeys: [],
  selectors: {
    bridge: null,
    title: "[data-fixture-title]",
    tableShell: "[data-fixture-table]",
    tableHeader: "[data-fixture-header]",
    content: "[data-fixture-content]",
  },
}, [derivedFixturePage]);
requireCondition(
  derivedFixture.route === derivedFixturePage.route
    && derivedFixture.component === derivedFixturePage.component
    && derivedFixture.template === derivedFixturePage.template
    && JSON.stringify(derivedFixture.pageFactoryRequiredRegions) === JSON.stringify(derivedFixturePage.requiredRegions),
  "Explicit adapter metadata did not derive from the single Page Factory source.",
);

const pilot = contract.resolveDeveloperGlobalFrameAdapterForRoute(
  "/zb/client-source/product-analysis",
  "?tab=keyword-planner&siteId=pilot-fixture",
  "client_source",
);
requireCondition(pilot?.pageFactoryId === "product-analysis-interest-search" && pilot.lifecycle === "pilot-complete", "The pilot-complete Interest Search route is not eligible.");
requireCondition(contract.resolveDeveloperGlobalFrameAdapterForRoute("/zb/client-source/not-registered", "", "client_source") === null, "Unknown routes must fail closed.");
requireCondition(contract.resolveDeveloperGlobalFrameAdapterForRoute("/zb/client-source/social", "?tab=dashboard&unknownIdentity=1", "client_source") === null, "Unknown query identity must fail closed.");
requireCondition(contract.isDeveloperGlobalFrameCompatibleTarget(pilot, [pilot.pageFactoryId], "client_source"), "Compatible page IDs must admit the exact resolved page.");
requireCondition(!contract.isDeveloperGlobalFrameCompatibleTarget(pilot, ["client-social-dashboard"], "client_source"), "A non-target page was admitted by the compatibleTargetPageIds gate.");

const defaultGraph = contract.buildDeveloperGlobalFrameTargetGraph("1.0.0", "client_source");
requireCondition(defaultGraph.adapters.length === 201 && defaultGraph.target_matrix.length === 201, "The published target graph must persist all 201 page identities.");
requireCondition(defaultGraph.target_matrix.filter((target) => target.compatibility === "compatible").length === 196, "All 196 business pages must be compatible by default.");
requireCondition(JSON.stringify(defaultGraph.target_matrix.filter((target) => target.compatibility === "isolated").map((target) => target.page_id).sort()) === JSON.stringify([
  "auth-callback",
  "auth-error",
  "client-logout-callback",
  "client-preview-frame",
  "client-preview-site",
]), "The five technical/control-flow routes must remain durably isolated.");
requireCondition(new Set(defaultGraph.target_matrix.map((target) => target.source_scope)).size === 3, "The published graph must retain real HQ/Agency/Client target scopes.");
let rejectedUnknownTarget = false;
try {
  contract.buildDeveloperGlobalFrameTargetGraph("1.0.0", "client_source", ["not-a-factory-page"]);
} catch {
  rejectedUnknownTarget = true;
}
requireCondition(rejectedUnknownTarget, "Unknown preflight target IDs must fail closed before draft construction.");

const responsiveHostCore = read("src/components/ResponsivePageHost.tsx");
const responsiveHostRuntime = read("src/components/ResponsivePageHostRuntime.tsx");
const responsiveHost = `${responsiveHostCore}\n${responsiveHostRuntime}`;
for (const token of [
  'const ResponsivePageHostRuntime = lazy(() => import("./ResponsivePageHostRuntime"))',
  "schedulePostPaintIdle(() => setRuntimeReady(true))",
  "useLayoutEffect(() => {",
  '<Fragment key="page-content">{children}</Fragment>',
  "hostElement={hostElement}",
  "onShowTitleOneFallbackChange={handleTitleOneFallbackChange}",
]) requireCondition(responsiveHostCore.includes(token), `ResponsivePageHost core is missing its stable first-paint/deferred-runtime boundary: ${token}`);
for (const token of [
  "resolveDeveloperGlobalFrameAdapterForRoute",
  "isDeveloperGlobalFrameCompatibleTarget",
  "release.compatibleTargetPageIds",
  "projectRuntimeFactoryRegions",
  'frameAdapterResolution?.strategy !== "template-projection"',
  'frameAdapterResolution.templateRegistration.scrollContract === "content-only"',
  'import "@/page-factory/page-factory.css"',
  'candidate.dataset.pageFactoryRegionStrategy === "runtime-auto"',
  'element.dataset.pageFactoryRuntimeProjection !== "true"',
  "element.dataset.developmentStandardFrameRegion !== region",
  "hadMismatchedAlias",
  "staleProjectedRoots",
  "[data-social-content-card]",
  "[data-page-layout-footer]",
  "data-responsive-factory-body-marker-geometry",
  "SHARED_LAYOUT_STYLE_CARD_REGION_DISCOVERY_MUTATION_ATTRIBUTES",
  "attributeFilter: Array.from(new Set([",
  '"data-development-standard-frame-region"',
  '"data-development-standard-frame-label"',
  "host.dataset.developerGlobalFrameResolvedPageId",
  "data-developer-global-batch-target-page-id",
  "cleanupTemplateProfile?.();",
]) requireCondition(responsiveHost.includes(token), `ResponsivePageHost is missing runtime gate/lifecycle token: ${token}`);
const adapterRegistrySource = read("src/lib/developer-global-frame-adapter-registry.ts");
requireCondition(
  adapterRegistrySource.includes('scrollContract: "content-only"')
    && adapterRegistrySource.includes('projection: "canonical-semantic-regions"'),
  "The seven shared template adapters must own one latent content scroll contract.",
);
requireCondition(
  (responsiveHost.match(/const assignRegion =/g) ?? []).length === 1,
  "ResponsivePageHost must keep one canonical region resolver; identity projection cannot duplicate region ownership.",
);
const globalStyles = read("src/index.css");
const responsiveMarkerHoverStart = globalStyles.indexOf(':has(> [data-responsive-factory-body-marker-hit-area="true"]:hover)::after {');
const responsiveMarkerHoverEnd = globalStyles.indexOf("}", responsiveMarkerHoverStart);
requireCondition(responsiveMarkerHoverStart >= 0 && responsiveMarkerHoverEnd > responsiveMarkerHoverStart, "Cannot locate the responsive Factory body-marker hover rule.");
const responsiveMarkerHoverRule = globalStyles.slice(responsiveMarkerHoverStart, responsiveMarkerHoverEnd);
for (const token of ["display: inline-flex !important", "visibility: visible !important", "opacity: 1 !important"]) {
  requireCondition(responsiveMarkerHoverRule.includes(token), `Responsive Factory body-marker hover is missing precedence token: ${token}`);
}
const factoryPageSource = read("src/page-factory/FactoryPage.tsx");
for (const token of [
  "canonical.find(isRenderedElement)",
  "element.dataset.developmentStandardFrameRegion",
  "[role='tabpanel']:not([hidden])",
  "[data-social-content-card]",
  "SHARED_LAYOUT_STYLE_CARD_REGION_DISCOVERY_MUTATION_ATTRIBUTES",
  "attributeFilter: [...SHARED_LAYOUT_STYLE_CARD_REGION_DISCOVERY_MUTATION_ATTRIBUTES]",
]) requireCondition(factoryPageSource.includes(token), `FactoryPage is missing visibility/annotation reconciliation: ${token}`);
const readinessStart = responsiveHost.indexOf("const updateContentReadiness = () => {");
const readinessEnd = responsiveHost.indexOf("const markSharedAdaptiveSurfaces", readinessStart);
requireCondition(readinessStart >= 0 && readinessEnd > readinessStart, "Cannot locate ResponsivePageHost readiness lifecycle.");
requireCondition(!responsiveHost.slice(readinessStart, readinessEnd).includes("cleanupTemplateProfile"), "Content readiness must not tear down an unchanged batch profile.");
requireCondition(
  responsiveHostRuntime.includes("const frameAdapterResolution = useMemo(")
    && responsiveHostRuntime.includes("[factoryPageRegistration, frameAdapterResolution, hostElement, location.pathname, location.search, onShowTitleOneFallbackChange, requiresTitleOne, scope, sourceScope, template]"),
  "Route, host, callback, source and the complete memoized Factory resolution must remount the local batch gate.",
);

const publishedHost = read("src/components/developer-platform/DeveloperGlobalFrameRuntimeHost.tsx");
for (const token of [
  "resolveDeveloperGlobalFrameAdapterForRoute(pathname, search, sourceScope)",
  "resolveDeveloperGlobalFrameTemplateRuntimeApplication",
  "applyDeveloperGlobalFrameTemplateRuntimeProfile",
  "developerGlobalFramePublishedRuntime",
  "developerGlobalFramePublishedHash",
  "published-config-hash",
  "resolution.pageFactoryId !== registration.pageFactoryId",
  'sourceScope === "agency_source" ? "agency-source"',
  'document.querySelectorAll<HTMLElement>(`[data-responsive-shell="${responsiveShellScope}"]`)',
]) requireCondition(publishedHost.includes(token), `Published runtime host is missing a fail-closed source/page binding: ${token}`);

const standaloneHost = read("src/components/StandaloneGlobalFramePageHost.tsx");
const appSource = read("src/App.tsx");
for (const token of ["DeveloperGlobalFrameRuntimeHost", "ResponsivePageHost", 'sourceScope="client_source"', 'data-responsive-shell="client-source"']) {
  requireCondition(standaloneHost.includes(token), `Standalone factory runtime host is incomplete: ${token}`);
}
for (const route of ["/auth/callback", "/auth/error", "/logout-callback", "/sites/:slug", "/preview-frame"]) {
  requireCondition(appSource.includes(`<Route path="${route}"`), `Standalone registered route is missing: ${route}`);
}
requireCondition(appSource.includes("<StandaloneGlobalFramePageHost />"), "The five standalone Page Factory routes are not mounted under their read-only runtime host.");
requireCondition(appSource.includes('routePath("/version")'), "The official Agency Source /zb/agency-source/version route is missing.");
requireCondition(appSource.includes('path="/dl/version"'), "The legacy /dl/version alias must remain available.");
const agencyRouteContext = read("src/lib/agency-source-route-context.ts");
const agencyVersionCenter = read("src/pages/agency/AgencyVersionCenter.tsx");
requireCondition(agencyRouteContext.includes("resolveAgencySourceAgencyCode"), "Agency Source canonical route context resolver is missing.");
requireCondition(agencyVersionCenter.includes("resolveAgencySourceAgencyCode(window.location.search)"), "Agency version center does not render its real default tenant on the canonical no-query route.");

const runtimeCss = read("src/developer-global-frame-runtime.css");
requireCondition(
  !runtimeCss.includes(
    '[data-existing-workspace-body-marker-hit-area="left"][data-responsive-factory-body-marker-geometry="factory-root"]',
  ),
  "Published runtime CSS must not override SharedPageWorkspace-owned marker geometry.",
);
const existingWorkspaceCss = read("src/shared-existing-workspace-frame.css");
const closedExistingWorkspaceTitleDescriptionRule = [
  'html[data-tradepro-page-layout="active"][data-tradepro-page-shared-variables="true"] #root',
  '  [data-page-factory-frame-owner="existing-workspace"][data-shared-page-workspace][data-development-standard-frame-region="body"]',
  '  > [data-shared-layout-section="title"][data-development-standard-frame-region="title"]:not([data-responsive-live-surface-open="true"])',
  '  [data-page-title-content] > [data-shared-title-description] {',
  '  display: block !important;',
  '}',
].join("\n");
requireCondition(
  existingWorkspaceCss.includes(closedExistingWorkspaceTitleDescriptionRule),
  "The shared desktop title description must yield ownership when its live surface opens.",
);
const shortHeightExistingWorkspaceTitleDescriptionRule = [
  "@media (max-height: 799px) {",
  '  html[data-visual-responsive-contract="true"][data-tradepro-page-layout="active"][data-tradepro-page-shared-variables="true"] #root',
  '    [data-page-factory-frame-owner="existing-workspace"][data-shared-page-workspace][data-development-standard-frame-region="body"]',
  '    > [data-shared-layout-section="title"][data-development-standard-frame-region="title"]:not([data-responsive-live-surface-open="true"])',
  '    [data-page-title-content] > [data-shared-title-description] {',
  '    display: none !important;',
  '  }',
  '}',
].join("\n");
requireCondition(
  existingWorkspaceCss.includes(shortHeightExistingWorkspaceTitleDescriptionRule),
  "The canonical closed existing-workspace title must yield secondary copy on short viewports.",
);

const backendSchema = read("../backend/schemas/developer_global_frame.py");
requireCondition(backendSchema.includes('compatibility: Literal["compatible", "isolated"]'), "Backend strict schema does not persist compatible/isolated decisions.");
for (const token of [
  "target_scopes = {target.source_scope for target in self.target_matrix}",
  'global_scopes = {"hq", "agency_source", "client_source"}',
  "if target_scopes not in ({self.source_scope}, global_scopes):",
  "cannot cross source scopes unless the complete three-source matrix is present",
]) requireCondition(backendSchema.includes(token), `Backend source-scope validator is missing the single-owner/complete-three-source rule: ${token}`);
const draftSource = read("src/lib/developer-global-frame-draft.ts");
requireCondition(draftSource.includes("foundation target must remain compatible"), "Draft validation does not protect the reference and pilot targets from isolation.");

for (const [path, sourceScope] of [
  ["src/components/HQLayout.tsx", "hq"],
  ["src/components/AgencySourceLayout.tsx", "agency_source"],
  ["src/components/ClientSourceLayout.tsx", "client_source"],
]) {
  const layout = read(path);
  requireCondition(layout.includes("DeferredShellRuntimeHosts"), `${path} does not mount the deferred shared shell runtime boundary.`);
  requireCondition(layout.includes(`sourceScope="${sourceScope}"`), `${path} does not bind the runtime to ${sourceScope}.`);
}
const deferredShellRuntimeHosts = read("src/components/DeferredShellRuntimeHosts.tsx");
for (const token of [
  'const ShellRuntimeHosts = lazy(() => import("./ShellRuntimeHosts"))',
  "schedulePostPaintIdle(() => setReady(true))",
  "<VisualResponsiveBootstrap scope={visualScope} />",
  "<ShellRuntimeHosts pathname={pathname} search={search} sourceScope={sourceScope} />",
]) requireCondition(deferredShellRuntimeHosts.includes(token), `Deferred shell runtime boundary is incomplete: ${token}`);
const shellRuntimeHosts = read("src/components/ShellRuntimeHosts.tsx");
for (const token of [
  "DeveloperGlobalFrameRuntimeHost",
  "VisualResponsiveContract",
  "<DeveloperGlobalFrameRuntimeHost pathname={pathname} search={search} sourceScope={sourceScope} />",
  "<VisualResponsiveContract scope={visualScope} />",
]) requireCondition(shellRuntimeHosts.includes(token), `Shared shell runtime composition is incomplete: ${token}`);
const visualResponsiveBootstrap = read("src/components/VisualResponsiveBootstrap.tsx");
for (const token of [
  "useLayoutEffect(() => {",
  'root.setAttribute("data-visual-responsive-contract", "true")',
  'root.setAttribute("data-responsive-shell-contract", RESPONSIVE_SHELL_FACTORY_DEFAULT.version)',
  'window.addEventListener("resize", schedule, { passive: true })',
]) requireCondition(visualResponsiveBootstrap.includes(token), `Synchronous visual responsive bootstrap is incomplete: ${token}`);
const clientSourceLayout = read("src/components/ClientSourceLayout.tsx");
for (const token of [
  "data-client-project-unavailable",
  "data-client-project-unavailable-frame",
  "data-client-project-unavailable-header",
  'data-page-factory-region="content"',
  'data-page-factory-region="large-card"',
  'data-development-standard-frame-region="large-card"',
  'data-shared-large-card-surface="true"',
  'data-page-factory-region="small-card"',
  'data-development-standard-frame-region="small-card"',
  'data-shared-small-card-surface="true"',
]) requireCondition(clientSourceLayout.includes(token), `Client unavailable-state contract is missing its real visible shared-card semantic: ${token}`);
requireCondition(
  clientSourceLayout.includes("hasDedicatedProjectFrame && !projectUnavailable && !keepDedicatedProjectFooter"),
  "Client unavailable-state contract must keep the shared footer visible when a dedicated route frame cannot render.",
);
for (const token of ["[data-client-project-unavailable-frame]", "[data-client-project-unavailable-header]"]) {
  requireCondition(responsiveHostRuntime.includes(token), `Responsive runtime projection is missing the visible unavailable-state structural candidate: ${token}`);
}

console.log(`developer global adapter coverage passed: ${coverage.resolved}/${coverage.eligible} (${coverage.coveragePercent}%); explicit=${coverage.explicit}; template=${coverage.templateProjected}; HQ=66; Agency=33; Client=102.`);
