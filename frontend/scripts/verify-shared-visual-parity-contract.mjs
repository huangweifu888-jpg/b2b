import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFile(resolve(root, file), "utf8");

const [contract, sharedWindowContract, responsiveContract, visualResponsiveContract, visualEditorDock, responsivePageHost, runtimeScan, panel, productMarket, productMarketDevelopmentGuide, productMarketModules, css, aiServiceCss, e2e, globalResponsiveDeep, pageLayout, globalFrameRuntime, productAnalysis, socialMedia, allPagesE2e, sharedLiveSurfacesE2e, sharedCardCss, sharedExistingWorkspaceCss, sharedSortableOwnershipCss, pageFactoryCss] = await Promise.all([
  read("src/lib/shared-visual-parity-contract.ts"),
  read("src/lib/shared-window-contract.ts"),
  read("src/lib/responsive-shell-contract.ts"),
  read("src/components/VisualResponsiveContract.tsx"),
  read("src/components/product-market/VisualPageEditorDock.tsx"),
  Promise.all([
    read("src/components/ResponsivePageHost.tsx"),
    read("src/components/ResponsivePageHostRuntime.tsx"),
  ]).then((sources) => sources.join("\n")),
  read("src/lib/layout-screenshot-regressions.ts"),
  read("src/components/product-market/DevelopmentStandardPanels.tsx"),
  read("src/pages/ProductMarket.tsx"),
  read("src/components/product-market/ProductMarketDevelopmentGuidePanel.tsx"),
  read("src/components/product-market/ProductMarketModulesPanel.tsx"),
  read("src/index.css"),
  read("src/components/AIServiceWidget.css"),
  read("e2e/shared-visual-parity.spec.ts"),
  read("e2e/global-responsive-deep.spec.ts"),
  read("src/lib/page-layout-overrides.ts"),
  read("src/lib/developer-global-frame-runtime.ts"),
  read("src/pages/ProductAnalysis.tsx"),
  read("src/pages/SocialMedia.tsx"),
  read("e2e/developer-global-frame-all-pages.spec.ts"),
  read("e2e/shared-live-surfaces.spec.ts"),
  read("src/shared-layout-style-card.css"),
  read("src/shared-existing-workspace-frame.css"),
  read("src/shared-sortable-ownership-contract.css"),
  read("src/page-factory/page-factory.css"),
]);
const productMarketDevelopmentSource = `${productMarket}\n${productMarketDevelopmentGuide}`;
const [globalThemeTokens, dialogPrimitive, alertDialogPrimitive, sheetPrimitive, commandPrimitive, aiChat, sidebar, factoryPage, sharedCardRegionContract] = await Promise.all([
  read("src/lib/global-theme-tokens.ts"),
  read("src/components/ui/dialog.tsx"),
  read("src/components/ui/alert-dialog.tsx"),
  read("src/components/ui/sheet.tsx"),
  read("src/components/ui/command.tsx"),
  read("src/pages/AIChat.tsx"),
  read("src/components/Sidebar.tsx"),
  read("src/page-factory/FactoryPage.tsx"),
  read("src/lib/shared-card-region-contract.ts"),
]);
const [customerServiceMaterialPicker, developmentStandardApplyConsole, productMarketThemeEditorDialog] = await Promise.all([
  read("src/components/product-market/CustomerServiceMaterialPickerDialog.tsx"),
  read("src/components/product-market/DevelopmentStandardApplyConsole.tsx"),
  read("src/components/product-market/ProductMarketThemeEditorDialog.tsx"),
]);

function requireAnchoredSelectionControls(source, anchor, expectedCount, label) {
  const matches = [...source.matchAll(new RegExp(anchor.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "gu"))];
  if (matches.length !== expectedCount) {
    throw new Error(`${label} expected ${expectedCount} registered controls but found ${matches.length}.`);
  }
  for (const match of matches) {
    const index = match.index || 0;
    const openingTag = source.slice(Math.max(0, source.lastIndexOf("<", index)), index + 640);
    for (const token of ['data-shared-selection-control="true"', "data-selected=", "aria-pressed="]) {
      if (!openingTag.includes(token)) throw new Error(`${label} is missing ${token} near ${anchor}.`);
    }
  }
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectSourceFiles(fullPath));
    else if (/\.(?:css|ts|tsx)$/u.test(entry.name)) files.push(fullPath);
  }
  return files;
}

const activeSourceFiles = await collectSourceFiles(resolve(root, "src"));
const legacyWindowRegionFiles = [];
for (const file of activeSourceFiles) {
  if ((await readFile(file, "utf8")).includes('data-shared-window-region="header"')) {
    legacyWindowRegionFiles.push(file);
  }
}
if (legacyWindowRegionFiles.length) {
  throw new Error(`Legacy shared window region \"header\" remains outside the central region registry: ${legacyWindowRegionFiles.join(", ")}`);
}

