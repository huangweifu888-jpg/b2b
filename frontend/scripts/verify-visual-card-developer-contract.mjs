import { readFileSync } from "node:fs";
import { build } from "esbuild";

const read = (file) => readFileSync(file, "utf8");
const dock = read("src/components/product-market/VisualPageEditorDock.tsx");
const launcher = read("src/components/product-market/VisualPageEditorLauncher.tsx");
const projectContractHost = read("src/components/product-market/VisualProjectContractHost.tsx");
const pageRegionRegistry = read("src/lib/visual-page-region-registry.ts");
const sharedWindowContract = read("src/lib/shared-window-contract.ts");
const layoutFrameContract = read("src/lib/layout-frame-contract.ts");
const componentLibrary = read("src/lib/visual-page-component-library.ts");
const responsiveContract = read("src/components/VisualResponsiveContract.tsx");
const visualResponsiveBootstrap = read("src/components/VisualResponsiveBootstrap.tsx");
const deferredShellRuntimeHosts = read("src/components/DeferredShellRuntimeHosts.tsx");
const shellRuntimeHosts = read("src/components/ShellRuntimeHosts.tsx");
const globalCss = read("src/index.css");
const hqLayout = read("src/components/HQLayout.tsx");
const agencySourceLayout = read("src/components/AgencySourceLayout.tsx");
const clientSourceLayout = read("src/components/ClientSourceLayout.tsx");
const agencyLayout = read("src/components/AgencyLayout.tsx");
const adminLayout = read("src/components/AdminLayout.tsx");
const companyInfo = read("src/pages/CompanyInfo.tsx");
const companyInfoDeferredPanels = read("src/pages/CompanyInfoDeferredPanels.tsx");
const legacyConsole = read("src/components/product-market/DevelopmentStandardApplyConsole.tsx");
const layoutContract = read("src/lib/visual-card-layout-contract.ts");
const componentStyleRuntime = read("src/lib/visual-card-component-style-runtime.ts");
const sharedStyleBridge = read("src/lib/visual-card-shared-style-bridge.ts");
const pluginRuntime = read("src/lib/visual-card-plugin-runtime.ts");
const pluginRegistry = read("src/lib/content-plugin-registry.ts");
const contentPluginControls = read("src/components/content-plugins/ContentPluginControls.tsx");
const productMarket = read("src/pages/ProductMarket.tsx");
const responsivePageHost = `${read("src/components/ResponsivePageHost.tsx")}\n${read("src/components/ResponsivePageHostRuntime.tsx")}`;
const responsiveSemanticPageTools = read("src/components/ResponsiveSemanticPageTools.tsx");
const sharedAdaptiveSurfaceCss = read("src/shared-adaptive-surface.css");
const productMarketSharedStyle = read("src/lib/product-market-shared-style.ts");
const templateLifecycle = read("src/lib/product-market-template-lifecycle-contract.ts");
const sharedProjectSyncContract = read("src/lib/shared-project-sync-contract.ts");
const developmentStandardPanels = read("src/components/product-market/DevelopmentStandardPanels.tsx");
const sharedLiveSurfacesE2e = read("e2e/shared-live-surfaces.spec.ts");
const allPagesE2e = read("e2e/developer-global-frame-all-pages.spec.ts");
const audit = read("src/lib/page-composition-audit.ts");
const productMarketStore = read("src/lib/product-market-store.ts");
const sourceTopbars = [
  read("src/components/HQLayout.tsx"),
  read("src/components/AgencySourceLayout.tsx"),
  read("src/components/ClientSourceLayout.tsx"),
];

const requireToken = (source, token, message) => {
  if (!source.includes(token)) throw new Error(`${message}: ${token}`);
};

const forbidToken = (source, token, message) => {
  if (source.includes(token)) throw new Error(`${message}: ${token}`);
};

const requireMatch = (source, pattern, message) => {
  const match = source.match(pattern);
  if (!match) throw new Error(message);
  return match;
};

requireToken(pageRegionRegistry, "EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector", "可视化区域发现必须优先 canonical existing-workspace 主体");
requireToken(layoutFrameContract, "findExistingWorkspaceBodyMarkerHost", "可视化开发器缺少主体外框绘制宿主事实源");
requireToken(dock, "EXISTING_WORKSPACE_BODY_MARKER_HOST_ATTRIBUTE", "可视化开发器未把主体标注设置窄范围同步到外框宿主");
requireToken(dock, ':not([data-existing-workspace-body-marker-host]):hover::after', "主体外框不得因为 app-main 内部任意 hover 而常亮");
requireMatch(
  layoutContract,
  /id:\s*"footer"[\s\S]*?structureLocked:\s*true,\s*sortable:\s*false,\s*collapsible:\s*false,[\s\S]*?allowedPlacements:\s*\["flow"\],\s*defaultPlacement:\s*"flow"/,
  "尾栏必须固定在唯一正常流位置，开发器不得收起或改成 sticky-end",
);

const REQUIRED_REGION_IDS = [
  "total-frame",
  "topbar",
  "workspace",
  "title",
  "table-shell",
  "table-header",
  "content",
  "large-card",
  "small-card",
  "footer",
];
const REQUIRED_EDITABLE_REGION_IDS = REQUIRED_REGION_IDS.slice(1);
const REQUIRED_GLOBAL_REGION_IDS = [
  "total-frame",
  "topbar",
  "workspace",
  "title",
  "table-shell",
  "footer",
];
const REQUIRED_PAGE_REGION_IDS = [
  "table-header",
  "content",
  "large-card",
  "small-card",
];
const REQUIRED_GLOBAL_SELECTION_IDS = [
  "total-frame",
  "topbar",
  "workspace",
  "footer",
  "title",
  "table-shell",
];
const REQUIRED_PAGE_SELECTION_IDS = [
  "table-header",
  "content",
  "large-card",
  "small-card",
];
const REQUIRED_CANARY_SELECTION_IDS = [
  "workspace",
  "title",
  "table-shell",
  "topbar",
  "footer",
  "total-frame",
];
const REQUIRED_PARAMETER_SECTION_IDS = [
  "basic",
  "components",
  "responsive",
  "spacing",
  "annotation",
  "surface",
  "typography",
  "border",
  "plugins",
];
const REQUIRED_COMPONENT_STYLE_FIELDS = [
  "spacing",
  "annotation",
  "surface",
  "typography",
  "border",
];
const REQUIRED_COMPONENT_PADDING_FIELDS = ["top", "right", "bottom", "left"];
const REQUIRED_COMPONENT_STYLE_NESTED_FIELDS = {
  spacing: ["padding", "gapPx"],
  annotation: ["visibility", "mode"],
  surface: ["backgroundRole", "textRole"],
  typography: ["familyRole", "sizePx", "weight", "lineHeight", "letterSpacingEm"],
  border: ["style", "widthPx", "colorRole", "radiusPx", "shadow"],
};
const REQUIRED_BACKGROUND_ROLES = ["surface", "muted", "primary", "secondary", "transparent"];
const REQUIRED_TEXT_ROLES = ["default", "muted", "on-primary", "on-secondary"];
const REQUIRED_BORDER_COLOR_ROLES = ["default", "muted", "primary", "secondary"];
const REQUIRED_ANNOTATION_VISIBILITIES = ["hover", "always", "hidden"];
const REQUIRED_ANNOTATION_MODES = ["inline", "vertical"];
const REQUIRED_FONT_FAMILY_ROLES = ["body", "heading", "mono"];
const REQUIRED_BORDER_STYLES = ["none", "solid", "dashed"];
const REQUIRED_SHADOW_ROLES = ["none", "sm", "md", "lg"];
const REQUIRED_PUBLISHED_NODE_FIELDS = [
  "id",
  "regionId",
  "parentId",
  "slot",
  "order",
  "collapsed",
  "placement",
  "stylePresetId",
  "pluginIds",
];
const REQUIRED_PUBLISHED_CONFIG_FIELDS = [
  "schemaVersion",
  "frameInsets",
  "nodes",
  "componentInstances",
  "componentStyles",
  "updatedAt",
];
const REQUIRED_PUBLISHED_COMPONENT_INSTANCE_FIELDS = [
  "id",
  "definitionId",
  "regionId",
  "applicationScope",
  "order",
];
const REQUIRED_NORMALIZED_CONFIG_FIELDS = [
  "schemaVersion",
  "frameInsets",
  "nodes",
  "componentStyles",
  "updatedAt",
];

function quotedValues(block) {
  return [...block.matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
}

function typePropertyNames(block) {
  return [...block.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*)\??:/gmu)].map((match) => match[1]);
}

function indentedTypePropertyNames(block, spaces) {
  const pattern = new RegExp(`^[ \\t]{${spaces}}([A-Za-z][A-Za-z0-9]*)\\??:`, "gmu");
  return [...block.matchAll(pattern)].map((match) => match[1]);
}

function requireExactValues(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}。实际：${JSON.stringify(actual)}；期望：${JSON.stringify(expected)}`);
  }
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function requireExactObjectKeys(value, expected, message) {
  requireCondition(value && typeof value === "object" && !Array.isArray(value), `${message}：目标不是对象`);
  requireExactValues(Object.keys(value).sort(), [...expected].sort(), message);
}

function requireDeepEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}。实际：${JSON.stringify(actual)}；期望：${JSON.stringify(expected)}`);
  }
}

function nestedStyleTypeBlock(source, property) {
  const pattern = new RegExp(`^  ${property}\\?: \\{([\\s\\S]*?)^  \\};`, "mu");
  return requireMatch(source, pattern, `组件样式契约缺少 ${property} 子对象。`)[1];
}

