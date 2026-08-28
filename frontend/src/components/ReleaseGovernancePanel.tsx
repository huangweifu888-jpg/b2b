import { Badge } from "@/components/ui/badge";
import { formatDisplayOrdinal } from "@/lib/display-number-contract";

export type ReleaseLifecycle = "draft" | "pending_review" | "published" | "rolled_back";

const lifecycleCopy: Record<ReleaseLifecycle, { label: string; tone: string }> = {
  draft: { label: "草稿", tone: "border-slate-300 bg-slate-100 text-slate-700" },
  pending_review: { label: "待审核", tone: "border-amber-300 bg-amber-50 text-amber-800" },
  published: { label: "已发布", tone: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  rolled_back: { label: "已回退", tone: "border-violet-300 bg-violet-50 text-violet-800" },
};

export function ReleaseLifecycleBadge({ status }: { status: ReleaseLifecycle }) {
  const item = lifecycleCopy[status];
  return <Badge variant="outline" className={item.tone}>当前状态：{item.label}</Badge>;
}

export default function ReleaseGovernancePanel({
  source,
  status,
  selectedTargets = 0,
  totalTargets = 0,
}: {
  source: "agency" | "client";
  status: ReleaseLifecycle;
  selectedTargets?: number;
  totalTargets?: number;
}) {
  const isAgency = source === "agency";
  const downstreamLabel = isAgency ? "代理端" : "独立计划";
  const sourceLabel = isAgency ? "代理源" : "客户源";
  const boundary = isAgency
    ? "总部端维护代理源；代理端只能同步已发布版本，不可直接修改通用模板。"
    : "总部端维护客户源；客户端和独立计划只可手动合并已发布版本。";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label={`${sourceLabel}发布治理规则`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">发布治理与同步边界</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{boundary}</p>
        </div>
        <ReleaseLifecycleBadge status={status} />
      </div>
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
        {(["草稿", "待审核", "已发布", "已回退"] as const).map((step, index) => (
          <div key={step} className={`rounded-lg border px-3 py-2 ${lifecycleCopy[status].label === step ? lifecycleCopy[status].tone : "border-slate-200 bg-slate-50 text-slate-500"}`}>
            <b>{formatDisplayOrdinal(index + 1)}. {step}</b>
            <p className="mt-1 leading-4">{index === 0 ? "仅源端可编辑" : index === 1 ? "审核完成前不可下发" : index === 2 ? "下级可预览并手动同步" : "按版本恢复并保留备份"}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
        <div className="rounded-lg bg-sky-50 p-3 text-sky-950"><b>影响范围</b><p className="mt-1 leading-5">已选择 {selectedTargets} / {totalTargets} 个{downstreamLabel}。须先预览差异，再允许下发。</p></div>
        <div className="rounded-lg bg-emerald-50 p-3 text-emerald-950"><b>源强制更新</b><p className="mt-1 leading-5">已发布的应用功能、栏目结构、受管版面与服务规则。</p></div>
        <div className="rounded-lg bg-violet-50 p-3 text-violet-950"><b>下级永久保留</b><p className="mt-1 leading-5">公司简称、商标、客户、询盘、订单、成员、财务、计划与邀请码。</p></div>
      </div>
    </section>
  );
}