const sharedFooterRegionProps = sharedCardRegionContract.match(/footer:\s*\{[\s\S]*?\n\s*\},/u)?.[0] || "";
if (!sharedFooterRegionProps.includes('"data-shared-footer-region": "true"')
  || !sharedFooterRegionProps.includes('"data-shared-region-token-source"')) {
  throw new Error("Shared Layout Style footer must retain its dedicated shared region and token-source markers.");
}
if (sharedFooterRegionProps.includes('"data-responsive-shared-surface"')) {
  throw new Error("Shared Layout Style footer must not masquerade as a responsive shared-surface plugin.");
}
if (!responsiveContract.includes('ids: ["top", "title-1", "title-2", "table-header"]')) {
  throw new Error("Responsive shared-surface identities must remain the four plugin-owned live bands.");
}

for (const token of [
  '[role=\'dialog\']',
  '[role=\'alertdialog\']',
  '[aria-modal=\'true\']',
  'if (!registryId || !isSharedWindowRegistryBindingValid',
  "Shared window does not read the active page background, text or font tokens.",
  "SHARED_WINDOW_REGION_IDS",
]) {
  if (!contract.includes(token)) throw new Error(`Fail-closed shared-window runtime scan is missing: ${token}`);
}
for (const token of [
  'id: "generic-editor", label: "通用编辑器", kind: "editor"',
  'id: "command-palette", label: "命令面板", kind: "workbench"',
  'id: "mobile-navigation", label: "移动端导航", kind: "drawer"',
]) {
  if (!sharedWindowContract.includes(token)) throw new Error(`Shared-window registry entry is missing: ${token}`);
}
for (const token of [
  'data-shared-dialog-contract="generic-editor"',
  'data-shared-window-kind="editor"',
]) {
  if (dialogPrimitive.split(token).length < 3) throw new Error(`Dialog and draggable-dialog defaults are not centrally registered: ${token}`);
}
for (const token of [
  'data-shared-dialog-contract="mobile-navigation"',
  'data-shared-window-kind="drawer"',
  'data-shared-window-theme-projection="active-page"',
  'data-shared-window-region="topbar"',
  'data-shared-window-region="content"',
  'data-content-plugin-control="close"',
  'data-shared-window-close="true"',
]) {
  if (!sheetPrimitive.includes(token)) throw new Error(`Mobile Sheet does not use the central shared-window contract: ${token}`);
}
for (const token of [
  'data-shared-dialog-contract="save-confirmation"',
  'data-shared-window-kind="confirm"',
  'data-shared-window-theme-projection="active-page"',
  "<AlertDialogPrimitive.Cancel",
  "data-dialog-close",
  'data-content-plugin-control="close"',
  'data-shared-window-close="true"',
]) {
  if (!alertDialogPrimitive.includes(token)) throw new Error(`AlertDialog does not use the central shared-window contract: ${token}`);
}
for (const token of [
  "ownedSharedCloseControls",
  'sharedWindow.dataset.sharedWindowKind !== "loading"',
  "Shared window must own exactly one top-right shared close plugin.",
]) {
  if (!contract.includes(token)) throw new Error(`Fail-closed shared-window close gate is missing: ${token}`);
}
for (const [source, token, label] of [
  [commandPrimitive, 'data-shared-dialog-contract="command-palette"', "command palette registry"],
  [commandPrimitive, 'data-shared-window-kind="workbench"', "command palette kind"],
  [aiChat, 'data-shared-dialog-contract="save-confirmation"', "AI publish confirmation registry"],
  [aiChat, 'data-shared-window-kind="confirm"', "AI publish confirmation kind"],
  [sidebar, 'data-shared-window-close="true"', "Sidebar expert shared close"],
  [productMarket, 'data-shared-window-close="true"', "Product Market shared close"],
]) {
  if (!source.includes(token)) throw new Error(`${label} is missing: ${token}`);
}
for (const token of [
  "SHARED_SELECTION_SURFACE_CONTRACT",
  "isSharedSelectionSurfaceActive",
  "hasSharedSelectionSurfaceStateParity",
  'controlAttribute: "data-shared-selection-control"',
]) {
  if (!globalThemeTokens.includes(token) && !contract.includes(token)) throw new Error(`Shared selected-surface contract is missing: ${token}`);
}
requireAnchoredSelectionControls(customerServiceMaterialPicker, "data-customer-service-avatar-gender-filter=", 2, "Customer Service avatar material filters");
requireAnchoredSelectionControls(customerServiceMaterialPicker, "data-customer-service-audio-category=", 2, "Customer Service audio material filters");
requireAnchoredSelectionControls(developmentStandardApplyConsole, "data-development-standard-style-nav-item=", 1, "Developer top-level navigation");
requireAnchoredSelectionControls(productMarketThemeEditorDialog, "data-theme-editor-choice", 3, "Draft theme editor typography choices");
requireAnchoredSelectionControls(productMarket, "data-layout-global-font-choice=", 3, "Layout Style global typography choices");
for (const token of [
  'data-shared-window-theme-projection="draft-theme-preview"',
  "--tradepro-shared-selection-bg: var(--tradepro-panel-action-bg);",
  "--tradepro-shared-selection-text: var(--tradepro-panel-action-text);",
  "--tradepro-shared-selection-outline: var(--tradepro-panel-action-bg);",
  '[data-theme-editor-dialog] [data-theme-editor-choice][data-selected="true"]',
]) {
  if (!`${productMarketThemeEditorDialog}\n${css}`.includes(token)) throw new Error(`Draft theme editor shared selection projection is missing: ${token}`);
}
for (const token of [
  '#root#root .layout-global-font-buttons > button[data-layout-global-font-selected="true"]',
  "background-color: var(--pm-layout-font-choice-selected-bg, var(--tradepro-shared-selection-bg)) !important;",
  "color: var(--pm-layout-font-choice-selected-text, var(--tradepro-shared-selection-text)) !important;",
]) {
  if (!css.includes(token)) throw new Error(`Layout Style selected typography token projection is missing: ${token}`);
}
if (!sharedExistingWorkspaceCss.includes("box-shadow: var(--tradepro-layout-shadow, none) !important;")) {
  throw new Error("Existing-workspace table headers do not consume the shared layout shadow token.");
}
for (const token of [
  '[data-shared-sortable-card-rail][data-shared-service-section-large-card="true"]',
  "background-color: var(--tradepro-product-market-large-card-bg, var(--tradepro-panel-card-bg)) !important;",
]) {
  if (!sharedSortableOwnershipCss.includes(token)) throw new Error(`Customer Service resting large-card rail projection is missing: ${token}`);
}
for (const source of [e2e, contract]) {
  if (!source.includes("hasSingleSemanticDivider")) throw new Error("Layout sortable carrier must retain exactly one shared semantic divider.");
}
if (css.includes("--visual-responsive-dialog-width: 76rem") || customerServiceMaterialPicker.includes("sm:max-w-[76rem]")) {
  throw new Error("Customer Service material picker must not override the shared editor-wide geometry.");
}
if (productMarketThemeEditorDialog.includes("72rem") || productMarketThemeEditorDialog.includes("82vh")) {
  throw new Error("Product Market theme editor must not retain private geometry beside the shared editor-wide contract.");
}
for (const token of [
  'data-shared-dialog-contract="theme-editor"',
  'data-shared-window-size="editor-wide"',
  "max-h-[calc(100dvh-1rem)]",
  "max-w-[calc(100vw-1rem)]",
]) {
  if (!productMarketThemeEditorDialog.includes(token)) throw new Error(`Shared theme editor geometry registration is missing: ${token}`);
}
for (const token of [
  "--tradepro-shared-editor-wide-width",
  "legacyPrivateWidth",
  "expectedWidth",
  "themeEditorGeometry",
  "expectedHeight",
]) {
  if (!e2e.includes(token)) throw new Error(`Shared editor-wide dialog regression is missing: ${token}`);
}
for (const token of [
  'data-shared-selection-control="true"',
  "aria-pressed={csAvatarId === preset.id}",
  "aria-pressed={selectedAvatarSequenceMatch.animationStyle === option.value}",
]) {
  if (!productMarket.includes(token)) throw new Error(`Customer Service expert selection semantics are missing: ${token}`);
}
for (const token of [
  "Shared selection control does not synchronize data-selected with aria-pressed.",
  "animationOptions.evaluateAll",
  'item.getAttribute("aria-pressed") === item.getAttribute("data-selected")',
]) {
  if (!contract.includes(token) && !sharedLiveSurfacesE2e.includes(token)) throw new Error(`Shared selection state-parity gate is missing: ${token}`);
}
for (const token of [
  "通用编辑弹窗读取当前页面底色、字体和表单版色",
  "移动导航抽屉读取同一共享窗口契约和主题",
  "客服专家与提醒声音按共享选中态读取同一版色和字体",
  "素材筛选与开发器导航统一登记共享选中态",
  "版面与主题字体选项统一登记共享选中态",
  "attribute-only large and small card changes refresh the shared palette projection",
]) {
  if (!sharedLiveSurfacesE2e.includes(token)) throw new Error(`Shared window/selection browser regression is missing: ${token}`);
}
for (const token of [
  '[data-shared-dialog-contract="generic-editor"][data-shared-window-content="implicit"]',
  "--tradepro-panel-card-bg",
  "--tradepro-panel-card-text",
]) {
  if (!css.includes(token)) throw new Error(`Generic editor active-page theme projection is missing: ${token}`);
}
for (const token of [
  "Generic editor neutral copy does not read the active page text token.",
  "Generic editor form controls do not read the active page card background, text or font tokens.",
]) {
  if (!contract.includes(token)) throw new Error(`Generic editor runtime theme gate is missing: ${token}`);
}
if (!sharedCardRegionContract.includes("SHARED_LAYOUT_STYLE_CARD_REGION_DISCOVERY_MUTATION_ATTRIBUTES")) {
  throw new Error("Layout-style card regions are missing their central mutation attribute contract.");
}
for (const [source, owner, tokens] of [
  [factoryPage, "FactoryPage", ["SHARED_LAYOUT_STYLE_CARD_REGION_DISCOVERY_MUTATION_ATTRIBUTES", "projectedRegionAttributes", "projectedRegionValues", "attributeOldValue: true"]],
  [responsivePageHost, "ResponsivePageHost", ["SHARED_LAYOUT_STYLE_CARD_REGION_DISCOVERY_MUTATION_ATTRIBUTES", "projectedFactoryAttributes", "projectedFactoryValues", "attributeOldValue: true"]],
]) {
  for (const token of tokens) {
    if (!source.includes(token)) throw new Error(`${owner} does not consume the dynamic card-region contract: ${token}`);
  }
}

