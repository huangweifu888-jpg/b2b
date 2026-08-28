import sharedContractData from "@website-style/developer-optimization-contract.json";

export type DeveloperTopLevelAppId =
  | "visual-frame"
  | "shared-contract"
  | "figma-ui"
  | "visual-evidence"
  | "performance-experience"
  | "quality-release"
  | "page-factory"
  | "page-lock";

export type OptimizationAuditScope = "global" | "page";
export type DeveloperOptimizationSourceScope = "hq" | "agency_source" | "client_source";
export type DeveloperLoadingIntent = "critical" | "post-paint" | "viewport" | "interaction" | "background";

export type SharedOptimizationBudgetId =
  | "route-fallback"
  | "route-script"
  | "post-paint-script"
  | "largest-chunk"
  | "long-task"
  | "layout-shift"
  | "source-module";

export type DeveloperLoadingSpeedRuleId =
  | "stable-page-identity"
  | "intent-driven-boundaries"
  | "deduplicated-async-work"
  | "immutable-computation-cache"
  | "visibility-aware-scheduling"
  | "viewport-media-delivery"
  | "route-owned-assets"
  | "tiered-performance-evidence"
  | "capability-preservation"
  | "fail-closed-governance";

export type DeveloperTopLevelApp = {
  id: DeveloperTopLevelAppId;
  order: string;
  label: string;
  description: string;
  footer: string;
};

export type DeveloperNavigationOrderAlias = {
  appId: Extract<DeveloperTopLevelAppId, "page-factory" | "page-lock">;
  previousOrder: string;
  currentOrder: string;
};

export type DeveloperLoadingSpeedRule = {
  id: DeveloperLoadingSpeedRuleId;
  label: string;
  guidance: string;
  evidencePatternIds: readonly string[];
};

export type DeveloperLoadingSpeedApplicationPlan = {
  appId: DeveloperTopLevelAppId;
  responsibility: string;
  ruleIds: readonly DeveloperLoadingSpeedRuleId[];
  checks: readonly string[];
  output: string;
  boundary: string;
};

type DeveloperLoadingSpeedLearningContract = {
  version: string;
  owner: "performance-experience-learning";
  catalogSource: "frontend/src/lib/performance-experience-learning.ts";
  singleSource: true;
  automaticSourceRewrite: false;
  scopes: readonly OptimizationAuditScope[];
  loadPlanProjection: {
    schemaVersion: 1;
    globalProfileId: "global-registered-pages";
    unregisteredProfileId: "unregistered-page";
    pageProfileIdSource: "pageFactoryId";
    pageEntryIntent: "critical";
    bucketIntents: {
      alwaysEntries: DeveloperLoadingIntent;
      layoutEntries: DeveloperLoadingIntent;
      initialLazyEntriesByPageId: DeveloperLoadingIntent;
      deferredLazyEntriesBySourceScope: DeveloperLoadingIntent;
      deferredLazyEntriesByPageId: DeveloperLoadingIntent;
    };
    budgetSource: "budgets";
    ruleSource: "loadingSpeedLearning.rules";
    pageOverridesOnly: true;
    globalEmbedsPerPageUnits: false;
  };
  comparisonProtocol: {
    requireSamePageDna: true;
    requireFunctionalParity: true;
    requireBeforeAfterEvidence: true;
    allowedUnexpectedMutationRequests: 0;
    quick: {
      coldRuns: number;
      repeatRuns: number;
      viewports: readonly number[];
      releaseEvidence: false;
    };
    release: {
      coldRuns: number;
      repeatRuns: number;
      viewports: readonly number[];
      releaseEvidence: true;
    };
  };
  rules: readonly DeveloperLoadingSpeedRule[];
  applicationPlans: readonly DeveloperLoadingSpeedApplicationPlan[];
};

