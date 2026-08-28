import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postcss from "postcss";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const app = read("src/App.tsx");
const siteSettings = read("src/pages/SiteSettings.tsx");
const deferredCss = read("src/pages/SiteSettings.css");
const globalCss = read("src/index.css");

assert.match(
  app,
  /const SiteSettingsPage = lazyPage\(\(\) => import\("\.\/pages\/SiteSettings"\)\);/u,
  "SiteSettings must remain behind the application lazy-page boundary.",
);
assert.match(
  siteSettings,
  /import "\.\/SiteSettings\.css";/u,
  "The lazy SiteSettings route must keep ownership of its stylesheet.",
);

const laterRouteMarker = "/* Site settings intentionally keeps the earlier standard management layout.";
const sharedFrameMarker = "/* The standard site-settings page exposes the same semantic anchors as the";
const sharedFrameStart = deferredCss.indexOf(sharedFrameMarker);
const prefixEnd = deferredCss.indexOf(laterRouteMarker);
assert.ok(sharedFrameStart > 0, "The migrated route base must remain before the SiteSettings shared-frame prefix.");
assert.ok(prefixEnd > sharedFrameStart, "The original SiteSettings route rules must remain after the shared-frame prefix.");
const sharedFramePrefix = deferredCss.slice(sharedFrameStart, prefixEnd);
assert.ok(
  Buffer.byteLength(sharedFramePrefix, "utf8") >= 12 * 1024,
  "The deferred shared-frame prefix must remain a meaningful route-only split.",
);

for (const token of [
  "/* The standard site-settings page exposes the same semantic anchors as the",
  'html[data-tradepro-page-layout="active"][data-tradepro-page-layout-plugin="shared-frame"] #root [data-site-settings-standard] {',
  'html[data-tradepro-page-layout="active"][data-tradepro-page-layout-plugin="shared-frame"] #root [data-site-settings-standard] [data-page-layout-frame] {',
  'html[data-tradepro-page-layout="active"][data-tradepro-page-layout-plugin="shared-frame"] #root [data-site-settings-standard] [data-page-title-search]::placeholder {',
  'html[data-tradepro-page-layout="active"][data-tradepro-page-layout-plugin="shared-frame"] #root [data-site-settings-standard] [data-page-layout-footer-status] {',
]) {
  assert.ok(sharedFramePrefix.includes(token), `Deferred CSS is missing its shared-frame rule: ${token}`);
  assert.ok(!globalCss.includes(token), `Global CSS still contains the deferred-only rule: ${token}`);
}

const prefixRoot = postcss.parse(sharedFramePrefix, {
  from: "src/pages/SiteSettings.css#shared-frame-prefix",
});
prefixRoot.walkRules((rule) => {
  for (const selector of rule.selectors ?? [rule.selector]) {
    assert.ok(
      selector.includes('[data-tradepro-page-layout-plugin="shared-frame"]')
        && selector.includes("[data-site-settings-standard]"),
      `Deferred prefix contains a selector outside the SiteSettings shared-frame boundary: ${selector}`,
    );
  }
});

for (const token of [
  "/* The standard topbar keeps the navigation-customization treatment: the shell",
  'html[data-tradepro-page-layout="active"][data-tradepro-page-layout-plugin="shared-frame"] #root .app-topbar {',
  "/* Reusable visual frame learned from Homepage Design -> Navigation Customization.",
  'html[data-tradepro-page-layout-plugin="navigation-frame"] #root [data-page-layout-frame] {',
]) {
  assert.ok(globalCss.includes(token), `Global CSS lost a shared or navigation-frame rule: ${token}`);
  assert.ok(!sharedFramePrefix.includes(token), `Deferred prefix captured a shared rule: ${token}`);
}

assert.match(
  globalCss,
  /#root :is\(\s*\[data-client-project-frame\],\s*\[data-site-settings-standard\] \[data-page-layout-frame\]\s*\)/u,
  "The shared project/SiteSettings workspace rule must remain global.",
);

assert.ok(!sharedFramePrefix.includes(".app-topbar"), "Shared topbar rules must remain global.");
assert.ok(
  !sharedFramePrefix.includes('[data-tradepro-page-layout-plugin="navigation-frame"]'),
  "Navigation-frame rules must remain after the deferred shared-frame prefix.",
);

postcss.parse(deferredCss, { from: "src/pages/SiteSettings.css" });
postcss.parse(globalCss, { from: "src/index.css" });
assert.ok(!sharedFramePrefix.includes("\uFFFD"), "SiteSettings shared-frame CSS contains a replacement character.");

console.log("SiteSettings shared-frame deferred CSS contract verified.");