for (const token of [
  "--tradepro-shared-table-header-frame-height",
  "--tradepro-shared-table-header-height",
  "--tradepro-shared-table-header-width",
  "--tradepro-shared-table-header-justify",
  "--tradepro-shared-table-header-align",
  "--tradepro-shared-table-header-padding",
  "--tradepro-shared-table-header-gap",
  "--tradepro-shared-table-header-font-family",
  "--tradepro-shared-table-header-font-size",
  "--tradepro-shared-table-header-font-weight",
  "--tradepro-shared-table-header-line-height",
]) {
  if (!pageLayout.includes(token)) throw new Error(`Shared table-header default or migration token is missing: ${token}`);
}

for (const token of [
  "--tradepro-shared-table-header-gap",
  "--tradepro-shared-table-header-font-family",
  "--tradepro-shared-table-header-font-size",
  "--tradepro-shared-table-header-font-weight",
  "--tradepro-shared-table-header-line-height",
]) {
  if (!globalFrameRuntime.includes(token)) throw new Error(`Developer frame table-header projection is missing: ${token}`);
}

for (const source of [productAnalysis, socialMedia]) {
  for (const semantic of ['role="tablist"', 'role="tab"', "aria-selected", 'data-state={active ? "active" : "inactive"}']) {
    if (!source.includes(semantic)) throw new Error(`Shared table-header selection semantic is missing: ${semantic}`);
  }
}

