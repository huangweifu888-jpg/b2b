import { useEffect, useMemo, useState } from "react";

import { useSearchParams } from "react-router-dom";

import { Archive, ArrowUpRight, BarChart3, Building2, CheckCircle2, Clock, Eye, FileText, FolderOpen, Globe, Inbox, Mail, MousePointerClick, Plus, RefreshCw, Send, Star, Tag, TrendingUp, Users } from "lucide-react";

import SiteContextCard from "@/components/SiteContextCard";
import { CrmGovernance } from "@/components/crm/CrmGovernance";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { collectClientProjects, deriveClientCustomers, loadClientLiveSnapshot, type ClientLiveSnapshot } from "@/lib/client-live-data";

import { getSiteById, getSitePublicUrl } from "@/lib/sites";

import { sanitizeDisplayText } from "@/lib/text-sanitizer";
import { formatDisplayOrdinal } from "@/lib/display-number-contract";
import { FactoryPage } from "@/page-factory/FactoryPage";

type CustomerRow = ReturnType<typeof deriveClientCustomers>[number];
type ProjectRow = ReturnType<typeof collectClientProjects>[number];

function formatDateTime(value?: string) {
  if (!value) return "-";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(time));
}

function formatRelativeTime(value?: string) {
  if (!value) return "-";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "-";
  const diff = Date.now() - time;
  const hour = 1000 * 60 * 60;
  const day = hour * 24;
  if (diff < hour) return "刚刚";
  if (diff < day) return `${Math.max(1, Math.floor(diff / hour))} 小时前`;
  return `${Math.max(1, Math.floor(diff / day))} 天前`;
}

function initialsOf(name: string) {
  const text = name.trim();
  if (!text) return "C";
  const latin = text.split(/\s+/).map((item) => item[0]).join("");
  return latin.slice(0, 2).toUpperCase() || text.slice(0, 2).toUpperCase();
}

function buildOpportunityRows(projects: ProjectRow[]) {
  const stagePool = [
    { label: "新线索", probability: 25, tone: "bg-slate-100 text-slate-700" },
    { label: "需求确认", probability: 45, tone: "bg-sky-100 text-sky-700" },
    { label: "方案报价", probability: 68, tone: "bg-amber-100 text-amber-700" },
    { label: "商务洽谈", probability: 82, tone: "bg-emerald-100 text-emerald-700" },
  ];

  return projects.map((row, index) => {
    const stage = stagePool[index % stagePool.length];
    const amountBase = 18000 + (projects.length - index) * 3200;
    return {
      id: row.project.code,
      name: sanitizeDisplayText(row.site?.planName || row.project.name, row.project.code),
      clientName: sanitizeDisplayText(row.client.name, row.client.code),
      agencyName: sanitizeDisplayText(row.agency?.name || row.site?.agencyName || "", row.agency?.code || row.site?.agencyCode || "-"),
      stage,
      probability: stage.probability + (index % 3) * 3,
      amount: `$${amountBase.toLocaleString("en-US")}`,
      updatedAt: row.site?.updatedAt || row.project.updated_at || row.project.created_at,
      siteUrl: row.site ? getSitePublicUrl(row.site) : row.project.domain || "-",
    };
  });
}

function buildPoolRows(snapshot: ClientLiveSnapshot, customers: CustomerRow[]) {
  return customers.map((customer, index) => ({
    id: `${customer.id}-${index}`,
    name: customer.name,
    company: customer.company,
    region: customer.country,
    source: index % 3 === 0 ? "官网询盘" : index % 3 === 1 ? "代理分配" : "计划回访",
    recyclableIn: `${7 + index * 3} 天`,
    lastContact: formatRelativeTime(customer.lastContact),
    priority: index % 2 === 0 ? "可跟进" : "观察中",
    totalPlans: snapshot.currentClient?.projects.length || 0,
  }));
}

function buildEmailRows(projects: ProjectRow[]) {
  return projects.slice(0, 8).map((row, index) => ({
    id: row.project.code,
    from: `${row.client.code.toLowerCase()}@client.local`,
    subject: `${sanitizeDisplayText(row.project.name, row.project.code)} 进度同步`,
    time: formatRelativeTime(row.site?.updatedAt || row.project.updated_at || row.project.created_at),
    read: index > 1,
    starred: index % 3 === 0,
    siteName: sanitizeDisplayText(row.site?.name || row.project.name, row.project.code),
  }));
}

