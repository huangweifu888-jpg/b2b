import {
  createDeveloperGlobalFrameReleaseBatch,
  fetchLatestDeveloperGlobalFrameFactoryDefaultReceipt as fetchLatestDeveloperGlobalFrameFactoryDefaultReceiptFromServer,
  fetchTemplateReleaseBatch,
  fetchTemplate,
  listTemplateVersions,
  mergeDeveloperGlobalFrameDraft,
  mergeDeveloperGlobalFrameDraftWithPreflightEvidence,
  publishTemplate,
  recordDeveloperGlobalFrameFactoryDefaultReceipt as recordDeveloperGlobalFrameFactoryDefaultReceiptOnServer,
  type TemplateReleaseBatchResponse,
} from "@/lib/template-snapshot/api";
import type { TemplateVersionResponse } from "@/lib/template-snapshot/types";
import {
  inspectDeveloperGlobalBatchPreflight,
  writeDeveloperGlobalLocalBatchRelease,
  type DeveloperGlobalBatchTargetStatus,
} from "@/lib/developer-global-batch-release";
import {
  DEVELOPER_GLOBAL_FRAME_PROTECTED_OWNERSHIP,
  DEVELOPER_GLOBAL_FRAME_SECTION_NAME,
  DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
  bumpDeveloperGlobalFrameProfileVersionIfCurrent,
  validateDeveloperGlobalFrameSection,
  type DeveloperGlobalFrameSection,
  type DeveloperGlobalFrameSourceScope,
} from "@/lib/developer-global-frame-draft";

export const DEVELOPER_GLOBAL_FRAME_COORDINATOR_SCHEMA_VERSION = 2 as const;
export const DEVELOPER_GLOBAL_FRAME_COORDINATOR_STORAGE_KEY_PREFIX = "tradepro:developer-global-frame:coordinator.v2" as const;
export const DEVELOPER_GLOBAL_FRAME_FACTORY_DEFAULT_RECEIPT_KEY = "tradepro:developer-global-frame:factory-default-receipt.v1" as const;

const SHA256 = /^[0-9a-f]{64}$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:._/?=&-]{0,199}$/u;
const MAX_COORDINATOR_STATE_BYTES = 600_000;
const MAX_PREFLIGHT_EVIDENCE_AGE_MS = 30 * 60 * 1_000;
const MAX_PREFLIGHT_EVIDENCE_FUTURE_SKEW_MS = 5_000;
const EMPTY_LOCAL_DRAFT_HASH = "0".repeat(64);
const LOCAL_REPOSITORY_HEAD_KEY = "tradepro:developer-global-frame:local-repository-head.v1";

export type DeveloperGlobalFrameCoordinatorStage =
  | "preflight-blocked"
  | "prepared"
  | "draft-saved"
  | "review-pending"
  | "published"
  | "rollout-pending"
  | "rollout-complete"
  | "conflict"
  | "failed";

export type DeveloperGlobalFramePageCheck = {
  pageId: string;
  passed: boolean;
  checkedAt: string;
  checkIds: readonly string[];
  issues: readonly string[];
};

export type DeveloperGlobalFrameAcceptanceEvidence = {
  acceptanceArtifactId: string;
  acceptanceArtifactHash: string;
  issuedAt: string;
  expiresAt: string;
  pageChecks: readonly DeveloperGlobalFramePageCheck[];
  compatibleTargetPageIds: readonly string[];
  isolatedPageIds: readonly string[];
};

export type DeveloperGlobalFramePreflightTarget = {
  pageId: string;
  label: string;
  route: string;
  sourceScope: string;
  baseStatus: DeveloperGlobalBatchTargetStatus;
  disposition: "compatible" | "isolated";
  checkIds: string[];
  issues: string[];
};

export type DeveloperGlobalFrameCoordinatorPreflight = {
  passed: boolean;
  checkedAt: string;
  requireExplicitTargetEvidence: boolean;
  issues: string[];
  targets: DeveloperGlobalFramePreflightTarget[];
  compatibleTargetPageIds: string[];
  isolatedPageIds: string[];
};

export type DeveloperGlobalFrameRepositoryHead = {
  templateId: typeof DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID;
  ownerScope: DeveloperGlobalFrameSourceScope;
  latestVersion: string | null;
  draftConfigHash: string;
};

export type DeveloperGlobalFrameAtomicDraftRequest = {
  templateId: typeof DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID;
  baseDraftHash: string;
  artifactHash: string;
  section: DeveloperGlobalFrameSection;
  compatibleTargetPageIds: readonly string[];
  isolatedPageIds: readonly string[];
  checkedAt: string;
  visualDraftId: string;
  acceptanceArtifactId: string | null;
  acceptanceArtifactHash: string | null;
};

export type DeveloperGlobalFrameAtomicDraftResult = {
  savedDraftHash: string;
  acceptedArtifactHash: string;
  section: DeveloperGlobalFrameSection;
  preservedSiblingKeys: string[];
  durablePreflightEvidence: {
    templateId: typeof DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID;
    sourceScope: DeveloperGlobalFrameSourceScope;
    baseDraftHash: string;
    artifactHash: string;
    savedDraftHash: string;
    compatibleTargetPageIds: string[];
    isolatedPageIds: string[];
    recoveryPointId: string;
    checkedAt: string;
    evidenceHash: string;
    visualDraftId: string;
    acceptanceArtifactId: string;
    acceptanceArtifactHash: string;
  } | null;
};

export type DeveloperGlobalFramePublicationEvidence = {
  version: string;
  reviewStatus: string;
  releaseSections: readonly [typeof DEVELOPER_GLOBAL_FRAME_SECTION_NAME] | null;
};

export type DeveloperGlobalFrameRuntimeOwnerScope = "agency" | "client";

export const DEVELOPER_GLOBAL_FRAME_RUNTIME_SCOPE_BY_SOURCE_SCOPE: Readonly<
  Record<DeveloperGlobalFrameSourceScope, DeveloperGlobalFrameRuntimeOwnerScope | null>
> = Object.freeze({
  hq: null,
  agency_source: "agency",
  client_source: "client",
});

export type DeveloperGlobalFrameRolloutEvidence = {
  batchId: string;
  templateId: typeof DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID;
  templateVersion: string;
  ownerScope: DeveloperGlobalFrameRuntimeOwnerScope;
  sections: readonly [typeof DEVELOPER_GLOBAL_FRAME_SECTION_NAME] | null;
  status: string;
  totalTargets: number;
  succeededTargets: number;
  failedTargets: number;
};

export type DeveloperGlobalFrameReleaseRepository = {
  readonly kind: "local-dev-preview" | "server" | (string & {});
  readonly capabilities: {
    crossDevicePublication: boolean;
    durablePreflightEvidence: boolean;
    trustedAcceptance: boolean;
    rollout: boolean;
    factoryDefault: boolean;
  };
  readHead(): Promise<DeveloperGlobalFrameRepositoryHead>;
  saveDraftAtomic(request: DeveloperGlobalFrameAtomicDraftRequest): Promise<DeveloperGlobalFrameAtomicDraftResult>;
  requestPublication?(input: {
    templateId: typeof DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID;
    version: string;
    expectedDraftConfigHash: string;
    expectedPreflightArtifactHash: string;
    changelog: string | null;
    publishedBy: string | null;
    reviewAssignee: string | null;
    reviewDueAt: string | null;
  }): Promise<DeveloperGlobalFramePublicationEvidence>;
  readPublication?(version: string): Promise<DeveloperGlobalFramePublicationEvidence | null>;
  startRollout?(instanceIds: string[] | null): Promise<DeveloperGlobalFrameRolloutEvidence>;
  readRollout?(batchId: string): Promise<DeveloperGlobalFrameRolloutEvidence>;
  recordFactoryDefaultReceipt?(receipt: DeveloperGlobalFrameFactoryDefaultReceipt): Promise<DeveloperGlobalFrameFactoryDefaultReceipt>;
  readLatestFactoryDefaultReceipt?(): Promise<DeveloperGlobalFrameFactoryDefaultReceipt>;
};

