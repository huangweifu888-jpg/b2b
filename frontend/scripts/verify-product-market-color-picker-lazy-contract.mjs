import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const productMarket = read("src/pages/ProductMarket.tsx");
const colorPicker = read("src/components/product-market/ProductMarketColorPicker.tsx");
const themeEditor = read("src/components/product-market/ProductMarketThemeEditorDialog.tsx");
const packageJson = JSON.parse(read("package.json"));

assert.match(
  productMarket,
  /import type \{ ProductMarketColorPickerProps \} from "@\/components\/product-market\/ProductMarketColorPicker";/u,
  "ProductMarket may retain only the color-picker type on its eager path.",
);
assert.doesNotMatch(
  productMarket,
  /import \{ ProductMarketColorPicker/u,
  "ProductMarket must not statically import the color-picker implementation.",
);
assert.match(
  productMarket,
  /import\("@\/components\/product-market\/ProductMarketColorPicker"\)/u,
  "The color-picker implementation must load through a dynamic import.",
);
assert.match(
  productMarket,
  /loadLazyModule\([\s\S]*?import\("@\/components\/product-market\/ProductMarketColorPicker"\)[\s\S]*?"product-market-color-picker"[\s\S]*?\)/u,
  "The deferred picker must use shared inline retry and recovery diagnostics.",
);
assert.match(
  productMarket,
  /if \(productMarketColorPickerPromise\) return productMarketColorPickerPromise;[\s\S]*?productMarketColorPickerPromise = undefined;[\s\S]*?throw error;/u,
  "The color-picker loader must be single-flight and release a failed preload for retry.",
);
assert.match(
  productMarket,
  /const LazyProductMarketColorPicker = lazy\(async \(\) => \(\{[\s\S]*?loadProductMarketColorPicker\(\)[\s\S]*?ProductMarketColorPicker[\s\S]*?\}\)\);/u,
  "The real picker must use the retryable module promise through one React.lazy boundary.",
);
assert.ok(
  productMarket.includes("<Suspense fallback={(")
    && productMarket.includes("<LazyProductMarketColorPicker {...props} />")
    && productMarket.includes('data-product-market-color-picker-loader="loading"')
    && productMarket.includes('["--color-picker-value" as string]: props.surfaceColor || props.value')
    && productMarket.includes('["--color-picker-contrast" as string]: props.textColor || "#F8FAFC"')
    && productMarket.includes('["--color-picker-text" as string]: props.textColor || props.value'),
  "Each picker must retain a lightweight, color-stable Suspense fallback.",
);
assert.doesNotMatch(
  productMarket,
  /productMarketColorPickerListeners|ResolvedColorPicker|setResolvedColorPicker|setLoadFailed/u,
  "The lazy wrapper must not add per-picker listener, state or effect fan-out.",
);
assert.match(
  productMarket,
  /<TabsTrigger[\s\S]{0,160}?value="layout"[\s\S]{0,420}?onPointerEnter=\{preloadProductMarketColorPicker\}[\s\S]{0,220}?onPointerDown=\{preloadProductMarketColorPicker\}[\s\S]{0,220}?onFocus=\{preloadProductMarketColorPicker\}/u,
  "The Layout entry must preload the color picker on pointer and keyboard intent.",
);
assert.ok(
  productMarket.includes("preloadProductMarketColorPicker();")
    && productMarket.includes("colorPicker={ColorPicker}"),
  "The lazy theme editor must retain its injected picker contract and share the same preload.",
);
assert.ok(
  !productMarket.includes("const COLOR_PRESETS = [")
    && !productMarket.includes("function ColorPicker({")
    && !productMarket.includes('from "@/components/ui/popover"'),
  "Palette data, picker implementation and popover runtime must stay out of ProductMarket.",
);

for (const token of [
  "const COLOR_PRESETS = [",
  "export type ProductMarketColorPickerProps",
  "data-color-picker-value={value}",
  "collisionBoundary={collisionBoundary}",
  'type="color"',
]) {
  assert.ok(colorPicker.includes(token), `Lazy color-picker module lost its controlled UI contract: ${token}`);
}
assert.ok(
  themeEditor.includes("colorPicker: ComponentType<ThemeColorPickerProps>")
    && themeEditor.includes("colorPicker: ColorPicker"),
  "Theme editor picker injection must remain source-compatible.",
);

const rawBytes = Buffer.byteLength(colorPicker);
const gzipBytes = gzipSync(colorPicker, { level: 9 }).byteLength;
assert.ok(rawBytes >= 4_500 && gzipBytes >= 1_500, "The deferred picker must remain a meaningful lazy boundary.");
assert.equal(
  packageJson.scripts["verify:product-market-color-picker-lazy"],
  "node scripts/verify-product-market-color-picker-lazy-contract.mjs",
  "Package scripts must expose the focused color-picker boundary gate.",
);

console.log(`ProductMarket color-picker lazy contract verified: ${rawBytes} raw / ${gzipBytes} gzip source bytes deferred from ordinary tabs.`);
