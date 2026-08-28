import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  Factory,
  FileCheck2,
  History,
  Layers3,
  Rocket,
  ShieldAlert,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DeveloperGlobalFrameWorkflowCoordinatorBridge } from "@/components/developer-platform/DeveloperGlobalFrameWorkflowCoordinatorBridge";
import { inspectDeveloperGlobalFrameAuthoringRuntimeEvidence } from "@/lib/developer-global-frame-authoring-evidence";
import { inspectLocalRuntimeReadiness, inspectSharedContractHealth } from "@/lib/shared-contract-health";
import {
  consumeGlobalFrameWorkflowStatusHandoff,
  GLOBAL_FRAME_WORKFLOW_STATUS_EVENT,
  requestGlobalFrameWorkflowAction,
  requestVisualPageEditorOpen,
  type GlobalFrameReleaseAuthorization,
  type GlobalFrameWorkflowAction,
  type GlobalFrameWorkflowStatusDetail,
} from "@/lib/visual-page-editor-events";
import {
  UNIFIED_PAGE_FRAME_BASELINES,
  UNIFIED_PAGE_FRAME_BATCHES,
  UNIFIED_PAGE_FRAME_CONTRACT,
} from "@/lib/unified-page-frame-contract";
import type { DeveloperWorkflowScope } from "@/lib/developer-workflow-run";
import {
  createInitialUnifiedFrameWorkflow,
  getUnifiedFrameWorkflowStorageKey,
  isUnifiedFrameWorkflowScopeState,
  readUnifiedFrameWorkflow,
  UNIFIED_FRAME_WORKFLOW_STAGE_ORDER,
  type UnifiedFrameWorkflowStage as WorkflowStage,
  type UnifiedFrameWorkflowState as WorkflowState,
  type UnifiedFrameWorkflowVerificationStatus as VerificationStatus,
} from "@/lib/unified-frame-workflow-session";

const SHA256 = /^[0-9a-f]{64}$/u;

type UnifiedFrameMigrationWorkbenchProps = {
  pathname: string;
  search: string;
  sourceLabel: string;
  readOnly: boolean;
  writeLocked: boolean;
  structureLocked: boolean;
  workflowScope?: DeveloperWorkflowScope;
  workflowScopeIdentity: string;
  releaseAuthorization?: GlobalFrameReleaseAuthorization | null;
};

type WorkflowStep = { stage: Exclude<WorkflowStage, "complete">; label: string };

const PAGE_WORKFLOW_STEPS: readonly WorkflowStep[] = [
  { stage: "inspect", label: "检查当前页" },
  { stage: "visual", label: "可视化编辑" },
];

const GLOBAL_WORKFLOW_STEPS: readonly WorkflowStep[] = [
  { stage: "inspect", label: "检查当前页" },
  { stage: "visual", label: "可视化编辑" },
  { stage: "draft", label: "生成全局草稿" },
  { stage: "preflight", label: "三源可信验收" },
  { stage: "sync", label: "同步通过页面" },
  { stage: "publish", label: "发布并下发 client" },
  { stage: "factory-default", label: "保存 client 发布默认" },
];

function getNextStage(action: GlobalFrameWorkflowAction): WorkflowStage {
  if (action === "generate-draft") return "preflight";
  if (action === "preflight") return "sync";
  if (action === "sync-passed-pages") return "publish";
  if (action === "publish-three-end") return "factory-default";
  return "complete";
}

function getStageAction(stage: WorkflowStage): Exclude<GlobalFrameWorkflowAction, "generate-draft"> | null {
  if (stage === "preflight") return "preflight";
  if (stage === "sync") return "sync-passed-pages";
  if (stage === "publish") return "publish-three-end";
  if (stage === "factory-default") return "save-factory-default";
  return null;
}

function requiresReleaseAuthorization(action: Exclude<GlobalFrameWorkflowAction, "generate-draft">) {
  return action === "sync-passed-pages" || action === "publish-three-end" || action === "save-factory-default";
}

function hasLiveReleaseAuthorization(authorization: GlobalFrameReleaseAuthorization | null) {
  return Boolean(authorization && Date.parse(authorization.expiresAt) > Date.now());
}

function getExpectedStatusAction(stage: WorkflowStage): GlobalFrameWorkflowAction | null {
  if (stage === "draft") return "generate-draft";
  return getStageAction(stage);
}

