import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, BadgeCheck, ClipboardCheck, RefreshCw, ShieldCheck, Target } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FactoryPage } from "@/page-factory/FactoryPage";
import {
  acknowledgeFactoryHealthAlert, completeFactoryHealthTask, createFactoryHealthTask,
  listFactoryHealthWorkspace, refreshFactoryHealthCockpit, startFactoryHealthTask,
  verifyFactoryHealthTask, type FactoryHealthAlert, type FactoryHealthSnapshot,
  type FactoryHealthTask, type FactoryHealthWorkspace,
} from "@/lib/factory-health-cockpit-api";

const dateValue = (offsetDays: number) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
const isoAt = (value: string, hour = "09:00:00") => new Date(`${value}T${hour}`).toISOString();
const GRADE_LABEL = { healthy: "健康", watch: "关注", critical: "紧急" } as const;
const STATUS_LABEL: Record<string, string> = {
  open: "待认领", acknowledged: "已认领", "task-assigned": "任务已分派",
  "pending-verification": "待独立验证", resolved: "已闭环",
  assigned: "待执行", "in-progress": "执行中", completed: "待验证", verified: "已验证",
};

export default function FactoryHealthCockpit() {
  const [projectText, setProjectText] = useState("1");
  const [mode, setMode] = useState<"loading" | "live" | "error">("loading");
  const [workspace, setWorkspace] = useState<FactoryHealthWorkspace>({ snapshots: [], alerts: [], tasks: [], evidence: [], methodology: { version: "v1", policy: "read-only-authority-snapshot", metric_codes: [] } });
  const [periodStart, setPeriodStart] = useState(() => dateValue(-30));
  const [periodEnd, setPeriodEnd] = useState(() => dateValue(0));
  const [owner, setOwner] = useState("operating-owner-001");
  const [dueDate, setDueDate] = useState(() => dateValue(3));
  const [actionPlan, setActionPlan] = useState("核验权威来源，修复异常业务环节，并提交可复核的经营证据。");
  const [evidencePrefix, setEvidencePrefix] = useState("HEALTH-EVIDENCE-001");
  const projectId = Number(projectText);

  const load = async (silent = false) => {
    if (!Number.isInteger(projectId) || projectId <= 0) return;
    if (!silent) setMode("loading");
    try { setWorkspace(await listFactoryHealthWorkspace(projectId)); setMode("live"); }
    catch (error) { setMode("error"); toast.error(error instanceof Error ? error.message : "经营健康驾舱加载失败"); }
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const latest = workspace.snapshots[0];
  const taskByAlert = useMemo(() => new Map(workspace.tasks.map((task) => [task.alert_id, task])), [workspace.tasks]);
  const refresh = async () => {
    try {
      await refreshFactoryHealthCockpit(projectId, {
        snapshot_reference: `HEALTH-${projectId}-${Date.now()}`,
        period_start: isoAt(periodStart, "00:00:00"), period_end: isoAt(periodEnd, "23:59:59"),
      });
      toast.success("经营健康快照已从权威业务系统生成"); await load(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : "经营快照生成失败"); }
  };
  const execute = async (task: () => Promise<unknown>, success: string) => {
    try { await task(); toast.success(success); await load(true); }
    catch (error) { toast.error(error instanceof Error ? error.message : "经营责任闭环操作失败"); await load(true); }
  };
  const acknowledge = (alert: FactoryHealthAlert) => execute(() => acknowledgeFactoryHealthAlert(projectId, alert.id, {
    expected_revision: alert.revision, owner, due_at: isoAt(dueDate),
    acknowledgement_reference: `${evidencePrefix}-${alert.metric_code}-ACK`,
  }), "经营异常已由责任人认领");
  const assign = (alert: FactoryHealthAlert) => execute(() => createFactoryHealthTask(projectId, alert.id, {
    expected_alert_revision: alert.revision, owner, action_plan: actionPlan, due_at: isoAt(dueDate),
    assignment_reference: `${evidencePrefix}-${alert.metric_code}-ASSIGN`,
  }), "责任任务已分派并进入执行队列");
  const start = (task: FactoryHealthTask) => execute(() => startFactoryHealthTask(projectId, task.id, {
    expected_revision: task.revision, start_reference: `${evidencePrefix}-${task.task_number}-START`,
  }), "责任任务已开始执行");
  const complete = (task: FactoryHealthTask) => execute(() => completeFactoryHealthTask(projectId, task.id, {
    expected_revision: task.revision,
    completion_note: "已核验业务事实、完成责任动作，并将结果回写到对应权威业务系统。",
    completion_evidence_reference: `${evidencePrefix}-${task.task_number}-COMPLETE`,
  }), "责任任务已完成，等待独立验证");
  const verify = (task: FactoryHealthTask) => execute(() => verifyFactoryHealthTask(projectId, task.id, {
    expected_revision: task.revision, verification_reference: `${evidencePrefix}-${task.task_number}-VERIFY`,
    verification_note: "已独立复核权威来源和完成证据，确认异常责任闭环有效。",
  }), "独立验证通过，经营异常已闭环");

  return <FactoryPage pageId="client-health-cockpit" template="dashboard" sourceScope="client_source" autoRegions><main className="p-4 md:p-6" data-factory-health-cockpit-page data-health-cockpit-mode={mode}>
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-xl font-bold"><Activity className="h-5 w-5" />经营健康驾舱</h1><p className="mt-1 text-sm opacity-70">只读汇总权威业务事实；异常下钻后必须形成责任任务和独立验证，不在驾舱里篡改订单、资产、质量或财务记录。</p></div>
        <div className="flex flex-wrap gap-2"><Input aria-label="健康驾舱项目ID" className="w-24" value={projectText} onChange={(event) => setProjectText(event.target.value)} /><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />载入驾舱</Button></div>
      </div>

      <Card><CardHeader><CardTitle className="text-base">生成经营健康快照</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <Input aria-label="统计开始日期" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
        <Input aria-label="统计结束日期" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
        <Input aria-label="异常责任人" value={owner} onChange={(event) => setOwner(event.target.value)} />
        <Input aria-label="责任截止日期" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        <Input aria-label="责任行动方案" className="md:col-span-2" value={actionPlan} onChange={(event) => setActionPlan(event.target.value)} />
        <Input aria-label="经营证据前缀" value={evidencePrefix} onChange={(event) => setEvidencePrefix(event.target.value)} />
        <Button data-health-refresh onClick={() => void refresh()}><RefreshCw className="mr-1 h-4 w-4" />刷新权威指标</Button>
      </CardContent></Card>

      {latest ? <SnapshotPanel snapshot={latest} /> : <Card><CardContent className="py-8 text-center text-sm opacity-70">尚无经营快照。点击“刷新权威指标”生成第一份可审计基线。</CardContent></Card>}

      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4" />异常与责任闭环</CardTitle></CardHeader><CardContent className="space-y-3">
        {workspace.alerts.length === 0 ? <p className="text-sm opacity-70">当前没有经营异常。</p> : workspace.alerts.map((alert) => {
          const task = taskByAlert.get(alert.id);
          return <div key={alert.id} className="rounded-lg border p-3" data-health-alert={alert.id} data-health-alert-status={alert.status}>
            <div className="flex flex-wrap items-start justify-between gap-2"><div><b>{alert.metric_label}</b><p className="text-xs opacity-70">{alert.alert_number} · {alert.source_object_type}</p></div><div className="flex gap-2"><Badge variant={alert.severity === "critical" ? "destructive" : "secondary"}>{alert.severity}</Badge><Badge>{STATUS_LABEL[alert.status]}</Badge></div></div>
            <p className="mt-2 text-sm">实际 {alert.actual_value ?? "无数据"}{alert.unit} · 阈值 {alert.threshold_value}{alert.unit}{alert.owner ? ` · 责任人 ${alert.owner}` : ""}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {alert.status === "open" ? <Button size="sm" data-health-alert-action="open" onClick={() => void acknowledge(alert)}><Target className="mr-1 h-4 w-4" />认领异常</Button> : null}
              {alert.status === "acknowledged" ? <Button size="sm" data-health-alert-action="acknowledged" onClick={() => void assign(alert)}><ClipboardCheck className="mr-1 h-4 w-4" />分派责任任务</Button> : null}
              {task?.status === "assigned" ? <Button size="sm" data-health-task-action="assigned" onClick={() => void start(task)}>开始执行</Button> : null}
              {task?.status === "in-progress" ? <Button size="sm" data-health-task-action="in-progress" onClick={() => void complete(task)}>提交完成证据</Button> : null}
              {task?.status === "completed" ? <Button size="sm" data-health-task-action="completed" onClick={() => void verify(task)}><ShieldCheck className="mr-1 h-4 w-4" />独立验证</Button> : null}
            </div>
            {task ? <div className="mt-3 rounded-md bg-muted/50 p-2 text-xs" data-health-task={task.id} data-health-task-status={task.status}><b>{task.task_number} · {STATUS_LABEL[task.status]}</b><p>{task.action_plan}</p>{task.status === "verified" ? <p data-health-task-verified className="mt-1 font-semibold text-emerald-600"><BadgeCheck className="mr-1 inline h-3.5 w-3.5" />责任闭环已独立验证</p> : null}</div> : null}
          </div>;
        })}
      </CardContent></Card>
    </div>
  </main></FactoryPage>;
}

function SnapshotPanel({ snapshot }: { snapshot: FactoryHealthSnapshot }) {
  return <Card data-health-snapshot={snapshot.id} data-health-grade={snapshot.health_grade}><CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base"><span>{snapshot.snapshot_number}</span><span className="flex items-center gap-2"><Badge>{GRADE_LABEL[snapshot.health_grade]}</Badge><strong data-health-snapshot-score className="text-2xl">{snapshot.overall_score}</strong></span></CardTitle></CardHeader><CardContent className="space-y-3">
    <p className="text-xs opacity-70">口径 {snapshot.methodology_version} · {snapshot.available_metric_count}/{snapshot.metric_count} 项可用 · {snapshot.alert_count} 项异常 · 生成于 {new Date(snapshot.generated_at).toLocaleString()}</p>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{snapshot.dimensions.map((metric) => <div key={metric.code} className="rounded-lg border p-3" data-health-metric={metric.code} data-health-metric-status={metric.status}><div className="flex items-center justify-between gap-2"><b className="text-sm">{metric.label}</b><Badge variant={metric.status === "healthy" ? "default" : "secondary"}>{metric.status === "unavailable" ? "无数据" : `${metric.actual}${metric.unit}`}</Badge></div><p className="mt-2 text-xs opacity-70">目标 {metric.target}{metric.unit} · {metric.numerator}/{metric.denominator}</p><p className="mt-1 break-all text-[11px] opacity-60">{metric.source}</p></div>)}</div>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{snapshot.source_watermarks.map((source) => <div key={source.source} className="rounded-md bg-muted/40 p-2 text-xs"><b>{source.source}</b><p>{source.recordCount} 条 · {source.watermark ? new Date(source.watermark).toLocaleString() : "暂无水位"}</p></div>)}</div>
  </CardContent></Card>;
}
