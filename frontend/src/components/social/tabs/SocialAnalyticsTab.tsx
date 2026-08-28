import { useCallback, useEffect, useState } from "react";
import { Eye, Heart, MessageCircle, Users } from "lucide-react";
import { SocialListeningGovernance } from "@/components/social/SocialListeningGovernance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authApi } from "@/lib/auth";
import { getSiteById } from "@/lib/sites";
import { SOCIAL_SERVICE_PACKAGES, socialServicePackageStorageKey } from "@/lib/social-development-roadmap";
import { socialPageAssetsApi } from "@/lib/social-page-assets-api";
import { getLatestOfficialSnapshot, readSocialOfficialMetricSnapshots, readSocialPageBindings, type SocialOfficialMetricSnapshot, type SocialPageBinding } from "@/lib/social-real-page-workbench";
import { PLATFORMS, formatOfficialMetric, pageBindingFromServer, pageSnapshotFromServer, readSocialLocalArray, socialCampaignLinkStorageKey, socialContentDraftStorageKey, socialLeadTaskStorageKey, socialPublishTaskStorageKey, socialVideoTaskStorageKey, type SocialLocalMetric } from "./social-tab-shared";

type SocialPlatformAttribution = { name: string; posts: number; reach: string; engagement: string; growth: string };
type SocialContentLeadAttribution = { contentTitle: string; platform: string; leads: number; approvalState: string };
type LocalCampaignLink = { id: string; name: string; channel: string; destination: string; trackingUrl: string; createdAt: string };
type VerifiedMetricInput = { followers: string; impressions: string; engagements: string; views: string; clicks: string };

