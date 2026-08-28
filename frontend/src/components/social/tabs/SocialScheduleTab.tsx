import { useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { ContentCalendarGovernance } from "@/components/social/ContentCalendarGovernance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authApi } from "@/lib/auth";
import { getSiteById } from "@/lib/sites";
import { normalizeSocialChannelName } from "@/lib/social-channel-contract";
import { socialContentReviewApi, type SocialContentReviewRecord } from "@/lib/social-content-review-api";
import { socialPublishJobApi, type SocialPublishJobRecord } from "@/lib/social-publish-job-api";
import { DEFAULT_SOCIAL_PLAN_SETTINGS, PLATFORMS, getAvailableSocialPlatforms, parseDateTime, readSocialPlanSettings, socialPublishTaskStorageKey, socialScheduleIntentStorageKey, type SocialPlanSettings } from "./social-tab-shared";

type LocalPublishTask = { id: string; date: string; platform: string; title: string; status: "草稿" | "待审核" };

export default function SocialScheduleTab({ siteId, createTaskRequested, onCloseCreateTask }: { siteId?: string | null; createTaskRequested: boolean; onCloseCreateTask: () => void }) {
  const [localTasks, setLocalTasks] = useState<LocalPublishTask[]>([]);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftPlatform, setDraftPlatform] = useState(PLATFORMS[0]?.name || "Facebook");
  const [draftDate, setDraftDate] = useState("");
  const [fromContentReview, setFromContentReview] = useState(false);
  const [serverReviews, setServerReviews] = useState<SocialContentReviewRecord[]>([]);
  const [serverPublishJobs, setServerPublishJobs] = useState<SocialPublishJobRecord[]>([]);
  const [reviewActionNotice, setReviewActionNotice] = useState("");
  const [planSettings, setPlanSettings] = useState<SocialPlanSettings>(DEFAULT_SOCIAL_PLAN_SETTINGS);
  const reviewProjectId = siteId ? getSiteById(siteId)?.planId ?? null : null;
  const availablePlatforms = useMemo(() => getAvailableSocialPlatforms(planSettings), [planSettings]);

  useEffect(() => {
    const nextSettings = readSocialPlanSettings(siteId);
    const firstPlatform = getAvailableSocialPlatforms(nextSettings)[0];
    setPlanSettings(nextSettings);
    if (firstPlatform) setDraftPlatform(firstPlatform.name);
  }, [siteId]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(socialPublishTaskStorageKey(siteId));
      const parsed = raw ? JSON.parse(raw) : [];
      setLocalTasks(Array.isArray(parsed) ? parsed.filter((item): item is LocalPublishTask => Boolean(item && typeof item.id === "string" && typeof item.title === "string" && typeof item.platform === "string" && typeof item.date === "string")) : []);
    } catch {
      setLocalTasks([]);
    }
  }, [siteId]);

  useEffect(() => {
    if (!createTaskRequested) return;
    try {
      const raw = window.localStorage.getItem(socialScheduleIntentStorageKey(siteId));
      const intent = raw ? JSON.parse(raw) : null;
        if (intent && typeof intent.title === "string") {
          setDraftTitle(intent.title);
          if (typeof intent.platform === "string" && availablePlatforms.some((platform) => platform.name === intent.platform)) setDraftPlatform(intent.platform);
          setFromContentReview(true);
      }
    } catch {
      setFromContentReview(false);
    }
  }, [availablePlatforms, createTaskRequested, siteId]);

  useEffect(() => {
    if (!reviewProjectId || !authApi.getStoredToken()) {
      setServerReviews([]);
      setServerPublishJobs([]);
      return;
    }
    let active = true;
    void Promise.all([socialContentReviewApi.list(reviewProjectId), socialPublishJobApi.list(reviewProjectId)])
      .then(([reviews, jobs]) => {
        if (!active) return;
        setServerReviews(reviews.items);
        setServerPublishJobs(jobs.items);
      })
      .catch(() => {
        if (!active) return;
        setServerReviews([]);
        setServerPublishJobs([]);
      });
    return () => { active = false; };
  }, [reviewProjectId]);

  const saveLocalTasks = (next: LocalPublishTask[]) => {
    setLocalTasks(next);
    try {
      window.localStorage.setItem(socialPublishTaskStorageKey(siteId), JSON.stringify(next));
    } catch {
      // The task remains visible for the current session when browser storage is unavailable.
    }
  };

  const updateLocalTaskStatus = (id: string, status: LocalPublishTask["status"]) => {
    saveLocalTasks(localTasks.map((task) => task.id === id ? { ...task, status } : task));
  };

  const removeLocalTask = (id: string) => {
    saveLocalTasks(localTasks.filter((task) => task.id !== id));
  };

  const canResubmitReturnedReview = (review: SocialContentReviewRecord) => {
    if (!review.channels.length) return false;
    const allowedNames = new Set(availablePlatforms.map((platform) => platform.name));
    return review.channels.every((channel) => {
      const normalized = normalizeSocialChannelName(channel);
      return normalized !== null && allowedNames.has(normalized);
    });
  };

  const resubmitReturnedReview = async (review: SocialContentReviewRecord) => {
    if (!canResubmitReturnedReview(review)) {
      setReviewActionNotice("该审核记录包含当前计划或来源运营包范围外渠道，未重新提交。");
      return;
    }
    try {
      const updated = await socialContentReviewApi.action(review.id, "resubmit");
      setServerReviews((current) => current.map((item) => item.id === updated.id ? updated : item));
      setReviewActionNotice("已重新提交代理初审；在审核通过和账号授权前不会外部发布。");
    } catch {
      setReviewActionNotice("重新提交未完成：请确认当前登录账号、计划权限和审核服务状态。");
    }
  };

  const queueApprovedReview = async (review: SocialContentReviewRecord, provider: string) => {
    if (!reviewProjectId) return;
    if (!availablePlatforms.some((item) => item.name === provider)) {
      setReviewActionNotice("该渠道已移出当前计划或来源运营包范围，未创建发布队列任务。");
      return;
    }
    try {
      const job = await socialPublishJobApi.create({
        project_id: reviewProjectId,
        content_review_id: review.id,
        provider,
        idempotency_key: `social-review-${review.id}-${provider.toLowerCase().replace(/\s+/g, "-")}`,
      });
      setServerPublishJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
      setReviewActionNotice(job.status === "blocked" ? "已进入受控发布队列，但当前被安全阻断；请先完成 OAuth 回调验证和总部发布执行配置。" : "已进入受控发布队列，等待服务端按计划时间执行。");
    } catch {
      setReviewActionNotice("加入发布队列未完成：请确认当前登录账号、计划权限和审核状态。" );
    }
  };

  const saveDraftTask = () => {
    const title = draftTitle.trim();
    if (!title || !availablePlatforms.some((item) => item.name === draftPlatform)) {
      setReviewActionNotice("请选择当前计划允许的渠道后再保存排期任务。");
      return;
    }
    const next = [{
      id: `draft-${Date.now()}`,
      title,
      platform: draftPlatform,
      date: (draftDate || new Date().toISOString().slice(0, 16)).replace("T", " "),
      status: fromContentReview ? "待审核" as const : "草稿" as const,
    }, ...localTasks];
    saveLocalTasks(next);
    setDraftTitle("");
    setFromContentReview(false);
    try {
      window.localStorage.removeItem(socialScheduleIntentStorageKey(siteId));
    } catch {
      // Nothing else is needed when browser storage is unavailable.
    }
    onCloseCreateTask();
  };

  const orderedSchedule = [...localTasks].sort((a, b) => parseDateTime(b.date) - parseDateTime(a.date));
  const hasApprovedReview = serverReviews.some((review) => review.status === "approved_for_authorized_publish");
  const hasScheduledLocalTask = localTasks.length > 0;

  return (
    <div className="space-y-4">
      {createTaskRequested ? <Card data-social-publish-task-form className="bg-blue-50/40">
        <CardHeader>
          <CardTitle className="text-base">新建发布任务</CardTitle>
          <p className="text-sm text-slate-600">先暂存到当前计划的发布中心；外部渠道发布仍需经过内容审核和真实账号授权。</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-blue-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600 md:col-span-2">
            当前计划：{planSettings.marketScope === "dual" ? "国内与海外渠道" : planSettings.marketScope === "china" ? "仅国内渠道" : "仅海外渠道"}；默认时区：{planSettings.timezone === "asia-shanghai" ? "Asia/Shanghai (UTC+8)" : planSettings.timezone === "america-la" ? "America/Los_Angeles (UTC-7)" : "Europe/London (UTC+1)"}。保存的是排期草稿，不会自动外部发布。
          </div>
          <Input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="请输入内容标题" className="md:col-span-2" />
          <Select value={draftPlatform} onValueChange={setDraftPlatform}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{availablePlatforms.map((platform) => <SelectItem key={platform.name} value={platform.name}>{platform.name}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="datetime-local" value={draftDate} onChange={(event) => setDraftDate(event.target.value)} />
          <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
            <Button variant="outline" onClick={onCloseCreateTask}>取消</Button>
            <Button className="bg-blue-600 text-white" disabled={!draftTitle.trim()} onClick={saveDraftTask}>暂存发布任务</Button>
          </div>
        </CardContent>
      </Card> : null}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select defaultValue="week">
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">今日</SelectItem>
              <SelectItem value="week">本周</SelectItem>
              <SelectItem value="month">本月</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部平台</SelectItem>
              {availablePlatforms.map((p) => (
                <SelectItem key={p.name} value={p.name}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-slate-500">新建任务请使用页面标题右侧功能键</div>
      </div>

      {reviewProjectId ? <Card data-social-review-status>
        <CardHeader><CardTitle className="text-base">内容审核状态</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {serverReviews.length ? serverReviews.map((review) => {
            const canResubmit = canResubmitReturnedReview(review);
            return <div key={review.id} data-social-review-id={review.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 p-3 text-sm"><div><b>{review.title}</b><p className="mt-1 text-xs text-slate-500">{review.channels.join("、")}{review.review_note ? ` · 审核说明：${review.review_note}` : ""}</p></div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={review.status === "approved_for_authorized_publish" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : review.status === "returned" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}>{review.status === "pending_agency_review" ? "等待代理初审" : review.status === "pending_headquarters_review" ? "等待总部复核" : review.status === "approved_for_authorized_publish" ? "已批准待授权发布" : "已退回修改"}</Badge>{review.status === "returned" ? <Button size="sm" variant="outline" data-social-review-resubmit-allowed={canResubmit ? "true" : "false"} disabled={!canResubmit} onClick={() => void resubmitReturnedReview(review)}>{canResubmit ? "重新提交" : "范围外不可重提"}</Button> : null}</div></div>;
          }) : <p className="text-sm text-slate-500">暂无已提交到审核服务的内容。未配置计划或未登录时，草稿仅保存在当前浏览器。</p>}
          {reviewActionNotice ? <p className="text-sm text-blue-700" role="status">{reviewActionNotice}</p> : null}
        </CardContent>
      </Card> : null}

      {reviewProjectId ? <Card data-social-controlled-publish-queue className="border-cyan-200 bg-cyan-50/30">
        <CardHeader>
          <CardTitle className="text-base">受控发布队列</CardTitle>
          <p className="text-sm leading-6 text-slate-600">只有已批准内容可加入队列；每个渠道使用固定幂等编号，重复点击不会创建重复的外部发布任务。未完成 OAuth 或总部执行配置时，任务会被安全阻断。</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {serverReviews.filter((review) => review.status === "approved_for_authorized_publish").map((review) => (
            <div key={review.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-cyan-100 bg-white p-3">
              <div><div className="text-sm font-medium">{review.title}</div><div className="mt-1 text-xs text-slate-500">已批准渠道：{review.channels.join("、")}</div></div>
              <div className="flex flex-wrap gap-2">{review.channels.filter((channel) => availablePlatforms.some((item) => item.name === channel)).map((channel) => <Button key={channel} size="sm" variant="outline" onClick={() => void queueApprovedReview(review, channel)}>加入 {channel} 队列</Button>)}</div>
            </div>
          ))}
          {serverReviews.every((review) => review.status !== "approved_for_authorized_publish") ? <p className="text-sm text-slate-500">暂无可加入队列的已批准内容。请先完成代理初审和总部复核。</p> : null}
          {serverPublishJobs.length ? <div className="space-y-2">{serverPublishJobs.map((job) => <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm"><div><b>{job.provider}</b><span className="ml-2 text-xs text-slate-500">队列编号：{job.id}</span><p className="mt-1 text-xs text-slate-500">{job.block_reasons.length ? `阻断原因：${job.block_reasons.join("、")}` : "等待受控执行"}</p></div><Badge variant="outline" className={job.status === "blocked" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-cyan-200 bg-cyan-50 text-cyan-700"}>{job.status === "blocked" ? "安全阻断" : "等待队列"}</Badge></div>)}</div> : <p className="text-sm text-slate-500">当前计划尚未创建服务端发布队列任务。</p>}
        </CardContent>
      </Card> : null}

      <Card data-social-publish-preflight className="border-slate-200">
        <CardHeader><CardTitle className="text-base">发布前检查</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          <div className={`rounded-md border p-3 text-sm ${hasApprovedReview ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}><b>内容审核</b><p className="mt-1 text-xs">{hasApprovedReview ? "至少一条内容已完成总部复核。" : "需完成代理初审和总部复核。"}</p></div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><b>账号 OAuth</b><p className="mt-1 text-xs">尚未验证真实回调令牌；禁止外部发布。</p></div>
          <div className={`rounded-md border p-3 text-sm ${hasScheduledLocalTask ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}><b>排期任务</b><p className="mt-1 text-xs">{hasScheduledLocalTask ? "已有本计划排期草稿。" : "请先保存发布时间和渠道。"}</p></div>
        </CardContent>
      </Card>

      {reviewProjectId ? <ContentCalendarGovernance projectId={reviewProjectId} reviews={serverReviews} /> : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>计划时间</TableHead>
                <TableHead>平台</TableHead>
                <TableHead>内容标题</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderedSchedule.length === 0 ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">当前计划还没有排期任务。请通过页面标题右侧“新建发布任务”创建草稿；未完成审核和 OAuth 授权前不会外部发布。</TableCell></TableRow> : null}
              {orderedSchedule.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {s.date}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{s.platform}</TableCell>
                  <TableCell>{s.title}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        s.status === "待审核"
                          ? "text-amber-700 border-amber-200 bg-amber-50"
                          : "text-slate-600 border-slate-200 bg-slate-50"
                      }
                    >
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {s.status === "待审核" ? <Button size="sm" variant="ghost" onClick={() => updateLocalTaskStatus(s.id, "草稿")}>撤回审核</Button> : null}
                      <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => removeLocalTask(s.id)}>删除</Button>
                    </div>
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
