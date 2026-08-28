import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const testFile = resolve("src/lib/developer-workflow-run.test.ts");

if (!existsSync(testFile)) {
  console.error("缺少 DeveloperRun 运行时测试：src/lib/developer-workflow-run.test.ts");
  process.exit(1);
}

const tsxRunner = resolve("node_modules/tsx/dist/cli.mjs");
if (!existsSync(tsxRunner)) {
  console.error("缺少 TypeScript 测试运行器：node_modules/tsx/dist/cli.mjs");
  process.exit(1);
}

const result = spawnSync(process.execPath, [tsxRunner, "--test", testFile], {
  cwd: process.cwd(),
  encoding: "utf8",
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) process.exit(result.status || 1);

console.log("DeveloperRun 顺序、指纹、失效传播与 fail-closed 门禁验证通过。");
