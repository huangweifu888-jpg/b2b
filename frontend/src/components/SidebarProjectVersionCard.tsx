import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import UnifiedActionDialog from "@/components/UnifiedActionDialog";
import { resolveSiteDisplayName } from "@/lib/site-display-name";
import { hasPendingSiteSwitchLoading, startSiteSwitchLoading } from "@/lib/site-switch-loading";
import { fetchAllSitesFromBackend, getSiteSequenceMap, getVisibleSitesByScope, resolveCurrentSiteId } from "@/lib/sites";
import { formatDisplayOrdinal } from "@/lib/display-number-contract";
import { toast } from "@/hooks/use-toast";

type Scope = "client" | "agency" | "hq" | "client_source" | "agency_source";

const STORAGE_KEY = "tradepro.selectedProjectSite";

function scopePrefix(scope: Scope) {
  return `${STORAGE_KEY}:${scope}`;
}

function buildSiteTargetPath(scope: Scope, pathname: string) {
  if (scope === "hq") return pathname.startsWith("/zb/kh") ? pathname : "/zb/kh/product-market";
  if (scope === "agency") return pathname.startsWith("/dl/kh") ? pathname : "/dl/kh/product-market";
  if (scope === "client_source") return pathname.startsWith("/zb/client-source") ? pathname : "/zb/client-source/product-market";
  if (scope === "agency_source") return pathname.startsWith("/zb/agency-source") ? pathname : "/zb/agency-source/product-market";
  return pathname.startsWith("/zb") || pathname.startsWith("/dl") ? "/product-market" : pathname;
}

function getCompactSiteLabel(
  site: { id: string; scope?: Scope; planCode?: string | null; planName?: string | null; name: string; builderState?: Record<string, unknown> },
  sequence: number
) {
  return `#${formatDisplayOrdinal(sequence)} ${resolveSiteDisplayName(site, site.planCode || site.id)}`;
}

