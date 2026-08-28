import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { releaseRolloutsApi, type ReleaseRollout } from "@/lib/release-rollouts";
import { FactoryPage } from "@/page-factory/FactoryPage";

const initialForm = { version: "", releaseRole: "client" as const, deploymentId: "", manifestSha256: "", changeSummary: "" };

export default function ReleaseRollouts() {
  const [items, setItems] = useState<ReleaseRollout[]>([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => { setError(""); try { setItems(await releaseRolloutsApi.list()); } catch (cause) { setError(cause instanceof Error ? cause.message : "无法读取发布记录"); } };
  useEffect(() => { void load(); }, []);
  const create = async () => { setBusy(true); setError(""); try { await releaseRolloutsApi.create(form); setForm(initialForm); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "创建发布失败"); } finally { setBusy(false); } };
  const act = async (rollout: ReleaseRollout, stageKey: string, action: "start" | "approve" | "fail") => {
    const needsEvidence = action === "approve" || action === "fail";
    const note = needsEvidence ? window.prompt(action === "approve" ? "填写本阶段验收证据（测试编号、监控或截图说明）：" : "填写失败证据和暂停原因：") : undefined;
    if (needsEvidence && !note?.trim()) return;
    setBusy(true); try { await releaseRolloutsApi.action(rollout.id, stageKey, action, note); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "更新阶段失败"); } finally { setBusy(false); }
  };
  const rollback = async (rollout: ReleaseRollout) => { const reason = window.prompt("填写回退原因（只记录意图，不会自动操作服务器）："); if (!reason) return; setBusy(true); try { await releaseRolloutsApi.rollback(rollout.id, reason); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "回退记录失败"); } finally { setBusy(false); } };

  return <FactoryPage pageId="hq-release-rollouts" template="dashboard" sourceScope="hq" autoRegions><main className="space-y-5 p-4 sm:p-6"><div><h1 className="text-2xl font-bold text-slate-900">灰度发布控制台</h1><p className="mt-1 text-sm text-slate-600">记录发布阶段与审批，不会自动部署服务器或迁移数据库。</p></div>{error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
    <Card><CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5"><input className="h-10 rounded border px-3" placeholder="版本，如 1.2.0" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })}/><select className="h-10 rounded border px-3" value={form.releaseRole} onChange={(e) => setForm({ ...form, releaseRole: e.target.value as "hq" | "agency" | "client" })}><option value="client">客户</option><option value="agency">代理</option><option value="hq">总部</option></select><input className="h-10 rounded border px-3" placeholder="部署单元" value={form.deploymentId} onChange={(e) => setForm({ ...form, deploymentId: e.target.value })}/><input className="h-10 rounded border px-3" placeholder="发布清单 SHA-256" value={form.manifestSha256} onChange={(e) => setForm({ ...form, manifestSha256: e.target.value })}/><Button disabled={busy} onClick={() => void create()}>创建灰度发布</Button><textarea className="min-h-20 rounded border p-3 md:col-span-2 xl:col-span-5" placeholder="变更摘要 / 差异说明" value={form.changeSummary} onChange={(e) => setForm({ ...form, changeSummary: e.target.value })}/></CardContent></Card>
    {items.map((rollout) => <Card key={rollout.id}><CardContent className="space-y-4 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-semibold">{rollout.version} · {rollout.deployment_id}</div><div className="mt-1 text-sm text-slate-500">{rollout.change_summary || "无变更摘要"}</div></div><div className="flex items-center gap-2"><Badge>{rollout.status}</Badge><Button variant="destructive" size="sm" disabled={busy || rollout.status === "rolled_back"} onClick={() => void rollback(rollout)}>记录回退</Button></div></div><div className="grid gap-3 md:grid-cols-4">{rollout.stages.map((stage) => <div key={stage.stage_key} className="rounded-lg border p-3"><div className="font-medium">{stage.sequence}. {stage.stage_label}</div><div className="my-2 text-xs text-slate-500">状态：{stage.status}</div><div className="flex gap-2">{stage.status === "ready" ? <Button size="sm" disabled={busy} onClick={() => void act(rollout, stage.stage_key, "start")}>开始</Button> : null}{stage.status === "running" ? <><Button size="sm" disabled={busy} onClick={() => void act(rollout, stage.stage_key, "approve")}>批准</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void act(rollout, stage.stage_key, "fail")}>失败</Button></> : null}</div></div>)}</div>{rollout.rollback_reason ? <div className="text-sm text-amber-700">回退原因：{rollout.rollback_reason}</div> : null}</CardContent></Card>)}</main></FactoryPage>;
}
