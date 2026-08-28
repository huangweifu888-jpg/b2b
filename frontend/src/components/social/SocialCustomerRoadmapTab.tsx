import { useEffect, useState } from "react";
import { ArrowRight, Building2, CheckCircle2, Factory, RotateCcw, Users, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  SOCIAL_CUSTOMER_EDUCATION,
  SOCIAL_DEVELOPMENT_STAGES,
  SOCIAL_INTEGRATION_READINESS,
  SOCIAL_LAUNCH_READINESS_CHECKLIST,
  SOCIAL_MARKET_TRACKS,
  SOCIAL_OPERATION_READINESS_CHECKLIST,
  SOCIAL_OWNER_DESCRIPTIONS,
  SOCIAL_OWNER_LABELS,
  SOCIAL_PAIN_POINTS,
  SOCIAL_PREDEVELOPMENT_CHECKLIST,
  SOCIAL_SERVICE_PACKAGES,
  socialLaunchReadinessStorageKey,
  socialOperationReadinessStorageKey,
  socialPredevelopmentStorageKey,
  socialReadinessStorageKey,
  socialRoadmapPendingStorageKey,
  socialRoadmapStorageKey,
  socialServiceEnrollmentStorageKey,
  socialServicePackageStorageKey,
} from "@/lib/social-development-roadmap";

