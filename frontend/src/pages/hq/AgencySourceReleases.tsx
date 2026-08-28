import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, CloudUpload, Eye, History, RefreshCw, Send, ShieldCheck, TestTube2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import ReleaseGovernancePanel, { type ReleaseLifecycle } from "@/components/ReleaseGovernancePanel";
import ReleaseReadinessChecklist from "@/components/ReleaseReadinessChecklist";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { createTemplateReleaseBatch, diffLatest, fetchInstance, fetchTemplate, listTemplateVersions, publishTemplate, restoreTemplate, reviewTemplateVersion, syncLatest, upsertInstance, upsertTemplate } from "@/lib/template-snapshot/api";
import { readAgencyTemplateProductMarketConfig } from "@/lib/product-market-config";
import { attachSocialSourcePackage, readSocialSourcePackage } from "@/lib/social-source-package";
import { platformApi, type PlatformNode } from "@/lib/platform-api";
import { authApi } from "@/lib/auth";
import { listAuditLogs, type AuditLogItem } from "@/lib/audit-logs";
import type { TemplateVersionResponse } from "@/lib/template-snapshot/types";

const TEMPLATE_ID = "agency-source-global";

type AgentRow = {
  id: number;
  code: string;
  name: string;
  orgType: "agency" | "sub_agency";
  status: string;
  installedVersion: string;
  lastSyncedAt: string;
};

type RolloutBatch = { id: string; mode: "pilot" | "full"; version: string; codes: string[]; createdAt: string; failures?: string[] };
const BATCH_STORAGE_KEY = "tradepro.agency-source.last-rollout-batch";
const ROLLOUT_PAUSED_STORAGE_KEY = "tradepro.agency-source.rollout-paused";
const ROLLOUT_FAILURE_THRESHOLD_KEY = "tradepro.agency-source.failure-threshold";

function readLastBatch(): RolloutBatch | null {
  try { return JSON.parse(localStorage.getItem(BATCH_STORAGE_KEY) || "null") as RolloutBatch | null; } catch { return null; }
}

function flatten(nodes: PlatformNode[]): PlatformNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children || [])]);
}

function instanceId(code: string) {
  return `agency-runtime-${code}`;
}

function readTemplateVersion(value: unknown) {
  return value && typeof value === "object" && "latest_version" in value
    ? String((value as Record<string, unknown>).latest_version || "未发布")
    : "未发布";
}

function readConfig(value: unknown) {
  return value && typeof value === "object" && "config_json" in value
    ? ((value as Record<string, unknown>).config_json as Record<string, unknown>)
    : {};
}

function formatTime(value: string) {
  if (!value) return "未同步";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}

function reviewLabel(status?: string) {
  if (status === "pending_review") return "待审核";
  if (status === "published") return "已发布";
  if (status === "rejected") return "已驳回";
  return "历史可回退";
}

