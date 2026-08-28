import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFile(resolve(root, file), "utf8");
const assertIncludes = (source, expected, label) => {
  if (!source.includes(expected)) throw new Error(`Source Market engine contract missing: ${label}`);
};

const [market, config, css, profiles, store, hqSidebar, agencySourceSidebar, lifecycle] = await Promise.all([
  read("src/pages/ProductMarket.tsx"),
  read("src/lib/product-market-config.ts"),
  read("src/index.css"),
  read("src/lib/page-layout-overrides.ts"),
  read("src/lib/product-market-store.ts"),
  read("src/components/HQSidebar.tsx"),
  read("src/components/AgencySourceSidebar.tsx"),
  read("src/lib/product-market-template-lifecycle-contract.ts"),
]);

// One UI engine, three independent catalogues.  This contract intentionally
// prevents a later page-specific rewrite from reintroducing duplicated source
// pages or from copying client website applications into an agency catalogue.
assertIncludes(market, 'data-product-market-engine="shared"', "shared source-market engine marker");
assertIncludes(market, "SOURCE_WORKSPACE_GROUPS", "source-owned business grouping");
if (market.includes("const SOURCE_WORKSPACE_GROUPS")) {
  throw new Error("Source Market engine contract duplicated source category definitions inside ProductMarket");
}
assertIncludes(store, "export const SOURCE_WORKSPACE_GROUPS", "single source workspace category contract");
assertIncludes(store, "buildSourceWorkspaceCategoryOrderMap", "shared source category order map");
assertIncludes(store, "[key, index + 1]", "ascending source category numbering from 01");
if (/buildSourceWorkspaceCategoryDisplayOrderMap[\s\S]{0,1200}total\s*-\s*index/u.test(store)) {
  throw new Error("Source Market engine contract must not reverse source category numbering");
}
assertIncludes(market, "data-product-market-card-grid", "shared responsive card grid");
assertIncludes(market, "data-product-market-category-key={group.key}", "stable source category identity");
assertIncludes(market, "ProductMarketWorkspace", "single workspace boundary");
assertIncludes(market, 'data-product-market-theme-section', "dedicated theme workspace band");
assertIncludes(market, 'const isGlobalThemeSource = configScope === "hq" || isSourceScope;', "source-theme global baseline");
assertIncludes(market, 'includeDefault: templateLifecycleRole !== "source"', "source saves advance draft without overwriting factory default");
assertIncludes(market, "promoteProductMarketFactoryDefault(", "factory default promotion occurs only after verified rollout");
assertIncludes(lifecycle, 'export type ProductMarketLifecycleRole = "factory" | "source" | "runtime";', "shared template lifecycle roles");
assertIncludes(lifecycle, 'promotion: "verified-published-version-after-completed-all-client-plan-rollout"', "factory-default promotion boundary");
assertIncludes(config, 'readAndAlignCatalogScope(defaultProductMarketConfigKey("agency_source"), "agency_source")', "agency-source catalog isolation");
assertIncludes(config, 'readAndAlignCatalogScope(defaultProductMarketConfigKey("client_source"), "client_source")', "client-source catalog isolation");
assertIncludes(css, "[data-product-market-card-grid]", "shared card-grid CSS");
assertIncludes(css, "--tradepro-shared-product-market-card-min-width", "shared compact-card variable");
assertIncludes(css, "max(17rem, var(--tradepro-shared-product-market-card-min-width, 17rem))", "title-safe card-width floor");
assertIncludes(css, "--tradepro-shared-operations-band-inline-inset", "shared theme and batch-header inset");
assertIncludes(css, "--tradepro-shared-title-bottom-radius", "source-title square lower corners");
assertIncludes(profiles, '"--tradepro-shared-product-market-card-min-width": "17rem"', "global-sync title-safe default for card geometry");
assertIncludes(profiles, "removedLegacyProductMarketCardWidth", "legacy card-width override cleanup");
assertIncludes(profiles, 'delete variables["--tradepro-shared-product-market-card-min-width"]', "retired 14rem value deletion");
assertIncludes(profiles, '"--tradepro-shared-operations-band-inline-inset": "0.75rem"', "global-sync default for theme and batch-header spacing");
assertIncludes(profiles, '"--tradepro-shared-title-bottom-radius": "0px"', "global-sync default for source title lower corners");
for (const [source, label] of [[hqSidebar, "headquarters"], [agencySourceSidebar, "agency source"]]) {
  assertIncludes(source, "SOURCE_WORKSPACE_GROUPS", `${label} reads shared category contract`);
  assertIncludes(source, "buildSourceWorkspaceCategoryOrderMap", `${label} follows persisted category order`);
  assertIncludes(source, "data-source-nav-category-key", `${label} exposes stable category identity`);
}

console.log("Source Market engine contract passed: shared UI with isolated HQ, agency-source, and client-source catalogues.");
