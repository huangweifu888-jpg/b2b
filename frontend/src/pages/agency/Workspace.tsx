import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, AlertCircle, Plus, UserPlus, FileText, CreditCard, BookmarkCheck, Waves } from "lucide-react";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";
import { FactoryPage } from "@/page-factory/FactoryPage";

const todos = [
  { id: 1, title: "审批『美妆优品』订单 O20259 ¥68,000", type: "order", priority: "high", time: "30 分钟前" },
  { id: 2, title: "客户『Emma Wilson』报备待审核", type: "report", priority: "high", time: "1 小时前" },
  { id: 3, title: "公海池 4 个客户等待分配", type: "pool", priority: "medium", time: "2 小时前" },
  { id: 4, title: "SEO 任务『Meta 描述优化』已完成待验收", type: "seo", priority: "medium", time: "3 小时前" },
  { id: 5, title: "『杭州纺服』套餐即将到期（5 天）", type: "renew", priority: "low", time: "今日" },
  { id: 6, title: "新成员『陈小伟』权限需分配", type: "team", priority: "low", time: "昨日" },
];

const quick = [
  { label: "新增企业客户", icon: UserPlus, color: "from-blue-500 to-cyan-500" },
  { label: "创建订单", icon: CreditCard, color: "from-violet-500 to-fuchsia-500" },
  { label: "发布 SEO 任务", icon: FileText, color: "from-emerald-500 to-teal-500" },
  { label: "钱包充值", icon: Plus, color: "from-amber-500 to-orange-500" },
  { label: "分配公海客户", icon: Waves, color: "from-sky-500 to-blue-500" },
  { label: "审批报备", icon: BookmarkCheck, color: "from-pink-500 to-rose-500" },
];

const typeColor: Record<string, string> = {
  order: "bg-violet-100 text-violet-700",
  report: "bg-blue-100 text-blue-700",
  pool: "bg-sky-100 text-sky-700",
  seo: "bg-emerald-100 text-emerald-700",
  renew: "bg-amber-100 text-amber-700",
  team: "bg-pink-100 text-pink-700",
};

const typeLabel: Record<string, string> = {
  order: "订单",
  report: "报备",
  pool: "公海池",
  seo: "SEO",
  renew: "续费",
  team: "团队",
};

export default function Workspace() {
  return (
    <FactoryPage pageId="agency-workspace" template="dashboard" sourceScope="agency_source" className="space-y-6">
      <div data-page-factory-region="content" data-development-standard-frame-region="content" data-development-standard-frame-label="内容" className="space-y-6">
      <div data-page-factory-region="title-2" data-development-standard-frame-region="title-2" data-development-standard-frame-label="标题二">
        <h1 className="text-2xl font-bold text-slate-900">工作台</h1>
        <p className="text-sm text-slate-500 mt-1">待办事项与快捷操作</p>
      </div>

      <Card data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" className="border-slate-200">
        <CardContent className="p-6">
          <h3 className="font-semibold text-slate-900 mb-4">快捷操作</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {quick.map((q) => {
              const Icon = q.icon;
              return (
                <button
                  key={q.label}
                  data-page-factory-region="small-card"
                  data-development-standard-frame-region="small-card"
                  data-development-standard-frame-label="小卡片"
                  className="p-4 rounded-xl border border-slate-200 hover:shadow-md hover:border-violet-300 transition group text-left"
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${q.color} flex items-center justify-center mb-2 group-hover:scale-110 transition`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-sm font-medium text-slate-900">{sanitizeDisplayText(q.label, "快捷操作")}</div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">待办事项</h3>
              <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{todos.length} 项</Badge>
            </div>
            <div className="space-y-2">
              {todos.map((t) => (
                <div key={t.id} className="flex flex-wrap items-start gap-3 rounded-lg border border-transparent p-3 hover:border-slate-200 hover:bg-slate-50 sm:flex-nowrap sm:items-center">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    {t.priority === "high" ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : t.priority === "medium" ? (
                      <Clock className="w-4 h-4 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-900 truncate">{sanitizeDisplayText(t.title, "待办事项")}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{sanitizeDisplayText(t.time, "刚刚")}</div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${typeColor[t.type]} border-0`}>
                    {typeLabel[t.type] || "待办"}
                  </Badge>
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    处理
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4">今日动态</h3>
            <div className="relative pl-5 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
              {[
                { time: "14:32", text: "王小强 签下新客户『Gulf Electronics』¥45,000", color: "bg-emerald-500" },
                { time: "13:18", text: "张小美 提交 SEO 任务『长尾词挖掘』", color: "bg-blue-500" },
                { time: "11:05", text: "启明光电 续费专业版 ¥12,800", color: "bg-violet-500" },
                { time: "09:48", text: "公海池新增 1 个客户（报备到期）", color: "bg-amber-500" },
                { time: "09:12", text: "赵小敏 处理客户工单 3 单", color: "bg-sky-500" },
              ].map((a, i) => (
                <div key={i} className="relative">
                  <div className={`absolute -left-[18px] top-1 w-2.5 h-2.5 rounded-full ${a.color} ring-4 ring-white`} />
                  <div className="text-[11px] text-slate-400 font-mono">{a.time}</div>
                  <div className="text-xs text-slate-700 mt-0.5">{sanitizeDisplayText(a.text, "动态更新")}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </FactoryPage>
  );
}