export type DeveloperGlobalFrameCoordinatorState = {
  schemaVersion: typeof DEVELOPER_GLOBAL_FRAME_COORDINATOR_SCHEMA_VERSION;
  draftId: string;
  stage: DeveloperGlobalFrameCoordinatorStage;
  repositoryKind: DeveloperGlobalFrameReleaseRepository["kind"];
  templateId: typeof DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID;
  sourceScope: DeveloperGlobalFrameSourceScope;
  requestedProfileVersion: string;
  resolvedProfileVersion: string;
  baseVersion: string | null;
  baseDraftHash: string;
  artifactHash: string;
  savedDraftHash: string | null;
  durablePreflightEvidenceHash: string | null;
  acceptanceArtifactId: string | null;
  acceptanceArtifactHash: string | null;
  acceptanceIssuedAt: string | null;
  acceptanceExpiresAt: string | null;
  section: DeveloperGlobalFrameSection;
  preflight: DeveloperGlobalFrameCoordinatorPreflight;
  compatibleTargetPageIds: string[];
  isolatedPageIds: string[];
  recoveryPointId: string;
  preparedAt: string;
  draftSavedAt: string | null;
  releaseRequestedAt: string | null;
  submittedVersion: string | null;
  publishedVersion: string | null;
  rolloutBatchId: string | null;
  rolloutCompletedAt: string | null;
  updatedAt: string;
  error: { code: string; message: string; at: string } | null;
};

export type DeveloperGlobalFrameCoordinatorStateRepository = {
  read(sourceScope: DeveloperGlobalFrameSourceScope): DeveloperGlobalFrameCoordinatorState | null;
  write(state: DeveloperGlobalFrameCoordinatorState): boolean;
  remove(sourceScope: DeveloperGlobalFrameSourceScope): void;
};

export type DeveloperGlobalFrameFactoryDefaultReceipt = {
  schemaVersion: 1;
  templateId: typeof DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID;
  publishedVersion: string;
  artifactHash: string;
  draftHash: string;
  preflightEvidenceHash: string;
  compatibleTargetPageIds: string[];
  isolatedPageIds: string[];
  recoveryPointId: string;
  rolloutBatchId: string;
  recordedAt: string;
  receiptHash: string;
};

type ServerFactoryDefaultReceipt = Awaited<ReturnType<typeof recordDeveloperGlobalFrameFactoryDefaultReceiptOnServer>>;

