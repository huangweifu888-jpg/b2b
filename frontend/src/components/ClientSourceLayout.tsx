import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";

import { Bell, ChevronDown, CreditCard, HelpCircle, LayoutPanelTop, Lock, LogOut, Menu, Package, Save, Search, Share2, Unlock, User } from "lucide-react";

import Sidebar from "./Sidebar";

import LazyAIServiceWidget from "./LazyAIServiceWidget";

import DeferredShellRuntimeHosts from "./DeferredShellRuntimeHosts";
import ResponsivePageHost from "./ResponsivePageHost";
import {
  DeferredExternalDevtoolsMenu,
  DeferredGlobalLocalEnvAlert,
  DeferredSiteSwitchLoadingOverlay,
  DeferredUnifiedActionDialog,
} from "./DeferredShellUtilities";

import { Input } from "@/components/ui/input";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { ALL_PRODUCTS, useProductMarketStore } from "@/lib/product-market-store";

import { PRODUCT_MARKET_SHARED_STYLE_EVENT } from "@/lib/product-market-shared-style";

import { currentProductMarketConfigKey, normalizeClientSourceContentContract, PRODUCT_MARKET_CONFIG_EVENT, readClientTemplateProductMarketConfig, relevantProductMarketStorageKeys, writeStoredProductMarketConfig } from "@/lib/product-market-config";

import { buildTopbarSurfaceStyle, withAlpha } from "@/lib/topbar-surface";

import { PageFooterLockControls } from "@/components/PageFooterLockControls";
import { ContentPluginToggle } from "@/components/content-plugins/ContentPluginControls";

import { buildSharedPlatformLayoutLockParents, clearRemovedLayoutLocks, isCompletedSourceLocked, isRouteCompletedLayoutLocked, isRouteCompletedPageHardLocked, PAGE_LAYOUT_LOCK_EVENT, registerCompletedLayoutLockParents, resolveCompletedLayoutLock, setCompletedLayoutLocked, setCompletedPageHardLocked, setCompletedSourceLocked } from "@/lib/page-layout-lock";
import { syncSourcePageLock } from "@/lib/source-page-lock";

import { resolveConfiguredProductRoute } from "@/lib/product-navigation";
import { CLIENT_PROJECT_KEEP_SETTINGS_EVENT } from "@/lib/client-project-keep-settings";
import { dispatchSharedProjectSyncRequest } from "@/lib/shared-project-sync-contract";
import { RESPONSIVE_SHELL_TOOL_LABELS } from "@/lib/responsive-shell-contract";
import { useResponsiveNavigationLabel } from "@/hooks/use-responsive-navigation-label";

const VisualProjectContractHost = lazy(async () => ({
  default: (await import("@/components/product-market/VisualProjectContractHost")).VisualProjectContractHost,
}));

const t = {
  mobileNavTitle: "客户源导航",
  openNav: "打开导航",
  searchPlaceholder: "搜索客户源页面、产品、配置...",
  templateCenter: "客户源模板中心",
  templateName: "客户源模板",
  templateDesc: "总部唯一源体",
  help: "帮助中心",
  notice: "通知",
  accountTitle: "客户源账户",
  accountName: "Client Source",
  accountDesc: "总部客户端模板源",
  credits: "积分消费",
  social: "社媒账号",
  plans: "模板计划",
  profile: "个人资料",
  logout: "退出登录",
};

function getClientSourceAccountPath(tab: string) {
  return `/zb/client-source/account?tab=${tab}`;
}

type ClientProjectContext = {
  breadcrumb: string;
  title: string;
  description: string;
};

