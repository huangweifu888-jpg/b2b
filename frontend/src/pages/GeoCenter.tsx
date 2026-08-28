import { useSearchParams } from "react-router-dom";
import { ArrowUpRight, Calendar, ExternalLink, FileText, Newspaper, Plus, Search, Sparkles } from "lucide-react";

import SiteContextCard from "@/components/SiteContextCard";
import { GeoAeoGovernance } from "@/components/GeoAeoGovernance";
import { FactLibraryGovernance } from "@/components/FactLibraryGovernance";
import { CitationMonitoringGovernance } from "@/components/CitationMonitoringGovernance";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FactoryPage } from "@/page-factory/FactoryPage";

const keywordRows = [
  { keyword: "best LED strip lights 2025", volume: "18,100", difficulty: 42, status: "已优化", llmRank: "Top 3", platform: "ChatGPT" },
  { keyword: "solar panel manufacturer China", volume: "12,400", difficulty: 55, status: "优化中", llmRank: "Top 5", platform: "Gemini" },
  { keyword: "industrial valve supplier", volume: "8,200", difficulty: 38, status: "已优化", llmRank: "Top 3", platform: "Claude" },
  { keyword: "custom OEM LED bulb factory", volume: "5,600", difficulty: 30, status: "待优化", llmRank: "未收录", platform: "-" },
];

const articleCards = [
  { title: "产品评测文章", desc: "输出更像买家决策依据的产品评测内容。", count: "已生成 28 篇" },
  { title: "行业解决方案", desc: "围绕场景和行业痛点组织解决方案内容。", count: "已生成 15 篇" },
  { title: "技术指南", desc: "沉淀工艺、参数、安装和选型指南。", count: "已生成 22 篇" },
];

const writingRecords = [
  { title: "Top 10 LED Strip Lights for Commercial Use in 2026", keyword: "LED strip lights", words: 2450, platform: "ChatGPT", status: "已发布", date: "2026-06-21" },
  { title: "How to Choose the Right Solar Panel Manufacturer", keyword: "solar panel manufacturer", words: 1980, platform: "Gemini", status: "已发布", date: "2026-06-20" },
  { title: "Industrial Ball Valve Buying Guide", keyword: "ball valve supplier", words: 2200, platform: "Claude", status: "审核中", date: "2026-06-19" },
];

const schedules = [
  { title: "LED 照明行业趋势分析", date: "2026-06-25", platform: "权威媒体", media: "TechCrunch", status: "待发布" },
  { title: "太阳能板选购指南", date: "2026-06-27", platform: "行业博客", media: "SolarReviews", status: "已排期" },
  { title: "工业阀门质量标准", date: "2026-06-29", platform: "权威媒体", media: "IndustryWeek", status: "待审核" },
];

const publishHistory = [
  { title: "Complete Guide to LED Lighting Solutions", media: "TechCrunch", date: "2026-06-18", views: "12,500", citations: 8, status: "已收录" },
  { title: "Solar Energy Trends in Manufacturing", media: "Forbes", date: "2026-06-16", views: "8,900", citations: 5, status: "已收录" },
  { title: "Smart Factory Equipment Guide", media: "Manufacturing.net", date: "2026-06-14", views: "5,600", citations: 4, status: "待收录" },
];

const llmReports = [
  { model: "ChatGPT", total: 156, top3: 34, top5: 52, top10: 78, trend: "+18%" },
  { model: "Gemini", total: 128, top3: 28, top5: 45, top10: 68, trend: "+22%" },
  { model: "Claude", total: 98, top3: 22, top5: 38, top10: 55, trend: "+15%" },
  { model: "Perplexity", total: 112, top3: 30, top5: 48, top10: 72, trend: "+28%" },
];

const authorityMedia = [
  { name: "Forbes", domain: "forbes.com", da: 95, type: "商业", articles: 8, status: "已合作" },
  { name: "IndustryWeek", domain: "industryweek.com", da: 78, type: "工业", articles: 15, status: "已合作" },
  { name: "Manufacturing.net", domain: "manufacturing.net", da: 72, type: "制造", articles: 10, status: "已合作" },
  { name: "GreenBiz", domain: "greenbiz.com", da: 76, type: "环保", articles: 6, status: "洽谈中" },
];

function statusTone(status: string) {
  if (status.includes("已")) return "bg-emerald-100 text-emerald-700";
  if (status.includes("中")) return "bg-blue-100 text-blue-700";
  return "bg-amber-100 text-amber-700";
}

