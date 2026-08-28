import type { PublishedSite } from "./sites";
import { sanitizeDisplayText } from "./text-sanitizer";
import { defaultWebsiteContentState, getWebsiteContentState, type WebsiteContentState } from "./website-content-store";

type SiteDisplayNameInput = Pick<PublishedSite, "id" | "name" | "planCode" | "planName" | "scope" | "builderState">;

function readTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isTemplateDefaultCompanyName(value: string) {
  const normalized = value.trim();
  if (!normalized) return false;
  return [
    defaultWebsiteContentState.profile.companyName,
    defaultWebsiteContentState.profile.companyEnglishName,
    defaultWebsiteContentState.profile.brandName,
  ]
    .map((item) => item.trim())
    .includes(normalized);
}

export function resolveCompanyChineseNameFromState(
  contentState: WebsiteContentState | null | undefined,
  builderStateLike?: Record<string, unknown> | null,
  fallback = ""
) {
  const profileCompanyName = readTrimmedString(contentState?.profile?.companyName);
  const builderProfile =
    builderStateLike?.profile && typeof builderStateLike.profile === "object"
      ? (builderStateLike.profile as Record<string, unknown>)
      : null;
  const builderProfileCompanyName = readTrimmedString(builderProfile?.companyName);
  const directCompanyName = readTrimmedString(builderStateLike?.companyName);

  return sanitizeDisplayText(profileCompanyName || builderProfileCompanyName || directCompanyName || fallback, fallback);
}

export function resolveSiteDisplayName(site: SiteDisplayNameInput, fallback?: string) {
  const scope = site.scope || "client";
  const scopedSiteState = getWebsiteContentState(`${scope}:${site.id}`);
  const unscopedSiteState = getWebsiteContentState(site.id);
  const builderState =
    site.builderState && typeof site.builderState === "object"
      ? (site.builderState as Record<string, unknown>)
      : null;

  const scopedCompanyName = readTrimmedString(scopedSiteState.profile.companyName);
  const unscopedCompanyName = readTrimmedString(unscopedSiteState.profile.companyName);
  const storedCompanyName = !isTemplateDefaultCompanyName(scopedCompanyName)
    ? scopedCompanyName
    : !isTemplateDefaultCompanyName(unscopedCompanyName)
      ? unscopedCompanyName
      : "";

  const effectiveScopedState = storedCompanyName
    ? {
        ...scopedSiteState,
        profile: {
          ...scopedSiteState.profile,
          companyName: storedCompanyName,
        },
      }
    : {
        ...scopedSiteState,
        profile: {
          ...scopedSiteState.profile,
          companyName: "",
        },
      };

  const displayName = resolveCompanyChineseNameFromState(
    effectiveScopedState,
    builderState,
    site.planName || site.name || fallback || site.planCode || site.id
  );

  return sanitizeDisplayText(
    displayName || site.planName || site.name || fallback || site.planCode || site.id,
    fallback || site.planCode || site.id
  );
}
