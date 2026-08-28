export const DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION = "1.0.0" as const;

export const DEVELOPER_GLOBAL_STYLE_REFERENCE_PAGE_ID = "product-market:operations" as const;
export const DEVELOPER_GLOBAL_STYLE_PILOT_PAGE_ID = "client-source:social:marketing-playbook" as const;

export const DEVELOPER_GLOBAL_STYLE_PILOT_CHECK_IDS = [
  "workspace-annotation",
  "table-shell-annotation",
  "spacing-parity",
  "right-edge-parity",
] as const;

export type DeveloperGlobalStylePilotCheckId = (typeof DEVELOPER_GLOBAL_STYLE_PILOT_CHECK_IDS)[number];

export const DEVELOPER_GLOBAL_STYLE_WIZARD_STAGES = [
  {
    id: "preflight",
    order: "01",
    label: "预检",
    description: "只读检查共享契约、运行时和页面工厂生命周期覆盖率。",
    requiresWriteAccess: false,
  },
  {
    id: "visual",
    order: "02",
    label: "打开真实可视化",
    description: "在当前真实页面上调整外观，不生成第二套模拟预览。",
    requiresWriteAccess: true,
  },
  {
    id: "recovery",
    order: "03",
    label: "差异/恢复点",
    description: "先分类影响，再建立只包含共享外观的草案与恢复点。",
    requiresWriteAccess: true,
  },
  {
    id: "pilot",
    order: "04",
    label: "营销作战试点",
    description: "只在营销作战验证主体标注、表内标注、间距和右侧边界。",
    requiresWriteAccess: true,
  },
  {
    id: "global-ready",
    order: "05",
    label: "全局共享准备",
    description: "试点通过后只准备可审计的全局共享草案，不直接发布。",
    requiresWriteAccess: true,
  },
] as const;

export type DeveloperGlobalStyleWizardStageId = (typeof DEVELOPER_GLOBAL_STYLE_WIZARD_STAGES)[number]["id"];

export type DeveloperGlobalStyleImpactKind =
  | "shared-frame"
  | "shared-appearance"
  | "shared-annotation"
  | "shared-spacing"
  | "shared-scroll"
  | "page-structure"
  | "page-content"
  | "business-data"
  | "assets"
  | "plugins"
  | "navigation"
  | "unknown";

export type DeveloperGlobalStyleImpactTarget = {
  id: string;
  label: string;
  kind: DeveloperGlobalStyleImpactKind;
};

export type DeveloperGlobalStyleImpactClassification = {
  sharedAppearanceTargets: DeveloperGlobalStyleImpactTarget[];
  protectedPageOwnedTargets: DeveloperGlobalStyleImpactTarget[];
  unknownTargets: DeveloperGlobalStyleImpactTarget[];
};

const SHARED_APPEARANCE_IMPACT_KINDS = new Set<DeveloperGlobalStyleImpactKind>([
  "shared-frame",
  "shared-appearance",
  "shared-annotation",
  "shared-spacing",
  "shared-scroll",
]);

const PROTECTED_PAGE_OWNED_IMPACT_KINDS = new Set<DeveloperGlobalStyleImpactKind>([
  "page-structure",
  "page-content",
  "business-data",
  "assets",
  "plugins",
  "navigation",
]);

export function classifyDeveloperGlobalStyleImpact(
  targets: readonly (DeveloperGlobalStyleImpactTarget | string)[],
): DeveloperGlobalStyleImpactClassification {
  return targets.reduce<DeveloperGlobalStyleImpactClassification>((classification, target, index) => {
    const normalized = typeof target === "string"
      ? { id: `unknown-${index + 1}`, label: target, kind: "unknown" as const }
      : target;
    if (SHARED_APPEARANCE_IMPACT_KINDS.has(normalized.kind)) {
      classification.sharedAppearanceTargets.push(normalized);
    } else if (PROTECTED_PAGE_OWNED_IMPACT_KINDS.has(normalized.kind)) {
      classification.protectedPageOwnedTargets.push(normalized);
    } else {
      classification.unknownTargets.push(normalized);
    }
    return classification;
  }, {
    sharedAppearanceTargets: [],
    protectedPageOwnedTargets: [],
    unknownTargets: [],
  });
}

