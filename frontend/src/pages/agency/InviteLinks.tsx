import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link2, Copy, Plus, TrendingUp, Users, CheckCircle2 } from "lucide-react";

import { loadAgencyLiveSnapshot } from "@/lib/agency-live-data";
import { deriveAgencyInviteLinks } from "@/lib/agency-derived-data";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { useLocation } from "react-router-dom";

function parseDate(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function InviteLinks() {
  const { pathname } = useLocation();
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

  const inviteLinks = useMemo(() => (snapshot ? deriveAgencyInviteLinks(snapshot) : []), [snapshot]);
  const totalSignups = inviteLinks.reduce((s, l) => s + l.signups, 0);
  const totalConverted = inviteLinks.reduce((s, l) => s + l.converted, 0);
  const conversionRate = totalSignups > 0 ? ((totalConverted / totalSignups) * 100).toFixed(1) : "0.0";
  const orderedInviteLinks = [...inviteLinks].sort((a, b) => parseDate(b.created) - parseDate(a.created) || b.id.localeCompare(a.id));

  return (
    <FactoryPage pageId={pathname.endsWith("/invites") ? "agency-invites" : "agency-invite-links"} template="dashboard" sourceScope="agency_source" className="space-y-6">
      <div data-page-factory-region="content" data-development-standard-frame-region="content" data-development-standard-frame-label="内容" className="space-y-6">
      <div data-page-factory-region="title-2" data-development-standard-frame-region="title-2" data-development-standard-frame-label="标题二" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">注册链接</h1>
          <p className="mt-1 text-sm text-slate-500">生成专属注册链接，带来的企业客户自动归属</p>
        </div>
        <Button className="self-start bg-violet-600 hover:bg-violet-700 sm:self-auto">
          <Plus className="mr-2 h-4 w-4" />
          生成链接
        </Button>
      </div>

      <div data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" className="border-slate-200"><CardContent className="p-4"><div className="text-xs text-slate-500">有效链接</div><div className="text-2xl font-bold">{inviteLinks.filter((l) => l.status === "active").length}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-4"><div className="flex items-center gap-1 text-xs text-slate-500"><TrendingUp className="h-3 w-3" />总点击</div><div className="text-2xl font-bold">{inviteLinks.reduce((s, l) => s + l.clicks, 0).toLocaleString()}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-4"><div className="flex items-center gap-1 text-xs text-slate-500"><Users className="h-3 w-3" />注册数</div><div className="text-2xl font-bold text-blue-600">{totalSignups}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-4"><div className="flex items-center gap-1 text-xs text-slate-500"><CheckCircle2 className="h-3 w-3" />转化数</div><div className="text-2xl font-bold text-emerald-600">{totalConverted}</div><div className="text-[10px] text-slate-400">转化率 {conversionRate}%</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {orderedInviteLinks.map((link) => (
          <Card key={link.id} className="border-slate-200 transition hover:shadow-md">
            <CardContent className="p-5">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
                    <Link2 className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{sanitizeDisplayText(link.name, "未命名链接")}</div>
                    <div className="text-[11px] text-slate-500">创建于 {link.created}</div>
                  </div>
                </div>
                <Badge className={link.status === "active" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>
                  {link.status === "active" ? "有效" : "已过期"}
                </Badge>
              </div>
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-50 p-2.5">
                <code className="flex-1 truncate text-[11px] font-mono text-slate-700">{sanitizeDisplayText(link.url, "未生成链接")}</code>
                <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0">
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                <div>
                  <div className="text-[10px] text-slate-500">点击</div>
                  <div className="text-sm font-semibold">{link.clicks.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">注册</div>
                  <div className="text-sm font-semibold text-blue-600">{link.signups}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">转化</div>
                  <div className="text-sm font-semibold text-emerald-600">{link.converted}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      </div>
    </FactoryPage>
  );
}