const CLIENT_PROJECT_CONTEXTS: Record<string, ClientProjectContext> = {
  "/": { breadcrumb: "服务概览", title: "服务概览", description: "集中查看网站运营、服务状态与项目进度。" },
  "/product-market": { breadcrumb: "产品市场 → 模板配置", title: "模板配置", description: "统一管理页面模板、栏目与版面风格。" },
  "/projects": { breadcrumb: "已创计划", title: "已创计划", description: "管理已创建项目及其发布状态。" },
  "/ai-chat": { breadcrumb: "AI 智能 → AI 对话", title: "AI 对话", description: "使用智能助手处理网站内容与运营任务。" },
  "/ai-customer-service": { breadcrumb: "AI 智能 → 客服音效", title: "客服音效", description: "配置客服服务与音效体验。" },
  "/company-info": { breadcrumb: "企业资料", title: "企业资料", description: "维护企业基础资料、品牌内容与展示信息。" },
  "/templates": { breadcrumb: "网站风格", title: "网站风格", description: "管理网站模板与视觉展示方案。" },
  "/inquiries": { breadcrumb: "询盘管理", title: "询盘管理", description: "查看、处理并跟进客户询盘。" },
  "/customers": { breadcrumb: "CRM 管理", title: "CRM 管理", description: "维护客户信息、商机和沟通记录。" },
  "/cpq-quotes": { breadcrumb: "08.承转 → 报价合同", title: "报价合同", description: "管理配置报价、审批、买家接受与待确认订单意向。" },
  "/fulfillment-orders": { breadcrumb: "09.强链 → 全球交付", title: "全球交付", description: "校验并确认订单，追踪库存、生产、质量、发运与签收证据。" },
  "/customer-assets": { breadcrumb: "10.深养 → 客户资产", title: "客户资产", description: "关联已签收订单、序列号、保修、服务证据与续费行动。" },
  "/product-passports": { breadcrumb: "09.强链 → 产品护照", title: "产品护照", description: "关联工程版本、BOM、供应商、批次、证书、交付与客户资产追溯。" },
  "/quality-inspections": { breadcrumb: "09.强链 → 质量管理", title: "质量管理", description: "以订单、工单和批次为权威来源，闭环五项检验、NCR、CAPA与批准放行。" },
  "/procurement": { breadcrumb: "09.强链 → 供应采购", title: "供应采购", description: "从已发布工程BOM与确认订单计算需求，治理供应商准入、采购审批、承诺和独立收货。" },
  "/production-plans": { breadcrumb: "09.强链 → 产销计划", title: "产销计划", description: "把确认订单、工程BOM、真实采购收货和有限产能合并为可兑现的生产计划。" },
  "/manufacturing-execution": { breadcrumb: "09.强链 → 制造执行", title: "制造执行", description: "把已释放生产计划转为可追溯工单，控制物料批次、顺序报工、停机恢复和良品完工。" },
  "/field-service": { breadcrumb: "10.深养 → 服务工单", title: "服务工单", description: "把客户装机资产、技能派工、到场留证、诊断工时、备件凭证、客户签收和 SLA 贯通为服务履约闭环。" },
  "/warranty-rma": { breadcrumb: "10.深养 → 质保退货", title: "质保退货", description: "以已解决服务工单启动质保资格、退回运输、仓库收货、QMS 检验、责任处置、预计成本和客户确认闭环。" },
  "/renewal-growth": { breadcrumb: "10.深养 → 续约增长", title: "续约增长", description: "用装机资产、服务、RMA与客户确认形成增长建议，经过CPQ报价审批和OMS订单确认完成复购、续约与增购闭环。" },
  "/partner-voice": { breadcrumb: "10.深养 → 客户之声", title: "客户之声", description: "以伙伴准入证据、客户订单和装机资产为入口，贯通伙伴学院、VOC/NPS、客户确认及授权案例发布。" },
  "/health-cockpit": { breadcrumb: "11.驭数 → 健康驾舱", title: "经营健康驾舱", description: "只读汇总报价、订单、质量、资产、服务、客户之声、回款和伙伴权威事实，形成指标快照、异常下钻、责任任务与独立验证闭环。" },
  "/data-warehouse": { breadcrumb: "11.驭数 → 数据仓库", title: "经营数据仓库", description: "登记并审批受控权威来源，以不可变事实版本、质量门禁、逐批血缘和独立发布形成可信经营数据底座。" },
  "/metric-center": { breadcrumb: "11.驭数 → 指标语义", title: "指标语义中心", description: "以稳定指标身份、不可变口径版本、已发布仓库事实与独立审批复核，形成可追溯且不会静默改写历史的经营指标。" },
  "/revenue-profit": { breadcrumb: "11.驭数 → 利润分析", title: "归因与利润分析", description: "将有同意证据的营销触点与已发布回款、报价收入和成本事实独立验证绑定，形成可审计管理贡献结果，并与正式财务利润保持边界。" },
  "/forecast": { breadcrumb: "11.驭数 → 经营预测", title: "需求产能与现金预测", description: "固定六类已发布经营事实及其修订血缘，以独立审批策略形成滚动需求、产能与现金预测，不替代正式财务预测。" },
  "/ai-command": { breadcrumb: "11.驭数 → 智能战情", title: "AI问数与战情中心", description: "从已发布经营事实生成带修订引用的回答和零回写情景；建议经异人审批后交接目标系统，真正执行仍由目标系统负责。" },
  "/erp": { breadcrumb: "12.固本 → 经营总台", title: "ERP经营总台", description: "只引用OMS已确认订单，统一经营组织、成本中心、订单项目、不可变经营记账和独立月结；不复制订单确认，也不冒充正式财务总账。" },
  "/finance": { breadcrumb: "12.固本 → 财务资金", title: "财务资金中心", description: "以ERP经营组织为边界，引用OMS确认订单和SRM收货事实，形成应收、应付、收付款、预算、平衡复式分录及独立关账。" },
  "/people": { breadcrumb: "12.固本 → 人事中心", title: "HR人事中心", description: "以最小必要数据治理组织、岗位、员工、合同、工时、绩效与培训，严格隔离营销联系人、客户画像和原始敏感财税健康数据。" },
  "/recruiting": { breadcrumb: "12.固本 → 招聘面试", title: "招聘面试中心", description: "受岗位编制约束，治理候选人授权、结构化面试、AI辅助边界、人工录用决定、Offer审批与HR入职交接。" },
  "/approval-center": { breadcrumb: "12.固本 → 审批中心", title: "审批中心", description: "统一编排报价、采购、财务、人事、招聘与ERP审批，固定来源版本、强制顺序与职责分离，并通过显式交接保持业务系统权威。" },
  "/contract-legal": { breadcrumb: "12.固本 → 合同法务", title: "合同法务", description: "以法律合同为唯一权威记录，治理主体、不可变模板、独立法审、受控用印、第三方签署与履约义务，同时保持报价和采购来源不被改写。" },
  "/icp-profiles": { breadcrumb: "01.蓄势 → ICP客户定位", title: "ICP客户定位", description: "以不可变客群标准、权威业务证据、独立验证和可解释评分形成获客、内容与销售共用的客户定位契约。" },
  "/brand-studio": { breadcrumb: "01.蓄势 → 品牌定位与网站风格", title: "品牌定位与网站风格", description: "将经核验的价值主张、视觉系统与品牌语气沉淀为可追溯版本；不会自动发布站点或覆盖客户保护配置。" },
  "/digital-assets": { breadcrumb: "01.蓄势 → AI计划与数字资产", title: "AI计划与数字资产", description: "将AI建站建议、域名/商标/授权资产及人工审核沉淀为可追溯的受控交接；不保存注册商密钥，也不自动购买域名或发布站点。" },
  "/site-management": { breadcrumb: "02.布场 → 多站管理", title: "多站管理", description: "管理国内外官网、品牌站与活动站的受控内容版本；独立审核、批准与消费系统回执后交接，绝不直接覆盖客户站点。" },
  "/dam-localization": { breadcrumb: "02.布场 → 素材本地化", title: "素材本地化", description: "治理私有素材、版权范围、不可变术语、本地化质量、区域评估、国家内容包与下游确认。" },
  "/knowledge-graph": { breadcrumb: "04.占新 → 企业知识图谱", title: "企业知识图谱", description: "连接企业、产品、能力、证书、案例和市场，并以权威来源指纹、异人验证、不可变版本和下游确认保证事实可追溯。" },
  "/structured-data": { breadcrumb: "04.占新 → 结构化数据中心", title: "结构化数据中心", description: "从已发布企业知识图谱生成经异人验证、规则校验、不可变哈希发布和渠道确认的 Organization、Product、FAQ、Review 与 Article JSON-LD。" },
  "/channel-feed": { breadcrumb: "04.占新 → 商品Feed与平台刊登", title: "商品Feed与平台刊登", description: "以不可变结构化商品事实、渠道凭证引用、权威价格库存边界、异人验证和渠道回执同步搜索、商城与行业平台。" },
  "/identity-resolution": { breadcrumb: "05.锁客 → 身份合并", title: "身份合并与黄金档案", description: "在同意和用途边界内，以不可逆哈希、来源指纹、异人核验与人工裁决形成可审计黄金客户档案。" },
  "/account-graph": { breadcrumb: "05.锁客 → 企业关系", title: "B2B企业关系图谱", description: "以权威法务、身份、商机和履约记录连接企业层级、联系人、渠道与交易关系。" },
  "/buying-committee": { breadcrumb: "05.锁客 → 采购画像", title: "采购画像与决策委员会", description: "固定真实商机、ICP角色和已授权联系人，通过异人核验形成可发布、可回执的多线程决策网络。" },
  "/customer-timeline": { breadcrumb: "05.锁客 → 行为轨迹", title: "客户行为时间线", description: "按真实发生时间串联内容触点、询盘、报价、订单与服务，以权威来源指纹形成可追溯客户旅程。" },
  "/segments-consent": { breadcrumb: "05.锁客 → 标签同意", title: "标签分群与同意中心", description: "以有效同意、已核验身份和不可变行为时间线形成确定性动态分群，支持异人核验、版本发布、撤回排除与下游回执。" },
  "/abm": { breadcrumb: "07.精投 → 企业定向", title: "企业定向与ABM协同", description: "从有效同意分群与完整采购委员会固定目标企业，按采购角色协调营销、广告和销售并发布可回执的不可变计划。" },
  "/creative-center": { breadcrumb: "07.精投 → 创意中心", title: "AI创意中心", description: "以ABM采购角色与权利合规国家内容包生成可追溯创意，强制人工异人审核、不可变版本与渠道回执。" },
  "/ai-sdr": { breadcrumb: "08.承转 → AI售前", title: "AI售前SDR", description: "固定已独立验证的ICP适配证据，AI只生成可追溯建议，由人工完成资格审核并通过不可变载荷交接销售。" },
  "/rfq-samples": { breadcrumb: "08.承转 → 样品管理", title: "RFQ与样品管理", description: "固定权威询盘版本，以需求、范围和成本异人审核驱动样品发运、客户反馈与销售回执闭环。" },
  "/commerce": { breadcrumb: "08.承转 → 订货结账", title: "B2B订货与B2C结账", description: "统一固定权威报价或商品商业事实，通过条款、支付独立核验和OMS权威订单回执完成交易闭环。" },
  "/products": { breadcrumb: "产品管理", title: "产品管理", description: "维护产品目录、分类与展示内容。" },
  "/news": { breadcrumb: "新闻中心", title: "新闻中心", description: "编辑新闻、公告与内容发布计划。" },
  "/cases": { breadcrumb: "工程案例", title: "工程案例", description: "管理项目案例与成果展示。" },
  "/videos": { breadcrumb: "企业视频", title: "企业视频", description: "管理企业视频与媒体资源。" },
  "/blog": { breadcrumb: "博客优化", title: "博客优化", description: "编制博客内容并优化搜索表现。" },
  "/seo": { breadcrumb: "SEO 优化", title: "SEO 优化", description: "管理搜索优化策略与页面内容。" },
  "/geo-center": { breadcrumb: "GEO 中心", title: "GEO 中心", description: "维护地域投放与本地化运营配置。" },
  "/social": { breadcrumb: "社交媒体", title: "社交媒体", description: "管理社交渠道与内容分发。" },
  "/smart-ads": { breadcrumb: "智能推广", title: "智能推广", description: "配置推广计划并查看投放效果。" },
  "/product-analysis": { breadcrumb: "产品分析", title: "产品分析", description: "分析产品表现与运营数据。" },
  "/site-settings": { breadcrumb: "站点设置", title: "站点设置", description: "维护网站基础配置、安全与发布规则。" },
  "/reports": { breadcrumb: "数据报表", title: "数据报表", description: "查看网站流量、运营与转化数据。" },
  "/account": { breadcrumb: "账户设置", title: "账户设置", description: "管理账户资料、计划与服务信息。" },
};

