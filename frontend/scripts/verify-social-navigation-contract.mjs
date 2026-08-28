import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const repoRoot = resolve(root, "..");
const read = (file) => readFile(resolve(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(`社媒共享导航契约失败：${message}`);
};

const expected = [
  ["marketing-playbook", "营销作战", "/social?tab=marketing-playbook", "deepen.social-matrix", "client-social-marketing-playbook", "dashboard"],
  ["dashboard", "运营总览", "/social?tab=dashboard", "deepen.social-matrix", "client-social-dashboard", "dashboard"],
  ["accounts", "账号连接", "/social?tab=accounts", "deepen.social-matrix", "client-social-accounts", "dashboard"],
  ["create", "内容创作", "/social?tab=create", "deepen.localized-distribution", "client-social-create", "form"],
  ["digital-human", "视频创作", "/social?tab=digital-human", "deepen.influence", "client-social-digital-human", "editor"],
  ["schedule", "发布中心", "/social?tab=schedule", "deepen.content-calendar", "client-social-schedule", "workflow"],
  ["automation", "互动转化", "/social?tab=automation", "deepen.community", "client-social-automation", "dashboard"],
  ["analytics", "数据归因", "/social?tab=analytics", "deepen.listening", "client-social-analytics", "dashboard"],
  ["settings", "平台设置", "/social?tab=settings", "deepen.social-matrix", "client-social-settings", "form"],
];

const socialBusinessTabFiles = new Map([
  ["marketing-playbook", "src/components/social/SocialMarketingPlaybook.tsx"],
  ["dashboard", "src/components/social/tabs/SocialDashboardTab.tsx"],
  ["accounts", "src/components/social/tabs/SocialAccountsTab.tsx"],
  ["create", "src/components/social/tabs/SocialCreateTab.tsx"],
  ["digital-human", "src/components/social/tabs/SocialDigitalHumanTab.tsx"],
  ["schedule", "src/components/social/tabs/SocialScheduleTab.tsx"],
  ["automation", "src/components/social/tabs/SocialAutomationTab.tsx"],
  ["analytics", "src/components/social/tabs/SocialAnalyticsTab.tsx"],
  ["settings", "src/components/social/tabs/SocialSettingsTab.tsx"],
]);

const [blueprint, blueprintView, productMarket, appRoutes, deepResponsiveE2e, page, customerRoadmapPage, productStore, sidebar, hqSidebar, agencySourceSidebar, platformModules, routeLabels, lockSource, lockConsole, clientLayout, hqLayout, agencySourceLayout, channelContract, sourcePackage, roadmap, publishDeliveryApi, hqPublishDelivery, registrySource, pageLayoutOverrides, responsiveContract, responsiveHost, globalCss, socialMediaCss] = await Promise.all([
  read("src/lib/factory-platform-blueprint.ts"),
  read("src/components/product-market/FactoryPlatformBlueprint.tsx"),
  read("src/pages/ProductMarket.tsx"),
  read("src/App.tsx"),
  read("e2e/global-responsive-deep.spec.ts"),
  read("src/pages/SocialMedia.tsx"),
  read("src/components/social/SocialCustomerRoadmapTab.tsx"),
  read("src/lib/product-market-store.ts"),
  read("src/components/Sidebar.tsx"),
  read("src/components/HQSidebar.tsx"),
  read("src/components/AgencySourceSidebar.tsx"),
  read("src/lib/platform-modules.ts"),
  read("src/lib/page-route-label.ts"),
  read("src/lib/page-layout-lock.ts"),
  read("src/components/product-market/DevelopmentStandardApplyConsole.tsx"),
  read("src/components/ClientSourceLayout.tsx"),
  read("src/components/HQLayout.tsx"),
  read("src/components/AgencySourceLayout.tsx"),
  read("src/lib/social-channel-contract.ts"),
  read("src/lib/social-source-package.ts"),
  read("src/lib/social-development-roadmap.ts"),
  read("src/lib/social-publish-delivery-api.ts"),
  read("src/pages/hq/HQSocialPublishDelivery.tsx"),
  read("src/page-factory/page-registry.json"),
  read("src/lib/page-layout-overrides.ts"),
  read("src/lib/global-responsive-page-contract.ts"),
  read("src/components/ResponsivePageHost.tsx"),
  read("src/index.css"),
  read("src/pages/SocialMedia.css"),
]);
const socialTabSources = Object.fromEntries(await Promise.all(
  [...socialBusinessTabFiles].map(async ([tab, file]) => [tab, await read(file)]),
));
const socialTabShared = await read("src/components/social/tabs/social-tab-shared.ts");
const socialRuntimeSource = [page, socialTabShared, ...Object.values(socialTabSources)].join("\n");
const backendLock = await readFile(resolve(repoRoot, "backend/routers/local_dev.py"), "utf8");
const backendPublishDelivery = await readFile(resolve(repoRoot, "backend/routers/social_publish_delivery.py"), "utf8");
const registry = JSON.parse(registrySource);
assert(customerRoadmapPage.includes("function SocialCustomerRoadmapTab"), "客户痛点路线真值分包无法定位");
const socialTabLoaderStart = page.indexOf("const SOCIAL_TAB_LOADERS = {");
const socialTabLoaderEnd = page.indexOf("} as const;", socialTabLoaderStart);
assert(socialTabLoaderStart >= 0 && socialTabLoaderEnd > socialTabLoaderStart, "社媒 shell 缺少集中式栏目加载器");
const socialTabLoaderBlock = page.slice(socialTabLoaderStart, socialTabLoaderEnd);
const socialTabLoaderEntries = [...socialTabLoaderBlock.matchAll(/^\s+["']?([a-z-]+)["']?: \(\) => import\("([^"]+)"\),$/gmu)]
  .map((match) => ({ tab: match[1], source: match[2] }));
const expectedLoaderSources = new Map([
  ["customer-roadmap", "@/components/social/SocialCustomerRoadmapTab"],
  ...[...socialBusinessTabFiles].map(([tab, file]) => [tab, `@/${file.replace(/^src\//u, "").replace(/\.tsx$/u, "")}`]),
]);
assert(socialTabLoaderEntries.length === 10, `社媒 shell 必须正好声明 9 个业务栏目与 1 个开发路线懒加载入口，当前 ${socialTabLoaderEntries.length}`);
assert(new Set(socialTabLoaderEntries.map((item) => item.source)).size === 10, "社媒栏目必须各自拥有独立动态入口，不能复用同一个聚合模块");
for (const [tab, source] of expectedLoaderSources) {
  assert(socialTabLoaderEntries.some((item) => item.tab === tab && item.source === source), `${tab} 未登记到独立动态入口 ${source}`);
}
for (const eventName of ["onPointerEnter", "onPointerDown", "onFocus"]) {
  assert(page.includes(`${eventName}={() => preloadSocialTab(t.key)}`), `社媒横栏缺少 ${eventName} 意图预取`);
}
assert(page.includes('data-social-tab-module={tab}') && page.includes('<Suspense fallback={<SocialTabFallback tab={tab} />}>'), "当前栏目未置于带稳定占位的统一 Suspense 边界");
assert(!/^import .*Social(?:CustomerRoadmapTab|MarketingPlaybook|DashboardTab|AccountsTab|CreateTab|ScheduleTab|AutomationTab|DigitalHumanTab|AnalyticsTab|SettingsTab)/gmu.test(page), "社媒 shell 重新静态导入了栏目实现");
for (const [tab, file] of socialBusinessTabFiles) {
  const source = socialTabSources[tab];
  assert(typeof source === "string" && source.length > 0, `${tab} 栏目源码不可读取：${file}`);
  if (tab === "marketing-playbook") {
    assert(source.includes("export function SocialMarketingPlaybook"), "营销作战独立入口缺少命名组件导出");
  } else {
    assert(source.includes("export default function Social"), `${tab} 独立入口缺少默认组件导出`);
    assert(source.includes('from "./social-tab-shared"'), `${tab} 未复用社媒共享状态与存储契约`);
  }
  assert(page.includes(`tab === "${tab}"`), `${tab} 未按当前 tab 条件挂载`);
}
const socialLockBlock = backendLock.slice(
  backendLock.indexOf("SOURCE_PAGE_LOCK_SOCIAL_PATHS = _unique_source_page_lock_paths(["),
  backendLock.indexOf("SOURCE_PAGE_LOCK_PATHS = {"),
);
const socialLockPaths = [...socialLockBlock.matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
assert(new Set(socialLockPaths).size === socialLockPaths.length, "社媒源码锁白名单存在重复路径");
await Promise.all(socialLockPaths.map(async (relativePath) => {
  try {
    await readFile(resolve(repoRoot, relativePath));
  } catch {
    throw new Error(`社媒共享导航契约失败：源码锁目标不存在 ${relativePath}`);
  }
}));

const contractStart = blueprint.indexOf("export const FACTORY_PLATFORM_SOCIAL_WORKSPACES = [");
const contractEnd = blueprint.indexOf("] as const satisfies readonly FactoryPlatformSocialWorkspace[];", contractStart);
assert(contractStart >= 0 && contractEnd > contractStart, "蓝图缺少 factory-platform-social-workspace-v2 唯一数组");
const contract = blueprint.slice(contractStart, contractEnd);

const readFields = (pattern) => [...contract.matchAll(pattern)].map((match) => match[1]);
const tabs = readFields(/\n\s+tab: "([^"]+)"/gu);
const labels = readFields(/\n\s+label: "([^"]+)"/gu);
const routes = readFields(/\n\s+route: "([^"]+)"/gu);
const owners = readFields(/\n\s+applicationId: "([^"]+)"/gu);
const pageIds = readFields(/\n\s+pageFactoryId: "([^"]+)"/gu);
const runtimeSourceScopes = readFields(/\n\s+runtimeSourceScope: "([^"]+)"/gu);
const templates = readFields(/\n\s+template: "([^"]+)"/gu);

