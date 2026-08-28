import { MEDIA_OPTIMIZATION_CONTRACT } from "@/lib/media-optimization-contract";

/**
 * Column Configuration is the only category identity/order source for Product
 * Market. Operations projects its live product cards onto those groups and
 * reuses the same open/cancel/hide status actions for category-scoped batch
 * updates. It must not create another category list or a parallel status model.
 */
export const PRODUCT_MARKET_SHARED_CATEGORY_CONTRACT = {
  version: "shared-product-market-category-contract-v9",
  identity: "category-key+display-order+label",
  expertIdentity: "customer-service-expert-id+material-id",
  expertMaterialPolicy: "01-12>customer-service-local-material-reference>material-id+local-url",
  expertMediaReader: "resolveCustomerServiceLocalMaterialReference>readCustomerServiceMediaPreview>shared-cache>stable-object-url",
  expertMediaStability: "01-12-single-local-material-reference-contract",
  expertFirstPaintFallback: MEDIA_OPTIMIZATION_CONTRACT.delivery.avatarFirstPaint.policy,
  expertProjectionValidation: "service-select-expert>sidebar+modules+operations>same-expert-id+same-material-id",
  expertDisplaySize: "sidebar-20px>modules+operations-16px",
  sources: ["service-select-expert", "sidebar", "modules", "operations"],
  orderControl: "shared-drag+shared-up-down+two-digit-order",
  operationsAction: "category-batch-status",
  statusPolicy: "category-paths-only>open-cancel-hide>confirm-and-persist-shared-snapshot",
  actionLayout: "category-sort-controls+two-digit-order+label+adjacent-status-group",
  projectionPolicy: "column-configuration-order>sidebar+operations-live-projection",
  iconPolicy: "customer-service-select-expert>shared-category-identity-icon>sidebar+modules+operations",
  ownershipHighlight: "shared-key>direct-14+linked-8+category-10>no-navigation-no-scroll-no-persist",
  ownershipRoles: "column-configuration-sort-source>operations-status-projection>sidebar-navigation-projection",
} as const;

export type ProductMarketCategoryExpertMaterialOverride = {
  mediaAssetId?: string | null;
  imageDataUrl?: string | null;
};

/**
 * One stable identity marker for the expert portrait projected into the
 * Sidebar, Column Configuration and Operations Market. The marker references
 * the saved asset instead of copying avatar data into any projection.
 */
export function resolveProductMarketCategoryExpertMaterialId(
  expertId: string,
  override?: ProductMarketCategoryExpertMaterialOverride,
  defaultLocalMaterialId?: string | null,
) {
  const assetId = override?.mediaAssetId?.trim();
  if (assetId) return assetId;
  if (override?.imageDataUrl) return `inline:${expertId}`;
  const localMaterialId = defaultLocalMaterialId?.trim();
  if (localMaterialId) return localMaterialId;
  return `local:${expertId}`;
}

export type ProductMarketSharedCategoryGroup<TItem extends { path: string }> = {
  key: string;
  label: string;
  items: TItem[];
};

export type ProductMarketCategoryStatus = "active" | "inactive" | "hidden";

export type ProductMarketCategoryStatusSummary = {
  total: number;
  value: ProductMarketCategoryStatus;
  mixed: boolean;
};

/** Project the exact Column Configuration groups onto another live item map. */
export function projectProductMarketCategoryGroups<
  TSource extends { path: string },
  TTarget extends { path: string },
>(
  groups: readonly ProductMarketSharedCategoryGroup<TSource>[],
  targetByPath: ReadonlyMap<string, TTarget>,
): ProductMarketSharedCategoryGroup<TTarget>[] {
  return groups.map((group) => ({
    key: group.key,
    label: group.label,
    items: group.items
      .map((item) => targetByPath.get(item.path))
      .filter((item): item is TTarget => Boolean(item)),
  }));
}

/**
 * Resolve the status shown by the shared category row. A mixed category keeps
 * the historical Column Configuration fallback (`inactive`) while exposing a
 * separate marker so developer and visual validators can distinguish it.
 */
export function resolveProductMarketCategoryStatus(
  items: readonly { status: ProductMarketCategoryStatus }[],
): ProductMarketCategoryStatusSummary {
  const total = items.length;
  if (total === 0) {
    return { total: 0, value: "inactive", mixed: false };
  }

  const firstStatus = items[0].status;
  const mixed = items.some((item) => item.status !== firstStatus);
  return {
    total,
    value: mixed ? "inactive" : firstStatus,
    mixed,
  };
}
