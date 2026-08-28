import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Mail, MoreHorizontal, Plus, Search } from "lucide-react";

import { loadAgencyLiveSnapshot } from "@/lib/agency-live-data";
import { deriveAgencyMembers } from "@/lib/agency-derived-data";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";
import { FactoryPage } from "@/page-factory/FactoryPage";

const statusMap: Record<string, { label: string; cls: string }> = {
  active: { label: "在职", cls: "bg-emerald-100 text-emerald-700" },
  leave: { label: "离职", cls: "bg-amber-100 text-amber-700" },
};

export default function Members() {
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

  const teamMembers = useMemo(() => (snapshot ? deriveAgencyMembers(snapshot) : []), [snapshot]);

  return (
    <FactoryPage pageId="agency-members" template="list" sourceScope="agency_source" className="space-y-6">
      <div data-page-factory-region="content" data-development-standard-frame-region="content" data-development-standard-frame-label="内容" className="space-y-6">
      <div data-page-factory-region="title-2" data-development-standard-frame-region="title-2" data-development-standard-frame-label="标题二" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">成员管理</h1>
          <p className="mt-1 text-sm text-slate-500">管理代理商团队成员</p>
        </div>
        <Button className="self-start bg-violet-600 hover:bg-violet-700 sm:self-auto">
          <Plus className="mr-2 h-4 w-4" />
          邀请成员
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-200"><CardContent className="p-4"><div className="text-xs text-slate-500">成员总数</div><div className="text-2xl font-bold">{teamMembers.length}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-4"><div className="text-xs text-slate-500">在职</div><div className="text-2xl font-bold text-emerald-600">{teamMembers.filter((m) => m.status === "active").length}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-4"><div className="text-xs text-slate-500">部门数</div><div className="text-2xl font-bold">{new Set(teamMembers.map((m) => m.department)).size}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-4"><div className="text-xs text-slate-500">平均绩效</div><div className="text-2xl font-bold text-violet-600">{teamMembers.length ? Math.round(teamMembers.reduce((s, m) => s + m.performance, 0) / teamMembers.length) : 0}</div></CardContent></Card>
      </div>

      <Card data-page-factory-region="table-shell" data-development-standard-frame-region="table-shell" data-development-standard-frame-label="表内" className="border-slate-200">
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
            <Search className="h-4 w-4 text-slate-400" />
            <Input placeholder="搜索成员..." className="h-8 flex-1 border-0 shadow-none focus-visible:ring-0" />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm">按部门</Button>
              <Button variant="outline" size="sm">按角色</Button>
            </div>
          </div>
          <div data-page-factory-region="scrollbar" data-development-standard-frame-region="scrollbar" data-development-standard-frame-label="滚动条" className="responsive-table-wrap">
            <table className="w-full text-sm">
              <thead data-page-factory-region="table-header" data-development-standard-frame-region="table-header" data-development-standard-frame-label="表头" className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">成员</th>
                  <th className="px-4 py-3 text-left font-medium">角色</th>
                  <th className="px-4 py-3 text-left font-medium">部门</th>
                  <th className="px-4 py-3 text-center font-medium">客户数</th>
                  <th className="px-4 py-3 text-center font-medium">绩效</th>
                  <th className="px-4 py-3 text-left font-medium">入职</th>
                  <th className="px-4 py-3 text-left font-medium">状态</th>
                  <th className="px-4 py-3 text-center font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {teamMembers.map((member) => {
                  const state = statusMap[member.status] || { label: "未知", cls: "bg-slate-100 text-slate-700" };
                  return (
                    <tr key={member.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white">
                            {sanitizeDisplayText(member.avatar, sanitizeDisplayText(member.name, "成").slice(0, 1))}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{sanitizeDisplayText(member.name, "未命名成员")}</div>
                            <div className="text-[11px] text-slate-500">{sanitizeDisplayText(member.email, "未填写邮箱")}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{sanitizeDisplayText(member.role, "未设置角色")}</Badge></td>
                      <td className="px-4 py-3 text-slate-600">{sanitizeDisplayText(member.department, "未分配部门")}</td>
                      <td className="px-4 py-3 text-center font-semibold">{member.clients}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${member.performance > 180 ? "text-emerald-600" : member.performance > 100 ? "text-slate-900" : "text-slate-400"}`}>{member.performance}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{member.joined}</td>
                      <td className="px-4 py-3"><Badge className={`${state.cls} hover:${state.cls}`}>{state.label}</Badge></td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Mail className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </div>
    </FactoryPage>
  );
}