for (const token of [
  "checkSharedTableHeaderContract",
  "checkRegionMarkerAccuracy",
  "region-marker:exposed-target-upper-bound",
  "table-header:shared-token:",
  "table-header:font-size-upper-bound",
  "table-header:navigation-nowrap",
  "table-header:selected-highlight",
  "shared-table-header-geometry-and-selection",
]) {
  if (!allPagesE2e.includes(token)) throw new Error(`All-pages table-header acceptance is missing: ${token}`);
}

for (const token of [
  "checkScrollbarGeometryAndSpacing",
  "scrollbar-geometry:single-reserve",
  "scrollbar-geometry:symmetric-frame-inset",
  "scrollbar-geometry:no-redundant-ancestor-gutter",
  "scrollbar-spacing:top",
  "scrollbar-spacing:bottom",
  "scrollbar-geometry-and-spacing",
]) {
  if (!allPagesE2e.includes(token)) throw new Error(`All-pages scrollbar geometry acceptance is missing: ${token}`);
}
for (const token of [
  "The host is only a clipping boundary",
  "scrollbar-gutter: auto !important",
  "--tradepro-shared-list-scroll-top-inset",
  "--tradepro-shared-list-scroll-end-space",
  ".app-main-roomy",
]) {
  if (!pageFactoryCss.includes(token)) throw new Error(`Page Factory scrollbar normalization is missing: ${token}`);
}

for (const token of [
  "the deepest hovered/focused frame is the only visible marker",
  '[data-shared-small-card-style-surface-effective="true"]',
  '[data-development-standard-frame-region]:not([data-development-standard-marker-visibility="always"]):has(',
  '[data-development-standard-marker="silent"]',
  '[data-development-standard-marker-representative="first-per-large-card"]',
  '[data-development-standard-marker-placement="card-left-top"]::after',
]) {
  if (!sharedCardCss.includes(token)) throw new Error(`Shared semantic hover arbitration is missing: ${token}`);
}