assert(tabs.length === 9, `业务二级工作区必须正好 9 项，当前 ${tabs.length}`);
assert(new Set(tabs).size === 9 && new Set(routes).size === 9 && new Set(pageIds).size === 9, "tab、route、pageFactoryId 必须分别唯一");
assert(runtimeSourceScopes.length === 9 && runtimeSourceScopes.every((scope) => scope === "client_source"), "九项社媒运行页必须显式归属 client_source，HQ／代理源只消费治理投影");
expected.forEach(([tab, label, route, owner, pageId, template], index) => {
  assert(tabs[index] === tab, `${index + 1} 顺序应为 ${tab}，当前 ${tabs[index]}`);
  assert(labels[index] === label && routes[index] === route && owners[index] === owner && pageIds[index] === pageId && templates[index] === template, `${tab} 的名称、路由、一级归属、页面身份或模板漂移`);
  const registered = registry.pages.find((item) => item.id === pageId);
  assert(registered?.route === route && registered?.template === template && registered?.sourceScope === runtimeSourceScopes[index] && registered?.status === "complete", `${tab} 未按共享运行作用域登记到客户源页面工厂`);
});
assert(!contract.includes("customer-roadmap") && !contract.includes("capability="), "开发痛点路线或旧 capability 伪路由进入了九项业务契约");
assert(blueprint.includes('FACTORY_PLATFORM_SOCIAL_WORKSPACE_CONTRACT_ID = "factory-platform-social-workspace-v2"'), "社媒共享契约版本未升级到带运行作用域的 v2");
assert(blueprint.includes("getFactoryPlatformSocialWorkspaceRuntimeSourceScope"), "共享契约缺少按真实路由解析运行作用域的唯一入口");

