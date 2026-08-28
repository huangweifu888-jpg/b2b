import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Building2, Globe, ShoppingCart, DollarSign, MoreHorizontal } from "lucide-react";

import { loadAgencyLiveSnapshot } from "@/lib/agency-live-data";
import { deriveAgencyEnterprises } from "@/lib/agency-derived-data";

const statusMap: Record<string, { label: string; cls: string }> = {
  active: { label: "使用中", cls: "bg-emerald-100 text-emerald-700" },
  trial: { label: "试用", cls: "bg-blue-100 text-blue-700" },
  paused: { label: "已暂停", cls: "bg-slate-100 text-slate-700" },
  disabled: { label: "已禁用", cls: "bg-slate-100 text-slate-700" },
};

export default function Enterprises() {
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

  const enterprises = useMemo(() => (snapshot ? deriveAgencyEnterprises(snapshot) : []), [snapshot]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">外贸企业管理</h1>
          <p className="mt-1 text-sm text-slate-500">当前代理下真实企业客户列表，按最新优先展示</p>
        </div>
        <Button className="bg-violet-600 hover:bg-violet-700">
          <Plus className="mr-2 h-4 w-4" />
          新增企业
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "企业总数", value: enterprises.length, icon: Building2 },
          { label: "运行中站点", value: enterprises.reduce((sum, item) => sum + item.sites, 0), icon: Globe },
          { label: "累计订单", value: enterprises.reduce((sum, item) => sum + item.orders, 0), icon: ShoppingCart },
          { label: "总 MRR", value: `¥${enterprises.reduce((sum, item) => sum + item.mrr, 0).toLocaleString()}`, icon: DollarSign },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="border-slate-200">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
                  <Icon className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <div className="text-xs text-slate-500">{item.label}</div>
                  <div className="text-lg font-bold text-slate-900">{item.value}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-slate-200 p-4">
            <Search className="h-4 w-4 text-slate-400" />
            <Input placeholder="搜索企业名称、编号或负责人..." className="h-8 flex-1 border-0 shadow-none focus-visible:ring-0" />
            <Button variant="outline" size="sm">筛选</Button>
            <Button variant="outline" size="sm">导出</Button>
          </div>
          <div className="responsive-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">企业</th>
                  <th className="px-4 py-3 text-left font-medium">编号</th>
                  <th className="px-4 py-3 text-left font-medium">行业</th>
                  <th className="px-4 py-3 text-center font-medium">站点数</th>
                  <th className="px-4 py-3 text-center font-medium">订单</th>
                  <th className="px-4 py-3 text-right font-medium">MRR</th>
                  <th className="px-4 py-3 text-left font-medium">负责人</th>
                  <th className="px-4 py-3 text-left font-medium">状态</th>
                  <th className="px-4 py-3 text-center font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {enterprises.map((enterprise) => (
                  <tr key={enterprise.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white">
                          {enterprise.name.slice(0, 1)}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{enterprise.name}</div>
                          <div className="text-[11px] text-slate-500">{enterprise.contact}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{enterprise.code}</td>
                    <td className="px-4 py-3 text-slate-600">{enterprise.industry || "-"}</td>
                    <td className="px-4 py-3 text-center font-semibold">{enterprise.sites}</td>
                    <td className="px-4 py-3 text-center">{enterprise.orders}</td>
                    <td className="px-4 py-3 text-right font-semibold text-violet-600">¥{enterprise.mrr.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-600">{enterprise.owner}</td>
                    <td className="px-4 py-3">
                      <Badge className={`${statusMap[enterprise.status].cls} hover:${statusMap[enterprise.status].cls}`}>
                        {statusMap[enterprise.status].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
