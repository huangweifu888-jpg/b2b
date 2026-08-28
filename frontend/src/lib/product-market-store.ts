import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  LayoutDashboard,
  Bot,
  FolderKanban,
  FileText as FileTextIcon,
  LineChart,
  Globe,
  Building2,
  Package,
  Newspaper,
  HardHat,
  Video,
  BookOpen,
  Search,
  Share2,
  Megaphone,
  BarChart3,
  Inbox,
  Users,
  ShieldCheck,
  MessageCircle,
  LayoutTemplate,
  Settings,
  Link2,
  CreditCard,
  Puzzle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { safeRemoveLocalStorage, safeSetLocalStorage } from "./storage-guards";
import { sanitizeDisplayText } from "./text-sanitizer";
import { formatDisplayOrdinal } from "./display-number-contract";
import { buildCustomerServiceDefaultGreeting } from "./customer-service-default-greeting";
import { resolveAccessibleTextColor } from "./color-contrast";
import {
  LEFT_SELECTED_TEXT_FALLBACK,
  RIGHT_SELECTED_TEXT_FALLBACK,
  normalizeRightSelectedTextPreference,
} from "./global-theme-tokens";
import {
  PRODUCT_MARKET_THEME_PALETTES,
  buildProductMarketFactoryStatusCards,
  buildProductMarketSidebarGradient,
  type ProductMarketThemePalette,
  type ProductMarketThemePaletteKey,
} from "./product-market-theme-palettes";
import {
  CUSTOMER_SERVICE_VOICE_PRESETS,
  CUSTOMER_SERVICE_VOICE_CONTRACT_VERSION,
  DEFAULT_CUSTOMER_SERVICE_VOICE_RATE,
  getCustomerServiceVoicePreset,
  getDefaultVoiceGenderForAvatar,
  getDefaultVoiceStyleForAvatar,
  getLegacyVoiceStyleKeyForPreset,
  isLegacyCustomerServiceVoiceStyleKey,
  isCustomerServiceExpertVoiceAvatarId,
  resolveCustomerServiceVoiceMigrationPreset,
  type CustomerServiceVoiceStyleKey,
  normalizeCustomerServiceVoiceRate,
} from "./customer-service-voice";
import {
  CUSTOMER_SERVICE_REMINDER_CONTRACT_VERSION,
  resolveCustomerServiceReminderAssetRef,
  resolveCustomerServiceReminderMigrationStyle,
  resolveCustomerServiceReminderStyle,
} from "./customer-service-reminder-sound";
import { CUSTOMER_SERVICE_EXPERT_AUDIO_ROSTER } from "./customer-service-audio-roster";
import {
  cloneVisualCardLayout,
  normalizeVisualCardLayout,
  type VisualCardLayoutConfig,
} from "./visual-card-layout-contract";
import {
  FACTORY_PLATFORM_CATEGORIES,
  FACTORY_PLATFORM_CONTENT_PROGRAM_PROTECTION,
  FACTORY_PLATFORM_SOCIAL_WORKSPACES,
  buildFactoryPlatformFourCharacterLabel,
  isFactoryPlatformProtectedContentRoute,
  type FactoryPlatformCategoryKey,
  type FactoryPlatformDeliveryStatus,
} from "./factory-platform-blueprint";
import { dedupeProductOrderPaths } from "./product-market-order-contract";

export type ProductStatus = "active" | "inactive" | "hidden";
export type ProductMarketCatalogScope = "hq" | "agency_source" | "client_source" | "agency" | "client";

export type SourceWorkspaceCategoryDefinition = {
  key: string;
  label: string;
  paths: readonly string[];
};

/**
 * Headquarters and Agency Source category definitions are a shared contract.
 * Column Configuration, Operations Market and both source sidebars must read
 * these same keys and this same top-to-bottom order; only the customer source
 * uses the fixed twelve-stage factory blueprint contract below.
 */
export const SOURCE_WORKSPACE_GROUPS: Readonly<Partial<Record<
  ProductMarketCatalogScope,
  readonly SourceWorkspaceCategoryDefinition[]
>>> = {
  hq: [
    { key: "hq-overview", label: "概览", paths: ["/"] },
    { key: "hq-account", label: "账号管理", paths: ["/members", "/roles", "/depts"] },
    { key: "hq-agencies", label: "代理商管理", paths: ["/agencies", "/agency-source/releases", "/recharge-audit", "/oem-audit"] },
    { key: "hq-enterprise", label: "外贸企业", paths: ["/enterprises"] },
    { key: "hq-sites", label: "站点管理", paths: ["/sites", "/domains"] },
    { key: "hq-assets", label: "素材管理", paths: ["/templates", "/gallery"] },
    { key: "hq-ai", label: "AI 服务", paths: ["/ai-vendors", "/ai-models", "/ai-logs", "/ai-cost", "/ai-square"] },
    { key: "hq-finance", label: "资金管理", paths: ["/wallet"] },
    { key: "hq-plans", label: "套餐与积分", paths: ["/plans", "/boosters", "/coupons", "/points"] },
    { key: "hq-orders", label: "订单管理", paths: ["/orders", "/order-audit", "/auto-renew", "/refunds", "/invoices"] },
    { key: "hq-operations", label: "运营推广", paths: ["/announcements", "/promotions", "/groups", "/csat", "/qa-plans", "/qa-tasks", "/inquiry-auto"] },
    { key: "hq-seo", label: "SEO 任务", paths: ["/tdk-rules", "/seo-blogs"] },
    { key: "hq-notices", label: "通知管理", paths: ["/notify-config", "/email-config", "/expiring"] },
    { key: "hq-platform", label: "平台设置", paths: ["/kh-style-settings", "/material-assets", "/platform-architecture", "/platform-config", "/payment-channels", "/alerts", "/social-authorization", "/social-content-reviews", "/social-publish-delivery"] },
    { key: "hq-sources", label: "模板源", paths: ["/agency-source", "/client-source"] },
    { key: "hq-audit", label: "审计", paths: ["/audit-logs"] },
  ],
  agency_source: [
    { key: "agency-home", label: "首页", paths: ["/workspace", "/"] },
    { key: "agency-partners", label: "合伙人管理", paths: ["/partners", "/recharge-audit"] },
    { key: "agency-business", label: "业务", paths: ["/enterprises", "/customers", "/sites", "/orders", "/reports", "/public-pool", "/business-data", "/seo-tasks", "/seo-blogs"] },
    { key: "agency-team", label: "团队", paths: ["/members", "/roles", "/quotas", "/performance"] },
    { key: "agency-operation", label: "管理", paths: ["/plans", "/wallet", "/invite-links", "/oem-settings", "/releases", "/social-content-reviews"] },
  ],
};

/** Accept only the statuses supported by the current product-market UI.
 * Persisted source snapshots may predate this three-state contract. */
function normalizeProductStatus(value: unknown, fallback: ProductStatus = "active"): ProductStatus {
  return value === "active" || value === "inactive" || value === "hidden" ? value : fallback;
}

function normalizeDeliverySafeProductStatus(
  value: unknown,
  _deliveryStatus?: FactoryPlatformDeliveryStatus,
  fallback: ProductStatus = "active",
): ProductStatus {
  // Navigation visibility and delivery maturity are separate contracts.
  // A planned application may be shown in the catalogue while its visible
  // maturity badge continues to prevent it being sold as already delivered.
  return normalizeProductStatus(value, fallback);
}

export interface ProductCustomStyle {
  fontColor?: string;
  buttonColor?: string;
  bgColor?: string;
  borderColor?: string;
  iconName?: string;
  customIconUrl?: string;
  customIconAssetId?: string;
  nameFontColor?: string;
}

export interface ProductChildItem {
  label: string;
  path: string;
  status: ProductStatus;
  customLabel?: string;
  description?: string;
  customStyle?: ProductCustomStyle;
  children?: ProductChildItem[];
}

export interface ProductItem {
  label: string;
  path: string;
  status: ProductStatus;
  /** Product enablement is separate from delivery maturity. Planned blueprint cards remain visibly marked even when enabled. */
  deliveryStatus?: FactoryPlatformDeliveryStatus;
  icon: LucideIcon;
  customLabel?: string;
  description?: string;
  customStyle?: ProductCustomStyle;
  children?: ProductChildItem[];
}

export interface LayoutCustomStyle {
  headerBgColor: string;
  headerTextColor: string;
  footerBgColor: string;
  footerTextColor: string;
  contentBgColor: string;
  contentTextColor: string;
  clientTopbarBgColor?: string;
  clientTopbarTextColor?: string;
  /** Client shell override; absent values deliberately inherit sidebar gradient endpoints. */
  clientTopbarOverrideBgColor?: string;
  clientFooterOverrideBgColor?: string;
  /** Client chrome font overrides; absent values deliberately inherit sidebar text. */
  clientTopbarOverrideTextColor?: string;
  clientFooterOverrideTextColor?: string;
  clientFeatureCardBgColor?: string;
  clientFeatureCardTextColor?: string;
  clientCardBgColor?: string;
  clientCardTextColor?: string;
  clientSecondaryPageBgColor?: string;
  clientSecondaryPageTextColor?: string;
  clientSecondaryTitleBgColor?: string;
  clientSecondaryTitleTextColor?: string;
  clientSecondaryListBgColor?: string;
  clientSecondaryListTextColor?: string;
  /** 运营市场内容区独立于表内壳与表头；缺省时继承表内壳。 */
  clientSecondaryContentBgColor?: string;
  clientSecondaryContentTextColor?: string;
  /** 分类组大卡片独立于内部功能小卡片；缺省时继承小卡片。 */
  clientLargeCardBgColor?: string;
  clientLargeCardTextColor?: string;
  /** Right-side project pages and standard dialogs share these selected-state colours. */
  rightSelectedFrameColor?: string;
  rightSelectedTextColor?: string;
  /** 九区轻量框架的几何变量，仅保存当前源体草案。 */
  frameCornerRadius?: "square" | "soft" | "round";
  tableHeaderCornerRadius?: "square" | "soft" | "round";
  cardCornerRadius?: "square" | "soft" | "round";
  frameDensity?: "compact" | "standard" | "relaxed";
  frameElevation?: "flat" | "soft" | "raised";
  themePanelBgColor: string;
  themePanelTextColor: string;
  themePanelButtonColor: string;
  headerButtonTextColor: string;
  footerAccentColor: string;
  siteSwitchLoadingCardBgColor?: string;
  siteSwitchLoadingCardTextColor?: string;
  customerServiceLauncherBgColor?: string;
  customerServiceLauncherIconColor?: string;
  customerServicePanelBgColor?: string;
  customerServicePanelHeaderBgColor?: string;
  customerServicePanelHeaderTextColor?: string;
  customerServiceAssistantMsgBgColor?: string;
  customerServiceAssistantMsgTextColor?: string;
  customerServiceUserMsgBgColor?: string;
  customerServiceUserMsgTextColor?: string;
  customerServiceInputBorderColor?: string;
  defaultDialogBgColor?: string;
  defaultDialogHeaderBgColor?: string;
  defaultDialogPanelBgColor?: string;
  defaultDialogContentBgColor?: string;
  defaultDialogHeaderTextColor?: string;
  defaultDialogButtonColor?: string;
  defaultDialogButtonTextColor?: string;
  presetThemeBlackTextColor?: string;
  presetThemeLightTextColor?: string;
  presetThemeRoseTextColor?: string;
  presetThemeOrangeTextColor?: string;
  presetThemeBlackBgColor?: string;
  presetThemeLightBgColor?: string;
  presetThemeRoseBgColor?: string;
  presetThemeOrangeBgColor?: string;
  presetThemeBlackLabel?: string;
  presetThemeLightLabel?: string;
  presetThemeRoseLabel?: string;
  presetThemeOrangeLabel?: string;
  globalFontWeight?: string;
  globalLetterSpacing?: string;
}

export type ThemePresetKey = ProductMarketThemePaletteKey;

export interface SidebarStyle {
  bgFrom: string;
  bgVia: string;
  bgTo: string;
  textColor: string;
  activeHighlight: string;
  borderColor: string;
  fontFamily: string;
  fontWeight?: string;
  letterSpacing?: string;
}

export interface CardColors {
  bg: string;
  border: string;
  font: string;
  button: string;
  nameFont?: string;
}

export interface LayoutSectionConfig {
  id: string;
  title: string;
  description: string;
}

export interface CustomerServiceSectionConfig {
  id: string;
  title: string;
  description: string;
}

export type ProductModuleCategoryKey = FactoryPlatformCategoryKey;

export const PRODUCT_MODULE_CATEGORIES: ReadonlyArray<{
  key: ProductModuleCategoryKey;
  label: string;
  paths: readonly string[];
}> = FACTORY_PLATFORM_CATEGORIES.map((category) => ({
  key: category.key,
  label: category.label,
  paths: category.applications.map((application) => application.route),
}));

export const PRODUCT_MODULE_CATEGORY_ORDER = PRODUCT_MODULE_CATEGORIES.map((category) => category.key);

/**
 * Customer-facing reading path for the twelve platform stages.  This is not
 * a second category system: Operations, Column Configuration and Sidebar all
 * resolve these words from the same stable category key.
 */
export type ProductModuleCategoryMarketingGuide = {
  headline: string;
  pain: string;
  value: string;
  action: string;
};

export const PRODUCT_MODULE_CATEGORY_MARKETING_GUIDES: Readonly<Record<ProductModuleCategoryKey, ProductModuleCategoryMarketingGuide>> = {
  identity: { headline: "先找准值得成交的人", pain: "产品卖点分散、投放不知道该优先服务谁。", value: "用市场机会、竞品与 ICP 把高价值采购商和可赢产品说清楚。", action: "先确定目标客户与价值主张，再投入内容和预算。" },
  content: { headline: "让采购商三分钟看懂你", pain: "企业资料分散、多语言内容不足，买家找不到可信答案。", value: "把产品、工厂、案例与服务证据组织成可复用的多站内容。", action: "用清晰页面承接搜索和询盘，让买家愿意继续阅读。" },
  trust: { headline: "被找到，也被信任", pain: "买家搜索不到、看到了也难判断是否可靠。", value: "用搜索可见性、技术健康和可验证证据提升进入采购名单的机会。", action: "持续修复可见性并补全证明材料，减少第一次接触的不确定。" },
  recommend: { headline: "把对的内容推给对的人", pain: "内容已发布却没有触达相似的高意向采购商。", value: "结合受众、场景和内容表现，形成可解释的推荐与分发建议。", action: "让每次推荐服务于下一次咨询，而不是只增加浏览量。" },
  deepen: { headline: "把社媒关注变成可跟进商机", pain: "国内外账号、内容、互动和数据分散，只看点赞播放，容易漏掉真实采购信号。", value: "用统一账号矩阵、双市场内容、人工审核和归因证据，把客户痛点与产品利益连接到线索。", action: "先完成账号授权与痛点包装，再按内容、发布、互动、归因的九项工作区持续运营。" },
  portrait: { headline: "把分散联系人变成采购画像", pain: "同一企业、多位联系人和多次互动彼此割裂。", value: "在授权边界内连接企业、角色、偏好与旅程，形成可用客户画像。", action: "让营销和销售看到同一个客户，而不是各自保存一份名单。" },
  lead: { headline: "稳定获得可验证的商机", pain: "获客成本不清、流量质量不稳，销售拿到的线索难判断。", value: "将活动、素材、渠道和实验结果连接到合格线索与贡献。", action: "用小步验证替代盲目投放，把预算留给真正有效的来源。" },
  convert: { headline: "让询盘更快走向成交", pain: "响应慢、报价不一致、需求澄清反复，商机容易流失。", value: "把询盘、分配、样品、报价与合同串成可追踪的成交路径。", action: "让客户更快得到可信答复，让销售每一步都有依据。" },
  fulfillment: { headline: "把承诺变成可追踪交付", pain: "采购方担心规格、产能、质量和物流承诺无法兑现。", value: "让产品、采购、制造、质检与交付证据连接到同一订单。", action: "用透明履约降低采购风险，也让回款更可预期。" },
  care: { headline: "成交之后继续创造价值", pain: "交付完成后缺少服务跟进，复购、续约和口碑容易流失。", value: "围绕客户资产、服务结果、反馈与续约机会持续经营关系。", action: "把一次交易变成可衡量的长期客户价值。" },
  decision: { headline: "用事实做增长决策", pain: "营销、销售、交付和财务数据各说各话，决策滞后。", value: "将可追溯事实汇成经营指标、预警和可执行建议。", action: "让投入、风险与利润有共同依据，管理动作能复盘。" },
  operations: { headline: "让增长最终沉淀为利润", pain: "前端获客与后端履约脱节，增长没有落到现金和经营结果。", value: "统一组织、订单、资金、合同与经营主数据，形成闭环。", action: "把每一次增长兑现为可交付、可结算、可持续的经营成果。" },
};

export function getProductModuleCategoryMarketingGuide(key: string | null | undefined): ProductModuleCategoryMarketingGuide | undefined {
  if (!key || !Object.hasOwn(PRODUCT_MODULE_CATEGORY_MARKETING_GUIDES, key)) return undefined;
  return PRODUCT_MODULE_CATEGORY_MARKETING_GUIDES[key as ProductModuleCategoryKey];
}

export const PRODUCT_MODULE_CATEGORY_LOOKUP = PRODUCT_MODULE_CATEGORIES.flatMap((category) =>
  category.paths.map((path) => ({ key: category.key, path }))
).reduce((map, item) => {
  map.set(
    item.path,
    PRODUCT_MODULE_CATEGORIES.find((category) => category.key === item.key),
  );
  return map;
}, new Map<string, (typeof PRODUCT_MODULE_CATEGORIES)[number]>());

function buildDefaultProductModuleCategoryAssignments() {
  const assignments = Object.create(null) as Record<string, ProductModuleCategoryKey>;
  PRODUCT_MODULE_CATEGORIES.forEach((category) => {
    category.paths.forEach((path) => {
      assignments[path] = category.key;
    });
  });
  return assignments;
}

export function resolveProductModuleCategoryFromAssignments(
  path: string,
  assignments?: Record<string, string> | null
): (typeof PRODUCT_MODULE_CATEGORIES)[number] | undefined {
  if (assignments) {
    const assignedKey = assignments[path];
    if (assignedKey) {
      const assignedCategory = PRODUCT_MODULE_CATEGORIES.find((item) => item.key === assignedKey);
      if (assignedCategory) {
        return assignedCategory;
      }
    }
  }
  return PRODUCT_MODULE_CATEGORY_LOOKUP.get(path);
}

export function getProductModuleCategoryByPath(
  path: string,
  assignments?: Record<string, string> | null
): (typeof PRODUCT_MODULE_CATEGORIES)[number] | undefined {
  return resolveProductModuleCategoryFromAssignments(path, assignments);
}

export interface ThemePreset {
  key: ThemePresetKey | string;
  name: string;
  description: string;
  layout: LayoutCustomStyle;
  sidebar: SidebarStyle;
  fontFamily: string;
  cardActive: CardColors;
  cardInactive: CardColors;
  cardHidden: CardColors;
}

export interface CustomThemeData {
  key: string;
  name: string;
  description: string;
  layout: LayoutCustomStyle;
  sidebar: SidebarStyle;
  fontFamily: string;
  cardActive: CardColors;
  cardInactive: CardColors;
  cardHidden: CardColors;
}

// Keep the factory default on a font that is registered as a selectable
// shared-contract option.  Do not make a machine-only font the default.
export const DEFAULT_DESIGN_FONT_STACK = "'Noto Sans SC', sans-serif";
export const DEFAULT_DESIGN_FONT_WEIGHT = "400";
export const DEFAULT_DESIGN_LETTER_SPACING = "0.02em";

function normalizeGlobalFontFamily(value?: string | null) {
  const font = value?.trim();
  // These options relied on fonts installed on the editor's own device. Once
  // a source template was opened elsewhere they silently fell back, so remove
  // them from persisted shared contracts as well as from the picker.
  if (!font || /FZLanTingHei|方正兰亭|Microsoft YaHei|PingFang SC|^system-ui\s*,\s*sans-serif$/iu.test(font)) {
    return DEFAULT_DESIGN_FONT_STACK;
  }
  return font;
}

function normalizeGlobalLetterSpacing(value?: string | null) {
  // 0.015em was the pre-H970 theme default, but it has no matching option in
  // the editor. Migrate it to the declared “标准” choice on read.
  return !value || value === "0.015em" ? DEFAULT_DESIGN_LETTER_SPACING : value;
}

function resolveThemeCardColors(theme: ThemePreset | CustomThemeData, status: ProductStatus): CardColors {
  return status === "active"
    ? theme.cardActive
    : status === "hidden"
      ? theme.cardHidden
      : theme.cardInactive;
}

function buildStatusDrivenProductStyle(
  currentStyle: ProductCustomStyle | undefined,
  colors: CardColors
): ProductCustomStyle {
  return {
    ...currentStyle,
    bgColor: colors.bg,
    borderColor: colors.border,
    fontColor: colors.font,
    buttonColor: colors.button,
    nameFontColor: colors.nameFont || colors.font,
  };
}

const DEFAULT_SIDEBAR_STYLE: SidebarStyle = {
  bgFrom: "#2B0F20",
  bgVia: "#5B1E45",
  bgTo: "#A73D76",
  textColor: "#FFF1F7",
  activeHighlight: "#FFD4E7",
  borderColor: "#E67AAE",
  fontFamily: DEFAULT_DESIGN_FONT_STACK,
  fontWeight: DEFAULT_DESIGN_FONT_WEIGHT,
  letterSpacing: DEFAULT_DESIGN_LETTER_SPACING,
};

