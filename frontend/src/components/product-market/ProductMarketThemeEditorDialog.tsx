import type { CSSProperties, ComponentType, Dispatch, SetStateAction } from "react";
import { Package, Palette, PanelLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DraggableDialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { resolveAccessibleTextColor } from "@/lib/color-contrast";
import type { CustomThemeData, LayoutCustomStyle } from "@/lib/product-market-store";

type ThemeColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
  label: string;
  textColor?: string;
  surfaceColor?: string;
  hint?: string;
  compact?: boolean;
};

type ProductMarketThemeEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingThemeKey: string | null;
  themeForm: CustomThemeData;
  setThemeForm: Dispatch<SetStateAction<CustomThemeData>>;
  layoutSectionOrder: (id: string) => number;
  visualCornerRadius: string;
  dialogStyle: CSSProperties;
  onSave: () => void;
  colorPicker: ComponentType<ThemeColorPickerProps>;
};

const THEME_EDITOR_FONT_OPTIONS = [
  { label: "思源黑体字", value: "'Noto Sans SC', sans-serif" },
  { label: "思源宋体字", value: "'Noto Serif SC', serif" },
] as const;

const THEME_EDITOR_FONT_WEIGHT_OPTIONS = [
  { label: "细体小字体", value: "300" },
  { label: "中体中字体", value: "400" },
  { label: "粗体粗字体", value: "700" },
] as const;

const THEME_EDITOR_LETTER_SPACING_OPTIONS = [
  { label: "紧凑距离字", value: "0em" },
  { label: "标准距离字", value: "0.02em" },
  { label: "舒展距离字", value: "0.04em" },
] as const;

const FINE_LAYOUT_REGION_OPTIONS = [
  ["topbar", "顶部"],
  ["body", "主体"],
  ["title", "标题"],
  ["table-shell", "表内"],
  ["table-header", "表头"],
  ["content", "内容"],
  ["large-card", "大卡片"],
  ["small-card", "小卡片"],
  ["footer", "尾栏"],
  ["actions", "功能键"],
] as const;

type FineLayoutRegionId = (typeof FINE_LAYOUT_REGION_OPTIONS)[number][0];

