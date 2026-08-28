import { useCallback, useMemo, useState } from "react";
import { Check, Crown, Home, Settings, Sparkles } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import ExternalDevtoolsMenu from "./ExternalDevtoolsMenu";

import UnifiedActionDialog from "@/components/UnifiedActionDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { appendSiteIdToPath } from "@/lib/site-admin";
import { resolveCurrentSiteId } from "@/lib/sites";
import { cn } from "@/lib/utils";

type PlatformKey = "client" | "agency" | "hq" | "client_source" | "agency_source";
type PlatformSwitcherMode = "auto" | "source" | "runtime";
type PlatformItem = {
  key: PlatformKey;
  to: string;
  label: string;
  description: string;
  icon: typeof Home;
  gradient: string;
};

const runtimePlatforms: PlatformItem[] = [
  {
    key: "hq",
    to: "/zb",
    label: "总部端",
    description: "总部开发与平台控制",
    icon: Crown,
    gradient: "from-cyan-500 to-emerald-500",
  },
  {
    key: "agency",
    to: "/dl",
    label: "代理端",
    description: "客户与项目管理",
    icon: Sparkles,
    gradient: "from-violet-500 to-fuchsia-500",
  },
  {
    key: "client",
    to: "/kh",
    label: "客户端",
    description: "企业独立站后台",
    icon: Home,
    gradient: "from-blue-500 to-sky-500",
  },
];

const sourcePlatforms: PlatformItem[] = [
  {
    key: "hq",
    to: "/zb",
    label: "总部端",
    description: "总部开发与平台控制",
    icon: Crown,
    gradient: "from-cyan-500 to-emerald-500",
  },
  {
    key: "agency_source",
    to: "/zb/agency-source",
    label: "代理源",
    description: "代理端模板源，供下游手动同步与恢复",
    icon: Sparkles,
    gradient: "from-violet-500 to-fuchsia-500",
  },
  {
    key: "client_source",
    to: "/zb/client-source",
    label: "客户源",
    description: "客户端模板源，供下游手动同步与恢复",
    icon: Home,
    gradient: "from-blue-500 to-sky-500",
  },
  {
    key: "agency",
    to: "/dl",
    label: "代理端",
    description: "代理商日常经营与客户管理实体端",
    icon: Sparkles,
    gradient: "from-violet-500 to-fuchsia-500",
  },
  {
    key: "client",
    to: "/kh",
    label: "客户端",
    description: "企业独立站运营与计划管理实体端",
    icon: Home,
    gradient: "from-blue-500 to-sky-500",
  },
];

function getCurrentPlatform(pathname: string): PlatformKey {
  if (pathname.startsWith("/zb/client-source")) return "client_source";
  if (pathname.startsWith("/zb/agency-source")) return "agency_source";
  if (pathname.startsWith("/zb")) return "hq";
  if (pathname.startsWith("/dl")) return "agency";
  return "client";
}

