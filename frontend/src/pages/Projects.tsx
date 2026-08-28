import { useEffect, useMemo, useState } from "react";

import { Link, useLocation, useNavigate } from "react-router-dom";

import { Check, ChevronDown, Copy, ExternalLink, FolderOpen, Globe, Plus, Sparkles, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { Card, CardContent } from "@/components/ui/card";

import { Input } from "@/components/ui/input";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { toast } from "@/hooks/use-toast";

import { getAIBuilderScope, resolveClientRoute } from "@/lib/ai-builder-scope";

import type, { SiteBuilderState } from "@/lib/ai-site-builder";

import { copyTextWithFallback, openUrlInExternalBrowser } from "@/lib/browser-utils";

import { platformApi, type PlatformNode } from "@/lib/platform-api";

import { resolveCurrentClientContext } from "@/lib/platform-live";

import { useProductMarketStore } from "@/lib/product-market-store";

import { resolveSiteDisplayName } from "@/lib/site-display-name";
import { FactoryPage } from "@/page-factory/FactoryPage";

import { createSiteProjectVersion, formatSiteVersionId, getCurrentSiteProjectVersion, readSiteProjectVersions, setCurrentSiteProjectVersion, type SiteProjectVersionEntry } from "@/lib/site-project-version";

import { deleteSite, deleteSiteFromBackend, deleteSitesByScope, deleteSitesByScopeFromBackend, fetchAllSitesFromBackend, getAllSites, getPreferredSites, getSitePublicUrl, needsPublishedSiteMigration, resolveSiteLogoUrl, saveSite, syncSiteToBackend, type PublishedSite } from "@/lib/sites";

import { hasPendingSiteSwitchLoading, startSiteSwitchLoading } from "@/lib/site-switch-loading";

import { sanitizeDisplayText } from "@/lib/text-sanitizer";

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return hex;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function withAlpha(color: string, alpha: number) {
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return hexToRgba(trimmed, alpha);
  const match = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (match) return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
  return color;
}

function buildSiteAdminRoute(baseRoute: string, siteId: string) {
  return `${baseRoute}?siteId=${encodeURIComponent(siteId)}`;
}

function parsePlanSequence(planCode?: string | null, planName?: string | null) {
  const codeMatch = String(planCode || "")
    .toUpperCase()
    .match(/J0*([1-9]\d*)/);
  if (codeMatch) return Number(codeMatch[1]) || 0;

  const nameMatch = String(planName || "").match(/计划\s*([1-9]\d*)/);
  if (nameMatch) return Number(nameMatch[1]) || 0;

  return 0;
}

function getSiteBadge(site: PublishedSite) {
  const builderState = (site.builderState || {}) as Record<string, unknown>;
  const rawBrandName = typeof builderState.brandName === "string" ? builderState.brandName.trim() : "";
  const brandName = rawBrandName || site.name.trim();
  const logoText = brandName.trim().charAt(0);

  return {
    brandName,
    logoText,
    logoUrl: resolveSiteLogoUrl(site),
  };
}

function formatVersionLabel(versionId: string) {
  return formatSiteVersionId(versionId);
}

type ClientPlanRow = {
  project: PlatformNode["projects"][number];
  client: PlatformNode;
  agency: PlatformNode | null;
  site: PublishedSite | null;
};

export default function Projects() {
  const location = useLocation();
  const navigate = useNavigate();
  const scope = getAIBuilderScope(location.pathname);
  const aiChatRoute = resolveClientRoute(location.pathname, "/ai-chat");
  const { layoutStyle, sidebarStyle, globalFontFamily, globalFontWeight, globalLetterSpacing } = useProductMarketStore();

  const [sites, setSites] = useState<PublishedSite[]>([]);
  const [platformTree, setPlatformTree] = useState<PlatformNode[]>([]);
  const [platformLoading, setPlatformLoading] = useState(true);
  const [platformError, setPlatformError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [versionTick, setVersionTick] = useState(0);
  const [restoringSiteId, setRestoringSiteId] = useState<string | null>(null);
  const [planNameDrafts, setPlanNameDrafts] = useState<Record<string, string>>({});
  const [savingPlanId, setSavingPlanId] = useState<number | null>(null);

  const load = async (preferBackend = false) => {
    const sitePromise = preferBackend ? fetchAllSitesFromBackend() : Promise.resolve(getAllSites());
    const [siteResult, treeResult] = await Promise.allSettled([sitePromise, platformApi.tree()]);

    const source = siteResult.status === "fulfilled" ? siteResult.value : getAllSites();
    setSites(getPreferredSites(source.filter((site) => (site.scope || "client") === scope)));

    if (treeResult.status === "fulfilled") {
      setPlatformTree(treeResult.value.items || []);
      setPlatformError("");
    } else {
      setPlatformError(treeResult.reason instanceof Error ? treeResult.reason.message : "计划数据加载失败");
    }
    setPlatformLoading(false);
  };

  useEffect(() => {
    void load(true);
    const handleRefresh = () => {
      void load(false);
      setVersionTick((value) => value + 1);
    };

    window.addEventListener("sites-updated", handleRefresh);
    window.addEventListener("site-project-version-updated", handleRefresh);
    window.addEventListener("storage", handleRefresh);

    return () => {
      window.removeEventListener("sites-updated", handleRefresh);
      window.removeEventListener("site-project-version-updated", handleRefresh);
      window.removeEventListener("storage", handleRefresh);
    };
  }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const targets = sites.filter((site) => needsPublishedSiteMigration(site));
    if (!targets.length) return;

    let cancelled = false;
    void (async () => {
      for (const site of targets) {
        if (cancelled) return;
        const synced = await syncSiteToBackend(site);
        if (synced && !cancelled) {
          saveSite(synced);
        }
      }
      if (!cancelled) {
        void load(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sites]); // eslint-disable-line react-hooks/exhaustive-deps

  const versionMap = useMemo(() => {
    void versionTick;
    const next = new Map<string, string>();
    sites.forEach((site) => {
      next.set(site.id, formatSiteVersionId(getCurrentSiteProjectVersion(site.id)?.id || "J1"));
    });
    return next;
  }, [sites, versionTick]);

  const versionHistoryMap = useMemo(() => {
    void versionTick;
    const next = new Map<string, SiteProjectVersionEntry[]>();
    sites.forEach((site) => next.set(site.id, readSiteProjectVersions(site.id)));
    return next;
  }, [sites, versionTick]);

  const currentClientContext = useMemo(
    () =>
      resolveCurrentClientContext(platformTree, {
        url: typeof window !== "undefined" ? window.location.href : "",
        fallbackSites: sites,
      }),
    [platformTree, sites]
  );

  const listHeaderCardStyle = useMemo(
    () => ({
      background: `linear-gradient(135deg, ${layoutStyle.contentBgColor || sidebarStyle.bgFrom}, ${
        layoutStyle.contentBgColor || sidebarStyle.bgVia
      }, ${layoutStyle.contentBgColor || sidebarStyle.bgTo})`,
      borderColor: withAlpha(sidebarStyle.borderColor || "#ffffff", 0.35),
      color:
        layoutStyle.contentTextColor ||
        sidebarStyle.textColor ||
        layoutStyle.themePanelTextColor ||
        "#0f172a",
      fontFamily: globalFontFamily || sidebarStyle.fontFamily || "system-ui, sans-serif",
      fontWeight: globalFontWeight || sidebarStyle.fontWeight || "400",
      letterSpacing: globalLetterSpacing || sidebarStyle.letterSpacing || "0.02em",
    }),
    [
      globalFontFamily,
      globalFontWeight,
      globalLetterSpacing,
      layoutStyle.contentBgColor,
      layoutStyle.contentTextColor,
      layoutStyle.themePanelTextColor,
      sidebarStyle,
    ]
  );

  const listHeaderCellStyle = useMemo(
    () => ({
      backgroundColor:
        layoutStyle.clientSecondaryTitleBgColor ||
        layoutStyle.defaultDialogHeaderBgColor ||
        layoutStyle.headerBgColor ||
        "#0f172a",
      color:
        layoutStyle.clientSecondaryTitleTextColor ||
        layoutStyle.defaultDialogHeaderTextColor ||
        layoutStyle.headerTextColor ||
        "#ffffff",
      borderColor: withAlpha(sidebarStyle.borderColor || "#ffffff", 0.2),
    }),
    [
      layoutStyle.clientSecondaryTitleBgColor,
      layoutStyle.clientSecondaryTitleTextColor,
      layoutStyle.defaultDialogHeaderBgColor,
      layoutStyle.defaultDialogHeaderTextColor,
      layoutStyle.headerBgColor,
      layoutStyle.headerTextColor,
      sidebarStyle.borderColor,
    ]
  );

  const planRows = useMemo(() => {
    const currentClient = currentClientContext.client;
    if (!currentClient) return [] as ClientPlanRow[];

    const scopedSites = getPreferredSites(sites.filter((site) => !site.clientCode || site.clientCode === currentClient.code));
    const siteByPlanCode = new Map<string, PublishedSite>();
    scopedSites.forEach((site) => {
      if (site.planCode && !siteByPlanCode.has(site.planCode)) {
        siteByPlanCode.set(site.planCode, site);
      }
    });

    const rows: ClientPlanRow[] = [...currentClient.projects]
      .sort((a, b) => parsePlanSequence(b.code, b.name) - parsePlanSequence(a.code, a.name))
      .map((project) => ({
        project,
        client: currentClient,
        agency: currentClientContext.agency,
        site: siteByPlanCode.get(project.code) || null,
      }));

    return rows.sort((a, b) => {
      const sequenceDiff = parsePlanSequence(b.project.code, b.project.name) - parsePlanSequence(a.project.code, a.project.name);
      if (sequenceDiff !== 0) return sequenceDiff;
      const aId = Number(a.site?.planId || a.project.id || 0);
      const bId = Number(b.site?.planId || b.project.id || 0);
      if (aId !== bId) return bId - aId;
      return String(a.project.code).localeCompare(String(b.project.code));
    });
  }, [currentClientContext, sites]);

  useEffect(() => {
    setPlanNameDrafts((current) => {
      const next: Record<string, string> = {};
      planRows.forEach((row) => {
        const key = String(row.project.id);
        next[key] = row.site?.planName?.trim() || row.project.name || current[key] || "";
      });
      return next;
    });
  }, [planRows]);

  const handlePlanNameDraftChange = (projectId: number, value: string) => {
    setPlanNameDrafts((current) => ({ ...current, [String(projectId)]: value }));
  };

  const handleSavePlanName = async (row: ClientPlanRow) => {
    const draftKey = String(row.project.id);
    const nextName = (planNameDrafts[draftKey] || "").trim();
    if (!nextName) {
      toast({ title: "站点计划名称不能为空" });
      return;
    }

    setSavingPlanId(row.project.id);
    try {
      await platformApi.updateProject(row.project.id, { name: nextName });

      if (row.site) {
        const nextSite: PublishedSite = {
          ...row.site,
          name: nextName,
          planName: nextName,
          updatedAt: new Date().toISOString(),
        };
        saveSite(nextSite);
        await syncSiteToBackend(nextSite);
      }

      await load(true);
      toast({ title: "站点计划名称已保存", description: nextName });
    } catch (error) {
      toast({
        title: "站点计划名称保存失败",
        description: error instanceof Error ? error.message : "请稍后重试",
      });
    } finally {
      setSavingPlanId(null);
    }
  };

  const handleDeleteRow = (row: ClientPlanRow) => {
    const site = row.site;
    const label = site ? resolveSiteDisplayName(site, row.project.code) : sanitizeDisplayText(row.project.name, row.project.code);
    if (!window.confirm(`确定删除计划“${label}”吗？删除后会同步移除真实平台计划与对应站点。`)) return;

    const tasks: Array<Promise<unknown>> = [];
    if (site) {
      deleteSite(site.id);
      tasks.push(deleteSiteFromBackend(site.id));
    }
    if (!site && row.project.id > 0) {
      tasks.push(platformApi.deleteProject(row.project.id));
    }
    void Promise.allSettled(tasks).then(() => load(true));
  };

  const handleClearAll = () => {
    if (!planRows.length) return;
    if (!window.confirm("确定清空当前端口下的全部已创建计划吗？清空后，对应站点和版本记录都会被删除。")) return;

    const tasks: Array<Promise<unknown>> = [];
    deleteSitesByScope(scope);
    tasks.push(deleteSitesByScopeFromBackend(scope));
    planRows
      .filter((row) => !row.site && row.project.id > 0)
      .forEach((row) => {
        tasks.push(platformApi.deleteProject(row.project.id));
      });
    void Promise.allSettled(tasks).then(() => load(true));
  };

  const handleCopy = async (site: PublishedSite, id: string) => {
    const url = getSitePublicUrl(site);
    const copied = await copyTextWithFallback(url, () => {
      toast({ title: "复制失败", description: "请手动选中网址后再复制。" });
    });

    if (!copied) return;
    setCopiedId(id);
    toast({ title: "已复制", description: url });
    window.setTimeout(() => setCopiedId(null), 1500);
  };

  const openSiteInBrowser = async (site: PublishedSite) => {
    const synced = await syncSiteToBackend(site);
    const opened = await openUrlInExternalBrowser(getSitePublicUrl(synced || site));
    if (!opened) {
      toast({ title: "打开失败", description: "暂时无法调用电脑默认浏览器，请确认本地环境已启动。" });
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const handleRestoreVersion = async (site: PublishedSite, versionId: string) => {
    const currentVersionId = formatSiteVersionId(getCurrentSiteProjectVersion(site.id)?.id || "J1");
    if (currentVersionId === versionId) return;

    const versions = versionHistoryMap.get(site.id) || [];
    const targetVersion = versions.find((entry) => entry.id === versionId);
    if (!targetVersion) {
      toast({ title: "恢复失败", description: "没有找到对应的历史版本。" });
      return;
    }

    const restorePlanName = resolveSiteDisplayName(site, site.planCode || site.id);
    if (!window.confirm(`确定将计划“${restorePlanName}”恢复到 ${versionId} 吗？恢复后会覆盖当前站点内容。`)) return;

    setRestoringSiteId(site.id);
    try {
      const restoredDisplayName = resolveSiteDisplayName(
        {
          ...site,
          name: targetVersion.siteName || site.name,
          builderState: targetVersion.builderState as unknown as Record<string, unknown>,
        },
        site.planCode || site.id
      );
      const restoredSite: PublishedSite = {
        ...site,
        name: restoredDisplayName,
        html: targetVersion.html,
        builderState: targetVersion.builderState as unknown as Record<string, unknown>,
        updatedAt: new Date().toISOString(),
      };

      saveSite(restoredSite);
      void syncSiteToBackend(restoredSite);

      const restoreRecord = createSiteProjectVersion(
        site.id,
        scope,
        restoredDisplayName,
        targetVersion.builderState as SiteBuilderState,
        targetVersion.html,
        `恢复到 ${versionId}`,
        { force: true }
      );

      if (restoreRecord) {
        setCurrentSiteProjectVersion(site.id, restoreRecord.id);
      }

      toast({
        title: "已恢复版本",
        description: `${restoredDisplayName} 已恢复到 ${versionId}${restoreRecord ? `，并生成新的恢复记录 ${restoreRecord.id}` : ""}`,
      });
    } finally {
      setRestoringSiteId(null);
      setVersionTick((value) => value + 1);
    }
  };

  const handleOpenAdmin = (site: PublishedSite, adminRoute: string, displayName: string) => {
    if (hasPendingSiteSwitchLoading()) {
      toast({
        title: "计划切换处理中",
        description: "当前计划正在同步，系统保持最短 5 秒保护，请稍后再进入其他计划。",
      });
      return;
    }
    startSiteSwitchLoading({
      source: "projects-admin-enter",
      targetPath: new URL(adminRoute, window.location.origin).pathname,
      targetSiteId: site.id,
      companyName: displayName,
    });
    navigate(adminRoute);
  };

  return (
    <FactoryPage pageId="client-projects" template="dashboard" sourceScope="client_source" autoRegions>
    <div data-page-layout-surface className="space-y-4 p-4 sm:p-5 lg:p-6">
      <div data-page-layout-frame>
      <div data-page-title className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">已创建计划</h1>
          <p className="mt-0.5 text-sm text-slate-500">计划列表现在优先读取真实客户与真实计划，已发布站点会自动挂接到对应计划。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleClearAll} disabled={!planRows.length}>
            <Trash2 className="mr-2 h-4 w-4" />
            清空计划
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() =>
              navigate(aiChatRoute, {
                state: { templateId: "b2b-machinery-multilang", source: "projects:new-plan" },
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            新增计划
          </Button>
        </div>
      </div>

      <div data-page-list>
        <div className="mb-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <h2 className="font-semibold text-slate-900">独立站计划列表</h2>
            <Badge variant="outline" className="text-xs">
              {planRows.length}
            </Badge>
            {currentClientContext.client ? (
              <Badge variant="outline" className="text-xs">
                {currentClientContext.client.code} {sanitizeDisplayText(currentClientContext.client.name, currentClientContext.client.code)}
              </Badge>
            ) : null}
          </div>
          <Link to={aiChatRoute} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
            前往 AI 建站 <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {platformError ? (
          <Card data-page-layout-card className="bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">真实计划数据加载失败：{platformError}</CardContent>
          </Card>
        ) : null}

        {platformLoading ? (
          <Card data-page-layout-card className="border-2 border-dashed border-slate-200 bg-slate-50/50">
            <CardContent className="p-10 text-center text-sm text-slate-500">正在加载真实客户与计划链路...</CardContent>
          </Card>
        ) : planRows.length === 0 ? (
          <Card data-page-layout-card className="border-2 border-dashed border-slate-200 bg-slate-50/50">
            <CardContent className="p-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-sky-500">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <h3 className="mb-1 font-semibold text-slate-900">当前客户还没有计划</h3>
              <p className="mb-4 text-sm text-slate-500">先创建或发布一个真实计划，发布后的站点会自动写入对应目录并显示在这里。</p>
              <Link to={aiChatRoute}>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Sparkles className="mr-2 h-4 w-4" />
                  立即创建
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <Card data-page-table-header className="overflow-hidden rounded-2xl shadow-sm" style={listHeaderCardStyle}>
              <CardContent className="p-0">
                <div className="grid gap-0 md:grid-cols-3">
                  <div className="border-b p-4 md:border-b-0 md:border-r" style={listHeaderCellStyle}>
                    <div className="grid grid-cols-[2.5rem_2.5rem_minmax(0,1fr)] items-center gap-3 text-sm font-semibold">
                      <span className="text-center">排序号</span>
                      <span className="text-center">商标</span>
                      <span className="truncate">站点计划名称</span>
                    </div>
                  </div>
                  <div
                    className="flex items-center justify-center border-b p-4 text-center md:border-b-0 md:border-r"
                    style={listHeaderCellStyle}
                  >
                    <div className="text-sm font-semibold">网站域名</div>
                  </div>
                  <div className="flex items-center justify-center p-4 text-center" style={listHeaderCellStyle}>
                    <div className="text-sm font-semibold">设置</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            {planRows.map((row, index) => {
              const site = row.site;
              const versionId = site ? versionMap.get(site.id) || "J1" : "未发布";
              const planDisplayName = site ? resolveSiteDisplayName(site, row.project.code) : sanitizeDisplayText(row.project.name, row.project.code);
              const sequenceNumber = parsePlanSequence(site?.planCode || row.project.code, planDisplayName) || index + 1;
              const versions = site ? versionHistoryMap.get(site.id) || [] : [];
              const adminRoute = site ? buildSiteAdminRoute(aiChatRoute, site.id) : aiChatRoute;
              const siteBadge = site
                ? getSiteBadge(site)
                : {
                    brandName: planDisplayName,
                    logoText: planDisplayName.charAt(0),
                    logoUrl: null,
                  };
              const siteUrl = site ? getSitePublicUrl(site) : "";

              return (
                <Card
                  data-page-layout-card
                  data-page-list-item
                  key={`${row.client.code}:${row.project.code}:${site?.id || "plan"}`}
                  className="overflow-hidden rounded-2xl bg-white shadow-sm transition-shadow hover:shadow-md"
                  style={{
                    backgroundColor:
                      layoutStyle.clientFeatureCardBgColor ||
                      layoutStyle.clientCardBgColor ||
                      layoutStyle.defaultDialogContentBgColor ||
                      layoutStyle.defaultDialogBgColor ||
                      "#ffffff",
                    color:
                      layoutStyle.clientFeatureCardTextColor ||
                      layoutStyle.clientCardTextColor ||
                      layoutStyle.contentTextColor ||
                      layoutStyle.themePanelTextColor ||
                      "#0f172a",
                    borderColor: withAlpha(sidebarStyle.borderColor || "#e2e8f0", 0.26),
                  }}
                >
                  <CardContent className="p-0">
                    <div className="grid gap-0 md:grid-cols-3">
                      <div className="flex items-center gap-3 border-b border-slate-100 p-4 md:border-b-0 md:border-r md:border-slate-100">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-semibold text-white">
                          {sequenceNumber}
                        </span>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 text-xs font-semibold text-white">
                          {siteBadge.logoUrl ? (
                            <img src={siteBadge.logoUrl} alt={siteBadge.brandName} className="h-full w-full object-cover" />
                          ) : siteBadge.logoText ? (
                            <span>{siteBadge.logoText}</span>
                          ) : (
                            <Globe className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Input
                              value={planNameDrafts[String(row.project.id)] ?? ""}
                              onChange={(event) => handlePlanNameDraftChange(row.project.id, event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void handleSavePlanName(row);
                                }
                              }}
                              className="h-8 min-w-0 rounded-lg bg-white px-2.5 text-sm font-semibold text-slate-900"
                              maxLength={40}
                              placeholder="请输入站点计划名称"
                              aria-label={`站点计划名称 ${row.project.code}`}
                            />
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 shrink-0 bg-slate-900 px-3 text-xs text-white hover:bg-slate-800"
                              onClick={() => void handleSavePlanName(row)}
                              disabled={savingPlanId === row.project.id}
                            >
                              {savingPlanId === row.project.id ? "保存中" : "保存"}
                            </Button>
                          </div>
                          <div className="truncate text-[11px] text-slate-500">{row.project.code}</div>
                        </div>
                      </div>

                      <div className="border-b border-slate-100 p-4 md:border-b-0 md:border-r md:border-slate-100">
                        {site ? (
                          <div className="flex h-full items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => site && void openSiteInBrowser(site)} disabled={!site} className="h-8">
                              <Globe className="mr-1.5 h-3.5 w-3.5" />
                              访问网站
                            </Button>
                            <div className="min-w-0 flex-1">
                              <input
                                readOnly
                                value={siteUrl}
                                onFocus={(event) => event.currentTarget.select()}
                                onClick={(event) => event.currentTarget.select()}
                                className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[11px] text-blue-700 outline-none"
                                title="点击自动选中网址"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 shrink-0 px-2 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                              onClick={() => void handleCopy(site, site.id)}
                              title="复制网址"
                            >
                              {copiedId === site.id ? (
                                <>
                                  <Check className="mr-1 h-3 w-3 shrink-0 text-emerald-500" />
                                  <span className="shrink-0 text-emerald-600">已复制</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="mr-1 h-3 w-3 shrink-0 opacity-60" />
                                  <span className="shrink-0">复制</span>
                                </>
                              )}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex h-full items-center text-xs text-slate-400">当前计划还没有发布对应站点文件</div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 p-4">
                        <div className="flex flex-wrap gap-2">
                          {site ? (
                            <Button
                              className="bg-slate-900 text-white hover:bg-slate-800"
                              onClick={() => handleOpenAdmin(site, adminRoute, planDisplayName)}
                            >
                              <FolderOpen className="mr-2 h-4 w-4" />
                              进入后台
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              onClick={() =>
                                navigate(
                                  `${aiChatRoute}?client=${encodeURIComponent(row.client.code)}&plan=${encodeURIComponent(
                                    row.project.code
                                  )}&planName=${encodeURIComponent(planDisplayName)}`
                                )
                              }
                            >
                              <FolderOpen className="mr-2 h-4 w-4" />
                              去发布
                            </Button>
                          )}
                          {site && versions.length ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 shrink-0 gap-1 rounded-full bg-white px-2.5 text-xs"
                                  disabled={restoringSiteId === site.id}
                                >
                                  恢复版本
                                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-56">
                                <DropdownMenuLabel className="text-xs text-slate-500">当前版本 {formatVersionLabel(versionId)}</DropdownMenuLabel>
                                {versions.map((entry) => (
                                  <DropdownMenuItem
                                    key={entry.id}
                                    onClick={() => void handleRestoreVersion(site, entry.id)}
                                    className="flex flex-col items-start gap-0.5 py-2"
                                  >
                                    <span className="text-sm font-medium text-slate-900">{formatVersionLabel(entry.id)}</span>
                                    <span className="text-[11px] text-slate-500">{formatDate(entry.createdAt)}</span>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-10 w-10 shrink-0 p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                          onClick={() => handleDeleteRow(row)}
                          title="删除计划"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
    </FactoryPage>
  );
}
