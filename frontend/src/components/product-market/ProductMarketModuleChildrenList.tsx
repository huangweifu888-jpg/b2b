import type { ButtonHTMLAttributes, ComponentType } from "react";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { ContentPluginMoveRail, ContentPluginStatusActions, formatContentPluginOrderPath } from "@/components/content-plugins/ContentPluginControls";
import type { ContentPluginIconSettingProps } from "@/components/content-plugins/ContentPluginIconSetting";
import { Input } from "@/components/ui/input";
import { getDefaultProductModuleSecondaryIconName } from "@/lib/product-market-store";
import type { EditableModuleChild } from "@/lib/product-market-modules-editor-contract";
import { buildSharedModuleOwnershipKey } from "@/lib/shared-ownership-highlight-runtime";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";

type ProductMarketModuleChildrenListProps = {
  children: EditableModuleChild[];
  categoryKey: string;
  parentDisplayOrder: number;
  IconSetting: ComponentType<ContentPluginIconSettingProps>;
  onMoveChild: (childPath: string, direction: "up" | "down") => void;
  onUpdateChild: (childPath: string, updater: (current: EditableModuleChild) => EditableModuleChild) => void;
};

function ModuleChildEditor({
  child,
  categoryKey,
  orderLabel,
  dragButtonProps,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onUpdate,
  IconSetting,
}: {
  child: EditableModuleChild;
  categoryKey: string;
  orderLabel: string;
  dragButtonProps: ButtonHTMLAttributes<HTMLButtonElement>;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdate: (updater: (current: EditableModuleChild) => EditableModuleChild) => void;
  IconSetting: ComponentType<ContentPluginIconSettingProps>;
}) {
  return (
    <div
      data-development-standard-frame-region="small-card"
      data-page-list-item
      data-responsive-structure-item="module"
      data-shared-ownership-key={buildSharedModuleOwnershipKey(child.path)}
      data-shared-category-key={categoryKey}
      data-shared-ownership-source="modules"
      className="product-module-child-card"
    >
      <div data-template-module-split data-responsive-capacity-row="module-editor" className="adaptive-work-matrix-row">
        <div data-responsive-capacity-primary className="adaptive-work-matrix-function">
          <div className="adaptive-work-matrix-function-grid">
            <div className="adaptive-work-matrix-operation-grid product-module-child-operation-grid">
              <ContentPluginMoveRail layout="grid-contents" dragButtonProps={dragButtonProps} canMoveUp={canMoveUp} canMoveDown={canMoveDown} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
              <IconSetting
                compact
                label="图标设置"
                value={{
                  assetId: child.customStyle.customIconAssetId || null,
                  url: child.customStyle.customIconUrl || null,
                  iconName: child.customStyle.iconName || getDefaultProductModuleSecondaryIconName(child.path, child.customLabel || child.label),
                }}
                onChange={({ assetId, url, iconName }) => onUpdate((current) => ({
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
              <ContentPluginStatusActions value={child.status} onChange={(status) => onUpdate((current) => ({ ...current, status }))} />
            </div>
            <div data-shared-module-hierarchy-rail="flat" className="adaptive-work-matrix-sort-cell">
              <span className="product-module-hierarchy-text adaptive-work-matrix-pill shrink-0">二级</span>
              <span className="product-module-hierarchy-text adaptive-work-matrix-pill shrink-0">{orderLabel}栏</span>
              <span className="product-module-hierarchy-text adaptive-work-matrix-pill shrink-0">+三级</span>
            </div>
          </div>
        </div>
        <div data-responsive-capacity-content className="adaptive-work-matrix-edit">
          <div className="product-module-detail-grid grid w-full min-w-0 items-center gap-1">
            <Input data-shared-small-card-text value={child.customLabel} onChange={(event) => onUpdate((current) => ({ ...current, customLabel: event.target.value }))} className="adaptive-work-matrix-input h-8 min-w-0 px-2" placeholder={sanitizeDisplayText(child.label, "请输入子栏目名称")} maxLength={12} />
            <Input data-shared-small-card-text value={child.description} onChange={(event) => onUpdate((current) => ({ ...current, description: event.target.value }))} className="adaptive-work-matrix-input h-8 min-w-0 px-2" placeholder="说明编制：用于左侧导航和右侧栏说明调用" maxLength={80} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableModuleChildItem({
  child,
  categoryKey,
  index,
  total,
  parentDisplayOrder,
  onMoveChild,
  onUpdateChild,
  IconSetting,
}: ProductMarketModuleChildrenListProps & { child: EditableModuleChild; index: number; total: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: child.path });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition: transition || "transform 200ms ease", opacity: isDragging ? 0.82 : 1 }}>
      <div className={isDragging ? "rounded-xl ring-1 ring-cyan-400 shadow-lg shadow-cyan-900/30" : ""}>
        <ModuleChildEditor
          child={child}
          categoryKey={categoryKey}
          orderLabel={formatContentPluginOrderPath(parentDisplayOrder, index + 1)}
          dragButtonProps={{ ...attributes, ...listeners, className: "text-current" }}
          canMoveUp={index > 0}
          canMoveDown={index < total - 1}
          onMoveUp={() => onMoveChild(child.path, "up")}
          onMoveDown={() => onMoveChild(child.path, "down")}
          onUpdate={(updater) => onUpdateChild(child.path, updater)}
          IconSetting={IconSetting}
        />
      </div>
    </div>
  );
}

/** Nested module editors load only after their collapsed parent is expanded. */
export function ProductMarketModuleChildrenList(props: ProductMarketModuleChildrenListProps) {
  return (
    <SortableContext items={props.children.map((child) => child.path)} strategy={rectSortingStrategy}>
      <div className="product-module-nested-list pt-0">
        {props.children.map((child, index) => (
          <SortableModuleChildItem key={child.path} {...props} child={child} index={index} total={props.children.length} />
        ))}
      </div>
    </SortableContext>
  );
}

export default ProductMarketModuleChildrenList;
