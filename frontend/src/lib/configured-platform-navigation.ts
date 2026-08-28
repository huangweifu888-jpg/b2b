import type { ElementType } from "react";

import { ICON_OPTIONS, type ProductItem } from "@/lib/product-market-store";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";

export type PlatformNavigationItem = {
  to: string;
  label: string;
  icon: ElementType;
};

export type ConfiguredPlatformNavigationItem = PlatformNavigationItem & {
  status: "active" | "inactive";
  /** Shared Column Configuration → Column Description projection for hover help. */
  description?: string;
  /** Optional uploaded/material icon. Renderers prefer it over the icon component. */
  customIconUrl?: string;
};

function sourcePath(to: string, routePrefix: string) {
  const pathname = to.split("?")[0] || to;
  const normalized = pathname.replace(routePrefix, "");
  return normalized || "/";
}

/**
 * React Router regards links that differ only by query string as the same
 * active pathname.  Product Market uses `tab` deliberately, so its four
 * sidebar children need this shared exact-match contract rather than the
 * default NavLink activity flag.
 */
export function isPlatformProductMarketItemActive(
  itemTo: string,
  pathname: string,
  search: string,
) {
  const [itemPathname, itemSearch = ""] = itemTo.split("?");
  if (itemPathname !== pathname) return false;

  const expectedTab = new URLSearchParams(itemSearch).get("tab");
  return expectedTab
    ? new URLSearchParams(search).get("tab") === expectedTab
    : !new URLSearchParams(search).has("tab");
}

/**
 * Makes a platform sidebar read the same Product Market records that control
 * its runtime. Hidden applications disappear, inactive applications stay
 * visible but cannot be entered, and labels/icons/order follow the source.
 */
export function configurePlatformNavigation(
  items: PlatformNavigationItem[],
  routePrefix: string,
  products: ProductItem[],
  productOrder: string[],
): ConfiguredPlatformNavigationItem[] {
  const orderIndex = new Map(productOrder.map((path, index) => [path, index]));

  return items
    .map((item, fallbackIndex) => {
      const path = sourcePath(item.to, routePrefix);
      const product = products.find((candidate) => candidate.path === path);
      if (product?.status === "hidden") return null;
      const icon = product?.customStyle?.iconName
        ? ICON_OPTIONS.find((candidate) => candidate.name === product.customStyle?.iconName)?.icon || product.icon || item.icon
        : product?.icon || item.icon;
      return {
        ...item,
        label: sanitizeDisplayText(product?.customLabel, sanitizeDisplayText(product?.label, item.label)),
        description: sanitizeDisplayText(product?.description, "") || undefined,
        icon,
        customIconUrl: product?.customStyle?.customIconUrl,
        status: product?.status === "inactive" ? "inactive" : "active",
        order: orderIndex.get(path) ?? (product ? productOrder.length + fallbackIndex : Number.MAX_SAFE_INTEGER),
      };
    })
    .filter((item): item is ConfiguredPlatformNavigationItem & { order: number } => Boolean(item))
    .sort((left, right) => left.order - right.order)
    .map(({ order: _order, ...item }) => item);
}
