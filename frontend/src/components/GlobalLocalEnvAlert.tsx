import { useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, LoaderCircle, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DraggableDialogContent } from "@/components/ui/dialog";
import { formatLocalEnvTime, getLocalEnvRecoveryAction, localDevFetch, serviceStatusLabel, serviceStatusTone } from "@/lib/local-dev";
import { diagnoseLocalEnv, getLocalEnvLearningNote, listLocalEnvLearningFactors, recordLocalEnvRecovery } from "@/lib/local-env-recovery";
import { getRouteErrorLearningNote, listRouteErrorLearningFactors, readRouteErrorDiagnostic } from "@/lib/lazy-module-recovery";
import { useLocalEnvStatus } from "@/hooks/use-local-env-status";
import { cn } from "@/lib/utils";

type Variant = "client" | "agency" | "hq";
type Placement = "floating" | "footer" | "inline";
type DiagnosticKind = "preview" | "environment" | "page";
type Rule = { label: string; detail: string };
type LearnedFactor = { id: string; label: string; count: number; firstAt: string; lastAt: string; outcome: string };
type UsageStep = { label: string; detail: string };

// 这些不是预设规则，而是本次在本地实际发生、处理后已复检成功的案例。
// 后续记录只会在诊断完成并得到处理结果后追加到同一台账。
const VERIFIED_INCIDENT_FACTORS: Record<DiagnosticKind, readonly LearnedFactor[]> = {
  preview: [{
    id: "verified-preview-dynamic-module",
    label: "动态模块",
    count: 1,
    firstAt: "2026-08-22T00:00:00.000Z",
    lastAt: "2026-08-22T00:00:00.000Z",
    outcome: "已验证：恢复本地 Vite 预览服务后，重新加载右侧预览成功。",
  }],
  environment: [
    {
      id: "verified-env-backend-migration",
      label: "迁移落后",
      count: 1,
      firstAt: "2026-08-22T00:01:00.000Z",
      lastAt: "2026-08-22T00:01:00.000Z",
      outcome: "已验证：完成本地数据库迁移并复检后，8000 API 健康检查恢复。",
    },
    {
      id: "verified-env-website-preview",
      label: "网站未启",
      count: 1,
      firstAt: "2026-08-22T00:02:00.000Z",
      lastAt: "2026-08-22T00:02:00.000Z",
      outcome: "已验证：启动 3004 静态预览并复检后，网站端健康检查恢复。",
    },
    {
      id: "verified-env-all-services-stopped",
      label: "三服全停",
      count: 1,
      firstAt: "2026-08-23T01:25:14.000Z",
      lastAt: "2026-08-23T01:26:10.000Z",
      outcome: "已验证：3003、8000、3004 均未监听；调用当前 local-runtime 统一启动器后，三项均恢复为运行中，五个健康入口全部返回 200。",
    },
    {
      id: "verified-env-legacy-launcher",
      label: "旧启失效",
      count: 1,
      firstAt: "2026-08-23T01:19:00.000Z",
      lastAt: "2026-08-23T01:25:14.000Z",
      outcome: "已验证：源码目录旧便携启动器缺少打包依赖；改用 local-runtime/Start-LocalSandbox.ps1 统一启动入口后恢复。",
    },
    {
      id: "verified-env-policy-blocked",
      label: "策略拦截",
      count: 1,
      firstAt: "2026-08-23T01:24:40.000Z",
      lastAt: "2026-08-23T01:25:14.000Z",
      outcome: "已验证：PowerShell 执行策略拦截了首次启动；仅对本次启动进程使用 ExecutionPolicy Bypass，未修改系统全局策略，随后启动成功。",
    },
  ],
  page: [{
    id: "verified-page-isolation-diagnostic-entry",
    label: "隔离入口缺失",
    count: 1,
    firstAt: "2026-08-23T00:00:00.000Z",
    lastAt: "2026-08-23T00:00:00.000Z",
    outcome: "已修复：隔离页内置异常检测入口与快速重试；运行错误会保留在当前路由的学习记录中，不再依赖外层页面框架。",
  }],
};

const serviceLabels = { frontend: "前端", backend: "后端", website: "网站端" } as const;

