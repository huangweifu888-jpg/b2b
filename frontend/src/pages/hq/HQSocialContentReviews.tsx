import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { socialContentReviewApi, type SocialContentReviewRecord } from "@/lib/social-content-review-api";
import { CheckCircle2, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { FactoryPage } from "@/page-factory/FactoryPage";

const STATUS_LABEL: Record<SocialContentReviewRecord["status"], string> = {
  pending_agency_review: "等待代理初审",
  pending_headquarters_review: "等待总部复核",
  approved_for_authorized_publish: "已批准待授权发布",
  returned: "已退回修改",
};

export default function HQSocialContentReviews() {
  const [items, setItems] = useState<SocialContentReviewRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("读取总部待复核内容。");

  const load = async () => {
    setLoading(true);
    try {
      const response = await socialContentReviewApi.list();
      setItems(response.items);
      setNotice(response.items.length ? `已读取 ${response.items.length} 条租户可见内容。` : "暂无可见内容审核任务。");
    } catch {
      setNotice("无法读取审核队列：请确认总部管理员登录、后端服务和数据库迁移已完成。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const act = async (item: SocialContentReviewRecord, action: "headquarters_approve" | "return") => {
    setLoading(true);
    try {
      const updated = await socialContentReviewApi.action(item.id, action);
      setItems((current) => current.map((record) => record.id === updated.id ? updated : record));
      setNotice(action === "headquarters_approve" ? "总部复核已通过；仍需目标账号 OAuth 授权才能进入外部发布队列。" : "内容已退回客户修改；不会触发任何外部发布。");
    } catch {
      setNotice("审核操作未完成：请确认当前内容状态、总部管理员权限与数据库服务。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FactoryPage pageId="hq-social-content-reviews" template="dashboard" sourceScope="hq" autoRegions>
    <div className="space-y-4 p-6" data-social-content-review-headquarters>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">社交内容审核中心</h1><p className="mt-1 text-sm text-slate-600">客户端提交 → 代理初审 → 总部复核 → 已授权账号发布。当前页面只完成内部审核，不向外部平台发帖。</p></div>
        <Button variant="outline" disabled={loading} onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />刷新队列</Button>
      </div>

      <Card className="border-blue-200 bg-blue-50/60"><CardContent className="flex gap-3 p-4 text-sm leading-6 text-blue-950"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />总部仅处理已通过代理初审的内容。批准后状态为“已批准待授权发布”，并不代表已经发布；OAuth 授权、渠道权限和最终排期仍是必要条件。</CardContent></Card>
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{notice}</div>

      <div className="grid gap-4 xl:grid-cols-2">
        {items.length ? items.map((item) => <Card key={item.id} data-social-content-review-item>
          <CardHeader className="gap-2"><div className="flex items-start justify-between gap-2"><CardTitle className="text-base">{item.title}</CardTitle><Badge variant="outline" className={item.status === "approved_for_authorized_publish" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : item.status === "returned" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}>{STATUS_LABEL[item.status]}</Badge></div><p className="text-xs text-slate-500">计划 #{item.project_id} · 渠道：{item.channels.join("、")}</p></CardHeader>
          <CardContent className="space-y-3"><p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">{item.content_text}</p>{item.review_note ? <p className="text-xs text-slate-500">审核说明：{item.review_note}</p> : null}
            {item.status === "pending_headquarters_review" ? <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={loading} onClick={() => void act(item, "return")}><RotateCcw className="mr-1 h-4 w-4" />退回修改</Button><Button disabled={loading} className="bg-emerald-600 text-white" onClick={() => void act(item, "headquarters_approve")}><CheckCircle2 className="mr-1 h-4 w-4" />总部通过</Button></div> : null}
          </CardContent>
        </Card>) : <Card className="xl:col-span-2"><CardContent className="p-8 text-center text-sm text-slate-500">暂无审核任务。客户端提交后会先进入代理初审，再出现于本队列。</CardContent></Card>}
      </div>
    </div>
    </FactoryPage>
  );
}
