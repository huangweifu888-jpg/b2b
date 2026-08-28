import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFile(resolve(root, file), "utf8");
const assertIncludes = (source, expected, label) => {
  if (!source.includes(expected)) throw new Error(`框架样式合同缺失：${label}`);
};

const [contract, overrides, css, developer, productMarket, sharedExistingFrameCss, sharedWorkspace, unifiedWorkbench, unifiedContract, socialMediaCss] = await Promise.all([
  read("src/lib/layout-frame-contract.ts"),
  read("src/lib/page-layout-overrides.ts"),
  read("src/index.css"),
  read("src/components/product-market/DevelopmentStandardApplyConsole.tsx"),
  read("src/pages/ProductMarket.tsx"),
  read("src/shared-existing-workspace-frame.css"),
  read("src/components/SharedPageWorkspace.tsx"),
  read("src/components/developer-platform/UnifiedFrameMigrationWorkbench.tsx"),
  read("src/lib/unified-page-frame-contract.ts"),
  read("src/pages/SocialMedia.css"),
]);

assertIncludes(contract, "THREE_SOURCE_GLOBAL_FRAME_CONTRACT", "three-source shared frame contract");
assertIncludes(contract, 'sourceScopes: ["hq", "agency_source", "client_source"]', "three source scopes");
assertIncludes(contract, 'scrollPolicy: "content-only"', "single content scroll owner policy");
assertIncludes(contract, 'releaseMode: "source-scoped"', "source-scoped release boundary");
assertIncludes(contract, 'unregisteredPagePolicy: "fail-closed"', "unregistered pages fail closed");
assertIncludes(contract, "regionSelectors: EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.regionSelectors", "shared canonical region selectors");
assertIncludes(contract, '[data-page-layout-footer][data-development-standard-frame-region="footer"]', "shared source footer selector");
assertIncludes(contract, '[data-visual-card-developer-launcher]', "shared source visual launcher selector");
for (const protectedOwner of ["structure", "content", "business-data", "assets", "plugins", "navigation"]) {
  assertIncludes(contract, `"${protectedOwner}"`, `protected page ownership ${protectedOwner}`);
}
for (const pageId of [
  "hq-product-market-operations",
  "agency-source-product-market-operations",
  "client-source-product-market-operations",
  "client-social-marketing-playbook",
]) {
  assertIncludes(contract, pageId, `three-source reference or pilot ${pageId}`);
}
const threeSourceRoomyScrollOwnerStart = css.indexOf(
  '#root .app-shell:is([data-platform-frame-scope="hq"], [data-platform-frame-scope="agency-source"])\n  .app-main-roomy:has(',
);
const threeSourceRoomyScrollOwnerEnd = css.indexOf(
  "\nhtml[data-tradepro-page-layout=\"active\"]",
  threeSourceRoomyScrollOwnerStart,
);
if (threeSourceRoomyScrollOwnerStart < 0 || threeSourceRoomyScrollOwnerEnd < 0) {
  throw new Error("frame style contract missing: HQ/Agency Source single-scroll existing-workspace rule");
}
const threeSourceRoomyScrollOwnerRule = css.slice(
  threeSourceRoomyScrollOwnerStart,
  threeSourceRoomyScrollOwnerEnd,
);
assertIncludes(threeSourceRoomyScrollOwnerRule, '[data-page-list-scroll-owner]', "canonical content scroll owner");
assertIncludes(threeSourceRoomyScrollOwnerRule, "overflow: hidden", "roomy shell second scroll owner disabled");
assertIncludes(threeSourceRoomyScrollOwnerRule, "scrollbar-gutter: auto", "roomy shell duplicate scrollbar lane disabled");