function GeoKeywords() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative max-w-md flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input placeholder="搜索优化词" className="pl-9" /></div>
        <Button className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-2 h-4 w-4" />添加优化词</Button>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[{ label: "总优化词", value: "156" }, { label: "已收录", value: "89" }, { label: "Top 3 排名", value: "34" }, { label: "待优化", value: "42" }].map((item) => (
          <Card key={item.label} className=""><CardContent className="p-4"><div className="text-xs text-slate-500">{item.label}</div><div className="mt-1 text-xl font-bold">{item.value}</div></CardContent></Card>
        ))}
      </div>
      <Card className="">
        <CardHeader><CardTitle className="text-base">优化词列表</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-xs text-slate-500"><th className="py-2 text-left font-medium">关键词</th><th className="py-2 text-left font-medium">搜索量</th><th className="py-2 text-left font-medium">难度</th><th className="py-2 text-left font-medium">状态</th><th className="py-2 text-left font-medium">LLM 排名</th><th className="py-2 text-left font-medium">平台</th></tr></thead>
            <tbody>
              {keywordRows.map((row) => (
                <tr key={row.keyword} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2.5 font-medium">{row.keyword}</td>
                  <td className="py-2.5">{row.volume}</td>
                  <td className="py-2.5"><div className="flex items-center gap-2"><div className="h-2 w-16 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${row.difficulty > 50 ? "bg-red-400" : row.difficulty > 35 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${row.difficulty}%` }} /></div><span className="text-xs">{row.difficulty}</span></div></td>
                  <td className="py-2.5"><Badge className={`text-xs ${statusTone(row.status)}`}>{row.status}</Badge></td>
                  <td className="py-2.5"><Badge variant="outline" className="text-xs">{row.llmRank}</Badge></td>
                  <td className="py-2.5 text-slate-600">{row.platform}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function ArticleWriting() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><p className="text-sm text-slate-500">围绕当前计划的产品与市场，生成更容易被大模型引用的内容资产。</p><Button className="bg-blue-600 hover:bg-blue-700"><Sparkles className="mr-2 h-4 w-4" />AI 创作文章</Button></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {articleCards.map((card) => (
          <Card key={card.title} className="cursor-pointer transition-colors hover:border-blue-300"><CardContent className="p-5"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-50 to-sky-50"><FileText className="h-5 w-5 text-blue-600" /></div><h3 className="text-sm font-semibold">{card.title}</h3><p className="mt-1 text-xs text-slate-500">{card.desc}</p><div className="mt-2 text-xs text-blue-600">{card.count}</div></CardContent></Card>
        ))}
      </div>
      <Card className=""><CardHeader><CardTitle className="text-base">创作配置</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Input placeholder="目标关键词" /><Input placeholder="文章类型：评测 / 解决方案 / 指南" /><Input placeholder="目标平台：ChatGPT / Gemini / Claude / Perplexity" /><Input placeholder="建议字数：1500 - 3000" /></div><Button className="w-full bg-blue-600 hover:bg-blue-700"><Sparkles className="mr-2 h-4 w-4" />开始 AI 创作</Button></CardContent></Card>
    </div>
  );
}

function WritingRecords() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[{ label: "总创作数", value: "65" }, { label: "已发布", value: "48" }, { label: "审核中", value: "8" }, { label: "草稿", value: "9" }].map((item) => (<Card key={item.label} className=""><CardContent className="p-4 text-center"><div className="text-xs text-slate-500">{item.label}</div><div className="mt-1 text-xl font-bold">{item.value}</div></CardContent></Card>))}</div>
      <Card className=""><CardHeader><CardTitle className="text-base">创作记录</CardTitle></CardHeader><CardContent><table className="w-full text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="py-2 text-left font-medium">文章标题</th><th className="py-2 text-left font-medium">关键词</th><th className="py-2 text-left font-medium">字数</th><th className="py-2 text-left font-medium">目标平台</th><th className="py-2 text-left font-medium">状态</th><th className="py-2 text-left font-medium">日期</th></tr></thead><tbody>{writingRecords.map((row) => (<tr key={row.title} className="border-b border-slate-50 hover:bg-slate-50"><td className="max-w-[260px] truncate py-2.5 font-medium">{row.title}</td><td className="py-2.5 text-slate-600">{row.keyword}</td><td className="py-2.5">{row.words.toLocaleString()}</td><td className="py-2.5">{row.platform}</td><td className="py-2.5"><Badge className={`text-xs ${statusTone(row.status)}`}>{row.status}</Badge></td><td className="py-2.5 text-slate-500">{row.date}</td></tr>))}</tbody></table></CardContent></Card>
    </div>
  );
}