for (const token of [
  'plugin: "shared-context-marker-placement-v5"',
  "largeCardTopInset: 2",
]) {
  if (!responsiveContract.includes(token)) throw new Error(`Shared context-marker position contract is missing: ${token}`);
}
for (const token of [
  "--responsive-large-card-marker-top-inset",
  'data-development-standard-marker="silent"',
  'data-shared-small-card-marker-effective="silent"',
]) {
  if (!css.includes(token)) throw new Error(`Shared context-marker CSS bridge is missing: ${token}`);
}
for (const token of [
  'SHARED_SMALL_CARD_MARKER_CONTRACT_VERSION = "2026.08.26.2"',
  "SHARED_LARGE_CARD_REGION_SELECTOR",
  "SHARED_SMALL_CARD_MARKER_AUTOMATIC_SCOPE_SELECTOR = SHARED_LARGE_CARD_REGION_SELECTOR",
  "!element.matches(SHARED_LARGE_CARD_REGION_SELECTOR)",
  'SHARED_SMALL_CARD_EFFECTIVE_SCOPE_ATTRIBUTE = "data-shared-small-card-marker-scope-effective"',
  'SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE = "data-shared-small-card-style-surface-effective"',
  '"data-page-list-layout"',
  "isSharedSmallCardStyleSurface",
  "smallCardStyleSurfaceRuntimeAttribute: SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE",
  'SHARED_SMALL_CARD_MARKER_RESOLUTION = "first-real-card-surface-then-first-semantic-card"',
  'SHARED_SMALL_CARD_DISCOVERY_ADAPTERS = [',
  'isSharedSmallCardMarkerRealSurface',
  '?? candidates[0]',
  'smallCardMarkerSourceDeclarations: "central-effective-result-is-the-only-marker-ownership-truth"',
]) {
  if (!sharedWindowContract.includes(token)) throw new Error(`Global first-small-card marker contract is missing: ${token}`);
}
if (!sharedWindowContract.includes("SHARED_SMALL_CARD_DISCOVERY_MUTATION_ATTRIBUTES")) {
  throw new Error("Global first-small-card marker contract is missing its central mutation attribute list.");
}
for (const [source, owner] of [
  [visualResponsiveContract, "responsive marker synchronizer"],
  [visualEditorDock, "Visual developer observer"],
]) {
  for (const token of [
    "SHARED_SMALL_CARD_DISCOVERY_MUTATION_ATTRIBUTES",
    "attributeFilter: [...SHARED_SMALL_CARD_DISCOVERY_MUTATION_ATTRIBUTES]",
  ]) {
    if (!source.includes(token)) throw new Error(`${owner} does not consume the central marker mutation contract: ${token}`);
  }
}
for (const token of [
  "SHARED_DEVELOPER_LIVE_PREVIEW_MUTATION_ATTRIBUTES",
  "SHARED_DEVELOPER_LIVE_PREVIEW_DOCUMENT_THEME_MUTATION_ATTRIBUTES",
  '"aria-pressed"',
  '"data-selected"',
  '"data-product-market-batch-selected"',
  '"data-shared-theme-palette-state"',
]) {
  if (!sharedWindowContract.includes(token)) throw new Error(`Central Developer live-preview mutation contract is missing: ${token}`);
}
for (const token of [
  "SHARED_DEVELOPER_LIVE_PREVIEW_MUTATION_ATTRIBUTES",
  "attributeFilter: [...SHARED_DEVELOPER_LIVE_PREVIEW_MUTATION_ATTRIBUTES]",
  "SHARED_DEVELOPER_LIVE_PREVIEW_DOCUMENT_THEME_MUTATION_ATTRIBUTES",
  "livePreviewObserver.observe(document.documentElement",
]) {
  if (!visualEditorDock.includes(token)) throw new Error(`Visual developer live-preview observer is incomplete: ${token}`);
}
for (const token of [
  "attribute-only small-card discovery stays synchronized with the Developer",
  "selection and document theme mutations refresh Developer live previews",
  "Operations theme and batch selection use shared selected-control tokens",
  "Operations and Modules small cards read one shared Layout Style palette",
  "客服提醒声音在修改提醒音控件登记共享小卡片标注",
  "当前专家真人朗音自定义字段登记共享小卡片标注并在开发器中只显示首张代表",
  "开关客音与客服音效每个大卡片都只显示第一张小卡片标注",
  'not.toHaveAttribute("data-development-standard-marker")',
  "data-shared-window-small-card-surface-runtime-attribute",
  "data-page-list-layout",
  "large-card nodes are never registered as small-card targets",
  "representativeVisibleCount",
  "silentVisibleCount",
  "the Developer UI must not discover or annotate its own controls",
]) {
  if (!sharedLiveSurfacesE2e.includes(token)) throw new Error(`Shared marker/Developer browser regression is missing: ${token}`);
}
for (const token of [
  "SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE",
  "effectiveSmallCardSurfaceSelector",
  'surface.dataset.sharedLargeCardSurface === "true"',
]) {
  if (!contract.includes(token)) throw new Error(`Effective small-card parity scan is missing: ${token}`);
}
for (const token of [
  "SHARED_LARGE_CARD_REGION_SELECTOR",
  "SHARED_SMALL_CARD_CANDIDATE_DISCOVERY_SELECTOR",
  "region-marker:large-small-runtime-overlap",
  "dualLargeSmallTargets",
  "sharedSmallCardStyleSurfaceEffective",
]) {
  if (!allPagesE2e.includes(token)) throw new Error(`All-pages central marker selector regression is missing: ${token}`);
}
for (const token of [
  'data-current-expert-card-marker-scope="avatar-preview-first"',
  'data-current-expert-avatar-preview="true"',
  'data-development-standard-marker-placement="card-left-top"',
  'data-shared-small-card-surface="true"',
]) {
  if (!productMarket.includes(token)) throw new Error(`Current Expert avatar-preview marker contract is missing: ${token}`);
}
for (const token of [
  "currentExpertSmallCards",
  "currentExpertAvatarPreview",
  'developmentStandardMarkerPlacement !== "card-left-top"',
  'currentExpertCardMarkerScope !== "avatar-preview-first"',
  "左侧专家头像预览",
]) {
  if (!contract.includes(token)) throw new Error(`Current Expert marker parity scan is missing: ${token}`);
}
for (const token of [
  'data-customer-service-reminder-marker-scope="first-sound-card-left-top"',
  'data-customer-service-reminder-marker-anchor={soundIndex === 0 ? "first-sound-card-left-top" : undefined}',
  'data-development-standard-marker-placement={soundIndex === 0 ? "card-left-top" : undefined}',
  'data-shared-small-card-surface="true"',
]) {
  if (!productMarket.includes(token)) throw new Error(`Reminder-sound first-card marker contract is missing: ${token}`);
}
for (const token of [
  'data-customer-service-reminder-marker-scope="first-sound-card-left-top"',
  "customerServiceReminderMarkerAnchor",
  "左上第一张声音卡",
]) {
  if (!contract.includes(token)) throw new Error(`Reminder-sound marker parity scan is missing: ${token}`);
}
for (const token of [
  "SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE",
  "resolveSharedSmallCardMarkerRepresentative",
  'effectiveMarker === "representative"',
  "largeCardTopInset",
  "SHARED_SMALL_CARD_MARKER_SCOPE_SELECTOR",
  "SHARED_SMALL_CARD_EFFECTIVE_SCOPE_ATTRIBUTE",
  "SHARED_SMALL_CARD_ADAPTER_SCOPE",
]) {
  if (!contract.includes(token)) throw new Error(`Shared visual marker scan is missing: ${token}`);
}
if (css.includes('[data-development-standard-frame-region]:not([data-development-standard-marker-visibility="always"])::after {\n    display: none !important;')) {
  throw new Error("Viewport-height marker suppression must not hide cursor-addressable annotations");
}

