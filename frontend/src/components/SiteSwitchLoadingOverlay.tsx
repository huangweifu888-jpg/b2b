import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useLocation } from "react-router-dom";

import { Progress } from "@/components/ui/progress";
import { useProductMarketStore, type LayoutCustomStyle } from "@/lib/product-market-store";
import { PRODUCT_MARKET_SHARED_STYLE_EVENT } from "@/lib/product-market-shared-style";
import { readClientPlanProductMarketConfig } from "@/lib/product-market-config";
import {
  clearSiteSwitchLoading,
  getSiteSwitchLoadingRemaining,
  matchSiteSwitchLoading,
  SITE_SWITCH_LOADING_EVENT_NAME,
  SITE_SWITCH_LOADING_MAX_MS,
  SITE_SWITCH_LOADING_MIN_MS,
  SITE_SWITCH_LOADING_STORAGE_KEY,
  type SiteSwitchLoadingEntry,
} from "@/lib/site-switch-loading";
import { resolveCurrentSiteId } from "@/lib/sites";
import { SHARED_WINDOW_CONTRACT_VERSION, SHARED_WINDOW_FACTORY_DEFAULT } from "@/lib/shared-window-contract";

type OverlayScope = "client" | "agency" | "hq" | "client_source" | "agency_source";

function resolveOverlayScope(pathname: string): OverlayScope {
  if (pathname.startsWith("/zb/client-source")) return "client_source";
  if (pathname.startsWith("/zb/agency-source")) return "agency_source";
  if (pathname.startsWith("/dl/kh")) return "agency";
  if (pathname.startsWith("/zb/kh")) return "hq";
  if (pathname.startsWith("/dl")) return "agency";
  if (pathname.startsWith("/zb")) return "hq";
  return "client";
}

function buildSwitchMessage(entry: SiteSwitchLoadingEntry | null) {
  if (!entry) return "\u6b63\u5728\u540c\u6b65\u5f53\u524d\u7ad9\u70b9\u8ba1\u5212\u9875\u9762\uff0c\u8bf7\u7a0d\u5019\u3002";
  if (entry.source === "theme-live-switch") {
    const label = entry.themeDisplayName?.trim() || entry.companyName?.trim() || "\u5f53\u524d\u4e3b\u9898";
    return `\u6b63\u5728\u5207\u6362\u5230 ${label}\uff0c\u7cfb\u7edf\u6b63\u5728\u540c\u6b65\u5f53\u524d\u8ba1\u5212\u7684\u7248\u9762\u98ce\u683c\u4e0e\u53f3\u4fa7\u9884\u89c8\u6570\u636e\u3002`;
  }
  const label = entry.companyName?.trim() || "\u5f53\u524d\u7ad9\u70b9\u8ba1\u5212";
  return `\u6b63\u5728\u5207\u6362\u5230 ${label}\uff0c\u7cfb\u7edf\u6b63\u5728\u540c\u6b65\u5bf9\u5e94\u540e\u53f0\u4e0e\u6c99\u76d8\u6570\u636e\u3002`;
}

function readClientConfig(siteId?: string | null) {
  return readClientPlanProductMarketConfig(siteId);
}

function withAlpha(color: string | undefined, alphaHex: string) {
  if (!color) return `#ffffff${alphaHex}`;
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return `${trimmed}${alphaHex}`;
  return trimmed;
}

function hasMeaningfulPageContent() {
  if (typeof document === "undefined") return false;
  const bodyText = document.body?.textContent?.replace(/\s+/g, " ").trim() || "";
  if (!bodyText) return false;

  const blockingKeywords = [
    "\u9875\u9762\u6b63\u5728\u52a0\u8f7d",
    "\u6b63\u5728\u52a0\u8f7d\u9875\u9762\u6a21\u5757",
    "\u91cd\u8bd5\u52a0\u8f7d",
  ];
  if (blockingKeywords.some((keyword) => bodyText.includes(keyword))) {
    return false;
  }

  const appShell =
    document.querySelector("main") ||
    document.querySelector("[data-nav-tailbar]") ||
    document.querySelector("[data-sidebar-shell]") ||
    document.querySelector("[data-topbar-surface]") ||
    document.querySelector("aside");

  return Boolean(appShell) || bodyText.length > 40;
}

