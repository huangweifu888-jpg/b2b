import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const productMarket = await readFile(resolve(root, "src/pages/ProductMarket.tsx"), "utf8");
for (const text of ["changedProductLabels", "statusOutcome", "目标 ${changedPaths.length} 项", "预计结果：${statusOutcome}", "将在左侧导航显示并恢复可用", "将保留入口但显示为不可用", "将从左侧导航隐藏", "确认批量${statusLabel}"]) {
  if (!productMarket.includes(text)) throw new Error(`批量操作预览合同缺失：${text}`);
}
console.log("批量操作预览合同通过：确认前展示目标清单、预计状态结果与保存范围。");