for (const token of [
  "compact-popup-icon-centering-v1",
  "[data-ai-service-voice-playback]",
  "display: inline-flex !important",
  "align-items: center !important",
  "justify-content: center !important",
  "vertical-align: middle !important",
]) {
  if (!aiServiceCss.includes(token)) throw new Error(`Deferred popup icon centering contract is incomplete: ${token}`);
}

for (const factor of [
  "floating-service-safe-inset",
  "shared-gates",
  "semantic-regions",
  "single-scroll-owner",
  "table-shell-corners",
  "table-header-boundary",
  "card-radius",
  "card-elevation",
  "shared-typography",
  "plugin-geometry",
  "large-card-typography",
  "small-card-typography",
  "status-card-source",
  "sidebar-gradient-order",
  "font-choice-selection",
  "theme-palette-dual-tone",
  "context-markers",
  "responsive-vertical-budget",
  "responsive-learning-governance",
  "responsive-priority-ladder",
  "responsive-topbar-integrity",
  "responsive-page-tools-integrity",
  "responsive-function-key-consistency",
  "responsive-footer-capacity",
  "responsive-visual-launcher-safety",
  "responsive-drawer-integrity",
  "responsive-navigation-continuity",
  "responsive-scroll-containment",
  "responsive-global-page-host",
  "responsive-shared-live-surfaces",
]) {
  if (!contract.includes(`\"${factor}\"`)) throw new Error(`Shared visual parity factor is missing: ${factor}`);
}

for (const token of [
  "data-page-factory-region='title-1']:not([data-responsive-factory-title-one-fallback])",
  "data-responsive-factory-title-one-fallback",
  "data-development-standard-frame-region",
  "element.getAttribute(name) === value",
]) {
  if (!responsivePageHost.includes(token)) throw new Error(`Shared Title 1 host arbitration is missing: ${token}`);
}
for (const token of [
  "visibleTitleOneSurfaces",
  "data-responsive-semantic-band='page-context'",
  "页面自有标题1存在时不得再生成工作台补位标题",
]) {
  if (!contract.includes(token)) throw new Error(`Shared Title 1 uniqueness scan is missing: ${token}`);
}
for (const token of [
  "05 social workspaces inherit markers, scrolling and their declared responsive templates",
  "data-developer-global-frame-resolved-page-id",
  "data-responsive-factory-title-one-fallback",
]) {
  if (!globalResponsiveDeep.includes(token)) throw new Error(`Social Title 1 browser coverage is missing: ${token}`);
}

for (const token of [
  "SHARED_VISUAL_ALLOWED_DIFFERENCES",
  "SHARED_VISUAL_REFERENCE_DIFFERENCES",
  "inspectSharedVisualParity",
  "every-registered-page",
  "data-content-plugin-control^='status-'",
  "--tradepro-context-marker-font-family",
  "--tradepro-shared-large-card-font-size",
  "data-shared-large-card-text",
  "data-shared-floating-service-window",
  "--tradepro-shared-floating-service-safe-right",
  "data-layout-large-card-input",
  "data-shared-sidebar-expert-dialog",
  "data-content-plugin-control=\"close\"",
  "--tradepro-shared-small-card-font-size",
  "data-shared-small-card-text",
  "data-layout-fine-editor",
  "data-layout-fine-editor-contract",
  "data-layout-fine-controls",
  "data-layout-settings-pane",
  "data-shared-theme-palette-key",
  "data-shared-status-card-source",
  "data-service-theme-status",
  "data-service-shared-color-contract",
  "data-theme-editor-default-source",
  "data-layout-status-settings",
  "developmentStandardMarkerVisibility",
  "data-development-standard-frame-region",
  "developmentStandardMarkerPlacement",
  "data-responsive-topbar-disclosure-policy",
  "data-responsive-topbar-popover",
  "topbarDisclosure.strategy",
  "data-responsive-page-tools-policy",
  "data-responsive-toolbar-order-policy",
  "data-responsive-function-key-policy",
  "data-responsive-theme-palette-policy",
  "data-responsive-visual-launcher-policy",
  "data-responsive-visual-launcher-default-dock",
  "responsiveFooterActionOrder",
  "responsiveFooterLabelPolicy",
  "pageTools.strategy",
  "pageTools.triggerOrder",
  "pageTools.capacityPolicy",
  "functionKeys.strategy",
  "functionKeys.height",
  "sharedSurfaces.strategy",
  "themePalette.strategy",
  "sharedActions.strategy",
  "sharedInteractions.strategy",
  "visualLauncher.strategy",
  "visualLauncher.defaultDock",
  "footerActions.order",
  "footerActions.labelPolicy",
]) {
  if (!contract.includes(token)) throw new Error(`Shared visual parity contract token is missing: ${token}`);
}