function PublishSchedule() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><p className="text-sm text-slate-500">按计划管理内容发稿节奏，逐步沉淀品牌在行业媒体的可见度。</p><Button className="bg-blue-600 hover:bg-blue-700"><Calendar className="mr-2 h-4 w-4" />新建发布计划</Button></div>
      <Card className=""><CardHeader><CardTitle className="text-base">发布排期</CardTitle></CardHeader><CardContent><table className="w-full text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="py-2 text-left font-medium">文章标题</th><th className="py-2 text-left font-medium">目标日期</th><th className="py-2 text-left font-medium">发布平台</th><th className="py-2 text-left font-medium">目标媒体</th><th className="py-2 text-left font-medium">状态</th></tr></thead><tbody>{schedules.map((row) => (<tr key={row.title} className="border-b border-slate-50 hover:bg-slate-50"><td className="py-2.5 font-medium">{row.title}</td><td className="py-2.5 text-slate-600">{row.date}</td><td className="py-2.5">{row.platform}</td><td className="py-2.5"><Badge variant="outline" className="text-xs">{row.media}</Badge></td><td className="py-2.5"><Badge className={`text-xs ${statusTone(row.status)}`}>{row.status}</Badge></td></tr>))}</tbody></table></CardContent></Card>
    </div>
  );
}

function PublishHistory() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[{ label: "总发布数", value: "48" }, { label: "已收录", value: "36" }, { label: "总浏览量", value: "128K" }, { label: "总引用数", value: "89" }].map((item) => (<Card key={item.label} className=""><CardContent className="p-4 text-center"><div className="text-xs text-slate-500">{item.label}</div><div className="mt-1 text-xl font-bold">{item.value}</div></CardContent></Card>))}</div>
      <Card className=""><CardHeader><CardTitle className="text-base">发布记录</CardTitle></CardHeader><CardContent><table className="w-full text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="py-2 text-left font-medium">文章标题</th><th className="py-2 text-left font-medium">发布媒体</th><th className="py-2 text-left font-medium">发布日期</th><th className="py-2 text-left font-medium">浏览量</th><th className="py-2 text-left font-medium">引用数</th><th className="py-2 text-left font-medium">状态</th></tr></thead><tbody>{publishHistory.map((row) => (<tr key={row.title} className="border-b border-slate-50 hover:bg-slate-50"><td className="max-w-[260px] truncate py-2.5 font-medium">{row.title}</td><td className="py-2.5"><Badge variant="outline" className="text-xs">{row.media}</Badge></td><td className="py-2.5 text-slate-500">{row.date}</td><td className="py-2.5">{row.views}</td><td className="py-2.5">{row.citations}</td><td className="py-2.5"><Badge className={`text-xs ${statusTone(row.status)}`}>{row.status}</Badge></td></tr>))}</tbody></table></CardContent></Card>
    </div>
  );
}

function LLMReports() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[{ label: "总被引用次数", value: "559" }, { label: "Top 3 关键词", value: "126" }, { label: "覆盖大模型", value: "5" }, { label: "月增长率", value: "+19%" }].map((item) => (<Card key={item.label} className=""><CardContent className="p-4 text-center"><div className="text-xs text-slate-500">{item.label}</div><div className="mt-1 text-xl font-bold">{item.value}</div></CardContent></Card>))}</div>
      <Card className=""><CardHeader><CardTitle className="text-base">大模型报表</CardTitle></CardHeader><CardContent><table className="w-full text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="py-2 text-left font-medium">模型</th><th className="py-2 text-left font-medium">总提及</th><th className="py-2 text-left font-medium">Top 3</th><th className="py-2 text-left font-medium">Top 5</th><th className="py-2 text-left font-medium">Top 10</th><th className="py-2 text-left font-medium">趋势</th></tr></thead><tbody>{llmReports.map((row) => (<tr key={row.model} className="border-b border-slate-50 hover:bg-slate-50"><td className="py-2.5 font-medium">{row.model}</td><td className="py-2.5">{row.total}</td><td className="py-2.5">{row.top3}</td><td className="py-2.5">{row.top5}</td><td className="py-2.5">{row.top10}</td><td className="py-2.5 text-emerald-600"><span className="flex items-center gap-1"><ArrowUpRight className="h-3 w-3" />{row.trend}</span></td></tr>))}</tbody></table></CardContent></Card>
    </div>
  );
}

