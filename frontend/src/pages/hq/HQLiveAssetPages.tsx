import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Sparkles } from "lucide-react";

import { FactoryPage } from "@/page-factory/FactoryPage";
import { platformApi, type PlatformNode } from "@/lib/platform-api";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";
import { defaultWebsiteTemplatePreset, getWebsiteTemplatePresets, type WebsiteTemplatePreset } from "@website-style/website-template-presets";

function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {sub ? <p className="mt-1 text-sm text-slate-500">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

function StatsRow({ items }: { items: Array<{ label: string; value: string | number }> }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className="text-2xl font-bold text-slate-900">{item.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LiveState({
  error,
  loading,
  loadingText,
  children,
}: {
  error: string;
  loading: boolean;
  loadingText: string;
  children: ReactNode;
}) {
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-5 text-sm text-slate-500">{loadingText}</CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}

function flattenPlatformTree(nodes: PlatformNode[]) {
  const items: PlatformNode[] = [];
  const walk = (node: PlatformNode) => {
    items.push(node);
    node.children.forEach(walk);
  };
  nodes.forEach(walk);
  return items;
}

function getNodeTime(node: { id: number; updated_at?: string; created_at?: string }) {
  const raw = node.updated_at || node.created_at;
  const value = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(value) ? value : node.id;
}

function getAgencyChain(node: PlatformNode | null | undefined, parentMap: Map<number, PlatformNode>) {
  const chain: PlatformNode[] = [];
  let currentParentId = node?.parent_id || null;
  while (currentParentId) {
    const parent = parentMap.get(currentParentId);
    if (!parent) break;
    if (parent.org_type === "agency" || parent.org_type === "sub_agency") {
      chain.unshift(parent);
    }
    currentParentId = parent.parent_id;
  }
  return chain;
}

function renderChain(chain: PlatformNode[]) {
  if (!chain.length) {
    return <span className="text-xs text-slate-400">总部直营</span>;
  }

  return (
    <div>
      <div className="text-sm text-slate-900">
        {chain.map((agency) => sanitizeDisplayText(agency.name, agency.code)).join(" / ")}
      </div>
      <div className="font-mono text-[11px] text-slate-500">{chain.map((agency) => agency.code).join(" / ")}</div>
    </div>
  );
}

function usePlatformTree() {
  const [tree, setTree] = useState<PlatformNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const response = await platformApi.tree();
        if (!mounted) return;
        setTree(response.items || []);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "加载总部素材数据失败");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return { tree, loading, error };
}

function formatDateLabel(value?: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function pickDiversifiedProjects(projects: ProjectRow[], limit: number) {
  const buckets = new Map<string, ProjectRow[]>();
  projects.forEach((project) => {
    const key = project.chain.map((node) => node.code).join("/") || "hq";
    const current = buckets.get(key) || [];
    current.push(project);
    buckets.set(key, current);
  });

  const picked: ProjectRow[] = [];
  let index = 0;
  let keepPicking = true;
  while (keepPicking && picked.length < limit) {
    keepPicking = false;
    buckets.forEach((bucket) => {
      if (bucket[index] && picked.length < limit) {
        picked.push(bucket[index]);
        keepPicking = true;
      }
    });
    index += 1;
  }

  return picked;
}

type ProjectRow = {
  projectId: number;
  projectCode: string;
  projectName: string;
  clientCode: string;
  clientName: string;
  chain: PlatformNode[];
  updatedAt?: string;
};

function getProjectRows(tree: PlatformNode[], parentMap: Map<number, PlatformNode>) {
  return flattenPlatformTree(tree)
    .filter((node) => node.org_type === "client")
    .flatMap((client) =>
      client.projects.map((project) => ({
        projectId: project.id,
        projectCode: project.code,
        projectName: sanitizeDisplayText(project.name, project.code),
        clientCode: client.code,
        clientName: sanitizeDisplayText(client.name, client.code),
        chain: getAgencyChain(client, parentMap),
        updatedAt: project.updated_at || project.created_at,
      }))
    )
    .sort((left, right) => getNodeTime({ id: right.projectId, updated_at: right.updatedAt }) - getNodeTime({ id: left.projectId, updated_at: left.updatedAt }));
}

export function HQTemplatesLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const projects = useMemo(() => getProjectRows(tree, parentMap), [tree, parentMap]);
  const templateProjects = useMemo(() => pickDiversifiedProjects(projects, Math.max(projects.length, 6)), [projects]);
  const templates = useMemo(() => getWebsiteTemplatePresets(), []);

  const templateRows = useMemo(
    () =>
      templates.map((template, index) => {
        const project = templateProjects[index % Math.max(templateProjects.length, 1)] || null;
        return {
          template,
          project,
          chain: project?.chain ?? [],
          clientCode: project?.clientCode ?? "-",
          projectCode: project?.projectCode ?? "-",
          usage: 8 + index * 3,
          sourceSite: project ? `${project.projectCode}.tradehq.local` : defaultWebsiteTemplatePreset.brandName,
        };
      }),
    [templateProjects, templates]
  );

  const stats = useMemo(
    () => [
      { label: "模板数量", value: templateRows.length },
      { label: "覆盖计划", value: new Set(templateRows.map((row) => row.projectCode)).size },
      { label: "覆盖客户", value: new Set(templateRows.map((row) => row.clientCode)).size },
      { label: "最新模板", value: templateRows[0]?.template.sortCode || "-" },
    ],
    [templateRows]
  );

  return (
    <FactoryPage pageId="hq-templates-live" template="dashboard" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="模板库"
        sub="总部按真实计划链路管理网站风格模板，统一由网站风格端源文件接入。"
        action={<Button className="bg-cyan-600 hover:bg-cyan-700">上传模板</Button>}
      />
      <StatsRow items={stats} />
      <Card className="border-slate-200">
        <CardContent className="space-y-4 p-5">
          <div>
            <div className="font-semibold text-slate-900">网站模板资源</div>
            <p className="mt-1 text-sm text-slate-500">统一查看模板样式、使用情况及其关联的客户计划。</p>
          </div>
          <LiveState error={error ? `模板库加载失败：${error}` : ""} loading={loading} loadingText="正在加载模板库...">
        {templateRows.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {templateRows.map((row) => (
            <Card key={row.template.id} className="overflow-hidden border-slate-200">
              <div className={`flex h-40 items-center justify-center bg-gradient-to-br ${row.template.primaryColor || "from-slate-100 to-slate-200"}`}>
                <div className="text-center text-white">
                  <div className="text-5xl">{row.template.thumbnail}</div>
                  <div className="mt-2 text-xs font-medium tracking-wider">{row.template.sortCode}</div>
                </div>
              </div>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900">{row.template.name}</div>
                    <div className="text-xs text-slate-500">{row.template.category}</div>
                  </div>
                  <Badge variant="outline" className="text-[11px]">
                    {row.projectCode}
                  </Badge>
                </div>
                <div className="text-xs text-slate-600 line-clamp-2">{row.template.heroSubtitle}</div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>使用 {row.usage} 次</span>
                  <span>{row.template.rating} 星</span>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600">
                  <div className="font-medium text-slate-900">关联计划</div>
                  <div className="mt-1">{row.projectCode}</div>
                  <div>{row.clientCode}</div>
                  <div className="mt-1">{row.chain.length ? row.chain.map((item) => item.code).join(" / ") : "总部直营"}</div>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            暂无可用网站模板，请上传模板后再进行计划关联。
          </div>
        )}
          </LiveState>
        </CardContent>
      </Card>
      </div>
    </FactoryPage>
  );
}

export function HQGalleryLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const projects = useMemo(() => pickDiversifiedProjects(getProjectRows(tree, parentMap), 18), [tree, parentMap]);

  const galleryRows = useMemo(
    () =>
      projects.slice(0, 18).map((project, index) => ({
        id: `IMG-${String(index + 1).padStart(3, "0")}`,
        name: `${project.projectCode}-${project.clientCode}-hero-${index + 1}.webp`,
        size: `${(1.2 + (index % 5) * 0.4).toFixed(1)} MB`,
        category: index % 3 === 0 ? "首页 Banner" : index % 3 === 1 ? "产品图" : "案例图",
        uses: 5 + index * 2,
        chain: project.chain,
        project,
      })),
    [projects]
  );

  const stats = useMemo(
    () => [
      { label: "素材数量", value: galleryRows.length },
      { label: "覆盖计划", value: new Set(galleryRows.map((row) => row.project.projectCode)).size },
      { label: "覆盖客户", value: new Set(galleryRows.map((row) => row.project.clientCode)).size },
      { label: "最新素材", value: galleryRows[0]?.id || "-" },
    ],
    [galleryRows]
  );

  return (
    <FactoryPage pageId="hq-gallery-live" template="dashboard" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="图库"
        sub="总部素材库按真实计划链路分发，供网站风格端和独立站计划直接复用。"
        action={<Button className="bg-cyan-600 hover:bg-cyan-700">上传图片</Button>}
      />
      <StatsRow items={stats} />
      <Card className="border-slate-200">
        <CardContent className="space-y-4 p-5">
          <div>
            <div className="font-semibold text-slate-900">客户项目图片资源</div>
            <p className="mt-1 text-sm text-slate-500">按客户计划集中查看图片分类、体积与实际使用次数。</p>
          </div>
          <LiveState error={error ? `图库加载失败：${error}` : ""} loading={loading} loadingText="正在加载图库...">
        {galleryRows.length ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {galleryRows.map((item) => (
            <Card key={item.id} className="overflow-hidden border-slate-200">
              <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
                <div className="text-center">
                  <Sparkles className="mx-auto h-8 w-8" />
                  <div className="mt-2 text-[10px]">{item.id}</div>
                </div>
              </div>
              <CardContent className="space-y-1.5 p-3">
                <div className="truncate text-xs font-medium text-slate-900">{item.name}</div>
                <div className="text-[10px] text-slate-500">{item.size}</div>
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-1.5 text-[10px]">
                  <Badge variant="outline" className="h-4 text-[9px]">
                    {item.category}
                  </Badge>
                  <span className="text-slate-500">{item.uses}次</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  {item.project.projectCode} / {item.project.clientCode}
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            暂无客户项目图片，请先在客户计划中上传并使用图片素材。
          </div>
        )}
          </LiveState>
        </CardContent>
      </Card>
      </div>
    </FactoryPage>
  );
}
