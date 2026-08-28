import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, Eye, History, RefreshCw, RotateCcw, Send, ShieldCheck } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import ReleaseGovernancePanel, { type ReleaseLifecycle } from "@/components/ReleaseGovernancePanel";
import ReleaseReadinessChecklist from "@/components/ReleaseReadinessChecklist";
import { authApi } from "@/lib/auth";
import {
  DEVELOPER_GLOBAL_FRAME_SECTION_NAME,
  DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
  readDeveloperGlobalFramePreparedHandoff,
  validateDeveloperGlobalFrameHandoffServerDraft,
  type DeveloperGlobalFramePreparedHandoff,
} from "@/lib/developer-global-frame-draft";
import { dispatchDeveloperGlobalFramePublishedEvent } from "@/lib/developer-global-frame-published-event";
import { readClientTemplateProductMarketConfig } from "@/lib/product-market-config";
import { attachSocialSourcePackage, readSocialSourcePackage } from "@/lib/social-source-package";
import { platformApi, type PlatformNode } from "@/lib/platform-api";
import {
  diffLatest,
  fetchInstance,
  fetchLatestDeveloperGlobalFramePreflightEvidence,
  fetchTemplate,
  listTemplateVersions,
  publishTemplate,
  restoreTemplate,
  reviewTemplateVersion,
  upsertTemplate,
  validateDeveloperGlobalFramePreflightEvidence,
} from "@/lib/template-snapshot/api";
import type { TemplateVersionResponse } from "@/lib/template-snapshot/types";
import {
  assertClientPlanRuntimeInstanceBinding,
  resolveClientPlanRuntimeInstanceIdentity,
} from "@/lib/template-snapshot/client-plan-runtime-identity";
import { FactoryPage } from "@/page-factory/FactoryPage";

const TEMPLATE_ID = DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID;
const flatten = (nodes: PlatformNode[]): PlatformNode[] => nodes.flatMap((node) => [node, ...flatten(node.children || [])]);
const reviewLabel = (status?: string) => ({ pending_review: "待审核", pending_second_review: "待二次审核", published: "已发布", rejected: "已驳回", archived: "历史版本" }[status || ""] || "历史版本");
type PlanRow = { id: number; name: string; code: string; clientName: string; instanceId: string; installedVersion: string; lastSyncedAt: string };

