import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const frontendRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(frontendRoot, "..");
const readFrontend = (path) => readFile(resolve(frontendRoot, path), "utf8");
const readRepository = (path) => readFile(resolve(repositoryRoot, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(`Product Market 全计划发布契约失败：${message}`);
};

const [productMarket, lifecycle, api, rolloutE2E, developmentStandardPanels, batchRouter, batchService, batchTests, jobWorker, jobTests, instanceIdentity, tenantProvisioningTests, runtimeIdentityE2E, tenantRebindTests, consistencyRunner, gates, packageSource, clientPlanRuntimeIdentity, adminLayout, socialMedia, socialSettingsTab, clientSourceReleases, globalResponsiveDeep] = await Promise.all([
  readFrontend("src/pages/ProductMarket.tsx"),
  readFrontend("src/lib/product-market-template-lifecycle-contract.ts"),
  readFrontend("src/lib/template-snapshot/api.ts"),
  readFrontend("e2e/product-market-template-rollout.spec.ts"),
  readFrontend("src/components/product-market/DevelopmentStandardPanels.tsx"),
  readRepository("backend/routers/template_snapshot.py"),
  readRepository("backend/services/template_release_batches.py"),
  readRepository("backend/tests/test_template_release_batches.py"),
  readRepository("backend/services/job_worker.py"),
  readRepository("backend/tests/test_template_release_job_retry.py"),
  readRepository("backend/services/template_instance_identity.py"),
  readRepository("backend/tests/test_tenant_provisioning_flow.py"),
  readFrontend("e2e/product-market-runtime-identity.spec.ts"),
  readRepository("backend/tests/test_template_snapshot_tenant_rebind_guard.py"),
  readFrontend("scripts/run-product-market-consistency-runtime-contract.mjs"),
  readFrontend("scripts/run-development-standard-gates.mjs"),
  readFrontend("package.json"),
  readFrontend("src/lib/template-snapshot/client-plan-runtime-identity.ts"),
  readFrontend("src/components/AdminLayout.tsx"),
  readFrontend("src/pages/SocialMedia.tsx"),
  readFrontend("src/components/social/tabs/SocialSettingsTab.tsx"),
  readFrontend("src/pages/hq/ClientSourceReleases.tsx"),
  readFrontend("e2e/global-responsive-deep.spec.ts"),
]);
const packageJson = JSON.parse(packageSource);

for (const token of [
  "function mapTemplateVersionResponse",
  "return mapTemplateVersionResponse(response)",
  "return response.items.map(mapTemplateVersionResponse)",
  "export async function retryTemplateReleaseBatch",
  "export async function promoteProductMarketFactoryDefault",
  "export async function fetchProductMarketFactoryDefault",
  "product-market/factory-default",
  "expected_draft_config_hash: payload.expectedDraftConfigHash ?? null",
  "expected_template_version: expectedTemplateVersion",
  "release_batch_id: releaseBatchId",
  "contract_version: contractVersion",
]) {
  assert(api.includes(token), `版本响应或失败重试共享映射缺失：${token}`);
}
assert(
  (api.match(/return mapTemplateVersionResponse\(response\)/g) || []).length === 3,
  "publish、approve、review 必须共同使用单一 snake_case → camelCase 映射器",
);
const mapperStart = api.indexOf("function mapTemplateVersionResponse");
const mapperEnd = api.indexOf("\n}\n\nasync function templateRequest", mapperStart);
const mapperBlock = api.slice(mapperStart, mapperEnd);
assert(mapperStart >= 0 && mapperEnd > mapperStart, "无法定位版本响应共享映射器");
assert(
  mapperBlock.includes('reviewStatus:') && mapperBlock.includes(': "unknown"'),
  "review_status 缺失时必须映射为 unknown，禁止默认视为已发布",
);
assert(!mapperBlock.includes(': "published"'), "版本响应映射器不得把缺失 review_status 默认成 published");

const saveStart = productMarket.indexOf("const commitOperationDraft = useCallback(");
const saveEnd = productMarket.indexOf("\n  const saveDefaults", saveStart);
const saveBlock = productMarket.slice(saveStart, saveEnd);
assert(saveStart >= 0 && saveEnd > saveStart, "无法定位草稿保存事务");
assert(saveBlock.includes("includeDefault: false"), "保存草稿不得提前推进工厂默认");
const liveThemeSaveStart = productMarket.indexOf("const handleApplyLiveTheme = useCallback", saveStart);
const liveThemeSaveEnd = productMarket.indexOf("\n  const saveDefaults", liveThemeSaveStart);
const liveThemeSaveBlock = productMarket.slice(liveThemeSaveStart, liveThemeSaveEnd);
assert(liveThemeSaveStart >= 0 && liveThemeSaveEnd > liveThemeSaveStart, "无法定位网站风格切换保存事务");
assert(liveThemeSaveBlock.includes("await commitOperationDraft(nextConfig"), "网站风格切换必须复用正式保存与服务端回读事务");
assert(liveThemeSaveBlock.includes("网站风格保存未完成"), "网站风格保存失败必须保留中文错误");
assert(liveThemeSaveBlock.includes("defaultDialogDraftBaselineRef.current"), "网站风格保存前必须建立已验证基线，以便失败后继续提示未保存修改");
assert(
  productMarket.includes("if (!defaultDialogBaselineReady || !defaultDialogDraftBaselineRef.current)"),
  "未保存检测不得只在设置弹窗打开时生效",
);
assert(
  !liveThemeSaveBlock.includes("writeScopedConfig(") && !liveThemeSaveBlock.includes("writeScopedCurrentAndDefaultConfig("),
  "网站风格切换不得绕过正式保存事务直接写入快照",
);
assert(
  productMarket.includes(': isPublished ? published : null;'),
  "published 读取必须严格受 is_published 保护，不能回退到未发布草稿",
);
const livePersistStart = productMarket.indexOf("function persistCurrentScopeLiveConfig(");
const livePersistEnd = productMarket.indexOf("\n  function getRemoteSnapshotLoader", livePersistStart);
const livePersistBlock = productMarket.slice(livePersistStart, livePersistEnd);
assert(livePersistStart >= 0 && livePersistEnd > livePersistStart, "无法定位 Product Market 被动存储事务");
assert(
  livePersistBlock.includes('if (templateLifecycleRole === "source") return;'),
  "源体 current/draft 只能由显式保存回读事务推进，切换四区不得用精简 store 快照被动覆写",
);

for (const token of [
  "resolveClientPlanRuntimeInstanceIdentity",
  "resolveLegacyClientPlanRuntimeInstanceIdentity",
  "assertClientPlanRuntimeInstanceBinding",
  "resolveExistingRuntimeInstance",
  "assertRuntimeInstanceBinding",
  "cause instanceof TemplateSnapshotRequestError",
  "cause.status !== 404",
  "organizationId: identity.organizationId",
  "projectId: identity.projectId",
  'batch.targets.filter((target) => target.status !== "superseded")',
  "activeTargets.length !== batch.total_targets",
]) {
  assert(productMarket.includes(token), `Tenant-safe runtime read/write or superseded-target verification is missing: ${token}`);
}
for (const token of [
  'const INSTANCE_A = "client-plan:501:401"',
  'const INSTANCE_B = "client-plan:502:402"',
  'const LEGACY_INSTANCE_C = "client-plan:LEGACY-PLAN"',
  "api.reads.includes(INSTANCE_C) && api.reads.includes(LEGACY_INSTANCE_C)",
  "organization_id: 501",
  "project_id: 401",
  'const SITE_D = "runtime-plan-unprovisioned"',
  'const SITE_E = "runtime-plan-mismatched-legacy"',
  "writesBeforeLegacyThemeSave",
  "当前计划尚未由开通流程建立服务端实例",
  "历史计划编码实例绑定与当前客户、计划不一致",
  "离开前处理未保存修改",
]) {
  assert(runtimeIdentityE2E.includes(token), `Client runtime identity browser regression is missing: ${token}`);
}
assert(
  batchRouter.includes("Client plan runtime instances must be created by tenant provisioning"),
  "Client runtime browser PUT must not create an unprovisioned or half-bound instance.",
);
for (const token of [
  "test_client_runtime_browser_upsert_updates_only_a_provisioned_instance",
  'assert missing.value.status_code == 409',
  'assert updated["organization_id"] == client.id',
  'assert updated["project_id"] == project.id',
]) {
  assert(tenantRebindTests.includes(token), `Provisioning-only client runtime regression is missing: ${token}`);
}
for (const token of [
  "resolveClientPlanRuntimeInstanceIdentity",
  "assertClientPlanRuntimeInstanceBinding",
  "allowLegacyPlanCode = false",
  "(clientId === null) !== (planId === null)",
  "`client-plan:${clientId}:${planId}`",
  "resolveLegacyClientPlanRuntimeInstanceIdentity",
  "usesLegacyPlanCode: true",
]) {
  assert(clientPlanRuntimeIdentity.includes(token), `Shared client-plan runtime identity guard is missing: ${token}`);
}
for (const [source, label] of [
  [productMarket, "Product Market runtime save"],
  [adminLayout, "client runtime shell"],
  [`${socialMedia}\n${socialSettingsTab}`, "social runtime package"],
  [clientSourceReleases, "client-source release centre"],
]) {
  assert(source.includes("resolveClientPlanRuntimeInstanceIdentity"), `${label} does not use the shared canonical identity resolver`);
  assert(source.includes("assertClientPlanRuntimeInstanceBinding"), `${label} does not validate the returned tenant binding`);
  assert(!/client-plan:\$\{/u.test(source), `${label} still constructs a client-plan runtime ID inline`);
}
for (const token of [
  'instance_id: "client-plan:501:401"',
  "organization_id: 501",
  "project_id: 401",
  "clientId: 501",
  'expect(runtimeInstanceReads).not.toContain("client-plan:PLAN-E2E")',
]) {
  assert(globalResponsiveDeep.includes(token), `Canonical client runtime consumer regression is missing: ${token}`);
}
assert(clientSourceReleases.includes("selectedPlanInstanceIds"), "Release centre selection must use instance IDs so duplicate plan codes cannot collide");

const publishStart = productMarket.indexOf("const handlePublishTemplateSource = useCallback(");
const publishEnd = productMarket.indexOf("\n  const currentSettingsRestoreTarget", publishStart);
const publishBlock = productMarket.slice(publishStart, publishEnd);
assert(publishStart >= 0 && publishEnd > publishStart, "无法定位 Product Market 发布事务");
for (const token of [
  "const templateHead = await fetchTemplate(templateId)",
  "const expectedDraftConfigHash",
  'readRemoteTemplateConfig(templateId, "draft")',
  'readRemoteTemplateConfig(templateId, "published")',
  "listTemplateVersions(templateId)",
  "latestVersionHasLifecycleContract",
  "PRODUCT_MARKET_TEMPLATE_LIFECYCLE_CONTRACT_VERSION",
  "const savedDraftSignature = productMarketConfigSignature(savedDraft)",
  "const publishedConfigSignature = productMarketConfigSignature(existingPublished)",
  "const verifiedDraftMatches",
  "const publishedVersionMatches",
  "if (!verifiedDraftMatches && !publishedVersionMatches)",
  "const canReusePublishedVersion = !verifiedDraftMatches && publishedVersionMatches",
  "const nextConfig = (canReusePublishedVersion ? existingPublished : savedDraft) as ExportableConfig",
  "if (!canReusePublishedVersion)",
  "publishTemplate(templateId",
  "expectedDraftConfigHash",
  'publishedVersion.reviewStatus !== "published"',
  "createTemplateReleaseBatch(templateId, null, undefined, version)",
  "waitForProductMarketReleaseBatch",
  "retryTemplateReleaseBatch(batch.id)",
  "verifyCompletedProductMarketReleaseBatch",
  "promoteProductMarketFactoryDefault(",
  "promoted.factory_default_release_batch_id !== completed.id",
  "promoted.failed_targets !== 0",
  "const confirmedFactoryConfig = promoted.factory_default_config_json as ExportableConfig",
  "const factoryKey = defaultConfigKey(configScope, effectiveSiteId)",
  "writeScopedConfig(configScope, factoryKey, confirmedFactoryConfig",
  "已设为工厂默认，并自动发布到全部客户端计划",
]) {
  assert(publishBlock.includes(token), `发布事务缺少：${token}`);
}
const eligibilityGuardIndex = publishBlock.indexOf("if (!verifiedDraftMatches && !publishedVersionMatches)");
const publishRequestIndex = publishBlock.indexOf("publishTemplate(templateId");
assert(
  !publishBlock.slice(0, eligibilityGuardIndex).includes("readStoredConfig("),
  "发布资格不得依赖会被页面生命周期改变的本地 current 缓存",
);
assert(
  publishBlock.indexOf("const expectedDraftConfigHash")
    < publishBlock.indexOf("const verifiedDraftMatches")
    && publishBlock.indexOf("const latestVersionHasLifecycleContract")
      < publishBlock.indexOf("const publishedVersionMatches")
    && publishBlock.indexOf("const publishedVersionMatches") < eligibilityGuardIndex
    && eligibilityGuardIndex < publishRequestIndex,
  "发布资格必须先核对服务端草稿哈希或带当前 lifecycle contract 的 immutable 已发布版本，发布清空草稿后应可重试",
);
const completedVerificationIndex = publishBlock.indexOf("verifyCompletedProductMarketReleaseBatch");
const promotionIndex = publishBlock.indexOf("promoteProductMarketFactoryDefault(");
const localFactoryWriteIndex = publishBlock.indexOf("writeScopedConfig(configScope, factoryKey, confirmedFactoryConfig");
const successToastIndex = publishBlock.indexOf("已设为工厂默认，并自动发布到全部客户端计划");
assert(
  completedVerificationIndex < promotionIndex
    && promotionIndex < localFactoryWriteIndex
    && localFactoryWriteIndex < successToastIndex,
  "必须依次完成全计划验收、服务端工厂默认提升、本地默认回读，最后才允许成功提示",
);
assert(!publishBlock.includes("可手动同步最新版"), "客户源发布成功文案不得继续声称仅手动同步");
assert(productMarket.includes("源体草稿；需发布新版且全部计划成功后才更新工厂默认"), "客服素材源体提示必须声明先写草稿、全计划成功后才更新工厂默认");
assert(!productMarket.includes('isSourceScope ? "源体默认" : "当前计划"'), "客服素材成功提示不得把源体草稿误称为源体默认");
assert(!productMarket.includes('"源体工厂默认"'), "客服素材替换范围不得把源体草稿误称为工厂默认");
assert(productMarket.includes('aria-label={id === "save" ? "保存设置"'), "标题保存入口必须使用统一的保存设置动作词");

for (const token of [
  "PRODUCT_MARKET_TEMPLATE_LIFECYCLE_CONTRACT_VERSION",
  "工厂默认（发布成功后只读）",
  "源体：保存草稿 → 发布新版 → 全计划 → 工厂默认",
  "运行端：恢复已发布源体",
  "只有批次 completed、成功数等于总数且失败数为 0 才能显示完成",
]) {
  assert(developmentStandardPanels.includes(token), `开发器生命周期说明仍与共享发布契约不一致：${token}`);
}

for (const token of [
  'type BatchMode = "completed" | "partial_failed" | "partial_then_completed"',
  '{ instance_id: "client-plan:10:99", status: "superseded" }',
  "TEMPLATE_VERSIONS_URL",
  "fixtureConfigSignature",
  "expectLocalCurrentToMatchSavedDraft",
  "await expectLocalCurrentToMatchSavedDraft(page, api.savedConfig())",
  "await expectLocalCurrentToMatchSavedDraft(page, savedDraft)",
  'changelog: "运营市场、栏目配置、版面风格、客服音效 · 共享契约 2026-08-27.1"',
  "seedPublishedVersion",
  "已有已发布 v1 后保存不同 v2 草稿时必须发布并下发 v2",
  'expect(releasePayload?.expected_template_version).not.toBe("v1-existing")',
  "draftConfig = null",
  'calls.push("promote-factory-default")',
  "factoryAtPromotionRequest",
  "expect(api.publishCount()).toBe(1)",
  "expect(api.promotionCount()).toBe(0)",
  "发布清空草稿后可复用同一已发布版本重试且发布接口只调用一次",
]) {
  assert(rolloutE2E.includes(token), `真实交互回归缺少：${token}`);
}

for (const label of ["运营市场", "栏目配置", "版面风格", "客服音效"]) {
  assert(lifecycle.includes(`"${label}"`), `生命周期缺少四区覆盖声明：${label}`);
}
for (const token of [
  'terminalSuccess: "completed-and-all-targets-succeeded"',
  'partialFailure: "keep-previous-factory-default-and-retry-failed-targets"',
  "全部客户端计划下发成功后",
]) {
  assert(lifecycle.includes(token), `开发器／共享生命周期契约缺少：${token}`);
}

for (const token of [
  '.with_for_update()',
  'instance.instance_type != "client-plan"',
  'requested_target_ids = {instance.instance_id for instance in instances}',
  'TemplateSnapshotReleaseBatch.status.in_(',
  'if reusable_target_ids == requested_target_ids:',
  "MAX_TARGET_SET_RECONCILIATIONS = 3",
  "class ReleaseTargetSetChangedError(ValueError):",
  "async def _reconcile_full_client_batch_targets(",
  'target.status = "superseded"',
  'if batch.status == "partial_failed":',
  'AuditLog.action == "product_market_factory_default_target_set_reconciled"',
  'action="product_market_factory_default_target_set_unstable"',
  "async def _current_factory_default_supersedes_batch(",
  "validate_product_market_config_shape(pinned_version.config_json)",
  "if not reconciliation_required:",
]) {
  assert(batchService.includes(token), `后端全计划范围或幂等保护缺少：${token}`);
}
for (const token of [
  '"/templates/{template_id}/product-market/factory-default"',
  "response_model=ProductMarketFactoryDefaultResponse",
  "TemplateReleaseBatchService(db).promote_product_market_factory_default(",
]) {
  assert(batchRouter.includes(token), `后端工厂默认提升端点缺少：${token}`);
}
for (const token of [
  "async def promote_product_market_factory_default(",
  'batch.status != "completed"',
  "batch.succeeded_targets != batch.total_targets",
  "batch.failed_targets != 0",
  'raise ValueError("Factory-default promotion requires every client-plan target to succeed")',
  "current_target_ids != batch_target_ids",
  "select(PlanRuntimeConfig)",
  "plan_runtime.template_version = batch.template_version",
  "Factory-default rollout contains a missing, inactive, or stale client-plan runtime configuration",
  "template.factory_default_release_batch_id = batch.id",
  'action="product_market_factory_default_promoted"',
  "record_audit_event(",
  '"source": "template_release_batch_service"',
]) {
  assert(batchService.includes(token), `后端工厂默认提升完整性保护缺少：${token}`);
}
for (const token of [
  "test_client_source_all_target_batch_is_idempotent_and_covers_every_client_plan",
  "instance_ids=None",
  'assert after_completion["id"] == first["id"]',
  "test_client_source_batch_rejects_a_non_client_plan_target",
  "test_completed_full_client_rollout_promotes_and_reads_back_product_market_factory_default",
  "test_partial_failed_rollout_cannot_advance_existing_product_market_factory_default",
  "test_full_client_rollout_rolls_back_when_plan_runtime_configuration_is_missing",
  "test_pending_target_for_an_already_current_plan_completes_without_duplicate_backup",
  "test_completed_unpromoted_batch_reconciles_a_reactivated_stale_plan_before_promotion",
  "test_promoted_batch_evidence_is_immutable_when_the_active_plan_set_later_changes",
  "test_older_same_version_batch_replay_cannot_replace_newer_factory_evidence",
  "test_target_set_reconciliation_is_durably_bounded_and_a_fresh_batch_can_continue",
  "test_malformed_product_market_config_cannot_be_automatically_promoted",
]) {
  assert(batchTests.includes(token), `后端发布批次回归缺少：${token}`);
}

assert(gates.includes('"verify-product-market-template-rollout-contract.mjs"'), "静态契约未登记开发规范闸门");
assert(gates.includes('"run-product-market-template-rollout-runtime-contract.mjs"'), "真实交互回归未登记开发规范闸门");
for (const token of [
  "e2e/product-market-save-navigation.spec.ts",
  "e2e/product-market-four-tab-contract.spec.ts",
  "e2e/product-market-runtime-identity.spec.ts",
  '"--workers=1"',
  "e2e/shared-visual-parity.spec.ts",
  '"product-market-"',
]) {
  assert(consistencyRunner.includes(token), `Product Market consistency runner is missing: ${token}`);
}
assert(gates.includes('"run-product-market-consistency-runtime-contract.mjs"'), "Product Market save/four-tab/runtime identity/shared visual regressions are not mandatory gates.");
assert(
  packageJson.scripts?.["test:product-market-consistency"]
    === "node scripts/run-product-market-consistency-runtime-contract.mjs",
  "The Product Market end-to-end consistency command is missing.",
);
assert(
  packageJson.scripts?.["verify:product-market-template-rollout"]
    === "node scripts/verify-product-market-template-rollout-contract.mjs",
  "缺少独立 Product Market 全计划发布静态验收命令",
);
assert(
  packageJson.scripts?.["test:product-market-template-rollout"]
    === "playwright test e2e/product-market-template-rollout.spec.ts",
  "缺少独立 Product Market 全计划发布真实交互命令",
);

for (const token of [
  "async def _oldest_unfinished_template_batch_job()",
  'TemplateSnapshotReleaseBatch.status.in_(("queued", "running"))',
  "recovered_job = await _oldest_unfinished_template_batch_job()",
  "await execute_job(recovered_job)",
]) {
  assert(jobWorker.includes(token), `Durable template release queue recovery is missing: ${token}`);
}
for (const token of [
  "test_idle_worker_recovers_oldest_queued_factory_release_without_a_redis_job",
  "test_worker_reconciles_a_plan_activated_after_zero_target_batch_creation",
  "test_idle_worker_returns_false_when_redis_and_database_have_no_jobs",
  "test_idle_worker_survives_queue_and_durable_execution_failures",
  'AuditLog.action == "product_market_factory_default_promoted"',
]) {
  assert(jobTests.includes(token), `Durable template release queue regression is missing: ${token}`);
}
for (const token of [
  'return f"client-plan:{organization_id}:{project_id}"',
  "is_canonical_client_plan_runtime_instance_id(",
  "client_plan_runtime_instance_id(plan_code)",
]) {
  assert(instanceIdentity.includes(token), `Tenant-safe client-plan instance identity is missing: ${token}`);
}
for (const token of [
  "test_clients_may_reuse_a_plan_code_and_both_receive_the_factory_release",
  "test_plan_runtime_and_activation_reject_cross_client_project_binding_without_writes",
  'code="BASIC"',
  'assert completed["succeeded_targets"] == 2',
]) {
  assert(tenantProvisioningTests.includes(token), `Cross-client plan-code regression is missing: ${token}`);
}
const finalRefreshIndex = batchService.indexOf("await self._refresh_counts(batch)");
const finalPromotionIndex = batchService.indexOf(
  "await self._auto_promote_contract_release(batch)",
  finalRefreshIndex,
);
const finalCommitIndex = batchService.indexOf("await self.db.commit()", finalPromotionIndex);
assert(
  finalRefreshIndex >= 0
    && finalPromotionIndex > finalRefreshIndex
    && finalCommitIndex > finalPromotionIndex
    && !batchService.slice(finalRefreshIndex, finalPromotionIndex).includes("await self.db.commit()"),
  "Batch completion, factory-default promotion and promotion audit must share the final successful transaction.",
);
assert(
  batchService.includes('status="queued"') && batchService.includes("allow_empty_client_bootstrap"),
  "A zero-plan client bootstrap must remain durably queued until the worker promotes it.",
);

console.log("Product Market template rollout contract verified: draft isolation, strict publication readback, all-plan rollout, bounded target-set reconciliation, queue recovery, tenant-safe plan identities, atomic promotion audit and factory-default promotion are one guarded lifecycle.");
