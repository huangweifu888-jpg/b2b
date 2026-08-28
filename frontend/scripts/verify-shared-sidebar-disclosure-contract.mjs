import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFile(resolve(root, file), "utf8");
const requireToken = (source, token, label) => {
  if (!source.includes(token)) throw new Error(`Shared sidebar disclosure contract missing ${label}: ${token}`);
};
const forbidPattern = (source, pattern, label) => {
  if (pattern.test(source)) throw new Error(`Shared sidebar disclosure contract retains ${label}.`);
};

const [
  hook,
  hqSidebar,
  agencySourceSidebar,
  clientSidebar,
  responsiveContract,
  visualResponsiveContract,
  responsiveLearning,
  sharedParity,
  developerConsole,
  unifiedWorkbench,
  visualEditor,
] = await Promise.all([
  read("src/hooks/use-route-owned-sidebar-disclosure.ts"),
  read("src/components/HQSidebar.tsx"),
  read("src/components/AgencySourceSidebar.tsx"),
  read("src/components/Sidebar.tsx"),
  read("src/lib/responsive-shell-contract.ts"),
  read("src/components/VisualResponsiveContract.tsx"),
  read("src/lib/responsive-shell-learning.ts"),
  read("src/lib/shared-visual-parity-contract.ts"),
  read("src/components/product-market/DevelopmentStandardApplyConsole.tsx"),
  read("src/components/developer-platform/UnifiedFrameMigrationWorkbench.tsx"),
  read("src/components/product-market/VisualPageEditorDock.tsx"),
]);

for (const token of [
  "PRODUCT_MARKET_DISCLOSURE_KEY",
  "ROUTE_OWNED_SIDEBAR_DISCLOSURE_STRATEGY",
  "useRouteOwnedSidebarDisclosure",
  "activeRouteKey",
  "routeOwner",
  "openKey",
  "toggleDisclosure",
  "isDisclosureOpen",
]) {
  requireToken(hook, token, `shared hook token`);
}
forbidPattern(hook, /(?:localStorage|sessionStorage)/u, "persisted disclosure preference");

for (const token of [
  "sidebarNavigation",
  'strategy: "route-owned-single-branch"',
  'activeRoutePolicy: "open-owning-project-on-first-render"',
  'queryNavigationPolicy: "retain-owning-project-across-secondary-navigation"',
  'projectSwitchPolicy: "close-previous-and-open-current-project"',
  'remountPolicy: "derive-initial-open-project-from-url"',
  'persistencePolicy: "route-state-not-local-preference"',
]) {
  requireToken(responsiveContract, token, "responsive factory default");
}

for (const [label, source] of [
  ["Headquarters", hqSidebar],
  ["Agency Source", agencySourceSidebar],
  ["Client Source", clientSidebar],
]) {
  for (const token of [
    "useRouteOwnedSidebarDisclosure",
    "PRODUCT_MARKET_DISCLOSURE_KEY",
    "ROUTE_OWNED_SIDEBAR_DISCLOSURE_STRATEGY",
    "data-shared-sidebar-disclosure-contract",
    "data-shared-sidebar-disclosure={PRODUCT_MARKET_DISCLOSURE_KEY}",
    'data-shared-sidebar-route-active={productMarketRouteActive ? "true" : "false"}',
    "aria-expanded={productMarketExpanded}",
    "data-shared-sidebar-disclosure-child={PRODUCT_MARKET_DISCLOSURE_KEY}",
  ]) {
    requireToken(source, token, `${label} projection`);
  }
}

for (const [label, source] of [
  ["Headquarters", hqSidebar],
  ["Agency Source", agencySourceSidebar],
]) {
  requireToken(source, 'data-sidebar-primary-project="true"', `${label} primary project marker`);
}

for (const token of [
  "data-shared-sidebar-disclosure={hasChildren ? item.path : undefined}",
  'data-shared-sidebar-route-active={hasChildren ? (isParentActive(item) ? "true" : "false") : undefined}',
  "aria-expanded={hasChildren ? isOpen : undefined}",
  "data-shared-sidebar-disclosure-child={item.path}",
  "toggleDisclosure(item.path)",
]) {
  requireToken(clientSidebar, token, "Client Source ordinary-project projection");
}

const combinedSidebars = `${hqSidebar}\n${agencySourceSidebar}\n${clientSidebar}`;
forbidPattern(combinedSidebars, /productMarketRouteActive\s*\?\s*undefined/u, "legacy Product Market route exclusion");
forbidPattern(combinedSidebars, /setProductMarketExpanded/u, "per-sidebar Product Market state writer");
forbidPattern(combinedSidebars, /autoExpandedRouteKeyRef/u, "legacy effect-driven expansion guard");

for (const token of [
  "data-responsive-sidebar-navigation-policy",
  "RESPONSIVE_SHELL_FACTORY_DEFAULT.sidebarNavigation.strategy",
]) {
  requireToken(visualResponsiveContract, token, "visual responsive projection");
}
for (const token of [
  '"navigation-branch-mismatch"',
  "responsiveSidebarNavigationPolicy",
  "sharedSidebarDisclosureContract",
  "RESPONSIVE_SHELL_FACTORY_DEFAULT.sidebarNavigation.strategy",
]) {
  requireToken(responsiveLearning, token, "responsive learning integration");
}
for (const token of [
  '"responsive-sidebar-route-disclosure"',
  "data-shared-sidebar-disclosure-contract",
  "responsiveSidebarNavigationPolicy",
  "sharedSidebarDisclosureContract",
]) {
  requireToken(sharedParity, token, "shared visual parity integration");
}
requireToken(
  `${developerConsole}\n${unifiedWorkbench}`,
  "data-development-standard-sidebar-route-disclosure",
  "developer contract explanation",
);
requireToken(
  visualEditor,
  "data-responsive-sidebar-navigation-policy",
  "visual editor factory-default summary",
);

console.log("Shared sidebar disclosure contract verified: three source shells use one route-owned branch, learning/parity are wired, and legacy Product Market exclusion is absent.");
