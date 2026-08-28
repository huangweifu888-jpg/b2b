import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFile(resolve(root, file), "utf8");
const assertIncludes = (source, token, label) => {
  if (!source.includes(token)) throw new Error(`Client-source content sync contract missing: ${label}`);
};
const assertExcludes = (source, token, label) => {
  if (source.includes(token)) throw new Error(`Client-source content sync contract retains duplicate writer: ${label}`);
};

const [config, productMarket, productMarketModules, productMarketModuleChildren, productStore, sidebar, categoryIdentityIcon, clientLayout, pageLock, moduleEditorContract, orderContract] = await Promise.all([
  read("src/lib/product-market-config.ts"),
  read("src/pages/ProductMarket.tsx"),
  read("src/components/product-market/ProductMarketModulesPanel.tsx"),
  read("src/components/product-market/ProductMarketModuleChildrenList.tsx"),
  read("src/lib/product-market-store.ts"),
  read("src/components/Sidebar.tsx"),
  read("src/components/product-market/ProductMarketCategoryIdentityIcon.tsx"),
  read("src/components/ClientSourceLayout.tsx"),
  read("src/lib/page-layout-lock.ts"),
  read("src/lib/product-market-modules-editor-contract.ts"),
  read("src/lib/product-market-order-contract.ts"),
]);
const productMarketModuleContractSource = `${productMarket}\n${productMarketModules}\n${productMarketModuleChildren}`;

for (const token of [
  "CLIENT_SOURCE_CONTENT_PROGRAMS",
  "const baseProduct = factoryProduct ||",
  "Some real content editors are intentionally outside the factory",
  "moduleCategoryAssignments[program.path] = \"content\"",
  "clientSourceContentContractVersion",
  "const shouldNormalizeProgramShape = isLegacyProgram || (requiresContentUpgrade && hasLegacyChildren);",
  "const statusChanged = isLegacyProgram && product.status !== \"active\";",
]) {
  assertIncludes(config, token, `shared source catalogue: ${token}`);
}
assertExcludes(
  config,
  "(isLegacyProgram || requiresContentUpgrade) && product.status !== \"active\"",
  "content-contract migration must not reopen an explicit batch status",
);

for (const token of [
  "import { CLIENT_SOURCE_CONTENT_PROGRAMS",
  "const WEBSITE_CONTENT_PROGRAMS = CLIENT_SOURCE_CONTENT_PROGRAMS",
  "The shared source-contract reader performs this migration before the",
]) {
  assertIncludes(productMarket, token, `Column Configuration reader: ${token}`);
}
assertExcludes(productMarket, "missingPrograms.forEach((program)", "legacy Column Configuration add-program effect");

for (const [source, token, label] of [
  [productMarket, 'from "@/lib/product-market-modules-editor-contract"', "Product Market shared editor contract"],
  [productMarketModules, 'from "@/lib/product-market-modules-editor-contract"', "modules panel shared editor contract"],
  [productMarketModuleChildren, 'from "@/lib/product-market-modules-editor-contract"', "child list shared editor contract"],
  [productStore, 'from "./product-market-order-contract"', "store shared order boundary"],
  [config, 'from "./product-market-order-contract"', "storage shared order boundary"],
]) {
  assertIncludes(source, token, label);
}
for (const duplicateToken of ["type EditableModuleChild =", "type EditableModuleItem =", "MODULE_CATEGORY_SORT_ID_PREFIX"]) {
  assertExcludes(productMarket, duplicateToken, `Product Market local editor duplicate: ${duplicateToken}`);
  assertExcludes(productMarketModules, duplicateToken, `modules panel local editor duplicate: ${duplicateToken}`);
}
for (const token of [
  "export type EditableModuleChild",
  "export type EditableModuleItem",
  "encodeModuleCategorySortId",
  "decodeModuleCategorySortId",
]) {
  assertIncludes(moduleEditorContract, token, `shared modules editor contract: ${token}`);
}
for (const token of [
  "const productOrder = Array.isArray(next.productOrder)",
  "next.productOrder = dedupeProductOrderPaths(productOrder)",
  "let productOrder = dedupeProductOrderPaths(",
]) {
  assertIncludes(config, token, `all-scope order normalization: ${token}`);
}
for (const token of [
  "const sourcePaths = dedupeProductOrderPaths(paths).filter(",
  "const existingPaths = new Set(currentProducts.map((product) => product.path))",
  "productOrder: dedupeProductOrderPaths([",
  "const normalizedPaths = dedupeProductOrderPaths(orderedPaths)",
  "const importedOrder = dedupeProductOrderPaths(",
  "const savedOrder = dedupeProductOrderPaths(",
]) {
  assertIncludes(productStore, token, `store order normalization: ${token}`);
}

