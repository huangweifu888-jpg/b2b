import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Plus, Edit3, Users } from "lucide-react";

import { platformApi, type PlatformRole } from "@/lib/platform-api";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";
import { FactoryPage } from "@/page-factory/FactoryPage";

const scopeLabel: Record<string, string> = {
  hq: "总部",
  agency: "代理",
  sub_agency: "二级代理",
  client: "客户",
};

export default function Roles() {
  const [roles, setRoles] = useState<PlatformRole[]>([]);

  useEffect(() => {
    let mounted = true;

    void platformApi.roles().then((payload) => {
      if (mounted) setRoles(Array.isArray(payload.items) ? payload.items : []);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const orderedRoles = useMemo(
    () => [...roles].sort((a, b) => (a.scope || "").localeCompare(b.scope || "") || a.id - b.id),
    [roles]
  );

  return (
    <FactoryPage pageId="agency-roles" template="dashboard" sourceScope="agency_source" className="space-y-6">
      <div data-page-factory-region="content" data-development-standard-frame-region="content" data-development-standard-frame-label="内容" className="space-y-6">
      <div data-page-factory-region="title-2" data-development-standard-frame-region="title-2" data-development-standard-frame-label="标题二" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">角色管理</h1>
          <p className="mt-1 text-sm text-slate-500">直接读取后端角色定义，保持与总部权限一致</p>
        </div>
        <Button className="self-start bg-violet-600 hover:bg-violet-700 sm:self-auto"><Plus className="mr-2 h-4 w-4" />新建角色</Button>
      </div>

      <div data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {orderedRoles.map((role) => (
          <Card key={role.id} data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" className="border-slate-200 transition hover:shadow-md">
            <CardContent className="p-5">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
                  <ShieldCheck className="h-5 w-5 text-white" />
                </div>
                <Badge variant="outline" className="text-xs">
                  <Users className="mr-1 h-3 w-3" /> {scopeLabel[role.scope] || role.scope}
                </Badge>
              </div>
              <h3 className="font-semibold text-slate-900">{sanitizeDisplayText(role.name, "未命名角色")}</h3>
              <p className="mb-3 mt-1 text-xs text-slate-500">{sanitizeDisplayText(role.description || "", "暂无说明")}</p>
              <div className="mb-2 text-[11px] text-slate-500">权限</div>
              <div className="mb-3 flex flex-wrap gap-1">
                {(role.permissions || []).map((permission) => (
                  <Badge key={permission} variant="outline" className="bg-slate-50 text-[10px]">
                    {sanitizeDisplayText(permission, "权限")}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2 border-t border-slate-100 pt-3">
                <Button variant="outline" size="sm" className="h-7 flex-1 text-xs">
                  <Edit3 className="mr-1 h-3 w-3" /> 编辑
                </Button>
                <Button variant="outline" size="sm" className="h-7 flex-1 text-xs">分配成员</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!orderedRoles.length ? <Card data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" className="border-slate-200"><CardContent className="p-5 text-sm text-slate-500">暂无可显示的角色定义。</CardContent></Card> : null}
      </div>
      </div>
    </FactoryPage>
  );
}
