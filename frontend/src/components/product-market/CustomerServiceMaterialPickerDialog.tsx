import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type RefObject } from "react";
import { Mic2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getMediaUploadAccept } from "@/lib/media-optimization-contract";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DraggableDialogContent,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageFooterLockControls } from "@/components/PageFooterLockControls";
import {
  formatUploadedAvatarDisplayFileName,
} from "@/lib/customer-service-avatar-material-order";
import {
  formatCustomerServiceVoiceLibraryDisplayFileName,
} from "@/lib/customer-service-voice-material-order";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";
import type { MaterialAssetKind, MaterialAssetItem } from "@/lib/material-assets";

export type AvatarMaterialGender = "female" | "male";
export type AvatarMaterialGenderFilter = "all" | AvatarMaterialGender;
export type AudioMaterialCategory = "all" | "female-voice" | "male-voice" | "reminder-sound";
export type MaterialPickerTargetType = "avatar" | "female-voice" | "male-voice" | "reminder-sound";

export type CustomerServiceMaterialPickerTarget = {
  type: MaterialPickerTargetType;
  avatarId?: string;
  voiceGender?: "female" | "male";
  voiceStyleKey?: string;
  soundStyleKey?: string;
  title: string;
  description: string;
  allowedKinds: MaterialAssetKind[];
  emptyText: string;
};

export type CustomerServiceMaterialPickerEntry = {
  type: "stored";
  asset: MaterialAssetItem;
  avatarSequence?: number;
  avatarDisplayLabel?: string;
  voiceSequence?: number;
  audioCategory?: Exclude<AudioMaterialCategory, "all">;
  audioDisplayLabel?: string;
  voiceCoverUrl?: string;
  builtinAvatar?: {
    id: string;
    country: string;
    gender: AvatarMaterialGender;
  };
  virtualReminderStyleKey?: string;
  durationLabel?: string;
  reminderCoverUrl?: string;
  reminderCoverLabel?: string;
};

type PickerColors = {
  shellStyle: CSSProperties;
  headerBg: string;
  headerText: string;
  softBorder: string;
  contentFill: string;
  panelFill: string;
  text: string;
  mutedText: string;
  buttonBg: string;
  buttonText: string;
  previewActiveBg: string;
};

type Props = {
  target: CustomerServiceMaterialPickerTarget;
  entries: CustomerServiceMaterialPickerEntry[];
  loading: boolean;
  avatarGenderFilter: AvatarMaterialGenderFilter;
  audioCategory: AudioMaterialCategory;
  avatarGenderFallback: AvatarMaterialGender;
  restoreAvailable: boolean;
  busyAssetId: string | null;
  activePreviewAssetId: string | null;
  durations: Record<string, string>;
  dimensions: Record<string, string>;
  uploadAccept: string;
  uploadRef: RefObject<HTMLInputElement>;
  replaceRef: RefObject<HTMLInputElement>;
  replaceKind?: MaterialAssetKind;
  colors: PickerColors;
  sourceLocked: boolean;
  pageLocked: boolean;
  columnLocked: boolean;
  onClose: () => void;
  onUploadChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onReplaceChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onAvatarGenderFilterChange: (filter: AvatarMaterialGenderFilter) => void;
  onAudioCategoryChange: (category: Exclude<AudioMaterialCategory, "all"> | "all") => void;
  onUpload: () => void;
  onRefresh: () => void | Promise<void>;
  onRestore: () => void | Promise<void>;
  onRecordDimensions: (assetId: string, width: number, height: number) => void;
  onRecordDuration: (assetId: string, duration: number) => void;
  onApply: (asset: MaterialAssetItem, virtualReminderStyleKey?: string) => void | Promise<void>;
  onReplace: (asset: MaterialAssetItem) => void;
  onPreview: (asset: MaterialAssetItem) => void | Promise<void>;
  onDelete: (asset: MaterialAssetItem) => void;
  onToggleSource: () => void;
  onTogglePage: () => void;
  onToggleColumn: () => void;
  resolveAvatarGender: (entry: CustomerServiceMaterialPickerEntry) => AvatarMaterialGender;
};

const META_TEXT_CLASS = "text-[11px] leading-5 sm:text-xs";

function formatMaterialAssetSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMaterialAssetTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMaterialDisplayFileName(fileName?: string | null) {
  return sanitizeDisplayText(fileName, "未命名素材").replace(/^(\d)\./, "0$1.");
}