// Previous factory defaults are retained solely as an exact migration source.
// A persisted field is upgraded only when it still equals this old built-in
// value; source/client custom values are never replaced.
const LEGACY_FACTORY_BUILTIN_THEMES: ThemePreset[] = [
  {
    key: "rose",
    name: "玫红天青",
    description: "以玫瑰红建立品牌主色，以天青承担强调、信息与状态反馈；暖白留白与高对比文字保证专业运营场景的清晰度。",
    fontFamily: DEFAULT_DESIGN_FONT_STACK,
    layout: {
      headerBgColor: "#B71857",
      headerTextColor: "#FFFFFF",
      footerBgColor: "#5E0C30",
      footerTextColor: "#FFF7FA",
      contentBgColor: "#FFF7FA",
      contentTextColor: "#2A1020",
      clientTopbarBgColor: "#C61D60",
      clientTopbarTextColor: "#FFFFFF",
      clientFeatureCardBgColor: "#DDF6FA",
      clientFeatureCardTextColor: "#123A47",
      clientCardBgColor: "#FFFFFF",
      clientCardTextColor: "#2A1020",
      clientSecondaryPageBgColor: "#FFF7FA",
      clientSecondaryPageTextColor: "#2A1020",
      clientSecondaryTitleBgColor: "#A4154D",
      clientSecondaryTitleTextColor: "#FFFFFF",
      clientSecondaryListBgColor: "#C91E62",
      clientSecondaryListTextColor: "#FFFFFF",
      themePanelBgColor: "#FFE3EC",
      themePanelTextColor: "#2A1020",
      themePanelButtonColor: "#B71857",
      headerButtonTextColor: "#FFFFFF",
      footerAccentColor: "#20B8D4",
      siteSwitchLoadingCardBgColor: "#E7F8FB",
      siteSwitchLoadingCardTextColor: "#123A47",
      customerServiceLauncherBgColor: "#B71857",
      customerServiceLauncherIconColor: "#FFFFFF",
      customerServicePanelBgColor: "#FFFDFE",
      customerServicePanelHeaderBgColor: "#A4154D",
      customerServicePanelHeaderTextColor: "#FFFFFF",
      customerServiceAssistantMsgBgColor: "#E7F8FB",
      customerServiceAssistantMsgTextColor: "#123A47",
      customerServiceUserMsgBgColor: "#C91E62",
      customerServiceUserMsgTextColor: "#FFFFFF",
      customerServiceInputBorderColor: "#8BD9E7",
      defaultDialogBgColor: "#FFF3F7",
      defaultDialogHeaderBgColor: "#A4154D",
      defaultDialogPanelBgColor: "#FFE1EB",
      defaultDialogContentBgColor: "#FFFFFF",
      defaultDialogHeaderTextColor: "#FFFFFF",
      defaultDialogButtonColor: "#B71857",
      defaultDialogButtonTextColor: "#FFFFFF",
      globalFontWeight: DEFAULT_DESIGN_FONT_WEIGHT,
      globalLetterSpacing: DEFAULT_DESIGN_LETTER_SPACING,
    },
    sidebar: {
      bgFrom: "#560B2B",
      bgVia: "#941345",
      bgTo: "#C91E62",
      textColor: "#FFFFFF",
      activeHighlight: "#20B8D4",
      borderColor: "#F08AB0",
      fontFamily: DEFAULT_DESIGN_FONT_STACK,
      fontWeight: DEFAULT_DESIGN_FONT_WEIGHT,
      letterSpacing: DEFAULT_DESIGN_LETTER_SPACING,
    },
    cardActive: { bg: "#FFF1F5", border: "#B71857", font: "#2A1020", button: "#B71857", nameFont: "#2A1020" },
    cardInactive: { bg: "#F3FBFD", border: "#9EDFEA", font: "#123A47", button: "#58C5D9", nameFont: "#123A47" },
    cardHidden: { bg: "#F3EEF1", border: "#C5B2BA", font: "#5D4C54", button: "#9E818C", nameFont: "#42343A" },
  },
  {
    key: "orange",
    name: "暖橘荷青",
    description: "暖橘主色与荷青强调色组成的明亮主题，层次清晰、对比充足，适合转化与效率场景。",
    fontFamily: DEFAULT_DESIGN_FONT_STACK,
    layout: {
      headerBgColor: "#B94715",
      headerTextColor: "#FFFFFF",
      footerBgColor: "#74250D",
      footerTextColor: "#FFF8F3",
      contentBgColor: "#FFF8F3",
      contentTextColor: "#2B160D",
      clientTopbarBgColor: "#C94A16",
      clientTopbarTextColor: "#FFFFFF",
      clientFeatureCardBgColor: "#A1E6DD",
      clientFeatureCardTextColor: "#103C37",
      clientCardBgColor: "#FFFFFF",
      clientCardTextColor: "#2B160D",
      clientSecondaryPageBgColor: "#FFF8F3",
      clientSecondaryPageTextColor: "#2B160D",
      clientSecondaryTitleBgColor: "#B94715",
      clientSecondaryTitleTextColor: "#FFFFFF",
      clientSecondaryListBgColor: "#C94A16",
      clientSecondaryListTextColor: "#FFFFFF",
      themePanelBgColor: "#FFE8DA",
      themePanelTextColor: "#2B160D",
      themePanelButtonColor: "#FF6F2C",
      headerButtonTextColor: "#351509",
      footerAccentColor: "#A1E6DD",
      siteSwitchLoadingCardBgColor: "#E2F7F3",
      siteSwitchLoadingCardTextColor: "#103C37",
      customerServiceLauncherBgColor: "#FF6F2C",
      customerServiceLauncherIconColor: "#351509",
      customerServicePanelBgColor: "#FFFDF9",
      customerServicePanelHeaderBgColor: "#B94715",
      customerServicePanelHeaderTextColor: "#FFFFFF",
      customerServiceAssistantMsgBgColor: "#E2F7F3",
      customerServiceAssistantMsgTextColor: "#103C37",
      customerServiceUserMsgBgColor: "#FF6F2C",
      customerServiceUserMsgTextColor: "#351509",
      customerServiceInputBorderColor: "#80CFC5",
      defaultDialogBgColor: "#FFF1E7",
      defaultDialogHeaderBgColor: "#B94715",
      defaultDialogPanelBgColor: "#FFE0CF",
      defaultDialogContentBgColor: "#FFFFFF",
      defaultDialogHeaderTextColor: "#FFFFFF",
      defaultDialogButtonColor: "#FF6F2C",
      defaultDialogButtonTextColor: "#351509",
      globalFontWeight: DEFAULT_DESIGN_FONT_WEIGHT,
      globalLetterSpacing: DEFAULT_DESIGN_LETTER_SPACING,
    },
    sidebar: {
      bgFrom: "#4A1908",
      bgVia: "#A83D12",
      bgTo: "#FF6F2C",
      textColor: "#FFFFFF",
      activeHighlight: "#A1E6DD",
      borderColor: "#F7A27B",
      fontFamily: DEFAULT_DESIGN_FONT_STACK,
      fontWeight: DEFAULT_DESIGN_FONT_WEIGHT,
      letterSpacing: DEFAULT_DESIGN_LETTER_SPACING,
    },
    cardActive: { bg: "#FFF0E6", border: "#FF6F2C", font: "#2B160D", button: "#FF6F2C", nameFont: "#2B160D" },
    cardInactive: { bg: "#F5FBFA", border: "#80CFC5", font: "#173F3B", button: "#A1E6DD", nameFont: "#173F3B" },
    cardHidden: { bg: "#F2ECE8", border: "#B9A79C", font: "#5B4B43", button: "#9D8172", nameFont: "#42352F" },
  },
  {
    key: "indigoGreen",
    name: "因蓝艾绿",
    description: "因蓝主色与艾绿强调色构成的明亮高对比主题，沉稳而清爽，适合专业运营与数据场景。",
    fontFamily: DEFAULT_DESIGN_FONT_STACK,
    layout: {
      headerBgColor: "#012696",
      headerTextColor: "#FFFFFF",
      footerBgColor: "#00175D",
      footerTextColor: "#F4F8FF",
      contentBgColor: "#F5FBF8",
      contentTextColor: "#102B3C",
      clientTopbarBgColor: "#0A319E",
      clientTopbarTextColor: "#FFFFFF",
      clientFeatureCardBgColor: "#A4E2C6",
      clientFeatureCardTextColor: "#103C2A",
      clientCardBgColor: "#FFFFFF",
      clientCardTextColor: "#102B3C",
      clientSecondaryPageBgColor: "#F5FBF8",
      clientSecondaryPageTextColor: "#102B3C",
      clientSecondaryTitleBgColor: "#012696",
      clientSecondaryTitleTextColor: "#FFFFFF",
      clientSecondaryListBgColor: "#0B4A99",
      clientSecondaryListTextColor: "#FFFFFF",
      themePanelBgColor: "#DDF5E9",
      themePanelTextColor: "#103C2A",
      themePanelButtonColor: "#012696",
      headerButtonTextColor: "#FFFFFF",
      footerAccentColor: "#A4E2C6",
      siteSwitchLoadingCardBgColor: "#E4F7EE",
      siteSwitchLoadingCardTextColor: "#103C2A",
      customerServiceLauncherBgColor: "#012696",
      customerServiceLauncherIconColor: "#FFFFFF",
      customerServicePanelBgColor: "#FBFFFD",
      customerServicePanelHeaderBgColor: "#012696",
      customerServicePanelHeaderTextColor: "#FFFFFF",
      customerServiceAssistantMsgBgColor: "#E4F7EE",
      customerServiceAssistantMsgTextColor: "#103C2A",
      customerServiceUserMsgBgColor: "#012696",
      customerServiceUserMsgTextColor: "#FFFFFF",
      customerServiceInputBorderColor: "#79C8A4",
      defaultDialogBgColor: "#EFFAF4",
      defaultDialogHeaderBgColor: "#012696",
      defaultDialogPanelBgColor: "#D9F1E4",
      defaultDialogContentBgColor: "#FFFFFF",
      defaultDialogHeaderTextColor: "#FFFFFF",
      defaultDialogButtonColor: "#012696",
      defaultDialogButtonTextColor: "#FFFFFF",
      globalFontWeight: DEFAULT_DESIGN_FONT_WEIGHT,
      globalLetterSpacing: DEFAULT_DESIGN_LETTER_SPACING,
    },
    sidebar: {
      bgFrom: "#00175D",
      bgVia: "#012696",
      bgTo: "#0B4A99",
      textColor: "#FFFFFF",
      activeHighlight: "#A4E2C6",
      borderColor: "#6EBB9A",
      fontFamily: DEFAULT_DESIGN_FONT_STACK,
      fontWeight: DEFAULT_DESIGN_FONT_WEIGHT,
      letterSpacing: DEFAULT_DESIGN_LETTER_SPACING,
    },
    // 开通操作以深靛蓝配白字，保证按钮、状态胶囊在艾绿卡片上有足够对比度。
    cardActive: { bg: "#E9F8F0", border: "#57B987", font: "#FFFFFF", button: "#0B4A99", nameFont: "#103C2A" },
    cardInactive: { bg: "#F4F8FC", border: "#A9C8E8", font: "#19364F", button: "#6289B6", nameFont: "#19364F" },
    cardHidden: { bg: "#EDF0F1", border: "#B4BEC4", font: "#56646B", button: "#77858D", nameFont: "#3E4B52" },
  },
  {
    key: "tealRose",
    name: "斯绿玫粉",
    description: "以斯绿建立清晰、稳定的操作骨架，玫粉用于强调、提示与柔和表面；适合兼顾专业效率与亲和感的全局界面。",
    fontFamily: DEFAULT_DESIGN_FONT_STACK,
    layout: {
      headerBgColor: "#01847F",
      headerTextColor: "#FFFFFF",
      footerBgColor: "#005C59",
      footerTextColor: "#F5FFFE",
      contentBgColor: "#F7FCFB",
      contentTextColor: "#103C3A",
      clientTopbarBgColor: "#079892",
      clientTopbarTextColor: "#FFFFFF",
      clientFeatureCardBgColor: "#F9D2E4",
      clientFeatureCardTextColor: "#5A1738",
      clientCardBgColor: "#FFFFFF",
      clientCardTextColor: "#103C3A",
      clientSecondaryPageBgColor: "#F7FCFB",
      clientSecondaryPageTextColor: "#103C3A",
      clientSecondaryTitleBgColor: "#01726D",
      clientSecondaryTitleTextColor: "#FFFFFF",
      clientSecondaryListBgColor: "#01847F",
      clientSecondaryListTextColor: "#FFFFFF",
      themePanelBgColor: "#FCE8F1",
      themePanelTextColor: "#103C3A",
      themePanelButtonColor: "#01847F",
      headerButtonTextColor: "#FFFFFF",
      footerAccentColor: "#F9D2E4",
      siteSwitchLoadingCardBgColor: "#EFFBFA",
      siteSwitchLoadingCardTextColor: "#103C3A",
      customerServiceLauncherBgColor: "#01847F",
      customerServiceLauncherIconColor: "#FFFFFF",
      customerServicePanelBgColor: "#FCFFFE",
      customerServicePanelHeaderBgColor: "#01726D",
      customerServicePanelHeaderTextColor: "#FFFFFF",
      customerServiceAssistantMsgBgColor: "#EFFBFA",
      customerServiceAssistantMsgTextColor: "#103C3A",
      customerServiceUserMsgBgColor: "#01847F",
      customerServiceUserMsgTextColor: "#FFFFFF",
      customerServiceInputBorderColor: "#7DCEC9",
      defaultDialogBgColor: "#F5FCFB",
      defaultDialogHeaderBgColor: "#01726D",
      defaultDialogPanelBgColor: "#E6F6F4",
      defaultDialogContentBgColor: "#FFFFFF",
      defaultDialogHeaderTextColor: "#FFFFFF",
      defaultDialogButtonColor: "#01847F",
      defaultDialogButtonTextColor: "#FFFFFF",
      globalFontWeight: DEFAULT_DESIGN_FONT_WEIGHT,
      globalLetterSpacing: DEFAULT_DESIGN_LETTER_SPACING,
    },
    sidebar: {
      bgFrom: "#004B48",
      bgVia: "#01726D",
      bgTo: "#01847F",
      textColor: "#FFFFFF",
      activeHighlight: "#F9D2E4",
      borderColor: "#70C8C3",
      fontFamily: DEFAULT_DESIGN_FONT_STACK,
      fontWeight: DEFAULT_DESIGN_FONT_WEIGHT,
      letterSpacing: DEFAULT_DESIGN_LETTER_SPACING,
    },
    cardActive: { bg: "#FFF1F7", border: "#E89ABF", font: "#4A1730", button: "#01847F", nameFont: "#4A1730" },
    cardInactive: { bg: "#F2FBFA", border: "#A7D8D4", font: "#124946", button: "#A9DED9", nameFont: "#124946" },
    cardHidden: { bg: "#F0F3F3", border: "#B7C4C3", font: "#586967", button: "#869593", nameFont: "#3D4D4B" },
  },
  {
    key: "limeTea",
    name: "凝白茶青",
    description: "以凝白建立柔和、安定的表面基调，茶青用于强调与状态识别；正文采用更深茶绿，兼顾自然气质与专业可读性。",
    fontFamily: DEFAULT_DESIGN_FONT_STACK,
    layout: {
      headerBgColor: "#6AA338",
      headerTextColor: "#FFFFFF",
      footerBgColor: "#3F6D20",
      footerTextColor: "#F8FCEF",
      contentBgColor: "#F8FBF4",
      contentTextColor: "#25451E",
      clientTopbarBgColor: "#78AD48",
      clientTopbarTextColor: "#FFFFFF",
      clientFeatureCardBgColor: "#B6CB9B",
      clientFeatureCardTextColor: "#25451E",
      clientCardBgColor: "#FFFFFF",
      clientCardTextColor: "#25451E",
      clientSecondaryPageBgColor: "#F8FBF4",
      clientSecondaryPageTextColor: "#25451E",
      clientSecondaryTitleBgColor: "#5C8E30",
      clientSecondaryTitleTextColor: "#FFFFFF",
      clientSecondaryListBgColor: "#6AA338",
      clientSecondaryListTextColor: "#FFFFFF",
      themePanelBgColor: "#EAF2DE",
      themePanelTextColor: "#25451E",
      themePanelButtonColor: "#6AA338",
      headerButtonTextColor: "#FFFFFF",
      footerAccentColor: "#B6CB9B",
      siteSwitchLoadingCardBgColor: "#F2F8EA",
      siteSwitchLoadingCardTextColor: "#25451E",
      customerServiceLauncherBgColor: "#6AA338",
      customerServiceLauncherIconColor: "#FFFFFF",
      customerServicePanelBgColor: "#FEFFFC",
      customerServicePanelHeaderBgColor: "#5C8E30",
      customerServicePanelHeaderTextColor: "#FFFFFF",
      customerServiceAssistantMsgBgColor: "#F2F8EA",
      customerServiceAssistantMsgTextColor: "#25451E",
      customerServiceUserMsgBgColor: "#6AA338",
      customerServiceUserMsgTextColor: "#FFFFFF",
      customerServiceInputBorderColor: "#A1C77B",
      defaultDialogBgColor: "#F7FAF1",
      defaultDialogHeaderBgColor: "#5C8E30",
      defaultDialogPanelBgColor: "#E7F0DA",
      defaultDialogContentBgColor: "#FFFFFF",
      defaultDialogHeaderTextColor: "#FFFFFF",
      defaultDialogButtonColor: "#6AA338",
      defaultDialogButtonTextColor: "#FFFFFF",
      globalFontWeight: DEFAULT_DESIGN_FONT_WEIGHT,
      globalLetterSpacing: DEFAULT_DESIGN_LETTER_SPACING,
    },
    sidebar: {
      bgFrom: "#355C1D",
      bgVia: "#5C8E30",
      bgTo: "#6AA338",
      textColor: "#FFFFFF",
      activeHighlight: "#B6CB9B",
      borderColor: "#A9C98A",
      fontFamily: DEFAULT_DESIGN_FONT_STACK,
      fontWeight: DEFAULT_DESIGN_FONT_WEIGHT,
      letterSpacing: DEFAULT_DESIGN_LETTER_SPACING,
    },
    cardActive: { bg: "#F4F8ED", border: "#6AA338", font: "#25451E", button: "#6AA338", nameFont: "#25451E" },
    cardInactive: { bg: "#FAFCF7", border: "#B6CB9B", font: "#36572D", button: "#9BC072", nameFont: "#36572D" },
    cardHidden: { bg: "#F1F3EE", border: "#C0C9B9", font: "#64725E", button: "#8D9B86", nameFont: "#495648" },
  },
  {
    key: "dark",
    name: "墨黑星紫",
    description: "墨黑主色与星紫强调色构成的高对比主题，沉浸、亮眼且适合专业后台与高密度数据场景。",
    fontFamily: DEFAULT_DESIGN_FONT_STACK,
    layout: {
      headerBgColor: "#17121F",
      headerTextColor: "#F9F5FF",
      footerBgColor: "#0B0C10",
      footerTextColor: "#EEE7FF",
      contentBgColor: "#17141F",
      contentTextColor: "#F6F0FF",
      clientTopbarBgColor: "#21152F",
      clientTopbarTextColor: "#F9F5FF",
      clientFeatureCardBgColor: "#DEC7FF",
      clientFeatureCardTextColor: "#27113B",
      clientCardBgColor: "#211C2B",
      clientCardTextColor: "#F6F0FF",
      clientSecondaryPageBgColor: "#17141F",
      clientSecondaryPageTextColor: "#F6F0FF",
      clientSecondaryTitleBgColor: "#20142F",
      clientSecondaryTitleTextColor: "#F9F5FF",
      clientSecondaryListBgColor: "#35134F",
      clientSecondaryListTextColor: "#F9F5FF",
      themePanelBgColor: "#2A2038",
      themePanelTextColor: "#F6F0FF",
      themePanelButtonColor: "#A855F7",
      headerButtonTextColor: "#190621",
      footerAccentColor: "#A855F7",
      siteSwitchLoadingCardBgColor: "#2D2340",
      siteSwitchLoadingCardTextColor: "#F6F0FF",
      customerServiceLauncherBgColor: "#A855F7",
      customerServiceLauncherIconColor: "#190621",
      customerServicePanelBgColor: "#15111C",
      customerServicePanelHeaderBgColor: "#311849",
      customerServicePanelHeaderTextColor: "#F9F5FF",
      customerServiceAssistantMsgBgColor: "#292035",
      customerServiceAssistantMsgTextColor: "#F6F0FF",
      customerServiceUserMsgBgColor: "#A855F7",
      customerServiceUserMsgTextColor: "#190621",
      customerServiceInputBorderColor: "#72518E",
      defaultDialogBgColor: "#15111C",
      defaultDialogHeaderBgColor: "#28173A",
      defaultDialogPanelBgColor: "#21192C",
      defaultDialogContentBgColor: "#282032",
      defaultDialogHeaderTextColor: "#F9F5FF",
      defaultDialogButtonColor: "#A855F7",
      defaultDialogButtonTextColor: "#190621",
      globalFontWeight: DEFAULT_DESIGN_FONT_WEIGHT,
      globalLetterSpacing: DEFAULT_DESIGN_LETTER_SPACING,
    },
    sidebar: {
      bgFrom: "#0B0C10",
      bgVia: "#17121F",
      bgTo: "#5B1E8D",
      textColor: "#F9F5FF",
      activeHighlight: "#A855F7",
      borderColor: "#74489B",
      fontFamily: DEFAULT_DESIGN_FONT_STACK,
      fontWeight: DEFAULT_DESIGN_FONT_WEIGHT,
      letterSpacing: DEFAULT_DESIGN_LETTER_SPACING,
    },
    cardActive: { bg: "#2A1F3A", border: "#A855F7", font: "#F8F3FF", button: "#A855F7", nameFont: "#FFFFFF" },
    cardInactive: { bg: "#211B2B", border: "#5F4B73", font: "#E7DDF5", button: "#67457F", nameFont: "#F0E9FA" },
    cardHidden: { bg: "#15121C", border: "#393143", font: "#B7ADBF", button: "#332C3E", nameFont: "#CEC4D6" },
  },
  {
    key: "light",
    name: "松褐吉粉",
    description: "松褐主色与吉粉强调色构成的温暖明亮主题，层次明确并保持稳定的文字可读性。",
    fontFamily: DEFAULT_DESIGN_FONT_STACK,
    layout: {
      headerBgColor: "#664B3A",
      headerTextColor: "#FFF9F6",
      footerBgColor: "#493328",
      footerTextColor: "#FFF6F2",
      contentBgColor: "#FFF9F6",
      contentTextColor: "#34241C",
      clientTopbarBgColor: "#7B5A46",
      clientTopbarTextColor: "#FFF9F6",
      clientFeatureCardBgColor: "#F2B6B6",
      clientFeatureCardTextColor: "#48252A",
      clientCardBgColor: "#FFFFFF",
      clientCardTextColor: "#34241C",
      clientSecondaryPageBgColor: "#FFF9F6",
      clientSecondaryPageTextColor: "#34241C",
      clientSecondaryTitleBgColor: "#664B3A",
      clientSecondaryTitleTextColor: "#FFF9F6",
      clientSecondaryListBgColor: "#895F50",
      clientSecondaryListTextColor: "#FFF9F6",
      themePanelBgColor: "#FCE1DE",
      themePanelTextColor: "#34241C",
      themePanelButtonColor: "#664B3A",
      headerButtonTextColor: "#FFFFFF",
      footerAccentColor: "#F2B6B6",
      siteSwitchLoadingCardBgColor: "#FCE1DE",
      siteSwitchLoadingCardTextColor: "#48252A",
      customerServiceLauncherBgColor: "#664B3A",
      customerServiceLauncherIconColor: "#FFF9F6",
      customerServicePanelBgColor: "#FFFDFC",
      customerServicePanelHeaderBgColor: "#664B3A",
      customerServicePanelHeaderTextColor: "#FFF9F6",
      customerServiceAssistantMsgBgColor: "#FCE1DE",
      customerServiceAssistantMsgTextColor: "#48252A",
      customerServiceUserMsgBgColor: "#664B3A",
      customerServiceUserMsgTextColor: "#FFF9F6",
      customerServiceInputBorderColor: "#D49494",
      defaultDialogBgColor: "#FFF1EE",
      defaultDialogHeaderBgColor: "#664B3A",
      defaultDialogPanelBgColor: "#F8D7D3",
      defaultDialogContentBgColor: "#FFFFFF",
      defaultDialogHeaderTextColor: "#FFF9F6",
      defaultDialogButtonColor: "#664B3A",
      defaultDialogButtonTextColor: "#FFF9F6",
      globalFontWeight: DEFAULT_DESIGN_FONT_WEIGHT,
      globalLetterSpacing: DEFAULT_DESIGN_LETTER_SPACING,
    },
    sidebar: {
      bgFrom: "#38261D",
      bgVia: "#664B3A",
      bgTo: "#8B6552",
      textColor: "#FFF9F6",
      activeHighlight: "#F2B6B6",
      borderColor: "#BD8E7B",
      fontFamily: DEFAULT_DESIGN_FONT_STACK,
      fontWeight: DEFAULT_DESIGN_FONT_WEIGHT,
      letterSpacing: DEFAULT_DESIGN_LETTER_SPACING,
    },
    cardActive: { bg: "#FFF0EF", border: "#D98989", font: "#34241C", button: "#664B3A", nameFont: "#34241C" },
    cardInactive: { bg: "#FBF4F0", border: "#D2B9AC", font: "#4E382C", button: "#A77B66", nameFont: "#39281F" },
    cardHidden: { bg: "#F0ECE8", border: "#B9AAA0", font: "#67574D", button: "#887469", nameFont: "#4D4038" },
  },
];

function buildBuiltinThemeFromPalette(palette: ProductMarketThemePalette): ThemePreset {
  const statusCards = buildProductMarketFactoryStatusCards(palette);
  const sidebarGradient = buildProductMarketSidebarGradient(palette);
  const leftSelectedText = resolveAccessibleTextColor(
    palette.border,
    LEFT_SELECTED_TEXT_FALLBACK,
    "#000000",
    LEFT_SELECTED_TEXT_FALLBACK,
  );
  const rightSelectedText = resolveAccessibleTextColor(
    palette.border,
    RIGHT_SELECTED_TEXT_FALLBACK,
    "#000000",
    RIGHT_SELECTED_TEXT_FALLBACK,
  );
  const sharedLayoutGeometry = {
    frameCornerRadius: "round" as const,
    tableHeaderCornerRadius: "soft" as const,
    cardCornerRadius: "soft" as const,
    frameDensity: "standard" as const,
    frameElevation: "soft" as const,
  };

  return {
    key: palette.key,
    name: palette.name,
    description: palette.description,
    fontFamily: DEFAULT_DESIGN_FONT_STACK,
    layout: {
      headerBgColor: palette.chrome,
      headerTextColor: palette.onChrome,
      footerBgColor: palette.chrome,
      footerTextColor: palette.onChrome,
      contentBgColor: palette.surface,
      contentTextColor: palette.text,
      clientTopbarBgColor: palette.chrome,
      clientTopbarTextColor: palette.onChrome,
      // The lightweight-frame small-card default is the same semantic surface
      // as an active product card. Both editors therefore start from one
      // factory-owned background/text pair while remaining independently
      // customizable after the user changes either section.
      clientFeatureCardBgColor: statusCards.active.bg,
      clientFeatureCardTextColor: statusCards.active.nameFont,
      clientCardBgColor: palette.elevated,
      clientCardTextColor: palette.text,
      clientSecondaryPageBgColor: palette.surface,
      clientSecondaryPageTextColor: palette.text,
      clientSecondaryTitleBgColor: palette.chrome,
      clientSecondaryTitleTextColor: palette.onChrome,
      clientSecondaryListBgColor: palette.action,
      clientSecondaryListTextColor: palette.onAction,
      clientSecondaryContentBgColor: palette.surface,
      clientSecondaryContentTextColor: palette.text,
      clientLargeCardBgColor: palette.panel,
      clientLargeCardTextColor: palette.text,
      ...sharedLayoutGeometry,
      themePanelBgColor: palette.panel,
      themePanelTextColor: palette.text,
      themePanelButtonColor: palette.action,
      headerButtonTextColor: palette.onAction,
      rightSelectedFrameColor: palette.border,
      rightSelectedTextColor: rightSelectedText,
      footerAccentColor: palette.secondary,
      siteSwitchLoadingCardBgColor: palette.secondarySurface,
      siteSwitchLoadingCardTextColor: palette.text,
      customerServiceLauncherBgColor: palette.action,
      customerServiceLauncherIconColor: palette.onAction,
      customerServicePanelBgColor: palette.elevated,
      customerServicePanelHeaderBgColor: palette.chrome,
      customerServicePanelHeaderTextColor: palette.onChrome,
      customerServiceAssistantMsgBgColor: palette.secondarySurface,
      customerServiceAssistantMsgTextColor: palette.text,
      customerServiceUserMsgBgColor: palette.action,
      customerServiceUserMsgTextColor: palette.onAction,
      customerServiceInputBorderColor: palette.focus,
      defaultDialogBgColor: palette.surface,
      defaultDialogHeaderBgColor: palette.chrome,
      defaultDialogPanelBgColor: palette.panel,
      defaultDialogContentBgColor: palette.elevated,
      defaultDialogHeaderTextColor: palette.onChrome,
      defaultDialogButtonColor: palette.action,
      defaultDialogButtonTextColor: palette.onAction,
      globalFontWeight: DEFAULT_DESIGN_FONT_WEIGHT,
      globalLetterSpacing: DEFAULT_DESIGN_LETTER_SPACING,
    },
    sidebar: {
      ...sidebarGradient,
      textColor: palette.onChrome,
      activeHighlight: leftSelectedText,
      borderColor: palette.border,
      fontFamily: DEFAULT_DESIGN_FONT_STACK,
      fontWeight: DEFAULT_DESIGN_FONT_WEIGHT,
      letterSpacing: DEFAULT_DESIGN_LETTER_SPACING,
    },
    cardActive: statusCards.active,
    cardInactive: statusCards.inactive,
    cardHidden: statusCards.hidden,
  };
}

// Immutable semantic palette → UI-role projection. All four Product Market
// pages and every source-level developer console consume these same objects.
const FACTORY_BUILTIN_THEMES: ThemePreset[] = PRODUCT_MARKET_THEME_PALETTES.map(
  buildBuiltinThemeFromPalette
);

// Backward-compatible snapshot; nested objects are frozen to prevent callers
// from mutating the factory's single source of truth.
export const BUILTIN_THEME_PRESETS: readonly ThemePreset[] = Object.freeze(
  FACTORY_BUILTIN_THEMES.map((theme) =>
    Object.freeze({
      ...theme,
      layout: Object.freeze({ ...theme.layout }),
      sidebar: Object.freeze({ ...theme.sidebar }),
      cardActive: Object.freeze({ ...theme.cardActive }),
      cardInactive: Object.freeze({ ...theme.cardInactive }),
      cardHidden: Object.freeze({ ...theme.cardHidden }),
    }) as ThemePreset
  )
);

export function getDefaultSidebarStyle(): SidebarStyle {
  return { ...DEFAULT_SIDEBAR_STYLE };
}

export function getFactoryBuiltinThemes(): ThemePreset[] {
  return FACTORY_BUILTIN_THEMES.map((t) => ({
    ...t,
    layout: { ...t.layout },
    sidebar: { ...t.sidebar },
    cardActive: { ...t.cardActive },
    cardInactive: { ...t.cardInactive },
    cardHidden: { ...t.cardHidden },
  }));
}

export const ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
  { name: "LayoutDashboard", icon: LayoutDashboard },
  { name: "Bot", icon: Bot },
  { name: "FolderKanban", icon: FolderKanban },
  { name: "LineChart", icon: LineChart },
  { name: "Globe", icon: Globe },
  { name: "Package", icon: Package },
  { name: "Newspaper", icon: Newspaper },
  { name: "HardHat", icon: HardHat },
  { name: "Video", icon: Video },
  { name: "BookOpen", icon: BookOpen },
  { name: "Search", icon: Search },
  { name: "Share2", icon: Share2 },
  { name: "Megaphone", icon: Megaphone },
  { name: "BarChart3", icon: BarChart3 },
  { name: "Inbox", icon: Inbox },
  { name: "Users", icon: Users },
  { name: "Building2", icon: Building2 },
  { name: "ShieldCheck", icon: ShieldCheck },
  { name: "MessageCircle", icon: MessageCircle },
  { name: "LayoutTemplate", icon: LayoutTemplate },
  { name: "Settings", icon: Settings },
  { name: "CreditCard", icon: CreditCard },
  { name: "Puzzle", icon: Puzzle },
];

/**
 * Every catalogue item has a real factory icon before an editor chooses a
 * custom one.  The label is the first source of truth (so a “新闻模板” and a
 * “产品模板” are visibly different from their parent columns); the route hash
 * only provides a stable fallback for a newly added or unknown column.
 */
const DEFAULT_SECONDARY_ICON_NAMES = [
  "Search", "FolderKanban", "LayoutTemplate", "Globe", "Package",
  "Newspaper", "HardHat", "Video", "BookOpen", "Settings",
  "CreditCard", "Puzzle", "Inbox", "Users", "BarChart3",
  "MessageCircle", "Building2", "ShieldCheck", "Share2", "Megaphone",
] as const;

const DEFAULT_PRODUCT_MODULE_ICON_KEYWORDS: ReadonlyArray<readonly [readonly string[], string]> = [
  [["模板", "template"], "LayoutTemplate"],
  [["ai", "智能", "快发", "机器人"], "Bot"],
  [["分类", "category", "栏目"], "FolderKanban"],
  [["明细", "详情", "detail", "list"], "Search"],
  [["新闻", "文章", "news"], "Newspaper"],
  [["工程", "案例", "case"], "HardHat"],
  [["视频", "video"], "Video"],
  [["博客", "blog"], "BookOpen"],
  [["工厂", "factory"], "Settings"],
  [["公司", "企业", "关于", "company"], "Building2"],
  [["保障", "faq", "服务", "service"], "ShieldCheck"],
  [["展会", "活动", "exhibition"], "Megaphone"],
  [["物流", "货运", "logistics"], "Inbox"],
  [["联系", "客服", "im", "contact"], "MessageCircle"],
  [["多站点", "语言", "全球", "site", "language"], "Globe"],
  [["品牌", "版面", "主题"], "LayoutDashboard"],
  [["结构数据", "结构", "图谱"], "LayoutTemplate"],
  [["词图", "词", "检索"], "Search"],
  [["排名", "份额", "趋势", "指标"], "BarChart3"],
  [["监测", "引用"], "LineChart"],
  [["数字", "资产", "数据"], "BarChart3"],
  [["资料", "档案", "库"], "FolderKanban"],
  [["优化", "规划", "版图"], "LayoutDashboard"],
  [["口碑", "公关", "传播", "推广"], "Megaphone"],
  [["推荐", "聆听", "洞察"], "Bot"],
  [["图谱", "矩阵", "社媒", "社交"], "Share2"],
  [["日历", "计划", "调度"], "Settings"],
  [["分发", "投放"], "Inbox"],
  [["社群", "私域", "成员"], "Users"],
  [["市场", "分析", "增长"], "LineChart"],
  [["产品", "product"], "Package"],
];

export function getDefaultProductModuleSecondaryIconName(path: string, label = ""): string {
  const searchable = `${label} ${path}`.toLocaleLowerCase();
  const matched = DEFAULT_PRODUCT_MODULE_ICON_KEYWORDS.find(([keywords]) =>
    keywords.some((keyword) => searchable.includes(keyword)),
  );
  if (matched) return matched[1];

  let hash = 0;
  for (let index = 0; index < path.length; index += 1) {
    hash = ((hash * 31) + path.charCodeAt(index)) >>> 0;
  }
  return DEFAULT_SECONDARY_ICON_NAMES[hash % DEFAULT_SECONDARY_ICON_NAMES.length];
}

const FACTORY_PLATFORM_CATEGORY_ICONS: Record<ProductModuleCategoryKey, LucideIcon> = {
  identity: LineChart,
  content: LayoutTemplate,
  trust: Search,
  recommend: Globe,
  deepen: Share2,
  portrait: BarChart3,
  lead: Megaphone,
  convert: Inbox,
  fulfillment: Package,
  care: Users,
  decision: BarChart3,
  operations: Building2,
};

const LEGACY_CLIENT_PRODUCTS: ProductItem[] = [
  { label: "产品分析", path: "/product-analysis", status: "active", icon: LineChart, description: "围绕关键词、趋势、市场和商机，沉淀当前计划的外贸选品分析视角。", children: [
    { label: "兴趣搜索", path: "/product-analysis?tab=keyword-planner", status: "active" },
    { label: "趋势分析", path: "/product-analysis?tab=trends", status: "active" },
    { label: "数据洞察", path: "/product-analysis?tab=data-studio", status: "active" },
    { label: "全球商机", path: "/product-analysis?tab=market-finder", status: "active" },
    { label: "市场调查", path: "/product-analysis?tab=global-market", status: "active" },
  ]},
  { label: "网站风格", path: "/templates", status: "inactive", icon: LayoutTemplate, children: [
    { label: "模板库", path: "/templates?tab=library", status: "active" },
    { label: "当前风格", path: "/templates?tab=current", status: "active" },
    { label: "自定义样式", path: "/templates?tab=custom", status: "active" },
  ]},
  { label: "AI 智能", path: "/ai-chat", status: "active", icon: Bot, children: [
    { label: "AI 建站", path: "/ai-chat", status: "active" },
    { label: "智能客服", path: "/ai-customer-service", status: "active" },
  ]},
  { label: "已创计划", path: "/projects", status: "active", icon: FolderKanban },
  { label: "网址域名", path: "/site-settings?tab=domains", status: "active", icon: Link2, description: "管理域名注册、绑定解析和域名转出的统一入口。", children: [
    { label: "域名注册", path: "/site-settings?tab=domain-register", status: "active" },
    { label: "绑定解析", path: "/site-settings?tab=domain-binding", status: "active" },
    { label: "域名转出", path: "/site-settings?tab=domain-transfer", status: "active" },
  ]},
  { label: "服务概览", path: "/", status: "active", icon: LayoutDashboard },
  { label: "企业资料", path: "/company-info", status: "active", icon: Building2, children: [
    { label: "基本资料", path: "/company-info?tab=profile", status: "active" },
    { label: "自定义模块", path: "/company-info?tab=modules", status: "active" },
  ]},
  { label: "首页设计", path: "/company-info?tab=navigation", status: "active", icon: LayoutTemplate, children: [
    { label: "导航栏自定义", path: "/company-info?tab=navigation", status: "active", description: "网站导航结构，支持一级导航和外层二级导航，同步影响网站预览。" },
    { label: "首页 Banner", path: "/company-info?tab=banner", status: "active" },
    { label: "产品推荐", path: "/company-info?tab=recommend", status: "active" },
  ]},
  { label: "产品管理", path: "/products", status: "active", icon: Package, children: [
    { label: "产品列表", path: "/products?tab=list", status: "active" },
    { label: "分类管理", path: "/products?tab=category", status: "active" },
    { label: "文章管理", path: "/products?tab=article", status: "active" },
  ]},
  { label: "新闻中心", path: "/news", status: "active", icon: Newspaper, children: [
    { label: "新闻明细", path: "/news?tab=list", status: "active" },
    { label: "新闻分类", path: "/news?tab=category", status: "active" },
    { label: "新闻模板", path: "/news?tab=template", status: "active" },
  ]},
  { label: "工程案例", path: "/cases", status: "active", icon: HardHat, children: [
    { label: "工程明细", path: "/cases?tab=list", status: "active" },
    { label: "工程分类", path: "/cases?tab=category", status: "active" },
    { label: "工程模板", path: "/cases?tab=template", status: "active" },
  ]},
  { label: "企业视频", path: "/videos", status: "inactive", icon: Video, children: [
    { label: "视频列表", path: "/videos?tab=list", status: "active" },
    { label: "视频分类", path: "/videos?tab=category", status: "active" },
    { label: "视频授权同步", path: "/videos?tab=sync", status: "active" },
  ]},
  { label: "博客优化", path: "/blog", status: "inactive", icon: BookOpen, children: [
    { label: "博客列表", path: "/blog?tab=list", status: "active" },
    { label: "博客分类", path: "/blog?tab=category", status: "active" },
    { label: "博客模板", path: "/blog?tab=template", status: "active" },
  ]},
  { label: "关于我们", path: "/company-info?tab=about", status: "active", icon: Building2, children: [
    { label: "公司介绍", path: "/company-info?tab=about", status: "active" },
    { label: "工厂生产", path: "/company-info?tab=factory", status: "active" },
    { label: "公司风采", path: "/company-info?tab=gallery", status: "active" },
  ]},
  { label: "服务保障", path: "/company-info?tab=service", status: "active", icon: ShieldCheck, children: [
    { label: "FAQ", path: "/company-info?tab=faq", status: "active" },
    { label: "展会活动", path: "/company-info?tab=exhibition", status: "active" },
    { label: "物流货运", path: "/company-info?tab=logistics", status: "active" },
  ]},
  { label: "联系我们", path: "/company-info?tab=im", status: "active", icon: MessageCircle, children: [
    { label: "IM 客服", path: "/company-info?tab=im", status: "active" },
  ]},
  { label: "站点设置", path: "/site-settings", status: "active", icon: Settings, children: [
    { label: "站点设置", path: "/site-settings?tab=general", status: "active" },
    { label: "重定向", path: "/site-settings?tab=redirect", status: "active" },
  ]},
  { label: "SEO 优化", path: "/seo", status: "inactive", icon: Search, children: [
    { label: "关键词", path: "/seo?tab=keywords", status: "active" },
    { label: "排名追踪", path: "/seo?tab=ranking", status: "active" },
    { label: "SEO 文章", path: "/seo?tab=articles", status: "active" },
    { label: "站点审计", path: "/seo?tab=audit", status: "active" },
    { label: "Meta 管理", path: "/seo?tab=meta", status: "active" },
    { label: "外链分析", path: "/seo?tab=backlinks", status: "active" },
    { label: "内链规则", path: "/seo?tab=internal", status: "active" },
    { label: "死链检测", path: "/seo?tab=deadlinks", status: "active" },
    { label: "关键词密度", path: "/seo?tab=density", status: "active" },
    { label: "TDK 模板", path: "/seo?tab=tdk", status: "active" },
    { label: "关键词挖掘", path: "/seo?tab=mining", status: "active" },
  ]},
  { label: "GEO 中心", path: "/geo-center", status: "inactive", icon: Globe, children: [
    { label: "优化词", path: "/geo-center?tab=keywords", status: "active" },
    { label: "内容策略", path: "/geo-center?tab=strategy", status: "active" },
    { label: "多语搜索", path: "/geo-center?tab=multilang", status: "active" },
    { label: "文章创作", path: "/geo-center?tab=writing", status: "active" },
    { label: "创作记录", path: "/geo-center?tab=records", status: "active" },
    { label: "发布计划", path: "/geo-center?tab=schedule", status: "active" },
    { label: "发布记录", path: "/geo-center?tab=publish-history", status: "active" },
    { label: "大模型报表", path: "/geo-center?tab=llm-reports", status: "active" },
    { label: "权威媒体", path: "/geo-center?tab=authority-media", status: "active" },
  ]},
  { label: "社交媒体", path: "/social", status: "inactive", icon: Share2, children: createClientSocialMediaWorkflowChildren() },
  { label: "智能推广", path: "/smart-ads", status: "inactive", icon: Megaphone, children: [
    { label: "推广概览", path: "/smart-ads?tab=overview", status: "active" },
    { label: "广告平台", path: "/smart-ads?tab=platforms", status: "active" },
    { label: "推广活动", path: "/smart-ads?tab=campaigns", status: "active" },
    { label: "跨平台对比", path: "/smart-ads?tab=compare", status: "active" },
  ]},
  { label: "询盘管理", path: "/inquiries", status: "inactive", icon: Inbox, children: [
    { label: "询盘列表", path: "/inquiries?tab=list", status: "active" },
    { label: "表单配置", path: "/inquiries?tab=form", status: "active" },
    { label: "回复模板", path: "/inquiries?tab=template", status: "active" },
    { label: "分配规则", path: "/inquiries?tab=rules", status: "active" },
    { label: "垃圾黑名单", path: "/inquiries?tab=blacklist", status: "active" },
  ]},
  { label: "数据报表", path: "/reports", status: "inactive", icon: BarChart3, children: [
    { label: "流量概况", path: "/reports?tab=overview", status: "active" },
    { label: "流量来源", path: "/reports?tab=source", status: "active" },
    { label: "地域分布", path: "/reports?tab=region", status: "active" },
    { label: "受访页面", path: "/reports?tab=pages", status: "active" },
    { label: "日访问量", path: "/reports?tab=daily", status: "active" },
    { label: "访客时间", path: "/reports?tab=time", status: "active" },
    { label: "访问明细", path: "/reports?tab=details", status: "active" },
    { label: "浏览占比", path: "/reports?tab=browser", status: "active" },
    { label: "系统占比", path: "/reports?tab=system", status: "active" },
    { label: "设备占比", path: "/reports?tab=device", status: "active" },
    { label: "SEO 明细", path: "/reports?tab=seo", status: "active" },
    { label: "流量分类", path: "/reports?tab=classification", status: "active" },
  ]},
  { label: "CRM 管理", path: "/customers", status: "inactive", icon: Users, children: [
    { label: "工作汇总", path: "/customers?tab=summary", status: "active" },
    { label: "商机数据", path: "/customers?tab=opportunities", status: "active" },
    { label: "客户公海", path: "/customers?tab=pool", status: "active" },
    { label: "客户管理", path: "/customers?tab=clients", status: "active" },
    { label: "邮件管理", path: "/customers?tab=emails", status: "active" },
    { label: "文件夹管理", path: "/customers?tab=folders", status: "active" },
    { label: "邮件营销", path: "/customers?tab=marketing", status: "active" },
  ]},
  { label: "健康驾舱", path: "/health-cockpit", status: "active", icon: BarChart3, children: [
    { label: "内容健度", path: "/health-cockpit?tab=content", status: "active" },
    { label: "宣传健度", path: "/health-cockpit?tab=promotion", status: "active" },
    { label: "流量健度", path: "/health-cockpit?tab=traffic", status: "active" },
    { label: "资产健度", path: "/health-cockpit?tab=assets", status: "active" },
  ]},
];

