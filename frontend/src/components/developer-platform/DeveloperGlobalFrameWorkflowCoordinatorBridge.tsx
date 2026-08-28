import { useEffect, useRef } from "react";

import {
  DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS,
  isDeveloperGlobalFrameIntentionalIsolationPageId,
} from "@/lib/developer-global-frame-adapter-resolution";
import {
  buildDeveloperGlobalFrameSection,
} from "@/lib/developer-global-frame-draft";
import { DEVELOPER_GLOBAL_STYLE_PILOT_CHECK_IDS } from "@/lib/developer-global-style-contract";
import {
  buildDeveloperGlobalFrameFactoryDefaultReceipt,
  createDeveloperGlobalFrameLocalStateRepository,
  createDeveloperGlobalFrameReleaseCoordinator,
  createDeveloperGlobalFrameServerRepository,
  hashDeveloperGlobalFrameCanonicalValue,
  recordDeveloperGlobalFrameFactoryDefaultReceipt,
  type DeveloperGlobalFrameCoordinatorState,
  type DeveloperGlobalFramePageCheck,
} from "@/lib/developer-global-frame-release-coordinator";
import { readDeveloperGlobalFrameVisualDraft } from "@/lib/developer-global-style-session";
import {
  createDeveloperGlobalFrameAcceptanceJob,
  fetchDeveloperGlobalFrameAcceptanceArtifact,
  fetchDeveloperGlobalFrameAcceptanceJob,
  TemplateSnapshotRequestError,
} from "@/lib/template-snapshot/api";
import type {
  DeveloperGlobalFrameAcceptanceArtifact,
  DeveloperGlobalFrameAcceptanceJob,
} from "@/lib/template-snapshot/types";
import { UNIFIED_PAGE_FRAME_CONTRACT } from "@/lib/unified-page-frame-contract";
import {
  consumeGlobalFrameReleaseAuthorization,
  GLOBAL_FRAME_WORKFLOW_ACTION_EVENT,
  reportGlobalFrameWorkflowStatus,
  type GlobalFrameReleaseAuthorization,
  type GlobalFrameWorkflowAction,
  type GlobalFrameWorkflowActionDetail,
  type GlobalFrameWorkflowStatus,
} from "@/lib/visual-page-editor-events";
import { PAGE_FACTORY_PAGES } from "@/page-factory/page-factory";

const REQUESTED_PROFILE_VERSION = "1.0.0";
const ACCEPTANCE_VIEWPORTS = [1440, 1024, 390] as const;
const ACCEPTANCE_CASE_COUNT = PAGE_FACTORY_PAGES.length * ACCEPTANCE_VIEWPORTS.length;
const ACCEPTANCE_JOB_POLL_INTERVAL_MS = 2_500;

type BridgeProps = {
  pathname: string;
  search: string;
  releaseAuthorization: GlobalFrameReleaseAuthorization | null;
};

type AcceptanceBinding = {
  templateId: string;
  baseDraftHash: string;
  frameSectionHash: string;
  visualDraftId: string;
  recoveryPointId: string;
};

async function assertAcceptanceJobBinding(
  job: DeveloperGlobalFrameAcceptanceJob,
  expected: AcceptanceBinding,
) {
  const returnedSectionHash = await hashDeveloperGlobalFrameCanonicalValue(job.developerGlobalFrame);
  if (job.schemaVersion !== 1
    || job.templateId !== expected.templateId
    || job.sourceScope !== "client_source"
    || job.baseDraftHash !== expected.baseDraftHash
    || job.frameSectionHash !== expected.frameSectionHash
    || returnedSectionHash !== expected.frameSectionHash
    || job.visualDraftId !== expected.visualDraftId
    || job.recoveryPointId !== expected.recoveryPointId) {
    throw new Error("验收任务没有与当前冻结草稿、基础版本和精确框架 section 完整绑定。");
  }
}

function waitForAcceptanceJobPoll() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ACCEPTANCE_JOB_POLL_INTERVAL_MS));
}

