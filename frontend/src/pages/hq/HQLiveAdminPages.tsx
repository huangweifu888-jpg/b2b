import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

import { FactoryPage } from "@/page-factory/FactoryPage";
import {
  platformApi,
  type PlatformMembership,
  type PlatformNode,
  type PlatformOverview,
  type PlatformRole,
} from "@/lib/platform-api";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";

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
        <Card key={item.label} data-page-card-size="small" className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className="text-2xl font-bold text-slate-900">{item.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DataTable({ columns, rows, search }: { columns: string[]; rows: ReactNode[][]; search?: string }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="p-0">
        {search ? (
          <div className="flex items-center gap-2 border-b border-slate-200 p-4">
            <Search className="h-4 w-4 text-slate-400" />
            <Input placeholder={search} className="h-8 flex-1 border-0 shadow-none focus-visible:ring-0" />
            <Button variant="outline" size="sm">
              筛选
            </Button>
          </div>
        ) : null}
        <div className="responsive-table-wrap">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="whitespace-nowrap px-4 py-3 text-left font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-slate-100 hover:bg-slate-50">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-4 py-3 align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function LiveState({
  error,
  loading,
  loadingText,
  nested = false,
  children,
}: {
  error: string;
  loading: boolean;
  loadingText: string;
  nested?: boolean;
  children: ReactNode;
}) {
  if (error) {
    return (
      <Card data-page-card-size={nested ? "small" : undefined} className="border-red-200 bg-red-50">
        <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card data-page-card-size={nested ? "small" : undefined} className="border-slate-200">
        <CardContent className="p-5 text-sm text-slate-500">{loadingText}</CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "正常", cls: "bg-emerald-100 text-emerald-700" },
    pending: { label: "待处理", cls: "bg-amber-100 text-amber-700" },
    paused: { label: "已暂停", cls: "bg-slate-100 text-slate-700" },
    disabled: { label: "已禁用", cls: "bg-slate-100 text-slate-700" },
  };
  const info = map[status] || { label: sanitizeDisplayText(status, "未知"), cls: "bg-slate-100 text-slate-700" };
  return <Badge className={`${info.cls} hover:${info.cls}`}>{info.label}</Badge>;
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

function getNodeTime(node: { id: number; updated_at?: string; created_at?: string; last_login?: string | null }) {
  const raw = node.updated_at || node.created_at || node.last_login || "";
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
    return <span className="text-xs text-slate-400">总部直属</span>;
  }

  return (
    <div className="space-y-0.5">
      <div className="text-sm text-slate-900">
        {chain.map((agency) => sanitizeDisplayText(agency.name, agency.code)).join(" / ")}
      </div>
      <div className="font-mono text-[11px] text-slate-500">{chain.map((agency) => agency.code).join(" / ")}</div>
    </div>
  );
}

function formatDateLabel(value?: string | null) {
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

function getDepartmentLabel(node: PlatformNode) {
  if (node.org_type === "hq") return "总部平台";
  if (node.org_type === "agency") return "一级代理";
  if (node.org_type === "sub_agency") return "二级代理";
  return "客户企业";
}

function countAllProjects(node: PlatformNode): number {
  let total = node.projects.length;
  node.children.forEach((child) => {
    total += countAllProjects(child);
  });
  return total;
}

function countLeafClients(node: PlatformNode): number {
  let total = node.org_type === "client" ? 1 : 0;
  node.children.forEach((child) => {
    total += countLeafClients(child);
  });
  return total;
}

function useHQAdminData() {
  const [tree, setTree] = useState<PlatformNode[]>([]);
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [memberships, setMemberships] = useState<PlatformMembership[]>([]);
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const [treeResponse, rolesResponse, membershipsResponse, overviewResponse] = await Promise.all([
          platformApi.tree(),
          platformApi.roles(),
          platformApi.memberships(),
          platformApi.overview(),
        ]);
        if (!mounted) return;
        setTree(treeResponse.items || []);
        setRoles(rolesResponse.items || []);
        setMemberships(membershipsResponse.items || []);
        setOverview(overviewResponse);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "加载总部管理数据失败");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return { tree, roles, memberships, overview, loading, error };
}

export function HQMembersLive() {
  const { tree, roles, memberships, overview, loading, error } = useHQAdminData();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const nodeMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);

  const rows = useMemo(
    () =>
      memberships
        .slice()
        .sort(
          (left, right) =>
            getNodeTime({ id: right.id, updated_at: right.updated_at, created_at: right.created_at, last_login: right.last_login }) -
            getNodeTime({ id: left.id, updated_at: left.updated_at, created_at: left.created_at, last_login: left.last_login })
        )
        .map((member) => {
          const orgNode = nodeMap.get(member.org_id) || null;
          const chain = getAgencyChain(orgNode, parentMap);
          return [
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 text-xs font-bold text-white">
                {sanitizeDisplayText(member.name, "成员").slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div className="font-medium text-slate-900">{sanitizeDisplayText(member.name, member.user_id)}</div>
                <div className="text-[11px] text-slate-500">{sanitizeDisplayText(member.email, member.user_id)}</div>
              </div>
            </div>,
            <div>
              <div className="font-medium text-slate-900">{sanitizeDisplayText(member.role_name, "未分配角色")}</div>
              <div className="text-[11px] text-slate-500">{sanitizeDisplayText(member.role_scope || "platform", "platform")}</div>
            </div>,
            <div>
              <div className="font-medium text-slate-900">{sanitizeDisplayText(member.org_name, member.org_code || "未绑定组织")}</div>
              <div className="text-[11px] text-slate-500">
                {sanitizeDisplayText(member.org_code, "-")} · {getDepartmentLabel(orgNode || ({ org_type: member.org_type } as PlatformNode))}
              </div>
            </div>,
            renderChain(chain),
            member.project_code ? (
              <div>
                <div className="font-medium text-slate-900">{sanitizeDisplayText(member.project_name, member.project_code)}</div>
                <div className="font-mono text-[11px] text-slate-500">{member.project_code}</div>
              </div>
            ) : (
              <span className="text-xs text-slate-400">组织级成员</span>
            ),
            <span className="text-xs text-slate-500">{formatDateLabel(member.last_login || member.updated_at || member.created_at)}</span>,
            <div className="flex items-center gap-2">
              <StatusBadge status={member.status} />
              {member.is_default ? <Badge variant="outline">默认</Badge> : null}
            </div>,
          ];
        }),
    [memberships, nodeMap, parentMap]
  );

  const stats = useMemo(
    () => [
      { label: "成员关系", value: overview?.counts.memberships ?? memberships.length },
      { label: "已分配角色", value: new Set(memberships.filter((item) => item.role_name).map((item) => item.role_name)).size },
      { label: "覆盖组织", value: new Set(memberships.map((item) => item.org_id)).size },
      { label: "总部角色", value: roles.filter((role) => role.scope === "hq").length },
    ],
    [memberships, overview, roles]
  );

  return (
    <FactoryPage pageId="hq-members-live" template="list" sourceScope="hq" autoRegions>
      <div className="space-y-6">
        <PageHeader title="平台成员列表" sub="总部直接读取成员关系、角色和组织归属，优先展示最新成员变更。" action={<Button className="bg-cyan-600 hover:bg-cyan-700">新增成员</Button>} />
        <StatsRow items={stats} />
        <LiveState error={error ? `成员数据加载失败：${error}` : ""} loading={loading} loadingText="正在加载总部成员数据...">
          <DataTable
            search="搜索成员姓名、邮箱、角色或组织编号"
            columns={["成员", "角色", "组织归属", "代理链路", "计划归属", "最后登录", "状态"]}
            rows={rows}
          />
        </LiveState>
      </div>
    </FactoryPage>
  );
}

export function HQRolesLive() {
  const { tree, roles, memberships, loading, error } = useHQAdminData();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const nodeMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);

  const roleCards = useMemo(
    () =>
      roles
        .slice()
        .sort((left, right) => right.permissions.length - left.permissions.length || left.id - right.id)
        .map((role) => {
          const bindOrg = role.org_id ? nodeMap.get(role.org_id) || null : null;
          const memberCount = memberships.filter((item) => item.role_id === role.id).length;
          return {
            role,
            bindOrg,
            memberCount,
          };
        }),
    [memberships, nodeMap, roles]
  );

  const stats = useMemo(
    () => [
      { label: "角色总数", value: roles.length },
      { label: "总部角色", value: roles.filter((role) => role.scope === "hq").length },
      { label: "系统角色", value: roles.filter((role) => role.is_system).length },
      { label: "角色成员绑定", value: memberships.filter((item) => item.role_id).length },
    ],
    [memberships, roles]
  );

  return (
    <FactoryPage pageId="hq-roles-live" template="dashboard" sourceScope="hq" autoRegions>
      <div className="space-y-6">
        <PageHeader title="角色管理" sub="总部统一查看各层级角色、权限点和成员绑定数量。" action={<Button className="bg-cyan-600 hover:bg-cyan-700">新增角色</Button>} />
        <Card data-page-card-size="large" className="border-slate-200">
          <CardContent className="space-y-6 p-5">
            <StatsRow items={stats} />
            <LiveState nested error={error ? `角色数据加载失败：${error}` : ""} loading={loading} loadingText="正在加载总部角色数据...">
              {roleCards.length ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {roleCards.map(({ role, bindOrg, memberCount }) => (
                    <Card key={role.id} data-page-card-size="small" className="border-slate-200">
                      <CardContent className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{sanitizeDisplayText(role.name, `角色 ${role.id}`)}</div>
                          <div className="mt-1 text-xs text-slate-500">{sanitizeDisplayText(role.description, "未填写角色说明")}</div>
                        </div>
                        <Badge variant="outline">{sanitizeDisplayText(role.scope, "scope")}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">成员数量</div>
                          <div className="text-lg font-semibold text-slate-900">{memberCount}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">权限点</div>
                          <div className="text-lg font-semibold text-slate-900">{role.permissions.length}</div>
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 text-xs text-slate-500">归属组织</div>
                        <div className="text-sm text-slate-900">
                          {bindOrg ? sanitizeDisplayText(bindOrg.name, bindOrg.code) : "平台通用"}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">{bindOrg?.code || "GLOBAL"}</div>
                      </div>
                      <div>
                        <div className="mb-2 text-xs text-slate-500">权限清单</div>
                        <div className="flex flex-wrap gap-1.5">
                          {role.permissions.map((permission) => (
                            <Badge key={permission} variant="outline" className="bg-slate-50 text-[11px]">
                              {permission}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                  <div className="text-sm font-medium text-slate-700">暂无角色数据</div>
                  <div className="mt-1 text-xs text-slate-500">创建或同步角色后，将在这里显示权限点、归属组织和成员绑定情况。</div>
                </div>
              )}
            </LiveState>
          </CardContent>
        </Card>
      </div>
    </FactoryPage>
  );
}

export function HQDeptsLive() {
  const { tree, memberships, loading, error } = useHQAdminData();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);

  const deptRows = useMemo(
    () =>
      allNodes
        .slice()
        .sort((left, right) => getNodeTime(right) - getNodeTime(left))
        .map((node) => {
          const directMembers = memberships.filter((item) => item.org_id === node.id);
          const projectMembers = memberships.filter((item) =>
            item.project_code && node.projects.some((project) => project.id === item.project_id)
          );
          const agencyChain = getAgencyChain(node, parentMap);
          return {
            node,
            directMembers,
            projectMembers,
            agencyChain,
            clientCount: countLeafClients(node),
            projectCount: countAllProjects(node),
          };
        }),
    [allNodes, memberships, parentMap]
  );

  const stats = useMemo(
    () => [
      { label: "组织节点", value: deptRows.length },
      { label: "一级代理", value: deptRows.filter((item) => item.node.org_type === "agency").length },
      { label: "二级代理", value: deptRows.filter((item) => item.node.org_type === "sub_agency").length },
      { label: "客户企业", value: deptRows.filter((item) => item.node.org_type === "client").length },
    ],
    [deptRows]
  );

  return (
    <FactoryPage pageId="hq-depts-live" template="dashboard" sourceScope="hq" autoRegions>
      <div className="space-y-6">
        <PageHeader title="部门与组织层级" sub="总部用真实组织树统一查看总部、代理、客户的层级结构与成员覆盖情况。" action={<Button className="bg-cyan-600 hover:bg-cyan-700">新建部门</Button>} />
        <Card data-page-card-size="large" className="border-slate-200">
          <CardContent className="space-y-6 p-5">
            <StatsRow items={stats} />
            <LiveState nested error={error ? `组织数据加载失败：${error}` : ""} loading={loading} loadingText="正在加载总部组织层级...">
              {deptRows.length ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {deptRows.map(({ node, directMembers, projectMembers, agencyChain, clientCount, projectCount }) => (
                    <Card key={node.id} data-page-card-size="small" className="border-slate-200">
                      <CardContent className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{sanitizeDisplayText(node.name, node.code)}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {node.code} · {getDepartmentLabel(node)}
                          </div>
                        </div>
                        <StatusBadge status={node.status} />
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">直接成员</div>
                          <div className="text-lg font-semibold text-slate-900">{directMembers.length}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">计划成员</div>
                          <div className="text-lg font-semibold text-slate-900">{projectMembers.length}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">下属客户</div>
                          <div className="text-lg font-semibold text-slate-900">{clientCount}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">下属计划</div>
                          <div className="text-lg font-semibold text-slate-900">{projectCount}</div>
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 text-xs text-slate-500">代理链路</div>
                        {renderChain(agencyChain)}
                      </div>
                      <div>
                        <div className="mb-2 text-xs text-slate-500">下级节点</div>
                        <div className="flex flex-wrap gap-1.5">
                          {node.children.length ? (
                            node.children.map((child) => (
                              <Badge key={child.id} variant="outline" className="bg-slate-50">
                                {sanitizeDisplayText(child.name, child.code)}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">暂无下级节点</span>
                          )}
                        </div>
                      </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                  <div className="text-sm font-medium text-slate-700">暂无部门或组织数据</div>
                  <div className="mt-1 text-xs text-slate-500">创建或同步组织后，将在这里显示层级链路、成员覆盖和下属计划。</div>
                </div>
              )}
            </LiveState>
          </CardContent>
        </Card>
      </div>
    </FactoryPage>
  );
}