const FACTORY_PLATFORM_LEGACY_SECONDARY_PATHS: Partial<Record<string, readonly string[]>> = {
  "identity.digital-assets": ["/ai-chat", "/site-settings?tab=domains"],
  "content.company": ["/company-info?tab=about", "/company-info?tab=service", "/company-info?tab=im"],
  "content.proof": ["/news", "/videos", "/blog"],
  "content.dam-localization": ["/site-settings"],
};

const LEGACY_DEFAULT_NAVIGATION_LABELS = new Set(
  LEGACY_CLIENT_PRODUCTS.flatMap((product) => [
    product.label,
    ...(product.children || []).map((child) => child.label),
  ]).concat(["多语言SEO"]).map((label) => label.replace(/\s+/gu, "").toLocaleLowerCase()),
);

function buildFactoryPlatformProducts(): ProductItem[] {
  const legacyByPath = new Map(LEGACY_CLIENT_PRODUCTS.map((product) => [product.path, product] as const));
  return FACTORY_PLATFORM_CATEGORIES.flatMap((category) =>
    category.applications.map((application) => {
      const legacy = legacyByPath.get(application.route);
      const existingChildren = legacy?.children?.map((child) => ({
            ...child,
            label: buildFactoryPlatformFourCharacterLabel(child.label),
            description: child.description || child.label,
          })) || [];
      const migratedLegacyChildren = (FACTORY_PLATFORM_LEGACY_SECONDARY_PATHS[application.id] || [])
        .map((path) => legacyByPath.get(path))
        .filter((item): item is ProductItem => Boolean(item))
        .map((item) => ({
          label: buildFactoryPlatformFourCharacterLabel(item.label),
          path: item.path,
          status: item.status,
          description: item.description || item.label,
        }));
      const plannedChildren = application.navigationChildren.map((child) => ({
            label: child.label,
            path: child.route,
            status: "active" as ProductStatus,
            description: child.fullLabel,
          }));
      const children = existingChildren.length || migratedLegacyChildren.length
        ? [...existingChildren, ...migratedLegacyChildren]
        : plannedChildren;
      return {
        ...legacy,
        label: application.navigationLabel,
        path: application.route,
        // A newly created source catalogue must not render a commercially
        // accepted application as closed.  Explicit later open/cancel/hide
        // choices are retained from the saved snapshot below.
        status: legacy?.status || (application.deliveryStatus === "planned" ? "inactive" : "active"),
        deliveryStatus: application.deliveryStatus,
        icon: legacy?.icon || FACTORY_PLATFORM_CATEGORY_ICONS[category.key],
        description: application.value,
        children,
      };
    }),
  );
}

/**
 * Platform Blueprint is the single catalogue source. Column Configuration,
 * Operations Market, Sidebar and the page-lock hierarchy consume this exact
 * 12-category / 72-primary projection instead of maintaining local copies.
 */
export const ALL_PRODUCTS: ProductItem[] = buildFactoryPlatformProducts();

const FACTORY_BLUEPRINT_PRODUCT_PATHS = ALL_PRODUCTS.map((product) => product.path);
// Website-content editors are source-owned real routes.  They predate the
// factory platform but are not retired legacy applications, so client-source
// imports must never remove them while filtering old navigation shadows.
// This set is deliberately derived from the shared 02.布场 protection
// contract.  During a baseline migration, content sub-routes must be retained
// even though their parent application has moved into the 72-app blueprint.
// Do not replace it with a local list: that would reintroduce accidental
// removal when a new content programme is registered.
const RETAINED_CLIENT_SOURCE_CONTENT_PATHS = new Set(
  FACTORY_PLATFORM_CONTENT_PROGRAM_PROTECTION
    .map((program) => program.route)
    .filter((route) => !FACTORY_BLUEPRINT_PRODUCT_PATHS.includes(route)),
);
const RETIRED_LEGACY_PRIMARY_PATHS = new Set([
  ...LEGACY_CLIENT_PRODUCTS
    .map((product) => product.path)
    .filter((path) =>
      !FACTORY_BLUEPRINT_PRODUCT_PATHS.includes(path)
      && !RETAINED_CLIENT_SOURCE_CONTENT_PATHS.has(path)
      && !isFactoryPlatformProtectedContentRoute(path),
    ),
  // CPQ graduated from a blueprint placeholder to its governed pilot route.
  // Removing the old key during baseline migration prevents duplicate menu
  // entries and synchronizes Column/Operations/Sidebar to /cpq-quotes.
  "/product-market?tab=blueprint&category=convert&app=cpq-contract",
  // Global Delivery graduated to the authoritative order/fulfillment route.
  "/product-market?tab=blueprint&category=fulfillment&app=delivery",
  // Customer Success graduated to the installed-base and service workspace.
  "/product-market?tab=blueprint&category=care&app=customer-success",
  // PLM graduated to the engineering-version and product-passport workspace.
  "/product-market?tab=blueprint&category=fulfillment&app=plm",
  // QMS graduated to the governed inspection, NCR/CAPA and release workspace.
  "/product-market?tab=blueprint&category=fulfillment&app=qms",
  // SRM graduated to supplier qualification, purchase approval and receiving.
  "/product-market?tab=blueprint&category=fulfillment&app=srm",
  // S&OP/MRP/APS graduated to finite-capacity production planning.
  "/product-market?tab=blueprint&category=fulfillment&app=planning",
  // MES graduated to traceable manufacturing work orders and shop-floor reporting.
  "/product-market?tab=blueprint&category=fulfillment&app=mes",
  // Field Service graduated to governed dispatch, onsite evidence and customer sign-off.
  "/product-market?tab=blueprint&category=care&app=service-sla",
  // Warranty/RMA graduated to governed eligibility, return, inspection and remedy evidence.
  "/product-market?tab=blueprint&category=care&app=warranty-rma",
  // Partner Voice graduated to partner approval, academy, VOC/NPS and consented advocacy.
  "/product-market?tab=blueprint&category=care&app=partner-voice",
  // Health Cockpit graduated to governed authority snapshots and responsibility closure.
  "/product-market?tab=blueprint&category=decision&app=cockpit",
  // Data Warehouse graduated to governed source, quality, lineage and publication controls.
  "/product-market?tab=blueprint&category=decision&app=data-warehouse",
  // Metric Semantics graduated to governed definitions, immutable versions and independently verified calculations.
  "/product-market?tab=blueprint&category=decision&app=metrics",
  // Revenue Profit graduated to governed touchpoint evidence, warehouse fact bindings and independently published contribution analysis.
  "/product-market?tab=blueprint&category=decision&app=revenue-profit",
  // Forecast graduated to governed six-source snapshots and independently published rolling demand/capacity/cash results.
  "/product-market?tab=blueprint&category=decision&app=forecast",
  // AI Command graduated to cited questions, pinned scenarios, independent recommendation approval and business handoff.
  "/product-market?tab=blueprint&category=decision&app=ai-command",
  // ERP graduated to governed operating-unit, order-project, immutable posting and period-close controls.
  "/product-market?tab=blueprint&category=operations&app=erp",
  // Finance graduated to formal accrual books, governed source documents, balanced journals and independent close.
  "/product-market?tab=blueprint&category=operations&app=finance",
  // HR People graduated to governed people master, employment, time, performance and training controls.
  "/product-market?tab=blueprint&category=operations&app=people",
  // Recruiting graduated to consented candidates, structured interviews, human decisions and accepted-offer HR handoffs.
  "/product-market?tab=blueprint&category=operations&app=recruiting",
  // Approval Center graduated to pinned source revisions, ordered independent reviews, scoped delegation and explicit domain handoffs.
  "/product-market?tab=blueprint&category=operations&app=approvals",
  // Contract Legal graduated to governed parties, immutable templates, independent review, seal, signature and obligations.
  "/product-market?tab=blueprint&category=operations&app=contracts",
  // ICP graduated to immutable definitions, pinned evidence, explainable scoring and acknowledged activations.
  "/product-market?tab=blueprint&category=identity&app=icp",
  // DAM Localization graduated to governed rights, terminology, quality review and country-pack handoffs.
  "/product-market?tab=blueprint&category=content&app=dam-localization",
  // Enterprise Knowledge Graph graduated to source-pinned entities, independently verified relations and immutable publication.
  "/product-market?tab=blueprint&category=recommend&app=knowledge-graph",
  // Structured Data graduated to graph-pinned Schema mappings, validation, immutable JSON-LD releases and consumer acknowledgement.
  "/product-market?tab=blueprint&category=recommend&app=structured-data",
  // Channel Feed graduated to source-pinned product projections, governed credentials, validation, immutable releases and acknowledgements.
  "/product-market?tab=blueprint&category=recommend&app=channel-feed",
  // Identity Resolution graduated to consent-bound hashes, independent matching decisions and immutable golden-profile handoffs.
  "/product-market?tab=blueprint&category=portrait&app=identity-resolution",
  // Account Graph graduated to source-pinned enterprise, contact, opportunity and order relations with immutable handoffs.
  "/product-market?tab=blueprint&category=portrait&app=account-graph",
  // Buying Committee graduated to opportunity-pinned, consented-contact, ICP-role and independently verified influence paths.
  "/product-market?tab=blueprint&category=portrait&app=buying-committee",
  // Customer Timeline graduated to five source-pinned events, independent verification and immutable handoffs.
  "/reports?tab=details",
  // Segments & Consent graduated to consent-bound deterministic membership, independent verification and immutable activations.
  "/product-market?tab=blueprint&category=portrait&app=segments-consent",
  // Enterprise Targeting graduated to consent-safe accounts, complete buying-role plays and immutable activations.
  "/product-market?tab=blueprint&category=lead&app=abm",
  // Creative Center graduated to rights-safe role variants, human approval and immutable channel activations.
  "/product-market?tab=blueprint&category=lead&app=creative",
  "/product-market?tab=blueprint&category=convert&app=ai-sdr",
  "/product-market?tab=blueprint&category=convert&app=rfq-sample",
  "/product-market?tab=blueprint&category=convert&app=commerce",
  "/customers?tab=opportunities",
]);

export function isRetiredFactoryPlatformPrimaryPath(path: string) {
  return RETIRED_LEGACY_PRIMARY_PATHS.has(path);
}

export function isLegacyFactoryPlatformDefaultLabel(label: string) {
  return LEGACY_DEFAULT_NAVIGATION_LABELS.has(label.replace(/\s+/gu, "").toLocaleLowerCase());
}

/**
 * The three development workspaces share the same editor, but not the same
 * application catalogue.  Keeping these records here makes a published
 * snapshot self-describing and prevents an agency source from inheriting the
 * customer-website menu by accident.
 */
function createClientSocialMediaWorkflowChildren(): ProductChildItem[] {
  return [
    { label: "痛点路线", path: "/social?tab=customer-roadmap", status: "active" },
    ...FACTORY_PLATFORM_SOCIAL_WORKSPACES.map((workspace) => ({
      label: workspace.label,
      path: workspace.route,
      status: "active" as ProductStatus,
      description: `${workspace.customerPain} ${workspace.customerValue}`,
    })),
  ];
}

const AGENCY_SOCIAL_GOVERNANCE_CHILDREN: ProductChildItem[] = [
  { label: "内容审核", path: "/social-content-reviews", status: "active", description: "审核客户源提交的社媒内容；真实运行工作区仍归属客户源。" },
];

const HQ_SOCIAL_GOVERNANCE_CHILDREN: ProductChildItem[] = [
  { label: "账号授权", path: "/social-authorization", status: "active", description: "检查官方账号授权与凭据引用准备度。" },
  { label: "内容审核", path: "/social-content-reviews", status: "active", description: "执行总部社媒内容复核与放行。" },
  { label: "发布交付", path: "/social-publish-delivery", status: "active", description: "检查外部发布基础设施与连接器安全门禁。" },
];

export const AGENCY_SOURCE_PRODUCTS: ProductItem[] = [
  { label: "仪表盘", path: "/", status: "active", icon: LayoutDashboard, description: "代理源的首页经营总览。" },
  { label: "代理工作台", path: "/workspace", status: "active", icon: LayoutDashboard, description: "代理商日常经营、待办和关键经营指标。" },
  { label: "社交媒体", path: "/social-content-reviews", status: "active", icon: Share2, description: "维护客户源社媒工作流的代理审核投影；真实运行工作区归属客户源。", children: AGENCY_SOCIAL_GOVERNANCE_CHILDREN },
  { label: "合伙人列表", path: "/partners", status: "active", icon: Users, description: "管理代理源的合作伙伴关系。" },
  { label: "充值审核", path: "/recharge-audit", status: "active", icon: CreditCard, description: "审核代理源内的充值申请。" },
  { label: "外贸企业管理", path: "/enterprises", status: "active", icon: Building2, description: "管理代理名下外贸企业及其服务状态。" },
  { label: "客户管理", path: "/customers", status: "active", icon: Users, description: "沉淀客户资料、跟进状态与服务关系。" },
  { label: "站点管理", path: "/sites", status: "active", icon: Globe, description: "查看客户站点、域名和计划状态。" },
  { label: "订单管理", path: "/orders", status: "active", icon: CreditCard, description: "管理代理订单、续费和服务交付。" },
  { label: "客户报备", path: "/reports", status: "active", icon: Inbox, description: "管理客户报备、归属与审批记录。" },
  { label: "公海池", path: "/public-pool", status: "active", icon: Share2, description: "维护可分配商机与客户资源。" },
  { label: "业务数据", path: "/business-data", status: "active", icon: BarChart3, description: "查看代理团队的经营与转化数据。" },
  { label: "SEO 任务与工具", path: "/seo-tasks", status: "active", icon: Search, description: "提供代理可用的 SEO 执行工具。" },
  { label: "SEO 博客", path: "/seo-blogs", status: "inactive", icon: Newspaper, description: "维护代理内容运营与引流资源。" },
  { label: "成员管理", path: "/members", status: "active", icon: Users, description: "维护代理团队成员与协作范围。" },
  { label: "角色管理", path: "/roles", status: "active", icon: ShieldCheck, description: "配置代理端角色与可操作权限。" },
  { label: "配额管理", path: "/quotas", status: "active", icon: Settings, description: "配置客户、站点、素材和服务配额。" },
  { label: "绩效统计", path: "/performance", status: "active", icon: LineChart, description: "跟踪团队目标、业绩和服务效率。" },
  { label: "客户计划", path: "/plans", status: "active", icon: FolderKanban, description: "为客户分配和管理独立计划。" },
  { label: "钱包管理", path: "/wallet", status: "active", icon: CreditCard, description: "查看佣金、余额和资金流水。" },
  { label: "注册链接", path: "/invite-links", status: "active", icon: Link2, description: "生成客户注册与归属链接。" },
  { label: "OEM 设置", path: "/oem-settings", status: "active", icon: LayoutTemplate, description: "维护代理品牌、商标和平台外观。" },
  { label: "代理源发布", path: "/releases", status: "active", icon: Package, description: "将代理源配置按版本发布并下发到代理端。" },
];

export const HQ_PRODUCTS: ProductItem[] = [
  { label: "总部仪表盘", path: "/", status: "active", icon: LayoutDashboard, description: "总部平台经营与风险总览。" },
  { label: "平台代理商", path: "/agencies", status: "active", icon: Users, description: "管理代理层级、分佣、折扣和版本同步。" },
  { label: "社交媒体", path: "/social-authorization", status: "active", icon: Share2, description: "维护社媒授权、内容审核与发布交付治理；真实运行工作区归属客户源。", children: HQ_SOCIAL_GOVERNANCE_CHILDREN },
  { label: "平台成员", path: "/members", status: "active", icon: Users, description: "维护总部成员、部门与工作权限。" },
  { label: "角色与部门", path: "/roles", status: "active", icon: ShieldCheck, description: "管理总部角色、权限及组织规则。" },
  { label: "企业与站点", path: "/enterprises", status: "active", icon: Building2, description: "统一查看企业、站点和域名资产。" },
  { label: "模板与素材", path: "/templates", status: "active", icon: LayoutTemplate, description: "维护可发布的模板、素材和基础能力。" },
  { label: "AI 服务中心", path: "/ai-vendors", status: "active", icon: Bot, description: "管理 AI 供应商、模型、调用与成本。" },
  { label: "套餐与订单", path: "/plans", status: "active", icon: Package, description: "管理套餐、订单、续费和财务规则。" },
  { label: "运营推广", path: "/announcements", status: "active", icon: Megaphone, description: "维护公告、活动、客户运营与自动化。" },
  { label: "平台设置", path: "/platform-config", status: "active", icon: Settings, description: "维护平台配置、支付、预警与通知。" },
  { label: "模板源管理", path: "/agency-source", status: "active", icon: Puzzle, description: "进入代理源、客户源并控制发布链路。" },
  { label: "审计与恢复", path: "/audit-logs", status: "active", icon: BarChart3, description: "查看发布审计、备份与恢复演练。" },
  { label: "部门管理", path: "/depts", status: "active", icon: Users, description: "维护总部部门和组织分工。" },
  { label: "代理源发布", path: "/agency-source/releases", status: "active", icon: Package, description: "管理代理源版本审核、灰度和下发。" },
  { label: "充值审核", path: "/recharge-audit", status: "active", icon: CreditCard, description: "审核平台充值申请。" },
  { label: "OEM 审核", path: "/oem-audit", status: "active", icon: LayoutTemplate, description: "审核代理品牌与 OEM 配置。" },
  { label: "站点列表", path: "/sites", status: "active", icon: Globe, description: "查看平台站点资产。" },
  { label: "域名管理", path: "/domains", status: "active", icon: Link2, description: "管理域名与解析资产。" },
  { label: "图库", path: "/gallery", status: "active", icon: Puzzle, description: "维护平台图片素材。" },
  { label: "模型分配", path: "/ai-models", status: "active", icon: Bot, description: "配置 AI 模型使用范围。" },
  { label: "调用日志", path: "/ai-logs", status: "active", icon: FileTextIcon, description: "查看 AI 调用与审计记录。" },
  { label: "成本看板", path: "/ai-cost", status: "active", icon: BarChart3, description: "查看 AI 服务成本。" },
  { label: "模型市场", path: "/ai-square", status: "active", icon: Package, description: "浏览可用 AI 模型。" },
  { label: "钱包管理", path: "/wallet", status: "active", icon: CreditCard, description: "管理平台资金账户。" },
  { label: "加油包管理", path: "/boosters", status: "active", icon: Package, description: "管理加油包和增值服务。" },
  { label: "兑换码管理", path: "/coupons", status: "active", icon: Puzzle, description: "管理兑换码资源。" },
  { label: "积分配置", path: "/points", status: "active", icon: Settings, description: "维护积分规则。" },
  { label: "订单列表", path: "/orders", status: "active", icon: CreditCard, description: "查看平台订单。" },
  { label: "订单审核", path: "/order-audit", status: "active", icon: FileTextIcon, description: "审核平台订单。" },
  { label: "自动续费", path: "/auto-renew", status: "active", icon: Settings, description: "配置自动续费规则。" },
  { label: "退款管理", path: "/refunds", status: "active", icon: CreditCard, description: "处理退款申请。" },
  { label: "发票管理", path: "/invoices", status: "active", icon: FileTextIcon, description: "管理发票与开具记录。" },
  { label: "促销活动", path: "/promotions", status: "active", icon: Megaphone, description: "管理营销促销活动。" },
  { label: "分组管理", path: "/groups", status: "active", icon: FolderKanban, description: "维护运营分组。" },
  { label: "客户满意度", path: "/csat", status: "active", icon: MessageCircle, description: "查看客户满意度反馈。" },
  { label: "问答计划", path: "/qa-plans", status: "active", icon: FileTextIcon, description: "管理问答运营计划。" },
  { label: "问答任务", path: "/qa-tasks", status: "active", icon: FileTextIcon, description: "管理问答执行任务。" },
  { label: "询盘自动化", path: "/inquiry-auto", status: "active", icon: Inbox, description: "配置询盘自动化规则。" },
  { label: "TDK 规则配置", path: "/tdk-rules", status: "active", icon: Search, description: "维护 SEO TDK 规则。" },
  { label: "SEO 引流博客", path: "/seo-blogs", status: "active", icon: BookOpen, description: "管理 SEO 引流内容。" },
  { label: "通知配置", path: "/notify-config", status: "active", icon: MessageCircle, description: "配置平台通知。" },
  { label: "邮件配置", path: "/email-config", status: "active", icon: MessageCircle, description: "配置邮件服务。" },
  { label: "到期提醒", path: "/expiring", status: "active", icon: Settings, description: "配置到期提醒。" },
  { label: "客户端设置", path: "/kh-style-settings", status: "active", icon: Globe, description: "维护客户端默认设置。" },
  { label: "素材资源", path: "/material-assets", status: "active", icon: Puzzle, description: "维护可共享素材资源。" },
  { label: "平台架构", path: "/platform-architecture", status: "active", icon: LayoutTemplate, description: "查看平台架构与部署关系。" },
  { label: "支付渠道", path: "/payment-channels", status: "active", icon: CreditCard, description: "配置支付渠道。" },
  { label: "告警规则", path: "/alerts", status: "active", icon: Settings, description: "维护告警规则。" },
  { label: "客户源", path: "/client-source", status: "active", icon: Globe, description: "进入客户源模板工作区。" },
];

function cloneCatalogProducts(products: ProductItem[]) {
  return products.map((product) => ({
    ...product,
    customStyle: product.customStyle ? { ...product.customStyle } : undefined,
    children: cloneProductChildren(product.children),
  }));
}

export function normalizeProductMarketCatalogScope(value?: string | null): ProductMarketCatalogScope {
  return value === "hq" || value === "agency_source" || value === "client_source" || value === "agency" || value === "client"
    ? value
    : "client";
}

export function getProductMarketCatalogProducts(scope: ProductMarketCatalogScope) {
  if (scope === "hq") return cloneCatalogProducts(HQ_PRODUCTS);
  if (scope === "agency_source" || scope === "agency") return cloneCatalogProducts(AGENCY_SOURCE_PRODUCTS);
  return cloneCatalogProducts(ALL_PRODUCTS);
}

export function getProductMarketCatalogDefaultPaths(scope: ProductMarketCatalogScope) {
  return getProductMarketCatalogProducts(scope)
    .filter((product) => product.status === "active")
    .map((product) => product.path);
}

/**
 * 栏目配置和运营市场共用的默认业务路线。分类从“01.蓄势(身份)”
 * 正序推进到“12.固本(经营)”，每个分类内继续使用稳定的应用路径。
 * 自定义栏目不在此基线内，会保留在用户已有排序的末尾。
 */
export const PRODUCT_MODULE_BASELINE_VERSION = 52;
// Availability promotion is also a navigation-baseline migration: prior source
// snapshots must not retain the old /projects entry or make an accepted app
// look unavailable after an administrator opens it in Operations Market.
const FACTORY_PLATFORM_GRADUATED_PILOT_PATHS = new Set(["/cpq-quotes", "/fulfillment-orders", "/customer-assets", "/product-passports", "/quality-inspections", "/procurement", "/production-plans", "/manufacturing-execution", "/field-service", "/warranty-rma", "/renewal-growth", "/partner-voice", "/health-cockpit", "/data-warehouse", "/metric-center", "/revenue-profit", "/forecast", "/ai-command", "/erp", "/finance", "/people", "/recruiting", "/approval-center", "/contract-legal", "/icp-profiles", "/brand-studio", "/digital-assets", "/dam-localization", "/knowledge-graph", "/structured-data", "/channel-feed", "/identity-resolution", "/account-graph", "/buying-committee", "/customer-timeline", "/segments-consent", "/abm", "/creative-center", "/ai-sdr", "/rfq-samples", "/commerce"]);
// Version 49 repairs only source snapshots that were already moved to v48
// before digital-assets completed its real release gate.  It runs once, then
// preserves every subsequent customer decision to open, cancel or hide it.
const FACTORY_PLATFORM_BASELINE_49_AVAILABILITY_REPAIRS = new Set(["/digital-assets"]);
// Version 51 promotes the governed CRM source-of-record after its tenant,
// audit and independent-stage workflow became commercially available. This
// one-time migration repairs old saved source snapshots that still retained
// the former pilot's inactive navigation state.
const FACTORY_PLATFORM_BASELINE_51_AVAILABILITY_REPAIRS = new Set(["/customers"]);
// Version 50 is an explicit protected-content route migration.  The old `/`
// catalogue entry represented content.cms; `/` itself remains the client
// homepage, while all saved CMS status/style choices move to its real route.
const FACTORY_PLATFORM_BASELINE_50_CONTENT_CMS_ROUTE = "/site-management";
function migrateFactoryContentCmsPath(path: string, previousBaselineVersion: number) {
  return previousBaselineVersion < 50 && path === "/" ? FACTORY_PLATFORM_BASELINE_50_CONTENT_CMS_ROUTE : path;
}

function shouldActivateFactoryPlatformPathForBaseline(path: string, previousBaselineVersion: number) {
  return (previousBaselineVersion < 48 && FACTORY_PLATFORM_GRADUATED_PILOT_PATHS.has(path))
    || (previousBaselineVersion < 49 && FACTORY_PLATFORM_BASELINE_49_AVAILABILITY_REPAIRS.has(path))
    || (previousBaselineVersion < 51 && FACTORY_PLATFORM_BASELINE_51_AVAILABILITY_REPAIRS.has(path));
}

export function isFactoryPlatformGraduatedPilotPath(path: string) {
  return FACTORY_PLATFORM_GRADUATED_PILOT_PATHS.has(path);
}
export const PRODUCT_MODULE_BASELINE_PATHS = FACTORY_PLATFORM_CATEGORIES.flatMap((category) =>
  category.applications.map((application) => application.route),
);

/**
 * Social navigation is a customer-conversion workflow, not a list of
 * unrelated tools. Every source and runtime reads this order.
 */
const SOCIAL_MEDIA_CHILD_WORKFLOW_PATHS = [
  "/social?tab=customer-roadmap",
  ...FACTORY_PLATFORM_SOCIAL_WORKSPACES.map((workspace) => workspace.route),
] as const;

const RETIRED_SOCIAL_CAPABILITY_TABS = new Set([
  "accounts",
  "schedule",
  "create",
  "analytics",
  "automation",
  "digital-human",
]);

function isRetiredSocialCapabilityPath(path: string) {
  try {
    const route = new URL(path, "https://factory-platform.local");
    return route.pathname === "/social"
      && RETIRED_SOCIAL_CAPABILITY_TABS.has(route.searchParams.get("tab") || "")
      && /^\d+$/u.test(route.searchParams.get("capability") || "");
  } catch {
    return false;
  }
}

const LEGACY_SOCIAL_MEDIA_CHILD_LABELS_BY_PATH: Record<string, readonly string[]> = {
  "/social?tab=customer-roadmap": ["客户痛点路线"],
  "/social?tab=dashboard": ["社媒概览"],
  "/social?tab=accounts": ["账号管理"],
  "/social?tab=digital-human": ["数字人视频"],
  "/social?tab=schedule": ["发布计划"],
  "/social?tab=automation": ["自动化规则"],
  "/social?tab=analytics": ["互动分析"],
};

/** Retired duplicate entries. Their responsibilities now belong to 发布中心 / 互动转化. */
const RETIRED_SOCIAL_MEDIA_CHILD_PATHS = new Set([
  "/social?tab=publish",
  "/social?tab=comments",
]);

function applyProductModuleBaselineOrder<T extends { path: string }>(items: T[]): T[] {
  const byPath = new Map(items.map((item) => [item.path, item]));
  const baselineItems = PRODUCT_MODULE_BASELINE_PATHS
    .map((path) => byPath.get(path))
    .filter(Boolean) as T[];
  const baselinePaths = new Set(PRODUCT_MODULE_BASELINE_PATHS);
  return [...baselineItems, ...items.filter((item) => !baselinePaths.has(item.path))];
}

function applyProductModuleBaselinePaths(
  paths: readonly string[],
  assignments?: Record<string, string> | null,
): string[] {
  const availableCategoryKeys = new Set<string>(PRODUCT_MODULE_CATEGORY_ORDER);
  // The cleaner may receive a route with harmless query parameters reordered
  // or appended by a source workspace. Protected 02 content programmes are
  // never candidates for removal, even if a legacy set is expanded later.
  const sourcePaths = dedupeProductOrderPaths(paths).filter(
    (path) => isFactoryPlatformProtectedContentRoute(path) || !RETIRED_LEGACY_PRIMARY_PATHS.has(path),
  );
  const sourcePathSet = new Set(sourcePaths);

  const pathsByCategory = new Map<ProductModuleCategoryKey, string[]>(
    PRODUCT_MODULE_CATEGORY_ORDER.map((key) => [key, []]),
  );
  const uncategorizedPaths: string[] = [];

  sourcePaths.forEach((path) => {
    const assignedKey = assignments?.[path];
    const categoryKey = assignedKey && availableCategoryKeys.has(assignedKey)
      ? assignedKey as ProductModuleCategoryKey
      : PRODUCT_MODULE_CATEGORY_LOOKUP.get(path)?.key;
    if (categoryKey) {
      pathsByCategory.get(categoryKey)?.push(path);
    } else {
      uncategorizedPaths.push(path);
    }
  });

  // Blueprint applications are additive during a baseline migration. Keep the
  // tenant's existing order, but insert a newly graduated application beside
  // its blueprint neighbours instead of appending it to the end of a category.
  const blueprintIndex = new Map(PRODUCT_MODULE_BASELINE_PATHS.map((path, index) => [path, index]));
  FACTORY_BLUEPRINT_PRODUCT_PATHS.forEach((path) => {
    if (sourcePathSet.has(path)) return;
    const assignedKey = assignments?.[path];
    const categoryKey = assignedKey && availableCategoryKeys.has(assignedKey)
      ? assignedKey as ProductModuleCategoryKey
      : PRODUCT_MODULE_CATEGORY_LOOKUP.get(path)?.key;
    if (!categoryKey) {
      uncategorizedPaths.push(path);
      return;
    }

    const categoryPaths = pathsByCategory.get(categoryKey) || [];
    const pathIndex = blueprintIndex.get(path) ?? Number.MAX_SAFE_INTEGER;
    const nextIndex = categoryPaths.findIndex((candidate) =>
      (blueprintIndex.get(candidate) ?? Number.MAX_SAFE_INTEGER) > pathIndex
    );
    if (nextIndex >= 0) categoryPaths.splice(nextIndex, 0, path);
    else categoryPaths.push(path);
    pathsByCategory.set(categoryKey, categoryPaths);
  });

  return [
    ...PRODUCT_MODULE_CATEGORY_ORDER.flatMap((key) => pathsByCategory.get(key) || []),
    ...uncategorizedPaths,
  ];
}

function applySocialMediaChildWorkflowOrder(children: ProductChildItem[]) {
  const childByPath = new Map(children.map((child) => [child.path, child]));
  const workflowChildren = SOCIAL_MEDIA_CHILD_WORKFLOW_PATHS
    .map((path) => childByPath.get(path))
    .filter((child): child is ProductChildItem => Boolean(child));
  const workflowPaths = new Set<string>(SOCIAL_MEDIA_CHILD_WORKFLOW_PATHS);
  return [...workflowChildren, ...children.filter((child) => !workflowPaths.has(child.path))];
}

function clearLegacySocialMediaChildLabels(children: ProductChildItem[]) {
  return children.map((child) => {
    const legacyLabels = LEGACY_SOCIAL_MEDIA_CHILD_LABELS_BY_PATH[child.path];
    return legacyLabels?.includes(child.customLabel || "")
      ? { ...child, customLabel: undefined }
      : child;
  });
}

export function normalizeProductModuleCategoryOrder(order?: readonly string[] | null): ProductModuleCategoryKey[] {
  // Category identity remains the stable key. The visible two-digit number is
  // the shared display order owned by Column Configuration, so Sidebar and
  // Operations can follow the same user-authored sequence without duplicating
  // an order model. Unknown and duplicate keys are discarded; newly introduced
  // factory categories are appended in their code-owned default order.
  const knownKeys = new Set<string>(PRODUCT_MODULE_CATEGORY_ORDER);
  const normalized: ProductModuleCategoryKey[] = [];
  const seen = new Set<string>();
  for (const rawKey of order || []) {
    if (!knownKeys.has(rawKey) || seen.has(rawKey)) continue;
    seen.add(rawKey);
    normalized.push(rawKey as ProductModuleCategoryKey);
  }
  for (const key of PRODUCT_MODULE_CATEGORY_ORDER) {
    if (seen.has(key)) continue;
    normalized.push(key);
  }
  return normalized;
}

