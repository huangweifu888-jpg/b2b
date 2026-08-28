import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, CircleDashed, Factory, Map, RefreshCw, ShieldCheck, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SHARED_LAYOUT_STYLE_LARGE_CARD_PROPS,
  SHARED_LAYOUT_STYLE_SMALL_CARD_PROPS,
} from "@/lib/shared-card-region-contract";
import {
  SOCIAL_DEVELOPMENT_STANDARD_TEMPLATE,
  SOCIAL_MARKETING_CARD_REGION_CONTRACT,
  SOCIAL_MARKETING_MARKET_TRACKS,
  SOCIAL_MARKETING_STAGES,
  readSocialMarketingSnapshot,
  socialMarketingFactoryConfirmationKey,
  socialMarketingManualStatusKey,
  socialMarketingMarketViewKey,
  type SocialMarketingMarket,
  type SocialMarketingStage,
} from "@/lib/social-marketing-playbook";

type ManualStageStatus = "complete" | "pending";
type ManualStageStatusMap = Record<string, ManualStageStatus>;

const OWNER_LABELS = {
  headquarters: "总部端",
  "agency-source": "代理源",
  "client-source": "客户源",
  "client-plan": "客户端计划",
} as const;

function readManualStatuses(siteId?: string | null): ManualStageStatusMap {
  try {
    const raw = window.localStorage.getItem(socialMarketingManualStatusKey(siteId));
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, ManualStageStatus] => entry[1] === "complete" || entry[1] === "pending"));
  } catch {
    return {};
  }
}

function readMarketView(siteId?: string | null): SocialMarketingMarket {
  try {
    const value = window.localStorage.getItem(socialMarketingMarketViewKey(siteId));
    return value === "china" || value === "overseas" || value === "dual" ? value : "dual";
  } catch {
    return "dual";
  }
}

