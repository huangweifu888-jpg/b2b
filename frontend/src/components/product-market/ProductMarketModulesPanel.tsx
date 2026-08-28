import { lazy, Suspense, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import { ChevronDown, ChevronUp, Plus, ShoppingBag } from "lucide-react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabsContent } from "@/components/ui/tabs";
import { ContentPluginIconTrigger, ContentPluginMoveRail, ContentPluginOrderBadge, ContentPluginStatusActions } from "@/components/content-plugins/ContentPluginControls";
import type { ContentPluginIconSettingProps } from "@/components/content-plugins/ContentPluginIconSetting";
import { ProductMarketCategoryIdentityIcon } from "@/components/product-market/ProductMarketCategoryIdentityIcon";
import { ALL_PRODUCTS, PRODUCT_MODULE_CATEGORIES, formatProductModuleCategoryLabel, getDefaultProductModuleSecondaryIconName, getProductModuleCategoryMarketingGuide, type CustomProductItem, type ProductStatus, useProductMarketStore } from "@/lib/product-market-store";
import { PRODUCT_MARKET_SHARED_CATEGORY_CONTRACT, resolveProductMarketCategoryStatus } from "@/lib/product-market-category-contract";
import {
  encodeModuleCategorySortId,
  type EditableModuleChild,
  type EditableModuleItem,
} from "@/lib/product-market-modules-editor-contract";
import { buildSharedCategoryOwnershipKey, buildSharedModuleOwnershipKey } from "@/lib/shared-ownership-highlight-runtime";
import { getLayoutFrameMarkerLabel } from "@/lib/layout-frame-contract";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";

import "@/shared-module-editor-capacity.css";
import "./ProductMarketModulesPanel.css";

const preload = (load: () => Promise<unknown>) => () => { void load().catch(() => undefined); };

const loadContentPluginIconSetting = () => import("@/components/content-plugins/ContentPluginIconSetting");
const LazyContentPluginIconSetting = lazy(loadContentPluginIconSetting);
const warmContentPluginIconSetting = preload(loadContentPluginIconSetting);

function DeferredContentPluginIconSetting(props: ContentPluginIconSettingProps) {
  const [activated, setActivated] = useState(false);
  const trigger = (
    <div data-content-plugin-icon-setting data-content-plugin-icon-setting-variant="compact" className="content-plugin-icon-setting--compact rounded-xl border border-cyan-100 bg-gradient-to-r from-white to-cyan-50/60 p-3">
      <ContentPluginIconTrigger preview={<ShoppingBag className="h-4 w-4" />} aria-haspopup="dialog" onPointerEnter={warmContentPluginIconSetting} onFocus={warmContentPluginIconSetting} onClick={() => setActivated(true)} />
    </div>
  );

  if (!activated) return trigger;

  return (
    <Suspense fallback={trigger}>
      <LazyContentPluginIconSetting {...props} compact defaultOpen />
    </Suspense>
  );
}

const loadProductMarketModuleEditorDialog = () => import("@/components/product-market/ProductMarketModuleEditorDialog");
const warmProductMarketModuleEditorDialog = preload(loadProductMarketModuleEditorDialog);
const LazyProductMarketModuleEditorDialog = lazy(loadProductMarketModuleEditorDialog);

const loadProductMarketModuleChildrenList = () => import("@/components/product-market/ProductMarketModuleChildrenList");
const warmProductMarketModuleChildrenList = preload(loadProductMarketModuleChildrenList);
const LazyProductMarketModuleChildrenList = lazy(loadProductMarketModuleChildrenList);

type ModuleGroup = { key: string; label: string; items: EditableModuleItem[] };

type ModulesPanelProps = {
  title: { full: string; short: string; description: string; textColor: string };
  headerActions: ReactNode;
  moduleTableHeaderCollapsed: boolean;
  onCollapseTableHeader: () => void;
  tableHeaderBorderColor: string;
  actionButtonBackground: string;
  actionButtonText: string;
  groupedModuleProducts: ModuleGroup[];
  visibleModuleGroupCount: number;
  onLoadMoreGroups: () => void;
  onShowAllGroups: () => void;
  sensors: ComponentProps<typeof DndContext>["sensors"];
  moduleTopLevelDragIds: string[];
  onModuleDragEnd: (event: DragEndEvent) => void;
  categoryOrderIndexMap: Map<string, number>;
  allowModuleCategoryReorder: boolean;
  tempModuleCategoryOrder: string[];
  avatarPreviewMap: Record<string, { url: string; kind: "image" | "video" }>;
  avatarOverrides: ReturnType<typeof useProductMarketStore.getState>["csAvatarOverrides"];
  moduleIconVisibility: ReturnType<typeof useProductMarketStore.getState>["moduleIconVisibility"];
  moduleRenderOrderByPath: Map<string, number>;
  expandedModulePaths: string[];
  onToggleExpandedPath: (path: string) => void;
  onMoveCategory: (categoryKey: string, direction: "up" | "down") => void;
  onSetCategoryStatus: (categoryKey: string, status: ProductStatus) => void;
  onUpdateProduct: (path: string, updater: (current: EditableModuleItem) => EditableModuleItem) => void;
  onMoveProduct: (path: string, direction: "up" | "down") => void;
  onUpdateChild: (parentPath: string, childPath: string, updater: (current: EditableModuleChild) => EditableModuleChild) => void;
  onMoveChild: (parentPath: string, childPath: string, direction: "up" | "down") => void;
  onAddProduct: (product: CustomProductItem) => void;
};

function displayProductLabel(product: { path: string; label: string; customLabel?: string | null }) {
  const fallback = ALL_PRODUCTS.find((item) => item.path === product.path)?.label || "未命名功能";
  return sanitizeDisplayText(product.customLabel, sanitizeDisplayText(product.label, fallback));
}

function SortableDefaultItem({
  product,
  categoryKey,
  displayOrder,
  isChildrenExpanded,
  onToggleChildren,
  onUpdateProduct,
  onMoveProduct,
  onUpdateChild,
  onMoveChild,
}: {
  product: EditableModuleItem;
  categoryKey: string;
  displayOrder: number;
  isChildrenExpanded: boolean;
  onToggleChildren: () => void;
  onUpdateProduct: (updater: (current: EditableModuleItem) => EditableModuleItem) => void;
  onMoveProduct: (direction: "up" | "down") => void;
  onUpdateChild: (childPath: string, updater: (current: EditableModuleChild) => EditableModuleChild) => void;
  onMoveChild: (childPath: string, direction: "up" | "down") => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.path });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || "transform 200ms ease",
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.82 : 1,
  };

  const hasChildren = product.children.length > 0;
  const displayLabel = sanitizeDisplayText(product.customLabel || product.label, "未命名一级栏目");

  return (
    <div ref={setNodeRef} style={style}>
      <div
        data-page-list-item
        data-development-standard-frame-region="small-card"
        data-development-standard-frame-label="小卡片"
        data-responsive-structure-item="module"
        data-sortable-dragging={isDragging ? "true" : "false"}
        data-shared-ownership-key={buildSharedModuleOwnershipKey(product.path)}
        data-shared-category-key={categoryKey}
        data-shared-ownership-source="modules"
        className={`nav-3d-card product-module-root-card rounded-xl border px-2 py-2 ${isDragging ? "opacity-85" : ""}`}
      >
        <div className="product-module-card-content">
            <div data-template-module-split data-responsive-capacity-row="module-editor" className="adaptive-work-matrix-row">
              <div data-responsive-capacity-primary className="adaptive-work-matrix-function">
                <div className="adaptive-work-matrix-function-grid">
                  <div className="adaptive-work-matrix-operation-grid product-module-operation-grid">
                    <ContentPluginMoveRail
                      layout="grid-contents"
                      dragButtonProps={{ ...attributes, ...listeners, className: "text-current" }}
                      onMoveUp={() => onMoveProduct("up")}
                      onMoveDown={() => onMoveProduct("down")}
                    />
                    <DeferredContentPluginIconSetting
                      compact
                      label="图标设置"
                      value={{
                        assetId: product.customStyle.customIconAssetId || null,
                        url: product.customStyle.customIconUrl || null,
                        iconName: product.customStyle.iconName || getDefaultProductModuleSecondaryIconName(product.path, displayProductLabel(product)),
                      }}
                      onChange={({ assetId, url, iconName }) => onUpdateProduct((current) => ({
                        ...current,
                        customStyle: {
                          ...current.customStyle,
                          customIconAssetId: assetId || undefined,
                          customIconUrl: url || undefined,
                          iconName: iconName || undefined,
                        },
                      }))}
                      useCustomerSourceIconLibrary
                    />
                    <ContentPluginStatusActions value={product.status} onChange={(status) => onUpdateProduct((current) => ({ ...current, status }))} />
                  </div>
                <div data-shared-module-hierarchy-rail="flat" className="adaptive-work-matrix-sort-cell">
                    <span className="product-module-hierarchy-text adaptive-work-matrix-pill shrink-0">一级</span>
                    <ContentPluginOrderBadge order={displayOrder} suffix="栏" sequence="ascending" className="product-module-hierarchy-text shrink-0" />
                    <span className="product-module-hierarchy-text adaptive-work-matrix-pill shrink-0">+二级</span>
                    {hasChildren ? (
                      <button
                        type="button"
                        onPointerEnter={warmProductMarketModuleChildrenList}
                        onFocus={warmProductMarketModuleChildrenList}
                        onClick={onToggleChildren}
                        data-shared-module-hierarchy-action="toggle"
                        className="adaptive-work-matrix-pill shrink-0 px-1.5 transition-colors hover:brightness-110"
                        title={isChildrenExpanded ? "收起子栏目" : "展开子栏目"}
                      >
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isChildrenExpanded ? "rotate-180" : ""}`} />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
              <div data-responsive-capacity-content className="adaptive-work-matrix-edit">
                <div className="product-module-detail-grid grid w-full min-w-0 items-center gap-1">
                  <Input
                    data-shared-small-card-text
                    value={product.customLabel}
                    onChange={(event) => onUpdateProduct((current) => ({ ...current, customLabel: event.target.value }))}
                    className="adaptive-work-matrix-input h-8 min-w-0 px-2"
                    placeholder={sanitizeDisplayText(product.label, "请输入栏目名称")}
                    maxLength={12}
                  />
                  <Input
                    data-shared-small-card-text
                    value={product.description}
                    onChange={(event) => onUpdateProduct((current) => ({ ...current, description: event.target.value }))}
                    className="adaptive-work-matrix-input h-8 min-w-0 px-2"
                    placeholder="说明：栏目配置、导航与右侧栏可调取"
                    maxLength={100}
                  />
                </div>
              </div>
            </div>
              {hasChildren && isChildrenExpanded ? (
                <Suspense fallback={null}>
                  <LazyProductMarketModuleChildrenList
                    children={product.children}
                    categoryKey={categoryKey}
                    parentDisplayOrder={displayOrder}
                    IconSetting={DeferredContentPluginIconSetting}
                    onMoveChild={onMoveChild}
                    onUpdateChild={onUpdateChild}
                  />
                </Suspense>
              ) : null}
        </div>
      </div>
    </div>
  );
}

function SortableModuleCategoryHeader({
  categoryKey,
  label,
  order,
  allowReorder,
  canMoveUp,
  canMoveDown,
  status,
  categoryIdentityIcon,
  onMoveCategory,
  onSetStatus,
}: {
  categoryKey: string;
  label: string;
  order: number;
  allowReorder: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  status: ProductStatus;
  categoryIdentityIcon?: ReactNode;
  onMoveCategory: (direction: "up" | "down") => void;
  onSetStatus: (status: ProductStatus) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: encodeModuleCategorySortId(categoryKey), disabled: !allowReorder });
  const normalizedName = sanitizeDisplayText(label, "未命名分类").replace(/^\s*\d+\.\s*/, "");
  const displayOrder = String(order).padStart(2, "0");
  const normalizedLabel = formatProductModuleCategoryLabel(order, normalizedName);
  const marketingGuide = getProductModuleCategoryMarketingGuide(categoryKey);
  const marketingSummary = marketingGuide
    ? `${marketingGuide.headline}。痛点：${marketingGuide.pain}。价值：${marketingGuide.value}。行动：${marketingGuide.action}`
    : undefined;

  return (
    <div
      ref={setNodeRef}
      className="product-module-category-header-shell"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition || "transform 200ms ease",
        opacity: isDragging ? 0.82 : 1,
        zIndex: isDragging ? 50 : undefined,
      }}
    >
      <div
        className="product-module-category-header-card"
        data-shared-category-rail="true"
        data-shared-sortable-card-rail
        data-shared-sortable-capsule="single"
        data-shared-product-market-category-contract={PRODUCT_MARKET_SHARED_CATEGORY_CONTRACT.version}
        data-shared-product-market-category-source="modules"
        data-shared-product-market-category-key={categoryKey}
        data-shared-product-market-category-order={String(order).padStart(2, "0")}
        data-shared-product-market-category-label={normalizedLabel}
        data-shared-ownership-key={buildSharedCategoryOwnershipKey(categoryKey)}
        data-shared-category-key={categoryKey}
        data-shared-ownership-source="modules"
        data-shared-ownership-category-target
      >
        <div className="product-module-card-content">
          <div
            data-template-module-split
            data-responsive-capacity-row="module-category"
            className="adaptive-work-matrix-row product-module-category-row"
          >
            <div data-responsive-capacity-primary className="adaptive-work-matrix-function">
              <div className="adaptive-work-matrix-function-grid">
                <div
                  data-shared-product-market-category-sort-rail={allowReorder ? "draggable" : "fixed"}
                  className={`adaptive-work-matrix-operation-grid product-module-operation-grid product-module-category-operation-grid${allowReorder ? "" : " product-module-category-operation-grid-fixed"}`}
                >
                  {allowReorder ? (
                    <>
                      <ContentPluginMoveRail
                        layout="grid-contents"
                        className="product-module-category-action"
                    dragButtonProps={{ ...attributes, ...listeners, className: "text-current product-module-category-action", title: "拖拽" }}
                        canMoveUp={canMoveUp}
                        canMoveDown={canMoveDown}
                        onMoveUp={() => onMoveCategory("up")}
                        onMoveDown={() => onMoveCategory("down")}
                      />
                    </>
                  ) : null}
                  <span
                    data-shared-product-market-category-order-segment
                    className="product-module-category-order"
                    aria-label={`分类排号 ${displayOrder}`}
                  >
                    {displayOrder}
                  </span>
                  <span
                    data-product-market-module-category-heading
                    data-product-market-category-marketing-guide={marketingGuide ? categoryKey : undefined}
                    tabIndex={marketingGuide ? 0 : undefined}
                    title={marketingSummary}
                    aria-label={marketingSummary || normalizedName}
                    className={`flex min-w-0 items-center gap-1 truncate text-[12px] font-semibold leading-5 product-module-category-title${marketingGuide ? " cursor-help" : ""}`}
                  >
                    {categoryIdentityIcon}
                    <span data-shared-product-market-category-name className="min-w-0 truncate">{normalizedName}</span>
                  </span>
                  <ContentPluginStatusActions
                    className="product-module-category-action"
                    value={status}
                    onChange={onSetStatus}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProductMarketModulesPanel({
  title, headerActions, moduleTableHeaderCollapsed, onCollapseTableHeader,
  tableHeaderBorderColor, actionButtonBackground, actionButtonText,
  groupedModuleProducts, visibleModuleGroupCount, onLoadMoreGroups, onShowAllGroups,
  sensors, moduleTopLevelDragIds, onModuleDragEnd: handleModuleDragEnd,
  categoryOrderIndexMap, allowModuleCategoryReorder, tempModuleCategoryOrder,
  avatarPreviewMap, avatarOverrides: csAvatarOverrides, moduleIconVisibility,
  moduleRenderOrderByPath, expandedModulePaths, onToggleExpandedPath,
  onMoveCategory: moveTempCategory, onSetCategoryStatus: handleSetCategoryStatus,
  onUpdateProduct: updateTempProduct, onMoveProduct: moveTempProduct,
  onUpdateChild: updateTempChild, onMoveChild: moveTempChild,
  onAddProduct,
}: ModulesPanelProps) {
  const [moduleMobileHeaderExpanded, setModuleMobileHeaderExpanded] = useState(false);
  const [moduleMobileTableHeaderExpanded, setModuleMobileTableHeaderExpanded] = useState(false);
  const [moduleEditorOpen, setModuleEditorOpen] = useState(false);

  return (
    <>
            <TabsContent value="modules" data-product-market-settings-page-content="true" className="template-config-modules-panel m-0 h-full min-h-0 w-full flex-col overflow-hidden !mt-0 flex">
              <div data-responsive-semantic-band="page-context" data-responsive-shared-surface="title-1" data-responsive-shared-surface-plugin="large-band-density" data-shared-layout-section="title" data-development-standard-frame-region="title" data-development-standard-frame-label="标题" className="nav-3d-header template-config-section-title template-config-panel-header flex shrink-0 flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  className="nav-mobile-disclosure"
                  onClick={() => setModuleMobileHeaderExpanded((current) => !current)}
                  aria-expanded={moduleMobileHeaderExpanded}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ShoppingBag className="h-4 w-4 shrink-0" />
                    <span className="truncate">{title.short}</span>
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${moduleMobileHeaderExpanded ? "rotate-180" : ""}`} />
                </button>
                <div className={`nav-mobile-header-content ${moduleMobileHeaderExpanded ? "is-expanded" : ""}`}>
                <div className="flex w-full flex-wrap items-center justify-between gap-2">
                  <div data-drag-handle className="min-w-0 flex-1 cursor-move">
                    <div data-responsive-live-title-heading className="template-config-title-row flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-[20px] font-semibold leading-tight">
                      <ShoppingBag className="h-[22px] w-[22px] shrink-0" />
                      <span className="truncate">{title.full}</span>
                      <span data-responsive-live-title-description className="template-config-title-description text-[11px] font-normal leading-tight opacity-80" style={{ color: title.textColor }}>
                        {title.description}
                      </span>
                    </div>
                  </div>
{headerActions}
                </div>
                </div>
              </div>
              <div
                data-product-market-table-shell="true"
                data-product-market-table-header-mode={moduleTableHeaderCollapsed ? "collapsed" : "expanded"}
                data-development-standard-frame-region="table-shell"
                data-development-standard-frame-label={getLayoutFrameMarkerLabel("tableShell")}
                data-development-standard-marker-placement="frame-start"
                className="product-module-matrix-shell flex min-h-0 flex-1 flex-col overflow-hidden"
              >
              {!moduleTableHeaderCollapsed ? (
                <div
                  data-shared-layout-section="header"
                  data-product-market-table-header
                  data-responsive-semantic-band="table-header"
                  data-responsive-shared-surface="table-header"
                  data-responsive-shared-surface-plugin="large-band-density"
                  data-template-module-table-header="true"
                  data-development-standard-frame-region="table-header"
                  data-development-standard-frame-label="表头"
                  className="nav-3d-subnav-frame nav-table-header adaptive-work-matrix-frame template-config-table-header"
                >
                  <button
                    type="button"
                    className="nav-mobile-disclosure nav-mobile-table-disclosure"
                    onClick={() => setModuleMobileTableHeaderExpanded((current) => !current)}
                    aria-expanded={moduleMobileTableHeaderExpanded}
                  >
                    <span>栏目字段</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${moduleMobileTableHeaderExpanded ? "rotate-180" : ""}`} />
                  </button>
                  <div data-template-module-split className={`nav-table-header-content ${moduleMobileTableHeaderExpanded ? "is-expanded" : ""}`}>
                  <div className="adaptive-work-matrix-function">
                    <div className="adaptive-work-matrix-function-grid">
                      <div className="min-w-0">
                        <div className="adaptive-work-matrix-section-title">功能设置</div>
                        <div className="adaptive-work-matrix-subhead">栏目状态设置</div>
                      </div>
                      <div className="min-w-0">
                        <div className="adaptive-work-matrix-section-title">排序控制</div>
                        <div className="adaptive-work-matrix-subhead">栏目排号</div>
                      </div>
                    </div>
                  </div>
                  <div className="adaptive-work-matrix-edit">
                    <div className="w-full min-w-0">
                      <div className="adaptive-work-matrix-section-title">编制内容</div>
                      <div className="product-module-detail-grid grid min-w-0 items-center gap-1">
                        <div>栏目名称</div>
                        <div>栏目说明</div>
                      </div>
                    </div>
                  </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onCollapseTableHeader}
                    className="template-config-action-button template-config-module-collapse h-8 shrink-0 gap-1 px-3 text-xs"
                    style={{
                      backgroundColor: actionButtonBackground,
                      color: actionButtonText,
                      borderColor: tableHeaderBorderColor,
                    }}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                    收起表头
                  </Button>
                </div>
              ) : null}
                <ScrollArea
                  data-shared-layout-section="list"
                  data-shared-scroll-contract="table-inner-60"
                  data-page-list
                  data-page-list-scroll-owner
                  aria-busy={visibleModuleGroupCount === 0}
                  data-module-background-loading={visibleModuleGroupCount < groupedModuleProducts.length ? "true" : "false"}
                  data-development-standard-frame-region="content"
                  data-development-standard-frame-label={getLayoutFrameMarkerLabel("content")}
                  data-development-standard-marker-placement="content-start"
                className="nav-matrix-body product-module-matrix-body min-h-0 w-full flex-1"
              >
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleModuleDragEnd}
                >
                  <SortableContext items={moduleTopLevelDragIds} strategy={rectSortingStrategy}>
                  <div className="product-module-list w-full">
                    {groupedModuleProducts.slice(0, visibleModuleGroupCount).map((group, groupIndex) => {
                      const groupLabel = formatProductModuleCategoryLabel(
                        categoryOrderIndexMap.get(group.key) ?? groupIndex + 1,
                        group.label
                      );
                      const categoryStatus = resolveProductMarketCategoryStatus(group.items).value;
                      return (
                        <div
                          key={group.key}
                          data-product-market-category-group
                          data-product-market-category-key={group.key}
                          data-shared-product-market-category-contract={PRODUCT_MARKET_SHARED_CATEGORY_CONTRACT.version}
                          data-shared-product-market-category-source="modules"
                          data-shared-product-market-category-key={group.key}
                          data-shared-product-market-category-order={String(categoryOrderIndexMap.get(group.key) ?? groupIndex + 1).padStart(2, "0")}
                          data-shared-product-market-category-label={groupLabel}
                          data-shared-product-market-category-icon-policy={PRODUCT_MODULE_CATEGORIES.some((category) => category.key === group.key) ? "customer-service-select-expert" : "source-workspace-owned"}
                          data-shared-sortable-card
                          data-shared-ownership-key={buildSharedCategoryOwnershipKey(group.key)}
                          data-shared-category-key={group.key}
                          data-shared-ownership-source="modules"
                          data-shared-ownership-category-target
                          data-page-list-item
                          data-shared-large-card-surface="true"
                          data-development-standard-frame-region="large-card"
                          data-development-standard-frame-label="大卡片"
                          data-development-standard-marker-placement="card-center"
                        >
                          <SortableModuleCategoryHeader
                            categoryKey={group.key}
                            label={group.label}
                            order={categoryOrderIndexMap.get(group.key) ?? groupIndex + 1}
                            allowReorder={allowModuleCategoryReorder}
                            canMoveUp={groupIndex > 0}
                            canMoveDown={groupIndex < groupedModuleProducts.length - 1}
                            status={categoryStatus}
                            categoryIdentityIcon={(
                              <ProductMarketCategoryIdentityIcon
                                categoryKey={group.key}
                                categoryLabel={group.label}
                                categoryOrder={tempModuleCategoryOrder}
                                avatarPreviews={avatarPreviewMap}
                                avatarOverrides={csAvatarOverrides}
                                visible={moduleIconVisibility.category}
                                displaySize="category-16"
                              />
                            )}
                            onMoveCategory={(direction) => moveTempCategory(group.key, direction)}
                            onSetStatus={(status) => handleSetCategoryStatus(group.key, status)}
                          />
                          <div
                            className="space-y-2"
                            data-responsive-mobile-collection="function-grid"
                            data-responsive-collection-complexity="editor"
                          >
                            {group.items.map((product) => {
                              const renderOrder = moduleRenderOrderByPath.get(product.path);
                              const validOrder = renderOrder === undefined ? 0 : renderOrder;
                              const displayOrder = validOrder;
                              return (
                                <SortableDefaultItem
                                  key={product.path}
                                  product={product}
                                  categoryKey={group.key}
                                  displayOrder={displayOrder}
                                  isChildrenExpanded={expandedModulePaths.includes(product.path)}
                                  onToggleChildren={() => onToggleExpandedPath(product.path)}
                                  onUpdateProduct={(updater) => updateTempProduct(product.path, updater)}
                                  onMoveProduct={(direction) => moveTempProduct(product.path, direction)}
                                  onUpdateChild={(childPath, updater) => updateTempChild(product.path, childPath, updater)}
                                  onMoveChild={(childPath, direction) => moveTempChild(product.path, childPath, direction)}
                                />
                              );
                              })}
                          </div>
                        </div>
                      );
                    })}
                    {visibleModuleGroupCount < groupedModuleProducts.length ? (
                      <div
                        role="status"
                        aria-live="polite"
                        className="product-module-progressive-loading gap-2"
                      >
                        <span>已按需显示 {visibleModuleGroupCount}/{groupedModuleProducts.length} 组栏目</span>
                        <button
                          type="button"
                          onClick={onLoadMoreGroups}
                          className="bg-transparent p-0 font-medium text-current underline underline-offset-2"
                        >
                          加载更多栏目
                        </button>
                        <button
                          type="button"
                          onClick={onShowAllGroups}
                          className="bg-transparent p-0 font-medium text-current underline underline-offset-2"
                        >
                          显示全部栏目
                        </button>
                      </div>
                    ) : null}
                    </div>
                  </SortableContext>
                </DndContext>
                <div className="mt-3 flex justify-start pl-[9px]">
                  <Button
                    type="button"
                    size="sm"
                    onPointerEnter={warmProductMarketModuleEditorDialog}
                    onFocus={warmProductMarketModuleEditorDialog}
                    onClick={() => setModuleEditorOpen(true)}
                    className="h-8 px-3 text-xs"
                    style={{
                      backgroundColor: actionButtonBackground,
                      color: actionButtonText,
                    }}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    增加产品
                  </Button>
                </div>
              </ScrollArea>
              </div>
            </TabsContent>
      {moduleEditorOpen ? (
        <Suspense fallback={null}>
          <LazyProductMarketModuleEditorDialog
            onOpenChange={setModuleEditorOpen}
            onAddProduct={onAddProduct}
          />
        </Suspense>
      ) : null}
    </>
  );
}
