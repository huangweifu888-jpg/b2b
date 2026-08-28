import { useEffect, useState } from "react";
import { ChevronDown, LoaderCircle, Power, RefreshCw, RotateCcw, ServerCog } from "lucide-react";
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
import { useLocalEnvStatus } from "@/hooks/use-local-env-status";

type Variant = "client" | "agency" | "hq";

const OPEN_KEY = "tradepro.localEnvQuickPanelOpen";

const panelToneMap: Record<
  Variant,
  {
    wrapper: string;
    title: string;
    text: string;
    subtle: string;
    button: string;
  }
> = {
  client: {
    wrapper: "border-slate-200/80 bg-white/95",
    title: "text-slate-900",
    text: "text-slate-700",
    subtle: "text-slate-500",
    button: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
  },
  agency: {
    wrapper: "border-violet-500/25 bg-slate-950/65",
    title: "text-white",
    text: "text-slate-200",
    subtle: "text-slate-400",
    button: "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10",
  },
  hq: {
    wrapper: "border-emerald-400/25 bg-emerald-950/45",
    title: "text-white",
    text: "text-emerald-50",
    subtle: "text-emerald-200/75",
    button: "border-white/10 bg-white/5 text-emerald-50 hover:bg-white/10",
  },
};

function statusText(status?: LocalEnvServiceStatus) {
  return serviceStatusLabel(status?.status || "stopped");
}

export default function LocalEnvQuickPanel({ variant }: { variant: Variant }) {
  const tone = panelToneMap[variant];
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [starting, setStarting] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const { status: localEnvStatus, refreshStatus: baseRefreshStatus } = useLocalEnvStatus(300000);
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(`${OPEN_KEY}:${variant}`) === "true";
  });

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
          title: "本地环境状态读取失败",
          description: `未能获取 3003 / 8000 / 3004 状态：${message}`,
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
        description: "已发送重启指令，正在重新拉起 3003 / 8000 / 3004。",
      });
      await new Promise((resolve) => window.setTimeout(resolve, 5000));
      await refreshStatus(true);
      toast({
        title: "重启完成",
        description: "前端、后端、网站端状态已重新检查。",
      });
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

  const services = [
    { key: "frontend", label: "前端", value: localEnvStatus?.frontend },
    { key: "backend", label: "后端", value: localEnvStatus?.backend },
    { key: "website", label: "网站端", value: localEnvStatus?.website },
  ];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section className={cn("mt-2 rounded-lg border shadow-sm", tone.wrapper)}>
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-500/15 text-cyan-400">
            <ServerCog className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className={cn("text-xs font-semibold", tone.title)}>本地环境</div>
            <div className={cn("text-[10px]", tone.subtle)}>
              前端 {statusText(localEnvStatus?.frontend)} / 后端 {statusText(localEnvStatus?.backend)} / 网站端{" "}
              {statusText(localEnvStatus?.website)}
            </div>
          </div>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition",
                tone.button
              )}
            >
              {open ? "收起" : "展开"}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="border-t border-white/10">
          <div className="space-y-2 px-3 pb-2.5 pt-2">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void refreshStatus()}
                disabled={loadingStatus || starting || restarting}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition",
                  tone.button
                )}
                title="刷新状态"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loadingStatus && "animate-spin")} />
                刷新
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-md border border-white/10 bg-black/10 px-2.5 py-2">
                <div className={cn("text-[10px]", tone.subtle)}>状态</div>
                <div className="mt-1 space-y-1">
                  {services.map((service) => (
                    <div key={service.key} className="flex items-center justify-between gap-2">
                      <span className={cn("text-[11px]", tone.text)}>
                        {service.label} {service.value?.port || "-"}
                      </span>
                      <span className={cn("text-[11px] font-semibold", serviceStatusTone(service.value?.status || "stopped"))}>
                        {statusText(service.value)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className={cn("mt-2 text-[10px]", tone.subtle)}>
                  最近检查：{formatLocalEnvTime(localEnvStatus?.checkedAt) || "暂无"}
                </div>
              </div>

              <div className="grid grid-rows-2 gap-2">
                <button
                  type="button"
                  onClick={() => void handleStart()}
                  disabled={starting || restarting}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-2 text-[11px] font-semibold text-cyan-600 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-70"
                  title="启动本地环境"
                >
                  {starting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
                  启动
                </button>
                <button
                  type="button"
                  onClick={() => void handleRestart()}
                  disabled={starting || restarting}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-2 text-[11px] font-semibold text-violet-600 transition hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:opacity-70"
                  title="重启本地环境"
                >
                  {restarting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  重启
                </button>
              </div>
            </div>
            <div className={cn("rounded-md border border-white/10 bg-black/10 px-2.5 py-2 text-[10px] leading-5", tone.subtle)}>
              <span className={cn("font-semibold", tone.text)}>已学习的恢复规则：</span>
              后端 8000 若因 Windows 本地套接字异常退出，开发启动器会在 1 秒后自动拉起；若仍持续异常，请先查看状态，再执行重启。
            </div>
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