export default function AgencySourceReleases() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [versions, setVersions] = useState<TemplateVersionResponse[]>([]);
  const [latestVersion, setLatestVersion] = useState("未发布");
  const [selected, setSelected] = useState<string[]>([]);
  const [versionInput, setVersionInput] = useState("v1.0.0");
  const [changelog, setChangelog] = useState("代理源首个可同步版本");
  const [reviewAssignee, setReviewAssignee] = useState("");
  const [rollbackVersion, setRollbackVersion] = useState("");
  const [draftPending, setDraftPending] = useState(false);
  const [previewByCode, setPreviewByCode] = useState<Record<string, number>>({});
  const [lastBatch, setLastBatch] = useState<RolloutBatch | null>(() => readLastBatch());
  const [rolloutPaused, setRolloutPaused] = useState(() => localStorage.getItem(ROLLOUT_PAUSED_STORAGE_KEY) === "true");
  const [failureThreshold, setFailureThreshold] = useState(() => Number(localStorage.getItem(ROLLOUT_FAILURE_THRESHOLD_KEY) || "5"));
  const [auditEvents, setAuditEvents] = useState<AuditLogItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Local development tokens are intentionally short-lived and disappear
      // after a backend restart. Restore the account-free HQ session once here.
      await authApi.restoreLocalDemoSession("hq");
      const tree = await platformApi.tree();
      const all = flatten(tree.items || []);
      const hq = all.find((item) => item.org_type === "hq") || null;
      const agentNodes = all.filter((item) => item.org_type === "agency" || item.org_type === "sub_agency");
      let template: unknown = null;
      try { template = await fetchTemplate(TEMPLATE_ID); } catch { /* first release has not been created */ }
      const templateVersion = readTemplateVersion(template);
      let templateVersions: TemplateVersionResponse[] = [];
      if (template) {
        try { templateVersions = await listTemplateVersions(TEMPLATE_ID); } catch { /* a draft can exist before publishing */ }
      }
      const rawTemplate = template as Record<string, unknown> | null;
      // A draft remains in the source record while the latest immutable version
      // continues to be the only version that may be deployed.
      const publishedVersion = rawTemplate?.is_published === true ? templateVersion : templateVersions[0]?.version || templateVersion;
      const latestPublished = templateVersions.find((item) => item.version === publishedVersion) || templateVersions[0];
      setLatestVersion(publishedVersion);
      setDraftPending(Boolean(template && latestPublished && JSON.stringify(readConfig(template)) !== JSON.stringify(latestPublished.configJson)));
      setVersions(templateVersions);
      setRollbackVersion((current) => current || templateVersions[0]?.version || "");
      setVersionInput((current) => current === "v1.0.0" && templateVersions.length
        ? `v1.0.${templateVersions.length + 1}`
        : current);

      const rows = await Promise.all(agentNodes.map(async (agency): Promise<AgentRow> => {
        try {
          const instance = await fetchInstance(instanceId(agency.code)) as Record<string, unknown>;
          return {
            id: agency.id,
            code: agency.code,
            name: agency.name,
            orgType: agency.org_type,
            status: agency.status,
            installedVersion: String(instance.base_template_version || "待安装"),
            lastSyncedAt: typeof instance.last_synced_at === "string" ? instance.last_synced_at : "",
          };
        } catch {
          return { id: agency.id, code: agency.code, name: agency.name, orgType: agency.org_type, status: agency.status, installedVersion: "待安装", lastSyncedAt: "" };
        }
      }));
      setAgents(rows.sort((a, b) => b.code.localeCompare(a.code)));
      setSelected((current) => current.filter((code) => rows.some((item) => item.code === code)));
      const [syncEvents, restoreEvents] = await Promise.all([
        listAuditLogs("template_snapshot_instance_synced", 40).catch(() => []),
        listAuditLogs("template_snapshot_instance_restored", 40).catch(() => []),
      ]);
      setAuditEvents([...syncEvents, ...restoreEvents].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))).slice(0, 8));
      if (!hq) toast.error("未找到总部组织，不能发布代理源版本");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发布中心数据加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const getSourceConfig = () => {
    const config = readAgencyTemplateProductMarketConfig();
    return config ? attachSocialSourcePackage(config, readSocialSourcePackage("agency_source")) : null;
  };

  const ensureDraft = async () => {
    const config = getSourceConfig();
    if (!config) throw new Error("代理源尚无可发布配置，请先在代理源的产品市场完成配置并保存。");
    const tree = await platformApi.tree();
    const hq = flatten(tree.items || []).find((item) => item.org_type === "hq");
    if (!hq) throw new Error("未找到总部组织");
    let existing: Record<string, unknown> | null = null;
    try { existing = await fetchTemplate(TEMPLATE_ID) as Record<string, unknown>; } catch { /* first source draft */ }
    return upsertTemplate(TEMPLATE_ID, {
      templateId: TEMPLATE_ID,
      templateType: "agency-agent",
      ownerScope: "agency_source",
      ownerId: "HQ",
      organizationId: hq.id,
      name: "代理源通用模板",
      configJson: config,
      // Keep the deployed release pointer intact.  The source record can carry
      // the next draft, but sync operations must still resolve to a published
      // immutable version below.
      latestVersion: typeof existing?.latest_version === "string" ? existing.latest_version : undefined,
      isPublished: existing?.is_published === true,
    });
  };

  const saveDraft = async () => {
    setBusy(true);
    try {
      await ensureDraft();
      toast.success("已读取代理源当前配置并保存为发布草稿");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "草稿保存失败");
    } finally { setBusy(false); }
  };

  const publish = async () => {
    if (!versionInput.trim()) { toast.error("请填写版本号"); return; }
    setBusy(true);
    try {
      await ensureDraft();
      await publishTemplate(TEMPLATE_ID, {
        version: versionInput.trim(),
        changelog: changelog.trim() || "代理源更新",
        requiresApproval: true,
        reviewAssignee: reviewAssignee.trim() || undefined,
      });
      toast.success(`代理源 ${versionInput.trim()} 已提交审核；审核通过后才可下发。`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发布失败；版本号不能重复");
    } finally { setBusy(false); }
  };

  const approve = async (version: string) => {
    setBusy(true);
    try {
      await reviewTemplateVersion(TEMPLATE_ID, version, "approve");
      toast.success(`${version} 已审核通过并成为当前发布版本。`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "审核失败");
    } finally { setBusy(false); }
  };

  const reject = async (version: string) => {
    const note = window.prompt("请填写驳回原因（会写入审计日志）");
    if (note === null) return;
    setBusy(true);
    try {
      await reviewTemplateVersion(TEMPLATE_ID, version, "reject", note);
      toast.success(`${version} 已驳回，原因已记录。`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "驳回失败");
    } finally { setBusy(false); }
  };

  const setPaused = (value: boolean) => {
    localStorage.setItem(ROLLOUT_PAUSED_STORAGE_KEY, String(value));
    setRolloutPaused(value);
    toast.success(value ? "灰度下发已暂停；可核对失败项后再继续。" : "灰度下发已恢复。");
  };

  const updateFailureThreshold = (value: number) => {
    const next = Number.isFinite(value) ? Math.min(100, Math.max(1, value)) : 5;
    localStorage.setItem(ROLLOUT_FAILURE_THRESHOLD_KEY, String(next));
    setFailureThreshold(next);
  };

  const preview = async () => {
    if (!selected.length) { toast.error("请先选择要预览影响的代理端"); return; }
    setBusy(true);
    try {
      await ensureDraft();
      const entries = await Promise.all(selected.map(async (code) => {
        try { const diff = await diffLatest(instanceId(code)); return [code, diff.entries.length] as const; }
        catch { return [code, -1] as const; }
      }));
      setPreviewByCode(Object.fromEntries(entries));
      setDraftPending(true);
      toast.success("已生成发布前影响预览；- 表示首次安装。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "影响预览失败");
    } finally { setBusy(false); }
  };

  const deploy = async (targetCodes = selected, mode: "pilot" | "full" = "pilot") => {
    if (rolloutPaused) { toast.error("灰度下发已暂停，请先解除暂停后再继续。"); return; }
    if (!targetCodes.length) { toast.error("请先选择要同步的代理端"); return; }
    if (latestVersion === "未发布") { toast.error("请先发布代理源版本"); return; }
    setBusy(true);
    try {
      const templateVersions = await listTemplateVersions(TEMPLATE_ID);
      const published = templateVersions.find((item) => item.version === latestVersion);
      if (!published) throw new Error("找不到当前已发布版本，请刷新后重试");
      const sourceConfig = published.configJson;
      const version = published.version;
      const targets = agents.filter((item) => targetCodes.includes(item.code));
      // New agents have no runtime snapshot until their first rollout. Provision
      // that headquarters-owned instance before building the server batch so a
      // single release covers both existing and first-install agents.
      for (const agency of targets) {
        const runtimeId = instanceId(agency.code);
        try {
          const existing = await fetchInstance(runtimeId) as Record<string, unknown>;
          if (existing.baseTemplateId && existing.baseTemplateId !== TEMPLATE_ID) {
            throw new Error(`${agency.code} 已绑定其他模板，不能直接覆盖`);
          }
        } catch (error) {
          if (error instanceof Error && !error.message.includes("404")) throw error;
          await upsertInstance(runtimeId, {
            instanceId: runtimeId,
            instanceType: agency.orgType === "sub_agency" ? "sub-agency" : "agency",
            ownerScope: "agency",
            ownerId: agency.code,
            organizationId: agency.id,
            name: `${agency.name} 代理端运行实例`,
            baseTemplateId: TEMPLATE_ID,
            baseTemplateVersion: version,
            snapshotConfigJson: sourceConfig,
            overrideConfigJson: {},
            lastSyncedAt: new Date().toISOString(),
          });
        }
      }
      const response = await createTemplateReleaseBatch(TEMPLATE_ID, targets.map((agency) => instanceId(agency.code)));
      const failures = response.batch.targets
        .filter((target) => target.status === "failed")
        .map((target) => `${target.instance_id}: ${target.error_message || "Unknown error"}`);
      // Runtime instances are now provisioned centrally. This legacy fallback
      // is retained only for source-history compatibility and never executes.
      if ((globalThis as { __legacyAgencyFallbackEnabled?: boolean }).__legacyAgencyFallbackEnabled) for (const agency of targets) {
        try {
          await syncLatest(instanceId(agency.code), { syncMode: "merge", createBackup: true });
        } catch (syncError) {
          try {
            await upsertInstance(instanceId(agency.code), {
            instanceId: instanceId(agency.code),
            instanceType: agency.orgType === "sub_agency" ? "sub-agency" : "agency",
            ownerScope: "agency",
            ownerId: agency.code,
            organizationId: agency.id,
            name: `${agency.name} 代理端运行实例`,
            baseTemplateId: TEMPLATE_ID,
            baseTemplateVersion: version,
            snapshotConfigJson: sourceConfig,
            overrideConfigJson: {},
              lastSyncedAt: new Date().toISOString(),
            });
          } catch (createError) {
            const message = createError instanceof Error ? createError.message : syncError instanceof Error ? syncError.message : "未知错误";
            failures.push(`${agency.code}: ${message}`);
          }
        }
      }
      if (failures.length) {
        localStorage.setItem(ROLLOUT_PAUSED_STORAGE_KEY, "true");
        setRolloutPaused(true);
        toast.error(`下发有 ${failures.length} 项失败，已自动暂停后续灰度。`);
      }
      toast.success(`${mode === "pilot" ? "灰度" : "全量"}下发完成：${targets.length} 个代理端已更新至 ${version}；已安装实例均已自动备份。`);
      const batch: RolloutBatch = { id: response.batch.id, mode, version, codes: targets.map((item) => item.code), createdAt: new Date().toISOString(), failures };
      localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(batch));
      setLastBatch(batch);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "同步失败");
    } finally { setBusy(false); }
  };

  const rollback = async () => {
    if (!selected.length || !rollbackVersion) { toast.error("请选择代理端和要回退的版本"); return; }
    setBusy(true);
    try {
      for (const agency of agents.filter((item) => selectedSet.has(item.code) && item.installedVersion !== "待安装")) {
        await restoreTemplate(instanceId(agency.code), { target: "all", templateVersion: rollbackVersion, createBackup: true });
      }
      toast.success(`已回退已选代理端至 ${rollbackVersion}，回退前快照已保留。`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "回退失败");
    } finally { setBusy(false); }
  };

  const rollbackLastBatch = async () => {
    if (!lastBatch) { toast.error("还没有可回退的下发批次"); return; }
    if (!rollbackVersion) { toast.error("请先选择要回退到的版本"); return; }
    setBusy(true);
    try {
      const targets = agents.filter((item) => lastBatch.codes.includes(item.code) && item.installedVersion !== "待安装");
      for (const agency of targets) {
        await restoreTemplate(instanceId(agency.code), { target: "all", templateVersion: rollbackVersion, createBackup: true });
      }
      toast.success(`已回退批次 ${lastBatch.id} 的 ${targets.length} 个代理端至 ${rollbackVersion}。`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批次回退失败");
    } finally { setBusy(false); }
  };

  const toggleAll = (checked: boolean) => setSelected(checked ? agents.map((item) => item.code) : []);
  const toggle = (code: string, checked: boolean) => setSelected((items) => checked ? [...new Set([...items, code])] : items.filter((item) => item !== code));
  const releaseStatus: ReleaseLifecycle = draftPending
    ? "draft"
    : versions.some((item) => item.reviewStatus === "pending_review" || item.reviewStatus === "pending_second_review")
      ? "pending_review"
      : versions.some((item) => item.reviewStatus === "published")
        ? "published"
        : "draft";
  const pendingReview = versions.some((item) => item.reviewStatus === "pending_review" || item.reviewStatus === "pending_second_review");
  const previewedTargetCount = selected.filter((code) => previewByCode[code] !== undefined).length;
  const sourceConfigReady = Boolean(getSourceConfig());

  return (
    <FactoryPage pageId="agency-source-releases" template="list" sourceScope="agency_source" autoRegions>
      <section className="mx-auto max-w-7xl space-y-5 pb-10">
      <ReleaseGovernancePanel source="agency" status={releaseStatus} selectedTargets={selected.length} totalTargets={agents.length} />
      <ReleaseReadinessChecklist
        source="agency"
        configReady={sourceConfigReady}
        latestVersion={latestVersion}
        pendingReview={pendingReview}
        selectedTargets={selected.length}
        previewedTargets={previewedTargetCount}
      />
      <div className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-base font-semibold text-slate-900">发布流程 · 按顺序做就可以</h2><p className="mt-1 text-sm text-slate-500">每一步完成后再进入下一步；系统会保留版本、备份和审计记录。</p></div><Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">当前发布：{latestVersion}</Badge></div><ol className="mt-5 grid gap-3 md:grid-cols-5">{[["1", "保存草稿", "先在代理源产品市场改好内容，再回到本页保存草稿。"], ["2", "提交发布", "填写版本号和更新说明，点击“发布版本”。此时不会影响代理端。"], ["3", "审核通过", "由非发布人审核；通过后版本才允许下发，驳回不会影响现网。"], ["4", "灰度下发", "先勾选少量代理，先预览影响，再点击“灰度下发”。"], ["5", "确认全量", "灰度稳定后点击“全量下发”；代理端自行选择需要安装的更新。"]].map(([step, title, description], index) => <li key={step} className="relative rounded-xl border bg-slate-50 p-3"><div className="flex items-center gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">{step}</span><b className="text-sm text-slate-900">{title}</b></div><p className="mt-2 text-xs leading-5 text-slate-600">{description}</p>{index < 4 ? <span className="absolute -right-2 top-1/2 hidden h-px w-4 bg-sky-300 md:block" /> : null}</li>)}</ol><div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-sky-100 bg-sky-50/60 p-3 text-sm text-sky-900"><span className="font-medium">第 1 步快捷入口：</span><a href="/zb/agency-source" className="rounded-md border border-sky-200 bg-white px-2.5 py-1.5 font-medium text-sky-700 hover:bg-sky-100">代理源</a><a href="/zb/agency-source/product-market?tab=operations" className="rounded-md border border-sky-200 bg-white px-2.5 py-1.5 font-medium text-sky-700 hover:bg-sky-100">产品市场</a><Button size="sm" variant="outline" disabled={busy} onClick={() => void saveDraft()}>保存草稿</Button><span className="text-xs text-sky-700">路径：代理源 → 产品市场 → 回发布中心 → 保存草稿</span></div></div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"><span>灰度失败率阈值：达到阈值自动暂停（当前策略对任一失败也会立即保护性暂停）。</span><label className="flex items-center gap-1 text-xs">阈值 <input aria-label="灰度失败率阈值" className="w-14 rounded border bg-white px-1 py-0.5" type="number" min="1" max="100" value={failureThreshold} onChange={(event) => updateFailureThreshold(Number(event.target.value))} />%</label></div>
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${rolloutPaused ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}><span>灰度保护：{rolloutPaused ? "已暂停，解除暂停后才可继续下发" : "运行中，失败将自动暂停"}{lastBatch?.failures?.length ? ` · 最近批次失败 ${lastBatch.failures.length} 项` : ""}</span><Button size="sm" variant={rolloutPaused ? "destructive" : "outline"} onClick={() => setPaused(!rolloutPaused)} disabled={busy}>{rolloutPaused ? "解除暂停" : "暂停灰度"}</Button></div>
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-cyan-50 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-violet-700"><ShieldCheck className="h-5 w-5" /><span className="text-sm font-semibold">总部端 · 代理源发布中心</span></div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">开发代理源，按版本下发到代理端</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">代理端不能直接改通用模板。总部先在「代理源」配置，再生成不可变版本；每次同步和回退都会自动留下快照备份。</p>
          </div>
          <div className="flex items-center gap-2"><Badge className="bg-violet-600 px-3 py-1.5 text-sm">当前发布：{latestVersion}</Badge>{draftPending ? <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">草稿待发布</Badge> : null}</div>
        </div>
      </div>

      {versions.some((item) => item.reviewStatus === "pending_second_review") ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="text-sm font-semibold text-amber-900">待二次审核版本</div><div className="mt-3 flex flex-wrap gap-2">{versions.filter((item) => item.reviewStatus === "pending_second_review").map((item) => <div key={item.version} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"><span>{item.version}{item.reviewNote ? ` · ${item.reviewNote}` : ""}</span><Button size="sm" disabled={busy} onClick={() => void approve(item.version)}>二次通过</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void reject(item.version)}>驳回</Button></div>)}</div></div> : null}

      <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><CloudUpload className="h-5 w-5 text-violet-600" /><h2 className="font-semibold text-slate-900">1. 保存并发布代理源</h2></div>
            <p className="mt-1 text-sm text-slate-500">发布内容直接读取代理源开发工具：代理平台应用、运营市场、栏目配置、版面风格、服务助手，以及布局开发器和页面清扫器的受管规则。</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div><Label htmlFor="agency-release-version">版本号</Label><Input id="agency-release-version" className="mt-1.5" value={versionInput} onChange={(event) => setVersionInput(event.target.value)} placeholder="例如 v1.0.1" /></div>
              <div><Label>草稿状态</Label><div className="mt-1.5 flex h-10 items-center rounded-md border bg-slate-50 px-3 text-sm text-slate-600">从代理源产品市场读取</div></div>
              <div><Label htmlFor="agency-release-reviewer">审核人账号 ID（可选）</Label><Input id="agency-release-reviewer" className="mt-1.5" value={reviewAssignee} onChange={(event) => setReviewAssignee(event.target.value)} placeholder="留空则由其他总部审核人处理" /><p className="mt-1 text-xs text-slate-500">发布人不能审核自己的版本。</p></div>
            </div>
            <div className="mt-4"><Label htmlFor="agency-release-note">更新说明</Label><Textarea id="agency-release-note" className="mt-1.5 min-h-20" value={changelog} onChange={(event) => setChangelog(event.target.value)} /></div>
            <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => void saveDraft()}>保存草稿</Button><Button disabled={busy} onClick={() => void publish()}><Send className="mr-2 h-4 w-4" />发布版本</Button></div>
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs leading-5 text-emerald-900"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" />受保护字段：公司简称、商标、客户、询盘、订单、成员、钱包/财务、计划与邀请码不会写入代理源，也不会被同步覆盖。</div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><History className="h-5 w-5 text-sky-600" /><h2 className="font-semibold text-slate-900">版本记录与安全回退</h2></div>
            <div className="mt-4 space-y-2">
              {versions.length ? versions.map((item) => <div key={item.version} className="rounded-xl border bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><b className="text-sm text-slate-900">{item.version}</b><span className="flex items-center gap-2 text-xs text-slate-500"><Badge variant={item.reviewStatus === "published" ? "default" : "secondary"}>{reviewLabel(item.reviewStatus)}</Badge>{formatTime(item.publishedAt || "")}</span></div><div className="mt-2 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-slate-600">{item.changelog || "未填写说明"}</p>{item.reviewAssignee ? <p className="mt-1 text-xs text-slate-500">指定审核人：{item.reviewAssignee}</p> : null}{item.reviewNote ? <p className="mt-1 text-xs text-slate-500">审核说明：{item.reviewNote}</p> : null}</div>{item.reviewStatus === "pending_review" ? <span className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => void approve(item.version)}>审核通过</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void reject(item.version)}>驳回</Button></span> : null}</div></div>) : <p className="rounded-xl border border-dashed p-4 text-sm text-slate-500">尚未提交版本。</p>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2"><select className="h-9 min-w-0 flex-1 rounded-md border bg-white px-3 text-sm" value={rollbackVersion} onChange={(event) => setRollbackVersion(event.target.value)}><option value="">选择回退版本</option>{versions.filter((item) => item.reviewStatus !== "pending_review").map((item) => <option key={item.version} value={item.version}>{item.version}</option>)}</select><Button variant="outline" disabled={busy || !selected.length || !rollbackVersion} onClick={() => void rollback()}>回退已选</Button>{lastBatch ? <Button variant="secondary" disabled={busy || !rollbackVersion} onClick={() => void rollbackLastBatch()}>回退最近{lastBatch.mode === "pilot" ? "灰度" : "全量"}批次</Button> : null}</div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h2 className="font-semibold text-slate-900">2. 预览、灰度并下发代理端</h2><p className="mt-1 text-sm text-slate-500">先选少量代理做灰度；确认后再全量下发。首次下发会安装实例，后续采用安全合并与自动备份。</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => void load()} disabled={busy || loading}><RefreshCw className="mr-1.5 h-4 w-4" />刷新</Button><Button variant="outline" size="sm" onClick={() => void preview()} disabled={busy || !selected.length}><Eye className="mr-1.5 h-4 w-4" />预览影响</Button><Button size="sm" onClick={() => void deploy(selected, "pilot")} disabled={busy || !selected.length}><TestTube2 className="mr-1.5 h-4 w-4" />灰度下发（{selected.length}）</Button><Button size="sm" variant="secondary" onClick={() => void deploy(agents.map((item) => item.code), "full")} disabled={busy || !agents.length}><CloudUpload className="mr-1.5 h-4 w-4" />全量下发</Button></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[790px] text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="w-12 px-5 py-3"><Checkbox aria-label="选择全部代理" checked={agents.length > 0 && selected.length === agents.length} onCheckedChange={(value) => toggleAll(value === true)} /></th><th className="px-3 py-3">代理端</th><th className="px-3 py-3">层级</th><th className="px-3 py-3">已安装版本</th><th className="px-3 py-3">发布前影响</th><th className="px-3 py-3">最近同步</th><th className="px-3 py-3">状态</th></tr></thead><tbody>{agents.map((agency) => <tr key={agency.code} className="border-t"><td className="px-5 py-4"><Checkbox aria-label={`选择 ${agency.name}`} checked={selectedSet.has(agency.code)} onCheckedChange={(value) => toggle(agency.code, value === true)} /></td><td className="px-3 py-4"><div className="font-medium text-slate-900">{agency.name}</div><div className="mt-0.5 font-mono text-xs text-slate-500">{agency.code}</div></td><td className="px-3 py-4 text-slate-600">{agency.orgType === "agency" ? "一级代理" : "下级代理"}</td><td className="px-3 py-4"><Badge variant={agency.installedVersion === latestVersion ? "default" : "secondary"}>{agency.installedVersion}</Badge></td><td className="px-3 py-4 text-xs text-slate-600">{previewByCode[agency.code] === undefined ? "待预览" : previewByCode[agency.code] < 0 ? "首次安装" : `${previewByCode[agency.code]} 项变更`}</td><td className="px-3 py-4 text-xs text-slate-500">{formatTime(agency.lastSyncedAt)}</td><td className="px-3 py-4"><span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />{agency.status || "正常"}</span></td></tr>)}{!loading && !agents.length ? <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">当前没有可下发的代理端。</td></tr> : null}</tbody></table></div>
          <div className="grid gap-3 border-t bg-slate-50 p-4 sm:grid-cols-3"><div className="rounded-lg border bg-white p-3"><div className="text-xs text-slate-500">最近同步记录</div><div className="mt-1 text-xl font-semibold">{auditEvents.filter((item) => item.action.includes("synced")).length}</div></div><div className="rounded-lg border bg-white p-3"><div className="text-xs text-slate-500">最近回退记录</div><div className="mt-1 text-xl font-semibold">{auditEvents.filter((item) => item.action.includes("restored")).length}</div></div><div className="rounded-lg border bg-white p-3"><div className="text-xs text-slate-500">最近批次</div><div className="mt-1 truncate text-sm font-semibold">{lastBatch ? `${lastBatch.mode === "pilot" ? "灰度" : "全量"} · ${lastBatch.codes.length} 端` : "暂无"}</div></div></div>
          {auditEvents.length ? <div className="border-t px-5 py-3 text-xs text-slate-500">审计：{auditEvents.slice(0, 3).map((item) => `${item.action.replace("template_snapshot_instance_", "")}: ${item.target_id || "-"}`).join(" · ")}</div> : null}
          <div className="border-t bg-slate-50 px-5 py-3 text-xs leading-5 text-slate-500"><Clock3 className="mr-1 inline h-3.5 w-3.5" />同步仅覆盖代理源受管配置；代理的商标、简称、客户、订单及其他经营数据不属于代理源，不会被同步覆盖。</div>
        </div>
      </div>
      </section>
    </FactoryPage>
  );
}
