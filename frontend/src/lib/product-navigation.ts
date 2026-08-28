import type { ElementType } from "react";
import { Package } from "lucide-react";
import {
  ICON_OPTIONS,
  getDefaultProductModuleSecondaryIconName,
  type CustomProductItem,
  type ProductChildItem,
  type ProductItem,
  type ProductStatus,
} from "@/lib/product-market-store";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";

export type BaseProductNavChild = {
  label: string;
  path: string;
};

export type BaseProductNavItem = {
  label: string;
  path: string;
  icon?: ElementType;
  children?: BaseProductNavChild[];
};

export type ConfiguredProductNavChild = ProductChildItem & {
  label: string;
};

export type ConfiguredProductNavItem = BaseProductNavItem & {
  label: string;
  icon?: ElementType;
  product?: ProductItem;
  children?: ConfiguredProductNavChild[];
  disabled?: boolean;
};

function stripProductCategoryPrefix(label: string) {
  const normalized = label.trim();
  return normalized.replace(/^\d+\.[^\s]+\s+/, "");
}

function getConfiguredIcon(product?: ProductItem, fallback?: ElementType) {
  const iconName = product?.customStyle?.iconName;
  if (iconName) {
    return ICON_OPTIONS.find((item) => item.name === iconName)?.icon || product?.icon || fallback || Package;
  }
  const factoryIcon = product
    ? ICON_OPTIONS.find((item) => item.name === getDefaultProductModuleSecondaryIconName(product.path, product.customLabel || product.label))?.icon
    : undefined;
  return factoryIcon || product?.icon || fallback || Package;
}

function buildConfiguredChildren(
  baseChildren: BaseProductNavChild[] | undefined,
  product: ProductItem | undefined
) {
  if (product?.children?.length) {
    return product.children.map((child) => ({
      ...child,
      label: stripProductCategoryPrefix(sanitizeDisplayText(child.customLabel, sanitizeDisplayText(child.label, "未命名栏目"))),
    }));
  }
  if (!baseChildren?.length) return undefined;
  return baseChildren.map((child) => ({
    label: sanitizeDisplayText(child.label, "未命名栏目"),
    path: child.path,
    status: "active" as const,
    customLabel: child.label,
    customStyle: {},
    children: [],
  }));
}

export function normalizeComparableSearch(search: string) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("siteId");
  const normalized = params.toString();
  return normalized ? `?${normalized}` : "";
}

export function isNavPathMatch(targetPath: string, pathname: string, search: string) {
  const [targetPathname, targetRawSearch] = targetPath.split("?");
  const targetSearch = targetRawSearch ? `?${targetRawSearch}` : "";
  return pathname === targetPathname && normalizeComparableSearch(search) === normalizeComparableSearch(targetSearch);
}

/**
 * Resolves a URL to the single product-market record that owns it.
 *
 * Product groups such as 鈥滃叧浜庢垜浠?/ 鏈嶅姟淇濋殰 / 鑱旂郴鎴戜滑鈥?deliberately use
 * query-string routes. Comparing only `pathname` makes all of those routes
 * look like `/company-info`, so their status can drift from the navigation and
 * direct URLs can bypass a hidden or inactive item. Keep the comparison here
 * so every consumer uses the same siteId-insensitive route identity.
 */
export type ConfiguredProductRoute = {
  product?: ProductItem;
  child?: ProductChildItem;
  status: ProductStatus;
};

export function resolveConfiguredProductRoute(
  products: ProductItem[],
  pathname: string,
  search: string
): ConfiguredProductRoute {
  // 浜у搧閰嶇疆浣跨敤绔欑偣鍐呰矾寰勶紙渚嬪 /company-info?tab=about锛夛紝鑰屽鎴锋簮妗嗘灦
  // 浼犲叆鐨勬槸甯﹀伐浣滃尯鍓嶇紑鐨勫疄闄呭湴鍧€锛?zb/client-source/company-info锛夈€?  // 浠呭湪杩欓噷鏍囧噯鍖栧叆鍙ｏ紝閬垮厤鏂板椤圭洰鍐嶆鍥犲墠缂€涓嶅悓鑰岀粫杩囩姸鎬佸畧鍗€?
  const configuredPathname = pathname.replace(/^\/zb\/client-source(?=\/|$)/, "") || "/";
  const product =
    products.find((item) => isNavPathMatch(item.path, configuredPathname, search)) ||
    products.find((item) => item.children?.some((child) => isNavPathMatch(child.path, configuredPathname, search)));
  const child = product?.children?.find((item) => isNavPathMatch(item.path, configuredPathname, search));
  const statuses = [product?.status, child?.status];
  const status: ProductStatus = statuses.includes("hidden")
    ? "hidden"
    : statuses.includes("inactive")
      ? "inactive"
      : "active";

  return { product, child, status };
}

export function buildConfiguredProductNavItems(
  baseItems: BaseProductNavItem[],
  products: ProductItem[],
  customProducts: CustomProductItem[],
  productOrder: string[]
): ConfiguredProductNavItem[] {
  const mergedBaseItems = [...baseItems];

  customProducts.forEach((item) => {
    if (!mergedBaseItems.find((base) => base.path === item.path)) {
      mergedBaseItems.push({
        label: item.label,
        path: item.path,
        icon: Package,
        children: item.children?.length ? item.children : undefined,
      });
    }
  });

  const orderedItems = productOrder.length
    ? productOrder.map((path) => mergedBaseItems.find((item) => item.path === path)).filter(Boolean) as BaseProductNavItem[]
    : mergedBaseItems;

  mergedBaseItems.forEach((item) => {
    if (!orderedItems.find((orderedItem) => orderedItem.path === item.path)) {
      orderedItems.push(item);
    }
  });

    return orderedItems
    .map((item) => {
      const product = products.find((productItem) => productItem.path === item.path);
      if (product?.status === "hidden") return null;

      const fallbackLabel = sanitizeDisplayText(product?.label || item.label, "未命名栏目");
      const resolvedLabel = stripProductCategoryPrefix(sanitizeDisplayText(product?.customLabel, fallbackLabel));
      const baseLabel = stripProductCategoryPrefix(item.label);
      return {
        ...item,
        label: resolvedLabel || baseLabel,
        icon: getConfiguredIcon(product, item.icon),
        product,
        children: buildConfiguredChildren(item.children, product),
        disabled: product?.status === "inactive",
      } as ConfiguredProductNavItem;
    })
    .filter(Boolean) as ConfiguredProductNavItem[];
}




