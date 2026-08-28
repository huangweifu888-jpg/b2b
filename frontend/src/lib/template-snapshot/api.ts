import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";
import type { DeveloperGlobalFrameSection } from "@/lib/developer-global-frame-draft";
import type {
  BackupCreateRequest,
  DeveloperGlobalFrameAcceptanceArtifact,
  DeveloperGlobalFrameAcceptanceJob,
  DeveloperGlobalFramePreflightEvidence,
  DeveloperGlobalFramePreflightEvidenceInput,
  DiffResponse,
  InstanceDetachRequest,
  InstanceUpsertRequest,
  InstanceRebindTemplateRequest,
  InstanceResponse,
  InstanceRestoreTemplateRequest,
  InstanceSyncLatestRequest,
  TemplateCreateRequest,
  TemplatePublishRequest,
  TemplateUpsertRequest,
  TemplateVersionResponse,
  TemplateDraftResponse,
  ProductMarketFactoryDefaultResponse,
  LegacySnapshotMapping,
  UnmappedSnapshotResource,
} from "./types";

const TEMPLATE_SNAPSHOT_BASE = "/api/template-snapshot";

export class TemplateSnapshotRequestError extends Error {
  readonly status: number;

  constructor(status: number, detail?: string) {
    super(detail ? `Template snapshot request failed: ${status} · ${detail}` : `Template snapshot request failed: ${status}`);
    this.name = "TemplateSnapshotRequestError";
    this.status = status;
  }
}

function mapTemplateVersionResponse(item: Record<string, unknown>): TemplateVersionResponse {
  const releaseSections = item.release_sections ?? item.releaseSections;
  return {
    templateId: String(item.template_id ?? item.templateId ?? ""),
    version: String(item.version ?? ""),
    changelog: typeof item.changelog === "string" ? item.changelog : null,
    configJson: ((item.config_json ?? item.configJson) && typeof (item.config_json ?? item.configJson) === "object"
      ? (item.config_json ?? item.configJson)
      : {}) as Record<string, unknown>,
    releaseSections: Array.isArray(releaseSections)
      && releaseSections.length === 1
      && releaseSections[0] === "developer_global_frame"
      ? ["developer_global_frame"]
      : null,
    preflightEvidenceId: typeof (item.preflight_evidence_id ?? item.preflightEvidenceId) === "string"
      ? String(item.preflight_evidence_id ?? item.preflightEvidenceId)
      : null,
    reviewStatus: typeof (item.review_status ?? item.reviewStatus) === "string"
      ? String(item.review_status ?? item.reviewStatus)
      : "unknown",
    reviewNote: typeof (item.review_note ?? item.reviewNote) === "string"
      ? String(item.review_note ?? item.reviewNote)
      : null,
    reviewStep: typeof (item.review_step ?? item.reviewStep) === "number"
      ? Number(item.review_step ?? item.reviewStep)
      : 0,
    requiredReviewSteps: typeof (item.required_review_steps ?? item.requiredReviewSteps) === "number"
      ? Number(item.required_review_steps ?? item.requiredReviewSteps)
      : 1,
    reviewAssignee: typeof (item.review_assignee ?? item.reviewAssignee) === "string"
      ? String(item.review_assignee ?? item.reviewAssignee)
      : null,
    reviewDueAt: typeof (item.review_due_at ?? item.reviewDueAt) === "string"
      ? String(item.review_due_at ?? item.reviewDueAt)
      : null,
    approvedBy: typeof (item.approved_by ?? item.approvedBy) === "string"
      ? String(item.approved_by ?? item.approvedBy)
      : null,
    approvedAt: typeof (item.approved_at ?? item.approvedAt) === "string"
      ? String(item.approved_at ?? item.approvedAt)
      : null,
    publishedAt: typeof (item.published_at ?? item.publishedAt) === "string"
      ? String(item.published_at ?? item.publishedAt)
      : null,
    publishedBy: typeof (item.published_by ?? item.publishedBy) === "string"
      ? String(item.published_by ?? item.publishedBy)
      : null,
  };
}

