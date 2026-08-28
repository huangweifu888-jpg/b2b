import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookmarkCheck, Clock, Plus } from "lucide-react";

import { loadAgencyLiveSnapshot } from "@/lib/agency-live-data";
import { deriveAgencyReports } from "@/lib/agency-derived-data";
import { FactoryPage } from "@/page-factory/FactoryPage";

const statusMap: Record<string, { label: string; cls: string }> = {
  approved: { label: "已通过", cls: "bg-emerald-100 text-emerald-700" },
  pending: { label: "待审核", cls: "bg-amber-100 text-amber-700" },
  rejected: { label: "已拒绝", cls: "bg-red-100 text-red-700" },
};

export default function Reports() {
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof loadAgencyLiveSnapshot>> | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadAgencyLiveSnapshot().then((next) => {
      if (mounted) setSnapshot(next);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const reports = useMemo(() => (snapshot ? deriveAgencyReports(snapshot) : []), [snapshot]);
  const orderedReports = [...reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

  return (
    <FactoryPage pageId="agency-reports" template="list" sourceScope="agency_source" className="space-y-6">
      <div data-page-factory-region="content" data-development-standard-frame-region="content" data-development-standard-frame-label="内容" className="space-y-6">
      <div data-page-factory-region="title-2" data-development-standard-frame-region="title-2" data-development-standard-frame-label="标题二" className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">客户报备</h1>
          <p className="mt-1 text-sm text-slate-500">真实客户报备列表</p>
        </div>
        <Button className="bg-violet-600 hover:bg-violet-700">
          <Plus className="mr-2 h-4 w-4" />
          新建报备
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-slate-200"><CardContent className="p-4"><div className="text-xs text-slate-500">报备中</div><div className="text-2xl font-bold text-emerald-600">{orderedReports.filter((r) => r.status === "approved").length}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-4"><div className="text-xs text-slate-500">待审核</div><div className="text-2xl font-bold text-amber-600">{orderedReports.filter((r) => r.status === "pending").length}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-4"><div className="text-xs text-slate-500">已拒绝</div><div className="text-2xl font-bold text-red-600">{orderedReports.filter((r) => r.status === "rejected").length}</div></CardContent></Card>
      </div>

      <Card data-page-factory-region="table-shell" data-development-standard-frame-region="table-shell" data-development-standard-frame-label="表内" className="border-slate-200">
        <CardContent className="p-0">
          <div data-page-factory-region="scrollbar" data-development-standard-frame-region="scrollbar" data-development-standard-frame-label="滚动条" className="responsive-table-wrap">
            <table className="w-full text-sm">
              <thead data-page-factory-region="table-header" data-development-standard-frame-region="table-header" data-development-standard-frame-label="表头" className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">报备号</th>
                  <th className="px-4 py-3 text-left font-medium">客户</th>
                  <th className="px-4 py-3 text-left font-medium">报备人</th>
                  <th className="px-4 py-3 text-left font-medium">关联计划</th>
                  <th className="px-4 py-3 text-left font-medium">状态</th>
                  <th className="px-4 py-3 text-left font-medium">到期时间</th>
                  <th className="px-4 py-3 text-left font-medium">创建时间</th>
                  <th className="px-4 py-3 text-center font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {orderedReports.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <BookmarkCheck className="h-3.5 w-3.5 text-violet-500" />
                        {r.id}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{r.customer}</td>
                    <td className="px-4 py-3 text-slate-600">{r.from}</td>
                    <td className="px-4 py-3 text-slate-600">{r.enterprise}</td>
                    <td className="px-4 py-3">
                      <Badge className={`${statusMap[r.status].cls} hover:${statusMap[r.status].cls}`}>{statusMap[r.status].label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.expires !== "-" ? (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Clock className="h-3 w-3" />
                          {r.expires}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.createdAt}</td>
                    <td className="px-4 py-3 text-center">
                      <Button variant="ghost" size="sm" className="h-7 text-xs">查看</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </div>
    </FactoryPage>
  );
}