const COMPANY_INFO_TAB_CONTEXTS: Record<string, ClientProjectContext> = {
  profile: { breadcrumb: "企业资料 → 基本资料", title: "基本资料", description: "维护企业基础资料、品牌内容与展示信息。" },
  banner: { breadcrumb: "首页设计 → 首页 Banner", title: "首页 Banner", description: "配置首页轮播、置顶内容与移动端展示。" },
  recommend: { breadcrumb: "首页设计 → 产品推荐", title: "产品推荐", description: "维护并同步网站的产品推荐模块。" },
  about: { breadcrumb: "关于我们 → 公司介绍", title: "公司介绍", description: "维护公司介绍与品牌展示内容。" },
  faq: { breadcrumb: "服务保障 → FAQ", title: "FAQ", description: "维护常见问题与服务说明。" },
  factory: { breadcrumb: "关于我们 → 工厂生产", title: "工厂生产", description: "维护工厂生产与制造能力内容。" },
  gallery: { breadcrumb: "关于我们 → 公司风采", title: "公司风采", description: "维护企业环境、团队与图片展示。" },
  exhibition: { breadcrumb: "服务保障 → 展会活动", title: "展会活动", description: "维护展会活动与企业动态。" },
  service: { breadcrumb: "服务保障", title: "服务保障", description: "维护服务能力与保障说明。" },
  logistics: { breadcrumb: "服务保障 → 物流货运", title: "物流货运", description: "维护物流货运与交付说明。" },
  im: { breadcrumb: "联系我们", title: "联系我们", description: "维护联系渠道、国际聊天工具与社交媒体链接。" },
  modules: { breadcrumb: "企业资料 → 自定义模块", title: "自定义模块", description: "维护企业自定义展示模块。" },
};

function getClientProjectContext(pathname: string, search: string): ClientProjectContext {
  if (pathname.endsWith("/product-market")) {
    const tab = new URLSearchParams(search).get("tab") || "operations";
    const contexts: Record<string, ClientProjectContext> = {
      operations: { breadcrumb: "产品市场 → 运营市场", title: "运营市场", description: "集中管理客户端功能模块、状态与运营使用情况。" },
      blueprint: { breadcrumb: "产品市场 → 平台蓝图", title: "平台蓝图", description: "统一查看十二大经营类别、开发顺序、业务边界、三端治理与客户价值。" },
      modules: { breadcrumb: "产品市场 → 栏目配置", title: "栏目配置", description: "统一编制一级与二级栏目，并同步到客户端导航与计划网站。" },
      layout: { breadcrumb: "产品市场 → 版面风格", title: "版面风格", description: "统一设置当前客户端页面的版面、色板和视觉样式。" },
      service: { breadcrumb: "产品市场 → 客服音效", title: "客服音效", description: "配置悬浮客服、提醒声音与语音服务。" },
      development: { breadcrumb: "产品市场 → 开发规范", title: "开发规范", description: "按全局、表头、内容与插件组合生成并验收项目页面。" },
    };
    return contexts[tab] || contexts.operations;
  }

  if (pathname.endsWith("/site-settings") && new URLSearchParams(search).get("tab") === "general") {
    return {
      breadcrumb: "",
      title: "站点设置 → 站点设置",
      description: "维护网站基础信息、语言、访问地址与功能开关。",
    };
  }

  if (pathname.endsWith("/company-info")) {
    const tab = new URLSearchParams(search).get("tab") || "navigation";
    const tabContext = COMPANY_INFO_TAB_CONTEXTS[tab];
    if (tabContext) return tabContext;
  }

  const suffix = pathname.replace(/^\/zb\/client-source/, "") || "/";
  const params = new URLSearchParams(search);
  params.delete("siteId");
  const currentProjectPath = `${suffix}${params.size ? `?${params.toString()}` : ""}`;
  const secondaryMatch = ALL_PRODUCTS
    .map((product) => ({ product, child: product.children?.find((item) => item.path === currentProjectPath) }))
    .find((entry) => entry.child);
  if (secondaryMatch?.child) {
    return {
      breadcrumb: `${secondaryMatch.product.label} → ${secondaryMatch.child.label}`,
      title: secondaryMatch.child.label,
      description: `${secondaryMatch.product.label}的${secondaryMatch.child.label}栏目，统一由左侧导航与产品市场栏目配置管理。`,
    };
  }

  const known = CLIENT_PROJECT_CONTEXTS[suffix];
  if (known) return known;

  const fallback = suffix
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment).replace(/[-_]/g, " "))
    .join(" → ");
  return {
    breadcrumb: fallback || "项目页面",
    title: fallback || "项目页面",
    description: "此页面已自动套用开发规范定义的共享框架与主题样式。",
  };
}

