import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sourceRoot = fileURLToPath(new URL("../src", import.meta.url));
const collectSourceFiles = (directory) => readdirSync(directory).flatMap((entry) => {
  const absolutePath = join(directory, entry);
  return statSync(absolutePath).isDirectory() ? collectSourceFiles(absolutePath) : [absolutePath];
});

const app = read("src/App.tsx");
const main = read("src/main.tsx");
const siteSettings = read("src/pages/SiteSettings.tsx");
const deferredCss = read("src/pages/SiteSettings.css");
const globalCss = read("src/index.css");

const selectorNodeRequiresSiteSettings = (selectorNode) => {
  for (const node of selectorNode.nodes) {
    if (node.type === "attribute" && node.attribute === "data-site-settings-standard") return true;
    if (
      node.type === "pseudo"
      && [":is", ":where", ":has"].includes(node.value)
      && node.nodes?.length
      && node.nodes.every(selectorNodeRequiresSiteSettings)
    ) {
      return true;
    }
  }
  return false;
};

const selectorRequiresSiteSettings = (selector) => {
  let owned = true;
  selectorParser((root) => {
    owned = root.nodes.every(selectorNodeRequiresSiteSettings);
  }).processSync(selector);
  return owned;
};

assert.match(
  app,
  /const SiteSettingsPage = lazyPage\(\(\) => import\("\.\/pages\/SiteSettings"\)\);/u,
  "SiteSettings must remain behind the application lazy-page boundary.",
);
assert.match(
  siteSettings,
  /import "\.\/SiteSettings\.css";/u,
  "The SiteSettings lazy chunk must own its route-only stylesheet.",
);
assert.doesNotMatch(
  app,
  /SiteSettings\.css/u,
  "The application router must not statically import SiteSettings CSS.",
);
assert.doesNotMatch(
  main,
  /SiteSettings\.css/u,
  "The application entry must not statically import SiteSettings CSS.",
);
assert.deepEqual(
  collectSourceFiles(sourceRoot)
    .filter((path) => /\.[cm]?[jt]sx?$/u.test(path))
    .filter((path) => readFileSync(path, "utf8").includes("SiteSettings.css"))
    .map((path) => relative(sourceRoot, path).replaceAll("\\", "/")),
  ["pages/SiteSettings.tsx"],
  "Only the lazy SiteSettings page may import its stylesheet.",
);
assert.deepEqual(
  collectSourceFiles(sourceRoot)
    .filter((path) => /\.tsx$/u.test(path))
    .filter((path) => readFileSync(path, "utf8").includes("data-site-settings-standard"))
    .map((path) => relative(sourceRoot, path).replaceAll("\\", "/")),
  ["pages/SiteSettings.tsx"],
  "The deferred SiteSettings route anchor must keep one JSX producer.",
);

assert.ok(
  Buffer.byteLength(deferredCss, "utf8") >= 5 * 1024,
  "SiteSettings deferred CSS must remain a meaningful route-only split.",
);

for (const token of [
  "/* Site settings intentionally keeps the earlier standard management layout.",
  "#root [data-site-settings-standard] .site-settings-title-sortable-action.is-dragging {",
  "body .site-settings-redirect-dialog {",
  "#root [data-site-settings-standard] .site-settings-redirect-order-actions {",
  "#root [data-site-settings-standard] .site-settings-redirect-row.is-dragging {",
]) {
  assert.ok(deferredCss.includes(token), `Deferred CSS is missing its owned rule: ${token}`);
  assert.ok(!globalCss.includes(token), `Global CSS still contains the deferred-only rule: ${token}`);
}

const migratedEnd = deferredCss.indexOf(
  "/* The standard site-settings page exposes the same semantic anchors as the",
);
assert.ok(migratedEnd > 0, "The migrated SiteSettings route base must precede the shared-frame prefix.");
const migratedCss = deferredCss.slice(0, migratedEnd);
const migratedRoot = postcss.parse(migratedCss, { from: "src/pages/SiteSettings.css#route-base" });
let migratedRuleCount = 0;
migratedRoot.walkAtRules("layer", (atRule) => {
  assert.fail(`The migrated SiteSettings route base must not contain @layer ${atRule.params}.`);
});
migratedRoot.walkRules((rule) => {
  migratedRuleCount += 1;
  assert.ok(
    selectorRequiresSiteSettings(rule.selector),
    `Migrated SiteSettings CSS contains a selector without mandatory route ownership: ${rule.selector}`,
  );
});
assert.equal(migratedRuleCount, 15, "The audited 15 SiteSettings route-owned rules must stay deferred.");
assert.ok(
  deferredCss.startsWith("/* Route-owned SiteSettings base moved out of the global entry stylesheet. */"),
  "The migrated SiteSettings route base must remain before the shared-frame and final overrides.",
);

const deferredRoot = postcss.parse(deferredCss, { from: "src/pages/SiteSettings.css" });
deferredRoot.walkRules((rule) => {
  for (const selector of rule.selectors ?? [rule.selector]) {
    assert.ok(
      selector.includes("site-settings-") || selector.includes("[data-site-settings-standard]"),
      `Deferred CSS contains a selector without SiteSettings ownership: ${selector}`,
    );
    for (const sharedOwner of [
      ".navigation-customization-panel",
      "[data-client-source-shell]",
      "[data-client-runtime-shell]",
      "[data-client-project-frame]",
      "[data-product-market",
      "[data-platform-frame-scope]",
      ".app-topbar",
    ]) {
      assert.ok(
        !selector.includes(sharedOwner),
        `Deferred CSS captured a shared or mixed consumer selector: ${selector}`,
      );
    }
  }
});

const globalRoot = postcss.parse(globalCss, { from: "src/index.css" });
let residualRouteRules = 0;
globalRoot.walkRules((rule) => {
  if (selectorRequiresSiteSettings(rule.selector)) residualRouteRules += 1;
});
assert.equal(residualRouteRules, 0, "Global CSS still contains a SiteSettings route-owned rule.");
assert.match(
  globalCss,
  /#root :is\(\s*\[data-client-project-frame\],\s*\[data-site-settings-standard\] \[data-page-layout-frame\]\s*\)/u,
  "The shared project/SiteSettings workspace rule must remain global.",
);
assert.match(
  globalCss,
  /#root :is\(\s*\.product-market-scroll-list,[\s\S]*?\[data-site-settings-standard\] \.site-settings-redirect-list\s*\)/u,
  "The mixed-consumer scroll surface rule must remain global.",
);
assert.ok(!deferredCss.includes("\uFFFD"), "SiteSettings CSS contains a replacement character.");

console.log("SiteSettings deferred CSS contract verified.");