type SharedOptimizationContract = {
  version: string;
  ownership: "shared-first";
  automaticSourceRewrite: false;
  mediaContract: "media-optimization-contract.json";
  designContract: "design-integration-contract.json";
  navigationOrderMigration: {
    identityField: "appId";
    preserveStableAppIds: true;
    rewriteHistoricalRecords: false;
    effectiveContractVersion: string;
    aliases: readonly DeveloperNavigationOrderAlias[];
  };
  routeComposition: {
    alwaysEntries: readonly string[];
    layoutEntries: Readonly<Record<DeveloperOptimizationSourceScope, string>>;
    initialLazyEntriesByPageId: Readonly<Record<string, readonly string[]>>;
    deferredLazyEntriesBySourceScope: Readonly<Record<DeveloperOptimizationSourceScope, readonly string[]>>;
    deferredLazyEntriesByPageId: Readonly<Record<string, readonly string[]>>;
  };
  pageLockRuntime: {
    stateProjection: "single-readonly-snapshot-per-revision";
    storageRecordsPerSnapshot: readonly ["structure", "page", "source", "parents"];
    maxStorageReadsPerRevision: 4;
    memoizeInheritedResolution: true;
    hoverGuideOwner: "title-source-page-column-actions-only";
    duplicateTreeAndFooterHoverGuides: false;
    duplicateSelectionAndCustomLockGuides: false;
    batchStateCommit: "single-lock-tree-and-registry-refresh-after-operation";
    writeAndServerRegistrySemantics: "unchanged";
  };
  scopes: readonly OptimizationAuditScope[];
  apps: readonly DeveloperTopLevelApp[];
  loadingSpeedLearning: DeveloperLoadingSpeedLearningContract;
  budgets: readonly {
    id: SharedOptimizationBudgetId;
    label: string;
    unit: string;
    warning: number;
    limit: number;
  }[];
  principles: readonly {
    id: string;
    label: string;
    rule: string;
  }[];
  gates: readonly (
    | "source-lock"
    | "eslint"
    | "typescript"
    | "knip"
    | "bundle-budget"
    | "media-policy"
    | "responsive"
    | "shared-contract"
    | "page-factory"
    | "github-pr"
  )[];
  githubPrEvidence: {
    schemaVersion: 1;
    requiredChecks: readonly string[];
    requiredCheckBindings: readonly {
      name: string;
      appSlug: "github-actions";
      workflowName: string;
      workflowPath: ".github/workflows/verify.yml";
      event: "pull_request";
    }[];
    acceptedReviewDecisions: readonly ["approved"];
    requireExactWorkflowBinding: true;
    ttlSeconds: number;
    repositoryBinding: "git-origin";
    requireCleanWorktree: true;
    requireHeadShaMatch: true;
    requireCurrentSourceFingerprint: true;
    requireCurrentTargetManifest: true;
    requireHqFingerprintVerification: true;
    requireTrustedCheckProvenance: true;
    requireOneTimeConsumption: true;
    consumeRevalidatesAuthoritativeState: true;
  };
};

const sharedContract = sharedContractData as SharedOptimizationContract;

export const DEVELOPER_TOP_LEVEL_APPS = sharedContract.apps;

export const DEVELOPER_NAVIGATION_ORDER_ALIASES = sharedContract.navigationOrderMigration.aliases;

export const DEVELOPER_NAVIGATION_ORDER_MIGRATION_CONTRACT_VERSION = sharedContract.navigationOrderMigration.effectiveContractVersion;

export const SHARED_OPTIMIZATION_CONTRACT = sharedContract;

export const DEVELOPER_LOADING_SPEED_LEARNING_CONTRACT = sharedContract.loadingSpeedLearning;

export const DEVELOPER_ROUTE_COMPOSITION_CONTRACT = sharedContract.routeComposition;

export function getDeveloperTopLevelApp(id: DeveloperTopLevelAppId) {
  return DEVELOPER_TOP_LEVEL_APPS.find((item) => item.id === id) ?? DEVELOPER_TOP_LEVEL_APPS[0];
}

export function getNextDeveloperTopLevelApp(id: DeveloperTopLevelAppId) {
  const currentIndex = DEVELOPER_TOP_LEVEL_APPS.findIndex((item) => item.id === id);
  if (currentIndex < 0 || currentIndex >= DEVELOPER_TOP_LEVEL_APPS.length - 1) return null;
  return DEVELOPER_TOP_LEVEL_APPS[currentIndex + 1];
}

export function getDeveloperLoadingSpeedApplicationPlan(id: DeveloperTopLevelAppId) {
  const plan = DEVELOPER_LOADING_SPEED_LEARNING_CONTRACT.applicationPlans.find((item) => item.appId === id);
  if (!plan) throw new Error(`Developer loading-speed application plan is missing: ${id}`);
  return plan;
}

export function getDeveloperLoadingSpeedRulesForApp(id: DeveloperTopLevelAppId) {
  const plan = getDeveloperLoadingSpeedApplicationPlan(id);
  return plan.ruleIds.map((ruleId) => {
    const rule = DEVELOPER_LOADING_SPEED_LEARNING_CONTRACT.rules.find((item) => item.id === ruleId);
    if (!rule) throw new Error(`Developer loading-speed rule is missing: ${ruleId}`);
    return rule;
  });
}

export function getSharedOptimizationBudget(id: SharedOptimizationBudgetId) {
  return SHARED_OPTIMIZATION_CONTRACT.budgets.find((budget) => budget.id === id);
}

export function getRequiredSharedOptimizationBudget(id: SharedOptimizationBudgetId) {
  const budget = getSharedOptimizationBudget(id);
  if (!budget
    || !Number.isFinite(budget.warning)
    || budget.warning < 0
    || !Number.isFinite(budget.limit)
    || budget.limit <= budget.warning
    || !budget.unit.trim()) {
    throw new Error(`Shared optimization budget is missing or invalid: ${id}`);
  }
  return budget;
}
