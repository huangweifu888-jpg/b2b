import developerOptimizationContract from "../../../shared/contracts/developer-optimization-contract.json" with { type: "json" };
import developerRecordLedgerContract from "../../../shared/contracts/developer-record-ledger-contract.json" with { type: "json" };

import {
  buildDeveloperWorkflowScopeIdentity,
  DEVELOPER_WORKFLOW_STAGES,
  normalizeDeveloperWorkflowRun,
  type DeveloperWorkflowArtifactEnvelope,
  type DeveloperWorkflowRun,
} from "./developer-workflow-run.ts";
import { DEVELOPER_NAVIGATION_ORDER_MIGRATION_CONTRACT_VERSION } from "./developer-optimization-contract.ts";

export const DEVELOPER_RECORD_LEDGER_SCHEMA_VERSION = 1 as const;

export type DeveloperRecordAppId =
  | "visual-frame"
  | "shared-contract"
  | "figma-ui"
  | "visual-evidence"
  | "performance-experience"
  | "quality-release"
  | "page-lock"
  | "page-factory";

export type DeveloperRecordAuthority = "source" | "server" | "local" | "session";
export type DeveloperRecordScope = "global" | "page" | "system";
export type DeveloperRecordStatus = "pending" | "passed" | "failed" | "blocked" | "stale" | "info";

type RecordProjection = {
  order: string;
  appId: Exclude<DeveloperRecordAppId, "page-factory">;
  artifactKind: string;
  latestLimit: number;
};

type OptimizationApp = {
  id: DeveloperRecordAppId;
  order: string;
  label: string;
};

type NavigationOrderAlias = {
  appId: Extract<DeveloperRecordAppId, "page-factory" | "page-lock">;
  previousOrder: string;
  currentOrder: string;
};

type AuthorityDescriptor = {
  id: DeveloperRecordAuthority;
  label: string;
  auditLevel: "formal" | "authoritative-state" | "convenience-only" | "temporary-only";
};

type LedgerCompatibilityRules = {
  navigationOrderAlias: {
    effectiveContractVersionSource: string;
    missingContractVersionMode: "legacy-previous-order";
    beforeEffectiveVersion: "previous-order-alias";
    atOrAfterEffectiveVersion: "current-order";
  };
  workflowPerformanceRevision: {
    sourceKeyPattern: string;
    stageOrders: readonly string[];
    primaryAppId: Extract<DeveloperRecordAppId, "performance-experience">;
    artifactKind: "performance-evidence";
    pageIdentityObjectFields: readonly ["sourceScope", "normalizedRoute"];
    externalPendingMapsTo: "pending";
    statusPriority: readonly Exclude<DeveloperRecordStatus, "info">[];
  };
};

const RECORD_PROJECTIONS = developerRecordLedgerContract.projections as readonly RecordProjection[];
const OPTIMIZATION_APPS = developerOptimizationContract.apps as readonly OptimizationApp[];
const NAVIGATION_ORDER_ALIASES = developerOptimizationContract.navigationOrderMigration.aliases as readonly NavigationOrderAlias[];
const AGGREGATE_APP_ID = "page-factory" as const;
const LEDGER_COMPATIBILITY_RULES = developerRecordLedgerContract.compatibilityRules as LedgerCompatibilityRules;
const WORKFLOW_PERFORMANCE_COMPATIBILITY = LEDGER_COMPATIBILITY_RULES.workflowPerformanceRevision;
const WORKFLOW_PERFORMANCE_KEY_PATTERN = new RegExp(
  WORKFLOW_PERFORMANCE_COMPATIBILITY.sourceKeyPattern,
  "iu",
);
const WORKFLOW_STAGE_ORDERS = new Set(WORKFLOW_PERFORMANCE_COMPATIBILITY.stageOrders);

export const DEVELOPER_RECORD_APPS = Object.freeze(
  OPTIMIZATION_APPS.map((app) => {
    if (app.id === AGGREGATE_APP_ID) {
      return {
        id: developerRecordLedgerContract.aggregate.order,
        appId: app.id,
        label: app.label,
        artifactKind: developerRecordLedgerContract.aggregate.artifactKind,
        latestLimit: developerRecordLedgerContract.ui.projectionLatestLimit,
      };
    }
    const projection = RECORD_PROJECTIONS.find((candidate) => candidate.appId === app.id);
    return {
      id: projection?.order ?? app.order,
      appId: app.id,
      label: app.label,
      artifactKind: projection?.artifactKind ?? "unregistered-record",
      latestLimit: projection?.latestLimit ?? developerRecordLedgerContract.ui.projectionLatestLimit,
    };
  }).sort((left, right) => left.id.localeCompare(right.id)),
);

export const DEVELOPER_RECORD_AUTHORITIES = Object.freeze(
  (developerRecordLedgerContract.authorities as readonly AuthorityDescriptor[]).map((authority) => ({ ...authority })),
);

