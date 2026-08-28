import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";

/** Lightweight launcher; the full Visual editor chunk loads only after click. */
const preloadVisualPageEditorDock = () => import("@/components/product-market/VisualPageEditorDock");
export function VisualPageEditorTopbarLauncher({
  open,
  onOpenChange,
  pathname,
  locked = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
  locked?: boolean;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(() => (
    typeof document === "undefined" ? null : document.querySelector<HTMLElement>("[data-responsive-visual-launcher-slot]")
  ));

  useEffect(() => {
    document.documentElement.toggleAttribute("data-visual-card-launcher-visible", !open);
    return () => document.documentElement.removeAttribute("data-visual-card-launcher-visible");
  }, [open]);

  useEffect(() => {
    const resolveSlot = () => {
      const nextSlot = document.querySelector<HTMLElement>("[data-responsive-visual-launcher-slot]");
      setSlot(nextSlot);
      return nextSlot;
    };
    if (resolveSlot()) return undefined;

    const observer = new MutationObserver(() => {
      if (resolveSlot()) observer.disconnect();
    });
    observer.observe(document.getElementById("root") || document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  if (typeof document === "undefined" || open) return null;
  if (!slot) return null;

  return createPortal(
    <div
      data-visual-card-control-strip
      data-visual-card-control-path={pathname}
      data-responsive-visual-launcher="footer-fixed-before-save"
      data-responsive-footer-order="2"
      data-responsive-visual-launcher-dock="footer-before-save"
      data-responsive-visual-launcher-fixed="true"
      className="visual-page-editor-launcher"
    >
      <button
        type="button"
        data-visual-card-developer-launcher
        data-responsive-toolbar-trigger="visual"
        data-responsive-function-key-plugin="shared"
        aria-label="可视化开发器"
        aria-expanded={open}
        aria-disabled={locked}
        draggable={false}
        title={locked ? "当前页面已启用防误改，点击查看解除提示。" : "可视化：点击打开开发器；固定在尾栏保存并同步之前。"}
        onPointerEnter={() => { void preloadVisualPageEditorDock(); }}
        onPointerDown={() => { void preloadVisualPageEditorDock(); }}
        onFocus={() => { void preloadVisualPageEditorDock(); }}
        onClick={() => {
          if (locked) {
            toast.error("当前页面已启用防误改：可视化修改已阻止，请先在 08 页面锁定器解除。");
            return;
          }
          window.dispatchEvent(new CustomEvent("tradepro:responsive-toolbar-open", { detail: { source: "visual" } }));
          onOpenChange(true);
        }}
        className={`select-none transition-[background-color,box-shadow] ${locked ? "opacity-60" : "cursor-pointer"}`}
      >
        <span data-responsive-function-key-icon><Settings2 aria-hidden="true" /></span>
        <span data-responsive-tool-label>{locked ? "已硬锁" : "可视化"}</span>
      </button>
    </div>,
    slot,
  );
}
