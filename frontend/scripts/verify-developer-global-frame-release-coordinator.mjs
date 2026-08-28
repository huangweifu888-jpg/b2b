import fs from "node:fs";
import { webcrypto } from "node:crypto";

import { build } from "esbuild";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

const executable = await build({
  stdin: {
    contents: [
      'export * from "./src/lib/developer-global-frame-release-coordinator.ts";',
      'export * from "./src/lib/developer-global-frame-draft.ts";',
      'export * from "./src/lib/developer-global-batch-release.ts";',
      'export * from "./src/lib/developer-global-style-contract.ts";',
    ].join("\n"),
    loader: "ts",
    resolveDir: process.cwd(),
    sourcefile: "developer-global-frame-release-coordinator-verifier-entry.ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  plugins: [{
    name: "template-api-stub",
    setup(buildContext) {
      buildContext.onResolve({ filter: /^@\/lib\/template-snapshot\/api$/ }, () => ({
        path: "template-api-stub",
        namespace: "coordinator-verifier",
      }));
      buildContext.onLoad({ filter: /.*/, namespace: "coordinator-verifier" }, () => ({
        loader: "js",
        contents: [
          "export const fetchTemplate = async () => { throw new Error('stub'); };",
          "export const fetchTemplateReleaseBatch = async () => { throw new Error('stub'); };",
          "export const mergeDeveloperGlobalFrameDraft = async () => { throw new Error('stub'); };",
          "export const mergeDeveloperGlobalFrameDraftWithPreflightEvidence = async () => { throw new Error('stub'); };",
          "export const publishTemplate = async () => { throw new Error('stub'); };",
          "export const listTemplateVersions = async () => { throw new Error('stub'); };",
          "export const createDeveloperGlobalFrameReleaseBatch = async () => { throw new Error('stub'); };",
          "export const recordDeveloperGlobalFrameFactoryDefaultReceipt = async () => { throw new Error('stub'); };",
          "export const fetchLatestDeveloperGlobalFrameFactoryDefaultReceipt = async () => { throw new Error('stub'); };",
        ].join("\n"),
      }));
    },
  }],
  write: false,
  logLevel: "silent",
});
const bundled = executable.outputFiles[0]?.text;
requireCondition(bundled, "无法构建全局框架发布协调器行为夹具。");
const contract = await import(`data:text/javascript;base64,${Buffer.from(bundled).toString("base64")}`);

let tick = Date.parse("2026-08-23T08:00:00.000Z");
const clock = () => new Date(tick += 1_000);
const canaryDraft = {
  contractVersion: contract.DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION,
  id: "coordinator-canary",
  mode: "canary-profile",
  workspaceScope: "client_source",
  pathname: "/zb/client-source/product-market",
  search: "?tab=operations",
  appearance: {
    frameInsets: { top: 12, right: 12, bottom: 60, left: 12 },
    componentStyles: {},
    sharedStylePatch: { layoutStyle: {}, globalTypography: {} },
  },
  visualAuditId: "coordinator-audit",
  recoveryPointId: "coordinator-recovery",
  baselineOnly: false,
  savedAt: new Date(tick).toISOString(),
};

function sectionFor(profileVersion) {
  return contract.buildDeveloperGlobalFrameSection({
    profileVersion,
    sourceScope: "client_source",
    canaryDraft,
    recoveryDraftId: "coordinator-recovery-draft",
    pilotVerificationId: "coordinator-pilot-verification",
    pilotVerifiedAt: new Date(tick).toISOString(),
    pilotChecks: contract.DEVELOPER_GLOBAL_STYLE_PILOT_CHECK_IDS,
  });
}

const probeSection = sectionFor("9.0.0");
const basePreflight = contract.inspectDeveloperGlobalBatchPreflight(probeSection);
const firstReadyTarget = basePreflight.targets.find((target) => target.status === "ready");
requireCondition(firstReadyTarget, "页面工厂没有可用于协调器测试的 ready 页面。");
const onePassingCheck = [{
  pageId: firstReadyTarget.pageId,
  passed: true,
  checkedAt: new Date(tick).toISOString(),
  checkIds: ["three-scope", "responsive", "annotation", "scroll-owner"],
  issues: [],
}];