for (const token of [
  "sourceScope: PageFactoryScope",
  "getFactoryPlatformSocialWorkspaceRuntimeSourceScope(application.route)",
  "runtimeAvailableHere",
  'data-factory-platform-runtime-boundary="governance-projection"',
  "治理投影 · 客户源运行",
  "application.deliveryStatus === \"planned\" || !runtimeAvailableHere",
  'const siteId = new URLSearchParams(location.search).get("siteId")',
  'runtimeUrl.searchParams.set("siteId", siteId)',
]) assert(blueprintView.includes(token), `平台蓝图未阻断非运行源死链：${token}`);
assert(productMarket.includes("sourceScope={pageFactoryContract.sourceScope}"), "产品市场未把页面工厂 sourceScope 传入共享蓝图");

const clientRouteBlock = appRoutes.slice(appRoutes.indexOf("function clientRoutes"), appRoutes.indexOf("function agencyRoutes"));
const agencyRouteBlock = appRoutes.slice(appRoutes.indexOf("function agencyRoutes"), appRoutes.indexOf("export default function App"));
assert(clientRouteBlock.includes('routePath("/social")'), "客户源缺少真实 /social 运行路由");
assert(!agencyRouteBlock.includes('routePath("/social")'), "代理源错误登记了未经页面工厂身份治理的 /social 运行路由");
assert(!appRoutes.includes('<Route path="/zb/social"'), "总部端错误登记了未经页面工厂身份治理的 /zb/social 运行路由");
assert(deepResponsiveE2e.includes("05 social workspaces keep governance projections outside client source"), "三端社媒运行作用域缺少浏览器回归验证");
assert(deepResponsiveE2e.includes("05 source package channel scope reaches runtime actions") && deepResponsiveE2e.includes("snapshot_config_json"), "来源运营包渠道范围缺少服务端蛇形快照与运行动作浏览器回归");
assert(pageLayoutOverrides.includes('pathname.endsWith("/social")') && pageLayoutOverrides.includes("社交媒体九个业务工作区默认接入同步全局共用框架"), "社媒运行页没有接入工厂默认共享布局，标注与内容滚动会失去全局开关");
assert(responsiveContract.includes("FACTORY_PLATFORM_SOCIAL_WORKSPACES.find") && responsiveContract.includes('segment === "social"') && responsiveContract.includes('search = ""'), "响应式宿主未按九工作区唯一契约解析社媒 tab 模板");
assert(responsiveHost.includes("resolveGlobalResponsivePageTemplate(location.pathname, location.search)"), "响应式宿主没有把社媒 tab 传入模板解析器");
assert(`${globalCss}\n${socialMediaCss}`.includes('.app-main:has([data-social-media-workspace]) > [data-responsive-page-host]') && globalCss.includes('[data-responsive-page-host] > [data-page-factory-page-id^="client-social"]'), "响应式宿主没有贯通社媒 FactoryPage 的固定高度与内容滚动链");
assert(deepResponsiveE2e.includes("05 social workspaces inherit markers, scrolling and their declared responsive templates"), "社媒共享布局缺少九工作区标注、滚动与模板浏览器回归");

