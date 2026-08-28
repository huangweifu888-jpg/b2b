import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Gauge, TrendingUp, AlertTriangle } from "lucide-react";

import { loadAgencyLiveSnapshot } from "@/lib/agency-live-data";
import { deriveAgencyQuotas } from "@/lib/agency-derived-data";
import { FactoryPage } from "@/page-factory/FactoryPage";

export default function Quotas() {
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof loadAgencyLiveSnapshot>> | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadAgencyLiveSnapshot().then((next) => {
      if (mounted) setSnapshot(next);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const quotas = useMemo(() => (snapshot ? deriveAgencyQuotas(snapshot) : []), [snapshot]);

  return (
    <FactoryPage pageId="agency-quotas" template="dashboard" sourceScope="agency_source" className="space-y-6">
      <div data-page-factory-region="content" data-development-standard-frame-region="content" data-development-standard-frame-label="内容" className="space-y-6">
      <div data-page-factory-region="title-2" data-development-standard-frame-region="title-2" data-development-standard-frame-label="标题二" className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">配额管理</h1>
          <p className="mt-1 text-sm text-slate-500">围绕当前组织树的资源使用量与阈值监控</p>
        </div>
        <Button className="bg-violet-600 hover:bg-violet-700"><TrendingUp className="mr-2 h-4 w-4" />扩容</Button>
      </div>

      <div data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {quotas.map((quota) => {
          const pct = (quota.used / quota.limit) * 100;
          const warn = pct > 70;
          const danger = pct > 90;
          return (
            <Card key={quota.resource} data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" className={`border-slate-200 ${danger ? "border-red-300 bg-red-50/50" : warn ? "border-amber-300 bg-amber-50/30" : ""}`}>
              <CardContent className="p-5">
                <div className="mb-3 flex items-start justify-between">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${danger ? "bg-red-100" : warn ? "bg-amber-100" : "bg-violet-50"}`}>
                    {danger ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <Gauge className={`h-4 w-4 ${warn ? "text-amber-600" : "text-violet-600"}`} />}
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${danger ? "text-red-700 border-red-300" : warn ? "text-amber-700 border-amber-300" : ""}`}>
                    {pct.toFixed(0)}%
                  </Badge>
                </div>
                <div className="text-sm font-semibold text-slate-900">{quota.resource}</div>
                <div className="mt-3">
                  <Progress value={pct} className="h-2" />
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>{quota.used.toLocaleString()}</span>
                  <span>/ {quota.limit.toLocaleString()} {quota.unit}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      </div>
    </FactoryPage>
  );
}