function trustedAcceptanceFor(section, draftId) {
  const targetIds = contract.inspectDeveloperGlobalBatchPreflight(section).targets.map((target) => target.pageId);
  return {
    acceptanceArtifactId: `acceptance-${draftId}`,
    acceptanceArtifactHash: "d".repeat(64),
    issuedAt: new Date(tick).toISOString(),
    expiresAt: new Date(tick + 20 * 60 * 1_000).toISOString(),
    pageChecks: onePassingCheck.map((check) => ({ ...check, checkedAt: new Date(tick).toISOString() })),
    compatibleTargetPageIds: [firstReadyTarget.pageId],
    isolatedPageIds: targetIds.filter((pageId) => pageId !== firstReadyTarget.pageId),
  };
}

// Local development repository: exact subset preview, never publication truth.
const localStorage = memoryStorage();
const localStateRepository = contract.createDeveloperGlobalFrameLocalStateRepository(localStorage);
const localReleaseRepository = contract.createDeveloperGlobalFrameLocalDevRepository(localStorage);
const localCoordinator = contract.createDeveloperGlobalFrameReleaseCoordinator({
  releaseRepository: localReleaseRepository,
  stateRepository: localStateRepository,
  clock,
});
let localBuildCount = 0;
const localPrepared = await localCoordinator.prepare({
  draftId: "local-preview-draft",
  requestedProfileVersion: "9.0.0",
  requireExplicitTargetEvidence: true,
  pageChecks: onePassingCheck,
  buildSection: ({ profileVersion }) => {
    localBuildCount += 1;
    return sectionFor(profileVersion);
  },
});
requireCondition(localBuildCount === 1, "local prepare 重复构建了 section。");
requireCondition(localPrepared.stage === "prepared", "local 单页证据未通过预检。");
requireCondition(
  JSON.stringify(localPrepared.compatibleTargetPageIds) === JSON.stringify([firstReadyTarget.pageId]),
  "local 预检没有持久化精确 compatibleTargetPageIds 子集。",
);
requireCondition(localPrepared.isolatedPageIds.length === basePreflight.targets.length - 1, "local 隔离清单不完整。");
const localSaved = await localCoordinator.commitDraft(localPrepared.draftId);
requireCondition(localSaved.stage === "draft-saved", "local 开发预览未接通 batch writer。");
requireCondition(localSaved.savedDraftHash === localSaved.artifactHash, "local preview 未使用同一不可变 artifact hash。");
const localRelease = contract.readDeveloperGlobalLocalBatchRelease(localStorage);
requireCondition(
  JSON.stringify(localRelease?.compatibleTargetPageIds) === JSON.stringify([firstReadyTarget.pageId]),
  "local batch reader 拒绝了预检通过子集或扩大了应用范围。",
);
let localPublishBlocked = false;
try {
  await localCoordinator.requestPublication(localSaved.draftId);
} catch {
  localPublishBlocked = true;
}
requireCondition(localPublishBlocked, "localStorage 预览被误当成跨设备发布事实。");
let localFactoryReceiptBlocked = false;
try {
  await contract.buildDeveloperGlobalFrameFactoryDefaultReceipt(localSaved);
} catch {
  localFactoryReceiptBlocked = true;
}
requireCondition(localFactoryReceiptBlocked, "local preview 错误生成了工厂默认凭据。");
const defaultServerBoundary = contract.createDeveloperGlobalFrameServerRepository();
requireCondition(
  defaultServerBoundary.capabilities.crossDevicePublication
    && defaultServerBoundary.capabilities.durablePreflightEvidence
    && defaultServerBoundary.capabilities.trustedAcceptance,
  "未配置 server 证据端点时必须允许原子草稿、但禁止把本机隔离清单冒充持久发布证据。",
);

requireCondition(
  contract.DEVELOPER_GLOBAL_FRAME_RUNTIME_SCOPE_BY_SOURCE_SCOPE.hq === null
    && contract.DEVELOPER_GLOBAL_FRAME_RUNTIME_SCOPE_BY_SOURCE_SCOPE.agency_source === "agency"
    && contract.DEVELOPER_GLOBAL_FRAME_RUNTIME_SCOPE_BY_SOURCE_SCOPE.client_source === "client",
  "source-template scopes are not explicitly mapped to runtime rollout scopes",
);

