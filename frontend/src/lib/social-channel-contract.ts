export const SOCIAL_CHANNEL_CONTRACT_ID = "social-channel-contract-v1";

export type SocialChannelMarket = "china" | "overseas";
export type SocialChannelConnectorStatus = "readiness" | "planned";

export type SocialChannelDefinition = {
  id: string;
  name: string;
  aliases: readonly string[];
  short: string;
  color: string;
  market: SocialChannelMarket;
  method: string;
  capability: string;
  connectorStatus: SocialChannelConnectorStatus;
};

/**
 * 国内与海外社交渠道的唯一名称、市场和连接边界。
 * readiness 只代表已有连接准备检查，不代表已经完成 OAuth、外部发布或实时同步。
 */
export const SOCIAL_CHANNELS = [
  { id: "facebook", name: "Facebook", aliases: [], short: "FB", color: "bg-blue-600", market: "overseas", method: "OAuth 2.0 + Graph API", capability: "主页、内容、互动与数据（按获批权限）", connectorStatus: "readiness" },
  { id: "instagram", name: "Instagram", aliases: [], short: "IG", color: "bg-gradient-to-br from-pink-500 to-orange-500", market: "overseas", method: "OAuth 2.0 + Graph API", capability: "企业账号内容、互动与洞察（按获批权限）", connectorStatus: "readiness" },
  { id: "x-twitter", name: "X / Twitter", aliases: ["Twitter / X", "Twitter", "X"], short: "X", color: "bg-slate-900", market: "overseas", method: "OAuth 2.0 + API 方案", capability: "发帖、互动与数据（按套餐和审核权限）", connectorStatus: "planned" },
  { id: "linkedin", name: "LinkedIn", aliases: [], short: "IN", color: "bg-sky-700", market: "overseas", method: "OAuth 2.0 + 平台审核", capability: "企业页发布与数据（权限受审核限制）", connectorStatus: "planned" },
  { id: "tiktok", name: "TikTok", aliases: [], short: "TT", color: "bg-black", market: "overseas", method: "OAuth 2.0 + 审核接口", capability: "内容发布与账号数据（以获批能力为准）", connectorStatus: "planned" },
  { id: "youtube", name: "YouTube", aliases: [], short: "YT", color: "bg-red-600", market: "overseas", method: "OAuth 2.0 + Data API", capability: "视频、频道与评论管理（按获批权限）", connectorStatus: "planned" },
  { id: "pinterest", name: "Pinterest", aliases: [], short: "P", color: "bg-red-500", market: "overseas", method: "OAuth 2.0 + API", capability: "企业内容与数据（按获批权限）", connectorStatus: "planned" },
  { id: "whatsapp", name: "WhatsApp", aliases: ["WhatsApp Business"], short: "WA", color: "bg-green-500", market: "overseas", method: "Business API", capability: "企业消息与客户会话；不使用 WhatsApp Web 自动化", connectorStatus: "planned" },
  { id: "wechat-official", name: "微信公众号", aliases: ["微信"], short: "微信", color: "bg-emerald-600", market: "china", method: "开放平台授权", capability: "图文、素材与客服能力（按账号资质）", connectorStatus: "planned" },
  { id: "wechat-channels", name: "微信视频号", aliases: ["视频号"], short: "视频", color: "bg-cyan-600", market: "china", method: "企业／开放平台能力", capability: "按平台开放能力接入", connectorStatus: "planned" },
  { id: "weibo", name: "微博", aliases: [], short: "微博", color: "bg-rose-600", market: "china", method: "开放平台 OAuth", capability: "内容与互动（按应用审核）", connectorStatus: "planned" },
  { id: "douyin", name: "抖音", aliases: [], short: "抖音", color: "bg-slate-800", market: "china", method: "开放平台授权", capability: "企业内容、线索与数据（按资质）", connectorStatus: "planned" },
  { id: "kuaishou", name: "快手", aliases: [], short: "快手", color: "bg-orange-600", market: "china", method: "开放平台授权", capability: "企业内容与数据（按资质）", connectorStatus: "planned" },
  { id: "xiaohongshu", name: "小红书", aliases: [], short: "红书", color: "bg-red-500", market: "china", method: "品牌／企业能力", capability: "按平台开放能力接入", connectorStatus: "planned" },
  { id: "bilibili", name: "哔哩哔哩", aliases: ["B站"], short: "B站", color: "bg-sky-500", market: "china", method: "开放平台能力", capability: "视频与账号数据（按获批范围）", connectorStatus: "planned" },
  { id: "zhihu", name: "知乎", aliases: [], short: "知乎", color: "bg-blue-700", market: "china", method: "开放平台能力", capability: "内容与品牌运营（按获批范围）", connectorStatus: "planned" },
] as const satisfies readonly SocialChannelDefinition[];

export type SocialChannelName = (typeof SOCIAL_CHANNELS)[number]["name"];

export const SOCIAL_CHANNEL_NAMES: readonly SocialChannelName[] = SOCIAL_CHANNELS.map((channel) => channel.name);

export function normalizeSocialChannelName(value: string): SocialChannelName | null {
  const normalized = value.trim().toLocaleLowerCase();
  return SOCIAL_CHANNELS.find((channel) =>
    channel.id.toLocaleLowerCase() === normalized
    || channel.name.toLocaleLowerCase() === normalized
    || channel.aliases.some((alias) => alias.toLocaleLowerCase() === normalized)
  )?.name ?? null;
}

export function normalizeSocialChannelNames(
  value: unknown,
  fallback: readonly SocialChannelName[] = [],
): SocialChannelName[] {
  const source = value === undefined ? fallback : Array.isArray(value) ? value : [];
  return [...new Set(source.flatMap((item) => {
    if (typeof item !== "string") return [];
    const normalized = normalizeSocialChannelName(item);
    return normalized ? [normalized] : [];
  }))];
}

export function getSocialChannelNames(market: SocialChannelMarket) {
  return SOCIAL_CHANNELS.filter((channel) => channel.market === market).map((channel) => channel.name);
}
