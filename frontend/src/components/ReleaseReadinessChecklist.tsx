import { CheckCircle2, CircleAlert, ListChecks, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";

type ReleaseReadinessChecklistProps = {
  source: "agency" | "client";
  configReady: boolean;
  latestVersion: string;
  pendingReview: boolean;
  selectedTargets: number;
  previewedTargets: number;
};

/**
 * Source release pages share one pre-flight contract.  The checklist does not
 * publish or modify a downstream instance: it tells an operator exactly what
 * is ready before the existing publish / rollout controls are enabled.
 */
export default function ReleaseReadinessChecklist({
  source,
  configReady,
  latestVersion,
  pendingReview,
  selectedTargets,
  previewedTargets,
}: ReleaseReadinessChecklistProps) {
  const sourceLabel = source === "agency" ? "代理源" : "客户源";
  const checks = [
    { label: "源端配置", detail: configReady ? `已读取${sourceLabel}当前配置` : `请先保存${sourceLabel}配置`, passed: configReady },
    { label: "版本基线", detail: latestVersion && latestVersion !== "未发布" ? `当前已发布 ${latestVersion}` : "尚未有已发布版本", passed: Boolean(latestVersion && latestVersion !== "未发布") },
    { label: "审核状态", detail: pendingReview ? "存在待审核版本，审核完成后才可下发" : "没有待审核阻塞", passed: !pendingReview },
    { label: "影响预览", detail: selectedTargets ? `已预览 ${previewedTargets} / ${selectedTargets} 个下游目标` : "尚未选择下游目标", passed: selectedTargets > 0 && previewedTargets >= selectedTargets },
    { label: "同步保护", detail: "同步仅更新受管程序与结构；经营和内容数据保留", passed: true },
  ];
  const passedCount = checks.filter((item) => item.passed).length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label={`${sourceLabel}发布前检查`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-900"><ListChecks className="h-5 w-5 text-sky-600" /><h2 className="font-semibold">发布前检查</h2></div>
        <Badge variant={passedCount === checks.length ? "default" : "secondary"}>{passedCount} / {checks.length} 项就绪</Badge>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {checks.map((item) => <div key={item.label} className={`rounded-xl border p-3 text-xs ${item.passed ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
          <div className="flex items-center gap-1.5 font-semibold">{item.passed ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <CircleAlert className="h-3.5 w-3.5 text-amber-600" />}{item.label}</div>
          <p className="mt-1 leading-5 opacity-80">{item.detail}</p>
        </div>)}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><ShieldCheck className="h-3.5 w-3.5 text-violet-600" />此检查只读；通过后仍须按发布、审核、预览、安装的既有流程执行。</p>
    </section>
  );
}
