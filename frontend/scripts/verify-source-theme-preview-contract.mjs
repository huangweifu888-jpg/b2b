import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFile(resolve(root, file), "utf8");
const assertIncludes = (source, expected, label) => {
  if (!source.includes(expected)) throw new Error(`Source theme preview contract missing: ${label}`);
};

const [market, hqSidebar, agencySourceSidebar] = await Promise.all([
  read("src/pages/ProductMarket.tsx"),
  read("src/components/HQSidebar.tsx"),
  read("src/components/AgencySourceSidebar.tsx"),
]);

assertIncludes(market, "resolveGlobalThemeTokens(previewThemePreset.layout, previewThemePreset.sidebar)", "shared root-token hover preview");
for (const [label, sidebar] of [["HQ", hqSidebar], ["Agency Source", agencySourceSidebar]]) {
  assertIncludes(sidebar, "--tradepro-shell-from", `${label} preview background token`);
  assertIncludes(sidebar, "--tradepro-shell-highlight", `${label} preview highlight token`);
  assertIncludes(sidebar, "sidebarSoftBorder", `${label} preview border token`);
}

console.log("Source theme preview contract passed: HQ and Agency Source sidebars follow the Client Source hover-preview tokens.");
