import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FACTORY_PLATFORM_DEVELOPMENT_GATES,
  FACTORY_PLATFORM_EXECUTION_WORKSTREAMS,
} from "@/lib/factory-platform-blueprint-governance";
import {
  listFactoryExecutionWorkstreams,
  updateFactoryExecutionWorkstream,
  type FactoryDevelopmentGate,
  type FactoryExecutionStatus,
  type FactoryExecutionWorkstreamRecord,
} from "@/lib/factory-execution-api";

const STATUS_LABELS: Record<FactoryExecutionStatus, string> = { active: "进行中", queued: "排队中", blocked: "已阻断", done: "已完成" };
const splitList = (value: string) => value.split(/[\n,，、]/u).map((item) => item.trim()).filter(Boolean);

function staticRecords(): FactoryExecutionWorkstreamRecord[] {
  return FACTORY_PLATFORM_EXECUTION_WORKSTREAMS.map((item) => ({
    id: item.id,
    sequence: item.sequence,
    label: item.label,
    status: item.status,
    current_gate: item.currentGate,
    owner_roles: [...item.ownerRoles],
    deliverables: [...item.deliverables],
    blockers: [...item.blockers],
    evidence: [],
    next_action: item.nextAction,
    revision: 0,
  }));
}

export function FactoryExecutionDesk() {
  const [items, setItems] = useState<FactoryExecutionWorkstreamRecord[]>(staticRecords);
  const [mode, setMode] = useState<"loading" | "live" | "static">("loading");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, FactoryExecutionWorkstreamRecord>>({});

  const load = useCallback(async () => {
    setMode("loading");
    setConnectionError(null);
    try {
      const result = await listFactoryExecutionWorkstreams();
      if (!result.items.length) throw new Error("执行台尚未初始化数据库记录");
      setItems(result.items);
      setDrafts(Object.fromEntries(result.items.map((item) => [item.id, { ...item }])));
      setMode("live");
    } catch (error) {
      const fallback = staticRecords();
      setItems(fallback);
      setDrafts(Object.fromEntries(fallback.map((item) => [item.id, { ...item }])));
      setConnectionError(error instanceof Error ? error.message : "执行台控制面暂不可用");
      setMode("static");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const activeCount = useMemo(() => items.filter((item) => item.status === "active").length, [items]);

  const updateDraft = (id: string, changes: Partial<FactoryExecutionWorkstreamRecord>) => {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] || items.find((item) => item.id === id)!), ...changes } }));
  };

  const save = async (id: string) => {
    const draft = drafts[id];
    if (!draft || mode !== "live") return;
    setBusyId(id);
    try {
      const saved = await updateFactoryExecutionWorkstream(id, {
        expected_revision: draft.revision,
        status: draft.status,
        current_gate: draft.current_gate,
        blockers: draft.blockers,
        evidence: draft.evidence,
        next_action: draft.next_action,
      });
      setItems((current) => current.map((item) => item.id === id ? saved : item));
      setDrafts((current) => ({ ...current, [id]: saved }));
      toast.success(`${saved.label}已保存，修订号 ${saved.revision}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "执行台保存失败");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section data-factory-platform-execution-desk data-execution-control-mode={mode}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          开发执行台 · 首批队列
          <Badge variant={mode === "live" ? "default" : "outline"}>{mode === "live" ? "实时控制面" : mode === "loading" ? "连接中" : "静态只读"}</Badge>
          <Badge variant={activeCount === 1 ? "outline" : "destructive"}>进行中 {activeCount}/1</Badge>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={mode === "loading"}><RefreshCw className="mr-1 h-3.5 w-3.5" />刷新</Button>
      </div>
      <p className="mb-3 text-xs opacity-75">控制面使用数据库修订号防止并发覆盖；只有总部管理员可更新，并强制最多一条工作流处于进行中。</p>
      {connectionError ? <p data-execution-control-error className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">当前使用静态安全回退：{connectionError}</p> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const draft = drafts[item.id] || item;
          return (
            <Card key={item.id} data-execution-workstream={item.id} data-execution-status={draft.status} className="border-current/20 bg-transparent shadow-none">
              <CardHeader className="pb-2"><CardTitle className="flex items-center justify-between gap-2 text-sm"><span>{item.sequence}. {item.label}</span><Badge variant={draft.status === "active" ? "default" : "outline"}>{STATUS_LABELS[draft.status]}</Badge></CardTitle></CardHeader>
              <CardContent className="space-y-2 text-xs leading-5">
                <label className="block"><span className="font-semibold">状态</span><select data-execution-field="status" value={draft.status} disabled={mode !== "live"} onChange={(event) => updateDraft(item.id, { status: event.target.value as FactoryExecutionStatus })} className="mt-1 h-8 w-full rounded border border-current/20 bg-transparent px-2"><option value="active">进行中</option><option value="queued">排队中</option><option value="blocked">已阻断</option><option value="done">已完成</option></select></label>
                <label className="block"><span className="font-semibold">当前门禁</span><select data-execution-field="gate" value={draft.current_gate} disabled={mode !== "live"} onChange={(event) => updateDraft(item.id, { current_gate: event.target.value as FactoryDevelopmentGate })} className="mt-1 h-8 w-full rounded border border-current/20 bg-transparent px-2">{FACTORY_PLATFORM_DEVELOPMENT_GATES.map((gate) => <option key={gate.id} value={gate.id}>{gate.sequence}. {gate.label}</option>)}</select></label>
                <p className="opacity-75"><b>负责：</b>{draft.owner_roles.join("、")}</p>
                <p className="opacity-75"><b>产物：</b>{draft.deliverables.join("、")}</p>
                <label className="block"><span className="font-semibold">阻断</span><textarea data-execution-field="blockers" value={draft.blockers.join("、")} disabled={mode !== "live"} onChange={(event) => updateDraft(item.id, { blockers: splitList(event.target.value) })} className="mt-1 min-h-14 w-full rounded border border-current/20 bg-transparent px-2 py-1" /></label>
                <label className="block"><span className="font-semibold">证据</span><textarea data-execution-field="evidence" value={draft.evidence.join("、")} disabled={mode !== "live"} onChange={(event) => updateDraft(item.id, { evidence: splitList(event.target.value) })} className="mt-1 min-h-14 w-full rounded border border-current/20 bg-transparent px-2 py-1" /></label>
                <label className="block"><span className="font-semibold">下一步</span><textarea data-execution-field="next-action" value={draft.next_action} disabled={mode !== "live"} onChange={(event) => updateDraft(item.id, { next_action: event.target.value })} className="mt-1 min-h-16 w-full rounded border border-current/20 bg-transparent px-2 py-1" /></label>
                <div className="flex items-center justify-between gap-2"><span className="opacity-60">修订 {draft.revision || "—"}</span><Button data-execution-save type="button" size="sm" onClick={() => void save(item.id)} disabled={mode !== "live" || busyId === item.id}><Save className="mr-1 h-3.5 w-3.5" />{busyId === item.id ? "保存中" : "保存"}</Button></div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
