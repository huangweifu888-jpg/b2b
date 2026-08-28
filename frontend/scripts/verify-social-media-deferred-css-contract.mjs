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
const socialMedia = read("src/pages/SocialMedia.tsx");
const deferredCss = read("src/pages/SocialMedia.css");
const globalCss = read("src/index.css");
const ROUTE_ANCHORS = new Set([
  "data-social-media-workspace",
  "data-social-media-content",
  "data-social-media-title-header",
]);

const selectorNodeRequiresRoute = (selectorNode) => {
  for (const node of selectorNode.nodes) {
    if (node.type === "class" && ROUTE_ANCHORS.has(node.value)) return true;
    if (node.type === "attribute" && ROUTE_ANCHORS.has(node.attribute)) return true;
    if (
      node.type === "pseudo"
      && [":is", ":where", ":has"].includes(node.value)
      && node.nodes?.length
      && node.nodes.every(selectorNodeRequiresRoute)
    ) {
      return true;
    }
  }
  return false;
};

const selectorRequiresRoute = (selector) => {
  let owned = true;
  selectorParser((root) => {
    owned = root.nodes.every(selectorNodeRequiresRoute);
  }).processSync(selector);
  return owned;
};

assert.match(
  app,
  /const SocialMediaPage = lazyPage\(\(\) => import\("\.\/pages\/SocialMedia"\)\);/u,
  "SocialMedia must remain behind the application lazy-page boundary.",
);
assert.match(
  socialMedia,
  /import "\.\/SocialMedia\.css";/u,
  "The SocialMedia lazy chunk must own its route-only stylesheet.",
);
assert.doesNotMatch(app, /SocialMedia\.css/u, "The router must not statically import SocialMedia CSS.");
assert.doesNotMatch(main, /SocialMedia\.css/u, "The application entry must not statically import SocialMedia CSS.");
assert.deepEqual(
  collectSourceFiles(sourceRoot)
    .filter((path) => /\.[cm]?[jt]sx?$/u.test(path))
    .filter((path) => readFileSync(path, "utf8").includes("SocialMedia.css"))
    .map((path) => relative(sourceRoot, path).replaceAll("\\", "/")),
  ["pages/SocialMedia.tsx"],
  "Only the lazy SocialMedia page may import its stylesheet.",
);
assert.deepEqual(
  collectSourceFiles(sourceRoot)
    .filter((path) => /\.tsx$/u.test(path))
    .filter((path) => {
      const source = readFileSync(path, "utf8");
      return [...ROUTE_ANCHORS].some((anchor) => source.includes(anchor));
    })
    .map((path) => relative(sourceRoot, path).replaceAll("\\", "/")),
  ["pages/SocialMedia.tsx"],
  "The deferred SocialMedia route anchors must keep one JSX producer.",
);

assert.deepEqual(
  collectSourceFiles(sourceRoot)
    .filter((path) => /\.tsx$/u.test(path))
    .filter((path) => readFileSync(path, "utf8").includes("data-social-marketing-stage-rail"))
    .map((path) => relative(sourceRoot, path).replaceAll("\\", "/")),
  ["components/social/SocialMarketingPlaybook.tsx"],
  "The deferred marketing-stage selectors must keep one component consumer.",
);
assert.deepEqual(
  collectSourceFiles(sourceRoot)
    .filter((path) => /\.tsx$/u.test(path))
    .filter((path) => readFileSync(path, "utf8").includes("@/components/social/SocialMarketingPlaybook"))
    .map((path) => relative(sourceRoot, path).replaceAll("\\", "/")),
  ["pages/SocialMedia.tsx"],
  "The marketing playbook must remain owned by the SocialMedia route.",
);

assert.ok(
  Buffer.byteLength(deferredCss, "utf8") >= 7 * 1024,
  "SocialMedia deferred CSS must remain a meaningful route-only split.",
);

for (const token of [
  "/* Social Media uses the same editable Title / Header contracts as Product Market.",
  "[data-social-create-publish-task] {",
  "[data-social-marketing-stage-state=\"complete\"] {",
  "/* Social Media is a direct consumer of the Operations shared-frame contract.",
  "[data-social-media-title-header][data-page-title=\"social-media\"] {",
  "/* Social Media is a consumer of the Operations workspace, not a special",
  "[data-social-media-workspace][data-shared-page-workspace] > [data-social-media-content][data-page-list] {",
]) {
  assert.ok(deferredCss.includes(token), `Deferred CSS is missing its owned rule: ${token}`);
  assert.ok(!globalCss.includes(token), `Global CSS still contains the deferred-only rule: ${token}`);
}

