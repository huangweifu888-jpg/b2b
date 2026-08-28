import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check, Edit3, Plus, Search } from "lucide-react";

import { collectAgencyClients, collectAgencyProjects, loadAgencyLiveSnapshot } from "@/lib/agency-live-data";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";
import type { PlatformNode } from "@/lib/platform-api";

type PlanRow = {
  project: PlatformNode["projects"][number];
  client: PlatformNode;
};

const statusMap: Record<string, { label: string; cls: string }> = {
  active: { label: "正常", cls: "bg-emerald-100 text-emerald-700" },
  pending: { label: "待处理", cls: "bg-amber-100 text-amber-700" },
  paused: { label: "已暂停", cls: "bg-slate-100 text-slate-700" },
  disabled: { label: "已禁用", cls: "bg-slate-100 text-slate-700" },
  trial: { label: "试用中", cls: "bg-blue-100 text-blue-700" },
};

function formatDateLabel(value?: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function StatusBadge({ status }: { status: string }) {
  const info = statusMap[status] || { label: sanitizeDisplayText(status, "未知"), cls: "bg-slate-100 text-slate-700" };
  return <Badge className={`${info.cls} hover:${info.cls}`}>{info.label}</Badge>;
}

export default function Plans() {
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof loadAgencyLiveSnapshot>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const next = await loadAgencyLiveSnapshot();
        if (!mounted) return;
        setSnapshot(next);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "加载计划数据失败");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    const refresh = () => void load();
    window.addEventListener("storage", refresh);
    window.addEventListener("sites-updated", refresh);
    window.addEventListener("site-project-version-updated", refresh);

    return () => {
      mounted = false;
      window.removeEventListener("storage", refresh);
      window.removeEventListener("sites-updated", refresh);
      window.removeEventListener("site-project-version-updated", refresh);
    };
  }, []);

  const planRows = useMemo<PlanRow[]>(() => {
    if (!snapshot?.currentAgency) return [];
    return collectAgencyProjects(snapshot.currentAgency).map((project) => ({
      client: project.client,
      project,
    }));
  }, [snapshot]);

  const stats = useMemo(
    () => [
      { label: "计划总数", value: planRows.length },
      { label: "当前代理", value: snapshot?.currentAgency?.code || "-" },
      { label: "客户企业", value: collectAgencyClients(snapshot?.currentAgency || null).length },
      { label: "最新计划", value: planRows[0]?.project.code || "-" },
    ],
    [planRows, snapshot]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">客户计划</h1>
          <p className="mt-1 text-sm text-slate-500">按最新优先展示当前代理下的真实计划列表。</p>
        </div>
        <Button className="bg-violet-600 hover:bg-violet-700">
          <Plus className="mr-2 h-4 w-4" />
          新建计划
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {stats.map((item) => (
          <Card key={item.label} className="border-slate-200">
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">{item.label}</div>
              <div className="text-2xl font-bold text-slate-900">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">计划数据加载失败：{error}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card className="border-slate-200">
          <CardContent className="p-5 text-sm text-slate-500">正在加载真实计划数据...</CardContent>
        </Card>
      ) : (
        <Card className="border-slate-200">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b border-slate-200 p-4">
              <Search className="h-4 w-4 text-slate-400" />
              <Input placeholder="搜索计划名称、计划编号或客户编号" className="h-8 flex-1 border-0 shadow-none focus-visible:ring-0" />
              <Button variant="outline" size="sm">
                筛选
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">计划</th>
                    <th className="px-4 py-3 text-left font-medium">客户企业</th>
                    <th className="px-4 py-3 text-left font-medium">所属代理</th>
                    <th className="px-4 py-3 text-left font-medium">访问地址</th>
                    <th className="px-4 py-3 text-left font-medium">创建时间</th>
                    <th className="px-4 py-3 text-left font-medium">状态</th>
                    <th className="px-4 py-3 text-center font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {planRows.map((row) => (
                    <tr key={row.project.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{sanitizeDisplayText(row.project.name, row.project.code)}</div>
                        <div className="font-mono text-[11px] text-slate-500">{row.project.code}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{sanitizeDisplayText(row.client.name, row.client.code)}</div>
                        <div className="font-mono text-[11px] text-slate-500">{row.client.code}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-cyan-700">
                        {snapshot?.currentAgency ? sanitizeDisplayText(snapshot.currentAgency.name, snapshot.currentAgency.code) : "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{row.project.domain || "-"}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDateLabel(row.project.created_at)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.project.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
