import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { platformApi, type AIAssignmentResolution } from "@/lib/platform-api";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";

type Props = {
  appKey: string;
  siteId?: string | null;
  title: string;
  description?: string;
};

function scopeLabel(orgType: string, orgCode: string) {
  const value = (orgType || "").toLowerCase();
  if (value === "client") return `客户生效 ${orgCode}`;
  if (value === "agency" || value === "sub_agency") return `代理生效 ${orgCode}`;
  if (value === "hq") return `总部生效 ${orgCode}`;
  if (value === "global") return "平台全局生效";
  return orgCode || "未解析";
}

function chainBadgeClass(entry: { matched: boolean; org_type: string }) {
  if (entry.matched) return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
  const value = (entry.org_type || "").toLowerCase();
  if (value === "client") return "bg-sky-100 text-sky-700 hover:bg-sky-100";
  if (value === "agency" || value === "sub_agency") return "bg-violet-100 text-violet-700 hover:bg-violet-100";
  if (value === "hq") return "bg-amber-100 text-amber-700 hover:bg-amber-100";
  return "bg-slate-100 text-slate-700 hover:bg-slate-100";
}

export default function AIAssignmentScopeCard({ appKey, siteId, title, description }: Props) {
  const [data, setData] = useState<AIAssignmentResolution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const response = await platformApi.resolveAIAssignment({ appKey, siteId: siteId || undefined });
        if (!mounted) return;
        setData(response);
      } catch (event) {
        if (!mounted) return;
        setError(event instanceof Error ? event.message : "加载失败");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [appKey, siteId]);

  const matchedLabel = useMemo(() => {
    if (!data?.resolved) return "当前未找到可用分配";
    return scopeLabel(data.matched_org_type, data.matched_org_code);
  }, [data]);

  return (
    <Card className="border-slate-200">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">{title}</div>
            <div className="mt-1 text-xs text-slate-500">
              {description || "当前页面会实时显示这个 AI 应用实际命中的总部 / 代理 / 客户分配层级。"}
            </div>
          </div>
          <Badge className={data?.resolved ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>
            {loading ? "解析中" : matchedLabel}
          </Badge>
        </div>

        {loading ? (
          <div className="text-xs text-slate-500">正在解析当前 AI 分配链...</div>
        ) : error ? (
          <div className="text-xs text-red-600">分配链读取失败：{error}</div>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-[11px] text-slate-500">当前命中组织</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {sanitizeDisplayText(data.matched_org_name, data.matched_org_code || "未命中")}
                </div>
                <div className="mt-1 font-mono text-[11px] text-slate-500">{data.matched_org_code || "-"}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-[11px] text-slate-500">主运行模型</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {sanitizeDisplayText(data.primary_provider_name, data.primary_provider_key || "-")}
                </div>
                <div className="mt-1 font-mono text-[11px] text-slate-500">{sanitizeDisplayText(data.primary_model, "-")}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-[11px] text-slate-500">站点上下文</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{siteId || "未绑定站点"}</div>
                <div className="mt-1 text-[11px] text-slate-500">应用键：{appKey}</div>
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500">解析顺序</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.search_chain.map((entry) => (
                  <Badge key={`${entry.org_code}-${entry.org_id ?? "global"}`} className={chainBadgeClass(entry)}>
                    {scopeLabel(entry.org_type, entry.org_code)}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
