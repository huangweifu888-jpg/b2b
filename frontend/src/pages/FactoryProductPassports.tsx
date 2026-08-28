import { useState } from "react";
import { BadgeCheck, Boxes, FileCheck2, Fingerprint, RefreshCw, Rocket, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FactoryPage } from "@/page-factory/FactoryPage";
import {
  addFactoryProductPassportCertificate,
  createFactoryEngineeringVersion,
  createFactoryProductPassport,
  listFactoryProductPassports,
  publishFactoryProductPassport,
  releaseFactoryEngineeringVersion,
  type FactoryEngineeringVersion,
  type FactoryPassportEligibleOrder,
  type FactoryProductPassport,
} from "@/lib/factory-product-passport-api";

const dateAfter = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const uniqueSuffix = () => Date.now().toString().slice(-8);

export default function FactoryProductPassports() {
  const [projectIdText, setProjectIdText] = useState("1");
  const [engineering, setEngineering] = useState<FactoryEngineeringVersion[]>([]);
  const [passports, setPassports] = useState<FactoryProductPassport[]>([]);
  const [orders, setOrders] = useState<FactoryPassportEligibleOrder[]>([]);
  const [mode, setMode] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [orderId, setOrderId] = useState("");
  const [productReference, setProductReference] = useState("PUMP-001");
  const [skuReference, setSkuReference] = useState("PUMP-001-380V");
  const [productName, setProductName] = useState("工业循环泵 15kW");
  const [engineeringVersion, setEngineeringVersion] = useState("EV-1.0");
  const [ratedPower, setRatedPower] = useState("15kW");
  const [voltage, setVoltage] = useState("380V");
  const [standard, setStandard] = useState("IEC 60034");
  const [releaseReference, setReleaseReference] = useState("ECR-APPROVAL-001");
  const [releaseNote, setReleaseNote] = useState("工程规格与BOM已完成技术、质量和生产联合审批");
  const [targetMarket, setTargetMarket] = useState("EU");
  const [accessMode, setAccessMode] = useState<FactoryProductPassport["access_mode"]>("customer");
  const [certificateType, setCertificateType] = useState("CE Declaration");
  const [certificateNumber, setCertificateNumber] = useState(() => `CE-PUMP-${uniqueSuffix()}`);
  const [issuer, setIssuer] = useState("Factory Compliance Office");
  const [jurisdiction, setJurisdiction] = useState("EU");
  const [validFrom, setValidFrom] = useState(dateAfter(-30));
  const [validUntil, setValidUntil] = useState(dateAfter(365));
  const [certificateEvidence, setCertificateEvidence] = useState("DOC-CE-PUMP-001");
  const projectId = Number(projectIdText);

  const replaceEngineering = (item: FactoryEngineeringVersion) =>
    setEngineering((current) => current.map((candidate) => candidate.id === item.id ? item : candidate));
  const replacePassport = (item: FactoryProductPassport) =>
    setPassports((current) => current.map((candidate) => candidate.id === item.id ? item : candidate));

  const load = async () => {
    setMode("loading");
    try {
      const workspace = await listFactoryProductPassports(projectId);
      setEngineering(workspace.engineering_versions);
      setPassports(workspace.passports);
      setOrders(workspace.eligible_orders);
      setOrderId((current) => current || workspace.eligible_orders[0]?.id || "");
      setMode("live");
    } catch (error) {
      setMode("error");
      toast.error(error instanceof Error ? error.message : "产品护照工作台载入失败");
    }
  };

  const createEngineering = async () => {
    try {
      const item = await createFactoryEngineeringVersion(projectId, {
        order_id: orderId,
        product_reference: productReference,
        sku_reference: skuReference,
        product_name: productName,
        engineering_version: engineeringVersion,
        specification: { rated_power: ratedPower, voltage, standard },
        bom_components: [
          {
            material_reference: "MAT-MOTOR-001",
            material_name: "IE3高效电机",
            supplier_reference: "SUP-MOTOR-01",
            quantity: "1",
            unit: "EA",
            origin_country: "CN",
          },
          {
            material_reference: "MAT-SEAL-001",
            material_name: "机械密封组件",
            supplier_reference: "SUP-SEAL-02",
            quantity: "1",
            unit: "EA",
            origin_country: "DE",
          },
        ],
      });
      setEngineering((current) => [item, ...current]);
      setMode("live");
      toast.success("工程版本与可追溯BOM已建立");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "工程版本创建失败");
    }
  };

  const releaseEngineering = async (item: FactoryEngineeringVersion) => {
    try {
      replaceEngineering(await releaseFactoryEngineeringVersion(projectId, item.id, {
        expected_revision: item.revision,
        release_reference: releaseReference,
        release_note: releaseNote,
      }));
      toast.success("工程版本已发布并冻结事件证据");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "工程版本发布失败");
      await load();
    }
  };

  const createPassport = async (item: FactoryEngineeringVersion) => {
    try {
      const passport = await createFactoryProductPassport(projectId, {
        engineering_version_id: item.id,
        order_id: orderId,
        target_market: targetMarket,
        access_mode: accessMode,
      });
      setPassports((current) => [passport, ...current]);
      toast.success("交付批次已生成产品护照草稿");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "产品护照创建失败");
    }
  };

  const addCertificate = async (item: FactoryProductPassport) => {
    try {
      const result = await addFactoryProductPassportCertificate(projectId, item.id, {
        expected_revision: item.revision,
        certificate_type: certificateType,
        certificate_number: certificateNumber,
        issuer,
        jurisdiction,
        valid_from: `${validFrom}T00:00:00Z`,
        valid_until: `${validUntil}T23:59:59Z`,
        evidence_reference: certificateEvidence,
      });
      replacePassport({
        ...result.passport,
        certificates: [result.certificate],
        linked_assets: item.linked_assets,
      });
      toast.success("证书已核验并关联护照");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "证书核验失败");
      await load();
    }
  };

  const publishPassport = async (item: FactoryProductPassport) => {
    try {
      replacePassport(await publishFactoryProductPassport(projectId, item.id, { expected_revision: item.revision }));
      toast.success("产品护照已发布，追溯摘要与二维码载荷已冻结");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "产品护照发布失败");
      await load();
    }
  };

  return <FactoryPage pageId="client-product-passports" template="dashboard" sourceScope="client_source" autoRegions><main className="p-4 md:p-6" data-factory-product-passports-page data-product-passports-mode={mode}>
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold"><Fingerprint className="h-5 w-5" />产品护照 · PLM追溯</h1>
          <p className="mt-1 text-sm opacity-70">工程版本拥有规格和BOM；护照引用订单、批次、质检、发运、签收、证书与客户资产，不复制权威事实。</p>
        </div>
        <div className="flex items-center gap-2">
          <Input aria-label="产品护照计划ID" value={projectIdText} onChange={(event) => setProjectIdText(event.target.value)} className="w-24" />
          <Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />载入计划</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">建立工程版本与BOM</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
          <select aria-label="护照已交付订单" value={orderId} onChange={(event) => setOrderId(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">选择已交付订单</option>
            {orders.map((order) => <option key={order.id} value={order.id}>{order.order_number} · {order.account_reference}</option>)}
          </select>
          <Input aria-label="护照产品编号" value={productReference} onChange={(event) => setProductReference(event.target.value)} />
          <Input aria-label="护照SKU编号" value={skuReference} onChange={(event) => setSkuReference(event.target.value)} />
          <Input aria-label="工程产品名称" value={productName} onChange={(event) => setProductName(event.target.value)} />
          <Input aria-label="工程版本号" value={engineeringVersion} onChange={(event) => setEngineeringVersion(event.target.value)} />
          <Input aria-label="额定功率" value={ratedPower} onChange={(event) => setRatedPower(event.target.value)} />
          <Input aria-label="额定电压" value={voltage} onChange={(event) => setVoltage(event.target.value)} />
          <Input aria-label="工程标准" value={standard} onChange={(event) => setStandard(event.target.value)} />
          <Button data-engineering-version-create onClick={() => void createEngineering()}><Boxes className="mr-1 h-4 w-4" />建立版本</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">发布与合规参数</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
          <Input aria-label="工程发布依据" value={releaseReference} onChange={(event) => setReleaseReference(event.target.value)} />
          <Input aria-label="工程发布说明" value={releaseNote} onChange={(event) => setReleaseNote(event.target.value)} />
          <Input aria-label="护照目标市场" value={targetMarket} onChange={(event) => setTargetMarket(event.target.value)} />
          <select aria-label="护照访问模式" value={accessMode} onChange={(event) => setAccessMode(event.target.value as FactoryProductPassport["access_mode"])} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="controlled">内部受控</option><option value="customer">客户可见</option><option value="public-summary">公开摘要</option>
          </select>
          <Input aria-label="证书类型" value={certificateType} onChange={(event) => setCertificateType(event.target.value)} />
          <Input aria-label="证书编号" value={certificateNumber} onChange={(event) => setCertificateNumber(event.target.value)} />
          <Input aria-label="证书签发方" value={issuer} onChange={(event) => setIssuer(event.target.value)} />
          <Input aria-label="证书适用地区" value={jurisdiction} onChange={(event) => setJurisdiction(event.target.value)} />
          <Input aria-label="证书生效日" type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
          <Input aria-label="证书到期日" type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
          <Input aria-label="证书证据编号" value={certificateEvidence} onChange={(event) => setCertificateEvidence(event.target.value)} />
        </CardContent>
      </Card>

      <div className="grid gap-3 xl:grid-cols-2">
        {engineering.map((item) => <Card key={item.id} data-engineering-version={item.id} data-engineering-status={item.lifecycle_status}>
          <CardHeader className="pb-2"><CardTitle className="flex items-center justify-between gap-2 text-sm"><span>{item.engineering_number} · {item.engineering_version}</span><Badge>{item.lifecycle_status === "released" ? "已发布" : "草稿"}</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><b>{item.product_name}</b> · {item.product_reference}/{item.sku_reference}</p>
            <p>规格 {Object.entries(item.specification).map(([key, value]) => `${key}:${value}`).join(" · ")}</p>
            <p>BOM {item.bom_components.length} 项 · 供应商 {new Set(item.bom_components.map((component) => component.supplier_reference)).size} 家</p>
            <div className="flex flex-wrap gap-2">
              {item.lifecycle_status === "draft" ? <Button data-engineering-release size="sm" onClick={() => void releaseEngineering(item)}><BadgeCheck className="mr-1 h-4 w-4" />发布工程</Button> : <Button data-product-passport-create size="sm" onClick={() => void createPassport(item)}><Fingerprint className="mr-1 h-4 w-4" />创建护照</Button>}
            </div>
          </CardContent>
        </Card>)}
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {passports.map((item) => <Card key={item.id} data-product-passport={item.id} data-passport-status={item.lifecycle_status}>
          <CardHeader className="pb-2"><CardTitle className="flex items-center justify-between gap-2 text-sm"><span>{item.passport_number}</span><Badge>{item.lifecycle_status === "published" ? "已发布" : "待证书"}</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>订单 <b>{item.order_number}</b> · 工单 {item.work_order_reference} · 批次 {item.batch_reference}</p>
            <p>质检 {item.inspection_reference} · 发运 {item.shipment_reference} · 签收 {item.delivery_receipt_reference}</p>
            <p>目标 {item.target_market} · 证书 {item.certificates.length} 项 · 关联客户资产 <b data-passport-linked-assets>{item.linked_assets.length}</b> 台</p>
            {item.trace_digest ? <p data-passport-trace-digest className="break-all font-mono text-xs">SHA-256 {item.trace_digest}</p> : null}
            {item.lifecycle_status === "published" ? <p data-passport-published className="flex items-center gap-1 font-semibold text-emerald-600"><ShieldCheck className="h-4 w-4" />追溯摘要、证书与二维码载荷已冻结</p> : <div className="flex flex-wrap gap-2">
              {item.certificates.length === 0 ? <Button data-passport-certificate-add size="sm" variant="outline" onClick={() => void addCertificate(item)}><FileCheck2 className="mr-1 h-4 w-4" />核验证书</Button> : <Button data-passport-publish size="sm" onClick={() => void publishPassport(item)}><Rocket className="mr-1 h-4 w-4" />发布护照</Button>}
            </div>}
          </CardContent>
        </Card>)}
      </div>
    </div>
  </main></FactoryPage>;
}
