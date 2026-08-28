import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFile(resolve(root, file), "utf8");
const count = (source, token) => source.split(token).length - 1;

const assertIncludes = (source, expected, label) => {
  if (!source.includes(expected)) throw new Error(`产品市场清洁契约缺失：${label}`);
};

const assertExcludes = (source, retired, label) => {
  if (source.includes(retired)) throw new Error(`产品市场仍保留旧实现：${label}`);
};

const [contract, sharedWindowContract, developer, developerOptimization, productMarket, productMarketModules, productMarketModulesStyles, styles, factoryPage, sharedWorkspace, visualRegistry, sharedExistingFrameStyles] = await Promise.all([
  read("src/lib/layout-frame-contract.ts"),
  read("src/lib/shared-window-contract.ts"),
  read("src/components/product-market/DevelopmentStandardApplyConsole.tsx"),
  read("../shared/contracts/developer-optimization-contract.json"),
  read("src/pages/ProductMarket.tsx"),
  read("src/components/product-market/ProductMarketModulesPanel.tsx"),
  read("src/components/product-market/ProductMarketModulesPanel.css"),
  read("src/index.css"),
  read("src/page-factory/FactoryPage.tsx"),
  read("src/components/SharedPageWorkspace.tsx"),
  read("src/lib/visual-page-region-registry.ts"),
  read("src/shared-existing-workspace-frame.css"),
]);
const productMarketSurfaces = `${productMarket}\n${productMarketModules}`;
const productMarketStyles = `${styles}\n${productMarketModulesStyles}`;

for (const token of [
  "PRODUCT_MARKET_CLEANLINESS_PAGES",
  "PRODUCT_MARKET_PAGE_CLEANER_CHECKS",
  "PRODUCT_MARKET_CODE_REMOVER_CHECKS",
  "PRODUCT_MARKET_GLOBAL_STYLER_CHECKS",
  "PRODUCT_MARKET_DEVELOPER_TOOL_CONTRACTS",
  "VERTICAL_CONTEXT_CAPSULE_CONTRACT",
  "唯一框架归属：页面工厂、开发器、可视化和共享契约必须指向同一个 ProductMarketWorkspace",
  "重复页面工厂外壳：产品市场已有 SharedPageWorkspace 时",
  "框架归属模式：普通页由 factory-shell 承担框架",
  "运营市场",
  "栏目配置",
  "版面风格",
  "客服音效",
  "下游自定义、新增内容、业务数据和素材",
  "竖行标注：主体必须使用主体外框左侧预留空白槽，禁止覆盖标题；表内、内容使用左侧竖行上下结构",
  "竖行契约保护：清理主体侵入标题内容、停在框内或使用右侧旧位的覆盖规则",
  "竖行标注：主体统一读取主体外框左侧预留空白槽且不得覆盖标题，表内、内容读取各自左侧竖行上下结构",
]) {
  assertIncludes(contract, token, `共享合同源 ${token}`);
}

for (const token of [
  "UnifiedFrameMigrationWorkbench",
  "data-developer-active-footer-summary",
  "data-development-standard-page-factory-lifecycle",
  "data-development-standard-vertical-marker-contract",
]) {
  assertIncludes(developer, token, `开发器展示 ${token}`);
}
for (const token of ['"id": "visual-frame"', '"id": "page-factory"', '"id": "page-lock"']) {
  assertIncludes(developerOptimization, token, `开发器统一应用契约展示 ${token}`);
}
if (developer.includes("renderFactoryLifecycle") || developer.includes("data-global-frame-toggle-page-factory")) {
  throw new Error("01 全局框架器不得保留页面工厂嵌套入口。");
}

const tableShellCount = count(productMarketSurfaces, 'data-product-market-table-shell="true"');
if (tableShellCount !== 4) {
  throw new Error(`运营市场、栏目配置、版面风格、客服音效应各有一个表内框，当前找到 ${tableShellCount} 个。`);
}

for (const token of [
  'data-development-standard-frame-region="body"',
  'data-development-standard-frame-region="title"',
  'data-development-standard-frame-region="table-shell"',
  'data-development-standard-frame-region="table-header"',
  'data-development-standard-frame-region="content"',
  'data-development-standard-frame-region="large-card"',
  'data-development-standard-frame-region="small-card"',
  'data-product-market-layout-header-mode="palette"',
  'data-product-market-service-header-mode="audio"',
  'data-template-config-table-palette="true"',
  'data-template-config-service-header="true"',
]) {
  assertIncludes(productMarketSurfaces, token, `四页结构或特殊表头 ${token}`);
}

if (count(productMarket, 'frameOwner="existing-workspace"') !== 2) {
  throw new Error("产品市场主工作区与设置路由必须共同使用 existing-workspace，且不得扩大到素材页或普通弹窗。");
}
if (/<FactoryPage[^>]*>\s*<div\s+data-product-market-layout/u.test(productMarket)) {
  throw new Error("产品市场布局外仍存在额外 FactoryPage 可见外壳。");
}
for (const [source, token, label] of [
  [factoryPage, "@radix-ui/react-slot", "页面工厂 asChild 合并能力"],
  [factoryPage, "data-page-factory-frame-owner", "页面工厂框架归属标记"],
  [sharedWorkspace, "forwardRef<HTMLElement", "共享工作区 ref 透传"],
  [visualRegistry, "EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector", "可视化 canonical existing-workspace 主体选择器"],
]) {
  assertIncludes(source, token, label);
}
if (/page-factory-shell[^{}]*product-market|product-market[^{}]*page-factory-shell/u.test(productMarketStyles)) {
  throw new Error("产品市场不得通过 CSS 特例隐藏页面工厂重复外壳。");
}

