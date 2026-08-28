import { access, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const build = String(packageJson.scripts?.build || "");
const checks = [
  "verify-route-error-boundary-contract.mjs",
  "verify-page-frame-acceptance.mjs",
  "verify-foundation-regression-suite.mjs",
  "verify-unified-application-acceptance.mjs",
  "verify-content-safe-sync-contract.mjs",
  "verify-downstream-protection-contract.mjs",
];

for (const check of checks) {
  if (!build.includes(check)) throw new Error(`发布前门禁缺少：${check}`);
}

const output = resolve(root, "dist/index.html");
await access(output);
const outputStat = await stat(output);
if (outputStat.size < 200) throw new Error("发布产物不完整：dist/index.html 为空或过小。");

console.log(`发布前门禁通过：${checks.length} 项合同检查与生产构建产物均已确认。`);
