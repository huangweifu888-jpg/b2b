import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const impactMap = read("src/lib/page-composition-impact-map.ts");
const productMarket = `${read("src/pages/ProductMarket.tsx")}\n${read("src/components/product-market/ProductMarketDevelopmentGuidePanel.tsx")}`;

for (const value of [
  "export type PageCompositionImpactMap",
  '"template-downstream-only"',
  '"downstream-custom-data"',
  '"runtime-pages-cannot-publish"',
  "export function buildPageCompositionImpactMap",
]) {
  if (!impactMap.includes(value)) throw new Error(`Page composition impact-map contract is missing: ${value}`);
}

for (const value of ["data-page-composition-impact-map", "data-composition-impact-surface", "buildPageCompositionImpactMap"]) {
  if (!productMarket.includes(value)) throw new Error(`Development guide impact-map preview is missing: ${value}`);
}

console.log("Page composition impact-map contract verified.");
