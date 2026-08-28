import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, BarChart3, Eye, FileText, Users, Clock, Globe } from "lucide-react";

interface StatItem {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down";
}

interface DataStatsPanelProps {
  title: string;
  stats: StatItem[];
  chartData?: { label: string; value: number }[];
  topItems?: { title: string; views: number; date: string }[];
}

export default function DataStatsPanel({ title, stats, chartData, topItems }: DataStatsPanelProps) {
  const maxChartValue = chartData ? Math.max(...chartData.map((d) => d.value)) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">{s.label}</div>
                <Badge className={`text-xs ${s.trend === "up" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                  <span className="flex items-center gap-0.5">
                    {s.trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {s.change}
                  </span>
                </Badge>
              </div>
              <div className="text-2xl font-bold mt-1">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {chartData && (
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                近7日趋势
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 h-32">
                {chartData.map((d) => (
                  <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-blue-100 rounded-t relative" style={{ height: `${(d.value / maxChartValue) * 100}%`, minHeight: "4px" }}>
                      <div className="absolute inset-0 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t" />
                    </div>
                    <span className="text-[10px] text-slate-500">{d.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {topItems && (
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                热门内容 Top 5
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {topItems.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{item.title}</div>
                      <div className="text-[10px] text-slate-400">{item.date}</div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Eye className="w-3 h-3" />
                      {item.views.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-xs text-slate-500">内容完整度</div>
                <div className="text-sm font-bold">86%</div>
                <div className="w-20 h-1.5 bg-slate-100 rounded-full mt-1">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: "86%" }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Globe className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-xs text-slate-500">SEO 覆盖率</div>
                <div className="text-sm font-bold">78%</div>
                <div className="w-20 h-1.5 bg-slate-100 rounded-full mt-1">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: "78%" }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="text-xs text-slate-500">用户互动率</div>
                <div className="text-sm font-bold">4.2%</div>
                <div className="w-20 h-1.5 bg-slate-100 rounded-full mt-1">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: "42%" }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}