import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const [guide, productMarket, productMarketDevelopmentGuide] = await Promise.all([
  readFile(resolve(root, "src/lib/new-content-plugin-guide.ts"), "utf8"),
  readFile(resolve(root, "src/pages/ProductMarket.tsx"), "utf8"),
  readFile(resolve(root, "src/components/product-market/ProductMarketDevelopmentGuidePanel.tsx"), "utf8"),
]);
const productMarketDevelopmentSource = `${productMarket}\n${productMarketDevelopmentGuide}`;

for (const token of ["buildNewContentPluginGuide", "CONTENT_PLUGIN_DEFINITIONS", "previewAnchor", "supports", "requires", "shared-css", "draft-only-until-page-apply"]) {
  if (!guide.includes(token)) throw new Error(`New-content-plugin guide is missing: ${token}`);
}
for (const token of ["buildNewContentPluginGuide", "data-plugin-capability-boundary", "data-plugin-capability-item"]) {
  if (!productMarketDevelopmentSource.includes(token)) throw new Error(`Development guide must expose plugin capability boundaries: ${token}`);
}

console.log("New content-plugin guide contract verified.");