export type DeveloperGlobalStyleProfileDraft = {
  contractVersion: typeof DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION;
  scope: "appearance-only";
  referencePageId: typeof DEVELOPER_GLOBAL_STYLE_REFERENCE_PAGE_ID;
  regions: readonly ["topbar", "workspace", "title", "table-shell", "table-header", "content", "footer", "scrollbar"];
  protectedOwnership: readonly ["page-structure", "page-content", "business-data", "assets", "plugins", "navigation"];
};

export const DEVELOPER_GLOBAL_STYLE_PROFILE_DRAFT: DeveloperGlobalStyleProfileDraft = {
  contractVersion: DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION,
  scope: "appearance-only",
  referencePageId: DEVELOPER_GLOBAL_STYLE_REFERENCE_PAGE_ID,
  regions: ["topbar", "workspace", "title", "table-shell", "table-header", "content", "footer", "scrollbar"],
  protectedOwnership: ["page-structure", "page-content", "business-data", "assets", "plugins", "navigation"],
};

export type DeveloperGlobalStyleAdapterPlan = {
  pageId: string;
  role: "reference" | "pilot" | "consumer";
  readsProfileVersion: typeof DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION;
  ownsStructure: true;
  allowedOverrides: readonly string[];
};

export const DEVELOPER_GLOBAL_STYLE_ADAPTER_EXAMPLE: DeveloperGlobalStyleAdapterPlan = {
  pageId: DEVELOPER_GLOBAL_STYLE_PILOT_PAGE_ID,
  role: "pilot",
  readsProfileVersion: DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION,
  ownsStructure: true,
  allowedOverrides: [],
};

export type DeveloperGlobalStyleWizardState = {
  contractVersion: typeof DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION;
  stageId: DeveloperGlobalStyleWizardStageId;
  readOnly: boolean;
  writeLocked: boolean;
  releaseMode: "draft-only";
  preflightStatus: "idle" | "running" | "passed" | "failed";
  preflightIssues: readonly string[];
  visualOpenedAt: string | null;
  visualConfirmedAt: string | null;
  visualAuditId: string | null;
  canaryProfileDraftId: string | null;
  recoveryDraftId: string | null;
  recoveryPointId: string | null;
  impactTargets: readonly DeveloperGlobalStyleImpactTarget[];
  pilotStatus: "idle" | "passed" | "failed";
  pilotChecks: readonly DeveloperGlobalStylePilotCheckId[];
  pilotVerificationId: string | null;
  pilotVerifiedAt: string | null;
  globalPreparationStatus: "idle" | "prepared";
  preparedSectionDraftId: string | null;
  preparedProfile: DeveloperGlobalStyleProfileDraft | null;
  lastError: string | null;
};

export type DeveloperGlobalStyleWizardAction =
  | { type: "access-changed"; readOnly: boolean; writeLocked: boolean }
  | { type: "preflight-started" }
  | { type: "preflight-completed"; passed: boolean; issues?: readonly string[] }
  | { type: "visual-opened"; openedAt?: string }
  | { type: "visual-confirmed"; scope: "canary-profile"; auditId: string; canaryProfileDraftId: string; confirmedAt?: string }
  | {
      type: "recovery-created";
      draftId: string;
      recoveryPointId: string;
      impactTargets: readonly DeveloperGlobalStyleImpactTarget[];
    }
  | {
      type: "pilot-completed";
      passed: boolean;
      checks?: readonly DeveloperGlobalStylePilotCheckId[];
      verificationId?: string;
      verifiedAt?: string;
    }
  | { type: "global-prepared"; sectionDraftId: string; profile?: DeveloperGlobalStyleProfileDraft }
  | { type: "reset" };

