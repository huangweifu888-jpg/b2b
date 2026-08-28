import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFile(resolve(root, file), "utf8");
const assertIncludes = (source, token, label) => {
  if (!source.includes(token)) throw new Error(`社交媒体营销作战缺少：${label}`);
};

const [page, playbook, component, layoutCss, cardCss, cardContract, main, standard, workbench, sourcePackage, productStore, platformModules, sidebar, roadmap, blueprint, channels, productMarket, factoryPage] = await Promise.all([
  read("src/pages/SocialMedia.tsx"),
  read("src/lib/social-marketing-playbook.ts"),
  read("src/components/social/SocialMarketingPlaybook.tsx"),
  read("src/shared-existing-workspace-frame.css"),
  read("src/shared-layout-style-card.css"),
  read("src/lib/shared-card-region-contract.ts"),
  read("src/main.tsx"),
  read("src/lib/development-standard-template.ts"),
  read("src/components/product-market/DevelopmentStandardWorkbench.tsx"),
  read("src/lib/social-source-package.ts"),
  read("src/lib/product-market-store.ts"),
  read("src/lib/platform-modules.ts"),
  read("src/components/Sidebar.tsx"),
  read("src/lib/social-development-roadmap.ts"),
  read("src/lib/factory-platform-blueprint.ts"),
  read("src/lib/social-channel-contract.ts"),
  read("src/pages/ProductMarket.tsx"),
  read("src/page-factory/FactoryPage.tsx"),
]);

for (const [source, token, label] of [
  [blueprint, 'tab: "marketing-playbook"', "营销作战二级栏目"],
  [page, "FACTORY_PLATFORM_SOCIAL_WORKSPACES.map", "营销作战共享页签来源"],
  [page, "<SocialMarketingPlaybook", "营销作战页面入口"],
  [page, 'asChild frameOwner="existing-workspace"', "页面工厂复用真实社媒主体"],
  [page, 'data-development-standard-frame-region="body"', "真实主体区域"],
  [page, 'data-development-standard-frame-region="title-1"', "真实标题区域"],
  [page, 'data-page-table-shell', "真实表内区域"],
  [page, 'data-development-standard-frame-region="table-header"', "真实表头区域"],
  [page, 'data-development-standard-frame-region="content"', "真实内容区域"],
  [page, '"table-inner-60"', "唯一内容滚动契约"],
  [component, "data-social-marketing-playbook", "营销作战共享工作区"],
  [component, "data-social-marketing-stage-navigation", "九阶段业务导航"],
  [component, 'data-social-marketing-logic', "营销逻辑区"],
  [component, 'data-social-marketing-operation', "操作使用区"],
  [component, "SHARED_LAYOUT_STYLE_LARGE_CARD_PROPS", "大卡片共享语义"],
  [component, "SHARED_LAYOUT_STYLE_SMALL_CARD_PROPS", "小卡片共享语义"],
  [cardContract, '"data-page-factory-region": SHARED_LAYOUT_STYLE_CARD_REGION_CONTRACT.large.region', "大卡片页面工厂登记"],
  [cardContract, '"data-page-factory-region": SHARED_LAYOUT_STYLE_CARD_REGION_CONTRACT.small.region', "小卡片页面工厂登记"],
  [cardContract, '"data-shared-card-token-source": SHARED_LAYOUT_STYLE_CARD_REGION_CONTRACT.tokenSource', "大／小卡片版面风格令牌来源"],
  [playbook, "SOCIAL_MARKETING_CARD_REGION_CONTRACT", "营销作战卡片数量契约"],
  [component, "人工验收完成", "人工验收操作"],
  [component, "重新自检", "系统自检操作"],
  [standard, 'id: "development-standard-v1"', "统一规范模板"],
  [workbench, "data-development-standard-template", "开发器规范模板应用"],
  [sourcePackage, "marketingPlaybook", "来源包营销作战版本"],
  [productStore, "FACTORY_PLATFORM_SOCIAL_WORKSPACES.map", "多端产品目录"],
  [platformModules, "FACTORY_PLATFORM_SOCIAL_WORKSPACES.map", "客户源平台目录"],
  [sidebar, "FACTORY_PLATFORM_SOCIAL_WORKSPACES.map", "客户端左侧导航"],
  [channels, "SOCIAL_CHANNEL_CONTRACT_ID", "国内外渠道共享契约"],
  [roadmap, 'order: 52', "痛点路线开发阶段 43-52"],
  [layoutCss, '[data-page-factory-frame-owner="existing-workspace"]', "共享 existing-workspace 适配边界"],
  [layoutCss, '[data-development-standard-frame-region="table-shell"]', "共享 canonical 表内样式"],
  [layoutCss, '[data-development-standard-frame-region="table-header"]', "共享 canonical 表头样式"],
  [layoutCss, '[data-shared-scroll-contract="table-inner-60"][data-page-list-scroll-owner][data-development-standard-frame-region="content"]', "共享表内唯一滚动宿主样式"],
  [layoutCss, 'html[data-visual-card-editor-open]', "真实开发态五类标注显示机制"],
  [layoutCss, 'data-existing-workspace-body-marker-host', "主体标注开发器外框桥"],
  [layoutCss, 'content: none !important', "canonical 主体内框不得重复绘制标注"],
  [productMarket, 'asChild', "运营市场复用现有工作区"],
  [productMarket, 'frameOwner="existing-workspace"', "运营市场采用同一 FactoryPage 适配边界"],
  [productMarket, 'data-development-standard-frame-region="body"', "运营市场 canonical 主体"],
  [productMarket, 'data-development-standard-frame-region="title"', "运营市场 canonical 标题"],
  [productMarket, 'data-development-standard-frame-region="table-shell"', "运营市场 canonical 表内"],
  [productMarket, 'data-development-standard-frame-region="table-header"', "运营市场 canonical 表头"],
  [productMarket, 'data-development-standard-frame-region="content"', "运营市场 canonical 内容"],
  [productMarket, 'data-shared-scroll-contract="table-inner-60"', "运营市场采用同一滚动契约"],
  [main, 'import "./shared-existing-workspace-frame.css"', "共享框架一次性全局入口"],
  [main, 'import "./shared-layout-style-card.css"', "共享大／小卡片一次性全局入口"],
  [cardCss, '[data-shared-large-card-surface="true"]', "共享大卡片表面"],
  [cardCss, '[data-shared-small-card-surface="true"]', "共享小卡片表面"],
  [cardCss, "--tradepro-product-market-large-card-bg", "大卡片版面风格底色"],
  [cardCss, "--tradepro-product-market-large-card-text", "大卡片版面风格字体"],
  [cardCss, "--tradepro-panel-card-bg", "小卡片版面风格底色"],
  [cardCss, "--tradepro-panel-card-text", "小卡片版面风格字体"],
  [cardCss, 'html[data-visual-card-editor-open]', "开发器大／小卡片标注"],
  [factoryPage, 'root.querySelectorAll<HTMLElement>(`[data-page-factory-region="${region}"]`)', "显式卡片语义优先于运行时猜测"],
]) assertIncludes(source, token, label);