assertIncludes(contract, "SHARED_FRAME_STYLE_CONTRACT", "共享变量样式合同源");
assertIncludes(contract, "tableShell", "表内已登记为可见框架区域");
assertIncludes(contract, "styleOwner: \"shared\"", "表头与内容共享视觉归属");
assertIncludes(contract, "syncBoundary: \"style-only\"", "表头与内容样式同步边界");
assertIncludes(contract, "SHARED_STYLE_FRAME_SECTION_KEYS", "统一共享视觉区域清单");
assertIncludes(contract, "getLayoutFrameMarkerLabel", "共享标注读取器");
assertIncludes(contract, "VERTICAL_CONTEXT_CAPSULE_FRAME_SECTION_KEYS", "竖向上下文胶囊区域清单");
assertIncludes(contract, "VERTICAL_CONTEXT_CAPSULE_CONTRACT", "竖行上下结构化共享契约");
assertIncludes(contract, "EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT", "existing-workspace 版本化参考契约");
assertIncludes(contract, 'referencePageId: "product-market:operations"', "运营市场参考页面 ID");
assertIncludes(contract, 'referenceRoute: "/zb/client-source/product-market?tab=operations"', "运营市场参考路由");
assertIncludes(contract, 'version: "1.0.5"', "运营市场参考契约版本");
assertIncludes(contract, 'tableShellLeftInsetToken: "--responsive-table-shell-marker-left-inset"', "表内标注共享左偏移令牌");
assertIncludes(contract, ':not([data-responsive-shared-surface="title-2"])', "主标题契约排除独立标题 2 色板");
assertIncludes(contract, 'workspacePaintHostSelector: ":is(.app-main, .app-main-roomy)"', "主体外框唯一绘制宿主");
assertIncludes(contract, 'workspaceHitAreaAttribute: "data-existing-workspace-body-marker-hit-area"', "主体左外槽真实命中层");
assertIncludes(contract, "existingWorkspaceBodyMarkerHitAreaMatchesGeometry", "主体左外槽几何校验器");
assertIncludes(contract, "findExistingWorkspaceBodyMarkerHost", "主体语义节点到外框绘制宿主解析器");
assertIncludes(sharedWorkspace, "createPortal", "主体左外槽必须由共享工作区 portal 到外框宿主");
assertIncludes(sharedWorkspace, "new ResizeObserver(scheduleMeasure)", "主体左外槽必须随真实框架几何更新");
assertIncludes(sharedWorkspace, "EXISTING_WORKSPACE_BODY_MARKER_HIT_AREA_ATTRIBUTE", "共享工作区必须使用版本化主体命中属性");
assertIncludes(sharedWorkspace, "workspaceRect.left - hostRect.left", "主体左外槽宽度必须来自真实宿主与工作区边界");
assertIncludes(sharedExistingFrameCss, "--responsive-workspace-marker-min-host-gutter", "canonical existing-workspace 必须共享 640-1023 主体左槽最小宽度");
assertIncludes(contract, 'inlineStartToken: "--tradepro-shared-existing-workspace-footer-inline-start"', "existing-workspace 尾栏左侧内缩事实源");
assertIncludes(contract, 'inlineEndToken: "--tradepro-shared-existing-workspace-footer-inline-end"', "existing-workspace 尾栏右侧内缩事实源");
assertIncludes(css, "--tradepro-shared-existing-workspace-footer-inline-start", "existing-workspace 尾栏左侧内缩");
assertIncludes(css, "--tradepro-shared-existing-workspace-footer-inline-end", "existing-workspace 尾栏右侧内缩");
assertIncludes(css, "--visual-card-component-padding-left", "可视化尾栏内边距实时覆盖桥");
assertIncludes(css, "--developer-global-frame-footer-padding-right", "发布档案尾栏内边距桥");
const secondaryTitleMarkerRuleStart = css.indexOf('#root [data-development-standard-frame-region="title-2"]::after,');
const secondaryTitleMarkerRuleEnd = css.indexOf("\n}", secondaryTitleMarkerRuleStart);
if (secondaryTitleMarkerRuleStart < 0 || secondaryTitleMarkerRuleEnd < 0) {
  throw new Error("frame style contract missing: shared title-2 marker placement rule");
}
const secondaryTitleMarkerRule = css.slice(secondaryTitleMarkerRuleStart, secondaryTitleMarkerRuleEnd);
assertIncludes(secondaryTitleMarkerRule, "left: 0.5rem", "shared title-2 marker left inset");
assertIncludes(secondaryTitleMarkerRule, "right: auto", "shared title-2 marker right reset");
assertIncludes(css, '[data-development-standard-frame-region="title-2"],', "shared title-2 horizontal marker direction");
assertIncludes(sharedExistingFrameCss, '[data-page-factory-region="title-2"][data-development-standard-frame-region="title-2"]::after', "visual developer title-2 marker visibility");
assertIncludes(
  css,
  '[data-client-source-shell][data-responsive-shell="client-source"].app-shell',
  "客户源壳在全部断点保持唯一视口高度",
);
assertIncludes(css, "height: 100dvh;", "客户源尾栏不得落到视口外");
const footerTokenPublisherStart = css.indexOf(
  '#root :is([data-client-source-shell], [data-client-runtime-shell]):has(\n  [data-page-factory-frame-owner="existing-workspace"]',
);
const workspaceLayoutStart = css.indexOf(
  '\n#root [data-shared-page-workspace] {\n  box-sizing: border-box;',
  footerTokenPublisherStart,
);
if (footerTokenPublisherStart < 0 || workspaceLayoutStart < 0) {
  throw new Error("框架样式合同缺失：尾栏共享变量发布与工作区结构样式未分层。");
}
const footerTokenPublisher = css.slice(footerTokenPublisherStart, workspaceLayoutStart);
if (/^\s*(?:display|height|flex|flex-direction|overflow|background)\s*:/mu.test(footerTokenPublisher)) {
  throw new Error("框架样式合同缺失：尾栏变量发布器不得改写来源端 shell 的结构布局。");
}
if (css.includes(':has([data-social-media-workspace]) [data-client-page-footer]')
  || css.includes(':has([data-product-market-layout]) [data-client-page-footer]')) {
  throw new Error("框架样式合同缺失：尾栏对齐仍依赖 Social/ProductMarket 路由私有规则。");
}
if (sharedWorkspace.includes("data-shared-workspace-frame-hit-area")) {
  throw new Error("框架样式合同缺失：共享工作区仍渲染旧的框内四边命中层。");
}
if (css.includes(':has([data-product-market-layout] [data-page-factory-frame-owner="existing-workspace"])')) {
  throw new Error("框架样式合同缺失：主体左槽最小宽度仍由 Product Market 私有规则拥有。");
}
assertIncludes(contract, "tableShellPadding", "共享表内 padding token 基准");
assertIncludes(contract, "tableHeaderMinHeight", "共享表头高度 token 基准");
assertIncludes(contract, "contentPadding", "共享内容 padding token 基准");
assertIncludes(contract, "markerMode: \"vertical\"", "主体、表内和内容竖向胶囊归属");
assertIncludes(contract, "table-shell-entry-gap", "表内起始间距契约");
assertIncludes(contract, "任一特殊表头收起时仅表内外壳保留一层起始间距", "主题收起间距边界");
for (const token of [
  "竖行标注：主体必须使用主体外框左侧预留空白槽，禁止覆盖标题；表内、内容使用左侧竖行上下结构",
  "竖行契约保护：清理主体侵入标题内容、停在框内或使用右侧旧位的覆盖规则",
  "竖行标注：主体统一读取主体外框左侧预留空白槽且不得覆盖标题，表内、内容读取各自左侧竖行上下结构",
]) {
  assertIncludes(contract, token, `三工具学习规则 ${token}`);
}
assertIncludes(developer, "data-development-standard-vertical-marker-contract", "三端开发器消费竖行结构化契约");
assertIncludes(unifiedWorkbench, "data-unified-frame-migration-workbench", "开发器分层共享契约工作台");
assertIncludes(unifiedContract, 'regionStrategy: "explicit"', "开发器显式区域规则");
assertIncludes(unifiedContract, "pageVerticalOwners: 1", "开发器唯一正文滚动规则");
assertIncludes(unifiedContract, "geometryToleranceCssPixels: 1", "开发器主体标注几何误差规则");
assertIncludes(unifiedContract, 'mode: "batch-gated"', "开发器分批门禁规则");
assertIncludes(productMarket, "Object.freeze({", "主题色卡固定色值");
assertIncludes(productMarket, "const PRESET_THEME_SELECTION_COLORS = Object.freeze", "选择色调固定色卡来源");
assertIncludes(productMarket, "const fixedPreview = PRODUCT_MARKET_IMMUTABLE_THEME_PREVIEW_MAP", "选择色调固定色卡消费端");
for (const token of [
  'frameOwner="existing-workspace"',
  'data-development-standard-frame-region="body"',
  'data-development-standard-frame-region="title"',
  'data-development-standard-frame-region="table-shell"',
  'data-development-standard-frame-region="table-header"',
  'data-development-standard-frame-region="content"',
  'data-shared-scroll-contract="table-inner-60"',
]) {
  assertIncludes(productMarket, token, `运营市场 existing-workspace 兼容结构 ${token}`);
}
for (const token of [
  '[data-page-factory-frame-owner="existing-workspace"]',
  '[data-shared-page-workspace]',
  '[data-development-standard-frame-region="body"]',
  '[data-development-standard-frame-region="table-shell"]',
  '[data-development-standard-frame-region="table-header"]',
  '[data-shared-scroll-contract="table-inner-60"][data-page-list-scroll-owner][data-development-standard-frame-region="content"]',
  'html[data-visual-card-editor-open]',
  'content: attr(data-development-standard-frame-label) !important',
  'data-existing-workspace-body-marker-host',
  'data-existing-workspace-body-marker-hit-area="left"',
  'content: "主体"',
  'content: none !important',
  'overflow-y: auto !important',
  'scrollbar-gutter: stable',
]) {
  assertIncludes(sharedExistingFrameCss, token, `共享 existing-workspace canonical 样式 ${token}`);
}
if (sharedExistingFrameCss.includes("[data-social-") || sharedExistingFrameCss.includes("[data-product-market-")) {
  throw new Error("框架样式合同缺失：existing-workspace 兼容层仍依赖路由/业务私有选择器。");
}
if (sharedExistingFrameCss.includes("data-shared-workspace-frame-hit-area") || css.includes("data-shared-workspace-frame-hit-area")) {
  throw new Error("框架样式合同缺失：主体仍依赖工作区内部四边命中层。");
}
for (const token of [
  '[data-social-media-workspace]:not([data-page-factory-frame-owner="existing-workspace"])',
  '.app-main:has([data-product-market-layout]):not(:has([data-page-factory-frame-owner="existing-workspace"]))',
  '[data-shared-page-workspace]:not([data-page-factory-frame-owner="existing-workspace"])',
]) {
  assertIncludes(`${css}\n${socialMediaCss}`, token, `旧主体 hover 触发器必须排除 canonical existing-workspace：${token}`);
}
assertIncludes(contract, "table-shell-entry-gap", "开发器主题收起间距规则");
assertIncludes(css, '[data-responsive-factory-body-marker-hit-area="true"]:hover', "三端页面工厂主体只在真实外框命中条悬停时显示");
assertIncludes(css, "--responsive-factory-body-hit-left", "页面工厂主体命中条跟随真实外框左边线");
assertIncludes(css, ':has([data-responsive-factory-workspace-boundary="true"]) {', "普通页面 app-main 必须成为主体命中条定位根");
assertIncludes(css, "[data-development-standard-frame-region=\"content\"]::after", "内容上下结构共享样式");
assertIncludes(css, ".app-main-roomy", "总部端与代理源端主体标注宿主");
assertIncludes(css, "body-marker left outer gutter", "主体左侧预留槽工厂规则");
assertIncludes(css, "A collapsed special header leaves no visible header band", "主题收起单层间距样式");
assertIncludes(css, "#root [data-product-market-workspace] > [data-product-market-theme-section]", "运营市场标题 2 主题面板选择器");
assertIncludes(css, "background: var(--tradepro-shared-title-2-bg, var(--tradepro-panel-title-2-bg, var(--tradepro-panel-title-bg)));", "运营市场标题 2 读取版面风格底色");
assertIncludes(css, "color: var(--tradepro-shared-title-2-text, var(--tradepro-panel-title-2-text, var(--tradepro-panel-title-text)));", "运营市场标题 2 读取版面风格文字色");

