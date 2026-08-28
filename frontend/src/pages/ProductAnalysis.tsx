import { useSearchParams } from "react-router-dom";
import { lazy, Suspense } from "react";
import { ArrowUpRight, BarChart3, ExternalLink, Globe, Link2, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";

import { Tabs, TabsContent } from "@/components/ui/tabs";

import { openUrlInExternalBrowser } from "@/lib/browser-utils";
import { ProductIntelligenceWorkspace } from "@/components/product-intelligence/ProductIntelligenceWorkspace";
import { SharedPageWorkspace } from "@/components/SharedPageWorkspace";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { formatDisplayOrdinal } from "@/lib/display-number-contract";

const MarketRadarWorkspace = lazy(async () => ({
  default: (await import("@/components/market-radar/MarketRadarWorkspace")).MarketRadarWorkspace,
}));
const CompetitivePricingWorkspace = lazy(async () => ({
  default: (await import("@/components/competitive-pricing/CompetitivePricingWorkspace")).CompetitivePricingWorkspace,
}));

function DeferredAnalysisFallback() {
  return <p role="status" className="p-4 text-sm opacity-70">正在加载当前分析工具…</p>;
}

const PRODUCT_ANALYSIS_TABS = [
  { key: "keyword-planner", label: "兴趣搜索", description: "汇集产品机会、需求信号与当前版本可用证据。" },
  { key: "trends", label: "趋势分析", description: "观察公开趋势话题与区域增长方向。" },
  { key: "data-studio", label: "数据洞察", description: "集中查看报告、数据源和业务分析入口。" },
  { key: "market-finder", label: "全球商机", description: "按国家、产品和渠道固化市场进入证据。" },
  { key: "global-market", label: "市场调查", description: "对比市场报价、竞争信号与价格决策证据。" },
] as const;

const trendTopics = [
  { topic: "AI Powered Devices", region: "全球", growth: "+450%", period: "过去 12 个月", category: "科技" },
  { topic: "Sustainable Packaging", region: "欧洲", growth: "+180%", period: "过去 6 个月", category: "环保" },
  { topic: "Smart Home Security", region: "北美", growth: "+120%", period: "过去 12 个月", category: "家居" },
  { topic: "Electric Scooter Parts", region: "东南亚", growth: "+95%", period: "过去 3 个月", category: "出行" },
];

const reports = [
  { name: "产品销售分析报告", type: "销售", updated: "2 小时前", views: 128 },
  { name: "关键词效果跟踪", type: "SEO", updated: "1 天前", views: 89 },
  { name: "广告投放 ROI 分析", type: "广告", updated: "3 小时前", views: 256 },
  { name: "客户行为漏斗", type: "用户", updated: "5 小时前", views: 67 },
];

function openExternalTool(url: string) {
  void openUrlInExternalBrowser(url);
}

function levelBadge(level: string) {
  if (level === "高") return "destructive" as const;
  if (level === "中") return "default" as const;
  return "secondary" as const;
}

function TrendsAnalysis() {
  return (
    <div className="space-y-6">
      <Card data-page-layout-card data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片">
        <CardHeader className="pb-3">
          <div data-page-factory-responsive-row className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Google Trends</CardTitle>
              <Badge variant="outline" className="text-xs">
                <a href="https://www.google.com/trends/" target="_blank" rel="noreferrer" className="flex items-center gap-1">
                  官方入口 <ExternalLink className="h-3 w-3" />
                </a>
              </Badge>
            </div>
            <Button size="sm" variant="outline" onClick={() => openExternalTool("https://www.google.com/trends/")}>
              <Link2 className="mr-1 h-3.5 w-3.5" />直接使用
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex items-center gap-2">
            <Input placeholder="搜索趋势话题" className="flex-1" />
            <Button className="bg-blue-600 hover:bg-blue-700"><TrendingUp className="mr-1 h-4 w-4" />查看趋势</Button>
          </div>
          <div className="space-y-3">
            {trendTopics.map((item, index) => (
              <div key={item.topic} data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" className="flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-600">{formatDisplayOrdinal(index + 1)}</div>
                  <div>
                    <div className="text-sm font-medium">{item.topic}</div>
                    <div className="text-xs text-slate-500">{item.region} | {item.period}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">{item.category}</Badge>
                  <span className="flex items-center text-sm font-semibold text-emerald-600"><ArrowUpRight className="h-3.5 w-3.5" />{item.growth}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DataStudio() {
  return (
    <div className="space-y-6">
      <Card data-page-layout-card data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片">
        <CardHeader className="pb-3">
          <div data-page-factory-responsive-row className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Looker Studio</CardTitle>
              <Badge variant="outline" className="text-xs">
                <a href="https://marketingplatform.google.com/intl/zh-CN_cn/about/data-studio/" target="_blank" rel="noreferrer" className="flex items-center gap-1">
                  官方入口 <ExternalLink className="h-3 w-3" />
                </a>
              </Badge>
            </div>
            <Button size="sm" variant="outline" onClick={() => openExternalTool("https://marketingplatform.google.com/intl/zh-CN_cn/about/data-studio/")}>
              <Link2 className="mr-1 h-3.5 w-3.5" />直接使用
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" className="bg-blue-50/50"><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-blue-700">12</div><div className="text-xs text-slate-600">活跃报告</div></CardContent></Card>
            <Card data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" className="bg-emerald-50/50"><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-emerald-700">585</div><div className="text-xs text-slate-600">总浏览量</div></CardContent></Card>
            <Card data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" className="bg-amber-50/50"><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-amber-700">8</div><div className="text-xs text-slate-600">数据源</div></CardContent></Card>
          </div>
          <div className="space-y-2">
            {reports.map((report) => (
              <div key={report.name} className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  <div><div className="text-sm font-medium">{report.name}</div><div className="text-xs text-slate-500">更新于 {report.updated}</div></div>
                </div>
                <div className="flex items-center gap-3"><Badge variant="outline" className="text-xs">{report.type}</Badge><span className="text-xs text-slate-400">{report.views} 次查看</span></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProductAnalysis() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const currentTab = requestedTab || "keyword-planner";
  const factoryContract = currentTab !== "keyword-planner"
    ? currentTab === "trends"
      ? { pageId: "product-analysis-trends", template: "dashboard" as const }
      : currentTab === "data-studio"
        ? { pageId: "product-analysis-data-studio", template: "dashboard" as const }
        : currentTab === "market-finder"
          ? { pageId: "product-analysis-market-finder", template: "dashboard" as const }
          : { pageId: "product-analysis-global-market", template: "dashboard" as const }
    : requestedTab === "keyword-planner"
      ? { pageId: "product-analysis-interest-search", template: "workflow" as const }
      : { pageId: "client-product-analysis", template: "workflow" as const };
  const activeTab = PRODUCT_ANALYSIS_TABS.find((item) => item.key === currentTab) || PRODUCT_ANALYSIS_TABS[0];
  const setTab = (nextTab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", nextTab);
    setSearchParams(next);
  };
  const pageContent = (
    <Tabs data-page-analysis-tabs value={currentTab}>
      <TabsContent value="keyword-planner" className="mt-0"><ProductIntelligenceWorkspace /></TabsContent>
      <TabsContent value="trends" className="mt-0"><TrendsAnalysis /></TabsContent>
      <TabsContent value="data-studio" className="mt-0"><DataStudio /></TabsContent>
      <TabsContent value="market-finder" className="mt-0"><Suspense fallback={<DeferredAnalysisFallback />}><MarketRadarWorkspace /></Suspense></TabsContent>
      <TabsContent value="global-market" className="mt-0"><Suspense fallback={<DeferredAnalysisFallback />}><CompetitivePricingWorkspace /></Suspense></TabsContent>
    </Tabs>
  );

  return (
    <FactoryPage
      pageId={factoryContract.pageId}
      template={factoryContract.template}
      sourceScope="client_source"
      scrollContract="table-inner-60"
      asChild
      frameOwner="existing-workspace"
    >
      <SharedPageWorkspace data-product-analysis-workspace className="min-h-0">
        <section
          data-page-title="product-analysis"
          data-responsive-shared-surface="title-1"
          data-responsive-shared-surface-plugin="large-band-density"
          data-responsive-live-surface="title-1"
          data-responsive-live-surface-source="desktop"
          data-page-factory-region="title-1"
          data-shared-layout-section="title"
          data-development-standard-frame-region="title"
          data-development-standard-frame-label="标题"
          className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div data-page-title-content className="min-w-0">
            <h1 data-shared-title-heading className="flex items-center gap-2 text-2xl font-bold text-slate-900"><BarChart3 className="h-6 w-6 text-blue-600" />产品分析 → {activeTab.label}</h1>
            <p data-shared-title-description className="mt-1 text-sm text-slate-500">{activeTab.description}</p>
          </div>
        </section>
        <section
          data-page-table-shell
          data-page-factory-region="table-shell"
          data-shared-layout-section="table-shell"
          data-development-standard-frame-region="table-shell"
          data-development-standard-frame-label="表内"
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          <nav
            role="tablist"
            aria-label="产品分析页面"
            data-page-table-header
            data-page-factory-region="table-header"
            data-shared-layout-section="header"
            data-development-standard-frame-region="table-header"
            data-development-standard-frame-label="表头"
            className="flex items-center gap-1 overflow-x-auto p-1"
          >
            {PRODUCT_ANALYSIS_TABS.map((item) => {
              const active = item.key === currentTab;
              return <button key={item.key} type="button" role="tab" aria-selected={active} data-state={active ? "active" : "inactive"} onClick={() => setTab(item.key)} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${active ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}>{item.label}</button>;
            })}
          </nav>
          <section
            data-page-factory-region="content"
            data-page-list
            data-page-list-scroll-owner
            data-shared-scroll-contract="table-inner-60"
            data-development-standard-frame-region="content"
            data-development-standard-frame-label="内容"
            className="min-w-0 space-y-6 p-4 sm:p-5 lg:p-6"
          >
            <span hidden aria-hidden="true" data-page-factory-region="scrollbar" data-page-factory-scroll-owner-region="content" />
            <header
              data-page-factory-region="title-2"
              data-responsive-shared-surface="title-2"
              data-development-standard-frame-region="title-2"
              data-development-standard-frame-label="标题2"
              className="rounded-xl border border-current/15 px-4 py-3"
            >
              <h2 className="text-lg font-semibold">{activeTab.label}</h2>
              <p className="mt-1 text-sm opacity-70">{activeTab.description}</p>
            </header>
            {pageContent}
          </section>
        </section>
      </SharedPageWorkspace>
    </FactoryPage>
  );
}
