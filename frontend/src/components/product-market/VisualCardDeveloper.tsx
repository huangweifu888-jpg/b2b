import { useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Layers3,
  Pin,
  PinOff,
  Plug,
  Plus,
  RotateCcw,
  Save,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getContentPluginDefinition, type KnownContentPluginId } from "@/lib/content-plugin-registry";
import {
  VISUAL_CARD_REGION_CONTRACTS,
  VISUAL_CARD_LAYOUT_SCHEMA_VERSION,
  buildVisualCardLayoutScopeKey,
  createDefaultVisualCardLayout,
  getVisualCardRegionContract,
  normalizeVisualCardLayout,
  readVisualCardEditorLayout,
  resolveVisualCardWorkspaceScope,
  writeVisualCardEditorLayout,
  type VisualCardFrameInsets,
  type VisualCardLayoutConfig,
  type VisualCardLayoutNode,
  type VisualCardLayoutScope,
  type VisualCardPlacement,
  type VisualCardRegionId,
} from "@/lib/visual-card-layout-contract";

export type VisualCardDeveloperDraft = VisualCardLayoutConfig;

type VisualStyleId = "standard" | "accent";

const REGION_DESCRIPTIONS: Record<VisualCardRegionId, string> = {
  "total-frame": "默认总框架；统一维护顶部、主体、表内、尾栏与四边尺寸，并保护唯一共享骨架。",
  topbar: "管理顶部自身结构、入口和插件；可在正常流动与吸顶固定之间切换。",
  workspace: "管理唯一工作主体和主体插件；结构归属由共享契约保护。",
  title: "标题风格单选，可收起或吸顶，并支持批量应用到已选兼容卡片。",
  "table-shell": "保持唯一表内边界、四边尺寸和内容滚动归属。",
  "table-header": "负责栏目、搜索、筛选、批量操作和排序插件，可吸顶固定。",
  content: "负责唯一滚动内容、状态和分页插件；大／小卡片只能在此插槽排序。",
  "large-card": "可增加、收起、固定和拖拉，承载复杂业务内容及多种插件。",
  "small-card": "可增加、收起、固定和拖拉，承载快捷状态、开关与功能插件。",
  footer: "统一保存、同步、锁定、版本与恢复动作，可吸底固定。",
};

const REGION_STYLE_LABELS: Record<VisualCardRegionId, readonly [string, string]> = {
  "total-frame": ["标准共享框架", "强调共享框架"],
  topbar: ["简洁顶部", "品牌顶部"],
  workspace: ["透明主体", "立体主体"],
  title: ["简洁标题", "品牌标题"],
  "table-shell": ["标准表内", "强调表内"],
  "table-header": ["轻量表头", "操作表头"],
  content: ["列表内容", "分区内容"],
  "large-card": ["标准大卡片", "重点大卡片"],
  "small-card": ["紧凑小卡片", "胶囊小卡片"],
  footer: ["简洁尾栏", "操作尾栏"],
};

const placementLabel = (placement: VisualCardPlacement) =>
  placement === "sticky-start" ? "吸顶固定" : placement === "sticky-end" ? "吸底固定" : "正常流动";

const pluginLabel = (pluginId: KnownContentPluginId) => getContentPluginDefinition(pluginId).label;

function createScope(pathname: string, search: string): VisualCardLayoutScope {
  return {
    workspaceScope: resolveVisualCardWorkspaceScope(pathname),
    pathname,
    search,
  };
}

function nodeOrder(nodes: readonly VisualCardLayoutNode[]) {
  const contentCards = nodes
    .filter((node) => node.regionId === "large-card" || node.regionId === "small-card")
    .sort((left, right) => left.order - right.order);
  const byRegion = new Map(nodes.map((node) => [node.regionId, node]));
  return VISUAL_CARD_REGION_CONTRACTS.flatMap((contract) => {
    if (contract.id === "large-card") return contentCards;
    if (contract.id === "small-card") return [];
    const node = byRegion.get(contract.id);
    return node ? [node] : [];
  });
}

function nextPlacement(node: VisualCardLayoutNode) {
  const contract = getVisualCardRegionContract(node.regionId);
  if (node.placement !== "flow") return "flow" as const;
  return contract.allowedPlacements.find((placement) => placement !== "flow") || "flow";
}

