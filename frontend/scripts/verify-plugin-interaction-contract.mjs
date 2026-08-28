import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(path), "utf8");
const css = read("src/index.css");
const productMarket = read("src/pages/ProductMarket.tsx");
const contentPluginControls = read("src/components/content-plugins/ContentPluginControls.tsx");
const navigation = read("src/pages/CompanyInfo.tsx");
const redirect = read("src/pages/SiteSettings.tsx");
const banner = read("src/pages/CompanyInfoDeferredPanels.tsx");
const assertContains = (source, value, message) => {
  if (!source.includes(value)) throw new Error(message);
};
const assertExcludes = (source, value, message) => {
  if (source.includes(value)) throw new Error(message);
};

assertContains(css, "--tradepro-shared-plugin-control-size", "Plugin interactions must read the shared control-size token.");
assertContains(css, "--tradepro-shared-plugin-gap", "Plugin interactions must read the shared gap token.");
assertContains(css, "--tradepro-shared-plugin-icon-width", "Icon settings must retain the shared 90px width token.");
assertContains(css, ".product-module-category-operation-grid-fixed", "Fixed Product Market categories must use the shared title/status layout.");
assertContains(css, "--tradepro-shared-plugin-hover-surface", "Plugin hover must read the shared hover surface.");
assertContains(css, "box-shadow: 0 0 0 2px", "Pointer feedback must retain the visible circular focus ring.");
assertContains(css, ':is(#root, [data-visual-card-editor-dock]) :is(button, [role="button"])[data-content-plugin-control]:not([data-content-plugin-control^="status-"]):is(:hover, :focus-visible):not(:disabled)', "Plugin hover must bind to the shared hook instead of a page-specific container.");
assertContains(css, '[data-content-plugin-control="move-down"]', "Shared circular hover must cover both move controls.");
for (const control of ["drag", "move-up", "move-down"]) {
  assertContains(contentPluginControls, `data-content-plugin-control=\"${control}\"`, `Shared runtime action ${control} must expose the plugin hook.`);
}
for (const [control, runtimeToken] of [
  ["drag", "ContentPluginDragHandle"],
  ["move-up", "ContentPluginMoveButtons"],
  ["move-down", "ContentPluginMoveButtons"],
]) {
  assertContains(productMarket, runtimeToken, `Product Market action ${control} must consume the shared plugin runtime.`);
  assertContains(navigation, runtimeToken, `Navigation action ${control} must consume the shared plugin runtime.`);
}
assertContains(contentPluginControls, "data-content-plugin-control={`status-${status}`}", "Shared status actions must stay independently selectable.");
assertContains(contentPluginControls, 'data-content-plugin-actions="status"', "Shared status actions must expose one grouped plugin contract.");
assertContains(contentPluginControls, "content-plugin-status-button", "Shared status actions must use the protected shared runtime class.");
assertContains(productMarket, "ContentPluginStatusActions", "Product Market must consume shared status actions.");
assertExcludes(productMarket, "ContentPluginIconTrigger", "Product Market category rows must not restore the retired per-row icon setting.");
assertContains(navigation, 'data-content-plugin-control="icon"', "Navigation icon setting must expose the shared icon-trigger contract.");
assertContains(navigation, "content-plugin-icon-trigger", "Navigation icon setting must consume the shared icon-trigger contract.");
assertContains(productMarket, "product-module-category-operation-grid-fixed", "Product Market fixed categories must opt into the shared title/status spacing contract.");
assertContains(productMarket, '["--awm-operation-width" as string]: "330px"', "Product Market actions must retain their full 330px hit-area width.");
assertContains(productMarket, '["--awm-function-width" as string]: "570px"', "Product Market must preserve the separator gap between status and level controls.");
assertContains(css, 'button.content-plugin-icon-trigger:not(:hover):not(:focus-visible)', "Shared icon triggers must outrank generic navigation-frame button colour.");
assertContains(css, 'button.content-plugin-status-button:not(.is-active):not(:hover):not(:focus-visible)', "Inactive shared statuses must remain transparent inside list frames.");
assertContains(css, 'button.content-plugin-status-button.is-active[data-status="active"]', "The active shared status must retain its semantic blue state.");
assertContains(navigation, 'control="delete"', "Navigation deletion must consume the shared plugin action runtime.");
assertContains(redirect, 'data-content-plugin-control="drag"', "Redirect management must use shared drag interaction.");
assertContains(banner, 'data-content-plugin-actions="banner"', "Homepage Banner must expose real plugin action targets.");

console.log("Plugin-interaction contract verified.");
