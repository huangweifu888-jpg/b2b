import type { ProductCustomStyle, ProductStatus } from "@/lib/product-market-store";

export type EditableModuleChild = {
  label: string;
  path: string;
  status: ProductStatus;
  customLabel: string;
  description: string;
  customStyle: ProductCustomStyle;
};

export type EditableModuleItem = EditableModuleChild & {
  children: EditableModuleChild[];
};

const MODULE_CATEGORY_SORT_ID_PREFIX = "__pm-module-category__";

export function encodeModuleCategorySortId(categoryKey: string) {
  return `${MODULE_CATEGORY_SORT_ID_PREFIX}${categoryKey}`;
}

export function decodeModuleCategorySortId(sortId: string) {
  if (!sortId.startsWith(MODULE_CATEGORY_SORT_ID_PREFIX)) return null;
  return sortId.slice(MODULE_CATEGORY_SORT_ID_PREFIX.length);
}