const deferredRoot = postcss.parse(deferredCss, { from: "src/pages/SocialMedia.css" });
deferredRoot.walkRules((rule) => {
  for (const selector of rule.selectors ?? [rule.selector]) {
    assert.ok(
      selector.includes("data-social-") || selector.includes("client-social"),
      `Deferred CSS contains a selector without SocialMedia ownership: ${selector}`,
    );
  }
});
const globalRoot = postcss.parse(globalCss, { from: "src/index.css" });

const migratedEnd = deferredCss.indexOf(
  "/* Social Media uses the same editable Title / Header contracts as Product Market.",
);
assert.ok(migratedEnd > 0, "The migrated SocialMedia route base must precede its existing overrides.");
const migratedCss = deferredCss.slice(0, migratedEnd);
const migratedRoot = postcss.parse(migratedCss, { from: "src/pages/SocialMedia.css#route-base" });
let migratedRuleCount = 0;
migratedRoot.walkAtRules("layer", (atRule) => {
  assert.fail(`The migrated SocialMedia route base must not contain @layer ${atRule.params}.`);
});
migratedRoot.walkRules((rule) => {
  migratedRuleCount += 1;
  assert.ok(
    selectorRequiresRoute(rule.selector),
    `Migrated SocialMedia CSS contains a selector without mandatory route ownership: ${rule.selector}`,
  );
});
assert.equal(migratedRuleCount, 19, "The audited 19 SocialMedia route-owned rules must stay deferred.");

let residualRouteRules = 0;
globalRoot.walkRules((rule) => {
  if (selectorRequiresRoute(rule.selector)) residualRouteRules += 1;
});
assert.equal(residualRouteRules, 0, "Global CSS still contains a SocialMedia route-owned rule.");

for (const token of [
  "/* Social Media is a direct single workspace.  ClientSourceLayout's generic",
  '#root [data-client-source-shell] .app-main > [data-responsive-page-host] > [data-page-factory-page-id^="client-social"] {',
  '#root [data-client-source-shell] .app-main > [data-page-factory-page-id^="client-social"] {',
  "Shared Operations workspace",
  "#root [data-shared-page-workspace] > [data-shared-layout-section=\"title\"] {",
  "#root [data-shared-page-workspace]::after {",
]) {
  assert.ok(globalCss.includes(token), `Global CSS lost a structural/shared rule: ${token}`);
  assert.ok(!deferredCss.includes(token), `Deferred CSS captured a structural/shared rule: ${token}`);
}

assert.ok(
  deferredCss.startsWith("/* Route-owned SocialMedia workspace base moved out of the global entry stylesheet. */"),
  "The migrated SocialMedia route base must remain before the existing final overrides.",
);

const initialTitleRule = deferredCss.indexOf(
  '#root [data-social-media-workspace] [data-social-media-title-header] {',
);
const finalTitleRule = deferredCss.indexOf(
  '#root [data-client-source-shell] [data-social-media-title-header][data-page-title="social-media"] {',
);
const initialHeaderRule = deferredCss.indexOf(
  '#root [data-social-media-workspace] [data-client-project-subnav][data-page-table-header] {',
);
const finalHeaderRule = deferredCss.indexOf(
  'html[data-tradepro-page-shared-table-header="true"]\n  #root [data-client-source-shell] [data-social-media-workspace] [data-client-project-subnav][data-page-table-header] {',
);
const finalWorkspaceBridge = deferredCss.indexOf(
  '#root [data-client-source-shell] [data-social-media-workspace][data-shared-page-workspace] {',
);
assert.ok(
  initialTitleRule >= 0 && initialTitleRule < finalTitleRule,
  "The final SocialMedia title authority must remain after its theme rule.",
);
assert.ok(
  initialHeaderRule >= 0 && initialHeaderRule < finalHeaderRule,
  "The final SocialMedia table-header authority must remain after its theme rule.",
);
assert.ok(
  finalHeaderRule >= 0 && finalHeaderRule < finalWorkspaceBridge,
  "The final SocialMedia workspace bridge must remain last among deferred route overrides.",
);

assert.ok(!deferredCss.includes("\uFFFD"), "SocialMedia CSS contains a replacement character.");

console.log("SocialMedia deferred CSS contract verified.");
