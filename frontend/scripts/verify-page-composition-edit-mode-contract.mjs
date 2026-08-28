import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const mode = read("src/lib/page-composition-edit-mode.ts");
const productMarket = `${read("src/pages/ProductMarket.tsx")}\n${read("src/components/product-market/ProductMarketDevelopmentGuidePanel.tsx")}`;

for (const value of [
  '"configure" | "preview"',
  '"global-style-write-from-preview"',
  "export function getPageCompositionEditModeContract",
]) {
  if (!mode.includes(value)) throw new Error(`Page composition edit-mode contract is missing: ${value}`);
}
for (const value of ["data-page-composition-edit-mode", "data-page-composition-mode-switch", "readOnly={mode === \"preview\"}"]) {
  if (!productMarket.includes(value)) throw new Error(`Development guide must wire edit modes: ${value}`);
}

console.log("Page composition edit-mode contract verified.");
