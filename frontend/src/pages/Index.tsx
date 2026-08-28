import { Suspense, lazy } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

import { TrendingUp, TrendingDown, ArrowRight, Mail, Users2, Target, Coins } from "lucide-react";

import { loadClientLiveSnapshot, deriveClientDashboardStats, deriveClientRecentInquiries } from "@/lib/client-live-data";

import { Link } from "react-router-dom";

import { useEffect, useMemo, useState } from "react";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { usePostPaintReady } from "@/lib/post-paint-lazy";

const ClientDashboardCharts = lazy(() => import("@/components/charts/ClientDashboardCharts"));

function ClientDashboardChartsPlaceholder() {
  return <div aria-hidden="true" className="min-h-[280px] rounded-lg border border-slate-200 bg-slate-50" />;
}

const iconMap = [Mail, Users2, Target, Coins];
const colorMap: Record<string, string> = {
  blue: "from-blue-500 to-blue-600",
  sky: "from-sky-500 to-sky-600",
  emerald: "from-emerald-500 to-emerald-600",
  amber: "from-amber-500 to-amber-600",
};

export default function Index() {
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof loadClientLiveSnapshot>> | null>(null);
  const dashboardChartsReady = usePostPaintReady(700);

  useEffect(() => {
    let mounted = true;
    void loadClientLiveSnapshot().then((next) => {
      if (mounted) setSnapshot(next);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const dashboardStats = useMemo(() => (snapshot ? deriveClientDashboardStats(snapshot) : []), [snapshot]);
  const recentInquiries = useMemo(() => (snapshot ? deriveClientRecentInquiries(snapshot) : []), [snapshot]);

  return (
    <FactoryPage pageId="client-dashboard" template="dashboard" sourceScope="client_source" className="space-y-6">
      <div data-page-factory-region="content" data-development-standard-frame-region="content" data-development-standard-frame-label="内容" className="space-y-6">
      <div data-page-factory-region="title-2" data-development-standard-frame-region="title-2" data-development-standard-frame-label="标题二" className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">工作台</h1>
          <p className="mt-1 text-sm text-slate-500">欢迎回来，查看今日外贸业务动态。</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            系统正常
          </Badge>
        </div>
      </div>

      <div data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {dashboardStats.map((stat, index) => {
          const Icon = iconMap[index];
          return (
            <Card key={stat.label} data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-slate-500">{stat.label}</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{stat.value}</div>
                    <div className={`mt-2 flex items-center gap-1 text-xs ${stat.trend === "up" ? "text-emerald-600" : "text-red-500"}`}>
                      {stat.trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {stat.change}
                      <span className="text-slate-400">对比昨日</span>
                    </div>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${colorMap[stat.color]}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div data-client-dashboard-chart-post-paint>
        {dashboardChartsReady ? (
          <Suspense fallback={<ClientDashboardChartsPlaceholder />}>
            <ClientDashboardCharts />
          </Suspense>
        ) : (
          <ClientDashboardChartsPlaceholder />
        )}
      </div>

      <Card data-page-factory-region="table-shell" data-development-standard-frame-region="table-shell" data-development-standard-frame-label="表内">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">最新询盘</CardTitle>
          <Link to="/inquiries" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
            查看全部 <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          <div data-page-factory-region="scrollbar" data-page-list-scroll-owner className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead data-page-factory-region="table-header" data-development-standard-frame-region="table-header" data-development-standard-frame-label="表头">
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="px-2 py-2 text-left font-medium">询盘编号</th>
                  <th className="px-2 py-2 text-left font-medium">客户</th>
                  <th className="px-2 py-2 text-left font-medium">国家</th>
                  <th className="px-2 py-2 text-left font-medium">产品</th>
                  <th className="px-2 py-2 text-left font-medium">时间</th>
                  <th className="px-2 py-2 text-left font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {recentInquiries.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-2 py-3 font-mono text-xs text-blue-600">{row.id}</td>
                    <td className="px-2 py-3">
                      <div className="font-medium text-slate-900">{row.name}</div>
                      <div className="text-xs text-slate-500">{row.company}</div>
                    </td>
                    <td className="px-2 py-3 text-slate-700">{row.country}</td>
                    <td className="px-2 py-3 text-slate-700">{row.product}</td>
                    <td className="px-2 py-3 text-xs text-slate-500">{row.time}</td>
                    <td className="px-2 py-3">
                      {row.status === "new" && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">新询盘</Badge>}
                      {row.status === "replied" && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">已回复</Badge>}
                      {row.status === "pending" && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">待处理</Badge>}
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
