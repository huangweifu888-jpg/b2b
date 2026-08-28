import {
  DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION,
  DEVELOPER_GLOBAL_STYLE_PILOT_CHECK_IDS,
  DEVELOPER_GLOBAL_STYLE_PILOT_PAGE_ID,
  DEVELOPER_GLOBAL_STYLE_PROFILE_DRAFT,
  DEVELOPER_GLOBAL_STYLE_REFERENCE_PAGE_ID,
  type DeveloperGlobalStylePilotCheckId,
} from "@/lib/developer-global-style-contract";
import type { DeveloperGlobalStyleCanaryProfileDraft } from "@/lib/developer-global-style-session";
import type { VisualCardRegionId } from "@/lib/visual-card-layout-contract";
import { resolveVisualCardSharedRegionStyle } from "@/lib/visual-card-shared-style-bridge";
import {
  validateDeveloperGlobalFrameAdapterRegistry,
  type DeveloperGlobalFrameRegisteredRole,
} from "@/lib/developer-global-frame-adapter-registry";
import {
  DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS,
  inspectDeveloperGlobalFrameAdapterCoverage,
  isDeveloperGlobalFrameIntentionalIsolationPageId,
} from "@/lib/developer-global-frame-adapter-resolution";

export const DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID = "client-source-global" as const;
export const DEVELOPER_GLOBAL_FRAME_SECTION_NAME = "developer_global_frame" as const;
export const DEVELOPER_GLOBAL_FRAME_ATOMIC_DRAFT_ENDPOINT_STATUS = "available" as const;
export const DEVELOPER_GLOBAL_FRAME_PREPARED_HANDOFF_MAX_AGE_MS = 30 * 60 * 1000;

const DEVELOPER_GLOBAL_FRAME_HANDOFF_CLOCK_SKEW_MS = 5_000;
const DEVELOPER_GLOBAL_FRAME_HANDOFF_MAX_BYTES = 250_000;
const DEVELOPER_GLOBAL_FRAME_DRAFT_HASH = /^[0-9a-f]{64}$/u;

