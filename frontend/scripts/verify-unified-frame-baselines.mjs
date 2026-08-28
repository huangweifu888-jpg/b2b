import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const productMarket = read("src/pages/ProductMarket.tsx");
const socialMedia = read("src/pages/SocialMedia.tsx");
const socialPlaybook = read("src/components/social/SocialMarketingPlaybook.tsx");
const sharedCards = read("src/lib/shared-card-region-contract.ts");
const contract = read("src/lib/unified-page-frame-contract.ts");
const sourceFooters = [
  read("src/components/HQLayout.tsx"),
  read("src/components/AgencySourceLayout.tsx"),
  read("src/components/ClientSourceLayout.tsx"),
];

const requireToken = (source, token, label) => {
  if (!source.includes(token)) throw new Error(`${label}：${token}`);
};

const productFactoryStart = productMarket.indexOf("if (isRoutePage) {", productMarket.indexOf("function ProductMarketSettingsHost"));
const productFactoryEnd = productMarket.indexOf("</FactoryPage>", productFactoryStart);
const productSettingsHost = productMarket.slice(productFactoryStart, productFactoryEnd);
const productOperationsStart = productMarket.indexOf("!templateSettingsSubview ? <FactoryPage");
const productOperationsEnd = productMarket.indexOf("</FactoryPage>", productOperationsStart);
const productOperations = productMarket.slice(productOperationsStart, productOperationsEnd);
const socialFactoryStart = socialMedia.indexOf("const factoryProps =");
const socialFactoryEnd = socialMedia.indexOf(") : workspace;", socialFactoryStart);
const socialFactory = socialMedia.slice(socialFactoryStart, socialFactoryEnd);

for (const [label, source] of [
  ["产品市场设置基准页", productSettingsHost],
  ["运营市场基准页", productOperations],
]) {
  requireToken(source, 'scrollContract="table-inner-60"', label);
  if (source.includes("autoRegions")) throw new Error(`${label}仍依赖运行时自动猜测区域。`);
}
requireToken(socialFactory, 'scrollContract: "table-inner-60" as const', "营销作战基准页");
if (socialFactory.includes("autoRegions")) throw new Error("营销作战基准页仍依赖运行时自动猜测区域。");

for (const token of [
  'data-page-factory-region="title-1"',
  'data-page-factory-region="table-header"',
  'data-page-factory-region="table-shell"',
  'data-page-factory-region="content"',
  'data-page-list-scroll-owner',
]) requireToken(socialMedia, token, "营销作战显式结构缺失");

for (const token of [
  'data-development-standard-frame-region="title"',
  'data-development-standard-frame-region="table-shell"',
  'data-development-standard-frame-region="table-header"',
  'data-development-standard-frame-region="content"',
  'data-page-list-scroll-owner',
]) requireToken(productMarket, token, "产品市场五层框架缺失");
for (const source of sourceFooters) requireToken(source, "data-page-layout-footer", "三端尾栏契约缺失");

for (const token of [
  "SHARED_LAYOUT_STYLE_LARGE_CARD_PROPS",
  "SHARED_LAYOUT_STYLE_SMALL_CARD_PROPS",
]) requireToken(socialPlaybook, token, "营销作战卡片未复用共享契约");
for (const token of [
  '"data-page-factory-region": SHARED_LAYOUT_STYLE_CARD_REGION_CONTRACT.large.region',
  '"data-page-factory-region": SHARED_LAYOUT_STYLE_CARD_REGION_CONTRACT.small.region',
]) requireToken(sharedCards, token, "共享卡片契约缺失显式区域");

for (const token of [
  'sourceScopes: ["hq", "agency_source", "client_source"]',
  "boundaryPairs: [[639, 640], [767, 768], [1023, 1024], [1279, 1280]]",
  "pageVerticalOwners: 1",
  "baselineRequiredForEveryBatch: true",
  'failedPagePolicy: "isolate-and-keep-current-adapter"',
]) requireToken(contract, token, "基准页批次门禁缺失");

console.log("五个基准页统一框架静态门禁通过：显式区域、唯一滚动、三端与隔离规则均已登记。");