function DeferredAudioMetadata({ src, onDuration }: { src: string; onDuration: (duration: number) => void }) {
  const markerRef = useRef<HTMLSpanElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker || typeof IntersectionObserver === "undefined") {
      setEnabled(true);
      return;
    }
    const observer = new IntersectionObserver((items) => {
      if (!items.some((item) => item.isIntersecting)) return;
      setEnabled(true);
      observer.disconnect();
    }, { rootMargin: "240px" });
    observer.observe(marker);
    return () => observer.disconnect();
  }, [src]);

  return (
    <span ref={markerRef} aria-hidden="true" className="block h-px w-px overflow-hidden opacity-0">
      {enabled ? <audio src={src} preload="metadata" onLoadedMetadata={(event) => onDuration(event.currentTarget.duration)} /> : null}
    </span>
  );
}

function filterButtonStyle(selected: boolean, colors: PickerColors): CSSProperties {
  return {
    borderColor: selected ? "var(--tradepro-shared-selection-outline)" : colors.softBorder,
    backgroundColor: selected ? "var(--tradepro-shared-selection-bg)" : colors.contentFill,
    color: selected ? "var(--tradepro-shared-selection-text)" : colors.text,
    boxShadow: selected ? "inset 0 0 0 1px var(--tradepro-shared-selection-outline)" : "none",
  };
}