export default function SocialAnalyticsTab({ siteId }: { siteId?: string | null }) {
  const [localMetric, setLocalMetric] = useState<SocialLocalMetric>({ drafts: 0, schedules: 0, videos: 0, leads: 0 });
  const [platformStats, setPlatformStats] = useState<SocialPlatformAttribution[]>([]);
  const [contentLeadAttributions, setContentLeadAttributions] = useState<SocialContentLeadAttribution[]>([]);
  const [campaignLinks, setCampaignLinks] = useState<LocalCampaignLink[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [campaignChannel, setCampaignChannel] = useState("Facebook");
  const [campaignDestination, setCampaignDestination] = useState("");
  const [campaignNotice, setCampaignNotice] = useState("");
  const [reportPackageId, setReportPackageId] = useState("entry");
  const [reportNotice, setReportNotice] = useState("");
  const [pageBindings, setPageBindings] = useState<SocialPageBinding[]>([]);
  const [officialSnapshots, setOfficialSnapshots] = useState<SocialOfficialMetricSnapshot[]>([]);
  const [analysisRange, setAnalysisRange] = useState("30");
  const [showVerifiedMetricForm, setShowVerifiedMetricForm] = useState(false);
  const [selectedPageAssetId, setSelectedPageAssetId] = useState("");
  const [verifiedMetricInput, setVerifiedMetricInput] = useState<VerifiedMetricInput>({ followers: "", impressions: "", engagements: "", views: "", clicks: "" });
  const [verifiedMetricNotice, setVerifiedMetricNotice] = useState("");
  const projectId = siteId ? getSiteById(siteId)?.planId ?? null : null;
  const refreshLocalMetric = useCallback(() => {
    const drafts = readSocialLocalArray(socialContentDraftStorageKey(siteId));
    const schedules = readSocialLocalArray(socialPublishTaskStorageKey(siteId));
    const videos = readSocialLocalArray(socialVideoTaskStorageKey(siteId));
    const leads = readSocialLocalArray(socialLeadTaskStorageKey(siteId));
    const perPlatform = new Map<string, number>();
    const add = (platform: unknown) => {
      if (typeof platform !== "string" || !platform.trim()) return;
      perPlatform.set(platform, (perPlatform.get(platform) || 0) + 1);
    };
    drafts.forEach((draft) => Array.isArray(draft?.platforms) && draft.platforms.forEach(add));
    schedules.forEach((task) => add(task?.platform));
    leads.forEach((lead) => add(lead?.platform));
    setLocalMetric({ drafts: drafts.length, schedules: schedules.length, videos: videos.length, leads: leads.length });
    setPlatformStats([...perPlatform.entries()].sort(([a], [b]) => a.localeCompare(b, "zh-CN")).map(([name, posts]) => ({ name, posts, reach: "等待 OAuth", engagement: "等待 OAuth", growth: "等待 OAuth" })));
    const contentLeadMap = new Map<string, SocialContentLeadAttribution>();
    leads.forEach((lead) => {
      const title = typeof lead?.sourceDraftTitle === "string" && lead.sourceDraftTitle.trim() ? lead.sourceDraftTitle : "未关联内容";
      const platform = typeof lead?.platform === "string" && lead.platform.trim() ? lead.platform : "未指定渠道";
      const key = `${title}::${platform}`;
      const current = contentLeadMap.get(key) ?? { contentTitle: title, platform, leads: 0, approvalState: "本地待办" };
      current.leads += 1;
      contentLeadMap.set(key, current);
    });
    setContentLeadAttributions([...contentLeadMap.values()].sort((a, b) => b.leads - a.leads || a.contentTitle.localeCompare(b.contentTitle, "zh-CN")));
    setPageBindings(readSocialPageBindings(siteId));
    setOfficialSnapshots(readSocialOfficialMetricSnapshots(siteId));
  }, [siteId]);

  useEffect(() => { refreshLocalMetric(); }, [refreshLocalMetric]);

  const loadServerPageMetrics = useCallback(async () => {
    if (!projectId || !authApi.getStoredToken()) return;
    const { items } = await socialPageAssetsApi.list(projectId);
    const snapshotResponses = await Promise.all(items.map((item) => socialPageAssetsApi.listSnapshots(projectId, item.id)));
    setPageBindings(items.map(pageBindingFromServer));
    setOfficialSnapshots(snapshotResponses.flatMap((response) => response.items).map(pageSnapshotFromServer));
    setSelectedPageAssetId((current) => current || items[0]?.id || "");
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !authApi.getStoredToken()) return;
    let active = true;
    void loadServerPageMetrics().catch(() => { if (active) setVerifiedMetricNotice("服务器主页数据暂不可用，当前不展示任何远程指标。请检查计划权限、迁移和后端连接。 "); });
    return () => { active = false; };
  }, [loadServerPageMetrics, projectId]);

  useEffect(() => {
    const links = readSocialLocalArray(socialCampaignLinkStorageKey(siteId));
    setCampaignLinks(links.filter((item): item is LocalCampaignLink => Boolean(item && typeof item.id === "string" && typeof item.name === "string" && typeof item.channel === "string" && typeof item.destination === "string" && typeof item.trackingUrl === "string" && typeof item.createdAt === "string")));
    setCampaignName(""); setCampaignDestination(""); setCampaignNotice("");
  }, [siteId]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(socialServicePackageStorageKey(siteId));
      setReportPackageId(SOCIAL_SERVICE_PACKAGES.some((item) => item.id === stored) ? stored! : "entry");
    } catch { setReportPackageId("entry"); }
    setReportNotice("");
  }, [siteId]);

  const reportPackage = SOCIAL_SERVICE_PACKAGES.find((item) => item.id === reportPackageId) || SOCIAL_SERVICE_PACKAGES[0];
  const latestPageRows = pageBindings.map((binding) => ({ binding, snapshot: getLatestOfficialSnapshot(binding.id, officialSnapshots) }));
  const pagesWithOfficialData = latestPageRows.filter((row) => row.snapshot).length;
  const growthGuidance = pageBindings.length === 0
    ? "先登记真实主页资产，再确定本计划需要追踪的平台指标。"
    : pagesWithOfficialData === 0
      ? "主页已登记，但尚无官方快照。请等待总部完成 OAuth、平台审核和服务端同步后再判断增长表现。"
      : localMetric.schedules === 0
        ? "已有官方主页数据，但当前计划没有排期任务。先建立可审核内容与发布节奏，再比较内容表现。"
        : "已有官方快照与本地内容计划。请由运营人员结合互动、播放、点击和线索进行人工复核后，生成下一周期选题。";

  const createCampaignLink = () => {
    const name = campaignName.trim();
    const destination = campaignDestination.trim();
    if (!name || !destination) { setCampaignNotice("请填写活动名称和 HTTPS 落地页地址。"); return; }
    try {
      const url = new URL(destination);
      if (url.protocol !== "https:") throw new Error("https required");
      url.searchParams.set("utm_source", campaignChannel.toLowerCase().replace(/\s+/g, "-"));
      url.searchParams.set("utm_medium", "social");
      url.searchParams.set("utm_campaign", name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "-").replace(/^-+|-+$/g, ""));
      const next = [{ id: `campaign-${Date.now()}`, name, channel: campaignChannel, destination, trackingUrl: url.toString(), createdAt: new Date().toISOString() }, ...campaignLinks];
      setCampaignLinks(next);
      try { window.localStorage.setItem(socialCampaignLinkStorageKey(siteId), JSON.stringify(next)); } catch { /* current-session list remains visible */ }
      setCampaignName(""); setCampaignDestination(""); setCampaignNotice("已生成本计划可追溯链接；访问和转化数据需后续由已授权分析服务回传。");
    } catch {
      setCampaignNotice("落地页必须是完整的 HTTPS 地址，例如 https://example.com/landing。 ");
    }
  };

  const createVerifiedMetricSnapshot = async () => {
    if (!projectId || !authApi.getStoredToken() || !selectedPageAssetId) {
      setVerifiedMetricNotice("请先进入绑定正式计划的客户源，并保存主页资产到服务器，才能登记核验数据。");
      return;
    }
    const payload = Object.fromEntries(Object.entries(verifiedMetricInput).flatMap(([key, raw]) => {
      const value = raw.trim();
      if (!value) return [];
      const numeric = Number(value);
      return Number.isInteger(numeric) && numeric >= 0 ? [[key, numeric]] : [];
    })) as Partial<Record<keyof VerifiedMetricInput, number>>;
    if (Object.keys(payload).length === 0 || Object.keys(payload).length !== Object.values(verifiedMetricInput).filter((value) => value.trim()).length) {
      setVerifiedMetricNotice("请至少填写一项非负整数指标；人工录入仅用于核验过的官方后台导出数据。 ");
      return;
    }
    try {
      await socialPageAssetsApi.createVerifiedSnapshot(projectId, selectedPageAssetId, payload);
      setVerifiedMetricInput({ followers: "", impressions: "", engagements: "", views: "", clicks: "" });
      setShowVerifiedMetricForm(false);
      await loadServerPageMetrics();
      setVerifiedMetricNotice("核验数据已保存为“人工核验”，并可进入主页驾驶舱、诊断与归因报告；它不会被标为官方自动同步。 ");
    } catch {
      setVerifiedMetricNotice("核验数据未能保存。请确认当前计划权限、后端迁移已完成，并检查每项指标均为非负整数。 ");
    }
  };

  return (
    <div className="space-y-4">
      <Card data-social-local-attribution className="border-blue-200 bg-blue-50/40">
        <CardHeader className="flex flex-row items-center justify-between gap-3"><div><CardTitle className="text-base">本计划运营数据</CardTitle><p className="mt-1 text-sm text-slate-600">来自当前计划已保存的本地内容和待办；外部平台数据将在 OAuth 数据回传后替换。</p></div><Button size="sm" variant="outline" onClick={refreshLocalMetric}>刷新本地数据</Button></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[{ label: "内容草稿", value: localMetric.drafts }, { label: "排期任务", value: localMetric.schedules }, { label: "视频任务", value: localMetric.videos }, { label: "线索待办", value: localMetric.leads }].map((item) => <div key={item.label} className="rounded-md border border-blue-100 bg-white p-3"><div className="text-xs text-slate-500">{item.label}</div><div className="mt-1 text-2xl font-bold text-slate-900">{item.value}</div></div>)}
        </CardContent>
      </Card>

      {projectId ? <SocialListeningGovernance projectId={projectId} /> : null}

      <Card data-social-real-page-analytics className="border-violet-200 bg-violet-50/40">
        <CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle className="text-base">35 · 真实主页表现与数据新鲜度</CardTitle><p className="mt-1 text-sm leading-6 text-slate-600">按主页展示经官方接口回传的最新快照。时间范围用于未来趋势查询；当前不会以本地任务替代粉丝、曝光或互动。</p></div><div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={() => setShowVerifiedMetricForm((value) => !value)}>登记核验数据</Button><Select value={analysisRange} onValueChange={setAnalysisRange}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">近 7 天</SelectItem><SelectItem value="30">近 30 天</SelectItem><SelectItem value="90">近 90 天</SelectItem></SelectContent></Select></div></CardHeader>
        <CardContent>{showVerifiedMetricForm ? <div className="mb-4 grid gap-3 rounded-lg border border-violet-200 bg-white p-3 md:grid-cols-3"><div className="md:col-span-3"><div className="text-sm font-medium text-slate-900">人工核验数据登记</div><p className="mt-1 text-xs leading-5 text-slate-600">仅填写从客户拥有权限的官方后台导出或截图核验过的数据。保存后来源会明确标记为“人工核验”，不会伪装为自动 API 同步。</p></div><Select value={selectedPageAssetId} onValueChange={setSelectedPageAssetId}><SelectTrigger><SelectValue placeholder="选择已保存主页" /></SelectTrigger><SelectContent>{pageBindings.map((binding) => <SelectItem key={binding.id} value={binding.id}>{binding.platform} · {binding.pageName}</SelectItem>)}</SelectContent></Select><Input inputMode="numeric" value={verifiedMetricInput.followers} onChange={(event) => setVerifiedMetricInput((current) => ({ ...current, followers: event.target.value }))} placeholder="粉丝数" /><Input inputMode="numeric" value={verifiedMetricInput.impressions} onChange={(event) => setVerifiedMetricInput((current) => ({ ...current, impressions: event.target.value }))} placeholder="曝光量" /><Input inputMode="numeric" value={verifiedMetricInput.engagements} onChange={(event) => setVerifiedMetricInput((current) => ({ ...current, engagements: event.target.value }))} placeholder="互动量" /><Input inputMode="numeric" value={verifiedMetricInput.views} onChange={(event) => setVerifiedMetricInput((current) => ({ ...current, views: event.target.value }))} placeholder="播放量" /><Input inputMode="numeric" value={verifiedMetricInput.clicks} onChange={(event) => setVerifiedMetricInput((current) => ({ ...current, clicks: event.target.value }))} placeholder="点击量" /><div className="flex justify-end gap-2 md:col-span-3"><Button size="sm" variant="outline" onClick={() => setShowVerifiedMetricForm(false)}>取消</Button><Button size="sm" disabled={!pageBindings.length} onClick={() => void createVerifiedMetricSnapshot()}>保存核验快照</Button></div></div> : null}{verifiedMetricNotice ? <p className="mb-3 rounded-md border border-violet-200 bg-white px-3 py-2 text-xs leading-5 text-violet-900" role="status">{verifiedMetricNotice}</p> : null}<Table><TableHeader><TableRow><TableHead>真实主页</TableHead><TableHead>粉丝</TableHead><TableHead>曝光</TableHead><TableHead>互动</TableHead><TableHead>播放</TableHead><TableHead>数据状态</TableHead></TableRow></TableHeader><TableBody>{latestPageRows.length === 0 ? <TableRow><TableCell colSpan={6} className="py-7 text-center text-sm text-slate-500">尚未登记真实主页资产。请从“账号连接”登记客户要运营的主页。</TableCell></TableRow> : latestPageRows.map(({ binding, snapshot }) => <TableRow key={binding.id}><TableCell><div className="font-medium">{binding.pageName}</div><div className="text-xs text-slate-500">{binding.platform}</div></TableCell><TableCell>{formatOfficialMetric(snapshot?.followers)}</TableCell><TableCell>{formatOfficialMetric(snapshot?.impressions)}</TableCell><TableCell>{formatOfficialMetric(snapshot?.engagements)}</TableCell><TableCell>{formatOfficialMetric(snapshot?.views)}</TableCell><TableCell><Badge variant="outline" className={snapshot ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>{snapshot ? `${snapshot.source === "official_api" ? "官方接口" : "人工核验"} · ${new Date(snapshot.capturedAt).toLocaleDateString("zh-CN")}` : `待同步 · ${analysisRange} 天视图`}</Badge></TableCell></TableRow>)}</TableBody></Table></CardContent>
      </Card>

      <Card data-social-growth-diagnosis className="border-cyan-200 bg-cyan-50/40">
        <CardHeader><CardTitle className="text-base">36 · 增长诊断与内容建议</CardTitle><p className="text-sm leading-6 text-slate-600">这是“数据 → 人工判断 → 可审核内容建议”的工作台，不自动承诺增长或自动修改发布计划。</p></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]"><div className="rounded-lg border border-cyan-100 bg-white p-4"><div className="text-sm font-medium text-slate-900">当前诊断</div><p className="mt-2 text-sm leading-6 text-slate-600">{growthGuidance}</p><div className="mt-3 flex flex-wrap gap-2 text-xs"><Badge variant="outline">登记主页 {pageBindings.length}</Badge><Badge variant="outline">官方快照 {pagesWithOfficialData}</Badge><Badge variant="outline">本地排期 {localMetric.schedules}</Badge><Badge variant="outline">本地线索 {localMetric.leads}</Badge></div></div><div className="flex flex-col justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setReportNotice("诊断建议已准备：先核对数据截至时间，再由代理运营复核增长异常、最佳内容与目标市场，最后进入内容创作提交审核。")}>查看复核顺序</Button><Button size="sm" onClick={() => setReportNotice("下一周期选题应由代理源的行业模板生成，并在客户源经过市场、语言、素材权利与人工审核后保存为草稿。")}>生成选题说明</Button></div>{reportNotice ? <p className="text-xs leading-5 text-cyan-900 md:col-span-2" role="status">{reportNotice}</p> : null}</CardContent>
      </Card>

      <Card data-social-campaign-link-builder className="border-indigo-200 bg-indigo-50/40">
        <CardHeader><CardTitle className="text-base">活动链接与转化归因</CardTitle><p className="text-sm text-slate-600">为内容或活动生成统一 UTM 链接。这里只生成链接规则，不读取访问者数据，也不发送到外部渠道。</p></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="活动名称，例如秋季询盘" />
          <Select value={campaignChannel} onValueChange={setCampaignChannel}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PLATFORMS.map((platform) => <SelectItem key={platform.name} value={platform.name}>{platform.name}</SelectItem>)}</SelectContent></Select>
          <Input value={campaignDestination} onChange={(event) => setCampaignDestination(event.target.value)} placeholder="HTTPS 落地页地址" />
          <div className="flex items-center justify-between gap-2 md:col-span-3"><span className="text-xs text-slate-500">后续可将此链接与内容、表单、CRM 商机关联，形成可核验漏斗。</span><Button type="button" onClick={createCampaignLink}>生成活动链接</Button></div>
          {campaignNotice ? <p className="text-sm text-indigo-700 md:col-span-3" role="status">{campaignNotice}</p> : null}
          {campaignLinks.length ? <div className="space-y-2 md:col-span-3">{campaignLinks.slice(0, 5).map((link) => <div key={link.id} className="rounded-md border border-slate-200 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm text-slate-900">{link.name}</b><Badge variant="outline">{link.channel}</Badge></div><p className="mt-1 break-all text-xs text-slate-600">{link.trackingUrl}</p></div>)}</div> : null}
        </CardContent>
      </Card>

      <Card data-social-executive-report className="border-emerald-200 bg-emerald-50/40">
        <CardHeader><CardTitle className="text-base">经营报告与续费建议</CardTitle><p className="text-sm text-slate-600">按当前套餐生成本地报告提纲。只汇总可核验的本地任务；官方曝光、广告消耗和成交仍需授权数据回传。</p></CardHeader>
        <CardContent className="space-y-3"><div className="grid gap-3 md:grid-cols-4"><div className="rounded-md border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">当前套餐</div><div className="mt-1 font-semibold text-slate-900">{reportPackage.title}</div></div><div className="rounded-md border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">约定内容</div><div className="mt-1 font-semibold text-slate-900">{reportPackage.annualPosts}</div></div><div className="rounded-md border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">本地线索</div><div className="mt-1 font-semibold text-slate-900">{localMetric.leads}</div></div><div className="rounded-md border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">复盘节奏</div><div className="mt-1 font-semibold text-slate-900">{reportPackage.reporting}</div></div></div><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-500">报告将包含：内容交付、线索处理、归因链路、待解决风险与下周期建议。</span><Button type="button" variant="outline" onClick={() => setReportNotice(`已生成“${reportPackage.title}”本地报告提纲；正式报告须由已授权数据和人工复核补全。`)}>生成报告提纲</Button></div>{reportNotice ? <p className="text-sm text-emerald-700" role="status">{reportNotice}</p> : null}</CardContent>
      </Card>

      <Card data-social-growth-delivery-board className="border-slate-200 bg-slate-50/70">
        <CardHeader><CardTitle className="text-base">增长、交付与客户成果看板</CardTitle><p className="text-sm text-slate-600">第 21–24 项的本地基础结构。所有结论均以已保存任务为准，外部曝光、成交与广告数据未接入前保持“待回传”。</p></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><div className="rounded-lg border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">21 · A/B 测试</div><div className="mt-1 font-semibold text-slate-900">待建立实验</div><p className="mt-1 text-xs leading-5 text-slate-500">先确定单一变量、对照版本和停止规则，再等待真实数据。</p><Button size="sm" variant="outline" className="mt-2" onClick={() => setReportNotice("测试计划应包含假设、单一变量、样本条件与人工审核；真实平台数据接入后才可记录结果。")} >查看测试规则</Button></div><div className="rounded-lg border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">22 · 销售漏斗与 SLA</div><div className="mt-1 font-semibold text-slate-900">{localMetric.drafts} 内容 → {localMetric.schedules} 排期 → {localMetric.leads} 线索</div><p className="mt-1 text-xs leading-5 text-slate-500">线索优先级与响应时限请在“互动转化”处理；商机和成交需 CRM 回传。</p></div><div className="rounded-lg border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">23 · 服务交付协同</div><div className="mt-1 font-semibold text-slate-900">{reportPackage.title} · {reportPackage.annualPosts}</div><p className="mt-1 text-xs leading-5 text-slate-500">本月交付、客户确认和服务额度将按总部发布的套餐模板继续扩展。</p></div><div className="rounded-lg border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">24 · 客户成果中心</div><div className="mt-1 font-semibold text-slate-900">本地成果 {localMetric.drafts + localMetric.schedules + localMetric.leads} 项</div><p className="mt-1 text-xs leading-5 text-slate-500">只展示可核验内容、线索与报告；不把未授权的指标包装成成果。</p></div>{reportNotice ? <p className="text-sm text-slate-600 md:col-span-2 xl:col-span-4">{reportNotice}</p> : null}</CardContent>
      </Card>

      <Card data-social-budget-success className="border-amber-200 bg-amber-50/35">
        <CardHeader><CardTitle className="text-base">预算额度与客户成功提醒</CardTitle><p className="text-sm text-slate-600">当前只展示套餐计划额度和本地交付数量。广告消耗、实际成本、满意度与续费风险须由人工确认或正式服务回传。</p></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><div className="rounded-md border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">26 · 广告计划额度</div><div className="mt-1 font-semibold text-slate-900">{reportPackage.adBudget}</div><p className="mt-1 text-xs text-amber-700">未接入官方账单，不计算已花费。</p></div><div className="rounded-md border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">26 · 内容交付进度</div><div className="mt-1 font-semibold text-slate-900">本地排期 {localMetric.schedules} 项</div><p className="mt-1 text-xs text-slate-500">对照套餐 {reportPackage.annualPosts}，需按服务周期人工复核。</p></div><div className="rounded-md border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">28 · 客户满意度</div><div className="mt-1 font-semibold text-slate-900">待客户确认</div><p className="mt-1 text-xs text-slate-500">应在交付复盘后由客户或服务人员人工记录。</p></div><div className="rounded-md border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">28 · 续费风险</div><div className="mt-1 font-semibold text-slate-900">待人工评估</div><p className="mt-1 text-xs text-slate-500">以交付、反馈、风险事项和续费日期综合判断。</p></div></CardContent>
      </Card>

      <Card data-social-agency-quality className="border-cyan-200 bg-cyan-50/35">
        <CardHeader><CardTitle className="text-base">多代理服务质量看板</CardTitle><p className="text-sm text-slate-600">当前仅展示本计划可核验的服务结构。正式总部汇总必须由后端按代理、客户与计划范围隔离后生成。</p></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4"><div className="rounded-md border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">服务范围</div><div className="mt-1 font-semibold text-slate-900">当前独立计划</div></div><div className="rounded-md border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">本地交付</div><div className="mt-1 font-semibold text-slate-900">内容 {localMetric.drafts} · 排期 {localMetric.schedules}</div></div><div className="rounded-md border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">跟进风险</div><div className="mt-1 font-semibold text-slate-900">线索 {localMetric.leads} · 待人工确认</div></div><div className="rounded-md border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">总部汇总</div><div className="mt-1 font-semibold text-slate-900">待后端范围隔离接入</div></div></CardContent>
      </Card>

      <p className="text-xs text-slate-500">本表只统计当前计划本地草稿、排期和线索涉及的渠道；曝光、互动与粉丝数据必须由 OAuth 授权后的官方接口回传。</p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              总曝光
              <Eye className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold mt-1">—</div>
            <div className="text-xs text-slate-500">等待 OAuth 数据回传</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              总互动
              <Heart className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold mt-1">—</div>
            <div className="text-xs text-slate-500">等待 OAuth 数据回传</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              评论数
              <MessageCircle className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold mt-1">—</div>
            <div className="text-xs text-slate-500">等待 OAuth 数据回传</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              新增粉丝
              <Users className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold mt-1">—</div>
            <div className="text-xs text-slate-500">等待 OAuth 数据回传</div>
          </CardContent>
        </Card>
      </div>

      <Card data-social-content-lead-attribution>
        <CardHeader><CardTitle className="text-base">37 · 主页 → 内容 → 线索归因</CardTitle><p className="text-sm leading-6 text-slate-600">把登记主页、内容来源、UTM 链接与人工审核的 CRM 线索串为可追溯链路。只展示手动关联的本地线索；未授权平台互动不会被虚构为成交或收入。</p></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>对应主页</TableHead><TableHead>来源内容</TableHead><TableHead>渠道</TableHead><TableHead>已关联线索</TableHead><TableHead>交接状态</TableHead></TableRow></TableHeader>
            <TableBody>
              {contentLeadAttributions.length === 0 ? <TableRow><TableCell colSpan={5} className="py-7 text-center text-sm text-slate-500">创建线索时选择来源内容后，此处会形成可追溯的主页 → 内容 → 线索链路。</TableCell></TableRow> : null}
              {contentLeadAttributions.map((record) => { const page = pageBindings.find((binding) => binding.platform === record.platform); return <TableRow key={`${record.contentTitle}-${record.platform}`}><TableCell>{page ? <div><div className="font-medium">{page.pageName}</div><div className="text-xs text-slate-500">已登记</div></div> : <span className="text-slate-500">待登记主页</span>}</TableCell><TableCell className="font-medium">{record.contentTitle}</TableCell><TableCell>{record.platform}</TableCell><TableCell>{record.leads}</TableCell><TableCell><Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">{record.approvalState}</Badge></TableCell></TableRow>; })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card data-social-page-outcome-report className="border-emerald-200 bg-emerald-50/35">
        <CardHeader><CardTitle className="text-base">37 · 客户主页成果报告</CardTitle><p className="text-sm leading-6 text-slate-600">报告按“真实主页资产、数据截至时间、内容交付、可追溯链接、已审核线索、待处理风险”组织。总部统一数据口径，代理源提供行业模板，客户源只查看本计划已核验结果。</p></CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3"><div className="text-sm text-slate-600">当前可纳入：主页 {pageBindings.length} 个 · 官方快照 {pagesWithOfficialData} 条 · UTM 链接 {campaignLinks.length} 条 · 本地线索 {localMetric.leads} 条</div><Button size="sm" variant="outline" onClick={() => setReportNotice("主页成果报告提纲已生成：先补齐官方数据截至时间和人工审核线索，再由代理运营复核后向客户发送。")}>生成主页报告提纲</Button></CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">平台任务归因</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>平台</TableHead>
                <TableHead>本地任务</TableHead>
                <TableHead>总曝光</TableHead>
                <TableHead>互动率</TableHead>
                <TableHead>粉丝增长</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {platformStats.length === 0 ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">当前计划还没有可归因的本地任务。创建内容、排期或线索后会显示对应渠道。</TableCell></TableRow> : null}
              {platformStats.map((p) => (
                <TableRow key={p.name}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.posts}</TableCell>
                  <TableCell>{p.reach}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-blue-600 bg-blue-50">
                      {p.engagement}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500">{p.growth}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">近 30 天互动趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-slate-600">尚未接入官方 OAuth 数据，暂不绘制趋势，避免产生虚假运营结论。</p>
          <div className="h-48 flex items-end gap-1">
            {Array.from({ length: 0 }).map((_, i) => {
              const h = 20 + Math.abs(Math.sin(i * 0.8) * 80);
              return (
                <div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-blue-500 to-sky-300 rounded-t"
                  style={{ height: `${h}%` }}
                  title={`Day ${i + 1}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-2">
            <span>30 天前</span>
            <span>今天</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
