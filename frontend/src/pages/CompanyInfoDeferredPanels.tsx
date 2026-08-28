import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import "./CompanyInfoDeferredPanels.css";

import { Copy, Plus, Save, Trash2, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";

import { Switch } from "@/components/ui/switch";

import { ContentPluginActionButton, ContentPluginDragHandle, ContentPluginMoveButtons, ContentPluginOrderBadge, ContentPluginToggle } from "@/components/content-plugins/ContentPluginControls";

import { CompanyProfileGovernance } from "@/components/CompanyProfileGovernance";
import { ProofCenterGovernance } from "@/components/ProofCenterGovernance";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Textarea } from "@/components/ui/textarea";

import { toast } from "@/hooks/use-toast";

import { useProductMarketStore } from "@/lib/product-market-store";

import { type TranslationStatus, type WebsiteBannerItem, type WebsiteContentState, type WebsiteFaqItem, type WebsiteImChannel, type WebsiteSectionEntry, type WebsiteSocialLink } from "@/lib/website-content-store";

export type DeferredCompanyInfoTabKey =
  | "profile"
  | "banner"
  | "recommend"
  | "about"
  | "faq"
  | "factory"
  | "gallery"
  | "exhibition"
  | "service"
  | "logistics"
  | "im"
  | "modules";

type DeferredSectionKey = "about" | "factory" | "gallery" | "exhibition" | "service" | "logistics" | "modules";

type CurrentNavigationMeta = {
  secondaryLabel: string;
  secondaryIcon: LucideIcon;
};

type DeferredCompanyInfoPanelsProps = {
  activeTab: DeferredCompanyInfoTabKey;
  currentNavigationMeta: CurrentNavigationMeta;
  state: WebsiteContentState;
  onSave: () => void;
  updateState: (updater: (draft: WebsiteContentState) => void) => void;
};

const SECTION_META: Record<DeferredSectionKey, { title: string; description: string }> = {
  about: { title: "公司介绍", description: "支持标题、链接、摘要、多图、正文、置顶、启用与排序。" },
  factory: { title: "工厂生产", description: "展示生产线、工厂实力和交付能力。" },
  gallery: { title: "公司风采", description: "展示办公室、展厅、车间、团队等图文内容。" },
  exhibition: { title: "展会活动", description: "展示展会安排、地点、活动说明和图片内容。" },
  service: { title: "服务保障", description: "展示售前、交付、售后、保障流程等图文说明。" },
  logistics: { title: "物流货运", description: "展示海运、空运、铁路、快递等物流说明和优势。" },
  modules: { title: "自定义模块", description: "支持继续新增并沿用公司介绍同结构的页面内容模块。" },
};

const TRANSLATION_LABELS: Record<TranslationStatus, string> = {
  none: "未翻译",
  partial: "部分翻译",
  translated: "已翻译",
};

function withAlpha(color: string, alpha: number) {
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    const value = trimmed.replace("#", "");
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const match = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (match) return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
  return color;
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function cloneWithId<T extends { id: string }>(item: T, prefix: string): T {
  return { ...structuredClone(item), id: uid(prefix) };
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function joinLines(items: string[]) {
  return items.join("\n");
}

function orderItems<T extends { pinned?: boolean; sortOrder?: number | null; id: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    if (Boolean(left.pinned) !== Boolean(right.pinned)) return left.pinned ? -1 : 1;
    const leftOrder = typeof left.sortOrder === "number" ? left.sortOrder : Number.NEGATIVE_INFINITY;
    const rightOrder = typeof right.sortOrder === "number" ? right.sortOrder : Number.NEGATIVE_INFINITY;
    if (leftOrder !== rightOrder) return rightOrder - leftOrder;
    return left.id.localeCompare(right.id);
  });
}

function emptyBanner(): WebsiteBannerItem {
  return {
    id: uid("banner"),
    title: "",
    linkUrl: "",
    summary: "",
    images: [],
    pinned: false,
    enabled: true,
    translationStatus: "none",
    showTextOverlay: true,
    mobileOnly: false,
    sortOrder: null,
  };
}

function emptySection(): WebsiteSectionEntry {
  return {
    id: uid("section"),
    title: "",
    linkUrl: "",
    summary: "",
    images: [],
    content: "",
    pinned: false,
    enabled: true,
    translationStatus: "none",
    sortOrder: null,
  };
}

const MODULE_TEST_CONTENT: Array<Pick<WebsiteSectionEntry, "title" | "summary" | "content">> = [
  { title: "10.生产一线", summary: "展示生产现场、产线节拍与交付能力。", content: "生产一线测试内容：用于验证共享标题、表头、列表、滚条和内容插件。" },
  { title: "09.质量检测", summary: "展示来料、过程与成品质量检测流程。", content: "质量检测测试内容：记录质量控制节点与可追溯机制。" },
  { title: "08.自动加工", summary: "展示自动化设备与稳定加工能力。", content: "自动加工测试内容：验证多条内容在共享列表中的统一间距。" },
  { title: "07.装配测试", summary: "展示装配工序、功能测试与验收标准。", content: "装配测试内容：用于验证内容插件的拖拉、上下移、启用与编辑。" },
  { title: "06.仓储物流", summary: "展示仓储管理、出入库与发运协同。", content: "仓储物流测试内容：验证长列表的单一滚动容器。" },
  { title: "05.包装出货", summary: "展示包装规范、出货检验与交付保护。", content: "包装出货测试内容：验证标题、内容、链接栏的列对齐。" },
  { title: "04.设备维护", summary: "展示设备保养、巡检与持续改善。", content: "设备维护测试内容：验证共享颜色、字体和卡片边距。" },
  { title: "03.工艺研发", summary: "展示工艺验证、样品迭代与研发支持。", content: "工艺研发测试内容：验证置顶、复制和删除操作的统一样式。" },
  { title: "02.安全生产", summary: "展示安全培训、风险管理与现场规范。", content: "安全生产测试内容：验证内容列表的状态与排序显示。" },
  { title: "01.交付复核", summary: "展示最终复核、交付确认与售后衔接。", content: "交付复核测试内容：验证共享工作区底部留白与新增操作。" },
];