for (const token of ['data-shared-theme-palette-policy="immutable-factory-preview"', 'data-shared-theme-palette-appearance="operations-theme-switch"', 'data-shared-theme-palette-appearance="expanded-theme-toggle"', 'data-shared-theme-palette-appearance="layout-chooser"']) {
  if (!productMarket.includes(token)) throw new Error(`Product Market immutable palette token is missing: ${token}`);
}
for (const token of [
  'data-shared-selection-control="true"',
  "data-selected={isActive}",
  "aria-pressed={isActive}",
]) {
  if (!productMarket.includes(token)) throw new Error(`Operations theme selected-control semantic is missing: ${token}`);
}

for (const token of ['strategy: "single-source-immutable-factory-preview"', 'runtimeOverride: "forbidden"', 'sharedContractRole: "validate-only"']) {
  if (!responsiveContract.includes(token)) throw new Error(`Responsive immutable palette token is missing: ${token}`);
}

for (const token of ['strategy: "footer-fixed-inline"', 'strategy: "measured-label-icon-wrap-before-save"', 'wrapPolicy: "labelled-inline>icon-inline>icon-wrapped"']) {
  if (!responsiveContract.includes(token)) throw new Error(`Responsive factory contract token is missing: ${token}`);
}
for (const token of ['sectionChrome: "content-only"', 'settingsFlow: "one-line-shrink-then-wrap"', 'settingsWrapPolicy: "intrinsic-after-fluid-shrink"', 'batchActionStyle: "large-table-header-parity"']) {
  if (!responsiveContract.includes(token)) throw new Error(`Responsive settings-flow factory token is missing: ${token}`);
}
for (const token of ['navigation: "左栏"', 'visual: "可视化"', 'strategy: "shared-function-key-plugin"', 'height: 36', 'labelledWidth: 88', 'contentGap: 4', 'measurementTolerance: 1', 'labelPolicy: "show-until-measured-overflow"', 'controlContentGap: 4', '["源码解", "页面解", "栏目解"]', '["源码锁", "页面锁", "栏目锁"]', 'saveSync: "保存"']) {
  if (!responsiveContract.includes(token)) throw new Error(`Shared function-key factory token is missing: ${token}`);
}

for (const token of [
  "inspectSharedVisualParity",
  "inspectRegisteredLayoutPages",
  "PAGE_FACTORY_PAGES.map",
  "REGISTERED_LAYOUT_SCAN_TARGETS",
  "buildRegisteredLayoutScanRoute",
  "factoryIdentity",
  "data-client-project-unavailable",
  "unavailable",
  "frame.sandbox.add",
]) {
  if (!runtimeScan.includes(token)) throw new Error(`Registered-page parity scan token is missing: ${token}`);
}

for (const token of [
  "data-shared-visual-parity-contract",
  "data-shared-visual-run-scan",
  "data-shared-visual-scan-result",
  "inspectRegisteredLayoutPages(REGISTERED_LAYOUT_SCAN_TARGETS",
  "REGISTERED_LAYOUT_SCAN_TARGETS.length",
  "SHARED_VISUAL_PARITY_FACTORS",
  "SHARED_VISUAL_REFERENCE_DIFFERENCES",
  "SHARED_VISUAL_ALLOWED_DIFFERENCES",
]) {
  if (!panel.includes(token)) throw new Error(`Development Specification parity UI is missing: ${token}`);
}
if (!productMarketDevelopmentSource.includes("<SharedVisualParityContractPanel />")) {
  throw new Error("Shared visual parity panel is not mounted in Development Specification.");
}
for (const token of [
  "const displayOrder = order ?? index + 1;",
  'sequence="ascending"',
  "ContentPluginIconSetting",
  'compact',
]) {
  if (!`${productMarket}\n${productMarketModules}`.includes(token)) throw new Error(`Ascending layout/service order bridge is missing: ${token}`);
}

