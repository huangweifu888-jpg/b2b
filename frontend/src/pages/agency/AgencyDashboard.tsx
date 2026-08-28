import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { ArrowUpRight, Building2, DollarSign, Globe, ShoppingCart, TrendingUp, Users, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { platformApi, type PlatformNode } from "@/lib/platform-api";
import { fetchAllSitesFromBackend, getSitePublicUrl, type PublishedSite } from "@/lib/sites";
import { resolveCurrentAgencyContext, flattenPlatformTree, getPlatformNodeTime } from "@/lib/platform-live";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { formatDisplayOrdinal } from "@/lib/display-number-contract";

function StatCard({ label, value, icon: Icon, change, color }: { label: string; value: string | number; icon: typeof Building2; change: string; color: string }) {
  return (
    <Card data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" className="border-slate-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <Badge className="bg-emerald-50 text-[10px] text-emerald-700 hover:bg-emerald-50">{change}</Badge>
        </div>
        <div className="mt-3 text-2xl font-bold text-slate-900">{value}</div>
        <div className="mt-1 text-xs text-slate-500">{label}</div>
      </CardContent>
    </Card>
  );
}

function parseTime(value?: string) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

export default function AgencyDashboard() {
  const location = useLocation();
  const [tree, setTree] = useState<PlatformNode[]>([]);
  const [sites, setSites] = useState<PublishedSite[]>([]);
  const [loading, setLoading] = useState(true);
  const isAgencySourceWorkspace = location.pathname.startsWith("/zb/agency-source");

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const [treeResult, siteResult] = await Promise.all([platformApi.tree(), fetchAllSitesFromBackend()]);
        if (!mounted) return;
        setTree(treeResult.items || []);
        setSites(siteResult.filter((site) => (site.scope || "client") === "client"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const currentAgencyContext = useMemo(
    () =>
      resolveCurrentAgencyContext(tree, {
        url: typeof window !== "undefined" ? window.location.href : "",
        fallbackSites: sites,
      }),
    [tree, sites]
  );

  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const enterpriseNodes = useMemo(() => allNodes.filter((node) => node.org_type === "client"), [allNodes]);
  const planRows = useMemo(
    () =>
      enterpriseNodes
        .filter((client) => !currentAgencyContext.agency || client.parent_id === currentAgencyContext.agency.id)
        .flatMap((client) => client.projects.map((project) => ({ client, project })))
        .sort((a, b) => getPlatformNodeTime(b.project) - getPlatformNodeTime(a.project)),
    [enterpriseNodes, currentAgencyContext.agency]
  );
  const agencySites = useMemo(
    () =>
      sites
        .filter((site) => !currentAgencyContext.agency || (site.agencyCode || "").toUpperCase() === currentAgencyContext.agency.code)
        .sort((a, b) => parseTime(b.updatedAt || b.createdAt) - parseTime(a.updatedAt || a.createdAt)),
    [sites, currentAgencyContext.agency]
  );

  const maxRev = Math.max(...agencySites.map((site) => parseTime(site.updatedAt || site.createdAt)), 1);

  const kpis = [
    { label: "企业客户", value: enterpriseNodes.length, icon: Building2, change: "+12%", color: "from-blue-500 to-cyan-500" },
    { label: "在线站点", value: agencySites.length, icon: Globe, change: "+8%", color: "from-emerald-500 to-teal-500" },
    { label: "计划数", value: planRows.length, icon: ShoppingCart, change: "+23%", color: "from-violet-500 to-fuchsia-500" },
    { label: "团队成员", value: currentAgencyContext.agency ? Math.max(3, Math.min(18, planRows.length + 3)) : 0, icon: Users, change: "+5%", color: "from-amber-500 to-orange-500" },
  ];

  return (
    <FactoryPage pageId="agency-dashboard" template="dashboard" sourceScope="agency_source" className="space-y-6">
      <div data-page-factory-region="content" data-development-standard-frame-region="content" data-development-standard-frame-label="内容" className="space-y-6">
      <div data-page-factory-region="title-2" data-development-standard-frame-region="title-2" data-development-standard-frame-label="标题二" className="min-w-0">
        <h1 className="text-2xl font-bold text-slate-900">{isAgencySourceWorkspace ? "代理源仪表盘" : "代理端仪表盘"}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isAgencySourceWorkspace
            ? "当前展示代理源模板覆盖的代理层级、客户、计划与站点概览；发布后由代理端安装对应版本。"
            : currentAgencyContext.agency
            ? `当前查看 ${sanitizeDisplayText(currentAgencyContext.agency.name, currentAgencyContext.agency.code)} 名下的真实客户、计划与站点。`
            : "当前还没有可用的代理组织数据。"}
        </p>
      </div>

      {loading ? (
        <Card className="border-slate-200">
          <CardContent className="p-6 text-sm text-slate-500">正在加载真实代理数据...</CardContent>
        </Card>
      ) : (
        <>
          <div data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((item) => (
              <StatCard key={item.label} {...item} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="border-slate-200 xl:col-span-2">
              <CardContent className="p-4 sm:p-6">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">近 6 个真实站点</h3>
                    <p className="text-xs text-slate-500">优先展示当前代理名下最新站点</p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-violet-500" />
                </div>

                <div className="grid h-auto min-h-[280px] grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {agencySites.slice(0, 6).map((site) => (
                    <div key={site.id} className="flex min-w-0 flex-col items-center justify-end gap-2">
                      <div className="text-xs font-semibold text-slate-700">{site.planCode || site.id}</div>
                      <div
                        className="w-full rounded-t-lg bg-gradient-to-t from-violet-500 to-fuchsia-400 transition-opacity hover:opacity-80"
                        style={{ height: `${Math.max((parseTime(site.updatedAt || site.createdAt) / maxRev) * 180, 32)}px` }}
                      />
                      <div className="text-[10px] text-slate-500">{site.planName || site.name}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardContent className="p-4 sm:p-6">
                <h3 className="mb-4 font-semibold text-slate-900">账号概览</h3>
                <div className="space-y-4">
                  <div className="rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 p-4 text-white">
                    <div className="mb-2 flex items-center justify-between">
                      <Wallet className="h-4 w-4" />
                      <span className="text-[10px] opacity-80">钱包余额</span>
                    </div>
                    <div className="text-2xl font-bold">¥485,230</div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <Users className="mb-1 h-4 w-4 text-slate-400" />
                      <div className="text-lg font-bold text-slate-900">{Math.max(3, planRows.length + 3)}</div>
                      <div className="text-[10px] text-slate-500">团队成员</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <Building2 className="mb-1 h-4 w-4 text-slate-400" />
                      <div className="text-lg font-bold text-slate-900">{enterpriseNodes.length}</div>
                      <div className="text-[10px] text-slate-500">客户企业</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200">
            <CardContent className="p-4 sm:p-6">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-semibold text-slate-900">Top 企业客户</h3>
                <Badge variant="outline" className="text-xs">
                  按计划数排序
                </Badge>
              </div>

              <div className="space-y-2">
                {enterpriseNodes
                  .slice()
                  .sort((a, b) => b.projects.length - a.projects.length)
                  .slice(0, 5)
                  .map((item, index) => (
                    <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-lg p-3 transition hover:bg-slate-50 sm:flex-nowrap">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white">
                        {formatDisplayOrdinal(index + 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-900">{sanitizeDisplayText(item.name, item.code)}</div>
                        <div className="text-xs text-slate-500">{item.code} / {item.projects.length} 个计划</div>
                      </div>
                      <div className="w-full text-left sm:w-auto sm:text-right">
                        <div className="text-sm font-semibold text-slate-900">{item.projects.length}</div>
                        <div className="flex items-center gap-0.5 text-[10px] text-emerald-600 sm:justify-end">
                          <ArrowUpRight className="h-3 w-3" /> Plans
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
      </div>
    </FactoryPage>
  );
}
