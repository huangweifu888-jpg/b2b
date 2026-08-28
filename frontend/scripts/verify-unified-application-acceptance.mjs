import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFile(resolve(root, file), "utf8");
const assertIncludes = (source, expected, label) => {
  if (!source.includes(expected)) throw new Error(`统一应用验收缺失：${label}`);
};

const [baselines, navigation, market, css] = await Promise.all([
  read("src/lib/layout-quality-baselines.ts"),
  read("src/lib/product-market-navigation.ts"),
  read("src/pages/ProductMarket.tsx"),
  read("src/index.css"),
]);

assertIncludes(baselines, "LAYOUT_QUALITY_BASELINES", "六个普通业务页基线");
assertIncludes(baselines, "PRODUCT_MARKET_FRAME_ACCEPTANCE", "产品市场四页验收集合");
assertIncludes(baselines, "PRODUCT_MARKET_NAV_ITEMS.map", "产品市场验收由共享导航自动生成");
for (const [tab, label] of [["operations", "运营市场"], ["modules", "栏目配置"], ["layout", "版面风格"], ["service", "客服音效"]]) {
  assertIncludes(navigation, `{ tab: "${tab}", label: "${label}" }`, `产品市场 ${label} 导航项`);
}
assertIncludes(market, "resolveProductMarketNavTab", "四个子页使用统一路由解析");
assertIncludes(market, "data-product-market-layout", "运营市场主体框标记");
assertIncludes(market, 'data-product-market-settings-route="true"', "其余三页使用普通页面框架");
assertIncludes(css, "Shared Variables owns exactly one right-workspace surface", "四页主体外框统一规则");
assertIncludes(css, "Scroll tracks are part of the workspace chrome", "四页右侧滚条统一规则");

console.log("统一应用验收通过：六个普通业务页与产品市场四页均接入共享框架合同。");
