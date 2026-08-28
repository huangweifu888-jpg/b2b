import { useCallback, useEffect, useState } from "react";
import { CalendarClock, PenSquare, Users, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authApi } from "@/lib/auth";
import { getSiteById } from "@/lib/sites";
import { socialPageAssetsApi } from "@/lib/social-page-assets-api";
import { getLatestOfficialSnapshot, readSocialOfficialMetricSnapshots, readSocialPageBindings, type SocialOfficialMetricSnapshot, type SocialPageBinding } from "@/lib/social-real-page-workbench";
import { PLATFORMS, formatOfficialMetric, officialSnapshotStatus, pageBindingFromServer, pageSnapshotFromServer, parseDateTime, readSocialLocalArray, socialContentDraftStorageKey, socialLeadTaskStorageKey, socialPublishTaskStorageKey, socialVideoTaskStorageKey, type SocialLocalMetric } from "./social-tab-shared";

type DashboardLocalTask = { platform: string; title: string; createdAt: string; status: string };
type DashboardPlatformSummary = { name: string; taskCount: number };

export default function SocialDashboardTab({ siteId }: { siteId?: string | null }) {
  const [localMetric, setLocalMetric] = useState<SocialLocalMetric>({ drafts: 0, schedules: 0, videos: 0, leads: 0 });
  const [recentTasks, setRecentTasks] = useState<DashboardLocalTask[]>([]);
  const [platformSummary, setPlatformSummary] = useState<DashboardPlatformSummary[]>([]);
  const [pageBindings, setPageBindings] = useState<SocialPageBinding[]>([]);
  const [officialSnapshots, setOfficialSnapshots] = useState<SocialOfficialMetricSnapshot[]>([]);
  const projectId = siteId ? getSiteById(siteId)?.planId ?? null : null;
  const refreshLocalMetric = useCallback(() => {
    const drafts = readSocialLocalArray(socialContentDraftStorageKey(siteId));
    const schedules = readSocialLocalArray(socialPublishTaskStorageKey(siteId));
    const videos = readSocialLocalArray(socialVideoTaskStorageKey(siteId));
    const leads = readSocialLocalArray(socialLeadTaskStorageKey(siteId));
    const tasks: DashboardLocalTask[] = [
      ...drafts.flatMap((draft) => Array.isArray(draft?.platforms) ? draft.platforms.map((platform: string) => ({ platform, title: typeof draft?.title === "string" ? draft.title : "未命名内容草稿", createdAt: typeof draft?.createdAt === "string" ? draft.createdAt : "", status: draft?.status === "pending_review" ? "待审核" : "草稿" })) : []),
      ...schedules.map((task) => ({ platform: typeof task?.platform === "string" ? task.platform : "未指定渠道", title: typeof task?.title === "string" ? task.title : "未命名排期任务", createdAt: typeof task?.date === "string" ? task.date : "", status: typeof task?.status === "string" ? task.status : "草稿" })),
    ];
    const counts = new Map<string, number>();
    tasks.forEach((task) => counts.set(task.platform, (counts.get(task.platform) || 0) + 1));
    setLocalMetric({ drafts: drafts.length, schedules: schedules.length, videos: videos.length, leads: leads.length });
    setRecentTasks([...tasks].sort((a, b) => parseDateTime(b.createdAt) - parseDateTime(a.createdAt)).slice(0, 8));
    setPlatformSummary([...counts.entries()].sort(([a], [b]) => a.localeCompare(b, "zh-CN")).map(([name, taskCount]) => ({ name, taskCount })));
    setPageBindings(readSocialPageBindings(siteId));
    setOfficialSnapshots(readSocialOfficialMetricSnapshots(siteId));
  }, [siteId]);

  useEffect(() => {
    refreshLocalMetric();
  }, [refreshLocalMetric]);

  useEffect(() => {
    if (!projectId || !authApi.getStoredToken()) return;
    let active = true;
    void socialPageAssetsApi.list(projectId)
      .then(async ({ items }) => {
        const snapshots = (await Promise.all(items.map((item) => socialPageAssetsApi.listSnapshots(projectId, item.id)))).flatMap((response) => response.items);
        if (!active) return;
        setPageBindings(items.map(pageBindingFromServer));
        setOfficialSnapshots(snapshots.map(pageSnapshotFromServer));
      })
      .catch(() => { /* Local plan data remains available; the dashboard never invents remote metrics. */ });
    return () => { active = false; };
  }, [projectId]);

  const kpis = [
    { label: "内容草稿", value: String(localMetric.drafts), change: "当前计划", icon: PenSquare, color: "text-blue-600" },
    { label: "排期任务", value: String(localMetric.schedules), change: "当前计划", icon: CalendarClock, color: "text-emerald-600" },
    { label: "视频任务", value: String(localMetric.videos), change: "当前计划", icon: Video, color: "text-rose-500" },
    { label: "线索待办", value: String(localMetric.leads), change: "待人工跟进", icon: Users, color: "text-amber-500" },
  ];

  return (
    <div className="space-y-4">
      <Card data-social-local-overview data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" data-shared-large-card-surface="true" className="border-blue-200 bg-blue-50/40">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-medium text-slate-900">本计划运营总览</div>
            <p className="mt-1 text-sm text-slate-600">此处仅汇总当前计划已保存的内容、排期、视频和线索待办；平台账号、曝光及互动数据需完成 OAuth 授权后才会接入。</p>
          </div>
          <Button size="sm" variant="outline" onClick={refreshLocalMetric}>刷新本地数据</Button>
        </CardContent>
      </Card>
      <Card data-social-real-page-cockpit data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" data-shared-large-card-surface="true" className="border-violet-200 bg-violet-50/40">
        <CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle className="text-base">35 · 真实主页运营驾驶舱</CardTitle><p className="mt-1 text-sm leading-6 text-slate-600">按当前独立计划汇总已登记主页。粉丝、曝光、互动、播放和点击只读取总部服务端保存的官方接口快照；没有快照时保持空值，不显示估算数据。</p></div><Badge variant="outline" className="border-violet-200 bg-white text-violet-800">已登记主页 {pageBindings.length}</Badge></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pageBindings.length === 0 ? <div className="rounded-md border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500 md:col-span-2 xl:col-span-3">请先在“账号连接”登记实际运营主页。完成官方 OAuth 回调后，服务端才会按日写入可展示的真实数据。</div> : pageBindings.map((binding) => {
            const snapshot = getLatestOfficialSnapshot(binding.id, officialSnapshots);
            return <div key={binding.id} className="rounded-lg border border-violet-100 bg-white p-4"><div className="flex items-start justify-between gap-2"><div><div className="font-semibold text-slate-900">{binding.pageName}</div><div className="mt-1 text-xs text-slate-500">{binding.platform} · {officialSnapshotStatus(snapshot)}</div></div><a className="text-xs text-blue-700 underline underline-offset-2" href={binding.pageUrl} target="_blank" rel="noreferrer">原主页</a></div><div className="mt-3 grid grid-cols-2 gap-2 text-sm"><div className="rounded bg-slate-50 p-2"><div className="text-xs text-slate-500">粉丝</div><b className="text-slate-900">{formatOfficialMetric(snapshot?.followers)}</b></div><div className="rounded bg-slate-50 p-2"><div className="text-xs text-slate-500">曝光</div><b className="text-slate-900">{formatOfficialMetric(snapshot?.impressions)}</b></div><div className="rounded bg-slate-50 p-2"><div className="text-xs text-slate-500">互动</div><b className="text-slate-900">{formatOfficialMetric(snapshot?.engagements)}</b></div><div className="rounded bg-slate-50 p-2"><div className="text-xs text-slate-500">播放</div><b className="text-slate-900">{formatOfficialMetric(snapshot?.views)}</b></div></div><p className="mt-3 text-xs text-violet-800">状态：{snapshot ? "已获得官方数据快照" : "待 OAuth、平台审核与服务端同步"}</p></div>;
          })}
        </CardContent>
      </Card>
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" data-shared-small-card-surface="true">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-500">{k.label}</div>
                  <Icon className={`w-4 h-4 ${k.color}`} />
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{k.value}</div>
                <div className="text-xs text-emerald-600 mt-1">{k.change} 较上周</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Platform distribution */}
      <Card data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" data-shared-large-card-surface="true">
        <CardHeader>
          <CardTitle className="text-base">平台分布</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {platformSummary.length === 0 ? <div className="col-span-full rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">当前计划尚无渠道任务。创建内容草稿或发布排期后，会在此汇总对应渠道。</div> : null}
            {platformSummary.map((item) => {
              const platform = PLATFORMS.find((candidate) => candidate.name === item.name);
              return <div key={item.name} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${platform?.color || "bg-slate-500"} text-sm font-bold text-white`}>
                  {platform?.short || item.name.slice(0, 2)}
                </div>
                <div><div className="text-sm font-medium text-slate-900">{item.name}</div><div className="text-xs text-slate-500">本地任务 {item.taskCount}</div></div>
              </div>;
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent posts */}
      <Card data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" data-shared-large-card-surface="true">
        <CardHeader>
          <CardTitle className="text-base">最近本地任务</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>平台</TableHead>
                <TableHead>内容</TableHead>
                <TableHead>数据状态</TableHead>
                <TableHead>时间</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTasks.length === 0 ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">当前计划尚无本地内容或排期任务。</TableCell></TableRow> : null}
              {recentTasks.map((task, index) => (
                <TableRow key={`${task.platform}-${task.createdAt}-${index}`}>
                  <TableCell className="font-medium">{task.platform}</TableCell>
                  <TableCell className="max-w-xs truncate">{task.title}</TableCell>
                  <TableCell className="text-slate-500">等待 OAuth 数据回传</TableCell>
                  <TableCell className="text-slate-500">{task.createdAt || "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        task.status === "待审核"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }
                    >
                      {task.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