const RULEBOOK: Record<DiagnosticKind, { label: string; description: string; rules: readonly Rule[] }> = {
  preview: {
    label: "沙盘启动",
    description: "出现“右侧预览启动失败”时使用；只检查沙盘外壳、模块加载与 Vite 热更新。",
    rules: [
      { label: "动态模块", detail: "检查右侧预览是否收到动态模块加载失败。" },
      { label: "模块地址", detail: "核对预览模块地址是否可读取、是否指向当前版本。" },
      { label: "启动顺序", detail: "确认预览外壳、运行配置与页面模块的启动顺序。" },
      { label: "预览容器", detail: "确认右侧预览容器已创建且没有被提前卸载。" },
      { label: "热更连接", detail: "检查 Vite/HMR 连接中断或热更新后的模块失效。" },
      { label: "缓存版本", detail: "检查浏览器缓存与带时间戳的模块版本是否不一致。" },
      { label: "加载超时", detail: "记录模块请求没有在合理时间内完成的情况。" },
      { label: "依赖解析", detail: "检查预览模块依赖是否因缺失或循环引用而失败。" },
      { label: "运行配置", detail: "检查本地预览使用的运行配置是否可读取。" },
      { label: "重新加载", detail: "验证重新加载预览是否恢复，而不扩大到环境检查。" },
      { label: "恢复结果", detail: "记录预览重载后的成功、失败和耗时。" },
      { label: "转交条件", detail: "只有明确发现本地预览服务不可用时，才建议转到环境诊断。" },
    ],
  },
  environment: {
    label: "本地环境",
    description: "出现“本地环境异常提醒”或服务全停时使用；只检查 3003、8000、3004 与启动恢复。",
    rules: [
      { label: "前端监听", detail: "检查 3003 是否正在监听。" },
      { label: "API监听", detail: "检查 8000 本地 API 是否正在监听。" },
      { label: "网站监听", detail: "检查 3004 静态预览是否正在监听。" },
      { label: "统一入口", detail: "确认恢复动作使用当前 local-runtime/Start-LocalSandbox.ps1，不调用缺少打包依赖的旧便携入口。" },
      { label: "运行依赖", detail: "检查统一启动器需要的 Node、Python、数据库、素材目录与网站预览目录是否齐全。" },
      { label: "策略拦截", detail: "识别 PowerShell 执行策略拦截；仅允许对本次启动进程使用 Bypass，不修改系统全局策略。" },
      { label: "API健康", detail: "检查本地 API 的健康响应。" },
      { label: "网站健康", detail: "检查静态预览服务的健康响应。" },
      { label: "监督进程", detail: "检查后端监督进程是否仍在管理服务。" },
      { label: "启动日志", detail: "服务无法启动时，读取最近的本地启动错误摘要。" },
      { label: "迁移状态", detail: "仅后端启动失败时提示数据库迁移是否落后；绝不自动迁移。" },
      { label: "端口占用", detail: "检查端口被其他本地进程占用的可能性。" },
      { label: "单服启动", detail: "优先只启动发现故障的服务，不扩大重启范围。" },
      { label: "重启冷却", detail: "防止同一服务在短时间内反复重启。" },
      { label: "复检结果", detail: "修复后复检服务健康，并把结果写入环境学习记录。" },
    ],
  },
  page: {
    label: "页面隔离",
    description: "出现“当前页面加载异常已隔离”时使用；只检查当前路由、组件、插件、数据和运行时。",
    rules: [
      { label: "当前路由", detail: "确认被隔离的当前页面路径与查询参数。" },
      { label: "运行错误", detail: "读取页面隔离器记录的运行时错误摘要。" },
      { label: "懒加载", detail: "检查当前页面自己的懒加载模块是否失败。" },
      { label: "组件引用", detail: "检查未定义变量、空引用和组件导出错误。" },
      { label: "数据结构", detail: "检查页面读取的数据是否符合组件预期结构。" },
      { label: "插件组合", detail: "检查当前页面插件组合或插件状态是否冲突。" },
      { label: "页面配置", detail: "检查当前路由的页面配置是否完整。" },
      { label: "样式契约", detail: "检查共享样式与当前组件契约是否出现运行时冲突。" },
      { label: "重试当前", detail: "只重试当前页面，不影响左侧导航、顶部栏或其他工作区。" },
      { label: "错误重复", detail: "统计相同页面、相同错误类型的重复次数。" },
      { label: "学习记录", detail: "把当前页面异常单独记录到页面学习库。" },
      { label: "转交条件", detail: "只有错误明确属于模块加载时，才建议转到预览诊断。" },
    ],
  },
};

