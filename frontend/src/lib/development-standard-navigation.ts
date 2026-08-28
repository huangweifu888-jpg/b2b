const DEVELOPMENT_STANDARD_ONLY_ROUTE_SUFFIXES = [
  "/product-market?tab=development",
  "/social?tab=customer-roadmap",
  "/customers?tab=development",
] as const;

/**
 * Development-standard pages are reachable only from the specification menu.
 * This guard also filters historical/custom navigation records so an old saved
 * configuration cannot re-introduce a standard page into business navigation.
 */
export function isDevelopmentStandardOnlyPath(path: string) {
  return DEVELOPMENT_STANDARD_ONLY_ROUTE_SUFFIXES.some((suffix) => path.endsWith(suffix));
}

