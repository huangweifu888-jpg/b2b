export type TemplateType = "hq-agent" | "hq-client" | "agency-agent" | "agency-client";
export type InstanceType = "agency" | "sub-agency" | "third-agency" | "client-plan";
export type DeveloperGlobalFrameSectionName = "developer_global_frame";

export type TemplateDraftResponse = {
  template_id: string;
  owner_scope: string;
  draft_config_hash: string | null;
  published_config_hash?: string | null;
  draft_config_json?: Record<string, unknown> | null;
  config_json?: Record<string, unknown>;
  latest_version?: string | null;
  factory_default_version?: string | null;
  factory_default_release_batch_id?: string | null;
  factory_default_contract_version?: string | null;
  is_published?: boolean;
  [key: string]: unknown;
};

export type ProductMarketFactoryDefaultResponse = {
  template_id: string;
  source_scope: "client_source";
  rollout_owner_scope: "client";
  factory_default_version: string;
  factory_default_config_json: Record<string, unknown>;
  factory_default_release_batch_id: string;
  factory_default_contract_version: string;
  total_targets: number;
  succeeded_targets: number;
  failed_targets: 0;
  promoted_at: string;
  promoted_by?: string | null;
  covered_areas: Array<"operations" | "modules" | "layout" | "service">;
  valid: true;
};
export type RestoreTarget = "all" | "modules" | "layout" | "service" | DeveloperGlobalFrameSectionName;
export type SyncMode = "overwrite" | "merge";

export type TemplateCreateRequest = {
  templateId?: string | null;
  templateType: TemplateType;
  ownerScope: string;
  ownerId?: string | null;
  organizationId?: number | null;
  projectId?: number | null;
  parentTemplateId?: string | null;
  name: string;
  configJson: Record<string, unknown>;
  latestVersion?: string | null;
  isPublished?: boolean;
};

export type TemplateUpsertRequest = TemplateCreateRequest & {
  templateId: string;
};

export type TemplatePublishRequest = {
  version: string;
  changelog?: string | null;
  publishedBy?: string | null;
  requiresApproval?: boolean;
  requiredReviewSteps?: 1 | 2;
  requiredSections?: readonly [DeveloperGlobalFrameSectionName];
  expectedDraftConfigHash?: string | null;
  expectedPreflightArtifactHash?: string | null;
  reviewAssignee?: string | null;
  reviewDueAt?: string | null;
};

export type TemplateVersionResponse = {
  templateId: string;
  version: string;
  changelog?: string | null;
  configJson: Record<string, unknown>;
  releaseSections?: readonly [DeveloperGlobalFrameSectionName] | null;
  preflightEvidenceId?: string | null;
  reviewStatus?: "pending_review" | "pending_second_review" | "published" | "archived" | "rejected" | string;
  reviewNote?: string | null;
  reviewStep?: number;
  requiredReviewSteps?: number;
  reviewAssignee?: string | null;
  reviewDueAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  publishedBy?: string | null;
};

export type DeveloperGlobalFramePreflightEvidenceInput = {
  artifactHash: string;
  acceptanceArtifactId: string;
  acceptanceArtifactHash: string;
  visualDraftId: string;
  compatibleTargetPageIds: readonly string[];
  isolatedPageIds: readonly string[];
  recoveryPointId: string;
  checkedAt: string;
};

export type DeveloperGlobalFramePreflightEvidence = {
  evidenceId: string;
  templateId: string;
  sourceScope: string;
  baseDraftHash: string;
  savedDraftHash: string;
  artifactHash: string;
  acceptanceArtifactId: string;
  acceptanceArtifactHash: string;
  visualDraftId: string;
  compatibleTargetPageIds: string[];
  isolatedPageIds: string[];
  recoveryPointId: string;
  checkedAt: string;
  evidenceHash: string;
  valid: true;
  createdAt?: string | null;
};

export type DeveloperGlobalFrameAcceptanceCaseResult = {
  pageId: string;
  sourceScope: "hq" | "agency_source" | "client_source";
  viewport: 1440 | 1024 | 390;
  outcome: "passed" | "isolated";
};

export type DeveloperGlobalFrameAcceptanceJobStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "expired";

