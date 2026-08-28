import {
  BarChart3,
  BookOpen,
  Bot,
  FolderKanban,
  Globe,
  HardHat,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  LineChart,
  Megaphone,
  Newspaper,
  Package,
  Search,
  Settings,
  Share2,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { FACTORY_PLATFORM_SOCIAL_WORKSPACES } from "./factory-platform-blueprint";

export type ModuleStatus = "active" | "inactive" | "hidden";

export interface PlatformModuleChild {
  label: string;
  path: string;
  status: ModuleStatus;
}

export interface PlatformModuleItem {
  label: string;
  path: string;
  status: ModuleStatus;
  icon: LucideIcon;
  children?: PlatformModuleChild[];
}

export const CLIENT_PLATFORM_MODULES: PlatformModuleItem[] = [
  { label: "服务概览", path: "/", status: "active", icon: LayoutDashboard },
  {
    label: "AI 智能",
    path: "/ai-chat",
    status: "active",
    icon: Bot,
    children: [
      { label: "AI 建站", path: "/ai-chat", status: "active" },
      { label: "智能客服", path: "/ai-customer-service", status: "active" },
    ],
  },
  { label: "已创计划", path: "/projects", status: "active", icon: FolderKanban },
  {
    label: "产品分析",
    path: "/product-analysis",
    status: "active",
    icon: LineChart,
    children: [
      { label: "关键词规划", path: "/product-analysis?tab=keyword-planner", status: "active" },
      { label: "趋势分析", path: "/product-analysis?tab=trends", status: "active" },
      { label: "数据洞察", path: "/product-analysis?tab=data-studio", status: "active" },
      { label: "全球商机", path: "/product-analysis?tab=market-finder", status: "active" },
      { label: "市场调研", path: "/product-analysis?tab=global-market", status: "active" },
    ],
  },
  {
    label: "企业资料",
    path: "/company-info",
    status: "active",
    icon: Globe,
    children: [
      { label: "导航栏自定义", path: "/company-info?tab=navigation", status: "active" },
      { label: "基本资料", path: "/company-info?tab=profile", status: "active" },
      { label: "首页 Banner", path: "/company-info?tab=banner", status: "active" },
      { label: "产品推荐", path: "/company-info?tab=recommend", status: "active" },
      { label: "公司介绍", path: "/company-info?tab=about", status: "active" },
      { label: "FAQ", path: "/company-info?tab=faq", status: "active" },
      { label: "工厂生产", path: "/company-info?tab=factory", status: "active" },
      { label: "公司风采", path: "/company-info?tab=gallery", status: "active" },
      { label: "展会活动", path: "/company-info?tab=exhibition", status: "active" },
      { label: "服务保障", path: "/company-info?tab=service", status: "active" },
      { label: "物流货运", path: "/company-info?tab=logistics", status: "active" },
      { label: "IM 客服", path: "/company-info?tab=im", status: "active" },
      { label: "自定义模块", path: "/company-info?tab=modules", status: "active" },
    ],
  },
  {
    label: "产品管理",
    path: "/products",
    status: "active",
    icon: Package,
    children: [
      { label: "产品列表", path: "/products?tab=list", status: "active" },
      { label: "分类管理", path: "/products?tab=category", status: "active" },
      { label: "产品模板", path: "/products?tab=article", status: "active" },
    ],
  },
  {
    label: "新闻中心",
    path: "/news",
    status: "active",
    icon: Newspaper,
    children: [
      { label: "新闻列表", path: "/news?tab=list", status: "active" },
      { label: "新闻分类", path: "/news?tab=category", status: "active" },
      { label: "新闻模板", path: "/news?tab=template", status: "active" },
    ],
  },
  {
    label: "工程案例",
    path: "/cases",
    status: "active",
    icon: HardHat,
    children: [
      { label: "案例列表", path: "/cases?tab=list", status: "active" },
      { label: "案例分类", path: "/cases?tab=category", status: "active" },
      { label: "案例模板", path: "/cases?tab=template", status: "active" },
    ],
  },
  {
    label: "企业视频",
    path: "/videos",
    status: "inactive",
    icon: Video,
    children: [
      { label: "视频列表", path: "/videos?tab=list", status: "active" },
      { label: "视频分类", path: "/videos?tab=category", status: "active" },
      { label: "视频授权同步", path: "/videos?tab=sync", status: "active" },
    ],
  },
  {
    label: "博客优化",
    path: "/blog",
    status: "inactive",
    icon: BookOpen,
    children: [
      { label: "博客列表", path: "/blog?tab=list", status: "active" },
      { label: "博客分类", path: "/blog?tab=category", status: "active" },
      { label: "博客模板", path: "/blog?tab=template", status: "active" },
    ],
  },
  {
    label: "SEO 优化",
    path: "/seo",
    status: "inactive",
    icon: Search,
    children: [
      { label: "关键词", path: "/seo?tab=keywords", status: "active" },
      { label: "排名追踪", path: "/seo?tab=ranking", status: "active" },
      { label: "SEO 文章", path: "/seo?tab=articles", status: "active" },
      { label: "SEO 审计", path: "/seo?tab=audit", status: "active" },
      { label: "Meta 管理", path: "/seo?tab=meta", status: "active" },
      { label: "外链管理", path: "/seo?tab=backlinks", status: "active" },
      { label: "内链规则", path: "/seo?tab=internal", status: "active" },
      { label: "死链检测", path: "/seo?tab=deadlinks", status: "active" },
      { label: "关键词密度", path: "/seo?tab=density", status: "active" },
      { label: "TDK 模板", path: "/seo?tab=tdk", status: "active" },
      { label: "关键词挖掘", path: "/seo?tab=mining", status: "active" },
    ],
  },
  {
    label: "GEO 中心",
    path: "/geo-center",
    status: "inactive",
    icon: Globe,
    children: [
      { label: "优化词", path: "/geo-center?tab=keywords", status: "active" },
      { label: "文章创作", path: "/geo-center?tab=writing", status: "active" },
      { label: "创作记录", path: "/geo-center?tab=records", status: "active" },
      { label: "发布计划", path: "/geo-center?tab=schedule", status: "active" },
      { label: "发布记录", path: "/geo-center?tab=publish-history", status: "active" },
      { label: "大模型报表", path: "/geo-center?tab=llm-reports", status: "active" },
      { label: "权威媒体", path: "/geo-center?tab=authority-media", status: "active" },
    ],
  },
  {
    label: "社交媒体",
    path: "/social",
    status: "inactive",
    icon: Share2,
    children: [
      { label: "痛点路线", path: "/social?tab=customer-roadmap", status: "active" },
      ...FACTORY_PLATFORM_SOCIAL_WORKSPACES.map((workspace) => ({
        label: workspace.label,
        path: workspace.route,
        status: "active" as const,
      })),
    ],
  },
  {
    label: "智能推广",
    path: "/smart-ads",
    status: "inactive",
    icon: Megaphone,
    children: [
      { label: "推广概览", path: "/smart-ads?tab=overview", status: "active" },
      { label: "广告平台", path: "/smart-ads?tab=platforms", status: "active" },
      { label: "推广活动", path: "/smart-ads?tab=campaigns", status: "active" },
    ],
  },
  {
    label: "数据报表",
    path: "/reports",
    status: "inactive",
    icon: BarChart3,
    children: [
      { label: "流量概况", path: "/reports?tab=overview", status: "active" },
      { label: "流量来源", path: "/reports?tab=source", status: "active" },
      { label: "地区分布", path: "/reports?tab=region", status: "active" },
      { label: "受访页面", path: "/reports?tab=pages", status: "active" },
      { label: "每日访问量", path: "/reports?tab=daily", status: "active" },
      { label: "访问时段", path: "/reports?tab=time", status: "active" },
      { label: "访问明细", path: "/reports?tab=details", status: "active" },
      { label: "浏览器占比", path: "/reports?tab=browser", status: "active" },
      { label: "系统占比", path: "/reports?tab=system", status: "active" },
      { label: "设备占比", path: "/reports?tab=device", status: "active" },
      { label: "SEO 明细", path: "/reports?tab=seo", status: "active" },
      { label: "流量分类", path: "/reports?tab=classification", status: "active" },
    ],
  },
  {
    label: "询盘管理",
    path: "/inquiries",
    status: "inactive",
    icon: Inbox,
    children: [
      { label: "询盘列表", path: "/inquiries?tab=list", status: "active" },
      { label: "表单配置", path: "/inquiries?tab=form", status: "active" },
      { label: "回复模板", path: "/inquiries?tab=template", status: "active" },
      { label: "分配规则", path: "/inquiries?tab=rules", status: "active" },
      { label: "垃圾黑名单", path: "/inquiries?tab=blacklist", status: "active" },
    ],
  },
  {
    label: "CRM 管理",
    path: "/customers",
    status: "inactive",
    icon: Users,
    children: [
      { label: "工作汇总", path: "/customers?tab=summary", status: "active" },
      { label: "商机数据", path: "/customers?tab=opportunities", status: "active" },
      { label: "客户公海", path: "/customers?tab=pool", status: "active" },
      { label: "客户管理", path: "/customers?tab=clients", status: "active" },
      { label: "邮件管理", path: "/customers?tab=emails", status: "active" },
      { label: "文件夹管理", path: "/customers?tab=folders", status: "active" },
      { label: "邮件营销", path: "/customers?tab=marketing", status: "active" },
    ],
  },
  { label: "网站模板", path: "/templates", status: "inactive", icon: LayoutTemplate },
  {
    label: "站点设置",
    path: "/site-settings",
    status: "active",
    icon: Settings,
    children: [
      { label: "基础设置", path: "/site-settings?tab=general", status: "active" },
      { label: "重定向规则", path: "/site-settings?tab=redirect", status: "active" },
    ],
  },
];

const HOME_DESIGN_PLATFORM_PATH = "/company-info?tab=navigation";
const HOME_DESIGN_PLATFORM_CHILD_PATHS = new Set([
  "/company-info?tab=navigation",
  "/company-info?tab=banner",
  "/company-info?tab=recommend",
]);

const HOME_DESIGN_PLATFORM_MODULE: PlatformModuleItem = {
  label: "首页设计",
  path: HOME_DESIGN_PLATFORM_PATH,
  status: "active",
  icon: LayoutTemplate,
  children: [
    { label: "导航栏自定义", path: "/company-info?tab=navigation", status: "active" },
    { label: "首页 Banner", path: "/company-info?tab=banner", status: "active" },
    { label: "产品推荐", path: "/company-info?tab=recommend", status: "active" },
  ],
};

function normalizeClientPlatformModules(modules: PlatformModuleItem[]) {
  const normalized = modules
    .filter((module) => module.path !== HOME_DESIGN_PLATFORM_PATH)
    .map((module) => {
      if (module.path !== "/company-info") return module;
      return {
        ...module,
        children: module.children?.filter((child) => !HOME_DESIGN_PLATFORM_CHILD_PATHS.has(child.path)),
      };
    });

  const companyIndex = normalized.findIndex((module) => module.path === "/company-info");
  const homeDesignModule = {
    ...HOME_DESIGN_PLATFORM_MODULE,
    children: HOME_DESIGN_PLATFORM_MODULE.children?.map((child) => ({ ...child })),
  };
  if (companyIndex >= 0) {
    normalized.splice(companyIndex + 1, 0, homeDesignModule);
  } else {
    normalized.push(homeDesignModule);
  }

  return normalized;
}

export const DEFAULT_CLIENT_ACTIVE_PATHS = [
  "/",
  "/ai-chat",
  "/projects",
  "/product-analysis",
  "/company-info",
  "/company-info?tab=navigation",
  "/products",
  "/news",
  "/cases",
  "/site-settings",
];

export function createClientSidebarNavItems() {
  return normalizeClientPlatformModules(CLIENT_PLATFORM_MODULES).map(({ label, path, icon, children }) => ({
    label,
    path,
    icon,
    children: children?.map(({ label: childLabel, path: childPath }) => ({
      label: childLabel,
      path: childPath,
    })),
  }));
}

export function createClientProductItems() {
  return CLIENT_PLATFORM_MODULES.map((item) => ({
    ...item,
    children: item.children?.map((child) => ({ ...child })),
  }));
}
