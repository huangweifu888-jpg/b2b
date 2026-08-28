import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { platformApi, type PlatformNode } from "@/lib/platform-api";
import {
  bindLegacyUnmapped,
  listLegacyMappings,
  listLegacyUnmapped,
  upsertLegacyMapping,
} from "@/lib/template-snapshot/api";
import type { LegacySnapshotMapping, UnmappedSnapshotResource } from "@/lib/template-snapshot/types";
import { FactoryPage } from "@/page-factory/FactoryPage";

type TargetKind = "organization" | "project";

type TargetChoice = {
  kind: TargetKind;
  id: number;
  label: string;
};

function flattenTree(nodes: PlatformNode[]): PlatformNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children || [])]);
}

export default function TemplateSnapshotMigrations() {
  const [unmapped, setUnmapped] = useState<UnmappedSnapshotResource[]>([]);
  const [mappings, setMappings] = useState<LegacySnapshotMapping[]>([]);
  const [targets, setTargets] = useState<TargetChoice[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const mappingCount = useMemo(() => mappings.length, [mappings]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [legacyItems, mappingItems, tree] = await Promise.all([
        listLegacyUnmapped(),
        listLegacyMappings(),
        platformApi.tree(),
      ]);
      const nodes = flattenTree(tree.items);
      const organizationTargets = nodes.map((node) => ({
        kind: "organization" as const,
        id: node.id,
        label: `组织 #${node.id} · ${node.name}（${node.org_type}）`,
      }));
      const projectTargets = nodes.flatMap((node) =>
        (node.projects || []).map((project) => ({
          kind: "project" as const,
          id: project.id,
          label: `计划 #${project.id} · ${project.name}（客户组织 #${node.id}）`,
        }))
      );
      setUnmapped(legacyItems);
      setMappings(mappingItems);
      setTargets([...organizationTargets, ...projectTargets]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法读取模板快照迁移数据");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const bind = async (resource: UnmappedSnapshotResource) => {
    const key = `${resource.resourceType}:${resource.resourceId}`;
    const [kind, rawId] = (selected[key] || "").split(":");
    const id = Number(rawId);
    if ((kind !== "organization" && kind !== "project") || !Number.isInteger(id)) {
      setError("请先选择该记录对应的组织或独立计划");
      return;
    }
    setSaving(key);
    setError("");
    try {
      const target = kind === "organization" ? { organizationId: id } : { projectId: id };
      if (resource.ownerId) {
        await upsertLegacyMapping({ ownerScope: resource.ownerScope, legacyOwnerId: resource.ownerId, ...target });
      } else {
        await bindLegacyUnmapped({ resourceType: resource.resourceType, resourceId: resource.resourceId, ...target });
      }
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存映射失败");
    } finally {
      setSaving(null);
    }
  };

  return (
    <FactoryPage pageId="hq-template-snapshot-migrations" template="dashboard" sourceScope="hq" autoRegions>
    <main className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">模板快照迁移</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            将历史 siteId 显式绑定到组织或独立计划。系统不会自动猜测归属；完成绑定后，该记录才会进入对应租户的模板更新链路。
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading || saving !== null}>刷新清单</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500">待处理快照</div><div className="mt-1 text-2xl font-bold">{unmapped.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500">已有映射</div><div className="mt-1 text-2xl font-bold">{mappingCount}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500">可选目标</div><div className="mt-1 text-2xl font-bold">{targets.length}</div></CardContent></Card>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-5 py-4 text-sm font-semibold text-slate-900">未绑定记录</div>
          {loading ? <div className="p-5 text-sm text-slate-500">正在读取迁移清单…</div> : null}
          {!loading && unmapped.length === 0 ? <div className="p-5 text-sm text-emerald-700">没有待绑定的历史快照。</div> : null}
          {!loading && unmapped.map((resource) => {
            const key = `${resource.resourceType}:${resource.resourceId}`;
            return (
              <div key={key} className="grid gap-3 border-b px-5 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-slate-900">{resource.name || resource.resourceId}</span><Badge variant="secondary">{resource.resourceType}</Badge><Badge variant="outline">{resource.ownerScope}</Badge></div>
                  <div className="mt-1 truncate text-xs text-slate-500">ID: {resource.resourceId} · 历史归属: {resource.ownerId || "无（直接绑定）"}</div>
                </div>
                <select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" value={selected[key] || ""} onChange={(event) => setSelected((value) => ({ ...value, [key]: event.target.value }))}>
                  <option value="">选择目标组织或计划</option>
                  {targets.map((target) => <option key={`${target.kind}:${target.id}`} value={`${target.kind}:${target.id}`}>{target.label}</option>)}
                </select>
                <Button onClick={() => void bind(resource)} disabled={saving === key}>{saving === key ? "保存中…" : resource.ownerId ? "创建映射" : "直接绑定"}</Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </main>
    </FactoryPage>
  );
}