// Server repository: one GET/hash, one build, exact merge hash, two-review publication, rollout.
const serverCalls = { head: 0, saves: [], publications: [], rollouts: [] };
let publicationStatus = "pending_review";
const fakeServerRepository = {
  kind: "server-test",
  capabilities: {
    crossDevicePublication: true,
    durablePreflightEvidence: true,
    trustedAcceptance: true,
    rollout: true,
    factoryDefault: false,
  },
  async readHead() {
    serverCalls.head += 1;
    return {
      templateId: contract.DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
      ownerScope: "client_source",
      latestVersion: "9.0.0",
      draftConfigHash: "a".repeat(64),
    };
  },
  async saveDraftAtomic(request) {
    serverCalls.saves.push(structuredClone(request));
    return {
      savedDraftHash: "b".repeat(64),
      acceptedArtifactHash: request.artifactHash,
      section: structuredClone(request.section),
      preservedSiblingKeys: ["business", "modules"],
      durablePreflightEvidence: {
        templateId: request.templateId,
        sourceScope: request.section.source_scope,
        baseDraftHash: request.baseDraftHash,
        artifactHash: request.artifactHash,
        savedDraftHash: "b".repeat(64),
        compatibleTargetPageIds: [...request.compatibleTargetPageIds],
        isolatedPageIds: [...request.isolatedPageIds],
        recoveryPointId: request.section.recovery.recovery_point_id,
        checkedAt: request.checkedAt,
        evidenceHash: "c".repeat(64),
        visualDraftId: request.visualDraftId,
        acceptanceArtifactId: request.acceptanceArtifactId,
        acceptanceArtifactHash: request.acceptanceArtifactHash,
      },
    };
  },
  async requestPublication(request) {
    serverCalls.publications.push(structuredClone(request));
    return { version: request.version, reviewStatus: publicationStatus, releaseSections: ["developer_global_frame"] };
  },
  async readPublication(version) {
    return { version, reviewStatus: publicationStatus, releaseSections: ["developer_global_frame"] };
  },
  async startRollout(instanceIds) {
    serverCalls.rollouts.push(instanceIds);
    return {
      batchId: "batch-atomic-1",
      templateId: contract.DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
      templateVersion: "9.0.1",
      ownerScope: "client",
      sections: ["developer_global_frame"],
      status: "completed",
      totalTargets: 2,
      succeededTargets: 2,
      failedTargets: 0,
    };
  },
};
const serverStorage = memoryStorage();
const serverCoordinator = contract.createDeveloperGlobalFrameReleaseCoordinator({
  releaseRepository: fakeServerRepository,
  stateRepository: contract.createDeveloperGlobalFrameLocalStateRepository(serverStorage),
  clock,
});
let serverBuildCount = 0;
let missingAcceptanceBlocked = false;
try {
  await serverCoordinator.prepare({
    draftId: "server-missing-acceptance",
    requestedProfileVersion: "9.0.0",
    pageChecks: onePassingCheck,
    buildSection: ({ profileVersion }) => sectionFor(profileVersion),
  });
} catch {
  missingAcceptanceBlocked = true;
}
requireCondition(missingAcceptanceBlocked, "server prepare accepted browser-fabricated page checks without trusted attestation");

let expiredAcceptanceBlocked = false;
try {
  await serverCoordinator.prepare({
    draftId: "server-expired-acceptance",
    requestedProfileVersion: "9.0.0",
    resolveAcceptanceEvidence: ({ section, draftId }) => {
      const evidence = trustedAcceptanceFor(section, draftId);
      return Promise.resolve({
        ...evidence,
        issuedAt: new Date(tick - 31 * 60 * 1_000).toISOString(),
        expiresAt: new Date(tick - 1_000).toISOString(),
      });
    },
    buildSection: ({ profileVersion }) => sectionFor(profileVersion),
  });
} catch {
  expiredAcceptanceBlocked = true;
}
requireCondition(expiredAcceptanceBlocked, "server prepare accepted stale/expired trusted attestation");
serverCalls.head = 0;