function expectedCompatiblePageIds() {
  const registrations = new Map(
    DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS.map((entry) => [entry.pageFactoryId, entry]),
  );
  return PAGE_FACTORY_PAGES.filter((page) => {
    const registration = registrations.get(page.id);
    const intentionallyIsolated = isDeveloperGlobalFrameIntentionalIsolationPageId(page.id);
    return Boolean(!intentionallyIsolated && registration && registration.sourceScope === page.sourceScope);
  }).map((page) => page.id);
}

function formatAcceptanceSourceSummary(
  compatibleTargetPageIds: readonly string[],
  isolatedPageIds: readonly string[],
) {
  const compatible = new Set(compatibleTargetPageIds);
  const compatibleByScope = PAGE_FACTORY_PAGES.reduce((counts, page) => {
    if (compatible.has(page.id)) counts[page.sourceScope] += 1;
    return counts;
  }, { hq: 0, agency_source: 0, client_source: 0 });
  return `总部源 ${compatibleByScope.hq} 页、代理源 ${compatibleByScope.agency_source} 页、客户源 ${compatibleByScope.client_source} 页通过；${isolatedPageIds.length} 个技术/公开路由明确隔离。`;
}

function buildPageChecksFromAcceptance(
  artifact: DeveloperGlobalFrameAcceptanceArtifact,
): DeveloperGlobalFramePageCheck[] {
  const pages = new Map(PAGE_FACTORY_PAGES.map((page) => [page.id, page]));
  const compatible = new Set(artifact.compatibleTargetPageIds);
  const isolated = new Set(artifact.isolatedPageIds);
  if (artifact.valid !== true
    || artifact.schemaVersion !== 1
    || artifact.viewports.length !== ACCEPTANCE_VIEWPORTS.length
    || !ACCEPTANCE_VIEWPORTS.every((viewport, index) => artifact.viewports[index] === viewport)
    || artifact.caseResults.length !== PAGE_FACTORY_PAGES.length * ACCEPTANCE_VIEWPORTS.length
    || compatible.size !== artifact.compatibleTargetPageIds.length
    || isolated.size !== artifact.isolatedPageIds.length
    || [...compatible].some((pageId) => isolated.has(pageId))
    || new Set([...compatible, ...isolated]).size !== PAGE_FACTORY_PAGES.length
    || [...compatible, ...isolated].some((pageId) => !pages.has(pageId))) {
    throw new Error(`服务端验收凭据不是当前 ${PAGE_FACTORY_PAGES.length} 页 × ${ACCEPTANCE_VIEWPORTS.length} 视口的完整唯一结果。`);
  }
  const byPage = new Map<string, typeof artifact.caseResults>();
  for (const result of artifact.caseResults) {
    const page = pages.get(result.pageId);
    if (!page || page.sourceScope !== result.sourceScope) {
      throw new Error(`验收凭据包含未知或跨 source-scope 的页面：${result.pageId}`);
    }
    const results = byPage.get(result.pageId) ?? [];
    if (results.some((item) => item.viewport === result.viewport)) {
      throw new Error(`验收凭据包含重复视口：${result.pageId}/${result.viewport}`);
    }
    results.push(result);
    byPage.set(result.pageId, results);
  }
  return PAGE_FACTORY_PAGES.map((page) => {
    const results = byPage.get(page.id) ?? [];
    const passed = compatible.has(page.id);
    const expectedOutcome = passed ? "passed" : "isolated";
    if (results.length !== ACCEPTANCE_VIEWPORTS.length
      || !ACCEPTANCE_VIEWPORTS.every((viewport) => results.some((item) => item.viewport === viewport))
      || results.some((item) => item.outcome !== expectedOutcome)) {
      throw new Error(`验收凭据缺少页面三视口结果或处置不一致：${page.id}`);
    }
    return {
      pageId: page.id,
      passed,
      checkedAt: artifact.issuedAt,
      checkIds: ACCEPTANCE_VIEWPORTS.map((viewport) => `acceptance-${viewport}`),
      issues: passed ? [] : ["可信验收将此技术/公开路由明确隔离，保持原功能且不进入批量写入。"],
    };
  });
}

