import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const registryPath = resolve(repoRoot, ".codex", "source-page-locks.json");
const requestedPaths = process.argv.slice(2).filter((argument) => argument !== "--");

if (!existsSync(registryPath)) {
  console.log("源码锁检查：尚未登记任何完全防误改页面。");
  process.exit(0);
}

let registry;
try {
  registry = JSON.parse(readFileSync(registryPath, "utf8"));
} catch {
  console.error("源码锁检查失败：锁定登记文件无效。请先在 08 页面锁定器解除并重新勾选页面。");
  process.exit(2);
}

const locks = registry && typeof registry.locks === "object" && registry.locks ? registry.locks : {};
const normalizePath = (value) => relative(repoRoot, resolve(repoRoot, value)).replaceAll("\\", "/");
const selected = new Set(requestedPaths.map(normalizePath));
const failures = [];

for (const [lockId, entry] of Object.entries(locks)) {
  if (!entry || entry.locked !== true || !Array.isArray(entry.paths) || !entry.baseline || typeof entry.baseline !== "object") continue;
  for (const item of entry.paths) {
    const path = normalizePath(item);
    if (selected.size > 0 && !selected.has(path)) continue;
    const target = resolve(repoRoot, path);
    const expected = entry.baseline[path];
    const actual = existsSync(target) ? createHash("sha256").update(readFileSync(target)).digest("hex") : "missing";
    if (!expected || actual !== expected) failures.push({ lockId, path });
  }
}

if (failures.length > 0) {
  console.error("源码锁已阻止本次操作：下列文件属于已勾选的完全防误改页面，且与锁定基线不一致。");
  for (const failure of failures) console.error(`- ${failure.lockId} → ${failure.path}`);
  console.error("请先到 源开发器 → 08 页面锁定器 取消该页面的“完全防误改”勾选，再修改源码或执行自动命令。");
  process.exit(2);
}

console.log(`源码锁检查通过：${Object.keys(locks).filter((id) => locks[id]?.locked === true).length} 个已登记页面未被改动。`);
