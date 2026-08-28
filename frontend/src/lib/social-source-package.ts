import {
  SOCIAL_CHANNEL_CONTRACT_ID,
  SOCIAL_CHANNEL_NAMES,
  normalizeSocialChannelNames,
  type SocialChannelName,
} from "./social-channel-contract";

/**
 * A release-owned social operations package.  It travels with an existing
 * template snapshot; it deliberately contains no client page assets, metrics,
 * credentials, content drafts, leads, or CRM records.
 */
export type SocialSourceScope = "agency_source" | "client_source";

export type SocialSourcePackage = {
  schemaVersion: 2;
  channelContractId: typeof SOCIAL_CHANNEL_CONTRACT_ID;
  scope: SocialSourceScope;
  packageName: string;
  marketScope: "dual" | "overseas" | "china";
  primaryLanguage: "bilingual" | "zh-CN" | "en";
  approvalMode: "manual" | "agency_hq";
  crmAutoHandoffDefault: boolean;
  allowedPlatforms: SocialChannelName[];
  sourceNotes: string;
  standardTemplate?: {
    id: "development-standard-v1";
    version: string;
  };
  marketingPlaybook?: {
    version: string;
    stageIds: string[];
  };
  updatedAt: string;
};

export function socialSourcePackageStorageKey(scope: SocialSourceScope) {
  return `tradepro.social-source-package.${scope}`;
}

export function createDefaultSocialSourcePackage(scope: SocialSourceScope): SocialSourcePackage {
  return {
    schemaVersion: 2,
    channelContractId: SOCIAL_CHANNEL_CONTRACT_ID,
    scope,
    packageName: scope === "agency_source" ? "代理源社交运营服务包" : "客户源社交运营应用包",
    marketScope: "dual",
    primaryLanguage: "bilingual",
    approvalMode: "agency_hq",
    crmAutoHandoffDefault: false,
    allowedPlatforms: [...SOCIAL_CHANNEL_NAMES],
    sourceNotes: scope === "agency_source"
      ? "代理源下发服务标准、审核边界和行业运营模板；代理端不得修改总部来源包。"
      : "客户源下发客户应用默认值；客户端只在独立计划内保存账号、内容、线索和数据。",
    standardTemplate: { id: "development-standard-v1", version: "1.0.0" },
    marketingPlaybook: {
      version: "1.0.0",
      stageIds: ["market-strategy", "factory-profile", "account-connect", "content-kit", "video-production", "publish-calendar", "interaction-lead", "sample-quotation", "order-attribution"],
    },
    updatedAt: new Date().toISOString(),
  };
}

function decodeSocialSourcePackage(value: unknown, scope: SocialSourceScope): SocialSourcePackage | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const schemaVersion = item.schemaVersion;
  const standardTemplate = item.standardTemplate as SocialSourcePackage["standardTemplate"] | undefined;
  const marketingPlaybook = item.marketingPlaybook as SocialSourcePackage["marketingPlaybook"] | undefined;
  const standardTemplateValid = standardTemplate === undefined || (standardTemplate.id === "development-standard-v1" && typeof standardTemplate.version === "string");
  const marketingPlaybookValid = marketingPlaybook === undefined || (typeof marketingPlaybook.version === "string" && Array.isArray(marketingPlaybook.stageIds) && marketingPlaybook.stageIds.every((stageId) => typeof stageId === "string"));
  const commonValid = item.scope === scope
    && typeof item.packageName === "string"
    && (item.marketScope === "dual" || item.marketScope === "overseas" || item.marketScope === "china")
    && (item.primaryLanguage === "bilingual" || item.primaryLanguage === "zh-CN" || item.primaryLanguage === "en")
    && (item.approvalMode === "manual" || item.approvalMode === "agency_hq")
    && typeof item.crmAutoHandoffDefault === "boolean"
    && Array.isArray(item.allowedPlatforms)
    && typeof item.sourceNotes === "string"
    && typeof item.updatedAt === "string"
    && standardTemplateValid
    && marketingPlaybookValid;
  if (!commonValid || (schemaVersion !== 1 && schemaVersion !== 2)) return null;
  if (schemaVersion === 2 && item.channelContractId !== SOCIAL_CHANNEL_CONTRACT_ID) return null;
  return {
    schemaVersion: 2,
    channelContractId: SOCIAL_CHANNEL_CONTRACT_ID,
    scope,
    packageName: item.packageName as string,
    marketScope: item.marketScope as SocialSourcePackage["marketScope"],
    primaryLanguage: item.primaryLanguage as SocialSourcePackage["primaryLanguage"],
    approvalMode: item.approvalMode as SocialSourcePackage["approvalMode"],
    crmAutoHandoffDefault: item.crmAutoHandoffDefault as boolean,
    allowedPlatforms: normalizeSocialChannelNames(item.allowedPlatforms),
    sourceNotes: item.sourceNotes as string,
    standardTemplate,
    marketingPlaybook: marketingPlaybook ? { ...marketingPlaybook, stageIds: [...marketingPlaybook.stageIds] } : undefined,
    updatedAt: item.updatedAt as string,
  };
}

