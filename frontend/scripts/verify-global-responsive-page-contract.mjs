import { readFile } from "node:fs/promises";

import {
  RESPONSIVE_AUDIT_INTENTIONAL_ISOLATION_PAGE_IDS,
  registeredResponsiveSourceTemplateKey,
  selectRegisteredResponsiveAuditPages,
  selectRegisteredResponsiveSemanticPages,
} from "../e2e/registered-responsive-audit-targets.mjs";

const read = (file) => readFile(file, "utf8");
const [contract, structure, surfaceContract, host, semanticTools, productMarket, productMarketModules, productMarketModulesStyles, expertIdentity, expertContentContract, customerServiceRuntimeContract, productMarketCategoryContract, mediaOptimizationContract, productMarketCategoryIcon, sidebar, hq, agencySource, clientSource, responsive, learning, parity, visual, contentPluginControls, ownershipRuntime, css, surfaceCss, moduleEditorCss, serviceExpertCss, layoutSectionEditorCss, productMarketCategoryCss, sortableOwnershipCss, aiService, responsiveE2e, responsiveDeepE2e, main] = await Promise.all([
  read("src/lib/global-responsive-page-contract.ts"),
  read("src/lib/adaptive-structure-contract.ts"),
  read("src/lib/shared-adaptive-surface-contract.ts"),
  read("src/components/ResponsivePageHost.tsx"),
  read("src/components/ResponsiveSemanticPageTools.tsx"),
  read("src/pages/ProductMarket.tsx"),
  read("src/components/product-market/ProductMarketModulesPanel.tsx"),
  read("src/components/product-market/ProductMarketModulesPanel.css"),
  read("src/components/customer-service/ExpertIdentitySummary.tsx"),
  read("src/lib/customer-service-expert-contract.ts"),
  read("src/lib/customer-service-runtime-config.ts"),
  read("src/lib/product-market-category-contract.ts"),
  read("src/lib/media-optimization-contract.ts"),
  read("src/components/product-market/ProductMarketCategoryIdentityIcon.tsx"),
  read("src/components/Sidebar.tsx"),
  read("src/components/HQLayout.tsx"),
  read("src/components/AgencySourceLayout.tsx"),
  read("src/components/ClientSourceLayout.tsx"),
  read("src/lib/responsive-shell-contract.ts"),
  read("src/lib/responsive-shell-learning.ts"),
  read("src/lib/shared-visual-parity-contract.ts"),
  read("src/components/product-market/VisualPageEditorDock.tsx"),
  read("src/components/content-plugins/ContentPluginControls.tsx"),
  read("src/lib/shared-ownership-highlight-runtime.ts"),
  read("src/index.css"),
  read("src/shared-adaptive-surface.css"),
  read("src/shared-module-editor-capacity.css"),
  read("src/shared-service-expert-capacity.css"),
  read("src/shared-layout-section-editor-capacity.css"),
  read("src/shared-product-market-category-contract.css"),
  read("src/shared-sortable-ownership-contract.css"),
  read("src/components/AIServiceWidget.tsx"),
  read("e2e/global-responsive-pages.spec.ts"),
  read("e2e/global-responsive-deep.spec.ts"),
  read("src/main.tsx"),
]);
const responsiveHost = `${host}\n${await read("src/components/ResponsivePageHostRuntime.tsx")}`;
const app = await read("src/App.tsx");
const responsiveRuntime = await read("src/components/VisualResponsiveContract.tsx");
const responsiveTargetSelector = await read("e2e/registered-responsive-audit-targets.mjs");
const pageRegistry = JSON.parse(await read("src/page-factory/page-registry.json"));
const adapterResolution = await read("src/lib/developer-global-frame-adapter-resolution.ts");

for (const token of [
  "EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector",
  "findExistingWorkspaceBodyMarkerHost",
  "visualCardAnnotationVisibility",
  "developerGlobalFrameAnnotationVisible",
  "independentTools?.querySelectorAll<HTMLElement>",
  "availableToolTriggerIds.has(id)",
  "expectedOrder.length === visibleTriggers.length",
  "contentOwner.scrollHeight - contentReservedScrollEndSpace",
  "contentOwnerStyle.scrollPaddingBottom",
  "resolveVisibleTableHeaderEdgeCells",
  'surface.tagName === "THEAD"',
  "lastStyle.borderBottomRightRadius",
]) {
  if (!learning.includes(token)) throw new Error(`Responsive learning is missing canonical existing-workspace body marker coverage: ${token}`);
}