export const DEVELOPER_RECORD_LOCAL_STORAGE_PREFIX =
  developerRecordLedgerContract.localReceipts.storagePrefix;

export const DEVELOPER_RECORD_LOCAL_MAXIMUM_PER_SCOPE =
  developerRecordLedgerContract.localReceipts.maximumRecordsPerScope;

export const DEVELOPER_RECORD_LOCAL_DISCLAIMER =
  "本地记录只用于当前浏览器中的便捷回看，不是源码正式记录、服务端权威状态或不可篡改审计。" as const;

const APP_IDS = new Set<DeveloperRecordAppId>(DEVELOPER_RECORD_APPS.map((app) => app.appId));
const AUTHORITIES = new Set<DeveloperRecordAuthority>(
  DEVELOPER_RECORD_AUTHORITIES.map((authority) => authority.id),
);
const STATUSES = new Set<DeveloperRecordStatus>(["pending", "passed", "failed", "blocked", "stale", "info"]);
const SCOPES = new Set<DeveloperRecordScope>(["global", "page", "system"]);
const LEGACY_REVISION_PATTERN = new RegExp(
  developerRecordLedgerContract.legacyEvidence.revisionPattern,
  "u",
);
const LEGACY_AUDIT_KEYS = new Set<string>(developerRecordLedgerContract.legacyEvidence.auditKeys);
const LEGACY_REPAIR_KEYS = new Set<string>(developerRecordLedgerContract.legacyEvidence.repairKeys);

export type DeveloperRecordEntry = {
  schemaVersion: typeof DEVELOPER_RECORD_LEDGER_SCHEMA_VERSION;
  recordId: string;
  appId: DeveloperRecordAppId;
  relatedAppIds: readonly DeveloperRecordAppId[];
  artifactKind: string;
  scope: DeveloperRecordScope;
  scopeIdentity: string;
  sourceScope: string | null;
  pageIdentity: string | null;
  status: DeveloperRecordStatus;
  authority: DeveloperRecordAuthority;
  recordedAt: string;
  title: string;
  contractVersion: string | null;
  factoryVersion: string | null;
  hVersion: string | null;
  sourceFingerprint: string | null;
  targetManifestFingerprint: string | null;
  summary: string;
  validation: string | null;
  risks: string | null;
  artifactRefs: readonly string[];
  sourceKey: string | null;
};

export type DeveloperRecordFilter = {
  appIds?: readonly DeveloperRecordAppId[];
  scopeIdentity?: string;
  statuses?: readonly DeveloperRecordStatus[];
  authorities?: readonly DeveloperRecordAuthority[];
  pageIdentity?: string;
  hVersion?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
};

export type DeveloperRecordSortDirection = "asc" | "desc";
export type DeveloperRecordStorage = Pick<Storage, "getItem" | "setItem">;

export type LocalDeveloperRecordInput = Omit<
  DeveloperRecordEntry,
  "schemaVersion" | "authority" | "recordId"
> & {
  recordId?: string;
  authority?: DeveloperRecordAuthority;
};

export type AppendLocalDeveloperRecordOptions = {
  storage?: DeveloperRecordStorage | null;
  maximumRecordsPerScope?: number;
};

export type AppendLocalDeveloperRecordResult = {
  saved: boolean;
  record: DeveloperRecordEntry | null;
  records: readonly DeveloperRecordEntry[];
};

export type DeveloperLockReceiptInput = {
  recordId?: string;
  action: "lock" | "unlock" | "check";
  scope: "global" | "page";
  scopeIdentity: string;
  sourceScope?: string | null;
  pageIdentity?: string | null;
  targetIds: readonly string[];
  status?: Exclude<DeveloperRecordStatus, "pending" | "info">;
  recordedAt?: string;
  summary?: string;
  validation?: string | null;
  risks?: string | null;
  contractVersion?: string | null;
  factoryVersion?: string | null;
  hVersion?: string | null;
  sourceFingerprint?: string | null;
  targetManifestFingerprint?: string | null;
  artifactRefs?: readonly string[];
};

export type AdaptDeveloperWorkflowRecordsOptions = {
  authority?: DeveloperRecordAuthority;
};

export type AdaptPhaseTwoVerificationOptions = {
  authority?: DeveloperRecordAuthority;
  fallbackScopeIdentity?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function nullableString(value: unknown) {
  return cleanString(value) || null;
}

function normalizeTimestamp(value: unknown, fallback = "1970-01-01T00:00:00.000Z") {
  const candidate = cleanString(value);
  return candidate && Number.isFinite(Date.parse(candidate))
    ? new Date(candidate).toISOString()
    : fallback;
}

function normalizeNullableTimestamp(value: unknown) {
  const candidate = cleanString(value);
  return candidate && Number.isFinite(Date.parse(candidate)) ? new Date(candidate).toISOString() : null;
}

function uniqueStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanString(item)).filter(Boolean))];
}