const serverPrepared = await serverCoordinator.prepare({
  draftId: "server-release-draft",
  requestedProfileVersion: "9.0.0",
  resolveAcceptanceEvidence: ({ section, draftId }) => Promise.resolve(trustedAcceptanceFor(section, draftId)),
  buildSection: ({ profileVersion, latestVersion, baseDraftHash }) => {
    serverBuildCount += 1;
    requireCondition(latestVersion === "9.0.0", "builder 未收到 GET 的 latestVersion。");
    requireCondition(baseDraftHash === "a".repeat(64), "builder 未收到 GET 的 draft hash。");
    return sectionFor(profileVersion);
  },
});
requireCondition(serverCalls.head === 1 && serverBuildCount === 1, "server prepare 不是一次 GET、一次构建。");
requireCondition(serverPrepared.resolvedProfileVersion === "9.0.1", "当前不可变版本未自动 bump patch。");
const serverSaved = await serverCoordinator.commitDraft(serverPrepared.draftId);
requireCondition(serverSaved.stage === "draft-saved", "server 原子草稿提交失败。");
requireCondition(serverCalls.saves.length === 1, "server section 被重复提交。");
requireCondition(serverCalls.saves[0].baseDraftHash === "a".repeat(64), "commit 未复用 prepare GET 的同一 base hash。");
requireCondition(serverCalls.saves[0].artifactHash === serverPrepared.artifactHash, "commit 未提交 prepare 的同一 artifact hash。");
requireCondition(serverSaved.savedDraftHash === "b".repeat(64), "server 返回 draft hash 未冻结到状态。");
requireCondition(serverSaved.durablePreflightEvidenceHash === "c".repeat(64), "server durable evidence hash 未冻结到协调器状态。");
const reviewPending = await serverCoordinator.requestPublication(serverSaved.draftId, { changelog: "global frame" });
requireCondition(reviewPending.stage === "review-pending", "二审版本被错误视为已发布。");
requireCondition(
  serverCalls.publications[0].expectedDraftConfigHash === "b".repeat(64)
    && serverCalls.publications[0].expectedPreflightArtifactHash === serverSaved.artifactHash,
  "发布请求未使用原子 merge 返回的 exact draft hash。",
);
publicationStatus = "published";
const published = await serverCoordinator.refreshPublication(serverSaved.draftId);
requireCondition(published.stage === "published" && published.publishedVersion === "9.0.1", "二审 published 证据未推进状态。");
const rolledOut = await serverCoordinator.startRollout(serverSaved.draftId, ["instance-a", "instance-b"]);
requireCondition(rolledOut.stage === "rollout-complete" && rolledOut.rolloutBatchId === "batch-atomic-1", "发布后区段 rollout 未完成。");
const receiptStorage = memoryStorage();
const receipt = await contract.recordDeveloperGlobalFrameFactoryDefaultReceipt(receiptStorage, rolledOut, new Date(tick).toISOString());
requireCondition(await contract.validateDeveloperGlobalFrameFactoryDefaultReceipt(receipt), "有效工厂默认凭据未通过 hash 校验。");
requireCondition(
  receipt.publishedVersion === rolledOut.publishedVersion
    && receipt.artifactHash === rolledOut.artifactHash
    && receipt.draftHash === rolledOut.savedDraftHash
    && receipt.preflightEvidenceHash === rolledOut.durablePreflightEvidenceHash
    && receipt.recoveryPointId === rolledOut.recoveryPointId,
  "工厂默认凭据没有冻结 version/artifact/draft/preflight/recovery 不可变证据。",
);
const tamperedReceipt = structuredClone(receipt);
tamperedReceipt.compatibleTargetPageIds.push("forged-page");
requireCondition(!(await contract.validateDeveloperGlobalFrameFactoryDefaultReceipt(tamperedReceipt)), "篡改的工厂默认凭据未 fail closed。");