async function templateRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  let token = authApi.getStoredToken();
  if (!token && await authApi.restoreLocalDemoSession("hq")) token = authApi.getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response = await fetch(`${getAPIBaseURL()}${TEMPLATE_SNAPSHOT_BASE}${path}`, { ...init, headers, cache: "no-store" });
  if (response.status === 401 && await authApi.restoreLocalDemoSession("hq")) {
    token = authApi.getStoredToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    response = await fetch(`${getAPIBaseURL()}${TEMPLATE_SNAPSHOT_BASE}${path}`, { ...init, headers, cache: "no-store" });
  }
  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json() as { detail?: unknown };
      detail = typeof payload.detail === "string" ? payload.detail : "";
    } catch {
      // Status is the stable contract when the error body is not JSON.
    }
    throw new TemplateSnapshotRequestError(response.status, detail);
  }
  return response.json() as Promise<T>;
}

export async function createTemplate(payload: TemplateCreateRequest) {
  return templateRequest("/templates", { method: "POST", body: JSON.stringify({
    template_type: payload.templateType,
    owner_scope: payload.ownerScope,
    owner_id: payload.ownerId,
    organization_id: payload.organizationId,
    project_id: payload.projectId,
    parent_template_id: payload.parentTemplateId,
    name: payload.name,
    config_json: payload.configJson,
  }) });
}

export async function upsertTemplate(templateId: string, payload: TemplateUpsertRequest) {
  return templateRequest(`/templates/${templateId}`, { method: "PUT", body: JSON.stringify({
    template_id: templateId,
    template_type: payload.templateType,
    owner_scope: payload.ownerScope,
    owner_id: payload.ownerId,
    organization_id: payload.organizationId,
    project_id: payload.projectId,
    parent_template_id: payload.parentTemplateId,
    name: payload.name,
    config_json: payload.configJson,
    latest_version: payload.latestVersion ?? null,
    is_published: payload.isPublished ?? false,
  }) });
}

export async function publishTemplate(templateId: string, payload: TemplatePublishRequest) {
  const response = await templateRequest<Record<string, unknown>>(`/templates/${templateId}/publish`, { method: "POST", body: JSON.stringify({
    version: payload.version,
    changelog: payload.changelog,
    published_by: payload.publishedBy,
    requires_approval: payload.requiresApproval ?? false,
    required_review_steps: payload.requiredReviewSteps ?? 1,
    required_sections: payload.requiredSections ?? null,
    expected_draft_config_hash: payload.expectedDraftConfigHash ?? null,
    expected_preflight_artifact_hash: payload.expectedPreflightArtifactHash ?? null,
    review_assignee: payload.reviewAssignee ?? null,
    review_due_at: payload.reviewDueAt ?? null,
  }) });
  return mapTemplateVersionResponse(response);
}

export async function approveTemplateVersion(templateId: string, version: string) {
  const response = await templateRequest<Record<string, unknown>>(
    `/templates/${templateId}/versions/${encodeURIComponent(version)}/approve`,
    { method: "POST" },
  );
  return mapTemplateVersionResponse(response);
}

export async function reviewTemplateVersion(templateId: string, version: string, action: "approve" | "reject", note?: string) {
  const response = await templateRequest<Record<string, unknown>>(`/templates/${templateId}/versions/${encodeURIComponent(version)}/review`, {
    method: "POST", body: JSON.stringify({ action, note: note || null }),
  });
  return mapTemplateVersionResponse(response);
}

export async function getInstance(instanceId: string) {
  return templateRequest(`/instances/${instanceId}`) as Promise<InstanceResponse>;
}

export async function upsertInstance(instanceId: string, payload: InstanceUpsertRequest) {
  return templateRequest(`/instances/${instanceId}`, { method: "PUT", body: JSON.stringify({
    instance_id: instanceId,
    instance_type: payload.instanceType,
    owner_scope: payload.ownerScope,
    owner_id: payload.ownerId,
    organization_id: payload.organizationId,
    project_id: payload.projectId,
    parent_id: payload.parentId,
    name: payload.name,
    base_template_id: payload.baseTemplateId,
    base_template_version: payload.baseTemplateVersion,
    snapshot_config_json: payload.snapshotConfigJson,
    override_config_json: payload.overrideConfigJson ?? {},
    is_detached: payload.isDetached ?? false,
    last_synced_at: payload.lastSyncedAt ?? null,
  }) });
}

export async function diffLatest(instanceId: string) {
  return templateRequest(`/instances/${instanceId}/diff-latest`) as Promise<DiffResponse>;
}

export async function syncLatest(instanceId: string, payload: InstanceSyncLatestRequest) {
  return templateRequest(`/instances/${instanceId}/sync-latest`, { method: "POST", body: JSON.stringify({
    sync_mode: payload.syncMode ?? "merge",
    create_backup: payload.createBackup ?? true,
    operator: payload.operator,
    sections: payload.sections,
  }) });
}