function applyProductModuleCategoryBaselineOrder(
  order?: readonly string[] | null,
): ProductModuleCategoryKey[] {
  return normalizeProductModuleCategoryOrder(order);
}

/** Source workspaces use their own navigation group keys instead of customer-site categories. */
export function isSourceWorkspaceCategoryKey(key: string): boolean {
  return /^(hq|agency)-[a-z0-9-]+$/.test(key);
}

export function normalizeSourceWorkspaceCategoryOrder(
  order: readonly string[] | null | undefined,
  sourceCategoryKeys: readonly string[]
): string[] {
  const availableKeys = new Set(sourceCategoryKeys);
  const next = [...new Set(order || [])].filter((key) => availableKeys.has(key));
  sourceCategoryKeys.forEach((key) => {
    if (!next.includes(key)) next.push(key);
  });
  return next;
}

export function buildSourceWorkspaceCategoryOrderMap(
  order: readonly string[] | null | undefined,
  sourceCategoryKeys: readonly string[]
): Map<string, number> {
  const normalizedOrder = normalizeSourceWorkspaceCategoryOrder(order, sourceCategoryKeys);
  return new Map(normalizedOrder.map((key, index) => [key, index]));
}

export function buildSourceWorkspaceCategoryDisplayOrderMap(
  order: readonly string[] | null | undefined,
  sourceCategoryKeys: readonly string[]
): Map<string, number> {
  const normalizedOrderMap = buildSourceWorkspaceCategoryOrderMap(order, sourceCategoryKeys);
  // Source workspaces follow the same top-to-bottom numbering contract as
  // Client Source: the first visible category is 01 and every later category
  // increments by one.  The previous reverse calculation made Headquarters
  // render 16 -> 01 and Agency Source 05 -> 01 even though their DOM and
  // persisted category order already ran in the opposite direction.
  return new Map([...normalizedOrderMap].map(([key, index]) => [key, index + 1]));
}

/**
 * Category labels count up along the currently configured business route.
 * This keeps a newly added category and a manually reordered
 * category in sync across the module editor, operations market and sidebar.
 */
export function formatProductModuleCategoryOrder(order: number | null | undefined): string | null {
  if (!Number.isInteger(order) || !order || order < 1) return null;
  return formatDisplayOrdinal(order);
}

export function formatProductModuleCategoryLabel(order: number | null | undefined, label: string): string {
  const prefix = formatProductModuleCategoryOrder(order);
  return prefix ? `${prefix}.${label}` : label;
}

export function buildProductModuleCategoryDisplayOrderMap(
  order?: readonly string[] | null
): Map<string, number> {
  const normalizedOrder = normalizeProductModuleCategoryOrder(order);
  return new Map(normalizedOrder.map((key, index) => [key, index + 1]));
}

function normalizeModuleCategoryOrder(order?: string[] | null) {
  const sourceOrder = [...new Set(order || [])].filter(isSourceWorkspaceCategoryKey);
  if (sourceOrder.length) return sourceOrder;
  return normalizeProductModuleCategoryOrder(order);
}

function normalizeModuleCategoryAssignments(
  assignments?: Record<string, string> | null,
  fallbackPaths?: readonly string[]
) {
  const next: Record<string, ProductModuleCategoryKey> = { ...buildDefaultProductModuleCategoryAssignments() };
  const validKeys = new Set(PRODUCT_MODULE_CATEGORY_ORDER);
  Object.entries(assignments || {}).forEach(([path, key]) => {
    if (validKeys.has(key) && (fallbackPaths ? fallbackPaths.includes(path) : true)) {
      next[path] = key as ProductModuleCategoryKey;
    }
  });
  return next;
}

function normalizeModuleCategoryStyles(
  styles?: Record<string, ProductModuleCategoryStyle> | null
) {
  const validKeys = new Set(PRODUCT_MODULE_CATEGORY_ORDER);
  // Headquarters and Agency Source have their own real navigation groups
  // (for example hq-account / agency-business). They are not customer-site
  // categories, but their icon styles are still part of the source snapshot.
  const isSourceWorkspaceKey = (key: string) => /^(hq|agency)-[a-z0-9-]+$/.test(key);
  return Object.fromEntries(
    Object.entries(styles || {})
      .filter(([key, style]) => (validKeys.has(key) || isSourceWorkspaceKey(key)) && !!style)
      .map(([key, style]) => [
        key,
        {
          // Customer-site categories use their linked expert avatar/default
          // icon as the only source of truth. Drop stale category-icon
          // customisation on every read/write so a factory restore cannot
          // reintroduce an obsolete "图标设置" control. Source-workspace
          // groups remain independent and retain their own icons.
          iconName: validKeys.has(key) ? undefined : cleanOptionalText(style.iconName),
          customIconUrl: validKeys.has(key) ? undefined : cleanOptionalText(style.customIconUrl),
          customIconAssetId: validKeys.has(key) ? undefined : cleanOptionalText(style.customIconAssetId),
          blueprintVisible: typeof style.blueprintVisible === "boolean" ? style.blueprintVisible : undefined,
        } satisfies ProductModuleCategoryStyle,
      ])
  ) as Record<string, ProductModuleCategoryStyle>;
}

/** Visibility contract for category, primary and secondary module icons.
 * `showEmptyCategoryNames` follows the shared switch rule: on shows a 01–12
 * category name; off hides only a category whose complete item list is already
 * hidden. A category with an active or inactive item always remains visible. */
export interface ProductModuleIconVisibility {
  category: boolean;
  primary: boolean;
  secondary: boolean;
  showEmptyCategoryNames: boolean;
}

export const DEFAULT_PRODUCT_MODULE_ICON_VISIBILITY: ProductModuleIconVisibility = {
  category: true,
  primary: true,
  secondary: true,
  showEmptyCategoryNames: true,
};

function normalizeModuleIconVisibility(
  visibility?: Partial<ProductModuleIconVisibility> | null
): ProductModuleIconVisibility {
  const legacyHideEmptyCategoryNames = (visibility as (Partial<ProductModuleIconVisibility> & {
    hideEmptyCategoryNames?: boolean;
  }) | null | undefined)?.hideEmptyCategoryNames;
  return {
    category: typeof visibility?.category === "boolean" ? visibility.category : DEFAULT_PRODUCT_MODULE_ICON_VISIBILITY.category,
    primary: typeof visibility?.primary === "boolean" ? visibility.primary : DEFAULT_PRODUCT_MODULE_ICON_VISIBILITY.primary,
    secondary: typeof visibility?.secondary === "boolean" ? visibility.secondary : DEFAULT_PRODUCT_MODULE_ICON_VISIBILITY.secondary,
    // Keep existing local drafts readable after the naming change. New saves
    // write only the positive shared-switch field.
    showEmptyCategoryNames: typeof visibility?.showEmptyCategoryNames === "boolean"
      ? visibility.showEmptyCategoryNames
      : typeof legacyHideEmptyCategoryNames === "boolean"
        ? !legacyHideEmptyCategoryNames
        : DEFAULT_PRODUCT_MODULE_ICON_VISIBILITY.showEmptyCategoryNames,
  };
}

// Default active paths
const DEFAULT_ACTIVE_PATHS = [
  "/", "/ai-chat", "/projects", "/product-analysis",
  "/company-info", "/products", "/news", "/cases",
  "/company-info?tab=navigation",
  "/company-info?tab=about", "/company-info?tab=service", "/company-info?tab=im",
  "/health-cockpit",
  "/data-warehouse",
  "/metric-center",
  "/revenue-profit",
  "/forecast",
  "/site-settings", "/site-settings?tab=domains",
];

const DEFAULT_LAYOUT_STYLE: LayoutCustomStyle = {
  ...FACTORY_BUILTIN_THEMES.find((theme) => theme.key === "rose")!.layout,
  presetThemeBlackTextColor: PRODUCT_MARKET_THEME_PALETTES.find((palette) => palette.key === "dark")!.onPrimary,
  presetThemeLightTextColor: PRODUCT_MARKET_THEME_PALETTES.find((palette) => palette.key === "light")!.onPrimary,
  presetThemeRoseTextColor: PRODUCT_MARKET_THEME_PALETTES.find((palette) => palette.key === "rose")!.onPrimary,
  presetThemeOrangeTextColor: PRODUCT_MARKET_THEME_PALETTES.find((palette) => palette.key === "orange")!.onPrimary,
  presetThemeBlackBgColor: PRODUCT_MARKET_THEME_PALETTES.find((palette) => palette.key === "dark")!.primary,
  presetThemeLightBgColor: PRODUCT_MARKET_THEME_PALETTES.find((palette) => palette.key === "light")!.primary,
  presetThemeRoseBgColor: PRODUCT_MARKET_THEME_PALETTES.find((palette) => palette.key === "rose")!.primary,
  presetThemeOrangeBgColor: PRODUCT_MARKET_THEME_PALETTES.find((palette) => palette.key === "orange")!.primary,
  presetThemeBlackLabel: "墨黑星紫",
  presetThemeLightLabel: "松褐吉粉",
  presetThemeRoseLabel: "玫红天青",
  presetThemeOrangeLabel: "暖橘荷青",
};

export const DEFAULT_LAYOUT_SECTIONS: LayoutSectionConfig[] = [
  {
    id: "global-font",
    title: "全局与版面风格 · 字体",
    description: "当前客户源草案的统一字体、字重与字间距；保存前不向全局或下游同步。",
  },
  {
    id: "content-bg",
    title: "全局与版面风格 · 轻量框架",
    description: "按顶部、主体、标题、表内壳、表头、内容、卡片与尾栏维护当前客户源草案；不执行全局同步。",
  },
  {
    id: "sidebar-style",
    title: "左侧边栏样式",
    description: "统一控制左侧导航的渐变、文字、高亮和边框颜色。",
  },
  {
    id: "product-card-colors",
    title: "产品卡片颜色",
    description: "按开通、取消、隐藏三个状态分别设置小卡片与状态胶囊配色。",
  },
  {
    id: "customer-service-style",
    title: "悬浮客服样式",
    description: "同步作用到前台悬浮客服入口、聊天窗口、消息气泡和输入框。",
  },
];

export const DEFAULT_CUSTOMER_SERVICE_SECTIONS: CustomerServiceSectionConfig[] = [
  {
    id: "service-switches",
    title: "开关客音",
    description: "顶部固定显示基础开关，只控制共享初始配置或当前计划的基础状态。",
  },
  {
    id: "service-select-avatar",
    title: "选择专家",
    description: "每位专家都可独立设置自定头像、招呼语、动画效果和朗读声音。",
  },
  {
    id: "service-avatar-customize",
    title: "当前专家真人朗音自定义",
    description: "下面只针对当前选中的专家生效，不会影响其他专家。",
  },
  {
    id: "service-reminder-sound",
    title: "专家出现消息发送时提醒声音",
    description: "选择生肖提醒音，并支持上传或复用 250 × 250 封面图片及提醒声音素材。",
  },
];

type PersistScope = "hq" | "agency" | "client";

function getPersistScope(): PersistScope {
  if (typeof window === "undefined") return "client";
  const pathname = window.location.pathname;
  if (pathname.startsWith("/zb")) return "hq";
  if (pathname.startsWith("/dl")) return "agency";
  return "client";
}

const scopedPersistStorage = {
  getItem(name: string) {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(`${name}:${getPersistScope()}`);
  },
  setItem(name: string, value: string) {
    if (typeof window === "undefined") return;
    safeSetLocalStorage(`${name}:${getPersistScope()}`, value, { compact: true });
  },
  removeItem(name: string) {
    if (typeof window === "undefined") return;
    safeRemoveLocalStorage(`${name}:${getPersistScope()}`);
  },
};

export interface CustomerServiceAvatar {
  id: string;
  name: string;
  style: "professional" | "friendly" | "cute" | "tech" | "elegant" | "strong";
  greeting: string;
  color: string;
  /** Bundled local Select Expert portrait used when no saved replacement exists. */
  defaultAvatarUrl?: string;
  /** Stable local material identity paired with the Select Expert portrait. */
  defaultAvatarAssetId?: string;
  /** Human-facing origin label for the bundled local portrait. */
  defaultAvatarCountry?: string;
  /** Gender alignment guard for the bundled first-paint portrait. */
  defaultAvatarGender?: CustomerServiceVoiceGender;
  /** The product-market category this expert serves. Factory presets omit it. */
  categoryKey?: ProductModuleCategoryKey;
  /** Human-facing category rank. Higher ranks are displayed first. */
  order?: number;
  /** Default category icon. A category-level custom icon always takes precedence. */
  iconName?: string;
}

export type CustomerServiceAnimation =
  | "pulse"
  | "float"
  | "bounce"
  | "glow"
  | "flip-roll"
  | "spin-slow"
  | "breathe"
  | "sway"
  | "heartbeat"
  | "wobble"
  | "wave"
  | "tilt";

export const CUSTOMER_SERVICE_ANIMATION_OPTIONS: ReadonlyArray<{ label: string; value: CustomerServiceAnimation }> = [
  { label: "脉冲", value: "pulse" },
  { label: "漂浮", value: "float" },
  { label: "弹跳", value: "bounce" },
  { label: "光晕", value: "glow" },
  { label: "翻斗", value: "flip-roll" },
  { label: "转圈", value: "spin-slow" },
  { label: "呼吸", value: "breathe" },
  { label: "摇摆", value: "sway" },
  { label: "心跳", value: "heartbeat" },
  { label: "轻摇", value: "wobble" },
  { label: "波浪", value: "wave" },
  { label: "倾斜", value: "tilt" },
];

/**
 * One version gate aligns every numbered expert to its own voice, animation
 * and reminder slots once. After this migration, a user's manual replacement
 * remains an intentional per-expert override.
 */
export const CUSTOMER_SERVICE_EXPERT_SEQUENCE_CONTRACT_VERSION = "expert-sequence-auto-match-v2";
export const CUSTOMER_SERVICE_EXPERT_VOICE_RATE_CONTRACT_VERSION = "expert-voice-rate-default-1-30-v1";

const CUSTOMER_SERVICE_EXPERT_ANIMATION_BY_AVATAR_ID = new Map<string, CustomerServiceAnimation>(
  CUSTOMER_SERVICE_EXPERT_AUDIO_ROSTER.map((item) => [item.avatarId, item.animationStyleKey]),
);

export function getDefaultCustomerServiceAnimationForAvatar(
  avatarId?: string | null,
): CustomerServiceAnimation {
  return avatarId
    ? CUSTOMER_SERVICE_EXPERT_ANIMATION_BY_AVATAR_ID.get(avatarId) || "pulse"
    : "pulse";
}

export function isCustomerServiceAnimation(value: unknown): value is CustomerServiceAnimation {
  return typeof value === "string" && CUSTOMER_SERVICE_ANIMATION_OPTIONS.some((option) => option.value === value);
}

export function getCustomerServiceAnimationClass(animationStyle?: string) {
  switch (animationStyle) {
    case "float": return "animate-[float_3.4s_ease-in-out_infinite] motion-reduce:animate-none";
    case "bounce": return "animate-bounce motion-reduce:animate-none";
    case "glow": return "animate-pulse shadow-[0_0_24px_rgba(255,255,255,0.35)] motion-reduce:animate-none";
    case "flip-roll":
    case "flip": return "animate-[flip-roll_5s_ease-in-out_infinite] motion-reduce:animate-none";
    case "spin-slow": return "animate-[spin_10s_linear_infinite] motion-reduce:animate-none";
    case "breathe": return "animate-[avatar-breathe_3.2s_ease-in-out_infinite] motion-reduce:animate-none";
    case "sway": return "animate-[avatar-sway_3.6s_ease-in-out_infinite] motion-reduce:animate-none";
    case "heartbeat": return "animate-[avatar-heartbeat_2.2s_ease-in-out_infinite] motion-reduce:animate-none";
    case "wobble": return "animate-[avatar-wobble_3s_ease-in-out_infinite] motion-reduce:animate-none";
    case "wave": return "animate-[avatar-wave_3.8s_ease-in-out_infinite] motion-reduce:animate-none";
    case "tilt": return "animate-[avatar-tilt_2.8s_ease-in-out_infinite] motion-reduce:animate-none";
    case "pulse":
    default: return "animate-pulse motion-reduce:animate-none";
  }
}

export function getCustomerServiceAnimationLabel(animationStyle?: string) {
  return CUSTOMER_SERVICE_ANIMATION_OPTIONS.find((option) => option.value === animationStyle)?.label || "脉冲";
}
export type CustomerServiceMediaKind = "image" | "video" | "audio";
export type CustomerServiceVoiceGender = "female" | "male";

/** A shared fallback record, intentionally separate from any actual expert. */
export const DEFAULT_FEMALE_VOICE_OVERRIDE_ID = "__default_female_voice__";
export const DEFAULT_MALE_VOICE_OVERRIDE_ID = "__default_male_voice__";

export interface CustomerServiceAudioAssetRef {
  assetId?: string;
  mimeType?: string;
  fileName?: string;
}

export interface CustomerServiceMaterialVersion extends CustomerServiceAudioAssetRef {
  kind: "avatar" | "voice" | "reminder";
  savedAt: string;
}

export interface CustomerServiceAvatarOverride {
  mediaAssetId?: string;
  mediaKind?: CustomerServiceMediaKind;
  mediaMimeType?: string;
  imageDataUrl?: string;
  soundStyle?: string;
  reminderContractVersion?: string;
  expertSequenceContractVersion?: string;
  soundAssetId?: string;
  soundAssetMimeType?: string;
  soundAssetFileName?: string;
  soundAssetsByStyle?: Record<string, CustomerServiceAudioAssetRef>;
  /** Optional 250 × 250 reminder-cover image, keyed by zodiac reminder style. */
  reminderImageAssetsByStyle?: Record<string, CustomerServiceAudioAssetRef>;
  animationStyle?: CustomerServiceAnimation;
  displayName?: string;
  greetingText?: string;
  voiceEnabled?: boolean;
  voiceGender?: CustomerServiceVoiceGender;
  voiceRate?: number;
  voiceRateContractVersion?: string;
  voiceStyleKey?: CustomerServiceVoiceStyleKey;
  voiceContractVersion?: string;
  voiceAssetId?: string;
  voiceAssetMimeType?: string;
  voiceAssetFileName?: string;
  femaleVoiceAssetId?: string;
  femaleVoiceAssetMimeType?: string;
  femaleVoiceAssetFileName?: string;
  maleVoiceAssetId?: string;
  maleVoiceAssetMimeType?: string;
  maleVoiceAssetFileName?: string;
  voiceAssetsByStyle?: Record<string, CustomerServiceAudioAssetRef>;
  /** Optional 250 × 250 presenter cover, keyed by the stable female/male voice style. */
  voiceImageAssetsByStyle?: Record<string, CustomerServiceAudioAssetRef>;
  materialHistory?: CustomerServiceMaterialVersion[];
}

export interface CustomerServiceExpertSequenceFallbacks {
  reminderStyle?: string;
  voiceGender?: CustomerServiceVoiceGender;
  voiceRate?: number;
  animationStyle?: CustomerServiceAnimation;
}

/**
 * Resolves the four values that must follow the same stable expert id.
 * Legacy numbered overrides are intentionally ignored until they pass through
 * the one-time migration, preventing stale 01→12 pairings at runtime.
 */
export function resolveCustomerServiceExpertSequenceMatch(
  avatarId: string,
  override?: CustomerServiceAvatarOverride,
  fallbacks: CustomerServiceExpertSequenceFallbacks = {},
) {
  const isNumberedExpert = isCustomerServiceExpertVoiceAvatarId(avatarId);
  const honorsExplicitOverride = !isNumberedExpert
    || override?.expertSequenceContractVersion === CUSTOMER_SERVICE_EXPERT_SEQUENCE_CONTRACT_VERSION;
  const honorsExplicitVoiceRate = !isNumberedExpert
    || override?.voiceRateContractVersion === CUSTOMER_SERVICE_EXPERT_VOICE_RATE_CONTRACT_VERSION;
  const defaultVoiceGender = getDefaultVoiceGenderForAvatar(avatarId);
  const defaultVoiceStyleKey = getDefaultVoiceStyleForAvatar(avatarId);
  const voiceGender = honorsExplicitOverride
    ? override?.voiceGender || fallbacks.voiceGender || defaultVoiceGender
    : defaultVoiceGender;
  const voiceStyleKey = honorsExplicitOverride
    ? override?.voiceStyleKey || defaultVoiceStyleKey
    : defaultVoiceStyleKey;
  const voicePreset = getCustomerServiceVoicePreset(voiceStyleKey, voiceGender);
  const defaultAnimationStyle = getDefaultCustomerServiceAnimationForAvatar(avatarId);
  const animationStyle = honorsExplicitOverride
    ? override?.animationStyle || fallbacks.animationStyle || defaultAnimationStyle
    : defaultAnimationStyle;
  const reminderStyleKey = resolveCustomerServiceReminderStyle(
    avatarId,
    honorsExplicitOverride ? override?.soundStyle : undefined,
    fallbacks.reminderStyle,
  );

  return {
    voiceGender: voicePreset.gender,
    voiceStyleKey: voicePreset.key,
    voiceRate: normalizeCustomerServiceVoiceRate(
      honorsExplicitVoiceRate
        ? override?.voiceRate ?? fallbacks.voiceRate ?? voicePreset.rate
        : DEFAULT_CUSTOMER_SERVICE_VOICE_RATE,
    ),
    animationStyle,
    reminderStyleKey,
  };
}

function cleanAudioAssetRef(value?: CustomerServiceAudioAssetRef | null): CustomerServiceAudioAssetRef | undefined {
  if (!value) return undefined;
  const next: CustomerServiceAudioAssetRef = {};
  if (typeof value.assetId === "string" && value.assetId.trim()) {
    next.assetId = value.assetId.trim();
  }
  if (typeof value.mimeType === "string" && value.mimeType.trim()) {
    next.mimeType = value.mimeType.trim();
  }
  if (typeof value.fileName === "string" && value.fileName.trim()) {
    next.fileName = sanitizeDisplayText(value.fileName, "").trim().slice(0, 120);
  }
  return Object.keys(next).length ? next : undefined;
}