const agencyCatalogBlock = productStore.slice(
  productStore.indexOf("export const AGENCY_SOURCE_PRODUCTS"),
  productStore.indexOf("export const HQ_PRODUCTS"),
);
const hqCatalogBlock = productStore.slice(
  productStore.indexOf("export const HQ_PRODUCTS"),
  productStore.indexOf("function cloneProductChildren"),
);
const hqGovernanceChildrenBlock = productStore.slice(
  productStore.indexOf("const HQ_SOCIAL_GOVERNANCE_CHILDREN"),
  productStore.indexOf("export const AGENCY_SOURCE_PRODUCTS"),
);
assert(!agencyCatalogBlock.includes('path: "/social"') && !agencyCatalogBlock.includes('path: "/social?'), "代理源目录不得保存客户源社媒运行路径");
assert(!hqCatalogBlock.includes('path: "/social"') && !hqCatalogBlock.includes('path: "/social?'), "总部目录不得保存客户源社媒运行路径");
assert(agencyCatalogBlock.includes('path: "/social-content-reviews"'), "代理源社媒目录必须投影到已登记的内容审核治理页");
for (const governanceRoute of ["/social-authorization", "/social-content-reviews", "/social-publish-delivery"]) {
  assert(hqGovernanceChildrenBlock.includes(`path: "${governanceRoute}"`), `总部社媒目录缺少治理页 ${governanceRoute}`);
}
assert(hqCatalogBlock.includes("children: HQ_SOCIAL_GOVERNANCE_CHILDREN"), "总部社媒目录未消费治理页投影");
assert(productStore.includes("createClientSocialMediaWorkflowChildren"), "客户源社媒目录缺少共享九工作区投影");
assert(!agencyCatalogBlock.includes("createClientSocialMediaWorkflowChildren") && !hqCatalogBlock.includes("createClientSocialMediaWorkflowChildren"), "非客户源目录不得重新生成九项客户源运行工作区");
const hqPlatformGroup = productStore.match(/\{ key: "hq-platform", label: "平台设置", paths: \[([^\]]+)\]/u)?.[1] || "";
const agencyOperationGroup = productStore.match(/\{ key: "agency-operation", label: "管理", paths: \[([^\]]+)\]/u)?.[1] || "";
for (const route of ["/social-authorization", "/social-content-reviews", "/social-publish-delivery"]) {
  assert(hqPlatformGroup.includes(`"${route}"`), `总部运营市场平台设置分类缺少社媒治理路径：${route}`);
}
assert(agencyOperationGroup.includes('"/social-content-reviews"'), "代理源运营市场管理分类缺少社交内容初审路径");
assert(agencySourceSidebar.includes('to: "/zb/agency-source/social-content-reviews"'), "代理源左侧栏缺少社交内容初审治理入口");
for (const route of ["/zb/social-authorization", "/zb/social-content-reviews", "/zb/social-publish-delivery"]) {
  assert(hqSidebar.includes(`to: "${route}"`), `总部左侧栏缺少社媒治理入口：${route}`);
}

