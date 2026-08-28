import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { toast } from "sonner";
import {
  approveDigitalAsset, approveDigitalAssetHandoff, approveDigitalAssetPlan, createDigitalAssetPlan,
  generateDigitalAssetSuggestion, listDigitalAssetWorkspace, prepareDigitalAssetHandoff,
  registerDigitalAsset, reviewDigitalAssetSuggestion, type DigitalAssetWorkspace,
} from "@/lib/factory-digital-assets-api";

const empty: DigitalAssetWorkspace = { plans: [], suggestions: [], assets: [], handoffs: [], evidence: [], metrics: {}, availability: { application_id: "identity.digital-assets", status: "pilot", release_version: null }, contract: {} };

export default function FactoryDigitalAssets() {
  const [workspace, setWorkspace] = useState(empty);
  const [mode, setMode] = useState("loading");
  const [project, setProject] = useState(1);
  const load = async () => {
    try { setMode("loading"); setWorkspace(await listDigitalAssetWorkspace(project)); setMode("live"); }
    catch (error) { setMode("error"); toast.error(error instanceof Error ? error.message : "数字资产工作台加载失败"); }
  };
  useEffect(() => { void load(); }, [project]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (action: () => Promise<unknown>, message: string) => {
    try { await action(); toast.success(message); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "数字资产操作失败"); await load(); }
  };
  const reference = (prefix: string, revision = 1) => ({ expected_revision: revision, reference: `${prefix}-${Date.now()}` });
  const plan = workspace.plans[0];
  const suggestion = workspace.suggestions.find((item) => item.source_plan_id === plan?.id && item.status === "pending-review");
  const asset = workspace.assets.find((item) => item.source_plan_id === plan?.id && item.status === "pending-approval");
  const approvedAsset = workspace.assets.find((item) => item.source_plan_id === plan?.id && item.status === "rights-approved");
  const reviewedSuggestion = workspace.suggestions.find((item) => item.source_plan_id === plan?.id && item.status === "reviewed");
  const handoff = workspace.handoffs.find((item) => item.source_plan_id === plan?.id);
  return <FactoryPage pageId="client-digital-assets" template="dashboard" sourceScope="client_source" autoRegions><main className="space-y-4 p-4 md:p-6" data-factory-digital-assets-page data-digital-assets-mode={mode} data-digital-assets-availability={workspace.availability.status}>
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h1 className="text-xl font-bold">AI计划与数字资产</h1><p className="text-sm opacity-70">AI 只提供建议；域名、商标和授权必须人工核验。系统不保存注册商密钥，不购买、绑定或转移域名，也不自动发布或覆盖站点。</p></div><Input className="w-20" aria-label="项目编号" value={project} onChange={(event) => setProject(Number(event.target.value) || 1)} /></div>
    <div className="grid gap-2 sm:grid-cols-4">{Object.entries(workspace.metrics).map(([name, value]) => <Card key={name}><CardContent className="py-3 text-sm"><span className="opacity-70">{name}</span><b className="ml-2">{value}</b></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle className="text-base">1. 计划、AI建议与数字资产权利</CardTitle></CardHeader><CardContent className="space-y-3">
      <div className="flex flex-wrap gap-2"><Button data-digital-assets-plan-create disabled={Boolean(plan)} onClick={() => void run(() => createDigitalAssetPlan(project, { business_goal: "建立可核验的工业自动化获客站", target_market: "德国", target_audience: "工业自动化采购团队", site_scope: "产品、案例、信任与联系页面" }), "数字资产计划已建立")}>建立AI建站计划</Button>
      <Button data-digital-assets-suggestion-generate disabled={!plan || Boolean(suggestion) || Boolean(reviewedSuggestion)} onClick={() => plan && void run(() => generateDigitalAssetSuggestion(project, plan.id, { suggestion_type: "site-map", recommendation: { pages: ["home", "products", "proof", "contact"] }, source_reference: `RESEARCH-${Date.now()}` }), "AI建议已生成，等待人工复核")}>生成AI建议</Button>
      <Button data-digital-assets-suggestion-review disabled={!suggestion} onClick={() => suggestion && void run(() => reviewDigitalAssetSuggestion(project, suggestion.id, reference("AI-QA", suggestion.revision)), "AI建议已人工复核")}>复核AI建议</Button>
      <Button data-digital-assets-asset-register disabled={!plan || Boolean(asset) || Boolean(approvedAsset)} onClick={() => plan && void run(() => registerDigitalAsset(project, plan.id, { asset_kind: "domain", asset_identifier: `forgeflow-${project}.example`, ownership_reference: `DOMAIN-OWNER-${Date.now()}`, rights_scope: "全球工业B2B营销使用" }), "域名资产引用已登记")}>登记域名资产</Button>
      <Button data-digital-assets-asset-approve disabled={!asset} onClick={() => asset && void run(() => approveDigitalAsset(project, asset.id, reference("RIGHTS-QA", asset.revision)), "资产权利已独立批准")}>批准资产权利</Button>
      <Button data-digital-assets-plan-approve disabled={!plan || plan.status !== "draft" || !reviewedSuggestion || !approvedAsset} onClick={() => plan && void run(() => approveDigitalAssetPlan(project, plan.id, reference("PLAN-QA", plan.revision)), "数字资产计划已独立批准")}>批准数字计划</Button></div>
      {plan ? <div data-digital-assets-record data-digital-assets-status={plan.status} className="rounded border p-3"><b>{plan.plan_number}</b><Badge className="ml-2">{plan.status}</Badge><p className="mt-1 text-sm">{plan.business_goal} · {plan.target_market}</p></div> : null}
      {[...workspace.suggestions, ...workspace.assets].map((item) => <div key={item.id} data-digital-assets-record data-digital-assets-status={item.status} className="rounded border p-2 text-sm"><b>{"suggestion_number" in item ? item.suggestion_number : item.asset_number}</b><Badge className="ml-2">{item.status}</Badge></div>)}
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">2. 受控交接与商业可用性证据</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex flex-wrap gap-2"><Button data-digital-assets-handoff-prepare disabled={!plan || plan.status !== "approved" || Boolean(handoff)} onClick={() => plan && void run(() => prepareDigitalAssetHandoff(project, plan.id, { release_version: "2026.08.1", support_owner: "digital-ops", support_until: new Date(Date.now() + 180 * 86400000).toISOString(), customer_trial_reference: "DIGITAL-TRIAL", role_training_reference: "DIGITAL-TRAIN", issue_closure_reference: "DIGITAL-ISSUES", monitoring_reference: "DIGITAL-MON", rollback_reference: "DIGITAL-ROLLBACK" }), "受控交接证据已准备")}>准备受控交接</Button><Button data-digital-assets-handoff-approve disabled={!handoff || handoff.status !== "pending-approval"} onClick={() => handoff && void run(() => approveDigitalAssetHandoff(project, handoff.id, reference("DIGITAL-GA", handoff.revision)), "数字资产工作流已批准为正式可用")}>独立批准交接</Button></div>{handoff ? <div data-digital-assets-record data-digital-assets-status={handoff.status} className="rounded border p-3 text-sm"><b>{handoff.handoff_number} · {handoff.release_version}</b><Badge className="ml-2">{handoff.available ? "正式可用" : handoff.status}</Badge><p className="mt-1 break-all text-xs opacity-70">{handoff.manifest_hash}</p></div> : null}</CardContent></Card>
  </main></FactoryPage>;
}