export default function SiteSwitchLoadingOverlay() {
  const location = useLocation();
  const currentScope = useMemo(() => resolveOverlayScope(location.pathname), [location.pathname]);
  const currentSiteId = useMemo(() => resolveCurrentSiteId(currentScope, location.search), [currentScope, location.search]);
  const [entry, setEntry] = useState<SiteSwitchLoadingEntry | null>(null);
  const [progress, setProgress] = useState(0);
  const [effectiveLayoutStyle, setEffectiveLayoutStyle] = useState<LayoutCustomStyle | null>(null);
  const { layoutStyle, activeTheme } = useProductMarketStore();
  const tickTimerRef = useRef<number | null>(null);
  const activeEntryRef = useRef<SiteSwitchLoadingEntry | null>(null);

  useEffect(() => {
    const refreshConfig = () => {
      const nextConfig = readClientConfig(currentSiteId);
      if (nextConfig) {
        setEffectiveLayoutStyle(nextConfig.layoutStyle);
      }
    };

    refreshConfig();
    window.addEventListener(PRODUCT_MARKET_SHARED_STYLE_EVENT, refreshConfig);
    return () => {
      window.removeEventListener(PRODUCT_MARKET_SHARED_STYLE_EVENT, refreshConfig);
    };
  }, [currentSiteId]);

  useEffect(() => {
    const stopTicking = () => {
      if (tickTimerRef.current !== null) {
        window.clearTimeout(tickTimerRef.current);
        tickTimerRef.current = null;
      }
    };

    const clearOverlayState = () => {
      stopTicking();
      activeEntryRef.current = null;
      setEntry(null);
      setProgress(0);
    };

    const isPageReadyForTarget = (matched: SiteSwitchLoadingEntry) => {
      if (typeof window === "undefined") return false;

      if (matched.source === "theme-live-switch") {
        const targetThemeKey = matched.targetThemeKey?.trim();
        if (!targetThemeKey) return false;
        return String(activeTheme || "").trim() === targetThemeKey;
      }

      const expectedSiteId = currentSiteId?.trim();
      const searchSiteId = resolveCurrentSiteId(currentScope, window.location.search)?.trim() || "";
      if (expectedSiteId) {
        if (searchSiteId !== expectedSiteId) return false;
      } else if (matched.targetSiteId?.trim()) {
        return false;
      }
      if (window.location.pathname !== location.pathname) return false;

      return hasMeaningfulPageContent();
    };

    function updateOverlay(matched: SiteSwitchLoadingEntry) {
      if (Date.now() - matched.startedAt > SITE_SWITCH_LOADING_MAX_MS) {
        activeEntryRef.current = null;
        stopTicking();
        clearSiteSwitchLoading();
        setEntry(null);
        setProgress(0);
        return;
      }
      const remaining = getSiteSwitchLoadingRemaining(matched);
      const pageReady = isPageReadyForTarget(matched);
      if (remaining <= 0 && pageReady) {
        activeEntryRef.current = null;
        stopTicking();
        clearSiteSwitchLoading();
        setEntry(null);
        setProgress(100);
        return;
      }

      activeEntryRef.current = matched;
      setEntry(matched);
      setProgress(
        remaining <= 0
          ? 100
          : Math.max(8, Math.min(100, ((SITE_SWITCH_LOADING_MIN_MS - remaining) / SITE_SWITCH_LOADING_MIN_MS) * 100))
      );
      scheduleTick();
    }

    function tickOverlay() {
      tickTimerRef.current = null;
      const matched = activeEntryRef.current;
      if (!matched) return;
      updateOverlay(matched);
    }

    function scheduleTick() {
      stopTicking();
      if (!activeEntryRef.current || document.visibilityState === "hidden") return;
      tickTimerRef.current = window.setTimeout(tickOverlay, 200);
    }

    const syncOverlay = () => {
      const matched = matchSiteSwitchLoading(location.pathname, currentSiteId);
      if (!matched) {
        clearOverlayState();
        return;
      }
      updateOverlay(matched);
    };

    const syncFromStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) return;
      if (event.key !== null && event.key !== SITE_SWITCH_LOADING_STORAGE_KEY) return;
      syncOverlay();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopTicking();
        return;
      }
      syncOverlay();
    };

    syncOverlay();
    window.addEventListener(SITE_SWITCH_LOADING_EVENT_NAME, syncOverlay);
    window.addEventListener("storage", syncFromStorage);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearOverlayState();
      window.removeEventListener(SITE_SWITCH_LOADING_EVENT_NAME, syncOverlay);
      window.removeEventListener("storage", syncFromStorage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeTheme, currentScope, currentSiteId, location.pathname]);

  if (!entry) return null;

  const activeLayoutStyle = effectiveLayoutStyle || layoutStyle;
  const cardBg = activeLayoutStyle.siteSwitchLoadingCardBgColor || activeLayoutStyle.themePanelBgColor || "#ffffff";
  const textColor = activeLayoutStyle.siteSwitchLoadingCardTextColor || activeLayoutStyle.themePanelTextColor || "#0f172a";
  const accentColor = activeLayoutStyle.themePanelButtonColor || "#2563eb";

  return (
    <div
      data-shared-dialog-contract="site-switch-loading"
      data-shared-window-contract={SHARED_WINDOW_CONTRACT_VERSION}
      data-shared-window-factory-default={SHARED_WINDOW_FACTORY_DEFAULT.id}
      data-shared-window-kind="loading"
      data-shared-window-region="frame"
      data-shared-window-theme-projection="active-page"
      className="fixed inset-0 z-[90] flex cursor-wait items-center justify-center bg-slate-950/10 px-4"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 p-4 shadow-none"
        data-site-switch-loading-card
        data-shared-window-region="content"
        style={{ backgroundColor: withAlpha(cardBg, "f5") }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ backgroundColor: withAlpha(accentColor, "22"), color: accentColor }}
          >
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold" style={{ color: textColor }}>
              {entry.source === "theme-live-switch" ? "\u7248\u9762\u98ce\u683c\u5207\u6362\u4e2d" : "\u7ad9\u70b9\u8ba1\u5212\u5207\u6362\u4e2d"}
            </div>
            <div className="mt-1 text-xs leading-5" style={{ color: withAlpha(textColor, "cc") }}>
              {buildSwitchMessage(entry)}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100">
            <Progress value={progress} className="absolute inset-0 h-2.5 w-full bg-transparent" />
            <div
              className="pointer-events-none absolute inset-y-0 left-0 rounded-full transition-[width] duration-150"
              style={{ width: `${progress}%`, backgroundColor: accentColor }}
            />
          </div>
          <div className="mt-2 text-right text-[11px]" style={{ color: withAlpha(textColor, "99") }}>
            {"\u6700\u77ed\u4fdd\u62a4 5 \u79d2\uff0c\u907f\u514d\u8fde\u7eed\u5207\u6362\u4e92\u4e32"}
          </div>
        </div>
      </div>
    </div>
  );
}