export default function PlatformSettingsDropdown({
  compact = false,
  variant = "dark",
  mode = "auto",
  showDevtools = true,
  className,
}: {
  compact?: boolean;
  variant?: "light" | "dark";
  mode?: PlatformSwitcherMode;
  showDevtools?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentKey = getCurrentPlatform(location.pathname);
  const resolvedMode: Exclude<PlatformSwitcherMode, "auto"> =
    mode === "auto" ? (currentKey === "client_source" || currentKey === "agency_source" ? "source" : "runtime") : mode;
  const platformItems = resolvedMode === "source" ? sourcePlatforms : runtimePlatforms;
  // Source workspaces now own the complete source-to-runtime switcher.  This
  // keeps template editing and its corresponding entity entry together.
  const activePlatformKey: PlatformKey = resolvedMode === "runtime"
    ? (currentKey === "agency_source" ? "agency" : currentKey === "client_source" ? "client" : currentKey)
    : currentKey;
  const [switchDialog, setSwitchDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    busyLabel: string;
    onConfirm: null | (() => Promise<void> | void);
  }>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "确认切换",
    busyLabel: "切换中...",
    onConfirm: null,
  });

  const current = useMemo(() => {
    if (resolvedMode === "source" && currentKey === "client_source") {
      return {
        key: "client_source" as const,
        to: "/zb/client-source",
        label: "客户源",
        description: "客户端模板源，供下游手动同步与恢复",
        icon: Home,
        gradient: "from-blue-500 to-sky-500",
      };
    }

    if (resolvedMode === "source" && currentKey === "agency_source") {
      return {
        key: "agency_source" as const,
        to: "/zb/agency-source",
        label: "代理源",
        description: "代理端模板源，供下游手动同步与恢复",
        icon: Sparkles,
        gradient: "from-violet-500 to-fuchsia-500",
      };
    }

    return platformItems.find((item) => item.key === activePlatformKey) ?? platformItems[0];
  }, [activePlatformKey, currentKey, platformItems, resolvedMode]);

  const CurrentIcon = current.icon;
  const siteScope =
    currentKey === "client_source" ? "client" : currentKey === "agency_source" ? "agency" : currentKey;
  const currentSiteId = useMemo(
    () => resolveCurrentSiteId(siteScope, location.search),
    [location.search, siteScope]
  );
  const withCurrentSite = useCallback(
    (path: string) => appendSiteIdToPath(path, currentSiteId),
    [currentSiteId]
  );

  const openPlatformSwitchDialog = useCallback(
    (targetLabel: string, targetPath: string) => {
      setSwitchDialog({
        open: true,
        title: "平台切换",
        description: `确定切换到 ${targetLabel} 吗？系统会先执行切换，再保持最少 5 秒稳定读条。`,
        confirmLabel: "确认切换",
        busyLabel: "切换中...",
        onConfirm: () => {
          navigate(withCurrentSite(targetPath));
        },
      });
    },
    [navigate, withCurrentSite]
  );

  const triggerTone =
    variant === "dark"
      ? "border-white/10 bg-white/5 text-white hover:bg-white/10"
      : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50";
  const subText = variant === "dark" ? "text-slate-400" : "text-slate-500";
  const switcherLabel = resolvedMode === "source" ? "源体切换（含实体端）" : "实体端切换";

  return (
    <>
      <div data-platform-switcher data-platform-switcher-mode={resolvedMode} className={cn("space-y-2", className)}>
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex h-11 w-full items-center gap-2 rounded-md border px-2.5 text-left transition-colors",
              compact && "justify-center px-0",
              triggerTone
            )}
            title={switcherLabel}
          >
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-r text-white",
                current.gradient
              )}
            >
              <CurrentIcon className="h-4 w-4" />
            </div>
            {!compact ? (
              <div className="min-w-0 flex-1 truncate text-[11px] font-semibold leading-none">{current.label}</div>
            ) : null}
            {!compact ? <Settings className={cn("h-3.5 w-3.5 shrink-0", subText)} /> : null}
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" side="right" className="w-80">
            <DropdownMenuLabel className="text-xs text-slate-500">
              {switcherLabel}
            </DropdownMenuLabel>
            {platformItems.map((platform, index) => {
              const Icon = platform.icon;
              const active = platform.key === activePlatformKey;

              return (
                <div key={platform.key}>
                  {resolvedMode === "source" && index === 3 ? (
                    <>
                      <DropdownMenuSeparator className="my-2" />
                      <DropdownMenuLabel className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-600">
                        实体端
                      </DropdownMenuLabel>
                    </>
                  ) : null}
                  <DropdownMenuItem
                    onClick={() => openPlatformSwitchDialog(platform.label, platform.to)}
                    className="gap-2"
                  >
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-r text-white",
                        platform.gradient
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{platform.label}</div>
                      <div className="text-[10px] text-slate-500">{platform.description}</div>
                    </div>
                    {active ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : null}
                  </DropdownMenuItem>
                </div>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {showDevtools ? <ExternalDevtoolsMenu compact={compact} variant={variant} /> : null}
      </div>

      <UnifiedActionDialog
        open={switchDialog.open}
        title={switchDialog.title}
        description={switchDialog.description}
        confirmLabel={switchDialog.confirmLabel}
        busyLabel={switchDialog.busyLabel}
        onOpenChange={(open) => {
          if (!open) {
            setSwitchDialog((current) => ({ ...current, open: false, onConfirm: null }));
          }
        }}
        onConfirm={switchDialog.onConfirm}
        minimumBusyMs={3000}
      />
    </>
  );
}
