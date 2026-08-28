import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Waves, UserPlus } from "lucide-react";

import { loadAgencyLiveSnapshot } from "@/lib/agency-live-data";
import { deriveAgencyPublicPool } from "@/lib/agency-derived-data";
import { FactoryPage } from "@/page-factory/FactoryPage";

export default function PublicPool() {
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

  const publicPool = useMemo(() => (snapshot ? deriveAgencyPublicPool(snapshot) : []), [snapshot]);
  const totalValue = publicPool.reduce((sum, item) => sum + item.value, 0);

  return (
    <FactoryPage pageId="agency-public-pool" template="list" sourceScope="agency_source" className="space-y-6">
      <div data-page-factory-region="content" data-development-standard-frame-region="content" data-development-standard-frame-label="内容" className="space-y-6">
      <div data-page-factory-region="title-2" data-development-standard-frame-region="title-2" data-development-standard-frame-label="标题二" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Waves className="h-6 w-6 text-sky-500" />
            公海池
          </h1>
          <p className="mt-1 text-sm text-slate-500">尚未绑定到计划的客户线索，按真实组织树动态生成</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">批量导入</Button>
          <Button className="bg-sky-600 hover:bg-sky-700">自动分配规则</Button>
        </div>
      </div>

      <Card className="border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-sky-700">当前公海客户</div>
              <div className="mt-1 text-3xl font-bold text-sky-900">{publicPool.length}</div>
              <div className="mt-1 text-xs text-sky-600">预计总价值 ${totalValue.toLocaleString()}</div>
            </div>
            <Waves className="h-16 w-16 text-sky-300" />
          </div>
        </CardContent>
      </Card>

      <Card data-page-factory-region="table-shell" data-development-standard-frame-region="table-shell" data-development-standard-frame-label="表内" className="border-slate-200">
        <CardContent className="p-0">
          <div data-page-factory-region="scrollbar" data-page-list-scroll-owner className="responsive-table-wrap">
            <table className="w-full text-sm">
              <thead data-page-factory-region="table-header" data-development-standard-frame-region="table-header" data-development-standard-frame-label="表头" className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">客户</th>
                  <th className="px-4 py-3 text-left font-medium">公司</th>
                  <th className="px-4 py-3 text-left font-medium">国家</th>
                  <th className="px-4 py-3 text-left font-medium">进入原因</th>
                  <th className="px-4 py-3 text-left font-medium">可领取时间</th>
                  <th className="px-4 py-3 text-right font-medium">预估价值</th>
                  <th className="px-4 py-3 text-center font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {publicPool.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{item.customer}</td>
                    <td className="px-4 py-3 text-slate-600">{item.company}</td>
                    <td className="px-4 py-3">{item.country}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">{item.reason}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{item.available}</td>
                    <td className="px-4 py-3 text-right font-semibold">${item.value.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <Button size="sm" className="h-7 bg-sky-600 text-xs hover:bg-sky-700">
                        <UserPlus className="mr-1 h-3 w-3" /> 领取
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </div>
    </FactoryPage>
  );
}
