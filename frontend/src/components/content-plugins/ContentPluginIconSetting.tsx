import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listMaterialAssets, recordMaterialAssetApply, uploadMaterialAsset, type MaterialAssetItem } from "@/lib/material-assets";
import { getMediaUploadAccept } from "@/lib/media-optimization-contract";
import { ICON_OPTIONS } from "@/lib/product-market-store";

/**
 * The value is intentionally compatible with the Customer Source icon picker:
 * a preset icon name, or one image selected from the shared material library.
 */
export type ContentPluginIconValue = {
  assetId: string | null;
  url: string | null;
  iconName?: string | null;
};

export type ContentPluginIconSettingProps = {
  value: ContentPluginIconValue;
  onChange: (value: ContentPluginIconValue) => void;
  label?: string;
  description?: string;
  className?: string;
  compact?: boolean;
  /** Open immediately on first mount, for interaction-triggered lazy loading. */
  defaultOpen?: boolean;
  /** Reuse the Customer Source preset icon library instead of a local copy. */
  useCustomerSourceIconLibrary?: boolean;
};

/** Shared content-plugin icon control backed by Customer Source icons + material assets. */
export function ContentPluginIconSetting({
  value,
  onChange,
  label = "图标",
  description = "上传图片或从公共素材库选择",
  className = "",
  compact = false,
  defaultOpen = false,
  useCustomerSourceIconLibrary = false,
}: ContentPluginIconSettingProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [assets, setAssets] = useState<MaterialAssetItem[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedPreset = value.iconName ? ICON_OPTIONS.find((option) => option.name === value.iconName) : undefined;
  const TriggerIcon = selectedPreset?.icon || ImagePlus;
  const PreviewIcon = selectedPreset?.icon ?? ImagePlus;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingAssets(true);
    void listMaterialAssets()
      .then((response) => { if (!cancelled) setAssets(response.items.filter((asset) => asset.kind === "image")); })
      .catch(() => { if (!cancelled) setAssets([]); })
      .finally(() => { if (!cancelled) setLoadingAssets(false); });
    return () => { cancelled = true; };
  }, [open]);

  async function selectAsset(asset: Pick<MaterialAssetItem, "assetId" | "publicUrl">) {
    try { await recordMaterialAssetApply(asset.assetId); } catch { /* Usage analytics must not block selection. */ }
    onChange({ assetId: asset.assetId, url: asset.publicUrl, iconName: null });
    setOpen(false);
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadMaterialAsset(file, "image");
      await selectAsset({ assetId: uploaded.assetId, publicUrl: uploaded.publicUrl });
    } finally { setUploading(false); }
  }

  function selectPreset(iconName: string) {
    onChange({ assetId: null, url: null, iconName });
    setOpen(false);
  }

  return (
    <div
      data-content-plugin-icon-setting
      data-content-plugin-icon-setting-variant={compact ? "compact" : "card"}
      className={`rounded-xl border border-cyan-100 bg-gradient-to-r from-white to-cyan-50/60 p-3 ${compact ? "content-plugin-icon-setting--compact" : ""} ${className}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        {!compact ? <><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-cyan-100 bg-white text-cyan-600 shadow-sm">
          {value.url ? <img src={value.url} alt={`${label}预览`} className="h-full w-full object-contain p-1" /> : <PreviewIcon className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-800">{label}</p><p className="mt-0.5 text-xs text-slate-500">{description}</p></div></> : null}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant={compact ? "ghost" : "outline"} size="sm" data-content-plugin-control="icon" title={selectedPreset ? `图标设置：${selectedPreset.name}` : "图标设置"} className={compact ? "content-plugin-icon-trigger text-cyan-700 hover:bg-transparent hover:text-cyan-700" : "border-cyan-200 bg-white text-cyan-700 hover:bg-cyan-50"}><TriggerIcon className="h-4 w-4" /><span data-content-plugin-icon-label>图标设置</span></Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="z-[70] w-[min(92vw,360px)] rounded-xl border border-slate-700 bg-slate-900 p-3 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">选择{label}</p><p className="text-xs text-slate-400">客户源图标库与公共素材库</p></div>{(value.url || value.iconName) ? <Button type="button" size="sm" variant="ghost" onClick={() => { onChange({ assetId: null, url: null, iconName: null }); setOpen(false); }} className="h-8 px-2 text-slate-400 hover:bg-slate-800 hover:text-rose-300"><X className="h-4 w-4" /> 移除</Button> : null}</div>
            <input ref={inputRef} type="file" accept={getMediaUploadAccept(["image"])} className="hidden" onChange={handleUpload} />
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading} className="mt-3 w-full border-slate-600 bg-transparent text-slate-200 hover:border-slate-400 hover:bg-slate-800 hover:text-white">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{uploading ? "正在上传..." : "本地上传或使用现有素材"}</Button>
            {value.url ? <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-800 p-1.5"><img src={value.url} alt="已上传自定义图标" className="h-6 w-6 rounded object-contain" /><span className="text-xs text-emerald-400">已上传自定义图标</span></div> : null}
            {useCustomerSourceIconLibrary ? <><p className="mb-1.5 mt-3 text-xs text-slate-400">或选择客户源预设图标</p><div className="grid grid-cols-[repeat(auto-fit,minmax(2.5rem,1fr))] gap-2">{ICON_OPTIONS.map((option) => { const Icon = option.icon; return <button key={option.name} type="button" title={option.name} onClick={() => selectPreset(option.name)} className={`flex h-10 w-full items-center justify-center rounded-lg border transition hover:bg-slate-700 ${value.iconName === option.name && !value.url ? "border-blue-500 bg-blue-600/30 text-blue-400" : "border-slate-700 bg-slate-800 text-slate-400"}`}><Icon className="h-4 w-4" /></button>; })}</div></> : null}
            <div className="mt-3 border-t border-slate-700 pt-3"><p className="mb-2 text-xs font-medium text-slate-400">使用已有图片素材</p>{loadingAssets ? <div className="flex h-16 items-center justify-center text-xs text-slate-400"><Loader2 className="mr-2 h-4 w-4 animate-spin" />正在读取素材</div> : assets.length ? <div className="grid grid-cols-[repeat(auto-fit,minmax(2.5rem,1fr))] gap-2">{assets.slice(0, 10).map((asset) => <button key={asset.assetId} type="button" title={`使用 ${asset.fileName}`} onClick={() => void selectAsset(asset)} className={`aspect-square overflow-hidden rounded-lg border bg-slate-800 p-1 transition hover:border-cyan-400 hover:ring-2 hover:ring-cyan-300/20 ${value.assetId === asset.assetId ? "border-cyan-400 ring-2 ring-cyan-300/20" : "border-slate-700"}`}><img src={asset.publicUrl} alt={asset.fileName} loading="lazy" decoding="async" className="h-full w-full object-contain" /></button>)}</div> : <p className="rounded-lg bg-slate-800 px-3 py-3 text-center text-xs text-slate-400">暂无可用图片素材，可先上传公司商标。</p>}</div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export default ContentPluginIconSetting;
