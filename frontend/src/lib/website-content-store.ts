import { repairKnownMojibake } from "./text-sanitizer";
import { safeSetLocalStorage } from "./storage-guards";
import {
  getWebsiteContentSessionFallbackKey as getSessionFallbackKey,
  getWebsiteContentStorageKey as getStorageKey,
} from "./website-content-storage";

export { clearWebsiteContentState } from "./website-content-storage";

export type TranslationStatus = "none" | "partial" | "translated";

export type WebsiteNavigationItem = {
  id: string;
  label: string;
  /** Per-language website label. The management UI keeps the Chinese label as the canonical source. */
  labels?: Record<string, string>;
  iconName?: string;
  customIconUrl?: string;
  customIconAssetId?: string;
  sectionKey?: string;
  href: string;
  visible: boolean;
  /** Generated children are owned by the matching content-category library. */
  generatedFrom?: string;
  children?: WebsiteNavigationItem[];
};

export type WebsiteNavigationTemplateId = "global-b2b" | "brand-site" | "b2c-hybrid";

export type WebsiteNavigationTemplate = {
  id: WebsiteNavigationTemplateId;
  label: string;
  description: string;
};

/**
 * 02.布场的公共网站导航模板。它们只编排可面向访客的内容栏目；
 * “素材本地”是 DAM/本地化素材来源，绝不能被误投影为公开导航。
 * 产品、新闻、案例、视频和博客的分类子项仍由内容库自动生成。
 */
export const WEBSITE_NAVIGATION_TEMPLATES: readonly WebsiteNavigationTemplate[] = [
  { id: "global-b2b", label: "\u5916\u8d38 B2B", description: "以产品、工程案例、企业证明与询盘为主线，适合海外采购和经销商。" },
  { id: "brand-site", label: "\u54c1\u724c\u5b98\u7f51", description: "以品牌信任、制造实力、内容沉淀与长期关系为主线。" },
  { id: "b2c-hybrid", label: "B2C / \u6df7\u5408", description: "兼顾商品发现、品牌内容、服务保障与购买/询盘分流。" },
] as const;

type NavigationTemplateItem = Omit<WebsiteNavigationItem, "id" | "visible" | "children"> & {
  children?: NavigationTemplateItem[];
};

function materializeNavigationTemplate(items: NavigationTemplateItem[]): WebsiteNavigationItem[] {
  return items.map((item) => ({
    ...item,
    id: uid("nav"),
    visible: true,
    children: item.children?.length ? materializeNavigationTemplate(item.children) : undefined,
  }));
}

const NAVIGATION_TEMPLATE_ITEMS: Record<WebsiteNavigationTemplateId, NavigationTemplateItem[]> = {
  "global-b2b": [
    { label: "\u9996\u9875", labels: { zh: "\u9996\u9875", en: "Home" }, iconName: "Navigation", sectionKey: "hero", href: "/hero" },
    { label: "\u4ea7\u54c1\u4e2d\u5fc3", labels: { zh: "\u4ea7\u54c1\u4e2d\u5fc3", en: "Products" }, iconName: "Package", sectionKey: "products", href: "/products" },
    { label: "\u5de5\u7a0b\u6848\u4f8b", labels: { zh: "\u5de5\u7a0b\u6848\u4f8b", en: "Case Studies" }, iconName: "Calendar", sectionKey: "cases", href: "/cases" },
    {
      label: "\u4f01\u4e1a\u8d44\u6599", labels: { zh: "\u4f01\u4e1a\u8d44\u6599", en: "Company" }, iconName: "Building2", sectionKey: "company", href: "/company",
      children: [
        { label: "\u516c\u53f8\u4ecb\u7ecd", labels: { zh: "\u516c\u53f8\u4ecb\u7ecd", en: "About Us" }, iconName: "Building2", sectionKey: "company", href: "/company" },
        { label: "\u670d\u52a1\u4fdd\u969c", labels: { zh: "\u670d\u52a1\u4fdd\u969c", en: "Service Assurance" }, iconName: "ShieldCheck", sectionKey: "service", href: "/service" },
      ],
    },
    {
      label: "\u8d44\u6e90\u4e2d\u5fc3", labels: { zh: "\u8d44\u6e90\u4e2d\u5fc3", en: "Resources" }, iconName: "Globe2", sectionKey: "resources", href: "/news",
      children: [
        { label: "\u65b0\u95fb\u4e2d\u5fc3", labels: { zh: "\u65b0\u95fb\u4e2d\u5fc3", en: "News" }, iconName: "Blocks", sectionKey: "news", href: "/news" },
        { label: "\u4f01\u4e1a\u89c6\u9891", labels: { zh: "\u4f01\u4e1a\u89c6\u9891", en: "Videos" }, iconName: "Video", sectionKey: "videos", href: "/videos" },
        { label: "\u535a\u5ba2\u4e2d\u5fc3", labels: { zh: "\u535a\u5ba2\u4e2d\u5fc3", en: "Blog" }, iconName: "Globe2", sectionKey: "blog", href: "/blog" },
      ],
    },
    { label: "\u8054\u7cfb\u6211\u4eec", labels: { zh: "\u8054\u7cfb\u6211\u4eec", en: "Contact" }, iconName: "MessageCircle", sectionKey: "contact", href: "/contact" },
  ],
  "brand-site": [
    { label: "\u9996\u9875", labels: { zh: "\u9996\u9875", en: "Home" }, iconName: "Navigation", sectionKey: "hero", href: "/hero" },
    { label: "\u4f01\u4e1a\u8d44\u6599", labels: { zh: "\u4f01\u4e1a\u8d44\u6599", en: "Our Company" }, iconName: "Building2", sectionKey: "company", href: "/company", children: [
      { label: "\u516c\u53f8\u4ecb\u7ecd", labels: { zh: "\u516c\u53f8\u4ecb\u7ecd", en: "About Us" }, iconName: "Building2", sectionKey: "company", href: "/company" },
      { label: "\u670d\u52a1\u4fdd\u969c", labels: { zh: "\u670d\u52a1\u4fdd\u969c", en: "Service Assurance" }, iconName: "ShieldCheck", sectionKey: "service", href: "/service" },
    ] },
    { label: "\u4ea7\u54c1\u4e2d\u5fc3", labels: { zh: "\u4ea7\u54c1\u4e2d\u5fc3", en: "Products" }, iconName: "Package", sectionKey: "products", href: "/products" },
    { label: "\u5de5\u7a0b\u6848\u4f8b", labels: { zh: "\u5de5\u7a0b\u6848\u4f8b", en: "Case Studies" }, iconName: "Calendar", sectionKey: "cases", href: "/cases" },
    { label: "\u4f01\u4e1a\u89c6\u9891", labels: { zh: "\u4f01\u4e1a\u89c6\u9891", en: "Videos" }, iconName: "Video", sectionKey: "videos", href: "/videos" },
    { label: "\u535a\u5ba2\u4e2d\u5fc3", labels: { zh: "\u535a\u5ba2\u4e2d\u5fc3", en: "Insights" }, iconName: "Globe2", sectionKey: "blog", href: "/blog" },
    { label: "\u65b0\u95fb\u4e2d\u5fc3", labels: { zh: "\u65b0\u95fb\u4e2d\u5fc3", en: "News" }, iconName: "Blocks", sectionKey: "news", href: "/news" },
    { label: "\u8054\u7cfb\u6211\u4eec", labels: { zh: "\u8054\u7cfb\u6211\u4eec", en: "Contact" }, iconName: "MessageCircle", sectionKey: "contact", href: "/contact" },
  ],
  "b2c-hybrid": [
    { label: "\u9996\u9875", labels: { zh: "\u9996\u9875", en: "Home" }, iconName: "Navigation", sectionKey: "hero", href: "/hero" },
    { label: "\u4ea7\u54c1\u4e2d\u5fc3", labels: { zh: "\u4ea7\u54c1\u4e2d\u5fc3", en: "Shop Products" }, iconName: "Package", sectionKey: "products", href: "/products" },
    { label: "\u5de5\u7a0b\u6848\u4f8b", labels: { zh: "\u5de5\u7a0b\u6848\u4f8b", en: "Stories" }, iconName: "Calendar", sectionKey: "cases", href: "/cases" },
    {
      label: "\u5185\u5bb9\u4e2d\u5fc3", labels: { zh: "\u5185\u5bb9\u4e2d\u5fc3", en: "Discover" }, iconName: "Globe2", sectionKey: "content", href: "/blog",
      children: [
        { label: "\u535a\u5ba2\u4e2d\u5fc3", labels: { zh: "\u535a\u5ba2\u4e2d\u5fc3", en: "Blog" }, iconName: "Globe2", sectionKey: "blog", href: "/blog" },
        { label: "\u65b0\u95fb\u4e2d\u5fc3", labels: { zh: "\u65b0\u95fb\u4e2d\u5fc3", en: "News" }, iconName: "Blocks", sectionKey: "news", href: "/news" },
        { label: "\u4f01\u4e1a\u89c6\u9891", labels: { zh: "\u4f01\u4e1a\u89c6\u9891", en: "Videos" }, iconName: "Video", sectionKey: "videos", href: "/videos" },
      ],
    },
    { label: "\u670d\u52a1\u4fdd\u969c", labels: { zh: "\u670d\u52a1\u4fdd\u969c", en: "Service" }, iconName: "ShieldCheck", sectionKey: "service", href: "/service" },
    { label: "\u4f01\u4e1a\u8d44\u6599", labels: { zh: "\u4f01\u4e1a\u8d44\u6599", en: "Company" }, iconName: "Building2", sectionKey: "company", href: "/company", children: [
      { label: "\u516c\u53f8\u4ecb\u7ecd", labels: { zh: "\u516c\u53f8\u4ecb\u7ecd", en: "About Us" }, iconName: "Building2", sectionKey: "company", href: "/company" },
    ] },
    { label: "\u8054\u7cfb\u6211\u4eec", labels: { zh: "\u8054\u7cfb\u6211\u4eec", en: "Contact" }, iconName: "MessageCircle", sectionKey: "contact", href: "/contact" },
  ],
};

/** Returns a fresh, editable navigation tree; applying a template never mutates an existing site in place. */
export function createWebsiteNavigationTemplate(templateId: WebsiteNavigationTemplateId): WebsiteNavigationItem[] {
  return materializeNavigationTemplate(NAVIGATION_TEMPLATE_ITEMS[templateId]);
}

const NAVIGATION_ENGLISH_LABELS: Record<string, string> = {
  hero: "Home",
  products: "Products",
  news: "News",
  cases: "Cases",
  videos: "Videos",
  blog: "Blog",
  company: "Company",
  factory: "Factory",
  gallery: "Gallery",
  office: "Office",
  service: "Service",
  faq: "FAQ",
  exhibition: "Exhibitions",
  logistics: "Logistics",
  contact: "Contact",
  im: "IM Service",
};

const NAVIGATION_TOP_LEVEL_ORDER = ["products", "news", "cases", "videos", "blog", "company", "service", "contact", "hero"];