const USAGE_FLOW: Record<DiagnosticKind, readonly UsageStep[]> = {
  preview: [
    { label: "选择本项", detail: "只在右侧沙盘出现启动失败、动态模块或热更新错误时进入本项。" },
    { label: "检查本项", detail: "读取沙盘启动学习记录和当前模块故障，不扫描业务页面数据。" },
    { label: "按因处理", detail: "环境正常时重新加载沙盘；发现服务不可用时才转到“本地环境”。" },
    { label: "验证入库", detail: "重新加载成功后写入结果；未验证成功的猜测不会进入学习记录。" },
  ],
  environment: [
    { label: "选择本项", detail: "本地环境提醒、端口离线或三项服务全部停止时进入本项。" },
    { label: "检查本项", detail: "只读取 3003、8000、3004、统一入口、依赖、端口和最近启动日志。" },
    { label: "安全恢复", detail: "按检测结果选择安全启动或安全重启；不触碰业务数据和系统全局策略。" },
    { label: "复检入库", detail: "三项服务及健康入口复检通过后，才把原因与解决方式追加为下一条案例。" },
  ],
  page: [
    { label: "选择本项", detail: "只有当前页面出现“加载异常已隔离”时进入本项。" },
    { label: "检查本项", detail: "只读取当前路由与隔离错误，不扫描其他项目页或本地服务。" },
    { label: "修复当前", detail: "按路由、组件、数据或插件原因修复后，只重试当前页面。" },
    { label: "验证入库", detail: "当前页恢复后记录结果；若属于模块加载才转到“沙盘启动”。" },
  ],
};

function ruleNumber(index: number) {
  return String(index + 1).padStart(2, "0");
}

function getPreviewLearningSummary() {
  if (typeof window === "undefined") return "暂无预览学习记录。";
  try {
    const entries: unknown = JSON.parse(window.localStorage.getItem("tradepro.preview-bootstrap-failure-learning.v1") || "[]");
    if (!Array.isArray(entries) || !entries.length) return "暂无预览启动失败记录。";
    const latest = entries[entries.length - 1] as { signature?: unknown };
    return `本机已记录 ${entries.length} 次；最近归类：${typeof latest.signature === "string" ? latest.signature : "预览启动异常"}。`;
  } catch {
    return "预览学习记录暂不可读取。";
  }
}

function getPreviewLearningFactors(): LearnedFactor[] {
  if (typeof window === "undefined") return [];
  try {
    const entries: unknown = JSON.parse(window.localStorage.getItem("tradepro.preview-bootstrap-failure-learning.v1") || "[]");
    if (!Array.isArray(entries)) return [];
    const grouped = new Map<string, Array<{ recordedAt: string; outcome?: string }>>();
    for (const raw of entries) {
      const entry = raw as { signature?: unknown; recordedAt?: unknown; outcome?: unknown };
      if (typeof entry.signature !== "string" || typeof entry.recordedAt !== "string") continue;
      const group = grouped.get(entry.signature) || [];
      group.push({ recordedAt: entry.recordedAt, outcome: typeof entry.outcome === "string" ? entry.outcome : undefined });
      grouped.set(entry.signature, group);
    }
    return [...grouped.entries()].map(([signature, records]) => {
      const sorted = [...records].sort((left, right) => left.recordedAt.localeCompare(right.recordedAt));
      const latest = sorted[sorted.length - 1];
      return { id: signature, label: signature, count: sorted.length, firstAt: sorted[0].recordedAt, lastAt: latest.recordedAt, outcome: latest.outcome || "已记录，等待下一次预览检测。" };
    }).sort((left, right) => left.firstAt.localeCompare(right.firstAt));
  } catch {
    return [];
  }
}