for (const token of [
  'thead[data-responsive-shared-surface="table-header"]',
  ":nth-child(1 of :not([hidden]):not(.hidden))",
  ":nth-last-child(1 of :not([hidden]):not(.hidden))",
  "--tradepro-shared-table-header-radius",
]) {
  if (!css.includes(token)) throw new Error(`Native responsive table-header edge geometry is missing: ${token}`);
}

for (const token of [
  "container-first-semantic-templates",
  "reference", "dashboard", "list", "form", "detail", "editor", "workflow",
  "layout-only-never-records-fields-columns-or-materials",
  "container-capacity-first", "single-line>fluid-shrink>secondary-copy-yield>intrinsic-wrap", "auto-fit-by-own-container",
  "code-owned-global-responsive-page-contract",
  "shared-adaptive-structure-v3", "one-boundary-progressive-disclosure-by-container",
  "shared-mobile-app-frame-v1", "context-row-then-five-equal-primary-items",
  "section", "item", "action-rail", "choice-grid", "field-grid", "details",
  "code-owned-adaptive-structure-contract",
  "desktop-base-shared-adaptive-surfaces-v1", "single-live-dom-desktop-base",
  "same-live-dom-overlay", "same-dom-container-reflow", "same-dom-capacity-grid",
  "duplicate-business-controls", "semantic-action-reconstruction", "legacy-compact-projection",
  "code-owned-shared-adaptive-surface-contract",
  "viewport-contained-footer-safe", "detect-rank-test-promote-shared-contract",
  "labelled>measured-icon-only>measured-overflow", "densityOrder",
]) {
  if (!`${contract}\n${structure}\n${surfaceContract}\n${responsive}`.includes(token)) throw new Error(`Global responsive page contract is missing: ${token}`);
}

for (const [label, source, scope] of [
  ["HQ", hq, "hq"],
  ["Agency Source", agencySource, "agency-source"],
  ["Client Source", clientSource, "client-source"],
]) {
  if (!source.includes("ResponsivePageHost") || !source.includes(`scope=\"${scope}\"`)) {
    throw new Error(`${label} does not host every routed page through ResponsivePageHost.`);
  }
}

