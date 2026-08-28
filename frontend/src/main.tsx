import React from "react";
import { createRoot, type Root } from "react-dom/client";
import "./index.css";
import "./shared-adaptive-surface.css";
import "./shared-service-expert-capacity.css";
import "./shared-product-market-category-contract.css";
import "./shared-sortable-ownership-contract.css";
import "./shared-existing-workspace-frame.css";
import "./shared-layout-style-card.css";
import { loadRuntimeConfig } from "./lib/config.ts";

declare global {
  interface Window {
    __tradeproReactRoot?: Root;
  }
}

class ShellErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || "\u542f\u52a8\u9636\u6bb5\u51fa\u73b0\u672a\u77e5\u9519\u8bef" };
  }

  override componentDidCatch(error: Error) {
    console.error("TradeHQ shell render error:", error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8fafc", padding: 24 }}>
          <div style={{ maxWidth: 720, width: "100%", borderRadius: 24, border: "1px solid #fecaca", background: "#fff", padding: 24, boxShadow: "0 24px 60px rgba(15,23,42,0.08)" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#991b1b" }}>
              {"\u53f3\u4fa7\u6c99\u76d8\u542f\u52a8\u5f02\u5e38"}
            </div>
            <div style={{ marginTop: 8, whiteSpace: "pre-wrap", color: "#475569", lineHeight: 1.7 }}>{this.state.message}</div>
            <div style={{ marginTop: 14, fontSize: 13, color: "#64748b" }}>
              {"\u5df2\u62e6\u622a\u5f02\u5e38\uff0c\u9875\u9762\u4f1a\u663e\u793a\u9519\u8bef\u539f\u56e0\uff0c\u907f\u514d\u53f3\u4fa7\u6c99\u76d8\u76f4\u63a5\u7a7a\u767d\u3002"}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function installObserverGuards() {
  const isNodeLikeTarget = (target: unknown) => {
    if (!target || typeof target !== "object") {
      return false;
    }

    const candidate = target as { nodeType?: unknown; ownerDocument?: unknown };
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
          console.warn("Skipped observer registration for a non-node target.");
          return;
        }

        try {
          originalObserve.call(this, target, options);
        } catch (error) {
          console.warn("Skipped observer registration after observe() rejected the target.", error);
        }
      };

      proto.__codexSafeObservePatched = true;
    } catch (error) {
      console.warn("Observer guard patch skipped; browser keeps native behavior.", error);
    }
  };

  maybePatchObserve(globalThis.MutationObserver);
  maybePatchObserve(globalThis.ResizeObserver);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type PreviewFailureLearningEntry = {
  signature: string;
  recordedAt: string;
  outcome?: string;
};

const PREVIEW_FAILURE_LEARNING_KEY = "tradepro.preview-bootstrap-failure-learning.v1";
const PREVIEW_FAILURE_LEARNING_LIMIT = 200;

function classifyPreviewBootstrapFailure(detail: string) {
  if (/Failed to fetch dynamically imported module|Importing a module script failed/i.test(detail)) return "动态模块加载失败";
  if (/WebSocket|vite|HMR/i.test(detail)) return "Vite 连接或热更新中断";
  if (/Root element not found|render error|rendering/i.test(detail)) return "预览运行时渲染异常";
  return "未知预览启动异常";
}

function readPreviewFailureLearning(): PreviewFailureLearningEntry[] {
  try {
    const raw = window.localStorage.getItem(PREVIEW_FAILURE_LEARNING_KEY);
    const entries: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(entries)) return [];
    return entries.filter((entry): entry is PreviewFailureLearningEntry => Boolean(
      entry && typeof entry === "object" && typeof (entry as PreviewFailureLearningEntry).signature === "string" && typeof (entry as PreviewFailureLearningEntry).recordedAt === "string",
    )).slice(-PREVIEW_FAILURE_LEARNING_LIMIT);
  } catch {
    return [];
  }
}

function recordPreviewFailureLearning(detail: string, outcome?: string) {
  const signature = classifyPreviewBootstrapFailure(detail);
  const entries = readPreviewFailureLearning();
  const next = [...entries, { signature, recordedAt: new Date().toISOString(), outcome }].slice(-PREVIEW_FAILURE_LEARNING_LIMIT);
  try {
    window.localStorage.setItem(PREVIEW_FAILURE_LEARNING_KEY, JSON.stringify(next));
  } catch {
    // The failure page must remain usable when browser storage is unavailable.
  }
  const similarCount = next.filter((entry) => entry.signature === signature).length;
  return `本机已记录：${signature}（同类 ${similarCount} 次）。优先执行“异常检测”，确认环境正常后再重新加载预览。`;
}

function renderBootstrapShell(rootElement: HTMLElement, variant: "loading" | "error", detail: string) {
  const accent = variant === "error" ? "#ef4444" : "#0ea5e9";
  const title = variant === "error" ? "\u53f3\u4fa7\u9884\u89c8\u542f\u52a8\u5931\u8d25" : "\u6b63\u5728\u542f\u52a8\u672c\u5730\u9884\u89c8";
  const helper =
    variant === "error"
      ? "\u5df2\u62e6\u622a\u5f02\u5e38\uff0c\u907f\u514d\u53f3\u4fa7\u6c99\u76d8\u76f4\u63a5\u7a7a\u767d\u3002\u8bf7\u7a0d\u540e\u91cd\u8bd5\u6216\u7ee7\u7eed\u8ba9\u6211\u5904\u7406\u3002"
      : "\u6b63\u5728\u52a0\u8f7d\u9875\u9762\u6a21\u5757\u4e0e\u8fd0\u884c\u914d\u7f6e\uff0c\u8bf7\u7a0d\u5019...";
  const safeTitle = escapeHtml(title);
  const safeHelper = escapeHtml(helper);
  const safeDetail = escapeHtml(detail);
  const learningNote = variant === "error" ? recordPreviewFailureLearning(detail) : "";
  const safeLearningNote = escapeHtml(learningNote);

  rootElement.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#f8fafc 0%,#eef6ff 100%);padding:24px;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="width:min(560px,100%);border:1px solid rgba(148,163,184,0.22);border-radius:24px;background:rgba(255,255,255,0.96);box-shadow:0 24px 60px rgba(15,23,42,0.12);padding:28px;">
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:14px;height:14px;border-radius:999px;background:${accent};box-shadow:0 0 0 8px ${variant === "error" ? "rgba(239,68,68,0.12)" : "rgba(14,165,233,0.12)"};"></div>
          <div>
            <div style="font-size:18px;font-weight:700;color:#0f172a;">${safeTitle}</div>
            <div style="margin-top:4px;font-size:13px;color:#475569;">${safeHelper}</div>
          </div>
        </div>
        <div style="margin-top:18px;border-radius:18px;background:#f8fafc;padding:16px 18px;font-size:13px;line-height:1.7;color:#334155;white-space:pre-wrap;word-break:break-word;">${safeDetail}</div>
        ${variant === "error" ? `<div data-preview-bootstrap-learning style="margin-top:12px;border-radius:14px;background:#f0fdf4;padding:10px 12px;font-size:12px;line-height:1.7;color:#166534;">${safeLearningNote}</div>` : ""}
        ${variant === "error" ? '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:16px;"><button type="button" data-preview-bootstrap-retry style="border:0;border-radius:12px;background:#0f766e;color:#fff;padding:10px 14px;font:inherit;font-weight:700;cursor:pointer;">重新加载预览</button><button type="button" data-preview-bootstrap-diagnose style="border:1px solid #cbd5e1;border-radius:12px;background:#fff;color:#0f172a;padding:10px 14px;font:inherit;font-weight:700;cursor:pointer;">异常检测</button></div><div data-preview-bootstrap-diagnostic style="display:none;margin-top:14px;border-radius:14px;background:#eff6ff;padding:12px 14px;font-size:12px;line-height:1.7;color:#1e3a5f;"></div>' : ""}
      </div>
    </div>
  `;

  rootElement.querySelector<HTMLButtonElement>("[data-preview-bootstrap-retry]")?.addEventListener("click", () => {
    window.location.reload();
  });

  rootElement.querySelector<HTMLButtonElement>("[data-preview-bootstrap-diagnose]")?.addEventListener("click", async (event) => {
    const output = rootElement.querySelector<HTMLElement>("[data-preview-bootstrap-diagnostic]");
    const button = event.currentTarget;
    if (!output) return;
    button.disabled = true;
    output.style.display = "block";
    output.textContent = "正在检测 3003 / 8000 / 3004…";
    try {
      const bases = ["", "http://127.0.0.1:8000", "http://127.0.0.1:8002"];
      let snapshot: { ok?: boolean; frontend?: { status?: string; listening?: boolean }; backend?: { status?: string; listening?: boolean }; website?: { status?: string; listening?: boolean } } | null = null;
      let lastError = "";
      for (const base of bases) {
        try {
          const response = await fetch(`${base}/api/v1/local-dev/local-env-status`);
          if (!response.ok) throw new Error(`状态接口返回 ${response.status}`);
          snapshot = await response.json();
          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }
      if (!snapshot) {
        recordPreviewFailureLearning(detail, "环境状态接口不可用");
        output.textContent = `无法读取本地环境状态：${lastError || "本地 API 不可用"}。请先启动本地 API，再重新检测。`;
        return;
      }
      const labels = [
        ["前端 3003", snapshot.frontend],
        ["本地 API 8000", snapshot.backend],
        ["静态预览 3004", snapshot.website],
      ].map(([label, service]) => `${label}：${service?.listening ? service?.status || "已监听" : "未监听"}`);
      output.textContent = snapshot.ok
        ? `环境检测正常。${labels.join("；")}。现在可重新加载预览。`
        : `发现环境异常。${labels.join("；")}。请先在外层页面的“异常检测”中执行安全修复；数据库迁移需要明确确认后执行。`;
      recordPreviewFailureLearning(detail, snapshot.ok ? "环境检测正常" : `环境异常：${labels.join("；")}`);
    } finally {
      button.disabled = false;
    }
  });
}

async function initializeApp() {
  if (new URLSearchParams(window.location.search).get("__layoutPreview") === "1") {
    document.documentElement.dataset.tradeproStructurePreview = "true";
  }

  // Prerendered blog pages are served as pure static HTML for SEO.
  // Intentionally skip React mounting so the crawler-facing markup stays
  // lightweight and self-contained - no client-side hydration needed.
  if (
    document
      .querySelector('meta[name="prerender-static-page"]')
      ?.getAttribute("content") === "blog"
  ) {
    return;
  }

  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }

  try {
    const { default: App } = await import("./App.tsx");
    const appRoot = window.__tradeproReactRoot ?? createRoot(rootElement);
    window.__tradeproReactRoot = appRoot;
    appRoot.render(
      React.createElement(
        ShellErrorBoundary,
        null,
        React.createElement(App)
      )
    );
  } catch (error) {
    console.error("Failed to bootstrap TradeHQ Console:", error);
    const detail = error instanceof Error ? `${error.message}\n\n${error.stack || ""}` : String(error);
    renderBootstrapShell(rootElement, "error", detail || "\u672a\u77e5\u542f\u52a8\u9519\u8bef");
    return;
  }

  void loadRuntimeConfig().catch((error) => {
    console.warn("Failed to load runtime configuration, using defaults:", error);
  });
}

installObserverGuards();
initializeApp();