export type TemplateReleaseBatchResponse = {
  id: string;
  template_id: string;
  template_version: string;
  owner_scope: string;
  sections: string[];
  status: string;
  total_targets: number;
  succeeded_targets: number;
  failed_targets: number;
  retry_after_seconds?: number | null;
  targets: Array<{
    instance_id: string;
    organization_id?: number | null;
    project_id?: number | null;
    status: string;
    error_message?: string | null;
  }>;
};

export async function createTemplateReleaseBatch(
  templateId: string,
  instanceIds: string[] | null = null,
  sections?: import("./types").DeveloperGlobalFrameSectionName[],
  expectedTemplateVersion?: string | null,
) {
  return templateRequest<{ batch: TemplateReleaseBatchResponse }>("/release-batches", {
    method: "POST",
    body: JSON.stringify({
      template_id: templateId,
      expected_template_version: expectedTemplateVersion,
      instance_ids: instanceIds,
      sections,
    }),
  });
}

export async function fetchTemplateReleaseBatch(batchId: string) {
  return templateRequest<TemplateReleaseBatchResponse>(`/release-batches/${encodeURIComponent(batchId)}`);
}

export async function retryTemplateReleaseBatch(batchId: string) {
  return templateRequest<{ batch: TemplateReleaseBatchResponse }>(
    `/release-batches/${encodeURIComponent(batchId)}/retry`,
    { method: "POST" },
  );
}

export async function resumeTemplateReleaseBatch(batchId: string) {
  return templateRequest<{ batch: TemplateReleaseBatchResponse }>(
    `/release-batches/${encodeURIComponent(batchId)}/resume`,
    { method: "POST" },
  );
}

export async function promoteProductMarketFactoryDefault(
  templateId: string,
  releaseBatchId: string,
  contractVersion: string,
) {
  return templateRequest<ProductMarketFactoryDefaultResponse>(
    `/templates/${encodeURIComponent(templateId)}/product-market/factory-default`,
    {
      method: "POST",
      body: JSON.stringify({
        release_batch_id: releaseBatchId,
        contract_version: contractVersion,
      }),
    },
  );
}

export async function fetchProductMarketFactoryDefault(templateId: string) {
  return templateRequest<ProductMarketFactoryDefaultResponse>(
    `/templates/${encodeURIComponent(templateId)}/product-market/factory-default`,
  );
}

/**
 * Queue only the reviewed appearance profile. The backend pins the immutable
 * template version, creates per-instance backups, and preserves every peer
 * business/content section.
 */
export async function createDeveloperGlobalFrameReleaseBatch(
  templateId: string,
  instanceIds: string[] | null = null,
) {
  return createTemplateReleaseBatch(templateId, instanceIds, ["developer_global_frame"]);
}

export async function restoreTemplate(instanceId: string, payload: InstanceRestoreTemplateRequest) {
  return templateRequest(`/instances/${instanceId}/restore-template`, { method: "POST", body: JSON.stringify({
    target: payload.target ?? "all",
    template_version: payload.templateVersion ?? null,
    create_backup: payload.createBackup ?? true,
    operator: payload.operator,
  }) });
}

export async function detachInstance(instanceId: string, payload: InstanceDetachRequest) {
  return templateRequest(`/instances/${instanceId}/detach`, { method: "POST", body: JSON.stringify({
    operator: payload.operator,
  }) });
}

export async function rebindTemplate(instanceId: string, payload: InstanceRebindTemplateRequest) {
  return templateRequest(`/instances/${instanceId}/rebind-template`, { method: "POST", body: JSON.stringify({
    template_id: payload.templateId,
    template_version: payload.templateVersion,
    operator: payload.operator,
  }) });
}

export async function createBackup(payload: BackupCreateRequest) {
  return templateRequest("/backups", { method: "POST", body: JSON.stringify({
    target_type: payload.targetType,
    target_id: payload.targetId,
    version: payload.version,
    backup_kind: payload.backupKind,
    created_by: payload.createdBy,
  }) });
}

export async function listBackups() {
  const response = await templateRequest<{ items: Array<Record<string, unknown>> }>("/backups");
  return response.items;
}

export async function recordBackupRestoreDrill(backupId: string, result: "passed" | "failed", note?: string) {
  return templateRequest(`/backups/${encodeURIComponent(backupId)}/restore-drill`, {
    method: "POST", body: JSON.stringify({ result, note: note || null }),
  });
}

