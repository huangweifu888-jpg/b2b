import { Suspense, lazy } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Facebook, Instagram, Linkedin, Twitter, Youtube } from "lucide-react";

import SiteContextCard from "@/components/SiteContextCard";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePostPaintReady } from "@/lib/post-paint-lazy";

const AccountCreditsChart = lazy(() => import("@/components/charts/AccountCreditsChart"));

function AccountCreditsChartPlaceholder() {
  return <div aria-hidden="true" className="min-h-[260px] rounded-lg border border-slate-200 bg-slate-50" />;
}

const creditLogs = [
  { time: "2026-06-21 14:32", type: "AI 文章", action: "生成产品文章 1 篇", cost: 120 },
  { time: "2026-06-21 11:08", type: "关键词分析", action: "批量分析 128 个关键词", cost: 80 },
  { time: "2026-06-21 09:45", type: "排名查询", action: "批量查询 50 个词", cost: 50 },
  { time: "2026-06-20 16:20", type: "AI 建站", action: "生成首页与产品页", cost: 280 },
  { time: "2026-06-20 10:12", type: "外链扫描", action: "执行一次全站外链扫描", cost: 40 },
];

const socialAccounts = [
  { icon: Facebook, name: "Facebook", handle: "@UTradeLighting", connected: true, color: "text-blue-600" },
  { icon: Twitter, name: "Twitter / X", handle: "@utrade_led", connected: true, color: "text-slate-900" },
  { icon: Instagram, name: "Instagram", handle: "@utrade.lighting", connected: true, color: "text-pink-600" },
  { icon: Linkedin, name: "LinkedIn", handle: "UTrade Lighting Tech", connected: true, color: "text-blue-700" },
  { icon: Youtube, name: "YouTube", handle: "未绑定", connected: false, color: "text-red-600" },
];

const planOptions = [
  {
    name: "基础版",
    price: "$29",
    period: "月",
    features: ["1 个站点", "5,000 积分 / 月", "基础 SEO 工具", "邮件客服"],
    current: false,
    highlight: false,
  },
  {
    name: "专业版",
    price: "$99",
    period: "月",
    features: ["5 个站点", "20,000 积分 / 月", "全套 SEO 工具", "AI 建站助手", "优先客服"],
    current: true,
    highlight: true,
  },
  {
    name: "企业版",
    price: "$299",
    period: "月",
    features: ["无限站点", "100,000 积分 / 月", "企业级 SEO", "专属客户经理", "API 接入"],
    current: false,
    highlight: false,
  },
];

