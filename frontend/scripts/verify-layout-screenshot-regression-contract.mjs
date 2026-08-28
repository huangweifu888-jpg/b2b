import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFile(resolve(root, file), "utf8");
const [manifest, baselines, roadmap, visualCheck, productMarket, developmentPanels] = await Promise.all([
  read("src/lib/layout-screenshot-regressions.ts"),
  read("src/lib/layout-quality-baselines.ts"),
  read("src/lib/layout-roadmap.ts"),
  read("scripts/verify-product-market-visual-baseline.mjs"),
  read("src/pages/ProductMarket.tsx"),
  read("src/components/product-market/DevelopmentStandardPanels.tsx"),
]);

for (const id of ["homepage-banner", "domain-register", "crm-summary"]) {
  if (!manifest.includes(`id === "${id}"`) && !baselines.includes(`id: "${id}"`)) {
    throw new Error(`Screenshot regression baseline is missing: ${id}`);
  }
}
for (const region of ["主体", "标题", "表头", "内容", "右侧滚条", "尾栏"]) {
  if (!manifest.includes(`"${region}"`)) throw new Error(`Screenshot regression region is missing: ${region}`);
}
if (!manifest.includes("LAYOUT_QUALITY_BASELINES") || !manifest.includes("PRODUCT_MARKET_FRAME_ACCEPTANCE")) {
  throw new Error("Screenshot baselines must reuse the Quality Center baseline map.");
}
for (const token of ["PRODUCT_MARKET_NAV_ITEMS.map", "id: `product-market-${tab}`", "route: `/zb/client-source/product-market?tab=${tab}`"]) {
  if (!baselines.includes(token)) throw new Error(`Product Market screenshot baseline source is missing: ${token}`);
}
if (!roadmap.includes('completed(46, "截图回归"')) {
  throw new Error("Screenshot regression roadmap step must be completed only after browser verification.");
}
for (const token of ["product-market?tab=operations", "product-market?tab=modules", "product-market?tab=layout", "product-market?tab=service", "data-page-layout-frame", "legacy dialog bridge"]) {
  if (!visualCheck.includes(token)) throw new Error(`Actual Product Market visual baseline coverage is missing: ${token}`);
}
for (const token of ["data-screenshot-regression-baseline", "data-screenshot-regression-target", "LAYOUT_SCREENSHOT_REGRESSIONS", "截图回归基线"]) {
  if (!`${productMarket}\n${developmentPanels}`.includes(token)) throw new Error(`Development guide visual baseline coverage is missing: ${token}`);
}
if (!manifest.includes('recovery: "开发规范"')) throw new Error("Screenshot issues must recover through Development Specification instead of retired tools.");
for (const token of ["frame.sandbox.add", "allow-scripts", "allow-same-origin"]) {
  if (!manifest.includes(token)) throw new Error(`Registered-page scan isolation is missing: ${token}`);
}

const history = await read("src/lib/layout-page-scan-history.ts");
for (const token of ["SCAN_HISTORY_LIMIT = 10", "recordLayoutPageScanHistory", "getRuntimeFrameIssues", "business data", "downstream custom data"]) {
  if (!history.includes(token)) throw new Error(`Layout scan history contract is missing: ${token}`);
}

const visualContractE2e = await read("e2e/visual-contract.spec.ts");
for (const token of [
  "homepage-banner-frame.png",
  "homepage-banner-move-hover.png",
  "homepage-banner-mobile-visual.png",
  "toHaveScreenshot",
  "maxDiffPixelRatio: 0.01",
  "data-visual-plugin-preview-state",
  "data-visual-card-permission",
  "toBeDisabled",
]) {
  if (!visualContractE2e.includes(token)) throw new Error(`Automatic visual contract regression is missing: ${token}`);
}

console.log("截图回归合同通过：首页大图等关键页统一核对主体、标题、表头、内容、滚条与尾栏。");
