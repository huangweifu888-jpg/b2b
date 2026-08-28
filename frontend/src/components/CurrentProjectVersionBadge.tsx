import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Layers3 } from "lucide-react";

import { resolveSiteDisplayName } from "@/lib/site-display-name";
import { formatDisplayOrdinal } from "@/lib/display-number-contract";
import { formatSiteVersionId, getCurrentSiteProjectVersion, getLatestSiteProjectVersion } from "@/lib/site-project-version";
import { getSiteSequenceMap, getVisibleSitesByScope, resolveCurrentSiteId } from "@/lib/sites";

type ProjectScope = "client" | "agency" | "hq";

function resolveScope(pathname: string): ProjectScope | null {
  if (pathname.startsWith("/zb/kh")) return "hq";
  if (pathname.startsWith("/dl/kh")) return "agency";
  if (pathname.startsWith("/zb") || pathname.startsWith("/dl")) return null;
  return "client";
}

function resolveCurrentVersion(pathname: string, search: string) {
  const scope = resolveScope(pathname);
  if (!scope) return null;

  const siteId = resolveCurrentSiteId(scope, search);
  const scopedSites = getVisibleSitesByScope(scope, siteId);
  const activeSite = (siteId && scopedSites.find((site) => site.id === siteId)) || scopedSites[0] || null;
  if (!activeSite) return null;

  const sequenceMap = getSiteSequenceMap(scope, scopedSites);

  return {
    siteId: activeSite.id,
    siteName: resolveSiteDisplayName(activeSite, activeSite.planCode || activeSite.id),
    sequenceNumber: sequenceMap.get(activeSite.id) || 1,
    versionId: formatSiteVersionId(
      getCurrentSiteProjectVersion(activeSite.id)?.id || getLatestSiteProjectVersion(activeSite.id)?.id || "J1"
    ),
  };
}

export default function CurrentProjectVersionBadge({
  tone = "light",
}: {
  tone?: "light" | "dark";
}) {
  const location = useLocation();
  const [tick, setTick] = useState(0);

  useEffect(() => {
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

  const current = useMemo(
    () => resolveCurrentVersion(location.pathname, location.search),
    [location.pathname, location.search, tick]
  );

  if (!current) return null;

  const className =
    tone === "dark"
      ? "inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/10 px-2 py-1 text-white"
      : "inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700";

  const subText = tone === "dark" ? "text-white/65" : "text-slate-500";
  const badgeTone = tone === "dark" ? "bg-white/15 text-white" : "bg-blue-100 text-blue-700";

  return (
    <div className={className} title={`当前独立计划：${current.siteName} 版本 ${current.versionId}`}>
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-blue-600 to-sky-500 text-white">
        <Layers3 className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold leading-tight">项目版本</div>
        <div className={`max-w-[140px] truncate text-[9px] leading-tight ${subText}`}>
          #{formatDisplayOrdinal(current.sequenceNumber)} {current.siteName}
        </div>
      </div>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeTone}`}>{current.versionId}</span>
    </div>
  );
}
