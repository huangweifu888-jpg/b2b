import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import { ensureLocalEnvReady } from "@/lib/local-dev";
import { FactoryPage } from "@/page-factory/FactoryPage";

function installObserverGuards(targetWindow: Window) {
  const isNodeLikeTarget = (target: unknown) => {
    if (!target || typeof target !== "object") {
      return false;
    }

    const candidate = target as { nodeType?: unknown };
    return typeof candidate.nodeType === "number" && candidate.nodeType > 0;
  };

  const maybePatchObserve = (
    ObserverClass: typeof MutationObserver | typeof ResizeObserver | undefined
  ) => {
    if (!ObserverClass) {
      return;
    }

    const proto = ObserverClass.prototype as {
      observe?: (target: unknown, options?: unknown) => void;
      __codexSafeObservePatched?: boolean;
    };

    if (!proto.observe || proto.__codexSafeObservePatched) {
      return;
    }

    try {
      const originalObserve = proto.observe;

      proto.observe = function safeObserve(target: unknown, options?: unknown) {
        if (!isNodeLikeTarget(target)) {
          console.warn("Skipped preview observer registration for a non-node target.");
          return;
        }

        try {
          originalObserve.call(this, target, options);
        } catch (error) {
          console.warn("Skipped preview observer registration after observe() rejected the target.", error);
        }
      };

      proto.__codexSafeObservePatched = true;
    } catch (error) {
      console.warn("Preview observer guard patch skipped; browser keeps native behavior.", error);
    }
  };

  maybePatchObserve(targetWindow.MutationObserver);
  maybePatchObserve(targetWindow.ResizeObserver);
}

function renderFallback(title: string, message: string) {
  document.open();
  document.write(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    html, body { margin: 0; padding: 0; font-family: Inter, system-ui, sans-serif; background: #f8fafc; color: #0f172a; }
    body { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .panel { max-width: 560px; margin: 24px; padding: 28px 32px; border-radius: 24px; background: #fff; box-shadow: 0 20px 50px rgba(15,23,42,.10); border: 1px solid rgba(148,163,184,.18); }
    .title { font-size: 20px; font-weight: 700; margin: 0 0 10px; }
    .desc { font-size: 14px; line-height: 1.7; color: #475569; margin: 0; }
  </style>
</head>
  <body data-trade-preview-fallback="true">
   <div class="panel" data-trade-preview-fallback="true">
    <h1 class="title">${title}</h1>
    <p class="desc">${message}</p>
  </div>
</body>
</html>`);
  document.close();
}

export default function PreviewFrame() {
  const [searchParams] = useSearchParams();
  const storageKey = searchParams.get("storageKey") || "";

  useEffect(() => {
    if (typeof window === "undefined") return;
    installObserverGuards(window);

    if (!storageKey) {
      renderFallback("\u7ad9\u70b9\u9884\u89c8", "\u7f3a\u5c11\u9884\u89c8\u5b58\u50a8\u952e\uff0c\u8bf7\u5148\u4ece\u7f16\u8f91\u5668\u6216\u8ba1\u5212\u9875\u6253\u5f00\u7ad9\u70b9\u9884\u89c8\u3002");
      return;
    }

    const renderStoredPreview = () => {
      const html = window.localStorage.getItem(storageKey) || "";
      if (!html.trim()) return false;
      const previewWindow = window as Window & { __tradePreviewRenderedKey?: string };
      const renderedKey = `${storageKey}:${html.length}:${html.slice(0, 160)}`;
      if (previewWindow.__tradePreviewRenderedKey === renderedKey) {
        return true;
      }
      previewWindow.__tradePreviewRenderedKey = renderedKey;
      document.open();
      document.write(html);
      document.close();
      return true;
    };

    if (renderStoredPreview()) return;

    let cancelled = false;
    let retryTimer: number | null = null;

    const retryStoredPreview = (attempt = 0) => {
      if (cancelled || renderStoredPreview()) return;
      // Parent and iframe effects do not have a guaranteed execution order.
      // Give the parent a bounded window to write the first preview snapshot
      // before declaring the sandbox empty.
      if (attempt < 4) {
        retryTimer = window.setTimeout(() => retryStoredPreview(attempt + 1), 120);
        return;
      }
      void inspectLocalEnv();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey && event.newValue?.trim()) {
        renderStoredPreview();
      }
    };
    window.addEventListener("storage", handleStorage);

    const inspectLocalEnv = async () => {
      try {
        const localEnvStatus = await ensureLocalEnvReady();
        if (cancelled) return;

        if (!localEnvStatus?.ok) {
          renderFallback(
            "\u7ad9\u70b9\u9884\u89c8",
            "\u672c\u5730\u73af\u5883\u672a\u5c31\u7eea\uff0c\u5f53\u524d\u6c99\u76d8\u6682\u65f6\u65e0\u6cd5\u542f\u52a8\uff0c\u8bf7\u7a0d\u540e\u624b\u52a8\u91cd\u8bd5\u3002"
          );
          return;
        }
      } catch {
        if (cancelled) return;
        renderFallback(
          "\u7ad9\u70b9\u9884\u89c8",
          "\u672c\u5730\u73af\u5883\u68c0\u67e5\u5931\u8d25\uff0c\u5f53\u524d\u6c99\u76d8\u6682\u65f6\u65e0\u6cd5\u542f\u52a8\uff0c\u8bf7\u7a0d\u540e\u624b\u52a8\u91cd\u8bd5\u3002"
        );
        return;
      }

      if (!cancelled) {
        renderFallback(
          "\u7ad9\u70b9\u9884\u89c8",
          "\u5f53\u524d\u9884\u89c8\u5185\u5bb9\u4e3a\u7a7a\uff0c\u8bf7\u56de\u5230\u7f16\u8f91\u5668\u5237\u65b0\u6c99\u76d8\u540e\u518d\u8bd5\u3002"
        );
      }
    };

    retryStoredPreview();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      window.removeEventListener("storage", handleStorage);
    };
  }, [storageKey]);

  return (
    <FactoryPage pageId="client-preview-frame" template="reference" sourceScope="client_source" autoRegions>
      <div className="sr-only" aria-live="polite">正在载入客户站点预览。</div>
    </FactoryPage>
  );
}
