import { SOCIAL_CHANNELS, SOCIAL_CHANNEL_NAMES, normalizeSocialChannelNames, type SocialChannelName } from "@/lib/social-channel-contract";
import type { SocialPageAssetRecord } from "@/lib/social-page-assets-api";
import { readSocialSourcePackage, socialSourceScopeFromPath } from "@/lib/social-source-package";
import type { SocialOfficialMetricSnapshot, SocialPageBinding } from "@/lib/social-real-page-workbench";

export function parseDateTime(value: string) {
  const parsed = Date.parse(value.replace(" ", "T"));
  return Number.isFinite(parsed) ? parsed : 0;
}

export const PLATFORMS = SOCIAL_CHANNELS.map(({ name, color, short, market }) => ({ name, color, short, market }));

export type SocialMarket = "overseas" | "china";
export type SocialLocalMetric = { drafts: number; schedules: number; videos: number; leads: number };
export type SocialPlanSettings = {
  marketScope: "dual" | "overseas" | "china";
  primaryLanguage: "zh-CN" | "en" | "bilingual";
  approvalMode: "manual" | "agency_hq";
  timezone: "asia-shanghai" | "america-la" | "europe-london";
  sensitiveWordFilter: boolean;
  emailNotice: boolean;
  crmAutoHandoffEnabled: boolean;
  allowedPlatforms: SocialChannelName[];
  contactConsentRequired: boolean;
  dataRetentionDays: "30" | "90" | "180" | "365";
};

export const DEFAULT_SOCIAL_PLAN_SETTINGS: SocialPlanSettings = {
  marketScope: "dual",
  primaryLanguage: "bilingual",
  approvalMode: "agency_hq",
  timezone: "asia-shanghai",
  sensitiveWordFilter: true,
  emailNotice: false,
  crmAutoHandoffEnabled: false,
  allowedPlatforms: [...SOCIAL_CHANNEL_NAMES],
  contactConsentRequired: true,
  dataRetentionDays: "180",
};

export function socialAccountConnectionStorageKey(siteId?: string | null) {
  return `tradepro.social.account-connections.${siteId || "default"}`;
}

export function socialPlanSettingsStorageKey(siteId?: string | null) {
  return `tradepro.social.plan-settings.${siteId || "default"}`;
}

export function readSocialPlanSettings(siteId?: string | null): SocialPlanSettings {
  try {
    const raw = window.localStorage.getItem(socialPlanSettingsStorageKey(siteId));
    const parsed = raw ? JSON.parse(raw) : null;
    return normalizeSocialPlanSettings(parsed);
  } catch {
    return DEFAULT_SOCIAL_PLAN_SETTINGS;
  }
}

export function normalizeSocialPlanSettings(value: unknown): SocialPlanSettings {
  const item = value && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<SocialPlanSettings>
    : {};
  return {
    ...DEFAULT_SOCIAL_PLAN_SETTINGS,
    ...item,
    allowedPlatforms: normalizeSocialChannelNames(item.allowedPlatforms, SOCIAL_CHANNEL_NAMES),
  };
}

export function socialMarketsForScope(scope: SocialPlanSettings["marketScope"]): SocialMarket[] {
  if (scope === "overseas") return ["overseas"];
  if (scope === "china") return ["china"];
  return ["overseas", "china"];
}

export function getAvailableSocialPlatforms(settings: SocialPlanSettings) {
  const sourceScope = typeof window === "undefined" ? null : socialSourceScopeFromPath(window.location.pathname);
  const sourceAllowed = sourceScope ? readSocialSourcePackage(sourceScope).allowedPlatforms : SOCIAL_CHANNEL_NAMES;
  const allowed = new Set(settings.allowedPlatforms.filter((name) => sourceAllowed.includes(name)));
  const markets = socialMarketsForScope(settings.marketScope);
  return PLATFORMS.filter((platform) => markets.includes(platform.market) && allowed.has(platform.name));
}

export function pageBindingFromServer(item: SocialPageAssetRecord): SocialPageBinding {
  return {
    id: item.id,
    connectionId: item.authorization_request_id || "server-unlinked",
    platform: item.provider,
    pageName: item.display_name,
    pageUrl: item.page_url,
    assetReference: item.asset_reference,
    status: item.status === "ready_for_sync" ? "waiting_server_sync" : "pending_oauth",
    createdAt: item.created_at || new Date().toISOString(),
    updatedAt: item.updated_at || item.created_at || new Date().toISOString(),
  };
}

export function pageSnapshotFromServer(item: { id: string; page_asset_id: string; captured_at: string; source: "official_api" | "verified_manual"; followers?: number | null; impressions?: number | null; engagements?: number | null; views?: number | null; clicks?: number | null }): SocialOfficialMetricSnapshot {
  return {
    id: item.id,
    pageBindingId: item.page_asset_id,
    capturedAt: item.captured_at,
    source: item.source,
    ...(typeof item.followers === "number" ? { followers: item.followers } : {}),
    ...(typeof item.impressions === "number" ? { impressions: item.impressions } : {}),
    ...(typeof item.engagements === "number" ? { engagements: item.engagements } : {}),
    ...(typeof item.views === "number" ? { views: item.views } : {}),
    ...(typeof item.clicks === "number" ? { clicks: item.clicks } : {}),
  };
}

export function socialContentDraftStorageKey(siteId?: string | null) {
  return `tradepro.social.content-drafts.${siteId || "default"}`;
}

export function socialContentTemplateStorageKey(siteId?: string | null) {
  return `tradepro.social.content-templates.${siteId || "default"}`;
}

export function socialAssetRightsStorageKey(siteId?: string | null) {
  return `tradepro.social.asset-rights.${siteId || "default"}`;
}

export function socialScheduleIntentStorageKey(siteId?: string | null) {
  return `tradepro.social.schedule-intent.${siteId || "default"}`;
}

export function socialPublishTaskStorageKey(siteId?: string | null) {
  return `tradepro.social.publish-tasks.${siteId || "default"}`;
}

export function socialLeadTaskStorageKey(siteId?: string | null) {
  return `tradepro.social.lead-tasks.${siteId || "default"}`;
}

export function socialVideoTaskStorageKey(siteId?: string | null) {
  return `tradepro.social.video-tasks.${siteId || "default"}`;
}

export function socialCampaignLinkStorageKey(siteId?: string | null) {
  return `tradepro.social.campaign-links.${siteId || "default"}`;
}

export function readSocialLocalArray(storageKey: string) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function formatOfficialMetric(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("zh-CN") : "—";
}

export function officialSnapshotStatus(snapshot: SocialOfficialMetricSnapshot | null) {
  if (!snapshot) return "等待总部服务端官方接口同步";
  return snapshot.source === "official_api" ? `官方接口数据截至 ${new Date(snapshot.capturedAt).toLocaleString("zh-CN")}` : `人工核验数据截至 ${new Date(snapshot.capturedAt).toLocaleString("zh-CN")}`;
}
