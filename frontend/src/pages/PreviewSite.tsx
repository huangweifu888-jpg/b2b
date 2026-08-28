import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Edit3, ExternalLink, Eye, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fetchSiteFromBackend, getSiteBySlug, getSitePublicUrl, saveSite, type PublishedSite } from "@/lib/sites";
import { ensureLocalEnvReady } from "@/lib/local-dev";
import { FactoryPage } from "@/page-factory/FactoryPage";

function getPreviewTitle(site: PublishedSite) {
  const builderState =
    site.builderState && typeof site.builderState === "object"
      ? (site.builderState as Record<string, unknown>)
      : null;
  const homepageTitle =
    builderState && typeof builderState.homepageTitle === "string" ? builderState.homepageTitle.trim() : "";
  const brandName =
    builderState && typeof builderState.brandName === "string" ? builderState.brandName.trim() : "";
  return homepageTitle || brandName || site.name;
}

function getEditorRoute(site: PublishedSite | null) {
  const scope = site?.scope || "client";
  if (scope === "hq") return "/zb/kh/ai-chat";
  if (scope === "agency") return "/dl/kh/ai-chat";
  return "/kh/ai-chat";
}

function getProjectsRoute(site: PublishedSite | null) {
  const scope = site?.scope || "client";
  if (scope === "hq") return "/zb/kh/projects";
  if (scope === "agency") return "/dl/kh/projects";
  return "/kh/projects";
}