function buildMissingModuleTestContent(items: WebsiteSectionEntry[]) {
  const existingTitles = new Set(items.map((item) => item.title.trim()));
  return MODULE_TEST_CONTENT
    .filter((item) => !existingTitles.has(item.title))
    .map((item, index) => ({
      ...emptySection(),
      id: `module-test-${10 - index}-${uid("content")}`,
      ...item,
      linkUrl: `/production-line/${String(10 - index).padStart(2, "0")}`,
      enabled: true,
      translationStatus: "translated" as TranslationStatus,
      sortOrder: 10 - index,
    }));
}

function emptyFaq(): WebsiteFaqItem {
  return {
    id: uid("faq"),
    question: "",
    linkName: "",
    summary: "",
    answer: "",
    pinned: false,
    enabled: true,
    translationStatus: "none",
    sortOrder: null,
  };
}

function emptyIm(): WebsiteImChannel {
  return {
    id: uid("im"),
    platform: "WhatsApp",
    account: "",
    linkUrl: "",
    enabled: true,
    sortOrder: null,
  };
}

function emptySocial(): WebsiteSocialLink {
  return {
    id: uid("sns"),
    platform: "LinkedIn",
    url: "",
    enabled: true,
    sortOrder: null,
  };
}

function SectionHeader({
  title,
  description,
  onSave,
  actions,
  icon,
}: {
  title: string;
  description: string;
  onSave: () => void;
  actions?: ReactNode;
  icon?: LucideIcon;
}) {
  const { layoutStyle, sidebarStyle } = useProductMarketStore();
  const TitleIcon = icon;
  const headerStyle = useMemo(
    () => ({
      backgroundColor:
        layoutStyle.clientSecondaryTitleBgColor ||
        layoutStyle.defaultDialogHeaderBgColor ||
        layoutStyle.headerBgColor ||
        "#0f172a",
      borderColor: withAlpha(sidebarStyle.borderColor || "#ffffff", 0.34),
      color:
        layoutStyle.clientSecondaryTitleTextColor ||
        layoutStyle.defaultDialogHeaderTextColor ||
        layoutStyle.headerTextColor ||
        "#ffffff",
    }),
    [
      layoutStyle.clientSecondaryTitleBgColor,
      layoutStyle.clientSecondaryTitleTextColor,
      layoutStyle.defaultDialogHeaderBgColor,
      layoutStyle.defaultDialogHeaderTextColor,
      layoutStyle.headerBgColor,
      layoutStyle.headerTextColor,
      sidebarStyle.borderColor,
    ]
  );
  const descriptionStyle = useMemo(
    () => ({
      color: withAlpha(
        layoutStyle.clientSecondaryTitleTextColor ||
          layoutStyle.defaultDialogHeaderTextColor ||
          layoutStyle.headerTextColor ||
          "#ffffff",
        0.82
      ),
    }),
    [layoutStyle.clientSecondaryTitleTextColor, layoutStyle.defaultDialogHeaderTextColor, layoutStyle.headerTextColor]
  );
  const buttonStyle = useMemo(
    () => ({
      backgroundColor: layoutStyle.defaultDialogButtonColor || layoutStyle.themePanelButtonColor || "#2563eb",
      color: layoutStyle.defaultDialogButtonTextColor || "#ffffff",
    }),
    [layoutStyle.defaultDialogButtonColor, layoutStyle.defaultDialogButtonTextColor, layoutStyle.themePanelButtonColor]
  );

  return (
    <div data-page-title data-client-section-header data-shared-layout-section="title" data-development-standard-frame-region="title" data-development-standard-frame-label="标题" className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-start sm:justify-between" style={headerStyle}>
      <div data-page-title-content className="min-w-0">
        <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
          {TitleIcon ? <TitleIcon className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" /> : null}
          <span className="truncate">{title}</span>
        </h2>
        <p data-shared-title-description className="mt-0.5 text-xs leading-5 sm:text-sm" style={descriptionStyle}>
          {description}
        </p>
      </div>
      <div data-page-title-actions className="flex flex-wrap items-center gap-2">
        {actions}
        <Button data-shared-title-save-action onClick={onSave} className="border-0 shadow-sm hover:brightness-110" style={buttonStyle}>
          <Save className="mr-2 h-4 w-4" />
          保存设置
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className || ""}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        {required ? <span className="text-red-500">*</span> : null}
        <span>{label}</span>
        {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function BannerManager({
  items,
  onChange,
}: {
  items: WebsiteBannerItem[];
  onChange: (items: WebsiteBannerItem[]) => void;
}) {
  const [editing, setEditing] = useState<WebsiteBannerItem | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const orderedItems = useMemo(() => orderItems(items), [items]);

  const commitOrder = (next: WebsiteBannerItem[]) => {
    onChange(next.map((item, index) => ({ ...item, sortOrder: next.length - index })));
  };

  const moveItem = (id: string, direction: -1 | 1) => {
    const index = orderedItems.findIndex((item) => item.id === id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= orderedItems.length) return;
    const next = [...orderedItems];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    commitOrder(next);
  };

  const moveItemTo = (sourceId: string, targetId: string) => {
    if (!sourceId || sourceId === targetId) return;
    const sourceIndex = orderedItems.findIndex((item) => item.id === sourceId);
    const targetIndex = orderedItems.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const next = [...orderedItems];
    const [source] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, source);
    commitOrder(next);
  };

  const updateItem = (id: string, patch: Partial<WebsiteBannerItem>) => {
    onChange(items.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const upsert = (item: WebsiteBannerItem) => {
    const exists = items.some((current) => current.id === item.id);
    const nextOrder = Math.max(0, ...items.map((current) => current.sortOrder || 0)) + 1;
    const nextItem = exists || item.sortOrder ? item : { ...item, sortOrder: nextOrder };
    const next = exists
      ? items.map((current) => (current.id === item.id ? item : current))
      : [nextItem, ...items];
    onChange(orderItems(next));
  };

  const remove = (id: string) => {
    if (!window.confirm("确定删除这个 Banner 吗？")) return;
    onChange(items.filter((item) => item.id !== id));
  };

  return (
    <section
      data-page-content-stack="table"
      data-page-content-kind="banner"
      data-development-standard-frame-region="table-shell"
      data-development-standard-frame-label="表内"
      data-development-standard-marker-placement="frame-start"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <CardContent
        data-page-list
        data-page-list-layout="table"
        data-shared-layout-section="list"
        data-page-list-scroll-owner
        data-page-list-has-footer
        data-development-standard-frame-region="content"
        data-development-standard-frame-label="内容"
        data-development-standard-marker-placement="content-start"
        className="min-h-0 flex-1 overflow-auto px-0 pb-0 pt-0"
      >
          <Table data-page-table className="page-banner-management-table min-w-[880px] table-fixed">
          <colgroup>
            <col className="w-[40%]" />
            <col className="w-[10%]" />
            <col className="w-[20%]" />
            <col className="w-[12%]" />
            <col className="w-[18%]" />
          </colgroup>
          <TableHeader data-page-table-header data-shared-layout-section="tableHeader" data-development-standard-frame-region="table-header" data-development-standard-frame-label="表头">
            <TableRow>
              <TableHead className="w-[40%]">
                <div className="flex flex-col gap-1"><small>功能设置</small><b>首页大图设置</b></div>
              </TableHead>
              <TableHead className="w-[10%]">
                <div className="flex flex-col gap-1"><small>排序控制</small><b>排号</b></div>
              </TableHead>
              <TableHead colSpan={3} className="w-1/2">
                <div className="flex flex-col gap-1">
                  <small>编辑内容</small>
                  <div className="grid grid-cols-[1.3fr_1fr_1.3fr] gap-2"><b>名称</b><b>语言</b><b>链接</b></div>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderedItems.map((item, index) => (
              <TableRow
                key={item.id}
                data-page-list-item
                data-development-standard-frame-region="large-card"
                data-development-standard-frame-label="大卡片"
                data-development-standard-marker-placement="card-center"
                draggable
                className={draggingId === item.id ? "opacity-60" : undefined}
                onDragStart={() => setDraggingId(item.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  moveItemTo(draggingId || "", item.id);
                  setDraggingId(null);
                }}
                onDragEnd={() => setDraggingId(null)}
              >
                <TableCell>
                  <div className="page-banner-content-actions" data-content-plugin-actions="banner">
                    <ContentPluginDragHandle className="page-banner-icon-action" />
                    <ContentPluginMoveButtons
                      className="page-banner-plugin-move-controls"
                      canMoveUp={index > 0}
                      canMoveDown={index < orderedItems.length - 1}
                      onMoveUp={() => moveItem(item.id, -1)}
                      onMoveDown={() => moveItem(item.id, 1)}
                    />
                    <ContentPluginToggle label="首页大图" checked={item.enabled} onCheckedChange={(enabled) => updateItem(item.id, { enabled })} />
                    <ContentPluginActionButton control="pin" className={item.pinned ? "is-active" : undefined} aria-pressed={item.pinned} onClick={() => updateItem(item.id, { pinned: !item.pinned })}>置顶</ContentPluginActionButton>
                    <ContentPluginActionButton control="copy" onClick={() => commitOrder([cloneWithId(item, "banner"), ...orderedItems])}>复制</ContentPluginActionButton>
                    <ContentPluginActionButton control="edit" onClick={() => setEditing(item)}>编辑</ContentPluginActionButton>
                    <ContentPluginActionButton control="delete" className="page-banner-delete-action" onClick={() => remove(item.id)}><Trash2 className="h-4 w-4" /></ContentPluginActionButton>
                  </div>
                </TableCell>
                {/*
                  Homepage banners retain their priority value internally so
                  pinning, moving and publishing keep their existing behavior.
                  The editor's human-facing sequence is intentionally local to
                  the visible list: the current highest number is shown first
                  (10…01 for ten banners) instead of exposing old seed
                  priorities such as 91–100.
                */}
                <TableCell className="page-banner-order-cell"><ContentPluginOrderBadge order={orderedItems.length - index} /></TableCell>
                <TableCell className="max-w-0">
                  <div data-shared-large-card-text="primary" className="page-banner-name truncate" title={item.title || undefined}>
                    {item.title || "未填写名称"}
                  </div>
                </TableCell>
                <TableCell data-shared-large-card-text="secondary">{TRANSLATION_LABELS[item.translationStatus]}</TableCell>
                <TableCell data-shared-large-card-text="secondary" className="page-banner-link break-all">{item.linkUrl || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div data-content-plugin-list-footer="table" className="page-banner-list-footer flex justify-start">
          <Button className="page-banner-add-button tradepro-panel-action" onClick={() => setEditing(emptyBanner())}>
            <Plus className="mr-2 h-4 w-4" />
            新增 Banner
          </Button>
        </div>
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(open) => (!open ? setEditing(null) : null)}>
        <DialogContent aria-describedby={undefined} className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing?.title ? `编辑 Banner：${editing.title}` : "新增 Banner"}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="grid gap-4 py-2">
              <Field label="标题" required>
                <Input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
              </Field>
              <Field label="链接地址">
                <Input value={editing.linkUrl} onChange={(event) => setEditing({ ...editing, linkUrl: event.target.value })} />
              </Field>
              <Field label="摘要">
                <Textarea value={editing.summary} onChange={(event) => setEditing({ ...editing, summary: event.target.value })} />
              </Field>
              <Field label="图片" hint="每行一张，支持多图">
                <Textarea
                  className="min-h-[110px]"
                  value={joinLines(editing.images)}
                  onChange={(event) => setEditing({ ...editing, images: splitLines(event.target.value) })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="翻译状态">
                  <select
                    value={editing.translationStatus}
                    onChange={(event) => setEditing({ ...editing, translationStatus: event.target.value as TranslationStatus })}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    {Object.entries(TRANSLATION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="排序号" hint="数字越大越靠前">
                  <Input
                    value={editing.sortOrder ?? ""}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        sortOrder: event.target.value ? Number(event.target.value) || null : null,
                      })
                    }
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span>置顶</span>
                  <Switch checked={editing.pinned} onCheckedChange={(checked) => setEditing({ ...editing, pinned: checked })} />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span>启用</span>
                  <ContentPluginToggle
                    data-banner-edit-enabled-plugin
                    label="首页大图"
                    checked={editing.enabled}
                    onCheckedChange={(enabled) => setEditing({ ...editing, enabled })}
                  />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span>图上文字</span>
                  <Switch
                    checked={editing.showTextOverlay}
                    onCheckedChange={(checked) => setEditing({ ...editing, showTextOverlay: checked })}
                  />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span>仅移动端</span>
                  <Switch checked={editing.mobileOnly} onCheckedChange={(checked) => setEditing({ ...editing, mobileOnly: checked })} />
                </label>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (!editing) return;
                if (!editing.title.trim()) {
                  toast({ title: "请填写 Banner 标题" });
                  return;
                }
                upsert(editing);
                setEditing(null);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/**
 * 自定模块不再保留历史的 Card/Table 外壳。它使用与首页大图相同的
 * 标题、表头、列表滚动容器和内容插件；模块本身只提供记录和回调。
 */
function SharedModuleManager({
  items,
  onChange,
}: {
  items: WebsiteSectionEntry[];
  onChange: (items: WebsiteSectionEntry[]) => void;
}) {
  const [editing, setEditing] = useState<WebsiteSectionEntry | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const orderedItems = useMemo(() => orderItems(items), [items]);

  // 首次打开仅含系统默认占位模块时，自动以十条生产测试内容替代该占位项。
  // 它从不触碰已有客户自定义数据；已有模块或已生成测试内容都会跳过初始化。
  useEffect(() => {
    const isUntouchedDefault = items.length === 1 && items[0]?.title.trim() === "自定义模块";
    if (!isUntouchedDefault) return;
    const additions = buildMissingModuleTestContent(items);
    if (additions.length) onChange(orderItems(additions));
  }, [items, onChange]);

  const commitOrder = (next: WebsiteSectionEntry[]) => {
    onChange(next.map((item, index) => ({ ...item, sortOrder: next.length - index })));
  };

  const moveItem = (id: string, direction: -1 | 1) => {
    const index = orderedItems.findIndex((item) => item.id === id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= orderedItems.length) return;
    const next = [...orderedItems];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    commitOrder(next);
  };

  const moveItemTo = (sourceId: string, targetId: string) => {
    if (!sourceId || sourceId === targetId) return;
    const sourceIndex = orderedItems.findIndex((item) => item.id === sourceId);
    const targetIndex = orderedItems.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const next = [...orderedItems];
    const [source] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, source);
    commitOrder(next);
  };

  const updateItem = (id: string, patch: Partial<WebsiteSectionEntry>) => {
    onChange(items.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const upsert = (item: WebsiteSectionEntry) => {
    const exists = items.some((current) => current.id === item.id);
    const nextOrder = Math.max(0, ...items.map((current) => current.sortOrder || 0)) + 1;
    const nextItem = exists || item.sortOrder ? item : { ...item, sortOrder: nextOrder };
    onChange(orderItems(exists ? items.map((current) => current.id === item.id ? nextItem : current) : [nextItem, ...items]));
  };

  const remove = (id: string) => {
    if (!window.confirm("确定删除这条自定模块内容吗？")) return;
    onChange(items.filter((item) => item.id !== id));
  };

  const generateTestContent = () => {
    const additions = buildMissingModuleTestContent(items);

    if (!additions.length) {
      toast({ title: "10 条生产测试内容已存在" });
      return;
    }
    onChange(orderItems([...additions, ...items]));
    toast({ title: `已生成 ${additions.length} 条生产测试内容` });
  };

  return (
    <section
      data-page-content-stack="table"
      data-page-content-kind="module"
      data-company-module-shared-workspace
      data-development-standard-frame-region="table-shell"
      data-development-standard-frame-label="表内"
      data-development-standard-marker-placement="frame-start"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <CardContent
        data-page-list
        data-page-list-layout="table"
        data-shared-layout-section="list"
        data-page-list-scroll-owner
        data-page-list-has-footer
        data-development-standard-frame-region="content"
        data-development-standard-frame-label="内容"
        data-development-standard-marker-placement="content-start"
        className="min-h-0 flex-1 overflow-auto px-0 pb-0 pt-0"
      >
        <Table data-page-table className="page-banner-management-table company-module-management-table min-w-[880px] table-fixed">
          <colgroup>
            <col className="w-[40%]" />
            <col className="w-[10%]" />
            <col className="w-[20%]" />
            <col className="w-[12%]" />
            <col className="w-[18%]" />
          </colgroup>
          <TableHeader data-page-table-header data-shared-layout-section="tableHeader" data-development-standard-frame-region="table-header" data-development-standard-frame-label="表头">
            <TableRow>
              <TableHead className="w-[40%]"><div className="flex flex-col gap-1"><small>功能设置</small><b>自定模块设置</b></div></TableHead>
              <TableHead className="w-[10%]"><div className="flex flex-col gap-1"><small>排序控制</small><b>排号</b></div></TableHead>
              <TableHead colSpan={3} className="w-1/2"><div className="flex flex-col gap-1"><small>编辑内容</small><div className="grid grid-cols-[1.3fr_1fr_1.3fr] gap-2"><b>名称</b><b>语言</b><b>链接</b></div></div></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderedItems.map((item, index) => (
              <TableRow
                key={item.id}
                data-page-list-item
                data-development-standard-frame-region="large-card"
                data-development-standard-frame-label="大卡片"
                data-development-standard-marker-placement="card-center"
                draggable
                className={draggingId === item.id ? "opacity-60" : undefined}
                onDragStart={() => setDraggingId(item.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => { moveItemTo(draggingId || "", item.id); setDraggingId(null); }}
                onDragEnd={() => setDraggingId(null)}
              >
                <TableCell>
                  <div className="page-banner-content-actions" data-content-plugin-actions="module">
                    <ContentPluginDragHandle className="page-banner-icon-action" />
                    <ContentPluginMoveButtons
                      className="page-banner-plugin-move-controls"
                      canMoveUp={index > 0}
                      canMoveDown={index < orderedItems.length - 1}
                      onMoveUp={() => moveItem(item.id, -1)}
                      onMoveDown={() => moveItem(item.id, 1)}
                    />
                    <ContentPluginToggle label="自定模块" checked={item.enabled} onCheckedChange={(enabled) => updateItem(item.id, { enabled })} />
                    <ContentPluginActionButton control="pin" className={item.pinned ? "is-active" : undefined} aria-pressed={item.pinned} onClick={() => updateItem(item.id, { pinned: !item.pinned })}>置顶</ContentPluginActionButton>
                    <ContentPluginActionButton control="copy" onClick={() => commitOrder([cloneWithId(item, "module"), ...orderedItems])}>复制</ContentPluginActionButton>
                    <ContentPluginActionButton control="edit" onClick={() => setEditing(item)}>编辑</ContentPluginActionButton>
                    <ContentPluginActionButton control="delete" className="page-banner-delete-action" onClick={() => remove(item.id)}><Trash2 className="h-4 w-4" /></ContentPluginActionButton>
                  </div>
                </TableCell>
                <TableCell className="page-banner-order-cell"><ContentPluginOrderBadge order={orderedItems.length - index} /></TableCell>
                <TableCell className="max-w-0"><div data-shared-large-card-text="primary" className="page-banner-name truncate" title={item.title || undefined}>{item.title || "未填写名称"}</div></TableCell>
                <TableCell data-shared-large-card-text="secondary">{TRANSLATION_LABELS[item.translationStatus]}</TableCell>
                <TableCell data-shared-large-card-text="secondary" className="page-banner-link break-all">{item.linkUrl || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div data-content-plugin-list-footer="table" className="page-banner-list-footer flex flex-wrap justify-start gap-2">
          <Button className="page-banner-add-button tradepro-panel-action" onClick={() => setEditing(emptySection())}><Plus className="mr-2 h-4 w-4" />新增内容</Button>
          <Button variant="outline" className="page-banner-add-button" onClick={generateTestContent}>生成10条内容</Button>
        </div>
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(open) => (!open ? setEditing(null) : null)}>
        <DialogContent aria-describedby={undefined} className="max-h-[calc(100vh-2rem)] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.title ? `编辑自定模块：${editing.title}` : "新增自定模块"}</DialogTitle></DialogHeader>
          {editing ? (
            <div className="grid gap-4 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="标题" required><Input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></Field>
                <Field label="链接地址"><Input value={editing.linkUrl} onChange={(event) => setEditing({ ...editing, linkUrl: event.target.value })} /></Field>
              </div>
              <Field label="摘要"><Textarea value={editing.summary} onChange={(event) => setEditing({ ...editing, summary: event.target.value })} /></Field>
              <Field label="图片" hint="每行一张，支持多图"><Textarea className="min-h-[110px]" value={joinLines(editing.images)} onChange={(event) => setEditing({ ...editing, images: splitLines(event.target.value) })} /></Field>
              <Field label="正文描述"><Textarea className="min-h-[220px]" value={editing.content} onChange={(event) => setEditing({ ...editing, content: event.target.value })} /></Field>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="翻译状态"><select value={editing.translationStatus} onChange={(event) => setEditing({ ...editing, translationStatus: event.target.value as TranslationStatus })} className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">{Object.entries(TRANSLATION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                <Field label="排序号" hint="数字越大越靠前"><Input value={editing.sortOrder ?? ""} onChange={(event) => setEditing({ ...editing, sortOrder: event.target.value ? Number(event.target.value) || null : null })} /></Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"><span>置顶</span><Switch checked={editing.pinned} onCheckedChange={(checked) => setEditing({ ...editing, pinned: checked })} /></label>
                <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"><span>启用</span><Switch checked={editing.enabled} onCheckedChange={(checked) => setEditing({ ...editing, enabled: checked })} /></label>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
            <Button onClick={() => { if (!editing) return; if (!editing.title.trim()) { toast({ title: "请填写模块标题" }); return; } upsert(editing); setEditing(null); }} className="bg-blue-600 hover:bg-blue-700">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function SectionListEditor({
  title,
  items,
  onChange,
}: {
  title: string;
  items: WebsiteSectionEntry[];
  onChange: (items: WebsiteSectionEntry[]) => void;
}) {
  const { layoutStyle, sidebarStyle } = useProductMarketStore();
  const [editing, setEditing] = useState<WebsiteSectionEntry | null>(null);
  const listWrapperStyle = useMemo(
    () => ({
      backgroundColor:
        layoutStyle.clientFeatureCardBgColor ||
        layoutStyle.clientCardBgColor ||
        layoutStyle.defaultDialogContentBgColor ||
        layoutStyle.defaultDialogBgColor ||
        "#ffffff",
      borderColor: withAlpha(sidebarStyle.borderColor || "#94a3b8", 0.28),
      color:
        layoutStyle.clientFeatureCardTextColor ||
        layoutStyle.clientCardTextColor ||
        layoutStyle.contentTextColor ||
        layoutStyle.themePanelTextColor ||
        "#0f172a",
    }),
    [
      layoutStyle.clientFeatureCardBgColor,
      layoutStyle.clientCardBgColor,
      layoutStyle.clientFeatureCardTextColor,
      layoutStyle.clientCardTextColor,
      layoutStyle.contentTextColor,
      layoutStyle.defaultDialogBgColor,
      layoutStyle.defaultDialogContentBgColor,
      layoutStyle.themePanelTextColor,
      sidebarStyle.borderColor,
    ]
  );

  const upsert = (item: WebsiteSectionEntry) => {
    const next = items.some((current) => current.id === item.id)
      ? items.map((current) => (current.id === item.id ? item : current))
      : [item, ...items];
    onChange(orderItems(next));
  };

  const remove = (id: string) => {
    if (!window.confirm(`确定删除“${title}”中的这条内容吗？`)) return;
    onChange(items.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border" style={listWrapperStyle}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>标题</TableHead>
              <TableHead>图片数</TableHead>
              <TableHead>置顶</TableHead>
              <TableHead>启用</TableHead>
              <TableHead>翻译</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderItems(items).map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-xs text-slate-500">{item.id}</TableCell>
                <TableCell>
                  <div className="font-medium text-slate-900">{item.title || "未填写标题"}</div>
                  <div className="mt-1 text-xs text-slate-500">排序：{item.sortOrder ?? "-"}</div>
                </TableCell>
                <TableCell>{item.images.length}</TableCell>
                <TableCell>{item.pinned ? "是" : "否"}</TableCell>
                <TableCell>{item.enabled ? "是" : "否"}</TableCell>
                <TableCell>{TRANSLATION_LABELS[item.translationStatus]}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(item)}>
                      编辑
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onChange([cloneWithId(item, "section"), ...items])}>
                      <Copy className="mr-1 h-3.5 w-3.5" />
                      复制
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => remove(item.id)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      删除
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setEditing(emptySection())}>
        <Plus className="mr-2 h-4 w-4" />
        新增内容
      </Button>

      <Dialog open={!!editing} onOpenChange={(open) => (!open ? setEditing(null) : null)}>
        <DialogContent aria-describedby={undefined} className="max-h-[calc(100vh-2rem)] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.title ? `编辑 ${title}：${editing.title}` : `新增 ${title}`}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="grid gap-4 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="标题" required>
                  <Input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
                </Field>
                <Field label="链接地址">
                  <Input value={editing.linkUrl} onChange={(event) => setEditing({ ...editing, linkUrl: event.target.value })} />
                </Field>
              </div>
              <Field label="摘要">
                <Textarea value={editing.summary} onChange={(event) => setEditing({ ...editing, summary: event.target.value })} />
              </Field>
              <Field label="图片" hint="每行一张，支持多图">
                <Textarea
                  className="min-h-[110px]"
                  value={joinLines(editing.images)}
                  onChange={(event) => setEditing({ ...editing, images: splitLines(event.target.value) })}
                />
              </Field>
              <Field label="正文描述">
                <Textarea
                  className="min-h-[220px]"
                  value={editing.content}
                  onChange={(event) => setEditing({ ...editing, content: event.target.value })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="翻译状态">
                  <select
                    value={editing.translationStatus}
                    onChange={(event) => setEditing({ ...editing, translationStatus: event.target.value as TranslationStatus })}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    {Object.entries(TRANSLATION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="排序号" hint="数字越大越靠前">
                  <Input
                    value={editing.sortOrder ?? ""}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        sortOrder: event.target.value ? Number(event.target.value) || null : null,
                      })
                    }
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span>置顶</span>
                  <Switch checked={editing.pinned} onCheckedChange={(checked) => setEditing({ ...editing, pinned: checked })} />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span>启用</span>
                  <Switch checked={editing.enabled} onCheckedChange={(checked) => setEditing({ ...editing, enabled: checked })} />
                </label>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (!editing) return;
                if (!editing.title.trim()) {
                  toast({ title: "请填写标题" });
                  return;
                }
                upsert(editing);
                setEditing(null);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FaqManager({
  items,
  onChange,
}: {
  items: WebsiteFaqItem[];
  onChange: (items: WebsiteFaqItem[]) => void;
}) {
  const [editing, setEditing] = useState<WebsiteFaqItem | null>(null);

  const upsert = (item: WebsiteFaqItem) => {
    const next = items.some((current) => current.id === item.id)
      ? items.map((current) => (current.id === item.id ? item : current))
      : [item, ...items];
    onChange(orderItems(next));
  };

  const remove = (id: string) => {
    if (!window.confirm("确定删除这个 FAQ 吗？")) return;
    onChange(items.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>问题</TableHead>
              <TableHead>置顶</TableHead>
              <TableHead>启用</TableHead>
              <TableHead>翻译</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderItems(items).map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-xs text-slate-500">{item.id}</TableCell>
                <TableCell>
                  <div className="font-medium text-slate-900">{item.question || "未填写问题"}</div>
                  <div className="mt-1 text-xs text-slate-500">排序：{item.sortOrder ?? "-"}</div>
                </TableCell>
                <TableCell>{item.pinned ? "是" : "否"}</TableCell>
                <TableCell>{item.enabled ? "是" : "否"}</TableCell>
                <TableCell>{TRANSLATION_LABELS[item.translationStatus]}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(item)}>
                      编辑
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onChange([cloneWithId(item, "faq"), ...items])}>
                      <Copy className="mr-1 h-3.5 w-3.5" />
                      复制
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => remove(item.id)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      删除
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setEditing(emptyFaq())}>
        <Plus className="mr-2 h-4 w-4" />
        新增 FAQ
      </Button>

      <Dialog open={!!editing} onOpenChange={(open) => (!open ? setEditing(null) : null)}>
        <DialogContent aria-describedby={undefined} className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing?.question ? `编辑 FAQ：${editing.question}` : "新增 FAQ"}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="grid gap-4 py-2">
              <Field label="问题" required>
                <Input value={editing.question} onChange={(event) => setEditing({ ...editing, question: event.target.value })} />
              </Field>
              <Field label="链接名">
                <Input value={editing.linkName} onChange={(event) => setEditing({ ...editing, linkName: event.target.value })} />
              </Field>
              <Field label="摘要">
                <Textarea value={editing.summary} onChange={(event) => setEditing({ ...editing, summary: event.target.value })} />
              </Field>
              <Field label="回答" required>
                <Textarea
                  className="min-h-[220px]"
                  value={editing.answer}
                  onChange={(event) => setEditing({ ...editing, answer: event.target.value })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="翻译状态">
                  <select
                    value={editing.translationStatus}
                    onChange={(event) => setEditing({ ...editing, translationStatus: event.target.value as TranslationStatus })}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    {Object.entries(TRANSLATION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="排序号" hint="数字越大越靠前">
                  <Input
                    value={editing.sortOrder ?? ""}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        sortOrder: event.target.value ? Number(event.target.value) || null : null,
                      })
                    }
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span>置顶</span>
                  <Switch checked={editing.pinned} onCheckedChange={(checked) => setEditing({ ...editing, pinned: checked })} />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span>启用</span>
                  <Switch checked={editing.enabled} onCheckedChange={(checked) => setEditing({ ...editing, enabled: checked })} />
                </label>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (!editing) return;
                if (!editing.question.trim() || !editing.answer.trim()) {
                  toast({ title: "请填写问题和回答" });
                  return;
                }
                upsert(editing);
                setEditing(null);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImSocialManager({
  channels,
  socialLinks,
  onChangeChannels,
  onChangeSocial,
}: {
  channels: WebsiteImChannel[];
  socialLinks: WebsiteSocialLink[];
  onChangeChannels: (channels: WebsiteImChannel[]) => void;
  onChangeSocial: (links: WebsiteSocialLink[]) => void;
}) {
  const { layoutStyle, sidebarStyle } = useProductMarketStore();
  const [editingIm, setEditingIm] = useState<WebsiteImChannel | null>(null);
  const [editingSocial, setEditingSocial] = useState<WebsiteSocialLink | null>(null);
  const panelCardStyle = useMemo<CSSProperties>(
    () => ({
      backgroundColor:
        layoutStyle.clientFeatureCardBgColor ||
        layoutStyle.clientCardBgColor ||
        layoutStyle.defaultDialogContentBgColor ||
        layoutStyle.defaultDialogBgColor ||
        "#ffffff",
      borderColor: withAlpha(sidebarStyle.borderColor || "#ffffff", 0.28),
      color:
        layoutStyle.clientFeatureCardTextColor ||
        layoutStyle.clientCardTextColor ||
        layoutStyle.contentTextColor ||
        "#0A1A11",
    }),
    [
      layoutStyle.clientFeatureCardBgColor,
      layoutStyle.clientCardBgColor,
      layoutStyle.clientFeatureCardTextColor,
      layoutStyle.clientCardTextColor,
      layoutStyle.contentTextColor,
      layoutStyle.defaultDialogBgColor,
      layoutStyle.defaultDialogContentBgColor,
      sidebarStyle.borderColor,
    ]
  );

  const upsertIm = (item: WebsiteImChannel) => {
    const next = channels.some((current) => current.id === item.id)
      ? channels.map((current) => (current.id === item.id ? item : current))
      : [item, ...channels];
    onChangeChannels(orderItems(next as Array<WebsiteImChannel & { pinned?: boolean }>));
  };

  const upsertSocial = (item: WebsiteSocialLink) => {
    const next = socialLinks.some((current) => current.id === item.id)
      ? socialLinks.map((current) => (current.id === item.id ? item : current))
      : [item, ...socialLinks];
    onChangeSocial(orderItems(next as Array<WebsiteSocialLink & { pinned?: boolean }>));
  };

  return (
    <div className="space-y-6">
      <Card className="border" style={panelCardStyle}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">IM 客服</CardTitle>
            <CardDescription>支持增加国际聊天软件类型和联系账号。</CardDescription>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setEditingIm(emptyIm())}>
            <Plus className="mr-2 h-4 w-4" />
            新增 IM
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>平台</TableHead>
                <TableHead>账号</TableHead>
                <TableHead>链接</TableHead>
                <TableHead>启用</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.platform}</TableCell>
                  <TableCell>{item.account || "-"}</TableCell>
                  <TableCell className="max-w-[260px] truncate text-xs text-slate-500">{item.linkUrl || "-"}</TableCell>
                  <TableCell>{item.enabled ? "是" : "否"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingIm(item)}>
                        编辑
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => onChangeChannels(channels.filter((current) => current.id !== item.id))}>
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border" style={panelCardStyle}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">SNS 社媒</CardTitle>
            <CardDescription>支持增加各种国际社媒链接。</CardDescription>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setEditingSocial(emptySocial())}>
            <Plus className="mr-2 h-4 w-4" />
            新增 SNS
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>平台</TableHead>
                <TableHead>链接</TableHead>
                <TableHead>启用</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {socialLinks.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.platform}</TableCell>
                  <TableCell className="max-w-[320px] truncate text-xs text-slate-500">{item.url || "-"}</TableCell>
                  <TableCell>{item.enabled ? "是" : "否"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingSocial(item)}>
                        编辑
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => onChangeSocial(socialLinks.filter((current) => current.id !== item.id))}>
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editingIm} onOpenChange={(open) => (!open ? setEditingIm(null) : null)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingIm?.platform ? `编辑 IM：${editingIm.platform}` : "新增 IM"}</DialogTitle>
          </DialogHeader>
          {editingIm ? (
            <div className="grid gap-4 py-2">
              <Field label="平台" required>
                <Input value={editingIm.platform} onChange={(event) => setEditingIm({ ...editingIm, platform: event.target.value })} />
              </Field>
              <Field label="账号" required>
                <Input value={editingIm.account} onChange={(event) => setEditingIm({ ...editingIm, account: event.target.value })} />
              </Field>
              <Field label="链接地址">
                <Input value={editingIm.linkUrl} onChange={(event) => setEditingIm({ ...editingIm, linkUrl: event.target.value })} />
              </Field>
              <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <span>启用</span>
                <Switch checked={editingIm.enabled} onCheckedChange={(checked) => setEditingIm({ ...editingIm, enabled: checked })} />
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingIm(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (!editingIm) return;
                if (!editingIm.platform.trim() || !editingIm.account.trim()) {
                  toast({ title: "请填写平台和账号" });
                  return;
                }
                upsertIm(editingIm);
                setEditingIm(null);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingSocial} onOpenChange={(open) => (!open ? setEditingSocial(null) : null)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingSocial?.platform ? `编辑 SNS：${editingSocial.platform}` : "新增 SNS"}</DialogTitle>
          </DialogHeader>
          {editingSocial ? (
            <div className="grid gap-4 py-2">
              <Field label="平台" required>
                <Input
                  value={editingSocial.platform}
                  onChange={(event) => setEditingSocial({ ...editingSocial, platform: event.target.value })}
                />
              </Field>
              <Field label="链接" required>
                <Input value={editingSocial.url} onChange={(event) => setEditingSocial({ ...editingSocial, url: event.target.value })} />
              </Field>
              <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <span>启用</span>
                <Switch checked={editingSocial.enabled} onCheckedChange={(checked) => setEditingSocial({ ...editingSocial, enabled: checked })} />
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSocial(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (!editingSocial) return;
                if (!editingSocial.platform.trim() || !editingSocial.url.trim()) {
                  toast({ title: "请填写平台和链接" });
                  return;
                }
                upsertSocial(editingSocial);
                setEditingSocial(null);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CompanyInfoDeferredPanels({
  activeTab,
  currentNavigationMeta,
  state,
  onSave,
  updateState,
}: DeferredCompanyInfoPanelsProps) {
  const { layoutStyle, sidebarStyle } = useProductMarketStore();
  const panelCardStyle = useMemo<CSSProperties>(
    () => ({
      backgroundColor:
        layoutStyle.clientFeatureCardBgColor ||
        layoutStyle.clientCardBgColor ||
        layoutStyle.defaultDialogContentBgColor ||
        layoutStyle.defaultDialogBgColor ||
        "#ffffff",
      borderColor: withAlpha(sidebarStyle.borderColor || "#ffffff", 0.28),
      color:
        layoutStyle.clientFeatureCardTextColor ||
        layoutStyle.clientCardTextColor ||
        layoutStyle.contentTextColor ||
        "#0A1A11",
    }),
    [
      layoutStyle.clientFeatureCardBgColor,
      layoutStyle.clientCardBgColor,
      layoutStyle.clientFeatureCardTextColor,
      layoutStyle.clientCardTextColor,
      layoutStyle.contentTextColor,
      layoutStyle.defaultDialogBgColor,
      layoutStyle.defaultDialogContentBgColor,
      sidebarStyle.borderColor,
    ]
  );

  if (activeTab === "service") return <div className="space-y-4"><ProofCenterGovernance /></div>;

  if (activeTab === "profile") {
    const profile = state.profile;
    const setProfile = (key: keyof WebsiteContentState["profile"], value: string) =>
      updateState((draft) => void (draft.profile[key] = value));

    return (
      <div className="space-y-4">
        <SectionHeader
          title={currentNavigationMeta.secondaryLabel}
          description="基础企业信息会同步到网站计划与网站内容。"
          onSave={onSave}
          icon={currentNavigationMeta.secondaryIcon}
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="border" style={panelCardStyle}>
            <CardHeader>
              <CardTitle className="text-base">企业基础资料</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 p-5">
              <Field label="站点计划名称" required>
                <Input value={profile.companyName} onChange={(event) => setProfile("companyName", event.target.value)} />
              </Field>
              <Field label="公司英文名称" required>
                <Input value={profile.companyEnglishName} onChange={(event) => setProfile("companyEnglishName", event.target.value)} />
              </Field>
              <Field label="企业 Logo">
                <Input value={profile.logoUrl} onChange={(event) => setProfile("logoUrl", event.target.value)} />
              </Field>
              <Field label="Logo Alt">
                <Input value={profile.logoAlt} onChange={(event) => setProfile("logoAlt", event.target.value)} />
              </Field>
              <Field label="首页标题">
                <Input value={profile.homepageTitle} onChange={(event) => setProfile("homepageTitle", event.target.value)} />
              </Field>
              <Field label="联系人">
                <Input value={profile.contactPerson} onChange={(event) => setProfile("contactPerson", event.target.value)} />
              </Field>
              <Field label="联系电话">
                <Input value={profile.phone} onChange={(event) => setProfile("phone", event.target.value)} />
              </Field>
              <Field label="邮箱">
                <Input value={profile.email} onChange={(event) => setProfile("email", event.target.value)} />
              </Field>
            </CardContent>
          </Card>

          <Card className="border" style={panelCardStyle}>
            <CardHeader>
              <CardTitle className="text-base">地址与经营信息</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 p-5">
              <Field label="办公地址">
                <Input value={profile.officeAddress} onChange={(event) => setProfile("officeAddress", event.target.value)} />
              </Field>
              <Field label="工厂地址">
                <Input value={profile.factoryAddress} onChange={(event) => setProfile("factoryAddress", event.target.value)} />
              </Field>
              <Field label="主营市场">
                <Input value={profile.mainMarkets} onChange={(event) => setProfile("mainMarkets", event.target.value)} />
              </Field>
              <Field label="业务类型">
                <Input value={profile.businessType} onChange={(event) => setProfile("businessType", event.target.value)} />
              </Field>
              <Field label="品牌名称">
                <Input value={profile.brandName} onChange={(event) => setProfile("brandName", event.target.value)} />
              </Field>
              <Field label="员工人数">
                <Input value={profile.employees} onChange={(event) => setProfile("employees", event.target.value)} />
              </Field>
              <Field label="年销售额">
                <Input value={profile.annualSales} onChange={(event) => setProfile("annualSales", event.target.value)} />
              </Field>
              <Field label="官网地址">
                <Input value={profile.website} onChange={(event) => setProfile("website", event.target.value)} />
              </Field>
            </CardContent>
          </Card>
        </div>
        <CompanyProfileGovernance profileManifest={profile} />
      </div>
    );
  }

  if (activeTab === "banner") {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SectionHeader
          title={currentNavigationMeta.secondaryLabel}
          description="支持多图、置顶、启用、移动端和图片文字展示。"
          onSave={onSave}
          icon={currentNavigationMeta.secondaryIcon}
        />
        <BannerManager items={state.banner.items} onChange={(items) => updateState((draft) => void (draft.banner.items = items))} />
      </div>
    );
  }

  if (activeTab === "recommend") {
    return (
      <div className="page-recommend-panel">
        <SectionHeader
          title={currentNavigationMeta.secondaryLabel}
          description="当前推荐区说明会同步到网站产品推荐模块。"
          onSave={onSave}
          icon={currentNavigationMeta.secondaryIcon}
        />
        <section data-page-content-stack="operations" className="page-recommend-content-stack">
          <Card
            data-page-operations-header
            className="page-recommend-operations-header overflow-hidden"
          >
            <CardContent className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>内容设置</span>
              <b>推荐说明</b>
            </CardContent>
          </Card>
          <div data-page-list className="page-recommend-card-grid">
            <Card data-page-list-item className="page-recommend-note-card">
              <CardContent className="p-5">
              <Field label="推荐说明" className="page-recommend-note-field">
                <Textarea
                  className="min-h-[180px]"
                  value={state.recommend.note}
                  onChange={(event) => updateState((draft) => void (draft.recommend.note = event.target.value))}
                />
              </Field>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    );
  }

  if (activeTab === "faq") {
    return (
      <div className="space-y-4">
        <SectionHeader
          title={currentNavigationMeta.secondaryLabel}
          description="支持问题、链接名、摘要、回答、置顶、启用和排序。"
          onSave={onSave}
          icon={currentNavigationMeta.secondaryIcon}
        />
        <FaqManager items={state.faq} onChange={(items) => updateState((draft) => void (draft.faq = items))} />
      </div>
    );
  }

  if (activeTab === "im") {
    return (
      <div className="space-y-4">
        <SectionHeader
          title={currentNavigationMeta.secondaryLabel}
          description="支持增加国际聊天软件类型和各种国际社媒链接。"
          onSave={onSave}
          icon={currentNavigationMeta.secondaryIcon}
        />
        <ImSocialManager
          channels={state.im.channels}
          socialLinks={state.social.links}
          onChangeChannels={(channels) => updateState((draft) => void (draft.im.channels = channels))}
          onChangeSocial={(links) => updateState((draft) => void (draft.social.links = links))}
        />
      </div>
    );
  }

  const sectionKey: DeferredSectionKey = activeTab;
  const sectionMeta = SECTION_META[sectionKey];

  if (activeTab === "modules") {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SectionHeader
          title={currentNavigationMeta.secondaryLabel}
          description="使用首页大图同一套共享标题、表头、内容列表、滚条和内容插件；生成测试内容不会覆盖已有模块。"
          onSave={onSave}
          icon={currentNavigationMeta.secondaryIcon}
        />
        <SharedModuleManager
          items={state.sections.modules}
          onChange={(items) => updateState((draft) => void (draft.sections.modules = items))}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title={currentNavigationMeta.secondaryLabel}
        description={sectionMeta.description}
        onSave={onSave}
        icon={currentNavigationMeta.secondaryIcon}
      />
      <SectionListEditor
        title={currentNavigationMeta.secondaryLabel}
        items={state.sections[sectionKey]}
        onChange={(items) => updateState((draft) => void (draft.sections[sectionKey] = items))}
      />
    </div>
  );
}