export default function Account() {
  const [params, setParams] = useSearchParams();
  const creditsChartReady = usePostPaintReady(700);
  const tab = params.get("tab") || "credits";
  const siteId = params.get("siteId");

  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", value);
    setParams(next);
  };

  return (
    <FactoryPage pageId="client-account" template="workflow" sourceScope="client_source" className="space-y-6">
      <div data-page-factory-region="content" data-development-standard-frame-region="content" data-development-standard-frame-label="内容" className="space-y-6">
      <SiteContextCard siteId={siteId} />

      <div data-page-factory-region="title-2" data-development-standard-frame-region="title-2" data-development-standard-frame-label="标题二">
        <h1 className="text-2xl font-bold text-slate-900">账户中心</h1>
        <p className="mt-1 text-sm text-slate-500">查看积分、套餐、社媒账号和当前账户资料。</p>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="flex h-auto flex-wrap gap-1 bg-slate-100 p-1">
          <TabsTrigger value="credits">积分消耗</TabsTrigger>
          <TabsTrigger value="social">社媒账号</TabsTrigger>
          <TabsTrigger value="plan">套餐方案</TabsTrigger>
          <TabsTrigger value="profile">个人资料</TabsTrigger>
        </TabsList>

        <TabsContent value="credits" className="mt-4 space-y-4">
          <div data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" className="border-slate-200 bg-gradient-to-br from-blue-600 to-sky-500 text-white">
              <CardContent className="p-5">
                <div className="text-xs opacity-90">积分余额</div>
                <div className="mt-1 text-3xl font-bold">12,580</div>
                <div className="mt-2 text-xs opacity-80">本月已消耗 3,720</div>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-5">
                <div className="text-xs text-slate-500">今日消耗</div>
                <div className="mt-1 text-2xl font-bold">720</div>
                <Progress value={72} className="mt-2 h-1.5" />
                <div className="mt-1 text-xs text-slate-500">每日配额 1,000</div>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-5">
                <div className="text-xs text-slate-500">套餐剩余有效期</div>
                <div className="mt-1 text-2xl font-bold">183 天</div>
                <div className="mt-2 text-xs text-slate-500">到期时间 2026-12-22</div>
              </CardContent>
            </Card>
          </div>

          <div data-account-credits-chart-post-paint>
            {creditsChartReady ? (
              <Suspense fallback={<AccountCreditsChartPlaceholder />}>
                <AccountCreditsChart />
              </Suspense>
            ) : (
              <AccountCreditsChartPlaceholder />
            )}
          </div>

          <Card data-page-factory-region="table-shell" data-development-standard-frame-region="table-shell" data-development-standard-frame-label="表内" className="border-slate-200">
            <CardContent className="p-0">
              <div className="px-6 pt-6 text-base font-semibold">积分消耗明细</div>
              <div data-page-factory-region="scrollbar" data-development-standard-frame-region="scrollbar" data-development-standard-frame-label="滚动条" className="overflow-x-auto p-6 pt-4">
                <table className="w-full text-sm">
                  <thead data-page-factory-region="table-header" data-development-standard-frame-region="table-header" data-development-standard-frame-label="表头">
                    <tr className="border-b text-xs text-slate-500">
                      <th className="px-2 py-2 text-left font-medium">时间</th>
                      <th className="px-2 py-2 text-left font-medium">类型</th>
                      <th className="px-2 py-2 text-left font-medium">操作</th>
                      <th className="px-2 py-2 text-left font-medium">消耗</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditLogs.map((row) => (
                      <tr key={`${row.time}-${row.action}`} className="border-b border-slate-100">
                        <td className="px-2 py-2 text-xs text-slate-500">{row.time}</td>
                        <td className="px-2 py-2">
                          <Badge variant="outline" className="text-xs">
                            {row.type}
                          </Badge>
                        </td>
                        <td className="px-2 py-2">{row.action}</td>
                        <td className="px-2 py-2 font-mono text-amber-600">-{row.cost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social" className="mt-4">
          <Card className="border-slate-200">
            <CardContent className="space-y-3 p-6">
              <h3 className="font-semibold">社交媒体账号绑定</h3>
              {socialAccounts.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.name} className="flex items-center justify-between rounded-md border border-slate-200 p-3">
                    <div className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 ${item.color}`} />
                      <div>
                        <div className="text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-slate-500">{item.handle}</div>
                      </div>
                    </div>
                    {item.connected ? (
                      <Button variant="outline" size="sm" className="h-8 text-xs">
                        <Check className="mr-1 h-3.5 w-3.5 text-emerald-500" /> 已绑定
                      </Button>
                    ) : (
                      <Button size="sm" className="h-8 bg-blue-600 text-xs hover:bg-blue-700">
                        立即绑定
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plan" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {planOptions.map((plan) => (
              <Card key={plan.name} className={`border-slate-200 ${plan.highlight ? "border-2 border-blue-500 shadow-lg" : ""}`}>
                <CardContent className="p-6">
                  {plan.highlight ? <Badge className="mb-2 bg-blue-600 hover:bg-blue-600">推荐</Badge> : null}
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-sm text-slate-500">/{plan.period}</span>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-emerald-500" /> {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`mt-5 w-full ${plan.current ? "bg-slate-200 text-slate-700 hover:bg-slate-200" : "bg-blue-600 hover:bg-blue-700"}`}
                    disabled={plan.current}
                  >
                    {plan.current ? "当前套餐" : "升级套餐"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          <Card className="border-slate-200">
            <CardContent className="space-y-4 p-6">
              <h3 className="font-semibold">个人资料</h3>
              <div className="flex items-center gap-4 border-b pb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-sky-500 text-xl font-bold text-white">
                  AD
                </div>
                <div>
                  <div className="font-semibold">Admin User</div>
                  <div className="text-xs text-slate-500">admin@tradepro.com</div>
                  <Button variant="outline" size="sm" className="mt-2 h-7 text-xs">
                    上传头像
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label>姓名</Label>
                  <Input defaultValue="Admin User" />
                </div>
                <div>
                  <Label>邮箱</Label>
                  <Input defaultValue="admin@tradepro.com" />
                </div>
                <div>
                  <Label>手机号</Label>
                  <Input defaultValue="+86 138 0000 0000" />
                </div>
                <div>
                  <Label>时区</Label>
                  <Input defaultValue="UTC+8 Asia/Shanghai" />
                </div>
              </div>
              <div className="border-t pt-4">
                <h4 className="mb-3 text-sm font-medium">修改密码</h4>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <Label>当前密码</Label>
                    <Input type="password" />
                  </div>
                  <div>
                    <Label>新密码</Label>
                    <Input type="password" />
                  </div>
                  <div>
                    <Label>确认新密码</Label>
                    <Input type="password" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="bg-blue-600 hover:bg-blue-700">保存</Button>
                <Button variant="outline">取消</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </FactoryPage>
  );
}
