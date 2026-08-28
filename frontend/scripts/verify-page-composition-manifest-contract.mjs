import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const manifest = read("src/lib/page-composition-manifest.ts");
const compositionIdentity = read("src/lib/page-composition-identity.ts");
const routeIdentity = read("src/lib/page-route-identity.ts");
const productMarket = read("src/pages/ProductMarket.tsx");
const productMarketDevelopmentGuide = read("src/components/product-market/ProductMarketDevelopmentGuidePanel.tsx");

for (const value of [
  "export type PageCompositionManifest",
  "schemaVersion: 1",
  'direction: "template-downstream-only"',
  '"business-data-and-downstream-custom-data-stay-page-owned"',
  "export function canPublishPageComposition",
  "isSourcePageLayoutContract(route)",
]) {
  if (!manifest.includes(value)) throw new Error(`Page composition manifest contract is missing: ${value}`);
}
if (
  !manifest.includes("resolvePageCompositionStructuralRoute(pathname, search)")
  || !compositionIdentity.includes("normalizePageFrameSearch(pathname, search)")
  || !routeIdentity.includes('"capability"')
  || !routeIdentity.includes("CONTENT_LIBRARY_SHARED_FRAME_PATHS")
) {
  throw new Error("Capability subviews and content-library tabs must share the path-aware structural composition identity of their registered page.");
}

if (!productMarketDevelopmentGuide.includes("data-product-market-composition-manifest")) {
  throw new Error("Development guide must render its composition manifest example.");
}
if (!productMarketDevelopmentGuide.includes("buildPageCompositionManifest")) {
  throw new Error("Development guide must read the composition manifest through the shared helper.");
}
for (const value of ["data-new-page-composition-wizard", "data-new-page-route", "data-new-page-register", "registerPageLayoutContract"]) {
  if (!productMarketDevelopmentGuide.includes(value)) throw new Error(`Development guide new-page wizard is missing: ${value}`);
}
if (!productMarket.includes('import("@/components/product-market/ProductMarketDevelopmentGuidePanel")')) {
  throw new Error("Development guide must remain behind the Product Market lazy boundary.");
}

console.log("Page composition manifest contract verified.");