export default function ClientSourceReleases() {
  const [searchParams] = useSearchParams();
  const requestedSection = searchParams.get("section");
  const requestedTemplateId = searchParams.get("templateId");
  const developerGlobalFrameMode = requestedSection === DEVELOPER_GLOBAL_FRAME_SECTION_NAME;
  const [versions, setVersions] = useState<TemplateVersionResponse[]>([]);
  const [version, setVersion] = useState("v1.0.0");
  const [note, setNote] = useState("客户源模板更新");
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [selectedPlanInstanceIds, setSelectedPlanInstanceIds] = useState<string[]>([]);
  const [previewByPlan, setPreviewByPlan] = useState<Record<string, number>>({});
  const [rollbackVersion, setRollbackVersion] = useState("");
  const [developerGlobalFrameHandoff, setDeveloperGlobalFrameHandoff] = useState<DeveloperGlobalFramePreparedHandoff | null>(null);
  const [developerGlobalFrameHandoffIssue, setDeveloperGlobalFrameHandoffIssue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      await authApi.restoreLocalDemoSession("hq");
      const tree = await platformApi.tree();
      const all = flatten(tree.items || []);
      const entries = await listTemplateVersions(TEMPLATE_ID).catch(() => []);
      setVersions(entries);
      if (developerGlobalFrameMode) {
        setDeveloperGlobalFrameHandoff(null);
        if (requestedTemplateId !== TEMPLATE_ID) {
          setDeveloperGlobalFrameHandoffIssue("发布入口的 templateId 与 developer_global_frame 模板不匹配，已阻止提交。");
        } else {
          const handoff = readDeveloperGlobalFramePreparedHandoff(sessionStorage, "client_source");
          if (!handoff) {
            setDeveloperGlobalFrameHandoffIssue("未找到新鲜且完整的全局框架草稿交接记录，请返回 03全局样式器重新执行原子草稿保存。");
          } else {
            const serverDraft = await fetchTemplate(TEMPLATE_ID);
            const validation = validateDeveloperGlobalFrameHandoffServerDraft(handoff, serverDraft);
            if (!validation.valid) {
              setDeveloperGlobalFrameHandoffIssue(`服务器草稿与交接记录不一致：${validation.issues.join("；")}`);
            } else {
              setDeveloperGlobalFrameHandoff(handoff);
              setDeveloperGlobalFrameHandoffIssue(null);
              setVersion(handoff.section.profile_version);
              setNote(`developer_global_frame ${handoff.section.profile_version}`);
            }
          }
        }
      } else {
        setDeveloperGlobalFrameHandoff(null);
        setDeveloperGlobalFrameHandoffIssue(null);
      }
      const planCandidates = all.flatMap((node) => (node.projects || []).map((project) => ({
        id: project.id,
        name: project.name,
        code: project.code,
        clientName: node.name,
        clientId: project.client_org_id,
      })));
      const resolvedPlans = await Promise.all(planCandidates.map(async (plan): Promise<PlanRow> => {
        const identity = resolveClientPlanRuntimeInstanceIdentity({
          planCode: plan.code,
          clientId: plan.clientId,
          planId: plan.id,
        });
        try {
          const instance = await fetchInstance(identity.instanceId) as Record<string, unknown>;
          assertClientPlanRuntimeInstanceBinding(identity, instance);
          return {
            ...plan,
            instanceId: identity.instanceId,
            installedVersion: String(instance.base_template_version || "待首次同步"),
            lastSyncedAt: typeof instance.last_synced_at === "string" ? instance.last_synced_at : "",
          };
        } catch (error) {
          console.warn(`Unable to read client runtime instance ${identity.instanceId}.`, error);
          return { ...plan, instanceId: identity.instanceId, installedVersion: "待首次同步", lastSyncedAt: "" };
        }
      }));
      setPlans(resolvedPlans.sort((left, right) => right.code.localeCompare(left.code)));
      setSelectedPlanInstanceIds((current) => current.filter((instanceId) => resolvedPlans.some((plan) => plan.instanceId === instanceId)));
      if (!developerGlobalFrameMode) {
        setVersion((current) => current === "v1.0.0" ? `v1.0.${entries.length + 1}` : current);
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : "客户源发布中心加载失败"); }
    finally { setBusy(false); }
  }, [developerGlobalFrameMode, requestedTemplateId]);
  useEffect(() => { void load(); }, [load]);

  const submitFullTemplate = async () => {
    if (!version.trim()) { toast.error("请填写版本号"); return; }
    const baseConfig = readClientTemplateProductMarketConfig();
    const config = baseConfig ? attachSocialSourcePackage(baseConfig, readSocialSourcePackage("client_source")) : null;
    if (!config) { toast.error("请先在客户源产品市场保存配置"); return; }
    setBusy(true);
    try {
      const tree = await platformApi.tree();
      const hq = flatten(tree.items || []).find((node) => node.org_type === "hq");
      if (!hq) throw new Error("未找到总部组织");
      const current = await fetchTemplate(TEMPLATE_ID).catch(() => null) as Record<string, unknown> | null;
      await upsertTemplate(TEMPLATE_ID, { templateId: TEMPLATE_ID, templateType: "hq-client", ownerScope: "client_source", ownerId: "HQ", organizationId: hq.id, name: "客户源通用模板", configJson: config, latestVersion: typeof current?.latest_version === "string" ? current.latest_version : undefined, isPublished: current?.is_published === true });
      await publishTemplate(TEMPLATE_ID, { version: version.trim(), changelog: note.trim() || "客户源更新", requiresApproval: true, requiredReviewSteps: 2 });
      toast.success("客户源版本已提交两次审核；通过后客户端计划可手动同步。");
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "提交审核失败"); }
    finally { setBusy(false); }
  };

  const submitDeveloperGlobalFrame = async () => {
    if (!developerGlobalFrameHandoff || developerGlobalFrameHandoffIssue) {
      toast.error(developerGlobalFrameHandoffIssue || "developer_global_frame 交接记录尚未通过校验。");
      return;
    }
    setBusy(true);
    try {
      const freshHandoff = readDeveloperGlobalFramePreparedHandoff(sessionStorage, "client_source");
      if (!freshHandoff || freshHandoff.id !== developerGlobalFrameHandoff.id) {
        throw new Error("developer_global_frame 交接记录已过期或发生变化，请返回 03全局样式器重新保存并交接。");
      }
      const serverDraft = await fetchTemplate(TEMPLATE_ID);
      const validation = validateDeveloperGlobalFrameHandoffServerDraft(freshHandoff, serverDraft);
      if (!validation.valid) {
        throw new Error(`提交前服务器草稿复核失败：${validation.issues.join("；")}`);
      }
      const expectedDraftConfigHash = freshHandoff.draftConfigHash;
      if (!expectedDraftConfigHash) throw new Error("developer_global_frame 交接记录缺少服务器草稿哈希。");
      const latestPreflightEvidence = await fetchLatestDeveloperGlobalFramePreflightEvidence(TEMPLATE_ID);
      if (latestPreflightEvidence.savedDraftHash !== expectedDraftConfigHash) {
        throw new Error("服务器预检证据未绑定当前草稿哈希，请返回全局框架器重新执行预检与原子草稿保存。");
      }
      const validatedPreflightEvidence = await validateDeveloperGlobalFramePreflightEvidence(
        TEMPLATE_ID,
        latestPreflightEvidence.evidenceId,
        expectedDraftConfigHash,
        latestPreflightEvidence.artifactHash,
      );
      if (!validatedPreflightEvidence.valid
        || validatedPreflightEvidence.savedDraftHash !== expectedDraftConfigHash
        || validatedPreflightEvidence.artifactHash !== latestPreflightEvidence.artifactHash) {
        throw new Error("服务器预检证据复核失败，已阻止发布。");
      }
      const releaseVersion = freshHandoff.section.profile_version;
      const currentVersions = await listTemplateVersions(TEMPLATE_ID);
      if (currentVersions.some((item) => item.version === releaseVersion)) {
        throw new Error(`版本 ${releaseVersion} 已存在，不能重复提交同一全局框架交接记录。`);
      }
      await publishTemplate(TEMPLATE_ID, {
        version: freshHandoff.section.profile_version,
        changelog: note.trim() || `developer_global_frame ${releaseVersion}`,
        requiresApproval: true,
        requiredReviewSteps: 2,
        requiredSections: [DEVELOPER_GLOBAL_FRAME_SECTION_NAME],
        expectedDraftConfigHash,
        expectedPreflightArtifactHash: validatedPreflightEvidence.artifactHash,
      });
      toast.success(`developer_global_frame ${releaseVersion} 已提交两次审核；审核前不会创建下游发布批次。`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "developer_global_frame 提交审核失败");
    } finally {
      setBusy(false);
    }
  };

  const submit = developerGlobalFrameMode ? submitDeveloperGlobalFrame : submitFullTemplate;

  const review = async (item: TemplateVersionResponse, action: "approve" | "reject") => {
    const isDeveloperGlobalFrameVersion = item.releaseSections?.[0] === DEVELOPER_GLOBAL_FRAME_SECTION_NAME;
    if (developerGlobalFrameMode !== isDeveloperGlobalFrameVersion) {
      toast.error("当前发布模式与不可变版本的 release_sections 不匹配，已阻止审核。");
      return;
    }
    const reason = action === "reject" ? window.prompt("请填写驳回原因（会写入审计日志）") : undefined;
    if (reason === null) return;
    setBusy(true);
    try {
      const reviewed = await reviewTemplateVersion(TEMPLATE_ID, item.version, action, reason);
      const reviewedRecord = reviewed as unknown as Record<string, unknown>;
      const reviewStatus = reviewedRecord.review_status ?? reviewedRecord.reviewStatus;
      const reviewedVersion = reviewedRecord.version;
      const releaseSections = reviewedRecord.release_sections ?? reviewedRecord.releaseSections;
      const publishedAt = reviewedRecord.published_at ?? reviewedRecord.publishedAt;
      if (developerGlobalFrameMode
        && action === "approve"
        && reviewStatus === "published"
        && reviewedVersion === item.version
        && Array.isArray(releaseSections)
        && releaseSections.length === 1
        && releaseSections[0] === DEVELOPER_GLOBAL_FRAME_SECTION_NAME) {
        dispatchDeveloperGlobalFramePublishedEvent({
          templateId: TEMPLATE_ID,
          section: DEVELOPER_GLOBAL_FRAME_SECTION_NAME,
          version: item.version,
          publishedAt: typeof publishedAt === "string" ? publishedAt : null,
        });
      }
      toast.success(action === "approve" ? `${item.version} 审核动作已记录。` : `${item.version} 已驳回。`);
      await load();
    }
    catch (error) { toast.error(error instanceof Error ? error.message : "审核操作失败"); }
    finally { setBusy(false); }
  };
  const togglePlan = (instanceId: string, checked: boolean) => setSelectedPlanInstanceIds((current) => checked
    ? [...new Set([...current, instanceId])]
    : current.filter((item) => item !== instanceId));
  const toggleAllPlans = (checked: boolean) => setSelectedPlanInstanceIds(checked ? plans.map((plan) => plan.instanceId) : []);
  const previewSelectedPlans = async () => {
    if (!selectedPlanInstanceIds.length) { toast.error("请先选择要预览的独立计划"); return; }
    setBusy(true);
    try {
      const entries = await Promise.all(selectedPlanInstanceIds.map(async (instanceId) => {
        try { const diff = await diffLatest(instanceId); return [instanceId, diff.entries.length] as const; }
        catch { return [instanceId, -1] as const; }
      }));
      setPreviewByPlan((current) => ({ ...current, ...Object.fromEntries(entries) }));
      toast.success("已生成所选独立计划的发布前影响预览；首次同步会标记为首次安装。");
    } catch (error) { toast.error(error instanceof Error ? error.message : "影响预览失败"); }
    finally { setBusy(false); }
  };
  const rollbackSelectedPlans = async () => {
    if (!selectedPlanInstanceIds.length || !rollbackVersion) { toast.error("请先选择独立计划和回退版本"); return; }
    setBusy(true);
    try {
      for (const plan of plans.filter((item) => selectedPlanInstanceIds.includes(item.instanceId) && item.installedVersion !== "待首次同步")) {
        await restoreTemplate(plan.instanceId, { target: "all", templateVersion: rollbackVersion, createBackup: true });
      }
      toast.success(`已回退所选独立计划至 ${rollbackVersion}；回退前快照已保留。`);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "回退失败"); }
    finally { setBusy(false); }
  };
  const visibleVersions = useMemo(
    () => versions.filter((item) => developerGlobalFrameMode
      ? item.releaseSections?.[0] === DEVELOPER_GLOBAL_FRAME_SECTION_NAME
      : !item.releaseSections?.length),
    [developerGlobalFrameMode, versions],
  );
  const releaseStatus: ReleaseLifecycle = visibleVersions.some((item) => item.reviewStatus === "pending_review" || item.reviewStatus === "pending_second_review")
    ? "pending_review"
    : visibleVersions.some((item) => item.reviewStatus === "published")
      ? "published"
      : "draft";
  const latestPublishedVersion = useMemo(
    () => visibleVersions.find((item) => item.reviewStatus === "published")?.version || "未发布",
    [visibleVersions]
  );
  const plansAtLatestVersion = plans.filter((plan) => plan.installedVersion === latestPublishedVersion).length;
  const plansNeedingSync = plans.filter((plan) => plan.installedVersion !== latestPublishedVersion).length;
  const pendingReview = visibleVersions.some((item) => item.reviewStatus === "pending_review" || item.reviewStatus === "pending_second_review");
  const selectedPreviewedPlans = selectedPlanInstanceIds.filter((instanceId) => previewByPlan[instanceId] !== undefined).length;
  const sourceConfigReady = developerGlobalFrameMode
    ? Boolean(developerGlobalFrameHandoff && !developerGlobalFrameHandoffIssue)
    : Boolean(readClientTemplateProductMarketConfig());

  return <FactoryPage pageId="client-source-releases" template="form" sourceScope="client_source" autoRegions><section
    className="mx-auto max-w-6xl space-y-5 pb-10"
    data-developer-global-frame-release-mode={developerGlobalFrameMode ? "section-only" : undefined}
  >
    <ReleaseGovernancePanel source="client" status={releaseStatus} totalTargets={plans.length} />
    <ReleaseReadinessChecklist
      source="client"
      configReady={sourceConfigReady}
      latestVersion={latestPublishedVersion}
      pendingReview={pendingReview}
      selectedTargets={selectedPlanInstanceIds.length}
      previewedTargets={selectedPreviewedPlans}
    />
    {developerGlobalFrameMode ? <div
      className={`rounded-2xl border p-5 ${developerGlobalFrameHandoff ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}
      data-developer-global-frame-handoff={developerGlobalFrameHandoff ? "verified" : "blocked"}
    >
      <div className="flex items-center gap-2 font-semibold text-slate-900"><ShieldCheck className="h-5 w-5" />03全局样式器 · developer_global_frame 专用交接</div>
      {developerGlobalFrameHandoff ? <div className="mt-2 space-y-1 text-sm text-slate-700">
        <p>服务器草稿哈希、模板、source_scope、section 内容及 30 分钟 TTL 均已复核。</p>
        <p className="font-mono text-xs">profile_version={developerGlobalFrameHandoff.section.profile_version} · draft_config_hash={developerGlobalFrameHandoff.draftConfigHash}</p>
        <p>本页只提交该 section 的审核请求，不会 PUT/覆盖整份模板，也不会在审核前创建 rollout batch。</p>
      </div> : <p className="mt-2 text-sm text-amber-900">{developerGlobalFrameHandoffIssue || "正在校验全局框架草稿交接记录…"}</p>}
    </div> : null}
    <div className="rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-white to-violet-50 p-6"><div className="flex items-center gap-2 text-cyan-700"><ShieldCheck className="h-5 w-5" /><span className="text-sm font-semibold">总部端 · 客户源发布中心</span></div><h1 className="mt-2 text-2xl font-bold text-slate-900">客户源按审核版本提供给独立计划</h1><p className="mt-2 text-sm text-slate-600">客户源只管理通用功能和版面；客户内容、询盘、订单、品牌资料始终留在各自计划中。</p></div>
    <div className="grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="font-semibold">{developerGlobalFrameMode ? "提交 developer_global_frame 审核" : "提交客户源版本"}</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><div><Label htmlFor="client-release-version">版本号</Label><Input id="client-release-version" className="mt-1" value={version} disabled={developerGlobalFrameMode} onChange={(event) => setVersion(event.target.value)} /></div><div className="flex items-end"><Button className="w-full" data-developer-global-frame-submit={developerGlobalFrameMode ? "approval-only" : undefined} disabled={busy || (developerGlobalFrameMode && !developerGlobalFrameHandoff)} onClick={() => void submit()}><Send className="mr-2 h-4 w-4" />提交两次审核</Button></div></div><div className="mt-4"><Label htmlFor="client-release-note">更新说明</Label><Textarea id="client-release-note" className="mt-1 min-h-20" value={note} onChange={(event) => setNote(event.target.value)} /></div><p className="mt-4 text-xs leading-5 text-slate-500">{developerGlobalFrameMode ? "版本号严格使用交接 section 的 profile_version；提交始终 requiresApproval=true。" : "审核通过后，客户端进入独立计划的“产品市场”，点击右上角“手动同步模板最新版”即可安全合并更新。"}</p></div>
    <div className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-semibold">版本与审核</h2><Button variant="outline" size="sm" disabled={busy} onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />刷新</Button></div><div className="mt-4 space-y-2">{visibleVersions.length ? visibleVersions.map((item) => <div key={item.version} className="rounded-xl border bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><b>{item.version}</b><Badge variant={item.reviewStatus === "published" ? "default" : "secondary"}>{reviewLabel(item.reviewStatus)}</Badge></div><div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600"><span>{item.changelog || "未填写说明"}{item.reviewNote ? ` · 审核意见：${item.reviewNote}` : ""}</span>{["pending_review", "pending_second_review"].includes(item.reviewStatus || "") ? <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => void review(item, "approve")}>通过（第 {(item.reviewStep || 0) + 1} 次）</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void review(item, "reject")}>驳回</Button></div> : null}</div></div>) : <p className="rounded-xl border border-dashed p-4 text-sm text-slate-500">暂无匹配当前发布范围的版本。</p>}</div></div></div>
    {!developerGlobalFrameMode ? <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-violet-600" /><h2 className="font-semibold">可同步独立计划</h2></div><p className="mt-1 text-sm text-slate-500">总部发布统一版本；每个计划自行确认合并，不会覆盖客户内容。</p></div>
        <div className="flex gap-2"><Badge variant="outline">最新：{latestPublishedVersion}</Badge><Badge variant="secondary">已同步 {plansAtLatestVersion}</Badge><Badge variant={plansNeedingSync ? "destructive" : "default"}>待同步 {plansNeedingSync}</Badge></div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50/60 p-3">
        <label className="flex items-center gap-2 text-sm font-medium text-sky-950"><Checkbox aria-label="选择全部独立计划" checked={plans.length > 0 && selectedPlanInstanceIds.length === plans.length} onCheckedChange={(value) => toggleAllPlans(value === true)} />选择全部计划</label>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy || !selectedPlanInstanceIds.length} onClick={() => void previewSelectedPlans()}><Eye className="mr-1.5 h-4 w-4" />预览影响（{selectedPlanInstanceIds.length}）</Button><select aria-label="选择计划回退版本" className="h-9 rounded-md border bg-white px-2 text-sm" value={rollbackVersion} onChange={(event) => setRollbackVersion(event.target.value)}><option value="">选择回退版本</option>{versions.filter((item) => item.reviewStatus === "published").map((item) => <option key={item.version} value={item.version}>{item.version}</option>)}</select><Button size="sm" variant="outline" disabled={busy || !selectedPlanInstanceIds.length || !rollbackVersion} onClick={() => void rollbackSelectedPlans()}><RotateCcw className="mr-1.5 h-4 w-4" />回退已选</Button></div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{plans.length ? plans.map((plan) => <label key={plan.instanceId} className="cursor-pointer rounded-xl border bg-slate-50 px-3 py-2.5 text-sm"><div className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-2"><Checkbox aria-label={`选择 ${plan.name}`} checked={selectedPlanInstanceIds.includes(plan.instanceId)} onCheckedChange={(value) => togglePlan(plan.instanceId, value === true)} /><span className="truncate font-medium text-slate-900" title={plan.clientName}>{plan.clientName} · {plan.name}</span></span><Badge variant={plan.installedVersion === latestPublishedVersion ? "default" : "secondary"}>{plan.installedVersion}</Badge></div><div className="mt-1 flex items-center justify-between gap-2 font-mono text-xs text-slate-500"><span>{plan.code}{plan.lastSyncedAt ? ` · 已同步` : " · 待首次同步"}</span><span>{previewByPlan[plan.instanceId] === undefined ? "待预览" : previewByPlan[plan.instanceId] < 0 ? "首次安装" : `${previewByPlan[plan.instanceId]} 项变更`}</span></div></label>) : <span className="text-sm text-slate-500">暂无可用计划</span>}</div>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500"><History className="h-3.5 w-3.5 text-violet-600" />回退仅恢复已选计划的模板受管配置；每次回退均会先创建独立备份，客户内容、询盘、订单和品牌资料不被覆盖。</p>
    </div> : null}
  </section></FactoryPage>;
}