function cleanAudioAssetMap(value?: Record<string, CustomerServiceAudioAssetRef> | null) {
  if (!value || typeof value !== "object") return undefined;
  const entries = Object.entries(value)
    .map(([key, asset]) => [key.trim(), cleanAudioAssetRef(asset)] as const)
    .filter(([key, asset]) => Boolean(key) && Boolean(asset))
    .map(([key, asset]) => [key, asset!] as const);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function getDefaultVoiceGenderForPresetAvatar(avatarId?: string | null): CustomerServiceVoiceGender {
  return getDefaultVoiceGenderForAvatar(avatarId);
}

function getDefaultVoiceStyleForPresetAvatar(avatarId?: string | null): CustomerServiceVoiceStyleKey {
  return getDefaultVoiceStyleForAvatar(avatarId);
}

function normalizeVoiceOverrideForPresetAvatar(
  avatarId: string,
  override: CustomerServiceAvatarOverride
): CustomerServiceAvatarOverride {
  const next = { ...override };
  const defaultGender = getDefaultVoiceGenderForPresetAvatar(avatarId);
  const defaultStyle = getDefaultVoiceStyleForPresetAvatar(avatarId);
  const defaultPreset = CUSTOMER_SERVICE_VOICE_PRESETS.find((preset) => preset.key === defaultStyle)
    || CUSTOMER_SERVICE_VOICE_PRESETS[0];
  if (
    isCustomerServiceExpertVoiceAvatarId(avatarId)
    && next.expertSequenceContractVersion !== CUSTOMER_SERVICE_EXPERT_SEQUENCE_CONTRACT_VERSION
  ) {
    const previousVoiceStyle = next.voiceStyleKey;
    const previousVoiceGender = getCustomerServiceVoicePreset(
      previousVoiceStyle,
      next.voiceGender || defaultGender,
    ).gender;
    const previousReminderStyle = next.soundStyle;
    const activeVoiceAsset = resolveVoicePresetAssetFields(
      next,
      previousVoiceStyle,
      previousVoiceGender,
    );
    const activeReminderAsset = resolveCustomerServiceReminderAssetRef(
      next,
      previousReminderStyle,
    );
    const defaultReminderStyle = resolveCustomerServiceReminderStyle(avatarId);

    // v2 repairs old numbered selections that were accidentally stamped as
    // explicit v1 choices. If an expert really uses an uploaded replacement,
    // re-key that same material to the expert's canonical 01–12 slot first;
    // the remaining library entries stay untouched and reusable.
    if (activeVoiceAsset.assetId) {
      next.voiceAssetsByStyle = {
        ...(next.voiceAssetsByStyle || {}),
        [defaultStyle]: activeVoiceAsset,
      };
    }
    if (activeReminderAsset.assetId) {
      next.soundAssetsByStyle = {
        ...(next.soundAssetsByStyle || {}),
        [defaultReminderStyle]: activeReminderAsset,
      };
    }
    next.voiceGender = defaultGender;
    next.voiceStyleKey = defaultStyle;
    next.animationStyle = next.animationStyle || getDefaultCustomerServiceAnimationForAvatar(avatarId);
    next.soundStyle = defaultReminderStyle;
    next.expertSequenceContractVersion = CUSTOMER_SERVICE_EXPERT_SEQUENCE_CONTRACT_VERSION;
  }
  if (
    isCustomerServiceExpertVoiceAvatarId(avatarId)
    && next.voiceRateContractVersion !== CUSTOMER_SERVICE_EXPERT_VOICE_RATE_CONTRACT_VERSION
  ) {
    // The prior generated values varied per expert. Rebase the 12 built-in
    // voices once to the shared 1.30x default; later slider edits are kept.
    next.voiceRate = DEFAULT_CUSTOMER_SERVICE_VOICE_RATE;
    next.voiceRateContractVersion = CUSTOMER_SERVICE_EXPERT_VOICE_RATE_CONTRACT_VERSION;
  }
  const isLegacyDefaultCarrier = avatarId === DEFAULT_FEMALE_VOICE_OVERRIDE_ID
    || avatarId === DEFAULT_MALE_VOICE_OVERRIDE_ID;
  const legacyFlatVoiceAsset = cleanAudioAssetRef({
    assetId: next.voiceAssetId,
    mimeType: next.voiceAssetMimeType,
    fileName: next.voiceAssetFileName,
  });
  if (legacyFlatVoiceAsset?.assetId && !isLegacyDefaultCarrier) {
    const migrationGender = next.voiceGender === "male" || next.voiceGender === "female"
      ? next.voiceGender
      : defaultGender;
    const migrationStyle = isCustomerServiceExpertVoiceAvatarId(avatarId)
      && next.voiceContractVersion !== CUSTOMER_SERVICE_VOICE_CONTRACT_VERSION
      ? resolveCustomerServiceVoiceMigrationPreset(avatarId, next.voiceStyleKey).key
      : getCustomerServiceVoicePreset(next.voiceStyleKey, migrationGender).key;
    next.voiceAssetsByStyle = {
      [migrationStyle]: legacyFlatVoiceAsset,
      ...(next.voiceAssetsByStyle || {}),
    };
  }
  delete next.voiceAssetId;
  delete next.voiceAssetMimeType;
  delete next.voiceAssetFileName;
  if (
    isCustomerServiceExpertVoiceAvatarId(avatarId)
    && next.reminderContractVersion !== CUSTOMER_SERVICE_REMINDER_CONTRACT_VERSION
  ) {
    const previousStyle = next.soundStyle?.trim();
    const targetReminderStyle = resolveCustomerServiceReminderMigrationStyle(avatarId, previousStyle);
    const previousStyledAsset = previousStyle ? next.soundAssetsByStyle?.[previousStyle] : undefined;
    const previousFlatAsset = next.soundAssetId
      ? {
          assetId: next.soundAssetId,
          mimeType: next.soundAssetMimeType,
          fileName: next.soundAssetFileName,
        }
      : undefined;
    const migratedAsset = previousStyledAsset || previousFlatAsset;
    // v2 only adds local default files. Keep an existing numbered selection;
    // legacy six-style selections still migrate to this expert's numbered slot.
    next.soundStyle = targetReminderStyle;
    next.reminderContractVersion = CUSTOMER_SERVICE_REMINDER_CONTRACT_VERSION;
    if (migratedAsset?.assetId) {
      next.soundAssetsByStyle = {
        ...(next.soundAssetsByStyle || {}),
        [targetReminderStyle]: migratedAsset,
      };
    }
  }
  if (
    isCustomerServiceExpertVoiceAvatarId(avatarId)
    && next.voiceContractVersion !== CUSTOMER_SERVICE_VOICE_CONTRACT_VERSION
  ) {
    const migrationPreset = resolveCustomerServiceVoiceMigrationPreset(avatarId, next.voiceStyleKey);
    // v2 only adds local preview files. Keep the selected numbered voice and
    // any user-adjusted speed while legacy styles still use the expert default.
    next.voiceGender = migrationPreset.gender;
    next.voiceStyleKey = migrationPreset.key;
    next.voiceRate = typeof next.voiceRate === "number"
      ? normalizeCustomerServiceVoiceRate(next.voiceRate)
      : migrationPreset.rate;
    next.voiceContractVersion = CUSTOMER_SERVICE_VOICE_CONTRACT_VERSION;
    return next;
  }
  const previousGeneratedDefaults: Record<string, { gender: CustomerServiceVoiceGender; style: string; rate: number }> = {
    "pro-female": { gender: "female", style: "gentle-female", rate: 0.96 },
    "cute-female": { gender: "female", style: "bright-female", rate: 1.08 },
    "elegant-female": { gender: "female", style: "standard-female", rate: 1 },
    "tech-male": { gender: "male", style: "calm-male", rate: 0.94 },
    "friendly-male": { gender: "male", style: "deep-male", rate: 0.9 },
    "category-expert-portrait": { gender: "female", style: "gentle-female", rate: 0.96 },
    "strong-male": { gender: "female", style: "gentle-female", rate: 0.96 },
    "category-expert-convert": { gender: "female", style: "gentle-female", rate: 0.96 },
    "category-expert-fulfillment": { gender: "male", style: "standard-male", rate: 1 },
    "category-expert-care": { gender: "female", style: "standard-female", rate: 1 },
    "category-expert-decision": { gender: "female", style: "gentle-female", rate: 0.96 },
    "category-expert-operations": { gender: "male", style: "standard-male", rate: 1 },
  };
  const exactPreset = next.voiceStyleKey
    ? CUSTOMER_SERVICE_VOICE_PRESETS.find((preset) => preset.key === next.voiceStyleKey)
    : undefined;
  const hasCustomVoiceAssets = Boolean(
    next.femaleVoiceAssetId ||
    next.maleVoiceAssetId ||
    (next.voiceAssetsByStyle && Object.keys(next.voiceAssetsByStyle).length > 0)
  );
  const previousDefault = previousGeneratedDefaults[avatarId];
  const matchesPreviousGeneratedDefault = Boolean(
    !hasCustomVoiceAssets
    && previousDefault
    && next.voiceStyleKey === previousDefault.style
    && (!next.voiceGender || next.voiceGender === previousDefault.gender)
    && (!next.voiceRate || Math.abs(next.voiceRate - previousDefault.rate) < 0.001)
  );

  if (matchesPreviousGeneratedDefault || !next.voiceStyleKey) {
    next.voiceGender = defaultGender;
    next.voiceStyleKey = defaultStyle;
    next.voiceRate = defaultPreset.rate;
    return next;
  }

  if (exactPreset) {
    next.voiceGender = exactPreset.gender;
    if (!next.voiceRate) next.voiceRate = exactPreset.rate;
    return next;
  }

  if (isLegacyCustomerServiceVoiceStyleKey(next.voiceStyleKey)) {
    const legacyGender: CustomerServiceVoiceGender = next.voiceStyleKey.endsWith("-male")
      ? "male"
      : "female";
    const resolvedLegacyPreset = getCustomerServiceVoicePreset(next.voiceStyleKey, legacyGender);
    next.voiceGender = legacyGender;
    if (!next.voiceRate) next.voiceRate = resolvedLegacyPreset.rate;
    return next;
  }

  next.voiceGender = defaultGender;
  next.voiceStyleKey = defaultStyle;
  next.voiceRate = defaultPreset.rate;
  return next;
}

export function resolveReminderSoundAssetFields(
  override?: CustomerServiceAvatarOverride,
  styleKey?: string | null
): CustomerServiceAudioAssetRef {
  return resolveCustomerServiceReminderAssetRef(override, styleKey);
}

export function resolveVoicePresetAssetFields(
  override: CustomerServiceAvatarOverride | undefined,
  presetKey?: string | null,
  gender: CustomerServiceVoiceGender = "female"
): CustomerServiceAudioAssetRef {
  const normalizedPresetKey = presetKey?.trim();
  const hasStyledVoiceAssets = Boolean(
    override?.voiceAssetsByStyle && Object.keys(override.voiceAssetsByStyle).length > 0
  );
  const hasModernVoiceAssets = Boolean(
    override?.femaleVoiceAssetId ||
    override?.maleVoiceAssetId ||
    hasStyledVoiceAssets
  );
  const resolveDedicatedVoiceAsset = (): CustomerServiceAudioAssetRef => {
    if (gender === "female") {
      return {
        assetId: override?.femaleVoiceAssetId,
        mimeType: override?.femaleVoiceAssetMimeType,
        fileName: override?.femaleVoiceAssetFileName,
      };
    }
    return {
      assetId: override?.maleVoiceAssetId,
      mimeType: override?.maleVoiceAssetMimeType,
      fileName: override?.maleVoiceAssetFileName,
    };
  };

  const dedicatedVoiceAsset = resolveDedicatedVoiceAsset();
  if (override?.voiceAssetsByStyle && normalizedPresetKey && override.voiceAssetsByStyle[normalizedPresetKey]) {
    return override.voiceAssetsByStyle[normalizedPresetKey] || {};
  }
  const legacyPresetKey = getLegacyVoiceStyleKeyForPreset(normalizedPresetKey);
  if (override?.voiceAssetsByStyle && legacyPresetKey && override.voiceAssetsByStyle[legacyPresetKey]) {
    return override.voiceAssetsByStyle[legacyPresetKey] || {};
  }
  if (hasStyledVoiceAssets) {
    return {};
  }
  if (dedicatedVoiceAsset.assetId) {
    return dedicatedVoiceAsset;
  }
  if (!hasModernVoiceAssets && override?.voiceAssetId) {
    return {
      assetId: override.voiceAssetId,
      mimeType: override.voiceAssetMimeType,
      fileName: override.voiceAssetFileName,
    };
  }
  return dedicatedVoiceAsset;
}

/**
 * Resolves an expert's own voice first. Female experts without a selected
 * asset then inherit the saved default female voice for the same voice style.
 */
export function resolveVoicePresetAssetFromOverrides(
  overrides: Record<string, CustomerServiceAvatarOverride> | undefined,
  avatarId: string | undefined,
  presetKey?: string | null,
  gender: CustomerServiceVoiceGender = "female"
): CustomerServiceAudioAssetRef {
  const own = resolveVoicePresetAssetFields(avatarId ? overrides?.[avatarId] : undefined, presetKey, gender);
  if (own.assetId) return own;
  const defaultId = gender === "female" ? DEFAULT_FEMALE_VOICE_OVERRIDE_ID : DEFAULT_MALE_VOICE_OVERRIDE_ID;
  return resolveVoicePresetAssetFields(overrides?.[defaultId], presetKey, gender);
}

export const CS_AVATAR_PRESETS: CustomerServiceAvatar[] = [
  { id: "pro-female", name: "专业女客服", style: "professional", greeting: "您好，我是您的专属客服小美，请问有什么可以帮您？", color: "#3b82f6" },
  { id: "friendly-male", name: "亲切男客服", style: "friendly", greeting: "你好，欢迎来到 TradePro，我是小明，很高兴为您服务。", color: "#10b981" },
  { id: "strong-male", name: "猛男客服", style: "strong", greeting: "您好，我是猛男客服阿力，产品咨询、合作细节和方案确认都可以直接问我。", color: "#ef4444" },
  { id: "cute-female", name: "可爱萌客服", style: "cute", greeting: "嗨嗨~ 欢迎光临，我是小萌，有问题尽管问我哦~", color: "#ec4899" },
  { id: "tech-male", name: "科技风客服", style: "tech", greeting: "您好，我是 AI 智能客服助手，为您提供技术支持。", color: "#8b5cf6" },
  { id: "elegant-female", name: "优雅女客服", style: "elegant", greeting: "您好，很高兴为您服务。请问有什么需要帮助的？", color: "#f59e0b" },
];

export interface CustomProductItem {
  label: string;
  path: string;
  iconName?: string;
  children?: { label: string; path: string }[];
}

/** A category has its own presentation data. It never overwrites the icons
 * of the modules assigned to that category. */
export interface ProductModuleCategoryStyle {
  iconName?: string;
  customIconUrl?: string;
  customIconAssetId?: string;
  /** Shared Platform Blueprint presentation switch. False collapses planning
   * details without changing any application's active/inactive/hidden state. */
  blueprintVisible?: boolean;
}

const CATEGORY_EXPERT_LEGACY_AVATAR_IDS = [
  "pro-female",
  "cute-female",
  "elegant-female",
  "tech-male",
  "friendly-male",
  "strong-male",
] as const;

const CATEGORY_EXPERT_LEGACY_AVATAR_ID_BY_KEY: Partial<
  Record<ProductModuleCategoryKey, (typeof CATEGORY_EXPERT_LEGACY_AVATAR_IDS)[number]>
> = {
  identity: "pro-female",
  content: "cute-female",
  trust: "elegant-female",
  recommend: "tech-male",
  deepen: "friendly-male",
  lead: "strong-male",
};

const CATEGORY_EXPERT_ICON_NAMES: Record<ProductModuleCategoryKey, string> = {
  operations: "Building2",
  fulfillment: "Package",
  identity: "ShieldCheck",
  content: "LayoutTemplate",
  trust: "Search",
  recommend: "Megaphone",
  deepen: "Share2",
  lead: "LineChart",
  convert: "Inbox",
  portrait: "Users",
  care: "MessageCircle",
  decision: "BarChart3",
};

const CATEGORY_EXPERT_DEFAULT_STYLE_BY_KEY: Record<
  ProductModuleCategoryKey,
  CustomerServiceAvatar["style"]
> = {
  operations: "professional",
  fulfillment: "strong",
  identity: "professional",
  content: "cute",
  trust: "elegant",
  recommend: "tech",
  deepen: "friendly",
  lead: "strong",
  convert: "professional",
  portrait: "friendly",
  care: "elegant",
  decision: "tech",
};

const CATEGORY_EXPERT_DEFAULT_COLOR_BY_KEY: Record<ProductModuleCategoryKey, string> = {
  operations: "#0f766e",
  fulfillment: "#0369a1",
  identity: "#3b82f6",
  content: "#10b981",
  trust: "#f59e0b",
  recommend: "#8b5cf6",
  deepen: "#ec4899",
  lead: "#ef4444",
  convert: "#3b82f6",
  portrait: "#10b981",
  care: "#f59e0b",
  decision: "#8b5cf6",
};

type CustomerServiceFactoryPortrait = {
  assetId: string;
  country: string;
  gender: CustomerServiceVoiceGender;
  url: string;
};

export const CUSTOMER_SERVICE_BUILTIN_AVATARS = [
  { id: "builtin-avatar-us", assetId: "customer-service-avatar-expert-07", country: "美国", gender: "female", url: "/assets/customer-service-local-materials/01.us-woman-expert.webp", libraryRole: "default", expertOrder: 7 },
  { id: "builtin-avatar-japan", assetId: "customer-service-avatar-expert-08", country: "日本", gender: "female", url: "/assets/customer-service-local-materials/02.japan-woman-expert.webp", libraryRole: "default", expertOrder: 8 },
  { id: "builtin-avatar-india", assetId: "customer-service-avatar-expert-09", country: "印度", gender: "male", url: "/assets/customer-service-local-materials/05.india-man-expert.webp", libraryRole: "default", expertOrder: 9 },
  { id: "builtin-avatar-russia", assetId: "customer-service-avatar-expert-10", country: "俄罗斯", gender: "female", url: "/assets/customer-service-local-materials/03.russia-woman-expert.webp", libraryRole: "default", expertOrder: 10 },
  { id: "builtin-avatar-korea", assetId: "customer-service-avatar-expert-11", country: "韩国", gender: "female", url: "/assets/customer-service-local-materials/04.korea-woman-expert.webp", libraryRole: "default", expertOrder: 11 },
  { id: "builtin-avatar-germany", assetId: "customer-service-avatar-expert-12", country: "德国", gender: "male", url: "/assets/customer-service-local-materials/06.germany-man-expert.webp", libraryRole: "default", expertOrder: 12 },
  { id: "builtin-avatar-brazil", assetId: "customer-service-avatar-backup-13", country: "巴西", gender: "female", url: "/assets/customer-service-local-materials/07.brazil-backup-expert.webp", libraryRole: "backup" },
  { id: "builtin-avatar-uk", assetId: "customer-service-avatar-backup-14", country: "英国", gender: "male", url: "/assets/customer-service-local-materials/08.uk-backup-expert.webp", libraryRole: "backup" },
  { id: "builtin-avatar-france", assetId: "customer-service-avatar-backup-15", country: "法国", gender: "female", url: "/assets/customer-service-local-materials/09.france-backup-expert.webp", libraryRole: "backup" },
] as const satisfies readonly (CustomerServiceFactoryPortrait & {
  id: string;
  assetId: string;
  libraryRole: "default" | "backup";
  expertOrder?: number;
})[];

function requireCustomerServiceBuiltinAvatar(assetId: string): CustomerServiceFactoryPortrait {
  const avatar = CUSTOMER_SERVICE_BUILTIN_AVATARS.find((item) => item.assetId === assetId);
  if (!avatar) throw new Error(`Missing bundled customer-service avatar: ${assetId}`);
  return avatar;
}

/**
 * All twelve expert cards must have a code-owned first-paint portrait. Saved
 * local material remains authoritative and replaces this portrait as soon as
 * its preview is ready. Reusing a bundled material is intentional: the source
 * repository owns nine durable portraits while uploaded expert media stays in
 * local material storage and must never be copied into source code.
 */
const CATEGORY_EXPERT_DEFAULT_AVATAR_BY_KEY: Record<
  ProductModuleCategoryKey,
  CustomerServiceFactoryPortrait
> = {
  identity: requireCustomerServiceBuiltinAvatar("customer-service-avatar-expert-07"),
  content: requireCustomerServiceBuiltinAvatar("customer-service-avatar-backup-13"),
  trust: requireCustomerServiceBuiltinAvatar("customer-service-avatar-expert-09"),
  recommend: requireCustomerServiceBuiltinAvatar("customer-service-avatar-expert-08"),
  deepen: requireCustomerServiceBuiltinAvatar("customer-service-avatar-backup-15"),
  portrait: requireCustomerServiceBuiltinAvatar("customer-service-avatar-backup-14"),
  lead: requireCustomerServiceBuiltinAvatar("customer-service-avatar-expert-07"),
  convert: requireCustomerServiceBuiltinAvatar("customer-service-avatar-expert-08"),
  fulfillment: requireCustomerServiceBuiltinAvatar("customer-service-avatar-expert-09"),
  care: requireCustomerServiceBuiltinAvatar("customer-service-avatar-expert-10"),
  decision: requireCustomerServiceBuiltinAvatar("customer-service-avatar-expert-11"),
  operations: requireCustomerServiceBuiltinAvatar("customer-service-avatar-expert-12"),
};

/**
 * The customer-service roster follows the category roster, rather than a
 * separate hard-coded six-person list. Legacy IDs stay attached to their
 * original category keys so inserting a new category cannot move an existing
 * avatar, voice or greeting customisation to another expert.
 */
export function getCustomerServiceCategoryExperts(
  categoryOrder?: readonly string[] | null,
  _categoryStyles?: Record<string, ProductModuleCategoryStyle> | null,
): CustomerServiceAvatar[] {
  const normalizedOrder = normalizeProductModuleCategoryOrder(categoryOrder);
  return normalizedOrder.map((categoryKey, index) => {
    const category = PRODUCT_MODULE_CATEGORIES.find((item) => item.key === categoryKey);
    const legacyPresetId = CATEGORY_EXPERT_LEGACY_AVATAR_ID_BY_KEY[categoryKey];
    const legacyPreset = legacyPresetId
      ? CS_AVATAR_PRESETS.find((item) => item.id === legacyPresetId)
      : undefined;
    const baseName = (category?.label || "分类").replace(/\(.+\)$/, "");
    const defaultAvatar = CATEGORY_EXPERT_DEFAULT_AVATAR_BY_KEY[categoryKey];
    const expertStyle = legacyPreset?.style || CATEGORY_EXPERT_DEFAULT_STYLE_BY_KEY[categoryKey];
    const expertId = legacyPreset?.id || `category-expert-${categoryKey}`;
    const expertAudioProfile = CUSTOMER_SERVICE_EXPERT_AUDIO_ROSTER.find((item) => (
      item.avatarId === expertId || item.categoryKey === categoryKey
    ));
    // The business-stage roster is the expert identity contract. Factory
    // portrait countries remain useful material metadata, but must never
    // rename 07.精投专家–12.固本专家 or their numbered audio slots.
    const expertName = expertAudioProfile?.expertName || `${baseName}专家`;
    const expertOrder = expertAudioProfile?.order
      || index + 1;
    return {
      id: expertId,
      name: expertName,
      style: expertStyle,
      greeting: buildCustomerServiceDefaultGreeting({
        id: expertId,
        name: expertName,
        style: expertStyle,
        categoryKey,
        order: expertOrder,
      }),
      color: legacyPreset?.color || CATEGORY_EXPERT_DEFAULT_COLOR_BY_KEY[categoryKey],
      defaultAvatarUrl: defaultAvatar?.url,
      defaultAvatarAssetId: defaultAvatar?.assetId,
      defaultAvatarCountry: defaultAvatar?.country,
      defaultAvatarGender: defaultAvatar?.gender,
      categoryKey,
      order: expertOrder,
      // Customer-site category headings intentionally inherit their expert
      // identity. Category icon overrides were removed from 栏目配置.
      iconName: CATEGORY_EXPERT_ICON_NAMES[categoryKey],
    };
  });
}

export function getCustomerServiceCategoryExpertByKey(
  categoryKey: string,
  categoryOrder?: readonly string[] | null,
  categoryStyles?: Record<string, ProductModuleCategoryStyle> | null,
) {
  return getCustomerServiceCategoryExperts(categoryOrder, categoryStyles).find((expert) => expert.categoryKey === categoryKey);
}

export interface ExportableConfig {
  /** Identifies which source owns this application catalogue and snapshot. */
  catalogScope?: ProductMarketCatalogScope;
  products: { label: string; path: string; status: ProductStatus; customLabel?: string; description?: string; customStyle?: ProductCustomStyle; children?: ProductChildItem[] }[];
  customDefaultPaths: string[];
  layoutStyle: LayoutCustomStyle;
  visualCardLayout?: VisualCardLayoutConfig;
  layoutSections?: LayoutSectionConfig[];
  customerServiceSections?: CustomerServiceSectionConfig[];
  moduleActionOrder?: string[];
  layoutActionOrder?: string[];
  customerServiceActionOrder?: string[];
  activeTheme: ThemePresetKey | string;
  productOrder: string[];
  moduleOrderBaselineVersion?: number;
  moduleCategoryOrder?: string[];
  moduleCategoryAssignments?: Record<string, ProductModuleCategoryKey>;
  moduleCategoryStyles?: Record<string, ProductModuleCategoryStyle>;
  moduleIconVisibility?: ProductModuleIconVisibility;
  customThemes?: CustomThemeData[];
  builtinThemeOverrides?: Record<string, CustomThemeData>;
  sidebarStyle?: SidebarStyle;
  globalFontFamily?: string;
  globalFontWeight?: string;
  globalLetterSpacing?: string;
  customProducts?: CustomProductItem[];
  soundEnabled?: boolean;
  soundVolume?: number;
  soundStyle?: string;
  csAvatarId?: string;
  csEnabled?: boolean;
  csAvatarOverrides?: Record<string, CustomerServiceAvatarOverride>;
  customerServiceCustomized?: boolean;
  layoutCustomized?: boolean;
  layoutStructureCustomized?: boolean;
  csVoiceEnabled?: boolean;
  csVoiceGender?: CustomerServiceVoiceGender;
  csVoiceRate?: number;
  sidebarStyleSyncVersion?: string;
}

interface ProductMarketState {
  catalogScope: ProductMarketCatalogScope;
  products: ProductItem[];
  customDefaultPaths: string[];
  layoutStyle: LayoutCustomStyle;
  visualCardLayout?: VisualCardLayoutConfig;
  layoutSections: LayoutSectionConfig[];
  customerServiceSections: CustomerServiceSectionConfig[];
  moduleActionOrder: string[];
  layoutActionOrder: string[];
  customerServiceActionOrder: string[];
  activeTheme: ThemePresetKey | string;
  productOrder: string[];
  moduleOrderBaselineVersion: number;
  moduleCategoryOrder: string[];
  moduleCategoryAssignments: Record<string, ProductModuleCategoryKey>;
  moduleCategoryStyles: Record<string, ProductModuleCategoryStyle>;
  moduleIconVisibility: ProductModuleIconVisibility;
  customThemes: CustomThemeData[];
  builtinThemeOverrides: Record<string, CustomThemeData>;
  sidebarStyle: SidebarStyle;
  globalFontFamily: string;
  globalFontWeight: string;
  globalLetterSpacing: string;
  soundEnabled: boolean;
  soundVolume: number;
  soundStyle: string;
  setStatus: (path: string, status: ProductStatus) => void;
  batchSetStatus: (paths: string[], status: ProductStatus) => void;
  resetToDefault: () => void;
  resetToFactory: () => void;
  setCustomDefault: (paths: string[]) => void;
  applyCustomDefault: () => void;
  syncProducts: (sidebarItems: { label: string; path: string; icon: LucideIcon }[]) => void;
  setProductCustomStyle: (path: string, style: Partial<ProductCustomStyle>) => void;
  setProductCustomLabel: (path: string, label: string) => void;
  setLayoutStyle: (style: Partial<LayoutCustomStyle>) => void;
  setLayoutSections: (sections: LayoutSectionConfig[]) => void;
  setCustomerServiceSections: (sections: CustomerServiceSectionConfig[]) => void;
  setModuleActionOrder: (order: string[]) => void;
  setLayoutActionOrder: (order: string[]) => void;
  setCustomerServiceActionOrder: (order: string[]) => void;
  applyTheme: (key: ThemePresetKey | string) => void;
  reorderProducts: (orderedPaths: string[]) => void;
  applyProductModuleBaseline: () => void;
  exportConfig: () => ExportableConfig;
  importConfig: (config: ExportableConfig) => void;
  setModuleCategoryOrder: (order: string[]) => void;
  setModuleCategoryAssignments: (assignments: Record<string, ProductModuleCategoryKey>) => void;
  setModuleCategoryStyles: (styles: Record<string, ProductModuleCategoryStyle>) => void;
  setModuleIconVisibility: (visibility: Partial<ProductModuleIconVisibility>) => void;
  addCustomTheme: (theme: CustomThemeData) => void;
  updateCustomTheme: (key: string, theme: Partial<CustomThemeData>) => void;
  deleteCustomTheme: (key: string) => void;
  updateBuiltinTheme: (key: string, theme: Partial<CustomThemeData>) => void;
  getAllThemes: () => ThemePreset[];
  setSidebarStyle: (style: Partial<SidebarStyle>) => void;
  setGlobalFontFamily: (font: string) => void;
  setGlobalFontWeight: (weight: string) => void;
  setGlobalLetterSpacing: (spacing: string) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setSoundVolume: (volume: number) => void;
  setSoundStyle: (style: string) => void;
  addProduct: (product: CustomProductItem) => void;
  removeProduct: (path: string) => void;
  setChildStatus: (parentPath: string, childPath: string, status: ProductStatus) => void;
  setChildItems: (parentPath: string, children: ProductChildItem[]) => void;
  customProducts: CustomProductItem[];
  csAvatarId: string;
  setCsAvatarId: (id: string) => void;
  csEnabled: boolean;
  setCsEnabled: (enabled: boolean) => void;
  csAvatarOverrides: Record<string, CustomerServiceAvatarOverride>;
  customerServiceCustomized: boolean;
  layoutCustomized: boolean;
  layoutStructureCustomized: boolean;
  csVoiceEnabled: boolean;
  csVoiceGender: CustomerServiceVoiceGender;
  csVoiceRate: number;
  setCustomerServiceCustomized: (customized: boolean) => void;
  setLayoutCustomized: (customized: boolean) => void;
  setLayoutStructureCustomized: (customized: boolean) => void;
  setCsVoiceEnabled: (enabled: boolean) => void;
  setCsVoiceGender: (gender: CustomerServiceVoiceGender) => void;
  setCsVoiceRate: (rate: number) => void;
  setCsAvatarOverride: (id: string, override: Partial<CustomerServiceAvatarOverride>) => void;
  clearCsAvatarOverrideImage: (id: string) => void;
}

const BUILTIN_KEYS = new Set(FACTORY_BUILTIN_THEMES.map((t) => t.key));

let allThemesCache: {
  builtinThemeOverrides: Record<string, CustomThemeData>;
  customThemes: CustomThemeData[];
  themes: ThemePreset[];
} | null = null;

function normalizeThemeKey(themeKey?: ThemePresetKey | string | null) {
  const key = String(themeKey || "").replace(/__customized$/, "");
  return key === "green" || key === "deep-blue" || key === "ivoryStarlight" ? "rose" : key;
}

function isRetiredThemeKey(themeKey?: ThemePresetKey | string | null) {
  const key = String(themeKey || "").replace(/__customized$/, "");
  return key === "green" || key === "deep-blue" || key === "ivoryStarlight";
}

function getFactoryThemeByKey(themeKey?: ThemePresetKey | string | null) {
  const normalizedKey = normalizeThemeKey(themeKey);
  return (
    FACTORY_BUILTIN_THEMES.find((theme) => theme.key === normalizedKey) ||
    FACTORY_BUILTIN_THEMES.find((theme) => theme.key === "rose") ||
    FACTORY_BUILTIN_THEMES[0]
  );
}

const THEME_LAYOUT_SIGNATURE_FIELDS: Array<keyof LayoutCustomStyle> = [
  "headerBgColor",
  "headerTextColor",
  "footerBgColor",
  "footerTextColor",
  "contentBgColor",
  "contentTextColor",
  "clientTopbarBgColor",
  "clientTopbarTextColor",
  "clientTopbarOverrideBgColor",
  "clientFooterOverrideBgColor",
  "clientTopbarOverrideTextColor",
  "clientFooterOverrideTextColor",
  "clientFeatureCardBgColor",
  "clientFeatureCardTextColor",
  "clientCardBgColor",
  "clientCardTextColor",
  "clientSecondaryPageBgColor",
  "clientSecondaryPageTextColor",
  "clientSecondaryTitleBgColor",
  "clientSecondaryTitleTextColor",
  "clientSecondaryListBgColor",
  "clientSecondaryListTextColor",
  "clientSecondaryContentBgColor",
  "clientSecondaryContentTextColor",
  "clientLargeCardBgColor",
  "clientLargeCardTextColor",
  "frameCornerRadius",
  "tableHeaderCornerRadius",
  "cardCornerRadius",
  "frameDensity",
  "frameElevation",
  "themePanelBgColor",
  "themePanelTextColor",
  "themePanelButtonColor",
  "headerButtonTextColor",
  "footerAccentColor",
  "siteSwitchLoadingCardBgColor",
  "siteSwitchLoadingCardTextColor",
  "customerServiceLauncherBgColor",
  "customerServiceLauncherIconColor",
  "customerServicePanelBgColor",
  "customerServicePanelHeaderBgColor",
  "customerServicePanelHeaderTextColor",
  "customerServiceAssistantMsgBgColor",
  "customerServiceAssistantMsgTextColor",
  "customerServiceUserMsgBgColor",
  "customerServiceUserMsgTextColor",
  "customerServiceInputBorderColor",
  "defaultDialogBgColor",
  "defaultDialogHeaderBgColor",
  "defaultDialogPanelBgColor",
  "defaultDialogContentBgColor",
  "defaultDialogHeaderTextColor",
  "defaultDialogButtonColor",
  "defaultDialogButtonTextColor",
  "globalFontWeight",
  "globalLetterSpacing",
];

const THEME_SIDEBAR_SIGNATURE_FIELDS: Array<keyof SidebarStyle> = [
  "bgFrom",
  "bgVia",
  "bgTo",
  "textColor",
  "activeHighlight",
  "borderColor",
];

function buildConfigThemeCandidates(config: Partial<ExportableConfig> | null | undefined): ThemePreset[] {
  const builtinCandidates = FACTORY_BUILTIN_THEMES.map((factory) => {
    const override = config?.builtinThemeOverrides?.[factory.key];
    if (!override) return { ...factory };
    const normalizedOverride = normalizeBuiltinThemeOverride(factory.key, override);
    return {
      key: factory.key,
      name: normalizedOverride.name || factory.name,
      description: normalizedOverride.description || factory.description,
      fontFamily: normalizedOverride.fontFamily || factory.fontFamily,
      layout: normalizeLayoutStyle(normalizedOverride.layout || factory.layout, factory.key),
      sidebar: normalizeSidebarStyle(normalizedOverride.sidebar || factory.sidebar, factory.key),
      cardActive: normalizedOverride.cardActive || factory.cardActive,
      cardInactive: normalizedOverride.cardInactive || factory.cardInactive,
      cardHidden: normalizedOverride.cardHidden || factory.cardHidden,
    } satisfies ThemePreset;
  });

  const customCandidates = (config?.customThemes || []).map((theme) => ({
    key: theme.key,
    name: theme.name,
    description: theme.description,
    fontFamily: theme.fontFamily,
    layout: normalizeLayoutStyle(theme.layout, theme.key),
    sidebar: normalizeSidebarStyle(theme.sidebar, theme.key),
    cardActive: theme.cardActive,
    cardInactive: theme.cardInactive,
    cardHidden: theme.cardHidden,
  } satisfies ThemePreset));

  return [...builtinCandidates, ...customCandidates];
}

function matchesThemeLayoutSignature(
  style: Partial<LayoutCustomStyle> | null | undefined,
  theme: ThemePreset
) {
  if (!style) return false;
  const normalizedStyle = normalizeLayoutStyle(style, theme.key);
  const normalizedThemeLayout = normalizeLayoutStyle(theme.layout, theme.key);
  return THEME_LAYOUT_SIGNATURE_FIELDS.every((field) => normalizedStyle[field] === normalizedThemeLayout[field]);
}

function matchesThemeSidebarSignature(
  style: Partial<SidebarStyle> | null | undefined,
  theme: ThemePreset
) {
  if (!style) return false;
  const normalizedStyle = normalizeSidebarStyle(style, theme.key);
  const normalizedThemeSidebar = normalizeSidebarStyle(theme.sidebar, theme.key);
  return THEME_SIDEBAR_SIGNATURE_FIELDS.every((field) => normalizedStyle[field] === normalizedThemeSidebar[field]);
}

function inferThemeKeyFromConfig(config: Partial<ExportableConfig> | null | undefined) {
  const matchedTheme = buildConfigThemeCandidates(config).find(
    (theme) =>
      matchesThemeLayoutSignature(config?.layoutStyle, theme) &&
      matchesThemeSidebarSignature(config?.sidebarStyle, theme)
  );
  return normalizeThemeKey(matchedTheme?.key);
}

function resolveStoredThemeKey(
  config: Partial<ExportableConfig> | null | undefined,
  fallbackThemeKey?: ThemePresetKey | string | null
) {
  const activeThemeKey = normalizeThemeKey(config?.activeTheme);
  if (activeThemeKey && activeThemeKey !== "custom") {
    return activeThemeKey;
  }
  return inferThemeKeyFromConfig(config) || normalizeThemeKey(fallbackThemeKey) || "rose";
}

function resolveConfigTheme(config: Partial<ExportableConfig> | null | undefined) {
  const activeThemeKey = resolveStoredThemeKey(config);
  const builtinOverride = activeThemeKey
    ? config?.builtinThemeOverrides?.[activeThemeKey]
    : undefined;
  if (builtinOverride) {
    return normalizeBuiltinThemeOverride(activeThemeKey, {
      ...builtinOverride,
      layout: normalizeLayoutStyle(builtinOverride.layout, activeThemeKey),
      sidebar: normalizeSidebarStyle(builtinOverride.sidebar, activeThemeKey),
      cardActive: { ...builtinOverride.cardActive },
      cardInactive: { ...builtinOverride.cardInactive },
      cardHidden: { ...builtinOverride.cardHidden },
    });
  }

  const customTheme = (config?.customThemes || []).find((theme) => normalizeThemeKey(theme.key) === activeThemeKey);
  if (customTheme) {
    return {
      ...customTheme,
      layout: normalizeLayoutStyle(customTheme.layout, customTheme.key),
      sidebar: normalizeSidebarStyle(customTheme.sidebar, customTheme.key),
      cardActive: { ...customTheme.cardActive },
      cardInactive: { ...customTheme.cardInactive },
      cardHidden: { ...customTheme.cardHidden },
    } satisfies ThemePreset;
  }

  return getFactoryThemeByKey(activeThemeKey);
}

function retintProductTreeForTheme(
  products: Array<{
    label: string;
    path: string;
    status: ProductStatus;
    customLabel?: string;
    description?: string;
    customStyle?: ProductCustomStyle;
    children?: ProductChildItem[];
  }>,
  theme: ThemePreset | CustomThemeData
) {
  return products.map((product) => {
    const colors = resolveThemeCardColors(theme, product.status);
    return {
      ...product,
      customStyle: buildStatusDrivenProductStyle(product.customStyle, colors),
      children: product.children?.map((child) => ({
        ...child,
        customStyle: buildStatusDrivenProductStyle(
          child.customStyle,
          resolveThemeCardColors(theme, child.status)
        ),
      })),
    };
  });
}

const BUILTIN_THEME_LEGACY_NAME_MAP: Record<string, string> = {
  朱砂天青: "玫红天青",
  深蓝甲: "玫红天青",
  深蓝: "玫红天青",
  蓝色: "玫红天青",
  亮青色: "玫红天青",
  黑色: "墨黑星紫",
  黑深灰: "墨黑星紫",
  浅色: "松褐吉粉",
  浅粉色: "松褐吉粉",
  深海军: "松褐吉粉",
  绿色: "玫红天青",
  薄荷绿: "玫红天青",
  橙色: "暖橘荷青",
  活力橙: "暖橘荷青",
  暖橘橙: "暖橘荷青",
  玫红: "玫红天青",
  玫红色: "玫红天青",
};

const BUILTIN_THEME_LEGACY_DESCRIPTION_MATCHERS: Record<string, string[]> = {
  dark: ["纯黑暗色主题", "低调沉稳的后台使用"],
  rose: ["朱砂主色与天青强调色"],
};

function normalizeBuiltinThemeOverride(key: string, theme: CustomThemeData): CustomThemeData {
  const factory = FACTORY_BUILTIN_THEMES.find((item) => item.key === key);
  if (!factory) return theme;

  const rawName = sanitizeDisplayText(theme.name, factory.name).trim();
  const mappedName = BUILTIN_THEME_LEGACY_NAME_MAP[rawName] || rawName || factory.name;
  const rawDescription = sanitizeDisplayText(theme.description, factory.description).trim();
  const shouldResetDescription =
    !rawDescription ||
    rawDescription === rawName ||
    (BUILTIN_THEME_LEGACY_DESCRIPTION_MATCHERS[key] || []).some((matcher) => rawDescription.includes(matcher));

  return {
    ...theme,
    key: factory.key,
    name: mappedName || factory.name,
    description: shouldResetDescription ? factory.description : rawDescription,
    fontFamily: theme.fontFamily || factory.fontFamily,
    layout: normalizeLayoutStyle(theme.layout || factory.layout, factory.key),
    sidebar: normalizeSidebarStyle(theme.sidebar || factory.sidebar, factory.key),
    cardActive: upgradeLegacyBuiltinThemeCardStyle(theme.cardActive, factory.key, "cardActive") || factory.cardActive,
    cardInactive: upgradeLegacyBuiltinThemeCardStyle(theme.cardInactive, factory.key, "cardInactive") || factory.cardInactive,
    cardHidden: upgradeLegacyBuiltinThemeCardStyle(theme.cardHidden, factory.key, "cardHidden") || factory.cardHidden,
  };
}

const LEGACY_BUILTIN_THEME_FIXUPS: Partial<
  Record<
    ThemePresetKey,
    {
      layout?: Partial<LayoutCustomStyle>;
      sidebar?: Partial<SidebarStyle>;
    }
  >
> = {
  rose: {
    layout: {
      headerBgColor: "#980016",
      headerTextColor: "#FFFFFF",
      footerBgColor: "#56000D",
      footerTextColor: "#FFF7F8",
      contentBgColor: "#FFF7F8",
      contentTextColor: "#2A0A12",
      clientTopbarBgColor: "#B0001A",
      clientTopbarTextColor: "#FFFFFF",
      clientFeatureCardBgColor: "#BFDEFF",
      clientFeatureCardTextColor: "#133452",
      clientSecondaryPageBgColor: "#FFF7F8",
      clientSecondaryPageTextColor: "#2A0A12",
      clientSecondaryTitleBgColor: "#980016",
      clientSecondaryTitleTextColor: "#FFFFFF",
      clientSecondaryListBgColor: "#D30121",
      clientSecondaryListTextColor: "#FFFFFF",
      themePanelBgColor: "#FFE2E7",
      themePanelTextColor: "#2A0A12",
      themePanelButtonColor: "#D30121",
      defaultDialogBgColor: "#FFF0F2",
      defaultDialogHeaderBgColor: "#980016",
      defaultDialogPanelBgColor: "#FFDCE2",
      defaultDialogContentBgColor: "#FFFFFF",
      defaultDialogHeaderTextColor: "#FFFFFF",
      defaultDialogButtonColor: "#D30121",
      defaultDialogButtonTextColor: "#FFFFFF",
    },
    sidebar: {
      bgFrom: "#47000B",
      bgVia: "#920016",
      bgTo: "#D30121",
      textColor: "#FFFFFF",
      activeHighlight: "#BFDEFF",
      borderColor: "#EE7183",
    },
  },
  orange: {
    layout: {
      headerBgColor: "#B94715",
      headerTextColor: "#FFFFFF",
      footerBgColor: "#74250D",
      footerTextColor: "#FFF8F3",
      contentBgColor: "#FFF8F3",
      contentTextColor: "#2B160D",
      clientTopbarBgColor: "#C94A16",
      clientTopbarTextColor: "#FFFFFF",
      clientFeatureCardBgColor: "#A1E6DD",
      clientFeatureCardTextColor: "#103C37",
      clientSecondaryPageBgColor: "#FFF8F3",
      clientSecondaryPageTextColor: "#2B160D",
      clientSecondaryTitleBgColor: "#B94715",
      clientSecondaryTitleTextColor: "#FFFFFF",
      clientSecondaryListBgColor: "#C94A16",
      clientSecondaryListTextColor: "#FFFFFF",
      themePanelBgColor: "#FFE8DA",
      themePanelTextColor: "#2B160D",
      themePanelButtonColor: "#FF6F2C",
      defaultDialogBgColor: "#FFF1E7",
      defaultDialogHeaderBgColor: "#B94715",
      defaultDialogPanelBgColor: "#FFE0CF",
      defaultDialogContentBgColor: "#FFFFFF",
      defaultDialogHeaderTextColor: "#FFFFFF",
      defaultDialogButtonColor: "#FF6F2C",
      defaultDialogButtonTextColor: "#351509",
    },
    sidebar: {
      bgFrom: "#4A1908",
      bgVia: "#A83D12",
      bgTo: "#FF6F2C",
      textColor: "#FFFFFF",
      activeHighlight: "#A1E6DD",
      borderColor: "#F7A27B",
    },
  },
  dark: {
    layout: {
      headerBgColor: "#17121F",
      headerTextColor: "#F9F5FF",
      footerBgColor: "#0B0C10",
      footerTextColor: "#EEE7FF",
      contentBgColor: "#17141F",
      contentTextColor: "#F6F0FF",
      clientTopbarBgColor: "#21152F",
      clientTopbarTextColor: "#F9F5FF",
      clientFeatureCardBgColor: "#DEC7FF",
      clientFeatureCardTextColor: "#27113B",
      clientSecondaryPageBgColor: "#17141F",
      clientSecondaryPageTextColor: "#F6F0FF",
      clientSecondaryTitleBgColor: "#20142F",
      clientSecondaryTitleTextColor: "#F9F5FF",
      clientSecondaryListBgColor: "#35134F",
      clientSecondaryListTextColor: "#F9F5FF",
      themePanelBgColor: "#2A2038",
      themePanelTextColor: "#F6F0FF",
      themePanelButtonColor: "#A855F7",
      defaultDialogBgColor: "#15111C",
      defaultDialogHeaderBgColor: "#28173A",
      defaultDialogPanelBgColor: "#21192C",
      defaultDialogContentBgColor: "#282032",
      defaultDialogHeaderTextColor: "#F9F5FF",
      defaultDialogButtonColor: "#A855F7",
      defaultDialogButtonTextColor: "#190621",
    },
    sidebar: {
      bgFrom: "#0B0C10",
      bgVia: "#17121F",
      bgTo: "#5B1E8D",
      textColor: "#F9F5FF",
      activeHighlight: "#A855F7",
      borderColor: "#74489B",
    },
  },
  light: {
    layout: {
      headerBgColor: "#664B3A",
      headerTextColor: "#FFF9F6",
      footerBgColor: "#493328",
      footerTextColor: "#FFF6F2",
      contentBgColor: "#FFF9F6",
      contentTextColor: "#34241C",
      clientTopbarBgColor: "#7B5A46",
      clientTopbarTextColor: "#FFF9F6",
      clientFeatureCardBgColor: "#F2B6B6",
      clientFeatureCardTextColor: "#48252A",
      clientSecondaryPageBgColor: "#FFF9F6",
      clientSecondaryPageTextColor: "#34241C",
      clientSecondaryTitleBgColor: "#664B3A",
      clientSecondaryTitleTextColor: "#FFF9F6",
      clientSecondaryListBgColor: "#895F50",
      clientSecondaryListTextColor: "#FFF9F6",
      themePanelBgColor: "#FCE1DE",
      themePanelTextColor: "#34241C",
      themePanelButtonColor: "#664B3A",
      defaultDialogBgColor: "#FFF1EE",
      defaultDialogHeaderBgColor: "#664B3A",
      defaultDialogPanelBgColor: "#F8D7D3",
      defaultDialogContentBgColor: "#FFFFFF",
      defaultDialogHeaderTextColor: "#FFF9F6",
      defaultDialogButtonColor: "#664B3A",
      defaultDialogButtonTextColor: "#FFF9F6",
    },
    sidebar: {
      bgFrom: "#38261D",
      bgVia: "#664B3A",
      bgTo: "#8B6552",
      textColor: "#FFF9F6",
      activeHighlight: "#F2B6B6",
      borderColor: "#BD8E7B",
    },
  },
};

// 仅识别完整保留的旧工厂默认卡片色；任一字段被用户改过就不迁移，避免覆盖个性化设置。
const LEGACY_BUILTIN_THEME_CARD_FIXUPS: Partial<
  Record<ThemePresetKey, Partial<Record<"cardActive" | "cardInactive" | "cardHidden", CardColors>>>
> = {
  indigoGreen: {
    cardActive: { bg: "#E9F8F0", border: "#57B987", font: "#103C2A", button: "#012696", nameFont: "#103C2A" },
  },
};

const LEGACY_BUILTIN_THEME_COMPAT_VALUES: Partial<
  Record<
    ThemePresetKey,
    {
      layout?: Partial<Record<keyof LayoutCustomStyle, Array<unknown>>>;
      sidebar?: Partial<Record<keyof SidebarStyle, Array<unknown>>>;
    }
  >
> = {
  dark: {
    layout: {
      contentTextColor: ["#0B1A10"],
      themePanelBgColor: ["#334155"],
      themePanelButtonColor: ["#06b6d4"],
      defaultDialogHeaderBgColor: ["#334155"],
      defaultDialogPanelBgColor: ["#06b6d4"],
      defaultDialogContentBgColor: ["#475569"],
    },
    sidebar: {
      bgFrom: ["#1f2937"],
      bgVia: ["#111827"],
      bgTo: ["#0f172a"],
      textColor: ["#d1d5db"],
      borderColor: ["#475569"],
    },
  },
};

// The palette projection immediately before the status-semantics contract.
// It is retained only to migrate untouched built-in defaults; custom values
// remain untouched by the comparison below.
function buildPreviousPaletteStatusCards(palette: ProductMarketThemePalette) {
  return {
    cardActive: {
      bg: palette.secondarySurface,
      border: palette.focus,
      font: palette.onAction,
      button: palette.action,
      nameFont: palette.text,
    },
    cardInactive: {
      bg: palette.panel,
      border: palette.border,
      font: palette.onSecondary,
      button: palette.secondary,
      nameFont: palette.text,
    },
    cardHidden: {
      bg: palette.surface,
      border: palette.border,
      font: palette.onChrome,
      button: palette.chrome,
      nameFont: palette.mutedText,
    },
  } satisfies Record<"cardActive" | "cardInactive" | "cardHidden", CardColors>;
}

// The first status-semantics release used solid red and dark-grey cards. Keep
// that shape as a compatibility candidate so those untouched defaults can be
// upgraded to the clearer card/capsule hierarchy without touching custom work.
function buildPreviousFactoryStatusSemanticCards(palette: ProductMarketThemePalette) {
  return {
    cardActive: {
      bg: palette.primary,
      border: palette.primary,
      font: palette.onPrimary,
      button: palette.primary,
      nameFont: palette.onPrimary,
    },
    cardInactive: {
      bg: "#D92D20",
      border: "#B42318",
      font: "#FFFFFF",
      button: "#D92D20",
      nameFont: "#FFFFFF",
    },
    cardHidden: {
      bg: "#374151",
      border: "#111827",
      font: "#F9FAFB",
      button: "#374151",
      nameFont: "#F9FAFB",
    },
  } satisfies Record<"cardActive" | "cardInactive" | "cardHidden", CardColors>;
}

function isSameLegacyValue(current: unknown, candidate: unknown) {
  if (typeof current === "string" && typeof candidate === "string") {
    return current.trim().toLowerCase() === candidate.trim().toLowerCase();
  }
  return current === candidate;
}

function upgradeLegacyBuiltinThemeCardStyle(
  style: CardColors | null | undefined,
  themeKey: ThemePresetKey | string | null | undefined,
  section: "cardActive" | "cardInactive" | "cardHidden"
): CardColors | null | undefined {
  if (!style) return style;
  const normalizedKey = normalizeThemeKey(themeKey) as ThemePresetKey;
  const legacyCardStyle = LEGACY_BUILTIN_THEME_CARD_FIXUPS[normalizedKey]?.[section];
  const previousFactoryCardStyle = LEGACY_FACTORY_BUILTIN_THEMES.find(
    (theme) => theme.key === normalizedKey
  )?.[section];
  const previousPaletteFactoryCardStyle = (() => {
    const palette = PRODUCT_MARKET_THEME_PALETTES.find((item) => item.key === normalizedKey);
    return palette ? buildPreviousPaletteStatusCards(palette)[section] : undefined;
  })();
  const previousFactoryStatusSemanticCardStyle = (() => {
    const palette = PRODUCT_MARKET_THEME_PALETTES.find((item) => item.key === normalizedKey);
    return palette ? buildPreviousFactoryStatusSemanticCards(palette)[section] : undefined;
  })();
  const factoryCardStyle = getFactoryThemeByKey(normalizedKey)?.[section];

  if (!factoryCardStyle) {
    return style;
  }

  const legacyCandidates = [previousFactoryCardStyle, previousPaletteFactoryCardStyle, previousFactoryStatusSemanticCardStyle, legacyCardStyle].filter(Boolean) as CardColors[];
  const isUntouchedFactoryCardStyle = legacyCandidates.some((candidate) =>
    (Object.keys(candidate) as Array<keyof CardColors>).every((field) =>
      isSameLegacyValue(style[field], candidate[field])
    )
  );
  return isUntouchedFactoryCardStyle ? { ...factoryCardStyle } : style;
}

function upgradeLegacyBuiltinThemeFields<T extends Record<string, unknown>>(
  style: Partial<T> | null | undefined,
  themeKey: ThemePresetKey | string | null | undefined,
  section: "layout" | "sidebar"
): Partial<T> | null | undefined {
  if (!style) return style;
  const normalizedKey = normalizeThemeKey(themeKey) as ThemePresetKey;
  const legacyFixup = LEGACY_BUILTIN_THEME_FIXUPS[normalizedKey]?.[section] as Partial<T> | undefined;
  const previousFactory = LEGACY_FACTORY_BUILTIN_THEMES.find((theme) => theme.key === normalizedKey);
  const previousFactorySection = (previousFactory?.[section] || {}) as Partial<T>;
  const factory = getFactoryThemeByKey(normalizedKey);
  const factorySection = (factory?.[section] || {}) as Partial<T>;

  if (!factory) {
    return style;
  }

  const next = { ...style } as Partial<T>;
  const compatCandidates = LEGACY_BUILTIN_THEME_COMPAT_VALUES[normalizedKey]?.[section] as
    | Partial<Record<keyof T, Array<unknown>>>
    | undefined;
  const migrationFields = new Set<keyof T>([
    ...(Object.keys(previousFactorySection) as Array<keyof T>),
    ...(Object.keys(legacyFixup || {}) as Array<keyof T>),
  ]);
  migrationFields.forEach((field) => {
    const matchesFactorySnapshot = isSameLegacyValue(next[field], previousFactorySection[field]);
    const matchesPrimary = isSameLegacyValue(next[field], legacyFixup?.[field]);
    const matchesCompat = (compatCandidates?.[field] || []).some((candidate) =>
      isSameLegacyValue(next[field], candidate)
    );
    if ((matchesFactorySnapshot || matchesPrimary || matchesCompat) && factorySection[field] !== undefined) {
      next[field] = factorySection[field];
    }
  });
  return next;
}

export function normalizeLayoutStyle(
  style?: Partial<LayoutCustomStyle> | null,
  themeKey?: ThemePresetKey | string | null
): LayoutCustomStyle {
  const themeDefaults = getFactoryThemeByKey(themeKey);
  const upgradedStyle = upgradeLegacyBuiltinThemeFields<LayoutCustomStyle>(style, themeKey, "layout");
  const palette = PRODUCT_MARKET_THEME_PALETTES.find((item) => item.key === normalizeThemeKey(themeKey));
  const isUntouchedPreviousSmallCardDefault = Boolean(
    upgradedStyle
    && palette
    && isSameLegacyValue(upgradedStyle.clientFeatureCardBgColor, palette.secondary)
    && isSameLegacyValue(upgradedStyle.clientFeatureCardTextColor, palette.onSecondary)
  );
  const upgradedSelectionStyle = upgradedStyle
    ? {
        ...upgradedStyle,
        rightSelectedTextColor: normalizeRightSelectedTextPreference(upgradedStyle.rightSelectedTextColor),
        ...(isUntouchedPreviousSmallCardDefault
          ? {
              clientFeatureCardBgColor: themeDefaults?.layout.clientFeatureCardBgColor,
              clientFeatureCardTextColor: themeDefaults?.layout.clientFeatureCardTextColor,
            }
          : {}),
      }
    : upgradedStyle;
  const migratedTopbarStyle = upgradedSelectionStyle
    ? {
        ...upgradedSelectionStyle,
        clientTopbarBgColor:
          upgradedSelectionStyle.clientTopbarBgColor ||
          upgradedSelectionStyle.clientSecondaryPageBgColor ||
          themeDefaults?.layout.clientTopbarBgColor ||
          DEFAULT_LAYOUT_STYLE.clientTopbarBgColor,
        clientTopbarTextColor:
          upgradedSelectionStyle.clientTopbarTextColor ||
          upgradedSelectionStyle.clientSecondaryPageTextColor ||
          themeDefaults?.layout.clientTopbarTextColor ||
          DEFAULT_LAYOUT_STYLE.clientTopbarTextColor,
        clientCardBgColor:
          upgradedSelectionStyle.clientCardBgColor ||
          upgradedSelectionStyle.clientFeatureCardBgColor ||
          upgradedSelectionStyle.clientSecondaryTitleBgColor ||
          themeDefaults?.layout.clientCardBgColor ||
          DEFAULT_LAYOUT_STYLE.clientCardBgColor ||
          upgradedSelectionStyle.clientFeatureCardBgColor ||
          DEFAULT_LAYOUT_STYLE.clientFeatureCardBgColor,
        clientCardTextColor:
          upgradedSelectionStyle.clientCardTextColor ||
          upgradedSelectionStyle.clientFeatureCardTextColor ||
          upgradedSelectionStyle.clientSecondaryTitleTextColor ||
          themeDefaults?.layout.clientCardTextColor ||
          DEFAULT_LAYOUT_STYLE.clientCardTextColor ||
          upgradedSelectionStyle.clientFeatureCardTextColor ||
          DEFAULT_LAYOUT_STYLE.clientFeatureCardTextColor,
      }
    : upgradedSelectionStyle;
  return {
    ...DEFAULT_LAYOUT_STYLE,
    ...(themeDefaults?.layout || {}),
    ...(migratedTopbarStyle || {}),
  };
}

export function normalizeSidebarStyle(
  style?: Partial<SidebarStyle> | null,
  themeKey?: ThemePresetKey | string | null
): SidebarStyle {
  const themeDefaults = getFactoryThemeByKey(themeKey);
  const upgradedStyle = upgradeLegacyBuiltinThemeFields<SidebarStyle>(style, themeKey, "sidebar");
  const palette = PRODUCT_MARKET_THEME_PALETTES.find((item) => item.key === normalizeThemeKey(themeKey));
  const previousFactoryGradient = palette
    ? { bgFrom: palette.chrome, bgVia: palette.action, bgTo: palette.chrome }
    : undefined;
  // Upgrade only the exact old factory projection.  A user who has adjusted
  // any of the three stops keeps that custom gradient untouched.
  const isUntouchedPreviousFactoryGradient = Boolean(
    style
    && previousFactoryGradient
    && isSameLegacyValue(style.bgFrom, previousFactoryGradient.bgFrom)
    && isSameLegacyValue(style.bgVia, previousFactoryGradient.bgVia)
    && isSameLegacyValue(style.bgTo, previousFactoryGradient.bgTo)
  );
  const gradientAwareStyle = isUntouchedPreviousFactoryGradient && palette
    ? { ...upgradedStyle, ...buildProductMarketSidebarGradient(palette) }
    : upgradedStyle;
  const fallback = themeDefaults?.sidebar || DEFAULT_SIDEBAR_STYLE;
  return {
    ...DEFAULT_SIDEBAR_STYLE,
    ...fallback,
    ...(gradientAwareStyle || {}),
    bgFrom: gradientAwareStyle?.bgFrom || fallback.bgFrom || DEFAULT_SIDEBAR_STYLE.bgFrom,
    bgVia: gradientAwareStyle?.bgVia || fallback.bgVia || DEFAULT_SIDEBAR_STYLE.bgVia,
    bgTo: gradientAwareStyle?.bgTo || fallback.bgTo || DEFAULT_SIDEBAR_STYLE.bgTo,
    textColor: gradientAwareStyle?.textColor || fallback.textColor || DEFAULT_SIDEBAR_STYLE.textColor,
    activeHighlight:
      gradientAwareStyle?.activeHighlight || fallback.activeHighlight || DEFAULT_SIDEBAR_STYLE.activeHighlight,
    borderColor: gradientAwareStyle?.borderColor || fallback.borderColor || DEFAULT_SIDEBAR_STYLE.borderColor,
    fontFamily: normalizeGlobalFontFamily(gradientAwareStyle?.fontFamily || fallback.fontFamily || DEFAULT_SIDEBAR_STYLE.fontFamily),
    fontWeight: gradientAwareStyle?.fontWeight || fallback.fontWeight || DEFAULT_SIDEBAR_STYLE.fontWeight,
    letterSpacing:
      gradientAwareStyle?.letterSpacing || fallback.letterSpacing || DEFAULT_SIDEBAR_STYLE.letterSpacing,
  };
}

function cleanLayoutSection(section: LayoutSectionConfig, fallback: LayoutSectionConfig): LayoutSectionConfig {
  const legacyTitleMap: Record<string, Record<string, string>> = {
    "theme-panel": {
      "4. 产品市场 / 网站风格设置操作栏": fallback.title,
      "4. 全局右侧设置操作栏": fallback.title,
    },
    "site-switch-card": {
      "8. 联调站点计划切换卡片": fallback.title,
      "5. 站点计划切换 5 秒读条卡片": fallback.title,
    },
    "customer-service-style": {
      "7. 悬浮客服样式": fallback.title,
    },
  };
  const legacyDescriptionMap: Record<string, Record<string, string>> = {
    "theme-panel": {
      "可统一控制“网站风格设置”和“新增主题”区域的背景、文字和按键颜色。": fallback.description,
    },
    "site-switch-card": {
      "联调说明：总部保存后客户端独立计划应立即继承标题、顺序与读条样式。": fallback.description,
      "设置“站点计划切换 5 秒读条卡片”的卡片底色和文字颜色。": fallback.description,
    },
  };
  const sanitizedTitle = sanitizeDisplayText(section.title, fallback.title).trim();
  const normalizedTitle = sanitizedTitle.replace(/^\d+\.\s*/, "");
  const sanitizedDescription = sanitizeDisplayText(section.description, fallback.description).trim();

  return {
    id: fallback.id,
    title: legacyTitleMap[fallback.id]?.[sanitizedTitle] || normalizedTitle || fallback.title,
    description: legacyDescriptionMap[fallback.id]?.[sanitizedDescription] || sanitizedDescription || fallback.description,
  };
}

function mergeLayoutSections(saved?: LayoutSectionConfig[] | null): LayoutSectionConfig[] {
  if (!Array.isArray(saved) || saved.length === 0) {
    return DEFAULT_LAYOUT_SECTIONS.map((section) => ({ ...section }));
  }
  const defaultMap = new Map(DEFAULT_LAYOUT_SECTIONS.map((section) => [section.id, section]));
  const ordered: LayoutSectionConfig[] = [];
  const seen = new Set<string>();

  saved.forEach((section) => {
    const matched = defaultMap.get(section?.id);
    if (!matched || seen.has(matched.id)) return;
    ordered.push(cleanLayoutSection(section, matched));
    seen.add(matched.id);
  });

  DEFAULT_LAYOUT_SECTIONS.forEach((section) => {
    if (seen.has(section.id)) return;
    ordered.push({ ...section });
  });

  return ordered;
}

function cleanCustomerServiceSection(
  section: CustomerServiceSectionConfig,
  fallback: CustomerServiceSectionConfig
): CustomerServiceSectionConfig {
  const sanitizedTitle = sanitizeDisplayText(section.title, fallback.title).trim();
  const sanitizedDescription = sanitizeDisplayText(section.description, fallback.description).trim();
  const isLegacyDefaultTitle = section.title === "选择客服" || section.title === "当前客服真人朗音自定义" || section.title === "客服出现消息发送时提醒声音";
  const isLegacyDefaultDescription = section.description === "每位客服都可独立设置头像、招呼语、动画效果和朗读声音。" || section.description === "下面只针对当前选中的客服生效，不会影响其他客服。";
  return {
    id: fallback.id,
    title: isLegacyDefaultTitle ? fallback.title : (sanitizedTitle || fallback.title),
    description: isLegacyDefaultDescription ? fallback.description : (sanitizedDescription || fallback.description),
  };
}

function mergeCustomerServiceSections(
  saved?: CustomerServiceSectionConfig[] | null
): CustomerServiceSectionConfig[] {
  if (!Array.isArray(saved) || saved.length === 0) {
    return DEFAULT_CUSTOMER_SERVICE_SECTIONS.map((section) => ({ ...section }));
  }
  const defaultMap = new Map(DEFAULT_CUSTOMER_SERVICE_SECTIONS.map((section) => [section.id, section]));
  const ordered: CustomerServiceSectionConfig[] = [];
  const seen = new Set<string>();

  saved.forEach((section) => {
    const matched = defaultMap.get(section?.id);
    if (!matched || seen.has(matched.id)) return;
    ordered.push(cleanCustomerServiceSection(section, matched));
    seen.add(matched.id);
  });

  DEFAULT_CUSTOMER_SERVICE_SECTIONS.forEach((section) => {
    if (seen.has(section.id)) return;
    ordered.push({ ...section });
  });

  return ordered;
}

function cleanAvatarOverride(override?: CustomerServiceAvatarOverride | null): CustomerServiceAvatarOverride | undefined {
  if (!override) return undefined;
  const next: CustomerServiceAvatarOverride = {};
  const cleanedVoiceAssetsByStyle = cleanAudioAssetMap(override.voiceAssetsByStyle);
  const cleanedVoiceImageAssetsByStyle = cleanAudioAssetMap(override.voiceImageAssetsByStyle);
  const hasModernVoiceFields = Boolean(
    (typeof override.femaleVoiceAssetId === "string" && override.femaleVoiceAssetId.trim()) ||
    (typeof override.maleVoiceAssetId === "string" && override.maleVoiceAssetId.trim()) ||
    (cleanedVoiceAssetsByStyle && Object.keys(cleanedVoiceAssetsByStyle).length > 0)
  );
  if (typeof override.mediaAssetId === "string" && override.mediaAssetId.trim()) {
    next.mediaAssetId = override.mediaAssetId;
  }
  if (override.mediaKind === "image" || override.mediaKind === "video" || override.mediaKind === "audio") {
    next.mediaKind = override.mediaKind;
  }
  if (typeof override.mediaMimeType === "string" && override.mediaMimeType.trim()) {
    next.mediaMimeType = override.mediaMimeType;
  }
  if (typeof override.imageDataUrl === "string" && override.imageDataUrl.trim()) {
    next.imageDataUrl = override.imageDataUrl;
  }
  if (typeof override.soundStyle === "string" && override.soundStyle.trim()) {
    next.soundStyle = override.soundStyle;
  }
  if (typeof override.reminderContractVersion === "string" && override.reminderContractVersion.trim()) {
    next.reminderContractVersion = override.reminderContractVersion.trim();
  }
  if (typeof override.expertSequenceContractVersion === "string" && override.expertSequenceContractVersion.trim()) {
    next.expertSequenceContractVersion = override.expertSequenceContractVersion.trim();
  }
  if (typeof override.soundAssetId === "string" && override.soundAssetId.trim()) {
    next.soundAssetId = override.soundAssetId;
  }
  if (typeof override.soundAssetMimeType === "string" && override.soundAssetMimeType.trim()) {
    next.soundAssetMimeType = override.soundAssetMimeType;
  }
  if (typeof override.soundAssetFileName === "string" && override.soundAssetFileName.trim()) {
    next.soundAssetFileName = sanitizeDisplayText(override.soundAssetFileName, "").trim().slice(0, 120);
  }
  const cleanedSoundAssetsByStyle = cleanAudioAssetMap(override.soundAssetsByStyle);
  if (cleanedSoundAssetsByStyle) {
    next.soundAssetsByStyle = cleanedSoundAssetsByStyle;
  }
  if (cleanedVoiceImageAssetsByStyle) {
    next.voiceImageAssetsByStyle = cleanedVoiceImageAssetsByStyle;
  }
  const cleanedReminderImageAssetsByStyle = cleanAudioAssetMap(override.reminderImageAssetsByStyle);
  if (cleanedReminderImageAssetsByStyle) {
    next.reminderImageAssetsByStyle = cleanedReminderImageAssetsByStyle;
  }
  if (typeof override.displayName === "string" && override.displayName.trim()) {
    next.displayName = sanitizeDisplayText(override.displayName, "").trim().slice(0, 30);
  }
  if (typeof override.greetingText === "string" && override.greetingText.trim()) {
    next.greetingText = sanitizeDisplayText(override.greetingText, "").trim().slice(0, 160);
  }
  if (isCustomerServiceAnimation(override.animationStyle)) {
    next.animationStyle = override.animationStyle;
  }
  if (typeof override.voiceEnabled === "boolean") {
    next.voiceEnabled = override.voiceEnabled;
  }
  if (override.voiceGender === "male" || override.voiceGender === "female") {
    next.voiceGender = override.voiceGender;
  }
  if (typeof override.voiceRate === "number" && Number.isFinite(override.voiceRate)) {
    next.voiceRate = normalizeCustomerServiceVoiceRate(override.voiceRate);
  }
  if (typeof override.voiceRateContractVersion === "string" && override.voiceRateContractVersion.trim()) {
    next.voiceRateContractVersion = override.voiceRateContractVersion.trim();
  }
  if (typeof override.voiceStyleKey === "string" && override.voiceStyleKey.trim()) {
    next.voiceStyleKey = override.voiceStyleKey as CustomerServiceVoiceStyleKey;
  }
  if (typeof override.voiceContractVersion === "string" && override.voiceContractVersion.trim()) {
    next.voiceContractVersion = override.voiceContractVersion.trim();
  }
  // Keep the deprecated flat asset just long enough for
  // normalizeVoiceOverrideForPresetAvatar() to migrate it into the expert's
  // numbered voiceAssetsByStyle slot. It is removed before the normalized
  // override is returned.
  if (typeof override.voiceAssetId === "string" && override.voiceAssetId.trim()) {
    next.voiceAssetId = override.voiceAssetId.trim();
  }
  if (typeof override.voiceAssetMimeType === "string" && override.voiceAssetMimeType.trim()) {
    next.voiceAssetMimeType = override.voiceAssetMimeType.trim();
  }
  if (typeof override.voiceAssetFileName === "string" && override.voiceAssetFileName.trim()) {
    next.voiceAssetFileName = sanitizeDisplayText(override.voiceAssetFileName, "").trim().slice(0, 120);
  }
  if (!cleanedVoiceAssetsByStyle && typeof override.femaleVoiceAssetId === "string" && override.femaleVoiceAssetId.trim()) {
    next.femaleVoiceAssetId = override.femaleVoiceAssetId;
  }
  if (!cleanedVoiceAssetsByStyle && typeof override.femaleVoiceAssetMimeType === "string" && override.femaleVoiceAssetMimeType.trim()) {
    next.femaleVoiceAssetMimeType = override.femaleVoiceAssetMimeType;
  }
  if (!cleanedVoiceAssetsByStyle && typeof override.femaleVoiceAssetFileName === "string" && override.femaleVoiceAssetFileName.trim()) {
    next.femaleVoiceAssetFileName = sanitizeDisplayText(override.femaleVoiceAssetFileName, "").trim().slice(0, 120);
  }
  if (!cleanedVoiceAssetsByStyle && typeof override.maleVoiceAssetId === "string" && override.maleVoiceAssetId.trim()) {
    next.maleVoiceAssetId = override.maleVoiceAssetId;
  }
  if (!cleanedVoiceAssetsByStyle && typeof override.maleVoiceAssetMimeType === "string" && override.maleVoiceAssetMimeType.trim()) {
    next.maleVoiceAssetMimeType = override.maleVoiceAssetMimeType;
  }
  if (!cleanedVoiceAssetsByStyle && typeof override.maleVoiceAssetFileName === "string" && override.maleVoiceAssetFileName.trim()) {
    next.maleVoiceAssetFileName = sanitizeDisplayText(override.maleVoiceAssetFileName, "").trim().slice(0, 120);
  }
  if (cleanedVoiceAssetsByStyle) {
    next.voiceAssetsByStyle = cleanedVoiceAssetsByStyle;
  }
  if (Array.isArray(override.materialHistory)) {
    next.materialHistory = override.materialHistory
      .map((item) => {
        const asset = cleanAudioAssetRef(item);
        return asset && (item.kind === "avatar" || item.kind === "voice" || item.kind === "reminder")
          ? { ...asset, kind: item.kind, savedAt: typeof item.savedAt === "string" ? item.savedAt : new Date().toISOString() }
          : undefined;
      })
      .filter(Boolean)
      .slice(0, 3) as CustomerServiceMaterialVersion[];
  }
  return Object.keys(next).length ? next : undefined;
}

function cleanAvatarOverrides(
  overrides?: Record<string, CustomerServiceAvatarOverride> | null
): Record<string, CustomerServiceAvatarOverride> {
  return Object.fromEntries(
    Object.entries(overrides || {})
      .map(([key, value]) => {
        // Legacy builds auto-filled this carrier whenever an audio asset was
        // uploaded. Keep explicit per-style defaults, but drop the automatic
        // fallback fields so an expert's own custom choice always wins.
        const isLegacyDefaultCarrier = key === DEFAULT_FEMALE_VOICE_OVERRIDE_ID || key === DEFAULT_MALE_VOICE_OVERRIDE_ID;
        const candidate = isLegacyDefaultCarrier
          ? {
              ...value,
              femaleVoiceAssetId: undefined,
              femaleVoiceAssetMimeType: undefined,
              femaleVoiceAssetFileName: undefined,
              maleVoiceAssetId: undefined,
              maleVoiceAssetMimeType: undefined,
              maleVoiceAssetFileName: undefined,
            }
          : value;
        const cleaned = cleanAvatarOverride(candidate);
        if (!cleaned) return [key, cleaned] as const;
        return [key, normalizeVoiceOverrideForPresetAvatar(key, cleaned)] as const;
      })
      .filter((entry): entry is [string, CustomerServiceAvatarOverride] => Boolean(entry[1]))
  );
}

function cleanOptionalText(value?: string | null) {
  const cleaned = sanitizeDisplayText(value, "").trim();
  return cleaned || undefined;
}

function cleanSavedDefaultCustomLabel(value?: string | null, previousDefaultLabel?: string | null) {
  const cleaned = cleanOptionalText(value);
  if (!cleaned) return undefined;
  const previousDefault = cleanOptionalText(previousDefaultLabel);
  const comparable = (text: string) => text.replace(/\s+/gu, "").toLocaleLowerCase();
  return (previousDefault && comparable(cleaned) === comparable(previousDefault))
    || LEGACY_DEFAULT_NAVIGATION_LABELS.has(comparable(cleaned))
    ? undefined
    : cleaned;
}

function cleanCustomProduct(product: CustomProductItem): CustomProductItem {
  return {
    ...product,
    label: sanitizeDisplayText(product.label, "未命名功能"),
    status: normalizeProductStatus(product.status),
    children: product.children?.map((child) => ({
      ...child,
      label: sanitizeDisplayText(child.label, "未命名栏目"),
      status: normalizeProductStatus(child.status),
    })),
  };
}

function cleanFactoryPlatformCustomProducts(
  products: CustomProductItem[] | undefined,
  scope: ProductMarketCatalogScope,
) {
  const cleaned = (products || []).map(cleanCustomProduct);
  const factoryPlatformPaths = new Set(ALL_PRODUCTS.map((product) => product.path));
  return scope === "client" || scope === "client_source"
    ? cleaned.filter((product) =>
        !RETIRED_LEGACY_PRIMARY_PATHS.has(product.path)
        && !factoryPlatformPaths.has(product.path)
        && !LEGACY_DEFAULT_NAVIGATION_LABELS.has(product.label.replace(/\s+/gu, "").toLocaleLowerCase())
      )
    : cleaned;
}

function cleanSavedChildren(children?: ProductChildItem[]) {
  return children?.map((child) => ({
    ...child,
    label: sanitizeDisplayText(child.label, "未命名栏目"),
    status: normalizeProductStatus(child.status),
    customLabel: cleanOptionalText(child.customLabel),
    description: cleanOptionalText(child.description),
  }));
}

function mergeChildren(baseChildren?: ProductChildItem[], savedChildren?: ProductChildItem[], enforceSocialWorkflow = false) {
  const normalizedSaved = (cleanSavedChildren(savedChildren) || [])
    .filter((child) => !isRetiredSocialCapabilityPath(child.path))
    .filter((child) => !enforceSocialWorkflow || !RETIRED_SOCIAL_MEDIA_CHILD_PATHS.has(child.path));
  const savedMap = new Map(normalizedSaved.map((child) => [child.path, child]));
  const baseMap = new Map((baseChildren || []).map((child) => [child.path, child]));
  const order = normalizedSaved.length
    ? normalizedSaved.map((child) => child.path)
    : (baseChildren || []).map((child) => child.path);

  const merged = order
    .map((path) => {
      const base = baseMap.get(path);
      const saved = savedMap.get(path);
      if (base) {
        return {
          ...base,
          status: normalizeProductStatus(saved?.status, base.status),
          customLabel: cleanSavedDefaultCustomLabel(saved?.customLabel, saved?.label),
          description: cleanOptionalText(saved?.description) || cleanOptionalText(base.description),
          customStyle: saved?.customStyle ? { ...saved.customStyle } : undefined,
        };
      }
      if (!saved) return null;
      return {
        ...saved,
        label: sanitizeDisplayText(saved.label, "未命名栏目"),
        customLabel: cleanOptionalText(saved.customLabel),
        description: cleanOptionalText(saved.description),
        customStyle: saved.customStyle ? { ...saved.customStyle } : undefined,
      };
    })
    .filter(Boolean) as ProductChildItem[];

  (baseChildren || []).forEach((child) => {
    if (!merged.find((item) => item.path === child.path)) {
      merged.push({ ...child });
    }
  });

  return enforceSocialWorkflow
    ? clearLegacySocialMediaChildLabels(applySocialMediaChildWorkflowOrder(merged))
    : merged;
}

const LEGACY_COMPANY_INFO_CHILD_PATHS = new Set([
  "/company-info?tab=about",
  "/company-info?tab=faq",
  "/company-info?tab=factory",
  "/company-info?tab=gallery",
  "/company-info?tab=exhibition",
  "/company-info?tab=service",
  "/company-info?tab=logistics",
  "/company-info?tab=im",
]);
const LEGACY_COMPANY_INFO_GROUP_PATHS = new Set([
  "/company-info?tab=about",
  "/company-info?tab=service",
  "/company-info?tab=im",
]);

function cloneProductChildren(children?: ProductChildItem[]) {
  return children?.map((child) => ({
    ...child,
      customStyle: child.customStyle ? { ...child.customStyle } : undefined,
      children: cloneProductChildren(child.children),
  }));
}

function migrateLegacyCompanyInfoProducts(products: ProductItem[]) {
  const companyIcon = Building2;
  const serviceIcon = ShieldCheck;
  const contactIcon = MessageCircle;
  const extractedGroups = new Map<string, ProductItem>();
  const cloned = products
    .map((product) => ({
      ...product,
      customStyle: product.customStyle ? { ...product.customStyle } : undefined,
      children: cloneProductChildren(product.children),
    }))
    .filter((product) => {
      if (!LEGACY_COMPANY_INFO_GROUP_PATHS.has(product.path)) return true;
      extractedGroups.set(product.path, product);
      return false;
    });

  const companyInfoProduct = cloned.find((product) => product.path === "/company-info");
  const blogProduct = cloned.find((product) => product.path === "/blog");
  const extractedChildren = new Map<string, ProductChildItem>();

  if (companyInfoProduct?.children?.length) {
    companyInfoProduct.children = companyInfoProduct.children.filter((child) => {
      if (!LEGACY_COMPANY_INFO_CHILD_PATHS.has(child.path)) return true;
      extractedChildren.set(child.path, {
        ...child,
        customStyle: child.customStyle ? { ...child.customStyle } : undefined,
        children: cloneProductChildren(child.children),
      });
      return false;
    });
  }
  if (blogProduct?.children?.length) {
    blogProduct.children = blogProduct.children.filter((child) => child.path !== "/company-info?tab=im");
  }

  const ensureTopLevelGroup = (path: string, label: string) => {
    let existing = cloned.find((product) => product.path === path);
    if (!existing) {
      existing = {
        label,
        path,
        status: "active",
        icon:
          path === "/company-info?tab=service"
            ? serviceIcon
            : path === "/company-info?tab=im"
              ? contactIcon
              : companyIcon,
        children: [],
      };
      const restoredGroupPaths = ["/company-info?tab=about", "/company-info?tab=service", "/company-info?tab=im"];
      const existingGroupIndexes = cloned
        .map((product, index) => (restoredGroupPaths.includes(product.path) ? index : -1))
        .filter((index) => index >= 0);
      const anchorIndex = existingGroupIndexes.length
        ? Math.max(...existingGroupIndexes)
        : Math.max(
            cloned.findIndex((product) => product.path === "/blog"),
            cloned.findIndex((product) => product.path === "/company-info")
          );
      if (anchorIndex >= 0) cloned.splice(anchorIndex + 1, 0, existing);
      else cloned.push(existing);
    }
    if (!existing.children) existing.children = [];
    return existing;
  };
  const ensureChild = (group: ProductItem, path: string, label: string) => {
    let existing = group.children?.find((child) => child.path === path);
    if (!existing) {
      existing = { label, path, status: "active" };
      group.children = [...(group.children || []), existing];
    }
    return existing;
  };

  const applyChildMeta = (target: ProductChildItem | undefined, source?: ProductChildItem | ProductItem) => {
    if (!target || !source) return;
    target.status = source.status;
    target.customLabel = cleanOptionalText(source.customLabel);
    target.customStyle = source.customStyle ? { ...source.customStyle } : target.customStyle;
  };
  // 旧版会把“关于我们 / 服务保障 / 联系我们”作为独立顶层项目保存。
  // 迁移到带二级内容的新结构时，必须保留顶层项目自身的状态；否则每次导入
  // 都会因 ensureTopLevelGroup 的默认值而把“隐藏/取消”错误地恢复为“开通”。
  const applyGroupMeta = (target: ProductItem | undefined, source?: ProductItem | ProductChildItem) => {
    if (!target || !source) return;
    target.status = source.status;
    target.customLabel = cleanOptionalText(source.customLabel);
    target.customStyle = source.customStyle ? { ...source.customStyle } : target.customStyle;
  };
  const enforceChildLabel = (target: ProductChildItem | undefined, label: string) => {
    if (!target) return;
    target.label = label;
    if (!target.customLabel || target.customLabel.trim() === "" || target.customLabel.trim() === target.path.trim()) {
      target.customLabel = label;
    }
  };

  const companyChild = companyInfoProduct?.children?.find((child) => child.path === "/company-info?tab=about");
  const serviceChild = companyInfoProduct?.children?.find((child) => child.path === "/company-info?tab=service");
  const blogImChild = blogProduct?.children?.find((child) => child.path === "/company-info?tab=im");

  const legacyCompanyGroup = extractedGroups.get("/company-info?tab=about") || extractedChildren.get("/company-info?tab=about");
  const legacyServiceGroup = extractedGroups.get("/company-info?tab=service") || extractedChildren.get("/company-info?tab=service");
  const legacyImGroup = extractedGroups.get("/company-info?tab=im") || extractedChildren.get("/company-info?tab=im");

  applyChildMeta(companyChild, legacyCompanyGroup);
  applyChildMeta(serviceChild, legacyServiceGroup);
  applyChildMeta(blogImChild, legacyImGroup);

  const aboutGroup = ensureTopLevelGroup("/company-info?tab=about", "关于我们");
  const serviceGroup = ensureTopLevelGroup("/company-info?tab=service", "服务保障");
  const contactGroup = ensureTopLevelGroup("/company-info?tab=im", "联系我们");
  applyGroupMeta(aboutGroup, legacyCompanyGroup);
  applyGroupMeta(serviceGroup, legacyServiceGroup);
  applyGroupMeta(contactGroup, legacyImGroup);
  const aboutEntry = ensureChild(aboutGroup, "/company-info?tab=about", "公司介绍");
  const factoryEntry = ensureChild(aboutGroup, "/company-info?tab=factory", "工厂生产");
  const galleryEntry = ensureChild(aboutGroup, "/company-info?tab=gallery", "公司风采");
  const faqEntry = ensureChild(serviceGroup, "/company-info?tab=faq", "FAQ");
  const exhibitionEntry = ensureChild(serviceGroup, "/company-info?tab=exhibition", "展会活动");
  const logisticsEntry = ensureChild(serviceGroup, "/company-info?tab=logistics", "物流货运");
  const imEntry = ensureChild(contactGroup, "/company-info?tab=im", "IM 客服");

  applyChildMeta(aboutEntry, companyChild || legacyCompanyGroup);
  applyChildMeta(factoryEntry, extractedChildren.get("/company-info?tab=factory"));
  applyChildMeta(galleryEntry, extractedChildren.get("/company-info?tab=gallery"));
  applyChildMeta(faqEntry, extractedChildren.get("/company-info?tab=faq"));
  applyChildMeta(exhibitionEntry, extractedChildren.get("/company-info?tab=exhibition"));
  applyChildMeta(logisticsEntry, extractedChildren.get("/company-info?tab=logistics"));
  applyChildMeta(imEntry, blogImChild || legacyImGroup);
  enforceChildLabel(aboutEntry, "公司介绍");
  enforceChildLabel(factoryEntry, "工厂生产");
  enforceChildLabel(galleryEntry, "公司风采");
  enforceChildLabel(faqEntry, "FAQ");
  enforceChildLabel(exhibitionEntry, "展会活动");
  enforceChildLabel(logisticsEntry, "物流货运");
  enforceChildLabel(imEntry, "IM 客服");

  aboutGroup.icon = companyIcon;
  serviceGroup.icon = serviceIcon;
  contactGroup.icon = contactIcon;
  if (companyInfoProduct) {
    companyInfoProduct.icon = companyIcon;
  }
  if (blogProduct) {
    blogProduct.icon = blogProduct.icon || MessageCircle;
  }

  return cloned;
}

const HOME_DESIGN_PRODUCT_PATH = "/company-info?tab=navigation";
const HOME_DESIGN_CHILD_DEFAULTS: ProductChildItem[] = [
  { label: "导航栏自定义", path: "/company-info?tab=navigation", status: "active", description: "网站导航结构，支持一级导航和外层二级导航，同步影响网站预览。" },
  { label: "首页 Banner", path: "/company-info?tab=banner", status: "active" },
  { label: "产品推荐", path: "/company-info?tab=recommend", status: "active" },
];
const HOME_DESIGN_CHILD_PATHS = new Set(HOME_DESIGN_CHILD_DEFAULTS.map((child) => child.path));

function migrateHomeDesignProducts(products: ProductItem[]) {
  const cloned = products.map((product) => ({
    ...product,
    customStyle: product.customStyle ? { ...product.customStyle } : undefined,
    children: cloneProductChildren(product.children),
  }));
  const extractedChildren = new Map<string, ProductChildItem>();
  const companyInfoProduct = cloned.find((product) => product.path === "/company-info");

  if (companyInfoProduct?.children?.length) {
    companyInfoProduct.children = companyInfoProduct.children.filter((child) => {
      if (!HOME_DESIGN_CHILD_PATHS.has(child.path)) return true;
      extractedChildren.set(child.path, {
        ...child,
        customStyle: child.customStyle ? { ...child.customStyle } : undefined,
        children: cloneProductChildren(child.children),
      });
      return false;
    });
  }

  let homeDesignProduct = cloned.find((product) => product.path === HOME_DESIGN_PRODUCT_PATH);
  const existingHomeChildren = new Map((homeDesignProduct?.children || []).map((child) => [child.path, child]));

  if (!homeDesignProduct) {
    homeDesignProduct = {
      label: "首页设计",
      path: HOME_DESIGN_PRODUCT_PATH,
      status: "active",
      icon: LayoutTemplate,
      children: [],
    };
    cloned.push(homeDesignProduct);
  }

  homeDesignProduct.label = "首页设计";
  homeDesignProduct.icon = LayoutTemplate;
  homeDesignProduct.status = homeDesignProduct.status || "active";
  homeDesignProduct.children = HOME_DESIGN_CHILD_DEFAULTS.map((fallback) => {
    const saved = extractedChildren.get(fallback.path) || existingHomeChildren.get(fallback.path);
    return {
      ...fallback,
      status: saved?.status || fallback.status,
      customLabel: cleanOptionalText(saved?.customLabel),
      description: cleanOptionalText(saved?.description),
      customStyle: saved?.customStyle ? { ...saved.customStyle } : undefined,
      children: cloneProductChildren(saved?.children),
    };
  });

  const currentHomeIndex = cloned.findIndex((product) => product.path === HOME_DESIGN_PRODUCT_PATH);
  const companyIndex = cloned.findIndex((product) => product.path === "/company-info");
  if (currentHomeIndex >= 0 && companyIndex >= 0 && currentHomeIndex !== companyIndex + 1) {
    const [homeDesign] = cloned.splice(currentHomeIndex, 1);
    const nextCompanyIndex = cloned.findIndex((product) => product.path === "/company-info");
    cloned.splice(nextCompanyIndex + 1, 0, homeDesign);
  }

  return cloned;
}

const DOMAIN_MANAGEMENT_PATH = "/site-settings?tab=domains";
const DOMAIN_MANAGEMENT_CHILD_DEFAULTS: ProductChildItem[] = [
  { label: "域名注册", path: "/site-settings?tab=domain-register", status: "active", description: "登记、续费和查看当前计划可用的域名。" },
  { label: "绑定解析", path: "/site-settings?tab=domain-binding", status: "active", description: "将域名绑定到当前站点，并检查解析状态。" },
  { label: "域名转出", path: "/site-settings?tab=domain-transfer", status: "active", description: "管理授权码、转出条件和域名迁移状态。" },
];
const HEALTH_COCKPIT_PATH = "/health-cockpit";
const HEALTH_COCKPIT_CHILD_DEFAULTS: ProductChildItem[] = [
  { label: "内容健度", path: "/health-cockpit?tab=content", status: "active" },
  { label: "宣传健度", path: "/health-cockpit?tab=promotion", status: "active" },
  { label: "流量健度", path: "/health-cockpit?tab=traffic", status: "active" },
  { label: "资产健度", path: "/health-cockpit?tab=assets", status: "active" },
];
const HEALTH_COCKPIT_CHILD_PATHS = new Set(HEALTH_COCKPIT_CHILD_DEFAULTS.map((child) => child.path));

function migrateDomainManagementProducts(products: ProductItem[]) {
  const cloned = products.map((product) => ({
    ...product,
    customStyle: product.customStyle ? { ...product.customStyle } : undefined,
    children: cloneProductChildren(product.children),
  }));
  const defaults = ALL_PRODUCTS.find((product) => product.path === DOMAIN_MANAGEMENT_PATH);
  if (!defaults) return cloned;

  let domainProduct = cloned.find((product) => product.path === DOMAIN_MANAGEMENT_PATH);
  if (!domainProduct) {
    domainProduct = { ...defaults, children: [] };
    cloned.push(domainProduct);
  }

  const savedChildren = new Map((domainProduct.children || []).map((child) => [child.path, child]));
  domainProduct.label = "网址域名";
  domainProduct.icon = Link2;
  domainProduct.description = "管理域名注册、绑定解析和域名转出的统一入口。";
  domainProduct.children = DOMAIN_MANAGEMENT_CHILD_DEFAULTS.map((fallback) => {
    const saved = savedChildren.get(fallback.path);
    return {
      ...fallback,
      status: saved?.status || fallback.status,
      customLabel: cleanOptionalText(saved?.customLabel),
      description: cleanOptionalText(saved?.description) || fallback.description,
      customStyle: saved?.customStyle ? { ...saved.customStyle } : undefined,
      children: cloneProductChildren(saved?.children),
    };
  });

  const currentIndex = cloned.findIndex((product) => product.path === DOMAIN_MANAGEMENT_PATH);
  const settingsIndex = cloned.findIndex((product) => product.path === "/site-settings");
  if (currentIndex >= 0 && settingsIndex >= 0 && currentIndex !== settingsIndex + 1) {
    const [domainItem] = cloned.splice(currentIndex, 1);
    const nextSettingsIndex = cloned.findIndex((product) => product.path === "/site-settings");
    cloned.splice(nextSettingsIndex + 1, 0, domainItem);
  }
  return cloned;
}

function migrateHealthCockpitProducts(products: ProductItem[]) {
  const cloned = products.map((product) => ({
    ...product,
    customStyle: product.customStyle ? { ...product.customStyle } : undefined,
    children: cloneProductChildren(product.children),
  }));
  const extractedChildren = new Map<string, ProductChildItem>();
  const healthCockpitProduct = cloned.find((product) => product.path === HEALTH_COCKPIT_PATH);

  if (healthCockpitProduct?.children?.length) {
    healthCockpitProduct.children = healthCockpitProduct.children.filter((child) => {
      if (!HEALTH_COCKPIT_CHILD_PATHS.has(child.path)) return true;
      extractedChildren.set(child.path, {
        ...child,
        customStyle: child.customStyle ? { ...child.customStyle } : undefined,
        children: cloneProductChildren(child.children),
      });
      return false;
    });
  }

  let cockpitProduct = healthCockpitProduct;
  const existingCockpitChildren = new Map((cockpitProduct?.children || []).map((child) => [child.path, child]));

  if (!cockpitProduct) {
    cockpitProduct = {
      label: "健康驾舱",
      path: HEALTH_COCKPIT_PATH,
      status: "active",
      icon: BarChart3,
      children: [],
    };
    cloned.push(cockpitProduct);
  }

  cockpitProduct.label = "健康驾舱";
  cockpitProduct.icon = BarChart3;
  cockpitProduct.status = cockpitProduct.status || "active";
  cockpitProduct.children = HEALTH_COCKPIT_CHILD_DEFAULTS.map((fallback) => {
    const saved = extractedChildren.get(fallback.path) || existingCockpitChildren.get(fallback.path);
    return {
      ...fallback,
      status: saved?.status || fallback.status,
      customLabel: cleanOptionalText(saved?.customLabel),
      description: cleanOptionalText(saved?.description),
      customStyle: saved?.customStyle ? { ...saved.customStyle } : undefined,
      children: cloneProductChildren(saved?.children),
    };
  });

  const currentCockpitIndex = cloned.findIndex((product) => product.path === HEALTH_COCKPIT_PATH);
  const crmIndex = cloned.findIndex((product) => product.path === "/customers");
  if (currentCockpitIndex >= 0 && crmIndex >= 0 && currentCockpitIndex !== crmIndex + 1) {
    const [cockpitItem] = cloned.splice(currentCockpitIndex, 1);
    const nextCrmIndex = cloned.findIndex((product) => product.path === "/customers");
    cloned.splice(nextCrmIndex + 1, 0, cockpitItem);
  }

  return cloned;
}

function cloneDefaultProducts(scope: ProductMarketCatalogScope = "client") {
  const catalog = getProductMarketCatalogProducts(scope);
  return scope === "client" || scope === "client_source"
    ? applyProductModuleBaselineOrder(catalog)
    : catalog;
}

export const useProductMarketStore = create<ProductMarketState>()(
  persist(
    (set, get) => ({
      catalogScope: "client",
      products: cloneDefaultProducts(),
      customDefaultPaths: DEFAULT_ACTIVE_PATHS,
      layoutStyle: DEFAULT_LAYOUT_STYLE,
      visualCardLayout: undefined,
      layoutSections: DEFAULT_LAYOUT_SECTIONS.map((section) => ({ ...section })),
      customerServiceSections: DEFAULT_CUSTOMER_SERVICE_SECTIONS.map((section) => ({ ...section })),
      moduleActionOrder: ["module-table-toggle", "module-toggle", "restore", "save"],
      layoutActionOrder: ["theme-toggle", "theme-status", "restore", "save"],
      customerServiceActionOrder: ["collapse", "restore", "save"],
      activeTheme: "rose" as ThemePresetKey | string,
      productOrder: PRODUCT_MODULE_BASELINE_PATHS.slice(),
      moduleOrderBaselineVersion: PRODUCT_MODULE_BASELINE_VERSION,
      moduleCategoryOrder: PRODUCT_MODULE_CATEGORY_ORDER.slice(),
      moduleCategoryAssignments: buildDefaultProductModuleCategoryAssignments(),
      moduleCategoryStyles: {},
      moduleIconVisibility: { ...DEFAULT_PRODUCT_MODULE_ICON_VISIBILITY },
      customThemes: [] as CustomThemeData[],
      builtinThemeOverrides: {} as Record<string, CustomThemeData>,
      sidebarStyle: { ...DEFAULT_SIDEBAR_STYLE },
      globalFontFamily: DEFAULT_DESIGN_FONT_STACK,
      globalFontWeight: DEFAULT_DESIGN_FONT_WEIGHT,
      globalLetterSpacing: DEFAULT_DESIGN_LETTER_SPACING,
      soundEnabled: true,
      soundVolume: 0.5,
      soundStyle: "crisp",
      setStatus: (path, status) =>
        set((state) => {
          const activeThemePreset =
            state.getAllThemes().find((theme) => theme.key === state.activeTheme) ||
            FACTORY_BUILTIN_THEMES[0];
          const newDefaults = status === "active"
            ? (state.customDefaultPaths.includes(path) ? state.customDefaultPaths : [...state.customDefaultPaths, path])
            : state.customDefaultPaths.filter((p) => p !== path);
          return {
            products: state.products.map((p) =>
              p.path === path
                ? {
                    ...p,
                    status,
                    customStyle: buildStatusDrivenProductStyle(
                      p.customStyle,
                      resolveThemeCardColors(activeThemePreset, status)
                    ),
                  }
                : p
            ),
            customDefaultPaths: newDefaults,
          };
        }),
      batchSetStatus: (paths, status) =>
        set((state) => {
          const eligiblePaths = paths;
          const activeThemePreset =
            state.getAllThemes().find((theme) => theme.key === state.activeTheme) ||
            FACTORY_BUILTIN_THEMES[0];
          let newDefaults = [...state.customDefaultPaths];
          if (status === "active") {
            eligiblePaths.forEach((p) => { if (!newDefaults.includes(p)) newDefaults.push(p); });
          } else {
            newDefaults = newDefaults.filter((p) => !eligiblePaths.includes(p));
          }
          return {
            products: state.products.map((p) =>
              eligiblePaths.includes(p.path)
                ? {
                    ...p,
                    status,
                    customStyle: buildStatusDrivenProductStyle(
                      p.customStyle,
                      resolveThemeCardColors(activeThemePreset, status)
                    ),
                  }
                : p
            ),
            customDefaultPaths: newDefaults,
          };
        }),
      resetToDefault: () => {
          // Keep defaults only from the active source catalogue (remove custom product paths).
          const allProductPaths = getProductMarketCatalogProducts(get().catalogScope).map((p) => p.path);
        const customPaths = get().customDefaultPaths.filter((p) => allProductPaths.includes(p));
        set({
          products: cloneDefaultProducts(get().catalogScope).map((p) => ({
            ...p,
            status: customPaths.includes(p.path) ? "active" : "inactive",
          })),
          customProducts: [],
          customDefaultPaths: customPaths,
          layoutStyle: { ...DEFAULT_LAYOUT_STYLE },
          visualCardLayout: undefined,
          layoutSections: DEFAULT_LAYOUT_SECTIONS.map((section) => ({ ...section })),
          customerServiceSections: DEFAULT_CUSTOMER_SERVICE_SECTIONS.map((section) => ({ ...section })),
          moduleActionOrder: ["module-table-toggle", "module-toggle", "restore", "save"],
          layoutActionOrder: ["theme-toggle", "theme-status", "restore", "save"],
          customerServiceActionOrder: ["collapse", "restore", "save"],
          activeTheme: "rose",
          productOrder: PRODUCT_MODULE_BASELINE_PATHS.slice(),
          moduleOrderBaselineVersion: PRODUCT_MODULE_BASELINE_VERSION,
          moduleCategoryOrder: PRODUCT_MODULE_CATEGORY_ORDER.slice(),
          moduleCategoryAssignments: buildDefaultProductModuleCategoryAssignments(),
          moduleCategoryStyles: {},
          moduleIconVisibility: { ...DEFAULT_PRODUCT_MODULE_ICON_VISIBILITY },
          sidebarStyle: { ...DEFAULT_SIDEBAR_STYLE },
          globalFontFamily: DEFAULT_DESIGN_FONT_STACK,
          globalFontWeight: DEFAULT_DESIGN_FONT_WEIGHT,
          globalLetterSpacing: DEFAULT_DESIGN_LETTER_SPACING,
          soundEnabled: true,
          soundVolume: 0.5,
          soundStyle: "crisp",
          csAvatarId: "pro-female",
          csEnabled: true,
          csAvatarOverrides: {},
          customerServiceCustomized: false,
          layoutCustomized: false,
          layoutStructureCustomized: false,
          csVoiceEnabled: false,
          csVoiceGender: "female",
          csVoiceRate: DEFAULT_CUSTOMER_SERVICE_VOICE_RATE,
        });
      },
      resetToFactory: () => {
        const catalogScope = get().catalogScope;
        const catalogProducts = cloneDefaultProducts(catalogScope);
        set({
          products: catalogProducts,
          customProducts: [],
          customDefaultPaths: getProductMarketCatalogDefaultPaths(catalogScope),
          layoutStyle: { ...DEFAULT_LAYOUT_STYLE },
          visualCardLayout: undefined,
          layoutSections: DEFAULT_LAYOUT_SECTIONS.map((section) => ({ ...section })),
          customerServiceSections: DEFAULT_CUSTOMER_SERVICE_SECTIONS.map((section) => ({ ...section })),
          moduleActionOrder: ["module-table-toggle", "module-toggle", "restore", "save"],
          layoutActionOrder: ["theme-toggle", "theme-status", "restore", "save"],
          customerServiceActionOrder: ["collapse", "restore", "save"],
          activeTheme: "rose",
          productOrder: catalogProducts.map((product) => product.path),
          moduleOrderBaselineVersion: PRODUCT_MODULE_BASELINE_VERSION,
          moduleCategoryOrder: PRODUCT_MODULE_CATEGORY_ORDER.slice(),
          moduleCategoryAssignments: buildDefaultProductModuleCategoryAssignments(),
          moduleCategoryStyles: {},
          moduleIconVisibility: { ...DEFAULT_PRODUCT_MODULE_ICON_VISIBILITY },
          customThemes: [],
          builtinThemeOverrides: {},
          sidebarStyle: { ...DEFAULT_SIDEBAR_STYLE },
          globalFontFamily: DEFAULT_DESIGN_FONT_STACK,
          globalFontWeight: DEFAULT_DESIGN_FONT_WEIGHT,
          globalLetterSpacing: DEFAULT_DESIGN_LETTER_SPACING,
          soundEnabled: true,
          soundVolume: 0.5,
          soundStyle: "crisp",
          csAvatarId: "pro-female",
          csEnabled: true,
          csAvatarOverrides: {},
          customerServiceCustomized: false,
          layoutCustomized: false,
          layoutStructureCustomized: false,
          csVoiceEnabled: false,
          csVoiceGender: "female",
          csVoiceRate: DEFAULT_CUSTOMER_SERVICE_VOICE_RATE,
        });
      },
      setCustomDefault: (paths) => set({ customDefaultPaths: paths }),
      applyCustomDefault: () => {
        const customPaths = get().customDefaultPaths;
        set((state) => ({
          products: state.products.map((p) => ({
            ...p,
            status: customPaths.includes(p.path) ? "active" : "inactive",
          })),
        }));
      },
      syncProducts: (sidebarItems) => {
        set((state) => {
          const isFactoryBlueprintScope = state.catalogScope === "client" || state.catalogScope === "client_source";
          const currentProducts = isFactoryBlueprintScope
            ? state.products.filter((product) => !RETIRED_LEGACY_PRIMARY_PATHS.has(product.path))
            : state.products;
          const allowedBlueprintPaths = new Set(ALL_PRODUCTS.map((product) => product.path));
          const existingPaths = new Set(currentProducts.map((product) => product.path));
          const newItems = sidebarItems
            .filter((item) => !isFactoryBlueprintScope || allowedBlueprintPaths.has(item.path))
            .filter((item) => {
              if (existingPaths.has(item.path)) return false;
              existingPaths.add(item.path);
              return true;
            })
            .map((item) => ({
              label: item.label,
              path: item.path,
              status: "inactive" as ProductStatus,
              icon: item.icon,
            }));
          const removedLegacyItems = currentProducts.length !== state.products.length;
          if (newItems.length === 0 && !removedLegacyItems) return state;
          const newProducts = [...currentProducts, ...newItems];
          return {
            products: newProducts,
            productOrder: dedupeProductOrderPaths([
              ...state.productOrder.filter((path) => !RETIRED_LEGACY_PRIMARY_PATHS.has(path)),
              ...newItems.map((i) => i.path),
            ]),
          };
        });
      },
      setProductCustomStyle: (path, style) =>
        set((state) => ({
          products: state.products.map((p) =>
            p.path === path
              ? { ...p, customStyle: { ...p.customStyle, ...style } }
              : p
          ),
          activeTheme: "custom",
        })),
      setProductCustomLabel: (path, label) =>
        set((state) => ({
          products: state.products.map((p) =>
            p.path === path ? { ...p, customLabel: cleanOptionalText(label) } : p
          ),
        })),
      setLayoutStyle: (style) =>
        set((state) => ({
          layoutStyle: { ...state.layoutStyle, ...style },
          activeTheme: "custom",
        })),
      setLayoutSections: (sections) =>
        set(() => ({
          layoutSections: mergeLayoutSections(sections),
        })),
      setCustomerServiceSections: (sections) =>
        set(() => ({
          customerServiceSections: mergeCustomerServiceSections(sections),
        })),
      setModuleActionOrder: (order) => set({ moduleActionOrder: order }),
      setLayoutActionOrder: (order) => set({ layoutActionOrder: order }),
      setCustomerServiceActionOrder: (order) => set({ customerServiceActionOrder: order }),
      setModuleCategoryOrder: (order) =>
        set((state) => ({
          moduleCategoryOrder: normalizeModuleCategoryOrder(order),
          moduleCategoryAssignments: normalizeModuleCategoryAssignments(
            state.moduleCategoryAssignments,
            state.products.map((product) => product.path)
          ),
        })),
      setModuleCategoryAssignments: (assignments) =>
        set((state) => ({
          moduleCategoryAssignments: normalizeModuleCategoryAssignments(
            assignments,
            state.products.map((product) => product.path)
          ),
          moduleCategoryOrder: normalizeModuleCategoryOrder(state.moduleCategoryOrder),
        })),
      setModuleCategoryStyles: (styles) =>
        set(() => ({
          moduleCategoryStyles: normalizeModuleCategoryStyles(styles),
        })),
      setModuleIconVisibility: (visibility) =>
        set((state) => ({
          moduleIconVisibility: normalizeModuleIconVisibility({
            ...state.moduleIconVisibility,
            ...visibility,
          }),
        })),
      applyTheme: (key) => {
        const allThemes = get().getAllThemes();
        const preset = allThemes.find((t) => t.key === key);
        if (!preset) return;
        set((state) => ({
          layoutStyle: normalizeLayoutStyle(
            {
              ...preset.layout,
              presetThemeBlackTextColor: state.layoutStyle.presetThemeBlackTextColor,
              presetThemeLightTextColor: state.layoutStyle.presetThemeLightTextColor,
              presetThemeRoseTextColor: state.layoutStyle.presetThemeRoseTextColor,
              presetThemeOrangeTextColor: state.layoutStyle.presetThemeOrangeTextColor,
              presetThemeBlackBgColor: state.layoutStyle.presetThemeBlackBgColor,
              presetThemeLightBgColor: state.layoutStyle.presetThemeLightBgColor,
              presetThemeRoseBgColor: state.layoutStyle.presetThemeRoseBgColor,
              presetThemeOrangeBgColor: state.layoutStyle.presetThemeOrangeBgColor,
              presetThemeBlackLabel: state.layoutStyle.presetThemeBlackLabel,
              presetThemeLightLabel: state.layoutStyle.presetThemeLightLabel,
              presetThemeRoseLabel: state.layoutStyle.presetThemeRoseLabel,
              presetThemeOrangeLabel: state.layoutStyle.presetThemeOrangeLabel,
            },
            preset.key
          ),
          sidebarStyle: { ...preset.sidebar },
          globalFontFamily: preset.fontFamily || DEFAULT_DESIGN_FONT_STACK,
          globalFontWeight: preset.layout.globalFontWeight || preset.sidebar.fontWeight || DEFAULT_DESIGN_FONT_WEIGHT,
          globalLetterSpacing: preset.layout.globalLetterSpacing || preset.sidebar.letterSpacing || DEFAULT_DESIGN_LETTER_SPACING,
          products: state.products.map((p) => {
            const colors = preset[
              p.status === "active" ? "cardActive" : p.status === "hidden" ? "cardHidden" : "cardInactive"
            ];
            return {
              ...p,
              customStyle: {
                ...p.customStyle,
                bgColor: colors.bg,
                borderColor: colors.border,
                fontColor: colors.font,
                buttonColor: colors.button,
                nameFontColor: colors.nameFont || colors.font,
              },
            };
          }),
          activeTheme: key,
        }));
      },
      reorderProducts: (orderedPaths) => {
        set((state) => {
          const normalizedPaths = dedupeProductOrderPaths(orderedPaths);
          const productMap = new Map(state.products.map((p) => [p.path, p]));
          const reordered = normalizedPaths
            .map((path) => productMap.get(path))
            .filter(Boolean) as ProductItem[];
          state.products.forEach((p) => {
            if (!normalizedPaths.includes(p.path)) reordered.push(p);
          });
          return { products: reordered, productOrder: reordered.map((p) => p.path) };
        });
      },
      applyProductModuleBaseline: () => {
        set((state) => {
          const previousBaselineVersion = state.moduleOrderBaselineVersion;
          const shouldGraduatePilots = previousBaselineVersion < PRODUCT_MODULE_BASELINE_VERSION;
          const productByPath = new Map(state.products.map((product) => {
            const path = migrateFactoryContentCmsPath(product.path, previousBaselineVersion);
            return [path, path === product.path ? product : { ...product, path }];
          }));
          const orderedPaths = applyProductModuleBaselinePaths(
            state.products.map((product) => migrateFactoryContentCmsPath(product.path, previousBaselineVersion)),
            state.moduleCategoryAssignments,
          );
          const products = orderedPaths
            .map((path) => productByPath.get(path) || ALL_PRODUCTS.find((product) => product.path === path))
            .filter((product): product is ProductItem => Boolean(product));
          const graduatedProducts = products.map((product) => shouldGraduatePilots && shouldActivateFactoryPlatformPathForBaseline(product.path, previousBaselineVersion)
            ? { ...product, status: "active" as ProductStatus }
            : product);
          return {
            products: graduatedProducts,
            productOrder: graduatedProducts.map((product) => product.path),
            moduleOrderBaselineVersion: PRODUCT_MODULE_BASELINE_VERSION,
            moduleCategoryOrder: applyProductModuleCategoryBaselineOrder(state.moduleCategoryOrder),
          };
        });
      },
      exportConfig: () => {
        const state = get();
        return {
          catalogScope: state.catalogScope,
          products: state.products.map(({ label, path, status, customLabel, description, customStyle, children }) => ({
            label, path, status, customLabel, description, customStyle, children,
          })),
          customDefaultPaths: state.customDefaultPaths,
          layoutStyle: state.layoutStyle,
          visualCardLayout: state.visualCardLayout
            ? cloneVisualCardLayout(state.visualCardLayout)
            : undefined,
          layoutSections: state.layoutSections.map((section) => ({ ...section })),
          customerServiceSections: state.customerServiceSections.map((section) => ({ ...section })),
          moduleActionOrder: [...state.moduleActionOrder],
          layoutActionOrder: [...state.layoutActionOrder],
          customerServiceActionOrder: [...state.customerServiceActionOrder],
          activeTheme: state.activeTheme,
          productOrder: state.productOrder,
          moduleOrderBaselineVersion: state.moduleOrderBaselineVersion,
          moduleCategoryOrder: state.moduleCategoryOrder,
          moduleCategoryAssignments: state.moduleCategoryAssignments,
          moduleCategoryStyles: normalizeModuleCategoryStyles(state.moduleCategoryStyles),
          moduleIconVisibility: normalizeModuleIconVisibility(state.moduleIconVisibility),
          customThemes: state.customThemes,
          builtinThemeOverrides: state.builtinThemeOverrides,
          sidebarStyle: state.sidebarStyle,
          globalFontFamily: state.globalFontFamily,
          globalFontWeight: state.globalFontWeight,
          globalLetterSpacing: state.globalLetterSpacing,
          customProducts: state.customProducts,
          soundEnabled: state.soundEnabled,
          soundVolume: state.soundVolume,
          soundStyle: state.soundStyle,
          csAvatarId: state.csAvatarId,
          csEnabled: state.csEnabled,
          csAvatarOverrides: state.csAvatarOverrides,
          customerServiceCustomized: state.customerServiceCustomized,
          layoutCustomized: state.layoutCustomized,
          layoutStructureCustomized: state.layoutStructureCustomized,
          csVoiceEnabled: state.csVoiceEnabled,
          csVoiceGender: state.csVoiceGender,
          csVoiceRate: state.csVoiceRate,
        };
      },
      importConfig: (config) => {
        if (!config?.products || !Array.isArray(config.products)) return;
        set(() => {
          const catalogScope = normalizeProductMarketCatalogScope(config.catalogScope);
          const catalogProducts = getProductMarketCatalogProducts(catalogScope);
          const retiredTheme = isRetiredThemeKey(config.activeTheme);
          const resolvedActiveTheme = resolveStoredThemeKey(config, "rose");
          const resolvedTheme = retiredTheme ? getFactoryThemeByKey("rose") : resolveConfigTheme(config);
          const importedOrder = dedupeProductOrderPaths(
            config.productOrder?.length ? config.productOrder : catalogProducts.map((p) => p.path),
          );
          const shouldApplyProductModuleBaseline =
            (catalogScope === "client" || catalogScope === "client_source")
            && (config.moduleOrderBaselineVersion ?? 0) < PRODUCT_MODULE_BASELINE_VERSION;
          const previousBaselineVersion = config.moduleOrderBaselineVersion ?? 0;
          const importedProductByPath = new Map(config.products.map((product) => {
            const path = migrateFactoryContentCmsPath(product.path, previousBaselineVersion);
            return [path, path === product.path ? product : { ...product, path }];
          }));
          const normalizedOrder = shouldApplyProductModuleBaseline
            ? applyProductModuleBaselinePaths(importedOrder.map((path) => migrateFactoryContentCmsPath(path, previousBaselineVersion)), config.moduleCategoryAssignments)
            : (catalogScope === "client" || catalogScope === "client_source")
              ? importedOrder.filter((path) => !RETIRED_LEGACY_PRIMARY_PATHS.has(path))
              : importedOrder;
          const merged = normalizedOrder
            .map((path) => {
              const base = catalogProducts.find((p) => p.path === path);
              const saved = importedProductByPath.get(path);
              if (!base && saved) {
                const icon = ICON_OPTIONS.find((o) => o.name === (saved.customStyle?.iconName || ""))?.icon || Package;
                return {
                  ...saved,
                  label: sanitizeDisplayText(saved.label, "未命名功能"),
                  status: normalizeProductStatus(saved.status),
                  customLabel: cleanOptionalText(saved.customLabel),
                  description: cleanOptionalText(saved.description),
                  icon,
                  children: cleanSavedChildren(saved.children),
                } as ProductItem;
              }
              if (!base) return null;
              if (!saved) return { ...base, children: base.children?.map((child) => ({ ...child })) };
              const children = mergeChildren(base.children, saved.children, base.path === "/social");
              return {
                ...base,
                status: shouldApplyProductModuleBaseline && shouldActivateFactoryPlatformPathForBaseline(base.path, config.moduleOrderBaselineVersion ?? 0)
                  ? "active"
                  : normalizeDeliverySafeProductStatus(saved.status, base.deliveryStatus, base.status),
                customLabel: cleanSavedDefaultCustomLabel(saved.customLabel, saved.label),
                description: cleanOptionalText(saved.description) || cleanOptionalText(base.description),
                customStyle: saved.customStyle,
                children,
              };
            })
            .filter(Boolean) as ProductItem[];
          cloneDefaultProducts(catalogScope).forEach((p) => {
            if (!merged.find((m) => m.path === p.path)) {
              merged.push(p);
            }
          });
          const scopeProducts = catalogScope === "client" || catalogScope === "client_source"
            ? migrateDomainManagementProducts(migrateHomeDesignProducts(merged))
            : merged;
          const themedProducts = retintProductTreeForTheme(
            scopeProducts,
            resolvedTheme
          ) as ProductItem[];
          const mergedProductPaths = themedProducts.map((product) => product.path);
          return {
            catalogScope,
            products: themedProducts,
            customDefaultPaths: config.customDefaultPaths ? [...config.customDefaultPaths] : getProductMarketCatalogDefaultPaths(catalogScope),
            layoutStyle: retiredTheme
              ? normalizeLayoutStyle(resolvedTheme.layout, "rose")
              : normalizeLayoutStyle(config.layoutStyle, resolvedActiveTheme),
            visualCardLayout: config.visualCardLayout
              ? cloneVisualCardLayout(normalizeVisualCardLayout(config.visualCardLayout))
              : undefined,
          layoutSections: mergeLayoutSections(config.layoutSections),
          customerServiceSections: mergeCustomerServiceSections(config.customerServiceSections),
          moduleActionOrder: config.moduleActionOrder?.length ? [...config.moduleActionOrder] : ["module-table-toggle", "module-toggle", "restore", "save"],
          layoutActionOrder: config.layoutActionOrder?.length ? [...config.layoutActionOrder] : ["theme-toggle", "theme-status", "restore", "save"],
          customerServiceActionOrder: config.customerServiceActionOrder?.length ? [...config.customerServiceActionOrder] : ["collapse", "restore", "save"],
            activeTheme: resolvedActiveTheme,
            productOrder: themedProducts.map((p) => p.path),
            moduleOrderBaselineVersion: PRODUCT_MODULE_BASELINE_VERSION,
            moduleCategoryOrder: shouldApplyProductModuleBaseline
              ? applyProductModuleCategoryBaselineOrder(config.moduleCategoryOrder)
              : normalizeModuleCategoryOrder(config.moduleCategoryOrder),
            moduleCategoryAssignments: normalizeModuleCategoryAssignments(
              config.moduleCategoryAssignments,
              mergedProductPaths
            ),
            moduleCategoryStyles: normalizeModuleCategoryStyles(config.moduleCategoryStyles),
            moduleIconVisibility: normalizeModuleIconVisibility(config.moduleIconVisibility),
            customThemes: config.customThemes ? config.customThemes.filter((theme) => !isRetiredThemeKey(theme.key)).map((theme) => ({
              ...theme,
              layout: normalizeLayoutStyle(theme.layout, theme.key),
              sidebar: { ...theme.sidebar },
              cardActive: { ...theme.cardActive },
              cardInactive: { ...theme.cardInactive },
              cardHidden: { ...theme.cardHidden },
            })) : [],
            builtinThemeOverrides: config.builtinThemeOverrides
              ? Object.fromEntries(
                  Object.entries(config.builtinThemeOverrides).filter(([key]) => !isRetiredThemeKey(key)).map(([key, theme]) => [
                    key,
                    normalizeBuiltinThemeOverride(key, {
                      ...theme,
                      layout: normalizeLayoutStyle(theme.layout, key),
                      sidebar: { ...theme.sidebar },
                      cardActive: { ...theme.cardActive },
                      cardInactive: { ...theme.cardInactive },
                      cardHidden: { ...theme.cardHidden },
                    }),
                  ])
                )
              : {},
            sidebarStyle: retiredTheme
              ? normalizeSidebarStyle(resolvedTheme.sidebar, "rose")
              : normalizeSidebarStyle(config.sidebarStyle, resolvedActiveTheme),
            globalFontFamily: normalizeGlobalFontFamily(config.globalFontFamily),
            globalFontWeight: config.globalFontWeight || config.layoutStyle?.globalFontWeight || DEFAULT_DESIGN_FONT_WEIGHT,
            globalLetterSpacing: normalizeGlobalLetterSpacing(config.globalLetterSpacing || config.layoutStyle?.globalLetterSpacing),
            customProducts: cleanFactoryPlatformCustomProducts(config.customProducts, catalogScope),
            soundEnabled: config.soundEnabled ?? true,
            soundVolume: config.soundVolume ?? 0.5,
            soundStyle: config.soundStyle || "crisp",
            csAvatarId: config.csAvatarId || "pro-female",
            csEnabled: config.csEnabled ?? true,
            csAvatarOverrides: cleanAvatarOverrides(config.csAvatarOverrides),
            customerServiceCustomized: config.customerServiceCustomized ?? false,
            layoutCustomized: config.layoutCustomized ?? false,
            layoutStructureCustomized: config.layoutStructureCustomized ?? false,
            csVoiceEnabled: config.csVoiceEnabled ?? false,
            csVoiceGender: config.csVoiceGender === "male" ? "male" : "female",
            csVoiceRate:
              typeof config.csVoiceRate === "number" && Number.isFinite(config.csVoiceRate)
                ? normalizeCustomerServiceVoiceRate(config.csVoiceRate)
                : DEFAULT_CUSTOMER_SERVICE_VOICE_RATE,
          };
        });
      },
      addCustomTheme: (theme) =>
        set((state) => ({
          customThemes: [...state.customThemes, theme],
        })),
      updateCustomTheme: (key, updates) =>
        set((state) => ({
          customThemes: state.customThemes.map((t) =>
            t.key === key ? { ...t, ...updates } : t
          ),
        })),
      deleteCustomTheme: (key) =>
        set((state) => ({
          customThemes: state.customThemes.filter((t) => t.key !== key),
          activeTheme: state.activeTheme === key ? "rose" : state.activeTheme,
        })),
      updateBuiltinTheme: (key, updates) =>
        set((state) => {
          const factory = FACTORY_BUILTIN_THEMES.find((t) => t.key === key);
          if (!factory) return state;
          const existing = state.builtinThemeOverrides[key];
          const base: CustomThemeData = existing || {
            key: factory.key,
            name: factory.name,
            description: factory.description,
            fontFamily: factory.fontFamily,
            layout: { ...factory.layout },
            sidebar: { ...factory.sidebar },
            cardActive: { ...factory.cardActive },
            cardInactive: { ...factory.cardInactive },
            cardHidden: { ...factory.cardHidden },
          };
          const merged = { ...base, ...updates };
          return {
            builtinThemeOverrides: {
              ...state.builtinThemeOverrides,
              [key]: normalizeBuiltinThemeOverride(key, merged),
            },
          };
        }),
      getAllThemes: () => {
        const state = get();
        if (
          allThemesCache?.builtinThemeOverrides === state.builtinThemeOverrides
          && allThemesCache.customThemes === state.customThemes
        ) {
          return allThemesCache.themes;
        }
        // Merge factory builtins with overrides
        const builtins: ThemePreset[] = FACTORY_BUILTIN_THEMES.map((factory) => {
          const override = state.builtinThemeOverrides[factory.key];
          if (!override) return { ...factory };
          const normalizedOverride = normalizeBuiltinThemeOverride(factory.key, override);
          return {
            key: factory.key,
            name: normalizedOverride.name || factory.name,
            description: normalizedOverride.description || factory.description,
            fontFamily: normalizedOverride.fontFamily || factory.fontFamily,
            layout: normalizeLayoutStyle(normalizedOverride.layout || factory.layout, factory.key),
            sidebar: normalizeSidebarStyle(normalizedOverride.sidebar || factory.sidebar, factory.key),
            cardActive: normalizedOverride.cardActive || factory.cardActive,
            cardInactive: normalizedOverride.cardInactive || factory.cardInactive,
            cardHidden: normalizedOverride.cardHidden || factory.cardHidden,
          };
        });
        const customAsPresets: ThemePreset[] = state.customThemes.map((ct) => ({
          key: ct.key,
          name: ct.name,
          description: ct.description,
          layout: normalizeLayoutStyle(ct.layout, ct.key),
          sidebar: normalizeSidebarStyle(ct.sidebar, ct.key),
          fontFamily: ct.fontFamily,
          cardActive: ct.cardActive,
          cardInactive: ct.cardInactive,
          cardHidden: ct.cardHidden,
        }));
        const themes = [...builtins, ...customAsPresets];
        allThemesCache = {
          builtinThemeOverrides: state.builtinThemeOverrides,
          customThemes: state.customThemes,
          themes,
        };
        return themes;
      },
      setSidebarStyle: (style) =>
        set((state) => ({
          sidebarStyle: {
            ...state.sidebarStyle,
            ...style,
            fontFamily: normalizeGlobalFontFamily(style.fontFamily || state.sidebarStyle.fontFamily),
          },
        })),
      setGlobalFontFamily: (font) => set({ globalFontFamily: normalizeGlobalFontFamily(font) }),
      setGlobalFontWeight: (weight) => set({ globalFontWeight: weight }),
      setGlobalLetterSpacing: (spacing) => set({ globalLetterSpacing: spacing }),
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      setSoundVolume: (volume) => set({ soundVolume: Math.max(0, Math.min(1, volume)) }),
      setSoundStyle: (style) => set({ soundStyle: style }),
      customProducts: [] as CustomProductItem[],
      csAvatarId: "pro-female",
      csEnabled: true,
      csAvatarOverrides: {},
      customerServiceCustomized: false,
      layoutCustomized: false,
      layoutStructureCustomized: false,
      csVoiceEnabled: false,
      csVoiceGender: "female",
      csVoiceRate: DEFAULT_CUSTOMER_SERVICE_VOICE_RATE,
      setCsAvatarId: (id) => set({ csAvatarId: id }),
      setCsEnabled: (enabled) => set({ csEnabled: enabled }),
      setCustomerServiceCustomized: (customized) => set({ customerServiceCustomized: customized }),
      setLayoutCustomized: (customized) => set({ layoutCustomized: customized }),
      setLayoutStructureCustomized: (customized) => set({ layoutStructureCustomized: customized }),
      setCsVoiceEnabled: (enabled) => set({ csVoiceEnabled: enabled }),
      setCsVoiceGender: (gender) => set({ csVoiceGender: gender }),
      setCsVoiceRate: (rate) => set({ csVoiceRate: normalizeCustomerServiceVoiceRate(rate) }),
      setCsAvatarOverride: (id, override) =>
        set((state) => {
          // Normalize the stored value before stamping the new contract. This
          // also covers a live HMR session whose persisted override has not
          // rehydrated yet; the user's explicit change is then applied last.
          const previousCleaned = cleanAvatarOverride(state.csAvatarOverrides[id]);
          const previousNormalized = previousCleaned
            ? normalizeVoiceOverrideForPresetAvatar(id, previousCleaned)
            : undefined;
          const cleaned = cleanAvatarOverride({
            ...previousNormalized,
            ...override,
            ...(isCustomerServiceExpertVoiceAvatarId(id)
              ? {
                  voiceContractVersion: CUSTOMER_SERVICE_VOICE_CONTRACT_VERSION,
                  voiceRateContractVersion: CUSTOMER_SERVICE_EXPERT_VOICE_RATE_CONTRACT_VERSION,
                  reminderContractVersion: CUSTOMER_SERVICE_REMINDER_CONTRACT_VERSION,
                  expertSequenceContractVersion: CUSTOMER_SERVICE_EXPERT_SEQUENCE_CONTRACT_VERSION,
                }
              : {}),
          });
          const next = cleaned ? normalizeVoiceOverrideForPresetAvatar(id, cleaned) : undefined;
          const rest = { ...state.csAvatarOverrides };
          if (next) {
            rest[id] = next;
          } else {
            delete rest[id];
          }
          return { csAvatarOverrides: rest };
        }),
      clearCsAvatarOverrideImage: (id) =>
        set((state) => {
          const currentOverride = state.csAvatarOverrides[id];
          if (!currentOverride) return state;
          const cleaned = cleanAvatarOverride({
            ...currentOverride,
            mediaAssetId: undefined,
            mediaKind: undefined,
            mediaMimeType: undefined,
            imageDataUrl: undefined,
          });
          const next = cleaned ? normalizeVoiceOverrideForPresetAvatar(id, cleaned) : undefined;
          const rest = { ...state.csAvatarOverrides };
          if (next) {
            rest[id] = next;
          } else {
            delete rest[id];
          }
          return { csAvatarOverrides: rest };
        }),
      addProduct: (product) =>
        set((state) => {
          // Check if path already exists
          if (state.products.find((p) => p.path === product.path)) return state;
          const icon = product.iconName
            ? (ICON_OPTIONS.find((o) => o.name === product.iconName)?.icon || Package)
            : Package;
          const newProduct: ProductItem = {
            label: sanitizeDisplayText(product.label, "未命名功能"),
            path: product.path,
            status: "active",
            icon,
            children: product.children?.map((child) => ({
              label: sanitizeDisplayText(child.label, "未命名栏目"),
              path: child.path,
              status: "active" as ProductStatus,
              customLabel: child.label,
              description: `二级栏目：${sanitizeDisplayText(child.label, "未命名栏目")}，可在栏目配置、左侧导航、右侧栏调用。`,
            })),
          };
          const newProducts = [...state.products, newProduct];
          const newCustomProducts = [...state.customProducts, cleanCustomProduct(product)];
          return {
            products: newProducts,
            productOrder: [...state.productOrder, product.path],
            customDefaultPaths: [...state.customDefaultPaths, product.path],
            customProducts: newCustomProducts,
          };
        }),
      removeProduct: (path) =>
        set((state) => {
          // Only allow removing custom products
          if (!state.customProducts.find((p) => p.path === path)) return state;
          return {
            products: state.products.filter((p) => p.path !== path),
            productOrder: state.productOrder.filter((p) => p !== path),
            customDefaultPaths: state.customDefaultPaths.filter((p) => p !== path),
            customProducts: state.customProducts.filter((p) => p.path !== path),
          };
        }),
      setChildStatus: (parentPath, childPath, status) =>
        set((state) => {
          const activeThemePreset =
            state.getAllThemes().find((theme) => theme.key === state.activeTheme) ||
            FACTORY_BUILTIN_THEMES[0];
          return {
            products: state.products.map((p) => {
              if (p.path !== parentPath || !p.children) return p;
              return {
                ...p,
                children: p.children.map((c) =>
                  c.path === childPath
                    ? {
                        ...c,
                        status,
                        customStyle: buildStatusDrivenProductStyle(
                          c.customStyle,
                          resolveThemeCardColors(activeThemePreset, status)
                        ),
                      }
                    : c
                ),
              };
            }),
          };
        }),
      setChildItems: (parentPath, children) =>
        set((state) => ({
          products: state.products.map((p) =>
            p.path === parentPath
              ? { ...p, children: cleanSavedChildren(children) }
              : p
          ),
        })),
    }),
    {
      name: "product-market-storage",
      storage: createJSONStorage(() => scopedPersistStorage),
      partialize: (state) => ({
        products: state.products.map(({ label, path, status, customLabel, description, customStyle, children }) => ({
          label, path, status, customLabel, description, customStyle, children,
        })),
        customDefaultPaths: state.customDefaultPaths,
        layoutStyle: state.layoutStyle,
        visualCardLayout: state.visualCardLayout
          ? cloneVisualCardLayout(state.visualCardLayout)
          : undefined,
        layoutSections: state.layoutSections.map((section) => ({ ...section })),
        customerServiceSections: state.customerServiceSections.map((section) => ({ ...section })),
          moduleActionOrder: [...state.moduleActionOrder],
          layoutActionOrder: [...state.layoutActionOrder],
          customerServiceActionOrder: [...state.customerServiceActionOrder],
          activeTheme: state.activeTheme,
          productOrder: state.productOrder,
          moduleOrderBaselineVersion: state.moduleOrderBaselineVersion,
          moduleCategoryOrder: [...state.moduleCategoryOrder],
          moduleCategoryAssignments: { ...state.moduleCategoryAssignments },
          moduleCategoryStyles: normalizeModuleCategoryStyles(state.moduleCategoryStyles),
          moduleIconVisibility: normalizeModuleIconVisibility(state.moduleIconVisibility),
          customThemes: state.customThemes,
          builtinThemeOverrides: state.builtinThemeOverrides,
        sidebarStyle: state.sidebarStyle,
        globalFontFamily: state.globalFontFamily,
        globalFontWeight: state.globalFontWeight,
        globalLetterSpacing: state.globalLetterSpacing,
        soundEnabled: state.soundEnabled,
        soundVolume: state.soundVolume,
        soundStyle: state.soundStyle,
        customProducts: state.customProducts,
        csAvatarId: state.csAvatarId,
        csEnabled: state.csEnabled,
        csAvatarOverrides: state.csAvatarOverrides,
        customerServiceCustomized: state.customerServiceCustomized,
        layoutCustomized: state.layoutCustomized,
        layoutStructureCustomized: state.layoutStructureCustomized,
        csVoiceEnabled: state.csVoiceEnabled,
        csVoiceGender: state.csVoiceGender,
        csVoiceRate: state.csVoiceRate,
      }),
      merge: (persisted, current) => {
        const saved = persisted as {
          products?: { label: string; path: string; status: ProductStatus; customLabel?: string; description?: string; customStyle?: ProductCustomStyle; children?: ProductChildItem[] }[];
          customDefaultPaths?: string[];
          layoutStyle?: LayoutCustomStyle;
          visualCardLayout?: VisualCardLayoutConfig;
          layoutSections?: LayoutSectionConfig[];
          customerServiceSections?: CustomerServiceSectionConfig[];
          moduleActionOrder?: string[];
          layoutActionOrder?: string[];
          customerServiceActionOrder?: string[];
          activeTheme?: ThemePresetKey | string;
          productOrder?: string[];
          moduleOrderBaselineVersion?: number;
          moduleCategoryOrder?: string[];
          moduleCategoryAssignments?: Record<string, ProductModuleCategoryKey>;
          moduleCategoryStyles?: Record<string, ProductModuleCategoryStyle>;
          moduleIconVisibility?: ProductModuleIconVisibility;
          customThemes?: CustomThemeData[];
          builtinThemeOverrides?: Record<string, CustomThemeData>;
          sidebarStyle?: SidebarStyle;
          globalFontFamily?: string;
          globalFontWeight?: string;
          globalLetterSpacing?: string;
          soundEnabled?: boolean;
          soundVolume?: number;
          soundStyle?: string;
          customProducts?: CustomProductItem[];
          csAvatarId?: string;
          csEnabled?: boolean;
          csAvatarOverrides?: Record<string, CustomerServiceAvatarOverride>;
          customerServiceCustomized?: boolean;
          layoutCustomized?: boolean;
          layoutStructureCustomized?: boolean;
          csVoiceEnabled?: boolean;
          csVoiceGender?: CustomerServiceVoiceGender;
          csVoiceRate?: number;
        } | undefined;
        if (!saved?.products) return current;
        const savedOrder = dedupeProductOrderPaths(
          saved.productOrder?.length ? saved.productOrder : ALL_PRODUCTS.map((p) => p.path),
        );
        // Only migrate legacy configurations that predate the category baseline.
        // Once applied, later user drag-and-drop order is left untouched.
        const shouldApplyProductModuleBaseline =
          (saved.moduleOrderBaselineVersion ?? 0) < PRODUCT_MODULE_BASELINE_VERSION;
        const previousBaselineVersion = saved.moduleOrderBaselineVersion ?? 0;
        const savedProductByPath = new Map(saved.products!.map((product) => {
          const path = migrateFactoryContentCmsPath(product.path, previousBaselineVersion);
          return [path, path === product.path ? product : { ...product, path }];
        }));
        const order = shouldApplyProductModuleBaseline
          ? applyProductModuleBaselinePaths(savedOrder.map((path) => migrateFactoryContentCmsPath(path, previousBaselineVersion)), saved.moduleCategoryAssignments)
          : savedOrder.filter((path) => !RETIRED_LEGACY_PRIMARY_PATHS.has(path));
        const merged = order
          .map((path) => {
            const base = ALL_PRODUCTS.find((p) => p.path === path);
            const savedItem = savedProductByPath.get(path);
            if (!base && savedItem) {
              // Custom product not in ALL_PRODUCTS
              const icon = ICON_OPTIONS.find((o) => o.name === (savedItem.customStyle?.iconName || ""))?.icon || Package;
              return {
                ...savedItem,
                label: sanitizeDisplayText(savedItem.label, "未命名功能"),
                customLabel: cleanOptionalText(savedItem.customLabel),
                description: cleanOptionalText(savedItem.description),
                icon,
                children: cleanSavedChildren(savedItem.children),
              } as ProductItem;
            }
            if (!base) return null;
            if (savedItem) {
              const children = mergeChildren(base.children, savedItem.children, base.path === "/social");
              return {
                ...base,
                status: shouldApplyProductModuleBaseline && shouldActivateFactoryPlatformPathForBaseline(base.path, saved.moduleOrderBaselineVersion ?? 0)
                  ? "active"
                  : normalizeDeliverySafeProductStatus(savedItem.status, base.deliveryStatus, base.status),
                customLabel: cleanSavedDefaultCustomLabel(savedItem.customLabel, savedItem.label),
                description: cleanOptionalText(savedItem.description) || cleanOptionalText(base.description),
                customStyle: savedItem.customStyle,
                children,
              };
            }
            return base;
          })
          .filter(Boolean) as ProductItem[];
        ALL_PRODUCTS.forEach((p) => {
          if (!merged.find((m) => m.path === p.path)) merged.push(p);
        });
        const retiredTheme = isRetiredThemeKey(saved.activeTheme);
        const normalizedActiveTheme = resolveStoredThemeKey(saved, current.activeTheme);
        const normalizedCustomThemes = saved.customThemes ? saved.customThemes.filter((theme) => !isRetiredThemeKey(theme.key)).map((theme) => ({
          ...theme,
          layout: normalizeLayoutStyle(theme.layout, theme.key),
          sidebar: { ...theme.sidebar },
          cardActive: { ...theme.cardActive },
          cardInactive: { ...theme.cardInactive },
          cardHidden: { ...theme.cardHidden },
        })) : current.customThemes;
        const normalizedBuiltinThemeOverrides = saved.builtinThemeOverrides
          ? Object.fromEntries(
              Object.entries(saved.builtinThemeOverrides).filter(([key]) => !isRetiredThemeKey(key)).map(([key, theme]) => [
                key,
                normalizeBuiltinThemeOverride(key, theme),
              ])
            )
          : current.builtinThemeOverrides;
          const themedProducts = retintProductTreeForTheme(
            migrateHealthCockpitProducts(
              migrateDomainManagementProducts(
                migrateHomeDesignProducts(merged)
              )
            ),
            resolveConfigTheme({
              activeTheme: normalizedActiveTheme,
              customThemes: normalizedCustomThemes,
              builtinThemeOverrides: normalizedBuiltinThemeOverrides,
            })
          ) as ProductItem[];
        return {
          ...current,
          products: themedProducts,
          customDefaultPaths: saved.customDefaultPaths || current.customDefaultPaths,
          layoutStyle: retiredTheme
            ? normalizeLayoutStyle(getFactoryThemeByKey("rose").layout, "rose")
            : normalizeLayoutStyle(saved.layoutStyle || current.layoutStyle, normalizedActiveTheme),
          visualCardLayout: saved.visualCardLayout
            ? cloneVisualCardLayout(normalizeVisualCardLayout(saved.visualCardLayout))
            : current.visualCardLayout
              ? cloneVisualCardLayout(current.visualCardLayout)
              : undefined,
          layoutSections: mergeLayoutSections(saved.layoutSections || current.layoutSections),
          customerServiceSections: mergeCustomerServiceSections(saved.customerServiceSections || current.customerServiceSections),
          moduleActionOrder: saved.moduleActionOrder?.length ? [...saved.moduleActionOrder] : current.moduleActionOrder,
          layoutActionOrder: saved.layoutActionOrder?.length ? [...saved.layoutActionOrder] : current.layoutActionOrder,
          customerServiceActionOrder: saved.customerServiceActionOrder?.length ? [...saved.customerServiceActionOrder] : current.customerServiceActionOrder,
          activeTheme: normalizedActiveTheme,
            productOrder: themedProducts.map((p) => p.path),
            moduleOrderBaselineVersion: shouldApplyProductModuleBaseline
              ? PRODUCT_MODULE_BASELINE_VERSION
              : (saved.moduleOrderBaselineVersion ?? 0),
            moduleCategoryOrder: shouldApplyProductModuleBaseline
              ? applyProductModuleCategoryBaselineOrder(saved.moduleCategoryOrder)
              : normalizeModuleCategoryOrder(saved.moduleCategoryOrder),
            moduleCategoryAssignments: normalizeModuleCategoryAssignments(
              saved.moduleCategoryAssignments as Record<string, string> | undefined,
              themedProducts.map((product) => product.path)
            ),
            moduleCategoryStyles: normalizeModuleCategoryStyles(saved.moduleCategoryStyles),
            moduleIconVisibility: normalizeModuleIconVisibility(saved.moduleIconVisibility),
            customThemes: normalizedCustomThemes,
          builtinThemeOverrides: normalizedBuiltinThemeOverrides,
          sidebarStyle: retiredTheme
            ? normalizeSidebarStyle(getFactoryThemeByKey("rose").sidebar, "rose")
            : normalizeSidebarStyle(saved.sidebarStyle || current.sidebarStyle, normalizedActiveTheme),
          globalFontFamily: normalizeGlobalFontFamily(saved.globalFontFamily || current.globalFontFamily),
          globalFontWeight: saved.globalFontWeight || current.globalFontWeight,
          globalLetterSpacing: normalizeGlobalLetterSpacing(saved.globalLetterSpacing || current.globalLetterSpacing),
          soundEnabled: saved.soundEnabled ?? current.soundEnabled,
          soundVolume: saved.soundVolume ?? current.soundVolume,
          soundStyle: saved.soundStyle || current.soundStyle,
          customProducts: cleanFactoryPlatformCustomProducts(
            saved.customProducts || current.customProducts,
            normalizeProductMarketCatalogScope(saved.catalogScope || current.catalogScope),
          ),
          csAvatarId: saved.csAvatarId || current.csAvatarId,
          csEnabled: saved.csEnabled ?? current.csEnabled,
          csAvatarOverrides: cleanAvatarOverrides(saved.csAvatarOverrides) || current.csAvatarOverrides,
          customerServiceCustomized: saved.customerServiceCustomized ?? current.customerServiceCustomized,
          layoutCustomized: saved.layoutCustomized ?? current.layoutCustomized,
          layoutStructureCustomized: saved.layoutStructureCustomized ?? current.layoutStructureCustomized,
          csVoiceEnabled: saved.csVoiceEnabled ?? current.csVoiceEnabled,
          csVoiceGender: saved.csVoiceGender === "male" ? "male" : current.csVoiceGender,
          csVoiceRate:
            typeof saved.csVoiceRate === "number" && Number.isFinite(saved.csVoiceRate)
              ? normalizeCustomerServiceVoiceRate(saved.csVoiceRate)
              : current.csVoiceRate,
        };
      },
    }
  )
);