const sharedWorkspaceMarkerRule = css.match(/\.app-main:has\(\[data-product-market-layout\]\)::after\s*\{([\s\S]*?)\n\}/u)?.[1] || "";
for (const token of [
  "--tradepro-vertical-context-marker-padding",
  "--tradepro-vertical-context-marker-font-family",
  "--tradepro-vertical-context-marker-font-size",
  "--tradepro-vertical-context-marker-font-weight",
  "--tradepro-vertical-context-marker-line-height",
  "--tradepro-vertical-context-marker-letter-spacing",
  "--tradepro-vertical-context-marker-writing-mode",
  "--tradepro-vertical-context-marker-text-orientation",
]) {
  assertIncludes(sharedWorkspaceMarkerRule, token, `主体标注共享读取 ${token}`);
}
assertIncludes(css, "content: none !important", "主体旧框内伪元素已停用");
assertIncludes(css, "--responsive-workspace-marker-left-inset", "主体左侧预留槽位置令牌");
assertIncludes(css, "--responsive-table-shell-marker-left-inset", "表内空白槽共享位置令牌");
if (contract.includes("body-right-safe-gutter") || contract.includes("right-safe-gutter")) {
  throw new Error("框架样式合同缺失：主体仍登记在右侧旧位");
}
if (/#root \[data-product-market-workspace\]\s+:is\(\s*\[data-development-standard-frame-region="body"\]/u.test(css)) {
  throw new Error("框架样式合同缺失：主体仍使用无法命中自身的旧后代选择器");
}
for (const token of [
  "--tradepro-shared-workspace-bg",
  "--tradepro-shared-workspace-text",
  "--tradepro-shared-workspace-scroll-track",
  "--tradepro-shared-scrollbar-thumb",
  "--tradepro-shared-list-scrollbar-lane",
]) {
  assertIncludes(contract, token, `合同声明 ${token}`);
  assertIncludes(overrides, token, `全局配置默认值 ${token}`);
}