function usesDedicatedProjectFrame(pathname: string, search: string) {
  const tab = new URLSearchParams(search).get("tab");
  return (pathname.endsWith("/company-info") && tab === "navigation")
    || pathname.endsWith("/site-settings")
    || pathname.endsWith("/product-analysis")
    || pathname.endsWith("/social");
}

function needsShellProvidedProjectFrame(pathname: string, search: string) {
  return pathname.endsWith("/company-info") && new URLSearchParams(search).get("tab") === "navigation";
}

function shouldHideProjectSubnav(pathname: string) {
  return [
    "/product-analysis",
    "/products",
    "/news",
    "/cases",
    "/videos",
    "/blog",
    "/seo",
    "/geo-center",
    "/social",
    "/smart-ads",
    "/reports",
    "/inquiries",
    "/customers",
  ].some((route) => pathname.endsWith(route));
}

function buildSidebarLockParents(products: Array<{ path: string; children?: Array<{ path: string; children?: Array<unknown> }> }>) {
  const entries: Array<{ id: NonNullable<ReturnType<typeof resolveCompletedLayoutLock>>; parentId?: NonNullable<ReturnType<typeof resolveCompletedLayoutLock>> }> = [];

  const resolvePathLock = (path: string) => {
    const [pathname, search = ""] = path.split("?");
    return resolveCompletedLayoutLock(pathname, search ? `?${search}` : "");
  };
  const walk = (items: Array<{ path: string; children?: Array<unknown> }>, parentId?: NonNullable<ReturnType<typeof resolveCompletedLayoutLock>>) => {
    items.forEach((item) => {
      const id = resolvePathLock(item.path);
      if (!id) return;
      entries.push(parentId && id !== parentId ? { id, parentId } : { id });
      const children = Array.isArray(item.children) ? item.children as Array<{ path: string; children?: Array<unknown> }> : [];
      walk(children, id);
    });
  };

  walk(products);
  return entries;
}

