import {
  DEVELOPER_WORKFLOW_TARGET_MANIFEST_SCHEMA_VERSION,
  canonicalizeDeveloperWorkflowValue,
  fingerprintDeveloperWorkflowTargetManifest as fingerprintTargetManifest,
  fingerprintDeveloperWorkflowValue as fingerprintWorkflowValue,
  normalizeDeveloperWorkflowRoute,
  normalizeDeveloperWorkflowTargetEntries,
  stableDeveloperWorkflowJson as stableWorkflowJson,
} from "./developer-workflow-target-manifest.mjs";

// Static contract token: DEVELOPER_WORKFLOW_RUN_SCHEMA_VERSION = 1; the shared helper remains authoritative.
export const DEVELOPER_WORKFLOW_RUN_SCHEMA_VERSION = DEVELOPER_WORKFLOW_TARGET_MANIFEST_SCHEMA_VERSION as 1;
export const DEVELOPER_WORKFLOW_RUN_STORAGE_PREFIX = "tradepro.developer-workflow-run.v1" as const;

export const DEVELOPER_WORKFLOW_STAGES = [
  { id: "01", appId: "visual-frame", artifactKind: "scope-manifest" },
  { id: "02", appId: "shared-contract", artifactKind: "resolved-contract" },
  { id: "03", appId: "figma-ui", artifactKind: "design-snapshot" },
  { id: "04", appId: "visual-evidence", artifactKind: "visual-evidence" },
  { id: "05", appId: "performance-experience", artifactKind: "performance-evidence" },
  { id: "06", appId: "quality-release", artifactKind: "release-evidence" },
] as const;

export type DeveloperWorkflowScope = "global" | "page";
export type DeveloperWorkflowStatus = "pending" | "passed" | "failed" | "blocked" | "stale";
export type DeveloperWorkflowStageId = (typeof DEVELOPER_WORKFLOW_STAGES)[number]["id"];
export type DeveloperWorkflowAppId = (typeof DEVELOPER_WORKFLOW_STAGES)[number]["appId"];
export type DeveloperWorkflowArtifactKind = (typeof DEVELOPER_WORKFLOW_STAGES)[number]["artifactKind"];

export const DEVELOPER_WORKFLOW_PERFORMANCE_BENCHMARK_SCHEMA_VERSION = 1 as const;
export const DEVELOPER_WORKFLOW_PERFORMANCE_BENCHMARK_METRIC_IDS = [
  "visualReadyMs",
  "editReadyMs",
  "interactiveReadyMs",
  "domContentLoadedMs",
  "firstContentfulPaintMs",
  "largestContentfulPaintMs",
  "scriptEncodedBytes",
  "totalEncodedBytes",
  "resourceCount",
  "duplicateRequestExcess",
] as const;

export type DeveloperWorkflowPerformanceBenchmarkMetricId =
  (typeof DEVELOPER_WORKFLOW_PERFORMANCE_BENCHMARK_METRIC_IDS)[number];
export type DeveloperWorkflowPerformanceBenchmarkOutcome = "improved" | "regressed" | "unchanged" | "invalid";
export type DeveloperWorkflowPerformanceBenchmarkMetricStatus = Exclude<
  DeveloperWorkflowPerformanceBenchmarkOutcome,
  "invalid"
>;

export type DeveloperWorkflowPerformanceBenchmarkMetricDelta = {
  before: number;
  after: number;
  delta: number;
  deltaPercent: number | null;
  status: DeveloperWorkflowPerformanceBenchmarkMetricStatus;
};

export type DeveloperWorkflowPerformanceFunctionalParity = {
  status: "passed" | "failed";
  issues: readonly string[];
};

export type DeveloperWorkflowPerformanceEvidenceQuality = {
  aggregation: "mean" | "median";
  baselineSamples: number;
  candidateSamples: number;
  runCount: number;
  confidence: "stable" | "mixed";
  notes: readonly string[];
};

export type DeveloperWorkflowPerformanceBenchmarkPhase = {
  outcome: DeveloperWorkflowPerformanceBenchmarkOutcome;
  functionalParity: DeveloperWorkflowPerformanceFunctionalParity;
  metrics: Partial<Record<
    DeveloperWorkflowPerformanceBenchmarkMetricId,
    DeveloperWorkflowPerformanceBenchmarkMetricDelta
  >>;
};

export type DeveloperWorkflowPerformanceBenchmarkSummary = {
  schemaVersion: typeof DEVELOPER_WORKFLOW_PERFORMANCE_BENCHMARK_SCHEMA_VERSION;
  pageIdentity: string;
  baselineRunId: string;
  candidateRunId: string;
  outcome: DeveloperWorkflowPerformanceBenchmarkOutcome;
  artifactRefs: readonly string[];
  evidenceQuality?: DeveloperWorkflowPerformanceEvidenceQuality;
  fingerprints: {
    baselineReport: string;
    candidateReport: string;
    baselineSource: string | null;
    candidateSource: string | null;
    baselineRouteClosure: string | null;
    candidateRouteClosure: string | null;
  };
  cold: DeveloperWorkflowPerformanceBenchmarkPhase;
  repeat: DeveloperWorkflowPerformanceBenchmarkPhase;
};

export type DeveloperWorkflowTarget = {
  id: string;
  sourceScope?: string;
  normalizedRoute?: string;
  version?: string;
  fingerprint?: string;
};