export function ProductMarketThemeEditorDialog({
  open,
  onOpenChange,
  editingThemeKey,
  themeForm,
  setThemeForm,
  layoutSectionOrder,
  visualCornerRadius,
  dialogStyle,
  onSave,
  colorPicker: ColorPicker,
}: ProductMarketThemeEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DraggableDialogContent
        data-theme-editor-dialog
        data-shared-dialog-contract="theme-editor"
        data-shared-window-kind="editor"
        data-shared-window-theme-projection="draft-theme-preview"
        data-shared-window-size="editor-wide"
        resizable
        minWidth={360}
        minHeight={360}
        className="flex max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0"
        style={dialogStyle}
      >
        <DialogHeader data-drag-handle data-shared-window-region="title" className="cursor-move px-5 py-4 pr-12">
          <DialogTitle data-shared-title-heading className="flex items-center gap-2 text-lg font-bold">
            <Palette data-shared-window-title-leading-icon className="h-5 w-5" />
            {editingThemeKey ? "编辑主题" : "新增自定义主题"}
          </DialogTitle>
          <DialogDescription data-shared-title-description className="text-sm">
            五项共享契约会自动投影到客户端、代理端与总部端；外部实际功能新增字段时会从同一主题对象同步读取。
          </DialogDescription>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              value={themeForm.name}
              onChange={(event) => setThemeForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="主题名称"
              className="h-8 text-xs"
            />
            <Input
              value={themeForm.description}
              onChange={(event) => setThemeForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="主题说明（可选）"
              className="h-8 text-xs"
            />
          </div>
        </DialogHeader>
        <ScrollArea data-shared-window-region="content" className="min-h-0 flex-1 px-5 py-4">
          <div data-theme-editor-contract-list="true" className="flex flex-col gap-5 pr-2">
            <Card
              data-theme-editor-section="global-font"
              data-theme-editor-contract-source="layout-sections"
              className="theme-editor-section-surface p-4"
              style={{ order: layoutSectionOrder("global-font") }}
            >
              <h4 className="theme-editor-section-heading mb-3 text-sm font-semibold">全局字体</h4>
              <div>
                <Label className="theme-editor-section-label mb-1 block text-[11px]">字体选择</Label>
                <div className="flex gap-2 flex-wrap">
                  {THEME_EDITOR_FONT_OPTIONS.map((font) => (
                    <button
                      key={font.value}
                      data-theme-editor-choice
                      data-shared-selection-control="true"
                      data-selected={themeForm.fontFamily === font.value}
                      aria-pressed={themeForm.fontFamily === font.value}
                      onClick={() => setThemeForm((current) => ({ ...current, fontFamily: font.value, sidebar: { ...current.sidebar, fontFamily: font.value } }))}
                      className="rounded px-2.5 py-1 text-[11px] transition-all"
                      style={{ fontFamily: font.value }}
                    >
                      {font.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="theme-editor-section-label mb-1 block text-[11px]">字体细粗</Label>
                  <div className="flex flex-wrap gap-2">
                    {THEME_EDITOR_FONT_WEIGHT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        data-theme-editor-choice
                        data-shared-selection-control="true"
                        data-selected={themeForm.layout.globalFontWeight === option.value}
                        aria-pressed={themeForm.layout.globalFontWeight === option.value}
                        type="button"
                        onClick={() => setThemeForm((current) => ({ ...current, layout: { ...current.layout, globalFontWeight: option.value }, sidebar: { ...current.sidebar, fontWeight: option.value } }))}
                        className="rounded px-2 py-1 text-[11px]"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="theme-editor-section-label mb-1 block text-[11px]">字间距</Label>
                  <div className="flex flex-wrap gap-2">
                    {THEME_EDITOR_LETTER_SPACING_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        data-theme-editor-choice
                        data-shared-selection-control="true"
                        data-selected={themeForm.layout.globalLetterSpacing === option.value}
                        aria-pressed={themeForm.layout.globalLetterSpacing === option.value}
                        type="button"
                        onClick={() => setThemeForm((current) => ({ ...current, layout: { ...current.layout, globalLetterSpacing: option.value }, sidebar: { ...current.sidebar, letterSpacing: option.value } }))}
                        className="rounded px-2 py-1 text-[11px]"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <Card
              data-theme-editor-section="sidebar-style"
              data-theme-editor-contract-source="layout-sections"
              className="theme-editor-section-surface p-4"
              style={{ order: layoutSectionOrder("sidebar-style") }}
            >
              <h4 className="theme-editor-section-heading mb-3 flex items-center gap-2 text-sm font-semibold">
                <PanelLeft className="h-4 w-4" />
                侧边栏样式
              </h4>
              {(() => {
                const highlight = themeForm.sidebar.activeHighlight || "#0ea5e9";
                const red = parseInt(highlight.slice(1, 3), 16);
                const green = parseInt(highlight.slice(3, 5), 16);
                const blue = parseInt(highlight.slice(5, 7), 16);
                const previewItems = [
                  { label: "服务概览", state: "normal" as const },
                  { label: "AI 智能", state: "active" as const, children: [
                    { label: "AI 建站", state: "normal" as const },
                    { label: "智能客服", state: "selected" as const },
                  ] },
                  { label: "产品管理", state: "hover" as const },
                ];
                return (
                  <div className="rounded-lg mb-3 overflow-hidden text-xs" style={{
                    background: `linear-gradient(to bottom, ${themeForm.sidebar.bgFrom}, ${themeForm.sidebar.bgVia}, ${themeForm.sidebar.bgTo})`,
                    border: `1px solid ${themeForm.sidebar.borderColor}40`,
                    fontFamily: themeForm.sidebar.fontFamily || themeForm.fontFamily,
                  }}>
                    <div className="px-3 py-1.5 flex items-center gap-2" style={{ borderBottom: `1px solid ${themeForm.sidebar.borderColor}30` }}>
                      <div className="w-4 h-4 rounded flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${highlight}, ${themeForm.sidebar.bgFrom})` }}>
                        <span className="text-white text-[7px] font-bold">T</span>
                      </div>
                      <span className="font-semibold text-white text-[10px]">侧边栏实时预览</span>
                    </div>
                    <div className="py-1 px-1.5 space-y-0.5">
                      {previewItems.map((item, index) => (
                        <div key={index}>
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded" style={
                            item.state === "active" ? { background: `linear-gradient(to right, rgba(${red},${green},${blue},0.25), rgba(${red},${green},${blue},0.08))`, color: highlight, borderLeft: `2px solid ${highlight}`, fontWeight: 500 }
                            : item.state === "hover" ? { color: themeForm.sidebar.textColor, backgroundColor: `${themeForm.sidebar.textColor}10`, transform: "scale(1.02) translateX(1px)" }
                            : { color: `${themeForm.sidebar.textColor}e6` }
                          }>
                            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.state === "active" ? highlight : `${themeForm.sidebar.textColor}60` }} />
                            <span>{item.label}</span>
                          </div>
                          {item.children ? (
                            <div className="ml-4 mt-0.5 space-y-0.5 pl-1.5" style={{ borderLeft: `1.5px solid ${themeForm.sidebar.borderColor}30` }}>
                              {item.children.map((child, childIndex) => (
                                <div key={childIndex} className="px-2 py-0.5 rounded text-[10px]" style={
                                  child.state === "selected" ? { color: highlight, backgroundColor: `rgba(${red},${green},${blue},0.15)`, borderLeft: `2px solid ${highlight}`, marginLeft: "-2px", paddingLeft: "8px", fontWeight: 500 }
                                  : { color: `${themeForm.sidebar.textColor}b3` }
                                }>{child.label}</div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <div className="px-2 py-1 flex gap-2 text-[8px]" style={{ borderTop: `1px solid ${themeForm.sidebar.borderColor}30`, color: `${themeForm.sidebar.textColor}80` }}>
                      <span className="flex items-center gap-0.5"><span className="w-1 h-1 rounded-full" style={{ backgroundColor: highlight }} /> 选中</span>
                      <span className="flex items-center gap-0.5"><span className="w-1 h-1 rounded-full" style={{ backgroundColor: `${themeForm.sidebar.textColor}60` }} /> 普通</span>
                      <span className="flex items-center gap-0.5"><span className="w-1 h-1 rounded-full border" style={{ borderColor: `${themeForm.sidebar.textColor}40` }} /> 悬停</span>
                    </div>
                  </div>
                );
              })()}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <ColorPicker value={themeForm.sidebar.bgFrom} onChange={(color) => setThemeForm((current) => ({ ...current, sidebar: { ...current.sidebar, bgFrom: color } }))} label="渐变起始" />
                <ColorPicker value={themeForm.sidebar.bgVia} onChange={(color) => setThemeForm((current) => ({ ...current, sidebar: { ...current.sidebar, bgVia: color } }))} label="渐变中间" />
                <ColorPicker value={themeForm.sidebar.bgTo} onChange={(color) => setThemeForm((current) => ({ ...current, sidebar: { ...current.sidebar, bgTo: color } }))} label="渐变结束" />
                <ColorPicker value={themeForm.sidebar.textColor} onChange={(color) => setThemeForm((current) => ({ ...current, sidebar: { ...current.sidebar, textColor: color } }))} label="文字颜色" />
                <ColorPicker value={themeForm.sidebar.activeHighlight} onChange={(color) => setThemeForm((current) => ({ ...current, sidebar: { ...current.sidebar, activeHighlight: color } }))} label="高亮颜色" />
                <ColorPicker value={themeForm.sidebar.borderColor} onChange={(color) => setThemeForm((current) => ({ ...current, sidebar: { ...current.sidebar, borderColor: color } }))} label="边框颜色" />
              </div>
            </Card>

            <Card
              data-theme-editor-section="product-card-colors"
              data-theme-editor-contract-source="layout-sections"
              className="theme-editor-section-surface p-4"
              style={{ order: layoutSectionOrder("product-card-colors") }}
            >
              <h4 className="theme-editor-section-heading mb-3 text-sm font-semibold">产品卡片颜色</h4>
              <div className="space-y-3">
                <div>
                  <Label className="theme-editor-section-label mb-1.5 block text-[11px] font-medium">开通状态</Label>
                  <div className="flex gap-2 flex-wrap">
                    <ColorPicker value={themeForm.cardActive.bg} onChange={(color) => setThemeForm((current) => ({ ...current, cardActive: { ...current.cardActive, bg: color } }))} label="小卡片底色" />
                    <ColorPicker value={themeForm.cardActive.nameFont || themeForm.cardActive.font} onChange={(color) => setThemeForm((current) => ({ ...current, cardActive: { ...current.cardActive, nameFont: color } }))} label="小卡片字体" />
                    <ColorPicker value={themeForm.cardActive.button} onChange={(color) => setThemeForm((current) => ({ ...current, cardActive: { ...current.cardActive, button: color } }))} label="状态胶囊色" />
                    <ColorPicker value={themeForm.cardActive.font} onChange={(color) => setThemeForm((current) => ({ ...current, cardActive: { ...current.cardActive, font: color } }))} label="状态胶囊字" />
                  </div>
                </div>
                <div>
                  <Label className="theme-editor-section-label mb-1.5 block text-[11px] font-medium">取消状态</Label>
                  <div className="flex gap-2 flex-wrap">
                    <ColorPicker value={themeForm.cardInactive.bg} onChange={(color) => setThemeForm((current) => ({ ...current, cardInactive: { ...current.cardInactive, bg: color } }))} label="小卡片底色" />
                    <ColorPicker value={themeForm.cardInactive.nameFont || themeForm.cardInactive.font} onChange={(color) => setThemeForm((current) => ({ ...current, cardInactive: { ...current.cardInactive, nameFont: color } }))} label="小卡片字体" />
                    <ColorPicker value={themeForm.cardInactive.button} onChange={(color) => setThemeForm((current) => ({ ...current, cardInactive: { ...current.cardInactive, button: color } }))} label="状态胶囊色" />
                    <ColorPicker value={themeForm.cardInactive.font} onChange={(color) => setThemeForm((current) => ({ ...current, cardInactive: { ...current.cardInactive, font: color } }))} label="状态胶囊字" />
                  </div>
                </div>
                <div>
                  <Label className="theme-editor-section-label mb-1.5 block text-[11px] font-medium">隐藏状态</Label>
                  <div className="flex gap-2 flex-wrap">
                    <ColorPicker value={themeForm.cardHidden.bg} onChange={(color) => setThemeForm((current) => ({ ...current, cardHidden: { ...current.cardHidden, bg: color } }))} label="小卡片底色" />
                    <ColorPicker value={themeForm.cardHidden.nameFont || themeForm.cardHidden.font} onChange={(color) => setThemeForm((current) => ({ ...current, cardHidden: { ...current.cardHidden, nameFont: color } }))} label="小卡片字体" />
                    <ColorPicker value={themeForm.cardHidden.button} onChange={(color) => setThemeForm((current) => ({ ...current, cardHidden: { ...current.cardHidden, button: color } }))} label="状态胶囊色" />
                    <ColorPicker value={themeForm.cardHidden.font} onChange={(color) => setThemeForm((current) => ({ ...current, cardHidden: { ...current.cardHidden, font: color } }))} label="状态胶囊字" />
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <p className="theme-editor-section-label mb-1 text-center text-[10px]">实时预览</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {([
                    ["开通", themeForm.cardActive],
                    ["取消", themeForm.cardInactive],
                    ["隐藏", themeForm.cardHidden],
                  ] as const).map(([label, style]) => (
                    <div
                      key={label}
                      className="rounded-lg border p-2 transition-all duration-200"
                      style={{ background: style.bg, borderColor: style.border }}
                    >
                      <div className="mb-1 flex items-center gap-1.5">
                        <div className="flex h-4 w-4 items-center justify-center rounded bg-white/10">
                          <Package className="h-2.5 w-2.5" style={{ color: style.font }} />
                        </div>
                        <span className="truncate text-[9px] font-bold" style={{ color: style.nameFont || style.font }}>
                          产品名称
                        </span>
                      </div>
                      <p className="mb-1 truncate text-[8px]" style={{ color: resolveAccessibleTextColor(style.bg, style.font) }}>描述预览</p>
                      <div className="rounded py-0.5 text-center text-[8px] font-medium" style={{ backgroundColor: style.button, color: resolveAccessibleTextColor(style.button, style.font) }}>
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card
              data-theme-editor-section="content-bg"
              data-theme-editor-contract-source="layout-sections"
              className="theme-editor-section-surface p-4"
              style={{ order: layoutSectionOrder("content-bg") }}
            >
              <h4 className="theme-editor-section-heading mb-3 text-sm font-semibold">客户端右侧栏底色</h4>
              {(() => {
                const layout = themeForm.layout;
                const updateLayout = (patch: Partial<LayoutCustomStyle>) => setThemeForm((current) => ({ ...current, layout: { ...current.layout, ...patch } }));
                const RegionControls = ({ region }: { region: FineLayoutRegionId }) => {
                  if (region === "topbar") return <><ColorPicker compact value={layout.clientTopbarOverrideBgColor || layout.headerBgColor} onChange={(color) => updateLayout({ clientTopbarOverrideBgColor: color })} label="顶部底色" /><ColorPicker compact value={layout.clientTopbarOverrideTextColor || layout.headerTextColor} onChange={(color) => updateLayout({ clientTopbarOverrideTextColor: color })} label="顶部字体" /></>;
                  if (region === "body") return <><ColorPicker compact value={layout.contentBgColor} onChange={(color) => updateLayout({ contentBgColor: color })} label="主体外框色" /><ColorPicker compact value={layout.contentTextColor} onChange={(color) => updateLayout({ contentTextColor: color })} label="主体字体" /></>;
                  if (region === "title") return <><ColorPicker compact value={layout.clientSecondaryTitleBgColor || layout.headerBgColor} onChange={(color) => updateLayout({ clientSecondaryTitleBgColor: color })} label="标题底色" /><ColorPicker compact value={layout.clientSecondaryTitleTextColor || layout.headerTextColor} onChange={(color) => updateLayout({ clientSecondaryTitleTextColor: color })} label="标题字体" /></>;
                  if (region === "table-shell") return <><ColorPicker compact value={layout.clientSecondaryPageBgColor || layout.contentBgColor} onChange={(color) => updateLayout({ clientSecondaryPageBgColor: color })} label="表内底色" /><ColorPicker compact value={layout.clientSecondaryPageTextColor || layout.contentTextColor} onChange={(color) => updateLayout({ clientSecondaryPageTextColor: color })} label="表内字体" /></>;
                  if (region === "table-header") return <><ColorPicker compact value={layout.clientSecondaryListBgColor || layout.contentBgColor} onChange={(color) => updateLayout({ clientSecondaryListBgColor: color })} label="表头底色" /><ColorPicker compact value={layout.clientSecondaryListTextColor || layout.contentTextColor} onChange={(color) => updateLayout({ clientSecondaryListTextColor: color })} label="表头字体" /></>;
                  if (region === "content") return <><ColorPicker compact value={layout.clientSecondaryContentBgColor || layout.contentBgColor} onChange={(color) => updateLayout({ clientSecondaryContentBgColor: color })} label="内容区底色" /><ColorPicker compact value={layout.clientSecondaryContentTextColor || layout.contentTextColor} onChange={(color) => updateLayout({ clientSecondaryContentTextColor: color })} label="内容区字体" /></>;
                  if (region === "large-card") return <><ColorPicker compact value={layout.clientLargeCardBgColor || layout.clientCardBgColor || layout.contentBgColor} onChange={(color) => updateLayout({ clientLargeCardBgColor: color })} label="大卡片底色" /><ColorPicker compact value={layout.clientLargeCardTextColor || layout.clientCardTextColor || layout.contentTextColor} onChange={(color) => updateLayout({ clientLargeCardTextColor: color })} label="大卡片字体" /></>;
                  if (region === "small-card") return <><ColorPicker compact value={layout.clientFeatureCardBgColor || layout.clientCardBgColor || layout.contentBgColor} onChange={(color) => updateLayout({ clientFeatureCardBgColor: color })} label="小卡片底色" /><ColorPicker compact value={layout.clientFeatureCardTextColor || layout.clientCardTextColor || layout.contentTextColor} onChange={(color) => updateLayout({ clientFeatureCardTextColor: color })} label="小卡片字体" /></>;
                  if (region === "footer") return <><ColorPicker compact value={layout.clientFooterOverrideBgColor || themeForm.sidebar.bgTo} onChange={(color) => updateLayout({ clientFooterOverrideBgColor: color })} label="尾栏底色" /><ColorPicker compact value={layout.clientFooterOverrideTextColor || themeForm.sidebar.textColor} onChange={(color) => updateLayout({ clientFooterOverrideTextColor: color })} label="尾栏字体" /></>;
                  return <><ColorPicker compact value={layout.themePanelButtonColor || "#111111"} onChange={(color) => updateLayout({ themePanelButtonColor: color })} label="功能键底色" /><ColorPicker compact value={layout.headerButtonTextColor || "#FFFFFF"} onChange={(color) => updateLayout({ headerButtonTextColor: color })} label="功能键字体" /></>;
                };
                return <div data-layout-fine-editor data-layout-fine-editor-contract="shared-nine-region" className="grid gap-4 lg:grid-cols-2">
                  <div data-theme-editor-real-preview="true" className="overflow-hidden border p-3 text-xs" style={{ background: layout.contentBgColor, color: layout.contentTextColor, borderRadius: visualCornerRadius }}>
                    <div className="mb-2 rounded-lg px-3 py-2" style={{ background: layout.clientTopbarOverrideBgColor || layout.headerBgColor, color: layout.clientTopbarOverrideTextColor || layout.headerTextColor }}>顶部 · 功能键</div>
                    <div className="rounded-t-lg px-3 py-2" style={{ background: layout.clientSecondaryTitleBgColor || layout.headerBgColor, color: layout.clientSecondaryTitleTextColor || layout.headerTextColor }}>标题</div>
                    <div className="p-2" style={{ background: layout.clientSecondaryPageBgColor || layout.contentBgColor, color: layout.clientSecondaryPageTextColor || layout.contentTextColor }}><div className="mb-2 rounded px-2 py-1.5" style={{ background: layout.clientSecondaryListBgColor || layout.contentBgColor, color: layout.clientSecondaryListTextColor || layout.contentTextColor }}>表头</div><div className="rounded p-2" style={{ background: layout.clientSecondaryContentBgColor || layout.contentBgColor, color: layout.clientSecondaryContentTextColor || layout.contentTextColor }}>内容<div className="mt-2 rounded p-2" style={{ background: layout.clientLargeCardBgColor || layout.contentBgColor, color: layout.clientLargeCardTextColor || layout.contentTextColor }}>大卡片<div className="mt-2 rounded px-2 py-1" style={{ background: layout.clientFeatureCardBgColor || layout.contentBgColor, color: layout.clientFeatureCardTextColor || layout.contentTextColor }}>小卡片</div></div></div></div>
                    <div className="mt-2 rounded-lg px-3 py-2" style={{ background: layout.clientFooterOverrideBgColor || themeForm.sidebar.bgTo, color: layout.clientFooterOverrideTextColor || themeForm.sidebar.textColor }}>尾栏</div>
                  </div>
                  <div data-layout-direct-color-cards="true" className="grid min-w-0 gap-2 sm:grid-cols-2">
                    {FINE_LAYOUT_REGION_OPTIONS.map(([id, label]) => <section key={id} data-layout-fine-region={id} className="rounded-lg border border-current/15 p-2"><p className="mb-2 text-xs font-semibold">{label}</p><div className="grid grid-cols-1 gap-2"><RegionControls region={id} /></div></section>)}
                  </div>
                </div>;
              })()}
            </Card>

            <Card
              data-theme-editor-section="customer-service-style"
              data-theme-editor-contract-source="layout-sections"
              className="theme-editor-section-surface p-4"
              style={{ order: layoutSectionOrder("customer-service-style") }}
            >
              <h4 className="theme-editor-section-heading mb-3 text-sm font-semibold">悬浮客服样式</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="theme-editor-section-label mb-1.5 block text-[11px]">入口头像</Label>
                  <div className="flex flex-wrap gap-2">
                    <ColorPicker value={themeForm.layout.customerServiceLauncherBgColor || "#FFFFFF"} onChange={(color) => setThemeForm((current) => ({ ...current, layout: { ...current.layout, customerServiceLauncherBgColor: color } }))} label="底色" />
                    <ColorPicker value={themeForm.layout.customerServiceLauncherIconColor || "#000000"} onChange={(color) => setThemeForm((current) => ({ ...current, layout: { ...current.layout, customerServiceLauncherIconColor: color } }))} label="图标" />
                  </div>
                </div>
                <div>
                  <Label className="theme-editor-section-label mb-1.5 block text-[11px]">聊天窗口</Label>
                  <div className="flex flex-wrap gap-2">
                    <ColorPicker value={themeForm.layout.customerServicePanelBgColor || "#FFFFFF"} onChange={(color) => setThemeForm((current) => ({ ...current, layout: { ...current.layout, customerServicePanelBgColor: color } }))} label="底色" />
                    <ColorPicker value={themeForm.layout.customerServiceInputBorderColor || "#111111"} onChange={(color) => setThemeForm((current) => ({ ...current, layout: { ...current.layout, customerServiceInputBorderColor: color } }))} label="边框" />
                  </div>
                </div>
                <div>
                  <Label className="theme-editor-section-label mb-1.5 block text-[11px]">表头</Label>
                  <div className="flex flex-wrap gap-2">
                    <ColorPicker value={themeForm.layout.customerServicePanelHeaderBgColor || "#FFFFFF"} onChange={(color) => setThemeForm((current) => ({ ...current, layout: { ...current.layout, customerServicePanelHeaderBgColor: color } }))} label="底色" />
                    <ColorPicker value={themeForm.layout.customerServicePanelHeaderTextColor || "#000000"} onChange={(color) => setThemeForm((current) => ({ ...current, layout: { ...current.layout, customerServicePanelHeaderTextColor: color } }))} label="文字" />
                  </div>
                </div>
                <div>
                  <Label className="theme-editor-section-label mb-1.5 block text-[11px]">对话气泡</Label>
                  <div className="flex flex-wrap gap-2">
                    <ColorPicker value={themeForm.layout.customerServiceAssistantMsgBgColor || "#FFFFFF"} onChange={(color) => setThemeForm((current) => ({ ...current, layout: { ...current.layout, customerServiceAssistantMsgBgColor: color } }))} label="专家底色" />
                    <ColorPicker value={themeForm.layout.customerServiceAssistantMsgTextColor || "#000000"} onChange={(color) => setThemeForm((current) => ({ ...current, layout: { ...current.layout, customerServiceAssistantMsgTextColor: color } }))} label="专家文字" />
                    <ColorPicker value={themeForm.layout.customerServiceUserMsgBgColor || "#FFFFFF"} onChange={(color) => setThemeForm((current) => ({ ...current, layout: { ...current.layout, customerServiceUserMsgBgColor: color } }))} label="访客底色" />
                    <ColorPicker value={themeForm.layout.customerServiceUserMsgTextColor || "#000000"} onChange={(color) => setThemeForm((current) => ({ ...current, layout: { ...current.layout, customerServiceUserMsgTextColor: color } }))} label="访客文字" />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </ScrollArea>
        <DialogFooter data-shared-window-region="footer" className="shrink-0 gap-2 px-5 py-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-shared-window-action="secondary"
          >
            取消
          </Button>
          <Button
            onClick={onSave}
            disabled={!themeForm.name.trim()}
            data-shared-window-action="primary"
            className="disabled:opacity-40"
          >
            {editingThemeKey ? "保存修改" : "创建主题"}
          </Button>
        </DialogFooter>
      </DraggableDialogContent>
    </Dialog>
  );
}

export default ProductMarketThemeEditorDialog;