function serializeSocialSourcePackage(sourcePackage: SocialSourcePackage, updatedAt = sourcePackage.updatedAt): SocialSourcePackage {
  return {
    ...sourcePackage,
    schemaVersion: 2,
    channelContractId: SOCIAL_CHANNEL_CONTRACT_ID,
    allowedPlatforms: normalizeSocialChannelNames(sourcePackage.allowedPlatforms),
    marketingPlaybook: sourcePackage.marketingPlaybook
      ? { ...sourcePackage.marketingPlaybook, stageIds: [...new Set(sourcePackage.marketingPlaybook.stageIds.filter(Boolean))] }
      : undefined,
    updatedAt,
  };
}

export function readSocialSourcePackage(scope: SocialSourceScope): SocialSourcePackage {
  try {
    const raw = window.localStorage.getItem(socialSourcePackageStorageKey(scope));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    const decoded = decodeSocialSourcePackage(parsed, scope);
    if (decoded) {
      const defaults = createDefaultSocialSourcePackage(scope);
      return {
        ...decoded,
        standardTemplate: decoded.standardTemplate || defaults.standardTemplate,
        marketingPlaybook: decoded.marketingPlaybook || defaults.marketingPlaybook,
      };
    }
  } catch {
    // Fall through to secure, review-first defaults.
  }
  return createDefaultSocialSourcePackage(scope);
}

export function saveSocialSourcePackage(sourcePackage: SocialSourcePackage) {
  const safe = serializeSocialSourcePackage(sourcePackage, new Date().toISOString());
  window.localStorage.setItem(socialSourcePackageStorageKey(sourcePackage.scope), JSON.stringify(safe));
  return safe;
}

/** Returns the source package embedded in a template snapshot, if valid. */
export function readSocialSourcePackageFromSnapshot(value: unknown): SocialSourcePackage | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { scope?: unknown };
  return candidate.scope === "agency_source" || candidate.scope === "client_source"
    ? decodeSocialSourcePackage(value, candidate.scope)
    : null;
}

export function attachSocialSourcePackage<T extends object>(config: T, sourcePackage: SocialSourcePackage): T & { socialOperations: SocialSourcePackage } {
  return { ...config, socialOperations: serializeSocialSourcePackage(sourcePackage) };
}

export function socialSourceScopeFromPath(pathname: string): SocialSourceScope | null {
  if (pathname.includes("/agency-source/")) return "agency_source";
  if (pathname.includes("/client-source/")) return "client_source";
  return null;
}

export const SOCIAL_SOURCE_PACKAGE_PLATFORMS = SOCIAL_CHANNEL_NAMES;