const isolationBlock = adapterResolution.match(
  /DEVELOPER_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_IDS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\s*as const\)/u,
);
if (!isolationBlock) throw new Error("The responsive audit cannot inspect intentional-isolation page IDs.");
const isolationIds = [...isolationBlock[1].matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
if (JSON.stringify([...RESPONSIVE_AUDIT_INTENTIONAL_ISOLATION_PAGE_IDS].sort()) !== JSON.stringify([...isolationIds].sort())) {
  throw new Error("The responsive audit intentional-isolation mirror drifted from the production resolver.");
}
const eligiblePages = pageRegistry.pages.filter((page) => (page.status === "complete" || page.status === "pilot-complete")
  && !isolationIds.includes(page.id));
const expectedCombinationKeys = [...new Set(eligiblePages.map(registeredResponsiveSourceTemplateKey))].sort();
const representativePages = selectRegisteredResponsiveAuditPages(pageRegistry.pages, isolationIds);
const representedCombinationKeys = representativePages.map(registeredResponsiveSourceTemplateKey).sort();
if (JSON.stringify(representedCombinationKeys) !== JSON.stringify(expectedCombinationKeys)) {
  throw new Error(`The formal responsive matrix is missing adopted source/template combinations: expected ${expectedCombinationKeys.join(", ")}; received ${representedCombinationKeys.join(", ")}.`);
}
const semanticPages = selectRegisteredResponsiveSemanticPages(pageRegistry.pages, isolationIds);
const semanticScopes = [...new Set(semanticPages.map((page) => page.sourceScope))].sort();
if (JSON.stringify(semanticScopes) !== JSON.stringify(["agency_source", "client_source", "hq"])) {
  throw new Error(`The formal responsive semantic matrix does not cover all source shells: ${semanticScopes.join(", ")}.`);
}
for (const token of [
  "selectRegisteredResponsiveAuditPages",
  "selectRegisteredResponsiveSemanticPages",
  "PAGE_FACTORY_PAGES",
  "RESPONSIVE_AUDIT_INTENTIONAL_ISOLATION_PAGE_IDS",
  "buildPageFactoryRuntimeRoute",
  "representativePages",
  "semanticPages",
]) {
  if (!responsiveE2e.includes(token)) throw new Error(`The formal responsive matrix is not registry-derived: ${token}`);
}
if (/const\s+targets\s*=\s*\[\s*\{/u.test(responsiveE2e)) {
  throw new Error("The formal responsive matrix must not return to a hand-written route list.");
}
for (const token of [
  "ELIGIBLE_PAGE_STATUSES",
  "registeredResponsiveSourceTemplateKey",
  "expectedKeys",
  "selectedByKey",
  "semanticTabs",
]) {
  if (!responsiveTargetSelector.includes(token)) throw new Error(`The registry-derived responsive selector is incomplete: ${token}`);
}
for (const viewport of [
  '{ label: "minimum", width: 320, height: 568, stage: "compact" }',
  '{ label: "mobile", width: 390, height: 844, stage: "compact" }',
  '{ label: "tablet", width: 768, height: 900, stage: "wrap" }',
  '{ label: "desktop", width: 1440, height: 900, stage: "comfortable" }',
]) {
  if (!responsiveE2e.includes(viewport)) throw new Error(`The formal responsive matrix is missing a required viewport: ${viewport}`);
}
for (const token of [
  'test.beforeEach(async ({ page }) =>',
  'page.route("**/api/**", (route) => route.abort())',
  "for (const target of targets)",
  "for (const viewport of viewports)",
  "expect(result.hostOverflow",
  "expect(result.shellOverflow)",
  "expect(result.documentOverflow)",
  "expect(result.learningIssues",
]) {
  if (!responsiveE2e.includes(token)) throw new Error(`The formal responsive matrix is missing an execution or isolation assertion: ${token}`);
}
for (const token of ['test.beforeEach(async ({ page }) =>', 'page.route("**/api/**", (route) => route.abort())']) {
  if (!responsiveDeepE2e.includes(token)) throw new Error(`The deep responsive matrix is missing browser API isolation: ${token}`);
}
for (const [label, source] of [["formal", responsiveE2e], ["deep", responsiveDeepE2e]]) {
  const apiRouteHandlers = source.match(/page\.route\("\*\*\/api\/\*\*"/gu) || [];
  if (apiRouteHandlers.length !== 1 || source.includes("route.continue()")) {
    throw new Error(`The ${label} responsive matrix must have exactly one global API abort and no request bypass.`);
  }
}
const sortableHoverStart = responsiveDeepE2e.indexOf("const sortableHoverSources = [");
const sortableHoverEnd = responsiveDeepE2e.indexOf('test("operations projection', sortableHoverStart);
if (sortableHoverStart < 0 || sortableHoverEnd <= sortableHoverStart) throw new Error("The three-source sortable hover test block cannot be located.");
const sortableHoverBlock = responsiveDeepE2e.slice(sortableHoverStart, sortableHoverEnd);
for (const token of [
  '{ scope: "hq", baseRoute: "/zb/product-market" }',
  '{ scope: "agency-source", baseRoute: "/zb/agency-source/product-market" }',
  '{ scope: "client-source", baseRoute: "/zb/client-source/product-market" }',
  'for (const source of sortableHoverSources)',
  'for (const target of targets)',
  'await waitForPage(page, source.scope)',
  'expect(afterBackground).not.toBe(before.background)',
]) {
  if (!sortableHoverBlock.includes(token)) throw new Error(`The three-source sortable hover matrix is incomplete: ${token}`);
}
for (const tab of ['tab: "modules"', 'tab: "layout"', 'tab: "service"']) {
  if (!sortableHoverBlock.includes(tab)) throw new Error(`The three-source sortable hover matrix is missing ${tab}.`);
}
if (sortableHoverBlock.includes("route.continue()") || sortableHoverBlock.includes('page.route("**/api/**"')) {
  throw new Error("The three-source sortable hover matrix must inherit the global API abort and cannot override it.");
}

for (const token of [
  "data-responsive-page-host",
  "data-responsive-page-template",
  "responsivePageContainerStage",
  "ResizeObserver",
  "--responsive-page-container-width",
  "data-responsive-capacity-layout", "data-responsive-capacity-row", "data-responsive-capacity-grid", "responsiveCapacityFlow",
  "data-responsive-adaptive-structure", "responsiveStructureRole", "markAdaptiveStructures",
  "data-shared-adaptive-surface-contract", "data-shared-adaptive-surface-strategy", "markSharedAdaptiveSurfaces",
  "responsiveGeneratedTitleBand", "responsiveContentReady", "markGeneratedTitleSurface", "updateContentReadiness",
  "canonicalFactoryRoot", "canonicalFactoryTitleOne", "authoredTitleCandidates.find(isVisible)",
]) {
  if (!responsiveHost.includes(token)) throw new Error(`ResponsivePageHost is incomplete: ${token}`);
}

for (const token of [
  "data-responsive-semantic-tools",
  "data-responsive-single-live-source",
  "responsiveSemanticBandActive",
  "BAND_SELECTORS",
  "data-responsive-tools-overflowed",
  "data-responsive-tools-label-mode",
  "labelledRequiredWidthRef",
  "iconRequiredWidthRef",
  "inferLegacySemanticBand",
  '"h1, h2"',
  '"table thead"',
  "responsiveLiveSurfaceOpen", "responsiveLiveSurfaceSource", "data-responsive-live-surface-overflow-menu",
]) {
  if (!semanticTools.includes(token)) throw new Error(`Semantic page tools adapter is incomplete: ${token}`);
}

for (const forbidden of ["ResponsiveProductMarketToolsPortal", "responsivePageToolsProjection", "data-responsive-page-tools-projection", "semantic-action-reconstruction"]) {
  if (`${productMarket}\n${semanticTools}`.includes(forbidden)) throw new Error(`A page-specific compact projection is forbidden: ${forbidden}`);
}

if (!responsive.includes("explicit-markers>first-visible-page-heading>first-visible-table-head")) {
  throw new Error("Responsive factory contract is missing legacy-page semantic discovery.");
}

for (const token of [
  "missing-page-host", "page-host-template-mismatch", "page-host-content-overflow",
  "semantic-page-tools-missing", "semantic-band-not-collapsed", "footer-wrap-mismatch",
  "responsive-global-page-host", "pageContract", "data-visual-global-page-responsive-contract",
  "capacity-layout-mismatch", "premature-capacity-wrap", "data-responsive-capacity-layout-policy",
  "adaptive-structure-missing", "adaptive-structure-overflow", "adaptive-choice-grid-mismatch", "structureContract",
  "mobile-application-frame-missing", "mobile-collection-overflow", "mobile-editor-density-mismatch", "module-editor-capacity-mismatch", "module-category-capacity-mismatch", "product-market-category-contract-mismatch", "product-market-shared-categories", "layout-section-editor-capacity-mismatch", "layout-section-editor-capsule", "service-expert-capacity-mismatch", "service-expert-capacity", "mobile-primary-navigation-mismatch",
  "compressed-readable-text", "floating-service-overlap", "responsive-auto-recommendation",
  "shared-adaptive-surface-missing", "duplicate-live-surface", "live-surface-proxy-active", "surfaceContract",
  "page-tools-capacity-mismatch",
  "responsive-shared-live-surfaces", "data-responsive-shared-live-surface-policy", "大屏唯一基准",
]) {
  if (!`${learning}\n${parity}\n${visual}`.includes(token)) throw new Error(`Learning/visual/factory integration is missing: ${token}`);
}

for (const token of [
  "container-name: tradepro-page",
  "@container tradepro-page (max-width: 1023px)",
  "@container tradepro-page (max-width: 639px)",
  "@container tradepro-page (max-width: 359px)",
  '[data-responsive-page-template="editor"] .adaptive-work-matrix-row',
  "writing-mode: horizontal-tb !important",
  "grid-template-columns: minmax(0, 1fr) !important",
  '[data-responsive-semantic-band-active]',
  '[data-responsive-footer-flow="wrapped"]',
  '[data-responsive-capacity-row]', '[data-responsive-capacity-grid]', 'container-name: tradepro-layout-card',
  'Shared adaptive structure v2', '[data-responsive-structure-item="module"]', '[data-responsive-choice-grid]',
  'Shared mobile application frame v1', '[data-responsive-mobile-collection="function-grid"]', 'data-responsive-collection-complexity="editor"',
  '[data-responsive-structure-item="expert"]', 'container-name: tradepro-module-item',
  '[data-responsive-generated-title-band="true"]', '@media (max-width: 279px)',
  '[data-responsive-tools-label-mode="icon-only"]',
]) {
  if (!`${css}\n${surfaceCss}\n${moduleEditorCss}\n${productMarketModulesStyles}`.includes(token)) throw new Error(`Global responsive CSS is incomplete: ${token}`);
}

for (const token of ['data-layout-global-typography-pair="vertical-columns-v2"', 'data-layout-global-font-column="weight"', 'data-layout-global-font-column="spacing"']) {
  if (!productMarket.includes(token)) throw new Error(`Global typography settings are missing a vertical-column marker: ${token}`);
}
for (const token of ["shared-global-typography-columns-v2", "[data-layout-global-typography-pair]", "[data-layout-global-font-column]", "repeat(2, minmax(0, 1fr))", "grid-template-columns: minmax(0, 1fr) !important"]) {
  if (!css.includes(token)) throw new Error(`Global typography vertical-column layout is incomplete: ${token}`);
}

if (/max-width:\s*479px[\s\S]{0,900}\[data-responsive-tool-label\]/.test(css)) {
  throw new Error("Page-tool labels must never be hidden by a fixed 479px viewport breakpoint; measured rail capacity owns density.");
}

if (!responsiveHost.includes("if (candidate.matches(actionControlSelector)) return true")) {
  throw new Error("A direct button/link must remain a valid generated-title action rail across ordinary pages.");
}
if (!contract.includes("findPageFactoryPage(pathname, search)") || !contract.includes("return factoryPage.template")) {
  throw new Error("Responsive templates must read the Page Factory registry before using legacy route heuristics.");
}
for (const token of ["responsiveFactoryWorkspaceBoundary", "data-responsive-factory-workspace-boundary=\"true\"", "responsiveFactoryBodyMarkerHitArea", "data-responsive-factory-body-marker-hit-area=\"true\""]) {
  if (!`${responsiveHost}\n${css}`.includes(token)) throw new Error(`Ordinary-page body marker is missing its shared outer-gutter boundary: ${token}`);
}
const existingWorkspaceMarkerBranch = responsiveHost.match(/if \(existingWorkspaceHitArea\) \{([\s\S]*?)\n      \}/u)?.[1] || "";
for (const token of ["resetAlignedWorkspaceHitArea()", "removeResponsiveHitAreas()", "return;"]) {
  if (!existingWorkspaceMarkerBranch.includes(token)) {
    throw new Error(`SharedPageWorkspace marker ownership is incomplete: ${token}`);
  }
}
if (
  existingWorkspaceMarkerBranch.includes("responsive-factory-body-hit-") ||
  existingWorkspaceMarkerBranch.includes("markerGeometry")
) {
  throw new Error("Factory projection must not overwrite SharedPageWorkspace-owned marker geometry.");
}

for (const token of ["Shared module-editor capacity plugin v5", "tradepro-module-category", "@media (min-width: 1024px)", "@media (max-width: 1023px)", "desktopCompactHeight: 50", "desktop-shared-50-6-36-single-capsule-below-1024-static-flow", "normal-document-flow", "all-widths-static-flow", "position: static !important", "min-width: 30rem", "min-width: 22rem", "min-width: 27rem", "min-width: 64rem", "shared-module-editor-capacity-v5", "shared-module-category-capacity-v2", "one-card-boundary", "data-shared-module-hierarchy-rail", "product-module-hierarchy-text"]) {
  if (!`${moduleEditorCss}\n${responsive}\n${structure}`.includes(token)) throw new Error(`Shared module editor capacity plugin is incomplete: ${token}`);
}

for (const token of ["Shared customer-service expert capacity plugin v4", "tradepro-service-expert-workspace", "minimumCardInlineSize: 222", "maximumColumns: Number.POSITIVE_INFINITY", "currentExpertProjection: \"selection-card-auto-fit-v1\"", "currentExpertBlockSizing: \"intrinsic-block-size-no-track-stretch\"", "data-current-expert-capacity-contract=\"selection-card-auto-fit-v1\"", "align-self: start", "controlEdgeInset: 8", "controlGap: 8", "grid-template-columns: repeat(auto-fit", "tradepro-service-expert-card-min-inline-size", "--tradepro-current-expert-card-inline-size: 222px", "--tradepro-current-expert-primary-field-inline-size: 182px", "--tradepro-current-expert-primary-action-inline-size: 80px", "seven-character-total-shared-behavior-ellipsis-v3", "centered-avatar-eight-gap-fact-columns-v4", "unbounded-columns", "--tradepro-shared-expert-control-edge-inset", "--tradepro-shared-expert-control-gap", "eight-pixel-inline-control-inset", "no-unframed-double-inset", "--responsive-service-sticky-safe-block", "stickyHeaderScrollSafeBlock", "shared-service-expert-capacity-v4"]) {
  if (!`${serviceExpertCss}\n${responsive}\n${expertContentContract}\n${productMarket}`.includes(token)) throw new Error(`Shared customer-service expert capacity plugin is incomplete: ${token}`);
}
const sharedExpertAvatarAliasCount = (
  serviceExpertCss.match(/--tradepro-expert-summary-avatar-size:\s*var\(--tradepro-shared-expert-launcher-avatar-size\);/gu) || []
).length;
if (sharedExpertAvatarAliasCount < 3) {
  throw new Error("Current Expert, selection cards, and their normal shared summary must all inherit the floating launcher avatar-size token.");
}
const floatingAvatarFrameProjectionCount = (
  aiService.match(/data-shared-expert-avatar-frame-contract="floating-service-v1"/gu) || []
).length;
if (floatingAvatarFrameProjectionCount < 2) {
  throw new Error("Floating launcher and open chat title avatar must both inherit the Current Expert frame contract.");
}
for (const token of ["--tradepro-shared-expert-avatar-frame-color", "var(--tradepro-shared-expert-avatar-frame-color)"]) {
  if (!`${css}\n${aiService}\n${parity}`.includes(token)) throw new Error(`Shared expert avatar frame colour contract is incomplete: ${token}`);
}

for (const token of ["single-line-ellipsis-v1", "current-expert-voice-customization", "当前专家真人朗音自定义", "customer-service-name", "data-shared-expert-text-name", "data-shared-expert-text-value", "data-shared-expert-field", "data-shared-expert-switch-loading-text", "data-shared-expert-greeting-preview", "data-shared-expert-picker-name", "data-shared-expert-chat-name", "data-ai-service-message-id", "data-shared-customer-service-expert-projection", "resolveCustomerServiceExpertProfile", "resolveCustomerServiceRuntimeSnapshot", "reconcileCustomerServiceRuntimeExpertSelection", "saved-default-expert-resets-stale-chat-preference", "shared-customer-service-runtime-config-v2", ".shared-expert-identity-meta-item > span", "overflow-x: hidden", "客服名称与招呼词没有读取共享单行省略契约", "customer-service expert names and greetings use shared ellipsis"]) {
  if (!`${expertIdentity}\n${expertContentContract}\n${customerServiceRuntimeContract}\n${productMarket}\n${sidebar}\n${aiService}\n${css}\n${parity}\n${visual}\n${responsiveDeepE2e}`.includes(token)) throw new Error(`Shared customer-service expert content contract is incomplete: ${token}`);
}

for (const token of ["Shared Layout Style section-editor capsule plugin v2", "data-shared-layout-section-editor-capsule", "data-layout-section-editor-segment", "tradepro-layout-card", "max-width: 639px", "max-width: 479px", "shared-layout-section-editor-capsule-v2", "three-separated-semantic-segments", "semantic-divider-only", "no-inner-shells"]) {
  if (!`${layoutSectionEditorCss}\n${responsive}\n${productMarket}`.includes(token)) throw new Error(`Shared Layout Style section-editor capsule plugin is incomplete: ${token}`);
}

for (const token of ["shared-product-market-category-contract-v9", "category-key+display-order+label", "customer-service-expert-id+material-id", "01-12>customer-service-local-material-reference>material-id+local-url", "resolveCustomerServiceLocalMaterialReference>readCustomerServiceMediaPreview>shared-cache>stable-object-url", "01-12-single-local-material-reference-contract", "01-12>bundled-local-portrait-first>saved-media-ready-gate>saved-material-replaces>decode-error-to-bundled>never-empty", "data-product-market-expert-first-paint-fallback", "service-select-expert>sidebar+modules+operations>same-expert-id+same-material-id", "sidebar-20px>modules+operations-16px", "shared-drag+shared-up-down+two-digit-order", "category-batch-status", "category-paths-only>open-cancel-hide>confirm-and-persist-shared-snapshot", "category-sort-controls+two-digit-order+label+adjacent-status-group", "column-configuration-order>sidebar+operations-live-projection", "customer-service-select-expert>shared-category-identity-icon>sidebar+modules+operations", "shared-key>direct-14+linked-8+category-10>no-navigation-no-scroll-no-persist", "column-configuration-sort-source>operations-status-projection>sidebar-navigation-projection", "projectProductMarketCategoryGroups", "resolveProductMarketCategoryStatus", "resolveProductMarketCategoryExpertMaterialId", "ProductMarketCategoryIdentityIcon", "data-shared-product-market-category-icon", "data-shared-product-market-category-expert-id", "data-shared-product-market-category-material-id", "data-shared-product-market-category-display-size", "data-shared-product-market-category-media-stability", "customer-service-local-material", "data-shared-product-market-category-contract", "data-shared-product-market-category-sort-rail", "data-shared-product-market-category-order-segment", "data-shared-product-market-category-name", "data-product-market-category-status-cluster", "data-product-market-category-status-actions", "data-shared-ownership-key", "data-shared-ownership-category-target", "tradepro-product-market-category", "column-configuration-source>shared-category-reorder>sidebar+operations-live-projection>category-open-cancel-hide"]) {
  if (!`${productMarketCategoryContract}\n${mediaOptimizationContract}\n${productMarketCategoryIcon}\n${sidebar}\n${responsive}\n${productMarket}\n${productMarketModules}\n${productMarketCategoryCss}\n${ownershipRuntime}`.includes(token)) throw new Error(`Shared Product Market category contract is incomplete: ${token}`);
}
if (!productMarketCategoryContract.includes("MEDIA_OPTIMIZATION_CONTRACT.delivery.avatarFirstPaint.policy")) throw new Error("Shared Product Market category contract must consume the canonical media first-paint policy.");

for (const token of ["shared-sortable-ownership-contract-v3", "Shared sortable-card and ownership-highlight contract v3", "ContentPluginMoveRail", "data-shared-sort-move-rail", "data-shared-sortable-card", "data-shared-sortable-card-rail", "data-shared-sortable-capsule", "data-shared-category-capsule", "data-shared-sortable-capsule-title", "data-shared-sortable-capsule-description", "data-shared-product-market-category-source=\"operations\"", "moveRailWidth: 112", "sortToolbarWidth: 152", "settingsHeaderMinimum: 50", "settingsHeaderPadding: 6", "settingsHeaderInnerHeight: 36", "settingsContentGap: 12", "settingsFontSize: 14", "settingsLineHeight: 20", "defaultHighlightMix: 24", "hoverHighlightMix: 56", "linkedHighlightMix: 8", "categoryHighlightMix: 10", "single-outer-capsule", "14-20-type", "12-content-gap", "nearest-sortable-card-or-operations-category", "product-module-category-operation-grid", "useSharedOwnershipHighlightRuntime", "no-navigation-no-scroll-no-persist"]) {
  if (!`${contentPluginControls}\n${productMarket}\n${productMarketModules}\n${sidebar}\n${responsive}\n${learning}\n${parity}\n${ownershipRuntime}\n${sortableOwnershipCss}`.includes(token)) throw new Error(`Shared sortable ownership contract is incomplete: ${token}`);
}

for (const token of ["getSharedFloatingServiceBottomInset", "getFloatingServiceMaxHeight", "minimumFooterSafeBottom", "data-shared-floating-service-safe-bottom"]) {
  if (!aiService.includes(token)) throw new Error(`Floating customer-service safe-area integration is incomplete: ${token}`);
}


for (const token of ["Desktop-base shared adaptive surfaces v1", "tradepro-live-surface", "data-responsive-live-surface-open", "single-live-dom-desktop-base"]) {
  if (!surfaceCss.includes(token)) throw new Error(`Shared adaptive surface CSS is incomplete: ${token}`);
}
if (!main.includes('import "./shared-adaptive-surface.css"')) throw new Error("Shared adaptive surface CSS is not loaded after index.css.");
if (!productMarketModules.includes('import "@/shared-module-editor-capacity.css"')) throw new Error("Shared module editor capacity CSS must load with the lazy Column Configuration panel.");
if (!main.includes('import "./shared-service-expert-capacity.css"')) throw new Error("Shared customer-service expert capacity CSS is not loaded after the global CSS sources.");
if (!productMarket.includes('import "@/shared-layout-section-editor-capacity.css"')) throw new Error("Shared Layout Style section-editor capsule CSS must load with Product Market instead of the application entry.");
if (main.includes('shared-module-editor-capacity.css') || main.includes('shared-layout-section-editor-capacity.css')) throw new Error("Product Market-only capacity CSS must not remain in the global entry bundle.");
if (!main.includes('import "./shared-product-market-category-contract.css"')) throw new Error("Shared Product Market category CSS is not loaded after the global CSS sources.");
if (!main.includes('import "./shared-sortable-ownership-contract.css"')) throw new Error("Shared sortable ownership CSS is not loaded after the Product Market category contract.");
if (/\[data-product-market|\.product-market/.test(surfaceCss)) {
  throw new Error("Shared adaptive surface CSS must remain route-neutral; pages may only declare semantic markers.");
}

// Loading and idle-work boundaries are part of the responsive contract: a
// route must not pull unrelated screens into the entry chunk, and an idle
// viewport must not be remeasured once per second without a real signal.
if (/^import\s+[\s\S]*?from\s+["']\.\/pages\//mu.test(app)) {
  throw new Error("App route pages must use lazyPage/lazyNamedPage instead of static page imports.");
}
for (const token of [
  'lazyNamedPage(loadHQLiveFinancePages, "HQOrdersLive")',
  'lazyNamedPage(loadHQLiveConfigPages, "HQPlatformConfigLive")',
  'lazyPage(() => import("./pages/hq/PlatformArchitecture"))',
  'lazyPage(() => import("./pages/ProductAnalysis"))',
]) {
  if (!app.includes(token)) throw new Error(`Representative route is no longer lazy-loaded: ${token}`);
}
if (responsiveRuntime.includes("dimensionAuditTicks") || /dimensionAuditTicks\s*%/u.test(responsiveRuntime)) {
  throw new Error("Responsive runtime must not force a full idle audit on a timer tick.");
}
for (const token of ["window.addEventListener(\"resize\", scheduleApply", "ResizeObserver", "MutationObserver", "visualViewport?.addEventListener", "query.addEventListener(\"change\""]) {
  if (!responsiveRuntime.includes(token)) throw new Error(`Responsive event-driven trigger is missing: ${token}`);
}
for (const token of ["let auditFrame = 0", "let auditPending = false", "auditFrame = window.requestAnimationFrame", "window.cancelAnimationFrame(auditFrame)"]) {
  if (!responsiveRuntime.includes(token)) throw new Error(`Responsive observation batching is missing: ${token}`);
}
for (const token of [
  "let stableFramesRemaining = 0",
  "stableFramesRemaining = 2",
  "window.addEventListener(\"tradepro:workspace-marker-layout\", scheduleStableMarkerApply)",
  "window.removeEventListener(\"tradepro:workspace-marker-layout\", scheduleStableMarkerApply)",
]) {
  if (!responsiveRuntime.includes(token)) throw new Error(`Workspace marker stabilization is missing: ${token}`);
}
const markerStabilityBlock = responsiveRuntime.match(/const scheduleStableMarkerApply = \(\) => \{([\s\S]*?)\n    \};/u)?.[1] || "";
const unifiedFrameBlock = responsiveRuntime.match(/const ensureAuditFrame = \(\) => \{([\s\S]*?)\n    \};/u)?.[1] || "";
if (!markerStabilityBlock.includes("stableFramesRemaining = 2")
  || !unifiedFrameBlock.includes("stableFramesRemaining -= 1")
  || !unifiedFrameBlock.includes("apply();")) {
  throw new Error("Workspace marker observations must collect after two stable animation frames.");
}
if (responsiveRuntime.includes("window.queueMicrotask(() =>")) {
  throw new Error("Responsive observation must wait for the next layout frame instead of auditing inside a mutation microtask.");
}
for (const forbidden of ["assignmentScope", "resolveAIAssignment", "AIAssignmentResolution", 'from "@/lib/platform-api"']) {
  if (aiService.includes(forbidden)) throw new Error(`AI service startup still contains unused assignment work: ${forbidden}`);
}
if (!aiService.includes("aiProviderApi.runAssignedApp")) {
  throw new Error("AI service must retain the user-triggered assigned-app request.");
}

console.log("Global responsive page contract verified: all three source shells, seven templates, runtime learning, visual developer and factory restore are connected.");