function isCredentialBearingReference(reference: string) {
  return /:\/\/[^/@\s]+:[^/@\s]+@/u.test(reference)
    || /(?:[?&#]|^)(?:access[_-]?token|api[_-]?key|authorization|credential|password|secret)=/iu.test(reference)
    || /^bearer\s+/iu.test(reference);
}

/** Returns true only for filesystem-like absolute paths, not browser routes or HTTP URLs. */
export function isSensitiveLocalArtifactReference(reference: unknown) {
  const candidate = cleanString(reference);
  if (!candidate) return false;
  if (/^file:\/\//iu.test(candidate) || /^(?:[a-z]:[\\/]|\\\\)/iu.test(candidate)) return true;
  return /^\/(?:Users|home|root|tmp|private|var|opt|workspace|mnt|Volumes)(?:\/|$)/u.test(candidate);
}

export function sanitizeDeveloperRecordArtifactRefs(value: unknown) {
  return uniqueStrings(value).filter((reference) => (
    !isSensitiveLocalArtifactReference(reference)
    && !isCredentialBearingReference(reference)
    && !/^data:/iu.test(reference)
  ));
}

function normalizeRelatedAppIds(value: unknown, appId: DeveloperRecordAppId) {
  const result = uniqueStrings(value)
    .filter((candidate): candidate is DeveloperRecordAppId => APP_IDS.has(candidate as DeveloperRecordAppId));
  if (!result.includes(appId)) result.unshift(appId);
  return result;
}

export function normalizeDeveloperRecordEntry(value: unknown): DeveloperRecordEntry | null {
  if (!isRecord(value)) return null;
  const recordId = cleanString(value.recordId);
  const appId = cleanString(value.appId) as DeveloperRecordAppId;
  const artifactKind = cleanString(value.artifactKind);
  const scope = cleanString(value.scope) as DeveloperRecordScope;
  const scopeIdentity = cleanString(value.scopeIdentity);
  const status = cleanString(value.status) as DeveloperRecordStatus;
  const authority = cleanString(value.authority) as DeveloperRecordAuthority;
  const recordedAt = normalizeNullableTimestamp(value.recordedAt);
  const title = cleanString(value.title);
  const summary = cleanString(value.summary);
  if (!recordId || !APP_IDS.has(appId) || !artifactKind || !SCOPES.has(scope) || !scopeIdentity
    || !STATUSES.has(status) || !AUTHORITIES.has(authority) || !recordedAt || !title || !summary) {
    return null;
  }
  return {
    schemaVersion: DEVELOPER_RECORD_LEDGER_SCHEMA_VERSION,
    recordId,
    appId,
    relatedAppIds: normalizeRelatedAppIds(value.relatedAppIds, appId),
    artifactKind,
    scope,
    scopeIdentity,
    sourceScope: nullableString(value.sourceScope),
    pageIdentity: nullableString(value.pageIdentity),
    status,
    authority,
    recordedAt,
    title,
    contractVersion: nullableString(value.contractVersion),
    factoryVersion: nullableString(value.factoryVersion),
    hVersion: nullableString(value.hVersion),
    sourceFingerprint: nullableString(value.sourceFingerprint),
    targetManifestFingerprint: nullableString(value.targetManifestFingerprint),
    summary,
    validation: nullableString(value.validation),
    risks: nullableString(value.risks),
    artifactRefs: sanitizeDeveloperRecordArtifactRefs(value.artifactRefs),
    sourceKey: nullableString(value.sourceKey),
  };
}

function developerAppLabel(appId: DeveloperRecordAppId) {
  return DEVELOPER_RECORD_APPS.find((app) => app.appId === appId)?.label ?? appId;
}

function workflowArtifactSummary(artifact: DeveloperWorkflowArtifactEnvelope) {
  return artifact.message
    || `${artifact.artifactKind} 已记录，状态：${artifact.status}。`;
}

export function adaptDeveloperWorkflowArtifacts(
  value: DeveloperWorkflowRun | unknown,
  options: AdaptDeveloperWorkflowRecordsOptions = {},
) {
  const run = normalizeDeveloperWorkflowRun(value);
  if (!run) return [];
  const authority = options.authority && AUTHORITIES.has(options.authority) ? options.authority : "local";
  const records: DeveloperRecordEntry[] = [];
  for (const { id: stage } of DEVELOPER_WORKFLOW_STAGES) {
    const artifact = run.artifacts[stage] as DeveloperWorkflowArtifactEnvelope | undefined;
    if (!artifact) continue;
    const appId = artifact.appId as DeveloperRecordAppId;
    const entry = normalizeDeveloperRecordEntry({
      schemaVersion: DEVELOPER_RECORD_LEDGER_SCHEMA_VERSION,
      recordId: `workflow:${run.id}:${stage}`,
      appId,
      relatedAppIds: [appId, AGGREGATE_APP_ID],
      artifactKind: artifact.artifactKind,
      scope: artifact.scope,
      scopeIdentity: artifact.scopeIdentity,
      sourceScope: run.sourceScope,
      pageIdentity: run.scope === "page" && run.normalizedRoute
        ? `${run.sourceScope}:${run.normalizedRoute}`
        : null,
      status: artifact.status,
      authority,
      recordedAt: artifact.recordedAt,
      title: `${stage} ${developerAppLabel(appId)}记录`,
      contractVersion: artifact.contractVersion,
      factoryVersion: null,
      hVersion: null,
      sourceFingerprint: artifact.sourceFingerprint,
      targetManifestFingerprint: artifact.targetManifestFingerprint,
      summary: workflowArtifactSummary(artifact),
      validation: null,
      risks: run.issues.length ? run.issues.join("；") : null,
      artifactRefs: artifact.artifactRefs,
      sourceKey: `developer-workflow:${run.id}:${stage}`,
    });
    if (entry) records.push(entry);
  }
  return sortDeveloperRecords(records);
}

function isLegacyEvidenceKey(key: string) {
  return LEGACY_REVISION_PATTERN.test(key) || LEGACY_AUDIT_KEYS.has(key) || LEGACY_REPAIR_KEYS.has(key);
}

function isWorkflowPerformanceEvidence(key: string, value: Record<string, unknown>) {
  return Array.isArray(value.workflow) && WORKFLOW_PERFORMANCE_KEY_PATTERN.test(key);
}

function legacyArtifactKind(key: string, value: Record<string, unknown>) {
  const explicitArtifactKind = cleanString(value.artifactKind);
  if (explicitArtifactKind) return explicitArtifactKind;
  if (isWorkflowPerformanceEvidence(key, value)) return WORKFLOW_PERFORMANCE_COMPATIBILITY.artifactKind;
  if (LEGACY_AUDIT_KEYS.has(key)) return "page-factory-audit";
  if (LEGACY_REPAIR_KEYS.has(key)) return "page-factory-repair";
  return "page-factory-revision";
}

const PHASE_APP_RULES: readonly {
  appId: Exclude<DeveloperRecordAppId, "page-factory">;
  pattern: RegExp;
}[] = [
  { appId: "page-lock", pattern: /(?:page.?lock|locker|source.?lock|页面锁|锁定器|源码锁)/iu },
  { appId: "quality-release", pattern: /(?:quality|release|publish|version|save|finalize|backup|workflow|质量|发布|保存|版本|门禁|工厂默认)/iu },
  { appId: "performance-experience", pattern: /(?:performance|lazy|load|cache|media|first.?paint|wakeup|性能|加载|缓存|媒体|首屏|唤醒)/iu },
  { appId: "visual-evidence", pattern: /(?:visual|responsive|viewport|screenshot|popup|card|layout|spacing|theme|视觉|响应式|截图|弹窗|卡片|版面|间距|主题)/iu },
  { appId: "figma-ui", pattern: /(?:figma|design.?snapshot|page.?dna|设计快照|页面.?dna)/iu },
  { appId: "shared-contract", pattern: /(?:shared|contract|契约|共享)/iu },
  { appId: "visual-frame", pattern: /(?:frame|scope|sidebar|global|migration|框架|作用域|侧栏|迁移)/iu },
];

function legacyEvidenceSearchText(key: string, value: Record<string, unknown>) {
  const fields = ["title", "scope", "result", "summary"];
  return [key, ...fields.map((field) => cleanString(value[field]))].filter(Boolean).join("\n");
}

function compareDottedVersions(left: string, right: string) {
  const parse = (value: string) => {
    const parts = value.split(".");
    if (!parts.length || parts.some((part) => !/^\d+$/u.test(part))) return null;
    return parts.map((part) => Number.parseInt(part, 10));
  };
  const leftParts = parse(left);
  const rightParts = parse(right);
  if (!leftParts || !rightParts) return null;
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

function shouldUseLegacyNavigationOrderAliases(value: Record<string, unknown>) {
  const contractVersion = legacyContractVersion(value);
  if (!contractVersion) return true;
  const comparison = compareDottedVersions(
    contractVersion,
    DEVELOPER_NAVIGATION_ORDER_MIGRATION_CONTRACT_VERSION,
  );
  return comparison === null || comparison < 0;
}

function stageEvidenceAppIds(value: Record<string, unknown>) {
  if (!isRecord(value.stageEvidence)) return [];
  const appIds: DeveloperRecordAppId[] = [];
  const useLegacyAliases = shouldUseLegacyNavigationOrderAliases(value);
  for (const [key, evidence] of Object.entries(value.stageEvidence)) {
    if (isRecord(evidence)) {
      const explicitAppId = cleanString(evidence.appId) as DeveloperRecordAppId;
      if (APP_IDS.has(explicitAppId)) {
        appIds.push(explicitAppId);
        continue;
      }
    }
    const order = key.slice(0, 2);
    const legacyAppId = NAVIGATION_ORDER_ALIASES.find((alias) => alias.previousOrder === order)?.appId;
    const currentAppId = DEVELOPER_RECORD_APPS.find((app) => app.id === order)?.appId;
    const appId = useLegacyAliases ? legacyAppId ?? currentAppId : currentAppId;
    if (appId && APP_IDS.has(appId)) appIds.push(appId);
  }
  return [...new Set(appIds)];
}

function workflowEvidenceAppIds(value: Record<string, unknown>) {
  if (!Array.isArray(value.workflow)) return [];
  const appIds: DeveloperRecordAppId[] = [];
  for (const evidence of value.workflow) {
    if (!isRecord(evidence)) continue;
    const explicitAppId = cleanString(evidence.appId) as DeveloperRecordAppId;
    if (APP_IDS.has(explicitAppId)) {
      appIds.push(explicitAppId);
      continue;
    }
    const order = cleanString(evidence.stage).slice(0, 2);
    if (!WORKFLOW_STAGE_ORDERS.has(order)) continue;
    const currentAppId = DEVELOPER_RECORD_APPS.find((app) => app.id === order)?.appId;
    if (currentAppId && APP_IDS.has(currentAppId)) appIds.push(currentAppId);
  }
  return [...new Set(appIds)];
}

function classifyLegacyEvidence(key: string, value: Record<string, unknown>) {
  const text = legacyEvidenceSearchText(key, value);
  const matched = PHASE_APP_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.appId);
  const explicitAppId = cleanString(value.appId) as DeveloperRecordAppId;
  const appId = APP_IDS.has(explicitAppId)
    ? explicitAppId
    : isWorkflowPerformanceEvidence(key, value)
      ? WORKFLOW_PERFORMANCE_COMPATIBILITY.primaryAppId
      : matched[0] ?? AGGREGATE_APP_ID;
  const explicitRelatedAppIds = uniqueStrings(value.relatedAppIds)
    .filter((candidate): candidate is DeveloperRecordAppId => APP_IDS.has(candidate as DeveloperRecordAppId));
  const related = [...new Set([
    ...explicitRelatedAppIds,
    ...stageEvidenceAppIds(value),
    ...workflowEvidenceAppIds(value),
    ...matched,
    AGGREGATE_APP_ID,
  ])];
  if (!related.includes(appId)) related.unshift(appId);
  return { appId, relatedAppIds: related };
}

function normalizeWorkflowEvidenceStatus(value: unknown): Exclude<DeveloperRecordStatus, "info"> | null {
  const status = cleanString(value).toLocaleLowerCase();
  if (!status) return null;
  if (/(?:failed|failure|error|失败|未通过)/iu.test(status)) return "failed";
  if (/(?:blocked|block|阻断)/iu.test(status)) return "blocked";
  if (/(?:stale|expired|过期|失效)/iu.test(status)) return "stale";
  if (/(?:pending|external|not.?supplied|missing|待)/iu.test(status)) return "pending";
  if (/(?:passed|pass|通过)/iu.test(status)) return "passed";
  return null;
}

function workflowEvidenceStatus(value: Record<string, unknown>) {
  if (!Array.isArray(value.workflow)) return null;
  const rawStatuses = value.workflow
    .filter(isRecord)
    .map((evidence) => cleanString(evidence.status))
    .filter(Boolean);
  if (!rawStatuses.length) return null;
  const normalizedStatuses = rawStatuses
    .map(normalizeWorkflowEvidenceStatus)
    .filter((status): status is Exclude<DeveloperRecordStatus, "info"> => Boolean(status));
  for (const status of WORKFLOW_PERFORMANCE_COMPATIBILITY.statusPriority) {
    if (normalizedStatuses.includes(status)) return status;
  }
  return "pending";
}

function legacyStatus(value: Record<string, unknown>): DeveloperRecordStatus {
  const explicit = cleanString(value.status) as DeveloperRecordStatus;
  const workflow = workflowEvidenceStatus(value);
  const candidates = [STATUSES.has(explicit) ? explicit : null, workflow];
  for (const status of WORKFLOW_PERFORMANCE_COMPATIBILITY.statusPriority) {
    if (candidates.includes(status)) return status;
  }
  if (explicit === "info") return "info";
  if (typeof value.completionPercent === "number") return value.completionPercent >= 100 ? "passed" : "pending";
  const result = `${cleanString(value.result)} ${cleanString(value.validation)}`;
  if (/(?:失败|未通过|failed)/iu.test(result)) return "failed";
  return "info";
}

function legacyScope(value: Record<string, unknown>, fallbackScopeIdentity: string) {
  const pageIdentityObject = isRecord(value.pageIdentity) ? value.pageIdentity : null;
  const sourceScope = cleanString(pageIdentityObject?.sourceScope) || cleanString(value.sourceScope) || null;
  const normalizedRoute = cleanString(pageIdentityObject?.normalizedRoute);
  const explicitPageIdentity = cleanString(value.pageIdentity);
  const pageIdentity = explicitPageIdentity
    || (sourceScope && normalizedRoute ? `${sourceScope}:${normalizedRoute}` : null);
  const explicitIdentity = cleanString(value.scopeIdentity);
  if (explicitIdentity.startsWith("page:")) {
    return { scope: "page" as const, scopeIdentity: explicitIdentity, sourceScope, pageIdentity };
  }
  if (explicitIdentity.startsWith("global:")) {
    return { scope: "global" as const, scopeIdentity: explicitIdentity, sourceScope, pageIdentity };
  }
  if (sourceScope && normalizedRoute) {
    return {
      scope: "page" as const,
      scopeIdentity: buildDeveloperWorkflowScopeIdentity({ scope: "page", sourceScope, normalizedRoute }),
      sourceScope,
      pageIdentity,
    };
  }
  return {
    scope: "system" as const,
    scopeIdentity: explicitIdentity || fallbackScopeIdentity,
    sourceScope,
    pageIdentity,
  };
}

function legacySummary(value: Record<string, unknown>) {
  return cleanString(value.result)
    || cleanString(value.summary)
    || cleanString(value.finding)
    || cleanString(value.outcome)
    || "历史页面工厂证据已读取。";
}

function legacyContractVersion(value: Record<string, unknown>) {
  return nullableString(value.contractVersion)
    || nullableString(value.workflowContractVersion)
    || nullableString(value.mediaContractVersion);
}

function legacyArtifactRefs(value: Record<string, unknown>) {
  const refs = uniqueStrings(value.artifactRefs);
  if (isRecord(value.stageEvidence)) {
    for (const stage of Object.values(value.stageEvidence)) {
      if (!isRecord(stage)) continue;
      refs.push(...uniqueStrings(stage.artifactRefs));
    }
  }
  if (Array.isArray(value.workflow)) {
    for (const stage of value.workflow) {
      if (!isRecord(stage)) continue;
      refs.push(...uniqueStrings(stage.artifactRefs));
    }
  }
  return refs;
}

function humanizeLegacyKey(key: string) {
  const withoutPrefix = key.replace(/^latest/u, "").replace(/(?:Revision|Audit|Repair)$/u, "");
  const words = withoutPrefix.replace(/([a-z0-9])([A-Z])/gu, "$1 $2").trim();
  return words || key;
}

export function adaptPhaseTwoVerificationRecords(
  value: unknown,
  options: AdaptPhaseTwoVerificationOptions = {},
) {
  if (!isRecord(value)) return [];
  const authority = options.authority && AUTHORITIES.has(options.authority) ? options.authority : "source";
  const fallbackScopeIdentity = cleanString(options.fallbackScopeIdentity, "system:page-factory");
  const rootRecordedAt = normalizeTimestamp(value.recordedAt);
  const rootFactoryVersion = nullableString(value.factoryVersion);
  const records: DeveloperRecordEntry[] = [];
  for (const [sourceKey, rawEvidence] of Object.entries(value)) {
    if (!isLegacyEvidenceKey(sourceKey) || !isRecord(rawEvidence)) continue;
    const classification = classifyLegacyEvidence(sourceKey, rawEvidence);
    const scope = legacyScope(rawEvidence, fallbackScopeIdentity);
    const entry = normalizeDeveloperRecordEntry({
      schemaVersion: DEVELOPER_RECORD_LEDGER_SCHEMA_VERSION,
      recordId: `phase-two:${sourceKey}`,
      appId: classification.appId,
      relatedAppIds: classification.relatedAppIds,
      artifactKind: legacyArtifactKind(sourceKey, rawEvidence),
      scope: scope.scope,
      scopeIdentity: scope.scopeIdentity,
      sourceScope: scope.sourceScope,
      pageIdentity: scope.pageIdentity,
      status: legacyStatus(rawEvidence),
      authority,
      recordedAt: normalizeTimestamp(rawEvidence.recordedAt, rootRecordedAt),
      title: cleanString(rawEvidence.title) || humanizeLegacyKey(sourceKey),
      contractVersion: legacyContractVersion(rawEvidence),
      factoryVersion: nullableString(rawEvidence.factoryVersion) || rootFactoryVersion,
      hVersion: nullableString(rawEvidence.targetHVersion) || nullableString(rawEvidence.hVersion),
      sourceFingerprint: rawEvidence.sourceFingerprint,
      targetManifestFingerprint: rawEvidence.targetManifestFingerprint,
      summary: legacySummary(rawEvidence),
      validation: rawEvidence.validation,
      risks: rawEvidence.risks,
      artifactRefs: legacyArtifactRefs(rawEvidence),
      sourceKey,
    });
    if (entry) records.push(entry);
  }
  const currentSummary = adaptPageFactoryVerificationSummary(value);
  if (currentSummary) records.push(currentSummary);
  return sortDeveloperRecords(records);
}

export function adaptPageFactoryVerificationSummary(value: unknown) {
  if (!isRecord(value)) return null;
  const recordedAt = normalizeNullableTimestamp(value.recordedAt);
  const summary = cleanString(value.summary);
  if (!recordedAt || !summary) return null;
  const checks = Array.isArray(value.checks)
    ? value.checks.filter(isRecord).map((check) => cleanString(check.label) || cleanString(check.id)).filter(Boolean)
    : [];
  return normalizeDeveloperRecordEntry({
    schemaVersion: DEVELOPER_RECORD_LEDGER_SCHEMA_VERSION,
    recordId: `page-factory:verification:${recordedAt}`,
    appId: AGGREGATE_APP_ID,
    relatedAppIds: [AGGREGATE_APP_ID],
    artifactKind: "page-factory-verification",
    scope: "system",
    scopeIdentity: "system:page-factory",
    sourceScope: null,
    pageIdentity: null,
    status: STATUSES.has(value.status as DeveloperRecordStatus) ? value.status : "info",
    authority: "source",
    recordedAt,
    title: "07 页面工厂当前验证记录",
    contractVersion: null,
    factoryVersion: value.factoryVersion,
    hVersion: null,
    sourceFingerprint: null,
    targetManifestFingerprint: null,
    summary,
    validation: checks.length ? checks.join("；") : null,
    risks: null,
    artifactRefs: [],
    sourceKey: "phase-two-verification-root",
  });
}

function recordMatchesAppIds(record: DeveloperRecordEntry, appIds: readonly DeveloperRecordAppId[]) {
  return appIds.some((appId) => record.appId === appId || record.relatedAppIds.includes(appId));
}

export function sortDeveloperRecords(
  records: readonly DeveloperRecordEntry[],
  direction: DeveloperRecordSortDirection = "desc",
) {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...records].sort((left, right) => {
    const byTime = Date.parse(left.recordedAt) - Date.parse(right.recordedAt);
    if (byTime) return byTime * multiplier;
    return left.recordId.localeCompare(right.recordId, "en") * multiplier;
  });
}

export function filterDeveloperRecords(
  records: readonly DeveloperRecordEntry[],
  filter: DeveloperRecordFilter = {},
) {
  const search = cleanString(filter.search).toLocaleLowerCase();
  const from = normalizeNullableTimestamp(filter.from);
  const to = normalizeNullableTimestamp(filter.to);
  const result = sortDeveloperRecords(records).filter((record) => {
    if (filter.appIds?.length && !recordMatchesAppIds(record, filter.appIds)) return false;
    if (filter.scopeIdentity && record.scopeIdentity !== filter.scopeIdentity) return false;
    if (filter.statuses?.length && !filter.statuses.includes(record.status)) return false;
    if (filter.authorities?.length && !filter.authorities.includes(record.authority)) return false;
    if (filter.pageIdentity && record.pageIdentity !== filter.pageIdentity) return false;
    if (filter.hVersion && record.hVersion !== filter.hVersion) return false;
    if (from && record.recordedAt < from) return false;
    if (to && record.recordedAt > to) return false;
    if (search) {
      const haystack = [
        record.recordId,
        record.appId,
        ...record.relatedAppIds,
        record.artifactKind,
        record.scope,
        record.scopeIdentity,
        record.sourceScope,
        record.title,
        record.summary,
        record.validation,
        record.risks,
        record.sourceKey,
        record.pageIdentity,
        record.recordedAt,
        record.hVersion,
        record.factoryVersion,
        record.contractVersion,
        record.sourceFingerprint,
        record.targetManifestFingerprint,
        ...record.artifactRefs,
      ].filter(Boolean).join("\n").toLocaleLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
  const limit = Number.isInteger(filter.limit) && (filter.limit as number) >= 0
    ? filter.limit as number
    : null;
  return limit === null ? result : result.slice(0, limit);
}

function resolveStorage(storage?: DeveloperRecordStorage | null) {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function buildDeveloperRecordStorageKey(scopeIdentity: string) {
  const identity = cleanString(scopeIdentity);
  if (!identity) throw new Error("developer record scopeIdentity is required");
  return `${DEVELOPER_RECORD_LOCAL_STORAGE_PREFIX}:${encodeURIComponent(identity)}`;
}

export function parseLocalDeveloperRecords(raw: unknown, scopeIdentity: string) {
  const identity = cleanString(scopeIdentity);
  if (!identity) return [];
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  const values = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.records)
      ? parsed.records
      : [];
  const records = values
    .map(normalizeDeveloperRecordEntry)
    .filter((record): record is DeveloperRecordEntry => (
      Boolean(record) && record.authority === "local" && record.scopeIdentity === identity
    ));
  return sortDeveloperRecords(records).slice(0, DEVELOPER_RECORD_LOCAL_MAXIMUM_PER_SCOPE);
}

export function listLocalDeveloperRecords(
  scopeIdentity: string,
  storage?: DeveloperRecordStorage | null,
  filter: DeveloperRecordFilter = {},
) {
  const target = resolveStorage(storage);
  if (!target) return [];
  try {
    const raw = target.getItem(buildDeveloperRecordStorageKey(scopeIdentity));
    if (!raw) return [];
    return filterDeveloperRecords(parseLocalDeveloperRecords(raw, scopeIdentity), filter);
  } catch {
    return [];
  }
}

function localRecordId(record: Pick<LocalDeveloperRecordInput, "scopeIdentity" | "recordedAt" | "artifactKind">) {
  const timestamp = normalizeTimestamp(record.recordedAt).replace(/[^0-9]/gu, "");
  const kind = cleanString(record.artifactKind).replace(/[^a-z0-9-]+/giu, "-").replace(/^-+|-+$/gu, "");
  return `local:${encodeURIComponent(cleanString(record.scopeIdentity))}:${timestamp}:${kind || "record"}`;
}

export function appendLocalDeveloperRecord(
  input: LocalDeveloperRecordInput | DeveloperRecordEntry,
  options: AppendLocalDeveloperRecordOptions = {},
): AppendLocalDeveloperRecordResult {
  const target = resolveStorage(options.storage);
  const identity = cleanString(input.scopeIdentity);
  const existing = identity ? listLocalDeveloperRecords(identity, target) : [];
  if (!target || !identity) return { saved: false, record: null, records: existing };
  const record = normalizeDeveloperRecordEntry({
    ...input,
    schemaVersion: DEVELOPER_RECORD_LEDGER_SCHEMA_VERSION,
    recordId: cleanString(input.recordId) || localRecordId(input),
    authority: "local",
  });
  if (!record || record.scopeIdentity !== identity) return { saved: false, record: null, records: existing };
  const requestedCapacity = Number.isInteger(options.maximumRecordsPerScope)
    ? options.maximumRecordsPerScope as number
    : DEVELOPER_RECORD_LOCAL_MAXIMUM_PER_SCOPE;
  const capacity = Math.max(1, Math.min(DEVELOPER_RECORD_LOCAL_MAXIMUM_PER_SCOPE, requestedCapacity));
  const records = sortDeveloperRecords([record, ...existing.filter((item) => item.recordId !== record.recordId)])
    .slice(0, capacity);
  try {
    target.setItem(buildDeveloperRecordStorageKey(identity), JSON.stringify({
      schemaVersion: DEVELOPER_RECORD_LEDGER_SCHEMA_VERSION,
      scopeIdentity: identity,
      authority: "local",
      formalAudit: developerRecordLedgerContract.localReceipts.formalAudit,
      disclaimer: DEVELOPER_RECORD_LOCAL_DISCLAIMER,
      records,
    }));
    return { saved: true, record, records };
  } catch {
    return { saved: false, record: null, records: existing };
  }
}

export function createDeveloperLockReceipt(input: DeveloperLockReceiptInput) {
  const recordedAt = normalizeTimestamp(input.recordedAt, new Date().toISOString());
  const targetIds = [...new Set(input.targetIds.map((target) => cleanString(target)).filter(Boolean))];
  const actionLabel = input.action === "lock" ? "锁定" : input.action === "unlock" ? "解锁" : "锁状态检查";
  return normalizeDeveloperRecordEntry({
    schemaVersion: DEVELOPER_RECORD_LEDGER_SCHEMA_VERSION,
    recordId: cleanString(input.recordId)
      || `lock-receipt:${encodeURIComponent(input.scopeIdentity)}:${recordedAt.replace(/[^0-9]/gu, "")}:${input.action}`,
    appId: "page-lock",
    relatedAppIds: ["page-lock", AGGREGATE_APP_ID],
    artifactKind: RECORD_PROJECTIONS.find((projection) => projection.appId === "page-lock")?.artifactKind
      || "lock-receipt",
    scope: input.scope,
    scopeIdentity: input.scopeIdentity,
    sourceScope: input.sourceScope,
    pageIdentity: input.pageIdentity,
    status: input.status || "passed",
    authority: "local",
    recordedAt,
    title: `08 页面锁定器 · ${actionLabel}回执`,
    contractVersion: input.contractVersion || developerRecordLedgerContract.version,
    factoryVersion: input.factoryVersion,
    hVersion: input.hVersion,
    sourceFingerprint: input.sourceFingerprint,
    targetManifestFingerprint: input.targetManifestFingerprint,
    summary: cleanString(input.summary)
      || `${actionLabel}已记录；目标 ${targetIds.length} 项${targetIds.length ? `：${targetIds.join("、")}` : "。"}`,
    validation: input.validation,
    risks: input.risks,
    artifactRefs: input.artifactRefs || [],
    sourceKey: null,
  });
}
