import { useEffect, useState } from "react";
import { Database, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { acknowledgeCdpPublication, approveCdpProduct, createCdpProduct, listCdpWorkspace, publishCdpProduct, type CdpSource, type CdpWorkspace } from "@/lib/factory-cdp-api";

const EMPTY: CdpWorkspace = { products: [], publications: [], evidence: [], sources: [], metrics: { released_products: 0, consumer_receipt_percent: 0 }, contract: {} };
const reference = (revision: number, prefix: string) => ({ expected_revision: revision, reference: `${prefix}-${Date.now()}` });
const sourceKey = (source: Pick<CdpSource, "profile_version_id" | "timeline_version_id" | "segment_version_id">) => `${source.profile_version_id}:${source.timeline_version_id}:${source.segment_version_id}`;

export default function FactoryCdp() {
  const [projectText, setProjectText] = useState("1");
  const projectId = Number(projectText);
  const [workspace, setWorkspace] = useState(EMPTY);
  const [mode, setMode] = useState("loading");
  const [selectedSourceKey, setSelectedSourceKey] = useState("");

  const load = async (silent = false) => {
    if (!Number.isInteger(projectId) || projectId < 1) return;
    if (!silent) setMode("loading");
    try {
      const next = await listCdpWorkspace(projectId);
      setWorkspace(next);
      setSelectedSourceKey(current => next.sources.some(source => sourceKey(source) === current) ? current : (next.sources[0] ? sourceKey(next.sources[0]) : ""));
      setMode("live");
    } catch (error) {
      setMode("error");
      toast.error(error instanceof Error ? error.message : "CDP 加载失败");
    }
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (action: () => Promise<unknown>, message: string) => {
    try { await action(); toast.success(message); await load(true); }
    catch (error) { toast.error(error instanceof Error ? error.message : "CDP 操作失败"); await load(true); }
  };
  const source = workspace.sources.find(item => sourceKey(item) === selectedSourceKey);
  const product = workspace.products.find(item => source && item.profile_version_id === source.profile_version_id && item.timeline_version_id === source.timeline_version_id && item.segment_version_id === source.segment_version_id);
  const publications = product ? workspace.publications.filter(item => item.product_id === product.id) : [];

  return <FactoryPage pageId="client-cdp" template="dashboard" sourceScope="client_source" autoRegions><main className="p-4 md:p-6" data-factory-cdp-page data-cdp-mode={mode}>
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-xl font-bold"><Database className="h-5 w-5" />客户数据平台</h1><p className="mt-1 text-sm opacity-70">组合已发布身份、客户旅程与同意分群的不可变指针；不复制原始标识，不改写 CRM、营销或服务来源。</p></div>
        <div className="flex gap-2"><Input aria-label="CDP项目编号" className="w-24" value={projectText} onChange={event => setProjectText(event.target.value)} /><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />载入CDP</Button></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2"><Card><CardContent className="py-4"><p className="text-xs opacity-70">已发布数据产品</p><b className="text-2xl">{workspace.metrics.released_products}</b></CardContent></Card><Card><CardContent className="py-4"><p className="text-xs opacity-70">消费者回执</p><b className="text-2xl">{workspace.metrics.consumer_receipt_percent}%</b></CardContent></Card></div>
      <Card><CardHeader><CardTitle className="text-base">1. 固定已发布来源版本</CardTitle></CardHeader><CardContent className="space-y-3">
        <label className="block text-sm font-medium" htmlFor="cdp-source">选择同账户来源组合</label>
        <select id="cdp-source" data-cdp-source-select className="w-full rounded-md border bg-background p-2 text-sm" value={selectedSourceKey} onChange={event => setSelectedSourceKey(event.target.value)} disabled={!workspace.sources.length}>{workspace.sources.map(item => <option key={sourceKey(item)} value={sourceKey(item)}>{item.account_reference} · 身份 {item.profile_version_reference} · 旅程 {item.timeline_version_reference} · 分群 {item.segment_version_reference}</option>)}</select>
        <Button data-cdp-product-create disabled={!source || Boolean(product)} onClick={() => source && void run(() => createCdpProduct(projectId, { product_key: `CUSTOMER-360-${Date.now()}`, profile_version_id: source.profile_version_id, timeline_version_id: source.timeline_version_id, segment_version_id: source.segment_version_id }), "已建立不可变客户数据产品")}>建立客户数据产品</Button>
        {source ? <p className="text-sm">{source.account_reference} · 身份 {source.profile_version_reference} · 旅程 {source.timeline_version_reference} · 同意分群 {source.segment_version_reference}</p> : <p className="text-sm opacity-70">需先完成身份档案、客户旅程与同意分群的独立发布。</p>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">2. 独立审批与受控发布</CardTitle></CardHeader><CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2"><Button data-cdp-product-approve disabled={!product || product.status !== "draft"} onClick={() => product && void run(() => approveCdpProduct(projectId, product.id, reference(product.revision, "CDP-APPROVE")), "数据产品已独立审批")}>独立审批</Button><Button data-cdp-product-publish disabled={!product || product.status !== "approved"} onClick={() => product && void run(() => publishCdpProduct(projectId, product.id, { ...reference(product.revision, "CDP-PUBLISH"), consumers: ["crm", "marketing", "sales", "service"] }), "已向消费者发布冻结清单")}>发布数据产品</Button><Button data-cdp-publications-ack disabled={!product || !publications.some(item => item.status === "pending")} onClick={() => product && void run(() => Promise.all(publications.filter(item => item.status === "pending").map(item => acknowledgeCdpPublication(projectId, item.id, reference(item.revision, "CDP-RECEIPT")))), "消费者已确认清单哈希")}>登记消费者回执</Button></div>
        {workspace.products.map(item => <div key={item.id} data-cdp-record data-cdp-status={item.status} className="rounded border p-3"><b>{item.product_number} · {item.account_reference}</b><Badge className="ml-2">{item.status}</Badge><p className="mt-1 text-xs opacity-70">{item.source_manifest_hash.slice(0, 20)}… · 修订 {item.revision}</p></div>)}
        {workspace.publications.map(item => <div key={item.id} data-cdp-record data-cdp-status={item.status} className="rounded border p-3 text-sm"><Send className="mr-1 inline h-4 w-4" />{item.consumer.toUpperCase()} · {item.publication_number} · <Badge>{item.status}</Badge></div>)}
      </CardContent></Card>
      <Card><CardContent className="flex flex-wrap gap-2 py-4 text-xs"><Badge><ShieldCheck className="mr-1 h-3 w-3" />来源版本冻结</Badge><Badge>原始标识不入库</Badge><Badge>审批、发布、回执均须异人</Badge><Badge>不回写来源系统</Badge><Badge>审计证据 {workspace.evidence.length} 条</Badge></CardContent></Card>
    </div>
  </main></FactoryPage>;
}