function SortableRegionCard({
  node,
  active,
  selected,
  editorCollapsed,
  onActivate,
  onToggleSelected,
  onToggleEditorCollapsed,
  onTogglePlacement,
  onRemove,
}: {
  node: VisualCardLayoutNode;
  active: boolean;
  selected: boolean;
  editorCollapsed: boolean;
  onActivate: () => void;
  onToggleSelected: () => void;
  onToggleEditorCollapsed: () => void;
  onTogglePlacement: () => void;
  onRemove: () => void;
}) {
  const contract = getVisualCardRegionContract(node.regionId);
  const dragDisabled = !contract.sortable || node.placement !== "flow";
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    disabled: dragDisabled,
  });

  return (
    <article
      ref={setNodeRef}
      data-visual-developer-card={node.id}
      data-visual-region={node.regionId}
      data-visual-structure-locked={contract.structureLocked ? "true" : "false"}
      className={`rounded-lg border p-2 text-xs transition-colors ${active ? "border-blue-500 bg-blue-50/70 text-slate-900 ring-1 ring-blue-300" : "border-current/20 bg-background/40"} ${isDragging ? "opacity-55" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label={`拖拉${contract.label}`}
          title={dragDisabled ? (contract.structureLocked ? "共享骨架区域不可改变父级或顺序" : "固定卡片需先取消固定") : "在内容插槽内拖拉排序"}
          disabled={dragDisabled}
          className="mt-0.5 cursor-grab touch-none rounded border border-current/20 px-1.5 py-1 disabled:cursor-not-allowed disabled:opacity-35"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onActivate}>
          <span className="flex flex-wrap items-center gap-1.5">
            <b>{String(VISUAL_CARD_REGION_CONTRACTS.findIndex((item) => item.id === node.regionId)).padStart(2, "0")} · {contract.label}</b>
            <Badge variant="outline" className="px-1.5 py-0 text-[9px]">{contract.cardinality.max === 1 ? "唯一" : "可增加"}</Badge>
            {contract.structureLocked ? <Badge className="bg-slate-700 px-1.5 py-0 text-[9px] text-white">骨架锁</Badge> : null}
            {node.placement !== "flow" ? <Badge className="bg-blue-700 px-1.5 py-0 text-[9px] text-white">{placementLabel(node.placement)}</Badge> : null}
            {node.collapsed ? <Badge variant="outline" className="px-1.5 py-0 text-[9px]">页面已收起</Badge> : null}
          </span>
          {!editorCollapsed ? <span className="mt-1 block line-clamp-2 opacity-70">{REGION_DESCRIPTIONS[node.regionId]}</span> : null}
        </button>
        <button
          type="button"
          aria-label={`${selected ? "取消选择" : "选择"}${contract.label}`}
          title="加入批量应用"
          onClick={onToggleSelected}
          className={`h-5 w-5 shrink-0 rounded border ${selected ? "border-blue-600 bg-blue-600 text-white" : "border-current/30"}`}
        >
          {selected ? "✓" : ""}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <button type="button" className="inline-flex items-center gap-1 rounded border border-current/20 px-1.5 py-1" onClick={onToggleEditorCollapsed}>
          {editorCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          {editorCollapsed ? "展开编辑卡" : "收起编辑卡"}
        </button>
        {contract.allowedPlacements.length > 1 ? (
          <button type="button" className="inline-flex items-center gap-1 rounded border border-current/20 px-1.5 py-1" onClick={onTogglePlacement}>
            {node.placement === "flow" ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
            {node.placement === "flow" ? "固定" : "取消固定"}
          </button>
        ) : null}
        <span className="ml-auto rounded-full border border-current/20 px-1.5 py-0.5 opacity-75">{node.pluginIds.length} 插件</span>
        {contract.cardinality.max > 1 ? <button type="button" className="rounded border border-rose-300 px-1.5 py-1 text-rose-700" onClick={onRemove}>删除</button> : null}
      </div>
    </article>
  );
}

function PreviewRegion({ node, children }: { node: VisualCardLayoutNode | undefined; children?: React.ReactNode }) {
  if (!node) return null;
  const contract = getVisualCardRegionContract(node.regionId);
  if (node.collapsed) {
    return <section data-visual-card-preview-region={node.regionId} data-visual-card-runtime-collapsed="true" className="rounded-lg border border-dashed border-current/25 px-2 py-1 text-[10px] opacity-60">{contract.label} · 页面区域已收起</section>;
  }
  const placementClass = node.placement === "sticky-start" ? "sticky top-0 z-20" : node.placement === "sticky-end" ? "sticky bottom-0 z-20" : "";
  return (
    <section
      data-visual-card-preview-region={node.regionId}
      data-visual-card-placement={node.placement}
      className={`relative rounded-lg border p-2 ${placementClass} ${node.stylePresetId === "accent" ? "border-blue-400 bg-blue-500/10 shadow-sm" : "border-current/20 bg-background"}`}
    >
      <div className="flex items-center justify-between gap-2 text-[10px] font-semibold"><span>{contract.label}</span><span className="opacity-60">{placementLabel(node.placement)}</span></div>
      {children}
      {node.pluginIds.length ? <div className="absolute right-1 top-7 flex max-w-28 flex-wrap justify-end gap-1">{node.pluginIds.map((id) => <span key={id} className="rounded-full border border-current/20 bg-background/90 px-1 py-0.5 text-[8px]">{pluginLabel(id)}</span>)}</div> : null}
    </section>
  );
}

export function VisualCardDeveloper({ pathname, search, readOnly, canPrepareDraft, appliedLayout, onPrepareDraft, onClose }: {
  pathname: string;
  search: string;
  readOnly: boolean;
  canPrepareDraft: boolean;
  appliedLayout?: VisualCardLayoutConfig;
  onPrepareDraft: (draft: VisualCardDeveloperDraft) => void;
  onClose: () => void;
}) {
  const scope = useMemo(() => createScope(pathname, search), [pathname, search]);
  const scopeKey = useMemo(() => buildVisualCardLayoutScopeKey(scope), [scope]);
  const initial = useMemo(
    () => readVisualCardEditorLayout(scope) || normalizeVisualCardLayout(appliedLayout || createDefaultVisualCardLayout()),
    [scope, appliedLayout],
  );
  const [nodes, setNodes] = useState<VisualCardLayoutNode[]>(initial.nodes);
  const [frameInsets, setFrameInsets] = useState<VisualCardFrameInsets>(initial.frameInsets);
  const [componentStyles, setComponentStyles] = useState(initial.componentStyles);
  const [activeId, setActiveId] = useState(initial.nodes.find((item) => item.regionId === "title")?.id || initial.nodes[0].id);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [editorCollapsedIds, setEditorCollapsedIds] = useState<Set<string>>(() => new Set());
  const [dirty, setDirty] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const libraryNodes = useMemo(() => nodeOrder(nodes), [nodes]);
  const contentCards = useMemo(
    () => nodes.filter((item) => item.regionId === "large-card" || item.regionId === "small-card").sort((left, right) => left.order - right.order),
    [nodes],
  );
  const activeNode = nodes.find((item) => item.id === activeId) || nodes[0];
  const activeContract = getVisualCardRegionContract(activeNode.regionId);
  const selectedNodes = nodes.filter((item) => selectedIds.has(item.id));
  const previewNode = (regionId: VisualCardRegionId) => nodes.find((item) => item.regionId === regionId);

  const updateNode = (id: string, updater: (node: VisualCardLayoutNode) => VisualCardLayoutNode) => {
    setNodes((current) => current.map((item) => item.id === id ? updater(item) : item));
    setDirty(true);
  };
  const currentDraft = (): VisualCardDeveloperDraft => normalizeVisualCardLayout({
    schemaVersion: VISUAL_CARD_LAYOUT_SCHEMA_VERSION,
    nodes,
    frameInsets,
    componentStyles,
    updatedAt: new Date().toISOString(),
  });
  const save = () => {
    if (readOnly) return false;
    const saved = writeVisualCardEditorLayout(scope, currentDraft());
    if (!saved) {
      toast.error("浏览器本地空间不足，卡片布局草稿未保存。");
      return false;
    }
    setDirty(false);
    toast.success("可视化卡片布局草稿已保存；尚未写入业务页面。");
    return true;
  };
  const reset = () => {
    const next = createDefaultVisualCardLayout();
    setNodes(next.nodes);
    setFrameInsets(next.frameInsets);
    setComponentStyles(next.componentStyles);
    setActiveId(next.nodes.find((item) => item.regionId === "title")!.id);
    setSelectedIds(new Set());
    setEditorCollapsedIds(new Set());
    setDirty(true);
  };
  const addCard = (regionId: "large-card" | "small-card") => {
    const template = createDefaultVisualCardLayout().nodes.find((item) => item.regionId === regionId)!;
    const next: VisualCardLayoutNode = {
      ...template,
      id: `visual:${regionId}:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      order: contentCards.length,
    };
    setNodes((current) => [...current, next]);
    setActiveId(next.id);
    setDirty(true);
  };
  const removeCard = (id: string) => {
    setNodes((current) => current.filter((item) => item.id !== id));
    setSelectedIds((current) => { const next = new Set(current); next.delete(id); return next; });
    setEditorCollapsedIds((current) => { const next = new Set(current); next.delete(id); return next; });
    if (activeId === id) setActiveId(nodes.find((item) => item.regionId === "content")?.id || nodes[0].id);
    setDirty(true);
  };
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = contentCards.findIndex((item) => item.id === String(active.id));
    const to = contentCards.findIndex((item) => item.id === String(over.id));
    if (from < 0 || to < 0 || contentCards[from].placement !== "flow") return;
    const moved = arrayMove(contentCards, from, to);
    const orderById = new Map(moved.map((item, order) => [item.id, order]));
    setNodes((current) => current.map((item) => orderById.has(item.id) ? { ...item, order: orderById.get(item.id)! } : item));
    setDirty(true);
  };
  const setStyle = (styleId: VisualStyleId, batch = false) => {
    const targets = batch && selectedNodes.length ? selectedIds : new Set([activeNode.id]);
    setNodes((current) => current.map((item) => targets.has(item.id) ? { ...item, stylePresetId: styleId } : item));
    setDirty(true);
  };
  const applyPluginsToSelected = () => {
    if (!selectedNodes.length) return;
    setNodes((current) => current.map((item) => {
      if (!selectedIds.has(item.id)) return item;
      const allowed = getVisualCardRegionContract(item.regionId).allowedPlugins;
      return { ...item, pluginIds: activeNode.pluginIds.filter((plugin) => allowed.includes(plugin)) };
    }));
    setDirty(true);
  };
  const toggleSelected = (id: string) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleEditorCollapsed = (id: string) => setEditorCollapsedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <section data-visual-card-developer data-visual-card-scope-key={scopeKey} data-shared-layout-section="content" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header data-visual-card-final-workflow className="flex flex-wrap items-center justify-between gap-2 border-b border-current/15 px-3 py-2">
        <div><div className="flex items-center gap-2 text-sm font-semibold"><Layers3 className="h-4 w-4" />最终操作流程规则 · 可视化卡片式开发器</div><p className="mt-0.5 text-[11px] opacity-70">共享骨架使用合法插槽树；大／小卡片可在内容插槽拖拉。页面区域可收起或吸顶／吸底固定，风格单选，插件与目标可多选。</p></div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">已选 {selectedNodes.length}</Badge>
          <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => addCard("large-card")} disabled={readOnly}><Plus className="mr-1 h-3.5 w-3.5" />大卡片</Button>
          <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => addCard("small-card")} disabled={readOnly}><Plus className="mr-1 h-3.5 w-3.5" />小卡片</Button>
          <Button type="button" size="sm" variant="outline" className="h-7" onClick={reset} disabled={readOnly}><RotateCcw className="mr-1 h-3.5 w-3.5" />重置</Button>
          <Button data-visual-card-save type="button" size="sm" className="h-7" onClick={save} disabled={readOnly || !dirty}><Save className="mr-1 h-3.5 w-3.5" />保存草稿</Button>
          <Button type="button" size="sm" variant="outline" className="h-7" onClick={onClose}>返回工具</Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-3 xl:grid-cols-[minmax(16rem,0.72fr)_minmax(22rem,1.25fr)_minmax(18rem,0.83fr)]">
        <aside data-visual-card-library className="min-h-0 overflow-y-auto rounded-xl border border-current/20 p-2">
          <div className="mb-1 text-xs font-semibold">实际开发卡片</div>
          <p className="mb-2 text-[10px] leading-4 opacity-65">骨架卡片只能在合法父级内配置；内容扩展卡片支持鼠标或键盘拖拉排序。</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={libraryNodes.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <div className="grid gap-2">{libraryNodes.map((node) => <SortableRegionCard key={node.id} node={node} active={node.id === activeNode.id} selected={selectedIds.has(node.id)} editorCollapsed={editorCollapsedIds.has(node.id)} onActivate={() => setActiveId(node.id)} onToggleSelected={() => toggleSelected(node.id)} onToggleEditorCollapsed={() => toggleEditorCollapsed(node.id)} onTogglePlacement={() => updateNode(node.id, (item) => ({ ...item, placement: nextPlacement(item) }))} onRemove={() => removeCard(node.id)} />)}</div>
            </SortableContext>
          </DndContext>
        </aside>

        <main data-visual-card-live-canvas className="min-h-0 overflow-y-auto rounded-xl border border-current/20 bg-current/[0.02] p-3">
          <div className="mb-2 flex items-center justify-between text-xs"><b>实际页面组合预览</b><span className="opacity-65">结构、定位与插件预览；不载入业务数据</span></div>
          <div className="grid gap-2 rounded-xl border border-current/25 p-2" style={{ paddingTop: frameInsets.top, paddingRight: frameInsets.right, paddingBottom: frameInsets.bottom, paddingLeft: frameInsets.left }}>
            <PreviewRegion node={previewNode("total-frame")} />
            <PreviewRegion node={previewNode("topbar")}><div className="mt-2 h-6 rounded bg-current/10" /></PreviewRegion>
            <PreviewRegion node={previewNode("workspace")}>
              <div className="mt-2 grid gap-2">
                <PreviewRegion node={previewNode("title")}><div className="mt-2 h-10 rounded bg-current/10" /></PreviewRegion>
                <PreviewRegion node={previewNode("table-shell")}>
                  <div className="mt-2 grid gap-2">
                    <PreviewRegion node={previewNode("table-header")}><div className="mt-2 grid grid-cols-4 gap-1">{[1, 2, 3, 4].map((item) => <span key={item} className="h-5 rounded bg-current/10" />)}</div></PreviewRegion>
                    <PreviewRegion node={previewNode("content")}>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">{contentCards.map((node) => <PreviewRegion key={node.id} node={node}><div className={`mt-2 rounded bg-current/10 ${node.regionId === "large-card" ? "h-24" : "h-14"}`} /></PreviewRegion>)}</div>
                    </PreviewRegion>
                  </div>
                </PreviewRegion>
              </div>
            </PreviewRegion>
            <PreviewRegion node={previewNode("footer")}><div className="mt-2 flex justify-end gap-1"><span className="h-6 w-16 rounded bg-current/10" /><span className="h-6 w-16 rounded bg-current/15" /></div></PreviewRegion>
          </div>
        </main>

        <aside data-visual-card-settings className="min-h-0 overflow-y-auto rounded-xl border border-current/20 p-3">
          <div className="flex items-center justify-between gap-2"><div><div className="text-sm font-semibold">{activeContract.label}设置</div><div className="text-[10px] opacity-60">{activeNode.id}</div></div><Badge variant="outline">{activeContract.cardinality.max === 1 ? "唯一卡片" : "扩展卡片"}</Badge></div>
          <p className="mt-2 rounded-md border border-current/15 p-2 text-xs leading-5 opacity-80">{REGION_DESCRIPTIONS[activeNode.regionId]}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] opacity-70"><span>父级：{activeContract.parentRegionId ? getVisualCardRegionContract(activeContract.parentRegionId).label : "根"}</span><span>插槽：{activeContract.slot}</span></div>

          {activeContract.collapsible ? <section className="mt-3 border-t border-current/15 pt-3" data-visual-card-runtime-collapse><div className="text-xs font-semibold">页面区域状态</div><div className="mt-2 grid grid-cols-2 gap-2"><Button type="button" size="sm" variant={!activeNode.collapsed ? "default" : "outline"} onClick={() => updateNode(activeNode.id, (item) => ({ ...item, collapsed: false }))} disabled={readOnly}>页面显示</Button><Button type="button" size="sm" variant={activeNode.collapsed ? "default" : "outline"} onClick={() => updateNode(activeNode.id, (item) => ({ ...item, collapsed: true }))} disabled={readOnly}>页面收起</Button></div></section> : null}

          {activeContract.allowedPlacements.length > 1 ? <section className="mt-3 border-t border-current/15 pt-3" data-visual-card-placement-selector><div className="text-xs font-semibold">位置方式</div><div className="mt-2 grid gap-1.5">{activeContract.allowedPlacements.map((placement) => <button key={placement} type="button" className={`rounded-md border px-2 py-1.5 text-left text-[11px] ${activeNode.placement === placement ? "border-blue-500 bg-blue-50 text-blue-900" : "border-current/20"}`} onClick={() => updateNode(activeNode.id, (item) => ({ ...item, placement }))} disabled={readOnly}>{activeNode.placement === placement ? "✓ " : ""}{placementLabel(placement)}</button>)}</div></section> : null}

          <section className="mt-3 border-t border-current/15 pt-3" data-visual-card-style-selector>
            <div className="text-xs font-semibold">风格单选</div>
            <div className="mt-2 grid grid-cols-2 gap-2">{(["standard", "accent"] as const).map((styleId, index) => <button key={styleId} type="button" data-visual-card-style={styleId} className={`rounded-lg border p-2 text-left text-xs ${activeNode.stylePresetId === styleId ? "border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-300" : "border-current/20"}`} onClick={() => setStyle(styleId)} disabled={readOnly}><span className="font-semibold">{REGION_STYLE_LABELS[activeNode.regionId][index]}</span><span className="mt-1 block text-[10px] opacity-65">主色底色 · 辅色字体</span></button>)}</div>
            <Button type="button" size="sm" variant="outline" className="mt-2 w-full" onClick={() => setStyle(activeNode.stylePresetId === "accent" ? "accent" : "standard", true)} disabled={readOnly || !selectedNodes.length}>应用当前风格到已选 {selectedNodes.length} 项</Button>
          </section>

          {activeNode.regionId === "total-frame" ? <section data-visual-card-frame-insets className="mt-4 border-t border-current/15 pt-3"><div className="text-xs font-semibold">总框架四边尺寸（px）</div><div className="mt-2 grid grid-cols-2 gap-2">{(["top", "right", "bottom", "left"] as const).map((side) => <label key={side} className="text-[10px] opacity-75">{{ top: "上", right: "右", bottom: "下", left: "左" }[side]}<input type="number" min={0} max={160} value={frameInsets[side]} disabled={readOnly} onChange={(event) => { setFrameInsets((current) => ({ ...current, [side]: Math.max(0, Math.min(160, Number(event.target.value) || 0)) })); setDirty(true); }} className="mt-1 h-8 w-full rounded border border-current/20 bg-transparent px-2 text-xs" /></label>)}</div></section> : null}

          <section className="mt-4 border-t border-current/15 pt-3" data-visual-card-plugin-selector>
            <div className="flex items-center gap-1 text-xs font-semibold"><Plug className="h-3.5 w-3.5" />兼容插件多选</div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">{activeContract.allowedPlugins.map((pluginId) => { const enabled = activeNode.pluginIds.includes(pluginId); return <button key={pluginId} type="button" data-visual-card-plugin={pluginId} className={`rounded-md border px-2 py-1.5 text-left text-[11px] ${enabled ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-current/20"}`} onClick={() => updateNode(activeNode.id, (item) => ({ ...item, pluginIds: enabled ? item.pluginIds.filter((id) => id !== pluginId) : [...item.pluginIds, pluginId] }))} disabled={readOnly}>{enabled ? "✓ " : "+ "}{pluginLabel(pluginId)}</button>; })}</div>
            <Button type="button" size="sm" variant="outline" className="mt-2 w-full" onClick={applyPluginsToSelected} disabled={readOnly || !selectedNodes.length}>把兼容插件应用到已选项</Button>
          </section>

          <section className="mt-4 border-t border-current/15 pt-3 text-xs leading-5"><b>应用门禁</b><ul className="mt-1 list-disc space-y-1 pl-4 opacity-75"><li>总框架与核心区域保持唯一，并固定在合法父子插槽。</li><li>只有大卡片、小卡片可在内容插槽内改变真实页面顺序。</li><li>编辑器收起与批量选择不发布；页面收起和定位会进入布局草案。</li><li>插件只写展示与交互配置，不写业务数据、素材或下游自定义。</li></ul></section>
          <Button data-visual-card-prepare-draft type="button" className="mt-4 w-full" onClick={() => { const draft = currentDraft(); if (writeVisualCardEditorLayout(scope, draft)) { setDirty(false); onPrepareDraft(draft); } else toast.error("草稿保存失败，未生成页面组合差异草案。"); }} disabled={readOnly || !canPrepareDraft} title={!canPrepareDraft ? "当前页面组合清单未通过发布前置检查" : "先生成差异草案，再建立恢复点并应用"}>生成页面组合差异草案</Button>
        </aside>
      </div>
    </section>
  );
}
