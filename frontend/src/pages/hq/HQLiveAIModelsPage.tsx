import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { platformApi, type AIAssignment, type AIProvider, type PlatformOrganization } from "@/lib/platform-api";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";
import { toast } from "@/hooks/use-toast";
import { FactoryPage } from "@/page-factory/FactoryPage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

type DraftAssignment = {
  org_id: string;
  app_key: string;
  app_name: string;
  category: string;
  scope: string;
  primary_provider_id: string;
  primary_model: string;
  backup_provider_id: string;
  backup_model: string;
  enabled: boolean;
  sort_order: number;
};

const DEFAULT_DRAFT: DraftAssignment = {
  org_id: "",
  app_key: "",
  app_name: "",
  category: "",
  scope: "总部 / 代理 / 客户 / 计划",
  primary_provider_id: "",
  primary_model: "",
  backup_provider_id: "",
  backup_model: "",
  enabled: true,
  sort_order: 0,
};

function emptyToNullNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function providerNameById(providers: AIProvider[], providerId: number | null) {
  if (!providerId) return "-";
  const provider = providers.find((item) => item.id === providerId);
  return sanitizeDisplayText(provider?.name || provider?.provider_key, "-");
}

function orgLabel(org?: Pick<PlatformOrganization, "code" | "name" | "org_type"> | null) {
  if (!org) return "总部默认 / 全局";
  const typeLabel =
    org.org_type === "client"
      ? "客户"
      : org.org_type === "sub_agency"
        ? "二级代理"
        : org.org_type === "agency"
          ? "一级代理"
          : "总部";
  return `${typeLabel} ${sanitizeDisplayText(org.name, org.code)} (${org.code})`;
}

