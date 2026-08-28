import { normalizePageFrameSearch } from "@/lib/page-route-identity";

/**
 * Returns the structural page route shared by composition manifests, audit
 * records and recovery lookups. Runtime context such as site, tenant, agent,
 * client and plan IDs must never create a second page-composition identity.
 */
export function resolvePageCompositionStructuralRoute(pathname: string, search = "") {
  const normalizedSearch = normalizePageFrameSearch(pathname, search);
  return `${pathname}${normalizedSearch ? `?${normalizedSearch}` : ""}`;
}
