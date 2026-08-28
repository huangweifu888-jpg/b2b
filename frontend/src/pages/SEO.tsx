import { Suspense, lazy } from "react";

import { useSearchParams } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Badge } from "@/components/ui/badge";

import { Progress } from "@/components/ui/progress";

import { Label } from "@/components/ui/label";

import { TrendingUp, TrendingDown, Plus, Search, AlertCircle, CheckCircle2, XCircle, Link as LinkIcon } from "lucide-react";

import { loadClientLiveSnapshot, deriveClientKeywords } from "@/lib/client-live-data";

import AIGenerateButton from "@/components/AIGenerateButton";

import SiteContextCard from "@/components/SiteContextCard";
import { TechnicalSeoGovernance } from "@/components/TechnicalSeoGovernance";
import { KeywordMapGovernance } from "@/components/KeywordMapGovernance";
import { OnPageSeoGovernance } from "@/components/OnPageSeoGovernance";
import { SearchShareGovernance } from "@/components/SearchShareGovernance";
import { ReputationGovernance } from "@/components/ReputationGovernance";

import { useEffect, useMemo, useState } from "react";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { usePostPaintReady } from "@/lib/post-paint-lazy";

const SeoRankingChart = lazy(() => import("@/components/charts/SeoRankingChart"));

function SeoRankingChartPlaceholder() {
  return <div aria-hidden="true" className="min-h-[280px] rounded-lg border border-slate-200 bg-slate-50" />;
}