export function CustomerServiceMaterialPickerDialog({
  target,
  entries,
  loading,
  avatarGenderFilter,
  audioCategory,
  avatarGenderFallback,
  restoreAvailable,
  busyAssetId,
  activePreviewAssetId,
  durations,
  dimensions,
  uploadAccept,
  uploadRef,
  replaceRef,
  replaceKind,
  colors,
  sourceLocked,
  pageLocked,
  columnLocked,
  onClose,
  onUploadChange,
  onReplaceChange,
  onAvatarGenderFilterChange,
  onAudioCategoryChange,
  onUpload,
  onRefresh,
  onRestore,
  onRecordDimensions,
  onRecordDuration,
  onApply,
  onReplace,
  onPreview,
  onDelete,
  onToggleSource,
  onTogglePage,
  onToggleColumn,
  resolveAvatarGender,
}: Props) {
  const uploadVisible = target.type === "avatar"
    ? avatarGenderFilter !== "all"
    : audioCategory !== "all";
  const uploadLabel = target.type === "avatar"
    ? (avatarGenderFilter === "male" || (avatarGenderFilter === "all" && avatarGenderFallback === "male"))
      ? "上传男性新专家"
      : "上传女性新专家"
    : target.type === "reminder-sound"
      ? "上传提醒声音"
      : target.type === "male-voice"
        ? "上传男性声音"
        : "上传女性声音";

  return (
    <Dialog open modal onOpenChange={(open) => { if (!open) onClose(); }}>
      <DraggableDialogContent
        data-shared-dialog-contract="material-picker"
        data-shared-material-order-contract="newest-large-number-first"
        data-shared-window-kind="editor"
        data-shared-window-size="editor-wide"
        showCloseButton
        className="tradepro-dialog-surface flex max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden border p-0"
        resizable
        minWidth={420}
        minHeight={360}
        style={colors.shellStyle}
      >
        <input ref={uploadRef} type="file" accept={uploadAccept} className="hidden" onChange={onUploadChange} />
        <input
          ref={replaceRef}
          type="file"
          accept={getMediaUploadAccept([replaceKind || "image"])}
          className="hidden"
          onChange={onReplaceChange}
        />
        <DialogHeader
          data-drag-handle
          className="relative cursor-move space-y-1 border-b px-5 py-4"
          style={{ backgroundColor: colors.headerBg, color: colors.headerText, borderColor: `${colors.headerText}22` }}
        >
          <DialogTitle className="text-base font-semibold leading-6 sm:text-lg">{target.title || "选择素材"}</DialogTitle>
          <DialogDescription data-dialog-optional-description className="text-xs leading-5 sm:text-sm" style={{ color: `${colors.headerText}cc` }}>
            {target.description || "可本地上传，也可复用已存素材。"}
          </DialogDescription>
        </DialogHeader>

        <div data-shared-window-region="topbar" data-customer-service-material-picker-header className="flex shrink-0 flex-wrap items-center gap-2 p-2" aria-label="素材选择操作">
          {target.type === "avatar" ? (
            <div className="flex flex-wrap items-center gap-2" aria-label="专家头像性别筛选">
              <button type="button" data-customer-service-avatar-gender-filter="all" data-shared-selection-control="true" data-selected={avatarGenderFilter === "all"} aria-pressed={avatarGenderFilter === "all"} onClick={() => onAvatarGenderFilterChange("all")} className="h-8 rounded-md border px-3 text-sm font-medium transition-all hover:brightness-105" style={filterButtonStyle(avatarGenderFilter === "all", colors)}>全部专家</button>
              <span aria-hidden="true" data-customer-service-category-divider="experts" className="h-7 w-px shrink-0 rounded-full" style={{ backgroundColor: colors.softBorder }} />
              <div className="flex flex-wrap items-center gap-2" aria-label="专家性别分类">
                {([["female", "女性专家"], ["male", "男性专家"]] as const).map(([filter, label]) => (
                  <button key={filter} type="button" data-customer-service-avatar-gender-filter={filter} data-shared-selection-control="true" data-selected={avatarGenderFilter === filter} aria-pressed={avatarGenderFilter === filter} onClick={() => onAvatarGenderFilterChange(filter)} className="h-8 rounded-md border px-3 text-sm font-medium transition-all hover:brightness-105" style={filterButtonStyle(avatarGenderFilter === filter, colors)}>{label}</button>
                ))}
              </div>
            </div>
          ) : (
            <div data-customer-service-audio-library-categories="true" className="flex flex-wrap items-center gap-2" aria-label="声音素材分类">
              <button type="button" data-customer-service-audio-category="all" data-shared-selection-control="true" data-selected={audioCategory === "all"} aria-pressed={audioCategory === "all"} onClick={() => onAudioCategoryChange("all")} className="h-8 rounded-md border px-3 text-sm font-medium transition-all hover:brightness-105" style={filterButtonStyle(audioCategory === "all", colors)}>全部声音</button>
              <span aria-hidden="true" data-customer-service-category-divider="sounds" className="h-7 w-px shrink-0 rounded-full" style={{ backgroundColor: colors.softBorder }} />
              <div className="flex flex-wrap items-center gap-2" aria-label="声音类型分类">
                {([["female-voice", "女性声音"], ["male-voice", "男性声音"], ["reminder-sound", "提醒声音"]] as const).map(([category, label]) => (
                  <button key={category} type="button" data-customer-service-audio-category={category} data-shared-selection-control="true" data-selected={audioCategory === category} aria-pressed={audioCategory === category} onClick={() => onAudioCategoryChange(category)} className="h-8 rounded-md border px-3 text-sm font-medium transition-all hover:brightness-105" style={filterButtonStyle(audioCategory === category, colors)}>{label}</button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {uploadVisible ? (
              <Button type="button" onClick={onUpload} className="h-9" style={{ backgroundColor: colors.buttonBg, color: colors.buttonText }}>
                <Upload className="mr-1 h-4 w-4" />{uploadLabel}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => void onRefresh()} disabled={loading} className="h-9" style={{ borderColor: colors.softBorder, backgroundColor: colors.contentFill, color: colors.text }}>
              {loading ? "刷新中..." : "刷新素材"}
            </Button>
            {restoreAvailable ? (
              <Button type="button" variant="outline" onClick={() => void onRestore()} className="h-9" title="清除当前专家的替换素材，恢复对应编号的本地默认素材" style={{ borderColor: colors.softBorder, backgroundColor: colors.contentFill, color: colors.text }}>恢复默认</Button>
            ) : null}
          </div>
        </div>

        <div data-shared-window-region="content" className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-5 py-4">
          {loading && target.type !== "avatar" ? (
            <div className="rounded-xl border px-4 py-10 text-center text-sm" style={{ borderColor: colors.softBorder, backgroundColor: colors.contentFill, color: colors.mutedText }}>正在读取素材资源...</div>
          ) : entries.length === 0 ? (
            <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm" style={{ borderColor: colors.softBorder, backgroundColor: colors.contentFill, color: colors.mutedText }}>
              {target.type === "avatar" && avatarGenderFilter !== "all" ? `暂无${avatarGenderFilter === "female" ? "女性" : "男性"}专家头像素材。` : target.emptyText}
            </div>
          ) : (
            <ScrollArea data-shared-material-picker-list data-shared-material-order="newest-large-number-first" className="min-h-0 flex-1 pr-2">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {entries.map((entry, index) => {
                  const { asset, builtinAvatar } = entry;
                  const assetAudioCategory = entry.audioCategory;
                  const avatarGender = resolveAvatarGender(entry);
                  const previousAvatarGender = index > 0 ? resolveAvatarGender(entries[index - 1]) : undefined;
                  const previousAudioCategory = index > 0 ? entries[index - 1]?.audioCategory : undefined;
                  const showAvatarHeading = target.type === "avatar" && avatarGenderFilter === "all" && avatarGender !== previousAvatarGender;
                  const showAudioHeading = target.type !== "avatar" && audioCategory === "all" && assetAudioCategory && assetAudioCategory !== previousAudioCategory;
                  const categoryLabel = showAvatarHeading
                    ? avatarGender === "female" ? "女性专家" : "男性专家"
                    : assetAudioCategory === "female-voice" ? "女性声音" : assetAudioCategory === "male-voice" ? "男性声音" : "提醒声音";
                  const categoryKey = showAvatarHeading ? `${avatarGender}-expert` : assetAudioCategory;
                  return (
                    <div key={`picker-${asset.assetId}`} className="contents">
                      {showAvatarHeading || showAudioHeading ? (
                        <div data-customer-service-material-library-group={categoryKey} className="col-span-full flex min-w-0 items-center gap-2 pt-1">
                          <div className="flex shrink-0 items-center gap-2"><span aria-hidden="true" className="h-6 w-1 rounded-full" style={{ backgroundColor: "var(--tradepro-shared-selection-outline)" }} /><span className="text-sm font-semibold" style={{ color: colors.text }}>{categoryLabel}</span></div>
                          <span aria-hidden="true" className="h-px min-w-0 flex-1" style={{ backgroundColor: colors.softBorder }} />
                        </div>
                      ) : null}
                      <div
                        data-customer-service-uploaded-avatar-sequence={entry.avatarSequence ? String(entry.avatarSequence).padStart(2, "0") : undefined}
                        data-customer-service-uploaded-voice-sequence={entry.voiceSequence ? String(entry.voiceSequence).padStart(2, "0") : undefined}
                        data-customer-service-builtin-avatar={builtinAvatar?.id}
                        data-customer-service-builtin-avatar-sequence={builtinAvatar && entry.avatarSequence ? String(entry.avatarSequence).padStart(2, "0") : undefined}
                        className="flex min-w-0 flex-col rounded-2xl border p-4"
                        style={{ borderColor: colors.softBorder, backgroundColor: colors.panelFill }}
                      >
                        <div className="flex min-w-0 gap-3">
                          <div className="flex aspect-square w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border sm:w-28" style={{ borderColor: colors.softBorder, backgroundColor: colors.contentFill }}>
                            {asset.kind === "video" ? (
                              <video src={asset.publicUrl} className="h-full w-full object-cover" preload="metadata" onLoadedMetadata={(event) => onRecordDimensions(asset.assetId, event.currentTarget.videoWidth, event.currentTarget.videoHeight)} muted playsInline />
                            ) : asset.kind === "audio" ? (
                              <>
                                <DeferredAudioMetadata src={asset.publicUrl} onDuration={(duration) => onRecordDuration(asset.assetId, duration)} />
                                {entry.reminderCoverUrl ? <img src={entry.reminderCoverUrl} alt={entry.reminderCoverLabel || "提醒声音生肖封面"} title={entry.reminderCoverLabel} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                                  : entry.voiceCoverUrl ? <img src={entry.voiceCoverUrl} alt={assetAudioCategory === "male-voice" ? "男性演讲话筒封面" : "女性讲解话筒封面"} loading="lazy" decoding="async" className="h-full w-full object-cover" onLoad={(event) => onRecordDimensions(asset.assetId, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)} />
                                    : <div className="flex h-full w-full items-center justify-center"><Mic2 className="h-8 w-8" style={{ color: colors.text }} /></div>}
                              </>
                            ) : (
                              <img src={asset.publicUrl} alt={builtinAvatar ? `${builtinAvatar.country}专家头像素材` : asset.fileName} loading="lazy" decoding="async" className="h-full w-full object-cover" onLoad={(event) => onRecordDimensions(asset.assetId, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold" style={{ color: colors.text }}>
                              {entry.audioDisplayLabel || entry.avatarDisplayLabel || (entry.avatarSequence ? formatUploadedAvatarDisplayFileName(asset.fileName, entry.avatarSequence) : entry.voiceSequence ? formatCustomerServiceVoiceLibraryDisplayFileName(asset.fileName, entry.voiceSequence) : formatMaterialDisplayFileName(asset.fileName))}
                            </div>
                            <div className={`mt-2 space-y-1 ${META_TEXT_CLASS}`} style={{ color: colors.mutedText }}>
                              <div title={asset.usageCount > 0 ? `应用明细：${asset.usageLabels.join("、") || "配置中"}` : asset.systemManaged ? "系统默认素材，当前无应用明细" : "当前无应用明细"}>引用：{entry.virtualReminderStyleKey ? "本地默认" : asset.usageCount > 0 ? `${asset.usageCount} 处` : asset.systemManaged ? "系统默认" : "无"}</div>
                              {entry.avatarSequence ? <div>性别：{avatarGender === "male" ? "男" : "女"}·{asset.kind === "video" ? "动态" : "图片"}</div> : null}
                              {assetAudioCategory ? <div>性别：{assetAudioCategory === "reminder-sound" ? "提醒" : assetAudioCategory === "male-voice" ? "男声" : "女声"}</div> : null}
                              <div>大小：{formatMaterialAssetSize(asset.sizeBytes)}</div>
                              <div>尺寸：{asset.kind === "audio" ? entry.durationLabel || durations[asset.assetId] || "读取中…" : target.type === "avatar" ? "250 × 250" : dimensions[asset.assetId] || "读取中…"}</div>
                              <div>时间：{formatMaterialAssetTime(asset.createdAt)}</div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Button type="button" onClick={() => void onApply(asset, entry.virtualReminderStyleKey)} className="h-8 shrink-0 px-3 text-xs" title="使用当前素材" style={{ backgroundColor: colors.buttonBg, color: colors.buttonText }}>使用素材</Button>
                          <Button type="button" variant="outline" className="h-8 shrink-0 px-3 text-xs" disabled={asset.canReplace === false || busyAssetId === asset.assetId} title="保留素材 ID 与全部引用，直接替换存储中的原始文件" onClick={() => onReplace(asset)} style={{ borderColor: colors.softBorder, backgroundColor: colors.contentFill, color: colors.text }}>{busyAssetId === asset.assetId ? "替换中" : "替换"}</Button>
                          <span className="inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-md border px-2 text-[11px] font-semibold" title={`历史累计应用 ${asset.applyCount} 次；当前有 ${asset.usageCount} 处配置正在使用`} style={{ borderColor: colors.softBorder, backgroundColor: colors.contentFill, color: colors.text }}>累计{asset.applyCount}次</span>
                          {asset.kind === "audio" ? <Button type="button" variant="outline" className="h-8 shrink-0 px-2.5 text-xs" title={activePreviewAssetId === asset.assetId ? "停止试听" : "试听当前音频"} aria-label={activePreviewAssetId === asset.assetId ? "停止试听" : "试听当前音频"} onClick={() => void onPreview(asset)} style={{ borderColor: colors.softBorder, backgroundColor: activePreviewAssetId === asset.assetId ? colors.previewActiveBg : colors.contentFill, color: colors.text }}>{activePreviewAssetId === asset.assetId ? "停止试听" : "试听"}</Button> : null}
                          <Button type="button" variant="outline" className="h-8 shrink-0 px-2.5 text-xs" disabled={!asset.canDelete} title={asset.canDelete ? "当前没有配置引用，可以删除" : `仍被 ${asset.usageLabels.join("、") || `${asset.usageCount} 处配置`} 引用`} style={{ borderColor: colors.softBorder, backgroundColor: colors.contentFill, color: colors.text }} onClick={() => onDelete(asset)}>{!asset.canDelete ? "引用中" : "删除"}</Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
        <div data-shared-window-region="footer" data-page-layout-footer data-dialog-resize-safe-area className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-5 py-3">
          <div data-shared-window-footer-leading>
            <PageFooterLockControls compact sourceLocked={sourceLocked} pageLocked={pageLocked} columnLocked={columnLocked} onToggleSource={onToggleSource} onTogglePage={onTogglePage} onToggleColumn={onToggleColumn} />
          </div>
          <span data-shared-window-footer-status>{target.type === "avatar" ? "选择后立即应用到当前专家头像" : target.type === "reminder-sound" ? "选择后立即应用到当前专家提醒音" : "选择后立即应用到当前专家朗音"}</span>
        </div>
      </DraggableDialogContent>
    </Dialog>
  );
}