export function HQAIModelsLive() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]);
  const [assignments, setAssignments] = useState<AIAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<DraftAssignment>(DEFAULT_DRAFT);
  const [deleteTarget, setDeleteTarget] = useState<AIAssignment | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [providerRes, organizationRes, assignmentRes] = await Promise.all([
        platformApi.aiProviders(),
        platformApi.organizations(),
        platformApi.aiAssignments(),
      ]);
      setProviders(providerRes.items || []);
      setOrganizations(organizationRes.items || []);
      setAssignments(assignmentRes.items || []);
    } catch (error) {
      toast({
        title: "AI 分配加载失败",
        description: error instanceof Error ? error.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const assignableOrganizations = useMemo(
    () =>
      organizations
        .filter(
          (item) =>
            item.org_type === "hq" ||
            item.org_type === "agency" ||
            item.org_type === "sub_agency" ||
            item.org_type === "client"
        )
        .sort((left, right) => {
          const typeRank = (value: string) =>
            value === "hq" ? 0 : value === "agency" ? 1 : value === "sub_agency" ? 2 : 3;
          return typeRank(left.org_type) - typeRank(right.org_type) || left.code.localeCompare(right.code, "zh-CN");
        }),
    [organizations]
  );

  const stats = useMemo(
    () => [
      { label: "应用分配", value: assignments.length },
      { label: "启用中", value: assignments.filter((item) => item.enabled).length },
      { label: "默认供应商", value: providers.filter((item) => item.is_default).length },
      { label: "供应商总数", value: providers.length },
    ],
    [assignments, providers]
  );

  const createAssignment = async () => {
    if (!draft.app_key.trim() || !draft.app_name.trim()) {
      toast({
        title: "请先填写应用标识和应用名称",
        description: "这两个字段不能为空。",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const created = await platformApi.createAIAssignment({
        org_id: emptyToNullNumber(draft.org_id),
        app_key: draft.app_key.trim(),
        app_name: draft.app_name.trim(),
        category: draft.category.trim(),
        scope: draft.scope.trim(),
        primary_provider_id: emptyToNullNumber(draft.primary_provider_id),
        primary_model: draft.primary_model.trim(),
        backup_provider_id: emptyToNullNumber(draft.backup_provider_id),
        backup_model: draft.backup_model.trim(),
        enabled: draft.enabled,
        sort_order: draft.sort_order,
      });
      setAssignments((current) => [created, ...current].sort((left, right) => right.sort_order - left.sort_order || right.id - left.id));
      setDraft(DEFAULT_DRAFT);
      setShowCreate(false);
      toast({
        title: "AI 分配已创建",
        description: `${created.app_name} 已接入 ${created.org_name ? `${created.org_name} (${created.org_code})` : "总部默认"} 分配链。`,
      });
    } catch (error) {
      toast({
        title: "AI 分配创建失败",
        description: error instanceof Error ? error.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateAssignment = async (assignmentId: number, payload: Partial<AIAssignment>) => {
    try {
      const updated = await platformApi.updateAIAssignment(assignmentId, {
        app_name: payload.app_name,
        org_id: payload.org_id,
        category: payload.category,
        scope: payload.scope,
        primary_provider_id: payload.primary_provider_id,
        primary_model: payload.primary_model,
        backup_provider_id: payload.backup_provider_id,
        backup_model: payload.backup_model,
        enabled: payload.enabled,
        sort_order: payload.sort_order,
      });
      setAssignments((current) =>
        current
          .map((item) => (item.id === assignmentId ? updated : item))
          .sort((left, right) => right.sort_order - left.sort_order || right.id - left.id)
      );
    } catch (error) {
      toast({
        title: "AI 分配保存失败",
        description: error instanceof Error ? error.message : "请稍后再试",
        variant: "destructive",
      });
      await load();
    }
  };

  const deleteAssignment = async () => {
    if (!deleteTarget) return;
    try {
      await platformApi.deleteAIAssignment(deleteTarget.id);
      setAssignments((current) => current.filter((item) => item.id !== deleteTarget.id));
      toast({
        title: "AI 分配已删除",
        description: `${deleteTarget.app_name} 已从总部分配表移除。`,
      });
    } catch (error) {
      toast({
        title: "AI 分配删除失败",
        description: error instanceof Error ? error.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <FactoryPage pageId="hq-ai-models-live" template="list" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="AI 模型分配"
        sub="总部实时读写 AI 应用分配表，后续代理、客户、计划端都会复用这套真实链路。"
        action={
          <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => setShowCreate((value) => !value)}>
            {showCreate ? "收起新建" : "新增分配"}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <Card key={item.label} className="border-slate-200">
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">{item.label}</div>
              <div className="text-2xl font-bold text-slate-900">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {showCreate ? (
        <Card className="border-cyan-200 bg-cyan-50">
          <CardContent className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <Label className="text-xs">归属组织</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={draft.org_id}
                  onChange={(event) => setDraft((current) => ({ ...current, org_id: event.target.value }))}
                >
                  <option value="">总部默认 / 全局</option>
                  {assignableOrganizations.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {orgLabel(item)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">应用标识</Label>
                <Input value={draft.app_key} onChange={(event) => setDraft((current) => ({ ...current, app_key: event.target.value }))} className="mt-1" placeholder="例如 ai-chat" />
              </div>
              <div>
                <Label className="text-xs">应用名称</Label>
                <Input value={draft.app_name} onChange={(event) => setDraft((current) => ({ ...current, app_name: event.target.value }))} className="mt-1" placeholder="例如 AI 对话建站" />
              </div>
              <div>
                <Label className="text-xs">分类</Label>
                <Input value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">作用范围</Label>
                <Input value={draft.scope} onChange={(event) => setDraft((current) => ({ ...current, scope: event.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">主供应商</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={draft.primary_provider_id}
                  onChange={(event) => setDraft((current) => ({ ...current, primary_provider_id: event.target.value }))}
                >
                  <option value="">未选择</option>
                  {providers.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {sanitizeDisplayText(item.name, item.provider_key)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">主模型</Label>
                <Input value={draft.primary_model} onChange={(event) => setDraft((current) => ({ ...current, primary_model: event.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">备用供应商</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={draft.backup_provider_id}
                  onChange={(event) => setDraft((current) => ({ ...current, backup_provider_id: event.target.value }))}
                >
                  <option value="">未选择</option>
                  {providers.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {sanitizeDisplayText(item.name, item.provider_key)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">备用模型</Label>
                <Input value={draft.backup_model} onChange={(event) => setDraft((current) => ({ ...current, backup_model: event.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">排序号</Label>
                <Input
                  type="number"
                  value={draft.sort_order}
                  onChange={(event) => setDraft((current) => ({ ...current, sort_order: Number(event.target.value || 0) }))}
                  className="mt-1"
                />
              </div>
              <div className="flex items-end gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">启用</Label>
                  <div>
                    <Switch checked={draft.enabled} onCheckedChange={(checked) => setDraft((current) => ({ ...current, enabled: checked }))} />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowCreate(false); setDraft(DEFAULT_DRAFT); }}>
                取消
              </Button>
              <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => void createAssignment()} disabled={saving}>
                {saving ? "保存中..." : "保存分配"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-5 text-sm text-slate-500">正在加载总部 AI 分配数据...</div>
          ) : (
            <div className="responsive-table-wrap">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    {["排序", "归属组织", "应用", "分类", "主供应商 / 模型", "备用供应商 / 模型", "范围", "启用", "操作"].map((item) => (
                      <th key={item} className="whitespace-nowrap px-4 py-3 text-left font-medium">
                        {item}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => (
                    <tr key={assignment.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          value={assignment.sort_order}
                          onChange={(event) =>
                            setAssignments((current) =>
                              current.map((item) =>
                                item.id === assignment.id ? { ...item, sort_order: Number(event.target.value || 0) } : item
                              )
                            )
                          }
                          onBlur={(event) =>
                            void updateAssignment(assignment.id, { sort_order: Number(event.target.value || 0) })
                          }
                          className="h-8 w-24"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="h-8 min-w-56 rounded-md border border-input bg-background px-2 text-xs"
                          value={assignment.org_id ?? ""}
                          onChange={(event) => {
                            const nextOrgId = event.target.value ? Number(event.target.value) : null;
                            const nextOrg = assignableOrganizations.find((item) => item.id === nextOrgId) || null;
                            setAssignments((current) =>
                              current.map((item) =>
                                item.id === assignment.id
                                  ? {
                                      ...item,
                                      org_id: nextOrgId,
                                      org_code: nextOrg?.code || "",
                                      org_name: nextOrg?.name || "",
                                      org_type: nextOrg?.org_type || "global",
                                    }
                                  : item
                              )
                            );
                            void updateAssignment(assignment.id, { org_id: nextOrgId });
                          }}
                        >
                          <option value="">总部默认 / 全局</option>
                          {assignableOrganizations.map((item) => (
                            <option key={item.id} value={item.id}>
                              {orgLabel(item)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{sanitizeDisplayText(assignment.app_name, assignment.app_key)}</div>
                        <div className="font-mono text-[11px] text-slate-500">{assignment.app_key}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          value={assignment.category}
                          onChange={(event) =>
                            setAssignments((current) =>
                              current.map((item) => (item.id === assignment.id ? { ...item, category: event.target.value } : item))
                            )
                          }
                          onBlur={(event) => void updateAssignment(assignment.id, { category: event.target.value })}
                          className="h-8 min-w-32"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          <select
                            className="h-8 min-w-44 rounded-md border border-input bg-background px-2 text-xs"
                            value={assignment.primary_provider_id ?? ""}
                            onChange={(event) => {
                              const providerId = event.target.value ? Number(event.target.value) : null;
                              setAssignments((current) =>
                                current.map((item) =>
                                  item.id === assignment.id
                                    ? {
                                        ...item,
                                        primary_provider_id: providerId,
                                        primary_provider_name: providerNameById(providers, providerId),
                                      }
                                    : item
                                )
                              );
                              void updateAssignment(assignment.id, { primary_provider_id: providerId });
                            }}
                          >
                            <option value="">未选择</option>
                            {providers.map((item) => (
                              <option key={item.id} value={item.id}>
                                {sanitizeDisplayText(item.name, item.provider_key)}
                              </option>
                            ))}
                          </select>
                          <Input
                            value={assignment.primary_model}
                            onChange={(event) =>
                              setAssignments((current) =>
                                current.map((item) => (item.id === assignment.id ? { ...item, primary_model: event.target.value } : item))
                              )
                            }
                            onBlur={(event) => void updateAssignment(assignment.id, { primary_model: event.target.value })}
                            className="h-8 min-w-44 font-mono text-xs"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          <select
                            className="h-8 min-w-44 rounded-md border border-input bg-background px-2 text-xs"
                            value={assignment.backup_provider_id ?? ""}
                            onChange={(event) => {
                              const providerId = event.target.value ? Number(event.target.value) : null;
                              setAssignments((current) =>
                                current.map((item) =>
                                  item.id === assignment.id
                                    ? {
                                        ...item,
                                        backup_provider_id: providerId,
                                        backup_provider_name: providerNameById(providers, providerId),
                                      }
                                    : item
                                )
                              );
                              void updateAssignment(assignment.id, { backup_provider_id: providerId });
                            }}
                          >
                            <option value="">未选择</option>
                            {providers.map((item) => (
                              <option key={item.id} value={item.id}>
                                {sanitizeDisplayText(item.name, item.provider_key)}
                              </option>
                            ))}
                          </select>
                          <Input
                            value={assignment.backup_model}
                            onChange={(event) =>
                              setAssignments((current) =>
                                current.map((item) => (item.id === assignment.id ? { ...item, backup_model: event.target.value } : item))
                              )
                            }
                            onBlur={(event) => void updateAssignment(assignment.id, { backup_model: event.target.value })}
                            className="h-8 min-w-44 font-mono text-xs"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          value={assignment.scope}
                          onChange={(event) =>
                            setAssignments((current) =>
                              current.map((item) => (item.id === assignment.id ? { ...item, scope: event.target.value } : item))
                            )
                          }
                          onBlur={(event) => void updateAssignment(assignment.id, { scope: event.target.value })}
                          className="h-8 min-w-44"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={assignment.enabled}
                            onCheckedChange={(checked) => {
                              setAssignments((current) =>
                                current.map((item) => (item.id === assignment.id ? { ...item, enabled: checked } : item))
                              );
                              void updateAssignment(assignment.id, { enabled: checked });
                            }}
                          />
                          <Badge className={assignment.enabled ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>
                            {assignment.enabled ? "启用" : "停用"}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="outline" size="sm" className="h-8" onClick={() => setDeleteTarget(assignment)}>
                          删除
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除这条 AI 分配？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `将删除 ${deleteTarget.app_name}，后续总部、代理、客户、计划端都不会再读到这条分配。` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteAssignment()}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </FactoryPage>
  );
}