if (page.includes("social-media-layout.css") || page.includes("shared-existing-workspace-frame.css")) {
  throw new Error("营销作战页面不得私有导入共享框架；兼容页面必须从全局入口自动消费。");
}

const tableHeaderCount = (`${page}\n${component}`.match(/\bdata-page-table-header\b/g) || []).length;
if (tableHeaderCount !== 1) throw new Error(`营销作战必须正好拥有 1 个真实 data-page-table-header，当前为 ${tableHeaderCount}。`);

const sharedListCount = (`${page}\n${component}`.match(/data-shared-layout-section="list"/g) || []).length;
if (sharedListCount !== 1) throw new Error(`营销作战必须正好拥有 1 个共享 list 与滚动宿主，当前为 ${sharedListCount}。`);

if (layoutCss.includes("[data-social-") || layoutCss.includes("[data-product-market-")) {
  throw new Error("共享 existing-workspace 样式不得按营销作战或运营市场路由命名；两页必须消费同一 canonical selector。");
}

if (cardCss.includes("[data-social-") || cardCss.includes("[data-product-market-")) {
  throw new Error("共享卡片样式不得按营销作战或运营市场路由命名；所有页面必须消费同一语义卡片契约。");
}

if (!component.includes("<Card {...SHARED_LAYOUT_STYLE_LARGE_CARD_PROPS}") || !component.includes("<section {...SHARED_LAYOUT_STYLE_SMALL_CARD_PROPS}")) {
  throw new Error("营销作战必须把真实外层卡片与真实内层小卡片登记到共享语义，不能依赖 CardContent 猜测。");
}

const stageCount = (playbook.match(/id: "(?:market-strategy|factory-profile|account-connect|content-kit|video-production|publish-calendar|interaction-lead|sample-quotation|order-attribution)"/g) || []).length;
if (stageCount !== 9) throw new Error(`营销作战必须正好包含 9 个客户执行阶段，当前为 ${stageCount}。`);

for (const market of ["dual", "china", "overseas"]) assertIncludes(playbook, `${market}: {`, `${market} 市场线路`);
for (const boundary of ["不覆盖下游账号", "不保存密码、Cookie 或明文令牌", "默认人工审核，未批准不派发"]) assertIncludes(`${standard}\n${playbook}`, boundary, boundary);

console.log("社交媒体营销作战契约通过：统一规范模板、双市场、九阶段、真实操作入口、自检和多端发布均已登记。");
