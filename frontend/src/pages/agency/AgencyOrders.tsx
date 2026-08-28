import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Download, FileText, Search } from "lucide-react";

import { loadAgencyLiveSnapshot } from "@/lib/agency-live-data";
import { deriveAgencyOrders } from "@/lib/agency-derived-data";
import { FactoryPage } from "@/page-factory/FactoryPage";

const statusMap: Record<string, { label: string; cls: string }> = {
  paid: { label: "已支付", cls: "bg-emerald-100 text-emerald-700" },
  pending: { label: "待支付", cls: "bg-amber-100 text-amber-700" },
  refund: { label: "已退款", cls: "bg-red-100 text-red-700" },
};

export default function AgencyOrders() {
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof loadAgencyLiveSnapshot>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const next = await loadAgencyLiveSnapshot();
      if (mounted) {
        setSnapshot(next);
        setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const orders = useMemo(() => (snapshot ? deriveAgencyOrders(snapshot) : []), [snapshot]);
  const total = orders.filter((o) => o.status === "paid").reduce((s, o) => s + o.amount, 0);

  return (
    <FactoryPage pageId="agency-orders" template="list" sourceScope="agency_source" className="space-y-6">
      <div data-page-factory-region="content" data-development-standard-frame-region="content" data-development-standard-frame-label="内容" className="space-y-6">
      <div data-page-factory-region="title-2" data-development-standard-frame-region="title-2" data-development-standard-frame-label="标题二" className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">订单管理</h1>
          <p className="mt-1 text-sm text-slate-500">当前代理下的真实订单列表</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          导出账单
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Card className="border-slate-200"><CardContent className="p-4"><div className="text-xs text-slate-500">订单总数</div><div className="text-2xl font-bold">{orders.length}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-4"><div className="text-xs text-slate-500">已支付总额</div><div className="text-2xl font-bold text-emerald-600">¥{total.toLocaleString()}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-4"><div className="text-xs text-slate-500">待支付</div><div className="text-2xl font-bold text-amber-600">{orders.filter((o) => o.status === "pending").length}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-4"><div className="text-xs text-slate-500">已开发票</div><div className="text-2xl font-bold">{orders.filter((o) => o.invoice === "已开").length}</div></CardContent></Card>
      </div>

      <Card data-page-factory-region="table-shell" data-development-standard-frame-region="table-shell" data-development-standard-frame-label="表内" className="border-slate-200">
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-slate-200 p-4">
            <Search className="h-4 w-4 text-slate-400" />
            <Input placeholder="搜索订单号、企业或计划" className="h-8 flex-1 border-0 shadow-none focus-visible:ring-0" />
            <Button variant="outline" size="sm">筛选</Button>
          </div>
          <div data-page-factory-region="scrollbar" data-page-list-scroll-owner className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead data-page-factory-region="table-header" data-development-standard-frame-region="table-header" data-development-standard-frame-label="表头" className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">订单号</th>
                  <th className="px-4 py-3 text-left font-medium">企业</th>
                  <th className="px-4 py-3 text-left font-medium">计划</th>
                  <th className="px-4 py-3 text-right font-medium">金额</th>
                  <th className="px-4 py-3 text-left font-medium">支付方式</th>
                  <th className="px-4 py-3 text-left font-medium">状态</th>
                  <th className="px-4 py-3 text-left font-medium">发票</th>
                  <th className="px-4 py-3 text-left font-medium">日期</th>
                  <th className="px-4 py-3 text-center font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{order.id}</td>
                    <td className="px-4 py-3">{order.enterprise}</td>
                    <td className="px-4 py-3 text-slate-600">{order.plan}</td>
                    <td className="px-4 py-3 text-right font-semibold">¥{order.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs">{order.method}</td>
                    <td className="px-4 py-3">
                      <Badge className={`${statusMap[order.status].cls} hover:${statusMap[order.status].cls}`}>
                        {statusMap[order.status].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">{order.invoice}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{order.date}</td>
                    <td className="px-4 py-3 text-center">
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        <FileText className="mr-1 h-3 w-3" />
                        详情
                      </Button>
                    </td>
                  </tr>
                ))}
                {!loading && orders.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={9}>
                      当前没有可展示的订单
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </div>
    </FactoryPage>
  );
}