function sortWebsiteNavigationItems(items: WebsiteNavigationItem[]) {
  return [...items].sort((left, right) => {
    const leftRank = NAVIGATION_TOP_LEVEL_ORDER.indexOf(left.sectionKey || "");
    const rightRank = NAVIGATION_TOP_LEVEL_ORDER.indexOf(right.sectionKey || "");
    const normalizedLeftRank = leftRank < 0 ? Number.MAX_SAFE_INTEGER : leftRank;
    const normalizedRightRank = rightRank < 0 ? Number.MAX_SAFE_INTEGER : rightRank;
    return normalizedLeftRank - normalizedRightRank;
  });
}

export type WebsiteProfileState = {
  companyName: string;
  companyEnglishName: string;
  logoUrl: string;
  logoAlt: string;
  faviconUrl: string;
  homepageTitle: string;
  contactPerson: string;
  phone: string;
  fax: string;
  email: string;
  officeAddress: string;
  factoryAddress: string;
  registeredAddress: string;
  businessType: string;
  mainMarkets: string;
  brandName: string;
  brandType: string;
  employees: string;
  annualSales: string;
  foundedYear: string;
  website: string;
  footerCopyright: string;
  contactName?: string;
  region?: string;
  markets?: string;
  brands?: string;
  revenue?: string;
};

export type WebsiteBannerItem = {
  id: string;
  title: string;
  linkUrl: string;
  summary: string;
  images: string[];
  pinned: boolean;
  enabled: boolean;
  translationStatus: TranslationStatus;
  showTextOverlay: boolean;
  mobileOnly: boolean;
  sortOrder: number | null;
};

export type WebsiteSectionEntry = {
  id: string;
  title: string;
  linkUrl: string;
  summary: string;
  images: string[];
  content: string;
  pinned: boolean;
  enabled: boolean;
  translationStatus: TranslationStatus;
  sortOrder: number | null;
};

export type WebsiteContentLibraryKey = "news" | "cases" | "videos" | "blog";

export type WebsiteContentLibraryItem = WebsiteSectionEntry & {
  categoryId: string;
  publishedAt: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  videoUrl: string;
};

export type WebsiteContentLibraryCategory = {
  id: string;
  name: string;
  /** English label used by the public multilingual navigation. */
  labels?: Record<string, string>;
  parentId: string | null;
  enabled: boolean;
  sortOrder: number | null;
};

export type WebsiteContentLibrary = {
  items: WebsiteContentLibraryItem[];
  categories: WebsiteContentLibraryCategory[];
};

export type WebsiteFaqItem = {
  id: string;
  question: string;
  linkName: string;
  summary: string;
  answer: string;
  pinned: boolean;
  enabled: boolean;
  translationStatus: TranslationStatus;
  sortOrder: number | null;
};

export type WebsiteImChannel = {
  id: string;
  platform: string;
  account: string;
  linkUrl: string;
  enabled: boolean;
  sortOrder: number | null;
};

export type WebsiteSocialLink = {
  id: string;
  platform: string;
  url: string;
  enabled: boolean;
  sortOrder: number | null;
};

export type WebsiteContentState = {
  profile: WebsiteProfileState;
  navigation: {
    enabled: boolean;
    items: WebsiteNavigationItem[];
    ctaLabel: string;
    ctaHref: string;
  };
  banner: {
    items: WebsiteBannerItem[];
    /**
     * One-time migration marker for the homepage Banner starter set.  It keeps
     * a user's later deletions intentional instead of silently re-seeding
     * items on every read.
     */
    seedVersion?: number;
  };
  recommend: {
    note: string;
  };
  contentLibrary: Record<WebsiteContentLibraryKey, WebsiteContentLibrary>;
  sections: {
    about: WebsiteSectionEntry[];
    factory: WebsiteSectionEntry[];
    gallery: WebsiteSectionEntry[];
    exhibition: WebsiteSectionEntry[];
    service: WebsiteSectionEntry[];
    logistics: WebsiteSectionEntry[];
    modules: WebsiteSectionEntry[];
  };
  faq: WebsiteFaqItem[];
  im: {
    channels: WebsiteImChannel[];
    onlineHours: string;
    autoReply: string;
    showFloatingWidget: boolean;
  };
  social: {
    links: WebsiteSocialLink[];
  };
};

const HOMEPAGE_BANNER_SEED_VERSION = 1;
const HOMEPAGE_BANNER_STARTER_TITLE = "Build a multilingual machinery website that converts buyers";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeText(value: string | undefined, fallback = "") {
  return repairKnownMojibake(value || fallback).trim();
}

function sortByPriority<T extends { pinned?: boolean; sortOrder?: number | null }>(items: T[]) {
  return [...items].sort((a, b) => {
    const pinnedDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinnedDiff !== 0) return pinnedDiff;
    return (b.sortOrder || 0) - (a.sortOrder || 0);
  });
}

function defaultNavigationItems(): WebsiteNavigationItem[] {
  return [
    { id: uid("nav"), label: "首页", href: "#hero", visible: true },
    { id: uid("nav"), label: "产品中心", href: "#products", visible: true },
    { id: uid("nav"), label: "新闻中心", href: "#news", visible: true },
    { id: uid("nav"), label: "工程案例", href: "#cases", visible: true },
    { id: uid("nav"), label: "企业视频", href: "/videos", visible: true },
    { id: uid("nav"), label: "博客中心", href: "#blog", visible: true },
    {
      id: uid("nav"),
      label: "关于我们",
      href: "#company",
      visible: true,
      children: [
        { id: uid("nav"), label: "公司介绍", href: "#company", visible: true },
        { id: uid("nav"), label: "工厂生产", href: "#factory", visible: true },
        { id: uid("nav"), label: "公司风采", href: "#gallery", visible: true },
      ],
    },
    {
      id: uid("nav"),
      label: "服务保障",
      href: "#service",
      visible: true,
      children: [
        { id: uid("nav"), label: "FAQ", href: "#faq", visible: true },
        { id: uid("nav"), label: "展会活动", href: "#exhibition", visible: true },
        { id: uid("nav"), label: "物流货运", href: "#logistics", visible: true },
      ],
    },
    {
      id: uid("nav"),
      label: "联系我们",
      href: "#contact",
      visible: true,
      children: [{ id: uid("nav"), label: "IM 客服", href: "#im", visible: true }],
    },
  ];
}

function defaultNavigationItemsV2(): WebsiteNavigationItem[] {
  return [
    { id: uid("nav"), label: "首页", iconName: "Navigation", sectionKey: "hero", href: "/hero", visible: true },
    { id: uid("nav"), label: "产品中心", iconName: "Package", sectionKey: "products", href: "/products", visible: true, children: [{ id: uid("nav"), label: "产品分类名称1", labels: { zh: "产品分类名称1", en: "Product Category 1" }, iconName: "Package", sectionKey: "products-category-1", href: "/products?category=product-category-1", visible: true, generatedFrom: "content-category:products" }, { id: uid("nav"), label: "产品分类名称2", labels: { zh: "产品分类名称2", en: "Product Category 2" }, iconName: "Package", sectionKey: "products-category-2", href: "/products?category=product-category-2", visible: true, generatedFrom: "content-category:products" }] },
    { id: uid("nav"), label: "新闻中心", iconName: "Blocks", sectionKey: "news", href: "/news", visible: true, children: [{ id: uid("nav"), label: "新闻分类名称1", labels: { zh: "新闻分类名称1", en: "News Category 1" }, iconName: "Blocks", sectionKey: "news-category-1", href: "/news?category=news-category-1", visible: true, generatedFrom: "content-category:news" }, { id: uid("nav"), label: "新闻分类名称2", labels: { zh: "新闻分类名称2", en: "News Category 2" }, iconName: "Blocks", sectionKey: "news-category-2", href: "/news?category=news-category-2", visible: true, generatedFrom: "content-category:news" }] },
    { id: uid("nav"), label: "工程案例", iconName: "Calendar", sectionKey: "cases", href: "/cases", visible: true, children: [{ id: uid("nav"), label: "案例分类名称1", labels: { zh: "案例分类名称1", en: "Case Category 1" }, iconName: "Calendar", sectionKey: "cases-category-1", href: "/cases?category=cases-category-1", visible: true, generatedFrom: "content-category:cases" }, { id: uid("nav"), label: "案例分类名称2", labels: { zh: "案例分类名称2", en: "Case Category 2" }, iconName: "Calendar", sectionKey: "cases-category-2", href: "/cases?category=cases-category-2", visible: true, generatedFrom: "content-category:cases" }] },
    { id: uid("nav"), label: "企业视频", iconName: "Video", sectionKey: "videos", href: "/videos", visible: true, children: [{ id: uid("nav"), label: "视频分类名称1", labels: { zh: "视频分类名称1", en: "Video Category 1" }, iconName: "Video", sectionKey: "videos-category-1", href: "/videos?category=videos-category-1", visible: true, generatedFrom: "content-category:videos" }, { id: uid("nav"), label: "视频分类名称2", labels: { zh: "视频分类名称2", en: "Video Category 2" }, iconName: "Video", sectionKey: "videos-category-2", href: "/videos?category=videos-category-2", visible: true, generatedFrom: "content-category:videos" }] },
    { id: uid("nav"), label: "博客中心", iconName: "Globe2", sectionKey: "blog", href: "/blog", visible: true, children: [{ id: uid("nav"), label: "博客分类名称1", labels: { zh: "博客分类名称1", en: "Blog Category 1" }, iconName: "Globe2", sectionKey: "blog-category-1", href: "/blog?category=blog-category-1", visible: true, generatedFrom: "content-category:blog" }, { id: uid("nav"), label: "博客分类名称2", labels: { zh: "博客分类名称2", en: "Blog Category 2" }, iconName: "Globe2", sectionKey: "blog-category-2", href: "/blog?category=blog-category-2", visible: true, generatedFrom: "content-category:blog" }] },
    {
      id: uid("nav"),
      label: "关于我们",
      iconName: "Building2",
      sectionKey: "company",
      href: "/company",
      visible: true,
      children: [
        { id: uid("nav"), label: "公司介绍", iconName: "Building2", sectionKey: "company", href: "/company", visible: true },
        { id: uid("nav"), label: "工厂生产", iconName: "Factory", sectionKey: "factory", href: "/factory", visible: true },
        {
          id: uid("nav"),
          label: "公司风采",
          iconName: "Image",
          sectionKey: "gallery",
          href: "/gallery",
          visible: true,
          children: [{ id: uid("nav"), label: "办公环境", iconName: "Image", sectionKey: "office", href: "/office", visible: true }],
        },
      ],
    },
    {
      id: uid("nav"),
      label: "服务保障",
      iconName: "ShieldCheck",
      sectionKey: "service",
      href: "/service",
      visible: true,
      children: [
        { id: uid("nav"), label: "FAQ", iconName: "HelpCircle", sectionKey: "faq", href: "/faq", visible: true },
        { id: uid("nav"), label: "展会活动", iconName: "Calendar", sectionKey: "exhibition", href: "/exhibition", visible: true },
        { id: uid("nav"), label: "物流货运", iconName: "Truck", sectionKey: "logistics", href: "/logistics", visible: true },
      ],
    },
    {
      id: uid("nav"),
      label: "联系我们",
      iconName: "MessageCircle",
      sectionKey: "contact",
      href: "/contact",
      visible: true,
      children: [{ id: uid("nav"), label: "IM 客服", iconName: "MessageCircle", sectionKey: "im", href: "/im", visible: true }],
    },
  ];
}

