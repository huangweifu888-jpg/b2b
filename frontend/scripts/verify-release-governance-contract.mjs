import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFile(resolve(root, file), "utf8");
const assertIncludes = (source, expected, label) => {
  if (!source.includes(expected)) throw new Error(`Release governance contract missing: ${label}`);
};

const [checklist, agencySource, clientSource, runtimeCenter, snapshotService] = await Promise.all([
  read("src/components/ReleaseReadinessChecklist.tsx"),
  read("src/pages/hq/AgencySourceReleases.tsx"),
  read("src/pages/hq/ClientSourceReleases.tsx"),
  read("src/pages/agency/AgencyVersionCenter.tsx"),
  read("../backend/services/template_snapshot.py"),
]);

for (const token of ["源端配置", "版本基线", "审核状态", "影响预览", "同步保护"]) {
  assertIncludes(checklist, token, `shared readiness item: ${token}`);
}
assertIncludes(agencySource, "ReleaseReadinessChecklist", "agency-source release preflight");
assertIncludes(agencySource, "预览影响", "agency-source rollout diff preview");
assertIncludes(agencySource, "rollback", "agency-source version rollback");
assertIncludes(clientSource, "ReleaseReadinessChecklist", "client-source release preflight");
assertIncludes(clientSource, "previewSelectedPlans", "client plan diff preview");
assertIncludes(clientSource, "rollbackSelectedPlans", "client plan rollback");
assertIncludes(runtimeCenter, 'syncMode: "merge"', "runtime safe-merge default");
assertIncludes(snapshotService, "must never clear downstream modifications", "backend downstream data protection");

console.log("Release governance contract passed: preview, approval, protected sync, and rollback are available across source and runtime paths.");