function learningTime(value: string | number) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "未知时间" : date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function GlobalLocalEnvAlert({ variant, placement = "floating" }: { variant: Variant; placement?: Placement }) {
  void variant;
  const [open, setOpen] = useState(false);
  const [activeKind, setActiveKind] = useState<DiagnosticKind>("environment");
  const [hoveredRule, setHoveredRule] = useState<Rule | null>(null);
  const [loading, setLoading] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const [scanNonce, setScanNonce] = useState(0);
  const { status, error: fetchError, refreshStatus: baseRefreshStatus } = useLocalEnvStatus(300000);

  const refreshStatus = async (silent = false) => {
    if (!silent) setLoading(true);
    try { return await baseRefreshStatus(silent); }
    finally { if (!silent) setLoading(false); }
  };

  const recoveryAction = getLocalEnvRecoveryAction(status, fetchError);
  const findings = useMemo(() => diagnoseLocalEnv(status, fetchError, recoveryAction), [fetchError, recoveryAction, status]);
  const routeDiagnostic = useMemo(() => {
    void scanNonce;
    return readRouteErrorDiagnostic();
  }, [scanNonce]);
  const services = useMemo(() => {
    if (!status) return [];
    return [
      { key: "frontend", label: serviceLabels.frontend, value: status.frontend },
      { key: "backend", label: serviceLabels.backend, value: status.backend },
      { key: "website", label: serviceLabels.website, value: status.website },
    ] as const;
  }, [status]);

  const handleRecovery = async () => {
    if (!recoveryAction) return;
    setRestarting(true);
    setRecoveryError("");
    try {
      await localDevFetch(recoveryAction === "start" ? "/api/v1/local-dev/start-local-env" : "/api/v1/local-dev/restart-local-env", { method: "POST" });
      await new Promise((resolve) => window.setTimeout(resolve, 5000));
      const result = await refreshStatus(true);
      findings.forEach((finding) => recordLocalEnvRecovery(finding.id, recoveryAction, Boolean(result?.ok)));
    } catch (error) {
      findings.forEach((finding) => recordLocalEnvRecovery(finding.id, recoveryAction, false));
      setRecoveryError(error instanceof Error ? error.message : String(error));
    } finally {
      setRestarting(false);
      setScanNonce((value) => value + 1);
    }
  };

  const hasEnvironmentIssue = Boolean(fetchError) || (status ? !status.ok : false);
  const activePanel = RULEBOOK[activeKind];
  const usageFlow = USAGE_FLOW[activeKind];
  const learnedFactors = useMemo<LearnedFactor[]>(() => {
    const mergeWithVerifiedIncidents = (actualFactors: LearnedFactor[]) => {
      const verifiedFactors = VERIFIED_INCIDENT_FACTORS[activeKind];
      const verifiedLabels = new Set(verifiedFactors.map((factor) => factor.label));
      return [...verifiedFactors, ...actualFactors.filter((factor) => !verifiedLabels.has(factor.label))]
        .sort((left, right) => left.firstAt.localeCompare(right.firstAt));
    };
    if (activeKind === "preview") return mergeWithVerifiedIncidents(getPreviewLearningFactors());
    if (activeKind === "environment") {
      return mergeWithVerifiedIncidents(listLocalEnvLearningFactors()
        .filter((factor) => factor.lastAction !== "detect" && factor.lastSuccess)
        .map((factor) => ({
        id: factor.id,
        label: factor.label,
        count: factor.count,
        firstAt: factor.firstAt,
        lastAt: factor.lastAt,
        outcome: `${factor.lastAction === "detect" ? "最近为只读检测" : factor.lastAction === "start" ? "最近执行安全启动" : "最近执行安全重启"}；${factor.lastSuccess ? "复检成功" : "尚未确认恢复"}。`,
      })));
    }
    return mergeWithVerifiedIncidents(listRouteErrorLearningFactors(routeDiagnostic?.target).map((factor) => ({
      id: factor.signature,
      label: factor.signature,
      count: factor.count,
      firstAt: new Date(factor.firstAt).toISOString(),
      lastAt: new Date(factor.lastAt).toISOString(),
      outcome: `已隔离，未扩散至其他页面；关联页面：${factor.targets.join("、")}。需修复原因后再重试当前页。`,
    })));
  }, [activeKind, routeDiagnostic?.target, scanNonce]);
  const triggerClass = hasEnvironmentIssue
    ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
    : "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100";

  const retryIsolatedRoute = () => {
    const target = routeDiagnostic?.target;
    if (!target || typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("tradepro:retry-isolated-route", { detail: { target } }));
    setOpen(false);
  };

  return (
    <div data-local-env-diagnostic-host data-local-env-diagnostic-placement={placement} className={placement === "footer" ? "shrink-0" : placement === "inline" ? "inline-flex" : "fixed right-3 top-[72px] z-[90] sm:right-4"}>
      <Dialog open={open} onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          const currentRoute = readRouteErrorDiagnostic();
          setActiveKind(currentRoute ? "page" : "environment");
          setHoveredRule(null);
          setScanNonce((value) => value + 1);
        }
      }}>
        <DialogTrigger asChild>
          <button type="button" data-local-env-diagnostic-trigger data-responsive-footer-diagnostic-control={placement === "footer" ? "true" : undefined} data-responsive-priority={placement === "footer" ? "p1" : undefined} data-responsive-compact={placement === "footer" ? "icon-label" : undefined} aria-label="异常检测" title="异常检测" className={cn("inline-flex items-center gap-1.5 border px-2.5 text-xs font-semibold shadow-sm transition-colors", placement === "footer" ? "h-9 rounded-md" : placement === "inline" ? "h-[34px] rounded-md" : "h-8 rounded-full", triggerClass)}>
            {hasEnvironmentIssue ? <AlertTriangle className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            <span data-local-env-diagnostic-label>异常检测</span>
          </button>
        </DialogTrigger>
        <DraggableDialogContent
          showCloseButton
          resizable
          minWidth={320}
          minHeight={420}
          className="flex h-[min(760px,calc(100dvh-24px))] w-[min(92vw,56rem)] max-w-[calc(100vw-16px)] flex-col gap-0 overflow-hidden rounded-none p-0"
          data-local-env-diagnostic-panel
          data-shared-diagnostic-contract="three-isolated-learning-ledger-v2"
          data-shared-dialog-contract="runtime-diagnostic"
          data-shared-window-kind="workbench"
        >
          <DialogHeader data-shared-developer-dialog-title data-drag-handle className="shrink-0 border-b px-5 py-4 pr-12">
            <DialogTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-sky-600" />异常检测</DialogTitle>
            <DialogDescription data-dialog-optional-description>三类检查与学习记录相互隔离；默认只打开当前异常对应的一类，不扩大扫描范围。</DialogDescription>
          </DialogHeader>
          <div data-shared-developer-dialog-navigation data-shared-window-region="topbar" className="shrink-0 border-b px-5 py-3" role="tablist" aria-label="异常检测分类">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(RULEBOOK) as DiagnosticKind[]).map((kind) => {
                const panel = RULEBOOK[kind];
                const selected = activeKind === kind;
                return <button key={kind} type="button" role="tab" aria-selected={selected} title={panel.description} onClick={() => { setActiveKind(kind); setHoveredRule(null); setScanNonce((value) => value + 1); }} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors", selected ? "border-sky-600 bg-sky-700 text-white" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-sky-300 hover:bg-sky-50")}>{panel.label}</button>;
              })}
            </div>
          </div>
          <div data-shared-developer-dialog-content data-shared-window-region="content" className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">{activePanel.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{activePanel.description}</p>
              <p className="mt-2 min-h-5 rounded-md bg-white px-2 py-1 text-[11px] text-slate-600">{hoveredRule ? `处理说明：${hoveredRule.detail}` : "鼠标停留在编号胶囊上，可查看该真实案例的发生次数、时间与复检结果。"}</p>
            </div>
            <section className="mt-3 rounded-xl border border-slate-200 bg-white p-3" data-diagnostic-usage-flow={activeKind}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">如何使用</p>
                <span className="text-[11px] text-slate-400">选择分类 → 只检本项 → 按因处理 → 复检学习</span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {usageFlow.map((step, index) => <div key={`${activeKind}-usage-${step.label}`} title={step.detail} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700"><span className="mr-1.5 font-mono text-[11px] font-bold text-sky-700">{ruleNumber(index)}</span><span className="font-semibold">{step.label}</span><p className="mt-1 text-[11px] leading-5 text-slate-500">{step.detail}</p></div>)}
              </div>
            </section>
            <section className="mt-3 rounded-xl border border-sky-200 bg-sky-50/70 p-3" data-diagnostic-learning-sequence={activeKind}>
              <p className="text-sm font-semibold text-sky-950">真实处理记录</p>
              <p className="mt-1 text-[11px] leading-5 text-sky-800">只显示实际发生后的处理记录：已修复会写明复检结果，已隔离会明确标示尚待修复。未发生的基础规则不会显示；新案例确认后才追加下一号。</p>
              {learnedFactors.length ? <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {learnedFactors.map((factor, index) => {
                  const detail = `出现 ${factor.count} 次；首次：${learningTime(factor.firstAt)}；最近：${learningTime(factor.lastAt)}；处理结果：${factor.outcome}`;
                  return <button key={`${activeKind}-learned-${factor.id}`} type="button" title={detail} onMouseEnter={() => setHoveredRule({ label: factor.label, detail })} onFocus={() => setHoveredRule({ label: factor.label, detail })} className="flex min-w-0 items-center gap-2 rounded-lg border border-sky-200 bg-white px-2.5 py-2 text-left text-xs text-sky-950 transition hover:border-sky-500 hover:bg-sky-100"><span className="font-mono text-[11px] font-bold text-sky-700">{ruleNumber(index)}</span><span className="truncate font-medium">{factor.label}</span></button>;
                })}
              </div> : <p className="mt-2 rounded-lg bg-white/80 px-2 py-2 text-xs text-sky-800">当前类别尚无真实处理记录。异常出现后，只有形成隔离或修复处理结果才会登记为 01。</p>}
            </section>

            {activeKind === "preview" ? <section className="mt-4 rounded-xl border border-violet-200 bg-violet-50/70 p-3"><p className="text-sm font-semibold text-violet-950">预览学习记录</p><p className="mt-1 text-xs leading-5 text-violet-800">{getPreviewLearningSummary()}</p></section> : null}
            {activeKind === "environment" ? <section className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-1.5">{services.map((service) => <span key={service.key} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600">{service.label} {service.value.port}<span className={cn("font-semibold", serviceStatusTone(service.value.status))}>{serviceStatusLabel(service.value.status)}</span></span>)}</div>
              {hasEnvironmentIssue ? findings.map((finding) => <div key={finding.id} data-local-env-finding={finding.id} className="rounded-xl border border-amber-200 bg-amber-50/70 p-3"><p className="text-sm font-semibold text-amber-950">{finding.title}</p><p className="mt-1 text-xs leading-5 text-slate-700">{finding.detail}</p><p className="mt-2 text-[11px] text-slate-500">检测证据：{finding.evidence}</p><p className="mt-1 text-[11px] text-slate-500">{getLocalEnvLearningNote(finding.id)}</p></div>) : <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="mr-1.5 inline h-4 w-4" />本地环境当前正常；仅在你点击本项检查时读取服务状态。</div>}
              <p className="text-[11px] text-slate-400">最近环境检查：{formatLocalEnvTime(status?.checkedAt) || "暂未取得状态"}</p>
            </section> : null}
            {activeKind === "page" ? <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3"><p className="text-sm font-semibold text-amber-950">当前页面学习记录</p>{routeDiagnostic ? <><p className="mt-1 break-all font-mono text-[11px] text-amber-800">{routeDiagnostic.target}</p><p className="mt-2 text-xs leading-5 text-slate-700">已隔离错误：{routeDiagnostic.message}</p><p className="mt-2 text-[11px] text-slate-500">{getRouteErrorLearningNote(routeDiagnostic.target)}</p></> : <p className="mt-1 text-xs leading-5 text-slate-600">当前没有被隔离的页面错误。此项不会检查本地服务或预览模块。</p>}</section> : null}
            {recoveryError ? <p data-local-env-recovery-error className="mt-3 rounded-lg bg-rose-50 px-2.5 py-2 text-xs font-medium text-rose-700">恢复失败：{recoveryError}</p> : null}
          </div>
          <div data-shared-developer-dialog-footer data-shared-window-region="footer" data-dialog-resize-safe-area data-dialog-responsive-actions className="flex shrink-0 flex-wrap gap-2 border-t px-5 py-3">
            <Button type="button" variant="outline" size="sm" onClick={() => { if (activeKind === "environment") { recordLocalEnvRecovery(findings[0]?.id || "environment-incomplete", "detect", !hasEnvironmentIssue); void refreshStatus(); } setScanNonce((value) => value + 1); }} disabled={loading || restarting}>
              {loading && activeKind === "environment" ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}检查本项
            </Button>
            {activeKind === "environment" && recoveryAction ? <Button type="button" size="sm" onClick={() => void handleRecovery()} disabled={loading || restarting} className="bg-sky-700 hover:bg-sky-600">{restarting ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}{recoveryAction === "start" ? "安全启动" : "安全重启"}</Button> : null}
            {activeKind === "page" && routeDiagnostic ? <Button type="button" size="sm" onClick={retryIsolatedRoute} className="bg-amber-700 hover:bg-amber-600"><RotateCcw className="mr-1.5 h-3.5 w-3.5" />快速修复并重试</Button> : null}
            <span className="ml-auto inline-flex items-center text-[11px] text-slate-400">案例编号可持续增加，不限 09</span>
          </div>
        </DraggableDialogContent>
      </Dialog>
    </div>
  );
}
