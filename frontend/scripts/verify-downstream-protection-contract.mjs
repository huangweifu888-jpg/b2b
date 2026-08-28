import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const frontendApi = await readFile(resolve(root, "src/lib/template-snapshot/api.ts"), "utf8");
const service = await readFile(resolve(root, "../backend/services/template_snapshot.py"), "utf8");
const tests = await readFile(resolve(root, "../backend/tests/test_template_snapshot_sync.py"), "utf8");
for (const text of ["sync_mode: payload.syncMode ?? \"merge\"", "create_backup: payload.createBackup ?? true"]) {
  if (!frontendApi.includes(text)) throw new Error(`下游保护前端合同缺失：${text}`);
}
for (const text of ["TEMPLATE_SOURCE_SCOPES", "_assert_template_payload_allowed", "Apply a new template without overwriting downstream custom data", "legacy \"overwrite\" input is accepted for compatibility but uses the", "_compose_synced_snapshot"]) {
  if (!service.includes(text)) throw new Error(`下游保护服务合同缺失：${text}`);
}
for (const text of ["test_legacy_overwrite_mode_still_uses_the_non_destructive_merge_contract", "test_downstream_scope_cannot_write_a_template_source"]) {
  if (!tests.includes(text)) throw new Error(`下游保护回归测试缺失：${text}`);
}
console.log("下游保护合同通过：模板源写入受限，下游同步保留自定义和新增数据。 ");
