import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { resolveGlobalFooterTheme } from "@/lib/global-theme-tokens";
import { useProductMarketStore } from "@/lib/product-market-store";

type UnifiedActionDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  cancelLabel?: string;
  onCancel?: null | (() => Promise<void> | void);
  onOpenChange: (open: boolean) => void;
  onConfirm: null | (() => Promise<void> | void);
  minimumBusyMs?: number;
  completionHoldMs?: number;
  showBusyState?: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function withAlpha(color: string | undefined, alphaHex: string) {
  if (!color) return `#ffffff${alphaHex}`;
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return `${trimmed}${alphaHex}`;
  return trimmed;
}

function formatActionErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message) return fallback;
  if (/failed to fetch|networkerror|network request failed/i.test(message)) {
    return "连接本地服务失败，请确认本地服务已启动后重试。";
  }
  if (/abort(ed)?/i.test(message)) {
    return "操作连接已中断，请重试。";
  }
  if (/cannot read properties of undefined.*products/i.test(message)) {
    return "保存结果不完整，未读取到栏目配置。请重试保存；若仍失败，请刷新页面后再次操作。";
  }
  if (/^(typeerror|referenceerror|syntaxerror)\b/i.test(message)) {
    return "操作处理失败，请检查当前配置后重试。";
  }
  return message;
}

