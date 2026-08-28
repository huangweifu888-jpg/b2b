import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { socialContentReviewApi, type SocialContentReviewRecord } from "@/lib/social-content-review-api";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { CheckCircle2, RefreshCw, RotateCcw } from "lucide-react";

export default function AgencySocialContentReviews() {
  const [items, setItems] = useState<SocialContentReviewRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("读取当前代理层级可见的初审任务。");
  const load = async () => { setLoading(true); try { const response = await socialContentReviewApi.list(); setItems(response.items); setNotice(response.items.length ? `已读取 ${response.items.length} 条可见内容。` : "暂无待审核内容。"); } catch { setNotice("无法读取审核队列：请确认代理账号权限、后端服务和数据库迁移。"); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const act = async (item: SocialContentReviewRecord, action: "agency_approve" | "return") => { setLoading(true); try { const updated = await socialContentReviewApi.action(item.id, action); setItems((current) => current.map((record) => record.id === updated.id ? updated : record)); setNotice(action === "agency_approve" ? "代理初审已通过，内容已转入总部复核。" : "内容已退回客户修改，未触发外部发布。"); } catch { setNotice("操作未完成：请确认当前任务状态及代理审核权限。"); } finally { setLoading(false); } };

  return <FactoryPage pageId="agency-social-content-reviews" template="detail" sourceScope="agency_source" className="space-y-4 p-6">
    <div data-page-factory-region="content" data-development-standard-frame-region="content" data-development-standard-frame-label="内容" className="space-y-4" data-social-content-review-agency>
    <div data-page-factory-region="title-2" data-development-standard-frame-region="title-2" data-development-standard-frame-label="标题二" className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">社交内容初审</h1><p className="mt-1 text-sm text-slate-600">只显示当前代理层级下的客户计划。初审通过后转总部复核，不会向任何社交平台直接发布。</p></div><Button variant="outline" disabled={loading} onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />刷新队列</Button></div>
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{notice}</div>
    <div data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" className="grid gap-4 xl:grid-cols-2">{items.length ? items.map((item) => <Card key={item.id} data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片"><CardHeader className="gap-2"><div className="flex items-start justify-between gap-2"><CardTitle className="text-base">{item.title}</CardTitle><Badge variant="outline">{item.status === "pending_agency_review" ? "待初审" : item.status === "pending_headquarters_review" ? "已转总部" : item.status === "returned" ? "已退回" : "已批准"}</Badge></div><p className="text-xs text-slate-500">计划 #{item.project_id} · {item.channels.join("、")}</p></CardHeader><CardContent className="space-y-3"><p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">{item.content_text}</p>{item.status === "pending_agency_review" ? <div className="flex justify-end gap-2"><Button variant="outline" disabled={loading} onClick={() => void act(item, "return")}><RotateCcw className="mr-1 h-4 w-4" />退回修改</Button><Button disabled={loading} onClick={() => void act(item, "agency_approve")}><CheckCircle2 className="mr-1 h-4 w-4" />初审通过</Button></div> : null}</CardContent></Card>) : <Card data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" className="xl:col-span-2"><CardContent className="p-8 text-center text-sm text-slate-500">暂无客户提交的社交内容。</CardContent></Card>}</div>
    </div>
  </FactoryPage>;
}