function projectServerFactoryDefaultReceipt(value: ServerFactoryDefaultReceipt): DeveloperGlobalFrameFactoryDefaultReceipt {
  if (value.valid !== true
    || value.schemaVersion !== 1
    || value.templateId !== DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID
    || value.sourceScope !== "client_source"
    || value.rolloutOwnerScope !== DEVELOPER_GLOBAL_FRAME_RUNTIME_SCOPE_BY_SOURCE_SCOPE.client_source) {
    throw new Error("server factory-default receipt is not bound to the client-source global frame");
  }
  return {
    schemaVersion: value.schemaVersion,
    templateId: DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
    publishedVersion: value.publishedVersion,
    artifactHash: value.artifactHash,
    draftHash: value.draftHash,
    preflightEvidenceHash: value.preflightEvidenceHash,
    compatibleTargetPageIds: [...value.compatibleTargetPageIds],
    isolatedPageIds: [...value.isolatedPageIds],
    recoveryPointId: value.recoveryPointId,
    rolloutBatchId: value.rolloutBatchId,
    recordedAt: value.recordedAt,
    receiptHash: value.receiptHash,
  };
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function sha256Hex(value: unknown) {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto SHA-256 is unavailable");
  const bytes = new TextEncoder().encode(stableSerialize(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashDeveloperGlobalFrameCanonicalValue(value: unknown) {
  return sha256Hex(value);
}

function sameJson(left: unknown, right: unknown) {
  return stableSerialize(left) === stableSerialize(right);
}

function nowIso(clock: () => Date) {
  return clock().toISOString();
}

function coordinatorStorageKey(sourceScope: DeveloperGlobalFrameSourceScope) {
  return `${DEVELOPER_GLOBAL_FRAME_COORDINATOR_STORAGE_KEY_PREFIX}:${sourceScope}`;
}

function uniqueStrings(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.every((item) => typeof item === "string" && item.length > 0 && item.length <= 300)
    && new Set(value).size === value.length;
}

function hasProtectedBusinessBoundary(section: DeveloperGlobalFrameSection) {
  return section.scope === "appearance-only"
    && sameJson(section.protected_ownership, DEVELOPER_GLOBAL_FRAME_PROTECTED_OWNERSHIP);
}

function validateCoordinatorState(value: unknown): value is DeveloperGlobalFrameCoordinatorState {
  if (!isRecord(value)
    || value.schemaVersion !== DEVELOPER_GLOBAL_FRAME_COORDINATOR_SCHEMA_VERSION
    || typeof value.draftId !== "string"
    || !SAFE_ID.test(value.draftId)
    || typeof value.repositoryKind !== "string"
    || value.templateId !== DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID
    || !(["hq", "agency_source", "client_source"] as const).includes(value.sourceScope as DeveloperGlobalFrameSourceScope)
    || typeof value.requestedProfileVersion !== "string"
    || typeof value.resolvedProfileVersion !== "string"
    || (value.baseVersion !== null && typeof value.baseVersion !== "string")
    || typeof value.baseDraftHash !== "string"
    || !SHA256.test(value.baseDraftHash)
    || typeof value.artifactHash !== "string"
    || !SHA256.test(value.artifactHash)
    || (value.savedDraftHash !== null && (typeof value.savedDraftHash !== "string" || !SHA256.test(value.savedDraftHash)))
    || (value.durablePreflightEvidenceHash !== null
      && (typeof value.durablePreflightEvidenceHash !== "string" || !SHA256.test(value.durablePreflightEvidenceHash)))
    || (value.acceptanceArtifactId !== null
      && (typeof value.acceptanceArtifactId !== "string" || !SAFE_ID.test(value.acceptanceArtifactId)))
    || (value.acceptanceArtifactHash !== null
      && (typeof value.acceptanceArtifactHash !== "string" || !SHA256.test(value.acceptanceArtifactHash)))
    || (value.acceptanceIssuedAt !== null
      && (typeof value.acceptanceIssuedAt !== "string" || !Number.isFinite(Date.parse(value.acceptanceIssuedAt))))
    || (value.acceptanceExpiresAt !== null
      && (typeof value.acceptanceExpiresAt !== "string" || !Number.isFinite(Date.parse(value.acceptanceExpiresAt))))
    || !uniqueStrings(value.compatibleTargetPageIds)
    || !uniqueStrings(value.isolatedPageIds)
    || typeof value.recoveryPointId !== "string"
    || !value.recoveryPointId
    || typeof value.preparedAt !== "string"
    || typeof value.updatedAt !== "string"
    || !Number.isFinite(Date.parse(value.preparedAt))
    || !Number.isFinite(Date.parse(value.updatedAt))) return false;
  const compatibleTargetPageIds = value.compatibleTargetPageIds as string[];
  const isolatedPageIds = value.isolatedPageIds as string[];
  if (compatibleTargetPageIds.some((pageId) => isolatedPageIds.includes(pageId))) return false;
  const stages: DeveloperGlobalFrameCoordinatorStage[] = [
    "preflight-blocked", "prepared", "draft-saved", "review-pending", "published",
    "rollout-pending", "rollout-complete", "conflict", "failed",
  ];
  if (!stages.includes(value.stage as DeveloperGlobalFrameCoordinatorStage)) return false;
  const sectionValidation = validateDeveloperGlobalFrameSection(value.section);
  if (!sectionValidation.valid || !isRecord(value.section)) return false;
  const recovery = value.section.recovery;
  if (!isRecord(recovery)
    || value.section.source_scope !== value.sourceScope
    || value.section.profile_version !== value.resolvedProfileVersion
    || recovery.recovery_point_id !== value.recoveryPointId
    || !hasProtectedBusinessBoundary(value.section as DeveloperGlobalFrameSection)) return false;
  if (!isRecord(value.preflight)
    || !uniqueStrings(value.preflight.compatibleTargetPageIds)
    || !uniqueStrings(value.preflight.isolatedPageIds)
    || !sameJson(value.compatibleTargetPageIds, value.preflight.compatibleTargetPageIds)
    || !sameJson(value.isolatedPageIds, value.preflight.isolatedPageIds)) return false;
  if (value.repositoryKind !== "local-dev-preview"
    && value.stage !== "preflight-blocked"
    && (typeof value.acceptanceArtifactId !== "string"
      || typeof value.acceptanceArtifactHash !== "string"
      || typeof value.acceptanceIssuedAt !== "string"
      || typeof value.acceptanceExpiresAt !== "string")) return false;
  if (["draft-saved", "review-pending", "published", "rollout-pending", "rollout-complete"].includes(value.stage as string)
    && typeof value.savedDraftHash !== "string") return false;
  if (["review-pending", "published", "rollout-pending", "rollout-complete"].includes(value.stage as string)
    && typeof value.durablePreflightEvidenceHash !== "string") return false;
  if (["published", "rollout-pending", "rollout-complete"].includes(value.stage as string)
    && (typeof value.publishedVersion !== "string" || !value.publishedVersion)) return false;
  if (["rollout-pending", "rollout-complete"].includes(value.stage as string)
    && (typeof value.rolloutBatchId !== "string" || !value.rolloutBatchId)) return false;
  if (value.stage === "rollout-complete" && (typeof value.rolloutCompletedAt !== "string" || !Number.isFinite(Date.parse(value.rolloutCompletedAt)))) return false;
  return true;
}

export function createDeveloperGlobalFrameLocalStateRepository(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
): DeveloperGlobalFrameCoordinatorStateRepository {
  return {
    read(sourceScope) {
      const key = coordinatorStorageKey(sourceScope);
      const raw = storage.getItem(key);
      if (!raw) return null;
      if (raw.length > MAX_COORDINATOR_STATE_BYTES) {
        storage.removeItem(key);
        return null;
      }
      try {
        const state = JSON.parse(raw) as unknown;
        if (!validateCoordinatorState(state)) {
          storage.removeItem(key);
          return null;
        }
        return cloneJson(state);
      } catch {
        storage.removeItem(key);
        return null;
      }
    },
    write(state) {
      if (!validateCoordinatorState(state)) return false;
      try {
        storage.setItem(coordinatorStorageKey(state.sourceScope), JSON.stringify(state));
        return true;
      } catch {
        return false;
      }
    },
    remove(sourceScope) {
      storage.removeItem(coordinatorStorageKey(sourceScope));
    },
  };
}

function buildCoordinatorPreflight(
  section: DeveloperGlobalFrameSection,
  checks: readonly DeveloperGlobalFramePageCheck[],
  requireExplicitTargetEvidence: boolean,
  checkedAt: string,
): DeveloperGlobalFrameCoordinatorPreflight {
  const base = inspectDeveloperGlobalBatchPreflight(section);
  const issues = [...base.issues];
  const checkByPage = new Map<string, DeveloperGlobalFramePageCheck>();
  const preflightCheckedAt = Date.parse(checkedAt);
  for (const check of checks) {
    if (!SAFE_ID.test(check.pageId) || checkByPage.has(check.pageId)) {
      issues.push(`invalid or duplicate page preflight evidence: ${check.pageId}`);
      continue;
    }
    const pageCheckedAt = Date.parse(check.checkedAt);
    if (!Number.isFinite(pageCheckedAt)) {
      issues.push(`invalid page preflight timestamp: ${check.pageId}`);
      continue;
    }
    if (pageCheckedAt > preflightCheckedAt + MAX_PREFLIGHT_EVIDENCE_FUTURE_SKEW_MS
      || preflightCheckedAt - pageCheckedAt > MAX_PREFLIGHT_EVIDENCE_AGE_MS) {
      issues.push(`stale or future page preflight evidence: ${check.pageId}`);
      continue;
    }
    if (!Array.isArray(check.checkIds)
      || !check.checkIds.every((checkId) => typeof checkId === "string" && SAFE_ID.test(checkId))
      || new Set(check.checkIds).size !== check.checkIds.length
      || !Array.isArray(check.issues)
      || !check.issues.every((issue) => typeof issue === "string" && issue.trim().length > 0)) {
      issues.push(`malformed page preflight evidence: ${check.pageId}`);
      continue;
    }
    if (check.passed && (check.checkIds.length === 0 || check.issues.length > 0)) {
      issues.push(`passing page preflight evidence is incomplete or contradictory: ${check.pageId}`);
      continue;
    }
    checkByPage.set(check.pageId, check);
  }
  const targetIds = new Set(base.targets.map((target) => target.pageId));
  for (const pageId of checkByPage.keys()) {
    if (!targetIds.has(pageId)) issues.push(`preflight evidence does not belong to a registered page: ${pageId}`);
  }
  const targets = base.targets.map((target): DeveloperGlobalFramePreflightTarget => {
    const check = checkByPage.get(target.pageId);
    const targetIssues: string[] = [];
    if (target.status !== "ready") targetIssues.push(target.detail);
    if (target.status === "ready" && requireExplicitTargetEvidence && !check) targetIssues.push("missing explicit target verification evidence");
    if (check && !check.passed) targetIssues.push(...(check.issues.length ? check.issues : ["target verification failed"]));
    const compatible = target.status === "ready" && (!requireExplicitTargetEvidence || Boolean(check)) && (!check || check.passed);
    return {
      pageId: target.pageId,
      label: target.label,
      route: target.route,
      sourceScope: target.sourceScope,
      baseStatus: target.status,
      disposition: compatible ? "compatible" : "isolated",
      checkIds: check ? [...check.checkIds] : [],
      issues: targetIssues,
    };
  });
  const compatibleTargetPageIds = targets.filter((target) => target.disposition === "compatible").map((target) => target.pageId);
  const isolatedPageIds = targets.filter((target) => target.disposition === "isolated").map((target) => target.pageId);
  return {
    passed: base.passed && issues.length === 0 && compatibleTargetPageIds.length > 0,
    checkedAt,
    requireExplicitTargetEvidence,
    issues,
    targets,
    compatibleTargetPageIds,
    isolatedPageIds,
  };
}

function artifactPayload(state: Pick<DeveloperGlobalFrameCoordinatorState,
  "schemaVersion" | "draftId" | "templateId" | "sourceScope" | "baseVersion" | "baseDraftHash"
  | "resolvedProfileVersion" | "section" | "preflight" | "compatibleTargetPageIds" | "isolatedPageIds"
  | "recoveryPointId" | "preparedAt" | "acceptanceArtifactId" | "acceptanceArtifactHash"
  | "acceptanceIssuedAt" | "acceptanceExpiresAt"
>) {
  return {
    schemaVersion: state.schemaVersion,
    draftId: state.draftId,
    templateId: state.templateId,
    sourceScope: state.sourceScope,
    baseVersion: state.baseVersion,
    baseDraftHash: state.baseDraftHash,
    resolvedProfileVersion: state.resolvedProfileVersion,
    section: state.section,
    preflight: state.preflight,
    compatibleTargetPageIds: state.compatibleTargetPageIds,
    isolatedPageIds: state.isolatedPageIds,
    recoveryPointId: state.recoveryPointId,
    preparedAt: state.preparedAt,
    acceptanceArtifactId: state.acceptanceArtifactId,
    acceptanceArtifactHash: state.acceptanceArtifactHash,
    acceptanceIssuedAt: state.acceptanceIssuedAt,
    acceptanceExpiresAt: state.acceptanceExpiresAt,
    businessBoundary: {
      scope: "appearance-only",
      section: DEVELOPER_GLOBAL_FRAME_SECTION_NAME,
      protectedOwnership: DEVELOPER_GLOBAL_FRAME_PROTECTED_OWNERSHIP,
    },
  };
}

type PrepareDeveloperGlobalFrameInput = {
  draftId: string;
  requestedProfileVersion: string;
  pageChecks?: readonly DeveloperGlobalFramePageCheck[];
  requireExplicitTargetEvidence?: boolean;
  resolveAcceptanceEvidence?(context: {
    draftId: string;
    templateId: typeof DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID;
    sourceScope: DeveloperGlobalFrameSourceScope;
    baseDraftHash: string;
    section: DeveloperGlobalFrameSection;
  }): Promise<DeveloperGlobalFrameAcceptanceEvidence>;
  buildSection(context: {
    profileVersion: string;
    latestVersion: string | null;
    baseDraftHash: string;
  }): DeveloperGlobalFrameSection;
};

function errorState(
  state: DeveloperGlobalFrameCoordinatorState,
  stage: "conflict" | "failed",
  code: string,
  error: unknown,
  clock: () => Date,
) {
  const at = nowIso(clock);
  return {
    ...state,
    stage,
    updatedAt: at,
    error: { code, message: error instanceof Error ? error.message : String(error), at },
  } satisfies DeveloperGlobalFrameCoordinatorState;
}

function isConflict(error: unknown) {
  return isRecord(error) && (error.status === 409 || error.code === "atomic-conflict");
}

function assertRolloutEvidenceMatchesState(
  state: DeveloperGlobalFrameCoordinatorState,
  evidence: DeveloperGlobalFrameRolloutEvidence,
) {
  if (!SAFE_ID.test(evidence.batchId)
    || evidence.templateId !== state.templateId
    || evidence.templateVersion !== state.publishedVersion
    || evidence.ownerScope !== DEVELOPER_GLOBAL_FRAME_RUNTIME_SCOPE_BY_SOURCE_SCOPE[state.sourceScope]
    || !sameJson(evidence.sections, [DEVELOPER_GLOBAL_FRAME_SECTION_NAME])
    || !Number.isInteger(evidence.totalTargets)
    || !Number.isInteger(evidence.succeededTargets)
    || !Number.isInteger(evidence.failedTargets)
    || evidence.totalTargets <= 0
    || evidence.succeededTargets < 0
    || evidence.failedTargets < 0
    || evidence.succeededTargets + evidence.failedTargets > evidence.totalTargets) {
    throw new Error("rollout evidence is not bound to the reviewed frame version, section and non-empty target batch");
  }
}

function requirePersistedState(
  stateRepository: DeveloperGlobalFrameCoordinatorStateRepository,
  sourceScope: DeveloperGlobalFrameSourceScope,
  draftId: string,
) {
  const state = stateRepository.read(sourceScope);
  if (!state || state.draftId !== draftId) throw new Error("prepared developer global frame draft was not found");
  return state;
}

export function createDeveloperGlobalFrameReleaseCoordinator(input: {
  releaseRepository: DeveloperGlobalFrameReleaseRepository;
  stateRepository: DeveloperGlobalFrameCoordinatorStateRepository;
  sourceScope?: DeveloperGlobalFrameSourceScope;
  clock?: () => Date;
}) {
  const releaseRepository = input.releaseRepository;
  const stateRepository = input.stateRepository;
  const sourceScope = input.sourceScope ?? "client_source";
  const clock = input.clock ?? (() => new Date());
  const persist = (state: DeveloperGlobalFrameCoordinatorState) => {
    if (!stateRepository.write(state)) throw new Error("developer global frame coordinator state could not be persisted");
    return cloneJson(state);
  };

  return {
    getState() {
      return stateRepository.read(sourceScope);
    },

    reset() {
      stateRepository.remove(sourceScope);
    },

    async prepare(prepareInput: PrepareDeveloperGlobalFrameInput) {
      if (!SAFE_ID.test(prepareInput.draftId)) throw new Error("draftId is invalid");
      const requestedProfileVersion = prepareInput.requestedProfileVersion.trim();
      if (!requestedProfileVersion) throw new Error("requestedProfileVersion is required");
      const head = await releaseRepository.readHead();
      if (head.templateId !== DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID || head.ownerScope !== sourceScope || !SHA256.test(head.draftConfigHash)) {
        throw new Error("repository head is not bound to the expected template, source scope and SHA-256 draft hash");
      }
      const resolvedProfileVersion = bumpDeveloperGlobalFrameProfileVersionIfCurrent(requestedProfileVersion, head.latestVersion);
      // This is intentionally the only section build in the prepare/commit path.
      const section = cloneJson(prepareInput.buildSection({
        profileVersion: resolvedProfileVersion,
        latestVersion: head.latestVersion,
        baseDraftHash: head.draftConfigHash,
      }));
      const sectionValidation = validateDeveloperGlobalFrameSection(section);
      if (!sectionValidation.valid) throw new Error(`developer global frame section is invalid: ${sectionValidation.issues.join("; ")}`);
      if (section.source_scope !== sourceScope || section.profile_version !== resolvedProfileVersion || !hasProtectedBusinessBoundary(section)) {
        throw new Error("developer global frame section crossed its appearance-only business boundary");
      }
      const preparedAt = nowIso(clock);
      const acceptance = prepareInput.resolveAcceptanceEvidence
        ? await prepareInput.resolveAcceptanceEvidence({
          draftId: prepareInput.draftId,
          templateId: DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
          sourceScope,
          baseDraftHash: head.draftConfigHash,
          section: cloneJson(section),
        })
        : null;
      if (releaseRepository.capabilities.trustedAcceptance && !acceptance) {
        throw new Error("server publication requires a trusted 201-page x 3-viewport acceptance attestation");
      }
      if (acceptance) {
        const preparedAtMs = Date.parse(preparedAt);
        const issuedAtMs = Date.parse(acceptance.issuedAt);
        const expiresAtMs = Date.parse(acceptance.expiresAt);
        if (!SAFE_ID.test(acceptance.acceptanceArtifactId)
          || !SHA256.test(acceptance.acceptanceArtifactHash)
          || !Number.isFinite(issuedAtMs)
          || !Number.isFinite(expiresAtMs)
          || issuedAtMs > preparedAtMs + MAX_PREFLIGHT_EVIDENCE_FUTURE_SKEW_MS
          || preparedAtMs - issuedAtMs > MAX_PREFLIGHT_EVIDENCE_AGE_MS
          || expiresAtMs < preparedAtMs) {
          throw new Error("trusted acceptance attestation is invalid, stale, future-dated or expired");
        }
      }
      const requireExplicitTargetEvidence = prepareInput.requireExplicitTargetEvidence
        ?? releaseRepository.capabilities.crossDevicePublication;
      const preflight = buildCoordinatorPreflight(
        section,
        acceptance?.pageChecks ?? prepareInput.pageChecks ?? [],
        requireExplicitTargetEvidence,
        preparedAt,
      );
      if (acceptance
        && (!sameJson(preflight.compatibleTargetPageIds, acceptance.compatibleTargetPageIds)
          || !sameJson(preflight.isolatedPageIds, acceptance.isolatedPageIds))) {
        throw new Error("trusted acceptance attestation target disposition does not match the exact frame section");
      }
      const stateWithoutHash = {
        schemaVersion: DEVELOPER_GLOBAL_FRAME_COORDINATOR_SCHEMA_VERSION,
        draftId: prepareInput.draftId,
        stage: preflight.passed ? "prepared" : "preflight-blocked",
        repositoryKind: releaseRepository.kind,
        templateId: DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
        sourceScope,
        requestedProfileVersion,
        resolvedProfileVersion,
        baseVersion: head.latestVersion,
        baseDraftHash: head.draftConfigHash,
        artifactHash: "",
        savedDraftHash: null,
        durablePreflightEvidenceHash: null,
        acceptanceArtifactId: acceptance?.acceptanceArtifactId ?? null,
        acceptanceArtifactHash: acceptance?.acceptanceArtifactHash ?? null,
        acceptanceIssuedAt: acceptance?.issuedAt ?? null,
        acceptanceExpiresAt: acceptance?.expiresAt ?? null,
        section,
        preflight,
        compatibleTargetPageIds: [...preflight.compatibleTargetPageIds],
        isolatedPageIds: [...preflight.isolatedPageIds],
        recoveryPointId: section.recovery.recovery_point_id,
        preparedAt,
        draftSavedAt: null,
        releaseRequestedAt: null,
        submittedVersion: null,
        publishedVersion: null,
        rolloutBatchId: null,
        rolloutCompletedAt: null,
        updatedAt: preparedAt,
        error: null,
      } satisfies Omit<DeveloperGlobalFrameCoordinatorState, "artifactHash"> & { artifactHash: string };
      const artifactHash = await sha256Hex(artifactPayload(stateWithoutHash as DeveloperGlobalFrameCoordinatorState));
      return persist({ ...stateWithoutHash, artifactHash } as DeveloperGlobalFrameCoordinatorState);
    },

    async commitDraft(draftId: string) {
      let state = requirePersistedState(stateRepository, sourceScope, draftId);
      if (state.repositoryKind !== releaseRepository.kind) throw new Error("prepared draft belongs to a different release repository");
      if (state.stage !== "prepared" || !state.preflight.passed) throw new Error("draft has not passed preflight");
      const calculatedHash = await sha256Hex(artifactPayload(state));
      if (calculatedHash !== state.artifactHash) {
        state = errorState(state, "failed", "artifact-hash-mismatch", new Error("prepared artifact changed after preflight"), clock);
        return persist(state);
      }
      try {
        const result = await releaseRepository.saveDraftAtomic({
          templateId: state.templateId,
          baseDraftHash: state.baseDraftHash,
          artifactHash: state.artifactHash,
          section: cloneJson(state.section),
          compatibleTargetPageIds: [...state.compatibleTargetPageIds],
          isolatedPageIds: [...state.isolatedPageIds],
          checkedAt: state.preflight.checkedAt,
          visualDraftId: state.draftId,
          acceptanceArtifactId: state.acceptanceArtifactId,
          acceptanceArtifactHash: state.acceptanceArtifactHash,
        });
        if (!SHA256.test(result.savedDraftHash)
          || result.acceptedArtifactHash !== state.artifactHash
          || !sameJson(result.section, state.section)) {
          throw new Error("repository did not atomically accept the exact prepared artifact");
        }
        const durableEvidence = result.durablePreflightEvidence;
        if (releaseRepository.capabilities.durablePreflightEvidence
          && (!durableEvidence
            || durableEvidence.templateId !== state.templateId
            || durableEvidence.sourceScope !== state.sourceScope
            || durableEvidence.baseDraftHash !== state.baseDraftHash
            || durableEvidence.artifactHash !== state.artifactHash
            || durableEvidence.savedDraftHash !== result.savedDraftHash
            || !sameJson(durableEvidence.compatibleTargetPageIds, state.compatibleTargetPageIds)
            || !sameJson(durableEvidence.isolatedPageIds, state.isolatedPageIds)
            || durableEvidence.recoveryPointId !== state.recoveryPointId
            || durableEvidence.checkedAt !== state.preflight.checkedAt
            || durableEvidence.visualDraftId !== state.draftId
            || durableEvidence.acceptanceArtifactId !== state.acceptanceArtifactId
            || durableEvidence.acceptanceArtifactHash !== state.acceptanceArtifactHash
            || !SHA256.test(durableEvidence.evidenceHash))) {
          throw new Error("repository did not durably bind preflight isolation to the saved artifact");
        }
        const savedAt = nowIso(clock);
        state = {
          ...state,
          stage: "draft-saved",
          savedDraftHash: result.savedDraftHash,
          durablePreflightEvidenceHash: durableEvidence?.evidenceHash ?? null,
          draftSavedAt: savedAt,
          updatedAt: savedAt,
          error: null,
        };
        return persist(state);
      } catch (error) {
        state = errorState(state, isConflict(error) ? "conflict" : "failed", isConflict(error) ? "atomic-conflict" : "draft-save-failed", error, clock);
        return persist(state);
      }
    },

    async requestPublication(draftId: string, metadata: {
      changelog?: string | null;
      publishedBy?: string | null;
      reviewAssignee?: string | null;
      reviewDueAt?: string | null;
    } = {}) {
      let state = requirePersistedState(stateRepository, sourceScope, draftId);
      if (!releaseRepository.capabilities.crossDevicePublication || !releaseRepository.requestPublication) {
        throw new Error("this repository is a local development preview and cannot publish across devices");
      }
      if (!releaseRepository.capabilities.durablePreflightEvidence
        || !state.durablePreflightEvidenceHash) {
        throw new Error("server publication requires durable compatible/isolated preflight evidence bound to the artifact hash");
      }
      if (state.repositoryKind !== releaseRepository.kind || state.stage !== "draft-saved" || !state.savedDraftHash) {
        throw new Error("an atomically saved server draft is required before publication");
      }
      try {
        const evidence = await releaseRepository.requestPublication({
          templateId: state.templateId,
          version: state.resolvedProfileVersion,
          expectedDraftConfigHash: state.savedDraftHash,
          expectedPreflightArtifactHash: state.artifactHash,
          changelog: metadata.changelog ?? null,
          publishedBy: metadata.publishedBy ?? null,
          reviewAssignee: metadata.reviewAssignee ?? null,
          reviewDueAt: metadata.reviewDueAt ?? null,
        });
        if (evidence.version !== state.resolvedProfileVersion
          || !sameJson(evidence.releaseSections, [DEVELOPER_GLOBAL_FRAME_SECTION_NAME])) {
          throw new Error("publication response is not bound to the prepared frame version and section");
        }
        const requestedAt = nowIso(clock);
        const published = evidence.reviewStatus === "published";
        state = {
          ...state,
          stage: published ? "published" : "review-pending",
          releaseRequestedAt: requestedAt,
          submittedVersion: evidence.version,
          publishedVersion: published ? evidence.version : null,
          updatedAt: requestedAt,
          error: null,
        };
        return persist(state);
      } catch (error) {
        state = errorState(state, isConflict(error) ? "conflict" : "failed", isConflict(error) ? "atomic-conflict" : "publication-request-failed", error, clock);
        return persist(state);
      }
    },

    async refreshPublication(draftId: string) {
      let state = requirePersistedState(stateRepository, sourceScope, draftId);
      if (!releaseRepository.readPublication || !state.submittedVersion
        || !["review-pending", "published"].includes(state.stage)) {
        throw new Error("there is no reviewable server publication");
      }
      try {
        const evidence = await releaseRepository.readPublication(state.submittedVersion);
        if (!evidence) return cloneJson(state);
        if (evidence.version !== state.resolvedProfileVersion
          || !sameJson(evidence.releaseSections, [DEVELOPER_GLOBAL_FRAME_SECTION_NAME])) {
          throw new Error("publication evidence changed version or release section");
        }
        const refreshedAt = nowIso(clock);
        if (evidence.reviewStatus === "published") {
          state = { ...state, stage: "published", publishedVersion: evidence.version, updatedAt: refreshedAt, error: null };
        } else if (evidence.reviewStatus === "rejected" || evidence.reviewStatus === "archived") {
          state = errorState(state, "failed", `publication-${evidence.reviewStatus}`, new Error(`publication ${evidence.reviewStatus}`), clock);
        } else {
          state = { ...state, stage: "review-pending", updatedAt: refreshedAt, error: null };
        }
        return persist(state);
      } catch (error) {
        state = errorState(state, "failed", "publication-refresh-failed", error, clock);
        return persist(state);
      }
    },

    async startRollout(draftId: string, instanceIds: string[] | null = null) {
      let state = requirePersistedState(stateRepository, sourceScope, draftId);
      if (!releaseRepository.capabilities.rollout || !releaseRepository.startRollout) {
        throw new Error("this repository cannot create a server rollout batch");
      }
      if (state.stage !== "published" || !state.publishedVersion) {
        throw new Error("a reviewed, published frame version is required before rollout");
      }
      try {
        const evidence = await releaseRepository.startRollout(instanceIds);
        assertRolloutEvidenceMatchesState(state, evidence);
        const completed = ["completed", "succeeded"].includes(evidence.status)
          && evidence.failedTargets === 0
          && evidence.succeededTargets === evidence.totalTargets;
        const startedAt = nowIso(clock);
        state = {
          ...state,
          stage: completed ? "rollout-complete" : "rollout-pending",
          rolloutBatchId: evidence.batchId,
          rolloutCompletedAt: completed ? startedAt : null,
          updatedAt: startedAt,
          error: null,
        };
        return persist(state);
      } catch (error) {
        state = errorState(state, "failed", "rollout-start-failed", error, clock);
        return persist(state);
      }
    },

    async refreshRollout(draftId: string) {
      let state = requirePersistedState(stateRepository, sourceScope, draftId);
      if (!releaseRepository.readRollout || !state.rolloutBatchId
        || !["rollout-pending", "rollout-complete"].includes(state.stage)) {
        throw new Error("there is no server rollout batch to refresh");
      }
      try {
        const evidence = await releaseRepository.readRollout(state.rolloutBatchId);
        if (evidence.batchId !== state.rolloutBatchId) {
          throw new Error("rollout evidence changed batch identity");
        }
        assertRolloutEvidenceMatchesState(state, evidence);
        const refreshedAt = nowIso(clock);
        const completed = ["completed", "succeeded"].includes(evidence.status)
          && evidence.failedTargets === 0
          && evidence.succeededTargets === evidence.totalTargets;
        if (completed) {
          state = {
            ...state,
            stage: "rollout-complete",
            rolloutCompletedAt: refreshedAt,
            updatedAt: refreshedAt,
            error: null,
          };
        } else if (["failed", "cancelled"].includes(evidence.status) || evidence.failedTargets > 0) {
          state = errorState(state, "failed", "rollout-failed", new Error(`rollout ${evidence.status}`), clock);
        } else {
          state = { ...state, stage: "rollout-pending", updatedAt: refreshedAt, error: null };
        }
        return persist(state);
      } catch (error) {
        state = errorState(state, "failed", "rollout-refresh-failed", error, clock);
        return persist(state);
      }
    },
  };
}

type LocalRepositoryHead = { latestVersion: string | null; draftConfigHash: string };

function parseLocalRepositoryHead(raw: string | null): LocalRepositoryHead {
  if (!raw) return { latestVersion: null, draftConfigHash: EMPTY_LOCAL_DRAFT_HASH };
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value)
      || (value.latestVersion !== null && typeof value.latestVersion !== "string")
      || typeof value.draftConfigHash !== "string"
      || !SHA256.test(value.draftConfigHash)) return { latestVersion: null, draftConfigHash: EMPTY_LOCAL_DRAFT_HASH };
    return value as LocalRepositoryHead;
  } catch {
    return { latestVersion: null, draftConfigHash: EMPTY_LOCAL_DRAFT_HASH };
  }
}

/**
 * Local-only repository used for fast development preview. Its capability
 * flags deliberately prevent callers from treating localStorage as a
 * cross-device release or factory-default fact.
 */
export function createDeveloperGlobalFrameLocalDevRepository(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  sourceScope: DeveloperGlobalFrameSourceScope = "client_source",
): DeveloperGlobalFrameReleaseRepository {
  return {
    kind: "local-dev-preview",
    capabilities: {
      crossDevicePublication: false,
      durablePreflightEvidence: false,
      trustedAcceptance: false,
      rollout: false,
      factoryDefault: false,
    },
    async readHead() {
      const head = parseLocalRepositoryHead(storage.getItem(LOCAL_REPOSITORY_HEAD_KEY));
      return { templateId: DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID, ownerScope: sourceScope, ...head };
    },
    async saveDraftAtomic(request) {
      const head = parseLocalRepositoryHead(storage.getItem(LOCAL_REPOSITORY_HEAD_KEY));
      if (head.draftConfigHash !== request.baseDraftHash) {
        const conflict = new Error("local preview draft hash changed after prepare") as Error & { code?: string };
        conflict.code = "atomic-conflict";
        throw conflict;
      }
      const result = writeDeveloperGlobalLocalBatchRelease(storage, request.section, {
        compatibleTargetPageIds: request.compatibleTargetPageIds,
      });
      if (!result
        || !sameJson(result.release.compatibleTargetPageIds, request.compatibleTargetPageIds)
        || result.release.section.scope !== "appearance-only") {
        throw new Error("local preview batch rejected the compatible target subset or business boundary");
      }
      const nextHead: LocalRepositoryHead = {
        latestVersion: request.section.profile_version,
        draftConfigHash: request.artifactHash,
      };
      storage.setItem(LOCAL_REPOSITORY_HEAD_KEY, JSON.stringify(nextHead));
      return {
        savedDraftHash: nextHead.draftConfigHash,
        acceptedArtifactHash: request.artifactHash,
        section: cloneJson(request.section),
        preservedSiblingKeys: [],
        durablePreflightEvidence: null,
      };
    },
  };
}

export type DeveloperGlobalFrameServerRepositoryDependencies = {
  fetchTemplate: typeof fetchTemplate;
  mergeDeveloperGlobalFrameDraft?: typeof mergeDeveloperGlobalFrameDraft;
  mergeDeveloperGlobalFrameDraftWithPreflightEvidence?: typeof mergeDeveloperGlobalFrameDraftWithPreflightEvidence;
  publishTemplate: typeof publishTemplate;
  listTemplateVersions: typeof listTemplateVersions;
  createDeveloperGlobalFrameReleaseBatch: typeof createDeveloperGlobalFrameReleaseBatch;
  fetchTemplateReleaseBatch: typeof fetchTemplateReleaseBatch;
  recordDeveloperGlobalFrameFactoryDefaultReceipt?: typeof recordDeveloperGlobalFrameFactoryDefaultReceiptOnServer;
  fetchLatestDeveloperGlobalFrameFactoryDefaultReceipt?: typeof fetchLatestDeveloperGlobalFrameFactoryDefaultReceiptFromServer;
  /**
   * Optional server endpoint boundary. Production publication remains blocked
   * until this records the exact page-isolation manifest against both hashes.
   */
  persistPreflightEvidence?: (input: {
    templateId: typeof DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID;
    sourceScope: DeveloperGlobalFrameSourceScope;
    baseDraftHash: string;
    artifactHash: string;
    savedDraftHash: string;
    compatibleTargetPageIds: readonly string[];
    isolatedPageIds: readonly string[];
    recoveryPointId: string;
    checkedAt: string;
    visualDraftId: string;
    acceptanceArtifactId: string;
    acceptanceArtifactHash: string;
  }) => Promise<{
    templateId: typeof DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID;
    sourceScope: DeveloperGlobalFrameSourceScope;
    baseDraftHash: string;
    artifactHash: string;
    savedDraftHash: string;
    compatibleTargetPageIds: string[];
    isolatedPageIds: string[];
    recoveryPointId: string;
    checkedAt: string;
    evidenceHash: string;
    visualDraftId: string;
    acceptanceArtifactId: string;
    acceptanceArtifactHash: string;
  }>;
};

/** Server boundary: callers may replace these dependencies without changing the coordinator. */
export function createDeveloperGlobalFrameServerRepository(
  dependencies: DeveloperGlobalFrameServerRepositoryDependencies = {
    fetchTemplate,
    mergeDeveloperGlobalFrameDraftWithPreflightEvidence,
    publishTemplate,
    listTemplateVersions,
    createDeveloperGlobalFrameReleaseBatch,
    fetchTemplateReleaseBatch,
    recordDeveloperGlobalFrameFactoryDefaultReceipt: recordDeveloperGlobalFrameFactoryDefaultReceiptOnServer,
    fetchLatestDeveloperGlobalFrameFactoryDefaultReceipt: fetchLatestDeveloperGlobalFrameFactoryDefaultReceiptFromServer,
  },
): DeveloperGlobalFrameReleaseRepository {
  const durablePreflightEvidence = typeof dependencies.mergeDeveloperGlobalFrameDraftWithPreflightEvidence === "function"
    || typeof dependencies.persistPreflightEvidence === "function";
  const recordFactoryDefaultReceipt = dependencies.recordDeveloperGlobalFrameFactoryDefaultReceipt;
  const fetchLatestFactoryDefaultReceipt = dependencies.fetchLatestDeveloperGlobalFrameFactoryDefaultReceipt;
  const factoryDefault = typeof recordFactoryDefaultReceipt === "function"
    && typeof fetchLatestFactoryDefaultReceipt === "function";
  return {
    kind: "server",
    capabilities: {
      crossDevicePublication: true,
      durablePreflightEvidence,
      trustedAcceptance: true,
      rollout: true,
      factoryDefault,
    },
    async readHead() {
      const template = await dependencies.fetchTemplate(DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID);
      if (template.template_id !== DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID
        || template.owner_scope !== "client_source"
        || typeof template.draft_config_hash !== "string"
        || !SHA256.test(template.draft_config_hash)) {
        throw new Error("server template does not expose an atomically addressable client-source draft");
      }
      return {
        templateId: DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
        ownerScope: "client_source",
        latestVersion: typeof template.latest_version === "string" ? template.latest_version : null,
        draftConfigHash: template.draft_config_hash,
      };
    },
    async saveDraftAtomic(request) {
      if (dependencies.mergeDeveloperGlobalFrameDraftWithPreflightEvidence) {
        const result = await dependencies.mergeDeveloperGlobalFrameDraftWithPreflightEvidence(
          request.templateId,
          request.baseDraftHash,
          request.section,
          {
            artifactHash: request.artifactHash,
            compatibleTargetPageIds: request.compatibleTargetPageIds,
            isolatedPageIds: request.isolatedPageIds,
            recoveryPointId: request.section.recovery.recovery_point_id,
            checkedAt: request.checkedAt,
            visualDraftId: request.visualDraftId,
            acceptanceArtifactId: request.acceptanceArtifactId ?? "",
            acceptanceArtifactHash: request.acceptanceArtifactHash ?? "",
          },
        );
        if (!SHA256.test(result.savedDraftHash)
          || result.acceptedArtifactHash !== request.artifactHash
          || !sameJson(result.section, request.section)
          || !sameJson(result.durablePreflightEvidence.compatibleTargetPageIds, request.compatibleTargetPageIds)
          || !sameJson(result.durablePreflightEvidence.isolatedPageIds, request.isolatedPageIds)) {
          throw new Error("server atomic merge did not durably bind the exact prepared artifact and target manifest");
        }
        return result;
      }
      if (!dependencies.mergeDeveloperGlobalFrameDraft) {
        throw new Error("server repository has no developer global frame draft merge boundary");
      }
      const result = await dependencies.mergeDeveloperGlobalFrameDraft(
        request.templateId,
        request.baseDraftHash,
        request.section,
      );
      if (result.template_id !== request.templateId
        || result.owner_scope !== request.section.source_scope
        || result.write_scope !== "draft-only"
        || result.publish_performed !== false
        || result.batch_created !== false
        || !SHA256.test(result.draft_config_hash)
        || !sameJson(result.developer_global_frame, request.section)) {
        throw new Error("server atomic merge response crossed the section-only draft boundary");
      }
      const persistedEvidence = dependencies.persistPreflightEvidence
        ? await dependencies.persistPreflightEvidence({
          templateId: request.templateId,
          sourceScope: request.section.source_scope,
          baseDraftHash: request.baseDraftHash,
          artifactHash: request.artifactHash,
          savedDraftHash: result.draft_config_hash,
          compatibleTargetPageIds: request.compatibleTargetPageIds,
          isolatedPageIds: request.isolatedPageIds,
          recoveryPointId: request.section.recovery.recovery_point_id,
          checkedAt: request.checkedAt,
          visualDraftId: request.visualDraftId,
          acceptanceArtifactId: request.acceptanceArtifactId ?? "",
          acceptanceArtifactHash: request.acceptanceArtifactHash ?? "",
        })
        : null;
      return {
        savedDraftHash: result.draft_config_hash,
        acceptedArtifactHash: request.artifactHash,
        section: cloneJson(result.developer_global_frame),
        preservedSiblingKeys: [...result.preserved_sibling_keys],
        durablePreflightEvidence: persistedEvidence,
      };
    },
    async requestPublication(request) {
      const version = await dependencies.publishTemplate(request.templateId, {
        version: request.version,
        changelog: request.changelog,
        publishedBy: request.publishedBy,
        requiresApproval: true,
        requiredReviewSteps: 2,
        requiredSections: [DEVELOPER_GLOBAL_FRAME_SECTION_NAME],
        expectedDraftConfigHash: request.expectedDraftConfigHash,
        expectedPreflightArtifactHash: request.expectedPreflightArtifactHash,
        reviewAssignee: request.reviewAssignee,
        reviewDueAt: request.reviewDueAt,
      });
      return publicationEvidence(version);
    },
    async readPublication(version) {
      const versions = await dependencies.listTemplateVersions(DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID);
      const match = versions.find((candidate) => candidate.version === version);
      return match ? publicationEvidence(match) : null;
    },
    async startRollout(instanceIds) {
      const response = await dependencies.createDeveloperGlobalFrameReleaseBatch(
        DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
        instanceIds,
      );
      return rolloutEvidence(response.batch);
    },
    async readRollout(batchId) {
      return rolloutEvidence(await dependencies.fetchTemplateReleaseBatch(batchId));
    },
    async recordFactoryDefaultReceipt(receipt) {
      if (!recordFactoryDefaultReceipt || !fetchLatestFactoryDefaultReceipt) {
        throw new Error("server repository has no durable factory-default boundary");
      }
      if (!(await validateDeveloperGlobalFrameFactoryDefaultReceipt(receipt))) {
        throw new Error("factory-default receipt failed client integrity validation");
      }
      const recorded = projectServerFactoryDefaultReceipt(await recordFactoryDefaultReceipt(receipt));
      if (!(await validateDeveloperGlobalFrameFactoryDefaultReceipt(recorded)) || !sameJson(recorded, receipt)) {
        throw new Error("server did not attest the exact factory-default receipt");
      }
      return recorded;
    },
    async readLatestFactoryDefaultReceipt() {
      if (!fetchLatestFactoryDefaultReceipt) {
        throw new Error("server repository has no cross-browser factory-default read boundary");
      }
      const receipt = projectServerFactoryDefaultReceipt(
        await fetchLatestFactoryDefaultReceipt(DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID),
      );
      if (!(await validateDeveloperGlobalFrameFactoryDefaultReceipt(receipt))) {
        throw new Error("latest server factory-default receipt failed integrity validation");
      }
      return receipt;
    },
  };
}

function publicationEvidence(version: TemplateVersionResponse): DeveloperGlobalFramePublicationEvidence {
  return {
    version: version.version,
    reviewStatus: version.reviewStatus ?? "unknown",
    releaseSections: version.releaseSections?.length === 1
      && version.releaseSections[0] === DEVELOPER_GLOBAL_FRAME_SECTION_NAME
      ? [DEVELOPER_GLOBAL_FRAME_SECTION_NAME]
      : null,
  };
}

function rolloutEvidence(batch: TemplateReleaseBatchResponse): DeveloperGlobalFrameRolloutEvidence {
  return {
    batchId: batch.id,
    templateId: batch.template_id as typeof DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
    templateVersion: batch.template_version,
    ownerScope: batch.owner_scope as DeveloperGlobalFrameRuntimeOwnerScope,
    sections: batch.sections?.length === 1
      && batch.sections[0] === DEVELOPER_GLOBAL_FRAME_SECTION_NAME
      ? [DEVELOPER_GLOBAL_FRAME_SECTION_NAME]
      : null,
    status: batch.status,
    totalTargets: batch.total_targets,
    succeededTargets: batch.succeeded_targets,
    failedTargets: batch.failed_targets,
  };
}

function receiptPayload(receipt: Omit<DeveloperGlobalFrameFactoryDefaultReceipt, "receiptHash">) {
  return receipt;
}

/** Factory-default evidence is intentionally impossible before reviewed rollout completion. */
export async function buildDeveloperGlobalFrameFactoryDefaultReceipt(
  state: DeveloperGlobalFrameCoordinatorState,
  recordedAt = new Date().toISOString(),
): Promise<DeveloperGlobalFrameFactoryDefaultReceipt> {
  const recordedAtMs = Date.parse(recordedAt);
  if (!validateCoordinatorState(state)
    || state.repositoryKind === "local-dev-preview"
    || state.stage !== "rollout-complete"
    || !state.publishedVersion
    || !state.savedDraftHash
    || !state.durablePreflightEvidenceHash
    || !state.rolloutBatchId
    || !Number.isFinite(recordedAtMs)) {
    throw new Error("factory-default receipt requires a reviewed server publication and completed rollout");
  }
  const canonicalRecordedAt = new Date(recordedAtMs).toISOString();
  const payload: Omit<DeveloperGlobalFrameFactoryDefaultReceipt, "receiptHash"> = {
    schemaVersion: 1,
    templateId: state.templateId,
    publishedVersion: state.publishedVersion,
    artifactHash: state.artifactHash,
    draftHash: state.savedDraftHash,
    preflightEvidenceHash: state.durablePreflightEvidenceHash,
    compatibleTargetPageIds: [...state.compatibleTargetPageIds],
    isolatedPageIds: [...state.isolatedPageIds],
    recoveryPointId: state.recoveryPointId,
    rolloutBatchId: state.rolloutBatchId,
    recordedAt: canonicalRecordedAt,
  };
  return { ...payload, receiptHash: await sha256Hex(receiptPayload(payload)) };
}

export async function validateDeveloperGlobalFrameFactoryDefaultReceipt(value: unknown) {
  if (!isRecord(value)
    || value.schemaVersion !== 1
    || value.templateId !== DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID
    || typeof value.publishedVersion !== "string"
    || !value.publishedVersion
    || typeof value.artifactHash !== "string"
    || !SHA256.test(value.artifactHash)
    || typeof value.draftHash !== "string"
    || !SHA256.test(value.draftHash)
    || typeof value.preflightEvidenceHash !== "string"
    || !SHA256.test(value.preflightEvidenceHash)
    || !uniqueStrings(value.compatibleTargetPageIds)
    || !uniqueStrings(value.isolatedPageIds)
    || value.compatibleTargetPageIds.length === 0
    || typeof value.recoveryPointId !== "string"
    || !value.recoveryPointId
    || typeof value.rolloutBatchId !== "string"
    || !value.rolloutBatchId
    || typeof value.recordedAt !== "string"
    || !Number.isFinite(Date.parse(value.recordedAt))
    || new Date(Date.parse(value.recordedAt)).toISOString() !== value.recordedAt
    || typeof value.receiptHash !== "string"
    || !SHA256.test(value.receiptHash)) return false;
  const compatibleTargetPageIds = value.compatibleTargetPageIds as string[];
  const isolatedPageIds = value.isolatedPageIds as string[];
  if (compatibleTargetPageIds.some((pageId) => isolatedPageIds.includes(pageId))) return false;
  const { receiptHash, ...payload } = value;
  return await sha256Hex(receiptPayload(payload as Omit<DeveloperGlobalFrameFactoryDefaultReceipt, "receiptHash">)) === receiptHash;
}

export async function recordDeveloperGlobalFrameFactoryDefaultReceipt(
  storage: Pick<Storage, "setItem">,
  state: DeveloperGlobalFrameCoordinatorState,
  recordedAt = new Date().toISOString(),
) {
  const receipt = await buildDeveloperGlobalFrameFactoryDefaultReceipt(state, recordedAt);
  storage.setItem(DEVELOPER_GLOBAL_FRAME_FACTORY_DEFAULT_RECEIPT_KEY, JSON.stringify(receipt));
  return receipt;
}