export function createDeveloperGlobalStyleWizardState(
  access: { readOnly?: boolean; writeLocked?: boolean } = {},
): DeveloperGlobalStyleWizardState {
  return {
    contractVersion: DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION,
    stageId: "preflight",
    readOnly: access.readOnly ?? false,
    writeLocked: access.writeLocked ?? false,
    releaseMode: "draft-only",
    preflightStatus: "idle",
    preflightIssues: [],
    visualOpenedAt: null,
    visualConfirmedAt: null,
    visualAuditId: null,
    canaryProfileDraftId: null,
    recoveryDraftId: null,
    recoveryPointId: null,
    impactTargets: [],
    pilotStatus: "idle",
    pilotChecks: [],
    pilotVerificationId: null,
    pilotVerifiedAt: null,
    globalPreparationStatus: "idle",
    preparedSectionDraftId: null,
    preparedProfile: null,
    lastError: null,
  };
}

function rejectTransition(state: DeveloperGlobalStyleWizardState, message: string): DeveloperGlobalStyleWizardState {
  return { ...state, lastError: message };
}

function isWriteTransition(action: DeveloperGlobalStyleWizardAction) {
  return action.type === "visual-opened"
    || action.type === "visual-confirmed"
    || action.type === "recovery-created"
    || action.type === "pilot-completed"
    || action.type === "global-prepared";
}

export function reduceDeveloperGlobalStyleWizardState(
  state: DeveloperGlobalStyleWizardState,
  action: DeveloperGlobalStyleWizardAction,
): DeveloperGlobalStyleWizardState {
  if (action.type === "reset") {
    return createDeveloperGlobalStyleWizardState({ readOnly: state.readOnly, writeLocked: state.writeLocked });
  }
  if (action.type === "access-changed") {
    return {
      ...state,
      readOnly: action.readOnly,
      writeLocked: action.writeLocked,
      lastError: action.readOnly || action.writeLocked ? "当前访问状态仅允许只读预检。" : null,
    };
  }
  if (isWriteTransition(action) && (state.readOnly || state.writeLocked)) {
    return rejectTransition(state, state.readOnly ? "当前来源端只读，不能推进写入步骤。" : "当前页面或源码已锁定，不能推进写入步骤。");
  }

  switch (action.type) {
    case "preflight-started":
      return { ...state, stageId: "preflight", preflightStatus: "running", preflightIssues: [], lastError: null };
    case "preflight-completed":
      return {
        ...state,
        stageId: action.passed ? "visual" : "preflight",
        preflightStatus: action.passed ? "passed" : "failed",
        preflightIssues: action.issues ?? [],
        lastError: action.passed ? null : "预检未通过；必须先处理差异。",
      };
    case "visual-opened":
      if (state.preflightStatus !== "passed") return rejectTransition(state, "必须先通过 01 预检。");
      return { ...state, stageId: "visual", visualOpenedAt: action.openedAt ?? new Date().toISOString(), lastError: null };
    case "visual-confirmed":
      if (!state.visualOpenedAt) return rejectTransition(state, "必须先打开真实可视化。");
      if (action.scope !== "canary-profile" || !action.auditId || !action.canaryProfileDraftId) {
        return rejectTransition(state, "必须由试点档案确认产生真实审计与共享外观草案。");
      }
      return {
        ...state,
        stageId: "recovery",
        visualConfirmedAt: action.confirmedAt ?? new Date().toISOString(),
        visualAuditId: action.auditId,
        canaryProfileDraftId: action.canaryProfileDraftId,
        lastError: null,
      };
    case "recovery-created":
      if (!state.visualConfirmedAt || !state.visualAuditId || !state.canaryProfileDraftId) return rejectTransition(state, "必须先确认真实可视化已按 canary-profile 保存共享外观档案与审计。");
      if (classifyDeveloperGlobalStyleImpact(action.impactTargets).unknownTargets.length) {
        return rejectTransition(state, "影响分类仍有未知项；必须完成归属后才能进入营销作战试点。");
      }
      return {
        ...state,
        stageId: "pilot",
        recoveryDraftId: action.draftId,
        recoveryPointId: action.recoveryPointId,
        impactTargets: action.impactTargets,
        lastError: null,
      };
    case "pilot-completed":
      if (!state.recoveryDraftId || !state.recoveryPointId) return rejectTransition(state, "必须先建立差异草案与恢复点。");
      if (action.passed && !DEVELOPER_GLOBAL_STYLE_PILOT_CHECK_IDS.every((checkId) => action.checks?.includes(checkId))) {
        return rejectTransition(state, "营销作战四项固定检查未完整通过，禁止进入全局共享准备。");
      }
      if (action.passed && (!action.verificationId || !action.verifiedAt || !Number.isFinite(Date.parse(action.verifiedAt)))) {
        return rejectTransition(state, "营销作战通过必须带真实验证编号和时间。");
      }
      return {
        ...state,
        stageId: action.passed ? "global-ready" : "pilot",
        pilotStatus: action.passed ? "passed" : "failed",
        pilotChecks: action.checks ?? [],
        pilotVerificationId: action.passed ? action.verificationId! : null,
        pilotVerifiedAt: action.passed ? action.verifiedAt! : null,
        lastError: action.passed ? null : "营销作战试点未通过，禁止准备全局共享。",
      };
    case "global-prepared":
      if (state.pilotStatus !== "passed") return rejectTransition(state, "只有营销作战试点通过后才能准备全局共享草案。");
      if (!action.sectionDraftId) return rejectTransition(state, "严格 developer_global_frame 草案尚未生成。");
      return {
        ...state,
        stageId: "global-ready",
        globalPreparationStatus: "prepared",
        preparedSectionDraftId: action.sectionDraftId,
        preparedProfile: action.profile ?? DEVELOPER_GLOBAL_STYLE_PROFILE_DRAFT,
        lastError: null,
      };
  }
}

