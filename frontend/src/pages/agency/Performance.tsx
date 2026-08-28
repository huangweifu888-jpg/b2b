import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, TrendingUp, Download } from "lucide-react";

import { loadAgencyLiveSnapshot } from "@/lib/agency-live-data";
import { deriveAgencyPerformance } from "@/lib/agency-derived-data";
import { FactoryPage } from "@/page-factory/FactoryPage";

export default function Performance() {
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

  const performance = useMemo(() => (snapshot ? deriveAgencyPerformance(snapshot) : []), [snapshot]);
  const maxRev = Math.max(...performance.map((item) => item.revenue), 1);

  return (
    <FactoryPage pageId="agency-performance" template="dashboard" sourceScope="agency_source" className="space-y-6">
      <div data-page-factory-region="content" data-development-standard-frame-region="content" data-development-standard-frame-label="内容" className="space-y-6">
      <div data-page-factory-region="title-2" data-development-standard-frame-region="title-2" data-development-standard-frame-label="标题二" className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">绩效统计</h1>
          <p className="mt-1 text-sm text-slate-500">基于当前代理下真实客户数据生成排行</p>
        </div>
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">最新排序优先</Badge>
      </div>

      <Card data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" className="border-slate-200">
        <CardContent data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" className="p-6">
          <div className="mb-6 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold text-slate-900">本月销量榜</h3>
            <Badge className="ml-auto bg-amber-100 text-amber-700 hover:bg-amber-100">实时</Badge>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {performance.slice(0, 3).map((item, index) => {
              const medals = ["🥇", "🥈", "🥉"];
              const colors = ["from-amber-400 to-amber-500", "from-slate-300 to-slate-400", "from-orange-400 to-orange-500"];
              return (
                <div key={item.name} className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${colors[index]} p-5 text-white`}>
                  <div className="mb-2 text-3xl">{medals[index]}</div>
                  <div className="text-lg font-bold">{item.name}</div>
                  <div className="text-xs opacity-90">{item.role}</div>
                  <div className="mt-3 border-t border-white/30 pt-3">
                    <div className="text-xs opacity-80">本月营收</div>
                    <div className="text-2xl font-bold">¥{item.revenue.toLocaleString()}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            {performance.map((item) => (
              <div key={item.name} className="flex items-center gap-4 rounded-lg border border-slate-100 p-3 hover:bg-slate-50">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white">
                  {item.rank}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">{item.name}</div>
                  <div className="text-[11px] text-slate-500">{item.role}</div>
                </div>
                <div className="hidden items-center gap-6 text-xs md:flex">
                  <div className="text-center">
                    <div className="font-semibold text-slate-900">{item.newClients}</div>
                    <div className="text-slate-400">新客户</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-slate-900">{item.tasks}</div>
                    <div className="text-slate-400">任务</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-emerald-600">{item.completion}%</div>
                    <div className="text-slate-400">完成率</div>
                  </div>
                </div>
                <div className="hidden w-40 lg:block">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${(item.revenue / maxRev) * 100}%` }} />
                  </div>
                </div>
                <div className="min-w-[110px] text-right">
                  <div className="text-base font-bold text-violet-600">¥{item.revenue.toLocaleString()}</div>
                  <div className="flex items-center justify-end gap-0.5 text-[10px] text-emerald-600">
                    <TrendingUp className="h-3 w-3" /> 营收
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </div>
    </FactoryPage>
  );
}