type ExtensiblePayload = { readonly [key: string]: unknown };

export type DeveloperWorkflowArtifactPayloadByStage = {
  "01": ExtensiblePayload & {
    targetIds: readonly string[];
    loadPlanPolicyVersion: string;
    loadPlanProfileId: string;
    loadPlanFingerprint: string;
    excludedTargetIds?: readonly string[];
  };
  "02": ExtensiblePayload & {
    contractVersions: Readonly<Record<string, string>>;
    inheritedFrom?: string | null;
    overrideKeys?: readonly string[];
  };
  "03": ExtensiblePayload & {
    pageDnaFingerprint: string;
    fileKey: string | null;
    nodeId: string | null;
    revision: string | null;
    componentMappings?: readonly string[];
  };
  "04": ExtensiblePayload & {
    pageDnaFingerprint: string;
    viewportIds: readonly string[];
    checkIds: readonly string[];
    artifactRefs?: readonly string[];
  };
  "05": ExtensiblePayload & {
    metricIds: readonly string[];
    budgetViolations: readonly string[];
    artifactRefs?: readonly string[];
    benchmarkSummary?: DeveloperWorkflowPerformanceBenchmarkSummary | null;
  };
  "06": ExtensiblePayload & {
    gateIds: readonly string[];
    githubPr?: string | null;
    githubHeadSha?: string | null;
    githubChecks?: readonly unknown[];
    githubReviewDecision?: string | null;
    prEvidenceFingerprint?: string | null;
    releaseVersion?: string | null;
    artifactRefs?: readonly string[];
    passedGateIds?: readonly string[];
    pendingGateIds?: readonly string[];
    blockedGateIds?: readonly string[];
    gateResults?: readonly unknown[];
    workflowRunId?: string | null;
    workflowContractVersion?: string | null;
    workflowScopeIdentity?: string | null;
    workflowSourceFingerprint?: string | null;
    workflowTargetManifestFingerprint?: string | null;
    verificationExpiresAt?: string | null;
  };
};

type DeveloperWorkflowStageDefinition<S extends DeveloperWorkflowStageId> = Extract<
  (typeof DEVELOPER_WORKFLOW_STAGES)[number],
  { id: S }
>;

export type DeveloperWorkflowArtifactEnvelope<S extends DeveloperWorkflowStageId = DeveloperWorkflowStageId> = {
  schemaVersion: typeof DEVELOPER_WORKFLOW_RUN_SCHEMA_VERSION;
  stage: S;
  appId: DeveloperWorkflowStageDefinition<S>["appId"];
  artifactKind: DeveloperWorkflowStageDefinition<S>["artifactKind"];
  scope: DeveloperWorkflowScope;
  scopeIdentity: string;
  targetManifestFingerprint: string;
  sourceFingerprint: string;
  contractVersion: string;
  status: DeveloperWorkflowStatus;
  recordedAt: string;
  payload: DeveloperWorkflowArtifactPayloadByStage[S];
  artifactRefs: readonly string[];
  message: string | null;
  fingerprint: string;
};

export type DeveloperWorkflowArtifactMap = Partial<{
  [S in DeveloperWorkflowStageId]: DeveloperWorkflowArtifactEnvelope<S>;
}>;

type AnyDeveloperWorkflowArtifactEnvelope = NonNullable<
  DeveloperWorkflowArtifactMap[DeveloperWorkflowStageId]
>;

export type DeveloperWorkflowRun = {
  schemaVersion: typeof DEVELOPER_WORKFLOW_RUN_SCHEMA_VERSION;
  id: string;
  scope: DeveloperWorkflowScope;
  scopeIdentity: string;
  sourceScope: string;
  normalizedRoute: string | null;
  contractVersion: string;
  sourceFingerprint: string;
  targets: readonly DeveloperWorkflowTarget[];
  targetManifestFingerprint: string;
  status: DeveloperWorkflowStatus;
  artifacts: DeveloperWorkflowArtifactMap;
  issues: readonly string[];
  createdAt: string;
  updatedAt: string;
  fingerprint: string;
};

export type DeveloperWorkflowExecutionContext = {
  runId: string;
  scope: DeveloperWorkflowScope;
  scopeIdentity: string;
  sourceFingerprint: string;
  contractVersion: string;
  targetManifestFingerprint: string;
};

export type DeveloperWorkflowRunIdentityInput = {
  scope: DeveloperWorkflowScope;
  sourceScope: string;
  normalizedRoute?: string | null;
};

export type CreateDeveloperWorkflowRunInput = DeveloperWorkflowRunIdentityInput & {
  contractVersion: string;
  sourceFingerprint: string;
  targets: readonly (DeveloperWorkflowTarget | string)[];
  createdAt?: string;
  id?: string;
};

export type UpdateDeveloperWorkflowArtifactInput<S extends DeveloperWorkflowStageId> = {
  status: DeveloperWorkflowStatus;
  payload: DeveloperWorkflowArtifactPayloadByStage[S];
  artifactRefs?: readonly string[];
  message?: string | null;
  recordedAt?: string;
  expectedContext?: DeveloperWorkflowExecutionContext;
};

export type DeveloperWorkflowNextStepGate = {
  complete: boolean;
  allowed: boolean;
  nextStage: DeveloperWorkflowStageId | null;
  blockingStatus: Exclude<DeveloperWorkflowStatus, "pending" | "passed"> | null;
  reason: "ready" | "pending" | "complete" | "failed" | "blocked" | "stale";
};

