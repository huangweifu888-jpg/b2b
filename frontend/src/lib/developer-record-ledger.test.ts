import assert from "node:assert/strict";
import test from "node:test";

import phaseTwoVerification from "../page-factory/phase-two-verification.json" with { type: "json" };
import {
  DEVELOPER_RECORD_APPS,
  DEVELOPER_RECORD_AUTHORITIES,
  DEVELOPER_RECORD_LOCAL_DISCLAIMER,
  DEVELOPER_RECORD_LOCAL_MAXIMUM_PER_SCOPE,
  adaptDeveloperWorkflowArtifacts,
  adaptPhaseTwoVerificationRecords,
  appendLocalDeveloperRecord,
  buildDeveloperRecordStorageKey,
  createDeveloperLockReceipt,
  filterDeveloperRecords,
  isSensitiveLocalArtifactReference,
  listLocalDeveloperRecords,
  normalizeDeveloperRecordEntry,
  parseLocalDeveloperRecords,
  sanitizeDeveloperRecordArtifactRefs,
  sortDeveloperRecords,
  type DeveloperRecordEntry,
  type DeveloperRecordStorage,
  type LocalDeveloperRecordInput,
} from "./developer-record-ledger.ts";
import {
  createDeveloperWorkflowRun,
  updateDeveloperWorkflowArtifact,
} from "./developer-workflow-run.ts";
import { DEVELOPER_NAVIGATION_ORDER_MIGRATION_CONTRACT_VERSION } from "./developer-optimization-contract.ts";

const FIXED_TIME = "2026-08-28T08:00:00.000Z";
const PAGE_SCOPE_IDENTITY = "page:client_source:%2Fzb%2Fclient-source%2Fproduct-market%3Ftab%3Dservice";
const WORKFLOW_PERFORMANCE_RECORDS = [
  ["latestProductMarketOperationsWorkflowPerformanceRevision", "/product-market?tab=operations"],
  ["latestProductMarketModulesWorkflowPerformanceRevision", "/product-market?tab=modules"],
  ["latestProductMarketLayoutWorkflowPerformanceRevision", "/product-market?tab=layout"],
  ["latestProductMarketServiceWorkflowPerformanceRevision", "/product-market?tab=service"],
] as const;

