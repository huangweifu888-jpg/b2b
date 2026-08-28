import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";
import tailwindcss from "tailwindcss";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sourceRoot = fileURLToPath(new URL("../src", import.meta.url));
const collectSourceFiles = (directory) => readdirSync(directory).flatMap((entry) => {
  const absolutePath = join(directory, entry);
  return statSync(absolutePath).isDirectory() ? collectSourceFiles(absolutePath) : [absolutePath];
});

const PANEL_ANCHORS = new Set([
  "data-template-module-table-header",
  "product-module-child-operation-grid",
  "product-module-child-card",
  "product-module-operation-grid",
  "product-module-category-header-shell",
  "product-module-category-operation-grid",
  "product-module-root-card",
  "template-config-table-header",
  "product-module-category-row",
  "product-module-card-content",
  "product-module-list",
  "product-module-category-operation-grid-fixed",
  "product-module-matrix-shell",
  "data-product-market-module-category-heading",
  "data-template-module-split",
  "product-module-category-header-card",
  "product-module-category-title",
  "product-module-category-action",
  "template-config-module-collapse",
  "data-responsive-collection-complexity",
]);

const selectorNodeRequiresPanel = (selectorNode) => {
  for (const node of selectorNode.nodes) {
    if (node.type === "class" && PANEL_ANCHORS.has(node.value)) return true;
    if (node.type === "attribute" && PANEL_ANCHORS.has(node.attribute)) return true;
    if (
      node.type === "pseudo"
      && [":is", ":where", ":has"].includes(node.value)
      && node.nodes?.length
      && node.nodes.every(selectorNodeRequiresPanel)
    ) {
      return true;
    }
  }
  return false;
};

const selectorRequiresPanel = (selector) => {
  let owned = true;
  selectorParser((root) => {
    owned = root.nodes.every(selectorNodeRequiresPanel);
  }).processSync(selector);
  return owned;
};

const ruleIsLayered = (rule) => {
  let parent = rule.parent;
  while (parent && parent.type !== "root") {
    if (parent.type === "atrule" && parent.name === "layer") return true;
    parent = parent.parent;
  }
  return false;
};

const ruleIsSharedResponsiveStructure = (rule) => {
  const selectors = rule.selectors ?? [rule.selector];
  return selectors.length === 2
    && selectors.some((selector) => selector.includes(".product-module-card-content"))
    && selectors.some((selector) => (
      selector.includes('[data-responsive-structure-item="module"] > [data-template-module-split]')
      && !selector.includes(".product-module-card-content")
    ));
};

const selectorMentionsPanelAnchor = (selector) => (
  [...PANEL_ANCHORS].some((anchor) => selector.includes(anchor))
);

const productMarket = read("src/pages/ProductMarket.tsx");
const panel = read("src/components/product-market/ProductMarketModulesPanel.tsx");
const moduleChildren = read("src/components/product-market/ProductMarketModuleChildrenList.tsx");
const moduleEditor = read("src/components/product-market/ProductMarketModuleEditorDialog.tsx");
const iconSetting = read("src/components/content-plugins/ContentPluginIconSetting.tsx");
const deferredCss = read("src/components/product-market/ProductMarketModulesPanel.css");
const globalCss = read("src/index.css");