export default function SEOPage() {
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof loadClientLiveSnapshot>> | null>(null);
  const rankingChartReady = usePostPaintReady(700);
  const [params, setParams] = useSearchParams();
  const siteId = params.get("siteId");
  const tab = params.get("tab") || "keywords";

  const updateTab = (value: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", value);
    setParams(next);
  };

  useEffect(() => {
    let mounted = true;
    void loadClientLiveSnapshot().then((next) => {
      if (mounted) setSnapshot(next);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const keywords = useMemo(() => (snapshot ? deriveClientKeywords(snapshot) : []), [snapshot]);

  const tabs = [
    { v: "keywords", l: "关键词" },
    { v: "ranking", l: "排名追踪" },
    { v: "articles", l: "SEO 文章" },
    { v: "audit", l: "站点审计" },
    { v: "meta", l: "Meta 管理" },
    { v: "backlinks", l: "外链分析" },
    { v: "internal", l: "内链规则" },
    { v: "deadlinks", l: "死链检测" },
    { v: "density", l: "关键词密度" },
    { v: "tdk", l: "TDK 模板" },
    { v: "mining", l: "关键词挖掘" },
  ];

  return (
    <FactoryPage pageId="client-seo" template="workflow" sourceScope="client_source" autoRegions>
      <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">SEO 中心</h1>
        <p className="text-sm text-slate-500 mt-1">覆盖关键词、排名、内容与站点优化的完整工具集</p>
      </div>

      <SiteContextCard siteId={siteId} />

      <Tabs value={tab} onValueChange={updateTab}>
        <TabsList data-client-project-subnav className="flex flex-wrap h-auto">
          {tabs.map((item) => (
            <TabsTrigger key={item.v} value={item.v}>{item.l}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="keywords" className="mt-4">
          <KeywordMapGovernance />
          <Card className="">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <Input placeholder="搜索关键词..." className="max-w-xs" />
                <Button className="bg-blue-600"><Plus className="w-3.5 h-3.5 mr-1" />添加关键词</Button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="text-left font-medium py-2 px-2">关键词</th>
                    <th className="text-left font-medium py-2 px-2">搜索量</th>
                    <th className="text-left font-medium py-2 px-2">难度</th>
                    <th className="text-left font-medium py-2 px-2">当前排名</th>
                    <th className="text-left font-medium py-2 px-2">变化</th>
                    <th className="text-left font-medium py-2 px-2">CPC</th>
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((keyword) => (
                    <tr key={keyword.kw} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-2 font-medium">{keyword.kw}</td>
                      <td className="py-3 px-2">{keyword.volume.toLocaleString()}</td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <Progress value={keyword.difficulty} className="w-16 h-1.5" />
                          <span className="text-xs">{keyword.difficulty}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">#{keyword.rank}</Badge>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`inline-flex items-center gap-0.5 text-xs ${keyword.change > 0 ? "text-emerald-600" : keyword.change < 0 ? "text-red-500" : "text-slate-500"}`}>
                          {keyword.change > 0 ? <TrendingUp className="w-3 h-3" /> : keyword.change < 0 ? <TrendingDown className="w-3 h-3" /> : "-"}
                          {keyword.change !== 0 ? Math.abs(keyword.change) : ""}
                        </span>
                      </td>
                      <td className="py-3 px-2">{keyword.cpc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ranking" className="mt-4 space-y-4">
          <SearchShareGovernance />
          <div data-seo-ranking-chart-post-paint>
            {rankingChartReady ? (
              <Suspense fallback={<SeoRankingChartPlaceholder />}>
                <SeoRankingChart />
              </Suspense>
            ) : (
              <SeoRankingChartPlaceholder />
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { l: "TOP3 关键词", v: 48 },
              { l: "TOP10 关键词", v: 326 },
              { l: "TOP100 关键词", v: 1240 },
            ].map((stat) => (
              <Card key={stat.l} className="">
                <CardContent className="p-5">
                  <div className="text-xs text-slate-500">{stat.l}</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">{stat.v}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="articles" className="mt-4">
          <Card className="">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-semibold">AI 生成 SEO 文章</h3>
                <AIGenerateButton
                  label="AI 生成文章"
                  systemPrompt="你是一名专业的 B2B 外贸行业 SEO 内容写手。请根据用户提供的关键词和主题，输出适合外贸官网的文章大纲或初稿。"
                  placeholder="输入目标关键词和文章主题，例如：led bulb wholesale guide"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  variant="default"
                />
              </div>
              {[
                { t: "Complete Guide to LED Bulb Wholesale in 2026", kw: "led bulb wholesale", words: 2480, status: "published" },
                { t: "How to Source Solar Panels from China: A Buyer's Guide", kw: "solar panel manufacturer", words: 3120, status: "published" },
                { t: "Industrial Ball Valve Selection for Oil & Gas", kw: "industrial ball valve supplier", words: 1890, status: "draft" },
                { t: "Aluminum Profile 6063-T5 Specifications Explained", kw: "aluminum profile china", words: 2240, status: "published" },
              ].map((article) => (
                <div key={article.t} className="flex items-center justify-between p-3 border border-slate-200 rounded-md gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{article.t}</div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">#{article.kw}</Badge>
                      {article.words} 字
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {article.status === "published" ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">已发布</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">草稿</Badge>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-xs">编辑</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4 space-y-4">
          <TechnicalSeoGovernance />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { l: "SEO 总分", v: "86", color: "text-emerald-600" },
              { l: "通过检查", v: "42", color: "text-emerald-600" },
              { l: "警告项", v: "8", color: "text-amber-600" },
              { l: "严重问题", v: "2", color: "text-red-500" },
            ].map((item) => (
              <Card key={item.l} className="">
                <CardContent className="p-5">
                  <div className="text-xs text-slate-500">{item.l}</div>
                  <div className={`text-2xl font-bold mt-1 ${item.color}`}>{item.v}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="">
            <CardContent className="p-4 space-y-2">
              {[
                { s: "ok", t: "所有页面均已设置 title 标签" },
                { s: "ok", t: "robots.txt 配置正确" },
                { s: "ok", t: "Sitemap 已提交到 Google Search Console" },
                { s: "warn", t: "8 个页面的 meta description 长度超过 160 字符" },
                { s: "error", t: "2 个页面返回 404 状态码" },
                { s: "warn", t: "首页加载时间为 3.2 秒，建议优化到 2 秒内" },
              ].map((row, index) => (
                <div key={index} className="flex items-center gap-3 p-2 border-b border-slate-100 last:border-0">
                  {row.s === "ok" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {row.s === "warn" && <AlertCircle className="w-4 h-4 text-amber-500" />}
                  {row.s === "error" && <XCircle className="w-4 h-4 text-red-500" />}
                  <span className="text-sm">{row.t}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meta" className="mt-4">
          <OnPageSeoGovernance />
          <Card className="">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-semibold">页面 Meta 标签管理</h3>
                <AIGenerateButton
                  label="AI 优化 Meta"
                  systemPrompt="你是一名 SEO 专家。请根据页面 URL 和当前 Meta 信息，给出适合 B2B 外贸网站的优化建议。"
                  placeholder="输入页面 URL 和当前 Meta 信息，我来帮你优化..."
                />
              </div>
              {[
                { url: "/", title: "LED Lighting Manufacturer | UTrade", desc: "Premium LED solutions for global markets...", score: 92 },
                { url: "/products", title: "LED Products - UTrade", desc: "Wholesale LED bulbs, panels, street lights...", score: 85 },
                { url: "/about", title: "About Us | UTrade", desc: "15+ years of LED manufacturing experience...", score: 78 },
                { url: "/contact", title: "Contact UTrade Lighting", desc: "Get in touch for quotes and samples", score: 70 },
              ].map((page) => (
                <div key={page.url} className="p-3 border border-slate-200 rounded-md">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-blue-600">{page.url}</span>
                    <Badge className={page.score > 85 ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}>
                      {page.score}/100
                    </Badge>
                  </div>
                  <div className="text-sm font-medium">{page.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">{page.desc}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backlinks" className="mt-4">
          <ReputationGovernance />
          <Card className="">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {[
                  { l: "外链总数", v: "1,248" },
                  { l: "引用域名", v: "186" },
                  { l: "域名权重 DR", v: "42" },
                ].map((item) => (
                  <div key={item.l} className="p-3 bg-slate-50 rounded-md">
                    <div className="text-xs text-slate-500">{item.l}</div>
                    <div className="text-xl font-bold">{item.v}</div>
                  </div>
                ))}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-slate-500">
                    <th className="text-left font-medium py-2 px-2">来源域名</th>
                    <th className="text-left font-medium py-2 px-2">锚文本</th>
                    <th className="text-left font-medium py-2 px-2">DR</th>
                    <th className="text-left font-medium py-2 px-2">类型</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { d: "industryweek.com", a: "LED lighting supplier", dr: 78, t: "dofollow" },
                    { d: "tradeshownews.com", a: "UTrade Lighting", dr: 62, t: "dofollow" },
                    { d: "ledinside.com", a: "led bulb manufacturer", dr: 58, t: "nofollow" },
                    { d: "globalsources.com", a: "Shenzhen LED factory", dr: 84, t: "dofollow" },
                  ].map((backlink) => (
                    <tr key={backlink.d} className="border-b border-slate-100">
                      <td className="py-2 px-2 text-blue-600">{backlink.d}</td>
                      <td className="py-2 px-2">{backlink.a}</td>
                      <td className="py-2 px-2">{backlink.dr}</td>
                      <td className="py-2 px-2"><Badge variant="outline" className="text-xs">{backlink.t}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="internal" className="mt-4">
          <Card className="">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-semibold">内链自动化规则</h3>
                <Button className="bg-blue-600"><Plus className="w-3.5 h-3.5 mr-1" />新增规则</Button>
              </div>
              {[
                { kw: "LED bulb", target: "/products/led-bulb", limit: 3 },
                { kw: "solar panel", target: "/products/solar-panel", limit: 2 },
                { kw: "ball valve", target: "/products/ball-valve", limit: 3 },
              ].map((rule) => (
                <div key={rule.kw} className="flex items-center justify-between p-3 border border-slate-200 rounded-md gap-3">
                  <div className="flex items-center gap-3">
                    <LinkIcon className="w-4 h-4 text-blue-500" />
                    <div>
                      <div className="text-sm"><span className="font-medium">{rule.kw}</span> {"->"} <span className="text-blue-600">{rule.target}</span></div>
                      <div className="text-xs text-slate-500">每页最多出现 {rule.limit} 次</div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs">编辑</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deadlinks" className="mt-4">
          <Card className="">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div className="text-sm text-slate-500">上次扫描: 2026-04-26 10:30，发现 <span className="font-semibold text-red-500">4</span> 个死链</div>
                <Button className="bg-blue-600"><Search className="w-3.5 h-3.5 mr-1" />立即扫描</Button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-slate-500">
                    <th className="text-left font-medium py-2 px-2">URL</th>
                    <th className="text-left font-medium py-2 px-2">状态码</th>
                    <th className="text-left font-medium py-2 px-2">来源页</th>
                    <th className="text-left font-medium py-2 px-2">发现时间</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { u: "/products/old-led-bulb", c: 404, f: "/blog/led-guide", t: "2026-04-26" },
                    { u: "/contact-old", c: 404, f: "/footer", t: "2026-04-25" },
                    { u: "/about/team-member-x", c: 404, f: "/about", t: "2026-04-24" },
                    { u: "https://external-site.com/resource", c: 500, f: "/blog/industry-news", t: "2026-04-23" },
                  ].map((item) => (
                    <tr key={item.u} className="border-b border-slate-100">
                      <td className="py-2 px-2 font-mono text-xs">{item.u}</td>
                      <td className="py-2 px-2"><Badge className="bg-red-100 text-red-700 hover:bg-red-100">{item.c}</Badge></td>
                      <td className="py-2 px-2 text-blue-600 text-xs">{item.f}</td>
                      <td className="py-2 px-2 text-xs text-slate-500">{item.t}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="density" className="mt-4">
          <Card className="">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Input placeholder="输入页面 URL 分析关键词密度..." className="max-w-md" />
                <Button className="bg-blue-600">开始分析</Button>
              </div>
              <div className="space-y-2 pt-3">
                {[
                  { kw: "led bulb", count: 24, density: 3.2, status: "good" },
                  { kw: "wholesale", count: 18, density: 2.4, status: "good" },
                  { kw: "manufacturer", count: 32, density: 4.3, status: "warn" },
                  { kw: "china", count: 12, density: 1.6, status: "good" },
                  { kw: "quality", count: 8, density: 1.1, status: "low" },
                ].map((item) => (
                  <div key={item.kw} className="flex items-center justify-between p-3 border border-slate-200 rounded-md gap-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{item.kw}</div>
                      <div className="text-xs text-slate-500 mt-0.5">出现 {item.count} 次</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32">
                        <Progress value={item.density * 20} className="h-1.5" />
                      </div>
                      <span className="text-sm font-mono w-12">{item.density}%</span>
                      <Badge className={
                        item.status === "good" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" :
                        item.status === "warn" ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
                        "bg-slate-100 text-slate-700 hover:bg-slate-100"
                      }>
                        {item.status === "good" ? "合理" : item.status === "warn" ? "偏高" : "偏低"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tdk" className="mt-4">
          <Card className="">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-semibold">TDK 自动生成模板</h3>
                <AIGenerateButton
                  label="AI 生成 TDK"
                  systemPrompt="你是一名专业 SEO 专家。请根据页面类型与关键词，输出适合 B2B 外贸网站的 Title、Description 和 Keywords。"
                  placeholder="输入页面类型和核心关键词，例如：产品详情页，LED 灯泡，批发"
                />
              </div>
              {[
                { name: "产品详情页", t: "{{product}} - Wholesale {{category}} | {{brand}}", d: "Buy premium {{product}} from {{brand}}, trusted {{category}} manufacturer in China.", k: "{{product}}, {{category}}, wholesale" },
                { name: "分类页", t: "{{category}} Supplier & Manufacturer | {{brand}}", d: "Explore high-quality {{category}} from {{brand}}. ISO certified, global shipping.", k: "{{category}}, supplier, manufacturer" },
                { name: "文章页", t: "{{article_title}} | {{brand}} Blog", d: "{{article_summary}}", k: "{{article_keywords}}" },
              ].map((template) => (
                <div key={template.name} className="p-4 border border-slate-200 rounded-md space-y-2">
                  <div className="font-medium text-sm">{template.name}</div>
                  <div>
                    <Label className="text-xs text-slate-500">Title</Label>
                    <Input defaultValue={template.t} className="text-xs font-mono" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Description</Label>
                    <Input defaultValue={template.d} className="text-xs font-mono" />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Keywords</Label>
                    <Input defaultValue={template.k} className="text-xs font-mono" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mining" className="mt-4">
          <Card className="">
            <CardContent className="p-6 space-y-4">
              <div>
                <Label>种子关键词</Label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  <Input placeholder="例如: led bulb" defaultValue="led bulb" />
                  <Button className="bg-blue-600"><Search className="w-3.5 h-3.5 mr-1" />开始挖掘</Button>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">建议长尾关键词（128 个）</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[
                    "led bulb 9w e27", "led bulb wholesale price", "led bulb manufacturer china",
                    "led bulb bulk order", "cheap led bulb supplier", "oem led bulb factory",
                    "dimmable led bulb", "rgb led bulb", "smart led bulb bulk",
                    "led bulb 12w price", "e14 led bulb supplier", "gu10 led bulb china",
                  ].map((item) => (
                    <div key={item} className="flex items-center justify-between p-2 border border-slate-200 rounded-md">
                      <span className="text-xs font-mono">{item}</span>
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600">+</Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </FactoryPage>
  );
}