function targetSummary(state: DeveloperGlobalFrameCoordinatorState) {
  return {
    total: state.preflight.targets.length,
    passed: state.compatibleTargetPageIds.length,
    isolated: state.isolatedPageIds.length,
  };
}

function reportState(
  pathname: string,
  search: string,
  action: GlobalFrameWorkflowAction,
  status: GlobalFrameWorkflowStatus,
  message: string,
  state: DeveloperGlobalFrameCoordinatorState,
  validationEntries: string[] = [],
) {
  reportGlobalFrameWorkflowStatus({
    pathname,
    search,
    action,
    status,
    message,
    draftId: state.draftId,
    baseVersion: state.baseVersion || undefined,
    baseHash: state.baseDraftHash,
    releaseVersion: state.publishedVersion || state.submittedVersion || state.resolvedProfileVersion,
    releaseHash: state.artifactHash,
    recoveryPointId: state.recoveryPointId,
    targets: targetSummary(state),
    isolatedPageIds: [...state.isolatedPageIds],
    validationEntries,
  });
}

function isFailedState(state: DeveloperGlobalFrameCoordinatorState) {
  return state.stage === "preflight-blocked" || state.stage === "conflict" || state.stage === "failed";
}

function failureMessage(state: DeveloperGlobalFrameCoordinatorState) {
  return state.error?.message || state.preflight.issues.join("；") || "当前全局框架阶段未通过，页面保持隔离。";
}

