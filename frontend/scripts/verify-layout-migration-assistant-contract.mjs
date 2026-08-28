import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const [assistant, productMarket, developmentPanels] = await Promise.all([
  readFile(resolve(root, "src/lib/layout-migration-assistant.ts"), "utf8"),
  readFile(resolve(root, "src/pages/ProductMarket.tsx"), "utf8"),
  readFile(resolve(root, "src/components/product-market/DevelopmentStandardPanels.tsx"), "utf8"),
]);

for (const token of ["diagnoseLayoutMigration", "buildLayoutMigrationPlan", "findPageLayoutContract", '"registered" | "needs-contract"', "never writes", "uploaded-assets"]) {
  if (!assistant.includes(token)) throw new Error(`Migration assistant contract is missing: ${token}`);
}
for (const token of ["buildLayoutMigrationPlan", "data-page-composition-migration", "配置迁移", "不会复制旧 CSS"]) {
  if (!`${productMarket}\n${developmentPanels}`.includes(token)) throw new Error(`Development guide must expose migration diagnostic: ${token}`);
}

console.log("Migration assistant contract verified.");