export type DeveloperWorkflowStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type NormalizeDeveloperWorkflowRunOptions = {
  expectedContractVersion?: string;
  expectedSourceFingerprint?: string;
  expectedTargetManifestFingerprint?: string;
};

const WORKFLOW_STATUS_VALUES = new Set<DeveloperWorkflowStatus>([
  "pending",
  "passed",
  "failed",
  "blocked",
  "stale",
]);
const SHA256 = /^[0-9a-f]{64}$/u;
const PERFORMANCE_BENCHMARK_OUTCOMES = new Set<DeveloperWorkflowPerformanceBenchmarkOutcome>([
  "improved",
  "regressed",
  "unchanged",
  "invalid",
]);
const PERFORMANCE_BENCHMARK_METRIC_STATUSES = new Set<DeveloperWorkflowPerformanceBenchmarkMetricStatus>([
  "improved",
  "regressed",
  "unchanged",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeBenchmarkStringList(value: unknown) {
  if (!Array.isArray(value)) return null;
  return [...new Set(value.map((item) => cleanString(item)).filter(Boolean))].sort();
}

function normalizeBenchmarkEvidenceQuality(value: unknown): DeveloperWorkflowPerformanceEvidenceQuality | null {
  if (!isRecord(value)
    || (value.aggregation !== "mean" && value.aggregation !== "median")
    || (value.confidence !== "stable" && value.confidence !== "mixed")
    || !Number.isInteger(value.baselineSamples) || (value.baselineSamples as number) < 1
    || !Number.isInteger(value.candidateSamples) || (value.candidateSamples as number) < 1
    || !Number.isInteger(value.runCount) || (value.runCount as number) < 2
    || (value.runCount as number) > (value.baselineSamples as number) + (value.candidateSamples as number)
    || !Array.isArray(value.notes)) {
    return null;
  }
  const notes = [...new Set(value.notes.map((item) => cleanString(item)).filter(Boolean))];
  if (notes.length > 3) return null;
  return {
    aggregation: value.aggregation,
    baselineSamples: value.baselineSamples as number,
    candidateSamples: value.candidateSamples as number,
    runCount: value.runCount as number,
    confidence: value.confidence,
    notes,
  };
}

function normalizeBenchmarkMetricDelta(value: unknown): DeveloperWorkflowPerformanceBenchmarkMetricDelta | null {
  if (!isRecord(value)) return null;
  const before = value.before;
  const after = value.after;
  const delta = value.delta;
  const deltaPercent = value.deltaPercent;
  const status = value.status;
  if (typeof before !== "number" || !Number.isFinite(before) || before < 0
    || typeof after !== "number" || !Number.isFinite(after) || after < 0
    || typeof delta !== "number" || !Number.isFinite(delta)
    || (deltaPercent !== null && (typeof deltaPercent !== "number" || !Number.isFinite(deltaPercent)))
    || !PERFORMANCE_BENCHMARK_METRIC_STATUSES.has(status as DeveloperWorkflowPerformanceBenchmarkMetricStatus)) {
    return null;
  }
  return {
    before,
    after,
    delta,
    deltaPercent: deltaPercent as number | null,
    status: status as DeveloperWorkflowPerformanceBenchmarkMetricStatus,
  };
}

function normalizeBenchmarkFunctionalParity(value: unknown): DeveloperWorkflowPerformanceFunctionalParity | null {
  if (!isRecord(value) || (value.status !== "passed" && value.status !== "failed")) return null;
  const issues = normalizeBenchmarkStringList(value.issues);
  if (!issues) return null;
  return { status: value.status, issues };
}

function normalizeBenchmarkPhase(value: unknown): DeveloperWorkflowPerformanceBenchmarkPhase | null {
  if (!isRecord(value)
    || !PERFORMANCE_BENCHMARK_OUTCOMES.has(value.outcome as DeveloperWorkflowPerformanceBenchmarkOutcome)
    || !isRecord(value.metrics)) {
    return null;
  }
  const functionalParity = normalizeBenchmarkFunctionalParity(value.functionalParity);
  if (!functionalParity) return null;
  const metrics: DeveloperWorkflowPerformanceBenchmarkPhase["metrics"] = {};
  for (const metricId of DEVELOPER_WORKFLOW_PERFORMANCE_BENCHMARK_METRIC_IDS) {
    if (!(metricId in value.metrics)) continue;
    const metric = normalizeBenchmarkMetricDelta(value.metrics[metricId]);
    if (!metric) return null;
    metrics[metricId] = metric;
  }
  if (!Object.keys(metrics).length) return null;
  return {
    outcome: value.outcome as DeveloperWorkflowPerformanceBenchmarkOutcome,
    functionalParity,
    metrics,
  };
}

export function normalizeDeveloperWorkflowPerformanceBenchmarkSummary(
  value: unknown,
): DeveloperWorkflowPerformanceBenchmarkSummary | null {
  if (!isRecord(value)
    || value.schemaVersion !== DEVELOPER_WORKFLOW_PERFORMANCE_BENCHMARK_SCHEMA_VERSION
    || !PERFORMANCE_BENCHMARK_OUTCOMES.has(value.outcome as DeveloperWorkflowPerformanceBenchmarkOutcome)
    || !isRecord(value.fingerprints)) {
    return null;
  }
  const pageIdentity = cleanString(value.pageIdentity);
  const baselineRunId = cleanString(value.baselineRunId);
  const candidateRunId = cleanString(value.candidateRunId);
  const artifactRefs = normalizeBenchmarkStringList(value.artifactRefs);
  const baselineReport = cleanString(value.fingerprints.baselineReport);
  const candidateReport = cleanString(value.fingerprints.candidateReport);
  const cold = normalizeBenchmarkPhase(value.cold);
  const repeat = normalizeBenchmarkPhase(value.repeat);
  const evidenceQuality = "evidenceQuality" in value
    ? normalizeBenchmarkEvidenceQuality(value.evidenceQuality)
    : undefined;
  if (!pageIdentity || !baselineRunId || !candidateRunId || !artifactRefs?.length
    || !baselineReport || !candidateReport || !cold || !repeat
    || evidenceQuality === null) {
    return null;
  }
  return {
    schemaVersion: DEVELOPER_WORKFLOW_PERFORMANCE_BENCHMARK_SCHEMA_VERSION,
    pageIdentity,
    baselineRunId,
    candidateRunId,
    outcome: value.outcome as DeveloperWorkflowPerformanceBenchmarkOutcome,
    artifactRefs,
    ...(evidenceQuality ? { evidenceQuality } : {}),
    fingerprints: {
      baselineReport,
      candidateReport,
      baselineSource: cleanString(value.fingerprints.baselineSource) || null,
      candidateSource: cleanString(value.fingerprints.candidateSource) || null,
      baselineRouteClosure: cleanString(value.fingerprints.baselineRouteClosure) || null,
      candidateRouteClosure: cleanString(value.fingerprints.candidateRouteClosure) || null,
    },
    cold,
    repeat,
  };
}

function normalizeTimestamp(value: unknown, fallback: string) {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : fallback;
}

function normalizeRoute(value: unknown) {
  return normalizeDeveloperWorkflowRoute(value);
}

function canonicalize(value: unknown): unknown {
  return canonicalizeDeveloperWorkflowValue(value);
}

function normalizeArtifactPayload<S extends DeveloperWorkflowStageId>(
  stage: S,
  value: DeveloperWorkflowArtifactPayloadByStage[S],
) {
  const payload = canonicalize(value) as DeveloperWorkflowArtifactPayloadByStage[S];
  if (stage !== "05" || !isRecord(payload) || !("benchmarkSummary" in payload)) return payload;
  if (payload.benchmarkSummary === null) return payload;
  const benchmarkSummary = normalizeDeveloperWorkflowPerformanceBenchmarkSummary(payload.benchmarkSummary);
  if (!benchmarkSummary) throw new Error("developer workflow stage 05 benchmark summary is invalid");
  return canonicalize({ ...payload, benchmarkSummary }) as DeveloperWorkflowArtifactPayloadByStage[S];
}

export function stableDeveloperWorkflowJson(value: unknown) {
  return stableWorkflowJson(value);
}

/** A dependency-free SHA-256 implementation shared by browsers, tests and SSR. */
export function fingerprintDeveloperWorkflowValue(value: unknown) {
  return fingerprintWorkflowValue(value);
}

export function buildDeveloperWorkflowScopeIdentity(input: DeveloperWorkflowRunIdentityInput) {
  const sourceScope = cleanString(input.sourceScope);
  if (!sourceScope) throw new Error("developer workflow sourceScope is required");
  if (input.scope === "global") return `global:${encodeURIComponent(sourceScope)}`;
  const route = normalizeRoute(input.normalizedRoute);
  if (!route) throw new Error("developer workflow page scope requires normalizedRoute");
  return `page:${encodeURIComponent(sourceScope)}:${encodeURIComponent(route)}`;
}

export function normalizeDeveloperWorkflowTargets(targets: readonly (DeveloperWorkflowTarget | string)[]) {
  return normalizeDeveloperWorkflowTargetEntries(targets) as DeveloperWorkflowTarget[];
}

export function fingerprintDeveloperWorkflowTargetManifest(targets: readonly (DeveloperWorkflowTarget | string)[]) {
  return fingerprintTargetManifest(targets);
}

export function getDeveloperWorkflowExecutionContext(
  run: Pick<DeveloperWorkflowRun, "id" | "scope" | "scopeIdentity" | "sourceFingerprint" | "contractVersion" | "targetManifestFingerprint">,
): DeveloperWorkflowExecutionContext {
  return {
    runId: run.id,
    scope: run.scope,
    scopeIdentity: run.scopeIdentity,
    sourceFingerprint: run.sourceFingerprint,
    contractVersion: run.contractVersion,
    targetManifestFingerprint: run.targetManifestFingerprint,
  };
}

export function developerWorkflowExecutionContextMatches(
  run: Pick<DeveloperWorkflowRun, "id" | "scope" | "scopeIdentity" | "sourceFingerprint" | "contractVersion" | "targetManifestFingerprint">,
  expected: DeveloperWorkflowExecutionContext,
) {
  const actual = getDeveloperWorkflowExecutionContext(run);
  return actual.runId === expected.runId
    && actual.scope === expected.scope
    && actual.scopeIdentity === expected.scopeIdentity
    && actual.sourceFingerprint === expected.sourceFingerprint
    && actual.contractVersion === expected.contractVersion
    && actual.targetManifestFingerprint === expected.targetManifestFingerprint;
}

function stageDefinition<S extends DeveloperWorkflowStageId>(stage: S): DeveloperWorkflowStageDefinition<S> {
  const definition = DEVELOPER_WORKFLOW_STAGES.find((candidate) => candidate.id === stage);
  if (!definition) throw new Error(`unknown developer workflow stage: ${stage}`);
  return definition as DeveloperWorkflowStageDefinition<S>;
}

function artifactFingerprint(artifact: Omit<DeveloperWorkflowArtifactEnvelope, "fingerprint">) {
  return fingerprintDeveloperWorkflowValue(artifact);
}

function semanticArtifactFingerprint(
  artifact: Omit<DeveloperWorkflowArtifactEnvelope, "fingerprint"> & { fingerprint?: string },
) {
  const {
    fingerprint: _fingerprint,
    recordedAt: _recordedAt,
    message: _message,
    ...semanticEvidence
  } = artifact;
  return fingerprintDeveloperWorkflowValue(semanticEvidence);
}

function runFingerprint(run: Omit<DeveloperWorkflowRun, "fingerprint">) {
  return fingerprintDeveloperWorkflowValue(run);
}

function deriveRunStatus(artifacts: DeveloperWorkflowArtifactMap, issues: readonly string[] = []): DeveloperWorkflowStatus {
  if (issues.length) return "stale";
  for (const definition of DEVELOPER_WORKFLOW_STAGES) {
    const artifact = artifacts[definition.id];
    if (!artifact || artifact.status === "pending") return "pending";
    if (artifact.status !== "passed") return artifact.status;
  }
  return "passed";
}

function withRunFingerprint(run: Omit<DeveloperWorkflowRun, "fingerprint">): DeveloperWorkflowRun {
  return { ...run, fingerprint: runFingerprint(run) };
}

export function createDeveloperWorkflowRun(input: CreateDeveloperWorkflowRunInput): DeveloperWorkflowRun {
  const createdAt = normalizeTimestamp(input.createdAt, new Date().toISOString());
  const sourceScope = cleanString(input.sourceScope);
  const normalizedRoute = input.scope === "page" ? normalizeRoute(input.normalizedRoute) : null;
  const scopeIdentity = buildDeveloperWorkflowScopeIdentity({ scope: input.scope, sourceScope, normalizedRoute });
  const targets = normalizeDeveloperWorkflowTargets(input.targets);
  const targetManifestFingerprint = fingerprintDeveloperWorkflowTargetManifest(targets);
  const contractVersion = cleanString(input.contractVersion);
  const sourceFingerprint = cleanString(input.sourceFingerprint);
  if (!contractVersion || !sourceFingerprint) throw new Error("developer workflow contractVersion and sourceFingerprint are required");
  const id = cleanString(input.id) || `workflow-${fingerprintDeveloperWorkflowValue({ scopeIdentity, targetManifestFingerprint, sourceFingerprint, createdAt }).slice(0, 20)}`;
  return withRunFingerprint({
    schemaVersion: DEVELOPER_WORKFLOW_RUN_SCHEMA_VERSION,
    id,
    scope: input.scope,
    scopeIdentity,
    sourceScope,
    normalizedRoute,
    contractVersion,
    sourceFingerprint,
    targets,
    targetManifestFingerprint,
    status: "pending",
    artifacts: {},
    issues: [],
    createdAt,
    updatedAt: createdAt,
  });
}

function staleArtifact(artifact: AnyDeveloperWorkflowArtifactEnvelope): AnyDeveloperWorkflowArtifactEnvelope {
  const base = { ...artifact, status: "stale" as const };
  const { fingerprint: _fingerprint, ...withoutFingerprint } = base;
  return {
    ...withoutFingerprint,
    fingerprint: artifactFingerprint(withoutFingerprint as Omit<DeveloperWorkflowArtifactEnvelope, "fingerprint">),
  } as AnyDeveloperWorkflowArtifactEnvelope;
}

export function evaluateDeveloperWorkflowNextStep(run: DeveloperWorkflowRun): DeveloperWorkflowNextStepGate {
  if (run.issues.length) {
    return { complete: false, allowed: false, nextStage: "01", blockingStatus: "stale", reason: "stale" };
  }
  for (const definition of DEVELOPER_WORKFLOW_STAGES) {
    const artifact = run.artifacts[definition.id];
    if (!artifact) return { complete: false, allowed: true, nextStage: definition.id, blockingStatus: null, reason: "ready" };
    if (artifact.status === "pending") return { complete: false, allowed: true, nextStage: definition.id, blockingStatus: null, reason: "pending" };
    if (artifact.status !== "passed") {
      return {
        complete: false,
        allowed: false,
        nextStage: definition.id,
        blockingStatus: artifact.status,
        reason: artifact.status,
      };
    }
  }
  return { complete: true, allowed: false, nextStage: null, blockingStatus: null, reason: "complete" };
}

export function updateDeveloperWorkflowArtifact<S extends DeveloperWorkflowStageId>(
  run: DeveloperWorkflowRun,
  stage: S,
  input: UpdateDeveloperWorkflowArtifactInput<S>,
): DeveloperWorkflowRun {
  const normalizedRun = normalizeDeveloperWorkflowRun(run);
  if (!normalizedRun) throw new Error("invalid developer workflow run");
  if (input.expectedContext && !developerWorkflowExecutionContextMatches(normalizedRun, input.expectedContext)) {
    throw new Error(`developer workflow stage ${stage} context mismatch`);
  }
  const existing = normalizedRun.artifacts[stage];
  const gate = evaluateDeveloperWorkflowNextStep(normalizedRun);
  if (!existing && gate.nextStage !== stage) {
    throw new Error(`developer workflow stage ${stage} is out of order; expected ${gate.nextStage ?? "complete"}`);
  }
  if (input.status === "passed") {
    if (normalizedRun.issues.length) {
      throw new Error(`developer workflow stage ${stage} cannot pass while the run is stale`);
    }
    const stageIndex = DEVELOPER_WORKFLOW_STAGES.findIndex((candidate) => candidate.id === stage);
    const blockingUpstream = DEVELOPER_WORKFLOW_STAGES
      .slice(0, stageIndex)
      .find((candidate) => normalizedRun.artifacts[candidate.id]?.status !== "passed");
    if (blockingUpstream) {
      const blockingStatus = normalizedRun.artifacts[blockingUpstream.id]?.status ?? "missing";
      throw new Error(
        `developer workflow stage ${stage} requires fresh passed stage ${blockingUpstream.id}; found ${blockingStatus}`,
      );
    }
  }
  const definition = stageDefinition(stage);
  const recordedAt = normalizeTimestamp(input.recordedAt, new Date().toISOString());
  const artifactBase = {
    schemaVersion: DEVELOPER_WORKFLOW_RUN_SCHEMA_VERSION,
    stage,
    appId: definition.appId,
    artifactKind: definition.artifactKind,
    scope: normalizedRun.scope,
    scopeIdentity: normalizedRun.scopeIdentity,
    targetManifestFingerprint: normalizedRun.targetManifestFingerprint,
    sourceFingerprint: normalizedRun.sourceFingerprint,
    contractVersion: normalizedRun.contractVersion,
    status: input.status,
    recordedAt,
    payload: normalizeArtifactPayload(stage, input.payload),
    artifactRefs: [...new Set((input.artifactRefs || []).map((value) => cleanString(value)).filter(Boolean))].sort(),
    message: cleanString(input.message) || null,
  } as unknown as Omit<DeveloperWorkflowArtifactEnvelope<S>, "fingerprint">;
  const artifact: DeveloperWorkflowArtifactEnvelope<S> = {
    ...artifactBase,
    fingerprint: artifactFingerprint(artifactBase as Omit<DeveloperWorkflowArtifactEnvelope, "fingerprint">),
  };
  const artifacts: DeveloperWorkflowArtifactMap = { ...normalizedRun.artifacts, [stage]: artifact };

  if (!existing || semanticArtifactFingerprint(existing) !== semanticArtifactFingerprint(artifact)) {
    const changedIndex = DEVELOPER_WORKFLOW_STAGES.findIndex((candidate) => candidate.id === stage);
    for (const downstream of DEVELOPER_WORKFLOW_STAGES.slice(changedIndex + 1)) {
      const downstreamArtifact = artifacts[downstream.id];
      if (downstreamArtifact) artifacts[downstream.id] = staleArtifact(downstreamArtifact) as never;
    }
  }

  const status = deriveRunStatus(artifacts, normalizedRun.issues);
  const { fingerprint: _fingerprint, ...withoutFingerprint } = normalizedRun;
  return withRunFingerprint({
    ...withoutFingerprint,
    status,
    artifacts,
    updatedAt: recordedAt,
  });
}

function isGitHubPrEvidenceReference(value: string) {
  const reference = value.trim().toLowerCase();
  return reference.startsWith("github-pr-evidence:")
    || reference.startsWith("github-pr:")
    || /^https?:\/\/(?:api\.)?github\.com\//u.test(reference);
}

/**
 * Fails a previously passed release stage closed once its live GitHub PR evidence expires.
 *
 * `now` is supplied by the caller so this transition stays deterministic and can be
 * supervised outside the 06 workbench lifecycle. A still-valid or non-passed run is
 * returned by identity, allowing callers to avoid redundant storage and React updates.
 */
export function downgradeExpiredDeveloperWorkflowReleaseEvidence(
  run: DeveloperWorkflowRun,
  now: number | Date,
): DeveloperWorkflowRun {
  const release = run.artifacts["06"];
  if (release?.status !== "passed") return run;

  const nowMs = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(nowMs)) {
    throw new RangeError("developer workflow release evidence check requires a valid current time");
  }
  const expiresAt = cleanString(release.payload.verificationExpiresAt);
  const expiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  if (Number.isFinite(expiresAtMs) && expiresAtMs > nowMs) return run;

  const payloadArtifactRefs = Array.isArray(release.payload.artifactRefs)
    ? release.payload.artifactRefs.filter((value): value is string => (
      typeof value === "string" && !isGitHubPrEvidenceReference(value)
    ))
    : [];
  const artifactRefs = release.artifactRefs.filter((value) => !isGitHubPrEvidenceReference(value));

  return updateDeveloperWorkflowArtifact(run, "06", {
    status: "pending",
    payload: {
      ...release.payload,
      githubPr: null,
      githubHeadSha: null,
      githubChecks: [],
      githubReviewDecision: null,
      prEvidenceFingerprint: null,
      verificationExpiresAt: null,
      artifactRefs: payloadArtifactRefs,
      passedGateIds: [],
      pendingGateIds: ["github-pr"],
      blockedGateIds: [],
      gateResults: [],
    },
    artifactRefs,
    message: "GitHub PR 在线校验证据已到期，请回到 06 质量与发布中心重新验证。",
    recordedAt: new Date(nowMs).toISOString(),
  });
}

export function rebaseDeveloperWorkflowTargets(
  run: DeveloperWorkflowRun,
  targets: readonly (DeveloperWorkflowTarget | string)[],
  updatedAt = new Date().toISOString(),
) {
  const normalizedRun = normalizeDeveloperWorkflowRun(run);
  if (!normalizedRun) throw new Error("invalid developer workflow run");
  const normalizedTargets = normalizeDeveloperWorkflowTargets(targets);
  const targetManifestFingerprint = fingerprintDeveloperWorkflowTargetManifest(normalizedTargets);
  if (targetManifestFingerprint === normalizedRun.targetManifestFingerprint) return normalizedRun;
  const artifacts: DeveloperWorkflowArtifactMap = {};
  for (const definition of DEVELOPER_WORKFLOW_STAGES) {
    const artifact = normalizedRun.artifacts[definition.id];
    if (!artifact) continue;
    const rebound = {
      ...artifact,
      targetManifestFingerprint,
      status: "stale" as const,
      recordedAt: normalizeTimestamp(updatedAt, new Date().toISOString()),
    };
    const { fingerprint: _fingerprint, ...withoutFingerprint } = rebound;
    artifacts[definition.id] = {
      ...withoutFingerprint,
      fingerprint: artifactFingerprint(withoutFingerprint as Omit<DeveloperWorkflowArtifactEnvelope, "fingerprint">),
    } as never;
  }
  const { fingerprint: _fingerprint, ...withoutFingerprint } = normalizedRun;
  const timestamp = normalizeTimestamp(updatedAt, new Date().toISOString());
  return withRunFingerprint({
    ...withoutFingerprint,
    targets: normalizedTargets,
    targetManifestFingerprint,
    status: deriveRunStatus(artifacts),
    artifacts,
    issues: [],
    updatedAt: timestamp,
  });
}

function normalizeArtifact<S extends DeveloperWorkflowStageId>(
  value: unknown,
  definition: DeveloperWorkflowStageDefinition<S>,
  run: Pick<DeveloperWorkflowRun, "scope" | "scopeIdentity" | "targetManifestFingerprint" | "sourceFingerprint" | "contractVersion" | "createdAt">,
  issues: string[],
): DeveloperWorkflowArtifactEnvelope<S> | null {
  if (!isRecord(value) || !isRecord(value.payload)) return null;
  const recordedAt = normalizeTimestamp(value.recordedAt, run.createdAt);
  const rawStatus = WORKFLOW_STATUS_VALUES.has(value.status as DeveloperWorkflowStatus)
    ? value.status as DeveloperWorkflowStatus
    : "stale";
  const artifactRefs = Array.isArray(value.artifactRefs)
    ? [...new Set(value.artifactRefs.map((item) => cleanString(item)).filter(Boolean))].sort()
    : [];
  const metadataMatches = value.schemaVersion === DEVELOPER_WORKFLOW_RUN_SCHEMA_VERSION
    && value.stage === definition.id
    && value.appId === definition.appId
    && value.artifactKind === definition.artifactKind
    && value.scope === run.scope
    && value.scopeIdentity === run.scopeIdentity
    && value.targetManifestFingerprint === run.targetManifestFingerprint
    && value.sourceFingerprint === run.sourceFingerprint
    && value.contractVersion === run.contractVersion;
  const artifactBase = {
    schemaVersion: DEVELOPER_WORKFLOW_RUN_SCHEMA_VERSION,
    stage: definition.id,
    appId: definition.appId,
    artifactKind: definition.artifactKind,
    scope: run.scope,
    scopeIdentity: run.scopeIdentity,
    targetManifestFingerprint: run.targetManifestFingerprint,
    sourceFingerprint: run.sourceFingerprint,
    contractVersion: run.contractVersion,
    status: rawStatus,
    recordedAt,
    payload: canonicalize(value.payload) as DeveloperWorkflowArtifactPayloadByStage[S],
    artifactRefs,
    message: cleanString(value.message) || null,
  } as unknown as Omit<DeveloperWorkflowArtifactEnvelope<S>, "fingerprint">;
  const expectedFingerprint = artifactFingerprint(artifactBase as Omit<DeveloperWorkflowArtifactEnvelope, "fingerprint">);
  const integrityMatches = metadataMatches && value.fingerprint === expectedFingerprint;
  if (!integrityMatches) issues.push(`artifact-${definition.id}-fingerprint-mismatch`);
  const normalizedBase = integrityMatches ? artifactBase : { ...artifactBase, status: "stale" as const };
  return {
    ...normalizedBase,
    fingerprint: artifactFingerprint(normalizedBase as Omit<DeveloperWorkflowArtifactEnvelope, "fingerprint">),
  } as DeveloperWorkflowArtifactEnvelope<S>;
}

export function normalizeDeveloperWorkflowRun(
  value: unknown,
  options: NormalizeDeveloperWorkflowRunOptions = {},
): DeveloperWorkflowRun | null {
  if (!isRecord(value) || value.schemaVersion !== DEVELOPER_WORKFLOW_RUN_SCHEMA_VERSION) return null;
  const scope: DeveloperWorkflowScope | null = value.scope === "global" || value.scope === "page" ? value.scope : null;
  const sourceScope = cleanString(value.sourceScope);
  const contractVersion = cleanString(value.contractVersion);
  const sourceFingerprint = cleanString(value.sourceFingerprint);
  const createdAt = normalizeTimestamp(value.createdAt, "1970-01-01T00:00:00.000Z");
  const updatedAt = normalizeTimestamp(value.updatedAt, createdAt);
  if (!scope || !sourceScope || !contractVersion || !sourceFingerprint || !Array.isArray(value.targets)) return null;
  const normalizedRoute = scope === "page" ? normalizeRoute(value.normalizedRoute) : null;
  if (scope === "page" && !normalizedRoute) return null;
  const scopeIdentity = buildDeveloperWorkflowScopeIdentity({ scope, sourceScope, normalizedRoute });
  const targets = normalizeDeveloperWorkflowTargets(value.targets as (DeveloperWorkflowTarget | string)[]);
  const targetManifestFingerprint = fingerprintDeveloperWorkflowTargetManifest(targets);
  const issues: string[] = [];
  if (value.scopeIdentity !== scopeIdentity) issues.push("scope-identity-mismatch");
  if (value.targetManifestFingerprint !== targetManifestFingerprint) issues.push("target-manifest-fingerprint-mismatch");
  if (options.expectedContractVersion && options.expectedContractVersion !== contractVersion) issues.push("contract-version-stale");
  if (options.expectedSourceFingerprint && options.expectedSourceFingerprint !== sourceFingerprint) issues.push("source-fingerprint-stale");
  if (options.expectedTargetManifestFingerprint && options.expectedTargetManifestFingerprint !== targetManifestFingerprint) issues.push("target-manifest-stale");
  const storedIssues = Array.isArray(value.issues) ? value.issues.map((item) => cleanString(item)).filter(Boolean) : [];
  issues.push(...storedIssues);

  const artifactValues = isRecord(value.artifacts) ? value.artifacts : {};
  const artifacts: DeveloperWorkflowArtifactMap = {};
  const runContext = { scope, scopeIdentity, targetManifestFingerprint, sourceFingerprint, contractVersion, createdAt };
  for (const definition of DEVELOPER_WORKFLOW_STAGES) {
    const artifact = normalizeArtifact(artifactValues[definition.id], definition, runContext, issues);
    if (artifact) artifacts[definition.id] = artifact as never;
  }

  const normalizedIssues = [...new Set(issues)].sort();
  const id = cleanString(value.id);
  if (!id) return null;
  const runBase: Omit<DeveloperWorkflowRun, "fingerprint"> = {
    schemaVersion: DEVELOPER_WORKFLOW_RUN_SCHEMA_VERSION,
    id,
    scope,
    scopeIdentity,
    sourceScope,
    normalizedRoute,
    contractVersion,
    sourceFingerprint,
    targets,
    targetManifestFingerprint,
    status: deriveRunStatus(artifacts, normalizedIssues),
    artifacts,
    issues: normalizedIssues,
    createdAt,
    updatedAt,
  };
  const expectedRunFingerprint = runFingerprint({
    ...runBase,
    status: WORKFLOW_STATUS_VALUES.has(value.status as DeveloperWorkflowStatus)
      ? value.status as DeveloperWorkflowStatus
      : runBase.status,
    issues: storedIssues,
  });
  if (value.fingerprint !== expectedRunFingerprint) {
    runBase.issues = [...new Set([...runBase.issues, "run-fingerprint-mismatch"])].sort();
    runBase.status = "stale";
  }
  return withRunFingerprint(runBase);
}

function resolveStorage(storage?: DeveloperWorkflowStorage | null) {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function buildDeveloperWorkflowRunStorageKey(scopeIdentity: string) {
  const identity = cleanString(scopeIdentity);
  if (!identity) throw new Error("developer workflow scope identity is required");
  return `${DEVELOPER_WORKFLOW_RUN_STORAGE_PREFIX}:${encodeURIComponent(identity)}`;
}

export function saveDeveloperWorkflowRun(run: DeveloperWorkflowRun, storage?: DeveloperWorkflowStorage | null) {
  const target = resolveStorage(storage);
  if (!target) return false;
  const normalized = normalizeDeveloperWorkflowRun(run);
  if (!normalized) return false;
  try {
    target.setItem(buildDeveloperWorkflowRunStorageKey(normalized.scopeIdentity), JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function loadDeveloperWorkflowRun(
  scopeIdentity: string,
  storage?: DeveloperWorkflowStorage | null,
  options: NormalizeDeveloperWorkflowRunOptions = {},
) {
  const target = resolveStorage(storage);
  if (!target) return null;
  try {
    const raw = target.getItem(buildDeveloperWorkflowRunStorageKey(scopeIdentity));
    if (!raw) return null;
    const run = normalizeDeveloperWorkflowRun(JSON.parse(raw), options);
    return run?.scopeIdentity === scopeIdentity ? run : null;
  } catch {
    return null;
  }
}

export function removeDeveloperWorkflowRun(scopeIdentity: string, storage?: DeveloperWorkflowStorage | null) {
  const target = resolveStorage(storage);
  if (!target) return false;
  try {
    target.removeItem(buildDeveloperWorkflowRunStorageKey(scopeIdentity));
    return true;
  } catch {
    return false;
  }
}