class MemoryStorage implements DeveloperRecordStorage {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function recordInput(overrides: Partial<LocalDeveloperRecordInput> = {}): LocalDeveloperRecordInput {
  return {
    appId: "visual-evidence",
    relatedAppIds: ["visual-evidence", "page-factory"],
    artifactKind: "visual-evidence",
    scope: "page",
    scopeIdentity: PAGE_SCOPE_IDENTITY,
    sourceScope: "client_source",
    pageIdentity: "client_source:/zb/client-source/product-market?tab=service",
    status: "passed",
    recordedAt: FIXED_TIME,
    title: "04 可视化验证台记录",
    contractVersion: "2026.08.28.1",
    factoryVersion: "2026.08.22.6",
    hVersion: "H38683",
    sourceFingerprint: "source-fingerprint",
    targetManifestFingerprint: "target-fingerprint",
    summary: "三屏验证通过。",
    validation: "390、768、1440 均通过。",
    risks: null,
    artifactRefs: ["evidence:viewport-matrix"],
    sourceKey: null,
    ...overrides,
  };
}

function record(overrides: Partial<LocalDeveloperRecordInput> = {}) {
  return normalizeDeveloperRecordEntry({
    schemaVersion: 1,
    recordId: overrides.recordId || `record:${overrides.recordedAt || FIXED_TIME}`,
    authority: "local",
    ...recordInput(overrides),
  }) as DeveloperRecordEntry;
}

test("record ledger derives the ordered 01-08 applications and authority levels from shared contracts", () => {
  assert.deepEqual(DEVELOPER_RECORD_APPS.map((app) => app.id), ["01", "02", "03", "04", "05", "06", "07", "08"]);
  assert.equal(DEVELOPER_RECORD_APPS.find((app) => app.id === "07")?.appId, "page-factory");
  assert.equal(DEVELOPER_RECORD_APPS.find((app) => app.id === "07")?.artifactKind, "page-factory-verification");
  assert.equal(DEVELOPER_RECORD_APPS.find((app) => app.id === "08")?.artifactKind, "lock-receipt");
  assert.deepEqual(DEVELOPER_RECORD_AUTHORITIES.map((authority) => authority.id), ["source", "server", "local", "session"]);
  assert.equal(DEVELOPER_RECORD_LOCAL_MAXIMUM_PER_SCOPE, 120);
  assert.match(DEVELOPER_RECORD_LOCAL_DISCLAIMER, /不是源码正式记录/u);
});

test("artifact references redact absolute local paths and credentials while retaining safe references", () => {
  assert.equal(isSensitiveLocalArtifactReference("G:\\ruanjian\\private\\report.json"), true);
  assert.equal(isSensitiveLocalArtifactReference("C:/Users/Administrator/report.json"), true);
  assert.equal(isSensitiveLocalArtifactReference("file:///home/user/report.json"), true);
  assert.equal(isSensitiveLocalArtifactReference("/home/user/report.json"), true);
  assert.equal(isSensitiveLocalArtifactReference("/zb/client-source/product-market?tab=service"), false);
  assert.equal(isSensitiveLocalArtifactReference("frontend/src/report.json"), false);

  assert.deepEqual(sanitizeDeveloperRecordArtifactRefs([
    "G:\\ruanjian\\private\\report.json",
    "file:///home/user/report.json",
    "/tmp/private-report.json",
    "https://user:password@example.test/report",
    "https://example.test/report?access_token=secret",
    "data:text/plain,private",
    "frontend/src/report.json",
    "https://example.test/report",
    "performance-report:candidate-1",
    "performance-report:candidate-1",
  ]), [
    "frontend/src/report.json",
    "https://example.test/report",
    "performance-report:candidate-1",
  ]);
});

test("01-06 workflow artifacts adapt to the unified ledger and remain visible from 07", () => {
  let run = createDeveloperWorkflowRun({
    scope: "page",
    sourceScope: "client_source",
    normalizedRoute: "/zb/client-source/product-market?tab=service",
    contractVersion: "2026.08.28.1",
    sourceFingerprint: "source-fingerprint",
    targets: ["client-source-product-market-service"],
    createdAt: FIXED_TIME,
    id: "workflow-test-1",
  });
  run = updateDeveloperWorkflowArtifact(run, "01", {
    status: "passed",
    payload: { targetIds: ["client-source-product-market-service"] },
    artifactRefs: ["scope-manifest:service", "G:\\private\\manifest.json"],
    recordedAt: "2026-08-28T08:01:00.000Z",
  });
  run = updateDeveloperWorkflowArtifact(run, "02", {
    status: "passed",
    payload: { contractVersions: { shared: "2026.08.28.1" } },
    message: "共享契约已解析。",
    recordedAt: "2026-08-28T08:02:00.000Z",
  });

  const records = adaptDeveloperWorkflowArtifacts(run);
  assert.equal(records.length, 2);
  assert.equal(records[0].appId, "shared-contract");
  assert.equal(records[0].authority, "local");
  assert.equal(records[0].summary, "共享契约已解析。");
  assert.equal(records[1].artifactRefs.includes("G:\\private\\manifest.json"), false);
  assert.deepEqual(filterDeveloperRecords(records, { appIds: ["page-factory"] }).length, 2);
  assert.equal(records.every((entry) => entry.relatedAppIds.includes("page-factory")), true);
});

test("phase-two adapter exposes every legacy evidence record plus the 07 current summary", () => {
  const records = adaptPhaseTwoVerificationRecords(phaseTwoVerification);
  const legacyKeys = Object.keys(phaseTwoVerification).filter((key) => (
    /^latest.*Revision$/u.test(key)
    || key === "latestHeartbeatAudit"
    || key === "latestSmallCardDefaultTeaGreenAudit"
    || key === "versionHistoryRetentionDisplayRepair"
  ));
  assert.equal(records.length, legacyKeys.length + 1);
  const revisionKeyCount = legacyKeys.filter((key) => /^latest.*Revision$/u.test(key)).length;
  assert.equal(records.filter((entry) => entry.artifactKind === "page-factory-revision").length, revisionKeyCount - WORKFLOW_PERFORMANCE_RECORDS.length);
  assert.equal(records.filter((entry) => entry.artifactKind === "performance-evidence").length, WORKFLOW_PERFORMANCE_RECORDS.length);
  assert.equal(records.filter((entry) => entry.artifactKind === "page-factory-audit").length, 2);
  assert.equal(records.filter((entry) => entry.artifactKind === "page-factory-repair").length, 1);
  assert.equal(records.filter((entry) => entry.artifactKind === "page-factory-verification").length, 1);
  assert.equal(records.every((entry) => entry.authority === "source"), true);
  assert.equal(records.every((entry) => entry.relatedAppIds.includes("page-factory")), true);
  const legacyRecords = records.filter((entry) => entry.artifactKind !== "page-factory-verification");
  assert.ok(new Set(legacyRecords.map((entry) => entry.appId)).size >= 5);
  assert.ok(legacyRecords.filter((entry) => entry.appId === "page-lock").length < legacyRecords.length / 2);

  const pageLockRecord = records.find((entry) => entry.sourceKey === "latestPageLockerFilterUniformSurfaceRevision");
  assert.ok(pageLockRecord);
  assert.equal(pageLockRecord.appId, "page-lock");
  assert.equal(pageLockRecord.hVersion, "H38667");

  const consolidation = records.find((entry) => entry.sourceKey === "latestDeveloperRecordLedgerConsolidationRevision");
  assert.ok(consolidation);
  assert.equal(consolidation.appId, "visual-frame");
  assert.equal(consolidation.hVersion, "H38684");
  assert.equal(consolidation.contractVersion, "2026.08.28.2");
  assert.deepEqual(
    [...consolidation.relatedAppIds].sort(),
    DEVELOPER_RECORD_APPS.map((entry) => entry.appId).sort(),
  );

  const current = records.find((entry) => entry.artifactKind === "page-factory-verification");
  assert.ok(current);
  assert.equal(current.appId, "page-factory");
  assert.equal(current.sourceKey, "phase-two-verification-root");
  assert.match(current.title, /^07 页面工厂/u);
});

test("real Product Market workflow-performance records retain 01-06 relations, page identity and pending release truth", () => {
  const records = adaptPhaseTwoVerificationRecords(phaseTwoVerification);
  const expectedRelatedAppIds = DEVELOPER_RECORD_APPS
    .filter((entry) => ["01", "02", "03", "04", "05", "06", "07"].includes(entry.id))
    .map((entry) => entry.appId)
    .sort();

  for (const [sourceKey, normalizedRoute] of WORKFLOW_PERFORMANCE_RECORDS) {
    const record = records.find((entry) => entry.sourceKey === sourceKey);
    assert.ok(record, sourceKey);
    assert.equal(record.appId, "performance-experience", sourceKey);
    assert.equal(record.artifactKind, "performance-evidence", sourceKey);
    assert.equal(record.status, "pending", sourceKey);
    assert.equal(record.scope, "page", sourceKey);
    assert.equal(record.sourceScope, "client_source", sourceKey);
    assert.equal(record.pageIdentity, `client_source:${normalizedRoute}`, sourceKey);
    assert.equal(record.scopeIdentity, `page:client_source:${encodeURIComponent(normalizedRoute)}`, sourceKey);
    assert.deepEqual([...record.relatedAppIds].sort(), expectedRelatedAppIds, sourceKey);
  }
});

test("workflow-performance status keeps failed and blocked ahead of external pending", () => {
  const records = adaptPhaseTwoVerificationRecords({
    latestBlockedWorkflowPerformanceRevision: {
      recordedAt: FIXED_TIME,
      completionPercent: 100,
      result: "性能工作流仍被阻断。",
      workflow: [
        { stage: "01", status: "passed" },
        { stage: "03", status: "external-evidence-not-supplied" },
        { stage: "06", status: "blocked" },
      ],
    },
    latestFailedWorkflowPerformanceRevision: {
      recordedAt: FIXED_TIME,
      completionPercent: 100,
      result: "性能工作流执行失败。",
      workflow: [
        { stage: "03", status: "external-evidence-not-supplied" },
        { stage: "05", status: "failed" },
        { stage: "06", status: "blocked" },
      ],
    },
  });
  assert.equal(records.find((entry) => entry.sourceKey === "latestBlockedWorkflowPerformanceRevision")?.status, "blocked");
  assert.equal(records.find((entry) => entry.sourceKey === "latestFailedWorkflowPerformanceRevision")?.status, "failed");
});

test("legacy display orders keep old 07 lock evidence and old 09 factory evidence attached to stable app ids", () => {
  const records = adaptPhaseTwoVerificationRecords({
    latestLegacyDisplayOrderRevision: {
      recordedAt: FIXED_TIME,
      title: "旧编号只读兼容",
      appId: "page-factory",
      result: "历史展示编号不重写。",
      stageEvidence: {
        "07": { result: "旧 07 无显式身份时仍是页面锁定器。" },
        "07-current": { appId: "page-factory", result: "显式身份优先于展示编号。" },
        "09": { result: "旧 09 无显式身份时仍是页面工厂。" },
      },
    },
  });
  assert.equal(records.length, 1);
  assert.equal(records[0].appId, "page-factory");
  assert.equal(records[0].relatedAppIds.includes("page-lock"), true);
  assert.equal(records[0].relatedAppIds.includes("page-factory"), true);
});

test("current contract display order resolves bare 07 stage evidence to Page Factory", () => {
  const records = adaptPhaseTwoVerificationRecords({
    latestCurrentDisplayOrderRevision: {
      recordedAt: FIXED_TIME,
      contractVersion: DEVELOPER_NAVIGATION_ORDER_MIGRATION_CONTRACT_VERSION,
      appId: "page-factory",
      result: "当前导航编号读取当前应用身份。",
      stageEvidence: {
        "07": { result: "当前 07 是页面工厂。" },
      },
    },
  });
  assert.equal(records.length, 1);
  assert.equal(records[0].appId, "page-factory");
  assert.equal(records[0].relatedAppIds.includes("page-factory"), true);
  assert.equal(records[0].relatedAppIds.includes("page-lock"), false);
});

test("filtering and sorting support application, authority, status, page, H version, time and keyword", () => {
  const records = [
    record({ recordId: "old", recordedAt: "2026-08-28T08:00:00.000Z", hVersion: "H1", summary: "旧视觉证据" }),
    record({ recordId: "new", recordedAt: "2026-08-28T09:00:00.000Z", hVersion: "H2", summary: "最新视觉证据" }),
    record({
      recordId: "lock",
      appId: "page-lock",
      relatedAppIds: ["page-lock", "page-factory"],
      artifactKind: "lock-receipt",
      recordedAt: "2026-08-28T08:30:00.000Z",
      status: "blocked",
      title: "08 页面锁定器",
      summary: "页面仍被锁定",
    }),
  ];
  assert.deepEqual(sortDeveloperRecords(records).map((entry) => entry.recordId), ["new", "lock", "old"]);
  assert.deepEqual(sortDeveloperRecords(records, "asc").map((entry) => entry.recordId), ["old", "lock", "new"]);
  assert.deepEqual(filterDeveloperRecords(records, { appIds: ["page-lock"] }).map((entry) => entry.recordId), ["lock"]);
  assert.deepEqual(filterDeveloperRecords(records, { appIds: ["page-factory"], limit: 2 }).map((entry) => entry.recordId), ["new", "lock"]);
  assert.deepEqual(filterDeveloperRecords(records, { statuses: ["blocked"], search: "仍被锁定" }).map((entry) => entry.recordId), ["lock"]);
  assert.deepEqual(filterDeveloperRecords(records, { hVersion: "H1" }).map((entry) => entry.recordId), ["old"]);
  assert.deepEqual(filterDeveloperRecords(records, {
    authorities: ["local"],
    pageIdentity: "client_source:/zb/client-source/product-market?tab=service",
    from: "2026-08-28T08:15:00.000Z",
    to: "2026-08-28T08:45:00.000Z",
  }).map((entry) => entry.recordId), ["lock"]);
});

test("08 lock receipts and generic local storage remain scope-bound, bounded and convenience-only", () => {
  const storage = new MemoryStorage();
  const receipt = createDeveloperLockReceipt({
    action: "lock",
    scope: "page",
    scopeIdentity: PAGE_SCOPE_IDENTITY,
    sourceScope: "client_source",
    pageIdentity: "client_source:/zb/client-source/product-market?tab=service",
    targetIds: ["service", "service", "layout"],
    recordedAt: "2026-08-28T08:30:00.000Z",
    artifactRefs: ["lock-state:service", "C:\\private\\lock.json"],
  });
  assert.ok(receipt);
  assert.equal(receipt.authority, "local");
  assert.equal(receipt.appId, "page-lock");
  assert.match(receipt.title, /^08 页面锁定器/u);
  assert.equal(receipt.artifactRefs.includes("C:\\private\\lock.json"), false);

  const first = appendLocalDeveloperRecord(receipt, { storage, maximumRecordsPerScope: 2 });
  assert.equal(first.saved, true);
  appendLocalDeveloperRecord(recordInput({
    recordId: "second",
    authority: "source",
    recordedAt: "2026-08-28T09:00:00.000Z",
  }), { storage, maximumRecordsPerScope: 2 });
  const third = appendLocalDeveloperRecord(recordInput({
    recordId: "third",
    recordedAt: "2026-08-28T10:00:00.000Z",
  }), { storage, maximumRecordsPerScope: 2 });
  assert.equal(third.saved, true);
  assert.deepEqual(third.records.map((entry) => entry.recordId), ["third", "second"]);
  assert.equal(third.records.every((entry) => entry.authority === "local"), true);

  const listed = listLocalDeveloperRecords(PAGE_SCOPE_IDENTITY, storage);
  assert.deepEqual(listed.map((entry) => entry.recordId), ["third", "second"]);
  assert.deepEqual(listLocalDeveloperRecords("global:client_source", storage), []);

  const envelope = JSON.parse(storage.values.get(buildDeveloperRecordStorageKey(PAGE_SCOPE_IDENTITY)) || "{}");
  assert.equal(envelope.formalAudit, false);
  assert.equal(envelope.disclaimer, DEVELOPER_RECORD_LOCAL_DISCLAIMER);
});

test("local parsing fails closed for malformed, foreign-scope and non-local records", () => {
  assert.deepEqual(parseLocalDeveloperRecords("{broken", PAGE_SCOPE_IDENTITY), []);
  assert.deepEqual(parseLocalDeveloperRecords({ records: [
    { ...recordInput(), schemaVersion: 1, recordId: "server", authority: "server" },
    { ...recordInput({ scopeIdentity: "global:client_source" }), schemaVersion: 1, recordId: "other", authority: "local" },
    { ...recordInput(), schemaVersion: 1, recordId: "local", authority: "local" },
  ] }, PAGE_SCOPE_IDENTITY).map((entry) => entry.recordId), ["local"]);
  assert.equal(normalizeDeveloperRecordEntry({ recordId: "missing-fields" }), null);
});
