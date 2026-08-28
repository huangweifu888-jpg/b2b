import { forwardRef } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { formatDisplayOrdinal } from "@/lib/display-number-contract";

export { ContentPluginIconSetting } from "./ContentPluginIconSetting";
export type { ContentPluginIconValue } from "./ContentPluginIconSetting";

type ContentPluginStatus = "active" | "inactive" | "hidden";

function mergeClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

/** Shared two-digit order display for every list/content plugin. */
export function formatContentPluginOrder(order: number | null | undefined): string {
  if (!Number.isInteger(order) || !order || order < 1) return "--";
  return formatDisplayOrdinal(order);
}

/** Nested content keeps both levels readable, e.g. `10.01`. */
export function formatContentPluginOrderPath(
  parentOrder: number | null | undefined,
  childOrder: number | null | undefined
): string {
  return `${formatContentPluginOrder(parentOrder)}.${formatContentPluginOrder(childOrder)}`;
}

/**
 * Runtime primitives for Content Design plugins.
 *
 * Pages own their records and callbacks; this module owns the visual contract,
 * interaction labels and shared plugin markers so a later CSS/component change
 * reaches every caller without copying button markup.
 */
export function ContentPluginDragHandle({
  className,
  title = "拖拽排序",
  ...buttonProps
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...buttonProps}
      data-content-plugin-control="drag"
      className={mergeClassNames(
        "content-plugin-toolbar-control template-config-shared-drag-handle nav-action-icon cursor-grab active:cursor-grabbing",
        className
      )}
      title={title}
      aria-label={buttonProps["aria-label"] || title}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

export function ContentPluginMoveButtons({
  canMoveUp = true,
  canMoveDown = true,
  onMoveUp,
  onMoveDown,
  className,
}: {
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  className?: string;
}) {
  return (
    <div className={mergeClassNames("content-plugin-move-controls flex shrink-0 items-center justify-center gap-2", className)}>
      <button
        type="button"
        disabled={!canMoveUp}
        onClick={onMoveUp}
        data-content-plugin-control="move-up"
        className="content-plugin-toolbar-control template-config-shared-order nav-action-icon"
        title="上移"
        aria-label="上移"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        disabled={!canMoveDown}
        onClick={onMoveDown}
        data-content-plugin-control="move-down"
        className="content-plugin-toolbar-control template-config-shared-order nav-action-icon"
        title="下移"
        aria-label="下移"
      >
        <ArrowDown className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Smallest shared sorting primitive.  Column Configuration can keep icon and
 * status controls in its own grid while Layout Style and Customer Service add
 * the shared order badge through ContentPluginSortToolbar.
 */
export function ContentPluginMoveRail({
  canMoveUp = true,
  canMoveDown = true,
  onMoveUp,
  onMoveDown,
  dragButtonProps,
  className,
  layout = "inline",
}: {
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  dragButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  className?: string;
  layout?: "inline" | "grid-contents";
}) {
  return (
    <div
      data-shared-sort-move-rail
      data-shared-sort-move-rail-layout={layout}
      className={mergeClassNames("content-plugin-move-rail", layout === "grid-contents" ? "is-grid-contents" : "", className)}
    >
      <ContentPluginDragHandle {...dragButtonProps} />
      <ContentPluginMoveButtons
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />
    </div>
  );
}

/**
 * Shared compact action for content rows.  Pages provide callbacks and labels;
 * this primitive owns the hit target, hover ring and visual state.
 */
export function ContentPluginActionButton({
  control,
  className,
  children,
  ...buttonProps
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  control: "pin" | "copy" | "edit" | "delete";
}) {
  const title = buttonProps.title || ({ pin: "置顶", copy: "复制", edit: "编辑", delete: "删除" } as const)[control];
  return (
    <button
      type="button"
      {...buttonProps}
      data-content-plugin-control={control}
      className={mergeClassNames(
        "content-plugin-action-button",
        control === "delete" ? "is-danger is-icon" : undefined,
        className,
      )}
      title={title}
      aria-label={buttonProps["aria-label"] || title}
    >
      {children}
    </button>
  );
}

/** Shared close control for dialogs and drawers. It keeps the real X action
 * visually identical in the Visual editor and in every terminal. */
export function ContentPluginCloseButton({ className, children, ...buttonProps }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...buttonProps}
      data-content-plugin-control="close"
      className={mergeClassNames("content-plugin-action-button", "is-icon", className)}
      title={buttonProps.title || "Close"}
      aria-label={buttonProps["aria-label"] || buttonProps.title || "Close"}
    >
      {children}
    </button>
  );
}

/** The one icon-setting trigger used by real pages and the visual contract preview. */
export const ContentPluginIconTrigger = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  preview: ReactNode;
  label?: string;
}>(function ContentPluginIconTrigger({
  preview,
  label = "图标设置",
  className,
  ...buttonProps
}, ref) {
  return (
    <button
      ref={ref}
      type="button"
      {...buttonProps}
      data-content-plugin-control="icon"
      className={mergeClassNames(
        "content-plugin-icon-trigger nav-icon-setting flex h-8 min-w-[5.625rem] items-center justify-start gap-1 rounded-md px-1 py-1 text-left sm:px-1.5",
        className,
      )}
      title={buttonProps.title || label}
      aria-label={buttonProps["aria-label"] || label}
    >
      {preview}
      <span data-content-plugin-icon-label className="text-[10px] leading-none sm:text-xs">{label}</span>
    </button>
  );
});

