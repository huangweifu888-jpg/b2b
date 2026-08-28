import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { buildSync } from "esbuild";

const testEntries = {
  "developer-global-workflow-evidence": resolve("src/lib/developer-global-workflow-evidence.test.ts"),
  "developer-pr-evidence": resolve("src/lib/developer-pr-evidence.test.ts"),
  "performance-code-audit": resolve("src/lib/performance-code-audit.test.ts"),
};
const outputDirectory = mkdtempSync(join(tmpdir(), "developer-optimization-evidence-"));

try {
  buildSync({
    entryPoints: testEntries,
    outdir: outputDirectory,
    entryNames: "[name]",
    outExtension: { ".js": ".mjs" },
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    logLevel: "error",
  });
  const testFiles = Object.keys(testEntries).map((name) => join(outputDirectory, `${name}.mjs`));
  const result = spawnSync(process.execPath, ["--test", ...testFiles], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exitCode = result.status || 1;
} finally {
  rmSync(outputDirectory, { recursive: true, force: true });
}

if (process.exitCode) process.exit(process.exitCode);
console.log("全局 04–05 覆盖、加载门禁与 GitHub PR 严格证据测试通过。");