export type DeveloperGlobalFrameAcceptanceJob = {
  acceptanceJobId: string;
  schemaVersion: 1;
  templateId: string;
  sourceScope: "client_source";
  baseDraftHash: string;
  frameSectionHash: string;
  visualDraftId: string;
  recoveryPointId: string;
  developerGlobalFrame: Record<string, unknown>;
  pageRegistryHash: string;
  adapterRegistryHash: string;
  isolationPolicyHash: string;
  testSpecHash: string;
  sourceBuildDigest: string;
  status: DeveloperGlobalFrameAcceptanceJobStatus;
  attemptCount: number;
  maxAttempts: number;
  workerIssuer?: string | null;
  workerKeyId?: string | null;
  claimedAt?: string | null;
  leaseExpiresAt?: string | null;
  acceptanceArtifactId?: string | null;
  reportHash?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  expiresAt: string;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DeveloperGlobalFrameAcceptanceArtifact = {
  acceptanceArtifactId: string;
  schemaVersion: 1;
  runId: string;
  issuer: string;
  keyId: string;
  templateId: string;
  sourceScope: string;
  acceptanceJobId: string;
  baseDraftHash: string;
  frameSectionHash: string;
  visualDraftId: string;
  recoveryPointId: string;
  pageRegistryHash: string;
  adapterRegistryHash: string;
  isolationPolicyHash: string;
  testSpecHash: string;
  sourceBuildDigest: string;
  issuedAt: string;
  expiresAt: string;
  viewports: readonly [1440, 1024, 390];
  compatibleTargetPageIds: string[];
  isolatedPageIds: string[];
  caseResults: DeveloperGlobalFrameAcceptanceCaseResult[];
  failureCount: 0;
  flakyCount: 0;
  skippedCount: 0;
  reportHash: string;
  signature: string;
  valid: true;
  createdAt?: string | null;
};

export type InstanceResponse = {
  instanceId: string;
  instanceType: InstanceType;
  ownerScope: string;
  ownerId?: string | null;
  organizationId?: number | null;
  projectId?: number | null;
  parentId?: string | null;
  name: string;
  baseTemplateId?: string | null;
  baseTemplateVersion?: string | null;
  snapshotConfigJson: Record<string, unknown>;
  overrideConfigJson: Record<string, unknown>;
  isDetached: boolean;
  lastSyncedAt?: string | null;
};

export type InstanceUpsertRequest = {
  instanceId: string;
  instanceType: InstanceType;
  ownerScope: string;
  ownerId?: string | null;
  organizationId?: number | null;
  projectId?: number | null;
  parentId?: string | null;
  name: string;
  baseTemplateId?: string | null;
  baseTemplateVersion?: string | null;
  snapshotConfigJson: Record<string, unknown>;
  overrideConfigJson?: Record<string, unknown>;
  isDetached?: boolean;
  lastSyncedAt?: string | null;
};

export type InstanceSyncLatestRequest = {
  syncMode?: SyncMode;
  createBackup?: boolean;
  operator?: string | null;
  sections?: string[];
};

export type TemplateReleaseBatchCreateRequest = {
  expectedTemplateVersion?: string | null;
  instanceIds?: string[] | null;
  sections?: DeveloperGlobalFrameSectionName[];
};

export type InstanceRestoreTemplateRequest = {
  target?: RestoreTarget;
  templateVersion?: string | null;
  createBackup?: boolean;
  operator?: string | null;
};

export type InstanceDetachRequest = {
  operator?: string | null;
};

export type InstanceRebindTemplateRequest = {
  templateId: string;
  templateVersion: string;
  operator?: string | null;
};

export type DiffEntry = {
  path: string;
  currentValue?: unknown;
  targetValue?: unknown;
  changeType: "added" | "removed" | "updated";
};

export type DiffResponse = {
  instanceId: string;
  templateId: string;
  templateVersion: string;
  entries: DiffEntry[];
};

export type BackupCreateRequest = {
  targetType: string;
  targetId: string;
  version?: string | null;
  backupKind: string;
  createdBy?: string | null;
};

export type LegacySnapshotMapping = {
  ownerScope: string;
  legacyOwnerId: string;
  organizationId?: number | null;
  projectId?: number | null;
  createdAt?: string | null;
};

export type UnmappedSnapshotResource = {
  resourceType: "template" | "instance";
  resourceId: string;
  ownerScope: string;
  ownerId?: string | null;
  name: string;
  createdAt?: string | null;
};
