import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sourceRoot = fileURLToPath(new URL("../src", import.meta.url));
const collectSourceFiles = (directory) => readdirSync(directory).flatMap((entry) => {
  const absolutePath = join(directory, entry);
  return statSync(absolutePath).isDirectory() ? collectSourceFiles(absolutePath) : [absolutePath];
});

const main = read("src/main.tsx");
const companyInfo = read("src/pages/CompanyInfo.tsx");
const deferredPanels = read("src/pages/CompanyInfoDeferredPanels.tsx");
const deferredCss = read("src/pages/CompanyInfoDeferredPanels.css");
const globalCss = read("src/index.css");

assert.match(
  companyInfo,
  /const DeferredCompanyInfoPanels = lazy\(\(\) => loadLazyModule\([\s\S]*?\(\) => import\("\.\/CompanyInfoDeferredPanels"\)/u,
  "CompanyInfo must keep non-navigation panels behind its lazy boundary.",
);
assert.match(
  companyInfo,
  /if \(activeTab === "navigation"\)[\s\S]*?return \([\s\S]*?<NavigationMatrixEditorV2[\s\S]*?\);[\s\S]*?return \([\s\S]*?<Suspense[\s\S]*?<DeferredCompanyInfoPanels/u,
  "The navigation tab must render before the deferred panel branch.",
);
assert.match(
  deferredPanels,
  /import "\.\/CompanyInfoDeferredPanels\.css";/u,
  "The deferred panel chunk must own its Banner/Modules stylesheet.",
);
assert.doesNotMatch(
  companyInfo,
  /CompanyInfoDeferredPanels\.css/u,
  "The CompanyInfo shell must not statically import deferred CSS.",
);
assert.doesNotMatch(
  main,
  /CompanyInfoDeferredPanels\.css/u,
  "The application entry must not statically import deferred CSS.",
);
assert.deepEqual(
  collectSourceFiles(sourceRoot)
    .filter((path) => /\.[cm]?[jt]sx?$/u.test(path))
    .filter((path) => readFileSync(path, "utf8").includes("CompanyInfoDeferredPanels.css"))
    .map((path) => relative(sourceRoot, path).replaceAll("\\", "/")),
  ["pages/CompanyInfoDeferredPanels.tsx"],
  "Only the deferred panel chunk may import the Banner/Modules stylesheet.",
);

for (const token of [
  ".page-banner-management-table",
  '[data-company-info-tab="banner"]',
  '[data-company-info-tab="modules"]',
  "[data-company-module-shared-workspace]",
]) {
  assert.ok(deferredCss.includes(token), `Deferred CSS is missing its owned selector: ${token}`);
}

for (const token of [
  "#root .page-banner-management-table .page-banner-content-actions {",
  '[data-company-info-tab="modules"] [data-company-module-shared-workspace]',
  '[data-company-info-tab="banner"] [data-page-content-kind="banner"]',
]) {
  assert.ok(!globalCss.includes(token), `Global CSS still contains deferred-only selector: ${token}`);
}

for (const token of [
  '[data-company-info-shared-workspace="true"]',
  '[data-company-info-tab="navigation"]',
  "[data-company-info-navigation-workspace]",
  ".adaptive-work-matrix-operation-grid",
]) {
  assert.ok(globalCss.includes(token), `Global CSS lost shared/navigation selector: ${token}`);
}

assert.ok(!deferredCss.includes("\uFFFD"), "Deferred CSS contains a replacement character.");

console.log("CompanyInfo deferred CSS contract verified.");
