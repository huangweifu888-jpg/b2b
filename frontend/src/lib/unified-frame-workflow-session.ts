import type { DeveloperWorkflowScope } from "@/lib/developer-workflow-run";
import type {
  GlobalFrameWorkflowStatus,
  GlobalFrameWorkflowTargetSummary,
} from "@/lib/visual-page-editor-events";

export type UnifiedFrameWorkflowStage =
  | "inspect"
  | "visual"
  | "draft"
  | "preflight"
  | "sync"
  | "publish"
  | "factory-default"
  | "complete";

export type UnifiedFrameWorkflowVerificationStatus = "idle" | GlobalFrameWorkflowStatus;

export type UnifiedFrameWorkflowState = {
  route: string;
  scope: DeveloperWorkflowScope;
  scopeIdentity: string;
  stage: UnifiedFrameWorkflowStage;
  status: UnifiedFrameWorkflowVerificationStatus;
  issues: string[];
  draftId?: string;
  baseVersion?: string;
  baseHash?: string;
  releaseVersion?: string;
  releaseHash?: string;
  recoveryPointId?: string;
  targets: GlobalFrameWorkflowTargetSummary;
  isolatedPageIds: string[];
  validationEntries: string[];
};

export const UNIFIED_FRAME_WORKFLOW_STAGE_ORDER: Record<UnifiedFrameWorkflowStage, number> = {
  inspect: 0,
  visual: 1,
  draft: 2,
  preflight: 3,
  sync: 4,
  publish: 5,
  "factory-default": 6,
  complete: 7,
};

export const UNIFIED_FRAME_PAGE_WORKFLOW_STAGES = ["inspect", "visual"] as const satisfies readonly UnifiedFrameWorkflowStage[];

const UNIFIED_FRAME_WORKFLOW_STORAGE_PREFIX = "tradepro:global-frame-workbench:v3";
const WORKFLOW_STATUSES: readonly UnifiedFrameWorkflowVerificationStatus[] = [
  "idle",
  "running",
  "waiting",
  "passed",
  "blocked",
];

type SessionStorageReader = Pick<Storage, "getItem">;

export function createInitialUnifiedFrameWorkflow(
  route: string,
  scope: DeveloperWorkflowScope,
  scopeIdentity: string,
): UnifiedFrameWorkflowState {
  const normalizedScopeIdentity = normalizeUnifiedFrameWorkflowScopeIdentity(scopeIdentity, scope);
  return {
    route,
    scope,
    scopeIdentity: normalizedScopeIdentity,
    stage: "inspect",
    status: "idle",
    issues: [],
    targets: { total: 0, passed: 0, isolated: 0 },
    isolatedPageIds: [],
    validationEntries: ["等待检查当前页面。"],
  };
}

export function getUnifiedFrameWorkflowStorageKey(
  scopeIdentity: string,
  scope: DeveloperWorkflowScope,
) {
  const normalizedScopeIdentity = normalizeUnifiedFrameWorkflowScopeIdentity(scopeIdentity, scope);
  return `${UNIFIED_FRAME_WORKFLOW_STORAGE_PREFIX}:${scope}:${encodeURIComponent(normalizedScopeIdentity)}`;
}

export function isUnifiedFrameWorkflowScopeState(
  workflow: UnifiedFrameWorkflowState,
  scopeIdentity: string,
  scope: DeveloperWorkflowScope,
) {
  return workflow.scopeIdentity === scopeIdentity.trim() && workflow.scope === scope;
}

export function readUnifiedFrameWorkflow(
  storage: SessionStorageReader,
  route: string,
  scope: DeveloperWorkflowScope,
  scopeIdentity: string,
): UnifiedFrameWorkflowState {
  const initial = createInitialUnifiedFrameWorkflow(route, scope, scopeIdentity);
  try {
    const parsed = JSON.parse(
      storage.getItem(getUnifiedFrameWorkflowStorageKey(scopeIdentity, scope)) || "null",
    ) as Partial<UnifiedFrameWorkflowState> | null;
    if (!parsed
      || parsed.scope !== scope
      || parsed.scopeIdentity !== initial.scopeIdentity
      || !parsed.stage
      || !(parsed.stage in UNIFIED_FRAME_WORKFLOW_STAGE_ORDER)) return initial;
    if (scope === "page" && !UNIFIED_FRAME_PAGE_WORKFLOW_STAGES.some((stage) => stage === parsed.stage)) {
      return initial;
    }
    const parsedStatus = parsed.status && WORKFLOW_STATUSES.includes(parsed.status)
      ? parsed.status
      : "idle";
    const restoredStatus = parsedStatus === "running" || (scope === "page" && parsedStatus === "waiting")
      ? "idle"
      : parsedStatus;
    const validationEntries = Array.isArray(parsed.validationEntries) && parsed.validationEntries.length
      ? parsed.validationEntries.slice(-8)
      : ["已恢复当前范围的框架工作流。"];
    if (scope === "page") {
      return {
        ...initial,
        stage: parsed.stage === "visual" ? "visual" : "inspect",
        status: restoredStatus,
        issues: Array.isArray(parsed.issues) ? parsed.issues.slice(-8) : [],
        validationEntries,
      };
    }
    return {
      ...initial,
      ...parsed,
      route,
      scope,
      scopeIdentity: initial.scopeIdentity,
      status: restoredStatus,
      targets: { ...initial.targets, ...(parsed.targets || {}) },
      isolatedPageIds: Array.isArray(parsed.isolatedPageIds) ? parsed.isolatedPageIds : [],
      validationEntries,
    };
  } catch {
    return initial;
  }
}

function normalizeUnifiedFrameWorkflowScopeIdentity(
  scopeIdentity: string,
  scope: DeveloperWorkflowScope,
) {
  const normalizedScopeIdentity = scopeIdentity.trim();
  if (!normalizedScopeIdentity || !normalizedScopeIdentity.startsWith(`${scope}:`)) {
    throw new Error(`unified frame workflow ${scope} scopeIdentity is invalid`);
  }
  return normalizedScopeIdentity;
}
