import { useEffect, useState } from "react";
import { Plus, Zap } from "lucide-react";
import { CommunityGovernance } from "@/components/social/CommunityGovernance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { authApi } from "@/lib/auth";
import { getSiteById } from "@/lib/sites";
import { socialCrmHandoffApi, type SocialCrmHandoffRecord } from "@/lib/social-crm-handoff-api";
import { DEFAULT_SOCIAL_PLAN_SETTINGS, PLATFORMS, getAvailableSocialPlatforms, readSocialLocalArray, readSocialPlanSettings, socialContentDraftStorageKey, socialLeadTaskStorageKey, type SocialPlanSettings } from "./social-tab-shared";

type LocalSocialLeadTask = { id: string; platform: string; contact: string; message: string; status: "pending_manual_followup" | "crm_handoff_ready"; createdAt: string; sourceDraftId?: string; sourceDraftTitle?: string; score?: number; priority?: "high" | "medium" | "low"; dueAt?: string };

export default function SocialAutomationTab({ siteId }: { siteId?: string | null }) {
  const [leadPlatform, setLeadPlatform] = useState(PLATFORMS[0]?.name || "Facebook");
  const [leadContact, setLeadContact] = useState("");
  const [leadMessage, setLeadMessage] = useState("");
  const [leadTasks, setLeadTasks] = useState<LocalSocialLeadTask[]>([]);
  const [contentSources, setContentSources] = useState<Array<{ id: string; title: string }>>([]);
  const [sourceDraftId, setSourceDraftId] = useState("unlinked");
  const [serverHandoffs, setServerHandoffs] = useState<SocialCrmHandoffRecord[]>([]);
  const [leadNotice, setLeadNotice] = useState("");
  const [planSettings, setPlanSettings] = useState<SocialPlanSettings>(DEFAULT_SOCIAL_PLAN_SETTINGS);
  const handoffProjectId = siteId ? getSiteById(siteId)?.planId ?? null : null;
  const availablePlatforms = getAvailableSocialPlatforms(planSettings);

  useEffect(() => {
    const nextSettings = readSocialPlanSettings(siteId);
    const firstPlatform = getAvailableSocialPlatforms(nextSettings)[0];
    setPlanSettings(nextSettings);
    if (firstPlatform) setLeadPlatform(firstPlatform.name);
  }, [siteId]);

  useEffect(() => {
    const drafts = readSocialLocalArray(socialContentDraftStorageKey(siteId));
    setContentSources(drafts
      .filter((draft): draft is { id: string; title: string } => typeof draft?.id === "string" && typeof draft?.title === "string")
      .map((draft) => ({ id: draft.id, title: draft.title })));
    setSourceDraftId("unlinked");
  }, [siteId]);

  useEffect(() => {
    let active = true;
    if (!handoffProjectId || !authApi.getStoredToken()) {
      setServerHandoffs([]);
      return () => { active = false; };
    }
    void socialCrmHandoffApi.list(handoffProjectId)
      .then((response) => { if (active) setServerHandoffs(response.items); })
      .catch(() => { if (active) setServerHandoffs([]); });
    return () => { active = false; };
  }, [handoffProjectId]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(socialLeadTaskStorageKey(siteId));
      const parsed = raw ? JSON.parse(raw) : [];
      setLeadTasks(Array.isArray(parsed) ? parsed.filter((item): item is LocalSocialLeadTask => Boolean(item && typeof item.id === "string" && typeof item.platform === "string" && typeof item.contact === "string" && typeof item.message === "string" && (item.status === "pending_manual_followup" || item.status === "crm_handoff_ready") && (item.sourceDraftId === undefined || typeof item.sourceDraftId === "string") && (item.sourceDraftTitle === undefined || typeof item.sourceDraftTitle === "string") && (item.score === undefined || typeof item.score === "number") && (item.priority === undefined || ["high", "medium", "low"].includes(item.priority)))) : []);
    } catch { setLeadTasks([]); }
  }, [siteId]);

  const saveLeadTasks = (next: LocalSocialLeadTask[]) => {
    setLeadTasks(next);
    try { window.localStorage.setItem(socialLeadTaskStorageKey(siteId), JSON.stringify(next)); } catch { /* current-session fallback */ }
  };

  const createLeadTask = async () => {
    if (!leadContact.trim() || !leadMessage.trim()) { setLeadNotice("请填写联系人或账号标识，以及互动内容。" ); return; }
    if (!availablePlatforms.some((item) => item.name === leadPlatform)) { setLeadNotice("当前渠道不在本计划或来源运营包的允许范围内，线索待办未创建。" ); return; }
    if (/@|\d[\d\s-]{6,}\d/.test(leadContact)) {
      setLeadNotice("请使用账号、主页或 CRM 业务引用；不要在此保存手机号或邮箱。 ");
      return;
    }
    const sourceDraft = contentSources.find((item) => item.id === sourceDraftId);
    const summaryWithAttribution = sourceDraft ? `[来源内容：${sourceDraft.title}] ${leadMessage.trim()}` : leadMessage.trim();
    const normalizedMessage = leadMessage.toLowerCase();
    const score = Math.min(100, 20 + (sourceDraft ? 25 : 0) + (/(报价|价格|price|quote|样品|sample|采购|purchase|合作|order)/.test(normalizedMessage) ? 35 : 0) + (normalizedMessage.length >= 80 ? 10 : 0));
    const priority = score >= 70 ? "high" : score >= 45 ? "medium" : "low";
    const taskCreatedAt = new Date();
    const dueAt = new Date(taskCreatedAt.getTime() + (priority === "high" ? 2 : priority === "medium" ? 8 : 24) * 60 * 60 * 1000).toISOString();
    if (handoffProjectId && authApi.getStoredToken()) {
      try {
        const handoff = await socialCrmHandoffApi.create({
          project_id: handoffProjectId,
          provider: leadPlatform,
          contact_reference: leadContact.trim(),
          lead_summary: summaryWithAttribution,
        });
        setServerHandoffs((current) => [handoff, ...current.filter((item) => item.id !== handoff.id)]);
        setLeadContact(""); setLeadMessage("");
        setLeadNotice(handoff.review_required ? "线索已进入总部人工审核；未批准前不会派发到 CRM。" : "线索已进入受控 CRM 交接队列。");
        return;
      } catch {
        setLeadNotice("CRM 交接未创建：请确认当前计划、登录权限与后端服务可用。未授权时不会自动派发。");
        return;
      }
    }
    const task = { id: `lead-${taskCreatedAt.getTime()}`, platform: leadPlatform, contact: leadContact.trim(), message: leadMessage.trim(), status: (planSettings.crmAutoHandoffEnabled ? "crm_handoff_ready" : "pending_manual_followup") as const, createdAt: taskCreatedAt.toISOString(), score, priority, dueAt, ...(sourceDraft ? { sourceDraftId: sourceDraft.id, sourceDraftTitle: sourceDraft.title } : {}) };
    saveLeadTasks([task, ...leadTasks]);
    setLeadContact(""); setLeadMessage("");
    setLeadNotice("本地线索待办已保存；当前独立计划未绑定后端 CRM，未创建客户或发送消息。");
  };
  const rules: Array<{ name: string; platform: string; trigger: string; action: string; enabled: boolean; triggered: number }> = [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          互动转化规则持续识别高意向互动并创建待办；评论、私信等对外回复必须经过人工审核。
        </div>
        <Button className="bg-blue-600 text-white" onClick={() => setLeadNotice("自动规则需要已授权的平台事件、服务端队列和 CRM 映射；当前版本只支持人工确认后创建线索待办。")}>
          <Plus className="w-4 h-4 mr-1" /> 新建转化规则
        </Button>
      </div>

      <Card data-social-lead-handoff className="border-blue-200 bg-blue-50/40">
        <div className="flex justify-end px-6 pt-4">
          <Badge variant="outline" className={planSettings.crmAutoHandoffEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
            {planSettings.crmAutoHandoffEnabled ? "CRM 自动交接已开启" : "CRM 人工审核中"}
          </Badge>
        </div>
        <CardHeader><CardTitle className="text-base">统一收件与线索交接</CardTitle><p className="text-sm text-slate-600">将人工确认的评论、私信或表单摘要进入当前计划待办；评分只用于排序，不会自动回复、报价或派发。</p></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Select value={leadPlatform} onValueChange={setLeadPlatform}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{availablePlatforms.map((platform) => <SelectItem key={platform.name} value={platform.name}>{platform.name}</SelectItem>)}</SelectContent></Select>
          <Input value={leadContact} onChange={(event) => setLeadContact(event.target.value)} placeholder="账号、主页或 CRM 业务引用（不填手机/邮箱）" />
          <Select value={sourceDraftId} onValueChange={setSourceDraftId}><SelectTrigger><SelectValue placeholder="选择来源内容（可选）" /></SelectTrigger><SelectContent><SelectItem value="unlinked">未关联内容</SelectItem>{contentSources.map((draft) => <SelectItem key={draft.id} value={draft.id}>{draft.title}</SelectItem>)}</SelectContent></Select>
          <p className="self-center text-xs text-slate-500">关联来源内容后，数据归因会显示“内容 → 线索”链路。</p>
          <Textarea className="md:col-span-2" value={leadMessage} onChange={(event) => setLeadMessage(event.target.value)} placeholder="填写评论、私信或表单摘要；请先人工确认授权与意向。" rows={3} />
          <div className="flex flex-wrap items-center justify-between gap-2 md:col-span-2"><span className="text-xs text-slate-500">{handoffProjectId ? "仅由后端创建受控交接记录；人工审核未批准前不能派发。" : "当前独立计划未绑定后端 CRM，仅保存本地待办，不创建客户。"}</span><Button onClick={() => void createLeadTask()}><Plus className="mr-1 h-4 w-4" />创建线索待办</Button></div>
          {leadNotice ? <p className="text-sm text-blue-700 md:col-span-2" role="status">{leadNotice}</p> : null}
          {serverHandoffs.length ? <div className="space-y-2 md:col-span-2">{serverHandoffs.slice(0, 5).map((handoff) => <div key={handoff.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm"><div><b>{handoff.contact_reference}</b><span className="ml-2 text-xs text-slate-500">{handoff.provider}</span><p className="mt-1 text-xs text-slate-600">{handoff.lead_summary}</p></div><Badge variant="outline" className={handoff.status === "approved_for_crm" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : handoff.status === "returned" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}>{handoff.status === "approved_for_crm" ? "已批准待派发" : handoff.status === "returned" ? "已退回补充" : handoff.status === "dispatched" ? "已受控派发" : "待人工审核"}</Badge></div>)}</div> : null}
          {leadTasks.length ? <div className="space-y-2 md:col-span-2">{leadTasks.slice(0, 5).map((task) => <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm"><div><b>{task.contact}</b><span className="ml-2 text-xs text-slate-500">{task.platform}</span><p className="mt-1 text-xs text-slate-600">{task.message}</p><p className="mt-1 text-xs text-slate-500">优先级：{task.priority === "high" ? "高 · 2小时内" : task.priority === "medium" ? "中 · 8小时内" : "普通 · 24小时内"} · 评分：{task.score ?? "待评"}/100</p></div><div className="flex items-center gap-2"><Badge variant="outline" className={task.priority === "high" ? "border-rose-200 bg-rose-50 text-rose-700" : task.priority === "medium" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-600"}>{task.priority === "high" ? "高意向" : task.priority === "medium" ? "需跟进" : "待确认"}</Badge><Badge variant="outline" className={task.status === "crm_handoff_ready" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-amber-200 bg-amber-50 text-amber-700"}>{task.status === "crm_handoff_ready" ? "待受控派发" : "待人工跟进"}</Badge></div></div>)}</div> : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.length === 0 ? <Card className="md:col-span-2 border-dashed"><CardContent className="py-8 text-center text-sm text-slate-500">当前没有自动化规则。待总部完成 OAuth 事件订阅、服务端队列、人工审核和 CRM 映射后，才可创建可执行规则。</CardContent></Card> : null}
        {rules.map((r) => (
          <Card key={r.name}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">{r.name}</div>
                    <div className="text-xs text-slate-500">{r.platform}</div>
                  </div>
                </div>
                <Switch defaultChecked={r.enabled} />
              </div>
              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-12">触发</span>
                  <Badge variant="outline" className="text-slate-700">{r.trigger}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-12">动作</span>
                  <Badge variant="outline" className="text-slate-700">{r.action}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-12">已触发</span>
                  <span className="font-medium text-emerald-600">{r.triggered} 次</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {handoffProjectId ? <CommunityGovernance projectId={handoffProjectId} /> : null}
    </div>
  );
}