assertIncludes(overrides, "LIVE_THEME_LAYOUT_VARIABLES", "活主题框架变量");
assertIncludes(overrides, "OPERATIONS_SCROLLPORT_DEFAULTS", "运营市场滚条基线");
assertIncludes(css, "Shared Variables owns exactly one right-workspace surface", "单一主体外框规则");
assertIncludes(css, "Scroll tracks are part of the workspace chrome", "滚条归属规则");
assertIncludes(css, ".product-market-scroll-list", "运营市场接入滚条合同");
assertIncludes(css, ".navigation-customization-panel .nav-matrix-body", "导航栏接入滚条合同");
assertIncludes(css, "Banner, Navigation Customization, Operations, Module Configuration, Layout", "六个页面接入同一真实滚动容器合同");
assertIncludes(css, "[data-page-list-scroll-owner]", "真实滚动容器共享标记");
assertIncludes(css, ".site-settings-redirect-list", "重定向接入滚条合同");
assertIncludes(css, "[data-client-project-content]", "普通业务页接入滚条合同");
assertIncludes(css, "--tradepro-template-card-edge-inset", "栏目配置标题/内容统一左边缘");
assertIncludes(css, "--tradepro-template-card-right-inset", "栏目配置标题/滚条统一右边缘");

console.log("框架样式合同通过：主体、标题边距与右侧滚条共享同一全局来源。");
