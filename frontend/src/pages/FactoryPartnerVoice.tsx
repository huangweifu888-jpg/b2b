import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, BookOpenCheck, Handshake, HeartHandshake, Megaphone, MessageSquareText, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FactoryPage } from "@/page-factory/FactoryPage";
import {
  activatePartnerAccount, authorizeVoiceAdvocacy, certifyPartnerAcademy, closeVoiceCase,
  completePartnerAcademy, confirmVoiceCase, createPartnerAccount, createVoiceCase,
  enrollPartnerAcademy, inviteVoiceAdvocacy, listPartnerVoiceWorkspace,
  publishVoiceAdvocacy, resolveVoiceCase, startVoiceAction, triageVoiceCase,
  type FactoryPartnerAcademyEnrollment, type FactoryPartnerAccount,
  type FactoryVoiceCase, type PartnerVoiceWorkspace,
} from "@/lib/factory-partner-voice-api";

const PARTNER_STATUS: Record<string, string> = { draft: "待审批", active: "已开通", suspended: "已暂停" };
const ACADEMY_STATUS: Record<string, string> = { enrolled: "学习中", completed: "已通过", certified: "已认证" };
const VOICE_STATUS: Record<string, string> = {
  received: "已接收", triaged: "已分诊", "action-in-progress": "整改中",
  resolved: "已解决", "customer-confirmed": "客户已确认", closed: "已闭环",
};
const ADVOCACY_STATUS: Record<string, string> = {
  "not-eligible": "不符合倡导条件", eligible: "可邀请", invited: "已邀请",
  authorized: "已授权", published: "已发布",
};
const EMPTY_WORKSPACE: PartnerVoiceWorkspace = {
  partners: [], enrollments: [], voices: [], eligible_accounts: [],
  metrics: { nps_responses: 0, promoters: 0, detractors: 0, nps: null },
};
const futureIso = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
const uniqueReference = (prefix: string) => `${prefix}-${Date.now().toString().slice(-10)}`;

