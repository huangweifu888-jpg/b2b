import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown, TrendingUp, DollarSign, ShoppingCart, Users, Target } from "lucide-react";

import { loadAgencyLiveSnapshot } from "@/lib/agency-live-data";
import { deriveAgencyBusinessData } from "@/lib/agency-derived-data";
import { FactoryPage } from "@/page-factory/FactoryPage";

export default function BusinessData() {
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

  const businessData = useMemo(() => (snapshot ? deriveAgencyBusinessData(snapshot) : []), [snapshot]);
  const cur = businessData[businessData.length - 1];
  const prev = businessData[businessData.length - 2];
  const pct = (a: number, b: number) => (((a - b) / Math.max(b, 1)) * 100).toFixed(1);
  const maxRev = Math.max(...businessData.map((d) => d.revenue), 1);
  const maxGmv = Math.max(...businessData.map((d) => d.gmv), 1);

  return (
    <FactoryPage pageId="agency-business-data" template="dashboard" sourceScope="agency_source" className="space-y-6">
      <div data-page-factory-region="content" data-development-standard-frame-region="content" data-development-standard-frame-label="内容" className="space-y-6">
      <div data-page-factory-region="title-2" data-development-standard-frame-region="title-2" data-development-standard-frame-label="标题二">
        <h1 className="text-2xl font-bold text-slate-900">业务数据</h1>
        <p className="mt-1 text-sm text-slate-500">代理商经营趋势看板</p>
      </div>

      <div data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "本月营收", v: `¥${((cur?.revenue || 0) / 10000).toFixed(1)}万`, icon: DollarSign, change: pct(cur?.revenue || 0, prev?.revenue || 1), color: "from-violet-500 to-fuchsia-500" },
          { label: "本月订单", v: cur?.orders || 0, icon: ShoppingCart, change: pct(cur?.orders || 0, prev?.orders || 1), color: "from-blue-500 to-cyan-500" },
          { label: "新增企业", v: cur?.newClients || 0, icon: Users, change: pct(cur?.newClients || 0, prev?.newClients || 1), color: "from-emerald-500 to-teal-500" },
          { label: "GMV（站点）", v: `¥${((cur?.gmv || 0) / 10000).toFixed(0)}万`, icon: Target, change: pct(cur?.gmv || 0, prev?.gmv || 1), color: "from-amber-500 to-orange-500" },
        ].map((k) => {
          const Icon = k.icon;
          const positive = parseFloat(k.change) >= 0;
          return (
            <Card key={k.label} data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" className="border-slate-200">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${k.color}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <Badge className={`${positive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"} text-[10px] hover:bg-transparent`}>
                    {positive ? <TrendingUp className="mr-0.5 h-3 w-3" /> : <TrendingDown className="mr-0.5 h-3 w-3" />}
                    {k.change}%
                  </Badge>
                </div>
                <div className="mt-3 text-2xl font-bold text-slate-900">{k.v}</div>
                <div className="mt-1 text-xs text-slate-500">{k.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <h3 className="mb-6 font-semibold text-slate-900">营收趋势</h3>
            <div className="flex h-64 items-end gap-2">
              {businessData.map((item) => (
                <div key={item.month} className="flex flex-1 flex-col items-center gap-2">
                  <div className="text-[10px] font-semibold">¥{(item.revenue / 10000).toFixed(0)}万</div>
                  <div className="w-full rounded-t-md bg-gradient-to-t from-violet-500 to-fuchsia-400" style={{ height: `${(item.revenue / maxRev) * 85}%` }} />
                  <div className="text-[10px] text-slate-500">{item.month.slice(5)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <h3 className="mb-6 font-semibold text-slate-900">站点 GMV</h3>
            <div className="flex h-64 items-end gap-2">
              {businessData.map((item) => (
                <div key={item.month} className="flex flex-1 flex-col items-center gap-2">
                  <div className="text-[10px] font-semibold">¥{(item.gmv / 10000).toFixed(0)}万</div>
                  <div className="w-full rounded-t-md bg-gradient-to-t from-emerald-500 to-teal-400" style={{ height: `${(item.gmv / maxGmv) * 85}%` }} />
                  <div className="text-[10px] text-slate-500">{item.month.slice(5)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-page-factory-region="table-shell" data-development-standard-frame-region="table-shell" data-development-standard-frame-label="表内" className="border-slate-200">
        <CardContent className="p-0">
          <div data-page-factory-region="scrollbar" data-page-list-scroll-owner className="responsive-table-wrap">
            <table className="w-full text-sm">
              <thead data-page-factory-region="table-header" data-development-standard-frame-region="table-header" data-development-standard-frame-label="表头" className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">月份</th>
                  <th className="px-4 py-3 text-right font-medium">营收</th>
                  <th className="px-4 py-3 text-right font-medium">订单数</th>
                  <th className="px-4 py-3 text-right font-medium">新增企业</th>
                  <th className="px-4 py-3 text-right font-medium">GMV</th>
                </tr>
              </thead>
              <tbody>
                {businessData.slice().reverse().map((item) => (
                  <tr key={item.month} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono">{item.month}</td>
                    <td className="px-4 py-3 text-right font-semibold text-violet-600">¥{item.revenue.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{item.orders}</td>
                    <td className="px-4 py-3 text-right">{item.newClients}</td>
                    <td className="px-4 py-3 text-right font-semibold">¥{item.gmv.toLocaleString()}</td>
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