async function loadExecutableVisualCardContract() {
  const result = await build({
    stdin: {
      contents: [
        'export * from "./src/lib/visual-card-layout-contract.ts";',
        'export { applyVisualCardComponentStyleRuntime, clearVisualCardComponentStyleRuntime, VISUAL_CARD_REGION_THEME_CONTRACT } from "./src/lib/visual-card-component-style-runtime.ts";',
      ].join("\n"),
      loader: "ts",
      resolveDir: process.cwd(),
      sourcefile: "visual-card-contract-verifier-entry.ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    logLevel: "silent",
  });
  const source = result.outputFiles[0]?.text;
  requireCondition(source, "无法构建视觉卡片契约执行夹具。");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

async function loadExecutableSharedStyleBridge() {
  const result = await build({
    stdin: {
      contents: 'export { buildVisualCardSharedStylePatch, createDefaultVisualCardSharedStyleApplyPatch, normalizeVisualCardSharedColor, resolveVisualCardSharedRegionStyle, VISUAL_CARD_SHARED_REGION_STYLE_CONTRACT, VISUAL_CARD_SHARED_STYLE_EDITABLE_FIELDS, VISUAL_CARD_SHARED_STYLE_SURFACE_OWNER } from "./src/lib/visual-card-shared-style-bridge.ts";',
      loader: "ts",
      resolveDir: process.cwd(),
      sourcefile: "visual-card-shared-style-verifier-entry.ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    logLevel: "silent",
  });
  const source = result.outputFiles[0]?.text;
  requireCondition(source, "无法构建视觉卡片共享样式桥接执行夹具。");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

function createRuntimeTarget() {
  const attributes = new Map();
  const properties = new Map();
  return {
    attributes,
    properties,
    target: {
      setAttribute(name, value) { attributes.set(name, String(value)); },
      removeAttribute(name) { attributes.delete(name); },
      style: {
        setProperty(name, value) { properties.set(name, String(value)); },
        removeProperty(name) { properties.delete(name); },
        getPropertyValue(name) { return properties.get(name) || ""; },
      },
    },
  };
}

const regionIdBlock = requireMatch(
  layoutContract,
  /export const VISUAL_CARD_REGION_IDS = \[([\s\S]*?)\] as const;/u,
  "视觉布局契约缺少 VISUAL_CARD_REGION_IDS。",
)[1];
if (JSON.stringify(quotedValues(regionIdBlock)) !== JSON.stringify(REQUIRED_REGION_IDS)) {
  throw new Error("视觉布局必须且只能登记总框架加九类页面区域。");
}

const editableRegionBlock = requireMatch(
  layoutContract,
  /export const VISUAL_CARD_EDITABLE_REGION_IDS = \[([\s\S]*?)\] as const;/u,
  "视觉布局契约缺少九类可编辑区域。",
)[1];
if (JSON.stringify(quotedValues(editableRegionBlock)) !== JSON.stringify(REQUIRED_EDITABLE_REGION_IDS)) {
  throw new Error("固定开发器必须且只能编辑九类页面区域；总框架尺寸应归入外层框架。 ");
}
requireToken(layoutContract, "export const VISUAL_CARD_LAYOUT_SCHEMA_VERSION = 2 as const", "视觉卡片契约门禁必须跟随当前发布版本");
requireToken(layoutContract, "const LEGACY_VISUAL_CARD_LAYOUT_SCHEMA_VERSION = 1 as const", "视觉卡片契约升级后必须保留 v1 迁移兼容");
requireToken(layoutContract, "const LEGACY_COMPACT_FRAME_INSETS", "主体旧 8px 底边距必须通过精确迁移恢复共享契约");

const globalRegionBlock = requireMatch(
  layoutContract,
  /export const VISUAL_CARD_GLOBAL_REGION_IDS = \[([\s\S]*?)\] as const;/u,
  "视觉布局契约缺少全局同步区域白名单。",
)[1];
const pageRegionBlock = requireMatch(
  layoutContract,
  /export const VISUAL_CARD_PAGE_REGION_IDS = \[([\s\S]*?)\] as const;/u,
  "视觉布局契约缺少当前页面区域白名单。",
)[1];
const globalRegionIds = quotedValues(globalRegionBlock);
const pageRegionIds = quotedValues(pageRegionBlock);
requireExactValues(globalRegionIds, REQUIRED_GLOBAL_REGION_IDS, "全局同步区域白名单不正确");
requireExactValues(pageRegionIds, REQUIRED_PAGE_REGION_IDS, "当前页面区域白名单不正确");
const regionPartition = [...globalRegionIds, ...pageRegionIds];
if (new Set(regionPartition).size !== REQUIRED_REGION_IDS.length
  || REQUIRED_REGION_IDS.some((regionId) => !regionPartition.includes(regionId))) {
  throw new Error("全局与当前页面区域必须互斥，并完整覆盖总框架加九类页面区域。");
}

for (const token of [
  "VISUAL_CARD_REGION_CONTRACTS",
  "VisualCardLayoutConfig",
  "VisualCardLayoutNode",
  "VisualCardComponentInstance",
  "VisualCardEditableRegionId",
  "normalizeVisualCardLayout",
  "cloneVisualCardLayout",
  "mergeVisualCardLayoutForApplicationScope",
  "composeVisualCardLayout",
  "writeVisualCardPageOverride",
  "readVisualCardPageOverride",
  "VISUAL_CARD_DIRECT_APPLY_EVENT",
]) requireToken(layoutContract, token, "视觉卡片正式契约不完整");

const publishedNodeType = requireMatch(
  layoutContract,
  /export type VisualCardLayoutNode = \{([\s\S]*?)\n\};/u,
  "视觉布局契约缺少发布节点类型。",
)[1];
const publishedConfigType = requireMatch(
  layoutContract,
  /export type VisualCardLayoutConfig = \{([\s\S]*?)\n\};/u,
  "视觉布局契约缺少发布配置类型。",
)[1];
const publishedComponentInstanceType = requireMatch(
  layoutContract,
  /export type VisualCardComponentInstance = \{([\s\S]*?)\n\};/u,
  "视觉布局契约缺少发布组件实例类型。",
)[1];
requireExactValues(
  typePropertyNames(publishedNodeType),
  REQUIRED_PUBLISHED_NODE_FIELDS,
  "发布节点字段必须保持精确白名单，编辑器分栏状态不得进入节点",
);
requireExactValues(
  typePropertyNames(publishedConfigType),
  REQUIRED_PUBLISHED_CONFIG_FIELDS,
  "发布配置字段必须保持精确白名单，编辑器分栏状态不得进入配置",
);
requireExactValues(
  typePropertyNames(publishedComponentInstanceType),
  REQUIRED_PUBLISHED_COMPONENT_INSTANCE_FIELDS,
  "发布组件实例只能携带展示定义、区域、应用范围与顺序，不得携带业务数据或回调。",
);

const componentPaddingType = requireMatch(
  layoutContract,
  /export type VisualCardComponentPadding = \{([\s\S]*?)\n\};/u,
  "视觉布局契约缺少组件内边距类型。",
)[1];
const componentStyleType = requireMatch(
  layoutContract,
  /export type VisualCardComponentStyleOverrides = \{([\s\S]*?)\n\};/u,
  "视觉布局契约缺少 componentStyles 覆盖类型。",
)[1];
requireExactValues(
  typePropertyNames(componentPaddingType),
  REQUIRED_COMPONENT_PADDING_FIELDS,
  "组件内边距字段必须保持精确白名单",
);
requireExactValues(
  typePropertyNames(componentStyleType),
  REQUIRED_COMPONENT_STYLE_FIELDS,
  "componentStyles 顶层字段必须保持精确白名单",
);
requireToken(
  layoutContract,
  "export type VisualCardComponentStyles = Partial<Record<VisualCardRegionId, VisualCardComponentStyleOverrides>>;",
  "componentStyles 必须以正式区域 ID 为唯一键白名单",
);
const componentStyleNestedBlocks = Object.fromEntries(
  REQUIRED_COMPONENT_STYLE_FIELDS.map((property) => [property, nestedStyleTypeBlock(componentStyleType, property)]),
);
for (const [property, expected] of Object.entries(REQUIRED_COMPONENT_STYLE_NESTED_FIELDS)) {
  requireExactValues(
    indentedTypePropertyNames(componentStyleNestedBlocks[property], 4),
    expected,
    `componentStyles.${property} 字段必须保持精确白名单`,
  );
}
requireExactValues(
  quotedValues(requireMatch(componentStyleNestedBlocks.surface, /backgroundRole\?: ([^;]+);/u, "缺少背景语义角色。")[1]),
  REQUIRED_BACKGROUND_ROLES,
  "背景只能选择共享主题语义角色",
);
requireExactValues(
  quotedValues(requireMatch(componentStyleNestedBlocks.surface, /textRole\?: ([^;]+);/u, "缺少文字语义角色。")[1]),
  REQUIRED_TEXT_ROLES,
  "文字只能选择共享主题语义角色",
);
requireExactValues(
  quotedValues(requireMatch(componentStyleNestedBlocks.border, /colorRole\?: ([^;]+);/u, "缺少边框语义角色。")[1]),
  REQUIRED_BORDER_COLOR_ROLES,
  "边框只能选择共享主题语义角色",
);
requireExactValues(
  quotedValues(requireMatch(componentStyleNestedBlocks.annotation, /visibility\?: ([^;]+);/u, "缺少标注可见性枚举。")[1]),
  REQUIRED_ANNOTATION_VISIBILITIES,
  "标注可见性枚举不正确",
);
requireExactValues(
  quotedValues(requireMatch(componentStyleNestedBlocks.annotation, /mode\?: ([^;]+);/u, "缺少标注方向枚举。")[1]),
  REQUIRED_ANNOTATION_MODES,
  "标注方向枚举不正确",
);
requireExactValues(
  quotedValues(requireMatch(componentStyleNestedBlocks.typography, /familyRole\?: ([^;]+);/u, "缺少字体语义角色。")[1]),
  REQUIRED_FONT_FAMILY_ROLES,
  "字体只能选择共享字体语义角色",
);
requireExactValues(
  quotedValues(requireMatch(componentStyleNestedBlocks.border, /style\?: ([^;]+);/u, "缺少边框样式枚举。")[1]),
  REQUIRED_BORDER_STYLES,
  "边框样式枚举不正确",
);
requireExactValues(
  quotedValues(requireMatch(componentStyleNestedBlocks.border, /shadow\?: ([^;]+);/u, "缺少阴影语义角色。")[1]),
  REQUIRED_SHADOW_ROLES,
  "阴影只能选择共享语义角色",
);
requireToken(componentStyleNestedBlocks.typography, "weight?: 400 | 500 | 600 | 700", "字重必须保持离散安全白名单");
for (const forbidden of ["backgroundColor", "textColor", "borderColor", "colorHex", "cssColor"]) {
  forbidToken(componentStyleType, forbidden, "componentStyles 不得发布任意颜色值");
}
for (const token of [
  "normalizeVisualCardComponentStyles",
  "normalizeVisualCardComponentStyle",
  "normalizeComponentPadding",
  "normalizeOptionalNumber(value.spacing.gapPx, 0, 64)",
  "normalizeOptionalNumber(value.typography.sizePx, 8, 64)",
  "normalizeOptionalNumber(value.typography.lineHeight, 1, 2)",
  "normalizeOptionalNumber(value.typography.letterSpacingEm, -0.05, 0.2)",
  "normalizeOptionalNumber(value.border.widthPx, 0, 8)",
  "normalizeOptionalNumber(value.border.radiusPx, 0, 64)",
  'regionId !== "total-frame" && isRecord(value.annotation)',
  "const componentStyles = normalizeVisualCardComponentStyles(value.componentStyles)",
]) requireToken(layoutContract, token, "componentStyles 规范化、边界或总框架标注保护不完整");

const themeContractBlock = requireMatch(
  componentStyleRuntime,
  /export const VISUAL_CARD_REGION_THEME_CONTRACT:[\s\S]*?= \{([\s\S]*?)\n\};/u,
  "组件样式运行时缺少区域共享主题映射。",
)[1];
const mappedThemeRegionIds = [...themeContractBlock.matchAll(/^  (?:(?:"([^"]+)")|([a-z][a-z0-9-]*)): \{/gmu)]
  .map((match) => match[1] || match[2]);
requireExactValues(mappedThemeRegionIds, REQUIRED_REGION_IDS, "运行时共享主题映射必须精确覆盖十个区域");
for (const token of [
  "VISUAL_CARD_REGION_THEME_CONTRACT",
  "effectiveBackground",
  "effectiveText",
  "resolveBackgroundRole",
  "resolveTextRole",
  "resolveBorderRole",
  "resolveShadowRole",
  "COMPONENT_RUNTIME_ATTRIBUTES",
  "COMPONENT_RUNTIME_PROPERTIES",
  "applyVisualCardComponentStyleRuntime",
  "clearVisualCardComponentStyleRuntime",
]) requireToken(componentStyleRuntime, token, "组件样式运行时语义映射或清理不完整");

forbidToken(componentStyleRuntime, "THEME_RUNTIME_PROPERTIES", "运行时不得把共享契约变量加入局部写入或清理清单");
requireCondition(
  !/target\.style\.setProperty\(\s*(?:contract\.|["']--tradepro-(?:shared|product-market))/u.test(componentStyleRuntime),
  "运行时只能写 visual-card 专用变量，不得反写共享契约或产品市场主题变量",
);

const sharedStyleContractBlock = requireMatch(
  sharedStyleBridge,
  /export const VISUAL_CARD_SHARED_REGION_STYLE_CONTRACT = \{([\s\S]*?)\n\} as const satisfies/u,
  "可视化开发器缺少共享样式十区域桥接。",
)[1];
const mappedSharedStyleRegionIds = [...sharedStyleContractBlock.matchAll(/^  (?:(?:"([^"]+)")|([a-z][a-z0-9-]*)): \{/gmu)]
  .map((match) => match[1] || match[2]);
requireExactValues(mappedSharedStyleRegionIds, REQUIRED_REGION_IDS, "共享样式桥接必须精确覆盖十个区域");
for (const token of [
  "resolveVisualCardSharedRegionStyle",
  "buildVisualCardSharedStylePatch",
  "normalizeVisualCardSharedColor",
  'boundary: "global-layout-style"',
  'boundary: "current-page-appearance"',
  "resolveAccessibleTextColor",
  "rejectedFields",
  "VISUAL_CARD_SAFE_FONT_FAMILIES",
  "VISUAL_CARD_SAFE_FONT_WEIGHTS",
  "VISUAL_CARD_SAFE_LETTER_SPACINGS",
  "VISUAL_CARD_SHARED_STYLE_EDITABLE_FIELDS",
  "VISUAL_CARD_SHARED_STYLE_SURFACE_OWNER",
  '"total-frame": ["cornerRadius", "density", "elevation"]',
  '"total-frame": "workspace"',
]) requireToken(sharedStyleBridge, token, "共享样式读取、写入边界、对比度或白名单不完整");
for (const token of [
  "data-visual-card-shared-style",
  "data-visual-card-shared-background",
  "data-visual-card-shared-text",
  "data-visual-card-shared-style-preview",
  "buildVisualCardSharedStylePatch",
  "resolveVisualCardSharedRegionStyle",
  "resolveGlobalThemeTokens",
  "sharedStylePatch",
  "sharedStyleDirty",
]) requireToken(dock, token, "固定开发器未真实接入共享样式读取、预览或保存");
for (const token of [
  'data-visual-card-shared-contract="frame-density"',
  'data-visual-card-shared-contract="table-shell-top-corners"',
  'data-visual-card-shared-contract={field}',
  'data-visual-card-shared-contract="frame-elevation"',
  '"frameCornerRadius" | "tableHeaderCornerRadius" | "cardCornerRadius" | "frameDensity" | "frameElevation"',
  '"主体圆角"',
  '"表头圆角"',
  '"卡片圆角"',
  '>统一间距<',
  '>轻量 3D<',
  "updateSharedGeometry",
]) requireToken(dock, token, "共享几何契约必须集中在可视化总框架的对应参数中");
for (const token of [
  "FRAME_CORNER_OPTIONS",
  "FRAME_DENSITY_OPTIONS",
  "FRAME_ELEVATION_OPTIONS",
  "updateFineLayout({ frameCornerRadius",
  "updateFineLayout({ tableHeaderCornerRadius",
  "updateFineLayout({ cardCornerRadius",
  "updateFineLayout({ frameDensity",
  "updateFineLayout({ frameElevation",
]) forbidToken(productMarket, token, "版面风格右侧栏不得重复承载已迁入可视化的共享几何契约");
for (const token of [
  "sharedStylePatch",
  "sharedStylePatch.layoutStyle",
  "sharedStylePatch.globalTypography",
  "writeSharedVisualContract: true",
  "writeSharedVisualContractSettings(nextConfig)",
]) requireToken(productMarket, token, "产品市场未把可视化共享样式写回正式保存链路");

for (const token of [
  "applyVisualCardPluginRuntime",
  "inspectVisualCardPluginRuntime",
  "belongsToPluginScope",
  "data-content-plugin-owner-region",
  "SCROLL_OWNER_SELECTOR",
  ':not(:has([data-visual-card-plugin-applied~="hover"]',
  "当前区域未找到页面已注册的真实业务能力",
]) requireToken(pluginRuntime, token, "真实插件运行时、区域隔离或不可用状态不完整");
for (const forbidden of [
  'input[type="search"]',
  'input[aria-label*=',
  'input[placeholder*=',
  'button[aria-label*=',
  'button[title*=',
  '[data-visual-card-layout-version]',
]) forbidToken(pluginRuntime, forbidden, "插件能力不得靠宽泛 DOM 猜测或把布局 schema 冒充发布版本");

const executableContract = await loadExecutableVisualCardContract();
const {
  VISUAL_CARD_LAYOUT_SCHEMA_VERSION: executableSchemaVersion,
  VISUAL_CARD_REGION_THEME_CONTRACT: executableThemeContract,
  applyVisualCardComponentStyleRuntime,
  clearVisualCardComponentStyleRuntime,
  cloneVisualCardLayout: executableCloneLayout,
  composeVisualCardLayout: executableComposeLayout,
  createDefaultVisualCardLayout: executableCreateDefaultLayout,
  mergeVisualCardLayoutForApplicationScope: executableMergeLayout,
  normalizeVisualCardLayout: executableNormalizeLayout,
} = executableContract;
requireCondition(executableSchemaVersion === 2, "可执行视觉卡片契约版本必须为 v2。");

const executableDefault = executableCreateDefaultLayout();
const expectedDefaultPlugins = {
  "total-frame": ["responsive"],
  topbar: [],
  workspace: ["responsive"],
  title: [],
  "table-shell": [],
  "table-header": [],
  content: [],
  "large-card": [],
  "small-card": [],
  footer: [],
};
for (const regionId of REQUIRED_REGION_IDS) {
  requireDeepEqual(
    executableDefault.nodes.find((node) => node.regionId === regionId)?.pluginIds,
    expectedDefaultPlugins[regionId],
    `${regionId} 默认布局只能启用无需业务回调且有真实承载的插件`,
  );
}
requireDeepEqual(
  executableDefault.frameInsets,
  { top: 12, right: 12, bottom: 60, left: 12 },
  "总框架默认上下左右间距必须与共享契约一致",
);
const migratedCompactFrame = executableNormalizeLayout({
  ...executableDefault,
  frameInsets: { top: 12, right: 12, bottom: 8, left: 12 },
});
requireDeepEqual(
  migratedCompactFrame.frameInsets,
  executableDefault.frameInsets,
  "旧 12/12/8/12 主体间距必须迁移为共享 12/12/60/12 契约",
);
const normalizedLegacyFooterLayout = executableNormalizeLayout({
  ...executableDefault,
  nodes: executableDefault.nodes.map((node) => node.regionId === "footer"
    ? { ...node, collapsed: true, placement: "sticky-end", fixed: true }
    : node),
});
const normalizedLegacyFooter = normalizedLegacyFooterLayout.nodes.find((node) => node.regionId === "footer");
requireCondition(
  normalizedLegacyFooter?.collapsed === false && normalizedLegacyFooter?.placement === "flow",
  "旧尾栏 collapsed/sticky-end/fixed 配置必须自动收敛到固定显示的正常流尾栏",
);
const preservedCustomFrame = executableNormalizeLayout({
  ...executableDefault,
  frameInsets: { top: 12, right: 13, bottom: 8, left: 12 },
});
requireDeepEqual(
  preservedCustomFrame.frameInsets,
  { top: 12, right: 13, bottom: 8, left: 12 },
  "非旧默认组合的用户自定义主体间距不得被迁移覆盖",
);
const legacyUpdatedAt = "2025-06-01T02:03:04.000Z";
const legacyInput = {
  ...executableDefault,
  schemaVersion: 1,
  frameInsets: { top: 7, right: 8, bottom: 9, left: 10 },
  nodes: executableDefault.nodes.map((node) => node.regionId === "topbar"
    ? {
      ...node,
      collapsed: true,
      placement: "sticky-start",
      stylePresetId: "accent",
      pluginIds: ["search", "help"],
      editorCollapsed: true,
    }
    : node),
  updatedAt: legacyUpdatedAt,
  selectedRegionId: "topbar",
  windowRect: { left: 1, top: 2, width: 216, height: 700 },
};
delete legacyInput.componentStyles;
const migratedLayout = executableNormalizeLayout(legacyInput);
requireCondition(migratedLayout.schemaVersion === 2, "v1 布局必须迁移为 v2。");
requireDeepEqual(migratedLayout.frameInsets, legacyInput.frameInsets, "v1→v2 必须保留总框架尺寸");
requireCondition(migratedLayout.updatedAt === legacyUpdatedAt, "v1→v2 必须保留有效更新时间。");
const migratedTopbar = migratedLayout.nodes.find((node) => node.regionId === "topbar");
requireCondition(
  migratedTopbar?.collapsed === true
    && migratedTopbar.placement === "sticky-start"
    && migratedTopbar.stylePresetId === "accent"
    && JSON.stringify(migratedTopbar.pluginIds) === JSON.stringify(["search", "help"]),
  "v1→v2 必须保留节点的收起、位置、风格和插件。",
);
requireExactObjectKeys(migratedTopbar, REQUIRED_PUBLISHED_NODE_FIELDS, "迁移后的节点不得包含编辑器状态");
requireCondition(!("selectedRegionId" in migratedLayout) && !("windowRect" in migratedLayout), "迁移不得把编辑器 UI 状态带入发布配置。");

const styledLayout = executableNormalizeLayout({
  ...executableDefault,
  activeApplicationScope: "global",
  dirty: true,
  componentStyles: {
    "total-frame": {
      spacing: {
        padding: { top: -4, right: 120, bottom: 1.23456, left: Number.NaN, rogue: 1 },
        gapPx: 120,
        rogue: true,
      },
      annotation: { visibility: "always", mode: "vertical" },
      surface: { backgroundRole: "primary", textRole: "on-primary", backgroundColor: "#ffffff" },
      typography: { familyRole: "mono", sizePx: 100, weight: 450, lineHeight: 3, letterSpacingEm: -1, rogue: true },
      border: { style: "dashed", widthPx: 12, colorRole: "secondary", radiusPx: -2, shadow: "lg", borderColor: "#ffffff" },
      rogue: { value: true },
    },
    topbar: {
      spacing: { gapPx: -1 },
      annotation: { visibility: "hover", mode: "inline", rogue: true },
      typography: { sizePx: 2, weight: 700, lineHeight: 0, letterSpacingEm: 1 },
      border: { widthPx: -4, radiusPx: 100 },
    },
    content: {
      spacing: { padding: { top: "8" } },
      annotation: { visibility: "sometimes", mode: "diagonal" },
      surface: { backgroundRole: "neon", textRole: "raw", backgroundColor: "#ff00ff" },
      typography: { familyRole: "comic", sizePx: "12", weight: 900 },
      border: { style: "double", colorRole: "#fff", shadow: "xl" },
    },
    "not-a-region": { surface: { backgroundRole: "primary" } },
  },
});
requireExactObjectKeys(styledLayout, REQUIRED_NORMALIZED_CONFIG_FIELDS, "无组件实例的规范化 v2 配置字段不精确");
requireExactValues(Object.keys(styledLayout.componentStyles), ["total-frame", "topbar"], "非法区域或空样式必须从 componentStyles 清理");
const frameStyle = styledLayout.componentStyles["total-frame"];
const topbarStyle = styledLayout.componentStyles.topbar;
requireExactObjectKeys(frameStyle, ["spacing", "surface", "typography", "border"], "总框架样式必须拒绝标注及未知分组");
requireExactObjectKeys(frameStyle.spacing, ["padding", "gapPx"], "间距字段清理失败");
requireDeepEqual(frameStyle.spacing.padding, { top: 0, right: 96, bottom: 1.235 }, "四边内边距必须限制在 0–96 并保留三位小数");
requireCondition(frameStyle.spacing.gapPx === 64, "组件间距必须限制在 0–64。");
requireDeepEqual(frameStyle.surface, { backgroundRole: "primary", textRole: "on-primary" }, "表面样式必须只保留语义角色");
requireDeepEqual(
  frameStyle.typography,
  { familyRole: "mono", sizePx: 64, lineHeight: 2, letterSpacingEm: -0.05 },
  "字体边界、非法字重或未知字段清理失败",
);
requireDeepEqual(
  frameStyle.border,
  { style: "dashed", widthPx: 8, colorRole: "secondary", radiusPx: 0, shadow: "lg" },
  "边框边界、语义角色或未知字段清理失败",
);
requireDeepEqual(topbarStyle.spacing, { gapPx: 0 }, "负组件间距必须收敛到 0。");
requireDeepEqual(topbarStyle.annotation, { visibility: "hover", mode: "inline" }, "合法区域标注必须保留且清理未知字段");
requireDeepEqual(topbarStyle.typography, { sizePx: 8, weight: 700, lineHeight: 1, letterSpacingEm: 0.2 }, "字体下界或上界清理失败");
requireDeepEqual(topbarStyle.border, { widthPx: 0, radiusPx: 64 }, "边框数值下界或上界清理失败");

const clonedStyledLayout = executableCloneLayout(styledLayout);
requireDeepEqual(clonedStyledLayout, styledLayout, "clone 必须完整保留 componentStyles");
requireCondition(clonedStyledLayout !== styledLayout && clonedStyledLayout.componentStyles !== styledLayout.componentStyles, "clone 必须返回独立的组件样式对象。");
clonedStyledLayout.componentStyles.topbar.spacing.gapPx = 12;
requireCondition(styledLayout.componentStyles.topbar.spacing.gapPx === 0, "clone 后修改组件样式不得污染原配置。");

const globalBaseLayout = executableNormalizeLayout({
  ...executableDefault,
  frameInsets: { top: 11, right: 12, bottom: 13, left: 14 },
  componentStyles: {
    topbar: { surface: { backgroundRole: "surface" } },
    content: { surface: { backgroundRole: "muted" } },
    "large-card": { border: { shadow: "sm" } },
  },
});
const incomingLayout = executableNormalizeLayout({
  ...executableDefault,
  frameInsets: { top: 27, right: 28, bottom: 29, left: 30 },
  componentStyles: {
    topbar: { surface: { backgroundRole: "primary" } },
    content: { surface: { backgroundRole: "secondary" } },
    "small-card": { border: { shadow: "lg" } },
  },
});
const globalMergedLayout = executableMergeLayout(globalBaseLayout, incomingLayout, "global");
requireCondition(globalMergedLayout.frameInsets.top === 27, "全局合并必须采用传入总框架尺寸。");
requireCondition(globalMergedLayout.componentStyles.topbar.surface.backgroundRole === "primary", "全局合并必须采用传入全局区域样式。");
requireCondition(globalMergedLayout.componentStyles.content.surface.backgroundRole === "muted", "全局合并不得覆盖基础页面区域样式。");
const pageMergedLayout = executableMergeLayout(globalBaseLayout, incomingLayout, "current-page");
requireCondition(pageMergedLayout.frameInsets.top === 11, "当前页合并不得覆盖全局总框架尺寸。");
requireCondition(pageMergedLayout.componentStyles.topbar.surface.backgroundRole === "surface", "当前页合并不得覆盖基础全局区域样式。");
requireCondition(pageMergedLayout.componentStyles.content.surface.backgroundRole === "secondary", "当前页合并必须采用传入页面区域样式。");
const composedLayout = executableComposeLayout(globalBaseLayout, incomingLayout);
const componentInstanceLayout = executableNormalizeLayout({
  ...executableDefault,
  componentInstances: [
    { id: "component:title-accent:global", definitionId: "title-accent", regionId: "title", applicationScope: "global", order: 9, businessData: { forbidden: true } },
    { id: "component:title-soft:page", definitionId: "title-soft", regionId: "title", applicationScope: "current-page", order: 3, callback: "forbidden" },
    { id: "component:invalid-region", definitionId: "title-soft", regionId: "footer", applicationScope: "current-page", order: 1 },
    { id: "bad id", definitionId: "title-soft", regionId: "title", applicationScope: "current-page", order: 1 },
  ],
});
requireCondition(componentInstanceLayout.componentInstances.length === 2, "component instances must reject invalid ids and non-addable regions");
componentInstanceLayout.componentInstances.forEach((instance) => requireExactObjectKeys(
  instance,
  REQUIRED_PUBLISHED_COMPONENT_INSTANCE_FIELDS,
  "component instances must not publish business data or callbacks",
));
const globalInstanceLayout = executableMergeLayout(executableDefault, componentInstanceLayout, "global");
requireDeepEqual(
  globalInstanceLayout.componentInstances.map((instance) => instance.id),
  ["component:title-accent:global"],
  "global apply must publish only global component instances",
);
const composedInstanceLayout = executableMergeLayout(globalInstanceLayout, componentInstanceLayout, "current-page");
requireDeepEqual(
  composedInstanceLayout.componentInstances.map((instance) => instance.id),
  ["component:title-accent:global", "component:title-soft:page"],
  "current-page apply must compose page instances without replacing global instances",
);
requireCondition(composedLayout.componentStyles.topbar.surface.backgroundRole === "surface", "compose 必须保留全局区域样式。");
requireCondition(composedLayout.componentStyles.content.surface.backgroundRole === "secondary", "compose 必须叠加当前页面区域样式。");
requireCondition(composedLayout.componentStyles["small-card"].border.shadow === "lg", "compose 必须叠加当前页面卡片样式。");

requireExactValues(Object.keys(executableThemeContract), REQUIRED_REGION_IDS, "可执行运行时主题映射必须精确覆盖十个区域");
for (const regionId of REQUIRED_REGION_IDS) {
  const theme = executableThemeContract[regionId];
  requireExactObjectKeys(theme, ["effectiveBackground", "effectiveText"], `${regionId} 共享主题映射字段不精确`);
  requireCondition(theme.effectiveBackground.includes("var(--tradepro-") && theme.effectiveText.includes("var(--tradepro-"), `${regionId} 必须从共享主题有效变量解析颜色。`);
  const runtimeTarget = createRuntimeTarget();
  applyVisualCardComponentStyleRuntime(runtimeTarget.target, regionId, {
    surface: { backgroundRole: "surface", textRole: "default" },
  });
  requireCondition(runtimeTarget.properties.get("--visual-card-component-background") === theme.effectiveBackground, `${regionId} 运行时背景未读取共享契约有效变量。`);
  requireCondition(runtimeTarget.properties.get("--visual-card-component-text") === theme.effectiveText, `${regionId} 运行时文字未读取共享契约有效变量。`);
  requireCondition(
    ![...runtimeTarget.properties.keys()].some((property) => property.startsWith("--tradepro-shared-") || property.startsWith("--tradepro-product-market-")),
    `${regionId} 运行时不得反写共享契约变量。`,
  );
  clearVisualCardComponentStyleRuntime(runtimeTarget.target);
  requireCondition(runtimeTarget.attributes.size === 0 && runtimeTarget.properties.size === 0, `${regionId} 运行时清理后仍残留属性或 CSS 变量。`);
}
const fullRuntimeTarget = createRuntimeTarget();
applyVisualCardComponentStyleRuntime(fullRuntimeTarget.target, "topbar", {
  spacing: { padding: { top: 1, right: 2, bottom: 3, left: 4 }, gapPx: 5 },
  annotation: { visibility: "always", mode: "vertical" },
  surface: { backgroundRole: "primary", textRole: "on-primary" },
  typography: { familyRole: "heading", sizePx: 18, weight: 600, lineHeight: 1.5, letterSpacingEm: 0.02 },
  border: { style: "solid", widthPx: 1, colorRole: "primary", radiusPx: 8, shadow: "md" },
});
requireCondition(fullRuntimeTarget.attributes.size >= 18 && fullRuntimeTarget.properties.size >= 19, "完整 componentStyles 未全部投影到运行时。");
requireCondition(
  fullRuntimeTarget.properties.get("--visual-card-component-shadow")?.includes("--tradepro-layout-shadow"),
  "中等阴影必须读取共享 --tradepro-layout-shadow。",
);
requireCondition(
  ![...fullRuntimeTarget.properties.keys()].some((property) => property.startsWith("--tradepro-shared-") || property.startsWith("--tradepro-product-market-")),
  "完整 componentStyles 不得反写共享契约变量。",
);
clearVisualCardComponentStyleRuntime(fullRuntimeTarget.target);
requireCondition(fullRuntimeTarget.attributes.size === 0 && fullRuntimeTarget.properties.size === 0, "完整 componentStyles 运行时清理不彻底。");

const publishedRuntimeTarget = createRuntimeTarget();
publishedRuntimeTarget.properties.set("--tradepro-hover-capsule-bg", "rgb(1, 2, 3)");
publishedRuntimeTarget.properties.set("--tradepro-hover-capsule-text", "rgb(4, 5, 6)");
applyVisualCardComponentStyleRuntime(publishedRuntimeTarget.target, "workspace", {
  surface: { backgroundRole: "surface", textRole: "default" },
});
clearVisualCardComponentStyleRuntime(publishedRuntimeTarget.target);
requireCondition(
  publishedRuntimeTarget.properties.get("--tradepro-hover-capsule-bg") === "rgb(1, 2, 3)"
    && publishedRuntimeTarget.properties.get("--tradepro-hover-capsule-text") === "rgb(4, 5, 6)",
  "Visualizer cleanup must restore published workspace marker variables instead of deleting them.",
);

const executableSharedStyleBridge = await loadExecutableSharedStyleBridge();
requireExactValues(
  Object.keys(executableSharedStyleBridge.VISUAL_CARD_SHARED_REGION_STYLE_CONTRACT),
  REQUIRED_REGION_IDS,
  "可执行共享样式桥接必须精确覆盖十个区域",
);
requireExactValues(
  executableSharedStyleBridge.VISUAL_CARD_SHARED_STYLE_EDITABLE_FIELDS["total-frame"],
  ["cornerRadius", "density", "elevation"],
  "总框架只能编辑全局圆角、密度和层级",
);
requireCondition(
  executableSharedStyleBridge.VISUAL_CARD_SHARED_STYLE_SURFACE_OWNER["total-frame"] === "workspace",
  "总框架的上下文表面必须明确委托给 02主体",
);
for (const field of ["backgroundColor", "textColor", "fontFamily", "fontWeight", "letterSpacing"]) {
  requireCondition(
    executableSharedStyleBridge.VISUAL_CARD_SHARED_STYLE_EDITABLE_FIELDS.workspace.includes(field),
    `02主体必须继续拥有 ${field}`,
  );
  requireCondition(
    !executableSharedStyleBridge.VISUAL_CARD_SHARED_STYLE_EDITABLE_FIELDS["total-frame"].includes(field),
    `总框架不得拥有 02主体的 ${field}`,
  );
}
requireExactValues(
  executableSharedStyleBridge.VISUAL_CARD_SHARED_STYLE_EDITABLE_FIELDS.workspace,
  ["backgroundColor", "textColor", "fontFamily", "fontWeight", "letterSpacing"],
  "02主体只能拥有主体表面与全局字体，共享结构参数必须留在总框架",
);
for (const regionId of ["topbar", "title", "table-shell", "footer"]) {
  requireExactValues(
    executableSharedStyleBridge.VISUAL_CARD_SHARED_STYLE_EDITABLE_FIELDS[regionId],
    ["backgroundColor", "textColor"],
    `${regionId} 只能修改自己的共享表面色，不能覆盖总框架或02主体`,
  );
}
for (const forbidden of ["spacing", "annotation", "plugins"]) {
  requireCondition(
    !executableSharedStyleBridge.VISUAL_CARD_SHARED_STYLE_EDITABLE_FIELDS["total-frame"].includes(forbidden),
    `总框架不得接管 ${forbidden} 局部样式`,
  );
}
requireCondition(executableSharedStyleBridge.normalizeVisualCardSharedColor("rgb(1, 2, 3)") === "#010203", "共享颜色必须规范化为 #RRGGBB。");
requireCondition(executableSharedStyleBridge.normalizeVisualCardSharedColor("not-a-color") === undefined, "非法共享颜色必须拒绝。 ");
const defaultSharedStylePatch = executableSharedStyleBridge.createDefaultVisualCardSharedStyleApplyPatch();
for (const field of ["frameCornerRadius", "frameDensity", "frameElevation", "contentBgColor", "contentTextColor"]) {
  requireCondition(
    Object.prototype.hasOwnProperty.call(defaultSharedStylePatch.layoutStyle, field),
    `恢复默认补丁缺少 ${field}`,
  );
}
requireCondition(
  defaultSharedStylePatch.globalTypography.globalFontFamily
    && defaultSharedStylePatch.globalTypography.globalFontWeight
    && defaultSharedStylePatch.globalTypography.globalLetterSpacing,
  "恢复默认补丁必须同时恢复共享字体契约",
);
const bridgeLayout = {
  contentBgColor: "#F8FAFC",
  contentTextColor: "#0F172A",
  clientSecondaryTitleBgColor: "#123456",
  clientSecondaryTitleTextColor: "#FFFFFF",
  frameCornerRadius: "soft",
  frameDensity: "compact",
  frameElevation: "raised",
  globalFontWeight: "700",
  globalLetterSpacing: "0.04em",
};
const bridgeTypography = {
  globalFontFamily: "'Noto Serif SC', serif",
  globalFontWeight: "700",
  globalLetterSpacing: "0.04em",
};
const resolvedBridgeTitle = executableSharedStyleBridge.resolveVisualCardSharedRegionStyle("title", bridgeLayout, {}, bridgeTypography);
requireCondition(
  resolvedBridgeTitle.backgroundColor === "#123456"
    && resolvedBridgeTitle.cornerRadius === "soft"
    && resolvedBridgeTitle.density === "compact"
    && resolvedBridgeTitle.elevation === "raised"
    && resolvedBridgeTitle.fontFamily === "'Noto Serif SC', serif",
  "共享样式桥接未读取真实版面颜色、圆角、密度、阴影或字体。",
);
const resolvedTotalFrame = executableSharedStyleBridge.resolveVisualCardSharedRegionStyle("total-frame", bridgeLayout, {}, bridgeTypography);
requireCondition(
  resolvedTotalFrame.surfaceOwnerRegionId === "workspace"
    && JSON.stringify(resolvedTotalFrame.editableFields) === JSON.stringify(["cornerRadius", "density", "elevation"]),
  "总框架解析结果必须只暴露结构编辑能力，并把表面归属交给 02主体",
);
const totalFramePatch = executableSharedStyleBridge.buildVisualCardSharedStylePatch(
  "total-frame",
  {
    backgroundColor: "#334455",
    textColor: "#FFFFFF",
    cornerRadius: "round",
    density: "standard",
    elevation: "soft",
    fontFamily: "'Noto Sans SC', sans-serif",
    fontWeight: "400",
    letterSpacing: "0em",
  },
  bridgeLayout,
  {},
  bridgeTypography,
);
requireExactValues(
  Object.keys(totalFramePatch.layoutStyle).sort(),
  ["frameCornerRadius", "frameDensity", "frameElevation"].sort(),
  "总框架补丁只能包含全局结构字段",
);
requireCondition(
  Object.keys(totalFramePatch.globalTypography).length === 0
    && totalFramePatch.layoutStyle.contentBgColor === undefined
    && totalFramePatch.layoutStyle.contentTextColor === undefined,
  "总框架不得覆盖 02主体颜色或全局字体",
);
requireExactValues(
  [...totalFramePatch.rejectedFields].sort(),
  ["backgroundColor", "textColor", "fontFamily", "fontWeight", "letterSpacing"].sort(),
  "总框架必须明确拒绝主体表面和字体编辑",
);
const workspaceSharedPatch = executableSharedStyleBridge.buildVisualCardSharedStylePatch(
  "workspace",
  {
    backgroundColor: "#334455",
    textColor: "#FFFFFF",
    fontFamily: "'Noto Sans SC', sans-serif",
    fontWeight: "400",
    letterSpacing: "0em",
  },
  bridgeLayout,
  {},
  bridgeTypography,
);
requireCondition(
  workspaceSharedPatch.layoutStyle.contentBgColor === "#334455"
    && workspaceSharedPatch.layoutStyle.contentTextColor === "#FFFFFF"
    && workspaceSharedPatch.globalTypography.globalFontFamily === "'Noto Sans SC', sans-serif"
    && workspaceSharedPatch.globalTypography.globalFontWeight === "400"
    && workspaceSharedPatch.globalTypography.globalLetterSpacing === "0em",
  "02主体必须继续独立写入主体底色、字体色和共享字体",
);

const globalSharedPatch = executableSharedStyleBridge.buildVisualCardSharedStylePatch(
  "title",
  { backgroundColor: "#ABCDEF", density: "relaxed", fontWeight: "400" },
  bridgeLayout,
  {},
  bridgeTypography,
);
requireCondition(
  globalSharedPatch.boundary === "global-layout-style"
    && globalSharedPatch.layoutStyle.clientSecondaryTitleBgColor === "#ABCDEF"
    && globalSharedPatch.layoutStyle.frameDensity === undefined
    && globalSharedPatch.globalTypography.globalFontWeight === undefined
    && globalSharedPatch.rejectedFields.includes("density")
    && globalSharedPatch.rejectedFields.includes("fontWeight"),
  "标题共享样式必须只生成自身表面色补丁，并拒绝总框架结构和02主体字体字段。",
);
const pageSharedPatch = executableSharedStyleBridge.buildVisualCardSharedStylePatch(
  "content",
  { backgroundColor: "#223344", cornerRadius: "round" },
  bridgeLayout,
  {},
  bridgeTypography,
);
requireCondition(
  pageSharedPatch.boundary === "current-page-appearance"
    && Object.keys(pageSharedPatch.layoutStyle).length === 0
    && pageSharedPatch.pageAppearance?.backgroundColor === "#223344",
  "当前页面区域不得反向污染全局 Layout Style。",
);

// The launcher is an independent fixed footer portal. It is not nested in the
// development dialog or editable topbar, so collapsing topbar cannot lock the
// user out and no floating coordinate can move it away from Save and Sync.
for (const token of [
  "data-visual-card-control-strip",
  'document.querySelector<HTMLElement>("[data-responsive-visual-launcher-slot]")',
  "const observer = new MutationObserver(() => {",
  "if (resolveSlot()) observer.disconnect()",
  "slot,",
  "data-visual-card-developer-launcher",
]) requireToken(launcher, token, "尾栏固定可视化开发入口不完整");
requireToken(dock, "data-visual-card-editor-dock", "可视化开发器主体不完整");
for (const sourceTopbar of sourceTopbars) {
  requireToken(sourceTopbar, "data-source-topbar-actions", "源体顶栏未给右上角固定入口预留空间");
}
requireToken(dock, "[data-source-topbar-actions]", "固定入口未避让源体顶栏操作区");
for (const token of [
  "lazy(async ()",
  'import("@/components/product-market/VisualPageEditorDock")',
  "visualPageEditorOpen ? <Suspense",
]) requireToken(productMarket, token, "产品市场必须在点击可视化后才加载完整编辑器");
for (const token of [
  "lazy(async ()",
  'import("@/components/product-market/VisualPageEditorDock")',
  "open ? <Suspense",
]) requireToken(projectContractHost, token, "项目页必须在点击可视化后才加载完整编辑器");
forbidToken(dock, "<Dialog", "可视化卡片开发器不得重新放入弹窗");
forbidToken(legacyConsole, "data-visual-card-developer-launcher", "旧开发器弹窗内不得保留可视化入口");
forbidToken(legacyConsole, "<VisualCardDeveloper", "旧开发器弹窗内不得保留模拟画布");

// Two UI-only application scopes expose a compact direct button grid. The
// visible controls read the scope whitelist without a legacy group variable.
for (const token of [
  "data-visual-card-scope-columns",
  "data-visual-card-application-scope",
  "data-visual-card-global-scope",
  "data-visual-card-page-scope",
  "VISUAL_CARD_APPLICATION_SCOPE_META",
  "VISUAL_CARD_SCOPE_SELECTION_IDS",
  "activeApplicationScope",
  "visibleRegionIds",
  "data-visual-card-compact-button-grid",
  "data-visual-card-frame-settings",
  'data-visual-card-frame-settings-parent="total-frame"',
  "data-visual-card-total-frame-select",
  "data-visual-card-region-navigation",
  "data-visual-card-region-item-select",
  "visibleRegionIds.map",
  "data-visual-card-region-settings",
  "data-visual-card-selected-region",
  "data-visual-card-selected-setting-title",
  "data-visual-card-setting-row",
  "TooltipContent",
  "selectedRegionId",
  'selectedRegionId === "total-frame"',
]) requireToken(dock, token, "双作用域紧凑按钮、选中设置联动或逐行设置不完整");

const parameterSectionsBlock = requireMatch(
  dock,
  /const VISUAL_CARD_PARAMETER_SECTIONS = \[([\s\S]*?)\] as const;/u,
  "固定开发器缺少统一参数类别定义。",
)[1];
const parameterSectionIds = [...parameterSectionsBlock.matchAll(/id:\s*"([^"]+)"/gu)].map((match) => match[1]);
requireExactValues(parameterSectionIds, REQUIRED_PARAMETER_SECTION_IDS, "统一参数按钮必须精确保持九类及其顺序");
for (const token of [
  "data-visual-card-parameter-sections",
  "VISUAL_CARD_PARAMETER_SECTIONS.map",
  "data-visual-card-parameter-section={section.id}",
  "data-visual-card-parameter-panel={activeParameterSection}",
  "activeParameterSection",
  "setActiveParameterSection",
  "data-visual-card-setting-row",
  "data-visual-card-component-style-reset",
  "resetSelectedComponentStyle",
  "data-visual-card-spacing-padding={side}",
  "data-visual-card-spacing-gap",
  "data-visual-card-annotation-visibility",
  "data-visual-card-annotation-mode",
  "data-visual-card-surface-background",
  "data-visual-card-surface-text",
  "data-visual-card-typography-family",
  "data-visual-card-typography-size",
  "data-visual-card-typography-weight",
  "data-visual-card-typography-line-height",
  "data-visual-card-typography-letter-spacing",
  "data-visual-card-border-style",
  "data-visual-card-border-width",
  "data-visual-card-border-color",
  "data-visual-card-border-radius",
  "data-visual-card-border-shadow",
  'data-visual-card-annotation-unavailable="total-frame"',
  "总框架不使用区域标注",
]) requireToken(dock, token, "七类统一参数按钮、逐行控件、重置或总框架标注拒绝不完整");
forbidToken(dock, 'type="color"', "统一参数必须选择语义色位，不得要求任意颜色值");
const frameSettingsOpeningTag = requireMatch(
  dock,
  /<div data-visual-card-frame-settings(?:\s[^>]*)?>/u,
  "总框架尺寸设置容器缺失。",
)[0];
forbidToken(frameSettingsOpeningTag, "grid-cols-2", "总框架四边尺寸必须逐行显示，不能回到两列设置格");

const scopeColumnsOpeningTag = requireMatch(
  dock,
  /<div data-visual-card-scope-columns[^>]*>/u,
  "缺少作用域按钮容器。",
)[0];
const componentGridOpeningTag = requireMatch(
  dock,
  /<nav data-visual-card-region-navigation data-visual-card-compact-button-grid[^>]*>/u,
  "缺少两列组件按钮容器。",
)[0];
requireToken(scopeColumnsOpeningTag, "grid-cols-2", "全局／当前页面作用域按钮必须保持两列");
requireToken(componentGridOpeningTag, "grid-cols-2", "组件按钮必须保持两列");

const scopeSelectionBlock = requireMatch(
  dock,
  /const VISUAL_CARD_SCOPE_SELECTION_IDS = \{([\s\S]*?)\} as const satisfies Record<VisualCardEditorApplicationScope, readonly VisualCardRegionId\[\]>;/u,
  "固定开发器缺少 global/current-page/canary-profile 组件选择顺序。",
)[1];
const globalSelectionBlock = requireMatch(
  scopeSelectionBlock,
  /global:\s*\[([^\]]*)\]/u,
  "固定开发器缺少同步全局按钮顺序。",
)[1];
const pageSelectionBlock = requireMatch(
  scopeSelectionBlock,
  /"current-page":\s*\[([^\]]*)\]/u,
  "固定开发器缺少当前页面按钮顺序。",
)[1];
const canarySelectionBlock = requireMatch(
  scopeSelectionBlock,
  /"canary-profile":\s*\[([^\]]*)\]/u,
  "固定开发器缺少试点档案按钮顺序。",
)[1];
requireExactValues(
  quotedValues(globalSelectionBlock),
  REQUIRED_GLOBAL_SELECTION_IDS,
  "同步全局按钮必须按总框架、顶部、主体、尾栏、标题、表内排列",
);
requireExactValues(
  quotedValues(pageSelectionBlock),
  REQUIRED_PAGE_SELECTION_IDS,
  "当前页面按钮必须按表头、内容、大卡片、小卡片排列",
);
requireExactValues(
  quotedValues(canarySelectionBlock),
  REQUIRED_CANARY_SELECTION_IDS,
  "试点档案必须从主体开始并只暴露共享区域族",
);
forbidToken(dock, "data-visual-card-region-select", "旧的九类单层下拉必须移除");
for (const token of [
  "REGION_NAV_GROUPS",
  "VISUAL_CARD_EDITOR_NAV_GROUP_DEFS",
  "visibleRegionGroups",
  "data-visual-card-group-always-visible",
  "data-visual-card-frame-settings-always-visible",
  'data-visual-card-frame-settings-parent="outer-frame"',
  "data-visual-card-region-group-label",
  "data-visual-card-region-group-items",
  "data-visual-card-frame-settings-label",
  "frameExpanded",
  "setFrameExpanded",
  "expandedRegionGroupId",
  "setExpandedRegionGroupId",
  "data-visual-card-total-frame-toggle",
  "data-visual-card-region-group-select",
  "aria-expanded={frameExpanded}",
  "aria-expanded={expanded}",
  "{frameExpanded ? <div data-visual-card-frame-settings",
  "{expanded ? <div data-visual-card-region-group-items",
]) forbidToken(dock, token, "编辑器导航必须紧凑直显，不得保留展开／收起状态或条件渲染");

requireToken(dock, "VISUAL_CARD_EDITABLE_REGION_IDS.indexOf(regionId)", "组件区域编号必须保持全局 01-09 顺序");

// Window geometry remains an editor-only, bounded overlay. It can move and
// resize without resizing, scaling or shifting the real sandbox.
for (const token of [
  "VISUAL_CARD_EDITOR_DEFAULT_WIDTH",
  "VISUAL_CARD_EDITOR_DEFAULT_HEIGHT",
  "VISUAL_CARD_EDITOR_EXPANDED_SIDEBAR_WIDTH",
  "VISUAL_CARD_EDITOR_SIDEBAR_WIDTH_GAP",
  "VISUAL_CARD_EDITOR_DEFAULT_LEFT",
  "VISUAL_CARD_EDITOR_MIN_WIDTH",
  "VISUAL_CARD_EDITOR_MIN_HEIGHT",
  "clampVisualCardEditorWindowRect",
  "createDefaultVisualCardEditorWindowRect",
  "data-visual-card-window-drag-handle",
  "data-visual-card-window-resize-handle",
  "data-visual-card-window-state",
  "data-visual-card-window-interaction",
  'data-shared-dialog-contract="visual-workbench"',
  'data-shared-window-kind="workbench"',
  'data-shared-window-region="frame"',
  'data-shared-window-region="topbar"',
  'data-shared-window-region="content"',
  'data-shared-window-region="footer"',
  "SHARED_CENTER_SYMMETRIC_RESIZE_CONTRACT",
  "resolveCenteredWindowResize",
  "VISUAL_CARD_EDITOR_RESIZE_EDGES",
  "data-shared-resize-behavior",
  "data-window-resize-edge={edge}",
  'data-shared-resize-handle="true"',
  'data-content-plugin-control="close"',
  "onPointerDown={startWindowDrag}",
  "onPointerDown={startWindowResize(edge)}",
  'window.addEventListener("pointermove"',
  'window.addEventListener("pointerup"',
  'window.addEventListener("pointercancel"',
  'window.addEventListener("resize"',
  '["--tradepro-shared-runtime-window-width" as string]',
  '["--tradepro-shared-runtime-window-height" as string]',
  '["--tradepro-shared-dialog-title-min-height" as string]',
  'mode: "drag" | "resize"',
  "edge?: SharedWindowResizeEdge",
  "left: VISUAL_CARD_EDITOR_DEFAULT_LEFT",
  "bottom-0 right-0",
  "cursor-se-resize",
  "VISUAL_CARD_EDITOR_DEFAULT_HEIGHT(viewportHeight)",
  "viewportHeight - VISUAL_CARD_EDITOR_VIEWPORT_MARGIN * 2",
  "right: window.innerWidth - VISUAL_CARD_EDITOR_VIEWPORT_MARGIN",
  "bottom: window.innerHeight - VISUAL_CARD_EDITOR_VIEWPORT_MARGIN",
]) requireToken(dock, token, "可视化窗口的移动、缩放或视口边界保护不完整");
requireToken(
  dock,
  "VISUAL_CARD_EDITOR_DEFAULT_WIDTH = VISUAL_CARD_EDITOR_EXPANDED_SIDEBAR_WIDTH - VISUAL_CARD_EDITOR_SIDEBAR_WIDTH_GAP",
  "默认窗口宽度必须明确小于展开的左侧导航",
);
requireToken(
  dock,
  "VISUAL_CARD_EDITOR_DEFAULT_LEFT = Math.max(VISUAL_CARD_EDITOR_VIEWPORT_MARGIN, VISUAL_CARD_EDITOR_SIDEBAR_WIDTH_GAP / 2)",
  "默认窗口必须居中覆盖在展开的左侧导航内",
);
const expandedSidebarWidth = Number(requireMatch(
  dock,
  /const VISUAL_CARD_EDITOR_EXPANDED_SIDEBAR_WIDTH = (\d+);/u,
  "缺少左侧导航宽度基准。",
)[1]);
const sidebarWidthGap = Number(requireMatch(
  dock,
  /const VISUAL_CARD_EDITOR_SIDEBAR_WIDTH_GAP = (\d+);/u,
  "缺少可视化窗口与左侧导航的宽度差。",
)[1]);
if (!(sidebarWidthGap > 0 && sidebarWidthGap < expandedSidebarWidth)) {
  throw new Error("默认可视化窗口必须比展开的左侧导航窄。 ");
}
if (expandedSidebarWidth - sidebarWidthGap !== 216) {
  throw new Error(`默认可视化窗口必须精确为 216px。实际：${expandedSidebarWidth - sidebarWidthGap}px`);
}
forbidToken(dock, "fixed bottom-2 right-2 top-2", "可视化窗口不得继续锁死在右侧三边");
for (const edge of ["north", "south", "east", "west", "north-east", "north-west", "south-east", "south-west"]) {
  requireToken(dock, `"${edge}"`, `可视化窗口缺少共享缩放边缘：${edge}`);
}
forbidToken(dock, "localStorage.setItem", "窗口几何不得写入业务或租户存储");
forbidToken(dock, "sessionStorage.setItem", "窗口几何应和现有开发器一样在重开时复位");
forbidToken(dock, "html[data-visual-card-editor-open] [data-product-market-layout] { margin-right", "打开面板不得挤压真实页面");
forbidToken(dock, "data-product-market-layout] { transform", "打开面板不得缩放真实页面");

// Draft state is projected onto the real Product Market DOM. Layout fields and
// normalized componentStyles share the same real-page bridge and cleanup path.
for (const token of [
  "collectVisualPageRegionTargets",
  "findVisualPageLayoutRoot",
  "MutationObserver",
  "formatVisualContractAnnotation",
  "isVisualAnnotationTarget",
  "annotationTargets",
  "SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE",
  "SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE",
  "resolveSharedSmallCardMarkerRepresentative",
  'effectiveMarker === "representative"',
  "data-visual-contract-annotation",
  "RuntimeLayoutBridge",
  'from "@/lib/visual-card-component-style-runtime"',
  "applyVisualCardComponentStyleRuntime",
  "clearVisualCardComponentStyleRuntime",
  'applyVisualCardComponentStyleRuntime(root, "total-frame", config.componentStyles?.["total-frame"])',
  "applyVisualCardComponentStyleRuntime(target, regionId, config.componentStyles?.[regionId])",
  "data-visual-card-runtime-style",
  "data-visual-card-runtime-placement",
  "data-visual-card-runtime-collapsed",
  "data-visual-card-runtime-plugins",
  "--visual-card-frame-top",
  "--responsive-large-card-marker-top-inset",
  "data-visual-card-editor-selected",
]) requireToken(dock, token, "真实页面运行时投影不完整");
// Every client project page uses the same semantic registry. Explicit markers
// cover existing contracts; the observer also registers new non-table cards.
for (const token of [
  "VISUAL_PAGE_REGION_SELECTORS",
  "VISUAL_PAGE_REGION_LABELS",
  "findVisualPageLayoutRoot",
  "data-visual-layout-root",
  "data-product-market-layout",
  "data-client-project-frame",
  "data-page-title",
  "data-page-table-header",
  "data-page-list-scroll-owner",
  "SHARED_LARGE_CARD_REGION_SELECTOR",
  "SHARED_SMALL_CARD_MARKER_CANDIDATE_SELECTOR",
  "collectSharedSmallCardCandidates",
  "data-page-layout-footer",
  "formatVisualContractAnnotation",
]) requireToken(pageRegionRegistry, token, "project visual contract auto-registration is incomplete");
for (const token of [
  'SHARED_SMALL_CARD_MARKER_CONTRACT_VERSION = "2026.08.26.2"',
  "SHARED_LARGE_CARD_REGION_SELECTOR",
  "SHARED_SMALL_CARD_DISCOVERY_MUTATION_ATTRIBUTES",
  "SHARED_DEVELOPER_LIVE_PREVIEW_MUTATION_ATTRIBUTES",
  "SHARED_DEVELOPER_LIVE_PREVIEW_DOCUMENT_THEME_MUTATION_ATTRIBUTES",
  'SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE = "data-shared-small-card-style-surface-effective"',
  "isSharedSmallCardStyleSurface",
  "SHARED_SMALL_CARD_MARKER_AUTOMATIC_SCOPE_SELECTOR = SHARED_LARGE_CARD_REGION_SELECTOR",
  'data-development-standard-frame-region="small-card"',
  'data-page-card-size="small"',
  'data-page-factory-region="small-card"',
  "SHARED_SMALL_CARD_MARKER_STANDARD_CARD_FALLBACK_SELECTOR",
  "SHARED_SMALL_CARD_CANDIDATE_DISCOVERY_SELECTOR",
  "collectSharedSmallCardCandidates",
  "!element.matches(SHARED_LARGE_CARD_REGION_SELECTOR)",
  'element.tagName !== "TR"',
  "data-page-list-layout=\"table\"",
  '"data-page-list-layout"',
]) requireToken(sharedWindowContract, token, "shared small-card marker discovery contract is incomplete");
for (const token of [
  '"aria-pressed"',
  '"data-selected"',
  '"data-product-market-batch-selected"',
  '"data-shared-selection-control"',
  '"data-shared-theme-palette-state"',
]) requireToken(sharedWindowContract, token, "central Developer live-preview mutation contract is missing a semantic state attribute");
for (const token of [
  '"class"',
  '"style"',
  '"data-tradepro-theme-preview"',
]) requireToken(sharedWindowContract, token, "central Developer document theme mutation contract is incomplete");
requireToken(responsiveContract, "SHARED_SMALL_CARD_DISCOVERY_MUTATION_ATTRIBUTES", "responsive marker synchronizer must consume the central small-card mutation contract");
requireToken(responsiveContract, "attributeFilter: [...SHARED_SMALL_CARD_DISCOVERY_MUTATION_ATTRIBUTES]", "responsive marker synchronizer must observe only central small-card discovery attributes");
for (const token of [
  "SHARED_DEVELOPER_LIVE_PREVIEW_MUTATION_ATTRIBUTES",
  "attributeFilter: [...SHARED_DEVELOPER_LIVE_PREVIEW_MUTATION_ATTRIBUTES]",
  "SHARED_DEVELOPER_LIVE_PREVIEW_DOCUMENT_THEME_MUTATION_ATTRIBUTES",
  "livePreviewObserver.observe(document.documentElement",
  "attributeFilter: [...SHARED_DEVELOPER_LIVE_PREVIEW_DOCUMENT_THEME_MUTATION_ATTRIBUTES]",
]) requireToken(dock, token, "Visual developer must consume both central live-preview mutation contracts");
requireToken(dock, 'record.type === "attributes"', "Visual developer must rescan existing nodes when a central discovery attribute changes");
requireToken(
  pageRegionRegistry,
  '${SHARED_SMALL_CARD_MARKER_CANDIDATE_SELECTOR}',
  "Visual developer must consume the shared small-card candidate selector",
);
requireToken(
  pageRegionRegistry,
  "collectSharedSmallCardCandidates(root)",
  "Visual developer must use the shared small-card discovery function",
);
for (const token of [
  "attribute-only small-card discovery stays synchronized with the Developer",
  "selection and document theme mutations refresh Developer live previews",
  "Operations theme and batch selection use shared selected-control tokens",
  "large-card nodes are never registered as small-card targets",
  "representativeVisibleCount",
  "silentVisibleCount",
  "data-visual-card-editor-dock",
  "data-shared-window-small-card-surface-runtime-attribute",
  "Operations and Modules small cards read one shared Layout Style palette",
  "客服提醒声音在修改提醒音控件登记共享小卡片标注",
  "当前专家真人朗音自定义字段登记共享小卡片标注并在开发器中只显示首张代表",
  "开关客音与客服音效每个大卡片都只显示第一张小卡片标注",
  'not.toHaveAttribute("data-development-standard-marker")',
  "SHARED_SMALL_CARD_MARKER_CONTRACT_VERSION",
]) requireToken(sharedLiveSurfacesE2e, token, "shared marker/Developer browser regression is incomplete");

const operationsThemeSwitchButton = requireMatch(
  productMarket,
  /<button\s+key=\{preset\.key\}[\s\S]*?data-product-market-theme-key=\{preset\.key\}[\s\S]*?data-shared-theme-palette-appearance="operations-theme-switch"[\s\S]*?className="flex items-center gap-2/u,
  "operations theme switch button contract is missing",
)[0];
for (const token of [
  'data-shared-selection-control="true"',
  "data-selected={isActive}",
  "aria-pressed={isActive}",
]) requireToken(operationsThemeSwitchButton, token, "operations theme buttons must expose the shared selected-control semantics");
for (const token of [
  'data-product-market-batch-selected={isSelected ? "true" : "false"}',
  "ring-[var(--tradepro-shared-selection-outline)]",
  "ring-offset-[var(--tradepro-panel-frame-bg)]",
]) requireToken(productMarket, token, "operations batch selection must consume the shared selection tokens");
const operationsBatchCheckboxStyle = requireMatch(
  globalCss,
  /\[data-product-market-card-select\] \[role="checkbox"\]\[data-state="checked"\] \{[\s\S]*?\}/u,
  "operations checked-card checkbox style is missing",
)[0];
for (const token of [
  "border-color: var(--tradepro-shared-selection-outline) !important",
  "background-color: var(--tradepro-shared-selection-bg) !important",
  "color: var(--tradepro-shared-selection-text) !important",
]) requireToken(operationsBatchCheckboxStyle, token, "operations checked-card checkbox must consume the shared selection tokens");
for (const token of [
  "border-color: var(--product-market-card-name-color",
  "background-color: var(--product-market-card-name-color",
  "color: var(--product-market-card-bg",
]) forbidToken(operationsBatchCheckboxStyle, token, "operations checked-card checkbox must not retain private product-card colours");
const operationsBatchSelectedCardStyle = requireMatch(
  globalCss,
  /\[data-product-market-card\]\[data-product-market-batch-selected="true"\][^{]*\{[\s\S]*?\}/u,
  "operations selected-card outline style is missing",
)[0];
for (const token of [
  "0 0 0 2px var(--tradepro-shared-selection-outline)",
  "0 0 0 3px var(--tradepro-panel-frame-bg)",
  "!important",
]) requireToken(operationsBatchSelectedCardStyle, token, "operations selected-card outline must consume the shared selection and frame tokens");
for (const token of [
  "ring-2 ring-blue-500 ring-offset-1 ring-offset-slate-900",
  "data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 pointer-events-none",
]) forbidToken(productMarket, token, "operations batch selection must not retain its private blue selected styling");
for (const token of [
  "SHARED_LARGE_CARD_REGION_SELECTOR",
  "SHARED_SMALL_CARD_CANDIDATE_DISCOVERY_SELECTOR",
  "region-marker:large-small-runtime-overlap",
  "dualLargeSmallTargets",
  "sharedSmallCardStyleSurfaceEffective",
]) requireToken(allPagesE2e, token, "all-pages marker overlap regression must consume the central selector contract");
requireCondition(
  pageRegionRegistry.includes('):not([data-responsive-shared-surface=\\"title-2\\"])'),
  "primary Visual title discovery must exclude the independently-owned Layout Style title-2 band",
);

for (const token of [
  "VISUAL_CARD_DIRECT_APPLY_EVENT",
  "writeVisualCardPageOverride",
  'currentProductMarketConfigKey("client_source", siteId)',
  "writeSharedVisualContractSettings",
  "recordPageCompositionAudit",
  "VisualPageEditorTopbarLauncher",
  "VisualPageEditorDock",
]) requireToken(projectContractHost, token, "project visual contract host is incomplete");

for (const token of [
  "data-product-market-theme-section",
  'data-development-standard-frame-region="title"',
  'data-development-standard-frame-label="标题 2"',
]) requireToken(productMarket, token, "product market second title is not registered in the shared development annotation contract");

for (const token of [
  "VISUAL_PAGE_COMPONENT_DEFINITIONS",
  "title-standard",
  "title-accent",
  "title-soft",
  "table-header-standard",
  "large-card-soft",
  "small-card-standard",
  "createVisualPageComponentInstance",
  "applicationScope",
  "VISUAL_COMPONENT_CONTRACT_SCHEMA_VERSION",
  "VISUAL_COMPONENT_CONTRACT_INHERITANCE",
  "VISUAL_COMPONENT_INHERITANCE_STATUS_LABELS",
  "resolveVisualComponentInheritance",
  "VisualComponentInheritanceResolution",
  "VISUAL_COMPONENT_RUNTIME_STATES",
  "VISUAL_PAGE_COMPONENT_CONTRACTS",
  "buildVisualPageComponentContract",
  "getVisualPageComponentContract",
  "listVisualPageComponentContracts",
  'owner: "shared-visual-contract"',
  'runtimeSource: "real-page-region"',
  '"hq", "agency_source", "client_source"',
]) requireToken(componentLibrary, token, "visual component library is incomplete");

for (const token of [
  "componentInstances?: VisualCardComponentInstance[]",
  "normalizeComponentInstances",
  "ADDABLE_COMPONENT_REGION_IDS",
  'const persistedScope: VisualCardApplicationScope = scope === "canary-profile" ? "global" : scope',
  "instance.applicationScope !== persistedScope",
  "instance.applicationScope === persistedScope",
]) requireToken(layoutContract, token, "visual component instance contract is incomplete");

for (const token of [
  "data-visual-component-library",
  "data-visual-component-library-item",
  "VISUAL_COMPONENT_COLLECTIONS",
  "data-visual-component-collection-tabs",
  "data-visual-component-collection={collection.id}",
  'activeComponentCollection === "live"',
  "createVisualRegionPreviewSnapshot",
  "getComputedStyle(target)",
  'computed.backgroundImage.includes("gradient(")',
  "getVisualRegionPreviewStyleSignature",
  "deduplicateVisualRegionPreviews",
  "seenStyleSignatures",
  "uniqueSelectedRegionPreviews",
  "data-visual-component-live-preview-list",
  "data-visual-component-live-preview",
  "data-visual-component-live-preview-style-only",
  "data-visual-component-preview-source-index",
  "data-visual-component-preview-viewport",
  "data-visual-component-preview-canvas",
  "data-visual-component-style-preview",
  "data-visual-component-shared-style-list",
  "grid max-h-44 grid-cols-2",
  "data-visual-component-hover-actions",
  "data-visual-component-six-dot-handle",
  "data-visual-component-selection-actions",
  "data-visual-component-dropzones",
  "data-visual-component-replace-dropzone",
  "data-visual-component-add-dropzone",
  "data-visual-component-replace",
  "data-visual-component-add",
  "data-visual-component-instance-list",
  "data-visual-component-instance-more",
  "dropToReplaceRegion",
  "dropToAddComponent",
  "createVisualComponentInstanceElement",
  "data-visual-component-instance-host",
  "isVisualComponentInstanceMutation",
  "componentInstances: normalized.componentInstances || []",
  "data-visual-component-contract-count",
  "data-visual-component-contract={selectedSharedContract.id}",
  "data-visual-component-inheritance-resolution",
  "data-visual-component-inheritance-layer={layer.layerId}",
  "data-visual-component-inheritance-status={layer.status}",
  "三端同源",
  "data-visual-card-impact-preview",
  "data-visual-card-impact-scope={activeApplicationScope}",
  "data-visual-card-impact-compatible-targets",
  "data-visual-card-impact-isolated-targets",
  "GLOBAL_FRAME_COMPATIBLE_TARGET_COUNT",
  "DEVELOPER_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_IDS",
  "data-visual-card-impact-isolated-list",
  "data-visual-card-impact-target={target.label}",
  "compositionImpactTargets",
  "data-visual-card-permission",
  "data-visual-card-restore-latest={activeApplicationScope}",
  "restoreLatestApplicationScope",
  "listPageCompositionAuditRecords",
  "restorePageCompositionAudit",
]) requireToken(dock, token, "visual component drag and drop runtime is incomplete");

for (const token of [
  "if (!editorOpen || regionId !== selectedRegionId) return;",
  "nextPluginRuntime[selectedRegionId]",
  "nextRegionPreviews[selectedRegionId]",
]) requireToken(dock, token, "visual diagnostics must be collected only for the open selected region");

for (const token of [
  "VisualPluginCompactPreview",
  "VISUAL_PLUGIN_GROUP_META",
  "availablePluginGroups",
  "data-visual-plugin-compact-header",
  "data-visual-plugin-group-list",
  "data-visual-plugin-group={groupId}",
  "data-visual-plugin-group-toggle={groupId}",
  "data-visual-plugin-group-panel={groupId}",
  "data-visual-plugin-column-guides",
  "实际效果",
  "启用",
  "data-visual-plugin-select={plugin.id}",
  "data-visual-plugin-toggle={plugin.id}",
  "data-visual-plugin-detail={selectedPluginDefinition.id}",
  "data-visual-plugin-preview",
  "data-visual-plugin-preview-shared-runtime",
  "data-visual-plugin-preview-enabled",
  "data-visual-plugin-preview-state={previewState}",
  "data-visual-plugin-state-lab={selectedPluginDefinition.id}",
  "data-visual-plugin-state={state}",
  "listContentPluginPreviewStates",
  "CONTENT_PLUGIN_PREVIEW_STATE_LABELS",
  "data-visual-plugin-real-control",
  "data-visual-plugin-drag-handle",
  "ContentPluginDragHandle",
  "ContentPluginIconTrigger",
  "ContentPluginMoveButtons",
  "ContentPluginOrderBadge",
  "ContentPluginStatusActions",
  "ContentPluginActionButton",
  "ContentPluginTextBadge",
  "ContentPluginToggle",
  "VisualPluginRuntimeEffectPreview",
  "data-visual-plugin-runtime-effect",
  "applyVisualCardPluginRuntime(target, [pluginId], { observe: false })",
  "clearVisualCardPluginRuntime(target)",
]) requireToken(dock, token, "direct shared plugin preview contract is incomplete");
forbidToken(dock, "可用插件（多选）", "plugin picker must use compact grouped disclosure instead of a full flat list");
forbidToken(dock, 'min-w-0 flex-1 truncate text-[9px] font-semibold text-slate-700', "plugin rows must not repeat text beside the real shared control preview");
forbidToken(dock, "scale-[0.62]", "the three real status capsules must not be scaled into a look-alike preview");
forbidToken(dock, "compactActionClass", "plugin previews must use the same dimensions as the real project controls");
forbidToken(dock, "rounded-md border border-slate-200 bg-white px-1 text-slate-600", "plugin previews must not wrap real controls in a decorative outer frame");
forbidToken(dock, "bg-blue-50 ring-1 ring-blue-300", "plugin selection must not add a second framed preview around the real control");

for (const token of [
  "...buttonProps",
  'Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className" | "onClick">',
  'data-content-plugin-control="toggle"',
  "export const ContentPluginIconTrigger = forwardRef",
  'data-content-plugin-control="icon"',
  'content-plugin-icon-trigger nav-icon-setting',
  "export function ContentPluginTextBadge",
]) requireToken(contentPluginControls, token, "shared content-plugin toggle must forward editor markers and disabled state");

for (const token of [
  ':is(#root, [data-visual-card-editor-dock]) .template-config-content-plugin-toggle',
  '--tradepro-shared-plugin-toggle-track-width: 1.75rem',
  '--tradepro-shared-plugin-toggle-track-height: 1rem',
  '--tradepro-shared-plugin-toggle-thumb-size: 0.75rem',
  ':is(#root, [data-visual-card-editor-dock]) .content-plugin-toolbar-toggle',
  ':is(#root, [data-visual-card-editor-dock]) :is(.content-plugin-toolbar-control, .content-plugin-action-button)',
  ':is(#root, [data-visual-card-editor-dock]) :is(.content-plugin-toolbar-control, .content-plugin-action-button):is(:hover, :focus-visible):not(:disabled)',
  ':is(#root, [data-visual-card-editor-dock]) .template-config-shared-order',
  'font-weight: var(--tradepro-global-font-weight, 400) !important',
  'letter-spacing: var(--tradepro-global-letter-spacing, 0.02em) !important',
  '[data-visual-card-editor-dock] button.content-plugin-icon-trigger:is(:hover, :focus-visible)',
  ':is(#root, [data-visual-card-editor-dock]) button.content-plugin-icon-trigger > span',
  '[data-visual-card-editor-dock] button.content-plugin-status-button',
]) requireToken(globalCss, token, "shared plugin toggles must remain visible inside the visual editor portal instead of collapsing into empty frames");
requireToken(dock, '<ContentPluginOrderBadge order={1} suffix="栏" sequence="ascending" />', "the visual order preview must keep the real Product Market suffix and natural width");
requireToken(dock, '<ContentPluginStatusActions value="active"', "the visual status preview must show the real default active state instead of coupling it to plugin enablement");

requireToken(productMarket, "<ContentPluginStatusActions", "the real Product Market page must consume the shared status plugin primitive");
forbidToken(productMarket, "ContentPluginIconTrigger", "Product Market category icons are centrally controlled by the tailbar, not by a per-row icon plugin");
forbidToken(productMarket, 'className="content-plugin-icon-trigger nav-icon-setting flex h-8', "Product Market must not keep a private copy of the shared icon-setting trigger");

for (const token of [
  'pluginId === "icon"',
  'pluginId === "statusActions"',
  'pluginId === "levelBadge"',
  'pluginId === "hover"',
  'pluginId === "compact"',
  'pluginId === "split"',
  'pluginId === "scroll"',
  'pluginId === "responsive"',
  'pluginId === "empty"',
  'pluginId === "pin" ? "pin"',
  'pluginId === "copy" ? "copy"',
  "{label}</ContentPluginActionButton>",
]) requireToken(dock, token, "plugin preview must preserve the actual icon, merged-status, badge and text-action control types");

for (const token of [
  'id: "components"',
  'id: "responsive"',
  'listVisualPageComponentDefinitions([selectedRegionId])',
  'instance.regionId === selectedRegionId',
  'activeParameterSection === "components"',
  "data-visual-component-library-region={selectedRegionId}",
  'activeParameterSection === "responsive"',
  "data-visual-card-responsive-contract",
  "三端自适应已启用",
  "data-responsive-topbar-disclosure-policy",
  "data-responsive-page-tools-policy",
  "data-responsive-visual-launcher-policy",
]) requireToken(dock, token, "component library must be scoped under the selected region with responsive settings");

for (const token of [
  'VisualResponsiveContractScope = VisualResponsiveRuntimeScope',
  'data-visual-responsive-contract',
  'data-visual-responsive-mode',
  'data-visual-responsive-scope',
  'data-responsive-topbar-disclosure-policy',
  'data-responsive-page-tools-policy',
  'data-responsive-toolbar-order-policy',
  'data-responsive-function-key-policy',
  'data-responsive-theme-palette-policy',
  'data-responsive-shared-surface-policy',
  'data-responsive-shared-action-policy',
  'data-responsive-shared-interaction-policy',
  'data-responsive-visual-launcher-policy',
  'data-responsive-visual-launcher-default-dock',
  'data-responsive-footer-action-order',
  'data-responsive-footer-label-policy',
  '--responsive-topbar-popover-gap',
  'data-responsive-page-tools-capacity-policy',
  '--responsive-visual-launcher-footer-slot',
  '--responsive-function-key-height',
  '--responsive-function-key-content-gap',
  '--responsive-footer-control-content-gap',
  'width <= 640',
  'width <= 900',
  'width <= 1180',
  'window.addEventListener("resize", scheduleApply',
  'auditFrame = window.requestAnimationFrame',
  'window.cancelAnimationFrame(auditFrame)',
  'stableFramesRemaining = 2',
  'window.addEventListener("tradepro:workspace-marker-layout", scheduleStableMarkerApply)',
  'apply();',
]) requireToken(responsiveContract, token, "three-shell responsive runtime contract is incomplete");
if (responsiveContract.includes("window.queueMicrotask(() =>")) {
  throw new Error("three-shell responsive runtime must publish observations after layout frames, not a mutation microtask");
}

for (const [layout, scope] of [
  [hqLayout, "hq"],
  [agencySourceLayout, "agency_source"],
  [clientSourceLayout, "client_source"],
]) {
  requireToken(layout, "DeferredShellRuntimeHosts", `${scope} does not mount the deferred responsive/runtime boundary`);
  requireToken(layout, `sourceScope="${scope}"`, `${scope} does not bind the deferred responsive/runtime boundary`);
}
for (const token of [
  'const ShellRuntimeHosts = lazy(() => import("./ShellRuntimeHosts"))',
  "schedulePostPaintIdle(() => setReady(true))",
  "<VisualResponsiveBootstrap scope={visualScope} />",
]) requireToken(deferredShellRuntimeHosts, token, "deferred responsive/runtime boundary is incomplete");
for (const token of [
  "DeveloperGlobalFrameRuntimeHost",
  "VisualResponsiveContract",
  "<VisualResponsiveContract scope={visualScope} />",
]) requireToken(shellRuntimeHosts, token, "shared responsive/runtime composition is incomplete");
for (const token of [
  "useLayoutEffect(() => {",
  'root.setAttribute("data-visual-responsive-contract", "true")',
  'root.setAttribute("data-responsive-shell-contract", RESPONSIVE_SHELL_FACTORY_DEFAULT.version)',
  'root.setAttribute("data-visual-responsive-scope", scope)',
  'window.addEventListener("resize", schedule, { passive: true })',
]) requireToken(visualResponsiveBootstrap, token, "synchronous first-paint responsive bootstrap is incomplete");
for (const token of [
  'data-responsive-topbar-disclosure="popover"',
  'data-responsive-topbar-popover="anchored"',
  'aria-controls="client-source-topbar-tools"',
  'aria-label={`${mobileTopbarExpanded ? "收起" : "展开"}${RESPONSIVE_SHELL_TOOL_LABELS["client-tools"]}`}',
  'id="client-source-page-tools-slot"',
  'data-responsive-toolbar-trigger="client-tools"',
  'data-responsive-toolbar-order="2"',
  'document.addEventListener("pointerdown", closeOnOutsidePointer, true)',
  'document.addEventListener("keydown", closeOnEscape)',
]) requireToken(clientSourceLayout, token, "Client Source compact tool disclosure contract is incomplete");

forbidToken(clientSourceLayout, "客户端全局工具", "Client Source still renders the retired duplicate global-tools heading");
forbidToken(globalCss, "data-responsive-client-global-tools-heading", "retired duplicate global-tools heading CSS remains");

for (const token of [
  "Three-shell visual responsive contract",
  'html[data-visual-responsive-contract="true"]',
  "@media (max-width: 1180px)",
  "@media (max-width: 900px)",
  "@media (max-width: 640px)",
  '[data-content-plugin-control="delete"]',
  ".content-plugin-icon-trigger",
  "[data-visual-responsive-description]",
  '[data-responsive-topbar-popover="anchored"]',
  '[data-responsive-page-tools-projection]',
  '[data-responsive-independent-tools]',
  '[data-responsive-toolbar-trigger]',
  '--responsive-function-key-height',
  '[data-responsive-function-key-plugin="shared"]',
  '[data-responsive-footer-lock-density="labelled"]',
  '[data-responsive-shared-surface="title-1"]',
  '[data-responsive-shared-action-plugin="large-action-density"]',
  '[data-responsive-shared-popover-plugin="large-interaction-density"]',
  'font-weight: 800 !important',
  '[data-responsive-page-tools-popover="anchored"]',
  "position: absolute !important",
  'body [role="dialog"]',
  "grid-template-columns: minmax(0, 1fr) !important",
]) requireToken(globalCss, token, "global responsive CSS contract is incomplete");

for (const token of [
  'data-responsive-visual-launcher="footer-fixed-before-save"',
  'data-responsive-visual-launcher-dock="footer-before-save"',
  'data-responsive-visual-launcher-fixed="true"',
  'data-responsive-function-key-plugin="shared"',
  'draggable={false}',
  'createPortal(',
  'slot,',
]) requireToken(launcher, token, "fixed footer visual launcher contract is incomplete");

for (const retiredToken of [
  'VISUAL_LAUNCHER_POSITION_KEY',
  'setPointerCapture',
  'onPointerMove',
  'onDragStart',
  'onKeyDown',
  'cursor-grab',
]) forbidToken(launcher, retiredToken, "fixed footer visual launcher must not retain movement behavior");

for (const layout of [hqLayout, agencySourceLayout, clientSourceLayout]) {
  requireToken(layout, "data-footer-primary-actions", "source footer primary action rail is missing");
  requireToken(layout, "data-responsive-visual-launcher-slot", "source footer visual launcher slot is missing");
}

for (const layout of [agencyLayout, adminLayout]) {
  requireToken(layout, "data-responsive-visual-launcher-slot", "runtime footer visual launcher slot is missing");
}

for (const token of [
  'data-responsive-shared-surface-plugin="large-band-density"',
  'data-responsive-shared-action-plugin="large-action-density"',
  'data-product-market-hydrated',
]) requireToken(productMarket, token, "desktop source surface annotations are incomplete");

for (const token of [
  'ResponsiveSemanticPageTools',
  '<ResponsiveSemanticPageTools scope={scope} />',
]) requireToken(responsivePageHost, token, "shared semantic page-tools host is incomplete");

for (const token of [
  'data-responsive-single-live-source="true"',
  'data-responsive-toolbar-trigger={id}',
  'renderTrigger("page-context", 3)',
  'renderTrigger("theme", 4)',
  'renderTrigger("table-header", 5)',
  'data-responsive-toolbar-trigger="overflow"',
  'data-responsive-tools-capacity-policy',
  'data-responsive-tools-overflowed',
  'responsiveToolsRequiredWidth',
  'ResizeObserver',
  'RESPONSIVE_SHELL_TOOL_LABELS[id]',
  'data-responsive-navigation-label="page-name"',
  'responsiveLiveSurfaceOpen',
  'isSafeSemanticBandCandidate',
]) requireToken(responsiveSemanticPageTools, token, "single-live-source page-tools contract is incomplete");

for (const token of [
  '[data-responsive-live-surface][data-responsive-live-surface-open="true"]',
  'container: tradepro-live-surface / inline-size',
  '[data-responsive-live-surface-overflow-menu]',
]) requireToken(sharedAdaptiveSurfaceCss, token, "shared live-surface CSS contract is incomplete");

for (const retiredToken of [
  'ResponsiveProductMarketToolsPortal',
  'data-responsive-page-tools-projection',
  'data-responsive-legacy-projection-superseded',
]) forbidToken(`${productMarket}\n${responsivePageHost}\n${responsiveSemanticPageTools}`, retiredToken, "retired page-tools projection must not return");

for (const token of [
  'data-responsive-tools-overflowed="true"',
  'data-responsive-toolbar-trigger="page-context"',
  'data-responsive-toolbar-trigger="theme"',
  'data-responsive-toolbar-trigger="overflow"',
]) requireToken(globalCss, token, "measured page-tools overflow CSS contract is incomplete");

for (const token of [
  "VisualProjectContractHost",
  'const VisualProjectContractHost = lazy(async () => ({',
  'await import("@/components/product-market/VisualProjectContractHost")',
  '<Suspense fallback={null}>',
  "!isProductMarketPage && !isReleaseCenter",
  "data-visual-layout-root",
  'data-development-standard-frame-region="title"',
]) requireToken(clientSourceLayout, token, "client project pages do not share the visual contract host");

requireCondition(
  !/^\s*import\s+(?!\()[^\n]*["']@\/components\/product-market\/VisualProjectContractHost["'];?\s*$/mu.test(clientSourceLayout),
  "client project visual host must not use any static import form",
);

for (const token of [
  'data-development-standard-frame-region={level === 0 ? "large-card" : "small-card"}',
  'data-page-card-size={level === 0 ? "large" : "small"}',
  'data-development-standard-frame-region="table-shell"',
  'data-development-standard-frame-region="title"',
  'data-development-standard-frame-region="table-header"',
  'data-development-standard-frame-region="content"',
]) requireToken(companyInfo, token, "navigation visual contract annotations are incomplete");

for (const token of [
  'data-development-standard-frame-region="title"',
  'data-development-standard-frame-region="table-header"',
]) requireToken(companyInfoDeferredPanels, token, "company deferred panel annotations are incomplete");

const comparableLayoutBlock = requireMatch(
  dock,
  /function comparableLayout\(config: VisualCardLayoutConfig\) \{([\s\S]*?)\n\}/u,
  "固定开发器缺少草稿差异比较。",
)[1];
requireToken(comparableLayoutBlock, "componentStyles: normalized.componentStyles || {}", "componentStyles 变化必须进入 dirty 比较");
for (const token of [
  '#root [data-visual-card-runtime-component-style="true"]',
  "var(--visual-card-component-background)",
  "var(--visual-card-component-text)",
  "var(--visual-card-component-padding-top)",
  "var(--visual-card-component-padding-right)",
  "var(--visual-card-component-padding-bottom)",
  "var(--visual-card-component-padding-left)",
  "var(--visual-card-component-gap)",
  "var(--visual-card-component-font-family)",
  "var(--visual-card-component-font-size)",
  "var(--visual-card-component-font-weight)",
  "var(--visual-card-component-line-height)",
  "var(--visual-card-component-letter-spacing)",
  "var(--visual-card-component-border-style)",
  "var(--visual-card-component-border-width)",
  "var(--visual-card-component-border-color)",
  "var(--visual-card-component-radius)",
  "var(--visual-card-component-shadow)",
  '[data-visual-card-annotation-visibility="hidden"]',
  '[data-visual-card-annotation-mode="inline"]',
  '[data-visual-card-annotation-mode="vertical"]',
]) requireToken(dock, token, "componentStyles 运行时 CSS 消费不完整");
forbidToken(dock, "data-visual-card-live-canvas", "真实页面模式不得保留内部模拟画布");

// Plugin labels and compatibility continue to come from the canonical registry.
for (const token of [
  'from "@/lib/content-plugin-registry"',
  "getContentPluginDefinition",
  "selectedContract.allowedPlugins",
]) requireToken(dock, token, "固定开发器未使用正式插件注册表");
for (const token of [
  "CONTENT_PLUGIN_IDS",
  "CONTENT_PLUGIN_DEFINITIONS",
  "ContentPluginPreviewState",
  "CONTENT_PLUGIN_PREVIEW_STATE_LABELS",
  "listContentPluginPreviewStates",
  "getContentPluginDefinition",
  "isKnownContentPluginId",
]) requireToken(pluginRegistry, token, "正式内容插件注册表缺少开发器能力");

for (const token of [
  '[data-visual-plugin-preview-state="active"] .content-plugin-action-button',
  '[data-visual-plugin-preview-state="hover"]',
  '[data-visual-plugin-preview-state="focus"]',
  '[data-visual-plugin-preview-state="disabled"] [data-visual-plugin-real-control]',
]) requireToken(globalCss, token, "真实插件状态预览必须复用页面共享状态样式");
forbidToken(dock, "PLUGIN_CATALOG", "固定开发器不得复制插件目录");

// Direct apply carries explicit global/page persistence boundaries plus one
// session-only canary-profile boundary. The compact footer never publishes.
for (const token of [
  "buildVisualCardLayoutScopeKey(scope)",
  "writeVisualCardEditorLayout(scope, draft)",
  "readVisualCardPageOverride(scope)",
  "composeVisualCardLayout(",
  "mergeVisualCardLayoutForApplicationScope(",
  "const applyApplicationScope = (applicationScope: VisualCardEditorApplicationScope)",
  'applyApplicationScope("current-page")',
  'applyApplicationScope("global")',
  'applyApplicationScope("canary-profile")',
  "applicationScope,",
  "data-visual-card-action-footer",
  "data-visual-card-action-grid",
  "grid-cols-3",
  "data-visual-card-undo",
  "data-visual-card-reset-default",
  "data-visual-card-save-style",
  "data-visual-card-sync-global",
  'data-visual-card-primary-action="current-page"',
  'data-visual-card-primary-action="global"',
  'data-visual-card-primary-action="canary-profile"',
  'data-visual-card-apply-direct="current-page"',
  'data-visual-card-apply-direct="global"',
  'data-visual-card-apply-direct="canary-profile"',
  "createDefaultVisualCardSharedStyleApplyPatch",
  "detail.appliedConfig",
  "VISUAL_CARD_DIRECT_APPLY_EVENT",
  "detail.accepted",
]) requireToken(dock, token, "固定开发器的 global/page/canary 草稿／直接应用链不完整");
for (const token of [
  "const globalDirty",
  "const currentPageDirty",
  "const undoCurrentApplicationScope",
  "const saveCurrentPageStyle",
  "const saveCanaryProfile",
  "const syncGlobalStyle",
  "当前选中范围没有可撤销的修改。",
  "当前页面样式没有修改，无需重复保存。",
  "全局样式没有修改，无需重复保存草稿。",
]) {
  requireToken(dock, token, "固定开发器必须分别比较当前页面与全局修改，并在无差异时给出可读提示");
}
const actionGridBlock = requireMatch(
  dock,
  /<div data-visual-card-action-grid[\s\S]*?<\/div>/u,
  "固定开发器缺少按 scope 切换的纯文字操作键",
)[0];
for (const icon of ["<Undo2", "<RotateCcw", "<Save", "<RefreshCw"]) {
  forbidToken(actionGridBlock, icon, "固定开发器尾栏操作键只能显示文字");
}
const scopedActionOrder = [
  "data-visual-card-undo",
  "data-visual-card-reset-default",
  'data-visual-card-primary-action="canary-profile"',
  'data-visual-card-primary-action="current-page"',
  'data-visual-card-primary-action="global"',
].map((token) => dock.indexOf(token));
requireCondition(
  scopedActionOrder.every((index) => index >= 0)
    && scopedActionOrder.every((index, position) => position === 0 || index > scopedActionOrder[position - 1])
    && dock.includes('activeApplicationScope === "canary-profile" ? (')
    && dock.includes(') : activeApplicationScope === "current-page" ? ('),
  "尾栏必须先显示撤销/默认，再按 active scope 只显示一个主动作",
);
for (const token of [
  "handleDirectVisualCardApply",
  "buildVisualCardLayoutScopeKey(scope)",
  "recordPageCompositionAudit(location.pathname, location.search)",
  'const applicationScope = detail.applicationScope || "global"',
  'if (applicationScope === "current-page")',
  "writeVisualCardPageOverride(scope, detail.config)",
  "mergeVisualCardLayoutForApplicationScope(",
  "detail.appliedConfig = composeVisualCardLayout(",
  "readVisualCardPageOverride(scope)",
  "visualCardLayout: cloneVisualCardLayout(globalLayout)",
  "layoutCustomized: true",
  "layoutStructureCustomized: true",
  "writeSharedVisualContract: true",
  "writeSharedVisualContractSettings(nextConfig)",
  "commitConfigSnapshot(nextConfig",
  "detail.accepted = true",
  "VisualPageEditorTopbarLauncher",
  "VisualPageEditorDock",
  "const VisualPageEditorTopbarLauncher = lazy",
  'import("@/components/product-market/VisualPageEditorLauncher")',
  "!isDevelopmentGuide && postPaintApplicationsReady ? <Suspense",
  "readOnly={!isGlobalThemeSource}",
]) requireToken(productMarket, token, "产品市场未安全消费全局／当前页面直接应用请求");
for (const token of [
  "export function writeSharedVisualContractSettings",
  "const current = readSharedStyleSettings(siteId)",
  "...current",
  "layoutStyle: { ...config.layoutStyle }",
  "visualCardLayout: config.visualCardLayout",
  'source: "shared-visual-contract"',
]) requireToken(productMarketSharedStyle, token, "全局同步必须窄写视觉契约，不能覆盖产品、声音或客服共享数据");
forbidToken(
  productMarket,
  "visualCardLayout: cloneVisualCardLayout(detail.config)",
  "产品市场不得把包含当前页面区域的编辑草稿整包写入全局模板",
);

// Formal configuration persistence and audit recovery still carry normalized
// layout snapshots and remain compatible with older audit records.
for (const token of [
  "visualCardLayout?: VisualCardLayoutConfig",
  "visualCardLayout: state.visualCardLayout",
  "cloneVisualCardLayout(normalizeVisualCardLayout(config.visualCardLayout))",
]) requireToken(productMarketStore, token, "产品市场正式配置未持久化视觉布局");
for (const token of [
  "visualCardLayout: VisualCardLayoutConfig | null",
  "useProductMarketStore.getState().visualCardLayout",
  'if (record.visualSharedContract || "visualCardLayout" in record)',
  "snapshot?.visualCardLayout ?? record.visualCardLayout",
  "visualCardPageOverride",
  "writeStoredProductMarketConfig(record.productMarketConfigKey, nextConfig)",
]) requireToken(audit, token, "审计恢复未覆盖视觉布局快照");

for (const forbidden of ["fetch(", "localStorage.clear("]) {
  forbidToken(dock, forbidden, "固定开发器不得直接改写业务或全量存储");
}

for (const token of [
  'restoreFrom: "factory"',
  'saveTo: "source-draft"',
  'publishTo: "source-published"',
  "PRODUCT_MARKET_VERIFIED_DRAFT_BASELINE_CONTRACT",
  'saveBaseline: "verified-normalized-readback"',
  'liveHydration: "replace-live-store-from-verified-snapshot"',
  'canonicalHydration: "import-then-export-editor-shape"',
  'draftHydration: "replace-editor-draft-from-canonical-hydrated-snapshot"',
  'transportMetadata: "preserved-in-draft-signature"',
  'optionalTextNormalization: "empty-to-undefined-before-signature"',
  'draftIsolation: "preserve-user-edited-products-during-live-refresh"',
  'remoteCommit: "single-awaited-write-after-local-stage"',
  'passiveSourcePersistence: "transient-store-only-until-awaited-save-readback"',
  'sourceMountHydration: "local-first-paint>reset-plan-baseline>remote-verified-refresh>sync-editor-draft>timeout-to-local>protect-live-edits"',
  'shellSaveCompletion: "await-readback-before-dialog-close"',
  'baselineMutation: "clean-product-live-refresh-only"',
  'exitComparison: "verified-canonical-signature"',
  'exitPrompt: "only-unpersisted-differences"',
  'restoreFrom: "source-published"',
  'protectedData: "客户已添加、已填写、已编制的业务内容与素材"',
  'exitChoices: ["保存并退出", "放弃修改", "继续编辑"]',
  "summarizeProductMarketConfigChanges",
]) requireToken(templateLifecycle, token, "三端可视化模板生命周期共享契约不完整");
for (const token of [
  "persistAndVerifyScopedSnapshot",
  "return expected;",
  "applyConfigSnapshotToState(verifiedConfig",
  "let hydratedConfig = buildPersistedProductMarketSnapshot(",
  "buildSharedAwareConfig(buildConfigFromDialogState(), {",
  "finalVerifiedConfig = await persistAndVerifyScopedSnapshot(",
  "const hydratedSignature = productMarketConfigSignature(hydratedConfig)",
  "loadConfigIntoSettingsDraft(hydratedConfig)",
  "defaultDialogVerifiedSignatureRef",
  "saveOperationInFlightRef.current",
  "SHARED_PROJECT_SYNC_REQUEST_EVENT",
  "detail.respondWith(completion)",
  "data-template-draft-state",
  "data-template-draft-baseline-contract",
  "await publishTemplate(",
  "await readRemoteTemplateConfig(",
  "requestCloseDefaultDialog",
  "检测到未保存修改",
  "getProductMarketRestoreCopy(templateLifecycleRole",
]) requireToken(productMarket, token, "产品市场未完整接入保存／发布／恢复／退出生命周期契约");

const verifiedLiveHydrationIndex = productMarket.indexOf("applyConfigSnapshotToState(verifiedConfig");
const canonicalHydrationIndex = productMarket.indexOf("let hydratedConfig = buildPersistedProductMarketSnapshot(");
const canonicalPersistIndex = productMarket.indexOf("finalVerifiedConfig = await persistAndVerifyScopedSnapshot(");
const verifiedDraftHydrationIndex = productMarket.indexOf("loadConfigIntoSettingsDraft(hydratedConfig)");
const verifiedBaselineIndex = productMarket.indexOf(
  "defaultDialogVerifiedSignatureRef.current = hydratedSignature",
);
if (
  verifiedLiveHydrationIndex < 0
  || canonicalHydrationIndex <= verifiedLiveHydrationIndex
  || canonicalPersistIndex <= canonicalHydrationIndex
  || verifiedDraftHydrationIndex <= canonicalPersistIndex
  || verifiedBaselineIndex <= verifiedDraftHydrationIndex
) {
  throw new Error("产品市场保存成功后必须依次同步实时状态、导出规范形态、编辑草稿，再推进已验证退出基线");
}
forbidToken(productMarket, "loadConfigIntoSettingsDraft(verifiedConfig)", "服务端原始回读不得直接成为编辑器退出基线");
forbidToken(productMarket, "defaultDialogVerifiedSignatureRef.current = productMarketConfigSignature(verifiedConfig)", "服务端原始回读不得直接成为编辑器退出签名");
requireToken(productMarket, "currentSignature !== baselineSignature", "用户已编辑的产品草稿不得被实时目录刷新覆盖");
requireToken(productMarket, "defaultDialogProductsBaselineSignatureRef.current = liveSignature", "仅干净产品草稿可以吸收代码目录迁移");
requireToken(productMarket, "defaultDialogBaselineReadyRef.current = true;", "产品市场必须同步关闭基线建立后的旧闭包竞态窗口");
requireToken(productMarket, "const displayName = textDraft.displayName.trim()", "客服专家可选文字空值必须与已验证基线使用同一签名形态");
requireToken(productMarket, "applyState: false", "产品市场显式保存必须在回读通过前保持实时状态不变");
requireToken(productMarket, "if (saveOperationInFlightRef.current) return;", "显式保存回读期间不得启动被动模板 PUT");
requireToken(productMarket, "signature === inheritedSignatureRef.current || signature === appliedConfigSignatureRef.current", "被动持久化不得重复覆盖已应用签名");
requireToken(productMarket, "if (!options?.skipRemoteSnapshot) void upsertInstance", "运行端本地暂存必须能禁止回读前的后台重复 PUT");
requireToken(productMarket, "if (!options?.skipRemoteSnapshot && !options?.skipSourceTemplateDraft) void upsertTemplate", "源体本地暂存必须能禁止回读前的后台重复 PUT");
requireToken(productMarket, 'if (templateLifecycleRole === "source") return;', "源体被动状态只能留在临时 store，已验证 current 与远端草稿必须由显式保存共同推进");
requireToken(productMarket, "skipRemoteSnapshot: true", "显式保存／同步／恢复必须让回读校验成为唯一远端写入者");
forbidToken(productMarket, "syncingDialogProductsFromStoreRef", "产品目录被动同步不得写入或覆盖退出基线");
for (const token of [
  "SHARED_PROJECT_SYNC_CONTRACT_VERSION",
  "SHARED_PROJECT_SYNC_REQUEST_EVENT",
  "respondWith?: (completion: Promise<boolean>) => void",
  "return completion ? await completion : true",
]) requireToken(sharedProjectSyncContract, token, "共享页面保存事件必须等待页面持久化与回读完成");
for (const sourceTopbar of sourceTopbars) {
  requireToken(sourceTopbar, "dispatchSharedProjectSyncRequest", "三端外层保存必须等待页面保存完成");
  requireToken(sourceTopbar, "if (!saved)", "三端外层保存不得把失败或未完成当作成功");
}
for (const token of [
  "PRODUCT_MARKET_TEMPLATE_LIFECYCLE_CONTRACT_VERSION",
  "工厂默认（发布成功后只读）",
  "源体：保存草稿 → 发布新版 → 全计划 → 工厂默认",
  "运行端：恢复已发布源体",
  "只有批次 completed、成功数等于总数且失败数为 0 才能显示完成",
]) requireToken(developmentStandardPanels, token, "开发规范未学习三端模板生命周期共享契约");

console.log("可视化开发器契约通过：总框架／02主体权限拆分、共享契约出厂恢复、源体草稿／发布版本／运行端恢复生命周期、未保存退出保护与保存回读校验、撤销／默认／保存／同步四键、双脏状态与提交隔离、216px 全高窄窗、九类统一参数、三端自适应、当前组件按真实样式去重且无额外文字、组件双页签双列缩略图、固定投放区、插件三组折叠、无预览外框的项目原尺寸共享控件、三连状态胶囊、文字操作插件、浮层清晰启用开关及悬停效果、真实页面投影、窄范围全局写入、租户隔离及审计恢复均已验证。");