export default function FactoryPartnerVoice() {
  const [projectText, setProjectText] = useState("1");
  const [mode, setMode] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [workspace, setWorkspace] = useState<PartnerVoiceWorkspace>(EMPTY_WORKSPACE);
  const [busy, setBusy] = useState("");
  const [partnerReference, setPartnerReference] = useState(() => uniqueReference("PARTNER"));
  const [partnerName, setPartnerName] = useState("华东工业设备经销服务有限公司");
  const [contactReference, setContactReference] = useState("CRM-CONTACT-PARTNER-001");
  const [evidencePrefix, setEvidencePrefix] = useState("PARTNER-VOC-EVIDENCE-001");
  const [voiceReference, setVoiceReference] = useState(() => uniqueReference("NPS"));
  const projectId = Number(projectText);

  const load = async () => {
    if (!Number.isInteger(projectId) || projectId <= 0) return toast.error("请输入有效的项目 ID");
    setMode("loading");
    try {
      setWorkspace(await listPartnerVoiceWorkspace(projectId));
      setMode("live");
    } catch (error) {
      setMode("error");
      toast.error(error instanceof Error ? error.message : "客户之声工作台加载失败");
    }
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const execute = async (key: string, task: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await task();
      toast.success(success);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "业务操作失败");
      await load();
    } finally {
      setBusy("");
    }
  };

  const eligibleAccount = workspace.eligible_accounts[0];
  const activePartner = workspace.partners.find((item) => item.status === "active");
  const activeEnrollment = useMemo(
    () => activePartner ? workspace.enrollments.find((item) => item.partner_id === activePartner.id) : undefined,
    [activePartner, workspace.enrollments],
  );

  const createPartner = () => {
    if (!eligibleAccount) return toast.error("需要先由 OMS 或客户资产中心形成可验证客户账户");
    void execute("partner-create", () => createPartnerAccount(projectId, {
      external_reference: partnerReference, legal_name: partnerName, partner_type: "distributor",
      country_code: "CN", territory: "华东", product_scope: ["PUMP-002", "SERVICE"],
      primary_contact_reference: contactReference,
      relationship_evidence_reference: `${evidencePrefix}-DUE-DILIGENCE`,
      account_reference: eligibleAccount.account_reference,
    }), "伙伴档案已建立，等待独立审批开通");
  };
  const activatePartner = (partner: FactoryPartnerAccount) => void execute(`partner-${partner.id}`, () => activatePartnerAccount(projectId, partner.id, {
    expected_revision: partner.revision, agreement_reference: `${evidencePrefix}-AGREEMENT`,
    approval_note: "已复核伙伴主体、合同、服务区域、产品范围和客户关系证据，同意开通。",
  }), "伙伴已审批开通");
  const enrollAcademy = (partner: FactoryPartnerAccount) => void execute(`academy-${partner.id}`, () => enrollPartnerAcademy(projectId, {
    partner_id: partner.id, enrollment_reference: uniqueReference("ACADEMY"),
    learner_reference: partner.primary_contact_reference, course_code: "PUMP-SERVICE",
    course_title: "工业泵产品与售后服务认证", course_version: "2026.1",
    passing_score: 80, planned_completion_at: futureIso(30),
  }), "伙伴学院课程已分配");
  const advanceAcademy = (enrollment: FactoryPartnerAcademyEnrollment) => {
    if (enrollment.status === "enrolled") return void execute(`academy-${enrollment.id}`, () => completePartnerAcademy(projectId, enrollment.id, {
      expected_revision: enrollment.revision, assessment_score: 92,
      completion_evidence_reference: `${evidencePrefix}-ASSESSMENT`,
    }), "课程考核已通过");
    if (enrollment.status === "completed") return void execute(`academy-${enrollment.id}`, () => certifyPartnerAcademy(projectId, enrollment.id, {
      expected_revision: enrollment.revision, certification_reference: `${evidencePrefix}-CERTIFICATE`,
      certification_expires_at: futureIso(365),
    }), "伙伴学院认证已签发");
  };

  const createVoice = () => {
    if (!activePartner || !eligibleAccount) return toast.error("需要已开通伙伴和权威客户订单/资产");
    void execute("voice-create", () => createVoiceCase(projectId, {
      feedback_reference: voiceReference, source_type: "nps", score: 10,
      account_reference: eligibleAccount.account_reference, category: "customer-value", severity: "low",
      summary: "客户确认产品运行稳定、服务响应及时，并愿意在明确授权范围内分享真实使用价值。",
      partner_id: activePartner.id, related_order_id: eligibleAccount.latest_order_id,
      related_asset_id: eligibleAccount.asset_id,
    }), "NPS 客户反馈已登记");
  };
  const advanceVoice = (voice: FactoryVoiceCase) => {
    const ref = `${evidencePrefix}-${voice.voice_number}`;
    if (voice.lifecycle_status === "received") return void execute(`voice-${voice.id}`, () => triageVoiceCase(projectId, voice.id, {
      expected_revision: voice.revision, triage_reference: `${ref}-TRIAGE`,
      owner: "customer-success-001", due_at: futureIso(5),
    }), "客户反馈已分诊并确定责任人");
    if (voice.lifecycle_status === "triaged") return void execute(`voice-${voice.id}`, () => startVoiceAction(projectId, voice.id, {
      expected_revision: voice.revision,
      root_cause: "客户对设备稳定性和服务响应形成正向评价，需要核验事实并沉淀可复用价值证据。",
      action_plan: "核验订单、资产和服务事实，回访客户确认表达，并检查公开倡导的授权边界。",
      action_reference: `${ref}-ACTION`,
    }), "客户反馈改进行动已启动");
    if (voice.lifecycle_status === "action-in-progress") return void execute(`voice-${voice.id}`, () => resolveVoiceCase(projectId, voice.id, {
      expected_revision: voice.revision, resolution_reference: `${ref}-RESOLUTION`,
      resolution_note: "已核验客户订单、装机资产和服务事实，反馈内容与权威业务记录一致。",
    }), "反馈事实与处理结果已复核");
    if (voice.lifecycle_status === "resolved") return void execute(`voice-${voice.id}`, () => confirmVoiceCase(projectId, voice.id, {
      expected_revision: voice.revision, customer_confirmation_reference: `${ref}-CUSTOMER-CONFIRMATION`,
    }), "客户已确认处理结果");
    if (voice.lifecycle_status === "customer-confirmed") return void execute(`voice-${voice.id}`, () => closeVoiceCase(projectId, voice.id, {
      expected_revision: voice.revision, closure_reference: `${ref}-CLOSURE`,
    }), "客户反馈已完成闭环");
  };
  const advanceAdvocacy = (voice: FactoryVoiceCase) => {
    const ref = `${evidencePrefix}-${voice.voice_number}`;
    if (voice.advocacy_status === "eligible") return void execute(`advocacy-${voice.id}`, () => inviteVoiceAdvocacy(projectId, voice.id, {
      expected_revision: voice.revision, invitation_reference: `${ref}-INVITATION`,
    }), "已向客户发出真实案例邀请");
    if (voice.advocacy_status === "invited") return void execute(`advocacy-${voice.id}`, () => authorizeVoiceAdvocacy(projectId, voice.id, {
      expected_revision: voice.revision, consent_reference: `${ref}-CONSENT`,
      consent_scope: "仅授权在公司官网客户案例栏目发布本次已确认的设备运行与服务价值，不授权联系人信息或其他用途。",
      consent_expires_at: futureIso(365),
    }), "客户案例授权范围和期限已登记");
    if (voice.advocacy_status === "authorized") return void execute(`advocacy-${voice.id}`, () => publishVoiceAdvocacy(projectId, voice.id, {
      expected_revision: voice.revision, case_study_reference: `${ref}-CASE-STUDY`,
      publication_channel: "official-website",
    }), "客户案例已按授权渠道发布");
  };

  return <FactoryPage pageId="client-partner-voice" template="dashboard" sourceScope="client_source" autoRegions><main className="p-4 md:p-6" data-factory-partner-voice-page data-partner-voice-mode={mode}>
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-xl font-bold"><HeartHandshake className="h-5 w-5" />客户之声 · 伙伴与价值闭环</h1><p className="mt-1 text-sm opacity-70">伙伴准入有合同证据，客户反馈有订单/资产事实，公开案例必须经过客户确认、授权范围与有效期校验。</p></div>
        <div className="flex gap-2"><Input aria-label="客户之声项目ID" className="w-24" value={projectText} onChange={(event) => setProjectText(event.target.value)} /><Button variant="outline" onClick={() => void load()} disabled={mode === "loading"}><RefreshCw className="mr-1 h-4 w-4" />载入工作台</Button></div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs opacity-70">活跃伙伴</p><p className="mt-1 text-2xl font-bold">{workspace.partners.filter((item) => item.status === "active").length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs opacity-70">学院认证</p><p className="mt-1 text-2xl font-bold">{workspace.enrollments.filter((item) => item.status === "certified").length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs opacity-70">反馈闭环</p><p className="mt-1 text-2xl font-bold">{workspace.voices.filter((item) => item.lifecycle_status === "closed").length}/{workspace.voices.length}</p></CardContent></Card>
        <Card data-nps-score={workspace.metrics.nps ?? "pending"}><CardContent className="p-4"><p className="text-xs opacity-70">真实 NPS</p><p className="mt-1 text-2xl font-bold">{workspace.metrics.nps ?? "—"}</p><p className="text-xs opacity-60">{workspace.metrics.nps_responses} 份有效评分</p></CardContent></Card>
      </section>

      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Handshake className="h-4 w-4" />伙伴准入</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <Input aria-label="伙伴外部编号" value={partnerReference} onChange={(event) => setPartnerReference(event.target.value)} />
        <Input aria-label="伙伴企业名称" value={partnerName} onChange={(event) => setPartnerName(event.target.value)} />
        <Input aria-label="伙伴联系人引用" value={contactReference} onChange={(event) => setContactReference(event.target.value)} />
        <Input aria-label="客户之声证据前缀" value={evidencePrefix} onChange={(event) => setEvidencePrefix(event.target.value)} />
        <Button data-partner-create disabled={!eligibleAccount || busy !== ""} onClick={createPartner}><ShieldCheck className="mr-1 h-4 w-4" />建立伙伴档案</Button>
        <p className="text-xs opacity-70 md:col-span-2 xl:col-span-5">权威客户账户：{eligibleAccount ? `${eligibleAccount.account_reference} · ${eligibleAccount.latest_order_number || "无订单号"} · ${eligibleAccount.asset_number || "无资产号"}` : "暂无，请先完成订单或客户资产登记"}</p>
      </CardContent></Card>

      <section className="grid gap-3 lg:grid-cols-2">
        {workspace.partners.map((partner) => {
          const enrollment = workspace.enrollments.find((item) => item.partner_id === partner.id);
          return <Card key={partner.id} data-partner-account={partner.id} data-partner-status={partner.status}><CardHeader className="pb-2"><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{partner.partner_number} · {partner.legal_name}</span><Badge>{PARTNER_STATUS[partner.status]}</Badge></CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
            <p>{partner.partner_type} · {partner.country_code}/{partner.territory} · {partner.product_scope.join("、")}</p><p className="text-xs opacity-70">客户 {partner.account_reference || "—"} · 联系人 {partner.primary_contact_reference}</p>
            <div className="flex flex-wrap gap-2">
              {partner.status === "draft" ? <Button data-partner-activate size="sm" disabled={busy !== ""} onClick={() => activatePartner(partner)}><BadgeCheck className="mr-1 h-4 w-4" />审批开通</Button> : null}
              {partner.status === "active" && !enrollment ? <Button data-academy-enroll size="sm" disabled={busy !== ""} onClick={() => enrollAcademy(partner)}><BookOpenCheck className="mr-1 h-4 w-4" />分配学院课程</Button> : null}
              {enrollment && enrollment.status !== "certified" ? <Button data-academy-action={enrollment.status} size="sm" disabled={busy !== ""} onClick={() => advanceAcademy(enrollment)}><BookOpenCheck className="mr-1 h-4 w-4" />{enrollment.status === "enrolled" ? "登记考核通过" : "签发认证"}</Button> : null}
              {enrollment ? <Badge variant="outline" data-academy-status={enrollment.status}>{ACADEMY_STATUS[enrollment.status]} · {enrollment.course_title}</Badge> : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">{partner.evidence.map((evidence) => <div key={evidence.id} className="rounded-md border p-2 text-xs"><b>{evidence.evidence_type}</b><p className="break-all">{evidence.evidence_reference}</p></div>)}</div>
          </CardContent></Card>;
        })}
      </section>

      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageSquareText className="h-4 w-4" />登记真实客户反馈</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
        <Input aria-label="客户反馈编号" value={voiceReference} onChange={(event) => setVoiceReference(event.target.value)} />
        <div className="rounded-md border px-3 py-2 text-sm">NPS 10 · 推荐者 · {activePartner?.legal_name || "等待开通伙伴"}</div>
        <Button data-voice-create disabled={!activePartner || !eligibleAccount || busy !== ""} onClick={createVoice}><MessageSquareText className="mr-1 h-4 w-4" />登记 NPS 反馈</Button>
      </CardContent></Card>

      <section className="space-y-3">
        {workspace.voices.map((voice) => <Card key={voice.id} data-voice-case={voice.id} data-voice-status={voice.lifecycle_status} data-advocacy-status={voice.advocacy_status}><CardHeader className="pb-2"><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{voice.voice_number} · {voice.source_type.toUpperCase()} {voice.score ?? "—"} · {voice.account_reference}</span><span className="flex flex-wrap gap-2"><Badge>{VOICE_STATUS[voice.lifecycle_status]}</Badge><Badge variant="outline">{ADVOCACY_STATUS[voice.advocacy_status]}</Badge></span></CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
          <p>{voice.summary}</p><p className="text-xs opacity-70">订单 {voice.related_order_number || "—"} · 资产 {voice.related_asset_number || "—"} · 情绪 {voice.sentiment} · 严重度 {voice.severity}</p>
          <div className="flex flex-wrap gap-2">
            {voice.lifecycle_status !== "closed" ? <Button data-voice-action={voice.lifecycle_status} size="sm" disabled={busy !== ""} onClick={() => advanceVoice(voice)}><ShieldCheck className="mr-1 h-4 w-4" />{voice.lifecycle_status === "received" ? "分诊" : voice.lifecycle_status === "triaged" ? "启动行动" : voice.lifecycle_status === "action-in-progress" ? "登记解决" : voice.lifecycle_status === "resolved" ? "客户确认" : "关闭反馈"}</Button> : null}
            {voice.lifecycle_status === "customer-confirmed" ? <Badge data-voice-customer-confirmed variant="secondary">客户确认凭证已登记</Badge> : null}
            {["eligible", "invited", "authorized"].includes(voice.advocacy_status) ? <Button data-advocacy-action={voice.advocacy_status} size="sm" disabled={busy !== ""} onClick={() => advanceAdvocacy(voice)}><Megaphone className="mr-1 h-4 w-4" />{voice.advocacy_status === "eligible" ? "邀请客户案例" : voice.advocacy_status === "invited" ? "登记授权" : "按授权发布"}</Button> : null}
            {voice.advocacy_status === "published" ? <Badge data-advocacy-published className="bg-emerald-600"><Megaphone className="mr-1 h-3 w-3" />客户案例已授权发布</Badge> : null}
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">{voice.evidence.map((evidence) => <div key={evidence.id} className="rounded-md border p-2 text-xs"><b>{evidence.evidence_type}</b><p className="break-all">{evidence.evidence_reference}</p><small className="opacity-70">{evidence.note}</small></div>)}</div>
        </CardContent></Card>)}
      </section>
      {activeEnrollment?.status === "certified" ? <p className="flex items-center gap-2 text-sm font-medium text-emerald-600"><BadgeCheck className="h-4 w-4" />伙伴学院认证有效，可持续提供经过培训的渠道与服务能力。</p> : null}
    </div>
  </main></FactoryPage>;
}