export async function listLegacyMappings() {
  const response = await templateRequest<{ items: Array<Record<string, unknown>> }>("/legacy-mappings");
  return response.items.map((item): LegacySnapshotMapping => ({
    ownerScope: String(item.owner_scope || ""),
    legacyOwnerId: String(item.legacy_owner_id || ""),
    organizationId: typeof item.organization_id === "number" ? item.organization_id : null,
    projectId: typeof item.project_id === "number" ? item.project_id : null,
    createdAt: typeof item.created_at === "string" ? item.created_at : null,
  }));
}

export async function listLegacyUnmapped() {
  const response = await templateRequest<{ items: Array<Record<string, unknown>> }>("/legacy-unmapped");
  return response.items.map((item): UnmappedSnapshotResource => ({
    resourceType: item.resource_type === "instance" ? "instance" : "template",
    resourceId: String(item.resource_id || ""),
    ownerScope: String(item.owner_scope || ""),
    ownerId: typeof item.owner_id === "string" ? item.owner_id : null,
    name: String(item.name || ""),
    createdAt: typeof item.created_at === "string" ? item.created_at : null,
  }));
}

export async function upsertLegacyMapping(payload: {
  ownerScope: string;
  legacyOwnerId: string;
  organizationId?: number | null;
  projectId?: number | null;
}) {
  return templateRequest("/legacy-mappings", {
    method: "POST",
    body: JSON.stringify({
      owner_scope: payload.ownerScope,
      legacy_owner_id: payload.legacyOwnerId,
      organization_id: payload.organizationId ?? null,
      project_id: payload.projectId ?? null,
    }),
  });
}

export async function bindLegacyUnmapped(payload: {
  resourceType: "template" | "instance";
  resourceId: string;
  organizationId?: number | null;
  projectId?: number | null;
}) {
  return templateRequest(`/legacy-unmapped/${payload.resourceType}/${encodeURIComponent(payload.resourceId)}/bind`, {
    method: "POST",
    body: JSON.stringify({
      organization_id: payload.organizationId ?? null,
      project_id: payload.projectId ?? null,
    }),
  });
}

const templateFetchInFlight = new Map<string, Promise<TemplateDraftResponse>>();

export async function fetchTemplate(templateId: string) {
  const existing = templateFetchInFlight.get(templateId);
  if (existing) return existing;
  const request = templateRequest<TemplateDraftResponse>(`/templates/${templateId}`);
  templateFetchInFlight.set(templateId, request);
  try {
    return await request;
  } finally {
    if (templateFetchInFlight.get(templateId) === request) {
      templateFetchInFlight.delete(templateId);
    }
  }
}

export type DeveloperGlobalFrameDraftMergeResponse = {
  template_id: string;
  owner_scope: string;
  base_template_version: string | null;
  draft_config_hash: string;
  developer_global_frame: DeveloperGlobalFrameSection;
  preserved_sibling_keys: string[];
  write_scope: "draft-only";
  publish_performed: false;
  batch_created: false;
  preflight_evidence?: DeveloperGlobalFramePreflightEvidenceWire | null;
};

type DeveloperGlobalFramePreflightEvidenceWire = {
  evidence_id: string;
  template_id: string;
  source_scope: string;
  base_draft_hash: string;
  saved_draft_hash: string;
  artifact_hash: string;
  acceptance_artifact_id: string;
  acceptance_artifact_hash: string;
  visual_draft_id: string;
  compatible_target_page_ids: string[];
  isolated_page_ids: string[];
  recovery_point_id: string;
  checked_at: string;
  evidence_hash: string;
  valid: true;
  created_at?: string | null;
};

type DeveloperGlobalFrameAcceptanceArtifactWire = {
  acceptance_artifact_id: string;
  schema_version: 1;
  run_id: string;
  issuer: string;
  key_id: string;
  template_id: string;
  source_scope: string;
  acceptance_job_id: string;
  base_draft_hash: string;
  frame_section_hash: string;
  visual_draft_id: string;
  recovery_point_id: string;
  page_registry_hash: string;
  adapter_registry_hash: string;
  isolation_policy_hash: string;
  test_spec_hash: string;
  source_build_digest: string;
  issued_at: string;
  expires_at: string;
  viewports: [1440, 1024, 390];
  compatible_target_page_ids: string[];
  isolated_page_ids: string[];
  case_results: Array<{
    page_id: string;
    source_scope: "hq" | "agency_source" | "client_source";
    viewport: 1440 | 1024 | 390;
    outcome: "passed" | "isolated";
  }>;
  failure_count: 0;
  flaky_count: 0;
  skipped_count: 0;
  report_hash: string;
  signature: string;
  valid: true;
  created_at?: string | null;
};

