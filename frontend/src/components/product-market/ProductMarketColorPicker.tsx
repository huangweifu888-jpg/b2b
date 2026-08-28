import { useRef, useState } from "react";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getBestContrastingTextColor as getReadableTextColor } from "@/lib/color-contrast";

const COLOR_PRESETS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#1e293b", "#334155", "#475569",
  "#64748b", "#94a3b8", "#cbd5e1", "#f1f5f9", "#ffffff",
];

const FIELD_TITLE_CLASS = "text-[11px] font-medium leading-tight sm:text-[12px]";

export type ProductMarketColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
  label: string;
  /** Text shown on the colour capsule; defaults to this colour's configured text value. */
  textColor?: string;
  /** Surface shown behind the colour label; defaults to the edited colour itself. */
  surfaceColor?: string;
  hint?: string;
  compact?: boolean;
};

export function ProductMarketColorPicker({
  value,
  onChange,
  label,
  textColor,
  surfaceColor,
  hint,
  compact = false,
}: ProductMarketColorPickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [collisionBoundary, setCollisionBoundary] = useState<HTMLElement | undefined>(undefined);
  const capsuleSurfaceColor = surfaceColor || value;
  const valueTextColor = getReadableTextColor(capsuleSurfaceColor, "#08111D", "#F8FAFC");
  const capsuleTextColor = textColor || value;

  return (
    <Popover open={open} onOpenChange={(nextOpen) => {
      if (nextOpen) setCollisionBoundary(triggerRef.current?.closest<HTMLElement>('[role="dialog"]') || undefined);
      setOpen(nextOpen);
    }}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          title={hint}
          data-color-picker-value={value}
          className={`color-picker-trigger flex items-center rounded-md border border-slate-600 transition-colors hover:border-slate-400 bg-slate-800/50 ${compact ? "gap-1 px-1.5 py-1" : "gap-2 px-2 py-1.5"}`}
          style={{
            color: capsuleTextColor,
            ["--color-picker-value" as string]: capsuleSurfaceColor,
            ["--color-picker-contrast" as string]: valueTextColor,
            ["--color-picker-text" as string]: capsuleTextColor,
          }}
        >
          <div
            className={compact ? "h-4 w-4 rounded border border-slate-500" : "h-5 w-5 rounded border border-slate-500"}
            style={{ backgroundColor: value }}
          />
          <span className={`color-picker-label text-slate-300 ${compact ? "text-[10px]" : "text-xs"}`}>{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="color-picker-popover p-3 bg-slate-900"
        align="start"
        side="top"
        sideOffset={8}
        collisionBoundary={collisionBoundary}
        collisionPadding={16}
        sticky="always"
      >
        <div className="space-y-2">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <Label className={FIELD_TITLE_CLASS + " truncate text-slate-400"}>{label}</Label>
            <button
              type="button"
              aria-label={`关闭${label}色卡`}
              onClick={() => setOpen(false)}
              className="color-picker-close inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-600 text-slate-300 transition-colors hover:border-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="color-picker-swatch-grid">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                className={`h-8 w-8 rounded-md border-2 transition-colors ${
                  value === color ? "border-white ring-1 ring-white/50" : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
                onClick={() => {
                  onChange(color);
                  setOpen(false);
                }}
              />
            ))}
          </div>
          <div className="color-picker-custom-row flex items-center gap-2 pt-1">
            <Label className="text-xs text-slate-500 shrink-0">自定义</Label>
            <Input
              type="color"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              className="h-7 w-10 p-0.5 bg-transparent cursor-pointer"
            />
            <Input
              value={value}
              onChange={(event) => onChange(event.target.value)}
              className="h-7 min-w-0 flex-1 text-xs bg-slate-800 text-slate-300 font-mono"
              placeholder="#000000"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ProductMarketColorPicker;