for (const token of [
  "var(--tradepro-layout-shadow, none)",
  "data-product-market-card",
  "data-page-list-item",
  ":not([data-visual-card-runtime-shadow])",
  ":not([data-visual-card-runtime-radius])",
  "var(--tradepro-layout-card-radius, 0.75rem)",
  "var(--tradepro-layout-table-header-radius, 0.75rem)",
  "thead[data-page-table-header]::after",
  "thead[data-page-table-header]:hover > tr > th:first-child::after",
  "tr[data-development-standard-frame-region=\"large-card\"] > td:first-child::after",
  "--tradepro-large-card-marker-z-index",
  "--tradepro-shared-small-card-font-weight",
  "layout-section-card[data-development-standard-frame-region=\"large-card\"]",
  "data-development-standard-marker-visibility=\"always\"",
  "layout-section-two-pane--fine",
  "Fine layout colors are always paired",
  "新增主题” is a neutral starting template",
  "A named second-level title owns its own marker text",
  "--tradepro-shared-selection-bg",
  "data-layout-global-font-selected=\"true\"",
  "visual-shared-choice-select",
  "data-shared-category-rail",
  ".product-module-category-header-shell:hover [data-shared-category-rail]",
  "[data-service-shared-color-contract=\"true\"] [data-template-config-service-control=\"true\"]",
  "data-shared-service-section-large-card",
  "template-config-service-reminder-toolbar",
  "data-customer-service-expert-card",
  "data-customer-service-small-card-choice",
  "data-customer-service-animation-options",
  "data-customer-service-shared-toggle",
  "container-name: tradepro-expert-popup",
  "container-type: inline-size",
  'data-shared-scroll-contract="table-inner-60"',
  "--tradepro-shared-list-scroll-end-space: 3.75rem",
  "flex: 1 1 0 !important;",
  '[data-responsive-topbar-popover="anchored"]',
  "--responsive-topbar-popover-viewport-edge",
  "data-responsive-page-tools-projection",
  "data-shared-theme-palette-appearance=\"title-2-dual-tone\"",
  "data-responsive-page-tools-settings-flow",
  "data-responsive-batch-action-parity",
  "data-responsive-shared-surface",
  "data-responsive-shared-action-plugin",
  "data-responsive-shared-popover-plugin",
  "data-responsive-independent-tools",
  "data-responsive-toolbar-trigger",
  "--responsive-function-key-height",
  'data-responsive-function-key-plugin="shared"',
  "data-responsive-visual-launcher-dock",
  "data-responsive-visual-launcher-slot",
  "data-footer-primary-actions",
  "data-responsive-footer-lock-density",
  "--responsive-footer-control-content-gap",
  "product-market-card-control-contrast-v1",
  "[data-product-market-card-select] [role=\"checkbox\"]",
  '[data-product-market-card][data-product-market-batch-selected="true"]',
  "0 0 0 2px var(--tradepro-shared-selection-outline)",
  "background-color: var(--tradepro-shared-selection-bg) !important",
  "var(--product-market-card-name-color, currentColor)",
]) {
  if (!css.includes(token)) throw new Error(`Shared CSS bridge is missing: ${token}`);
}

for (const token of [
  "resolveVisibleTableHeaderEdgeCells",
  'surface.tagName === "THEAD"',
  "tableHeaderEdges.first",
  "tableHeaderEdges.last",
  "原生表头没有可见的边缘单元格",
]) {
  if (!contract.includes(token)) throw new Error(`Native table-header parity geometry is missing: ${token}`);
}
for (const token of [
  'thead[data-responsive-shared-surface="table-header"]',
  ":nth-child(1 of :not([hidden]):not(.hidden))",
  ":nth-last-child(1 of :not([hidden]):not(.hidden))",
]) {
  if (!css.includes(token)) throw new Error(`Native table-header edge-cell CSS is missing: ${token}`);
}
for (const token of [
  "visibleTableHeaderEdgeCells",
  "table-header visible edge cells missing",
  "edgeCells.first",
  "edgeCells.last",
]) {
  if (!e2e.includes(token)) throw new Error(`Native table-header edge-cell regression is missing: ${token}`);
}
for (const retiredCompactHeading of [">当前页面</h2>", ">标题 2 · 主题与版色</h2>", ">表头 · 批量操作</h2>"]) {
  if (productMarket.includes(retiredCompactHeading)) throw new Error(`Redundant compact page-tools heading has returned: ${retiredCompactHeading}`);
}
if (/box-shadow:\s*inset\s+0\s+1px\s+0\s+color-mix[\s\S]{0,180}data-page-list-item/.test(css)) {
  throw new Error("Legacy white inset card highlight has returned.");
}
for (const retiredSelector of [
  '#root [data-page-list] button {',
  ':is([data-page-layout-card], [data-page-list]) button:not([role="tab"])',
]) {
  if (css.includes(retiredSelector)) throw new Error(`Broad list button override has returned: ${retiredSelector}`);
}
for (const retiredModuleUi of ["function IconPicker(", "选择自定义图标素材"]) {
  if (productMarket.includes(retiredModuleUi)) throw new Error(`Retired module icon configuration UI has returned: ${retiredModuleUi}`);
}

for (const token of [
  "homepage-banner",
  "product-market-operations",
  "product-market-modules",
  "product-market-layout",
  "product-market-service",
  "data-client-project-unavailable",
  "private card shadow",
  "private card radius",
  "private table-header shadow",
  "unstable table-header hover",
  "plugin height",
  "large-card typography",
  "layout large-card typography",
  "missing layout large-card typography fields",
  "small-card typography",
  "missing shared fine-layout two-pane contract",
  "legacy fine settings frame",
  "missing fine-layout divider",
  "misaligned fine-layout panes",
  "layout theme palette mismatch",
  "operations theme palette mismatch",
  "new theme does not use neutral white black",
  "missing small-card typography fields",
  "missing context marker",
  "marker typography",
  "marker direction",
  "marker placement",
  "marker layer",
  "marker visibility",
  "missing layout status small-card marker",
  "data-banner-edit-enabled-plugin",
]) {
  if (!e2e.includes(token)) throw new Error(`Shared visual parity browser coverage is missing: ${token}`);
}

console.log("Shared visual parity contract passed: real card, plugin, scroll, typography and frame styles are registered and scan-ready.");
