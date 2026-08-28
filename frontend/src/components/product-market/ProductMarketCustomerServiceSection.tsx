import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Card, CardContent } from "@/components/ui/card";
import { ContentPluginSortToolbar } from "@/components/content-plugins/ContentPluginControls";
import type { CustomerServiceSectionConfig } from "@/lib/product-market-store";

const META_TEXT_CLASS = "text-[10px] leading-[1.25] sm:text-[11px] sm:leading-4";

export type ProductMarketCustomerServiceResponsiveMode = "full" | "compact" | "narrow";

export type ProductMarketCustomerServiceSectionProps = {
  section: CustomerServiceSectionConfig;
  index: number;
  total: number;
  onMove: (id: string, direction: "up" | "down") => void;
  order?: number;
  responsiveMode?: ProductMarketCustomerServiceResponsiveMode;
  children: ReactNode;
};

function getResponsiveCustomerServiceSectionTitle(
  section: CustomerServiceSectionConfig,
  mode: ProductMarketCustomerServiceResponsiveMode,
) {
  if (mode === "full") return section.title;
  switch (section.id) {
    case "service-select-avatar":
      return "选择专家";
    case "service-avatar-customize":
      return mode === "narrow" ? "当前专家..." : "当前专家真人...";
    case "service-reminder-sound":
      return mode === "narrow" ? "提醒声音" : "专家提醒声音";
    default:
      return section.title;
  }
}

export function SortableCustomerServiceSection({
  section,
  index,
  total,
  onMove,
  order,
  responsiveMode = "full",
  children,
}: ProductMarketCustomerServiceSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });
  const displayTitle = getResponsiveCustomerServiceSectionTitle(section, responsiveMode);
  const hideDescription = responsiveMode !== "full";
  const displayOrder = order ?? index + 1;

  return (
    <div
      ref={setNodeRef}
      className="template-config-service-section"
      aria-label={section.id === "service-select-avatar" ? `卡片/内容：${displayTitle}` : undefined}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDragging
          ? "box-shadow 180ms ease, opacity 150ms ease"
          : transition || "transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 220ms ease",
        opacity: isDragging ? 0.92 : 1,
        order,
      }}
    >
      <Card
        data-page-list-item
        data-shared-large-card-surface="true"
        data-development-standard-frame-region="large-card"
        data-development-standard-frame-label="大卡片"
        className={`template-config-service-card ${isDragging ? "shadow-xl shadow-cyan-500/20 ring-1 ring-cyan-400/50" : ""}`}
        data-responsive-structure-item="service-section"
        data-shared-sortable-card
        data-sortable-dragging={isDragging ? "true" : "false"}
      >
        <CardContent className="space-y-2 p-2.5 sm:p-3.5">
          <div
            className="template-config-service-list-editor rounded-xl border p-1.5"
            data-shared-service-section-large-card="true"
            data-shared-sortable-card-rail
            data-shared-sortable-capsule="single"
            style={{
              backgroundColor: "var(--tradepro-product-market-large-card-bg, var(--tradepro-panel-card-bg))",
              color: "var(--tradepro-product-market-large-card-text, var(--tradepro-panel-card-text))",
              borderColor: "color-mix(in srgb, var(--tradepro-product-market-large-card-text, var(--tradepro-panel-card-text)) 18%, transparent)",
            }}
          >
            <div data-responsive-capacity-row="section-editor" className="min-w-0 items-center gap-2">
              <div data-responsive-capacity-primary>
                <ContentPluginSortToolbar
                  order={displayOrder}
                  sequence="ascending"
                  canMoveUp={index > 0}
                  canMoveDown={index < total - 1}
                  onMoveUp={() => onMove(section.id, "up")}
                  onMoveDown={() => onMove(section.id, "down")}
                  dragButtonProps={{ ...attributes, ...listeners }}
                />
              </div>
              <div data-responsive-capacity-content className="flex min-w-0 items-center">
                <div className="flex min-w-0 items-center gap-2">
                  <div
                    data-shared-sortable-capsule-title
                    className={`shrink-0 truncate font-semibold leading-tight ${
                      responsiveMode === "narrow"
                        ? "max-w-[6.2em] text-[10px]"
                        : responsiveMode === "compact"
                          ? "max-w-[8.6em] text-[11px] sm:max-w-[10.5em]"
                          : "max-w-[8.4em] text-[10px] sm:max-w-[11em] sm:text-[12px] lg:max-w-[14em] xl:max-w-none xl:text-[14px]"
                    }`}
                    style={{ color: "var(--tradepro-product-market-large-card-text, var(--tradepro-panel-card-text))" }}
                    title={section.title}
                  >
                    {displayTitle}
                  </div>
                  <div
                    data-responsive-capacity-secondary-copy
                    data-shared-sortable-capsule-description
                    className={`${hideDescription ? "hidden" : `min-w-0 truncate ${META_TEXT_CLASS} leading-tight`}`}
                    style={{ color: "color-mix(in srgb, var(--tradepro-product-market-large-card-text, var(--tradepro-panel-card-text)) 78%, transparent)" }}
                  >
                    {section.description}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

export default SortableCustomerServiceSection;