type DeveloperGlobalFrameAcceptanceJobWire = {
  acceptance_job_id: string;
  schema_version: 1;
  template_id: string;
  source_scope: "client_source";
  base_draft_hash: string;
  frame_section_hash: string;
  visual_draft_id: string;
  recovery_point_id: string;
  developer_global_frame: Record<string, unknown>;
  page_registry_hash: string;
  adapter_registry_hash: string;
  isolation_policy_hash: string;
  test_spec_hash: string;
  source_build_digest: string;
  status: "pending" | "running" | "succeeded" | "failed" | "expired";
  attempt_count: number;
  max_attempts: number;
  worker_issuer?: string | null;
  worker_key_id?: string | null;
  claimed_at?: string | null;
  lease_expires_at?: string | null;
  acceptance_artifact_id?: string | null;
  report_hash?: string | null;
  last_error_code?: string | null;
  last_error_message?: string | null;
  expires_at: string;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type DeveloperGlobalFrameFactoryDefaultReceiptInput = {
  schemaVersion: 1;
  templateId: string;
  publishedVersion: string;
  artifactHash: string;
  draftHash: string;
  preflightEvidenceHash: string;
  compatibleTargetPageIds: readonly string[];
  isolatedPageIds: readonly string[];
  recoveryPointId: string;
  rolloutBatchId: string;
  recordedAt: string;
  receiptHash: string;
};

export type DeveloperGlobalFrameFactoryDefaultReceipt = {
  receiptId: string;
  schemaVersion: 1;
  templateId: string;
  sourceScope: string;
  rolloutOwnerScope: string;
  publishedVersion: string;
  preflightEvidenceId: string;
  artifactHash: string;
  draftHash: string;
  preflightEvidenceHash: string;
  compatibleTargetPageIds: string[];
  isolatedPageIds: string[];
  recoveryPointId: string;
  rolloutBatchId: string;
  recordedAt: string;
  receiptHash: string;
  recordedBy: string | null;
  createdAt: string | null;
  valid: true;
};

type DeveloperGlobalFrameFactoryDefaultReceiptWire = {
  receipt_id: string;
  schema_version: 1;
  template_id: string;
  source_scope: string;
  rollout_owner_scope: string;
  published_version: string;
  preflight_evidence_id: string;
  artifact_hash: string;
  draft_hash: string;
  preflight_evidence_hash: string;
  compatible_target_page_ids: string[];
  isolated_page_ids: string[];
  recovery_point_id: string;
  rollout_batch_id: string;
  recorded_at: string;
  receipt_hash: string;
  recorded_by?: string | null;
  created_at?: string | null;
  valid: true;
};

function mapDeveloperGlobalFramePreflightEvidence(
  evidence: DeveloperGlobalFramePreflightEvidenceWire,
): DeveloperGlobalFramePreflightEvidence {
  return {
    evidenceId: evidence.evidence_id,
    templateId: evidence.template_id,
    sourceScope: evidence.source_scope,
    baseDraftHash: evidence.base_draft_hash,
    savedDraftHash: evidence.saved_draft_hash,
    artifactHash: evidence.artifact_hash,
    acceptanceArtifactId: evidence.acceptance_artifact_id,
    acceptanceArtifactHash: evidence.acceptance_artifact_hash,
    visualDraftId: evidence.visual_draft_id,
    compatibleTargetPageIds: [...evidence.compatible_target_page_ids],
    isolatedPageIds: [...evidence.isolated_page_ids],
    recoveryPointId: evidence.recovery_point_id,
    checkedAt: evidence.checked_at,
    evidenceHash: evidence.evidence_hash,
    valid: true,
    createdAt: evidence.created_at ?? null,
  };
}

function mapDeveloperGlobalFrameAcceptanceArtifact(
  artifact: DeveloperGlobalFrameAcceptanceArtifactWire,
): DeveloperGlobalFrameAcceptanceArtifact {
  return {
    acceptanceArtifactId: artifact.acceptance_artifact_id,
    schemaVersion: artifact.schema_version,
    runId: artifact.run_id,
    issuer: artifact.issuer,
    keyId: artifact.key_id,
    templateId: artifact.template_id,
    sourceScope: artifact.source_scope,
    acceptanceJobId: artifact.acceptance_job_id,
    baseDraftHash: artifact.base_draft_hash,
    frameSectionHash: artifact.frame_section_hash,
    visualDraftId: artifact.visual_draft_id,
    recoveryPointId: artifact.recovery_point_id,
    pageRegistryHash: artifact.page_registry_hash,
    adapterRegistryHash: artifact.adapter_registry_hash,
    isolationPolicyHash: artifact.isolation_policy_hash,
    testSpecHash: artifact.test_spec_hash,
    sourceBuildDigest: artifact.source_build_digest,
    issuedAt: artifact.issued_at,
    expiresAt: artifact.expires_at,
    viewports: artifact.viewports,
    compatibleTargetPageIds: [...artifact.compatible_target_page_ids],
    isolatedPageIds: [...artifact.isolated_page_ids],
    caseResults: artifact.case_results.map((item) => ({
      pageId: item.page_id,
      sourceScope: item.source_scope,
      viewport: item.viewport,
      outcome: item.outcome,
    })),
    failureCount: artifact.failure_count,
    flakyCount: artifact.flaky_count,
    skippedCount: artifact.skipped_count,
    reportHash: artifact.report_hash,
    signature: artifact.signature,
    valid: true,
    createdAt: artifact.created_at ?? null,
  };
}

function mapDeveloperGlobalFrameAcceptanceJob(
  job: DeveloperGlobalFrameAcceptanceJobWire,
): DeveloperGlobalFrameAcceptanceJob {
  return {
    acceptanceJobId: job.acceptance_job_id,
    schemaVersion: job.schema_version,
    templateId: job.template_id,
    sourceScope: job.source_scope,
    baseDraftHash: job.base_draft_hash,
    frameSectionHash: job.frame_section_hash,
    visualDraftId: job.visual_draft_id,
    recoveryPointId: job.recovery_point_id,
    developerGlobalFrame: job.developer_global_frame,
    pageRegistryHash: job.page_registry_hash,
    adapterRegistryHash: job.adapter_registry_hash,
    isolationPolicyHash: job.isolation_policy_hash,
    testSpecHash: job.test_spec_hash,
    sourceBuildDigest: job.source_build_digest,
    status: job.status,
    attemptCount: job.attempt_count,
    maxAttempts: job.max_attempts,
    workerIssuer: job.worker_issuer ?? null,
    workerKeyId: job.worker_key_id ?? null,
    claimedAt: job.claimed_at ?? null,
    leaseExpiresAt: job.lease_expires_at ?? null,
    acceptanceArtifactId: job.acceptance_artifact_id ?? null,
    reportHash: job.report_hash ?? null,
    lastErrorCode: job.last_error_code ?? null,
    lastErrorMessage: job.last_error_message ?? null,
    expiresAt: job.expires_at,
    completedAt: job.completed_at ?? null,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}

function mapDeveloperGlobalFrameFactoryDefaultReceipt(
  receipt: DeveloperGlobalFrameFactoryDefaultReceiptWire,
): DeveloperGlobalFrameFactoryDefaultReceipt {
  return {
    receiptId: receipt.receipt_id,
    schemaVersion: receipt.schema_version,
    templateId: receipt.template_id,
    sourceScope: receipt.source_scope,
    rolloutOwnerScope: receipt.rollout_owner_scope,
    publishedVersion: receipt.published_version,
    preflightEvidenceId: receipt.preflight_evidence_id,
    artifactHash: receipt.artifact_hash,
    draftHash: receipt.draft_hash,
    preflightEvidenceHash: receipt.preflight_evidence_hash,
    compatibleTargetPageIds: [...receipt.compatible_target_page_ids],
    isolatedPageIds: [...receipt.isolated_page_ids],
    recoveryPointId: receipt.recovery_point_id,
    rolloutBatchId: receipt.rollout_batch_id,
    recordedAt: receipt.recorded_at,
    receiptHash: receipt.receipt_hash,
    recordedBy: receipt.recorded_by ?? null,
    createdAt: receipt.created_at ?? null,
    valid: true,
  };
}

/** Atomic, optimistic section merge. This saves a source draft only. */
export async function mergeDeveloperGlobalFrameDraft(
  templateId: string,
  baseDraftHash: string,
  section: DeveloperGlobalFrameSection,
) {
  return templateRequest<DeveloperGlobalFrameDraftMergeResponse>(
    `/templates/${encodeURIComponent(templateId)}/sections/developer-global-frame`,
    {
      method: "PATCH",
      body: JSON.stringify({
        base_draft_hash: baseDraftHash,
        developer_global_frame: section,
      }),
    },
  );
}

/**
 * Atomically merge the appearance section and seal its exact preflight target
 * disposition in the server database. There is no merge/evidence race window.
 */
export async function mergeDeveloperGlobalFrameDraftWithPreflightEvidence(
  templateId: string,
  baseDraftHash: string,
  section: DeveloperGlobalFrameSection,
  evidence: DeveloperGlobalFramePreflightEvidenceInput,
) {
  const result = await templateRequest<DeveloperGlobalFrameDraftMergeResponse>(
    `/templates/${encodeURIComponent(templateId)}/sections/developer-global-frame`,
    {
      method: "PATCH",
      body: JSON.stringify({
        base_draft_hash: baseDraftHash,
        developer_global_frame: section,
        preflight_evidence: {
          artifact_hash: evidence.artifactHash,
          acceptance_artifact_id: evidence.acceptanceArtifactId,
          acceptance_artifact_hash: evidence.acceptanceArtifactHash,
          visual_draft_id: evidence.visualDraftId,
          compatible_target_page_ids: evidence.compatibleTargetPageIds,
          isolated_page_ids: evidence.isolatedPageIds,
          recovery_point_id: evidence.recoveryPointId,
          checked_at: evidence.checkedAt,
        },
      }),
    },
  );
  if (!result.preflight_evidence) {
    throw new Error("Server did not return durable developer global frame preflight evidence");
  }
  const durablePreflightEvidence = mapDeveloperGlobalFramePreflightEvidence(result.preflight_evidence);
  return {
    savedDraftHash: result.draft_config_hash,
    acceptedArtifactHash: durablePreflightEvidence.artifactHash,
    section: result.developer_global_frame,
    preservedSiblingKeys: [...result.preserved_sibling_keys],
    durablePreflightEvidence,
  };
}

/**
 * Read a server-verified acceptance attestation for the exact frozen candidate.
 * Browsers cannot upload or sign acceptance artifacts through this boundary.
 */
export async function fetchDeveloperGlobalFrameAcceptanceArtifact(
  templateId: string,
  query: {
    baseDraftHash: string;
    frameSectionHash: string;
    visualDraftId: string;
    recoveryPointId: string;
  },
) {
  const params = new URLSearchParams({
    base_draft_hash: query.baseDraftHash,
    frame_section_hash: query.frameSectionHash,
    visual_draft_id: query.visualDraftId,
    recovery_point_id: query.recoveryPointId,
  });
  const result = await templateRequest<DeveloperGlobalFrameAcceptanceArtifactWire>(
    `/templates/${encodeURIComponent(templateId)}/sections/developer-global-frame/acceptance-artifacts/latest?${params.toString()}`,
  );
  return mapDeveloperGlobalFrameAcceptanceArtifact(result);
}

/**
 * Queue the exact frozen candidate for a trusted out-of-browser 603-case run.
 * The server is idempotent for an identical active binding and recomputes all
 * security-sensitive hashes instead of trusting browser-provided deployment data.
 */
export async function createDeveloperGlobalFrameAcceptanceJob(
  templateId: string,
  payload: {
    baseDraftHash: string;
    frameSectionHash: string;
    visualDraftId: string;
    recoveryPointId: string;
    developerGlobalFrame: DeveloperGlobalFrameSection;
  },
) {
  const result = await templateRequest<DeveloperGlobalFrameAcceptanceJobWire>(
    `/templates/${encodeURIComponent(templateId)}/sections/developer-global-frame/acceptance-jobs`,
    {
      method: "POST",
      body: JSON.stringify({
        base_draft_hash: payload.baseDraftHash,
        frame_section_hash: payload.frameSectionHash,
        visual_draft_id: payload.visualDraftId,
        recovery_point_id: payload.recoveryPointId,
        developer_global_frame: payload.developerGlobalFrame,
      }),
    },
  );
  return mapDeveloperGlobalFrameAcceptanceJob(result);
}

/** Read one durable acceptance job owned by the authenticated requester. */
export async function fetchDeveloperGlobalFrameAcceptanceJob(
  templateId: string,
  acceptanceJobId: string,
) {
  const result = await templateRequest<DeveloperGlobalFrameAcceptanceJobWire>(
    `/templates/${encodeURIComponent(templateId)}/sections/developer-global-frame/acceptance-jobs/${encodeURIComponent(acceptanceJobId)}`,
  );
  return mapDeveloperGlobalFrameAcceptanceJob(result);
}

/** Fetch and server-validate the latest evidence for the current draft. */
export async function fetchLatestDeveloperGlobalFramePreflightEvidence(templateId: string) {
  const result = await templateRequest<DeveloperGlobalFramePreflightEvidenceWire>(
    `/templates/${encodeURIComponent(templateId)}/sections/developer-global-frame/preflight-evidence/latest`,
  );
  return mapDeveloperGlobalFramePreflightEvidence(result);
}

/** Revalidate an immutable evidence receipt against the server's current draft. */
export async function validateDeveloperGlobalFramePreflightEvidence(
  templateId: string,
  evidenceId: string,
  expectedSavedDraftHash: string,
  expectedArtifactHash: string,
) {
  const result = await templateRequest<DeveloperGlobalFramePreflightEvidenceWire>(
    `/templates/${encodeURIComponent(templateId)}/sections/developer-global-frame/preflight-evidence/${encodeURIComponent(evidenceId)}/validate`,
    {
      method: "POST",
      body: JSON.stringify({
        expected_saved_draft_hash: expectedSavedDraftHash,
        expected_artifact_hash: expectedArtifactHash,
      }),
    },
  );
  return mapDeveloperGlobalFramePreflightEvidence(result);
}

/** Persist the reviewed, rolled-out factory default on the server. */
export async function recordDeveloperGlobalFrameFactoryDefaultReceipt(
  receipt: DeveloperGlobalFrameFactoryDefaultReceiptInput,
) {
  const result = await templateRequest<DeveloperGlobalFrameFactoryDefaultReceiptWire>(
    `/templates/${encodeURIComponent(receipt.templateId)}/sections/developer-global-frame/factory-default-receipts`,
    {
      method: "POST",
      body: JSON.stringify({
        schema_version: receipt.schemaVersion,
        template_id: receipt.templateId,
        published_version: receipt.publishedVersion,
        artifact_hash: receipt.artifactHash,
        draft_hash: receipt.draftHash,
        preflight_evidence_hash: receipt.preflightEvidenceHash,
        compatible_target_page_ids: receipt.compatibleTargetPageIds,
        isolated_page_ids: receipt.isolatedPageIds,
        recovery_point_id: receipt.recoveryPointId,
        rollout_batch_id: receipt.rolloutBatchId,
        recorded_at: receipt.recordedAt,
        receipt_hash: receipt.receiptHash,
      }),
    },
  );
  return mapDeveloperGlobalFrameFactoryDefaultReceipt(result);
}

/** Cross-browser source of truth for the latest recorded factory default. */
export async function fetchLatestDeveloperGlobalFrameFactoryDefaultReceipt(templateId: string) {
  const result = await templateRequest<DeveloperGlobalFrameFactoryDefaultReceiptWire>(
    `/templates/${encodeURIComponent(templateId)}/sections/developer-global-frame/factory-default-receipts/latest`,
  );
  return mapDeveloperGlobalFrameFactoryDefaultReceipt(result);
}

/** Restore only the shared frame from a server receipt; the backend always creates a backup. */
export async function restoreDeveloperGlobalFrameFactoryDefault(
  instanceId: string,
  receiptHash?: string | null,
) {
  const result = await templateRequest<{
    receipt: DeveloperGlobalFrameFactoryDefaultReceiptWire;
    instance: Record<string, unknown>;
  }>(
    `/instances/${encodeURIComponent(instanceId)}/developer-global-frame/factory-default/restore`,
    {
      method: "POST",
      body: JSON.stringify({ receipt_hash: receiptHash ?? null }),
    },
  );
  return {
    receipt: mapDeveloperGlobalFrameFactoryDefaultReceipt(result.receipt),
    instance: result.instance,
  };
}

export async function listTemplateVersions(templateId: string) {
  const response = await templateRequest<{ items: Array<Record<string, unknown>> }>(`/templates/${templateId}/versions`);
  return response.items.map(mapTemplateVersionResponse);
}

export async function listReviewQueue() {
  const response = await templateRequest<{ items: Array<Record<string, unknown>> }>("/review-queue");
  return response.items;
}

export async function fetchInstance(instanceId: string) {
  return templateRequest(`/instances/${instanceId}`);
}