const SIMPLE_IMMUTABLE_PROFILE_VERSION = /^(v?)(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

export function bumpDeveloperGlobalFrameProfileVersionIfCurrent(candidate: string, latestVersion: string | null | undefined) {
  const trimmedCandidate = candidate.trim();
  const trimmedLatest = latestVersion?.trim() || "";
  if (!trimmedLatest || trimmedCandidate !== trimmedLatest) return trimmedCandidate;
  const match = SIMPLE_IMMUTABLE_PROFILE_VERSION.exec(trimmedLatest);
  if (!match) return trimmedCandidate;
  const patch = Number(match[4]);
  if (!Number.isSafeInteger(patch) || patch >= Number.MAX_SAFE_INTEGER) return trimmedCandidate;
  return `${match[1]}${match[2]}.${match[3]}.${patch + 1}`;
}

export const DEVELOPER_GLOBAL_FRAME_REGIONS = DEVELOPER_GLOBAL_STYLE_PROFILE_DRAFT.regions;
export const DEVELOPER_GLOBAL_FRAME_PROTECTED_OWNERSHIP = DEVELOPER_GLOBAL_STYLE_PROFILE_DRAFT.protectedOwnership;

export type DeveloperGlobalFrameSourceScope = "hq" | "agency_source" | "client_source";
export type DeveloperGlobalFrameRegion = (typeof DEVELOPER_GLOBAL_FRAME_REGIONS)[number];
export type DeveloperGlobalFrameAdapterRole = DeveloperGlobalFrameRegisteredRole;

export type DeveloperGlobalFrameRegionTokens = Partial<{
  background_color: string;
  foreground_color: string;
  border_color: string;
  border_width: string | number;
  border_radius: string | number;
  box_shadow: string;
  font_family: string;
  font_size: string | number;
  font_weight: string | number;
  letter_spacing: string | number;
  line_height: string | number;
  padding_top: string | number;
  padding_right: string | number;
  padding_bottom: string | number;
  padding_left: string | number;
  gap: string | number;
  right_inset: string | number;
  annotation_visible: boolean;
  annotation_offset: string | number;
  annotation_font_size: string | number;
  scrollbar_gutter: "auto" | "stable" | "stable both-edges";
  scrollbar_width: string | number;
  overflow_x: "visible" | "hidden" | "clip" | "auto" | "scroll";
  overflow_y: "visible" | "hidden" | "clip" | "auto" | "scroll";
}>;

export type DeveloperGlobalFrameAdapter = {
  page_id: string;
  role: DeveloperGlobalFrameAdapterRole;
  reads_profile_version: string;
  owns_structure: true;
  allowed_overrides: [];
};

export type DeveloperGlobalFrameTarget = {
  page_id: string;
  source_scope: DeveloperGlobalFrameSourceScope;
  adapter_role: DeveloperGlobalFrameAdapterRole;
  reads_profile_version: string;
  compatibility: "compatible" | "isolated";
};

export type DeveloperGlobalFrameSection = {
  contract_version: typeof DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION;
  profile_version: string;
  scope: "appearance-only";
  source_scope: DeveloperGlobalFrameSourceScope;
  reference_page_id: typeof DEVELOPER_GLOBAL_STYLE_REFERENCE_PAGE_ID;
  regions: [...typeof DEVELOPER_GLOBAL_FRAME_REGIONS];
  region_tokens: Record<DeveloperGlobalFrameRegion, DeveloperGlobalFrameRegionTokens>;
  protected_ownership: [...typeof DEVELOPER_GLOBAL_FRAME_PROTECTED_OWNERSHIP];
  adapters: DeveloperGlobalFrameAdapter[];
  target_matrix_complete: true;
  target_matrix: DeveloperGlobalFrameTarget[];
  recovery: {
    draft_id: string;
    recovery_point_id: string;
    visual_audit_id: string;
  };
  pilot: {
    page_id: typeof DEVELOPER_GLOBAL_STYLE_PILOT_PAGE_ID;
    status: "passed";
    checks: [...typeof DEVELOPER_GLOBAL_STYLE_PILOT_CHECK_IDS];
    verification_id: string;
    verified_at: string;
  };
};

export type DeveloperGlobalFramePreparedHandoff = {
  contractVersion: typeof DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION;
  id: string;
  templateId: typeof DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID;
  sectionName: typeof DEVELOPER_GLOBAL_FRAME_SECTION_NAME;
  status: "locally-validated-pending-atomic-save" | "source-draft-saved";
  sourceCanaryProfileDraftId: string;
  section: DeveloperGlobalFrameSection;
  createdAt: string;
  savedAt: string | null;
  draftConfigHash: string | null;
  preservedSiblingKeys: string[];
};

export type DeveloperGlobalFrameServerDraftEvidence = {
  template_id: string;
  owner_scope: string;
  draft_config_hash: string | null;
  draft_config_json?: Record<string, unknown> | null;
};

export type BuildDeveloperGlobalFrameSectionInput = {
  profileVersion: string;
  sourceScope: DeveloperGlobalFrameSourceScope;
  canaryDraft: Pick<
    DeveloperGlobalStyleCanaryProfileDraft,
    "appearance" | "visualAuditId" | "recoveryPointId"
  >;
  recoveryDraftId: string;
  pilotVerificationId: string;
  pilotVerifiedAt: string;
  pilotChecks: readonly DeveloperGlobalStylePilotCheckId[];
  /** Page Factory IDs admitted by preflight. Technical/control-flow pages are always isolated. */
  compatibleTargetPageIds?: readonly string[];
};

const VISUAL_REGION_BY_FRAME_REGION: Record<Exclude<DeveloperGlobalFrameRegion, "scrollbar">, VisualCardRegionId> = {
  topbar: "topbar",
  workspace: "workspace",
  title: "title",
  "table-shell": "table-shell",
  "table-header": "table-header",
  content: "content",
  footer: "footer",
};

const SAFE_PAGE_ID = /^[a-z0-9][a-z0-9:._/?=&-]+$/u;
const SEMVER = /^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u;
const FORBIDDEN_STYLE_VALUE = /url\(|javascript:|expression\(|@import|[<>{};]/iu;
const REGION_TOKEN_KEYS = new Set([
  "background_color", "foreground_color", "border_color", "border_width", "border_radius", "box_shadow",
  "font_family", "font_size", "font_weight", "letter_spacing", "line_height", "padding_top", "padding_right",
  "padding_bottom", "padding_left", "gap", "right_inset", "annotation_visible", "annotation_offset",
  "annotation_font_size", "scrollbar_gutter", "scrollbar_width", "overflow_x", "overflow_y",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function shadowForOverride(shadow: "none" | "sm" | "md" | "lg" | undefined, fallback: string) {
  if (!shadow) return fallback;
  return {
    none: "none",
    sm: "0 1px 2px rgb(15 23 42 / 8%)",
    md: "0 4px 12px rgb(15 23 42 / 12%)",
    lg: "0 10px 24px rgb(15 23 42 / 18%)",
  }[shadow];
}

function buildRegionTokens(
  region: Exclude<DeveloperGlobalFrameRegion, "scrollbar">,
  canaryDraft: Pick<DeveloperGlobalStyleCanaryProfileDraft, "appearance">,
): DeveloperGlobalFrameRegionTokens {
  const visualRegion = VISUAL_REGION_BY_FRAME_REGION[region];
  const componentStyle = canaryDraft.appearance.componentStyles[visualRegion] || {};
  const resolved = resolveVisualCardSharedRegionStyle(
    visualRegion,
    canaryDraft.appearance.sharedStylePatch.layoutStyle,
    {},
    canaryDraft.appearance.sharedStylePatch.globalTypography,
  );
  const padding = componentStyle.spacing?.padding;
  const isWorkspace = region === "workspace";
  const isAlignedInnerRegion = region === "title" || region === "table-shell" || region === "table-header" || region === "content";
  return {
    background_color: resolved.backgroundColor,
    foreground_color: resolved.textColor,
    border_width: componentStyle.border?.widthPx ?? 0,
    border_radius: componentStyle.border?.radiusPx ?? resolved.cornerRadiusPx,
    box_shadow: shadowForOverride(componentStyle.border?.shadow, resolved.shadow),
    font_family: resolved.fontFamily,
    font_size: componentStyle.typography?.sizePx ?? 14,
    font_weight: componentStyle.typography?.weight ?? resolved.fontWeight,
    letter_spacing: componentStyle.typography?.letterSpacingEm ?? resolved.letterSpacing,
    line_height: componentStyle.typography?.lineHeight ?? 1.5,
    padding_top: padding?.top ?? (isWorkspace ? canaryDraft.appearance.frameInsets.top : resolved.spacingPx),
    padding_right: padding?.right ?? (isWorkspace ? canaryDraft.appearance.frameInsets.right : resolved.spacingPx),
    padding_bottom: padding?.bottom ?? (isWorkspace ? canaryDraft.appearance.frameInsets.bottom : resolved.spacingPx),
    padding_left: padding?.left ?? (isWorkspace ? canaryDraft.appearance.frameInsets.left : resolved.spacingPx),
    gap: componentStyle.spacing?.gapPx ?? resolved.spacingPx,
    right_inset: isAlignedInnerRegion ? 0 : canaryDraft.appearance.frameInsets.right,
    annotation_visible: componentStyle.annotation?.visibility !== "hidden",
    annotation_offset: 0,
    annotation_font_size: 10,
  };
}

export function buildDeveloperGlobalFrameTargetGraph(
  profileVersion: string,
  sourceScope: DeveloperGlobalFrameSourceScope,
  compatibleTargetPageIds?: readonly string[],
) {
  const registryValidation = validateDeveloperGlobalFrameAdapterRegistry();
  if (!registryValidation.valid) throw new Error(`developer global frame adapter registry invalid: ${registryValidation.issues.join("; ")}`);
  const coverage = inspectDeveloperGlobalFrameAdapterCoverage();
  if (coverage.issues.length || coverage.resolved !== coverage.eligible) {
    throw new Error(`developer global frame template adapter coverage incomplete: ${coverage.issues.join("; ")}`);
  }
  if (!(sourceScope === "hq" || sourceScope === "agency_source" || sourceScope === "client_source")) {
    throw new Error(`unsupported developer global frame source scope: ${sourceScope}`);
  }
  const registrations = DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS;
  if (!registrations.length) throw new Error("no developer global frame target registrations");
  const resolvedProfileVersion = profileVersion.trim();
  if (!resolvedProfileVersion) throw new Error("developer global frame profile version is required");
  const allFactoryIds = new Set(registrations.map((entry) => entry.pageFactoryId));
  const compatibleFactoryIds = compatibleTargetPageIds
    ? new Set(compatibleTargetPageIds)
    : new Set(registrations
      .filter((entry) => !isDeveloperGlobalFrameIntentionalIsolationPageId(entry.pageFactoryId))
      .map((entry) => entry.pageFactoryId));
  if (compatibleFactoryIds.size !== (compatibleTargetPageIds?.length ?? compatibleFactoryIds.size)
    || [...compatibleFactoryIds].some((pageId) => !allFactoryIds.has(pageId)
      || isDeveloperGlobalFrameIntentionalIsolationPageId(pageId))) {
    throw new Error("compatible target page IDs must be unique registered business Page Factory IDs");
  }
  const adapters: DeveloperGlobalFrameAdapter[] = registrations.map((entry) => ({
    page_id: entry.profilePageId,
    role: entry.role,
    reads_profile_version: resolvedProfileVersion,
    owns_structure: true,
    allowed_overrides: [],
  }));
  const target_matrix: DeveloperGlobalFrameTarget[] = registrations.map((entry) => ({
    page_id: entry.profilePageId,
    source_scope: entry.sourceScope,
    adapter_role: entry.role,
    reads_profile_version: resolvedProfileVersion,
    compatibility: compatibleFactoryIds.has(entry.pageFactoryId) ? "compatible" : "isolated",
  }));
  return { adapters, target_matrix };
}

export function buildDeveloperGlobalFrameSection(input: BuildDeveloperGlobalFrameSectionInput): DeveloperGlobalFrameSection {
  const graph = buildDeveloperGlobalFrameTargetGraph(input.profileVersion, input.sourceScope, input.compatibleTargetPageIds);
  const region_tokens = Object.fromEntries(DEVELOPER_GLOBAL_FRAME_REGIONS.map((region) => [
    region,
    region === "scrollbar"
      ? { scrollbar_gutter: "stable", scrollbar_width: 10, overflow_x: "hidden", overflow_y: "auto" }
      : buildRegionTokens(region, input.canaryDraft),
  ])) as Record<DeveloperGlobalFrameRegion, DeveloperGlobalFrameRegionTokens>;
  return {
    contract_version: DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION,
    profile_version: input.profileVersion.trim(),
    scope: "appearance-only",
    source_scope: input.sourceScope,
    reference_page_id: DEVELOPER_GLOBAL_STYLE_REFERENCE_PAGE_ID,
    regions: [...DEVELOPER_GLOBAL_FRAME_REGIONS],
    region_tokens,
    protected_ownership: [...DEVELOPER_GLOBAL_FRAME_PROTECTED_OWNERSHIP],
    adapters: graph.adapters,
    target_matrix_complete: true,
    target_matrix: graph.target_matrix,
    recovery: {
      draft_id: input.recoveryDraftId,
      recovery_point_id: input.canaryDraft.recoveryPointId,
      visual_audit_id: input.canaryDraft.visualAuditId,
    },
    pilot: {
      page_id: DEVELOPER_GLOBAL_STYLE_PILOT_PAGE_ID,
      status: "passed",
      checks: [...input.pilotChecks] as [...typeof DEVELOPER_GLOBAL_STYLE_PILOT_CHECK_IDS],
      verification_id: input.pilotVerificationId,
      verified_at: input.pilotVerifiedAt,
    },
  };
}

export function validateDeveloperGlobalFrameSection(value: unknown): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!isRecord(value)) return { valid: false, issues: ["section must be an object"] };
  const topKeys = ["contract_version", "profile_version", "scope", "source_scope", "reference_page_id", "regions", "region_tokens", "protected_ownership", "adapters", "target_matrix_complete", "target_matrix", "recovery", "pilot"];
  if (!exactKeys(value, topKeys)) issues.push("section fields must match the strict schema");
  if (value.contract_version !== DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION) issues.push("contract_version mismatch");
  if (typeof value.profile_version !== "string" || !SEMVER.test(value.profile_version)) issues.push("profile_version must be semver");
  if (value.scope !== "appearance-only") issues.push("scope must be appearance-only");
  if (!(["hq", "agency_source", "client_source"] as const).includes(value.source_scope as DeveloperGlobalFrameSourceScope)) issues.push("invalid source_scope");
  if (value.reference_page_id !== DEVELOPER_GLOBAL_STYLE_REFERENCE_PAGE_ID) issues.push("reference page must be 运营市场");
  if (!Array.isArray(value.regions) || JSON.stringify(value.regions) !== JSON.stringify(DEVELOPER_GLOBAL_FRAME_REGIONS)) issues.push("canonical region order required");
  if (!Array.isArray(value.protected_ownership) || JSON.stringify(value.protected_ownership) !== JSON.stringify(DEVELOPER_GLOBAL_FRAME_PROTECTED_OWNERSHIP)) issues.push("protected ownership must remain complete");

  if (!isRecord(value.region_tokens) || Object.keys(value.region_tokens).length < 1 || Object.keys(value.region_tokens).length > 8) {
    issues.push("region_tokens must contain 1-8 canonical regions");
  } else {
    for (const [region, tokens] of Object.entries(value.region_tokens)) {
      if (!(DEVELOPER_GLOBAL_FRAME_REGIONS as readonly string[]).includes(region) || !isRecord(tokens) || Object.keys(tokens).length === 0) {
        issues.push(`invalid tokens for ${region}`);
        continue;
      }
      for (const [key, token] of Object.entries(tokens)) {
        if (!REGION_TOKEN_KEYS.has(key)) issues.push(`unsupported token ${region}.${key}`);
        if (typeof token !== "string" && typeof token !== "number" && typeof token !== "boolean") issues.push(`invalid scalar ${region}.${key}`);
        if (typeof token === "string" && (token.length > 200 || FORBIDDEN_STYLE_VALUE.test(token))) issues.push(`unsafe token ${region}.${key}`);
      }
    }
  }

  const adapters = Array.isArray(value.adapters) ? value.adapters : [];
  const targets = Array.isArray(value.target_matrix) ? value.target_matrix : [];
  const registryValidation = validateDeveloperGlobalFrameAdapterRegistry();
  if (!registryValidation.valid) issues.push(...registryValidation.issues.map((issue) => `adapter registry: ${issue}`));
  const coverage = inspectDeveloperGlobalFrameAdapterCoverage();
  if (coverage.issues.length || coverage.resolved !== coverage.eligible) issues.push("template adapter coverage must be complete");
  const expectedRegistrations = DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS;
  if (!expectedRegistrations.length) issues.push("global target registry is empty");
  if (adapters.length !== expectedRegistrations.length) issues.push("adapters must exactly match all resolvable Page Factory targets");
  if (targets.length !== expectedRegistrations.length || value.target_matrix_complete !== true) issues.push("target matrix must exactly match all resolvable Page Factory targets");
  const adapterByPage = new Map<string, Record<string, unknown>>();
  for (const adapter of adapters) {
    if (!isRecord(adapter) || !exactKeys(adapter, ["page_id", "role", "reads_profile_version", "owns_structure", "allowed_overrides"])) {
      issues.push("invalid adapter shape");
      continue;
    }
    if (typeof adapter.page_id !== "string" || !SAFE_PAGE_ID.test(adapter.page_id) || adapterByPage.has(adapter.page_id)) issues.push("adapter page IDs must be safe and unique");
    if (!(["reference", "pilot", "consumer"] as const).includes(adapter.role as DeveloperGlobalFrameAdapterRole)) issues.push("invalid adapter role");
    if (adapter.reads_profile_version !== value.profile_version || adapter.owns_structure !== true || !Array.isArray(adapter.allowed_overrides) || adapter.allowed_overrides.length) issues.push("adapter ownership/version mismatch");
    if (typeof adapter.page_id === "string") adapterByPage.set(adapter.page_id, adapter);
  }
  const targetByPage = new Map<string, Record<string, unknown>>();
  for (const target of targets) {
    if (!isRecord(target) || !exactKeys(target, ["page_id", "source_scope", "adapter_role", "reads_profile_version", "compatibility"])) {
      issues.push("invalid target shape");
      continue;
    }
    if (typeof target.page_id !== "string" || !SAFE_PAGE_ID.test(target.page_id) || targetByPage.has(target.page_id)) issues.push("target page IDs must be safe and unique");
    if (!(target.source_scope === "hq" || target.source_scope === "agency_source" || target.source_scope === "client_source")
      || target.reads_profile_version !== value.profile_version
      || !(target.compatibility === "compatible" || target.compatibility === "isolated")) issues.push("target compatibility/version mismatch");
    if (typeof target.page_id === "string") targetByPage.set(target.page_id, target);
  }
  if (adapterByPage.size !== targetByPage.size || [...adapterByPage.keys()].some((id) => !targetByPage.has(id))) issues.push("adapter and target page sets must match");
  for (const [pageId, adapter] of adapterByPage) {
    if (targetByPage.get(pageId)?.adapter_role !== adapter.role) issues.push(`role mismatch for ${pageId}`);
  }
  for (const registration of expectedRegistrations) {
    const adapter = adapterByPage.get(registration.profilePageId);
    const target = targetByPage.get(registration.profilePageId);
    if (value.contract_version !== registration.supportedContractVersion) {
      issues.push(`unsupported adapter contract for ${registration.profilePageId}`);
    }
    if (!adapter || adapter.role !== registration.role) {
      issues.push(`registered adapter mismatch for ${registration.profilePageId}`);
    }
    if (!target || target.adapter_role !== registration.role) {
      issues.push(`registered target mismatch for ${registration.profilePageId}`);
    } else if (target.source_scope !== registration.sourceScope) {
      issues.push(`registered target source mismatch for ${registration.profilePageId}`);
    }
  }
  const references = [...adapterByPage.values()].filter((adapter) => adapter.role === "reference").map((adapter) => adapter.page_id);
  const pilots = [...adapterByPage.values()].filter((adapter) => adapter.role === "pilot").map((adapter) => adapter.page_id);
  const consumers = [...adapterByPage.values()].filter((adapter) => adapter.role === "consumer");
  if (references.length !== 1 || references[0] !== value.reference_page_id) issues.push("exact reference adapter required");
  if (targets.filter((target) => isRecord(target) && target.compatibility === "compatible").length < 1) issues.push("at least one compatible target required");
  for (const foundationPageId of [value.reference_page_id, DEVELOPER_GLOBAL_STYLE_PILOT_PAGE_ID]) {
    if (typeof foundationPageId === "string" && targetByPage.get(foundationPageId)?.compatibility !== "compatible") {
      issues.push(`foundation target must remain compatible: ${foundationPageId}`);
    }
  }

  if (!isRecord(value.recovery) || !exactKeys(value.recovery, ["draft_id", "recovery_point_id", "visual_audit_id"])
    || [value.recovery?.draft_id, value.recovery?.recovery_point_id, value.recovery?.visual_audit_id].some((item) => typeof item !== "string" || !item)) issues.push("complete recovery evidence required");
  if (!isRecord(value.pilot) || !exactKeys(value.pilot, ["page_id", "status", "checks", "verification_id", "verified_at"])) {
    issues.push("complete pilot evidence required");
  } else {
    if (value.pilot.page_id !== DEVELOPER_GLOBAL_STYLE_PILOT_PAGE_ID || value.pilot.status !== "passed") issues.push("marketing pilot must pass");
    if (!Array.isArray(value.pilot.checks) || JSON.stringify(value.pilot.checks) !== JSON.stringify(DEVELOPER_GLOBAL_STYLE_PILOT_CHECK_IDS)) issues.push("canonical pilot checks required");
    if (typeof value.pilot.verification_id !== "string" || !value.pilot.verification_id) issues.push("pilot verification_id required");
    if (typeof value.pilot.verified_at !== "string" || !Number.isFinite(Date.parse(value.pilot.verified_at))) issues.push("pilot verified_at must be ISO-8601");
  }
  if (pilots.length !== 1 || pilots[0] !== DEVELOPER_GLOBAL_STYLE_PILOT_PAGE_ID || consumers.length === 0) issues.push("exact pilot and at least one consumer required");
  return { valid: issues.length === 0, issues };
}

export function buildDeveloperGlobalFramePreparedHandoff(
  section: DeveloperGlobalFrameSection,
  sourceCanaryProfileDraftId: string,
  createdAt = new Date().toISOString(),
): DeveloperGlobalFramePreparedHandoff {
  const validation = validateDeveloperGlobalFrameSection(section);
  if (!validation.valid) throw new Error(validation.issues.join("; "));
  return {
    contractVersion: DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION,
    id: `developer-global-frame-${Date.parse(createdAt)}-${sourceCanaryProfileDraftId}`,
    templateId: DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
    sectionName: DEVELOPER_GLOBAL_FRAME_SECTION_NAME,
    status: "locally-validated-pending-atomic-save",
    sourceCanaryProfileDraftId,
    section,
    createdAt,
    savedAt: null,
    draftConfigHash: null,
    preservedSiblingKeys: [],
  };
}

export function markDeveloperGlobalFrameHandoffSaved(
  handoff: DeveloperGlobalFramePreparedHandoff,
  result: {
    draft_config_hash: string;
    preserved_sibling_keys: string[];
    write_scope: "draft-only";
    publish_performed: false;
    batch_created: false;
  },
  savedAt = new Date().toISOString(),
): DeveloperGlobalFramePreparedHandoff {
  if (result.write_scope !== "draft-only" || result.publish_performed !== false || result.batch_created !== false) {
    throw new Error("Atomic merge response crossed the draft-only boundary");
  }
  return {
    ...handoff,
    status: "source-draft-saved",
    savedAt,
    draftConfigHash: result.draft_config_hash,
    preservedSiblingKeys: [...result.preserved_sibling_keys],
  };
}

export function buildDeveloperGlobalFramePreparedHandoffStorageKey(sourceScope: DeveloperGlobalFrameSourceScope) {
  return `tradepro:developer-global-style:prepared-handoff:${sourceScope}`;
}

export function writeDeveloperGlobalFramePreparedHandoff(storage: Pick<Storage, "setItem">, handoff: DeveloperGlobalFramePreparedHandoff) {
  const validation = validateDeveloperGlobalFrameSection(handoff.section);
  if (!validation.valid
    || handoff.status !== "source-draft-saved"
    || !handoff.savedAt
    || !handoff.draftConfigHash
    || !Number.isFinite(Date.parse(handoff.createdAt))
    || !Number.isFinite(Date.parse(handoff.savedAt))) return false;
  try {
    storage.setItem(buildDeveloperGlobalFramePreparedHandoffStorageKey(handoff.section.source_scope), JSON.stringify(handoff));
    return true;
  } catch {
    return false;
  }
}

function validateDeveloperGlobalFramePreparedHandoff(
  value: unknown,
  sourceScope: DeveloperGlobalFrameSourceScope,
  now: number,
): value is DeveloperGlobalFramePreparedHandoff {
  if (!isRecord(value) || !exactKeys(value, [
    "contractVersion",
    "id",
    "templateId",
    "sectionName",
    "status",
    "sourceCanaryProfileDraftId",
    "section",
    "createdAt",
    "savedAt",
    "draftConfigHash",
    "preservedSiblingKeys",
  ])) return false;
  if (value.contractVersion !== DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION
    || value.templateId !== DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID
    || value.sectionName !== DEVELOPER_GLOBAL_FRAME_SECTION_NAME
    || value.status !== "source-draft-saved"
    || typeof value.id !== "string"
    || typeof value.sourceCanaryProfileDraftId !== "string"
    || !value.sourceCanaryProfileDraftId
    || value.sourceCanaryProfileDraftId.length > 200
    || typeof value.createdAt !== "string"
    || typeof value.savedAt !== "string"
    || typeof value.draftConfigHash !== "string"
    || !DEVELOPER_GLOBAL_FRAME_DRAFT_HASH.test(value.draftConfigHash)
    || !Array.isArray(value.preservedSiblingKeys)) return false;
  const sectionValidation = validateDeveloperGlobalFrameSection(value.section);
  if (!sectionValidation.valid || !isRecord(value.section) || value.section.source_scope !== sourceScope) return false;
  const createdAt = Date.parse(value.createdAt);
  const savedAt = Date.parse(value.savedAt);
  if (!Number.isFinite(createdAt)
    || !Number.isFinite(savedAt)
    || savedAt < createdAt
    || savedAt - createdAt > DEVELOPER_GLOBAL_FRAME_PREPARED_HANDOFF_MAX_AGE_MS
    || savedAt > now + DEVELOPER_GLOBAL_FRAME_HANDOFF_CLOCK_SKEW_MS
    || now - savedAt > DEVELOPER_GLOBAL_FRAME_PREPARED_HANDOFF_MAX_AGE_MS
    || value.id !== `developer-global-frame-${createdAt}-${value.sourceCanaryProfileDraftId}`) return false;
  const siblingKeys = value.preservedSiblingKeys;
  if (siblingKeys.length > 256
    || siblingKeys.some((item) => typeof item !== "string" || !item || item.length > 200 || item === DEVELOPER_GLOBAL_FRAME_SECTION_NAME)
    || new Set(siblingKeys).size !== siblingKeys.length) return false;
  return true;
}

/**
 * Reads only a fresh, exact, section-only handoff written after the atomic
 * source-draft merge. Invalid or expired session evidence is removed so it
 * cannot be retried as a release instruction.
 */
export function readDeveloperGlobalFramePreparedHandoff(
  storage: Pick<Storage, "getItem" | "removeItem">,
  sourceScope: DeveloperGlobalFrameSourceScope,
  now = Date.now(),
): DeveloperGlobalFramePreparedHandoff | null {
  const key = buildDeveloperGlobalFramePreparedHandoffStorageKey(sourceScope);
  const raw = storage.getItem(key);
  if (!raw) return null;
  if (raw.length > DEVELOPER_GLOBAL_FRAME_HANDOFF_MAX_BYTES) {
    storage.removeItem(key);
    return null;
  }
  try {
    const candidate = JSON.parse(raw) as unknown;
    if (!validateDeveloperGlobalFramePreparedHandoff(candidate, sourceScope, now)) {
      storage.removeItem(key);
      return null;
    }
    return candidate;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Fail closed unless the server still exposes the exact saved draft. */
export function validateDeveloperGlobalFrameHandoffServerDraft(
  handoff: DeveloperGlobalFramePreparedHandoff,
  serverDraft: DeveloperGlobalFrameServerDraftEvidence,
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (serverDraft.template_id !== handoff.templateId) issues.push("template_id mismatch");
  if (serverDraft.owner_scope !== handoff.section.source_scope) issues.push("owner_scope mismatch");
  if (typeof serverDraft.draft_config_hash !== "string"
    || !DEVELOPER_GLOBAL_FRAME_DRAFT_HASH.test(serverDraft.draft_config_hash)
    || serverDraft.draft_config_hash !== handoff.draftConfigHash) issues.push("draft_config_hash mismatch");
  const authoringDraft = serverDraft.draft_config_json;
  const serverSection = isRecord(authoringDraft) ? authoringDraft[DEVELOPER_GLOBAL_FRAME_SECTION_NAME] : undefined;
  const sectionValidation = validateDeveloperGlobalFrameSection(serverSection);
  if (!sectionValidation.valid) issues.push("server draft is missing or has an invalid developer_global_frame section");
  if (sectionValidation.valid && stableSerialize(serverSection) !== stableSerialize(handoff.section)) {
    issues.push("server developer_global_frame section differs from the prepared handoff");
  }
  return { valid: issues.length === 0, issues };
}
