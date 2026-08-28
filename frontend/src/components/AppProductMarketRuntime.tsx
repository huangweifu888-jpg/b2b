import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import {
  bootstrapProductMarketVersionBackups,
  buildVersionStorageKey,
  createProductMarketVersion,
} from "@/lib/product-market-version";
import { bootstrapSiteProjectVersionBackups } from "@/lib/site-project-version";
import { currentProductMarketConfigKey, readStoredProductMarketConfig } from "@/lib/product-market-config";
import { DEFAULT_DESIGN_FONT_STACK, useProductMarketStore } from "@/lib/product-market-store";
import { applyGlobalThemeTokens, resolveGlobalThemeTokens } from "@/lib/global-theme-tokens";
import { applyPageCssProfiles, PAGE_CSS_PROFILE_EVENT } from "@/lib/page-layout-overrides";
import { PAGE_LAYOUT_LOCK_EVENT } from "@/lib/page-layout-lock";
import { safeSetLocalStorage } from "@/lib/storage-guards";
import {
  HQ_SOFTWARE_UPDATE_CREATED_AT,
  HQ_SOFTWARE_UPDATE_ID,
  HQ_SOFTWARE_UPDATE_SUMMARY,
  HQ_SOFTWARE_UPDATE_TITLE,
  HQ_SOFTWARE_VERSION,
} from "@/lib/software-version";

const HQ_SOFTWARE_UPDATE_MARKER_KEY = "tradepro.hqSoftwareUpdateMarkers";

type IdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function useIdleTask(task: () => void, delay = 6000) {
  const taskRef = useRef(task);
  useEffect(() => {
    taskRef.current = task;
  }, [task]);
  useEffect(() => {
    const idleWindow = window as IdleWindow;
    let idleHandle: number | undefined;
    let fallbackHandle: number | undefined;
    let delayElapsed = false;
    let scheduled = false;

    const scheduleInBackground = () => {
      if (scheduled || document.visibilityState !== "visible") return;
      scheduled = true;
      if (idleWindow.requestIdleCallback) {
        idleHandle = idleWindow.requestIdleCallback(() => taskRef.current(), { timeout: 3000 });
        return;
      }
      fallbackHandle = window.setTimeout(() => taskRef.current(), 600);
    };

    const delayHandle = window.setTimeout(() => {
      delayElapsed = true;
      scheduleInBackground();
    }, delay);
    const onVisibilityChange = () => {
      if (delayElapsed) scheduleInBackground();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearTimeout(delayHandle);
      if (fallbackHandle !== undefined) window.clearTimeout(fallbackHandle);
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [delay]);
}

function HQSoftwareVersionRecorder() {
  useIdleTask(() => {
    const markers = JSON.parse(localStorage.getItem(HQ_SOFTWARE_UPDATE_MARKER_KEY) || "[]") as string[];
    const currentConfig =
      readStoredProductMarketConfig(currentProductMarketConfigKey("hq")) ||
      readStoredProductMarketConfig(currentProductMarketConfigKey("client")) ||
      useProductMarketStore.getState().exportConfig();
    createProductMarketVersion("hq", currentConfig, {
      force: true,
      fixedId: HQ_SOFTWARE_VERSION,
      createdAt: HQ_SOFTWARE_UPDATE_CREATED_AT,
      source: "hq-software-update",
      title: HQ_SOFTWARE_UPDATE_TITLE,
      summary: HQ_SOFTWARE_UPDATE_SUMMARY,
    });
    safeSetLocalStorage(buildVersionStorageKey("hq"), HQ_SOFTWARE_VERSION);
    safeSetLocalStorage("tradepro.buildVersion", HQ_SOFTWARE_VERSION);
    window.dispatchEvent(new CustomEvent("product-market-version-updated", { detail: { scope: "hq", version: HQ_SOFTWARE_VERSION } }));
    if (markers.includes(HQ_SOFTWARE_UPDATE_ID)) return;
    safeSetLocalStorage(HQ_SOFTWARE_UPDATE_MARKER_KEY, JSON.stringify([HQ_SOFTWARE_UPDATE_ID, ...markers].slice(0, 20)));
  });
  return null;
}

function VersionBackupBootstrap() {
  useIdleTask(() => {
    void bootstrapProductMarketVersionBackups();
    void bootstrapSiteProjectVersionBackups();
  }, 10_000);
  return null;
}

export default function AppProductMarketRuntime() {
  const location = useLocation();
  const {
    layoutStyle,
    sidebarStyle,
    globalFontFamily,
    globalFontWeight,
    globalLetterSpacing,
  } = useProductMarketStore(useShallow((state) => ({
    layoutStyle: state.layoutStyle,
    sidebarStyle: state.sidebarStyle,
    globalFontFamily: state.globalFontFamily,
    globalFontWeight: state.globalFontWeight,
    globalLetterSpacing: state.globalLetterSpacing,
  })));
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--tradepro-global-font-family", globalFontFamily || DEFAULT_DESIGN_FONT_STACK);
    root.style.setProperty("--tradepro-global-font-weight", globalFontWeight || "400");
    root.style.setProperty("--tradepro-global-letter-spacing", globalLetterSpacing || "0.02em");
    applyGlobalThemeTokens(root, resolveGlobalThemeTokens(layoutStyle, sidebarStyle));
  }, [globalFontFamily, globalFontWeight, globalLetterSpacing, layoutStyle, sidebarStyle]);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener(PAGE_CSS_PROFILE_EVENT, refresh);
    window.addEventListener(PAGE_LAYOUT_LOCK_EVENT, refresh);
    return () => {
      window.removeEventListener(PAGE_CSS_PROFILE_EVENT, refresh);
      window.removeEventListener(PAGE_LAYOUT_LOCK_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    applyPageCssProfiles(location.pathname, location.search, {
      "--tradepro-global-font-family": globalFontFamily || "system-ui, sans-serif",
      "--tradepro-global-font-weight": globalFontWeight || "400",
      "--tradepro-global-letter-spacing": globalLetterSpacing || "0.02em",
      ...resolveGlobalThemeTokens(layoutStyle, sidebarStyle),
      "--tradepro-page-body-size": "1rem",
      "--tradepro-page-note-size": "0.8125rem",
      "--tradepro-page-title-size": "1.25rem",
      "--tradepro-page-title-note-size": "0.875rem",
      "--tradepro-page-columns": "4",
      "--tradepro-page-card-gap": "1.25rem",
      "--tradepro-page-radius": "0.75rem",
      "--tradepro-page-frame-radius": "1.5rem",
      "--tradepro-page-frame-gutter": "0px",
      "--tradepro-page-title-to-body-gap": "0.75rem",
      "--tradepro-page-list-style": "hybrid",
    });
  }, [globalFontFamily, globalFontWeight, globalLetterSpacing, layoutStyle, location.pathname, location.search, revision, sidebarStyle]);

  return (
    <>
      <HQSoftwareVersionRecorder />
      <VersionBackupBootstrap />
    </>
  );
}