function buildFolderRows(projects: ProjectRow[]) {
  return projects.map((row, index) => ({
    id: row.project.code,
    name: `${row.project.code}-${sanitizeDisplayText(row.project.name, row.project.code)}`,
    count: 6 + index * 2,
    size: `${128 + index * 36} MB`,
    updatedAt: formatDateTime(row.site?.updatedAt || row.project.updated_at || row.project.created_at),
    color:
      index % 4 === 0
        ? "bg-blue-500"
        : index % 4 === 1
          ? "bg-emerald-500"
          : index % 4 === 2
            ? "bg-amber-500"
            : "bg-purple-500",
  }));
}

function buildCampaignRows(projects: ProjectRow[]) {
  return projects.slice(0, 6).map((row, index) => {
    const sent = 900 + index * 260;
    const opened = Math.round(sent * (0.42 + index * 0.03));
    const clicked = Math.round(opened * (0.18 + (index % 2) * 0.05));
    return {
      id: row.project.code,
      name: `${sanitizeDisplayText(row.project.name, row.project.code)} 多语言触达`,
      status: index === 0 ? "进行中" : index === 1 ? "已发送" : index === 2 ? "计划中" : "草稿",
      sent,
      opened,
      clicked,
      date: formatDateTime(row.site?.updatedAt || row.project.updated_at || row.project.created_at),
    };
  });
}

