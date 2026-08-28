import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(`产品市场签名缓存契约失败：${message}`);
};

const [productMarket, lifecycle, learning, gates, packageSource] = await Promise.all([
  read("src/pages/ProductMarket.tsx"),
  read("src/lib/product-market-template-lifecycle-contract.ts"),
  read("src/lib/performance-experience-learning.ts"),
  read("scripts/run-development-standard-gates.mjs"),
  read("package.json"),
]);
const packageJson = JSON.parse(packageSource);

for (const token of [
  "immutableBaselineFieldSignatures = new WeakMap",
  "baselineFieldSignature(before, field)",
  "signatures.has(field)",
]) {
  assert(lifecycle.includes(token), `不可变草稿 baseline 缓存缺失：${token}`);
}
assert(
  (lifecycle.match(/baselineFieldSignature\(before, field\)/g) || []).length === 2,
  "分组字段与 other 字段必须共同复用 baseline 签名",
);
assert(
  lifecycle.includes("stableValue(after[field as keyof ExportableConfig])"),
  "当前草稿必须在每次相关编辑时重新计算，不得缓存 live draft",
);

const persistStart = productMarket.indexOf("async function persistAndVerifyScopedSnapshot(");
const persistEnd = productMarket.indexOf("\nfunction getInheritedConfig", persistStart);
const persistBlock = productMarket.slice(persistStart, persistEnd);
assert(persistStart >= 0 && persistEnd > persistStart, "无法定位保存回读流程");
assert(
  (persistBlock.match(/productMarketConfigSignature\(expected\)/g) || []).length === 1
    && persistBlock.includes("const expectedSignature = productMarketConfigSignature(expected)")
    && (persistBlock.match(/expectedSignature/g) || []).length >= 6,
  "保存流程必须只计算一次 expected 签名并复用于本地、源体和运行端回读",
);

const publishStart = productMarket.indexOf("const handlePublishTemplateSource = useCallback(");
const publishEnd = productMarket.indexOf("\n  const currentSettingsRestoreTarget", publishStart);
const publishBlock = productMarket.slice(publishStart, publishEnd);
assert(publishStart >= 0 && publishEnd > publishStart, "无法定位发布回读流程");
assert(
  (publishBlock.match(/productMarketConfigSignature\(nextConfig\)/g) || []).length === 1
    && publishBlock.includes("const nextConfigSignature = productMarketConfigSignature(nextConfig)")
    && (publishBlock.match(/nextConfigSignature/g) || []).length >= 5,
  "发布流程必须只计算一次 nextConfig 签名并复用于草稿、接口与发布回读",
);

assert(
  productMarket.includes("defaultDialogProductsBaselineSignatureRef")
    && productMarket.includes("const tempProductsSignature = useMemo(() => JSON.stringify(tempProducts), [tempProducts])")
    && !productMarket.includes("JSON.parse(JSON.stringify(tempProducts))"),
  "栏目 baseline 必须保存字符串签名并复用当前草稿 memo，不得保留重复深克隆",
);

for (const token of [
  "customerServiceAvatarPreviewDescriptorCache = new WeakMap",
  "getCustomerServiceAvatarPreviewDescriptor(override, serviceWorkspaceActive)",
  "areCustomerServiceAvatarPreviewPlansEqual(current.plan, nextPlan)",
  '"imageDataUrl", override.imageDataUrl || null',
  '"soundStyle", override.soundStyle || null',
  '"voiceStyleKey", override.voiceStyleKey || null',
  'appendCustomerServiceStyleAssetDescriptor(service, "soundAssetsByStyle"',
  'appendCustomerServiceStyleAssetDescriptor(service, "reminderImageAssetsByStyle"',
  'appendCustomerServiceStyleAssetDescriptor(service, "voiceAssetsByStyle"',
  'appendCustomerServiceStyleAssetDescriptor(service, "voiceImageAssetsByStyle"',
]) {
  assert(productMarket.includes(token), `客服媒体结构描述符缺失：${token}`);
}
const previewStart = productMarket.indexOf("const avatarPreviewLoadSnapshot = useMemo(");
const previewEnd = productMarket.indexOf("\n  const selectedAvatarSequenceMatch", previewStart);
const previewBlock = productMarket.slice(previewStart, previewEnd);
assert(previewStart >= 0 && previewEnd > previewStart, "无法定位客服媒体预览计划");
assert(
  !previewBlock.includes("JSON.stringify") && !previewBlock.includes('.join("|")'),
  "预览计划不得把旧 Data URL 再序列化或拼接成第二份大字符串",
);
for (const forbidden of ["imageDataUrl.length", "imageDataUrl.slice", "imageDataUrl.substring", "hashImageDataUrl"]) {
  assert(!productMarket.includes(forbidden), `旧 Data URL 身份不得使用可能碰撞的截断或散列：${forbidden}`);
}

for (const dependency of [
  "builtinThemeOverrides",
  "csAvatarId",
  "csEnabled",
  "csVoiceEnabled",
  "customThemes",
  "customerServiceCustomized",
  "moduleIconVisibility",
  "sidebarStyle",
  "soundEnabled",
  "soundStyle",
  "soundVolume",
  "visualCardLayout",
]) {
  assert(productMarket.includes(`    ${dependency},`), `草稿构建依赖缺失：${dependency}`);
}

assert(learning.includes('version: "2026.08.28.15"'), "优化加载体验尚未记录本轮共享性能学习版本");
assert(gates.includes('"verify-product-market-signature-cache-contract.mjs"'), "签名缓存契约未登记开发规范闸门");
assert(
  packageJson.scripts?.["verify:product-market-signature-cache"]
    === "node scripts/verify-product-market-signature-cache-contract.mjs",
  "缺少独立签名缓存验收命令",
);

console.log("Product Market signature cache contract verified: immutable draft baselines, save/publish transaction signatures and legacy media descriptors avoid repeated large serialization.");
