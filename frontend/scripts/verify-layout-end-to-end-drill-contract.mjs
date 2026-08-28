import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pkg = await readFile(resolve(root, "package.json"), "utf8");
for (const token of [
  "verify-new-page-layout-guide-contract.mjs",
  "verify-layout-regression-queue-contract.mjs",
  "verify-global-trial-contract.mjs",
  "verify-restore-regression-contract.mjs",
  "verify-content-safe-sync-contract.mjs",
  "verify-downstream-protection-contract.mjs",
]) {
  if (!pkg.includes(token)) throw new Error(`End-to-end layout drill is missing a gate: ${token}`);
}
console.log("全链路演练合同通过：新增页面、回归、试运行同步、恢复与下游保护均纳入同一构建门禁。");