const [{ text: orderContractRuntime }] = (await build({
  entryPoints: [resolve(root, "src/lib/product-market-order-contract.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
})).outputFiles;
const { dedupeProductOrderPaths } = await import(`data:text/javascript;base64,${Buffer.from(orderContractRuntime).toString("base64")}`);
const dirtyOrder = ["/a", "/b", "/a", "/c", "/b"];
const cleanOrder = dedupeProductOrderPaths(dirtyOrder);
if (JSON.stringify(cleanOrder) !== JSON.stringify(["/a", "/b", "/c"]) || dirtyOrder.length !== 5) {
  throw new Error("Client-source content sync contract failed: product order dedupe must preserve first occurrence without mutating input");
}

for (const token of [
  "RETAINED_CLIENT_SOURCE_CONTENT_PATHS",
  '"/news"',
  '"/videos"',
  '"/blog"',
  "!RETAINED_CLIENT_SOURCE_CONTENT_PATHS.has(path)",
]) {
  assertIncludes(productStore, token, `source content must not be filtered as legacy: ${token}`);
}

for (const token of [
  "DEFAULT_PRODUCT_MODULE_ICON_KEYWORDS",
  "Every catalogue item has a real factory icon",
  "getDefaultProductModuleSecondaryIconName(path: string, label = \"\")",
]) {
  assertIncludes(productStore, token, `name-first factory icon contract: ${token}`);
}

for (const token of [
  "PRODUCT_MODULE_CATEGORY_MARKETING_GUIDES",
  "先找准值得成交的人",
  "让采购商三分钟看懂你",
  "把承诺变成可追踪交付",
  "让增长最终沉淀为利润",
]) {
  assertIncludes(productStore, token, `twelve-stage customer value guide: ${token}`);
}

for (const token of [
  "getDefaultProductModuleSecondaryIconName(child.path, child.customLabel || child.label)",
  "getDefaultProductModuleSecondaryIconName(product.path, displayProductLabel(product))",
  "data-product-market-category-marketing-guide",
  "痛点：{marketingGuide.pain}",
  "价值：{marketingGuide.value}",
  "行动：{marketingGuide.action}",
]) {
  assertIncludes(productMarketModuleContractSource, token, `Column Configuration icon default: ${token}`);
}

for (const token of [
  "useRouteOwnedSidebarDisclosure",
  "activeDisclosureKey",
  "PRODUCT_MARKET_DISCLOSURE_KEY",
  "buildConfiguredProductNavItems",
  "ProductMarketCategoryIdentityIcon",
  "visible={moduleIconVisibility.category}",
  "moduleIconVisibility.primary",
  "moduleIconVisibility.secondary",
  "getDefaultProductModuleSecondaryIconName(child.path, child.customLabel || child.label)",
  "data-source-nav-category-marketing-guide",
  "data-source-nav-category-empty",
  "moduleIconVisibility.showEmptyCategoryNames",
  "痛点：{marketingGuide.pain}",
]) {
  assertIncludes(sidebar, token, `Sidebar projection: ${token}`);
}

for (const token of [
  "persistModuleIconVisibility",
  "label=\"分类图标\"",
  "label=\"一级图标\"",
  "label=\"二级图标\"",
]) {
  assertIncludes(clientLayout, token, `Footer icon controls: ${token}`);
}
assertIncludes(clientLayout, "label=\"分类名称\"", "Footer empty-category visibility control");
assertIncludes(clientLayout, "showEmptyCategoryNames", "Footer empty-category shared-contract field");

for (const token of [
  "getCustomerServiceCategoryExpertByKey",
  "resolveProductMarketCategoryExpertMaterialId",
  "expert.defaultAvatarAssetId",
  "if (!visible) return null",
  "customer-service-select-expert",
  "data-shared-product-market-category-icon",
  "data-shared-product-market-category-expert-id",
  "data-shared-product-market-category-material-id",
  "data-shared-product-market-category-display-size",
  "data-shared-product-market-category-media-stability",
  "customer-service-local-material",
]) {
  assertIncludes(categoryIdentityIcon, token, `Shared category identity icon: ${token}`);
}
assertIncludes(productMarket, "<ProductMarketCategoryIdentityIcon", "Operations and Column Configuration must use the shared category identity icon.");
assertIncludes(productMarket, "visible={moduleIconVisibility.category}", "Product Market category icons must follow the shared category visibility toggle.");
assertIncludes(productMarket, "expertAvatarWorkspaceActive", "Service, Operations and Column Configuration must activate one shared avatar load plan.");
assertIncludes(productMarket, "const nextPlan: CustomerServiceAvatarPreviewPlanEntry[] = expertAvatarWorkspaceActive", "The shared avatar load plan must cover every active expert projection.");
assertIncludes(productMarket, "getCustomerServiceCategoryExperts(tempModuleCategoryOrder, tempModuleCategoryStyles)", "The shared avatar load plan must retain every configured expert source.");
assertIncludes(productMarket, 'displaySize="category-16"', "Operations and Column Configuration category portraits must remain 16px.");
assertIncludes(sidebar, 'displaySize="sidebar-20"', "Sidebar category portraits must remain 20px.");
assertIncludes(productMarket, "readCustomerServiceMediaPreview(", "Product Market must read all 01-12 expert portraits through the stable Select Expert media preview.");
assertIncludes(productMarket, "resolveCustomerServiceLocalMaterialReference(", "Product Market must resolve all 01-12 portraits through one local material reference contract.");
assertIncludes(productMarket, "materialReference", "Product Market must carry one material reference shape through the complete 01-12 load plan.");
assertIncludes(sidebar, "readCustomerServiceMediaPreview(", "Sidebar must read all 01-12 expert portraits through the stable Select Expert media preview.");
assertIncludes(sidebar, "resolveCustomerServiceLocalMaterialReference(", "Sidebar must resolve all 01-12 portraits through the same local material reference contract.");
assertIncludes(sidebar, "materialReference", "Sidebar must carry one material reference shape through the complete 01-12 load plan.");
assertIncludes(productStore, "/assets/customer-service-local-materials/", "Bundled Select Expert portraits must use the customer-service local material namespace.");
assertExcludes(productStore, "/assets/factory-experts/", "Select Expert portraits must not retain a separate factory portrait namespace.");

for (const token of [
  "readClientTemplateProductMarketConfig",
  "registerCompletedLayoutLockParents([",
  "...buildSidebarLockParents(products)",
  "...buildSharedPlatformLayoutLockParents()",
  "resolveConfiguredProductRoute(products, location.pathname, location.search)",
]) {
  assertIncludes(clientLayout, token, `source shell projection: ${token}`);
}

for (const token of [
  "tool:product-market:${tab}",
  "params.delete(\"siteId\")",
  "buildSharedPlatformLayoutLockParents",
  "registerCompletedLayoutLockParents",
]) {
  assertIncludes(pageLock, token, `Page Lock inheritance: ${token}`);
}

console.log("Client-source content sync contract verified: Column Configuration, Operations, Sidebar and Page Lock use one shared source catalogue.");