for (const [owner, count] of [["deepen.social-matrix", 4], ["deepen.content-calendar", 1], ["deepen.localized-distribution", 1], ["deepen.listening", 1], ["deepen.community", 1], ["deepen.influence", 1]]) {
  assert(owners.filter((item) => item === owner).length === count, `${owner} 的二级工作区数量不正确`);
  assert(blueprint.includes(`navigationChildren: getFactoryPlatformSocialWorkspaceNavigationChildren("${owner}")`), `${owner} 未消费显式二级投影`);
}

for (const [source, token, label] of [
  [page, "FACTORY_PLATFORM_SOCIAL_WORKSPACES.map", "社媒横栏"],
  [productStore, "FACTORY_PLATFORM_SOCIAL_WORKSPACES.map", "栏目配置／运营市场目录"],
  [sidebar, "FACTORY_PLATFORM_SOCIAL_WORKSPACES.map", "左侧栏"],
  [platformModules, "FACTORY_PLATFORM_SOCIAL_WORKSPACES.map", "兼容平台目录"],
  [routeLabels, "FACTORY_PLATFORM_SOCIAL_WORKSPACES.find", "开发器页名"],
  [lockConsole, "normalizeProductModuleCategoryOrder(configuredCategoryOrder).map", "08 页面锁定器分类树"],
  [lockConsole, "buildFactoryApplicationLockTree(categoryKey, applications, configuredColumns)", "08 页面锁定器无级别分类分组与一级／二级全局编号"],
  [lockConsole, "getFactoryPlatformApplicationLayoutLockId(application.id)", "08 页面锁定器应用语义锁"],
  [lockConsole, "buildSharedSocialGovernanceLockTree", "HQ／代理源共享 05 治理投影"],
  [lockConsole, 'projection: "client-source-governance"', "非客户源锁树运行作用域边界"],
  [lockConsole, "id === parentLockId", "通用治理目录父子重复锁 ID 过滤"],
  [lockSource, "buildSharedPlatformLayoutLockParents", "产品市场／分类／应用／页面共享父链"],
  [clientLayout, "buildSharedPlatformLayoutLockParents()", "客户源锁继承"],
  [hqLayout, "buildSharedPlatformLayoutLockParents()", "总部端锁继承"],
  [agencySourceLayout, "buildSharedPlatformLayoutLockParents()", "代理源锁继承"],
  [sourcePackage, "SOCIAL_CHANNEL_NAMES", "来源运营包渠道"],
  [roadmap, "getSocialChannelNames", "国内外路线渠道"],
  [backendLock, "SOURCE_PAGE_LOCK_SOCIAL_PATHS", "社媒真实源码白名单"],
  [backendLock, 'lock_id.startswith("page:/social")', "社媒页面源码锁解析"],
]) assert(source.includes(token), `${label} 未消费共享契约：${token}`);
assert(deepResponsiveE2e.includes("05 governance catalogs, sidebars and page locker stay aligned across three sources"), "三端运营市场、左栏与 08 页面锁定器缺少浏览器回归");
for (const protectedPath of [
  "frontend/src/pages/ProductMarket.tsx",
  "frontend/src/index.css",
  "frontend/src/components/product-market/FactoryPlatformBlueprint.tsx",
]) assert(socialLockPaths.includes(protectedPath), `05 治理投影源码锁未保护 ${protectedPath}`);

