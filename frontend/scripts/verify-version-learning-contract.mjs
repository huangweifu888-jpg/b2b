import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFile(resolve(root, file), "utf8");
const assertIncludes = (source, expected, label) => {
  if (!source.includes(expected)) throw new Error(`版本学习合同缺失：${label}`);
};

const [devtoolsBump, hqBump, devtoolsVerify, hqVerify, versionBadge, versionHistory, sharedWindowContract, materialPicker] = await Promise.all([
  read("scripts/auto-bump-devtools-version.mjs"),
  read("scripts/auto-bump-hq-version.mjs"),
  read("scripts/verify-devtools-version.mjs"),
  read("scripts/verify-hq-version.mjs"),
  read("src/components/SoftwareVersionBadge.tsx"),
  read("src/lib/product-market-version.ts"),
  read("src/lib/shared-window-contract.ts"),
  read("src/components/product-market/CustomerServiceMaterialPickerDialog.tsx"),
]);

for (const field of ["summary", "learningRules", "verification", "sourceFingerprint"]) {
  assertIncludes(devtoolsBump, field, `外置开发工具记录 ${field}`);
  assertIncludes(devtoolsVerify, field, `外置开发工具校验 ${field}`);
}
for (const field of ["changedFiles", "summary", "verification", "restorePoint"]) {
  assertIncludes(hqBump, field, `总部记录 ${field}`);
  assertIncludes(hqVerify, field, `总部校验 ${field}`);
}
assertIncludes(versionBadge, "确定恢复总部版本", "总部版本恢复确认");
assertIncludes(versionBadge, "更新说明", "总部版本更新说明");
if (versionBadge.includes('className="tradepro-version-summary')) {
  throw new Error("版本学习合同失败：总部 H 弹窗不应重复渲染当前版本摘要栏");
}
for (const [token, label] of [
  ['data-shared-dialog-contract="hq-version-history"', "总部版本共享弹窗登记"],
  ['data-shared-window-kind="editor"', "总部版本共享编辑器类型"],
  ['data-shared-window-region="topbar"', "总部版本共享表头"],
  ['data-shared-window-region="content"', "总部版本共享滚动内容区"],
  ['data-shared-window-region="footer"', "总部版本共享尾栏"],
  ["data-shared-window-footer-status", "总部版本尾栏计数"],
  ["data-hq-version-history-limit", "总部版本十条上限标记"],
  ["HISTORY_LIMIT = 10", "总部版本默认保留十条"],
  ["compareVersionIdsDescending", "总部版本号数字降序"],
  ["compareNewestLargeSequenceFirst", "总部版本共享最新大号优先排序"],
  ['data-hq-version-history-order="newest-large-number-first"', "总部版本最新大号优先标记"],
  ["最新且大号排前", "总部版本最新大号优先说明"],
  ["版号：{entry.id}", "总部版本素材卡版号字段"],
  ["引用：", "总部版本素材卡引用字段"],
  ["时间：{label.createdAt}", "总部版本素材卡时间字段"],
  ["说明：", "总部版本素材卡说明字段"],
  ["恢复版本", "总部版本素材卡独立恢复按键"],
]) {
  assertIncludes(versionBadge, token, label);
}
if (versionBadge.includes("const signatures = new Set<string>()") || versionBadge.includes("Boolean(entry.title?.trim() || entry.summary?.trim())")) {
  throw new Error("总部版本历史不得按相同说明折叠或过滤无说明的可恢复版本。");
}
assertIncludes(hqBump, "\\\\s*=\\\\s*[^;]+;", "总部自动版本多行说明更新");
assertIncludes(versionHistory, 'new CustomEvent("product-market-version-updated"', "总部版本远端回读后刷新界面");
assertIncludes(sharedWindowContract, 'id: "hq-version-history"', "总部版本窗口工厂注册");
for (const token of [
  "DraggableDialogContent",
  'data-shared-window-size="editor-wide"',
  "showCloseButton",
  "resizable",
  "minWidth={420}",
  "minHeight={360}",
  "max-h-[calc(100dvh-1rem)]",
  'data-shared-window-region="topbar"',
  'data-shared-window-region="content"',
  'data-shared-window-region="footer"',
  "data-page-layout-footer",
  "data-dialog-resize-safe-area",
  "ScrollArea",
]) {
  assertIncludes(versionBadge, token, `总部 H 版本窗口与专家头像素材结构一致：${token}`);
  assertIncludes(materialPicker, token, `专家头像素材共享结构基准：${token}`);
}
for (const [source, label] of [
  [versionBadge, "总部 H 版本窗口"],
  [materialPicker, "专家头像素材窗口"],
]) {
  if (source.includes("sm:max-w-[76rem]")) {
    throw new Error(`版本学习合同失败：${label}不得覆盖 editor-wide 共享宽度`);
  }
}

console.log("版本学习合同通过：W/H 版本均包含变更说明、验证结论与可恢复依据。");