function getPrimaryLabel(stage: WorkflowStage, status: VerificationStatus, scope: DeveloperWorkflowScope = "global") {
  if (scope === "page") {
    if (status === "running") return "正在检查当前页";
    if (stage === "inspect") return `${status === "blocked" ? "重新：" : "下一步："}检查当前页`;
    return "打开/继续编辑当前页";
  }
  if (status === "running") {
    if (stage === "inspect") return "正在检查当前页";
    if (stage === "preflight") return "正在读取三源可信验收";
    if (stage === "sync") return "正在同步通过页面";
    if (stage === "publish") return "正在发布并下发 client 实例";
    if (stage === "factory-default") return "正在保存 client 发布默认";
  }
  if (status === "waiting") {
    if (stage === "publish") return "刷新审核与发布状态";
    if (stage === "factory-default") return "刷新下发状态";
  }
  const prefix = status === "blocked" ? "重新：" : "下一步：";
  if (stage === "inspect") return `${prefix}检查当前页`;
  if (stage === "visual") return `${prefix}打开可视化编辑`;
  if (stage === "draft") return `${prefix}生成全局草稿`;
  if (stage === "preflight") return `${prefix}三源可信验收`;
  if (stage === "sync") return `${prefix}同步已通过页面`;
  if (stage === "publish") return "确认发布并下发 client";
  if (stage === "factory-default") return "保存为 client 发布默认";
  return "全局框架流程已完成";
}

function applyWorkflowStatus(
  current: WorkflowState,
  detail: GlobalFrameWorkflowStatusDetail,
  workflowScopeIdentity: string,
): WorkflowState {
  if (!isUnifiedFrameWorkflowScopeState(current, workflowScopeIdentity, "global")) return current;
  const expectedAction = getExpectedStatusAction(current.stage);
  if (detail.action !== expectedAction) return current;
  if (detail.action === "generate-draft") {
    if (detail.status === "passed" && (!detail.draftId || !detail.recoveryPointId)) return current;
  } else {
    if (!detail.draftId || !current.draftId || detail.draftId !== current.draftId) return current;
    if (detail.status !== "running" && detail.status !== "blocked"
      && (!detail.baseHash || !SHA256.test(detail.baseHash)
        || !detail.releaseHash || !SHA256.test(detail.releaseHash))) return current;
    if (current.baseHash && detail.baseHash && current.baseHash !== detail.baseHash) return current;
    if (current.releaseHash && detail.releaseHash && current.releaseHash !== detail.releaseHash) return current;
  }
  const validationEntries = [
    ...current.validationEntries,
    detail.message,
    ...(detail.validationEntries || []),
  ].slice(-8);
  const shared: WorkflowState = {
    ...current,
    status: detail.status,
    draftId: detail.draftId || current.draftId,
    baseVersion: detail.baseVersion || current.baseVersion,
    baseHash: detail.baseHash || current.baseHash,
    releaseVersion: detail.releaseVersion || current.releaseVersion,
    releaseHash: detail.releaseHash || current.releaseHash,
    recoveryPointId: detail.recoveryPointId || current.recoveryPointId,
    targets: detail.targets || current.targets,
    isolatedPageIds: detail.isolatedPageIds || current.isolatedPageIds,
    validationEntries,
  };
  if (detail.status === "blocked") {
    return { ...shared, issues: [detail.message, ...(detail.validationEntries || [])] };
  }
  if (detail.status === "running" || detail.status === "waiting") return shared;
  return {
    ...shared,
    stage: getNextStage(detail.action),
    status: "passed",
    issues: [],
  };
}

