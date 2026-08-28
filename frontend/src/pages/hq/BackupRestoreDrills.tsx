import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listBackups, recordBackupRestoreDrill } from "@/lib/template-snapshot/api";
import { FactoryPage } from "@/page-factory/FactoryPage";

type Backup = { backup_id: string; target_id: string; version?: string | null; backup_kind: string; created_at?: string | null; metadata_json?: { restore_drill?: { result?: string; note?: string; recorded_at?: string } } };
const time = (value?: string | null) => value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-";

export default function BackupRestoreDrills() {
  const [items, setItems] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); try { setItems(await listBackups() as Backup[]); } catch (error) { toast.error(error instanceof Error ? error.message : "备份记录加载失败"); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const record = async (backup: Backup, result: "passed" | "failed") => {
    const note = window.prompt(result === "passed" ? "填写隔离恢复演练说明（可留空）" : "请填写恢复演练失败原因");
    if (note === null) return;
    setBusy(backup.backup_id);
    try { await recordBackupRestoreDrill(backup.backup_id, result, note); toast.success("恢复演练结果已记录到审计日志。"); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "记录失败"); }
    finally { setBusy(null); }
  };
  return <FactoryPage pageId="hq-backup-restore-drills" template="list" sourceScope="hq" autoRegions><section className="mx-auto max-w-6xl space-y-5 pb-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-2 text-emerald-700"><ShieldCheck className="h-5 w-5" /><span className="text-sm font-semibold">总部端 · 备份恢复演练</span></div><h1 className="mt-2 text-2xl font-bold">备份快照与隔离恢复记录</h1><p className="mt-1 text-sm text-slate-500">演练只记录在隔离测试环境中的恢复结果，不能直接覆盖正在运行的实例。</p></div><Button variant="outline" disabled={loading} onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />刷新</Button></div><div className="overflow-x-auto rounded-2xl border bg-white shadow-sm"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-3">备份</th><th className="px-4 py-3">目标/版本</th><th className="px-4 py-3">创建时间</th><th className="px-4 py-3">最近演练</th><th className="px-4 py-3">操作</th></tr></thead><tbody>{items.map((item) => { const drill = item.metadata_json?.restore_drill; return <tr key={item.backup_id} className="border-t"><td className="px-4 py-3"><div className="font-mono text-xs">{item.backup_id}</div><Badge variant="secondary" className="mt-1">{item.backup_kind}</Badge></td><td className="px-4 py-3">{item.target_id}<div className="text-xs text-slate-500">{item.version || "未指定版本"}</div></td><td className="px-4 py-3 text-xs text-slate-500">{time(item.created_at)}</td><td className="px-4 py-3 text-xs">{drill ? <span className={drill.result === "passed" ? "text-emerald-700" : "text-rose-700"}>{drill.result === "passed" ? "通过" : "失败"} · {time(drill.recorded_at)}<br />{drill.note || "无说明"}</span> : "尚未演练"}</td><td className="px-4 py-3"><div className="flex gap-2"><Button size="sm" disabled={busy === item.backup_id} onClick={() => void record(item, "passed")}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />通过</Button><Button size="sm" variant="outline" disabled={busy === item.backup_id} onClick={() => void record(item, "failed")}><XCircle className="mr-1 h-3.5 w-3.5" />失败</Button></div></td></tr>; })}{!loading && !items.length ? <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">暂无快照备份；同步或回退后会自动生成。</td></tr> : null}</tbody></table></div></section></FactoryPage>;
}
