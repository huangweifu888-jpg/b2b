import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listAuditLogs, type AuditLogItem } from "@/lib/audit-logs";
import { FactoryPage } from "@/page-factory/FactoryPage";

function displayTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}

export default function AuditReleaseLogs() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await listAuditLogs(undefined, 200)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => {
      const date = item.created_at ? new Date(item.created_at) : null;
      if (fromDate && date && date < new Date(`${fromDate}T00:00:00`)) return false;
      if (toDate && date && date > new Date(`${toDate}T23:59:59`)) return false;
      return !needle || JSON.stringify({ action: item.action, target: item.target_id, actor: item.actor_ref, detail: item.detail }).toLowerCase().includes(needle);
    });
  }, [fromDate, items, query, toDate]);
  const exportLogs = () => {
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [["时间", "操作人", "动作", "对象类型", "对象", "详情"], ...filtered.map((item) => [displayTime(item.created_at), item.actor_ref || "系统", item.action, item.target_type || "", item.target_id || "", item.detail ? JSON.stringify(item.detail) : ""])];
    const body = `\ufeff${rows.map((row) => row.map(escape).join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `audit-logs-${Date.now()}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  return <FactoryPage pageId="hq-audit-release-logs" template="list" sourceScope="hq" autoRegions><section className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-bold text-slate-900">审计日志</h1><p className="mt-1 text-sm text-slate-500">查询版本、代理、客户计划、操作人和审核/同步/回退结果。</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />刷新</Button><Button variant="outline" onClick={exportLogs} disabled={!filtered.length}><Download className="mr-2 h-4 w-4" />导出 CSV</Button></div></div><div className="rounded-2xl border bg-white shadow-sm"><div className="flex flex-wrap items-center gap-2 border-b p-4"><Search className="h-4 w-4 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="版本号、代理、客户计划、操作人或动作" className="min-w-[260px] flex-1 border-0 shadow-none focus-visible:ring-0" /><input className="h-9 rounded-md border px-2 text-sm" type="date" aria-label="开始日期" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /><span className="text-slate-400">至</span><input className="h-9 rounded-md border px-2 text-sm" type="date" aria-label="结束日期" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-3">时间</th><th className="px-4 py-3">操作人</th><th className="px-4 py-3">动作</th><th className="px-4 py-3">对象</th><th className="px-4 py-3">版本/详情</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id} className="border-t"><td className="px-4 py-3 text-xs text-slate-500">{displayTime(item.created_at)}</td><td className="px-4 py-3">{item.actor_ref || "系统"}</td><td className="px-4 py-3"><Badge variant="secondary">{item.action}</Badge></td><td className="px-4 py-3">{item.target_type || "-"}<div className="font-mono text-xs text-slate-500">{item.target_id || "-"}</div></td><td className="px-4 py-3 text-xs text-slate-600">{item.detail ? JSON.stringify(item.detail) : "-"}</td></tr>)}{!loading && !filtered.length ? <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">没有匹配的审计记录</td></tr> : null}</tbody></table></div></div></section></FactoryPage>;
}