export function DeveloperGlobalFrameWorkflowCoordinatorBridge({ pathname, search, releaseAuthorization }: BridgeProps) {
  const releaseAuthorizationRef = useRef(releaseAuthorization);

  useEffect(() => {
    releaseAuthorizationRef.current = releaseAuthorization;
  }, [releaseAuthorization]);

  useEffect(() => {
    let disposed = false;
    let running = false;
    const stateRepository = createDeveloperGlobalFrameLocalStateRepository(window.localStorage);
    const releaseRepository = createDeveloperGlobalFrameServerRepository();
    const coordinator = createDeveloperGlobalFrameReleaseCoordinator({
      releaseRepository,
      stateRepository,
      sourceScope: "client_source",
    });

    const handleAction = async (event: Event) => {
      const detail = (event as CustomEvent<GlobalFrameWorkflowActionDetail>).detail;
      if (!detail || detail.pathname !== pathname || detail.search !== search) return;
      if (detail.contractVersion !== UNIFIED_PAGE_FRAME_CONTRACT.version) {
        reportGlobalFrameWorkflowStatus({
          pathname,
          search,
          action: detail.action,
          status: "blocked",
          message: "全局框架契约版本已变化，请关闭并重新打开开发器。",
        });
        return;
      }
      if (detail.action !== "preflight"
        && !consumeGlobalFrameReleaseAuthorization(detail, releaseAuthorizationRef.current)) {
        reportGlobalFrameWorkflowStatus({
          pathname,
          search,
          action: detail.action,
          status: "blocked",
          message: "发布授权已缺失、过期或与当前执行记录不一致。请依次通过 02–06，再到 08 核对发布门后重试。",
          draftId: detail.draftId,
          recoveryPointId: detail.recoveryPointId,
        });
        return;
      }
      if (running) {
        reportGlobalFrameWorkflowStatus({
          pathname,
          search,
          action: detail.action,
          status: "waiting",
          message: "唯一发布协调器正在处理上一项请求，请等待结果。",
        });
        return;
      }
      running = true;
      reportGlobalFrameWorkflowStatus({
        pathname,
        search,
        action: detail.action,
        status: "running",
        message: "唯一发布协调器正在核对版本、hash、三源页面验收与 client 实例目标。",
        draftId: detail.draftId,
        recoveryPointId: detail.recoveryPointId,
      });

      try {
        if (!detail.draftId) throw new Error("缺少可视化全局草稿编号，请返回上一步重新生成草稿。");

        if (detail.action === "preflight") {
          const existing = coordinator.getState();
          if (existing?.draftId === detail.draftId
            && existing.stage === "prepared"
            && existing.acceptanceExpiresAt
            && Date.parse(existing.acceptanceExpiresAt) >= Date.now()) {
            reportState(pathname, search, detail.action, "passed", "三源页面可信验收已完成，可继续原子保存通过页面。", existing);
            return;
          }
          if (existing) coordinator.reset();

          const visualDraft = readDeveloperGlobalFrameVisualDraft(window.sessionStorage, {
            workspaceScope: "client_source",
            pathname,
            search,
            draftId: detail.draftId,
          });
          if (!visualDraft
            || !detail.recoveryPointId
            || detail.recoveryPointId !== visualDraft.recoveryPointId) {
            throw new Error("没有找到与 draftId、路由、全局作用域和恢复点完全一致的冻结外观草稿；请重新生成。");
          }
          const compatibleTargetPageIds = expectedCompatiblePageIds();
          const prepared = await coordinator.prepare({
            draftId: detail.draftId,
            requestedProfileVersion: REQUESTED_PROFILE_VERSION,
            requireExplicitTargetEvidence: true,
            async resolveAcceptanceEvidence(context) {
              const frameSectionHash = await hashDeveloperGlobalFrameCanonicalValue(context.section);
              const binding: AcceptanceBinding = {
                templateId: context.templateId,
                baseDraftHash: context.baseDraftHash,
                frameSectionHash,
                visualDraftId: context.draftId,
                recoveryPointId: context.section.recovery.recovery_point_id,
              };
              let acceptanceJobId: string | null = null;
              let artifact: DeveloperGlobalFrameAcceptanceArtifact;
              try {
                artifact = await fetchDeveloperGlobalFrameAcceptanceArtifact(context.templateId, binding);
              } catch (error) {
                if (!(error instanceof TemplateSnapshotRequestError) || error.status !== 404) throw error;
                let job = await createDeveloperGlobalFrameAcceptanceJob(context.templateId, {
                  baseDraftHash: context.baseDraftHash,
                  frameSectionHash,
                  visualDraftId: context.draftId,
                  recoveryPointId: context.section.recovery.recovery_point_id,
                  developerGlobalFrame: context.section,
                });
                acceptanceJobId = job.acceptanceJobId;
                await assertAcceptanceJobBinding(job, binding);
                reportGlobalFrameWorkflowStatus({
                  pathname,
                  search,
                  action: detail.action,
                  status: "waiting",
                  message: `可信验收任务 ${job.acceptanceJobId} 已进入队列；任务会在后台完成 ${PAGE_FACTORY_PAGES.length} 页 × ${ACCEPTANCE_VIEWPORTS.length} 视口检查，关闭弹窗也不会取消。`,
                  draftId: detail.draftId,
                  recoveryPointId: detail.recoveryPointId,
                });
                while (job.status === "pending" || job.status === "running") {
                  if (disposed) throw new Error("当前页面已离开；可信验收任务仍在后台继续，可稍后重新打开并查询同一任务。");
                  if (Date.parse(job.expiresAt) <= Date.now()) {
                    throw new Error(`可信验收任务 ${job.acceptanceJobId} 已超过服务端有效期，当前候选不会进入发布链。`);
                  }
                  await waitForAcceptanceJobPoll();
                  job = await fetchDeveloperGlobalFrameAcceptanceJob(context.templateId, job.acceptanceJobId);
                  await assertAcceptanceJobBinding(job, binding);
                }
                if (job.status === "failed") {
                  throw new Error(`可信验收任务失败：${job.lastErrorMessage || job.lastErrorCode || "工作器未返回具体原因"}`);
                }
                if (job.status !== "succeeded" || !job.acceptanceArtifactId || !job.reportHash) {
                  throw new Error(`可信验收任务状态为 ${job.status}，没有形成可发布的服务端验收凭证。`);
                }
                artifact = await fetchDeveloperGlobalFrameAcceptanceArtifact(context.templateId, binding);
              }
              if (artifact.templateId !== context.templateId
                || artifact.sourceScope !== context.sourceScope
                || artifact.baseDraftHash !== context.baseDraftHash
                || artifact.frameSectionHash !== frameSectionHash
                || artifact.visualDraftId !== context.draftId
                || artifact.recoveryPointId !== context.section.recovery.recovery_point_id
                || (acceptanceJobId !== null && artifact.acceptanceJobId !== acceptanceJobId)
                || artifact.failureCount !== 0
                || artifact.flakyCount !== 0
                || artifact.skippedCount !== 0) {
                throw new Error("服务端可信验收凭据没有绑定当前冻结草稿、基础版本与精确框架 section。");
              }
              return {
                acceptanceArtifactId: artifact.acceptanceArtifactId,
                acceptanceArtifactHash: artifact.reportHash,
                issuedAt: artifact.issuedAt,
                expiresAt: artifact.expiresAt,
                pageChecks: buildPageChecksFromAcceptance(artifact),
                compatibleTargetPageIds: artifact.compatibleTargetPageIds,
                isolatedPageIds: artifact.isolatedPageIds,
              };
            },
            buildSection: ({ profileVersion }) => buildDeveloperGlobalFrameSection({
              profileVersion,
              sourceScope: "client_source",
              canaryDraft: {
                appearance: visualDraft.appearance,
                visualAuditId: visualDraft.visualAuditId,
                recoveryPointId: visualDraft.recoveryPointId,
              },
              recoveryDraftId: visualDraft.id,
              pilotVerificationId: visualDraft.visualAuditId,
              pilotVerifiedAt: visualDraft.savedAt,
              pilotChecks: DEVELOPER_GLOBAL_STYLE_PILOT_CHECK_IDS,
              compatibleTargetPageIds,
            }),
          });
          if (isFailedState(prepared)) {
            reportState(pathname, search, detail.action, "blocked", failureMessage(prepared), prepared, prepared.preflight.issues);
            return;
          }
          reportState(
            pathname,
            search,
            detail.action,
            "passed",
            `三源页面可信验收完成：${prepared.compatibleTargetPageIds.length} 页通过，${prepared.isolatedPageIds.length} 页隔离；${ACCEPTANCE_CASE_COUNT} 个视口用例已绑定服务端凭据。`,
            prepared,
            [
              formatAcceptanceSourceSummary(prepared.compatibleTargetPageIds, prepared.isolatedPageIds),
              "Section 仅含外观令牌；业务内容、数据、素材、插件和导航未进入草稿。",
            ],
          );
          return;
        }

        let state = coordinator.getState();
        if (!state || state.draftId !== detail.draftId) {
          throw new Error("未找到与当前可视化草稿匹配的协调器状态，请从三源页面可信验收重新开始。");
        }

        if (detail.action === "sync-passed-pages") {
          if (state.stage !== "draft-saved") state = await coordinator.commitDraft(detail.draftId);
          if (isFailedState(state) || state.stage !== "draft-saved") {
            reportState(pathname, search, detail.action, "blocked", failureMessage(state), state);
            return;
          }
          reportState(
            pathname,
            search,
            detail.action,
            "passed",
            "通过页面、隔离页面与外观草稿已在同一服务端事务原子保存；尚未审核或发布。",
            state,
            ["草稿 hash 与预检 artifact hash 已由服务端持久绑定。"],
          );
          return;
        }

        if (detail.action === "publish-three-end") {
          if (state.stage === "draft-saved") {
            state = await coordinator.requestPublication(detail.draftId, {
              changelog: `统一页面框架 ${state.resolvedProfileVersion}`,
            });
          } else if (state.stage === "review-pending") {
            state = await coordinator.refreshPublication(detail.draftId);
          }
          if (isFailedState(state)) {
            reportState(pathname, search, detail.action, "blocked", failureMessage(state), state);
            return;
          }
          if (state.stage === "review-pending") {
            reportState(
              pathname,
              search,
              detail.action,
              "waiting",
              "已提交两次独立审核；审核完成前不会下发 client 运行实例。点击可刷新审核状态。",
              state,
            );
            return;
          }
          if (state.stage === "published") state = await coordinator.startRollout(detail.draftId);
          else if (state.stage === "rollout-pending") state = await coordinator.refreshRollout(detail.draftId);
          if (isFailedState(state)) {
            reportState(pathname, search, detail.action, "blocked", failureMessage(state), state);
            return;
          }
          if (state.stage === "rollout-pending") {
            reportState(pathname, search, detail.action, "waiting", "不可变共享框架版本已发布，client 运行实例批次仍在执行；代理实例不在本批，总部没有实例下发。点击可刷新。", state);
            return;
          }
          if (state.stage !== "rollout-complete") throw new Error(`发布状态 ${state.stage} 尚不能完成 client 实例下发。`);
          reportState(pathname, search, detail.action, "passed", "两次审核与 client 运行实例下发已完成，允许保存 client 发布默认。", state);
          return;
        }

        if (detail.action === "save-factory-default") {
          if (state.stage === "rollout-pending") state = await coordinator.refreshRollout(detail.draftId);
          if (state.stage !== "rollout-complete") {
            reportState(pathname, search, detail.action, "waiting", "只有已发布且 client 运行实例下发完成的不可变版本才能保存为 client 发布默认。", state);
            return;
          }
          if (!releaseRepository.capabilities.factoryDefault
            || !releaseRepository.recordFactoryDefaultReceipt
            || !releaseRepository.readLatestFactoryDefaultReceipt) {
            throw new Error("服务端尚未提供可跨浏览器读取的工厂默认凭据边界。");
          }
          const candidateReceipt = await buildDeveloperGlobalFrameFactoryDefaultReceipt(state);
          const receipt = await releaseRepository.recordFactoryDefaultReceipt(candidateReceipt);
          const latestReceipt = await releaseRepository.readLatestFactoryDefaultReceipt();
          if (latestReceipt.receiptHash !== receipt.receiptHash
            || latestReceipt.publishedVersion !== receipt.publishedVersion
            || latestReceipt.recoveryPointId !== receipt.recoveryPointId) {
            throw new Error("服务端最新工厂默认未回读到刚保存的不可变凭据。");
          }
          const localReceipt = await recordDeveloperGlobalFrameFactoryDefaultReceipt(
            window.localStorage,
            state,
            receipt.recordedAt,
          );
          if (localReceipt.receiptHash !== receipt.receiptHash) {
            throw new Error("本地便捷副本与服务端工厂默认凭据不一致。");
          }
          if (disposed) return;
          reportState(
            pathname,
            search,
            detail.action,
            "passed",
            `工厂默认已由服务端绑定不可变版本 ${receipt.publishedVersion} 并完成跨浏览器回读，可按恢复点回退且不触碰业务数据。`,
            state,
            [`工厂凭据 ${receipt.receiptHash}`, `恢复点 ${receipt.recoveryPointId}`],
          );
        }
      } catch (error) {
        if (disposed) return;
        reportGlobalFrameWorkflowStatus({
          pathname,
          search,
          action: detail.action,
          status: "blocked",
          message: error instanceof Error ? error.message : "全局框架工作流执行失败，当前页面已保持隔离。",
          draftId: detail.draftId,
          recoveryPointId: detail.recoveryPointId,
        });
      } finally {
        running = false;
      }
    };

    window.addEventListener(GLOBAL_FRAME_WORKFLOW_ACTION_EVENT, handleAction);
    return () => {
      disposed = true;
      window.removeEventListener(GLOBAL_FRAME_WORKFLOW_ACTION_EVENT, handleAction);
    };
  }, [pathname, search]);

  return null;
}
