import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Search, Activity, Target, Link2, Sparkles, TrendingUp, Plus } from "lucide-react";

import { loadAgencyLiveSnapshot } from "@/lib/agency-live-data";
import { deriveAgencySeoTasks } from "@/lib/agency-derived-data";
import { FactoryPage } from "@/page-factory/FactoryPage";

const iconMap = { Search, Activity, Target, Link2, Sparkles, TrendingUp };

const statusMap: Record<string, { label: string; cls: string }> = {
  done: { label: "已完成", cls: "bg-emerald-100 text-emerald-700" },
  in_progress: { label: "进行中", cls: "bg-blue-100 text-blue-700" },
  pending: { label: "待开始", cls: "bg-slate-100 text-slate-700" },
};

const priorityMap: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-700",
};

export default function SEOTasks() {
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

  const tasks = useMemo(() => (snapshot ? deriveAgencySeoTasks(snapshot) : []), [snapshot]);
  const tools = useMemo(() => {
    const projectCount = snapshot?.currentAgency?.children.reduce((sum, client) => sum + client.projects.length, 0) || 0;
    const clientCount = snapshot?.currentAgency ? snapshot.currentAgency.children.filter((node) => node.org_type === "client").length : 0;
    return [
      { name: "关键词挖掘", desc: "围绕当前客户与计划生成长尾关键词", icon: "Search", used: clientCount * 120 + 80, quota: 5000 },
      { name: "站点审计", desc: "检查当前代理下的网站结构与内容问题", icon: "Activity", used: projectCount * 2 + 18, quota: 200 },
      { name: "竞品分析", desc: "对标同类客户站点的内容与流量", icon: "Target", used: clientCount * 4 + 12, quota: 500 },
      { name: "外链监测", desc: "跟踪收录、外链与排名变化", icon: "Link2", used: projectCount * 30 + 200, quota: 20000 },
      { name: "AI 内容生成", desc: "按计划批量生成内容稿件", icon: "Sparkles", used: projectCount * 12 + 40, quota: 1000 },
      { name: "排名追踪", desc: "监测目标词 SERP 排名波动", icon: "TrendingUp", used: clientCount * 40 + 120, quota: 2000 },
    ];
  }, [snapshot]);

  return (
    <FactoryPage pageId="agency-seo-tasks" template="workflow" sourceScope="agency_source" className="space-y-6">
      <div data-page-factory-region="content" data-development-standard-frame-region="content" data-development-standard-frame-label="内容" className="space-y-6">
      <div data-page-factory-region="title-2" data-development-standard-frame-region="title-2" data-development-standard-frame-label="标题二" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">SEO 任务与工具</h1>
          <p className="mt-1 text-sm text-slate-500">为当前代理下的站点提供 SEO 工具和任务分发</p>
        </div>
        <Button className="bg-violet-600 hover:bg-violet-700"><Plus className="mr-2 h-4 w-4" />新建任务</Button>
      </div>

      <div>
        <h3 className="mb-3 font-semibold text-slate-900">SEO 工具</h3>
        <div data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => {
            const Icon = iconMap[tool.icon as keyof typeof iconMap];
            const pct = (tool.used / tool.quota) * 100;
            return (
              <Card key={tool.name} data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" className="cursor-pointer border-slate-200 transition hover:shadow-md">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <Badge variant="outline" className="text-[10px]">{pct.toFixed(0)}%</Badge>
                  </div>
                  <h4 className="font-semibold">{tool.name}</h4>
                  <p className="mb-3 mt-1 text-xs text-slate-500">{tool.desc}</p>
                  <Progress value={pct} className="h-1.5" />
                  <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
                    <span>已用 {tool.used.toLocaleString()}</span>
                    <span>额度 {tool.quota.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-semibold text-slate-900">进行中的任务</h3>
        <Card data-page-factory-region="table-shell" data-development-standard-frame-region="table-shell" data-development-standard-frame-label="表内" className="border-slate-200">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b border-slate-200 p-4">
              <Search className="h-4 w-4 text-slate-400" />
              <input className="h-8 flex-1 rounded border-0 bg-transparent text-sm outline-none" placeholder="搜索任务、站点或负责人" />
              <Button variant="outline" size="sm">筛选</Button>
            </div>
            <div data-page-factory-region="scrollbar" data-development-standard-frame-region="scrollbar" data-development-standard-frame-label="滚动条" className="responsive-table-wrap">
              <table className="w-full text-sm">
                <thead data-page-factory-region="table-header" data-development-standard-frame-region="table-header" data-development-standard-frame-label="表头" className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">任务</th>
                    <th className="px-4 py-3 text-left font-medium">目标站点</th>
                    <th className="px-4 py-3 text-left font-medium">负责人</th>
                    <th className="px-4 py-3 text-left font-medium">优先级</th>
                    <th className="px-4 py-3 text-left font-medium">状态</th>
                    <th className="px-4 py-3 text-left font-medium">截止</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{task.title}</td>
                      <td className="px-4 py-3 text-xs text-violet-600">{task.site}</td>
                      <td className="px-4 py-3 text-slate-600">{task.assignee}</td>
                      <td className="px-4 py-3">
                        <Badge className={`${priorityMap[task.priority]} hover:${priorityMap[task.priority]}`}>
                          {task.priority === "high" ? "高" : task.priority === "medium" ? "中" : "低"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`${statusMap[task.status].cls} hover:${statusMap[task.status].cls}`}>
                          {statusMap[task.status].label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{task.due}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </FactoryPage>
  );
}