/* -------------------- Customer roadmap -------------------- */
export function SocialCustomerRoadmapTab({ siteId, onSelectTab }: { siteId?: string | null; onSelectTab: (tab: string) => void }) {
  const [completedStageIds, setCompletedStageIds] = useState<string[]>([]);
  const [pendingStageIds, setPendingStageIds] = useState<string[]>([]);
  const [hoveredRoadmapStageId, setHoveredRoadmapStageId] = useState<string | null>(null);
  const [hoveredExternalOperationGroupId, setHoveredExternalOperationGroupId] = useState<string | null>(null);
  const [completedReadinessIds, setCompletedReadinessIds] = useState<string[]>([]);
  const [completedPredevelopmentIds, setCompletedPredevelopmentIds] = useState<string[]>([]);
  const [completedLaunchReadinessIds, setCompletedLaunchReadinessIds] = useState<string[]>([]);
  const [completedOperationReadinessIds, setCompletedOperationReadinessIds] = useState<string[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState("entry");
  const [serviceScopeConfirmed, setServiceScopeConfirmed] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(socialRoadmapStorageKey(siteId));
      const parsed = raw ? JSON.parse(raw) : [];
      setCompletedStageIds(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
    } catch {
      setCompletedStageIds([]);
    }
  }, [siteId]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(socialServiceEnrollmentStorageKey(siteId));
      const parsed = raw ? JSON.parse(raw) : null;
      setServiceScopeConfirmed(Boolean(parsed && typeof parsed === "object" && parsed.scopeConfirmed === true));
    } catch {
      setServiceScopeConfirmed(false);
    }
  }, [siteId]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(socialRoadmapPendingStorageKey(siteId));
      const parsed = raw ? JSON.parse(raw) : [];
      setPendingStageIds(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
    } catch {
      setPendingStageIds([]);
    }
  }, [siteId]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(socialOperationReadinessStorageKey(siteId));
      const parsed = raw ? JSON.parse(raw) : [];
      setCompletedOperationReadinessIds(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
    } catch {
      setCompletedOperationReadinessIds([]);
    }
  }, [siteId]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(socialLaunchReadinessStorageKey(siteId));
      const parsed = raw ? JSON.parse(raw) : [];
      setCompletedLaunchReadinessIds(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
    } catch {
      setCompletedLaunchReadinessIds([]);
    }
  }, [siteId]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(socialPredevelopmentStorageKey(siteId));
      const parsed = raw ? JSON.parse(raw) : [];
      setCompletedPredevelopmentIds(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
    } catch {
      setCompletedPredevelopmentIds([]);
    }
  }, [siteId]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(socialServicePackageStorageKey(siteId));
      if (SOCIAL_SERVICE_PACKAGES.some((item) => item.id === stored)) {
        setSelectedPackageId(stored!);
      } else {
        setSelectedPackageId("entry");
      }
    } catch {
      setSelectedPackageId("entry");
    }
  }, [siteId]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(socialReadinessStorageKey(siteId));
      const parsed = raw ? JSON.parse(raw) : [];
      setCompletedReadinessIds(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
    } catch {
      setCompletedReadinessIds([]);
    }
  }, [siteId]);

  const saveProgress = (next: string[]) => {
    setCompletedStageIds(next);
    try {
      window.localStorage.setItem(socialRoadmapStorageKey(siteId), JSON.stringify(next));
    } catch {
      // Roadmap progress is a convenience state. A disabled browser cache must not block the page.
    }
  };

  const savePendingStages = (next: string[]) => {
    setPendingStageIds(next);
    try {
      window.localStorage.setItem(socialRoadmapPendingStorageKey(siteId), JSON.stringify(next));
    } catch {
      // A manual pending override stays in the current session if browser storage is unavailable.
    }
  };

  const saveReadinessProgress = (next: string[]) => {
    setCompletedReadinessIds(next);
    try {
      window.localStorage.setItem(socialReadinessStorageKey(siteId), JSON.stringify(next));
    } catch {
      // Preparation progress must remain optional when browser storage is unavailable.
    }
  };

  const selectServicePackage = (packageId: string) => {
    setSelectedPackageId(packageId);
    try {
      window.localStorage.setItem(socialServicePackageStorageKey(siteId), packageId);
    } catch {
      // The package choice is a plan-local draft until an order integration is enabled.
    }
  };

  const setServiceScopeConfirmation = (scopeConfirmed: boolean) => {
    setServiceScopeConfirmed(scopeConfirmed);
    try {
      window.localStorage.setItem(socialServiceEnrollmentStorageKey(siteId), JSON.stringify({ packageId: selectedPackageId, scopeConfirmed, updatedAt: new Date().toISOString() }));
    } catch {
      // The acknowledgement remains visible during the current session only.
    }
  };

  const savePredevelopmentProgress = (next: string[]) => {
    setCompletedPredevelopmentIds(next);
    try {
      window.localStorage.setItem(socialPredevelopmentStorageKey(siteId), JSON.stringify(next));
    } catch {
      // Pre-development gates stay a local planning aid until workflow storage is enabled.
    }
  };

  const saveLaunchReadinessProgress = (next: string[]) => {
    setCompletedLaunchReadinessIds(next);
    try {
      window.localStorage.setItem(socialLaunchReadinessStorageKey(siteId), JSON.stringify(next));
    } catch {
      // Launch readiness is a plan-local checklist until workflow storage is enabled.
    }
  };

  const saveOperationReadinessProgress = (next: string[]) => {
    setCompletedOperationReadinessIds(next);
    try {
      window.localStorage.setItem(socialOperationReadinessStorageKey(siteId), JSON.stringify(next));
    } catch {
      // Operational readiness remains plan-local until the workflow service is implemented.
    }
  };

  const stageStatus = (stage: (typeof SOCIAL_DEVELOPMENT_STAGES)[number]) => {
    if (completedStageIds.includes(stage.id)) return "manual_checked" as const;
    if (stage.developmentVerification && !pendingStageIds.includes(stage.id)) return "development_verified" as const;
    return "pending" as const;
  };
  const completedCount = SOCIAL_DEVELOPMENT_STAGES.filter((stage) => stageStatus(stage) !== "pending").length;
  const nextStage = SOCIAL_DEVELOPMENT_STAGES.find((stage) => stageStatus(stage) === "pending");
  const roadmapProgressPercent = Math.round((completedCount / SOCIAL_DEVELOPMENT_STAGES.length) * 100);
  const roadmapFullyComplete = completedCount === SOCIAL_DEVELOPMENT_STAGES.length;
  const getRoadmapStageInfo = (stage: (typeof SOCIAL_DEVELOPMENT_STAGES)[number]) => {
    const status = stageStatus(stage);
    const complete = status !== "pending";
    const current = nextStage?.id === stage.id;
    const progressPercent = complete ? 100 : 0;
    const statusLabel = status === "manual_checked" ? "人工核对已勾选" : status === "development_verified" ? "开发验证通过" : current ? "当前待核对" : "待核对";
    const currentSituation = status === "manual_checked"
      ? "本步骤仅由浏览器本地人工核对并勾选；仍须以总部连接器、平台回执和业务验收为准。"
      : status === "development_verified"
        ? "本地开发与专项验证已通过；真实平台账号、授权或服务端连接仍需按下一步完成。"
        : "尚未完成人工核对；请按下一步完成配置、审核或外部连接，并提交总部复核。";
    return { status, complete, current, progressPercent, statusLabel, currentSituation };
  };
  const hoveredRoadmapStage = SOCIAL_DEVELOPMENT_STAGES.find((stage) => stage.id === hoveredRoadmapStageId);
  const hoveredRoadmapStageInfo = hoveredRoadmapStage ? getRoadmapStageInfo(hoveredRoadmapStage) : null;
  const confirmManualCheck = (stageId: string) => {
    savePendingStages(pendingStageIds.filter((id) => id !== stageId));
    if (!completedStageIds.includes(stageId)) saveProgress([...completedStageIds, stageId]);
  };
  const markStagePending = (stageId: string) => {
    saveProgress(completedStageIds.filter((id) => id !== stageId));
    if (!pendingStageIds.includes(stageId)) savePendingStages([...pendingStageIds, stageId]);
  };
  const focusRoadmapStage = (stageId: string) => {
    const target = document.querySelector<HTMLElement>(`[data-social-roadmap-stage="${stageId}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus({ preventScroll: true });
  };
  const completedReadinessCount = SOCIAL_INTEGRATION_READINESS.filter((item) => completedReadinessIds.includes(item.id)).length;
  const completedPredevelopmentCount = SOCIAL_PREDEVELOPMENT_CHECKLIST.filter((item) => completedPredevelopmentIds.includes(item.id)).length;
  const nextPredevelopment = SOCIAL_PREDEVELOPMENT_CHECKLIST.find((item) => !completedPredevelopmentIds.includes(item.id));
  const completedLaunchReadinessCount = SOCIAL_LAUNCH_READINESS_CHECKLIST.filter((item) => completedLaunchReadinessIds.includes(item.id)).length;
  const nextLaunchReadiness = SOCIAL_LAUNCH_READINESS_CHECKLIST.find((item) => !completedLaunchReadinessIds.includes(item.id));
  const completedOperationReadinessCount = SOCIAL_OPERATION_READINESS_CHECKLIST.filter((item) => completedOperationReadinessIds.includes(item.id)).length;
  const nextOperationReadiness = SOCIAL_OPERATION_READINESS_CHECKLIST.find((item) => !completedOperationReadinessIds.includes(item.id));
  const selectedPackage = SOCIAL_SERVICE_PACKAGES.find((item) => item.id === selectedPackageId) || SOCIAL_SERVICE_PACKAGES[0];
  const externalOperationGroups = [
    { id: "integration", order: "01", label: "渠道接入", completed: completedReadinessCount, total: SOCIAL_INTEGRATION_READINESS.length, next: SOCIAL_INTEGRATION_READINESS.find((item) => !completedReadinessIds.includes(item.id))?.title, target: "[data-social-readiness-checklist]", tone: "amber" },
    { id: "engineering", order: "02", label: "工程门槛", completed: completedPredevelopmentCount, total: SOCIAL_PREDEVELOPMENT_CHECKLIST.length, next: nextPredevelopment?.title, target: "[data-social-predevelopment-checklist]", tone: "indigo" },
    { id: "launch", order: "03", label: "上线交付", completed: completedLaunchReadinessCount, total: SOCIAL_LAUNCH_READINESS_CHECKLIST.length, next: nextLaunchReadiness?.title, target: "[data-social-launch-readiness-checklist]", tone: "teal" },
    { id: "operation", order: "04", label: "持续运营", completed: completedOperationReadinessCount, total: SOCIAL_OPERATION_READINESS_CHECKLIST.length, next: nextOperationReadiness?.title, target: "[data-social-operation-readiness-checklist]", tone: "fuchsia" },
  ] as const;
  const externalOperationCompleted = externalOperationGroups.reduce((total, group) => total + group.completed, 0);
  const externalOperationTotal = externalOperationGroups.reduce((total, group) => total + group.total, 0);
  const externalOperationPercent = Math.round((externalOperationCompleted / externalOperationTotal) * 100);
  const nextExternalOperationGroup = externalOperationGroups.find((group) => group.completed < group.total);
  const hoveredExternalOperationGroup = externalOperationGroups.find((group) => group.id === hoveredExternalOperationGroupId);
  const hoveredExternalOperationPercent = hoveredExternalOperationGroup ? Math.round((hoveredExternalOperationGroup.completed / hoveredExternalOperationGroup.total) * 100) : 0;
  const focusExternalOperationGroup = (selector: string) => {
    const target = document.querySelector<HTMLElement>(selector);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="space-y-4" data-social-customer-roadmap data-social-roadmap-truth-scope="local-development-and-manual-review">
      <Card data-social-content-card data-social-roadmap-summary className={roadmapFullyComplete ? "border-emerald-300 bg-gradient-to-r from-emerald-50 via-white to-teal-50" : "bg-gradient-to-r from-blue-50 via-white to-cyan-50"}>
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <Workflow className="h-5 w-5 text-blue-600" />
                客户痛点路线
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                先解决客户的账号、内容、询盘和归因问题，再按总部端、代理源、客户源的职责推进，避免同一能力在三个地方重复开发。
              </p>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-amber-700">
                本路线只展示代码内开发验证和浏览器本地人工核对，不读取外部连接器或平台回执；所有百分比均不代表外部发布闭环。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={roadmapFullyComplete ? "border-emerald-300 bg-emerald-600 px-3 py-1 text-white" : "bg-white px-3 py-1 text-blue-700"}>
                本地覆盖 {completedCount} / {SOCIAL_DEVELOPMENT_STAGES.length} 步
              </Badge>
              {nextStage ? (
                <Button className="bg-blue-600 text-white" onClick={() => confirmManualCheck(nextStage.id)}>
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  勾选第 {nextStage.order} 步人工核对
                </Button>
              ) : (
                <Button variant="outline" onClick={() => saveProgress([])}>
                  <RotateCcw className="mr-1 h-4 w-4" />
                  重置本地核对
                </Button>
              )}
            </div>
          </div>
          <div className="mt-3" data-social-roadmap-progress role="progressbar" aria-label="客户痛点本地验证与人工核对覆盖" aria-valuemin={0} aria-valuemax={SOCIAL_DEVELOPMENT_STAGES.length} aria-valuenow={completedCount} aria-valuetext={`本地覆盖 ${completedCount} / ${SOCIAL_DEVELOPMENT_STAGES.length} 步，${roadmapProgressPercent}%`}>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className={roadmapFullyComplete ? "font-medium text-emerald-700" : "text-slate-500"}>{roadmapFullyComplete ? "本地验证／核对已覆盖；外部发布状态以总部服务端真值为准" : "节块自动读取本地流程；新增步骤会自动增加"}</span>
              <span className={roadmapFullyComplete ? "font-semibold text-emerald-700" : "font-semibold text-blue-700"}>本地覆盖 {roadmapProgressPercent}%</span>
            </div>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12" aria-label="客户痛点路线步骤节块">
              {SOCIAL_DEVELOPMENT_STAGES.map((stage) => {
                const { status, complete, current, progressPercent, statusLabel } = getRoadmapStageInfo(stage);
                return (
                  <button
                    type="button"
                    key={stage.id}
                    data-social-roadmap-progress-segment={stage.id}
                    aria-label={`定位第 ${stage.order} 步：${stage.title}`}
                    onClick={() => focusRoadmapStage(stage.id)}
                    onMouseEnter={() => setHoveredRoadmapStageId(stage.id)}
                    onMouseLeave={() => setHoveredRoadmapStageId(null)}
                    onFocus={() => setHoveredRoadmapStageId(stage.id)}
                    onBlur={() => setHoveredRoadmapStageId(null)}
                    className={`group relative flex h-10 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      status === "manual_checked"
                        ? "border-emerald-500 bg-emerald-600 text-white shadow-sm"
                        : status === "development_verified"
                          ? "border-cyan-500 bg-gradient-to-r from-blue-600 to-cyan-500 text-white"
                        : current
                          ? "border-blue-400 bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                          : "border-slate-200 bg-slate-100 text-slate-400"
                    }`}
                  >
                    <span className="flex h-3 items-center text-[10px] leading-none" aria-label={`第 ${stage.order} 步${complete ? "本地已覆盖" : "待核对"}`}>{String(stage.order).padStart(2, "0")}</span>
                    <span className="text-[9px] leading-none">{status === "manual_checked" ? "人工" : status === "development_verified" ? "开发" : "待核对"}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 min-h-0" aria-live="polite">
              {hoveredRoadmapStage && hoveredRoadmapStageInfo ? (
                <div data-social-roadmap-segment-tooltip className="rounded-lg border border-slate-200 bg-slate-950 p-3 text-xs leading-5 text-slate-100 shadow-sm">
                  <div className="font-semibold text-white">第 {hoveredRoadmapStage.order} 步 · {hoveredRoadmapStage.title}</div>
                  <div className="mt-1 text-cyan-200">状态：{hoveredRoadmapStageInfo.statusLabel} · 本地覆盖：{hoveredRoadmapStageInfo.progressPercent}%</div>
                  <div className="mt-1 text-slate-200">当前情况：{hoveredRoadmapStageInfo.currentSituation}</div>
                  {hoveredRoadmapStage.developmentVerification ? <div className="mt-1 text-emerald-200">验证记录：{hoveredRoadmapStage.developmentVerification.verifiedAt} · {hoveredRoadmapStage.developmentVerification.note}</div> : null}
                  <div className="mt-1 text-amber-200">下一步：{hoveredRoadmapStage.nextAction}</div>
                  <div className="mt-1 text-slate-400">点击节块可定位到该流程。</div>
                </div>
              ) : null}
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {nextStage ? `当前待核对：第 ${nextStage.order} 步「${nextStage.title}」` : "本地路线检查已覆盖；持续复盘仍以真实平台数据与总部验收为准。"}
          </p>
        </CardContent>
      </Card>

      <Card data-social-content-card data-social-external-operation-progress className="border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50">
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><CardTitle className="text-base">外部上线人工准备清单</CardTitle><p className="mt-1 text-sm leading-6 text-slate-600">这里只记录浏览器本地人工勾选，不读取总部连接器就绪证据或平台回执；百分比只表示人工确认，不代表外部系统就绪或已经上线。</p></div>
            <Badge variant="outline" className={externalOperationCompleted === externalOperationTotal ? "border-emerald-300 bg-emerald-600 px-3 py-1 text-white" : "border-amber-300 bg-white px-3 py-1 text-amber-800"}>人工确认 {externalOperationCompleted} / {externalOperationTotal} · {externalOperationPercent}%</Badge>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-amber-100" role="progressbar" aria-label="外部上线人工准备进度" aria-valuemin={0} aria-valuemax={externalOperationTotal} aria-valuenow={externalOperationCompleted} aria-valuetext={`人工确认 ${externalOperationCompleted} / ${externalOperationTotal} 项，${externalOperationPercent}%`}><div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all" style={{ width: `${externalOperationPercent}%` }} /></div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" aria-label="外部上线人工准备关卡节块">
          {externalOperationGroups.map((group) => {
            const percent = Math.round((group.completed / group.total) * 100);
            const complete = group.completed === group.total;
            const current = nextExternalOperationGroup?.id === group.id;
            return <button type="button" key={group.id} data-social-external-operation-group={group.id} aria-label={`定位第 ${group.order} 关：${group.label}`} onClick={() => focusExternalOperationGroup(group.target)} onMouseEnter={() => setHoveredExternalOperationGroupId(group.id)} onMouseLeave={() => setHoveredExternalOperationGroupId(null)} onFocus={() => setHoveredExternalOperationGroupId(group.id)} onBlur={() => setHoveredExternalOperationGroupId(null)} className={`group relative flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${complete ? "border-emerald-500 bg-emerald-600 text-white shadow-sm" : current ? "border-amber-500 bg-gradient-to-r from-amber-500 to-orange-500 text-white" : "border-slate-200 bg-slate-100 text-slate-500 hover:border-amber-300"}`}><span className="text-[11px] leading-none">{complete ? <CheckCircle2 className="h-4 w-4" aria-label={`第 ${group.order} 关已完成`} /> : group.order}</span><span className="text-[10px] leading-none">{percent}%</span></button>;
          })}
          </div>
          <div className="mt-3 min-h-0" aria-live="polite">
            {hoveredExternalOperationGroup ? <div data-social-external-operation-tooltip className="rounded-lg border border-slate-200 bg-slate-950 p-3 text-xs leading-5 text-slate-100 shadow-sm"><div className="font-semibold text-white">第 {hoveredExternalOperationGroup.order} 关 · {hoveredExternalOperationGroup.label}</div><div className="mt-1 text-amber-200">状态：{hoveredExternalOperationGroup.completed === hoveredExternalOperationGroup.total ? "人工已确认" : "待人工确认"} · 人工确认度：{hoveredExternalOperationGroup.completed} / {hoveredExternalOperationGroup.total} · {hoveredExternalOperationPercent}%</div><div className="mt-1 text-slate-200">作用：{hoveredExternalOperationGroup.label === "渠道接入" ? "人工核对平台官方能力、客户授权范围与线索归属。" : hoveredExternalOperationGroup.label === "工程门槛" ? "人工核对订单、密钥、回调、权限与平台能力等工程条件。" : hoveredExternalOperationGroup.label === "上线交付" ? "人工核对客户开通、服务交付与上线验收材料。" : "人工核对持续服务、复盘、续费与多客户运营准备。"}</div><div className="mt-1 text-amber-200">下一项：{hoveredExternalOperationGroup.next ?? "该关卡的人工准备项已勾选。"}</div><div className="mt-1 text-slate-400">点击节块可定位到对应人工检查清单。</div></div> : null}
          </div>
          {nextExternalOperationGroup ? <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white p-3"><div><div className="text-sm font-medium text-slate-900">当前人工准备下一步</div><div className="text-xs text-slate-600">先核对第 {nextExternalOperationGroup.order} 关「{nextExternalOperationGroup.label}」：{nextExternalOperationGroup.next ?? "全部项目"}</div></div><Button size="sm" variant="outline" onClick={() => focusExternalOperationGroup(nextExternalOperationGroup.target)}>定位检查项 <ArrowRight className="ml-1 h-4 w-4" /></Button></div> : <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">人工准备项已全部勾选，可以提交总部验收；这不代表外部连接器就绪或平台已经上线。</div>}
        </CardContent>
      </Card>

      <Card data-social-content-card data-social-service-packages className="bg-gradient-to-r from-sky-50 via-white to-blue-50">
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Facebook 品牌出海服务套餐</CardTitle>
            <Badge variant="outline" className="bg-white text-sky-800">当前计划：{selectedPackage.title}</Badge>
          </div>
          <p className="text-sm leading-6 text-slate-600">
            套餐决定内容频次、投放额度和复盘节奏；账号授权、客户审核与平台合规边界对所有套餐一致。当前选择仅保存于此独立计划，正式服务范围以签约订单为准。
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {SOCIAL_SERVICE_PACKAGES.map((servicePackage) => {
              const selected = selectedPackage.id === servicePackage.id;
              return (
                <button
                  type="button"
                  key={servicePackage.id}
                  data-social-service-package={servicePackage.id}
                  aria-pressed={selected}
                  onClick={() => selectServicePackage(servicePackage.id)}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    selected ? "border-sky-500 bg-sky-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-900 hover:border-sky-300 hover:bg-sky-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{servicePackage.title}</span>
                    {selected ? <CheckCircle2 className="h-4 w-4" /> : null}
                  </div>
                  <div className={`mt-2 text-lg font-bold ${selected ? "text-white" : "text-sky-700"}`}>{servicePackage.priceLabel}</div>
                  <div className={`mt-1 text-xs ${selected ? "text-sky-100" : "text-slate-500"}`}>{servicePackage.annualPosts} · {servicePackage.reporting}</div>
                  <div className={`mt-2 rounded-md px-2 py-1 text-xs font-medium ${selected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"}`}>{servicePackage.adBudget}</div>
                  <p className={`mt-3 text-xs leading-5 ${selected ? "text-sky-50" : "text-slate-600"}`}>{servicePackage.positioning}</p>
                </button>
              );
            })}
          </div>
     <div className="mt-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-semibold text-slate-900">{selectedPackage.title}交付范围</div>
              <Badge variant="outline" className="bg-sky-50 text-sky-800">{selectedPackage.annualPosts}</Badge>
              <Badge variant="outline" className="bg-sky-50 text-sky-800">{selectedPackage.adBudget}</Badge>
              <Badge variant="outline" className="bg-sky-50 text-sky-800">{selectedPackage.reporting}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedPackage.includedServices.map((service) => <span key={service} className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs text-sky-900">{service}</span>)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-social-content-card data-social-service-enrollment className="border-amber-200 bg-amber-50/50">
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-base">服务准入与交付边界</CardTitle><Badge variant="outline" className={serviceScopeConfirmed ? "border-sky-200 bg-sky-50 text-sky-800" : "border-amber-200 bg-amber-50 text-amber-800"}>{serviceScopeConfirmed ? "范围已确认 · 待签约" : "待确认范围"}</Badge></div>
          <p className="text-sm leading-6 text-slate-600">套餐选择只是当前计划草稿。只有签约订单、客户授权和总部审核均完成后，才可实际开通账号接入、发布或广告服务。</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-emerald-200 bg-white p-3"><div className="text-xs text-slate-500">1 · 服务套餐</div><div className="mt-1 font-semibold text-slate-900">{selectedPackage.title}</div><div className="mt-1 text-xs text-emerald-700">已选择计划草稿</div></div>
          <div className="rounded-lg border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">2 · 交付范围</div><div className="mt-1 font-semibold text-slate-900">内容、投放与复盘</div><div className="mt-1 text-xs text-slate-500">{serviceScopeConfirmed ? "客户已确认范围" : "等待客户确认"}</div></div>
          <div className="rounded-lg border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">3 · 签约订单</div><div className="mt-1 font-semibold text-slate-900">总部订单审核</div><div className="mt-1 text-xs text-amber-700">未接入订单服务</div></div>
          <div className="rounded-lg border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">4 · 账号授权</div><div className="mt-1 font-semibold text-slate-900">OAuth 官方授权</div><div className="mt-1 text-xs text-amber-700">未完成不开放发布</div></div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-sky-200 bg-white p-3 md:col-span-2 xl:col-span-4"><div><div className="text-sm font-medium text-slate-900">确认套餐交付边界</div><div className="text-xs text-slate-500">确认后仅记录当前计划的服务范围，不会代替签约、扣费、账号授权或功能开通。</div></div><Switch checked={serviceScopeConfirmed} onCheckedChange={setServiceScopeConfirmation} aria-label="确认套餐交付边界" /></div>
        </CardContent>
      </Card>

      <Card data-social-content-card data-social-predevelopment-checklist className="bg-gradient-to-r from-indigo-50 via-white to-violet-50">
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">前期开发准备 · 8 项门槛</CardTitle>
            <Badge variant="outline" className="bg-white text-indigo-800">已完成 {completedPredevelopmentCount} / {SOCIAL_PREDEVELOPMENT_CHECKLIST.length} 项</Badge>
          </div>
          <p className="text-sm leading-6 text-slate-600">先完成这些门槛，再接入真实 OAuth、发布、广告、客户数据或 CRM。未完成时，系统只能作为规划与人工操作辅助，不能宣称已具备平台自动化能力。</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {nextPredevelopment ? (
              <Button size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => savePredevelopmentProgress([...completedPredevelopmentIds, nextPredevelopment.id])}>
                <CheckCircle2 className="mr-1 h-4 w-4" />完成第 {nextPredevelopment.order} 项
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => savePredevelopmentProgress([])}>
                <RotateCcw className="mr-1 h-4 w-4" />重置准备状态
              </Button>
            )}
            <span className="text-xs text-slate-500">{nextPredevelopment ? `当前门槛：${nextPredevelopment.title}` : "8 项门槛已完成，可按套餐交付顺序进入实施。"}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {SOCIAL_PREDEVELOPMENT_CHECKLIST.map((item) => {
            const complete = completedPredevelopmentIds.includes(item.id);
            return (
              <div key={item.id} data-social-predevelopment-item={item.id} className={`grid gap-3 rounded-lg border p-4 lg:grid-cols-[40px_minmax(0,1fr)_auto] lg:items-start ${complete ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"}`}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${complete ? "bg-emerald-600 text-white" : "bg-indigo-100 text-indigo-800"}`}>
                  {complete ? <CheckCircle2 className="h-4 w-4" /> : item.order}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <Badge variant="outline" className="bg-white text-slate-600">{SOCIAL_OWNER_LABELS[item.owner]}</Badge>
                    {nextPredevelopment?.id === item.id ? <Badge className="bg-indigo-600 text-white">当前门槛</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm leading-5 text-slate-700">目标：{item.purpose}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">实施：{item.implementation}</p>
                  <p className="mt-1 text-xs leading-5 text-emerald-800">验收：{item.acceptance}</p>
                  <p className="mt-1 text-xs leading-5 text-amber-800">依赖：{item.dependency}</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
                  <Button
                    variant={complete ? "outline" : "default"}
                    size="sm"
                    className={complete ? "" : "bg-indigo-600 hover:bg-indigo-700"}
                    onClick={() => savePredevelopmentProgress(complete ? completedPredevelopmentIds.filter((id) => id !== item.id) : [...completedPredevelopmentIds, item.id])}
                  >
                    {complete ? "取消完成" : "标记完成"}
                  </Button>
                  {item.targetTab ? <Button variant="outline" size="sm" onClick={() => onSelectTab(item.targetTab!)}>
                    查看准备位置 <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button> : null}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card data-social-content-card data-social-launch-readiness-checklist className="bg-gradient-to-r from-teal-50 via-white to-emerald-50">
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">上线交付准备 · 6 项门槛</CardTitle>
            <Badge variant="outline" className="bg-white text-teal-800">已完成 {completedLaunchReadinessCount} / {SOCIAL_LAUNCH_READINESS_CHECKLIST.length} 项</Badge>
          </div>
          <p className="text-sm leading-6 text-slate-600">这 6 项用于保护客户开通、日常交付和正式上线。完成工程门槛后仍需完成此处验收，才能把计划从准备状态切换为正式服务。</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {nextLaunchReadiness ? (
              <Button size="sm" className="bg-teal-600 text-white hover:bg-teal-700" onClick={() => saveLaunchReadinessProgress([...completedLaunchReadinessIds, nextLaunchReadiness.id])}>
                <CheckCircle2 className="mr-1 h-4 w-4" />完成第 {nextLaunchReadiness.order} 项
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => saveLaunchReadinessProgress([])}>
                <RotateCcw className="mr-1 h-4 w-4" />重置准备状态
              </Button>
            )}
            <span className="text-xs text-slate-500">{nextLaunchReadiness ? `当前门槛：${nextLaunchReadiness.title}` : "6 项上线交付门槛已完成，可发起正式上线验收。"}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {SOCIAL_LAUNCH_READINESS_CHECKLIST.map((item) => {
            const complete = completedLaunchReadinessIds.includes(item.id);
            return (
              <div key={item.id} data-social-launch-readiness-item={item.id} className={`grid gap-3 rounded-lg border p-4 lg:grid-cols-[40px_minmax(0,1fr)_auto] lg:items-start ${complete ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"}`}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${complete ? "bg-emerald-600 text-white" : "bg-teal-100 text-teal-800"}`}>
                  {complete ? <CheckCircle2 className="h-4 w-4" /> : item.order}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <Badge variant="outline" className="bg-white text-slate-600">{SOCIAL_OWNER_LABELS[item.owner]}</Badge>
                    {nextLaunchReadiness?.id === item.id ? <Badge className="bg-teal-600 text-white">当前门槛</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm leading-5 text-slate-700">目标：{item.purpose}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">实施：{item.implementation}</p>
                  <p className="mt-1 text-xs leading-5 text-emerald-800">验收：{item.acceptance}</p>
                  <p className="mt-1 text-xs leading-5 text-amber-800">依赖：{item.dependency}</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
                  <Button
                    variant={complete ? "outline" : "default"}
                    size="sm"
                    className={complete ? "" : "bg-teal-600 hover:bg-teal-700"}
                    onClick={() => saveLaunchReadinessProgress(complete ? completedLaunchReadinessIds.filter((id) => id !== item.id) : [...completedLaunchReadinessIds, item.id])}
                  >
                    {complete ? "取消完成" : "标记完成"}
                  </Button>
                  {item.targetTab ? <Button variant="outline" size="sm" onClick={() => onSelectTab(item.targetTab!)}>
                    查看准备位置 <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button> : null}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card data-social-content-card data-social-operation-readiness-checklist className="bg-gradient-to-r from-fuchsia-50 via-white to-rose-50">
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">运营强化准备 · 5 项提升</CardTitle>
            <Badge variant="outline" className="bg-white text-fuchsia-800">已完成 {completedOperationReadinessCount} / {SOCIAL_OPERATION_READINESS_CHECKLIST.length} 项</Badge>
          </div>
          <p className="text-sm leading-6 text-slate-600">这些项目不阻塞本地原型，但在持续代运营、代理分佣、续费服务和真实多客户上线前应全部落实。</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {nextOperationReadiness ? (
              <Button size="sm" className="bg-fuchsia-600 text-white hover:bg-fuchsia-700" onClick={() => saveOperationReadinessProgress([...completedOperationReadinessIds, nextOperationReadiness.id])}>
                <CheckCircle2 className="mr-1 h-4 w-4" />完成第 {nextOperationReadiness.order} 项
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => saveOperationReadinessProgress([])}>
                <RotateCcw className="mr-1 h-4 w-4" />重置准备状态
              </Button>
            )}
            <span className="text-xs text-slate-500">{nextOperationReadiness ? `当前提升：${nextOperationReadiness.title}` : "5 项运营强化已完成，可进入持续服务和续费复盘。"}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {SOCIAL_OPERATION_READINESS_CHECKLIST.map((item) => {
            const complete = completedOperationReadinessIds.includes(item.id);
            return (
              <div key={item.id} data-social-operation-readiness-item={item.id} className={`grid gap-3 rounded-lg border p-4 lg:grid-cols-[40px_minmax(0,1fr)_auto] lg:items-start ${complete ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"}`}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${complete ? "bg-emerald-600 text-white" : "bg-fuchsia-100 text-fuchsia-800"}`}>
                  {complete ? <CheckCircle2 className="h-4 w-4" /> : item.order}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <Badge variant="outline" className="bg-white text-slate-600">{SOCIAL_OWNER_LABELS[item.owner]}</Badge>
                    {nextOperationReadiness?.id === item.id ? <Badge className="bg-fuchsia-600 text-white">当前提升</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm leading-5 text-slate-700">目标：{item.purpose}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">实施：{item.implementation}</p>
                  <p className="mt-1 text-xs leading-5 text-emerald-800">验收：{item.acceptance}</p>
                  <p className="mt-1 text-xs leading-5 text-amber-800">依赖：{item.dependency}</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
                  <Button
                    variant={complete ? "outline" : "default"}
                    size="sm"
                    className={complete ? "" : "bg-fuchsia-600 hover:bg-fuchsia-700"}
                    onClick={() => saveOperationReadinessProgress(complete ? completedOperationReadinessIds.filter((id) => id !== item.id) : [...completedOperationReadinessIds, item.id])}
                  >
                    {complete ? "取消完成" : "标记完成"}
                  </Button>
                  {item.targetTab ? <Button variant="outline" size="sm" onClick={() => onSelectTab(item.targetTab!)}>
                    查看准备位置 <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button> : null}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card data-social-content-card data-social-readiness-checklist className="bg-gradient-to-r from-amber-50 via-white to-orange-50">
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">接入准备清单</CardTitle>
            <Badge variant="outline" className="bg-white text-amber-800">已准备 {completedReadinessCount} / {SOCIAL_INTEGRATION_READINESS.length} 项</Badge>
          </div>
          <p className="text-sm leading-6 text-slate-600">这 8 项应在真实账号连接、OAuth 授权和平台发布接口开发前确认；进度按当前独立计划保存。</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {SOCIAL_INTEGRATION_READINESS.map((item) => {
            const complete = completedReadinessIds.includes(item.id);
            return (
              <div key={item.id} data-social-readiness-item={item.id} className={`flex gap-3 rounded-lg border p-3 ${complete ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-white"}`}>
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${complete ? "bg-emerald-600 text-white" : "bg-amber-100 text-amber-800"}`}>
                  {complete ? <CheckCircle2 className="h-4 w-4" /> : item.order}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <Badge variant="outline" className="bg-white text-slate-600">{SOCIAL_OWNER_LABELS[item.owner]}</Badge>
                  </div>
                  <p className="mt-1 text-sm leading-5 text-slate-700">{item.outcome}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">注意：{item.note}</p>
                  <Button
                    variant={complete ? "outline" : "default"}
                    size="sm"
                    className={`mt-2 ${complete ? "" : "bg-amber-600 hover:bg-amber-700"}`}
                    onClick={() => saveReadinessProgress(complete ? completedReadinessIds.filter((id) => id !== item.id) : [...completedReadinessIds, item.id])}
                  >
                    {complete ? "取消完成" : "标记完成"}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card data-social-content-card data-social-customer-education className="bg-gradient-to-r from-violet-50 via-white to-indigo-50">
        <CardHeader className="gap-2">
          <CardTitle className="text-base">客户安全运营说明</CardTitle>
          <p className="text-sm leading-6 text-slate-600">此内容可在客户开通、培训、续费与销售沟通时直接展示：平台帮助客户提升效率，但不替代客户的账号权利、内容审核和商业决策。</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {SOCIAL_CUSTOMER_EDUCATION.map((item) => (
            <div key={item.id} data-social-customer-education-item={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="font-semibold text-slate-900">{item.title}</div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="p-3">
                  <div className="text-sm font-medium text-emerald-800">平台可以协助</div>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm leading-5 text-emerald-950">
                    {item.allowed.map((value) => <li key={value}>{value}</li>)}
                  </ul>
                </div>
        <div className="p-3">
                  <div className="text-sm font-medium text-rose-800">平台明确不做</div>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm leading-5 text-rose-950">
                    {item.prohibited.map((value) => <li key={value}>{value}</li>)}
                  </ul>
                </div>
              </div>
       <div className="mt-3 p-3 text-sm leading-6 text-violet-950">
                <span className="font-semibold">销售沟通建议：</span>{item.salesMessage}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card data-social-content-card data-social-market-tracks>
        <CardHeader>
          <CardTitle className="text-base">国内与海外渠道开发参考</CardTitle>
          <p className="text-sm leading-6 text-slate-500">
            共用账号、素材、审批、排期、询盘和归因能力；只按市场切换语言、平台规则、时区、合规要求与转化入口，避免重复开发两套系统。
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {SOCIAL_MARKET_TRACKS.map((track) => (
            <div key={track.id} data-social-market-track={track.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-slate-900">{track.title}</div>
                <Badge variant="outline" className="bg-white text-slate-600">{track.id === "china" ? "CN" : "GLOBAL"}</Badge>
              </div>
              <p className="mt-2 text-sm leading-5 text-slate-600">{track.scope}</p>
              <div className="mt-3">
                <div className="text-xs font-medium text-slate-500">优先渠道</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {track.platformExamples.map((platform) => <span key={platform} className="rounded bg-white px-2 py-1 text-xs text-slate-600 shadow-sm">{platform}</span>)}
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xs font-medium text-slate-500">首期建设重点</div>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm leading-5 text-slate-700">
                  {track.priorities.map((priority) => <li key={priority}>{priority}</li>)}
                </ul>
              </div>
       <div className="mt-3 p-2.5 text-sm text-blue-900">
                <span className="font-medium">转化线路：</span>{track.conversionPath}
              </div>
              <div className="mt-3 text-xs leading-5 text-slate-500">
                <span className="font-medium text-slate-600">实施边界：</span>{track.safeguards.join("；")}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {SOCIAL_PAIN_POINTS.map((item) => (
          <Card key={item.id} data-social-content-card>
            <CardContent className="p-4">
              <div className="text-sm font-semibold text-slate-900">客户痛点：{item.pain}</div>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-md bg-slate-50 p-3">
                  <div className="text-xs font-medium text-slate-500">解决方式</div>
                  <p className="mt-1 leading-5 text-slate-700">{item.solution}</p>
                </div>
                <div className="rounded-md bg-emerald-50 p-3">
                  <div className="text-xs font-medium text-emerald-700">客户获得的价值</div>
                  <p className="mt-1 leading-5 text-emerald-900">{item.customerValue}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card data-social-content-card>
        <CardHeader>
          <CardTitle className="text-base">三端搭配应用</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <OwnerCard icon={Building2} title="总部端 · 事业市场" owner="headquarters" body="维护渠道能力、合规要求、应用凭据和全局升级规则。" />
          <OwnerCard icon={Factory} title="代理源 · 共业市场" owner="agency-source" body="沉淀行业模板、服务流程与可同步的代理版本。" />
          <OwnerCard icon={Users} title="客户源 · 社交媒体" owner="client-source" body="绑定实际账号、审批内容、发布并处理客户互动和询盘。" />
        </CardContent>
      </Card>

      <Card data-social-content-card>
        <CardHeader>
          <CardTitle className="text-base">{selectedPackage.title} · 套餐交付顺序</CardTitle>
          <p className="text-sm leading-6 text-slate-500">以协议服务流程为主线；第 4 步读取内容频次，第 6 步读取广告额度与复盘节奏，避免套餐选定后仍按同一服务深度执行。</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {SOCIAL_DEVELOPMENT_STAGES.map((stage, index) => {
            const status = stageStatus(stage);
            const complete = status !== "pending";
            const isCurrent = nextStage?.id === stage.id;
            return (
              <div
                key={stage.id}
                data-social-roadmap-stage={stage.id}
                data-social-roadmap-stage-status={status}
                tabIndex={-1}
                className={`relative grid gap-3 rounded-lg border p-4 md:grid-cols-[44px_minmax(0,1fr)_auto] md:items-center ${
                  isCurrent ? "border-blue-300 bg-blue-50/60" : status === "manual_checked" ? "border-emerald-200 bg-emerald-50/50" : status === "development_verified" ? "border-cyan-200 bg-cyan-50/50" : "border-slate-200"
                }`}
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${status === "manual_checked" ? "bg-emerald-600 text-white" : status === "development_verified" ? "bg-cyan-600 text-white" : isCurrent ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {complete ? <CheckCircle2 className="h-4 w-4" /> : stage.order}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-slate-900">{stage.title}</div>
                    <Badge variant="outline" className="bg-white text-slate-600">{SOCIAL_OWNER_LABELS[stage.owner]}</Badge>
                    {status === "development_verified" ? <Badge className="bg-cyan-600 text-white">开发验证通过</Badge> : null}
                    {status === "manual_checked" ? <Badge className="bg-emerald-600 text-white">人工核对已勾选</Badge> : null}
                    {isCurrent && <Badge className="bg-blue-600 text-white">当前步骤</Badge>}
                  </div>
                  <p className="mt-1 text-sm leading-5 text-slate-600">{stage.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {stage.deliverables.map((deliverable) => <span key={deliverable} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">{deliverable}</span>)}
                    {stage.order === 4 ? <span className="rounded bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800">{selectedPackage.annualPosts}</span> : null}
                    {stage.order === 6 ? <>
                      <span className="rounded bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800">{selectedPackage.adBudget}</span>
                      <span className="rounded bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800">{selectedPackage.reporting}</span>
                    </> : null}
                  </div>
                  {stage.developmentVerification ? <p className="mt-2 text-xs leading-5 text-cyan-800">开发验证：{stage.developmentVerification.verifiedAt} · {stage.developmentVerification.note}</p> : null}
                  <p className="mt-2 text-xs text-slate-500">下一动作：{stage.nextAction}</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-self-start md:flex-col md:items-end md:justify-self-end">
                  <Button variant={status === "pending" ? "default" : "outline"} size="sm" className={status === "pending" ? "bg-blue-600 text-white" : ""} onClick={() => status === "pending" ? confirmManualCheck(stage.id) : markStagePending(stage.id)}>
                    {status === "pending" ? "勾选人工核对" : "设为待核对"}
                  </Button>
                  {stage.targetTab ? (
                    <Button variant="outline" size="sm" onClick={() => onSelectTab(stage.targetTab!)}>
                      进入相关功能 <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  ) : <span className="text-xs text-slate-500">在对应源端开发工具配置</span>}
                </div>
                {index < SOCIAL_DEVELOPMENT_STAGES.length - 1 && <div className="hidden md:block absolute -bottom-3 left-[33px] z-10 h-3 border-l border-dashed border-slate-300" />}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function OwnerCard({ icon: Icon, title, owner, body }: { icon: typeof Building2; title: string; owner: keyof typeof SOCIAL_OWNER_LABELS; body: string }) {
  return (
    <div data-social-content-capsule className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center gap-2 font-semibold text-slate-900"><Icon className="h-4 w-4 text-blue-600" />{title}</div>
      <p className="mt-2 text-sm leading-5 text-slate-600">{body}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">边界：{SOCIAL_OWNER_DESCRIPTIONS[owner]}</p>
    </div>
  );
}

export default SocialCustomerRoadmapTab;