export default function SidebarProjectVersionCard({
  scope,
  compact = false,
}: {
  scope: Scope;
  showRestoreActions?: boolean;
  compact?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  // Source workspaces configure a shared template, but their sidebar still
  // needs to display and switch the runtime plan that receives that template.
  // Keep this context shared with the corresponding runtime instead of looking
  // for fictitious `client_source` / `agency_source` sites.
  const planScope: Scope = scope === "client_source" ? "client" : scope === "agency_source" ? "agency" : scope;
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

  const routeSiteId = resolveCurrentSiteId(planScope, location.search);
  const storedSiteId = typeof window === "undefined" ? null : window.localStorage.getItem(scopePrefix(planScope));

  const sites = useMemo(() => getVisibleSitesByScope(planScope, routeSiteId || storedSiteId || null), [planScope, tick, routeSiteId, storedSiteId]);
  const sequenceMap = useMemo(() => getSiteSequenceMap(planScope, sites), [planScope, sites]);
  const preferredSiteId = routeSiteId || storedSiteId || null;
  const currentSite = sites.find((site) => site.id === preferredSiteId) || sites[0] || null;
  const currentSiteId = currentSite?.id || null;
  const currentCompanyName = currentSite ? resolveSiteDisplayName(currentSite, currentSite.planCode || currentSite.id) : "站点计划";

  const sortedSites = useMemo(() => {
    return [...sites].sort((a, b) => {
      const aSequence = sequenceMap.get(a.id) || 0;
      const bSequence = sequenceMap.get(b.id) || 0;
      if (aSequence !== bSequence) return bSequence - aSequence;
      const aCurrent = a.id === currentSiteId ? 1 : 0;
      const bCurrent = b.id === currentSiteId ? 1 : 0;
      if (aCurrent !== bCurrent) return bCurrent - aCurrent;
      return a.id.localeCompare(b.id);
    });
  }, [sites, currentSiteId, sequenceMap]);

  useEffect(() => {
    void fetchAllSitesFromBackend().finally(() => {
      setTick((value) => value + 1);
    });

    const refresh = () => setTick((value) => value + 1);
    window.addEventListener("sites-updated", refresh);
    window.addEventListener("site-project-version-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("sites-updated", refresh);
      window.removeEventListener("site-project-version-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!currentSiteId) return;
    window.localStorage.setItem(scopePrefix(planScope), currentSiteId);
  }, [currentSiteId, planScope]);

  useEffect(() => {
    if (!currentSiteId) return;
    if (routeSiteId && routeSiteId === currentSiteId) return;
    if (!routeSiteId && (!storedSiteId || storedSiteId === currentSiteId)) return;
    const params = new URLSearchParams(location.search);
    params.set("siteId", currentSiteId);
    navigate({ pathname: buildSiteTargetPath(scope, location.pathname), search: `?${params.toString()}` }, { replace: true });
  }, [currentSiteId, location.pathname, location.search, navigate, routeSiteId, scope, storedSiteId]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const pickSite = (siteId: string) => {
    if (!siteId) return;
    if (siteId === currentSiteId) {
      setOpen(false);
      return;
    }
    if (hasPendingSiteSwitchLoading()) {
      toast({
        title: "计划切换处理中",
        description: "当前计划正在同步，系统保持最短 5 秒保护，请稍后再切换。",
      });
      return;
    }
    const nextSite = sites.find((site) => site.id === siteId);
    const nextSiteLabel = nextSite ? resolveSiteDisplayName(nextSite, nextSite.planCode || nextSite.id) : siteId;
    setSwitchDialog({
      open: true,
      title: "站点计划切换",
      description: `确定切换到 ${nextSiteLabel} 吗？系统会先执行切换，再保持最少 5 秒稳定读条。`,
      confirmLabel: "确认切换",
      busyLabel: "切换中...",
      onConfirm: () => {
        window.localStorage.setItem(scopePrefix(planScope), siteId);
        const params = new URLSearchParams(location.search);
        params.set("siteId", siteId);
        startSiteSwitchLoading({
          source: "sidebar-plan-switch",
          targetPath: buildSiteTargetPath(scope, location.pathname),
          targetSiteId: siteId,
          companyName: nextSiteLabel,
        });
        navigate({ pathname: buildSiteTargetPath(scope, location.pathname), search: `?${params.toString()}` }, { replace: false });
        setOpen(false);
        setTick((value) => value + 1);
      },
    });
  };

  if (!currentSite) {
    return (
      <div className={compact ? "rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-500" : "mx-2 my-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500"}>
        暂无站点计划
      </div>
    );
  }

  const currentSequence = sequenceMap.get(currentSite.id) || 1;

  return (
    <div ref={containerRef} className={compact ? "relative" : "relative mx-2 my-2"}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={
          compact
            ? "flex h-11 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-left text-[11px] leading-none shadow-sm transition hover:border-blue-200 hover:bg-slate-50"
            : "flex h-auto w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-blue-200 hover:bg-slate-50"
        }
        title={getCompactSiteLabel(currentSite, currentSequence)}
        aria-expanded={open}
      >
        <div className="grid min-w-0 flex-1 grid-cols-[30px_minmax(0,1fr)] items-center gap-2 text-left">
          <div className="flex h-6 w-7 shrink-0 items-center justify-center rounded-md bg-slate-900 text-[10px] font-semibold text-white">
            {formatDisplayOrdinal(currentSequence)}
          </div>
          <div className="min-w-0">
            {compact ? (
              <div className="truncate text-[11px] font-semibold leading-none text-slate-900">{currentCompanyName}</div>
            ) : (
              <>
                <div className="truncate text-[10px] uppercase tracking-[0.18em] text-slate-400">站点计划</div>
                <div className="truncate text-[15px] font-semibold leading-5 text-slate-900">{currentCompanyName}</div>
              </>
            )}
          </div>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open ? (
        <div
          className={
            compact
              ? "absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-md border border-slate-200 bg-white p-1 shadow-lg"
              : "absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
          }
        >
          <div className="max-h-80 overflow-y-auto">
            {sortedSites.map((site) => {
              const sequence = sequenceMap.get(site.id) || 1;
              const companyName = resolveSiteDisplayName(site, site.planCode || site.id);
              const active = site.id === currentSiteId;

              return (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => pickSite(site.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50"
                >
                  <span className="flex h-6 w-7 shrink-0 items-center justify-center rounded-md bg-slate-900 text-[10px] font-semibold text-white">
                    {sequence}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-900" title={companyName}>
                    {companyName}
                  </span>
                  {active ? <span className="text-[10px] text-slate-400">当前</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <UnifiedActionDialog
        open={switchDialog.open}
        title={switchDialog.title}
        description={switchDialog.description}
        confirmLabel={switchDialog.confirmLabel}
        busyLabel={switchDialog.busyLabel}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSwitchDialog((current) => ({ ...current, open: false, onConfirm: null }));
          }
        }}
        onConfirm={switchDialog.onConfirm}
        showBusyState={false}
      />
    </div>
  );
}
