import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const fail = (message) => {
  console.error(`主题可读性契约失败：${message}`);
  process.exit(1);
};
const assert = (condition, message) => {
  if (!condition) fail(message);
};

const palettePath = "src/lib/product-market-theme-palettes.json";
const paletteContract = read("src/lib/product-market-theme-palettes.ts");
const productMarketStore = read("src/lib/product-market-store.ts");
const palettes = JSON.parse(read(palettePath));
const requiredKeys = ["rose", "orange", "indigoGreen", "tealRose", "limeTea", "dark", "light"];
const requiredNames = ["玫红天青", "暖橘荷青", "因蓝艾绿", "斯绿玫粉", "凝白茶青", "墨黑星紫", "松褐吉粉"];
const exactBrandPairs = {
  rose: ["#F9D2E4", "#BFDEFF"],
  orange: ["#FF6F2C", "#A1E6DD"],
  indigoGreen: ["#012696", "#A4E2C6"],
  dark: ["#0B0C10", "#A855F7"],
};
const requiredFields = [
  "primary", "secondary", "chrome", "action", "surface", "elevated", "panel",
  "secondarySurface", "border", "focus", "text", "mutedText", "onPrimary",
  "onSecondary", "onChrome", "onAction",
];
const opaqueHex = /^#[0-9A-F]{6}$/i;

const luminance = (hex) => {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};
const contrast = (left, right) => {
  const first = luminance(left);
  const second = luminance(right);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};
const assertPair = (palette, backgroundField, foregroundField, minimum) => {
  const ratio = contrast(palette[backgroundField], palette[foregroundField]);
  assert(
    ratio >= minimum,
    `${palette.name} ${backgroundField}/${foregroundField} 对比度 ${ratio.toFixed(2)}，低于 ${minimum}:1`
  );
};

assert(Array.isArray(palettes) && palettes.length === 7, "必须且只能登记七套内置色板");
assert(JSON.stringify(palettes.map(({ key }) => key)) === JSON.stringify(requiredKeys), "主题键或顺序发生分叉");
assert(JSON.stringify(palettes.map(({ name }) => name)) === JSON.stringify(requiredNames), "主题名称发生分叉");
assert(new Set(palettes.map(({ key }) => key)).size === 7, "主题键存在重复");

for (const palette of palettes) {
  for (const field of requiredFields) {
    assert(opaqueHex.test(palette[field] || ""), `${palette.name}.${field} 必须是不透明六位十六进制颜色`);
  }
  if (exactBrandPairs[palette.key]) {
    assert(
      palette.primary === exactBrandPairs[palette.key][0] && palette.secondary === exactBrandPairs[palette.key][1],
      `${palette.name} 的用户指定主辅色被改动`
    );
  }
  for (const [background, foreground] of [
    ["primary", "onPrimary"],
    ["secondary", "onSecondary"],
    ["chrome", "onChrome"],
    ["action", "onAction"],
    ["surface", "text"],
    ["elevated", "text"],
    ["panel", "text"],
    ["secondarySurface", "text"],
    ["surface", "mutedText"],
  ]) {
    assertPair(palette, background, foreground, 4.5);
  }
  assertPair(palette, "surface", "border", 3);
  assertPair(palette, "elevated", "border", 3);
  assertPair(palette, "panel", "border", 3);
  assertPair(palette, "secondarySurface", "focus", 3);
  assertPair(palette, "surface", "focus", 3);
}

const store = read("src/lib/product-market-store.ts");
const market = read("src/pages/ProductMarket.tsx");
const css = read("src/index.css");
const contrastSource = read("src/lib/color-contrast.ts");
const frameContract = read("src/lib/layout-frame-contract.ts");
const rotation = read("src/lib/product-market-theme-rotation.ts");
const globalThemeTokens = read("src/lib/global-theme-tokens.ts");
const clientSidebar = read("src/components/Sidebar.tsx");
const hqSidebar = read("src/components/HQSidebar.tsx");
const agencySidebar = read("src/components/AgencySourceSidebar.tsx");