/** Shared text badge used by hierarchy/status/version plugins. */
export function ContentPluginTextBadge({
  children,
  className,
  control = "badge",
  ...spanProps
}: HTMLAttributes<HTMLSpanElement> & {
  control?: "badge" | "level-badge" | "status" | "lock" | "version";
}) {
  return (
    <span
      {...spanProps}
      data-content-plugin-control={control}
      className={mergeClassNames("template-config-shared-order adaptive-work-matrix-pill shrink-0", className)}
    >
      {children}
    </span>
  );
}

export function ContentPluginOrderBadge({
  order,
  suffix = "",
  className,
  sequence = "descending",
}: {
  order: number;
  suffix?: string;
  className?: string;
  sequence?: "ascending" | "descending";
}) {
  const formattedOrder = formatContentPluginOrder(order);
  const orderDescription = sequence === "ascending"
    ? "按当前页面从上到下的排放顺序递增，拖动后即时重排。"
    : "同组项目按大号码在前显示，不改变当前编辑顺序。";
  return (
    <span
      data-content-plugin-control="order"
      data-content-plugin-order-sequence={sequence}
      className={mergeClassNames(
        "template-config-shared-order template-config-content-plugin-order adaptive-work-matrix-pill",
        className
      )}
      title={`排号 ${formattedOrder}：${orderDescription}`}
    >
      {formattedOrder}{suffix}
    </span>
  );
}

/**
 * Shared runtime toolbar for list-like content.  The surrounding page may own
 * its records and placement, but drag / move / order must stay visually and
 * behaviorally identical anywhere this toolbar is used.
 */
export function ContentPluginSortToolbar({
  order,
  sequence = "descending",
  canMoveUp = true,
  canMoveDown = true,
  onMoveUp,
  onMoveDown,
  dragButtonProps,
  className,
}: {
  order: number;
  sequence?: "ascending" | "descending";
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  dragButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  className?: string;
}) {
  return (
    <div className={mergeClassNames("content-plugin-sort-toolbar", className)}>
      <ContentPluginMoveRail
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        dragButtonProps={dragButtonProps}
      />
      <ContentPluginOrderBadge order={order} sequence={sequence} />
    </div>
  );
}

export function ContentPluginStatusActions({
  value,
  onChange,
  className,
}: {
  value: ContentPluginStatus;
  onChange: (status: ContentPluginStatus) => void;
  className?: string;
}) {
  const labels: Record<ContentPluginStatus, string> = {
    active: "开通",
    inactive: "取消",
    hidden: "隐藏",
  };

  return (
    <div data-content-plugin-actions="status" className={mergeClassNames("module-status-control content-plugin-status-actions", className)}>
      {(Object.keys(labels) as ContentPluginStatus[]).map((status) => (
        <button
          key={status}
          type="button"
          onClick={() => onChange(status)}
          data-status={status}
          data-content-plugin-control={`status-${status}`}
          className={`content-plugin-status-button module-status-button template-config-content-plugin-status ${
            value === status ? "template-config-content-plugin-status-active is-active" : "template-config-content-plugin-status-inactive"
          }`}
        >
          {labels[status]}
        </button>
      ))}
    </div>
  );
}

/** Shared enable switch used by content plugins that expose a visible marker. */
export function ContentPluginToggle({
  label,
  checked,
  onCheckedChange,
  className,
  showLabel = false,
  ...buttonProps
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  /** Keep the footer compact; the state and purpose remain available on hover. */
  showLabel?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className" | "onClick">) {
  const action = checked ? "关闭" : "开启";
  const title = `${action}${label}；立即同步到使用这一内容插件的页面。`;
  return (
    <button
      {...buttonProps}
      type="button"
      data-content-plugin-control="toggle"
      data-state={checked ? "enabled" : "disabled"}
      aria-pressed={checked}
      onClick={() => onCheckedChange(!checked)}
      title={title}
      aria-label={title}
      className={mergeClassNames(
        "content-plugin-toolbar-toggle template-config-content-plugin-toggle inline-flex h-8 shrink-0 items-center justify-center rounded-md border px-2 text-xs font-semibold transition-all",
        className
      )}
    >
      <span
        aria-hidden="true"
        data-content-plugin-toggle-track
        className="relative rounded-full border transition-colors"
      >
        <span data-content-plugin-toggle-thumb className="absolute rounded-full shadow transition-transform" />
      </span>
      {showLabel ? <span>{action}{label}</span> : null}
    </button>
  );
}