assert.match(
  productMarket,
  /const ProductMarketModulesPanel = lazy\(async \(\) => \(\{[\s\S]*?import\("@\/components\/product-market\/ProductMarketModulesPanel"\)/u,
  "ProductMarketModulesPanel must remain behind its component lazy boundary.",
);
assert.match(
  productMarket,
  /activeSettingsTab === "modules" \? \([\s\S]*?<ProductMarketModulesPanel/u,
  "The modules panel must remain gated by the modules tab.",
);
assert.doesNotMatch(
  panel,
  /import\s*\{[^}]*\bContentPluginIconSetting\b[^}]*\}\s*from\s*["']@\/components\/content-plugins\/(?:ContentPluginControls|ContentPluginIconSetting)["']/u,
  "The full ContentPluginIconSetting runtime must not be statically imported by the modules panel.",
);
assert.match(
  panel,
  /import\("@\/components\/content-plugins\/ContentPluginIconSetting"\)/u,
  "The full ContentPluginIconSetting runtime must stay behind a dynamic import.",
);
assert.match(
  panel,
  /onPointerEnter=\{warmContentPluginIconSetting\}/u,
  "Pointer intent must preload the deferred icon setting.",
);
assert.match(
  panel,
  /onFocus=\{warmContentPluginIconSetting\}/u,
  "Keyboard focus must preload the deferred icon setting.",
);
assert.match(
  panel,
  /onClick=\{\(\) => setActivated\(true\)\}/u,
  "The first explicit activation must mount the full icon setting.",
);
assert.match(
  panel,
  /<LazyContentPluginIconSetting \{\.\.\.props\} compact defaultOpen \/>/u,
  "The interaction-loaded icon setting must open automatically after mounting.",
);
assert.match(
  iconSetting,
  /defaultOpen = false[\s\S]*?useState\(defaultOpen\)/u,
  "ContentPluginIconSetting must preserve its default closed state while supporting deferred auto-open.",
);
assert.match(
  panel,
  /import\("@\/components\/product-market\/ProductMarketModuleEditorDialog"\)/u,
  "The custom module editor must stay behind an interaction-only dynamic import.",
);
assert.doesNotMatch(
  panel,
  /<Dialog(?:Content|Description|Footer|Header|Title|\s)/u,
  "The modules startup chunk must not inline the custom module editor dialog body.",
);
assert.match(
  panel,
  /onPointerEnter=\{warmProductMarketModuleEditorDialog\}[\s\S]*?onFocus=\{warmProductMarketModuleEditorDialog\}/u,
  "The add-module action must preload its editor for both pointer and keyboard intent.",
);
assert.match(
  moduleEditor,
  /export function ProductMarketModuleEditorDialog\([\s\S]*?<Dialog open onOpenChange=\{onOpenChange\}>/u,
  "The deferred module editor must retain the complete controlled dialog interaction.",
);
assert.match(
  panel,
  /import\("@\/components\/product-market\/ProductMarketModuleChildrenList"\)/u,
  "Collapsed nested module editors must stay behind a dynamic import.",
);
assert.match(
  panel,
  /onPointerEnter=\{warmProductMarketModuleChildrenList\}[\s\S]*?onFocus=\{warmProductMarketModuleChildrenList\}[\s\S]*?hasChildren && isChildrenExpanded \? \([\s\S]*?<LazyProductMarketModuleChildrenList/u,
  "Nested module editors must preload on expansion intent and mount only while expanded.",
);
assert.match(
  moduleChildren,
  /data-responsive-structure-item="module"[\s\S]*?export function ProductMarketModuleChildrenList\([\s\S]*?<SortableContext/u,
  "The deferred nested module chunk must retain sortable shared-card semantics.",
);
assert.match(
  panel,
  /import "@\/shared-module-editor-capacity\.css";\s*import "\.\/ProductMarketModulesPanel\.css";/u,
  "The lazy panel must load its shared capacity plugin before its owned stylesheet.",
);
assert.deepEqual(
  collectSourceFiles(sourceRoot)
    .filter((path) => /\.[cm]?[jt]sx?$/u.test(path))
    .filter((path) => readFileSync(path, "utf8").includes("ProductMarketModulesPanel.css"))
    .map((path) => relative(sourceRoot, path).replaceAll("\\", "/")),
  ["components/product-market/ProductMarketModulesPanel.tsx"],
  "Only the lazy ProductMarketModulesPanel module may import its owned stylesheet.",
);
assert.deepEqual(
  collectSourceFiles(sourceRoot)
    .filter((path) => /\.tsx$/u.test(path))
    .filter((path) => {
      const source = readFileSync(path, "utf8");
      return [...PANEL_ANCHORS].some((anchor) => source.includes(anchor));
    })
    .map((path) => relative(sourceRoot, path).replaceAll("\\", "/"))
    .sort(),
  [
    "components/product-market/ProductMarketModuleChildrenList.tsx",
    "components/product-market/ProductMarketModulesPanel.tsx",
  ],
  "Deferred CSS anchors must stay inside the modules panel and its expansion-only child chunk.",
);

assert.ok(
  Buffer.byteLength(deferredCss, "utf8") >= 11 * 1024,
  "ProductMarketModulesPanel deferred CSS must remain a meaningful tab-only split.",
);

const deferredRoot = postcss.parse(deferredCss, {
  from: "src/components/product-market/ProductMarketModulesPanel.css",
});
let deferredRuleCount = 0;
deferredRoot.walkAtRules("layer", (atRule) => {
  assert.fail(`Deferred CSS must not contain Tailwind-only @layer blocks: @layer ${atRule.params}`);
});
deferredRoot.walkRules((rule) => {
  deferredRuleCount += 1;
  assert.ok(
    selectorRequiresPanel(rule.selector),
    `Deferred CSS contains a selector without mandatory panel ownership: ${rule.selector}`,
  );
  assert.ok(
    !ruleIsSharedResponsiveStructure(rule),
    `Deferred CSS captured a shared responsive-structure rule: ${rule.selector}`,
  );
});
assert.equal(deferredRuleCount, 41, "Deferred CSS must retain the audited 41 non-layer panel rules.");

const globalRoot = postcss.parse(globalCss, { from: "src/index.css" });
let retainedLayeredRules = 0;
let residualDeferredRules = 0;
let retainedTopLevelMixedRules = 0;
let retainedOptionalSharedRules = 0;
let retainedResponsiveStructureRules = 0;

globalRoot.walkRules((rule) => {
  if (ruleIsSharedResponsiveStructure(rule)) {
    retainedResponsiveStructureRules += 1;
    return;
  }
  if (selectorRequiresPanel(rule.selector)) {
    if (ruleIsLayered(rule)) retainedLayeredRules += 1;
    else residualDeferredRules += 1;
    return;
  }
  if (!selectorMentionsPanelAnchor(rule.selector)) return;
  const selectorBranches = rule.selectors ?? [rule.selector];
  if (selectorBranches.some(selectorMentionsPanelAnchor) && !selectorBranches.every(selectorMentionsPanelAnchor)) {
    retainedTopLevelMixedRules += 1;
  } else {
    retainedOptionalSharedRules += 1;
  }
});

assert.equal(residualDeferredRules, 0, "Global CSS still contains a non-layer panel-owned rule.");
assert.equal(retainedLayeredRules, 31, "The 31 Tailwind-layer panel rules must remain global.");
assert.equal(retainedResponsiveStructureRules, 2, "The two shared responsive-structure rules must remain global.");
assert.equal(retainedTopLevelMixedRules, 9, "The nine mixed-selector rules must remain global.");
assert.equal(
  retainedTopLevelMixedRules + retainedResponsiveStructureRules,
  11,
  "All 11 audited mixed/shared rules must remain global.",
);
assert.equal(
  retainedOptionalSharedRules,
  6,
  "The four optional shared table-header adapters and two shared operation-grid states must remain global.",
);

for (const pattern of [
  /\.product-module-card-content,\s*\.product-module-nested-list,\s*\.navigation-card-content/u,
  /\.template-config-section-title,\s*\.template-config-table-header/u,
  /\.nav-level-secondary \.adaptive-work-matrix-pill,\s*\.product-module-child-card \.adaptive-work-matrix-pill/u,
  /\.product-module-list,\s*body \[data-product-market-workspace\][\s\S]*?\[data-template-config-card-list="true"\]/u,
  /\[data-responsive-structure-item="module"\] > \.product-module-card-content > \[data-template-module-split\],[\s\S]*?\[data-responsive-structure-item="module"\] > \[data-template-module-split\]/u,
]) {
  assert.match(globalCss, pattern, `Global CSS lost a mixed/shared rule: ${pattern}`);
  assert.doesNotMatch(deferredCss, pattern, `Deferred CSS captured a mixed/shared rule: ${pattern}`);
}

await postcss([tailwindcss]).process(deferredCss, {
  from: "src/components/product-market/ProductMarketModulesPanel.css",
});
assert.ok(!deferredCss.includes("\uFFFD"), "ProductMarketModulesPanel CSS contains a replacement character.");

console.log("ProductMarketModulesPanel deferred CSS contract verified.");
