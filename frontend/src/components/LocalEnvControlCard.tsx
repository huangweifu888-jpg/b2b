import { useEffect, useState } from "react";
import { ChevronDown, ExternalLink, LoaderCircle, Power, RefreshCw, RotateCcw, ServerCog } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  formatLocalEnvTime,
  localDevFetch,
  serviceStatusLabel,
  serviceStatusTone,
  type LocalEnvServiceStatus,
} from "@/lib/local-dev";
import { openUrlInExternalBrowser } from "@/lib/browser-utils";
import { useLocalEnvStatus } from "@/hooks/use-local-env-status";

type Variant = "client" | "agency" | "hq";

const OPEN_KEY = "tradepro.localEnvControlCardOpen";

const toneMap: Record<
  Variant,
  {
    wrapper: string;
    title: string;
    text: string;
    subtle: string;
    button: string;
    accent: string;
  }
> = {
  client: {
    wrapper: "border-slate-200 bg-white/95",
    title: "text-slate-900",
    text: "text-slate-700",
    subtle: "text-slate-500",
    button: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
    accent: "text-cyan-600",
  },
  agency: {
    wrapper: "border-violet-200 bg-white/95",
    title: "text-slate-900",
    text: "text-slate-700",
    subtle: "text-slate-500",
    button: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
    accent: "text-violet-600",
  },
  hq: {
    wrapper: "border-emerald-200 bg-white/95",
    title: "text-slate-900",
    text: "text-slate-700",
    subtle: "text-slate-500",
    button: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
    accent: "text-emerald-600",
  },
};

function statusText(status?: LocalEnvServiceStatus) {
  return serviceStatusLabel(status?.status || "stopped");
}

export default function LocalEnvControlCard({
  variant,
  className,
}: {
  variant: Variant;
  className?: string;
}) {
  const tone = toneMap[variant];
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(`${OPEN_KEY}:${variant}`) === "true";
  });
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [starting, setStarting] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const { status, refreshStatus: baseRefreshStatus } = useLocalEnvStatus(300000);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(`${OPEN_KEY}:${variant}`, String(open));
  }, [open, variant]);

  const refreshStatus = async (silent = false) => {
    if (!silent) setLoadingStatus(true);
    try {
      return await baseRefreshStatus(silent);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!silent) {
        toast({
          title: "读取本地环境状态失败",
          description: `暂时无法获取 3003 / 8000 / 3004 状态：${message}`,
        });
      }
      return null;
    } finally {
      if (!silent) setLoadingStatus(false);
    }
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      const response = await localDevFetch("/api/v1/local-dev/start-local-env", { method: "POST" });
      const result = await response.json();
      await refreshStatus(true);
      toast({
        title: "本地环境已启动",
        description: `前端 3003：${result?.statuses?.["3003"] || "UNKNOWN"}，后端 8000：${
          result?.statuses?.["8000"] || "UNKNOWN"
        }，网站端 3004：${result?.statuses?.["3004"] || "UNKNOWN"}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: "启动失败",
        description: `未能启动本地环境：${message}`,
      });
    } finally {
      setStarting(false);
    }
  };

  const handleRestart = async () => {
    setRestarting(true);
    try {
      await localDevFetch("/api/v1/local-dev/restart-local-env", { method: "POST" });
      toast({
        title: "正在重启本地环境",
        description: "已发送重启指令，稍后会自动刷新 3003 / 8000 / 3004 状态。",
      });
      await new Promise((resolve) => window.setTimeout(resolve, 5000));
      await refreshStatus(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: "重启失败",
        description: `未能重启本地环境：${message}`,
      });
    } finally {
      setRestarting(false);
    }
  };

  const handleOpenSite = async () => {
    const opened = await openUrlInExternalBrowser("http://127.0.0.1:3003/zb");
    if (!opened) {
      toast({
        title: "打开失败",
        description: "未能调用电脑默认浏览器，请确认本地环境与系统浏览器可正常使用后再试。",
      });
    }
  };

  const services = [
    { key: "frontend", label: "主程序前端", value: status?.frontend },
    { key: "backend", label: "主程序后端", value: status?.backend },
    { key: "website", label: "网站端", value: status?.website },
  ];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section className={cn("rounded-xl border shadow-sm", tone.wrapper, className)}>
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10", tone.accent)}>
            <ServerCog className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className={cn("text-sm font-semibold", tone.title)}>本地环境</div>
            <div className={cn("text-[11px]", tone.subtle)}>
              前端 {statusText(status?.frontend)} / 后端 {statusText(status?.backend)} / 网站端{" "}
              {statusText(status?.website)}
            </div>
          </div>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition",
                tone.button
              )}
            >
              {open ? "收起" : "展开"}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="border-t border-slate-200">
          <div className="space-y-3 px-3 pb-3 pt-3">
            <div className="grid gap-2 md:grid-cols-[1.2fr_1fr]">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium text-slate-900">运行状态</div>
                  <button
                    type="button"
                    onClick={() => void refreshStatus()}
                    disabled={loadingStatus || starting || restarting}
                    className="inline-flex items-center gap-1 text-[11px] text-cyan-700 transition hover:text-cyan-900"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", loadingStatus && "animate-spin")} />
                    刷新
                  </button>
                </div>
                <div className="mt-2 space-y-1.5 text-xs">
                  {services.map((service) => (
                    <div key={service.key} className="flex items-center justify-between gap-2">
                      <span className={tone.text}>
                        {service.label} {service.value?.port || "-"}
                      </span>
                      <span className={cn("font-semibold", serviceStatusTone(service.value?.status || "stopped"))}>
                        {statusText(service.value)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className={cn("mt-2 text-[11px]", tone.subtle)}>
                  最近检查：{formatLocalEnvTime(status?.checkedAt) || "暂无"}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
                <button
                  type="button"
                  onClick={() => void handleStart()}
                  disabled={starting || restarting}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {starting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
                  启动
                </button>
                <button
                  type="button"
                  onClick={() => void handleRestart()}
                  disabled={starting || restarting}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {restarting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  重启
                </button>
                <button
                  type="button"
                  onClick={() => void handleOpenSite()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  打开总部端
                </button>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