function CrmSummary({
  snapshot,
  customers,
  opportunities,
}: {
  snapshot: ClientLiveSnapshot;
  customers: CustomerRow[];
  opportunities: ReturnType<typeof buildOpportunityRows>;
}) {
  const currentClientName = sanitizeDisplayText(snapshot.currentClient?.name || "", snapshot.currentClient?.code || "当前客户");
  const currentAgencyName = sanitizeDisplayText(snapshot.currentAgency?.name || "", snapshot.currentAgency?.code || "当前代理");

  const summaryStats = [
    { label: "客户主体", value: currentClientName, hint: snapshot.currentClient?.code || "-", icon: Building2, tone: "bg-blue-50 text-blue-600" },
    { label: "归属代理", value: currentAgencyName, hint: snapshot.currentAgency?.code || "-", icon: Globe, tone: "bg-sky-50 text-sky-600" },
    { label: "有效商机", value: opportunities.length.toString(), hint: "按最新计划倒序", icon: TrendingUp, tone: "bg-emerald-50 text-emerald-600" },
    { label: "联系人", value: customers.length.toString(), hint: "真实计划派生", icon: Users, tone: "bg-amber-50 text-amber-600" },
  ];

  const recentActivities = opportunities.slice(0, 5).map((item, index) => ({
    id: item.id,
    time: formatRelativeTime(item.updatedAt),
    action:
      index % 2 === 0
        ? `计划 ${item.name} 已同步到客户链路`
        : `客户 ${item.clientName} 的站点 ${item.name} 更新完成`,
  }));

  const todoItems = opportunities.slice(0, 4).map((item, index) => ({
    id: item.id,
    title: `${item.name} - ${item.stage.label}`,
    due: index === 0 ? "今天" : index === 1 ? "明天" : "本周",
    done: index === 3,
  }));

  return (
    <div data-page-list className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryStats.map((item) => (
          <Card key={item.label} data-page-list-item className="">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-slate-500">{item.label}</div>
                <div className="truncate text-base font-semibold text-slate-900">{item.value}</div>
                <div className="text-xs text-slate-400">{item.hint}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card data-page-list-item className="">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">最新动态</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivities.map((item) => (
              <div key={item.id} className="flex items-start gap-3 text-sm">
                <span className="w-20 shrink-0 pt-0.5 text-xs text-slate-400">{item.time}</span>
                <span className="text-slate-700">{item.action}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card data-page-list-item className="">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">待推进事项</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todoItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm last:border-0">
                <div className="flex items-center gap-2">
                  {item.done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-slate-400" />
                  )}
                  <span className={item.done ? "text-slate-400 line-through" : "text-slate-700"}>{item.title}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {item.due}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OpportunityTab({ opportunities }: { opportunities: ReturnType<typeof buildOpportunityRows> }) {
  const stageSummary = Array.from(
    opportunities.reduce((map, item) => {
      const current = map.get(item.stage.label) || { label: item.stage.label, count: 0, amount: 0, tone: item.stage.tone };
      const numeric = Number(item.amount.replace(/[$,]/g, ""));
      current.count += 1;
      current.amount += numeric;
      map.set(item.stage.label, current);
      return map;
    }, new Map<string, { label: string; count: number; amount: number; tone: string }>())
  ).map(([, item]) => item);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stageSummary.map((item) => (
          <Card key={item.label} className="">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500">{item.label}</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">{item.count}</div>
                </div>
                <Badge className={item.tone}>{item.label}</Badge>
              </div>
              <div className="mt-2 text-xs text-slate-400">${item.amount.toLocaleString("en-US")}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">商机列表</CardTitle>
            <Button className="bg-blue-600 text-white hover:bg-blue-700">
              <Plus className="mr-1 h-4 w-4" />
              新建商机
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="px-2 py-2 font-medium">计划</th>
                <th className="px-2 py-2 font-medium">客户</th>
                <th className="px-2 py-2 font-medium">归属代理</th>
                <th className="px-2 py-2 font-medium">金额</th>
                <th className="px-2 py-2 font-medium">阶段</th>
                <th className="px-2 py-2 font-medium">成功率</th>
                <th className="px-2 py-2 font-medium">网站</th>
                <th className="px-2 py-2 font-medium">更新时间</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-2 py-3 font-medium text-slate-900">{item.name}</td>
                  <td className="px-2 py-3">{item.clientName}</td>
                  <td className="px-2 py-3">{item.agencyName}</td>
                  <td className="px-2 py-3 font-semibold">{item.amount}</td>
                  <td className="px-2 py-3">
                    <Badge className={item.stage.tone}>{item.stage.label}</Badge>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${item.probability}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{item.probability}%</span>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-xs text-blue-600">
                    <a href={item.siteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                      访问
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  </td>
                  <td className="px-2 py-3 text-xs text-slate-500">{formatDateTime(item.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function CustomerPoolTab({
  poolRows,
}: {
  poolRows: ReturnType<typeof buildPoolRows>;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500">公共池客户</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{poolRows.length}</div>
            <div className="mt-1 text-xs text-emerald-600">按最新计划倒序同步</div>
          </CardContent>
        </Card>
        <Card className="">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500">可立即跟进</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {poolRows.filter((item) => item.priority === "可跟进").length}
            </div>
            <div className="mt-1 text-xs text-slate-400">同一客户链路统一排序</div>
          </CardContent>
        </Card>
        <Card className="">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500">计划联动数</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {poolRows.reduce((sum, item) => sum + item.totalPlans, 0)}
            </div>
            <div className="mt-1 text-xs text-slate-400">来自真实客户计划</div>
          </CardContent>
        </Card>
      </div>

      <Card className="">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">公共池线索</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input placeholder="搜索客户名称" className="h-9 sm:w-56" />
              <Button variant="outline" size="sm">
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                刷新
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="px-2 py-2 font-medium">客户名称</th>
                <th className="px-2 py-2 font-medium">公司</th>
                <th className="px-2 py-2 font-medium">区域</th>
                <th className="px-2 py-2 font-medium">来源</th>
                <th className="px-2 py-2 font-medium">回收周期</th>
                <th className="px-2 py-2 font-medium">最后联系</th>
                <th className="px-2 py-2 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {poolRows.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-2 py-3 font-medium text-slate-900">{item.name}</td>
                  <td className="px-2 py-3">{item.company}</td>
                  <td className="px-2 py-3">{item.region}</td>
                  <td className="px-2 py-3">
                    <Badge variant="outline" className="text-xs">
                      {item.source}
                    </Badge>
                  </td>
                  <td className="px-2 py-3 text-slate-600">{item.recyclableIn}</td>
                  <td className="px-2 py-3 text-xs text-slate-500">{item.lastContact}</td>
                  <td className="px-2 py-3">
                    <Badge className={item.priority === "可跟进" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>
                      {item.priority}
                    </Badge>
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

function CustomerManagementTab({ customers }: { customers: CustomerRow[] }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">客户管理</h2>
          <p className="text-sm text-slate-500">客户联系人、计划标签、最后联系时间全部按最新优先显示。</p>
        </div>
        <Button className="bg-blue-600 text-white hover:bg-blue-700">
          <Plus className="mr-1 h-4 w-4" />
          新增客户
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "客户数", value: customers.length },
          { label: "活跃标签", value: customers.reduce((sum, item) => sum + item.tags.length, 0) },
          { label: "总询盘", value: customers.reduce((sum, item) => sum + item.inquiries, 0) },
          { label: "最近联系", value: customers[0] ? formatRelativeTime(customers[0].lastContact) : "-" },
        ].map((item) => (
          <Card key={item.label} className="">
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">{item.label}</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="">
        <CardContent className="p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input placeholder="搜索客户名称 / 编号" className="sm:max-w-xs" />
            <Button variant="outline" size="sm">
              <Tag className="mr-1 h-3.5 w-3.5" />
              标签筛选
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="px-2 py-2 font-medium">客户</th>
                  <th className="px-2 py-2 font-medium">公司</th>
                  <th className="px-2 py-2 font-medium">区域</th>
                  <th className="px-2 py-2 font-medium">邮箱</th>
                  <th className="px-2 py-2 font-medium">计划标签</th>
                  <th className="px-2 py-2 font-medium">询盘数</th>
                  <th className="px-2 py-2 font-medium">最后联系</th>
                  <th className="px-2 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={`${customer.id}-${customer.email}`} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-sky-500 text-xs font-semibold text-white">
                          {initialsOf(customer.name)}
                        </div>
                        <span className="font-medium text-slate-900">{customer.name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3">{customer.company}</td>
                    <td className="px-2 py-3">{customer.country}</td>
                    <td className="px-2 py-3 text-xs text-slate-600">{customer.email}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-1">
                        {customer.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-3 font-medium">{customer.inquiries}</td>
                    <td className="px-2 py-3 text-xs text-slate-500">{formatDateTime(customer.lastContact)}</td>
                    <td className="px-2 py-3">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600">
                        <Mail className="mr-1 h-3 w-3" />
                        联系
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmailManagementTab({ emailRows }: { emailRows: ReturnType<typeof buildEmailRows> }) {
  const folders = [
    { name: "收件箱", count: emailRows.filter((item) => !item.read).length, icon: Inbox },
    { name: "已发送", count: emailRows.length, icon: Send },
    { name: "星标邮件", count: emailRows.filter((item) => item.starred).length, icon: Star },
    { name: "归档", count: Math.max(2, emailRows.length - 2), icon: Archive },
    { name: "草稿", count: 1, icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-900">邮件管理</h2>
        <Button className="bg-blue-600 text-white hover:bg-blue-700">
          <Plus className="mr-1 h-4 w-4" />
          写邮件
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="">
          <CardContent className="space-y-1 p-3">
            {folders.map((folder) => (
              <div key={folder.name} className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <folder.icon className="h-4 w-4 text-slate-400" />
                  <span>{folder.name}</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {folder.count}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="">
          <CardContent className="p-4">
            <div className="mb-4 flex gap-2">
              <Input placeholder="搜索邮件主题" className="flex-1" />
              <Button variant="outline" size="sm">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-1">
              {emailRows.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 rounded-md px-3 py-3 ${item.read ? "hover:bg-slate-50" : "bg-blue-50/60 hover:bg-blue-50"}`}
                >
                  <Star className={`h-4 w-4 shrink-0 ${item.starred ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`truncate text-sm ${item.read ? "text-slate-700" : "font-semibold text-slate-900"}`}>{item.from}</span>
                      <span className="shrink-0 text-xs text-slate-400">{item.time}</span>
                    </div>
                    <p className="truncate text-sm text-slate-600">{item.subject}</p>
                    <p className="truncate text-xs text-slate-400">{item.siteName}</p>
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

function FolderManagementTab({ folders }: { folders: ReturnType<typeof buildFolderRows> }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">文件夹管理</h2>
          <p className="text-sm text-slate-500">每个计划一组资料目录，按最新更新时间优先显示。</p>
        </div>
        <Button className="bg-blue-600 text-white hover:bg-blue-700">
          <Plus className="mr-1 h-4 w-4" />
          新建文件夹
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {folders.map((folder) => (
          <Card key={folder.id} className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${folder.color}`}>
                    <FolderOpen className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-900">{folder.name}</div>
                    <div className="text-xs text-slate-500">
                      {folder.count} 个文件 · {folder.size}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-400">最后更新 {folder.updatedAt}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EmailMarketingTab({ campaigns }: { campaigns: ReturnType<typeof buildCampaignRows> }) {
  const statusTone: Record<string, string> = {
    已发送: "bg-emerald-100 text-emerald-700",
    进行中: "bg-blue-100 text-blue-700",
    计划中: "bg-amber-100 text-amber-700",
    草稿: "bg-slate-100 text-slate-700",
  };

  const cards = [
    { label: "发送总量", value: campaigns.reduce((sum, item) => sum + item.sent, 0).toLocaleString("en-US"), icon: Send, tone: "bg-blue-50 text-blue-600" },
    { label: "打开总量", value: campaigns.reduce((sum, item) => sum + item.opened, 0).toLocaleString("en-US"), icon: Eye, tone: "bg-emerald-50 text-emerald-600" },
    { label: "点击总量", value: campaigns.reduce((sum, item) => sum + item.clicked, 0).toLocaleString("en-US"), icon: MousePointerClick, tone: "bg-amber-50 text-amber-600" },
    { label: "活动数", value: campaigns.length.toString(), icon: BarChart3, tone: "bg-purple-50 text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">邮件营销</h2>
          <p className="text-sm text-slate-500">多语言活动与计划链路同步，界面按窄屏先缩内容再换行。</p>
        </div>
        <Button className="bg-blue-600 text-white hover:bg-blue-700">
          <Plus className="mr-1 h-4 w-4" />
          创建活动
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.tone}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500">{card.label}</div>
                <div className="text-xl font-bold text-slate-900">{card.value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="">
        <CardContent className="overflow-x-auto p-4">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="px-2 py-2 font-medium">活动名称</th>
                <th className="px-2 py-2 font-medium">状态</th>
                <th className="px-2 py-2 font-medium">发送量</th>
                <th className="px-2 py-2 font-medium">打开量</th>
                <th className="px-2 py-2 font-medium">点击量</th>
                <th className="px-2 py-2 font-medium">更新时间</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-2 py-3 font-medium text-slate-900">{campaign.name}</td>
                  <td className="px-2 py-3">
                    <Badge className={statusTone[campaign.status]}>{campaign.status}</Badge>
                  </td>
                  <td className="px-2 py-3">{campaign.sent.toLocaleString("en-US")}</td>
                  <td className="px-2 py-3">{campaign.opened.toLocaleString("en-US")}</td>
                  <td className="px-2 py-3">{campaign.clicked.toLocaleString("en-US")}</td>
                  <td className="px-2 py-3 text-xs text-slate-500">{campaign.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

const CRM_TEMPLATE_CHAIN = [
  { title: "总部模板源", description: "定义 CRM 字段、流程、角色、自动化规则与页面组合，不携带任何真实客户数据。" },
  { title: "代理源 / 客户源", description: "接收总部批准版本，允许在授权范围内配置行业字段、销售阶段和服务规则。" },
  { title: "代理端 / 客户端", description: "只读取已发布版本；实际线索、联系人、报价、订单和跟进记录归当前租户所有。" },
  { title: "客户端计划", description: "按 plan_id 隔离站点、渠道、活动和归因数据，同一客户的不同计划不可串数。" },
] as const;

const CRM_FACTORY_PIPELINE = [
  ["01", "线索进入", "官网询盘、展会、转介绍、邮件、社媒与人工录入统一去重。"],
  ["02", "客户初筛", "按国家、行业、采购角色、需求强度、合规风险和预计金额评分。"],
  ["03", "需求确认", "记录产品参数、数量、交期、认证、包装、贸易条款与决策链。"],
  ["04", "样品与报价", "样品任务、成本版本、币种、有效期和审批记录可追溯。"],
  ["05", "商务推进", "跟进动作必须有负责人、截止时间、结果和下一步，不允许只有备注。"],
  ["06", "订单交付", "赢单后衔接合同、收款、生产、质检、物流和异常处理。"],
  ["07", "复购经营", "按产品周期触发回访、补货、交叉销售、流失预警和客户价值复盘。"],
] as const;

const CRM_STANDARD_DOMAINS = [
  { title: "数据与租户边界", items: ["所有记录强制携带 agent_path、tenant_id、client_id 和可选 plan_id", "模板只同步结构与规则，禁止同步真实客户、联系人、邮件正文和报价数据", "跨租户查看必须经过明确授权并保留审计记录"] },
  { title: "客户与联系人模型", items: ["企业、联系人、采购角色、地址、税务与认证信息分表管理", "企业去重使用域名、邮箱域、电话及人工合并，保留来源记录", "一个联系人可关联多个机会，但客户归属与计划归属不可隐式变更"] },
  { title: "销售流程与公海", items: ["阶段、必填项、进入条件、退出条件和失败原因使用同一状态机", "领取、保护、退回、转派、撞单和离职交接均采用可配置规则", "逾期未跟进自动提醒，达到回收条件后进入待审核而非直接改归属"] },
  { title: "营销与归因", items: ["活动、渠道、内容、UTM、询盘、机会、订单形成可追溯链", "邮件触达须包含同意依据、退订、频控、黑名单和发送审计", "指标以有效询盘、报价、赢单、毛利和复购为主，不以浏览量代替经营结果"] },
  { title: "权限与审计", items: ["总部管理模板，代理管理授权范围，客户管理本租户业务数据", "敏感字段按角色脱敏；导出、删除、合并、转派和批量发送必须审计", "删除采用可恢复软删除及保留策略，正式清理需要审批和备份凭证"] },
  { title: "单机到多服务器", items: ["应用层保持无状态，租户上下文由服务端验证而非前端信任", "任务、邮件、同步和报表进入可重试队列，使用幂等键避免重复执行", "数据库、对象存储、缓存和任务节点可独立扩容，版本发布支持灰度与回滚"] },
] as const;

const CRM_DELIVERY_PHASES = [
  ["阶段 1", "统一数据契约", "完成租户字段、客户/联系人/机会模型、唯一键和审计字段。"],
  ["阶段 2", "询盘到商机", "打通多渠道录入、去重、评分、分配、公海与跟进任务。"],
  ["阶段 3", "报价到订单", "落地需求、样品、报价审批、合同与赢单/输单闭环。"],
  ["阶段 4", "营销自动化", "上线分群、邮件序列、频控、退订、归因与复购提醒。"],
  ["阶段 5", "经营驾驶舱", "形成代理、客户、计划三级指标和数据质量告警。"],
  ["阶段 6", "规模化部署", "完成队列、幂等、灰度、灾备、容量压测和多服务器演练。"],
] as const;

function CrmDevelopmentStandardModule() {
  return (
    <section data-crm-development-standard data-development-standard-hidden-route="crm" className="space-y-5">
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 via-white to-cyan-50">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-4xl">
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Building2 className="h-5 w-5 text-blue-600" />
                CRM 管理 · B2B 工厂客户开发规范
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                本模块只在“规范”入口显示，不加入 CRM 二级栏目。它用于约束模板发布、租户隔离、工厂销售流程、营销自动化和后期多服务器部署；业务人员仍在 CRM 原有栏目处理真实客户数据。
              </p>
            </div>
            <Badge className="bg-blue-600 text-white">规范专用 · 不进入二级导航</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">模板链与数据所有权</CardTitle>
          <p className="text-sm text-slate-500">版本向下发布，真实业务数据留在产生它的租户内；结构同步与数据同步必须分开。</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {CRM_TEMPLATE_CHAIN.map((item, index) => (
            <article key={item.title} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs text-blue-700">{formatDisplayOrdinal(index + 1)}</span>
                {item.title}
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">{item.description}</p>
            </article>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">工厂客户经营主流程</CardTitle>
          <p className="text-sm text-slate-500">每一阶段都必须具备负责人、完成条件、下一动作、超时规则和审计记录。</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {CRM_FACTORY_PIPELINE.map(([order, title, description]) => (
            <article key={order} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2"><Badge variant="outline">{order}</Badge><h2 className="text-sm font-semibold text-slate-900">{title}</h2></div>
              <p className="mt-2 text-xs leading-5 text-slate-600">{description}</p>
            </article>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {CRM_STANDARD_DOMAINS.map((domain) => (
          <Card key={domain.title} data-crm-standard-domain>
            <CardHeader className="pb-2"><CardTitle className="text-base">{domain.title}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {domain.items.map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-600">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />{item}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">分阶段落地顺序</CardTitle>
          <p className="text-sm text-slate-500">前一阶段通过数据隔离、权限、幂等和回归验收后再进入下一阶段。</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {CRM_DELIVERY_PHASES.map(([phase, title, acceptance]) => (
            <article key={phase} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Clock className="h-4 w-4 text-blue-600" />{phase} · {title}</div>
              <p className="mt-2 text-xs leading-5 text-slate-600">{acceptance}</p>
            </article>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

export default function Customers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const siteId = searchParams.get("siteId");
  const currentTab = searchParams.get("tab") || "summary";
  const [snapshot, setSnapshot] = useState<ClientLiveSnapshot | null>(null);

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void loadClientLiveSnapshot().then((next) => {
        if (mounted) {
          setSnapshot(next);
        }
      });
    };

    refresh();
    window.addEventListener("sites-updated", refresh);
    window.addEventListener("site-project-version-updated", refresh);
    return () => {
      mounted = false;
      window.removeEventListener("sites-updated", refresh);
      window.removeEventListener("site-project-version-updated", refresh);
    };
  }, []);

  const projects = useMemo(() => (snapshot ? collectClientProjects(snapshot) : []), [snapshot]);
  const governedProjectId = useMemo(() => {
    const value = siteId ? getSiteById(siteId)?.planId : null;
    return typeof value === "number" && value > 0 ? value : null;
  }, [siteId]);
  const customers = useMemo(() => (snapshot ? deriveClientCustomers(snapshot) : []), [snapshot]);
  const opportunities = useMemo(() => buildOpportunityRows(projects), [projects]);
  const poolRows = useMemo(() => (snapshot ? buildPoolRows(snapshot, customers) : []), [snapshot, customers]);
  const emailRows = useMemo(() => buildEmailRows(projects), [projects]);
  const folderRows = useMemo(() => buildFolderRows(projects), [projects]);
  const campaignRows = useMemo(() => buildCampaignRows(projects), [projects]);

  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next);
  };

  const ready = !!snapshot;

  return (
    <FactoryPage pageId="client-customers" template="workflow" sourceScope="client_source" autoRegions>
      <div data-page-layout-surface data-page-layout-frame className="space-y-6">
      <div data-page-title>
        <h1 className="text-2xl font-bold text-slate-900">CRM 管理</h1>
        <p data-shared-title-description className="mt-1 text-sm text-slate-500">
          客户、商机、邮件和文件统一从总部 - 代理 - 客户 - 计划真实链路派生，最新数据优先显示。
        </p>
      </div>

      <SiteContextCard siteId={siteId} />

      {governedProjectId ? <CrmGovernance projectId={governedProjectId} /> : null}

      {currentTab === "development" ? (
        <CrmDevelopmentStandardModule />
      ) : !ready ? (
        <Card className="">
          <CardContent className="flex items-center gap-3 p-5 text-sm text-slate-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            正在载入 CRM 真实数据...
          </CardContent>
        </Card>
      ) : (
        <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList data-client-project-subnav className="flex h-auto flex-wrap justify-start gap-2 bg-slate-100 p-1">
            <TabsTrigger value="summary">工作概览</TabsTrigger>
            <TabsTrigger value="opportunities">商机数据</TabsTrigger>
            <TabsTrigger value="pool">客户公海</TabsTrigger>
            <TabsTrigger value="clients">客户管理</TabsTrigger>
            <TabsTrigger value="emails">邮件管理</TabsTrigger>
            <TabsTrigger value="folders">文件夹</TabsTrigger>
            <TabsTrigger value="marketing">邮件营销</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <CrmSummary snapshot={snapshot} customers={customers} opportunities={opportunities} />
          </TabsContent>
          <TabsContent value="opportunities">
            <OpportunityTab opportunities={opportunities} />
          </TabsContent>
          <TabsContent value="pool">
            <CustomerPoolTab poolRows={poolRows} />
          </TabsContent>
          <TabsContent value="clients">
            <CustomerManagementTab customers={customers} />
          </TabsContent>
          <TabsContent value="emails">
            <EmailManagementTab emailRows={emailRows} />
          </TabsContent>
          <TabsContent value="folders">
            <FolderManagementTab folders={folderRows} />
          </TabsContent>
          <TabsContent value="marketing">
            <EmailMarketingTab campaigns={campaignRows} />
          </TabsContent>
        </Tabs>
      )}
      </div>
    </FactoryPage>
  );
}