export default function UnifiedActionDialog({
  open,
  title,
  description,
  confirmLabel,
  busyLabel,
  cancelLabel = "取消",
  onCancel = null,
  onOpenChange,
  onConfirm,
  minimumBusyMs = 3000,
  completionHoldMs = 2000,
  showBusyState = true,
}: UnifiedActionDialogProps) {
  const { layoutStyle, sidebarStyle } = useProductMarketStore();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const actionCompletedAtRef = useRef<number | null>(null);
  const progressValueAtCompletionRef = useRef(0);

  const cardBg = layoutStyle.siteSwitchLoadingCardBgColor || layoutStyle.themePanelBgColor || "#ffffff";
  const textColor = layoutStyle.siteSwitchLoadingCardTextColor || layoutStyle.themePanelTextColor || "#0f172a";
  const accentColor = layoutStyle.themePanelButtonColor || layoutStyle.defaultDialogButtonColor || "#2563eb";
  const confirmBg = layoutStyle.defaultDialogButtonColor || accentColor;
  const confirmTextColor = layoutStyle.defaultDialogButtonTextColor || "#ffffff";
  const headerBg = layoutStyle.defaultDialogHeaderBgColor || accentColor;
  const headerTextColor = layoutStyle.defaultDialogHeaderTextColor || "#ffffff";
  const footerTheme = resolveGlobalFooterTheme(layoutStyle, sidebarStyle);
  const footerBg = footerTheme.background || headerBg;
  const footerTextColor = footerTheme.text || headerTextColor;

  useEffect(() => {
    if (!busy) {
      setProgress(0);
      startedAtRef.current = null;
      actionCompletedAtRef.current = null;
      progressValueAtCompletionRef.current = 0;
      return;
    }

    startedAtRef.current = Date.now();
    setProgress(8);

    const timer = window.setInterval(() => {
      if (!startedAtRef.current) return;

      const now = Date.now();
      const elapsed = now - startedAtRef.current;
      const actionCompletedAt = actionCompletedAtRef.current;
      let next = 8;

      if (!actionCompletedAt) {
        if (elapsed <= minimumBusyMs) {
          next = Math.max(8, Math.min(90, 8 + (elapsed / minimumBusyMs) * 82));
        } else {
          next = Math.max(90, Math.min(96, 90 + (elapsed - minimumBusyMs) / 220));
        }
      } else {
        const holdElapsed = now - actionCompletedAt;
        const holdProgress = Math.min(1, holdElapsed / completionHoldMs);
        next = Math.max(
          progressValueAtCompletionRef.current,
          Math.min(
            100,
            progressValueAtCompletionRef.current +
              (100 - progressValueAtCompletionRef.current) * holdProgress
          )
        );
      }

      setProgress(next);
    }, 120);

    return () => window.clearInterval(timer);
  }, [busy, completionHoldMs, minimumBusyMs]);

  const effectiveDescription = useMemo(() => description, [description]);

  const handleConfirm = async () => {
    if (!onConfirm || busy) return;

    setErrorMessage(null);

    if (!showBusyState) {
      try {
        await Promise.resolve(onConfirm());
        onOpenChange(false);
      } catch (error) {
        setErrorMessage(formatActionErrorMessage(error, "执行失败，请检查当前设置后重试。"));
      }
      return;
    }

    setBusy(true);

    try {
      await Promise.resolve(onConfirm());

      actionCompletedAtRef.current = Date.now();
      progressValueAtCompletionRef.current = progress;

      const startedAt = startedAtRef.current ?? actionCompletedAtRef.current;
      const actionElapsed = actionCompletedAtRef.current - startedAt;
      const waitForMinimum = Math.max(0, minimumBusyMs - actionElapsed);

      await sleep(waitForMinimum + completionHoldMs);
      setProgress(100);
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(formatActionErrorMessage(error, "执行失败，请检查当前设置后重试。"));
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (busy) return;
    try {
      await Promise.resolve(onCancel?.());
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(formatActionErrorMessage(error, "取消操作失败，请重试。"));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (busy) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className="flex max-w-md flex-col gap-0 overflow-hidden border-0 p-0 shadow-none"
        style={{ backgroundColor: withAlpha(cardBg, "f5") }}
        showCloseButton={!busy}
        data-unified-action-busy={busy ? "true" : undefined}
        data-unified-action-dialog="true"
        data-shared-dialog-contract="save-confirmation"
        data-shared-window-kind="confirm"
        data-shared-window-size="confirm"
      >
        <DialogHeader
          data-unified-action-header
          data-shared-window-region="title"
          className="flex shrink-0 flex-col justify-center gap-1 border-b px-5 py-4 pr-12"
          style={{
            backgroundColor: headerBg,
            color: headerTextColor,
            borderColor: withAlpha(headerTextColor, "22"),
          }}
        >
          <DialogTitle className="text-sm font-semibold" style={{ color: headerTextColor }}>{title}</DialogTitle>
          <DialogDescription className="text-xs leading-5" style={{ color: withAlpha(headerTextColor, "d9") }}>
            {effectiveDescription}
          </DialogDescription>
        </DialogHeader>

        <div data-unified-action-content data-shared-window-region="content" className="min-h-0 flex-1 space-y-4 px-5 py-4">
          {busy && showBusyState ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: withAlpha(accentColor, "22"), color: accentColor }}
                >
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold" style={{ color: textColor }}>
                    {busyLabel}
                  </div>
                  <div className="mt-1 text-xs leading-5" style={{ color: withAlpha(textColor, "cc") }}>
                    系统已开始执行，真实动作完成后会继续稳定 2 秒再结束。
                  </div>
                </div>
              </div>
              <div>
                <div data-unified-action-progress className="relative h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <Progress value={progress} className="absolute inset-0 h-2.5 w-full bg-transparent" />
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 rounded-full transition-[width] duration-150"
                    style={{ width: `${progress}%`, backgroundColor: accentColor }}
                  />
                </div>
                <div className="mt-2 text-right text-[11px]" style={{ color: withAlpha(textColor, "99") }}>
                  最少等待 {Math.ceil(minimumBusyMs / 1000)} 秒，动作完成后再稳定 {Math.ceil(completionHoldMs / 1000)} 秒
                </div>
              </div>
            </div>
          ) : null}

          {!busy && errorMessage ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-600">
              {errorMessage}
            </div>
          ) : null}

        </div>
        <DialogFooter
          data-unified-action-footer
          data-shared-window-region="footer"
          className="flex h-14 shrink-0 flex-row items-center justify-end gap-2 border-t px-5 py-0"
          style={{ backgroundColor: footerBg, color: footerTextColor, borderColor: withAlpha(footerTextColor, "22") }}
        >
          <Button
            variant="outline"
            onClick={() => void handleCancel()}
            disabled={busy}
            className="h-9 min-w-20"
            style={{ borderColor: withAlpha(footerTextColor, "66"), backgroundColor: "transparent", color: footerTextColor }}
          >
            {cancelLabel}
          </Button>
          <Button
            data-unified-action-confirm
            onClick={() => void handleConfirm()}
            disabled={busy || !onConfirm}
            className="h-9 min-w-20 hover:opacity-90"
            style={{ backgroundColor: confirmBg, color: confirmTextColor }}
          >
            {busy && showBusyState ? busyLabel : errorMessage ? "重试" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
