import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const registryPath = resolve(repoRoot, ".codex", "source-page-locks.json");
const governanceManifestPath = resolve(repoRoot, "shared/contracts/developer-governance-source-lock-manifest.json");
const governanceManifest = JSON.parse(readFileSync(governanceManifestPath, "utf8"));
if (governanceManifest?.schemaVersion !== 1 || !governanceManifest.groups || typeof governanceManifest.groups !== "object") {
  throw new Error("Developer governance source-lock manifest is invalid.");
}
const developerGovernancePaths = Object.values(governanceManifest.groups).flatMap((paths) => {
  if (!Array.isArray(paths) || !paths.length || paths.some((path) => typeof path !== "string" || !path)) {
    throw new Error("Developer governance source-lock manifest contains an invalid group.");
  }
  return paths;
});
const sharedDependencies = [
  ...developerGovernancePaths,
  "frontend/src/components/PageFooterLockControls.tsx",
  "frontend/src/lib/page-layout-lock.ts",
  "frontend/src/lib/source-page-lock.ts",
  "frontend/src/lib/layout-frame-contract.ts",
  "frontend/src/components/ui/tooltip.tsx",
  "frontend/src/components/HQLayout.tsx",
  "frontend/src/components/AgencySourceLayout.tsx",
  "frontend/src/components/ClientSourceLayout.tsx",
];
if (new Set(sharedDependencies).size !== sharedDependencies.length) {
  throw new Error("Source-lock dependency manifests contain duplicate paths.");
}

if (!existsSync(registryPath)) {
  throw new Error("未找到源码锁登记文件，无法扩展已锁页面的依赖清单。");
}

const registry = JSON.parse(readFileSync(registryPath, "utf8"));
const locks = registry && typeof registry.locks === "object" && registry.locks ? registry.locks : {};
let changed = 0;

for (const entry of Object.values(locks)) {
  if (!entry || entry.locked !== true || !Array.isArray(entry.paths) || !entry.baseline || typeof entry.baseline !== "object") continue;

  const paths = new Set(entry.paths);
  for (const relativePath of sharedDependencies) {
    if (paths.has(relativePath)) continue;
    const target = resolve(repoRoot, relativePath);
    if (!existsSync(target)) throw new Error(`源码锁依赖不存在：${relativePath}`);
    entry.baseline[relativePath] = createHash("sha256").update(readFileSync(target)).digest("hex");
    paths.add(relativePath);
    changed += 1;
  }
  entry.paths = [...paths];
}

registry.updatedAt = new Date().toISOString();
const temporaryPath = `${registryPath}.tmp`;
writeFileSync(temporaryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
renameSync(temporaryPath, registryPath);
console.log(`源码锁依赖已扩展：新增 ${changed} 条基线，未改写既有页面基线。`);