// Server factory default: the exact canonical receipt must be durably recorded and read back.
let serverFactoryReceipt = null;
const factoryReceiptResponse = (input) => ({
  receiptId: "factory-receipt-1",
  sourceScope: "client_source",
  rolloutOwnerScope: "client",
  preflightEvidenceId: "preflight-evidence-1",
  recordedBy: "reviewer-2",
  createdAt: input.recordedAt,
  valid: true,
  ...structuredClone(input),
});
const serverFactoryRepository = contract.createDeveloperGlobalFrameServerRepository({
  fetchTemplate: async () => { throw new Error("unused"); },
  publishTemplate: async () => { throw new Error("unused"); },
  listTemplateVersions: async () => { throw new Error("unused"); },
  createDeveloperGlobalFrameReleaseBatch: async () => { throw new Error("unused"); },
  fetchTemplateReleaseBatch: async () => { throw new Error("unused"); },
  recordDeveloperGlobalFrameFactoryDefaultReceipt: async (input) => {
    serverFactoryReceipt = factoryReceiptResponse(input);
    return serverFactoryReceipt;
  },
  fetchLatestDeveloperGlobalFrameFactoryDefaultReceipt: async () => {
    if (!serverFactoryReceipt) throw new Error("missing server factory receipt");
    return structuredClone(serverFactoryReceipt);
  },
});
requireCondition(serverFactoryRepository.capabilities.factoryDefault, "server factory-default capability was not exposed");
const serverRecordedReceipt = await serverFactoryRepository.recordFactoryDefaultReceipt(receipt);
const serverReadBackReceipt = await serverFactoryRepository.readLatestFactoryDefaultReceipt();
requireCondition(
  serverRecordedReceipt.receiptHash === receipt.receiptHash
    && serverReadBackReceipt.receiptHash === receipt.receiptHash
    && serverReadBackReceipt.recordedAt === new Date(serverReadBackReceipt.recordedAt).toISOString(),
  "server factory-default exact write/read or UTC millisecond canonicalization failed",
);

const tamperedServerFactoryRepository = contract.createDeveloperGlobalFrameServerRepository({
  fetchTemplate: async () => { throw new Error("unused"); },
  publishTemplate: async () => { throw new Error("unused"); },
  listTemplateVersions: async () => { throw new Error("unused"); },
  createDeveloperGlobalFrameReleaseBatch: async () => { throw new Error("unused"); },
  fetchTemplateReleaseBatch: async () => { throw new Error("unused"); },
  recordDeveloperGlobalFrameFactoryDefaultReceipt: async (input) => factoryReceiptResponse({
    ...input,
    compatibleTargetPageIds: [...input.compatibleTargetPageIds, "forged-page"],
  }),
  fetchLatestDeveloperGlobalFrameFactoryDefaultReceipt: async () => { throw new Error("unused"); },
});
let tamperedServerReceiptBlocked = false;
try {
  await tamperedServerFactoryRepository.recordFactoryDefaultReceipt(receipt);
} catch {
  tamperedServerReceiptBlocked = true;
}
requireCondition(tamperedServerReceiptBlocked, "tampered server factory-default response did not fail closed");

// Persisted artifact tampering and optimistic conflicts both fail closed.
const tamperStorage = memoryStorage();
const tamperCoordinator = contract.createDeveloperGlobalFrameReleaseCoordinator({
  releaseRepository: fakeServerRepository,
  stateRepository: contract.createDeveloperGlobalFrameLocalStateRepository(tamperStorage),
  clock,
});
const tamperPrepared = await tamperCoordinator.prepare({
  draftId: "tamper-draft",
  requestedProfileVersion: "10.0.0",
  resolveAcceptanceEvidence: ({ section, draftId }) => Promise.resolve(trustedAcceptanceFor(section, draftId)),
  buildSection: ({ profileVersion }) => sectionFor(profileVersion),
});
const stateKey = `${contract.DEVELOPER_GLOBAL_FRAME_COORDINATOR_STORAGE_KEY_PREFIX}:client_source`;
const tamperedState = JSON.parse(tamperStorage.getItem(stateKey));
tamperedState.section.region_tokens.workspace.background_color = "#010203";
tamperStorage.setItem(stateKey, JSON.stringify(tamperedState));
const tamperResult = await tamperCoordinator.commitDraft(tamperPrepared.draftId);
requireCondition(tamperResult.stage === "failed" && tamperResult.error?.code === "artifact-hash-mismatch", "持久化 artifact 篡改未 fail closed。");

