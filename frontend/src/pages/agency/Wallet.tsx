import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, TrendingUp, TrendingDown, Plus, Download } from "lucide-react";

import { loadAgencyLiveSnapshot } from "@/lib/agency-live-data";
import { deriveAgencyWalletTxns } from "@/lib/agency-derived-data";
import { FactoryPage } from "@/page-factory/FactoryPage";

const typeMap: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  recharge: { label: "充值", cls: "text-emerald-600", icon: TrendingUp },
  consume: { label: "消费", cls: "text-slate-700", icon: TrendingDown },
  refund: { label: "退款", cls: "text-blue-600", icon: TrendingUp },
};

export default function WalletPage() {
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

  const walletTxns = useMemo(() => (snapshot ? deriveAgencyWalletTxns(snapshot) : []), [snapshot]);
  const orderedWalletTxns = [...walletTxns].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const balance = orderedWalletTxns[0]?.balance || 0;

  return (
    <FactoryPage pageId="agency-wallet" template="workflow" sourceScope="agency_source" className="space-y-6">
      <div data-page-factory-region="content" data-development-standard-frame-region="content" data-development-standard-frame-label="内容" className="space-y-6">
      <div data-page-factory-region="title-2" data-development-standard-frame-region="title-2" data-development-standard-frame-label="标题二" className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">钱包管理</h1>
          <p className="mt-1 text-sm text-slate-500">代理商账户余额与交易流水</p>
        </div>
        <Button variant="outline" className="self-start sm:self-auto">
          <Download className="mr-2 h-4 w-4" />
          导出账单
        </Button>
      </div>

      <div data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" className="md:col-span-2 border-0 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                <span className="text-sm opacity-90">代理商钱包</span>
              </div>
              <Badge className="bg-white/20 text-white hover:bg-white/20">VIP</Badge>
            </div>
            <div className="text-xs opacity-80">当前余额</div>
            <div className="mt-1 text-4xl font-bold">¥{balance.toLocaleString()}</div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button size="sm" className="bg-white text-violet-600 hover:bg-slate-100">
                <Plus className="mr-1 h-4 w-4" />
                充值
              </Button>
              <Button size="sm" variant="outline" className="border-white/50 !bg-transparent text-white">
                提现
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-3">
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">本月消费</div>
              <div className="mt-1 text-xl font-bold">¥50,400</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">本月充值</div>
              <div className="mt-1 text-xl font-bold text-emerald-600">¥150,000</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card data-page-factory-region="table-shell" data-development-standard-frame-region="table-shell" data-development-standard-frame-label="表内" className="border-slate-200">
        <CardContent className="p-0">
          <div className="border-b border-slate-200 p-4 font-semibold">交易流水</div>
          <div data-page-factory-region="scrollbar" data-development-standard-frame-region="scrollbar" data-development-standard-frame-label="滚动条" className="responsive-table-wrap">
            <table className="w-full text-sm">
              <thead data-page-factory-region="table-header" data-development-standard-frame-region="table-header" data-development-standard-frame-label="表头" className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">流水号</th>
                  <th className="px-4 py-3 text-left font-medium">类型</th>
                  <th className="px-4 py-3 text-left font-medium">说明</th>
                  <th className="px-4 py-3 text-left font-medium">支付方式</th>
                  <th className="px-4 py-3 text-right font-medium">金额</th>
                  <th className="px-4 py-3 text-right font-medium">余额</th>
                  <th className="px-4 py-3 text-left font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {orderedWalletTxns.map((txn) => {
                  const info = typeMap[txn.type] || { label: "其他", cls: "text-slate-700", icon: TrendingDown };
                  const Icon = info.icon;
                  return (
                    <tr key={txn.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs">{txn.id}</td>
                      <td className="px-4 py-3">
                        <div className={`flex items-center gap-1 ${info.cls}`}>
                          <Icon className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">{info.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{txn.desc}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{txn.method}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${info.cls}`}>
                        {txn.amount > 0 ? "+" : ""}¥{Math.abs(txn.amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">¥{txn.balance.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{txn.date}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </div>
    </FactoryPage>
  );
}
