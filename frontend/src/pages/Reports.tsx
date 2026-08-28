
import { lazy, Suspense, type ComponentProps } from "react";
import { useSearchParams } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import SiteContextCard from "@/components/SiteContextCard";
import { usePostPaintReady } from "@/lib/post-paint-lazy";
import { FactoryPage } from "@/page-factory/FactoryPage";

import { Download, TrendingUp, TrendingDown, Monitor, Smartphone, Tablet, Chrome } from "lucide-react";

const ReportChart = lazy(() => import("@/components/reports/ReportChart"));
type ReportChartProps = ComponentProps<(typeof import("@/components/reports/ReportChart"))["default"]>;

function DeferredReportChart(props: ReportChartProps) {
  const ready = usePostPaintReady(700);
  const fallback = <div data-report-chart-post-paint aria-busy="true" aria-label="图表加载中" className="w-full animate-pulse rounded-xl bg-slate-100" style={{ height: props.height }} />;
  if (!ready) return fallback;
  return (
    <Suspense fallback={fallback}>
      <ReportChart {...props} />
    </Suspense>
  );
}

// ===== 流量概况 =====
function TrafficOverview() {
  const dailyTraffic = [
    { date: "04/28", pv: 4520, uv: 1890, ip: 1650 },
    { date: "04/29", pv: 5100, uv: 2120, ip: 1830 },
    { date: "04/30", pv: 4890, uv: 1980, ip: 1720 },
    { date: "05/01", pv: 6200, uv: 2580, ip: 2210 },
    { date: "05/02", pv: 5800, uv: 2340, ip: 2050 },
    { date: "05/03", pv: 5450, uv: 2200, ip: 1920 },
    { date: "05/04", pv: 6800, uv: 2890, ip: 2480 },
    { date: "05/05", pv: 7200, uv: 3050, ip: 2650 },
    { date: "05/06", pv: 6950, uv: 2920, ip: 2530 },
    { date: "05/07", pv: 7500, uv: 3200, ip: 2780 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "今日 PV", value: "7,500", change: "+8.2%", up: true },
          { label: "今日 UV", value: "3,200", change: "+9.6%", up: true },
          { label: "今日 IP", value: "2,780", change: "+5.3%", up: true },
          { label: "跳出率", value: "42.3%", change: "-2.1%", up: false },
        ].map((s) => (
          <Card key={s.label} className="">
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">{s.label}</div>
              <div className="text-2xl font-bold mt-1">{s.value}</div>
              <div className={`text-xs mt-1 flex items-center gap-0.5 ${s.up ? "text-emerald-600" : "text-red-500"}`}>
                {s.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{s.change}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="">
        <CardHeader><CardTitle className="text-base">近10天流量趋势</CardTitle></CardHeader>
        <CardContent>
          <DeferredReportChart
            kind="area"
            data={dailyTraffic}
            height={300}
            series={[
              { key: "pv", color: "#2563eb", name: "浏览量(PV)" },
              { key: "uv", color: "#10b981", name: "访客数(UV)" },
              { key: "ip", color: "#f59e0b", name: "独立IP" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ===== 流量来源 =====
function TrafficSource() {
  const sourceData = [
    { name: "搜索引擎", value: 45, color: "#2563eb" },
    { name: "直接访问", value: 22, color: "#10b981" },
    { name: "社交媒体", value: 18, color: "#f59e0b" },
    { name: "外部链接", value: 10, color: "#8b5cf6" },
    { name: "邮件营销", value: 5, color: "#ef4444" },
  ];

  const sourceDetail = [
    { source: "Google", visits: 12800, percentage: "32%", bounce: "38%", duration: "4m 12s" },
    { source: "Bing", visits: 3200, percentage: "8%", bounce: "42%", duration: "3m 45s" },
    { source: "直接输入", visits: 8800, percentage: "22%", bounce: "35%", duration: "5m 20s" },
    { source: "Facebook", visits: 4200, percentage: "10.5%", bounce: "52%", duration: "2m 30s" },
    { source: "LinkedIn", visits: 2100, percentage: "5.3%", bounce: "45%", duration: "3m 15s" },
    { source: "Twitter/X", visits: 1800, percentage: "4.5%", bounce: "55%", duration: "2m 10s" },
    { source: "外部博客", visits: 2400, percentage: "6%", bounce: "40%", duration: "3m 50s" },
    { source: "邮件链接", visits: 2000, percentage: "5%", bounce: "30%", duration: "4m 40s" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="">
          <CardHeader><CardTitle className="text-base">流量来源分布</CardTitle></CardHeader>
          <CardContent>
            <DeferredReportChart kind="pie" data={sourceData} height={280} />
          </CardContent>
        </Card>
        <Card className="">
          <CardHeader><CardTitle className="text-base">来源明细</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="text-left py-2 font-medium">来源</th>
                  <th className="text-left py-2 font-medium">访问量</th>
                  <th className="text-left py-2 font-medium">占比</th>
                  <th className="text-left py-2 font-medium">跳出率</th>
                  <th className="text-left py-2 font-medium">平均时长</th>
                </tr>
              </thead>
              <tbody>
                {sourceDetail.map((s) => (
                  <tr key={s.source} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 font-medium">{s.source}</td>
                    <td className="py-2">{s.visits.toLocaleString()}</td>
                    <td className="py-2">{s.percentage}</td>
                    <td className="py-2">{s.bounce}</td>
                    <td className="py-2">{s.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ===== 地域分布 =====
function RegionDistribution() {
  const regions = [
    { country: "美国", flag: "🇺🇸", visits: 12500, percentage: 28, growth: "+12%" },
    { country: "德国", flag: "🇩🇪", visits: 8200, percentage: 18, growth: "+22%" },
    { country: "英国", flag: "🇬🇧", visits: 5400, percentage: 12, growth: "+8%" },
    { country: "法国", flag: "🇫🇷", visits: 4500, percentage: 10, growth: "+15%" },
    { country: "日本", flag: "🇯🇵", visits: 3800, percentage: 8, growth: "+18%" },
    { country: "澳大利亚", flag: "🇦🇺", visits: 2900, percentage: 6, growth: "+25%" },
    { country: "加拿大", flag: "🇨🇦", visits: 2400, percentage: 5, growth: "+10%" },
    { country: "巴西", flag: "🇧🇷", visits: 2100, percentage: 5, growth: "+35%" },
    { country: "印度", flag: "🇮🇳", visits: 1800, percentage: 4, growth: "+42%" },
    { country: "其他", flag: "🌍", visits: 1800, percentage: 4, growth: "+5%" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "覆盖国家", value: "86" },
          { label: "TOP 国家", value: "美国" },
          { label: "新兴市场增长", value: "+32%" },
          { label: "国际流量占比", value: "78%" },
        ].map((s) => (
          <Card key={s.label} className="">
            <CardContent className="p-4 text-center">
              <div className="text-xs text-slate-500">{s.label}</div>
              <div className="text-xl font-bold mt-1">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="">
        <CardHeader><CardTitle className="text-base">访客地域分布</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {regions.map((r) => (
              <div key={r.country} className="flex items-center gap-3">
                <span className="text-lg w-8">{r.flag}</span>
                <span className="w-20 text-sm font-medium">{r.country}</span>
                <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full flex items-center justify-end pr-2" style={{ width: `${r.percentage * 3}%` }}>
                    <span className="text-xs text-white font-medium">{r.percentage}%</span>
                  </div>
                </div>
                <span className="text-sm text-slate-600 w-16 text-right">{r.visits.toLocaleString()}</span>
                <span className="text-xs text-emerald-600 w-12 text-right">{r.growth}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== 受访页面 =====
function VisitedPages() {
  const pages = [
    { page: "/", title: "首页", pv: 18500, uv: 8200, bounce: "32%", avgTime: "2m 15s" },
    { page: "/products", title: "产品列表", pv: 12300, uv: 5600, bounce: "28%", avgTime: "4m 30s" },
    { page: "/products/led-bulb", title: "LED灯泡详情", pv: 8900, uv: 4200, bounce: "22%", avgTime: "5m 12s" },
    { page: "/about", title: "关于我们", pv: 6500, uv: 3100, bounce: "45%", avgTime: "1m 50s" },
    { page: "/contact", title: "联系我们", pv: 5200, uv: 2800, bounce: "38%", avgTime: "3m 20s" },
    { page: "/products/solar-panel", title: "太阳能板详情", pv: 4800, uv: 2300, bounce: "25%", avgTime: "4m 45s" },
    { page: "/blog", title: "博客文章", pv: 4200, uv: 2100, bounce: "42%", avgTime: "3m 10s" },
    { page: "/faq", title: "常见问题", pv: 3500, uv: 1800, bounce: "35%", avgTime: "2m 40s" },
  ];

  return (
    <div className="space-y-6">
      <Card className="">
        <CardHeader><CardTitle className="text-base">受访页面排行</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="text-left py-2 font-medium">#</th>
                <th className="text-left py-2 font-medium">页面</th>
                <th className="text-left py-2 font-medium">浏览量</th>
                <th className="text-left py-2 font-medium">访客数</th>
                <th className="text-left py-2 font-medium">跳出率</th>
                <th className="text-left py-2 font-medium">平均停留</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p, i) => (
                <tr key={p.page} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-3 text-slate-400 font-medium">{i + 1}</td>
                  <td className="py-3">
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-slate-400">{p.page}</div>
                  </td>
                  <td className="py-3">{p.pv.toLocaleString()}</td>
                  <td className="py-3">{p.uv.toLocaleString()}</td>
                  <td className="py-3">{p.bounce}</td>
                  <td className="py-3">{p.avgTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== 天访问量 =====
function DailyVisits() {
  const dailyData = [
    { date: "04/21", pv: 4200, uv: 1750 }, { date: "04/22", pv: 4500, uv: 1880 },
    { date: "04/23", pv: 4800, uv: 2010 }, { date: "04/24", pv: 5100, uv: 2150 },
    { date: "04/25", pv: 4900, uv: 2050 }, { date: "04/26", pv: 3800, uv: 1600 },
    { date: "04/27", pv: 3500, uv: 1480 }, { date: "04/28", pv: 5200, uv: 2180 },
    { date: "04/29", pv: 5500, uv: 2300 }, { date: "04/30", pv: 5800, uv: 2420 },
    { date: "05/01", pv: 6200, uv: 2600 }, { date: "05/02", pv: 6000, uv: 2510 },
    { date: "05/03", pv: 4200, uv: 1780 }, { date: "05/04", pv: 4000, uv: 1680 },
    { date: "05/05", pv: 6500, uv: 2720 }, { date: "05/06", pv: 6800, uv: 2850 },
    { date: "05/07", pv: 7200, uv: 3020 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "今日PV", value: "7,200" },
          { label: "今日UV", value: "3,020" },
          { label: "日均PV", value: "5,312" },
          { label: "日均UV", value: "2,235" },
        ].map((s) => (
          <Card key={s.label} className="">
            <CardContent className="p-4 text-center">
              <div className="text-xs text-slate-500">{s.label}</div>
              <div className="text-xl font-bold mt-1">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="">
        <CardHeader><CardTitle className="text-base">每日访问量趋势（近17天）</CardTitle></CardHeader>
        <CardContent>
          <DeferredReportChart
            kind="bar"
            data={dailyData}
            height={320}
            series={[
              { key: "pv", color: "#2563eb", name: "浏览量(PV)" },
              { key: "uv", color: "#10b981", name: "访客数(UV)" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ===== 访客时间 =====
function VisitorTime() {
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, "0")}:00`,
    visits: 50 + ((i * 73 + 127) % 401) + (i >= 8 && i <= 20 ? 300 : 0),
  }));

  const weekdayData = [
    { day: "周一", visits: 5200 }, { day: "周二", visits: 5800 },
    { day: "周三", visits: 6100 }, { day: "周四", visits: 5900 },
    { day: "周五", visits: 5500 }, { day: "周六", visits: 3200 },
    { day: "周日", visits: 2800 },
  ];

  return (
    <div className="space-y-6">
      <Card className="">
        <CardHeader><CardTitle className="text-base">24小时访问分布</CardTitle></CardHeader>
        <CardContent>
          <DeferredReportChart
            kind="area"
            data={hourlyData}
            height={280}
            xKey="hour"
            showLegend={false}
            series={[{ key: "visits", color: "#8b5cf6", name: "访问量" }]}
          />
        </CardContent>
      </Card>
      <Card className="">
        <CardHeader><CardTitle className="text-base">一周访问分布</CardTitle></CardHeader>
        <CardContent>
          <DeferredReportChart
            kind="bar"
            data={weekdayData}
            height={220}
            xKey="day"
            showLegend={false}
            series={[{ key: "visits", color: "#f59e0b", name: "访问量" }]}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ===== 访问明细 =====
function VisitDetails() {
  const details = [
    { time: "10:32:15", ip: "192.168.1.***", region: "美国·纽约", page: "/products/led-bulb", source: "Google", device: "Desktop", duration: "5m 12s" },
    { time: "10:28:42", ip: "172.16.0.***", region: "德国·柏林", page: "/", source: "直接访问", device: "Mobile", duration: "2m 30s" },
    { time: "10:25:18", ip: "10.0.0.***", region: "英国·伦敦", page: "/about", source: "LinkedIn", device: "Desktop", duration: "1m 45s" },
    { time: "10:22:05", ip: "192.168.2.***", region: "日本·东京", page: "/products", source: "Google", device: "Tablet", duration: "4m 20s" },
    { time: "10:18:33", ip: "172.16.1.***", region: "法国·巴黎", page: "/contact", source: "Facebook", device: "Mobile", duration: "3m 10s" },
    { time: "10:15:21", ip: "10.0.1.***", region: "澳大利亚·悉尼", page: "/products/solar-panel", source: "Google", device: "Desktop", duration: "6m 05s" },
    { time: "10:12:08", ip: "192.168.3.***", region: "加拿大·多伦多", page: "/blog", source: "Twitter", device: "Mobile", duration: "2m 15s" },
    { time: "10:08:55", ip: "172.16.2.***", region: "巴西·圣保罗", page: "/faq", source: "Bing", device: "Desktop", duration: "3m 40s" },
  ];

  return (
    <div className="space-y-6">
      <Card className="">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">实时访问明细</CardTitle>
            <Badge variant="outline" className="text-xs">实时更新</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="text-left py-2 font-medium">时间</th>
                <th className="text-left py-2 font-medium">IP</th>
                <th className="text-left py-2 font-medium">地区</th>
                <th className="text-left py-2 font-medium">页面</th>
                <th className="text-left py-2 font-medium">来源</th>
                <th className="text-left py-2 font-medium">设备</th>
                <th className="text-left py-2 font-medium">停留</th>
              </tr>
            </thead>
            <tbody>
              {details.map((d, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2.5 text-slate-600">{d.time}</td>
                  <td className="py-2.5 font-mono text-xs">{d.ip}</td>
                  <td className="py-2.5">{d.region}</td>
                  <td className="py-2.5 text-blue-600">{d.page}</td>
                  <td className="py-2.5">{d.source}</td>
                  <td className="py-2.5">
                    <Badge variant="outline" className="text-xs">{d.device}</Badge>
                  </td>
                  <td className="py-2.5">{d.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== 浏览占比 =====
function BrowserShare() {
  const browserData = [
    { name: "Chrome", value: 58, color: "#2563eb", icon: "🌐" },
    { name: "Safari", value: 18, color: "#10b981", icon: "🧭" },
    { name: "Firefox", value: 10, color: "#f59e0b", icon: "🦊" },
    { name: "Edge", value: 8, color: "#8b5cf6", icon: "🔷" },
    { name: "Opera", value: 3, color: "#ef4444", icon: "🔴" },
    { name: "其他", value: 3, color: "#64748b", icon: "📱" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="">
          <CardHeader><CardTitle className="text-base">浏览器占比</CardTitle></CardHeader>
          <CardContent>
            <DeferredReportChart kind="pie" data={browserData} height={280} />
          </CardContent>
        </Card>
        <Card className="">
          <CardHeader><CardTitle className="text-base">浏览器详情</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {browserData.map((b) => (
                <div key={b.name} className="flex items-center gap-3">
                  <span className="text-lg w-8">{b.icon}</span>
                  <span className="w-16 text-sm font-medium">{b.name}</span>
                  <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${b.value}%`, backgroundColor: b.color }} />
                  </div>
                  <span className="text-sm font-semibold w-12 text-right">{b.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ===== 系统占比 =====
function SystemShare() {
  const osData = [
    { name: "Windows", value: 45, color: "#2563eb", icon: "🪟" },
    { name: "macOS", value: 25, color: "#64748b", icon: "🍎" },
    { name: "Android", value: 15, color: "#10b981", icon: "🤖" },
    { name: "iOS", value: 12, color: "#f59e0b", icon: "📱" },
    { name: "Linux", value: 3, color: "#8b5cf6", icon: "🐧" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="">
          <CardHeader><CardTitle className="text-base">操作系统分布</CardTitle></CardHeader>
          <CardContent>
            <DeferredReportChart kind="pie" data={osData} height={280} />
          </CardContent>
        </Card>
        <Card className="">
          <CardHeader><CardTitle className="text-base">系统详情</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {osData.map((o) => (
                <div key={o.name} className="flex items-center gap-3">
                  <span className="text-lg w-8">{o.icon}</span>
                  <span className="w-20 text-sm font-medium">{o.name}</span>
                  <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${o.value}%`, backgroundColor: o.color }} />
                  </div>
                  <span className="text-sm font-semibold w-12 text-right">{o.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ===== 设备占比 =====
function DeviceShare() {
  const deviceData = [
    { name: "桌面端", value: 62, color: "#2563eb" },
    { name: "移动端", value: 30, color: "#10b981" },
    { name: "平板", value: 8, color: "#f59e0b" },
  ];

  const resolutionData = [
    { resolution: "1920×1080", percentage: 35 },
    { resolution: "1366×768", percentage: 18 },
    { resolution: "390×844", percentage: 15 },
    { resolution: "1536×864", percentage: 12 },
    { resolution: "414×896", percentage: 10 },
    { resolution: "768×1024", percentage: 5 },
    { resolution: "其他", percentage: 5 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {deviceData.map((d) => (
          <Card key={d.name} className="">
            <CardContent className="p-5 text-center">
              <div className="mx-auto mb-2">
                {d.name === "桌面端" && <Monitor className="w-8 h-8 mx-auto text-blue-600" />}
                {d.name === "移动端" && <Smartphone className="w-8 h-8 mx-auto text-emerald-600" />}
                {d.name === "平板" && <Tablet className="w-8 h-8 mx-auto text-amber-600" />}
              </div>
              <div className="text-2xl font-bold">{d.value}%</div>
              <div className="text-xs text-slate-500">{d.name}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="">
        <CardHeader><CardTitle className="text-base">屏幕分辨率分布</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {resolutionData.map((r) => (
              <div key={r.resolution} className="flex items-center gap-3">
                <span className="w-28 text-sm font-mono">{r.resolution}</span>
                <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${r.percentage * 2.5}%` }} />
                </div>
                <span className="text-sm font-semibold w-10 text-right">{r.percentage}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== SEO明细 =====
function SEODetails() {
  const seoKeywords = [
    { keyword: "LED strip lights wholesale", rank: 3, volume: "12,100", clicks: 890, ctr: "7.4%", change: "+2" },
    { keyword: "solar panel manufacturer", rank: 5, volume: "8,100", clicks: 520, ctr: "6.4%", change: "+1" },
    { keyword: "industrial valve supplier", rank: 8, volume: "5,400", clicks: 280, ctr: "5.2%", change: "-1" },
    { keyword: "custom LED bulb OEM", rank: 2, volume: "3,600", clicks: 420, ctr: "11.7%", change: "+3" },
    { keyword: "ball valve price", rank: 12, volume: "9,900", clicks: 180, ctr: "1.8%", change: "+5" },
    { keyword: "aluminum profile factory", rank: 6, volume: "4,400", clicks: 310, ctr: "7.0%", change: "0" },
    { keyword: "steel pipe wholesale", rank: 15, volume: "6,600", clicks: 120, ctr: "1.8%", change: "-3" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "自然搜索流量", value: "18,200" },
          { label: "收录页面", value: "1,256" },
          { label: "排名关键词", value: "342" },
          { label: "平均排名", value: "8.5" },
        ].map((s) => (
          <Card key={s.label} className="">
            <CardContent className="p-4 text-center">
              <div className="text-xs text-slate-500">{s.label}</div>
              <div className="text-xl font-bold mt-1">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="">
        <CardHeader><CardTitle className="text-base">SEO 关键词排名明细</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="text-left py-2 font-medium">关键词</th>
                <th className="text-left py-2 font-medium">排名</th>
                <th className="text-left py-2 font-medium">搜索量</th>
                <th className="text-left py-2 font-medium">点击量</th>
                <th className="text-left py-2 font-medium">CTR</th>
                <th className="text-left py-2 font-medium">变化</th>
              </tr>
            </thead>
            <tbody>
              {seoKeywords.map((k) => (
                <tr key={k.keyword} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2.5 font-medium">{k.keyword}</td>
                  <td className="py-2.5">
                    <Badge className={`text-xs ${k.rank <= 3 ? "bg-emerald-100 text-emerald-700" : k.rank <= 10 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"}`}>
                      #{k.rank}
                    </Badge>
                  </td>
                  <td className="py-2.5">{k.volume}</td>
                  <td className="py-2.5">{k.clicks}</td>
                  <td className="py-2.5">{k.ctr}</td>
                  <td className="py-2.5">
                    <span className={`text-xs font-medium ${k.change.startsWith("+") ? "text-emerald-600" : k.change.startsWith("-") ? "text-red-500" : "text-slate-400"}`}>
                      {k.change === "0" ? "—" : k.change}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== 流量分类 =====
function TrafficClassification() {
  const classData = [
    { type: "自然搜索", visits: 18200, percentage: 42, color: "#2563eb", trend: "+12%" },
    { type: "付费搜索", visits: 5600, percentage: 13, color: "#ef4444", trend: "+28%" },
    { type: "直接访问", visits: 8800, percentage: 20, color: "#10b981", trend: "+5%" },
    { type: "社交流量", visits: 5200, percentage: 12, color: "#f59e0b", trend: "+18%" },
    { type: "引荐流量", visits: 3500, percentage: 8, color: "#8b5cf6", trend: "+8%" },
    { type: "邮件流量", visits: 2200, percentage: 5, color: "#06b6d4", trend: "+15%" },
  ];

  const chartData = classData.map((c) => ({ name: c.type, value: c.percentage, color: c.color }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="">
          <CardHeader><CardTitle className="text-base">流量分类占比</CardTitle></CardHeader>
          <CardContent>
            <DeferredReportChart kind="pie" data={chartData} height={280} />
          </CardContent>
        </Card>
        <Card className="">
          <CardHeader><CardTitle className="text-base">分类详情</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {classData.map((c) => (
                <div key={c.type} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="text-sm font-medium">{c.type}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm">{c.visits.toLocaleString()}</span>
                    <span className="text-sm font-semibold">{c.percentage}%</span>
                    <span className="text-xs text-emerald-600">{c.trend}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ===== Main Component =====
export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const siteId = searchParams.get("siteId");
  const currentTab = searchParams.get("tab") || "overview";

  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next);
  };

  return (
    <FactoryPage pageId="client-reports" template="dashboard" sourceScope="client_source" autoRegions>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">数据报表</h1>
          <p className="text-sm text-slate-500 mt-1">全方位网站流量数据分析与洞察</p>
        </div>
        <Button variant="outline"><Download className="w-4 h-4 mr-2" />导出报表</Button>
      </div>

      <SiteContextCard siteId={siteId} />

      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList data-client-project-subnav className="bg-slate-100 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview">流量概况</TabsTrigger>
          <TabsTrigger value="source">流量来源</TabsTrigger>
          <TabsTrigger value="region">地域分布</TabsTrigger>
          <TabsTrigger value="pages">受访页面</TabsTrigger>
          <TabsTrigger value="daily">天访问量</TabsTrigger>
          <TabsTrigger value="time">访客时间</TabsTrigger>
          <TabsTrigger value="details">访问明细</TabsTrigger>
          <TabsTrigger value="browser">浏览占比</TabsTrigger>
          <TabsTrigger value="system">系统占比</TabsTrigger>
          <TabsTrigger value="device">设备占比</TabsTrigger>
          <TabsTrigger value="seo">SEO明细</TabsTrigger>
          <TabsTrigger value="classification">流量分类</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><TrafficOverview /></TabsContent>
        <TabsContent value="source"><TrafficSource /></TabsContent>
        <TabsContent value="region"><RegionDistribution /></TabsContent>
        <TabsContent value="pages"><VisitedPages /></TabsContent>
        <TabsContent value="daily"><DailyVisits /></TabsContent>
        <TabsContent value="time"><VisitorTime /></TabsContent>
        <TabsContent value="details"><VisitDetails /></TabsContent>
        <TabsContent value="browser"><BrowserShare /></TabsContent>
        <TabsContent value="system"><SystemShare /></TabsContent>
        <TabsContent value="device"><DeviceShare /></TabsContent>
        <TabsContent value="seo"><SEODetails /></TabsContent>
        <TabsContent value="classification"><TrafficClassification /></TabsContent>
      </Tabs>
      </div>
    </FactoryPage>
  );
}