for (const [retired, label] of [
  ["data-template-config-service-content=", "客服首卡重复内容语义"],
  ["data-template-config-list-marker={", "产品市场首卡冒充内容标注"],
  ['className="flex flex-col gap-5"', "客服私有 20px 卡片间距层"],
  ["px-3 pb-28 pt-3", "已被表内契约覆盖的旧滚动 utility"],
]) {
  assertExcludes(productMarket, retired, label);
}

assertExcludes(productMarketSurfaces, 'className="product-module-child-card rounded-xl border', "二级栏目重复外框");
for (const token of [
  "二级栏目本身只是左右两个真实胶囊的无框承载层",
  "#root [data-product-market-workspace] .product-module-child-card {",
  "border: 0 !important;",
]) {
  assertIncludes(productMarketStyles, token, `二级栏目无外框工厂契约 ${token}`);
}

for (const token of [
  "#root [data-product-market-table-shell] {",
  "--tradepro-shared-table-shell-bottom-radius",
  '> [data-shared-layout-section="list"]',
  "--tradepro-shared-scrollbar-thumb",
  "data-development-standard-frame-region=\"small-card\"",
  "[data-product-market-workspace][data-development-standard-frame-region=\"body\"]::after",
  '[data-page-factory-frame-owner="existing-workspace"]',
  "--responsive-workspace-marker-min-host-gutter",
  "--responsive-table-shell-marker-left-inset",
  "--responsive-large-card-marker-top-inset",
]) {
  assertIncludes(`${productMarketStyles}\n${productMarket}\n${productMarketModules}\n${sharedExistingFrameStyles}`, token, `共享表内或标注样式 ${token}`);
}

for (const token of [
  "SHARED_SMALL_CARD_MARKER_AUTOMATIC_SCOPE_SELECTOR",
  "SHARED_SMALL_CARD_MARKER_ADAPTER_SCOPE_SELECTOR",
  "SHARED_SMALL_CARD_MARKER_CANDIDATE_SELECTOR",
  "SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE",
  "SHARED_SMALL_CARD_EFFECTIVE_SCOPE_ATTRIBUTE",
]) {
  assertIncludes(sharedWindowContract, token, `Global first-small-card discovery and marker ${token}`);
}

const sharedWorkspaceMarkerRule = styles.match(/#root \[data-shared-page-workspace\]::after\s*\{([\s\S]*?)\n\}/u)?.[1] || "";
for (const token of [
  "--tradepro-vertical-context-marker-font-family",
  "--tradepro-vertical-context-marker-font-size",
  "--tradepro-vertical-context-marker-font-weight",
  "--tradepro-vertical-context-marker-line-height",
  "--tradepro-vertical-context-marker-letter-spacing",
  "--tradepro-vertical-context-marker-writing-mode",
  "--tradepro-vertical-context-marker-text-orientation",
]) {
  assertIncludes(sharedWorkspaceMarkerRule, token, `主体与表内、内容共用竖行字型 ${token}`);
}

if (/#root \[data-product-market-workspace\]\s+:is\(\s*\[data-development-standard-frame-region="body"\]/u.test(productMarketStyles)) {
  throw new Error("产品市场仍保留无法命中主体自身的旧竖排后代选择器。");
}

for (const token of [
  "layout-style-editor",
  "layout-section-theme-pane",
  "layout-section-theme-settings",
  "layout-section-table-header",
  "layout-section-matrix-actions",
  "layout-section-static-text",
  ':has([data-template-config-list-marker="true"]) [data-shared-layout-section="list"].nav-matrix-body::after',
  'body [data-product-market-workspace][data-product-market-settings-route="true"] [data-shared-layout-section="list"].nav-matrix-body:not(.product-module-matrix-body)',
]) {
  assertExcludes(productMarketStyles, token, `无消费方或已被表内规则取代的 CSS：${token}`);
}

if (!/#root \[data-product-market-table-shell\]:not\(:has\([\s\S]{0,240}data-template-config-service-header="true"[\s\S]{0,240}> \[data-shared-scroll-contract="table-inner-60"\][\s\S]{0,160}padding-top:\s*0\s*!important;/u.test(productMarketStyles)) {
  throw new Error("客服音效表头收起后缺少单层 12px 起始节距保护。");
}

for (const token of [
  "@media (min-width: 641px) and (max-height: 799px)",
  ".template-config-layout-theme-preset-grid",
  "grid-template-columns: repeat(8, minmax(0, 1fr)) !important;",
  "A short desktop viewport is not a phone.",
]) {
  assertIncludes(productMarketStyles, token, `矮屏桌面色板不得误用手机折叠规则：${token}`);
}

console.log("产品市场清洁契约通过：四页结构、旧覆盖清退、特殊表头保护与三个开发器规则清单均已验证。");