function isNavigationMatch(item: WebsiteNavigationItem | undefined, targets: string[]) {
  if (!item) return false;
  const label = normalizeText(item.label, "").trim();
  const sectionKey = normalizeText(item.sectionKey, "").replace(/^[/#]+/, "").trim();
  const hrefToken = normalizeText(item.href, "")
    .replace(/^[/#]+/, "")
    .split(/[?#]/)[0]
    .trim();
  return [label, sectionKey, hrefToken].some((value) => value && targets.includes(value));
}

function migrateNavigationItemsV2(items: WebsiteNavigationItem[]) {
  const cloned = items.map((item) => ({
    ...item,
    children: item.children?.map((child) => ({ ...child })),
  }));

  const casesItem = cloned.find((item) => isNavigationMatch(item, ["工程案例", "cases"]));
  let extractedVideoChild: WebsiteNavigationItem | undefined;
  if (casesItem) {
    const casesChildren = [...(casesItem.children || [])];
    const nextChildren: WebsiteNavigationItem[] = [];
    casesChildren.forEach((child) => {
      if (!extractedVideoChild && isNavigationMatch(child, ["企业视频", "videos"])) {
        extractedVideoChild = {
          ...child,
          iconName: child.iconName || "Video",
          sectionKey: "videos",
          href: "/videos",
          visible: child.visible !== false,
        };
        return;
      }
      nextChildren.push(child);
    });
    casesItem.children = nextChildren.length ? nextChildren : undefined;
  }

  const videoItem = cloned.find((item) => isNavigationMatch(item, ["企业视频", "videos"]));
  if (!videoItem) {
    const insertIndex = cloned.findIndex((item) => isNavigationMatch(item, ["工程案例", "cases"]));
    const nextVideoItem =
      extractedVideoChild || {
        id: uid("nav"),
        label: "企业视频",
        iconName: "Video",
        sectionKey: "videos",
        href: "/videos",
        visible: true,
      };
    if (insertIndex >= 0) {
      cloned.splice(insertIndex + 1, 0, nextVideoItem);
    } else {
      cloned.push(nextVideoItem);
    }
  }

  const serviceItem = cloned.find((item) => isNavigationMatch(item, ["服务保障", "service"]));
  let extractedImChild: WebsiteNavigationItem | undefined;
  if (serviceItem?.children?.length) {
    const nextChildren: WebsiteNavigationItem[] = [];
    serviceItem.children.forEach((child) => {
      if (!extractedImChild && isNavigationMatch(child, ["IM 客服", "im"])) {
        extractedImChild = {
          ...child,
          iconName: child.iconName || "MessageCircle",
          sectionKey: "im",
          href: "/im",
          visible: child.visible !== false,
        };
        return;
      }
      nextChildren.push(child);
    });
    serviceItem.children = nextChildren;
  }

  const contactItem = cloned.find((item) => isNavigationMatch(item, ["联系我们", "contact"]));
  if (contactItem) {
    const contactChildren = [...(contactItem.children || [])];
    if (!contactChildren.some((child) => isNavigationMatch(child, ["IM 客服", "im"]))) {
      contactChildren.push(
        extractedImChild || {
          id: uid("nav"),
          label: "IM 客服",
          iconName: "MessageCircle",
          sectionKey: "im",
          href: "/im",
          visible: true,
        }
      );
    }
    contactItem.children = contactChildren;
  }

  return cloned;
}

function defaultNavigationItemsEnterprise(): WebsiteNavigationItem[] {
  return [
    { id: uid("nav"), label: "首页", href: "#hero", visible: true },
    { id: uid("nav"), label: "产品中心", href: "#products", visible: true },
    { id: uid("nav"), label: "新闻中心", href: "#news", visible: true },
    { id: uid("nav"), label: "工程案例", href: "#cases", visible: true },
    { id: uid("nav"), label: "企业视频", href: "/videos", visible: true },
    {
      id: uid("nav"),
      label: "博客中心",
      href: "#blog",
      visible: true,
      children: [{ id: uid("nav"), label: "IM 客服", href: "#im", visible: true }],
    },
    {
      id: uid("nav"),
      label: "企业资料",
      href: "#company",
      visible: true,
      children: [
        {
          id: uid("nav"),
          label: "公司介绍",
          href: "#company",
          visible: true,
          children: [
            { id: uid("nav"), label: "工厂生产", href: "#factory", visible: true },
            { id: uid("nav"), label: "公司风采", href: "#gallery", visible: true },
          ],
        },
        {
          id: uid("nav"),
          label: "服务保障",
          href: "#service",
          visible: true,
          children: [
            { id: uid("nav"), label: "FAQ", href: "#faq", visible: true },
            { id: uid("nav"), label: "展会活动", href: "#exhibition", visible: true },
            { id: uid("nav"), label: "物流货运", href: "#logistics", visible: true },
          ],
        },
      ],
    },
  ];
}

function defaultNavigationItemsEnterpriseV2(): WebsiteNavigationItem[] {
  return [
    { id: uid("nav"), label: "首页", iconName: "Navigation", sectionKey: "hero", href: "/hero", visible: true },
    { id: uid("nav"), label: "产品中心", iconName: "Package", sectionKey: "products", href: "/products", visible: true },
    { id: uid("nav"), label: "新闻中心", iconName: "Blocks", sectionKey: "news", href: "/news", visible: true },
    { id: uid("nav"), label: "工程案例", iconName: "Calendar", sectionKey: "cases", href: "/cases", visible: true },
    { id: uid("nav"), label: "企业视频", iconName: "Video", sectionKey: "videos", href: "/videos", visible: true },
    {
      id: uid("nav"),
      label: "博客中心",
      iconName: "Globe2",
      sectionKey: "blog",
      href: "/blog",
      visible: true,
      children: [{ id: uid("nav"), label: "IM 客服", iconName: "MessageCircle", sectionKey: "im", href: "/im", visible: true }],
    },
    {
      id: uid("nav"),
      label: "企业资料",
      iconName: "Building2",
      sectionKey: "company",
      href: "/company",
      visible: true,
      children: [
        {
          id: uid("nav"),
          label: "公司介绍",
          iconName: "Building2",
          sectionKey: "company",
          href: "/company",
          visible: true,
          children: [
            { id: uid("nav"), label: "工厂生产", iconName: "Factory", sectionKey: "factory", href: "/factory", visible: true },
            { id: uid("nav"), label: "公司风采", iconName: "Image", sectionKey: "gallery", href: "/gallery", visible: true },
          ],
        },
        {
          id: uid("nav"),
          label: "服务保障",
          iconName: "ShieldCheck",
          sectionKey: "service",
          href: "/service",
          visible: true,
          children: [
            { id: uid("nav"), label: "FAQ", iconName: "HelpCircle", sectionKey: "faq", href: "/faq", visible: true },
            { id: uid("nav"), label: "展会活动", iconName: "Calendar", sectionKey: "exhibition", href: "/exhibition", visible: true },
            { id: uid("nav"), label: "物流货运", iconName: "Truck", sectionKey: "logistics", href: "/logistics", visible: true },
          ],
        },
      ],
    },
  ];
}

function cloneNavigationBranch(item: WebsiteNavigationItem): WebsiteNavigationItem {
  return {
    ...item,
    children: item.children?.map((child) => cloneNavigationBranch(child)),
  };
}

function repairNavigationLabelByPath(item: WebsiteNavigationItem): WebsiteNavigationItem {
  const next: WebsiteNavigationItem = {
    ...item,
    children: item.children?.map((child) => repairNavigationLabelByPath(child)),
  };
  const normalizedHref = normalizeText(next.href, "").split("?")[0].trim().toLowerCase();
  const normalizedSectionKey = normalizeText(next.sectionKey, "").trim().toLowerCase();
  const normalizedLabel = normalizeText(next.label, "").trim();
  const matchedKey = normalizedSectionKey || normalizedHref.replace(/^[/#]+/, "");
  const legacyWrongLabels = new Set(["关于我们", "服务保障", "联系我们"]);

  const expectedLabelMap: Record<string, string> = {
    company: "公司介绍",
    service: "服务保障",
    faq: "FAQ",
    exhibition: "展会活动",
    logistics: "物流货运",
    im: "IM 客服",
  };

  const matchedExpectedLabel =
    expectedLabelMap[matchedKey] ||
    expectedLabelMap[normalizedHref.replace(/^[/#]+/, "")];

  if (matchedExpectedLabel && (normalizedLabel === "" || legacyWrongLabels.has(normalizedLabel))) {
    next.label = matchedExpectedLabel;
  }

  return next;
}

function normalizeNavigationChildrenByParent(item: WebsiteNavigationItem): WebsiteNavigationItem {
  const next: WebsiteNavigationItem = {
    ...item,
    children: item.children?.map((child) => normalizeNavigationChildrenByParent(child)),
  };
  if (!next.children?.length) {
    return next;
  }

  const parentKey = normalizeText(next.sectionKey, "")
    .replace(/^[/#]+/, "")
    .trim()
    .toLowerCase();
  const parentHref = normalizeText(next.href, "")
    .replace(/^[/#]+/, "")
    .split(/[?#]/)[0]
    .trim()
    .toLowerCase();
  const resolvedParentKey = parentKey || parentHref;
  const childExpectedLabelMapByParent: Record<string, Record<string, string>> = {
    company: {
      company: "公司介绍",
      factory: "工厂生产",
      gallery: "公司风采",
    },
    service: {
      faq: "FAQ",
      exhibition: "展会活动",
      logistics: "物流货运",
    },
    contact: {
      im: "IM 客服",
    },
  };

  const childExpectedLabelMap = childExpectedLabelMapByParent[resolvedParentKey];
  if (!childExpectedLabelMap) {
    return next;
  }

  next.children = next.children.map((child) => {
    const childKey = normalizeText(child.sectionKey, "")
      .replace(/^[/#]+/, "")
      .trim()
      .toLowerCase();
    const childHref = normalizeText(child.href, "")
      .replace(/^[/#]+/, "")
      .split(/[?#]/)[0]
      .trim()
      .toLowerCase();
    const resolvedChildKey = childKey || childHref;
    const expectedLabel = childExpectedLabelMap[resolvedChildKey];
    if (!expectedLabel) {
      return child;
    }
    const normalizedChildLabel = normalizeText(child.label, "").trim();
    const duplicateParentLabel =
      normalizedChildLabel !== "" &&
      normalizedChildLabel === normalizeText(next.label, "").trim();
    return duplicateParentLabel || normalizedChildLabel === "" ? { ...child, label: expectedLabel } : child;
  });

  return next;
}

function resolveNavigationItemKey(item: WebsiteNavigationItem | undefined) {
  if (!item) return "";
  const sectionKey = normalizeText(item.sectionKey, "")
    .replace(/^[/#]+/, "")
    .trim()
    .toLowerCase();
  const hrefToken = normalizeText(item.href, "")
    .replace(/^[/#]+/, "")
    .split(/[?#]/)[0]
    .trim()
    .toLowerCase();
  return sectionKey || hrefToken;
}

function collectNavigationDescendants(items?: WebsiteNavigationItem[]): WebsiteNavigationItem[] {
  const result: WebsiteNavigationItem[] = [];
  (items || []).forEach((item) => {
    result.push(cloneNavigationBranch(item));
    if (item.children?.length) {
      result.push(...collectNavigationDescendants(item.children));
    }
  });
  return result;
}

function restoreCanonicalNavigationItemsV2(items: WebsiteNavigationItem[]) {
  const cloned = items.map((item) => cloneNavigationBranch(item));
  const takeTopLevelItem = (targets: string[]) => {
    const index = cloned.findIndex((item) => isNavigationMatch(item, targets));
    if (index < 0) return undefined;
    return cloned.splice(index, 1)[0];
  };
  const insertAfterItem = (targets: string[], item: WebsiteNavigationItem | undefined) => {
    if (!item) return;
    const targetIndex = cloned.findIndex((entry) => isNavigationMatch(entry, targets));
    const insertIndex = targetIndex >= 0 ? targetIndex + 1 : cloned.length;
    cloned.splice(insertIndex, 0, item);
  };

  const aboutTop = takeTopLevelItem(["关于我们", "company"]);
  const serviceTop = takeTopLevelItem(["服务保障", "service"]);
  const contactTop = takeTopLevelItem(["联系我们", "contact"]);
  const enterpriseTop = takeTopLevelItem(["企业资料", "profile"]);
  const blogTop = cloned.find((item) => isNavigationMatch(item, ["博客中心", "blog"]));

  const aboutPool = [
    ...(aboutTop?.children || []),
    ...collectNavigationDescendants(enterpriseTop?.children),
  ];
  const servicePool = [
    ...(serviceTop?.children || []),
    ...collectNavigationDescendants(enterpriseTop?.children),
  ];
  const contactPool = [
    ...(contactTop?.children || []),
    ...collectNavigationDescendants(blogTop?.children),
    ...collectNavigationDescendants(serviceTop?.children),
    ...collectNavigationDescendants(enterpriseTop?.children),
  ];

  const pickFirstMatch = (pool: WebsiteNavigationItem[], targets: string[]) =>
    pool.find((item) => isNavigationMatch(item, targets));
  const pickCustomChildren = (pool: WebsiteNavigationItem[], reservedKeys: Set<string>) =>
    pool.filter((item) => {
      const key = resolveNavigationItemKey(item);
      return key && !reservedKeys.has(key);
    });

  const aboutReservedKeys = new Set(["company", "factory", "gallery", "service", "faq", "exhibition", "logistics", "im"]);
  const serviceReservedKeys = new Set(["company", "factory", "gallery", "service", "faq", "exhibition", "logistics", "im"]);
  const contactReservedKeys = new Set(["company", "factory", "gallery", "service", "faq", "exhibition", "logistics", "im"]);

  const aboutChildren = [
    {
      fallback: { id: uid("nav"), label: "公司介绍", iconName: "Building2", sectionKey: "company", href: "/company", visible: true },
      found: pickFirstMatch(aboutPool, ["公司介绍", "company"]),
    },
    {
      fallback: { id: uid("nav"), label: "工厂生产", iconName: "Factory", sectionKey: "factory", href: "/factory", visible: true },
      found: pickFirstMatch(aboutPool, ["工厂生产", "factory"]),
    },
    {
      fallback: { id: uid("nav"), label: "公司风采", iconName: "Image", sectionKey: "gallery", href: "/gallery", visible: true },
      found: pickFirstMatch(aboutPool, ["公司风采", "gallery"]),
    },
  ].map(({ found, fallback }) => ({
    ...fallback,
    ...(found ? cloneNavigationBranch(found) : {}),
    label: fallback.label,
    iconName: found?.iconName || fallback.iconName,
    sectionKey: fallback.sectionKey,
    href: fallback.href,
    children: undefined,
    visible: found?.visible ?? fallback.visible,
  }));

  const serviceChildren = [
    {
      fallback: { id: uid("nav"), label: "FAQ", iconName: "HelpCircle", sectionKey: "faq", href: "/faq", visible: true },
      found: pickFirstMatch(servicePool, ["FAQ", "faq"]),
    },
    {
      fallback: { id: uid("nav"), label: "展会活动", iconName: "Calendar", sectionKey: "exhibition", href: "/exhibition", visible: true },
      found: pickFirstMatch(servicePool, ["展会活动", "exhibition"]),
    },
    {
      fallback: { id: uid("nav"), label: "物流货运", iconName: "Truck", sectionKey: "logistics", href: "/logistics", visible: true },
      found: pickFirstMatch(servicePool, ["物流货运", "logistics"]),
    },
  ].map(({ found, fallback }) => ({
    ...fallback,
    ...(found ? cloneNavigationBranch(found) : {}),
    label: fallback.label,
    iconName: found?.iconName || fallback.iconName,
    sectionKey: fallback.sectionKey,
    href: fallback.href,
    children: undefined,
    visible: found?.visible ?? fallback.visible,
  }));

  const contactChildren = [
    {
      fallback: { id: uid("nav"), label: "IM 客服", iconName: "MessageCircle", sectionKey: "im", href: "/im", visible: true },
      found: pickFirstMatch(contactPool, ["IM 客服", "im"]),
    },
  ].map(({ found, fallback }) => ({
    ...fallback,
    ...(found ? cloneNavigationBranch(found) : {}),
    label: fallback.label,
    iconName: found?.iconName || fallback.iconName,
    sectionKey: fallback.sectionKey,
    href: fallback.href,
    children: undefined,
    visible: found?.visible ?? fallback.visible,
  }));

  const aboutItem: WebsiteNavigationItem = {
    ...(aboutTop ? cloneNavigationBranch(aboutTop) : { id: uid("nav"), iconName: "Building2", visible: true }),
    label: "关于我们",
    iconName: aboutTop?.iconName || "Building2",
    sectionKey: "company",
    href: "/company",
    visible: aboutTop?.visible !== false,
    children: [...aboutChildren, ...pickCustomChildren(aboutPool, aboutReservedKeys).map((item) => ({ ...cloneNavigationBranch(item), children: undefined }))],
  };

  const serviceItem: WebsiteNavigationItem = {
    ...(serviceTop ? cloneNavigationBranch(serviceTop) : { id: uid("nav"), iconName: "ShieldCheck", visible: true }),
    label: "服务保障",
    iconName: serviceTop?.iconName || "ShieldCheck",
    sectionKey: "service",
    href: "/service",
    visible: serviceTop?.visible !== false,
    children: [...serviceChildren, ...pickCustomChildren(servicePool, serviceReservedKeys).map((item) => ({ ...cloneNavigationBranch(item), children: undefined }))],
  };

  const contactItem: WebsiteNavigationItem = {
    ...(contactTop ? cloneNavigationBranch(contactTop) : { id: uid("nav"), iconName: "MessageCircle", visible: true }),
    label: "联系我们",
    iconName: contactTop?.iconName || "MessageCircle",
    sectionKey: "contact",
    href: "/contact",
    visible: contactTop?.visible !== false,
    children: [...contactChildren, ...pickCustomChildren(contactPool, contactReservedKeys).map((item) => ({ ...cloneNavigationBranch(item), children: undefined }))],
  };

  if (blogTop?.children?.length) {
    blogTop.children = blogTop.children.filter((child) => !isNavigationMatch(child, ["IM 客服", "im"]));
    if (!blogTop.children.length) {
      blogTop.children = undefined;
    }
  }

  insertAfterItem(["博客中心", "blog"], aboutItem);
  insertAfterItem(["关于我们", "company"], serviceItem);
  insertAfterItem(["服务保障", "service"], contactItem);

  return cloned;
}

function migrateNavigationItemsEnterpriseV2(items: WebsiteNavigationItem[]) {
  const cloned = items.map((item) => cloneNavigationBranch(item));
  const takeTopLevelItem = (targets: string[]) => {
    const index = cloned.findIndex((item) => isNavigationMatch(item, targets));
    if (index < 0) return undefined;
    return cloned.splice(index, 1)[0];
  };

  const aboutItem = takeTopLevelItem(["关于我们", "company"]);
  const serviceItem = takeTopLevelItem(["服务保障", "service"]);
  const contactItem = takeTopLevelItem(["联系我们", "contact"]);
  const blogItem =
    cloned.find((item) => isNavigationMatch(item, ["博客中心", "blog"])) ||
    (() => {
      const created: WebsiteNavigationItem = {
        id: uid("nav"),
        label: "博客中心",
        iconName: "Globe2",
        sectionKey: "blog",
        href: "/blog",
        visible: true,
        children: [],
      };
      const insertIndex = cloned.findIndex((item) => isNavigationMatch(item, ["企业视频", "videos"]));
      if (insertIndex >= 0) cloned.splice(insertIndex + 1, 0, created);
      else cloned.push(created);
      return created;
    })();
  const enterpriseItem =
    cloned.find((item) => isNavigationMatch(item, ["企业资料", "profile"])) ||
    (() => {
      const created: WebsiteNavigationItem = {
        id: uid("nav"),
        label: "企业资料",
        iconName: "Building2",
        sectionKey: "company",
        href: "/company",
        visible: true,
        children: [],
      };
      const insertIndex = cloned.findIndex((item) => isNavigationMatch(item, ["博客中心", "blog"]));
      if (insertIndex >= 0) cloned.splice(insertIndex + 1, 0, created);
      else cloned.push(created);
      return created;
    })();

  const aboutSelfChild = aboutItem?.children?.find((child) => isNavigationMatch(child, ["公司介绍", "company"]));
  const companyChild: WebsiteNavigationItem =
    enterpriseItem.children?.find((child) => isNavigationMatch(child, ["公司介绍", "company"])) || {
      id: uid("nav"),
      label: "公司介绍",
      iconName: "Building2",
      sectionKey: "company",
      href: "/company",
      visible: true,
      children: [],
    };
  companyChild.iconName = aboutSelfChild?.iconName || aboutItem?.iconName || companyChild.iconName;
  companyChild.sectionKey = aboutSelfChild?.sectionKey || aboutItem?.sectionKey || companyChild.sectionKey;
  companyChild.href = aboutSelfChild?.href || aboutItem?.href || companyChild.href;
  companyChild.visible = (aboutSelfChild?.visible ?? aboutItem?.visible ?? companyChild.visible) !== false;
  const companyNestedChildren = [
    ...(aboutSelfChild?.children || []),
    ...((aboutItem?.children || []).filter((child) => !isNavigationMatch(child, ["公司介绍", "company"])) || []),
  ];
  if (companyNestedChildren.length) {
    companyChild.children = companyNestedChildren.map((child) => cloneNavigationBranch(child));
  }

  const serviceChild: WebsiteNavigationItem =
    enterpriseItem.children?.find((child) => isNavigationMatch(child, ["服务保障", "service"])) || {
      id: uid("nav"),
      label: "服务保障",
      iconName: "ShieldCheck",
      sectionKey: "service",
      href: "/service",
      visible: true,
      children: [],
    };
  serviceChild.iconName = serviceItem?.iconName || serviceChild.iconName;
  serviceChild.sectionKey = serviceItem?.sectionKey || serviceChild.sectionKey;
  serviceChild.href = serviceItem?.href || serviceChild.href;
  serviceChild.visible = (serviceItem?.visible ?? serviceChild.visible) !== false;
  if (serviceItem?.children?.length) {
    serviceChild.children = serviceItem.children
      .filter((child) => !isNavigationMatch(child, ["IM 客服", "im"]))
      .map((child) => cloneNavigationBranch(child));
  }

  const legacyImChild =
    contactItem?.children?.find((child) => isNavigationMatch(child, ["IM 客服", "im"])) ||
    serviceItem?.children?.find((child) => isNavigationMatch(child, ["IM 客服", "im"]));
  const imChild: WebsiteNavigationItem =
    blogItem.children?.find((child) => isNavigationMatch(child, ["IM 客服", "im"])) || {
      id: uid("nav"),
      label: "IM 客服",
      iconName: "MessageCircle",
      sectionKey: "im",
      href: "/im",
      visible: true,
    };
  imChild.iconName = legacyImChild?.iconName || imChild.iconName;
  imChild.sectionKey = legacyImChild?.sectionKey || imChild.sectionKey;
  imChild.href = legacyImChild?.href || imChild.href;
  imChild.visible = (legacyImChild?.visible ?? imChild.visible) !== false;

  enterpriseItem.children = [
    companyChild,
    serviceChild,
    ...(enterpriseItem.children || []).filter((child) => !isNavigationMatch(child, ["公司介绍", "company", "服务保障", "service"])),
  ];
  blogItem.children = [
    ...(blogItem.children || []).filter((child) => !isNavigationMatch(child, ["IM 客服", "im"])),
    imChild,
  ];

  return cloned;
}

function restoreClassicNavigationItemsV2(items: WebsiteNavigationItem[]) {
  const cloned = items.map((item) => cloneNavigationBranch(item));
  const takeTopLevelItem = (targets: string[]) => {
    const index = cloned.findIndex((item) => isNavigationMatch(item, targets));
    if (index < 0) return undefined;
    return cloned.splice(index, 1)[0];
  };

  const aboutItem = takeTopLevelItem(["关于我们", "company"]);
  const serviceItem = takeTopLevelItem(["服务保障", "service"]);
  const contactItem = takeTopLevelItem(["联系我们", "contact"]);
  const enterpriseItem = takeTopLevelItem(["企业资料", "profile"]);
  const blogItem = cloned.find((item) => isNavigationMatch(item, ["博客中心", "blog"]));
  const nestedCompanyItem = enterpriseItem?.children?.find((child) => isNavigationMatch(child, ["公司介绍", "company"]));
  const nestedServiceItem = enterpriseItem?.children?.find((child) => isNavigationMatch(child, ["服务保障", "service"]));
  const nestedImItem = blogItem?.children?.find((child) => isNavigationMatch(child, ["IM 客服", "im"]));

  if (blogItem?.children?.length) {
    blogItem.children = blogItem.children.filter((child) => !isNavigationMatch(child, ["IM 客服", "im"]));
    if (!blogItem.children.length) blogItem.children = undefined;
  }

  const flattenChildren = (children?: WebsiteNavigationItem[]) =>
    (children || []).map((child) => ({ ...cloneNavigationBranch(child), children: undefined }));

  const nextAboutItem =
    aboutItem ||
    (nestedCompanyItem
      ? {
          id: uid("nav"),
          label: "关于我们",
          iconName: "Building2",
          sectionKey: "company",
          href: "/company",
          visible: nestedCompanyItem.visible !== false,
          children: [],
        }
      : undefined);
  if (nextAboutItem) {
    nextAboutItem.children =
      aboutItem?.children?.length
        ? flattenChildren(aboutItem.children)
        : nestedCompanyItem
          ? [
              { ...cloneNavigationBranch(nestedCompanyItem), label: "公司介绍", children: undefined },
              ...flattenChildren(nestedCompanyItem.children),
            ]
          : nextAboutItem.children;
  }

  const nextServiceItem =
    serviceItem ||
    (nestedServiceItem
      ? {
          id: uid("nav"),
          label: "服务保障",
          iconName: "ShieldCheck",
          sectionKey: "service",
          href: "/service",
          visible: nestedServiceItem.visible !== false,
          children: [],
        }
      : undefined);
  if (nextServiceItem) {
    nextServiceItem.children =
      serviceItem?.children?.length
        ? flattenChildren(serviceItem.children)
        : nestedServiceItem
          ? flattenChildren(nestedServiceItem.children)
          : nextServiceItem.children;
  }

  const classicImChild =
    contactItem?.children?.find((child) => isNavigationMatch(child, ["IM 客服", "im"])) || nestedImItem;
  const nextContactItem =
    contactItem ||
    (classicImChild
      ? {
          id: uid("nav"),
          label: "联系我们",
          iconName: "MessageCircle",
          sectionKey: "contact",
          href: "/contact",
          visible: classicImChild.visible !== false,
          children: [],
        }
      : undefined);
  if (nextContactItem && classicImChild) {
    nextContactItem.children = [{ ...cloneNavigationBranch(classicImChild), children: undefined }];
  }

  const insertAfterBlog = (item: WebsiteNavigationItem | undefined) => {
    if (!item) return;
    const blogIndex = cloned.findIndex((entry) => isNavigationMatch(entry, ["博客中心", "blog"]));
    const insertIndex = blogIndex >= 0 ? blogIndex + 1 : cloned.length;
    cloned.splice(insertIndex, 0, item);
  };

  insertAfterBlog(nextContactItem);
  insertAfterBlog(nextServiceItem);
  insertAfterBlog(nextAboutItem);

  return cloned;
}

function normalizeNavigationItemsV2(items?: WebsiteNavigationItem[], level = 0): WebsiteNavigationItem[] {
  if (!Array.isArray(items) || !items.length) {
    return defaultNavigationItemsV2();
  }

  const fallbackKey = level === 0 ? "hero" : level === 1 ? "section" : "detail";
  const normalizedItems = items.map((item) => {
    const rawSectionKey = normalizeText(item.sectionKey, "").replace(/^[/#]+/, "");
    const rawHref = normalizeText(item.href, "");
    const hrefToken = rawHref.replace(/^[/#]+/, "").split(/[?#]/)[0].trim();
    const sectionKey = rawSectionKey || hrefToken || fallbackKey;
    const rawLabels = item.labels && typeof item.labels === "object" ? item.labels : {};
    return {
      id: item.id || uid("nav"),
      labels: {
        ...Object.fromEntries(Object.entries(rawLabels).filter(([, value]) => typeof value === "string" && value.trim())),
        zh: normalizeText(rawLabels.zh, normalizeText(item.label, "")),
        en: normalizeText(rawLabels.en, NAVIGATION_ENGLISH_LABELS[sectionKey] || normalizeText(item.label, "")),
      },
      label: normalizeText(item.label, "新导航"),
      iconName: normalizeText(item.iconName, "Navigation"),
      customIconUrl: normalizeText(item.customIconUrl, ""),
      customIconAssetId: normalizeText(item.customIconAssetId, ""),
      sectionKey,
      href: rawHref ? (rawHref.startsWith("#") ? `/${hrefToken || sectionKey}` : rawHref) : `/${sectionKey}`,
      visible: item.visible !== false,
      generatedFrom: normalizeText(item.generatedFrom),
      children: item.children?.length ? normalizeNavigationItemsV2(item.children, level + 1) : undefined,
    };
  });

  return level === 0
    ? sortWebsiteNavigationItems(restoreCanonicalNavigationItemsV2(migrateNavigationItemsV2(restoreClassicNavigationItemsV2(normalizedItems))).map((item) =>
        normalizeNavigationChildrenByParent(repairNavigationLabelByPath(item))
      ))
    : normalizedItems.map((item) => normalizeNavigationChildrenByParent(repairNavigationLabelByPath(item)));
}

function createDefaultProfile(): WebsiteProfileState {
  return {
    companyName: "Machina Global Equipment Co., Ltd.",
    companyEnglishName: "Machina Global Equipment Co., Ltd.",
    logoUrl: "",
    logoAlt: "Machina Global logo",
    faviconUrl: "",
    homepageTitle: "Machina Global Equipment Co., Ltd.",
    contactPerson: "Sophia Zhang",
    phone: "+86 755-8888-6666",
    fax: "+86 755-8888-6667",
    email: "sales@machinaglobal.com",
    officeAddress: "Nanshan Technology Park, Shenzhen, Guangdong, China",
    factoryAddress: "Export Industrial Park, Suzhou, Jiangsu, China",
    registeredAddress: "Shenzhen, Guangdong, China",
    businessType: "Manufacturer / Exporter / Solution Provider",
    mainMarkets: "North America, Europe, Southeast Asia, Middle East, South America",
    brandName: "Machina Global",
    brandType: "自有品牌",
    employees: "200-500",
    annualSales: "USD 5,000,000 - 10,000,000",
    foundedYear: "2015",
    website: "www.machinaglobal.com",
    footerCopyright: "© 2026 Machina Global Equipment Co., Ltd. All Rights Reserved.",
    contactName: "Sophia Zhang",
    region: "Shenzhen, China",
    markets: "North America, Europe, Southeast Asia, Middle East, South America",
    brands: "Machina Global",
    revenue: "USD 5,000,000 - 10,000,000",
  };
}

function createBannerItem(overrides?: Partial<WebsiteBannerItem>): WebsiteBannerItem {
  return {
    id: uid("banner"),
    title: "首页主横幅",
    linkUrl: "#contact",
    summary: "支持多语言展示、工厂实力表达与询盘转化。",
    images: ["https://images.unsplash.com/photo-1565008447742-97f6f38c985c?auto=format&fit=crop&w=1600&q=80"],
    pinned: true,
    enabled: true,
    translationStatus: "translated",
    showTextOverlay: true,
    mobileOnly: false,
    sortOrder: 100,
    ...overrides,
  };
}

function seedHomepageBanners(items: WebsiteBannerItem[], seedVersion?: number) {
  if (
    seedVersion === HOMEPAGE_BANNER_SEED_VERSION ||
    items.length !== 1 ||
    items[0]?.title !== HOMEPAGE_BANNER_STARTER_TITLE
  ) {
    return { items, seedVersion };
  }

  const [starter] = items;
  return {
    items: [
      starter,
      ...Array.from({ length: 9 }, (_, index) =>
        createBannerItem({
          ...starter,
          id: uid("banner"),
          title: `${starter.title} · Banner ${index + 2}`,
          pinned: false,
          sortOrder: Math.max(1, (starter.sortOrder || 100) - index - 1),
        })
      ),
    ],
    seedVersion: HOMEPAGE_BANNER_SEED_VERSION,
  };
}

function createSectionEntry(title: string, overrides?: Partial<WebsiteSectionEntry>): WebsiteSectionEntry {
  return {
    id: uid("section"),
    title,
    linkUrl: "",
    summary: "",
    images: [],
    content: "",
    pinned: false,
    enabled: true,
    translationStatus: "none",
    sortOrder: null,
    ...overrides,
  };
}

function createContentLibraryItem(title: string, overrides?: Partial<WebsiteContentLibraryItem>): WebsiteContentLibraryItem {
  return {
    ...createSectionEntry(title),
    id: uid("content"),
    categoryId: "",
    publishedAt: new Date().toISOString().slice(0, 10),
    metaTitle: "",
    metaDescription: "",
    keywords: "",
    videoUrl: "",
    ...overrides,
  };
}

function createContentLibraryCategory(name: string, overrides?: Partial<WebsiteContentLibraryCategory>): WebsiteContentLibraryCategory {
  return {
    id: uid("content_category"),
    name,
    parentId: null,
    enabled: true,
    sortOrder: null,
    ...overrides,
  };
}

function createContentLibrary(items: WebsiteContentLibraryItem[], categories: WebsiteContentLibraryCategory[]): WebsiteContentLibrary {
  return { items, categories };
}

function createFaqItem(overrides?: Partial<WebsiteFaqItem>): WebsiteFaqItem {
  return {
    id: uid("faq"),
    question: "",
    linkName: "",
    summary: "",
    answer: "",
    pinned: false,
    enabled: true,
    translationStatus: "none",
    sortOrder: null,
    ...overrides,
  };
}

function createImChannel(overrides?: Partial<WebsiteImChannel>): WebsiteImChannel {
  return {
    id: uid("im"),
    platform: "WhatsApp",
    account: "",
    linkUrl: "",
    enabled: true,
    sortOrder: null,
    ...overrides,
  };
}

function createSocialLink(overrides?: Partial<WebsiteSocialLink>): WebsiteSocialLink {
  return {
    id: uid("sns"),
    platform: "LinkedIn",
    url: "",
    enabled: true,
    sortOrder: null,
    ...overrides,
  };
}

export const defaultWebsiteContentState: WebsiteContentState = {
  profile: createDefaultProfile(),
  navigation: {
    enabled: true,
    items: defaultNavigationItemsV2(),
    ctaLabel: "联系我们",
    ctaHref: "#contact",
  },
  banner: {
    items: [
      createBannerItem({
        title: "Build a multilingual machinery website that converts buyers",
        summary: "Responsive editing, multilingual switching, plugin modules, and direct publishing.",
      }),
    ],
  },
  recommend: {
    note: "产品推荐以产品管理里的已启用、已排序内容为准。",
  },
  contentLibrary: {
    news: createContentLibrary(
      [createContentLibraryItem("Factory expansion completed", { summary: "New production capacity and quality inspection lines are now in service.", content: "Share production capacity, delivery impact and buyer-facing evidence.", categoryId: "news_category_1", pinned: true, translationStatus: "translated", sortOrder: 100 })],
      [createContentLibraryCategory("新闻分类名称1", { id: "news_category_1", labels: { zh: "新闻分类名称1", en: "News Category 1" }, sortOrder: 100 }), createContentLibraryCategory("新闻分类名称2", { id: "news_category_2", labels: { zh: "新闻分类名称2", en: "News Category 2" }, sortOrder: 90 })]
    ),
    cases: createContentLibrary(
      [createContentLibraryItem("Automation line delivered for overseas buyer", { summary: "A documented reference case from requirements through commissioning.", content: "Capture application, market, specification, result and buyer proof.", categoryId: "cases_category_1", pinned: true, translationStatus: "translated", sortOrder: 100 })],
      [createContentLibraryCategory("案例分类名称1", { id: "cases_category_1", labels: { zh: "案例分类名称1", en: "Case Category 1" }, sortOrder: 100 }), createContentLibraryCategory("案例分类名称2", { id: "cases_category_2", labels: { zh: "案例分类名称2", en: "Case Category 2" }, sortOrder: 90 })]
    ),
    videos: createContentLibrary(
      [createContentLibraryItem("Factory capability overview", { summary: "Show factory, inspection and export packing in a concise buyer video.", content: "Use the video URL for YouTube, Vimeo, CDN or a local media page.", categoryId: "videos_category_1", pinned: true, translationStatus: "translated", sortOrder: 100 })],
      [createContentLibraryCategory("视频分类名称1", { id: "videos_category_1", labels: { zh: "视频分类名称1", en: "Video Category 1" }, sortOrder: 100 }), createContentLibraryCategory("视频分类名称2", { id: "videos_category_2", labels: { zh: "视频分类名称2", en: "Video Category 2" }, sortOrder: 90 })]
    ),
    blog: createContentLibrary(
      [createContentLibraryItem("How to prepare a technical B2B inquiry", { summary: "A buyer guide that captures the information needed for a faster quotation.", content: "Use answer-first content, specifications, source proof and a clear inquiry CTA.", categoryId: "blog_category_1", pinned: true, translationStatus: "translated", sortOrder: 100, keywords: "B2B inquiry, technical specification, OEM" })],
      [createContentLibraryCategory("博客分类名称1", { id: "blog_category_1", labels: { zh: "博客分类名称1", en: "Blog Category 1" }, sortOrder: 100 }), createContentLibraryCategory("博客分类名称2", { id: "blog_category_2", labels: { zh: "博客分类名称2", en: "Blog Category 2" }, sortOrder: 90 })]
    ),
  },
  sections: {
    about: [
      createSectionEntry("公司介绍", {
        summary: "帮助海外买家快速理解企业定位、主营能力和交付实力。",
        images: ["https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=1200&q=80"],
        content:
          "Machina Global is a manufacturing company focused on industrial machinery, automation lines, and B2B export website solutions.",
        pinned: true,
        translationStatus: "translated",
        sortOrder: 100,
      }),
    ],
    factory: [
      createSectionEntry("工厂生产", {
        summary: "展示生产线、质量控制和产能配置。",
        images: ["https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1200&q=80"],
        content: "Integrated CNC machining, assembly, quality inspection, and packaging workflows.",
        translationStatus: "translated",
        sortOrder: 90,
      }),
    ],
    gallery: [
      createSectionEntry("公司风采", {
        summary: "办公室、车间、展厅与团队展示。",
        images: ["https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80"],
        content: "Showroom, workshop, warehouse, and team profile.",
        translationStatus: "translated",
        sortOrder: 80,
      }),
    ],
    exhibition: [
      createSectionEntry("展会活动", {
        summary: "方便买家查看展会安排和约见信息。",
        content: "Hannover Messe / Canton Fair / buyer appointment support.",
        translationStatus: "partial",
        sortOrder: 70,
      }),
    ],
    service: [
      createSectionEntry("服务保障", {
        summary: "售前咨询、投产支持、备件支持与长期维护。",
        content: "Pre-sales consulting, commissioning support, spare parts, and long-term service.",
        translationStatus: "translated",
        sortOrder: 60,
      }),
    ],
    logistics: [
      createSectionEntry("物流货运", {
        summary: "海运、空运、铁路和快递方案说明。",
        content: "Support sea, air, rail, and express delivery according to destination and timeline.",
        translationStatus: "translated",
        sortOrder: 50,
      }),
    ],
    modules: [
      createSectionEntry("自定义模块", {
        summary: "可继续扩展品牌故事、认证资质、下载中心等页面。",
        content: "Custom module area.",
        translationStatus: "none",
      }),
    ],
  },
  faq: [
    createFaqItem({
      question: "Do you support OEM / ODM and multilingual branding?",
      summary: "品牌与多语言支持",
      answer: "Yes. Product labels, packaging, website copy, and language assets can all be customized.",
      pinned: true,
      enabled: true,
      translationStatus: "translated",
      sortOrder: 100,
    }),
    createFaqItem({
      question: "What is the normal delivery lead time?",
      summary: "交付周期",
      answer: "Samples usually take 3-7 days, and production orders usually take 15-35 days depending on complexity.",
      enabled: true,
      translationStatus: "translated",
      sortOrder: 90,
    }),
  ],
  im: {
    channels: [
      createImChannel({
        platform: "WhatsApp",
        account: "+86 188-0000-5566",
        linkUrl: "https://wa.me/8618800005566",
        sortOrder: 100,
      }),
      createImChannel({
        platform: "Telegram",
        account: "@machina_global",
        linkUrl: "https://t.me/machina_global",
        sortOrder: 90,
      }),
    ],
    onlineHours: "Mon-Sat 09:00 - 20:00 (UTC+8)",
    autoReply: "Hello, thank you for contacting Machina Global. Our consultant will follow up with you as soon as possible.",
    showFloatingWidget: true,
  },
  social: {
    links: [
      createSocialLink({ platform: "LinkedIn", url: "https://linkedin.com", sortOrder: 100 }),
      createSocialLink({ platform: "YouTube", url: "https://youtube.com", sortOrder: 90 }),
      createSocialLink({ platform: "Facebook", url: "https://facebook.com", sortOrder: 80 }),
    ],
  },
};

function normalizeNavigationItems(items?: WebsiteNavigationItem[], level = 0): WebsiteNavigationItem[] {
  if (!Array.isArray(items) || !items.length) {
    return defaultNavigationItems();
  }

  return items.map((item) => ({
    id: item.id || uid("nav"),
    label: normalizeText(item.label, "新导航"),
    href: normalizeText(item.href, "#contact"),
    visible: item.visible !== false,
    children:
      level === 0 && item.children?.length
        ? normalizeNavigationItems(item.children, level + 1).map((child) => ({ ...child, children: undefined }))
        : undefined,
  }));
}

function normalizeProfile(profile?: Partial<WebsiteProfileState> | null): WebsiteProfileState {
  const fallback = createDefaultProfile();
  const companyName = normalizeText(profile?.companyName, fallback.companyName);
  const contactPerson = normalizeText(profile?.contactPerson || profile?.contactName, fallback.contactPerson);
  const officeAddress = normalizeText(profile?.officeAddress, fallback.officeAddress);
  const factoryAddress = normalizeText(profile?.factoryAddress, fallback.factoryAddress);
  const mainMarkets = normalizeText(profile?.mainMarkets || profile?.markets, fallback.mainMarkets);
  const brandName = normalizeText(profile?.brandName || profile?.brands, fallback.brandName);
  const annualSales = normalizeText(profile?.annualSales || profile?.revenue, fallback.annualSales);

  return {
    ...fallback,
    ...profile,
    companyName,
    companyEnglishName: normalizeText(profile?.companyEnglishName, companyName),
    logoUrl: normalizeText(profile?.logoUrl),
    logoAlt: normalizeText(profile?.logoAlt, `${companyName} logo`),
    faviconUrl: normalizeText(profile?.faviconUrl),
    homepageTitle: normalizeText(profile?.homepageTitle, companyName),
    contactPerson,
    phone: normalizeText(profile?.phone, fallback.phone),
    fax: normalizeText(profile?.fax),
    email: normalizeText(profile?.email, fallback.email),
    officeAddress,
    factoryAddress,
    registeredAddress: normalizeText(profile?.registeredAddress || profile?.region, officeAddress),
    businessType: normalizeText(profile?.businessType, fallback.businessType),
    mainMarkets,
    brandName,
    brandType: normalizeText(profile?.brandType, "自有品牌"),
    employees: normalizeText(profile?.employees),
    annualSales,
    foundedYear: normalizeText(profile?.foundedYear),
    website: normalizeText(profile?.website),
    footerCopyright: normalizeText(profile?.footerCopyright, fallback.footerCopyright),
    contactName: contactPerson,
    region: normalizeText(profile?.region || profile?.registeredAddress, officeAddress),
    markets: mainMarkets,
    brands: brandName,
    revenue: annualSales,
  };
}

function normalizeBannerItem(item?: Partial<WebsiteBannerItem> | null): WebsiteBannerItem {
  return {
    ...createBannerItem(),
    ...item,
    id: item?.id || uid("banner"),
    title: normalizeText(item?.title, "首页横幅"),
    linkUrl: normalizeText(item?.linkUrl, "#contact"),
    summary: normalizeText(item?.summary),
    images: Array.isArray(item?.images) ? item!.images.map((image) => normalizeText(image)).filter(Boolean) : [],
    pinned: item?.pinned === true,
    enabled: item?.enabled !== false,
    translationStatus: item?.translationStatus || "none",
    showTextOverlay: item?.showTextOverlay !== false,
    mobileOnly: item?.mobileOnly === true,
    sortOrder: typeof item?.sortOrder === "number" ? item.sortOrder : null,
  };
}

function normalizeSectionEntry(item?: Partial<WebsiteSectionEntry> | null, fallbackTitle = "内容模块"): WebsiteSectionEntry {
  return {
    ...createSectionEntry(fallbackTitle),
    ...item,
    id: item?.id || uid("section"),
    title: normalizeText(item?.title, fallbackTitle),
    linkUrl: normalizeText(item?.linkUrl),
    summary: normalizeText(item?.summary),
    images: Array.isArray(item?.images) ? item!.images.map((image) => normalizeText(image)).filter(Boolean) : [],
    content: normalizeText(item?.content),
    pinned: item?.pinned === true,
    enabled: item?.enabled !== false,
    translationStatus: item?.translationStatus || "none",
    sortOrder: typeof item?.sortOrder === "number" ? item.sortOrder : null,
  };
}

function normalizeContentLibraryItem(item?: Partial<WebsiteContentLibraryItem> | null, fallbackTitle = "Untitled content"): WebsiteContentLibraryItem {
  const base = normalizeSectionEntry(item, fallbackTitle);
  return {
    ...base,
    categoryId: normalizeText(item?.categoryId),
    publishedAt: normalizeText(item?.publishedAt, new Date().toISOString().slice(0, 10)),
    metaTitle: normalizeText(item?.metaTitle),
    metaDescription: normalizeText(item?.metaDescription),
    keywords: normalizeText(item?.keywords),
    videoUrl: normalizeText(item?.videoUrl),
  };
}

function normalizeContentLibraryCategory(item?: Partial<WebsiteContentLibraryCategory> | null): WebsiteContentLibraryCategory {
  const rawLabels = item?.labels && typeof item.labels === "object" ? item.labels : {};
  const name = normalizeText(item?.name, "Uncategorized");
  return {
    id: item?.id || uid("content_category"),
    name,
    labels: {
      ...Object.fromEntries(Object.entries(rawLabels).filter(([, value]) => typeof value === "string" && value.trim())),
      zh: normalizeText(rawLabels.zh, name),
      en: normalizeText(rawLabels.en, name),
    },
    parentId: typeof item?.parentId === "string" && item.parentId.trim() ? item.parentId.trim() : null,
    enabled: item?.enabled !== false,
    sortOrder: typeof item?.sortOrder === "number" ? item.sortOrder : null,
  };
}

const CONTENT_NAVIGATION_SOURCES: Record<WebsiteContentLibraryKey, { sectionKey: string; iconName: string }> = {
  news: { sectionKey: "news", iconName: "Blocks" },
  cases: { sectionKey: "cases", iconName: "Calendar" },
  videos: { sectionKey: "videos", iconName: "Video" },
  blog: { sectionKey: "blog", iconName: "Globe2" },
};

/**
 * Materializes first-level content categories as second-level website navigation.
 * The category editor is authoritative; manual navigation children are retained.
 */
export function syncContentCategoryNavigation(state: WebsiteContentState): WebsiteContentState {
  const syncNavigationItem = (parent: WebsiteNavigationItem): WebsiteNavigationItem => {
    const children = parent.children?.map(syncNavigationItem);
    if (parent.sectionKey === "products") {
      const productGenerated = (children || []).filter((child) => child.generatedFrom === "content-category:products");
      const manualChildren = (children || []).filter((child) => child.generatedFrom !== "content-category:products");
      if (!productGenerated.length && !manualChildren.length) {
        return {
          ...parent,
          children: [
            { id: "nav_products_category_1", label: "产品分类名称1", labels: { zh: "产品分类名称1", en: "Product Category 1" }, iconName: "Package", sectionKey: "products-category-1", href: "/products?category=product-category-1", visible: true, generatedFrom: "content-category:products" },
            { id: "nav_products_category_2", label: "产品分类名称2", labels: { zh: "产品分类名称2", en: "Product Category 2" }, iconName: "Package", sectionKey: "products-category-2", href: "/products?category=product-category-2", visible: true, generatedFrom: "content-category:products" },
          ],
        };
      }
      return { ...parent, children };
    }
    const source = (Object.keys(CONTENT_NAVIGATION_SOURCES) as WebsiteContentLibraryKey[])
      .find((key) => CONTENT_NAVIGATION_SOURCES[key].sectionKey === parent.sectionKey);
    if (!source) return children ? { ...parent, children } : parent;
    const sourceKey = `content-category:${source}`;
    const generated = state.contentLibrary[source].categories
      .filter((category) => !category.parentId && category.enabled !== false)
      .sort((left, right) => (right.sortOrder || 0) - (left.sortOrder || 0))
      .map((category) => ({
        id: `nav_category_${source}_${category.id}`,
        label: category.labels?.zh || category.name,
        labels: {
          zh: category.labels?.zh || category.name,
          en: category.labels?.en || category.name,
        },
        iconName: CONTENT_NAVIGATION_SOURCES[source].iconName,
        sectionKey: `${source}-category-${category.id}`,
        href: `/${source}?category=${encodeURIComponent(category.id)}`,
        visible: true,
        generatedFrom: sourceKey,
      }));
    const manualChildren = (children || []).filter((child) => child.generatedFrom !== sourceKey);
    return { ...parent, children: generated.length || manualChildren.length ? [...generated, ...manualChildren] : undefined };
  };
  const navigation = state.navigation.items.map(syncNavigationItem);
  return { ...state, navigation: { ...state.navigation, items: navigation } };
}

function normalizeContentLibrary(library: Partial<WebsiteContentLibrary> | undefined, fallback: WebsiteContentLibrary): WebsiteContentLibrary {
  const categories = Array.isArray(library?.categories) && library.categories.length
    ? sortByPriority(library.categories.map((item) => normalizeContentLibraryCategory(item)))
    : fallback.categories.map((item) => normalizeContentLibraryCategory(item));
  const items = Array.isArray(library?.items) && library.items.length
    ? sortByPriority(library.items.map((item) => normalizeContentLibraryItem(item)))
    : fallback.items.map((item) => normalizeContentLibraryItem(item));
  return { categories, items };
}

function normalizeFaqItem(item?: Partial<WebsiteFaqItem> | null): WebsiteFaqItem {
  const normalized = createFaqItem(item);
  return {
    ...normalized,
    id: item?.id || uid("faq"),
    question: normalizeText(item?.question),
    linkName: normalizeText(item?.linkName),
    summary: normalizeText(item?.summary),
    answer: normalizeText(item?.answer),
    pinned: item?.pinned === true,
    enabled: item?.enabled !== false,
    translationStatus: item?.translationStatus || "none",
    sortOrder: typeof item?.sortOrder === "number" ? item.sortOrder : null,
  };
}

function normalizeImChannel(item?: Partial<WebsiteImChannel> | null): WebsiteImChannel {
  return {
    ...createImChannel(),
    ...item,
    id: item?.id || uid("im"),
    platform: normalizeText(item?.platform, "WhatsApp"),
    account: normalizeText(item?.account),
    linkUrl: normalizeText(item?.linkUrl),
    enabled: item?.enabled !== false,
    sortOrder: typeof item?.sortOrder === "number" ? item.sortOrder : null,
  };
}

function normalizeSocialLink(item?: Partial<WebsiteSocialLink> | null): WebsiteSocialLink {
  return {
    ...createSocialLink(),
    ...item,
    id: item?.id || uid("sns"),
    platform: normalizeText(item?.platform, "LinkedIn"),
    url: normalizeText(item?.url),
    enabled: item?.enabled !== false,
    sortOrder: typeof item?.sortOrder === "number" ? item.sortOrder : null,
  };
}

function normalizeSectionList(items: unknown, fallbackTitle: string) {
  if (!Array.isArray(items) || !items.length) return [];
  return sortByPriority(items.map((item) => normalizeSectionEntry(item as Partial<WebsiteSectionEntry>, fallbackTitle)));
}

function upgradeLegacyState(parsed: Partial<WebsiteContentState> & Record<string, unknown>): WebsiteContentState {
  const base = structuredClone(defaultWebsiteContentState);
  const legacyAbout = parsed.about as Record<string, unknown> | undefined;
  const legacyFactory = parsed.factory as Record<string, unknown> | undefined;
  const legacyGallery = parsed.gallery as Record<string, unknown> | undefined;
  const legacyIm = parsed.im as Record<string, unknown> | undefined;
  const legacyLogistics = parsed.logistics as Record<string, unknown> | undefined;
  const legacyModules = parsed.modules as Array<Record<string, unknown>> | undefined;
  const legacyService = parsed.service as Array<Record<string, unknown>> | undefined;
  const legacyExhibition = parsed.exhibition as Array<Record<string, unknown>> | undefined;
  const legacyFaq = parsed.faq as Array<Record<string, unknown>> | undefined;

  const aboutEntries =
    parsed.sections?.about?.length
      ? parsed.sections.about
      : legacyAbout
        ? [
            normalizeSectionEntry(
              {
                title: String(legacyAbout.title || "公司介绍"),
                summary: String(legacyAbout.description || ""),
                content: String(legacyAbout.description || ""),
                images: legacyAbout.image ? [String(legacyAbout.image)] : [],
                pinned: true,
                enabled: true,
              },
              "公司介绍"
            ),
          ]
        : base.sections.about;

  const factoryEntries =
    parsed.sections?.factory?.length
      ? parsed.sections.factory
      : Array.isArray(legacyFactory?.lines)
        ? legacyFactory.lines.map((line) =>
            normalizeSectionEntry(
              {
                title: String((line as Record<string, unknown>).name || "工厂生产"),
                summary: `${String((line as Record<string, unknown>).capacity || "")} ${String((line as Record<string, unknown>).status || "")}`.trim(),
                content: `${String((line as Record<string, unknown>).capacity || "")} / ${String((line as Record<string, unknown>).status || "")} / ${String((line as Record<string, unknown>).workers || 0)} workers`,
                images: Array.isArray(legacyFactory.images) ? legacyFactory.images.map((image) => String(image)) : [],
              },
              "工厂生产"
            )
          )
        : base.sections.factory;

  const galleryEntries =
    parsed.sections?.gallery?.length
      ? parsed.sections.gallery
      : Array.isArray(legacyGallery?.albums)
        ? legacyGallery.albums.map((album) =>
            normalizeSectionEntry(
              {
                title: String((album as Record<string, unknown>).name || "公司风采"),
                summary: `${String((album as Record<string, unknown>).count || 0)} images`,
                content: `${String((album as Record<string, unknown>).count || 0)} images`,
                images: (album as Record<string, unknown>).image ? [String((album as Record<string, unknown>).image)] : [],
              },
              "公司风采"
            )
          )
        : base.sections.gallery;

  const serviceEntries =
    parsed.sections?.service?.length
      ? parsed.sections.service
      : Array.isArray(legacyService)
        ? legacyService.map((item) =>
            normalizeSectionEntry(
              {
                title: String(item.title || "服务保障"),
                content: String(item.desc || ""),
                summary: String(item.desc || ""),
                enabled: item.enabled !== false,
              },
              "服务保障"
            )
          )
        : base.sections.service;

  const logisticsEntries =
    parsed.sections?.logistics?.length
      ? parsed.sections.logistics
      : Array.isArray(legacyLogistics?.methods)
        ? legacyLogistics.methods.map((item) =>
            normalizeSectionEntry(
              {
                title: String((item as Record<string, unknown>).name || "物流货运"),
                summary: String((item as Record<string, unknown>).time || ""),
                content: `${String((item as Record<string, unknown>).time || "")} / ${String((item as Record<string, unknown>).cost || "")} / ${Array.isArray((item as Record<string, unknown>).regions) ? ((item as Record<string, unknown>).regions as string[]).join(", ") : ""}`,
                enabled: (item as Record<string, unknown>).enabled !== false,
              },
              "物流货运"
            )
          )
        : legacyLogistics?.description
          ? [normalizeSectionEntry({ title: "物流货运", content: String(legacyLogistics.description), summary: String(legacyLogistics.description) }, "物流货运")]
          : base.sections.logistics;

  const exhibitionEntries =
    parsed.sections?.exhibition?.length
      ? parsed.sections.exhibition
      : Array.isArray(legacyExhibition)
        ? legacyExhibition.map((item) =>
            normalizeSectionEntry(
              {
                title: String(item.name || "展会活动"),
                summary: `${String(item.location || "")} ${String(item.date || "")}`.trim(),
                content: `${String(item.location || "")} / ${String(item.date || "")} / ${String(item.booth || "")} / ${String(item.status || "")}`,
              },
              "展会活动"
            )
          )
        : base.sections.exhibition;

  const moduleEntries =
    parsed.sections?.modules?.length
      ? parsed.sections.modules
      : Array.isArray(legacyModules)
        ? legacyModules.map((item) =>
            normalizeSectionEntry(
              {
                title: String(item.name || "自定义模块"),
                summary: String(item.type || ""),
                content: Array.isArray(item.pages) ? (item.pages as string[]).join(", ") : String(item.type || ""),
                enabled: item.visible !== false,
              },
              "自定义模块"
            )
          )
        : base.sections.modules;

  const faqItems =
    Array.isArray(legacyFaq) && legacyFaq.length
      ? legacyFaq.map((item) =>
          normalizeFaqItem({
            id: String(item.id || uid("faq")),
            question: String(item.question || ""),
            answer: String(item.answer || ""),
            enabled: item.visible !== false,
          })
        )
      : base.faq;

  const imChannels =
    Array.isArray(legacyIm?.channels) && legacyIm.channels.length
      ? legacyIm.channels.map((item) =>
          normalizeImChannel({
            id: String((item as Record<string, unknown>).id || uid("im")),
            platform: String((item as Record<string, unknown>).platform || "WhatsApp"),
            account: String((item as Record<string, unknown>).account || ""),
            enabled: (item as Record<string, unknown>).enabled !== false,
          })
        )
        : base.im.channels;

  const banner = seedHomepageBanners(
    sortByPriority((parsed.banner?.items?.length ? parsed.banner.items : base.banner.items).map((item) => normalizeBannerItem(item))),
    parsed.banner?.seedVersion
  );

  return normalizeWebsiteContentState({
    profile: normalizeProfile(parsed.profile || {}),
    navigation: {
      enabled: parsed.navigation?.enabled !== false,
      items: normalizeNavigationItemsV2(parsed.navigation?.items),
      ctaLabel: normalizeText(parsed.navigation?.ctaLabel, "联系我们"),
      ctaHref: normalizeText(parsed.navigation?.ctaHref, "#contact"),
    },
    banner,
    recommend: {
      note: normalizeText(parsed.recommend?.note, base.recommend.note),
    },
    contentLibrary: {
      news: normalizeContentLibrary(parsed.contentLibrary?.news, base.contentLibrary.news),
      cases: normalizeContentLibrary(parsed.contentLibrary?.cases, base.contentLibrary.cases),
      videos: normalizeContentLibrary(parsed.contentLibrary?.videos, base.contentLibrary.videos),
      blog: normalizeContentLibrary(parsed.contentLibrary?.blog, base.contentLibrary.blog),
    },
    sections: {
      about: aboutEntries,
      factory: factoryEntries,
      gallery: galleryEntries,
      exhibition: exhibitionEntries,
      service: serviceEntries,
      logistics: logisticsEntries,
      modules: moduleEntries,
    },
    faq: sortByPriority(faqItems.map((item) => normalizeFaqItem(item))),
    im: {
      channels: sortByPriority(imChannels.map((item) => normalizeImChannel(item))),
      onlineHours: normalizeText(parsed.im?.onlineHours, base.im.onlineHours),
      autoReply: normalizeText(parsed.im?.autoReply, base.im.autoReply),
      showFloatingWidget: parsed.im?.showFloatingWidget !== false,
    },
    social: {
      links: sortByPriority(
        (parsed.social?.links?.length ? parsed.social.links : base.social.links).map((item) => normalizeSocialLink(item))
      ),
    },
  });
}

function normalizeWebsiteContentState(state: WebsiteContentState): WebsiteContentState {
  const banner = seedHomepageBanners(
    sortByPriority((state.banner?.items || []).map((item) => normalizeBannerItem(item))),
    state.banner?.seedVersion
  );

  const normalized: WebsiteContentState = {
    profile: normalizeProfile(state.profile),
    navigation: {
      enabled: state.navigation?.enabled !== false,
      items: normalizeNavigationItemsV2(state.navigation?.items),
      ctaLabel: normalizeText(state.navigation?.ctaLabel, "联系我们"),
      ctaHref: normalizeText(state.navigation?.ctaHref, "#contact"),
    },
    banner,
    recommend: {
      note: normalizeText(state.recommend?.note, defaultWebsiteContentState.recommend.note),
    },
    contentLibrary: {
      news: normalizeContentLibrary(state.contentLibrary?.news, defaultWebsiteContentState.contentLibrary.news),
      cases: normalizeContentLibrary(state.contentLibrary?.cases, defaultWebsiteContentState.contentLibrary.cases),
      videos: normalizeContentLibrary(state.contentLibrary?.videos, defaultWebsiteContentState.contentLibrary.videos),
      blog: normalizeContentLibrary(state.contentLibrary?.blog, defaultWebsiteContentState.contentLibrary.blog),
    },
    sections: {
      about: normalizeSectionList(state.sections?.about, "公司介绍"),
      factory: normalizeSectionList(state.sections?.factory, "工厂生产"),
      gallery: normalizeSectionList(state.sections?.gallery, "公司风采"),
      exhibition: normalizeSectionList(state.sections?.exhibition, "展会活动"),
      service: normalizeSectionList(state.sections?.service, "服务保障"),
      logistics: normalizeSectionList(state.sections?.logistics, "物流货运"),
      modules: normalizeSectionList(state.sections?.modules, "自定义模块"),
    },
    faq: sortByPriority((state.faq || []).map((item) => normalizeFaqItem(item))),
    im: {
      channels: sortByPriority((state.im?.channels || []).map((item) => normalizeImChannel(item))),
      onlineHours: normalizeText(state.im?.onlineHours, defaultWebsiteContentState.im.onlineHours),
      autoReply: normalizeText(state.im?.autoReply, defaultWebsiteContentState.im.autoReply),
      showFloatingWidget: state.im?.showFloatingWidget !== false,
    },
    social: {
      links: sortByPriority((state.social?.links || []).map((item) => normalizeSocialLink(item))),
    },
  };
  return syncContentCategoryNavigation(normalized);
}

function sanitizeContentStrings<T>(value: T): T {
  if (typeof value === "string") {
    return repairKnownMojibake(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeContentStrings(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeContentStrings(item)])) as T;
  }
  return value;
}

export function cloneWebsiteContentState(state: WebsiteContentState) {
  return normalizeWebsiteContentState(sanitizeContentStrings(structuredClone(state)));
}

export function getWebsiteContentState(siteId?: string | null): WebsiteContentState {
  try {
    const storageKey = getStorageKey(siteId);
    let raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      try {
        raw = window.sessionStorage.getItem(getSessionFallbackKey(storageKey));
      } catch {
        // Session storage is a recovery layer only; a clean default remains safe.
      }
    }
    if (!raw) return cloneWebsiteContentState(defaultWebsiteContentState);
    const parsed = JSON.parse(raw) as Partial<WebsiteContentState> & Record<string, unknown>;
    return upgradeLegacyState(sanitizeContentStrings(parsed));
  } catch {
    return cloneWebsiteContentState(defaultWebsiteContentState);
  }
}

export function saveWebsiteContentState(state: WebsiteContentState, siteId?: string | null) {
  const storageKey = getStorageKey(siteId);
  const sanitized = normalizeWebsiteContentState(sanitizeContentStrings(state));
  const serialized = JSON.stringify(sanitized);
  const savedToLocal = safeSetLocalStorage(storageKey, serialized, { compact: true });
  let savedToSession = false;

  try {
    const sessionKey = getSessionFallbackKey(storageKey);
    if (savedToLocal) {
      window.sessionStorage.removeItem(sessionKey);
    } else {
      window.sessionStorage.setItem(sessionKey, serialized);
      savedToSession = true;
    }
  } catch {
    // The primary local store has already succeeded, or no session fallback is available.
  }

  window.dispatchEvent(
    new CustomEvent("website-content-updated", {
      detail: { siteId: siteId || null, storageKey, persisted: savedToLocal || savedToSession },
    })
  );
  return savedToLocal || savedToSession;
}
