import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Globe, Download, FolderOpen, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FactoryPage } from "@/page-factory/FactoryPage";
import SiteAIAssignmentBadges from "@/components/SiteAIAssignmentBadges";
import { fetchAllSitesFromBackend, getSitePublicUrl, type PublishedSite } from "@/lib/sites";
import { resolveCurrentAgencyContext } from "@/lib/platform-live";
import { platformApi, type PlatformNode } from "@/lib/platform-api";

function parseSiteTime(value?: string) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function formatDateLabel(value?: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function sortSitesLatestFirst(sites: PublishedSite[]) {
  return [...sites].sort((a, b) => {
    const updatedDiff = parseSiteTime(b.updatedAt) - parseSiteTime(a.updatedAt);
    if (updatedDiff !== 0) return updatedDiff;
    const createdDiff = parseSiteTime(b.createdAt) - parseSiteTime(a.createdAt);
    if (createdDiff !== 0) return createdDiff;
    return b.id.localeCompare(a.id);
  });
}

function deriveDomainLabel(site: PublishedSite) {
  const publicUrl = getSitePublicUrl(site);
  try {
    const parsed = new URL(publicUrl);
    if (parsed.hostname === "127.0.0.1") {
      return `${parsed.hostname}:${parsed.port}${site.urlPath || parsed.pathname}`;
    }
    return parsed.host;
  } catch {
    return site.publicUrl || site.urlPath || "-";
  }
}

export default function AgencySites() {
  const [sites, setSites] = useState<PublishedSite[]>([]);
  const [tree, setTree] = useState<PlatformNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const [items, treeResponse] = await Promise.all([fetchAllSitesFromBackend(), platformApi.tree()]);
        if (!mounted) return;
        setSites(sortSitesLatestFirst(items.filter((site) => (site.scope || "client") === "client")));
        setTree(treeResponse.items || []);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "加载站点失败");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const currentAgencyCode = useMemo(
    () =>
      resolveCurrentAgencyContext(tree, {
        url: typeof window !== "undefined" ? window.location.href : "",
        fallbackSites: sites,
      }).agency?.code || "",
    [sites, tree]
  );
  const agencySites = useMemo(
    () => sites.filter((site) => (site.agencyCode || "").trim().toUpperCase() === currentAgencyCode),
    [sites, currentAgencyCode]
  );
  const currentAgencyName = agencySites[0]?.agencyName || currentAgencyCode || "当前代理";

  const stats = useMemo(
    () => [
      { label: "当前代理", value: currentAgencyCode || "-" },
      { label: "已发布网站", value: agencySites.length },
      { label: "覆盖客户", value: new Set(agencySites.map((site) => site.clientCode).filter(Boolean)).size },
      { label: "最新计划", value: agencySites[0]?.planCode || "-" },
    ],
    [agencySites, currentAgencyCode]
  );

  return (
    <FactoryPage pageId="agency-sites" template="dashboard" sourceScope="agency_source" className="space-y-6">
      <div data-page-factory-region="content" data-development-standard-frame-region="content" data-development-standard-frame-label="内容" className="space-y-6">
      <div data-page-factory-region="title-2" data-development-standard-frame-region="title-2" data-development-standard-frame-label="标题二" className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">站点管理</h1>
          <p className="mt-1 text-sm text-slate-500">当前查看 {currentAgencyName} 名下全部真实已发布网站</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          导出
        </Button>
      </div>

      <div data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <Card key={item.label} data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" className="border-slate-200">
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">{item.label}</div>
              <div className="text-2xl font-bold text-slate-900">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">代理站点数据加载失败：{error}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card className="border-slate-200">
          <CardContent className="p-5 text-sm text-slate-500">正在加载代理真实站点列表...</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {agencySites.map((site) => (
            <Card key={site.id} className="border-slate-200 hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
                    <Globe className="h-5 w-5 text-white" />
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-700">
                    已发布
                  </Badge>
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-slate-900">{site.planName || site.name}</h3>
                  <div className="font-mono text-[11px] text-slate-500">{site.planCode || site.id}</div>
                </div>

                <SiteAIAssignmentBadges siteId={site.id} />

                <div className="mt-4 space-y-2 text-xs text-slate-500">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      客户
                    </span>
                    <span className="font-medium text-slate-700">
                      {site.clientName || "-"} {site.clientCode ? `(${site.clientCode})` : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>访问地址</span>
                    <a
                      href={getSitePublicUrl(site)}
                      target="_blank"
                      rel="noreferrer"
                      className="max-w-[220px] truncate text-cyan-700 hover:underline"
                    >
                      {deriveDomainLabel(site)}
                    </a>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1">
                      <FolderOpen className="h-3 w-3" />
                      本地目录
                    </span>
                    <span className="max-w-[220px] truncate text-slate-700">{site.urlPath || "-"}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-xs text-slate-500">更新于 {formatDateLabel(site.updatedAt || site.createdAt)}</span>
                  <div className="flex items-center gap-2">
                    <Link to={`/dl/kh/company-info?siteId=${encodeURIComponent(site.id)}`}>
                      <Button size="sm" className="h-8 bg-slate-900 text-white hover:bg-slate-800">
                        进入后台
                      </Button>
                    </Link>
                    <a
                      href={getSitePublicUrl(site)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline"
                    >
                      访问网站
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>
    </FactoryPage>
  );
}