export default function PreviewSite() {
  const { slug } = useParams<{ slug: string }>();
  const [site, setSite] = useState<PublishedSite | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [frameState, setFrameState] = useState<"loading" | "ready" | "error">("loading");
  const [frameMessage, setFrameMessage] = useState("\u6b63\u5728\u542f\u52a8\u672c\u5730\u9884\u89c8\u2026");
  const frameTimeoutRef = useRef<number | null>(null);
  const frameRetryCountRef = useRef(0);

  const retryPreviewWithEnvCheck = useCallback(async (loadingMessage: string, fallbackMessage: string) => {
    try {
      const localEnvStatus = await ensureLocalEnvReady();
      if (!localEnvStatus?.ok) {
        setFrameState("error");
        setFrameMessage("\u672c\u5730\u73af\u5883\u672a\u5c31\u7eea\uff0c\u5f53\u524d\u9884\u89c8\u6682\u65f6\u65e0\u6cd5\u542f\u52a8\u3002");
        return false;
      }
    } catch {
      setFrameState("error");
      setFrameMessage("\u672c\u5730\u73af\u5883\u68c0\u67e5\u5931\u8d25\uff0c\u5f53\u524d\u9884\u89c8\u6682\u65f6\u65e0\u6cd5\u542f\u52a8\u3002");
      return false;
    }

    if (frameRetryCountRef.current < 1) {
      frameRetryCountRef.current += 1;
      setFrameState("loading");
      setFrameMessage(loadingMessage);
      setRefreshTick((value) => value + 1);
      return true;
    }

    setFrameState("error");
    setFrameMessage(fallbackMessage);
    return false;
  }, []);

  useEffect(() => {
    const refresh = () => setRefreshTick((value) => value + 1);
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
    let cancelled = false;

    const loadSite = async () => {
      if (!slug) {
        if (!cancelled) setNotFound(true);
        return;
      }

      const found = getSiteBySlug(slug);
      if (found) {
        if (!cancelled) {
          setSite(found);
          setNotFound(false);
          setFrameState("loading");
          setFrameMessage("\u6b63\u5728\u542f\u52a8\u672c\u5730\u9884\u89c8\u2026");
          document.title = getPreviewTitle(found);
        }
        return;
      }

      const backendSite = await fetchSiteFromBackend(slug);
      if (backendSite) {
        saveSite(backendSite);
        if (!cancelled) {
          setSite(backendSite);
          setNotFound(false);
          setFrameState("loading");
          setFrameMessage("\u6b63\u5728\u542f\u52a8\u672c\u5730\u9884\u89c8\u2026");
          document.title = getPreviewTitle(backendSite);
        }
        return;
      }

      if (!cancelled) setNotFound(true);
    };

    void loadSite();
    return () => {
      cancelled = true;
    };
  }, [slug, refreshTick]);

  useEffect(() => {
    if (frameTimeoutRef.current) {
      window.clearTimeout(frameTimeoutRef.current);
      frameTimeoutRef.current = null;
    }
    if (!site?.id) return;

    frameTimeoutRef.current = window.setTimeout(() => {
      void retryPreviewWithEnvCheck(
        "\u5f53\u524d\u9884\u89c8\u542f\u52a8\u7a0d\u6162\uff0c\u7cfb\u7edf\u6b63\u5728\u81ea\u52a8\u91cd\u8bd5\u4e00\u6b21\u3002",
        "\u5f53\u524d\u9884\u89c8\u5185\u5bb9\u4e3a\u7a7a\uff0c\u8bf7\u56de\u5230\u7f16\u8f91\u5668\u5237\u65b0\u6c99\u76d8\u540e\u518d\u8bd5\u3002"
      );
    }, 9000);

    return () => {
      if (frameTimeoutRef.current) {
        window.clearTimeout(frameTimeoutRef.current);
        frameTimeoutRef.current = null;
      }
    };
  }, [retryPreviewWithEnvCheck, site?.id, site?.updatedAt]);

  const previewTitle = useMemo(() => (site ? getPreviewTitle(site) : ""), [site]);
  const editRoute = useMemo(() => getEditorRoute(site), [site]);
  const projectsRoute = useMemo(() => getProjectsRoute(site), [site]);
  const publicUrl = useMemo(() => (site ? getSitePublicUrl(site) : ""), [site]);

  const reloadPreview = () => {
    frameRetryCountRef.current = 0;
    setFrameState("loading");
    setFrameMessage("\u6b63\u5728\u91cd\u65b0\u542f\u52a8\u672c\u5730\u9884\u89c8\u2026");
    setRefreshTick((value) => value + 1);
  };

  if (notFound) {
    return (
      <FactoryPage pageId="client-preview-site" template="reference" sourceScope="client_source" autoRegions>
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-amber-500" />
            <h1 className="text-xl font-semibold text-slate-900">{"\u9884\u89c8\u672a\u627e\u5230"}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {"\u5f53\u524d\u8def\u5f84"}
              <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">/sites/{slug}</code>
              {"\u6ca1\u6709\u5bf9\u5e94\u7684\u7ad9\u70b9\u5185\u5bb9\uff0c\u8bf7\u8fd4\u56de\u8ba1\u5212\u5217\u8868\u6216\u7f16\u8f91\u5668\u91cd\u65b0\u53d1\u5e03\u3002"}
            </p>
            <Link to={projectsRoute}>
              <Button className="mt-6 bg-blue-600 hover:bg-blue-700">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {"\u8fd4\u56de\u8ba1\u5212\u5217\u8868"}
              </Button>
            </Link>
          </div>
        </div>
      </div>
      </FactoryPage>
    );
  }

  if (!site) {
    return (
      <FactoryPage pageId="client-preview-site" template="reference" sourceScope="client_source" autoRegions>
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          {"\u6b63\u5728\u542f\u52a8\u672c\u5730\u9884\u89c8\u2026"}
        </div>
      </div>
      </FactoryPage>
    );
  }

  return (
    <FactoryPage pageId="client-preview-site" template="reference" sourceScope="client_source" autoRegions>
    <div className="relative min-h-screen bg-white">
      {showToolbar ? (
        <div className="fixed right-3 top-3 z-[9999] flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
          <span
            className={`h-2 w-2 rounded-full ${
              frameState === "ready"
                ? "bg-emerald-500"
                : frameState === "error"
                  ? "bg-amber-500"
                  : "animate-pulse bg-blue-500"
            }`}
          />
          <div className="flex flex-col leading-tight">
            <span className="text-slate-500">{"\u7ad9\u70b9\uff1a"}{site.name}</span>
            <span className="font-medium text-slate-700">{"\u6807\u9898\uff1a"}{previewTitle}</span>
          </div>
          <span className="text-slate-300">|</span>
          <Link to={editRoute} className="flex items-center gap-1 text-blue-600 hover:underline">
            <Edit3 className="h-3 w-3" />
            {"\u7f16\u8f91"}
          </Link>
          <Link to={projectsRoute} className="flex items-center gap-1 text-slate-500 hover:text-slate-900">
            <ArrowLeft className="h-3 w-3" />
            {"\u8fd4\u56de"}
          </Link>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-slate-500 hover:text-slate-900">
            <ExternalLink className="h-3 w-3" />
            {"\u6253\u5f00"}
          </a>
          <button
            onClick={reloadPreview}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-900"
            title="\u5237\u65b0\u9884\u89c8"
            type="button"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          <button
            onClick={() => setShowToolbar(false)}
            className="ml-1 text-slate-400 hover:text-slate-700"
            title="\u6536\u8d77\u5de5\u5177\u680f"
            type="button"
          >
            x
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowToolbar(true)}
          className="fixed right-3 top-3 z-[9999] flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700"
          title="\u5c55\u5f00\u5de5\u5177\u680f"
          type="button"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      )}

      <iframe
        key={`${site.id}:${site.updatedAt}:${refreshTick}`}
        src={publicUrl}
        title={previewTitle}
        className="block h-screen w-full border-0"
        onLoad={() => {
          if (frameTimeoutRef.current) {
            window.clearTimeout(frameTimeoutRef.current);
            frameTimeoutRef.current = null;
          }
          frameRetryCountRef.current = 0;
          setFrameState("ready");
          setFrameMessage("");
        }}
        onError={() => {
          if (frameTimeoutRef.current) {
            window.clearTimeout(frameTimeoutRef.current);
            frameTimeoutRef.current = null;
          }
          void retryPreviewWithEnvCheck(
            "\u7ad9\u70b9\u9884\u89c8\u542f\u52a8\u5931\u8d25\uff0c\u7cfb\u7edf\u6b63\u5728\u81ea\u52a8\u91cd\u8bd5\u4e00\u6b21\u3002",
            "\u7ad9\u70b9\u9884\u89c8\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u53d1\u5e03\u5185\u5bb9\u6216\u91cd\u65b0\u751f\u6210\u7f51\u7ad9\u6587\u4ef6\u3002"
          );
        }}
      />

      {frameState !== "ready" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/92 p-6">
          <div
            className={`w-full max-w-md rounded-3xl border p-6 text-center shadow-sm ${
              frameState === "error" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"
            }`}
          >
            <div
              className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full ${
                frameState === "error" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
              }`}
            >
              {frameState === "error" ? <AlertTriangle className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </div>
            <div className="mt-3 text-sm font-semibold text-slate-900">
              {frameState === "error" ? "\u9884\u89c8\u5f02\u5e38" : "\u9884\u89c8\u52a0\u8f7d\u4e2d"}
            </div>
            <div className="mt-2 text-xs leading-5 text-slate-500">{frameMessage}</div>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={reloadPreview}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {"\u5237\u65b0"}
              </Button>
              <Link to={editRoute}>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                  {"\u8fd4\u56de\u7f16\u8f91\u5668"}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
    </FactoryPage>
  );
}
