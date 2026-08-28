import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import postcss from "postcss";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sourceRoot = fileURLToPath(new URL("../src", import.meta.url));
const collectSourceFiles = (directory) => readdirSync(directory).flatMap((entry) => {
  const absolutePath = join(directory, entry);
  return statSync(absolutePath).isDirectory() ? collectSourceFiles(absolutePath) : [absolutePath];
});

const widget = read("src/components/AIServiceWidget.tsx");
const lazyWidget = read("src/components/LazyAIServiceWidget.tsx");
const deferredCss = read("src/components/AIServiceWidget.css");
const globalCss = read("src/index.css");
const developmentStandardGates = read("scripts/run-development-standard-gates.mjs");
const packageJson = JSON.parse(read("package.json"));

assert.match(
  lazyWidget,
  /const AIServiceWidget = lazy\(\(\) => import\("\.\/AIServiceWidget"\)\);/u,
  "AIServiceWidget must remain behind its React lazy boundary.",
);
assert.match(
  widget,
  /import "\.\/AIServiceWidget\.css";/u,
  "The lazy AIServiceWidget module must own its deferred stylesheet.",
);
assert.deepEqual(
  collectSourceFiles(sourceRoot)
    .filter((path) => /\.[cm]?[jt]sx?$/u.test(path))
    .filter((path) => readFileSync(path, "utf8").includes("AIServiceWidget.css"))
    .map((path) => relative(sourceRoot, path).replaceAll("\\", "/")),
  ["components/AIServiceWidget.tsx"],
  "Only the dynamically imported AIServiceWidget module may import its stylesheet.",
);
assert.deepEqual(
  collectSourceFiles(sourceRoot)
    .filter((path) => /\.tsx$/u.test(path))
    .filter((path) => readFileSync(path, "utf8").includes("data-ai-service-drag-root"))
    .map((path) => relative(sourceRoot, path).replaceAll("\\", "/")),
  ["components/AIServiceWidget.tsx"],
  "The deferred floating-chat root must keep exactly one component consumer.",
);

assert.ok(
  Buffer.byteLength(deferredCss, "utf8") >= 10 * 1024,
  "AIServiceWidget deferred CSS must remain a meaningful component-only split.",
);

for (const token of [
  "#root .ai-service-launcher {",
  "/* Client Source normally clears inactive action buttons inside #root.",
  "[data-ai-service-confirm-expert-switch] {",
  "/* Floating customer-service chat consumes the same 8px dialog rhythm",
  "/* compact-popup-icon-centering-v1:",
  "[data-ai-service-send] {",
]) {
  assert.ok(deferredCss.includes(token), `Deferred CSS is missing its owned rule: ${token}`);
  assert.ok(!globalCss.includes(token), `Global CSS still contains the deferred-only rule: ${token}`);
}

const deferredRoot = postcss.parse(deferredCss, { from: "src/components/AIServiceWidget.css" });
let deferredRuleCount = 0;
deferredRoot.walkRules((rule) => {
  deferredRuleCount += 1;
  for (const selector of rule.selectors ?? [rule.selector]) {
    assert.match(
      selector,
      /(?:data-ai-service|ai-service-launcher)/u,
      `Deferred CSS contains a selector without AIServiceWidget ownership: ${selector}`,
    );
  }
});
assert.equal(deferredRuleCount, 20, "AIServiceWidget deferred CSS must retain the audited 20 owned rules.");

assert.doesNotMatch(
  globalCss,
  /data-ai-service-drag-root/u,
  "Global CSS must not regain floating-chat component-only rules.",
);
assert.match(
  globalCss,
  /@media \(max-width: 520px\) \{[\s\S]*?\.ai-service-launcher \{[\s\S]*?width: 2\.25rem !important;/u,
  "The layered compact launcher override must remain global.",
);
assert.doesNotMatch(
  deferredCss,
  /width: 2\.25rem !important;/u,
  "The deferred stylesheet must not capture the layered compact launcher override.",
);

for (const token of [
  "--tradepro-shared-expert-launcher-avatar-size: 64px;",
  "#root [data-shared-window-contract],",
  "/* Customer-service chat uses the same canonical portrait frame as the",
  '[data-shared-window-footer-locks] [data-responsive-footer-lock-control] {',
]) {
  assert.ok(globalCss.includes(token), `Global CSS lost a shared contract rule: ${token}`);
  assert.ok(!deferredCss.includes(token), `Deferred CSS captured a shared contract rule: ${token}`);
}

postcss.parse(globalCss, { from: "src/index.css" });
assert.ok(!deferredCss.includes("\uFFFD"), "AIServiceWidget CSS contains a replacement character.");

assert.ok(
  developmentStandardGates.includes('"verify-ai-service-widget-deferred-css-contract.mjs"'),
  "The AIServiceWidget CSS contract must remain registered in development-standard gates.",
);
assert.equal(
  packageJson.scripts["verify:ai-service-widget-deferred-css"],
  "node scripts/verify-ai-service-widget-deferred-css-contract.mjs",
  "package.json must expose the focused AIServiceWidget CSS contract.",
);

console.log("AIServiceWidget deferred CSS contract verified.");
