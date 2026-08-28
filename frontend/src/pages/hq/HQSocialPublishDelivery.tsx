import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { socialPublishDeliveryApi, type SocialPublishDeliveryChecklistItem, type SocialPublishDeliveryReadiness } from "@/lib/social-publish-delivery-api";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { CheckCircle2, LockKeyhole, RefreshCw, ServerCog } from "lucide-react";
import { formatDisplayOrdinal } from "@/lib/display-number-contract";

const FALLBACK_CHECKLIST: SocialPublishDeliveryChecklistItem[] = [
  { id: "database", title: "执行数据库迁移", owner: "总部运维", detail: "部署审核与授权控制表后再启用正式队列。" },
  { id: "https", title: "配置 HTTPS 回调域名", owner: "总部运维", detail: "OAuth 回调只能使用正式 HTTPS 域名。" },
  { id: "secrets", title: "接入密钥库", owner: "总部安全", detail: "密钥和令牌永不进入客户端或代码仓库。" },
  { id: "apps", title: "配置平台应用", owner: "总部运营", detail: "完成各渠道 App、权限和平台审核。" },
  { id: "worker", title: "启用发布工作进程", owner: "总部运维", detail: "先在沙箱校验队列、重试、审计和回执。" },
];

export default function HQSocialPublishDelivery() {
  const [readiness, setReadiness] = useState<SocialPublishDeliveryReadiness | null>(null);
  const [items, setItems] = useState<SocialPublishDeliveryChecklistItem[]>(FALLBACK_CHECKLIST);
  const [notice, setNotice] = useState("正在读取部署就绪状态。");
  const [loading, setLoading] = useState(false);
  const load = async () => { setLoading(true); try { const [nextReadiness, nextChecklist] = await Promise.all([socialPublishDeliveryApi.readiness(), socialPublishDeliveryApi.checklist()]); setReadiness(nextReadiness); setItems(nextChecklist.items); setNotice(nextReadiness.message); } catch { setReadiness(null); setNotice("尚未连接总部服务；以下清单只能作为人工准备参考，不能证明外部发布就绪。"); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const checks = readiness ? [
    ["数据库与迁移", readiness.database_configured], ["OAuth 回调域名", readiness.callback_base_configured], ["密钥库", readiness.secrets_backend_configured], ["发布工作进程", readiness.worker_enabled], ["外部执行开关", readiness.execution_enabled], ["官方发布连接器", readiness.connector_implemented],
  ] : [] as Array<[string, boolean]>;

  return <FactoryPage pageId="hq-social-publish-delivery" template="dashboard" sourceScope="hq" autoRegions><div className="space-y-4 p-6" data-social-publish-delivery>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">社交发布部署中心</h1><p className="mt-1 text-sm text-slate-600">把本地审核和排期链路交接给云端 OAuth、队列和工作进程；没有全部条件时，系统保持锁定。</p></div><Button variant="outline" disabled={loading} onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />刷新状态</Button></div>
    <Card className={readiness?.ready_for_external_publish ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}><CardContent className="flex gap-3 p-4 text-sm leading-6"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" />{notice}</CardContent></Card>
    {checks.length ? <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{checks.map(([label, passed]) => <Card key={label}><CardContent className="p-4"><div className="flex items-center justify-between gap-2 text-sm font-medium">{label}{passed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <ServerCog className="h-4 w-4 text-amber-600" />}</div><Badge variant="outline" className={`mt-3 ${passed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{passed ? "已配置" : "待配置"}</Badge></CardContent></Card>)}</div> : null}
    <Card><CardHeader><CardTitle className="text-base">上线准备清单</CardTitle></CardHeader><CardContent className="space-y-3">{items.map((item, index) => <div key={item.id} className="flex gap-3 rounded-md border border-slate-200 p-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">{formatDisplayOrdinal(index + 1)}</span><div><div className="font-medium text-slate-900">{item.title} <span className="ml-1 text-xs font-normal text-slate-500">· {item.owner}</span></div><p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p></div></div>)}</CardContent></Card>
  </div></FactoryPage>;
}