export function SocialMarketingPlaybook({ siteId, onSelectTab }: { siteId?: string | null; onSelectTab: (tab: string) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [marketView, setMarketView] = useState<SocialMarketingMarket>(() => readMarketView(siteId));
  const [manualStatuses, setManualStatuses] = useState<ManualStageStatusMap>(() => readManualStatuses(siteId));
  const [revision, setRevision] = useState(0);
  const snapshot = useMemo(() => readSocialMarketingSnapshot(siteId), [siteId, revision]);

  useEffect(() => {
    setMarketView(readMarketView(siteId));
    setManualStatuses(readManualStatuses(siteId));
    setRevision((current) => current + 1);
  }, [siteId]);

  useEffect(() => {
    const refresh = () => setRevision((current) => current + 1);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const saveMarketView = (next: SocialMarketingMarket) => {
    setMarketView(next);
    try { window.localStorage.setItem(socialMarketingMarketViewKey(siteId), next); } catch { /* current view remains usable */ }
  };

  const saveManualStatus = (stage: SocialMarketingStage, status: ManualStageStatus) => {
    const next = { ...manualStatuses, [stage.id]: status };
    setManualStatuses(next);
    if (stage.id === "factory-profile") {
      try { window.localStorage.setItem(socialMarketingFactoryConfirmationKey(siteId), status === "complete" ? "confirmed" : "pending"); } catch { /* manual state remains visible */ }
    }
    try { window.localStorage.setItem(socialMarketingManualStatusKey(siteId), JSON.stringify(next)); } catch { /* manual state remains visible */ }
    setRevision((current) => current + 1);
  };

  const progressFor = (stage: SocialMarketingStage) => {
    const automaticCount = stage.progressKeys.filter((key) => snapshot[key]).length;
    const automaticPercent = Math.round((automaticCount / Math.max(stage.progressKeys.length, 1)) * 100);
    const manual = manualStatuses[stage.id];
    const percent = manual === "complete" ? 100 : automaticPercent;
    const complete = manual === "complete" || (manual !== "pending" && automaticPercent === 100);
    const statusLabel = manual === "complete" ? "人工验收完成" : complete ? "系统验证通过" : percent > 0 ? "进行中" : "待完成";
    return { automaticCount, automaticPercent, percent, complete, statusLabel };
  };

  const totalProgress = Math.round(SOCIAL_MARKETING_STAGES.reduce((total, stage) => total + progressFor(stage).percent, 0) / SOCIAL_MARKETING_STAGES.length);
  const completedStages = SOCIAL_MARKETING_STAGES.filter((stage) => progressFor(stage).complete).length;
  const nextStage = SOCIAL_MARKETING_STAGES.find((stage) => !progressFor(stage).complete);

  const focusStage = (stageId: string) => document.querySelector<HTMLElement>(`[data-social-marketing-stage="${stageId}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const openStageTarget = (stage: SocialMarketingStage) => {
    if (stage.target.kind === "social-tab") {
      onSelectTab(stage.target.value);
      return;
    }
    const socialIndex = location.pathname.indexOf("/social");
    const applicationRoot = socialIndex >= 0 ? location.pathname.slice(0, socialIndex) : location.pathname;
    const [pathname, rawSearch = ""] = stage.target.value.split("?");
    const params = new URLSearchParams(rawSearch);
    if (siteId) params.set("siteId", siteId);
    navigate(`${applicationRoot}${pathname}${params.size ? `?${params.toString()}` : ""}`);
  };

  const market = SOCIAL_MARKETING_MARKET_TRACKS[marketView];

  return (
    <div data-social-marketing-playbook data-development-standard-template={SOCIAL_DEVELOPMENT_STANDARD_TEMPLATE.id} data-content-design-application="social-marketing-playbook" className="space-y-4">
      <Card {...SHARED_LAYOUT_STYLE_LARGE_CARD_PROPS} data-page-factory-region="large-card" data-social-content-card data-social-marketing-summary className="border-current/20">
        <CardHeader key="summary-header" className="gap-3">
          <div
            data-page-factory-region="title-2"
            data-responsive-shared-surface="title-2"
            data-development-standard-frame-region="title-2"
            data-development-standard-frame-label="标题2"
            className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"
          >
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-lg"><Map className="h-5 w-5" />工厂社交媒体营销作战</CardTitle>
              <p className="mt-1 max-w-4xl text-sm leading-6 opacity-75">先理解营销逻辑，再进入对应页面完成操作。系统自动读取当前独立计划的设置、账号、内容、发布、线索和归因记录；人工验收与系统验证分别留痕。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">模板 {SOCIAL_DEVELOPMENT_STANDARD_TEMPLATE.version}</Badge>
              <Badge variant="outline">完成 {completedStages}/{SOCIAL_MARKETING_STAGES.length} · {totalProgress}%</Badge>
              <Button size="sm" variant="outline" onClick={() => setRevision((current) => current + 1)}><RefreshCw className="mr-1 h-4 w-4" />重新自检</Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3" data-social-market-selector>
            {(Object.keys(SOCIAL_MARKETING_MARKET_TRACKS) as SocialMarketingMarket[]).map((value) => {
              const item = SOCIAL_MARKETING_MARKET_TRACKS[value];
              const selected = marketView === value;
              return <button key={value} type="button" data-social-market-view={value} aria-pressed={selected} onClick={() => saveMarketView(value)} className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${selected ? "border-current bg-current/10 font-medium" : "border-current/15 hover:bg-current/[0.05]"}`}><span className="block text-sm font-semibold">{item.label}</span><span className="mt-1 block leading-5 opacity-70">{item.description}</span></button>;
            })}
          </div>
          <div className="rounded-lg border border-current/15 bg-current/[0.03] p-3 text-xs leading-5">
            <div className="font-semibold">当前作战线路：{market.label}</div>
            <div className="mt-1 grid gap-2 md:grid-cols-2"><p><span className="font-medium">推荐渠道：</span>{market.channels}</p><p><span className="font-medium">转化路线：</span>{market.conversion}</p></div>
          </div>
        </CardHeader>
        <CardContent key="summary-content">
          <div data-social-marketing-stage-rail data-social-marketing-stage-navigation className="grid grid-cols-3 gap-1.5 rounded-lg border border-current/15 p-2 sm:grid-cols-5 xl:grid-cols-9">
            {SOCIAL_MARKETING_STAGES.map((stage) => {
              const progress = progressFor(stage);
              return <button key={stage.id} type="button" data-social-marketing-stage-state={progress.complete ? "complete" : progress.percent > 0 ? "partial" : "pending"} onClick={() => focusStage(stage.id)} title={`${stage.title}：${progress.statusLabel}，${progress.percent}%`} className={`min-w-0 rounded-md border px-2 py-2 text-center text-[11px] transition-colors ${progress.complete ? "border-emerald-500 bg-emerald-600 text-white" : progress.percent > 0 ? "border-sky-400 bg-sky-50 text-sky-800" : "border-current/15 bg-background/70 opacity-70"}`}><span className="block font-semibold">{String(stage.order).padStart(2, "0")}</span><span className="mt-0.5 block truncate">{stage.title}</span><span className="mt-0.5 block text-[10px]">{progress.percent}%</span></button>;
            })}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-current/10" role="progressbar" aria-label="营销作战总体完成度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={totalProgress}><div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all" style={{ width: `${totalProgress}%` }} /></div>
          <p className="mt-2 text-xs opacity-70">{nextStage ? `当前建议先完成第 ${String(nextStage.order).padStart(2, "0")} 步「${nextStage.title}」。` : "所有阶段已经验证完成，可进入持续运营和数据复盘。"}</p>
        </CardContent>
      </Card>

      <section data-social-marketing-stage-list className="grid gap-3">
        {SOCIAL_MARKETING_STAGES.map((stage) => {
          const progress = progressFor(stage);
          const logic = marketView === "china" ? stage.domesticLogic : marketView === "overseas" ? stage.overseasLogic : `国内：${stage.domesticLogic}\n海外：${stage.overseasLogic}`;
          return (
            <Card {...SHARED_LAYOUT_STYLE_LARGE_CARD_PROPS} key={stage.id} data-social-content-card data-social-marketing-stage={stage.id} tabIndex={-1} className="scroll-mt-4 border-current/20 outline-none focus-visible:ring-2 focus-visible:ring-current/30">
              <CardHeader key="stage-header" className="gap-3 pb-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={`inline-flex h-9 min-w-9 items-center justify-center rounded-full border text-sm font-bold ${progress.complete ? "border-emerald-500 bg-emerald-600 text-white" : "border-current/20 bg-current/[0.05]"}`}>{String(stage.order).padStart(2, "0")}</span>
                    <div><CardTitle className="text-base">{stage.title}</CardTitle><p className="mt-1 text-sm leading-6 opacity-75">{stage.purpose}</p></div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2"><Badge variant="outline">{OWNER_LABELS[stage.owner]}</Badge><Badge variant="outline" className={progress.complete ? "border-emerald-300 text-emerald-700" : ""}>{progress.statusLabel} · {progress.percent}%</Badge></div>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-current/10"><div className={`h-full rounded-full transition-all ${progress.complete ? "bg-emerald-500" : "bg-sky-500"}`} style={{ width: `${progress.percent}%` }} /></div>
              </CardHeader>
              <CardContent key="stage-content" className="grid gap-3 xl:grid-cols-2">
                <section {...SHARED_LAYOUT_STYLE_SMALL_CARD_PROPS} data-page-factory-region="small-card" data-social-marketing-logic className="rounded-xl border border-current/15 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold"><Target className="h-4 w-4" />营销逻辑</h3>
                  <div className="mt-2 whitespace-pre-line text-sm leading-6 opacity-80">{logic}</div>
                  <div className="mt-3 rounded-lg border border-current/10 bg-background/60 p-3 text-xs leading-5"><span className="font-semibold">完成结果：</span>{stage.acceptance.join("；")}。</div>
                </section>
                <section {...SHARED_LAYOUT_STYLE_SMALL_CARD_PROPS} data-social-marketing-operation className="rounded-xl border border-current/15 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold"><Factory className="h-4 w-4" />操作使用</h3>
                  <ol className="mt-2 grid gap-2 text-sm leading-5">
                    {stage.operationSteps.map((step, index) => <li key={step} className="flex gap-2 rounded-lg border border-current/10 bg-current/[0.02] px-3 py-2"><span className="font-semibold opacity-65">{String(index + 1).padStart(2, "0")}</span><span>{step}</span></li>)}
                  </ol>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => openStageTarget(stage)}>{stage.actionLabel}<ArrowRight className="ml-1 h-4 w-4" /></Button>
                    {progress.complete ? <Button size="sm" variant="outline" onClick={() => saveManualStatus(stage, "pending")}><CircleDashed className="mr-1 h-4 w-4" />设为待完成</Button> : <Button size="sm" variant="outline" onClick={() => saveManualStatus(stage, "complete")}><CheckCircle2 className="mr-1 h-4 w-4" />人工验收完成</Button>}
                  </div>
                  <p className="mt-2 text-xs opacity-65">系统自检：{progress.automaticCount}/{stage.progressKeys.length} 项通过。人工验收只确认真实业务情况，不会修改账号、素材、内容或线索数据。</p>
                </section>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card {...SHARED_LAYOUT_STYLE_LARGE_CARD_PROPS} data-social-content-card data-social-standard-boundary className="border-current/20">
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" />统一开发规范与发布边界</div><p className="mt-1 text-xs leading-5 opacity-75">{SOCIAL_DEVELOPMENT_STANDARD_TEMPLATE.releaseBoundary}</p></div>
          <Button variant="outline" size="sm" onClick={() => onSelectTab("customer-roadmap")}>查看内部痛点路线<ArrowRight className="ml-1 h-4 w-4" /></Button>
        </CardContent>
      </Card>
    </div>
  );
}
