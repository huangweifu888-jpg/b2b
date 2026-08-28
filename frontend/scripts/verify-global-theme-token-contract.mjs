import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (file) => readFileSync(resolve(file), "utf8");
const assertContains = (source, value, message) => {
  if (!source.includes(value)) throw new Error(message);
};

const tokens = read("src/lib/global-theme-tokens.ts");
const app = read("src/App.tsx");
const productMarketRuntime = read("src/components/AppProductMarketRuntime.tsx");
const productMarket = read("src/pages/ProductMarket.tsx");
const unifiedActionDialog = read("src/components/UnifiedActionDialog.tsx");
const globalStyles = read("src/index.css");

for (const name of [
  "--tradepro-shell-from",
  "--tradepro-panel-frame-bg",
  "--tradepro-panel-title-bg",
  "--tradepro-panel-title-2-bg",
  "--tradepro-panel-title-2-primary",
  "--tradepro-panel-card-bg",
  "--tradepro-panel-table-bg",
  "--tradepro-shared-selection-bg",
  "--tradepro-shared-selection-text",
  "--tradepro-shared-selection-outline",
  "--tradepro-client-topbar-bg",
  "--tradepro-client-footer-bg",
]) {
  assertContains(tokens, `"${name}"`, `Global theme source is missing ${name}.`);
}

assertContains(tokens, "export const GLOBAL_THEME_TOKEN_NAMES", "Global theme tokens must have one named token list.");
assertContains(tokens, "export function resolveGlobalThemeTokens", "Global theme tokens must have one resolver.");
assertContains(tokens, "export function resolveGlobalFooterTheme", "Global footer must have one shared resolver.");
assertContains(tokens, "export function applyGlobalThemeTokens", "Global theme tokens must have one runtime applier.");
assertContains(tokens, "export const SHARED_SELECTION_SURFACE_CONTRACT", "Shared selected surfaces must have one semantic token contract.");
assertContains(tokens, "export function isSharedSelectionSurfaceActive", "Shared selected surfaces must have one active-state resolver.");
assertContains(tokens, "export function hasSharedSelectionSurfaceStateParity", "Shared selected surfaces must have one accessibility-state parity resolver.");
assertContains(tokens, "layout.clientFooterOverrideBgColor?.trim() || sidebarEnd", "Footer background must default to the sidebar gradient end.");
assertContains(tokens, "layout.clientFooterOverrideTextColor?.trim() || sidebarText", "Footer text must default to the shared sidebar text.");
if (tokens.includes("layout.clientFooterOverrideBgColor || layout.footerBgColor")) {
  throw new Error("Legacy footerBgColor still masks the shared gradient-end contract.");
}
assertContains(tokens, "layout.themePanelBgColor", "Title 2 must read the active theme panel surface.");
assertContains(tokens, "layout.themePanelButtonColor", "Title 2 must read the active theme primary action.");
assertContains(app, 'applyGlobalThemeTokens, resolveGlobalThemeTokens', "App runtime must use the shared theme resolver.");
assertContains(app, "applyGlobalThemeTokens(root, resolveGlobalThemeTokens(state.layoutStyle, state.sidebarStyle))", "App bootstrap must restore legacy global tokens through the shared resolver.");
assertContains(productMarketRuntime, "applyGlobalThemeTokens(root, resolveGlobalThemeTokens(layoutStyle, sidebarStyle))", "Product Market runtime must apply the resolved global tokens.");
assertContains(productMarketRuntime, "...resolveGlobalThemeTokens(layoutStyle, sidebarStyle)", "Product Market runtime must inherit the same resolved global tokens.");
assertContains(productMarket, "GLOBAL_THEME_TOKEN_NAMES,", "Product Market preview must import the shared theme token list.");
assertContains(productMarket, "resolveGlobalThemeTokens,", "Product Market preview must import the shared theme resolver.");
assertContains(productMarket, "GLOBAL_THEME_TOKEN_NAMES.map", "Theme preview must capture the complete shared token list.");
assertContains(productMarket, "resolveGlobalThemeTokens(previewThemePreset.layout, previewThemePreset.sidebar)", "Theme preview must use the same resolver as the runtime.");
assertContains(productMarket, 'data-customer-service-expert-card="true"', "Customer Service must expose the expert-card semantic surface.");
assertContains(productMarket, 'data-shared-selection-control="true"', "Customer Service selected cards must expose the shared selection control contract.");
assertContains(productMarket, "aria-pressed={csAvatarId === preset.id}", "Customer Service expert cards must synchronize their accessible selected state.");
assertContains(productMarket, "aria-pressed={selectedAvatarSequenceMatch.animationStyle === option.value}", "Customer Service animation choices must synchronize their accessible selected state.");
assertContains(productMarket, 'data-shared-theme-palette-appearance="operations-theme-switch"', "Operations theme buttons must expose the shared palette role.");
assertContains(productMarket, "data-selected={isActive}", "Operations and Layout theme buttons must expose their selected state.");
assertContains(productMarket, "aria-pressed={isActive}", "Operations and Layout theme buttons must synchronize their accessible selected state.");
assertContains(globalStyles, '[data-product-market-card][data-product-market-batch-selected="true"]', "Operations batch selection must own a shared outline rule after global elevation.");
assertContains(globalStyles, "0 0 0 2px var(--tradepro-shared-selection-outline)", "Operations batch selection must read the shared outline token.");
assertContains(productMarket, "tempLayout.clientFooterOverrideBgColor || sidebarStyle.bgTo", "Theme editor footer preview must inherit the gradient end.");
assertContains(unifiedActionDialog, "resolveGlobalFooterTheme(layoutStyle, sidebarStyle)", "Shared dialogs must consume the global footer resolver.");
assertContains(unifiedActionDialog, "function formatActionErrorMessage", "Shared dialogs must own one user-facing action-error formatter.");
assertContains(unifiedActionDialog, "连接本地服务失败，请确认本地服务已启动后重试。", "Shared dialogs must translate fetch failures into a Chinese local-service recovery message.");
assertContains(unifiedActionDialog, "failed to fetch|networkerror|network request failed", "Shared dialogs must classify browser network failures before rendering them.");
assertContains(globalStyles, "var(--tradepro-client-footer-bg, var(--tradepro-shell-to))", "Client-source footers must inherit the shared gradient-end chain.");
assertContains(globalStyles, "var(--tradepro-shared-footer-bg, var(--tradepro-client-footer-bg, var(--tradepro-shell-to)))", "HQ, agency and client runtime footers must share one footer token chain.");
if (productMarket.includes("getGlobalThemePreviewVariables") || productMarket.includes("const GLOBAL_THEME_PREVIEW_VARIABLES")) {
  throw new Error("Product Market still contains a retired duplicate global-theme resolver.");
}

console.log("Global theme token contract verified.");