assert(store.includes("PRODUCT_MARKET_THEME_PALETTES.map(\n  buildBuiltinThemeFromPalette"), "工厂主题未从唯一色板投影");
assert(paletteContract.includes("PRODUCT_MARKET_FACTORY_STATUS_SEMANTICS"), "状态卡片缺少工厂语义色源");
assert(paletteContract.includes("PRODUCT_MARKET_IMMUTABLE_THEME_PREVIEW_MAP"), "缺少三入口工厂只读预览色源");
assert(paletteContract.includes("operationsSwitch: Object.freeze") && paletteContract.includes("layoutChooser: Object.freeze") && paletteContract.includes("expandedThemeStatus: Object.freeze"), "三入口预览颜色没有分别深度冻结");
assert(paletteContract.includes("background: palette.primary") && paletteContract.includes("text: palette.onPrimary"), "运营市场或已展开主题没有读取主色与主色可读字");
assert(paletteContract.includes("background: palette.panel") && paletteContract.includes("text: palette.text"), "选择色调没有读取面板底与正文可读字");
assert(paletteContract.includes('button: "#D92D20"') && paletteContract.includes('button: "#D1D5DB"'), "取消/隐藏状态未使用高红色和浅灰色工厂胶囊");
assert(paletteContract.includes("bg: palette.primary") && paletteContract.includes("button: palette.action"), "开通状态的卡片和胶囊未从同一色板分层读取");
assert(store.includes("buildProductMarketFactoryStatusCards(palette)"), "七色板未投影为工厂状态卡片颜色");
assert(store.includes("LEGACY_FACTORY_BUILTIN_THEMES"), "缺少只迁移未自定义旧默认值的兼容快照");
assert(store.includes("borderColor: colors.border"), "主题应用遗漏卡片边框色");
assert(
  paletteContract.includes("PRODUCT_MARKET_IMMUTABLE_THEME_PREVIEW_MAP = Object.freeze")
    && paletteContract.includes("PRODUCT_MARKET_THEME_PALETTES.map((palette) =>"),
  "版面风格预设卡的只读预览未从共享色板派生",
);
assert(market.includes("PRODUCT_MARKET_IMMUTABLE_THEME_PREVIEW_MAP"), "三个特殊入口未读取工厂只读预览色策略");
assert(market.includes("data-product-market-palette-key"), "版面风格预设卡缺少可检测的主题契约标记");
assert(market.includes("--tradepro-product-market-palette-card-text"), "版面风格预设卡未输出已校验文字变量");
assert(market.includes("--tradepro-product-market-palette-card-primary"), "版面风格预设卡未输出同源主体色变量");
assert(market.includes("data-shared-theme-palette-state"), "版面风格预设卡未登记选中、预览与空闲状态");
assert(market.includes('data-shared-theme-palette-appearance="title-2-dual-tone"'), "标题2未登记浅底色与主体色双层契约");
assert(market.includes('data-shared-theme-palette-policy="immutable-factory-preview"'), "三个特殊入口未登记不可覆盖策略");
assert(market.includes('data-shared-theme-palette-appearance="layout-chooser"'), "选择色调未登记工厂只读入口");
assert(market.includes('data-shared-theme-palette-appearance="expanded-theme-toggle"'), "已展开主题未登记工厂只读入口");
assert(market.includes("const fixedPreview = PRODUCT_MARKET_IMMUTABLE_THEME_PREVIEW_MAP[PRESET_THEME_KEY_MAP[key]].layoutChooser"), "版面风格预设卡未读取每套色板自己的固定 panel/text 预览色");
assert(
  market.includes("const presetBgColor = fixedPreview.background")
    && market.includes("const presetCardTextColor = fixedPreview.text"),
  "预设主题颜色仍可能从页面草案读取",
);
assert(market.includes("resolveAccessibleTextColor as resolveReadableTextColor"), "页面未读取共享对比度计算器");
assert(!/function\s+(parseColorToRgb|getColorLuminance|getContrastRatio|resolveReadableTextColor)\s*\(/.test(market), "页面仍保留重复对比度算法");
assert(contrastSource.includes("WCAG_TEXT_MIN_CONTRAST = 4.5"), "共享文字门槛必须为 4.5:1");
assert(contrastSource.includes("WCAG_NON_TEXT_MIN_CONTRAST = 3"), "共享非文字门槛必须为 3:1");
assert(!css.includes("ivoryStarlight"), "CSS 仍包含退役主题键 ivoryStarlight");

assert(globalThemeTokens.includes('"--tradepro-shell-active-text"'), "left selected text lacks a shared accessible theme token");
assert(globalThemeTokens.includes("resolveAccessibleThemeTextColor(\n    sidebarSelectionBackground") && globalThemeTokens.includes("resolveAccessibleThemeTextColor(\n    selectionBackground"), "left/right selected text does not share the WCAG fallback resolver");
assert(globalThemeTokens.includes('LEFT_SELECTED_TEXT_FALLBACK = "#FFFFCC"'), "left selected text lacks its warm high-contrast shared fallback");
assert(globalThemeTokens.includes('RIGHT_SELECTED_TEXT_FALLBACK = "#FFFFCC"'), "right selected text lacks the shared warm high-contrast factory default");
assert(globalThemeTokens.includes('PREVIOUS_RIGHT_SELECTED_TEXT_FALLBACKS = ["#EEFFFF", "#FFFCEB"]') && globalThemeTokens.includes("normalizeRightSelectedTextPreference"), "former right selected-text defaults lack a safe exact migration");
assert(market.includes("RIGHT_SELECTED_TEXT_FALLBACK") && market.includes("LEFT_SELECTED_TEXT_FALLBACK"), "layout preview does not consume both distinct selected-text fallbacks");
assert(productMarketStore.includes("rightSelectedTextColor: rightSelectedText"), "factory themes do not persist the distinct right selected-text default");
assert(productMarketStore.includes("activeHighlight: leftSelectedText"), "factory themes do not persist the distinct left selected-text default");
assert(productMarketStore.includes("clientFeatureCardBgColor: statusCards.active.bg") && productMarketStore.includes("clientFeatureCardTextColor: statusCards.active.nameFont"), "lightweight-frame small-card defaults do not share the active-status background/text pair");
assert(productMarketStore.includes("isUntouchedPreviousSmallCardDefault"), "previous untouched small-card defaults lack an exact safe migration");
for (const [name, source] of [["client", clientSidebar], ["hq", hqSidebar], ["agency", agencySidebar]]) {
  assert(source.includes("--tradepro-shell-active-text"), `${name} sidebar does not consume the shared accessible selected-text token`);
  assert(source.includes("backgroundColor: sidebarBorder") || source.includes("backgroundColor: activeSurface") || source.includes("background: activeSurface"), `${name} sidebar selection does not use the shared selected-frame surface`);
}

for (const match of css.matchAll(/([^{}]*data-product-market-theme-key[^{}]*)\{([^{}]*)\}/g)) {
  assert(!/#(?:[0-9a-f]{3}|[0-9a-f]{6})\b|rgba?\(|hsla?\(/i.test(match[2]), `主题键 CSS 仍有硬编码颜色：${match[1].trim()}`);
}
assert(css.includes("var(--tradepro-product-market-theme-switch-bg)"), "快捷主题通用 CSS 未读取语义变量");
assert(css.includes("var(--tradepro-product-market-theme-switch-text)"), "快捷主题文字未读取语义变量");
assert(css.includes("var(--tradepro-product-market-palette-card-text)"), "预设色卡未抵抗表头文字继承覆盖");
assert(css.includes("var(--tradepro-panel-title-2-bg"), "标题2共享插件未读取专属浅底色变量");

for (const key of requiredKeys) {
  assert(rotation.includes(`"${key}"`), `计划主题轮换缺少 ${key}`);
}
assert(frameContract.includes("PRODUCT_MARKET_THEME_READABILITY_CONTRACT"), "开发器未登记七主题可读性契约");
assert(frameContract.includes("三端样式边界"), "全局样式器缺少三端下游保护规则");
assert(frameContract.includes("旧主题样式清退"), "代码删除器缺少旧主题清退规则");
assert(frameContract.includes("七主题可读性"), "页面清扫器缺少七主题扫描规则");

console.log("主题可读性契约通过：7 套色板、9 组文字色对、5 组边界色对、三端开发器规则均已验证。");
