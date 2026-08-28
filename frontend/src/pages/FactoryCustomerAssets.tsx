import { useState } from "react";
import { CalendarClock, CheckCircle2, ClipboardPlus, RefreshCw, ShieldCheck, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createFactoryAssetServiceTicket, flagFactoryCustomerAssetWarranty, listFactoryCustomerAssets, registerFactoryCustomerAsset, transitionFactoryAssetServiceTicket, type FactoryAssetEligibleOrder, type FactoryAssetServiceTicket, type FactoryCustomerAsset } from "@/lib/factory-customer-asset-api";
import { CustomerSuccessGovernance } from "@/components/customer-success/CustomerSuccessGovernance";
import { FactoryPage } from "@/page-factory/FactoryPage";

const dateAfter = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const ASSET_STATUS: Record<string, string> = { active: "正常运行", "service-open": "服务处理中", retired: "已退役" };
const TICKET_STATUS: Record<string, string> = { open: "待调度", scheduled: "已排期", "in-progress": "处理中", resolved: "已解决" };

export default function FactoryCustomerAssets() {
  const [projectIdText, setProjectIdText] = useState("1");
  const [assets, setAssets] = useState<FactoryCustomerAsset[]>([]);
  const [tickets, setTickets] = useState<FactoryAssetServiceTicket[]>([]);
  const [orders, setOrders] = useState<FactoryAssetEligibleOrder[]>([]);
  const [mode, setMode] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [orderId, setOrderId] = useState("");
  const [product, setProduct] = useState("PUMP-001");
  const [sku, setSku] = useState("PUMP-001-380V");
  const [serial, setSerial] = useState(() => `SN-${Date.now().toString().slice(-8)}`);
  const [location, setLocation] = useState("客户上海工厂 · 1号产线");
  const [installedAt, setInstalledAt] = useState(dateAfter(-2));
  const [warrantyUntil, setWarrantyUntil] = useState(dateAfter(60));
  const [serviceDue, setServiceDue] = useState(dateAfter(30));
  const [issue, setIssue] = useState("设备振动偏高，需要现场检查与校准");
  const [severity, setSeverity] = useState<FactoryAssetServiceTicket["severity"]>("high");
  const [serviceOwner, setServiceOwner] = useState("engineer-001");
  const [scheduledFor, setScheduledFor] = useState(dateAfter(1));
  const [resolutionReference, setResolutionReference] = useState("SERVICE-REPORT-001");
  const [resolutionNote, setResolutionNote] = useState("轴承对中已校正，复测振动恢复正常");
  const [renewalOwner, setRenewalOwner] = useState("account-manager-001");
  const [renewalAction, setRenewalAction] = useState("准备年度维保续约报价并安排客户复盘");
  const projectId = Number(projectIdText);

  const replaceAsset = (item: FactoryCustomerAsset) => setAssets((current) => current.map((asset) => asset.id === item.id ? item : asset));
  const replaceTicket = (item: FactoryAssetServiceTicket) => setTickets((current) => current.map((ticket) => ticket.id === item.id ? item : ticket));
  const load = async () => {
    setMode("loading");
    try { const workspace = await listFactoryCustomerAssets(projectId); setAssets(workspace.assets); setTickets(workspace.tickets); setOrders(workspace.eligible_orders); setOrderId((current) => current || workspace.eligible_orders[0]?.id || ""); setMode("live"); }
    catch (error) { setMode("error"); toast.error(error instanceof Error ? error.message : "客户资产连接失败"); }
  };
  const register = async () => {
    try { const item = await registerFactoryCustomerAsset(projectId, { order_id: orderId, product_reference: product, sku_reference: sku, serial_number: serial, installation_location: location, installed_at: `${installedAt}T09:00:00Z`, warranty_until: `${warrantyUntil}T23:59:59Z`, next_service_due_at: `${serviceDue}T09:00:00Z` }); setAssets((current) => [item, ...current]); setMode("live"); toast.success("客户装机资产已登记并关联确认订单"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "资产登记失败"); }
  };
  const createTicket = async (asset: FactoryCustomerAsset) => {
    try { const result = await createFactoryAssetServiceTicket(projectId, asset.id, { issue_summary: issue, severity }); replaceAsset(result.asset); setTickets((current) => [result.ticket, ...current]); toast.success("服务工单已创建并启动SLA"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "服务工单创建失败"); }
  };
  const transitionTicket = async (ticket: FactoryAssetServiceTicket) => {
    const action = ticket.status === "open" ? "schedule" : ticket.status === "scheduled" ? "start" : "resolve";
    try { const result = await transitionFactoryAssetServiceTicket(projectId, ticket.id, { expected_revision: ticket.revision, action, ...(action === "schedule" ? { assigned_to: serviceOwner, scheduled_for: `${scheduledFor}T09:00:00Z` } : {}), ...(action === "resolve" ? { resolution_reference: resolutionReference, resolution_note: resolutionNote, next_service_due_at: `${dateAfter(90)}T09:00:00Z` } : {}) }); replaceAsset(result.asset); replaceTicket(result.ticket); toast.success({ schedule: "服务已排期", start: "现场服务已开始", resolve: "服务已解决并形成证据" }[action]); }
    catch (error) { toast.error(error instanceof Error ? error.message : "服务推进失败"); await load(); }
  };
  const flagWarranty = async (asset: FactoryCustomerAsset) => {
    try { replaceAsset(await flagFactoryCustomerAssetWarranty(projectId, asset.id, { expected_revision: asset.revision, renewal_owner: renewalOwner, renewal_action: renewalAction })); toast.success("保修到期行动已进入续费跟进"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "续费行动创建失败"); await load(); }
  };

  return <FactoryPage pageId="client-customer-assets" template="dashboard" sourceScope="client_source"><main data-page-factory-region="content" className="p-4 md:p-6" data-factory-customer-assets-page data-customer-assets-mode={mode}>
    <div className="mx-auto max-w-7xl space-y-4">
      <div data-page-factory-region="title-2" className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-xl font-bold"><ShieldCheck className="h-5 w-5" />客户资产 · 服务续费</h1><p className="mt-1 text-sm opacity-70">以已签收确认订单、产品、SKU和序列号建立装机档案；服务与续费只引用权威事实，不覆盖订单或产品主档。</p></div><div className="flex items-center gap-2"><Input aria-label="客户资产计划ID" value={projectIdText} onChange={(event) => setProjectIdText(event.target.value)} className="w-24" /><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />载入计划</Button></div></div>
      <Card data-page-factory-region="large-card"><CardHeader><CardTitle className="text-base">登记装机资产</CardTitle></CardHeader><CardContent data-page-factory-region="small-card" className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
        <select aria-label="已签收订单" value={orderId} onChange={(event) => setOrderId(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">选择已签收订单</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.order_number} · {order.account_reference}</option>)}</select>
        <Input aria-label="资产产品编号" value={product} onChange={(event) => setProduct(event.target.value)} /><Input aria-label="资产SKU编号" value={sku} onChange={(event) => setSku(event.target.value)} /><Input aria-label="设备序列号" value={serial} onChange={(event) => setSerial(event.target.value)} /><Input aria-label="安装位置" value={location} onChange={(event) => setLocation(event.target.value)} /><Input aria-label="安装日期" type="date" value={installedAt} onChange={(event) => setInstalledAt(event.target.value)} /><Input aria-label="保修到期" type="date" value={warrantyUntil} onChange={(event) => setWarrantyUntil(event.target.value)} /><Input aria-label="下次维护" type="date" value={serviceDue} onChange={(event) => setServiceDue(event.target.value)} /><Button data-customer-asset-register onClick={() => void register()}><ClipboardPlus className="mr-1 h-4 w-4" />登记资产</Button>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">服务与续费执行参数</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-3 xl:grid-cols-4"><Input aria-label="服务问题" value={issue} onChange={(event) => setIssue(event.target.value)} /><select aria-label="服务等级" value={severity} onChange={(event) => setSeverity(event.target.value as FactoryAssetServiceTicket["severity"])} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="critical">紧急 · 4小时</option><option value="high">高 · 8小时</option><option value="medium">中 · 24小时</option><option value="low">低 · 72小时</option></select><Input aria-label="服务负责人" value={serviceOwner} onChange={(event) => setServiceOwner(event.target.value)} /><Input aria-label="服务排期" type="date" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} /><Input aria-label="解决证据编号" value={resolutionReference} onChange={(event) => setResolutionReference(event.target.value)} /><Input aria-label="解决说明" value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} /><Input aria-label="续费负责人" value={renewalOwner} onChange={(event) => setRenewalOwner(event.target.value)} /><Input aria-label="续费行动" value={renewalAction} onChange={(event) => setRenewalAction(event.target.value)} /></CardContent></Card>
      <div className="grid gap-3 xl:grid-cols-2">{assets.map((asset) => <Card key={asset.id} data-customer-asset={asset.id} data-asset-status={asset.status} data-renewal-status={asset.renewal_status}><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between gap-2 text-sm"><span>{asset.asset_number} · {asset.serial_number}</span><Badge>{ASSET_STATUS[asset.status] || asset.status}</Badge></CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>订单 <b>{asset.order_number}</b> · {asset.product_reference}/{asset.sku_reference}</p><p>安装：{asset.installation_location} · 保修至 {new Date(asset.warranty_until).toLocaleDateString()} · 服务 {asset.service_count} 次</p><p>续费状态：<b>{asset.renewal_status}</b>{asset.renewal_owner ? ` · ${asset.renewal_owner}` : ""}</p><div className="flex flex-wrap gap-2"><Button data-asset-service-create size="sm" disabled={asset.status === "service-open"} onClick={() => void createTicket(asset)}><Wrench className="mr-1 h-4 w-4" />创建服务</Button>{asset.renewal_status === "monitoring" ? <Button data-warranty-action size="sm" variant="outline" onClick={() => void flagWarranty(asset)}><CalendarClock className="mr-1 h-4 w-4" />到期行动</Button> : null}</div></CardContent></Card>)}</div>
      <div className="grid gap-3 xl:grid-cols-2">{tickets.map((ticket) => <Card key={ticket.id} data-service-ticket={ticket.id} data-service-status={ticket.status}><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between gap-2 text-sm"><span>{ticket.ticket_number} · {ticket.asset_number}</span><Badge>{TICKET_STATUS[ticket.status]}</Badge></CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>{ticket.issue_summary} · SLA {new Date(ticket.sla_due_at).toLocaleString()}</p>{ticket.status !== "resolved" ? <Button data-service-transition={ticket.status} size="sm" onClick={() => void transitionTicket(ticket)}>{ticket.status === "in-progress" ? <CheckCircle2 className="mr-1 h-4 w-4" /> : <Wrench className="mr-1 h-4 w-4" />}{ticket.status === "open" ? "安排服务" : ticket.status === "scheduled" ? "开始服务" : "解决工单"}</Button> : <p data-service-resolved className="font-semibold text-emerald-600">已解决：{ticket.resolution_reference} · 服务证据已冻结。</p>}</CardContent></Card>)}</div>
      <CustomerSuccessGovernance projectId={projectId} assets={assets} />
    </div>
  </main></FactoryPage>;
}