for (const volatile of ["siteId", "projectPageName", "developmentApply", "developmentDraft", "visualCardLayout", "createTask"]) {
  assert(lockSource.includes(`"${volatile}"`), `页面锁未清理运行参数 ${volatile}`);
}
assert(lockSource.includes("params.sort();"), "页面锁未稳定 query 顺序");
assert(lockSource.includes("(?:client-source|agency-source)|kh"), "客户运行端 /kh 未与客户源共享 canonical 页面锁");
assert(productStore.includes("PRODUCT_MODULE_BASELINE_VERSION = 52") && productStore.includes("isRetiredSocialCapabilityPath"), "旧 capability 子路由迁移没有版本化清理");

const chinaChannels = (channelContract.match(/market: "china"/gu) || []).length;
const overseasChannels = (channelContract.match(/market: "overseas"/gu) || []).length;
const readinessChannels = (channelContract.match(/connectorStatus: "readiness"/gu) || []).length;
assert(chinaChannels === 8 && overseasChannels === 8, `渠道契约必须为国内 8 / 海外 8，当前 ${chinaChannels} / ${overseasChannels}`);
assert(readinessChannels === 2, `只有 Facebook/Instagram 可标记准备检查，当前 ${readinessChannels} 项`);
assert(channelContract.includes("export type SocialChannelName") && channelContract.includes("normalizeSocialChannelNames"), "渠道名称与旧别名没有唯一类型安全规范化入口");
assert(sourcePackage.includes("schemaVersion: 2") && sourcePackage.includes("channelContractId: SOCIAL_CHANNEL_CONTRACT_ID") && sourcePackage.includes("decodeSocialSourcePackage(value, candidate.scope)"), "来源运营包 v2 或旧快照安全解码未登记");
assert(socialRuntimeSource.includes("allowedPlatforms: SocialChannelName[]") && socialRuntimeSource.includes("getAvailableSocialPlatforms(planSettings)"), "计划渠道范围未进入账号／内容／排期／互动执行筛选");
assert(socialRuntimeSource.includes("allowedPlatforms: [...inheritedSourcePackage.allowedPlatforms]") && socialRuntimeSource.includes("permittedSelected"), "来源渠道范围未应用到客户计划或提交前二次校验");
assert(socialRuntimeSource.includes("record?.snapshot_config_json ?? record?.snapshotConfigJson ?? record?.config_json"), "客户计划未优先读取服务端实例的 snapshot_config_json，来源运营包继承链会失效");
const accountsBlock = socialTabSources.accounts;
assert(accountsBlock.includes("allowedConnections = connections.filter") && accountsBlock.includes("!isPlatformAvailable(connection.platform)"), "主页资产绑定未按允许渠道筛选并在提交前复核");
assert(accountsBlock.includes("!isPlatformAvailable(binding.platform)") && accountsBlock.includes("disabled={!platformAllowed}"), "官方主页同步未在动作层和界面层阻断范围外渠道");
const scheduleBlock = socialTabSources.schedule;
assert(scheduleBlock.includes("canResubmitReturnedReview") && scheduleBlock.includes("normalizeSocialChannelName(channel)"), "退回审核重提未按统一渠道契约规范化并校验全部渠道");
assert(scheduleBlock.includes("if (!canResubmitReturnedReview(review))") && scheduleBlock.includes("disabled={!canResubmit}"), "退回审核重提缺少动作层与界面层双重渠道范围阻断");
assert(scheduleBlock.includes("范围外不可重提") && deepResponsiveE2e.includes("reviewActionCount"), "退回审核范围阻断缺少明确界面状态或浏览器零请求回归");
assert(!socialRuntimeSource.includes('<Button variant="outline">保存草稿</Button>') && !socialRuntimeSource.includes('>立即发布</Button>'), "内容创作仍保留无处理逻辑的伪发布按钮");
assert(!roadmap.includes("CRM 自动交接插件均已接入"), "路线说明仍把外部 CRM 派发误报为已接入");
assert(page.includes("客户痛点：${activeWorkspace.customerPain} 客户价值：${activeWorkspace.customerValue}"), "九项页面标题未读取痛点／价值包装");
assert(
  page.includes('data-social-workspace-contract={FACTORY_PLATFORM_SOCIAL_WORKSPACE_CONTRACT_ID}')
    || page.includes('"data-social-workspace-contract": FACTORY_PLATFORM_SOCIAL_WORKSPACE_CONTRACT_ID'),
  "页面工厂根未标记社媒共享契约",
);
assert(backendPublishDelivery.includes("EXTERNAL_PUBLISH_CONNECTOR_IMPLEMENTED = False") && backendPublishDelivery.includes("infrastructure_ready and connector_implemented"), "外部发布 readiness 缺少代码拥有的连接器硬阻断");
assert(backendPublishDelivery.includes('"connector_implemented": connector_implemented') && backendPublishDelivery.includes('"message": message'), "外部发布 readiness 未返回连接器证据与同源说明");
assert(publishDeliveryApi.includes("connector_implemented: boolean") && publishDeliveryApi.includes("message: string"), "前端发布 readiness 类型未消费连接器证据与同源说明");
assert(hqPublishDelivery.includes("setNotice(nextReadiness.message)") && hqPublishDelivery.includes('readiness.connector_implemented'), "总部发布部署中心未消费后端真值说明或连接器硬门禁");
assert(customerRoadmapPage.includes("外部上线人工准备清单") && customerRoadmapPage.includes("百分比只表示人工确认，不代表外部系统就绪或已经上线"), "客户页未把本地勾选进度明确标记为人工准备");
assert(!customerRoadmapPage.includes("真实对外运营完成卡") && !customerRoadmapPage.includes(">真实运营 {externalOperationCompleted}"), "客户页仍把 localStorage 人工进度命名为真实外部运营");
assert(customerRoadmapPage.includes('data-social-roadmap-truth-scope="local-development-and-manual-review"'), "客户痛点路线未声明本地开发／人工核对真值边界");
assert(customerRoadmapPage.includes("本路线只展示代码内开发验证和浏览器本地人工核对，不读取外部连接器或平台回执；所有百分比均不代表外部发布闭环。"), "客户痛点路线未说明百分比不代表外部发布闭环");
assert(customerRoadmapPage.includes('return "manual_checked" as const') && customerRoadmapPage.includes("confirmManualCheck"), "客户痛点路线未把浏览器勾选建模为人工核对");
assert(customerRoadmapPage.includes("本地覆盖 {roadmapProgressPercent}%") && customerRoadmapPage.includes('status === "manual_checked" ? "人工"'), "客户痛点路线仍显示无口径百分比节块");
for (const forbidden of ["operational_complete", "confirmOperationalComplete", "运营已确认", "确认运营完成", "全部步骤已完成", "路线已完成", ">{roadmapProgressPercent}%</span>", ">{progressPercent}%</span>"]) {
  assert(!customerRoadmapPage.includes(forbidden), `客户痛点路线仍含外部运营完成误导：${forbidden}`);
}

console.log("社媒共享导航契约通过：05 六个一级应用、9 个 client_source 真实工作区、HQ／代理源治理投影、页面工厂身份、栏目投影、左栏、08 页面锁定器、源码锁及国内/海外 16 渠道完全对齐。");