function AuthorityMedia() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><p className="text-sm text-slate-500">维护权威媒体资源，提升内容在行业与 AI 搜索中的可信度。</p><Button className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-2 h-4 w-4" />添加媒体</Button></div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[{ label: "合作媒体", value: "6" }, { label: "洽谈中", value: "2" }, { label: "已发布文章", value: "71" }, { label: "平均 DA", value: "78" }].map((item) => (<Card key={item.label} className=""><CardContent className="p-4 text-center"><div className="text-xs text-slate-500">{item.label}</div><div className="mt-1 text-xl font-bold">{item.value}</div></CardContent></Card>))}</div>
      <Card className=""><CardHeader><CardTitle className="text-base">媒体资源列表</CardTitle></CardHeader><CardContent><table className="w-full text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="py-2 text-left font-medium">媒体名称</th><th className="py-2 text-left font-medium">域名</th><th className="py-2 text-left font-medium">DA 权重</th><th className="py-2 text-left font-medium">类型</th><th className="py-2 text-left font-medium">已发文章</th><th className="py-2 text-left font-medium">状态</th><th className="py-2 text-left font-medium">操作</th></tr></thead><tbody>{authorityMedia.map((row) => (<tr key={row.name} className="border-b border-slate-50 hover:bg-slate-50"><td className="py-2.5 font-medium"><div className="flex items-center gap-2"><Newspaper className="h-4 w-4 text-slate-400" />{row.name}</div></td><td className="py-2.5 text-xs text-blue-600">{row.domain}</td><td className="py-2.5"><Badge variant="outline" className="text-xs">DA {row.da}</Badge></td><td className="py-2.5">{row.type}</td><td className="py-2.5">{row.articles}</td><td className="py-2.5"><Badge className={`text-xs ${statusTone(row.status)}`}>{row.status}</Badge></td><td className="py-2.5"><Button variant="ghost" size="sm" className="h-7 text-xs"><ExternalLink className="mr-1 h-3 w-3" />访问</Button></td></tr>))}</tbody></table></CardContent></Card>
    </div>
  );
}

export default function GeoCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "keywords";
  const siteId = searchParams.get("siteId");

  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next);
  };

  return (
    <FactoryPage pageId="client-geo-center" template="workflow" sourceScope="client_source" autoRegions>
      <div className="space-y-6">
      <SiteContextCard siteId={siteId} />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">GEO 中心</h1>
        <p className="mt-1 text-sm text-slate-500">围绕生成式搜索的可见度，管理优化词、内容资产、媒体发布和大模型引用表现。</p>
      </div>
      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList data-client-project-subnav className="flex h-auto flex-wrap gap-1 bg-slate-100 p-1">
          <TabsTrigger value="keywords">优化词</TabsTrigger>
          <TabsTrigger value="governance">受控答案</TabsTrigger>
          <TabsTrigger value="writing">文章创作</TabsTrigger>
          <TabsTrigger value="records">创作记录</TabsTrigger>
          <TabsTrigger value="schedule">发布计划</TabsTrigger>
          <TabsTrigger value="publish-history">发布记录</TabsTrigger>
          <TabsTrigger value="llm-reports">大模型报表</TabsTrigger>
          <TabsTrigger value="authority-media">权威媒体</TabsTrigger>
        </TabsList>
        <TabsContent value="keywords" className="mt-4"><GeoKeywords /></TabsContent>
        <TabsContent value="governance" className="mt-4"><GeoAeoGovernance /></TabsContent>
        <TabsContent value="writing" className="mt-4"><div className="space-y-4"><FactLibraryGovernance /><ArticleWriting /></div></TabsContent>
        <TabsContent value="records" className="mt-4"><WritingRecords /></TabsContent>
        <TabsContent value="schedule" className="mt-4"><PublishSchedule /></TabsContent>
        <TabsContent value="publish-history" className="mt-4"><PublishHistory /></TabsContent>
        <TabsContent value="llm-reports" className="mt-4"><div className="space-y-4"><CitationMonitoringGovernance /><LLMReports /></div></TabsContent>
        <TabsContent value="authority-media" className="mt-4"><AuthorityMedia /></TabsContent>
      </Tabs>
      </div>
    </FactoryPage>
  );
}
