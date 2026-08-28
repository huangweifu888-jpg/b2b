import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  Building2,
  CheckCircle2,
  Database,
  GitBranch,
  KeyRound,
  Link2,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  platformApi,
  type AIProvider,
  type PlatformNode,
  type PlatformOverview,
  type PlatformRole,
} from "@/lib/platform-api";
import { PLATFORM_REBUILD_PRINCIPLES } from "@/lib/platform-blueprint";
import { FactoryPage } from "@/page-factory/FactoryPage";

function typeLabel(type: string) {
  return (
    {
      hq: "总部",
      agency: "一级代理",
      sub_agency: "下级代理",
      client: "客户端",
    }[type] || type
  );
}

function emptyText(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function NodeCard({ node, depth = 0 }: { node: PlatformNode; depth?: number }) {
  return (
    <div className="space-y-2" style={{ marginLeft: depth ? 12 : 0 }}>
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Building2 className="h-4 w-4 text-cyan-600" />
                <div className="font-semibold text-slate-900">{node.name}</div>
                <Badge variant="outline">{typeLabel(node.org_type)}</Badge>
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{node.status}</Badge>
              </div>
              <div className="mt-1 text-xs text-slate-500">组织编码：{node.code}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4 lg:min-w-[420px]">
              <div>分佣模式：{emptyText(node.commission_mode)}</div>
              <div>分佣比例：{emptyText(node.commission_rate)}</div>
              <div>折扣比例：{emptyText(node.discount_rate)}</div>
              <div>邀请码：{emptyText(node.invite_code)}</div>
            </div>
          </div>

          {node.invite_url && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <Link2 className="h-3.5 w-3.5" />
              <span className="font-mono break-all">{node.invite_url}</span>
              {node.qr_code_url && <span className="break-all text-slate-400">二维码：{node.qr_code_url}</span>}
            </div>
          )}

          {node.projects.length > 0 && (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {node.projects.map((project) => (
                <div key={project.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
                  <div className="font-semibold text-slate-800">{project.name}</div>
                  <div className="mt-1 break-all text-slate-500">
                    项目编码：{project.code} | 域名：{emptyText(project.domain)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {node.children.map((child) => (
        <NodeCard key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function PlatformArchitecture() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [tree, setTree] = useState<PlatformNode[]>([]);
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const counts = overview?.counts;
  const roleGroups = useMemo(() => {
    return roles.reduce<Record<string, PlatformRole[]>>((acc, role) => {
      acc[role.scope] = acc[role.scope] || [];
      acc[role.scope].push(role);
      return acc;
    }, {});
  }, [roles]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const [overviewData, treeData, rolesData, providerData] = await Promise.all([
          platformApi.overview(),
          platformApi.tree(),
          platformApi.roles(),
          platformApi.aiProviders(),
        ]);

        if (!mounted) return;
        setOverview(overviewData);
        setTree(treeData.items || []);
        setRoles(rolesData.items || []);
        setProviders(providerData.items || []);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "平台接口暂时不可用");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = [
    ["组织", counts?.organizations ?? 0, Building2],
    ["项目", counts?.projects ?? 0, GitBranch],
    ["角色", counts?.roles ?? 0, ShieldCheck],
    ["成员关系", counts?.memberships ?? 0, Activity],
    ["备份", counts?.backups ?? 0, Database],
    ["AI 接口", counts?.aiProviders ?? 0, Bot],
  ] as const;

  return (
    <FactoryPage pageId="hq-platform-architecture" template="dashboard" sourceScope="hq" autoRegions>
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">平台架构总览</h1>
          <p className="mt-1 text-sm text-slate-500">
            这里集中查看总部、代理商、客户端的组织结构、权限角色、AI 服务与上线部署主轴。
          </p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()}>
          刷新
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">后端接口暂时不可用：{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {stats.map(([label, value, Icon]) => (
          <Card key={label} className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">{label}</div>
                <Icon className="h-4 w-4 text-cyan-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <GitBranch className="h-4 w-4 text-cyan-600" />
            多租户组织树
          </div>
          {loading ? (
            <Card>
              <CardContent className="p-5 text-sm text-slate-500">正在加载平台结构...</CardContent>
            </Card>
          ) : tree.length > 0 ? (
            tree.map((node) => <NodeCard key={node.id} node={node} />)
          ) : (
            <Card>
              <CardContent className="p-5 text-sm text-slate-500">当前还没有组织数据。</CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <ShieldCheck className="h-4 w-4 text-cyan-600" />
                权限角色体系
              </div>
              <div className="space-y-3">
                {Object.entries(roleGroups).length > 0 ? (
                  Object.entries(roleGroups).map(([scope, items]) => (
                    <div key={scope}>
                      <div className="mb-1 text-xs font-semibold uppercase text-slate-500">{scope}</div>
                      <div className="space-y-2">
                        {items.map((role) => (
                          <div key={role.id} className="rounded-md border border-slate-200 px-3 py-2">
                            <div className="font-medium text-slate-900">{role.name}</div>
                            <div className="mt-1 text-xs text-slate-500">{role.description || "暂无说明"}</div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {role.permissions.map((permission) => (
                                <Badge key={permission} variant="outline" className="text-[10px]">
                                  {permission}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">当前还没有角色配置。</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <KeyRound className="h-4 w-4 text-cyan-600" />
                AI 接口配置
              </div>
              <div className="space-y-2">
                {providers.length > 0 ? (
                  providers.map((provider) => (
                    <div key={provider.id} className="rounded-md border border-slate-200 px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium text-slate-900">{provider.name}</div>
                        {provider.is_default && (
                          <Badge className="bg-cyan-100 text-cyan-700 hover:bg-cyan-100">默认</Badge>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {provider.provider_key} | {emptyText(provider.default_model)}
                      </div>
                      <div className="mt-1 break-all text-xs text-slate-400">
                        环境变量：{emptyText(provider.api_key_env)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">当前还没有接入 AI 供应商。</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                已落地基础能力
              </div>
              <ul className="space-y-1 text-xs text-emerald-700">
                {(overview?.implemented || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Database className="h-4 w-4 text-cyan-600" />
              核心开发语言方案
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {(overview?.tech_stack?.primary_languages || []).map((item) => (
                <div key={item.name} className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-slate-900">{item.name}</div>
                    <Badge className="bg-cyan-100 text-cyan-700 hover:bg-cyan-100">{item.framework}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{item.usage}</div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {item.responsibility.map((part) => (
                      <Badge key={part} variant="outline" className="text-[10px]">
                        {part}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-md bg-slate-50 p-3">
              <div className="mb-2 text-xs font-semibold text-slate-600">统一架构原则</div>
              <ul className="space-y-2 text-xs text-slate-600">
                {PLATFORM_REBUILD_PRINCIPLES.map((item) => (
                  <li key={item} className="rounded-md bg-white px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <CheckCircle2 className="h-4 w-4 text-cyan-600" />
                上线部署建议
              </div>
              <ul className="space-y-2 text-sm text-slate-600">
                {(overview?.deployment_strategy || []).map((item) => (
                  <li key={item} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Bot className="h-4 w-4 text-cyan-600" />
                下一步重点
              </div>
              <ul className="space-y-2 text-sm text-slate-600">
                {(overview?.next || []).map((item) => (
                  <li key={item} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </FactoryPage>
  );
}
