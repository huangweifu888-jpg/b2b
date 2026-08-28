import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [sidebar, store, media, learning, gates, packageSource] = await Promise.all([
  read("src/components/Sidebar.tsx"),
  read("src/lib/product-market-store.ts"),
  read("src/lib/customer-service-media.ts"),
  read("src/lib/performance-experience-learning.ts"),
  read("scripts/run-development-standard-gates.mjs"),
  read("package.json"),
]);
const packageJson = JSON.parse(packageSource);

for (const token of [
  "const settledPreviews = await Promise.allSettled(categoryExpertAvatarLoadPlan.map",
  "return [id, { url: preview.url, kind: media.kind }] as const",
  "return null",
  "if (!active) return",
  'result.status !== "fulfilled" || !result.value',
  "const [id, preview] = result.value",
  "nextPreviews[id] = preview",
  "Object.keys(current).length > 0 ? {} : current",
  "const currentIds = Object.keys(current)",
  "const nextIds = Object.keys(nextPreviews)",
  "currentIds.length !== nextIds.length",
  "current[id]?.url !== nextPreviews[id]?.url || current[id]?.kind !== nextPreviews[id]?.kind",
  "return changed ? nextPreviews : current",
  "active = false",
]) {
  assert(sidebar.includes(token), `Sidebar 头像批量提交契约缺失：${token}`);
}
assert((sidebar.match(/setCategoryExpertAvatarPreviews\(/g) || []).length === 2, "01–12 头像必须只保留一次条件清旧和一次结算后批量替换。");
assert(sidebar.includes("Promise.allSettled") && sidebar.includes("without blocking the remaining previews"), "单项头像读取失败必须继续与其他素材隔离。");

for (const token of [
  "PRODUCT_MODULE_CATEGORIES",
  "PRODUCT_MODULE_CATEGORY_ORDER = PRODUCT_MODULE_CATEGORIES.map",
  "return normalizedOrder.map((categoryKey, index)",
  "getCustomerServiceCategoryExperts(",
]) {
  assert(store.includes(token), `01–12 专家共享来源契约缺失：${token}`);
}
for (const token of [
  "materialMediaCache.get(assetId)",
  "readCustomerServiceMediaSingleFlight(materialId, async () =>",
  "materialMediaPreviewUrlCache.get(media.id)",
  "materialMediaPreviewUrlCache.set(media.id, url)",
  "invalidateCustomerServiceMedia",
]) {
  assert(media.includes(token), `头像批处理必须保留共享素材缓存/失效语义：${token}`);
}

for (const token of [
  'version: "2026.08.28.15"',
  'id: "batch-async-state-commit"',
  'id: "route-owned-data-boundary"',
  'id: "route-owned-deferred-css"',
  "最坏 12 次大侧栏重渲染",
  "正常初次加载仍最多 1 次批量提交",
  "素材替换场景最多增加 1 次条件清旧",
  "至少减少 10 次、约 83%",
  "单项失败、素材缓存、替换失效和 effect 取消语义保持不变",
  "头像媒体计划由 12 项降至可见栏最多 2 项",
  "深签名与读取约减少 83%",
  "少 8 组 Object.entries/sort/map",
  "raw 401118→193570（-207548）",
  "minified 300532→127978（-172554）",
  "gzip9 44173→8886（-35287）",
  "38 条、12950 bytes 专属 CSS",
  "index.css 625969→613019",
  "全局 gzip9 减少 1119 bytes",
  "路由 gzip 增加 807 bytes",
]) {
  assert(learning.includes(token), `优化加载体验缺少 Sidebar 批量提交证据：${token}`);
}
for (const forbidden of ["EventTarget.prototype", "window.fetch =", "globalThis.fetch ="]) {
  assert(!sidebar.includes(forbidden) && !media.includes(forbidden), `头像批处理不得劫持全局 API：${forbidden}`);
}

assert(gates.includes('"verify-sidebar-avatar-preview-batch-contract.mjs"'), "Sidebar 头像批量提交契约未登记开发规范闸门。");
assert(
  packageJson.scripts?.["verify:sidebar-avatar-preview-batch"]
    === "node scripts/verify-sidebar-avatar-preview-batch-contract.mjs",
  "缺少独立 Sidebar 头像批量提交验收命令。",
);

console.log("Sidebar avatar preview batch contract verified: stale previews clear once and settled media replaces state once.");