const conflictStorage = memoryStorage();
const conflictRepository = {
  ...fakeServerRepository,
  kind: "server-conflict-test",
  async saveDraftAtomic() {
    const error = new Error("stale hash");
    error.status = 409;
    throw error;
  },
};
const conflictCoordinator = contract.createDeveloperGlobalFrameReleaseCoordinator({
  releaseRepository: conflictRepository,
  stateRepository: contract.createDeveloperGlobalFrameLocalStateRepository(conflictStorage),
  clock,
});
const conflictPrepared = await conflictCoordinator.prepare({
  draftId: "conflict-draft",
  requestedProfileVersion: "11.0.0",
  resolveAcceptanceEvidence: ({ section, draftId }) => Promise.resolve(trustedAcceptanceFor(section, draftId)),
  buildSection: ({ profileVersion }) => sectionFor(profileVersion),
});
const conflictResult = await conflictCoordinator.commitDraft(conflictPrepared.draftId);
requireCondition(conflictResult.stage === "conflict" && conflictResult.error?.code === "atomic-conflict", "409 没有保留为可重试的原子冲突状态。");

const coordinatorSource = fs.readFileSync("src/lib/developer-global-frame-release-coordinator.ts", "utf8");
const bridgeSource = fs.readFileSync("src/components/developer-platform/DeveloperGlobalFrameWorkflowCoordinatorBridge.tsx", "utf8");
const templateApiSource = fs.readFileSync("src/lib/template-snapshot/api.ts", "utf8");
requireCondition(
  coordinatorSource.includes("mergeDeveloperGlobalFrameDraftWithPreflightEvidence"),
  "default server repository must use the atomic draft plus durable preflight evidence API",
);
requireCondition(coordinatorSource.includes("requiredReviewSteps: 2"), "server publication 未强制二审。");
requireCondition(coordinatorSource.includes("requiredSections: [DEVELOPER_GLOBAL_FRAME_SECTION_NAME]"), "server publication 未限制为 appearance section。");
requireCondition(coordinatorSource.includes('reviewStatus: version.reviewStatus ?? "unknown"'), "缺失 reviewStatus 时发布门禁未 fail closed。");
requireCondition(coordinatorSource.includes("assertRolloutEvidenceMatchesState"), "rollout 未核对同一 template/version/section 与非空目标。");
requireCondition(coordinatorSource.includes("writeDeveloperGlobalLocalBatchRelease"), "local-dev repository 未接通现有 batch writer。");
requireCondition(coordinatorSource.includes("crossDevicePublication: false"), "local preview capability 未明确禁止跨设备发布。");
requireCondition(coordinatorSource.includes("persistPreflightEvidence"), "server repository 未暴露可扩展的持久隔离证据边界。");
requireCondition(coordinatorSource.includes("recordFactoryDefaultReceipt"), "server repository is missing durable factory-default write/read methods");
requireCondition(coordinatorSource.includes("canonicalRecordedAt"), "factory-default receipt does not freeze UTC milliseconds before hashing");
requireCondition(bridgeSource.includes("releaseRepository.recordFactoryDefaultReceipt(candidateReceipt)"), "workflow still records factory default only in local storage");
requireCondition(bridgeSource.includes("releaseRepository.readLatestFactoryDefaultReceipt()"), "workflow does not verify cross-browser factory-default readback");
requireCondition(
  bridgeSource.includes("fetchDeveloperGlobalFrameAcceptanceArtifact")
    && bridgeSource.includes("buildPageChecksFromAcceptance")
    && !bridgeSource.includes("function buildPageChecks(checkedAt"),
  "workflow bridge still fabricates passing page checks from the local registry instead of a trusted acceptance attestation",
);
requireCondition(
  coordinatorSource.includes("trustedAcceptance")
    && coordinatorSource.includes("acceptanceArtifactId")
    && coordinatorSource.includes("acceptanceArtifactHash"),
  "coordinator artifact/save state is not bound to the trusted acceptance attestation",
);
requireCondition(
  templateApiSource.includes("fetchDeveloperGlobalFrameAcceptanceArtifact")
    && templateApiSource.includes("acceptance-artifacts/latest")
    && !templateApiSource.includes("export async function recordDeveloperGlobalFrameAcceptanceArtifact"),
  "browser API must be read-only for trusted acceptance artifacts",
);

console.log(`全局框架发布协调器通过：一次构建/同 hash 原子提交；${serverPrepared.compatibleTargetPageIds.length} 页兼容、${serverPrepared.isolatedPageIds.length} 页持久隔离；二审、rollout 与工厂凭据门禁闭合。`);
