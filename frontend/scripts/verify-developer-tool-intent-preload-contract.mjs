import { readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");
const externalDevtoolsMenu = read("src/components/ExternalDevtoolsMenu.tsx");
const routePreload = read("src/lib/route-preload.ts");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const token of [
  "let developmentStandardApplyConsolePromise: Promise<DevelopmentStandardApplyConsoleModule> | undefined",
  "if (developmentStandardApplyConsolePromise) return developmentStandardApplyConsolePromise",
  '() => import("@/components/product-market/DevelopmentStandardApplyConsole")',
  "developmentStandardApplyConsolePromise = undefined",
  "developmentStandardApplyConsolePromise = pending",
  "void loadDevelopmentStandardApplyConsole().catch(() => undefined)",
  "default: (await loadDevelopmentStandardApplyConsole()).DevelopmentStandardApplyConsole",
]) {
  assert(externalDevtoolsMenu.includes(token), `Apply console is missing retryable single-flight loading: ${token}`);
}

const applicationLauncherStart = externalDevtoolsMenu.indexOf("data-development-application-launcher");
const applicationLauncherEnd = externalDevtoolsMenu.indexOf("</button>", applicationLauncherStart);
const applicationLauncher = externalDevtoolsMenu.slice(applicationLauncherStart, applicationLauncherEnd);
for (const token of [
  "onPointerEnter={preloadDevelopmentStandardApplyConsole}",
  "onPointerDown={preloadDevelopmentStandardApplyConsole}",
  "onFocus={preloadDevelopmentStandardApplyConsole}",
  "preloadDevelopmentStandardApplyConsole();",
  "setConsoleOpen(true);",
]) {
  assert(applicationLauncher.includes(token), `Apply console launcher is missing real-intent preload: ${token}`);
}

const blueprintItemStart = externalDevtoolsMenu.indexOf('data-development-standard-quick-item="platform-blueprint"');
const blueprintItemEnd = externalDevtoolsMenu.indexOf("</DropdownMenuItem>", blueprintItemStart);
const blueprintItem = externalDevtoolsMenu.slice(blueprintItemStart, blueprintItemEnd);
for (const eventName of ["onPointerEnter", "onPointerDown", "onFocus", "onSelect"]) {
  assert(
    blueprintItem.includes(`${eventName}=`) && blueprintItem.includes("preloadWorkspaceRouteForPath(platformBlueprintRoute)"),
    `Blueprint entry does not precisely preload tab=blueprint on ${eventName}`,
  );
}

const standardItemsStart = externalDevtoolsMenu.indexOf("DEVELOPMENT_STANDARD_CATALOG.map");
const standardItemsEnd = externalDevtoolsMenu.indexOf("</DropdownMenuContent>", standardItemsStart);
const standardItems = externalDevtoolsMenu.slice(standardItemsStart, standardItemsEnd);
assert(
  standardItems.includes("const developmentStandardRoute = getDevelopmentStandardRoute(guideRoute, item.id)"),
  "Development-standard entries do not share one precise route",
);
for (const eventName of ["onPointerEnter", "onPointerDown", "onFocus", "onSelect"]) {
  assert(
    standardItems.includes(`${eventName}=`) && standardItems.includes("preloadWorkspaceRouteForPath(developmentStandardRoute)"),
    `Development-standard entry does not precisely preload tab=development on ${eventName}`,
  );
}

for (const [tab, modulePath] of [
  ["modules", "@/components/product-market/ProductMarketModulesPanel"],
  ["service", "@/lib/product-market-customer-service-section-loader"],
  ["development", "@/components/product-market/ProductMarketDevelopmentGuidePanel"],
  ["blueprint", "@/components/product-market/FactoryPlatformBlueprint"],
]) {
  assert(routePreload.includes(`get("tab")?.toLowerCase() === "${tab}"`), `route-preload is missing tab=${tab}`);
  assert(routePreload.includes(`import("${modulePath}")`), `route-preload is missing the tab=${tab} module`);
}
assert(
  routePreload.includes('const PRODUCT_MARKET_BLUEPRINT_PRELOAD_KEY = "productMarket:blueprint"')
    && routePreload.includes("routePreloads.delete(PRODUCT_MARKET_BLUEPRINT_PRELOAD_KEY)"),
  "Blueprint preload must be single-flight and release failures for real-route retry",
);

console.log("Developer tool intent preload contract passed: apply-console single-flight plus precise blueprint/development route preload.");
