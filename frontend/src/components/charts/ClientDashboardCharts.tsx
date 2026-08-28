import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { loadClientLiveSnapshot, deriveClientTrafficSeries, deriveClientTrafficSources } from "@/lib/client-live-data";
import { useEffect, useMemo, useState } from "react";

export default function ClientDashboardCharts() {
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof loadClientLiveSnapshot>> | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadClientLiveSnapshot().then((next) => {
      if (mounted) setSnapshot(next);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const trafficData = useMemo(() => (snapshot ? deriveClientTrafficSeries(snapshot) : []), [snapshot]);
  const sourceData = useMemo(() => (snapshot ? deriveClientTrafficSources(snapshot) : []), [snapshot]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2 border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">流量与询盘趋势</CardTitle>
          <Badge variant="outline" className="text-xs">最近 7 天</Badge>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trafficData}>
              <defs>
                <linearGradient id="dashboard-traffic-visitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="dashboard-traffic-inquiries" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
              <Area type="monotone" dataKey="visitors" stroke="#2563eb" fill="url(#dashboard-traffic-visitors)" strokeWidth={2} name="访客" />
              <Area type="monotone" dataKey="inquiries" stroke="#10b981" fill="url(#dashboard-traffic-inquiries)" strokeWidth={2} name="询盘" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">流量来源</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={sourceData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} dataKey="value">
                {sourceData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
