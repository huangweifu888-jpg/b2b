export type PageFactoryRuntimeScope = "hq" | "agency_source" | "client_source";

export type PageFactoryRuntimeRouteIdentity = {
  route: string;
  sourceScope: PageFactoryRuntimeScope;
};

export const PAGE_FACTORY_RUNTIME_SCOPE_PREFIX: Readonly<Record<PageFactoryRuntimeScope, string>> = Object.freeze({
  hq: "/zb",
  agency_source: "/zb/agency-source",
  client_source: "/zb/client-source",
});

export const PAGE_FACTORY_RUNTIME_DYNAMIC_SEGMENT_VALUE = "__shared-visual-audit__";

/** Converts a normalized registry identity into its read-only local source-shell route. */
export function buildPageFactoryRuntimeRoute(page: PageFactoryRuntimeRouteIdentity) {
  const [registeredPath, registeredSearch = ""] = page.route.split("?", 2);
  const concretePath = registeredPath.replace(/:[A-Za-z0-9_]+/gu, PAGE_FACTORY_RUNTIME_DYNAMIC_SEGMENT_VALUE);
  const scopedPath = `${PAGE_FACTORY_RUNTIME_SCOPE_PREFIX[page.sourceScope]}${concretePath === "/" ? "" : concretePath}`;
  return registeredSearch ? `${scopedPath}?${registeredSearch}` : scopedPath;
}