export function canAdvanceDeveloperGlobalStyleWizard(
  state: DeveloperGlobalStyleWizardState,
  stageId: DeveloperGlobalStyleWizardStageId = state.stageId,
): boolean {
  if (stageId !== "preflight" && (state.readOnly || state.writeLocked)) return false;
  switch (stageId) {
    case "preflight": return state.preflightStatus === "passed";
    case "visual": return state.preflightStatus === "passed" && Boolean(state.visualConfirmedAt && state.visualAuditId && state.canaryProfileDraftId);
    case "recovery": return Boolean(state.recoveryDraftId && state.recoveryPointId);
    case "pilot": return state.pilotStatus === "passed";
    case "global-ready": return state.globalPreparationStatus === "prepared" && Boolean(state.preparedSectionDraftId);
  }
}

export function restoreDeveloperGlobalStyleWizardState(
  serialized: string | null,
  access: { readOnly?: boolean; writeLocked?: boolean } = {},
): DeveloperGlobalStyleWizardState {
  const fresh = createDeveloperGlobalStyleWizardState(access);
  if (!serialized) return fresh;
  try {
    const candidate = JSON.parse(serialized) as Partial<DeveloperGlobalStyleWizardState>;
    const validStage = DEVELOPER_GLOBAL_STYLE_WIZARD_STAGES.some((stage) => stage.id === candidate.stageId);
    if (candidate.contractVersion !== DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION || !validStage) return fresh;
    const impactTargets = Array.isArray(candidate.impactTargets)
      ? candidate.impactTargets.filter((target): target is DeveloperGlobalStyleImpactTarget => Boolean(
        target
        && typeof target === "object"
        && typeof target.id === "string"
        && typeof target.label === "string"
        && typeof target.kind === "string",
      ))
      : [];
    const pilotChecks = Array.isArray(candidate.pilotChecks)
      ? candidate.pilotChecks.filter((item): item is DeveloperGlobalStylePilotCheckId => DEVELOPER_GLOBAL_STYLE_PILOT_CHECK_IDS.includes(item as DeveloperGlobalStylePilotCheckId))
      : [];
    const preflightPassed = candidate.preflightStatus === "passed";
    const visualOpenedAt = typeof candidate.visualOpenedAt === "string" ? candidate.visualOpenedAt : null;
    const visualConfirmedAt = typeof candidate.visualConfirmedAt === "string" ? candidate.visualConfirmedAt : null;
    const visualAuditId = typeof candidate.visualAuditId === "string" ? candidate.visualAuditId : null;
    const canaryProfileDraftId = typeof candidate.canaryProfileDraftId === "string" ? candidate.canaryProfileDraftId : null;
    const visualConfirmed = preflightPassed && Boolean(visualOpenedAt && visualConfirmedAt && visualAuditId && canaryProfileDraftId);
    const recoveryDraftId = typeof candidate.recoveryDraftId === "string" ? candidate.recoveryDraftId : null;
    const recoveryPointId = typeof candidate.recoveryPointId === "string" ? candidate.recoveryPointId : null;
    const impact = classifyDeveloperGlobalStyleImpact(impactTargets);
    const recoveryReady = visualConfirmed
      && Boolean(recoveryDraftId && recoveryPointId)
      && impact.sharedAppearanceTargets.length > 0
      && impact.unknownTargets.length === 0;
    const pilotPassed = recoveryReady
      && candidate.pilotStatus === "passed"
      && DEVELOPER_GLOBAL_STYLE_PILOT_CHECK_IDS.every((checkId) => pilotChecks.includes(checkId))
      && typeof candidate.pilotVerificationId === "string"
      && candidate.pilotVerificationId.length > 0
      && typeof candidate.pilotVerifiedAt === "string"
      && Number.isFinite(Date.parse(candidate.pilotVerifiedAt));
    const safeStage: DeveloperGlobalStyleWizardStageId = pilotPassed
      ? "global-ready"
      : recoveryReady
        ? "pilot"
        : visualConfirmed
          ? "recovery"
          : preflightPassed
            ? "visual"
            : "preflight";
    const preparedSectionDraftId = typeof candidate.preparedSectionDraftId === "string" ? candidate.preparedSectionDraftId : null;
    const globalPrepared = pilotPassed && candidate.globalPreparationStatus === "prepared" && Boolean(preparedSectionDraftId);
    return {
      ...fresh,
      contractVersion: DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION,
      stageId: safeStage,
      readOnly: access.readOnly ?? false,
      writeLocked: access.writeLocked ?? false,
      releaseMode: "draft-only",
      preflightStatus: candidate.preflightStatus === "running" || candidate.preflightStatus === "passed" || candidate.preflightStatus === "failed" ? candidate.preflightStatus : "idle",
      preflightIssues: Array.isArray(candidate.preflightIssues) ? candidate.preflightIssues.filter((item): item is string => typeof item === "string") : [],
      visualOpenedAt,
      visualConfirmedAt: visualConfirmed ? visualConfirmedAt : null,
      visualAuditId: visualConfirmed ? visualAuditId : null,
      canaryProfileDraftId: visualConfirmed ? canaryProfileDraftId : null,
      recoveryDraftId: recoveryReady ? recoveryDraftId : null,
      recoveryPointId: recoveryReady ? recoveryPointId : null,
      impactTargets: recoveryReady ? impactTargets : [],
      pilotStatus: pilotPassed ? "passed" : candidate.pilotStatus === "failed" && recoveryReady ? "failed" : "idle",
      pilotChecks: pilotPassed ? pilotChecks : [],
      pilotVerificationId: pilotPassed ? candidate.pilotVerificationId as string : null,
      pilotVerifiedAt: pilotPassed ? candidate.pilotVerifiedAt as string : null,
      globalPreparationStatus: globalPrepared ? "prepared" : "idle",
      preparedSectionDraftId: globalPrepared ? preparedSectionDraftId : null,
      preparedProfile: globalPrepared ? DEVELOPER_GLOBAL_STYLE_PROFILE_DRAFT : null,
      lastError: null,
    };
  } catch {
    return fresh;
  }
}