export default function ClientSourceLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { layoutStyle, sidebarStyle, products, moduleIconVisibility, setModuleIconVisibility } = useProductMarketStore(useShallow((state) => ({
    layoutStyle: state.layoutStyle,
    sidebarStyle: state.sidebarStyle,
    products: state.products,
    moduleIconVisibility: state.moduleIconVisibility,
    setModuleIconVisibility: state.setModuleIconVisibility,
  })));
  const [ready, setReady] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileTopbarExpanded, setMobileTopbarExpanded] = useState(false);
  const clientTopbarRef = useRef<HTMLElement | null>(null);
  const clientTopbarToggleRef = useRef<HTMLButtonElement | null>(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [projectLayoutLocked, setProjectLayoutLocked] = useState(() => isRouteCompletedLayoutLocked(location.pathname, location.search));
  const [projectHardLocked, setProjectHardLocked] = useState(() => isRouteCompletedPageHardLocked(location.pathname, location.search));
  const [projectSourceLocked, setProjectSourceLocked] = useState(() => {
    const lock = resolveCompletedLayoutLock(location.pathname, location.search);
    return Boolean(lock && isCompletedSourceLocked(lock));
  });
  const appliedConfigSignatureRef = useRef("");
  const contractRefreshRouteKey = useMemo(() => {
    if (!location.pathname.endsWith("/product-market")) {
      return `${location.pathname}${location.search}`;
    }
    const params = new URLSearchParams(location.search);
    params.delete("tab");
    const search = params.toString();
    return `${location.pathname}${search ? `?${search}` : ""}`;
  }, [location.pathname, location.search]);

  useLayoutEffect(() => {
    try {
      const storedConfig = readClientTemplateProductMarketConfig();
      const config = storedConfig
        ? normalizeClientSourceContentContract(storedConfig)
        : null;
      const { resetToFactory, importConfig } = useProductMarketStore.getState();
      appliedConfigSignatureRef.current = JSON.stringify(config || null);
      if (config) importConfig(config);
      else resetToFactory();
    } catch (error) {
      console.warn("Client source layout config bootstrap failed, using defaults:", error);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    const refreshConfig = (event?: Event) => {
      if (event instanceof StorageEvent) {
        if (!event.key || !relevantProductMarketStorageKeys(null).includes(event.key)) return;
      }
      try {
        const storedConfig = readClientTemplateProductMarketConfig();
        const config = storedConfig
          ? normalizeClientSourceContentContract(storedConfig)
          : null;
        const nextSignature = JSON.stringify(config || null);
        if (config && nextSignature !== appliedConfigSignatureRef.current) {
          appliedConfigSignatureRef.current = nextSignature;
          useProductMarketStore.getState().importConfig(config);
        }
      } catch (error) {
        console.warn("Client source layout live config refresh failed:", error);
      }
    };

    window.addEventListener(PRODUCT_MARKET_SHARED_STYLE_EVENT, refreshConfig);
    window.addEventListener(PRODUCT_MARKET_CONFIG_EVENT, refreshConfig);
    window.addEventListener("storage", refreshConfig);
    return () => {
      window.removeEventListener(PRODUCT_MARKET_SHARED_STYLE_EVENT, refreshConfig);
      window.removeEventListener(PRODUCT_MARKET_CONFIG_EVENT, refreshConfig);
      window.removeEventListener("storage", refreshConfig);
    };
  }, []);

  // A content-contract migration can be performed while resolving a direct
  // project route. Re-read on route changes as well as storage events so the
  // corrected source contract reaches Sidebar and Page Lock immediately,
  // without requiring a browser refresh or a return to 栏目配置.
  useEffect(() => {
    const idleWindow = window as typeof window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const refreshRouteContract = () => {
      try {
        const storedConfig = readClientTemplateProductMarketConfig();
        const config = storedConfig
          ? normalizeClientSourceContentContract(storedConfig)
          : null;
        const nextSignature = JSON.stringify(config || null);
        if (config && nextSignature !== appliedConfigSignatureRef.current) {
          appliedConfigSignatureRef.current = nextSignature;
          useProductMarketStore.getState().importConfig(config);
        }
      } catch (error) {
        console.warn("Client source route contract refresh failed:", error);
      }
    };
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(refreshRouteContract, { timeout: 1500 });
      return () => idleWindow.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(refreshRouteContract, 700);
    return () => window.clearTimeout(timer);
  }, [contractRefreshRouteKey]);

  const projectContext = getClientProjectContext(location.pathname, location.search);
  const navigationLabel = useResponsiveNavigationLabel({
    routeKey: `${location.pathname}${location.search}`,
    preferredLabel: projectContext.title,
  });
  const isCompanyInfoPage = location.pathname.endsWith("/company-info");
  const hasDedicatedProjectFrame = usesDedicatedProjectFrame(location.pathname, location.search);
  const shellProvidesProjectFrame = needsShellProvidedProjectFrame(location.pathname, location.search);
  const keepDedicatedProjectFooter = location.pathname.endsWith("/social") || location.pathname.endsWith("/product-analysis");
  const hideProjectSubnav = shouldHideProjectSubnav(location.pathname);
  const syncStorageKey = `tradepro.client-project-sync.${location.pathname}${location.search}`;
  const configuredProjectRoute = useMemo(
    () => resolveConfiguredProductRoute(products, location.pathname, location.search),
    [location.pathname, location.search, products]
  );
  const projectNavItem = configuredProjectRoute.product;
  const isProductMarketPage = location.pathname.endsWith("/product-market");
  const isReleaseCenter = location.pathname.endsWith("/releases");
  const isProductMarketModulesPage = isProductMarketPage && new URLSearchParams(location.search).get("tab") === "modules";
  const persistModuleIconVisibility = (visibility: Partial<typeof moduleIconVisibility>) => {
    setModuleIconVisibility(visibility);
    // These footer toggles are shared-navigation plugins, not a local
    // visual-only preference. Persist the same export that Sidebar reads so
    // its icon projection updates immediately and survives page navigation.
    writeStoredProductMarketConfig(
      currentProductMarketConfigKey("client_source"),
      useProductMarketStore.getState().exportConfig(),
    );
  };
  const projectUnavailable = !isProductMarketPage && Boolean(projectNavItem) && configuredProjectRoute.status !== "active";
  const ProjectTitleIcon = projectNavItem?.icon || LayoutPanelTop;
  // The sidebar is the configured navigation source of truth.  Reflect its
  // current labels in the page title instead of keeping a second hard-coded
  // breadcrumb that drifts after an administrator renames a product or child.
  const configuredParentLabel = (projectNavItem?.customLabel || projectNavItem?.label || "").trim();
  const configuredChildLabel = (
    configuredProjectRoute.child?.customLabel
    || configuredProjectRoute.child?.label
    || ""
  ).trim();
  const projectTitlePath = configuredParentLabel && configuredChildLabel
    ? `${configuredParentLabel} → ${configuredChildLabel}`
    : projectContext.breadcrumb || projectContext.title;
  const currentLayoutLock = resolveCompletedLayoutLock(location.pathname, location.search);

  useEffect(() => {
    clearRemovedLayoutLocks();
  }, []);

  useEffect(() => {
    registerCompletedLayoutLockParents([
      ...buildSidebarLockParents(products),
      ...buildSharedPlatformLayoutLockParents(),
    ]);
  }, [products]);

  useEffect(() => {
    const refreshLayoutLock = () => {
      setProjectLayoutLocked(isRouteCompletedLayoutLocked(location.pathname, location.search));
      setProjectHardLocked(isRouteCompletedPageHardLocked(location.pathname, location.search));
      const lock = resolveCompletedLayoutLock(location.pathname, location.search);
      setProjectSourceLocked(Boolean(lock && isCompletedSourceLocked(lock)));
    };
    refreshLayoutLock();
    window.addEventListener(PAGE_LAYOUT_LOCK_EVENT, refreshLayoutLock);
    return () => window.removeEventListener(PAGE_LAYOUT_LOCK_EVENT, refreshLayoutLock);
  }, [location.pathname, location.search]);

  const syncCurrentProjectPage = async () => {
    if (projectHardLocked) {
      throw new Error("当前页面已启用防误改：保存与同步已阻止，请先在 08 页面锁定器取消该页面的防误改。");
    }
    const saved = await dispatchSharedProjectSyncRequest({
      pathname: location.pathname,
      search: location.search,
    });
    if (!saved) {
      throw new Error("保存未完成：页面配置尚未通过本地与服务端回读验证，请重试。");
    }
    const timestamp = new Date().toLocaleString("zh-CN");
    window.localStorage.setItem(syncStorageKey, timestamp);
  };

  const openProjectKeepSettings = () => {
    if (projectHardLocked) {
      toast.error("当前页面已启用防误改：保存与同步已阻止，请先在 08 页面锁定器取消该页面的防误改。");
      return;
    }
    setSyncDialogOpen(true);
  };

  useEffect(() => {
    window.addEventListener(CLIENT_PROJECT_KEEP_SETTINGS_EVENT, openProjectKeepSettings);
    return () => window.removeEventListener(CLIENT_PROJECT_KEEP_SETTINGS_EVENT, openProjectKeepSettings);
  }, []);

  useEffect(() => {
    setMobileTopbarExpanded(false);
  }, [contractRefreshRouteKey]);

  useEffect(() => {
    const closeForPeerTool = (event: Event) => {
      const source = (event as CustomEvent<{ source?: string }>).detail?.source;
      if (source !== "client-tools") setMobileTopbarExpanded(false);
    };
    window.addEventListener("tradepro:responsive-toolbar-open", closeForPeerTool);
    return () => window.removeEventListener("tradepro:responsive-toolbar-open", closeForPeerTool);
  }, []);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) setMobileTopbarExpanded(false);
    };
    closeOnDesktop(desktopQuery);
    desktopQuery.addEventListener("change", closeOnDesktop);
    return () => desktopQuery.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!mobileTopbarExpanded) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || clientTopbarRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-radix-popper-content-wrapper]")) return;
      setMobileTopbarExpanded(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMobileTopbarExpanded(false);
      window.requestAnimationFrame(() => clientTopbarToggleRef.current?.focus());
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileTopbarExpanded]);

  const toggleCurrentProjectLayoutLock = () => {
    const lock = resolveCompletedLayoutLock(location.pathname, location.search);
    if (!lock) return;
    setCompletedLayoutLocked(lock, !projectLayoutLocked, "footer");
  };

  const toggleCurrentProjectSourceLock = async () => {
    const lock = resolveCompletedLayoutLock(location.pathname, location.search);
    if (!lock) return;
    const nextLocked = !projectSourceLocked;
    try {
      await syncSourcePageLock(lock, nextLocked);
      setCompletedSourceLocked(lock, nextLocked, "footer");
    } catch (error) {
      const message = error instanceof Error ? error.message : "源码锁登记失败";
      toast.error(`未改变源码锁：${message}`);
    }
  };

  const toggleCurrentProjectPageLock = () => {
    const lock = resolveCompletedLayoutLock(location.pathname, location.search);
    if (!lock) return;
    setCompletedPageHardLocked(lock, !projectHardLocked, "footer");
  };

  if (!ready) {
    return <div className="app-shell bg-slate-50" />;
  }

  const headerBgColor = layoutStyle.clientTopbarOverrideBgColor || sidebarStyle.bgFrom || layoutStyle.clientTopbarBgColor || "#123524";
  const headerTextColor = layoutStyle.clientTopbarOverrideTextColor || sidebarStyle.textColor || layoutStyle.clientTopbarTextColor || "#ffffff";
  const topbarBorderColor = withAlpha(headerTextColor, 0.18);
  const topbarSurfaceBg = withAlpha(headerTextColor, 0.06);
  const topbarMutedTextColor = withAlpha(headerTextColor, 0.72);
  const topbarSubtleTextColor = withAlpha(headerTextColor, 0.5);
  const topbarSurfaceStyle = buildTopbarSurfaceStyle(headerTextColor);
  const sourceHighlight = sidebarStyle.activeHighlight || "#0ea5e9";
  const unavailablePanelStyle = {
    backgroundColor:
      layoutStyle.clientFeatureCardBgColor ||
      layoutStyle.clientCardBgColor ||
      layoutStyle.defaultDialogContentBgColor ||
      "#ffffff",
    borderColor: withAlpha(sidebarStyle.borderColor || sourceHighlight, 0.34),
    color:
      layoutStyle.clientFeatureCardTextColor ||
      layoutStyle.clientCardTextColor ||
      layoutStyle.contentTextColor ||
      "#0f172a",
  };
  const unavailableProjectCopy = configuredProjectRoute.status === "hidden"
    ? "该项目已隐藏，左侧导航和直接访问都会保持不可用。请在“产品市场 → 运营市场”重新开通后再访问。"
    : "该项目尚未开通。请在“产品市场 → 运营市场”开通后再访问；导航、直接链接与页面框架会读取同一状态。";
  const projectSiteId = new URLSearchParams(location.search).get("siteId");
  const productMarketDestination = `/zb/client-source/product-market?tab=operations${projectSiteId ? `&siteId=${encodeURIComponent(projectSiteId)}` : ""}`;

  return (
    <div data-client-source-shell data-responsive-shell="client-source" className="app-shell flex overflow-hidden bg-slate-50 lg:h-screen">
      <div data-responsive-desktop-nav className="hidden lg:block">
        <Sidebar key={`client-source-${layoutStyle.clientTopbarBgColor || "topbar"}-${sidebarStyle.bgFrom || "sidebar"}`} />
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" data-responsive-drawer="client-source" className="app-mobile-sheet">
          <SheetHeader className="app-mobile-sheet-header">
            <SheetTitle className="text-base">{t.mobileNavTitle}</SheetTitle>
          </SheetHeader>
          <SheetBody className="app-mobile-sheet-body bg-slate-50">
            <Sidebar key={`client-source-${layoutStyle.clientTopbarBgColor || "topbar"}-${sidebarStyle.bgFrom || "sidebar"}-mobile`} />
          </SheetBody>
        </SheetContent>
      </Sheet>

      <div data-client-project-workspace className="app-page flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header
          ref={clientTopbarRef}
          className="app-topbar client-source-topbar"
          data-responsive-topbar
          data-responsive-shared-surface="top"
          data-responsive-shared-surface-plugin="large-band-density"
          data-responsive-shared-action-scope="true"
          data-responsive-topbar-disclosure="popover"
          data-responsive-topbar-expanded={mobileTopbarExpanded ? "true" : "false"}
          style={{ backgroundColor: headerBgColor, color: headerTextColor, borderColor: topbarBorderColor }}
        >
          <button
            className="app-toolbar-icon-btn client-source-mobile-menu shrink-0"
            data-responsive-nav-trigger
            data-responsive-toolbar-trigger="navigation"
            data-responsive-function-key-plugin="shared"
            data-responsive-toolbar-order="1"
            data-responsive-priority="p0"
            style={{ borderColor: topbarBorderColor, color: headerTextColor, backgroundColor: topbarSurfaceBg }}
            aria-label={`打开${navigationLabel}导航`}
            title={navigationLabel}
            data-responsive-navigation-label="page-name"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("tradepro:responsive-toolbar-open", { detail: { source: "navigation" } }));
              setMobileNavOpen(true);
            }}
            type="button"
          >
            <Menu className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span data-responsive-tool-label>{navigationLabel}</span>
          </button>
          <button
            ref={clientTopbarToggleRef}
            type="button"
            className="client-source-mobile-topbar-toggle"
            data-responsive-topbar-toggle
            data-responsive-client-tools-toggle
            data-responsive-toolbar-trigger="client-tools"
            data-responsive-function-key-plugin="shared"
            data-responsive-toolbar-order="2"
            data-responsive-priority="p0"
            onClick={() => setMobileTopbarExpanded((current) => {
              const next = !current;
              if (next) window.dispatchEvent(new CustomEvent("tradepro:responsive-toolbar-open", { detail: { source: "client-tools" } }));
              return next;
            })}
            aria-expanded={mobileTopbarExpanded}
            aria-controls="client-source-topbar-tools"
            aria-label={`${mobileTopbarExpanded ? "收起" : "展开"}${RESPONSIVE_SHELL_TOOL_LABELS["client-tools"]}`}
            title={RESPONSIVE_SHELL_TOOL_LABELS["client-tools"]}
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span data-responsive-topbar-toggle-label data-responsive-tool-label>{RESPONSIVE_SHELL_TOOL_LABELS["client-tools"]}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${mobileTopbarExpanded ? "rotate-180" : ""}`} />
          </button>
          <div id="client-source-page-tools-slot" data-responsive-page-tools-slot />
          <div
            id="client-source-topbar-tools"
            role="region"
            aria-label={`${RESPONSIVE_SHELL_TOOL_LABELS["client-tools"]}工具面板`}
            data-responsive-topbar-content
            data-responsive-topbar-popover="anchored"
            data-responsive-shared-popover="top-tools"
            data-responsive-shared-popover-plugin="large-interaction-density"
            className={`client-source-topbar-content flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:gap-3 ${mobileTopbarExpanded ? "is-expanded" : ""}`}
          >
            <div data-responsive-priority="p0" data-responsive-region="search" className="client-source-search relative min-w-0 w-full lg:max-w-[420px] lg:flex-1">
              <button
                className="hidden"
                style={{ borderColor: topbarBorderColor, color: headerTextColor, backgroundColor: topbarSurfaceBg }}
                aria-label={t.openNav}
                onClick={() => setMobileNavOpen(true)}
                type="button"
              >
                <Menu className="h-4 w-4" />
              </button>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: topbarSubtleTextColor }} />
              <Input
                placeholder={t.searchPlaceholder}
                className="h-9 pl-9 placeholder:opacity-60"
                style={{ borderColor: topbarBorderColor, backgroundColor: topbarSurfaceBg, color: headerTextColor }}
              />
            </div>
            <div data-source-topbar-actions data-responsive-sequence="business-order" className="client-source-topbar-actions flex w-full min-w-0 flex-nowrap items-center justify-end gap-2 overflow-hidden lg:ml-auto lg:w-auto lg:flex-none">
              <button
                onClick={() => navigate("/zb/client-source/releases")}
                data-responsive-priority="p1"
                data-responsive-compact="icon-label"
                className="app-toolbar-chip h-9 w-[148px] shrink-0 gap-1.5 whitespace-nowrap px-2 py-1.5 transition-colors"
                style={topbarSurfaceStyle}
                title={t.templateCenter}
                type="button"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded text-white" style={{ background: `linear-gradient(135deg, ${sourceHighlight}, #1e3a5f)` }}>
                  <Package className="h-3 w-3" />
                </div>
                <div data-responsive-copy="group" className="min-w-0 flex-1 whitespace-nowrap text-left [&>div:first-child]:!text-current [&>div:last-child]:!text-current [&>div:last-child]:opacity-70">
                  <div className="text-[10px] font-semibold leading-tight text-slate-700">{t.templateName}</div>
                  <div data-responsive-copy="secondary" className="text-[9px] leading-tight text-slate-400">{t.templateDesc}</div>
                </div>
              </button>
              <button data-responsive-priority="p2" data-responsive-compact="icon-only" className="app-toolbar-icon-btn shrink-0" style={topbarSurfaceStyle} type="button" aria-label={t.help}>
                <HelpCircle className="h-4 w-4" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger data-responsive-priority="p1" data-responsive-compact="icon-only" className="app-toolbar-chip h-9 w-[134px] shrink-0 gap-2 whitespace-nowrap px-2 py-1" style={topbarSurfaceStyle}>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-sky-500 text-xs font-semibold text-white">
                    CS
                  </div>
                  <div data-responsive-copy="group" className="hidden min-w-0 flex-1 whitespace-nowrap text-left sm:block">
                    <div className="text-xs font-medium" style={{ color: headerTextColor }}>{t.accountName}</div>
                    <div data-responsive-copy="secondary" className="text-[10px]" style={{ color: topbarMutedTextColor }}>{t.accountDesc}</div>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>{t.accountTitle}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(getClientSourceAccountPath("credits"))}>
                    <CreditCard className="mr-2 h-3.5 w-3.5 text-slate-500" />
                    {t.credits}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(getClientSourceAccountPath("social"))}>
                    <Share2 className="mr-2 h-3.5 w-3.5 text-slate-500" />
                    {t.social}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(getClientSourceAccountPath("plan"))}>
                    <Package className="mr-2 h-3.5 w-3.5 text-slate-500" />
                    {t.plans}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(getClientSourceAccountPath("profile"))}>
                    <User className="mr-2 h-3.5 w-3.5 text-slate-500" />
                    {t.profile}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <HelpCircle className="mr-2 h-3.5 w-3.5 text-slate-500" />
                    {t.help}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600">
                    <LogOut className="mr-2 h-3.5 w-3.5" />
                    {t.logout}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button data-responsive-priority="p1" data-responsive-compact="icon-only" className="app-toolbar-icon-btn relative shrink-0" style={topbarSurfaceStyle} type="button" aria-label={t.notice}>
                <Bell className="h-4 w-4" />
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
              </button>
            </div>
          </div>
        </header>

        <DeferredShellRuntimeHosts pathname={location.pathname} search={location.search} sourceScope="client_source" />

        {!isProductMarketPage && !isReleaseCenter ? (
          <Suspense fallback={null}>
            <VisualProjectContractHost
              pathname={location.pathname}
              search={location.search}
              sourceLabel={projectTitlePath}
            />
          </Suspense>
        ) : null}

        <main
          data-client-source-main
          data-client-project-shell
          data-visual-layout-root
          data-development-standard-frame-region={isCompanyInfoPage ? "body" : undefined}
          data-development-standard-frame-label={isCompanyInfoPage ? "主体" : undefined}
          data-client-project-subnav-hidden={hideProjectSubnav ? "true" : "false"}
          className="app-main"
        >
          <ResponsivePageHost scope="client-source">{isProductMarketPage || isReleaseCenter ? <Outlet /> : projectUnavailable ? (
            <section data-client-project-unavailable data-product-route-status={configuredProjectRoute.status} className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-6 py-16 text-center">
              <nav
                aria-label="未开通项目导航"
                data-page-table-header
                data-client-project-unavailable-navigation
                data-page-factory-region="table-header"
                data-development-standard-frame-region="table-header"
                data-development-standard-frame-label="表头"
                className="flex min-h-[62px] w-full items-center justify-between gap-3 rounded-xl border px-4 text-left"
              >
                <span className="min-w-0 truncate text-sm font-semibold">{projectTitlePath}</span>
                <button
                  type="button"
                  className="shrink-0 rounded-md border px-3 py-2 text-xs font-medium"
                  onClick={() => navigate(productMarketDestination)}
                >
                  运营市场
                </button>
              </nav>
              <div
                data-page-factory-region="content"
                data-development-standard-frame-region="content"
                data-development-standard-frame-label="内容"
                className="w-full"
              >
                <div data-client-project-unavailable-frame className="w-full">
                  <div
                    data-client-project-unavailable-header
                    data-page-factory-region="title-2"
                    data-responsive-shared-surface="title-2"
                    data-development-standard-frame-region="title-2"
                    data-development-standard-frame-label="标题2"
                    className="w-full text-center"
                  >
                    <ProjectTitleIcon className="mx-auto mb-2 h-8 w-8" aria-hidden="true" />
                    <h1 className="text-xl font-semibold">{projectTitlePath}</h1>
                  </div>
                  <div
                    data-page-factory-region="large-card"
                    data-development-standard-frame-region="large-card"
                    data-development-standard-frame-label="大卡片"
                    data-shared-large-card-surface="true"
                    className="w-full rounded-2xl border p-8 shadow-sm"
                    style={unavailablePanelStyle}
                  >
                    <div
                      data-page-factory-region="small-card"
                      data-development-standard-frame-region="small-card"
                      data-development-standard-frame-label="小卡片"
                      data-shared-small-card-surface="true"
                      className="mx-auto mt-3 w-full max-w-xl rounded-xl border p-4"
                      style={{ borderColor: withAlpha(sourceHighlight, 0.22), backgroundColor: withAlpha(sourceHighlight, 0.07) }}
                    >
                      <p className="text-sm leading-6 opacity-80">{unavailableProjectCopy}</p>
                      <button
                        type="button"
                        data-client-project-action
                        className="mt-4 inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-medium"
                        style={{ borderColor: withAlpha(sourceHighlight, 0.58), backgroundColor: withAlpha(sourceHighlight, 0.14), color: sourceHighlight }}
                        onClick={() => navigate(productMarketDestination)}
                      >
                        前往运营市场
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : !hasDedicatedProjectFrame ? (
            <section
              data-client-project-frame
              data-page-layout-frame
              data-development-standard-frame-region={isCompanyInfoPage ? undefined : "body"}
              data-development-standard-frame-label={isCompanyInfoPage ? undefined : "主体"}
              aria-label={`${projectTitlePath} 页面框架`}
            >
              <section
                data-client-project-context
                data-page-title
                data-shared-layout-section="title"
                data-development-standard-frame-region="title"
                data-development-standard-frame-label="标题"
              >
                <div data-client-project-context-copy>
                  <div data-client-project-heading>
                    {projectNavItem?.customStyle?.customIconUrl ? (
                      <img src={projectNavItem.customStyle.customIconUrl} alt="" aria-hidden="true" />
                    ) : (
                      <ProjectTitleIcon aria-hidden="true" />
                    )}
                    <div>
                      <h1 data-shared-title-heading>{projectTitlePath}</h1>
                      <p data-shared-title-description>{projectContext.description}</p>
                    </div>
                  </div>
                </div>
                <div data-client-project-context-actions data-page-title-actions>
                  <button type="button" data-client-project-action data-shared-title-save-action aria-disabled={projectHardLocked} title={projectHardLocked ? "当前页面已启用防误改，点击查看解除提示。" : undefined} onClick={openProjectKeepSettings}>
                    <Save aria-hidden="true" />
                    保存设置
                  </button>
                </div>
              </section>
              <div data-client-project-content><Outlet /></div>
            </section>
          ) : shellProvidesProjectFrame ? (
            <section data-client-project-frame data-client-project-navigation-frame data-page-layout-frame data-development-standard-frame-region="workspace" data-development-standard-frame-label="主体" aria-label={`${projectTitlePath} 页面框架`}>
              <Outlet />
            </section>
          ) : <Outlet />}</ResponsivePageHost>
        </main>
        <footer
          data-client-page-footer
          data-page-layout-footer
          data-development-standard-frame-region="footer"
          data-development-standard-frame-label="尾栏"
          data-client-project-footer-hidden={hasDedicatedProjectFrame && !projectUnavailable && !keepDedicatedProjectFooter ? "true" : "false"}
          className="shrink-0 items-center justify-between px-4 py-3 text-xs sm:px-6"
        >
          <div data-client-project-footer-copy className="flex min-w-0 items-center gap-1.5">
            {currentLayoutLock ? <PageFooterLockControls
              sourceLocked={projectSourceLocked}
              pageLocked={projectHardLocked}
              columnLocked={projectLayoutLocked}
              onToggleSource={() => { void toggleCurrentProjectSourceLock(); }}
              onTogglePage={toggleCurrentProjectPageLock}
              onToggleColumn={toggleCurrentProjectLayoutLock}
            /> : null}
            {isProductMarketModulesPage ? (
              <div className="flex min-w-0 items-center gap-1" data-product-module-icon-controls>
                <ContentPluginToggle
                  label="分类图标"
                  checked={moduleIconVisibility.category}
                  onCheckedChange={(category) => persistModuleIconVisibility({ category })}
                />
                <ContentPluginToggle
                  label="一级图标"
                  checked={moduleIconVisibility.primary}
                  onCheckedChange={(primary) => persistModuleIconVisibility({ primary })}
                />
                <ContentPluginToggle
                  label="二级图标"
                  checked={moduleIconVisibility.secondary}
                  onCheckedChange={(secondary) => persistModuleIconVisibility({ secondary })}
                />
                <ContentPluginToggle
                  label="分类名称"
                  checked={moduleIconVisibility.showEmptyCategoryNames}
                  onCheckedChange={(showEmptyCategoryNames) => persistModuleIconVisibility({ showEmptyCategoryNames })}
                />
              </div>
            ) : null}
          </div>
          <div data-footer-primary-actions>
            <DeferredExternalDevtoolsMenu placement="footer" variant="light" />
            <DeferredGlobalLocalEnvAlert variant="client" placement="footer" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  data-responsive-compact-external-tools
                  aria-label="外置工具"
                  title="外置工具"
                >
                  <Menu aria-hidden="true" />
                  <span data-responsive-tool-label>工具</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>外置工具</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem data-responsive-compact-tool="standard" onSelect={() => window.setTimeout(() => document.querySelector<HTMLButtonElement>("[data-development-standard-quick-switch]")?.click(), 0)}>
                  <LayoutPanelTop className="mr-2 h-4 w-4" aria-hidden="true" />
                  规范
                </DropdownMenuItem>
                <DropdownMenuItem data-responsive-compact-tool="developer" onSelect={() => window.setTimeout(() => document.querySelector<HTMLButtonElement>("[data-development-application-launcher]")?.click(), 0)}>
                  <Package className="mr-2 h-4 w-4" aria-hidden="true" />
                  客户源开发器
                </DropdownMenuItem>
                <DropdownMenuItem data-responsive-compact-tool="diagnostic" onSelect={() => window.setTimeout(() => document.querySelector<HTMLButtonElement>("[data-local-env-diagnostic-trigger]")?.click(), 0)}>
                  <HelpCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                  异常检测
                </DropdownMenuItem>
                <DropdownMenuItem data-responsive-compact-tool="visual" onSelect={() => window.setTimeout(() => document.querySelector<HTMLButtonElement>("[data-visual-card-developer-launcher]")?.click(), 0)}>
                  <LayoutPanelTop className="mr-2 h-4 w-4" aria-hidden="true" />
                  可视化
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div data-responsive-visual-launcher-slot />
            <button type="button" data-client-project-action data-responsive-priority="p0" aria-label="保存并同步" aria-disabled={projectHardLocked} title={projectHardLocked ? "当前页面已启用防误改，点击查看解除提示。" : undefined} onClick={openProjectKeepSettings}>
              <Save aria-hidden="true" />
              <span data-save-sync-label>保存</span>
            </button>
          </div>
        </footer>
        <DeferredUnifiedActionDialog
          open={syncDialogOpen}
          onOpenChange={setSyncDialogOpen}
          title="保存并同步页面设置"
          description="将当前页面的共享框架和已完成配置同步到本地项目设置。"
          confirmLabel="确认保存并同步"
          busyLabel="正在保存并同步"
          onConfirm={syncCurrentProjectPage}
        />
        <DeferredSiteSwitchLoadingOverlay />
        <LazyAIServiceWidget />
      </div>
    </div>
  );
}