export function UnifiedFrameMigrationWorkbench({
  pathname,
  search,
  sourceLabel,
  readOnly,
  writeLocked,
  structureLocked,
  workflowScope = "global",
  workflowScopeIdentity,
  releaseAuthorization = null,
}: UnifiedFrameMigrationWorkbenchProps) {
  const currentRoute = `${pathname}${search || ""}`;
  const [workflow, setWorkflow] = useState<WorkflowState>(() => typeof window === "undefined"
    ? createInitialUnifiedFrameWorkflow(currentRoute, workflowScope, workflowScopeIdentity)
    : readUnifiedFrameWorkflow(window.sessionStorage, currentRoute, workflowScope, workflowScopeIdentity));
  const currentBaseline = useMemo(
    () => UNIFIED_PAGE_FRAME_BASELINES.find((item) => item.route === currentRoute) ?? null,
    [currentRoute],
  );
  const writeBlocked = readOnly || writeLocked;
  const workflowSteps = workflowScope === "global" ? GLOBAL_WORKFLOW_STEPS : PAGE_WORKFLOW_STEPS;

  useEffect(() => {
    setWorkflow(readUnifiedFrameWorkflow(window.sessionStorage, currentRoute, workflowScope, workflowScopeIdentity));
  }, [currentRoute, workflowScope, workflowScopeIdentity]);

  useEffect(() => {
    if (typeof window === "undefined"
      || !isUnifiedFrameWorkflowScopeState(workflow, workflowScopeIdentity, workflowScope)) return;
    window.sessionStorage.setItem(
      getUnifiedFrameWorkflowStorageKey(workflowScopeIdentity, workflowScope),
      JSON.stringify(workflow),
    );
  }, [workflow, workflowScope, workflowScopeIdentity]);

  useEffect(() => {
    if (workflowScope !== "global") return;
    const applyStatus = (detail: GlobalFrameWorkflowStatusDetail | null) => {
      if (!detail || detail.pathname !== pathname || detail.search !== search) return;
      setWorkflow((current) => applyWorkflowStatus(current, detail, workflowScopeIdentity));
    };
    const handleStatus = (event: Event) => {
      applyStatus((event as CustomEvent<GlobalFrameWorkflowStatusDetail>).detail);
    };
    applyStatus(consumeGlobalFrameWorkflowStatusHandoff(window.sessionStorage, { pathname, search }));
    window.addEventListener(GLOBAL_FRAME_WORKFLOW_STATUS_EVENT, handleStatus);
    return () => window.removeEventListener(GLOBAL_FRAME_WORKFLOW_STATUS_EVENT, handleStatus);
  }, [pathname, search, workflowScope, workflowScopeIdentity]);

  const runCurrentPageVerification = async () => {
    const verificationScope = workflowScope;
    setWorkflow((current) => isUnifiedFrameWorkflowScopeState(current, workflowScopeIdentity, verificationScope)
      ? {
          ...current,
          status: "running",
          issues: [],
          validationEntries: [...current.validationEntries, "开始检查当前页共享契约与本地运行环境。"].slice(-8),
        }
      : current);
    const authoringEvidence = inspectDeveloperGlobalFrameAuthoringRuntimeEvidence({ pathname, search });
    const structural = inspectSharedContractHealth({ pathname, search });
    const runtime = await inspectLocalRuntimeReadiness();
    const nextIssues = [
      ...authoringEvidence.checks.filter((check) => check.status === "issue").map((check) => `${check.label}：${check.detail}`),
      ...(runtime.status === "passed" ? [] : [`${runtime.label}：${runtime.detail}`]),
      ...(writeBlocked ? ["当前页面处于只读、页面锁或源码锁状态，只允许检查，不能进入可视化编辑。"] : []),
    ];
    const legacyDiagnostics = structural.checks
      .filter((check) => check.status === "issue")
      .map((check) => `兼容诊断（不替代新版运行时门禁）· ${check.label}：${check.detail}`);
    const passed = authoringEvidence.passed && runtime.status === "passed" && !writeBlocked;
    setWorkflow((current) => isUnifiedFrameWorkflowScopeState(current, workflowScopeIdentity, verificationScope)
      ? {
          ...current,
          stage: passed ? "visual" : "inspect",
          status: passed ? "passed" : "blocked",
          issues: nextIssues,
          validationEntries: [
            ...current.validationEntries,
            `新版运行时证据 ${authoringEvidence.version}：${authoringEvidence.pageFactoryId || "未解析"} · ${authoringEvidence.adapterId || "无适配器"}。`,
            ...legacyDiagnostics,
            ...(workflowScope !== "global" ? [] : ["发布门提示：完成 02–06 后，到 08 只读核对源码锁、页面硬锁与栏目锁均未阻断，再由唯一协调器同步发布。"]),
            passed ? `当前页基础检查通过，可以进入${verificationScope === "global" ? "全局" : "当前页面"}范围可视化编辑。` : "当前页检查未通过，页面保持隔离。",
          ].slice(-8),
        }
      : current);
  };

  const openVisual = () => {
    if (writeBlocked) return;
    const opened = requestVisualPageEditorOpen({
      pathname,
      search,
      initialApplicationScope: workflowScope === "global" ? "global" : "current-page",
      applicationScopeLock: workflowScope === "global" ? "global" : "current-page",
      workflowOrigin: workflowScope === "global" ? "global-frame-workbench" : undefined,
    });
    if (!opened) return;
    setWorkflow((current) => isUnifiedFrameWorkflowScopeState(current, workflowScopeIdentity, workflowScope)
      ? {
          ...current,
          stage: workflowScope === "global" ? "draft" : "visual",
          status: workflowScope === "global" ? "idle" : "passed",
          validationEntries: [...current.validationEntries, `已打开${workflowScope === "global" ? "全局" : "当前页面"}范围可视化；开发器工作流保持挂载。`].slice(-8),
        }
      : current);
  };

  const runCoordinatorAction = () => {
    if (workflowScope !== "global"
      || !isUnifiedFrameWorkflowScopeState(workflow, workflowScopeIdentity, "global")) return;
    const action = getStageAction(workflow.stage);
    if (!action || writeBlocked) return;
    if (requiresReleaseAuthorization(action) && !hasLiveReleaseAuthorization(releaseAuthorization)) {
      setWorkflow((current) => isUnifiedFrameWorkflowScopeState(current, workflowScopeIdentity, "global")
        ? {
            ...current,
            status: "blocked",
            issues: ["当前发布门未授权：请依次通过 02–06，再到 08 页面锁定器执行只读核对。"],
            validationEntries: [...current.validationEntries, "同步、发布和保存发布默认必须携带当前执行记录的 02–06 证据与 08 新鲜回执。"].slice(-8),
          }
        : current);
      return;
    }
    setWorkflow((current) => isUnifiedFrameWorkflowScopeState(current, workflowScopeIdentity, "global")
      ? {
          ...current,
          status: "running",
          issues: [],
          validationEntries: [...current.validationEntries, `已提交“${getPrimaryLabel(current.stage, "idle").replace("下一步：", "")}”请求，等待唯一发布协调器返回结果。`].slice(-8),
        }
      : current);
    requestGlobalFrameWorkflowAction({
      pathname,
      search,
      action,
      contractVersion: UNIFIED_PAGE_FRAME_CONTRACT.version,
      draftId: workflow.draftId,
      baseVersion: workflow.baseVersion,
      baseHash: workflow.baseHash,
      recoveryPointId: workflow.recoveryPointId,
      releaseAuthorization: requiresReleaseAuthorization(action) ? releaseAuthorization : null,
    });
  };

  const runPrimaryAction = () => {
    if (!isUnifiedFrameWorkflowScopeState(workflow, workflowScopeIdentity, workflowScope)) return;
    if (workflow.stage === "inspect") {
      void runCurrentPageVerification();
      return;
    }
    if (workflowScope === "page") {
      if (workflow.stage === "visual") openVisual();
      return;
    }
    if (workflow.stage === "visual" || workflow.stage === "draft") {
      openVisual();
      return;
    }
    runCoordinatorAction();
  };

  const currentStageOrder = UNIFIED_FRAME_WORKFLOW_STAGE_ORDER[workflow.stage];
  const currentCoordinatorAction = workflowScope === "global" ? getStageAction(workflow.stage) : null;
  const releaseAuthorizationRequired = Boolean(currentCoordinatorAction && requiresReleaseAuthorization(currentCoordinatorAction));
  const releaseAuthorizationValid = hasLiveReleaseAuthorization(releaseAuthorization);
  const primaryDisabled = !isUnifiedFrameWorkflowScopeState(workflow, workflowScopeIdentity, workflowScope)
    || workflow.status === "running"
    || (workflowScope === "global" && workflow.stage === "complete")
    || (releaseAuthorizationRequired && !releaseAuthorizationValid)
    || ((workflow.stage === "visual" || workflow.stage === "draft") && writeBlocked);

  return (
    <section
      data-unified-frame-migration-workbench
      data-developer-workflow-scope={workflowScope}
      data-global-frame-workbench
      data-global-frame-workflow-stage={workflow.stage}
      data-global-frame-workflow-status={workflow.status}
      data-unified-frame-contract={UNIFIED_PAGE_FRAME_CONTRACT.version}
      data-unified-frame-release-mode={workflowScope === "global" ? "batch-gated" : "current-page-only"}
      data-unified-frame-business-boundary="preserve"
      data-development-standard-sidebar-route-disclosure="route-owned-single-disclosure"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {workflowScope === "global" ? <DeveloperGlobalFrameWorkflowCoordinatorBridge pathname={pathname} search={search} releaseAuthorization={releaseAuthorization} /> : null}
      <header className="shrink-0 border-b border-current/15 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">{workflowScope === "global" ? "全局框架开发" : "当前页框架开发"}</h3>
            <p className="mt-1 text-[11px] leading-5 opacity-70">{workflowScope === "global" ? "当前页检查、可视化草稿、三源页面可信验收、通过页同步、共享版本发布、client 实例下发与发布默认确认使用同一条版本化工作流。" : "只检查和编辑当前路由；保存当前页覆盖层，不生成全局草稿，也不进入同步、发布或 client 发布默认链。"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="rounded-full border border-current/20 px-2 py-1">契约 {UNIFIED_PAGE_FRAME_CONTRACT.version}</span>
            {workflowScope === "global" ? <><span data-global-frame-draft-id className="rounded-full border border-current/20 px-2 py-1">草稿 {workflow.draftId || "待生成"}</span><span data-global-frame-release-version className="rounded-full border border-current/20 px-2 py-1">发布 {workflow.releaseVersion || "未发布"}</span></> : <span data-current-page-frame-boundary className="rounded-full border border-current/20 px-2 py-1">仅当前页</span>}
          </div>
        </div>

        <ol data-global-frame-workflow-steps data-unified-frame-workflow-steps={workflowScope} className={`mt-3 grid gap-1 ${workflowScope === "global" ? "sm:grid-cols-4 xl:grid-cols-7" : "sm:grid-cols-2"}`}>
          {workflowSteps.map((item, index) => {
            const order = UNIFIED_FRAME_WORKFLOW_STAGE_ORDER[item.stage];
            const completed = currentStageOrder > order;
            const active = currentStageOrder === order || (workflow.stage === "complete" && index === workflowSteps.length - 1);
            return <li key={item.stage} data-global-frame-workflow-step={item.stage} data-global-frame-workflow-step-state={completed ? "completed" : active ? workflow.status : "pending"} className={`rounded-md border px-2 py-1.5 text-[10px] ${active ? "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950/30 dark:text-blue-100" : "border-current/15"}`}><b>{String(index + 1).padStart(2, "0")}</b><span className="ml-1">{item.label}</span>{completed ? <CheckCircle2 className="ml-1 inline h-3 w-3 text-emerald-500" /> : null}</li>;
          })}
        </ol>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button data-unified-frame-next-step data-global-frame-primary-action type="button" size="sm" onClick={runPrimaryAction} disabled={primaryDisabled}>
            {workflow.stage === "visual" || workflow.stage === "draft" ? <Eye className="mr-1 h-3.5 w-3.5" /> : workflow.stage === "publish" ? <Rocket className="mr-1 h-3.5 w-3.5" /> : workflow.stage === "factory-default" || workflow.stage === "complete" ? <Factory className="mr-1 h-3.5 w-3.5" /> : <ShieldAlert className="mr-1 h-3.5 w-3.5" />}
            {getPrimaryLabel(workflow.stage, workflow.status, workflowScope)}
          </Button>
          {releaseAuthorizationRequired ? <span data-global-frame-release-authorization={releaseAuthorizationValid ? "passed" : "required"} className="self-center text-[10px] opacity-70">{releaseAuthorizationValid ? `发布门已核对 · ${releaseAuthorization!.lockReceiptId}` : "需先完成 02–06，并到 08 核对发布门"}</span> : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3" data-page-list-scroll-owner data-shared-scroll-contract="table-inner-60">
        <section className="grid gap-3 lg:grid-cols-2">
          <article className="rounded-lg border border-current/15 p-3">
            <h4 className="text-xs font-semibold">当前页面</h4>
            <p className="mt-1 break-all text-[11px] opacity-70">{sourceLabel} · {currentRoute}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
              <span className="rounded-full border border-current/20 px-2 py-1">{currentBaseline ? `基准：${currentBaseline.label}` : "普通项目页"}</span>
              <span className="rounded-full border border-current/20 px-2 py-1">栏目锁：{structureLocked ? "已启用" : "未启用"}</span>
              <span className="rounded-full border border-current/20 px-2 py-1">写入：{writeBlocked ? "已阻止" : "工作流受控"}</span>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[11px]">
              {workflow.status === "passed" || workflow.stage === "complete" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <ShieldAlert className="h-4 w-4 text-amber-500" />}
              状态：{workflow.status === "running" ? "处理中" : workflow.status === "waiting" ? "等待外部审核或下发完成" : workflow.status === "blocked" ? "当前阶段已隔离" : workflow.stage === "complete" ? "发布与 client 发布默认已完成" : getPrimaryLabel(workflow.stage, "idle", workflowScope).replace("下一步：", "等待")}
            </p>
            {workflow.issues.length ? <ul className="mt-2 list-disc space-y-1 pl-4 text-[10px] leading-4 text-amber-700 dark:text-amber-300">{workflow.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}
          </article>

          <article className="rounded-lg border border-current/15 p-3">
            <h4 className="text-xs font-semibold">{workflowScope === "global" ? "发布边界" : "当前页编辑边界"}</h4>
            {workflowScope === "global" ? <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] leading-5 opacity-75">
              <li>可视化只生成版本草稿，不直接审核、发布或下发运行实例。</li>
              <li>总部、代理、客户三源目标页必须使用同一候选 section 完成全部规范视口验收；页面和视口数量以权威目标清单为准。</li>
              <li>失败页面保持原版本并进入隔离清单，仅同步已通过页面。</li>
              <li>正式发布和 client 实例下发成功后才能保存 client 发布默认；业务内容、数据和素材始终不迁移。</li>
            </ol> : <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] leading-5 opacity-75">
              <li>当前页检查只读取本机路由、共享契约和运行时证据。</li>
              <li>可视化编辑只写入当前页覆盖层，其他页面继续继承全局框架。</li>
              <li>要同步多页、发布或保存 client 发布默认，请切换到“全局”范围。</li>
            </ol>}
          </article>
        </section>

        {workflowScope === "global" ? <section data-global-frame-status-panels className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <article data-global-frame-impact-pages className="rounded-lg border border-current/15 p-3 text-[10px] leading-4">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold"><Users className="h-3.5 w-3.5" />三源页面目标</h4>
            <p className="mt-2">目标 {workflow.targets.total} · 通过 {workflow.targets.passed} · 隔离 {workflow.targets.isolated}</p>
            <p className="mt-1 opacity-60">这里是页面数，不是实例数；仅可信凭据确认的 compatibleTargetPageIds 会进入同步。实例阶段仅显示 client 批次，代理不在本批，总部无实例下发。</p>
          </article>
          <article data-global-frame-isolation-list className="rounded-lg border border-current/15 p-3 text-[10px] leading-4">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold"><Layers3 className="h-3.5 w-3.5" />隔离清单</h4>
            <p className="mt-2 break-all">{workflow.isolatedPageIds.length ? workflow.isolatedPageIds.slice(0, 4).join("、") : "暂无隔离页面"}</p>
            {workflow.isolatedPageIds.length > 4 ? <p className="mt-1 opacity-60">另有 {workflow.isolatedPageIds.length - 4} 页</p> : null}
          </article>
          <article data-global-frame-recovery-point className="rounded-lg border border-current/15 p-3 text-[10px] leading-4">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold"><History className="h-3.5 w-3.5" />恢复点</h4>
            <p className="mt-2 break-all">{workflow.recoveryPointId || "正式发布后建立"}</p>
            <p className="mt-1 break-all opacity-60">{workflow.releaseHash ? `hash ${workflow.releaseHash}` : workflow.baseHash ? `基础 hash ${workflow.baseHash}` : "等待版本/hash预检"}</p>
          </article>
          <article data-global-frame-validation-log className="rounded-lg border border-current/15 p-3 text-[10px] leading-4">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold"><FileCheck2 className="h-3.5 w-3.5" />验证日记</h4>
            <p className="mt-2">{workflow.validationEntries.at(-1)}</p>
            <p className="mt-1 opacity-60">已记录 {workflow.validationEntries.length} 条当前会话结果</p>
          </article>
        </section> : null}

        {workflowScope === "global" ? <><section className="mt-3 rounded-lg border border-current/15 p-3" data-unified-frame-baseline-gate>
          <h4 className="text-xs font-semibold">五个基准页</h4>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {UNIFIED_PAGE_FRAME_BASELINES.map((item, index) => <article key={item.id} className="rounded-md border border-current/15 px-2 py-2 text-[10px] leading-4"><b>{String(index + 1).padStart(2, "0")} · {item.label}</b><p className="mt-1 opacity-65">{item.role}</p></article>)}
          </div>
        </section>

        <section className="mt-3 rounded-lg border border-current/15 p-3" data-unified-frame-batch-plan>
          <h4 className="text-xs font-semibold">分批迁移顺序</h4>
          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {UNIFIED_PAGE_FRAME_BATCHES.map((batch) => <article key={batch.id} className="rounded-md border border-current/15 px-2 py-2 text-[10px] leading-4"><b>{batch.order} · {batch.label}</b><p className="mt-1 opacity-65">{batch.scope}</p></article>)}
          </div>
        </section></> : null}

      </div>
    </section>
  );
}
