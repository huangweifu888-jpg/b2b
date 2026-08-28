import type { ExportableConfig } from "./product-market-store";
import {
  readAgencyTemplateProductMarketConfig,
  readClientPlanProductMarketConfig,
  readClientTemplateProductMarketConfig,
  readHeadquartersProductMarketConfig,
} from "./product-market-config";

export type CustomerServiceRuntimeScope = "client" | "agency" | "hq" | "client_source" | "agency_source";

export const CUSTOMER_SERVICE_RUNTIME_CONFIG_CONTRACT = {
  version: "2026.08.26.1",
  plugin: "shared-customer-service-runtime-config-v2",
  policy: "saved-current-scope-and-site-first>live-editor-fallback>one-avatar-override-map>saved-default-expert-resets-stale-chat-preference",
} as const;

/**
 * A chat-window expert switch is a local convenience, whereas a saved
 * selection in Customer Service is the scoped default.  When that persisted
 * default changes, retaining the former local choice makes the floating
 * expert look as if the save did not take effect.  Keep the rule pure so the
 * widget can apply it consistently for headquarters, both source workspaces
 * and site plans.
 */
export function reconcileCustomerServiceRuntimeExpertSelection({
  previousRuntimeAvatarId,
  nextRuntimeAvatarId,
  activeExpertId,
}: {
  previousRuntimeAvatarId?: string | null;
  nextRuntimeAvatarId?: string | null;
  activeExpertId?: string | null;
}) {
  const previous = previousRuntimeAvatarId?.trim() || "";
  const next = nextRuntimeAvatarId?.trim() || "";
  const hasSavedDefaultChanged = Boolean(previous && next && previous !== next);

  return {
    activeExpertId: hasSavedDefaultChanged ? null : (activeExpertId || null),
    clearRememberedExpert: hasSavedDefaultChanged,
  } as const;
}

export function resolveCustomerServiceRuntimeScope(pathname: string): CustomerServiceRuntimeScope {
  if (pathname.startsWith("/zb/client-source")) return "client_source";
  if (pathname.startsWith("/zb/agency-source")) return "agency_source";
  if (pathname.startsWith("/dl/kh")) return "agency";
  if (pathname.startsWith("/zb/kh")) return "hq";
  if (pathname.startsWith("/dl")) return "agency";
  if (pathname.startsWith("/zb")) return "hq";
  return "client";
}

export function mergeCustomerServiceAvatarOverrideMaps(
  primary?: ExportableConfig["csAvatarOverrides"],
  secondary?: ExportableConfig["csAvatarOverrides"],
) {
  return Object.fromEntries(
    Array.from(new Set([...Object.keys(secondary || {}), ...Object.keys(primary || {})]))
      .map((key) => [
        key,
        {
          ...(secondary?.[key] || {}),
          ...(primary?.[key] || {}),
        },
      ] as const)
      .filter(([, value]) => Object.keys(value || {}).length > 0),
  );
}

export function resolveCustomerServiceRuntimeSnapshot({
  pathname,
  currentSiteId,
  liveStoreConfig,
}: {
  pathname: string;
  currentSiteId?: string | null;
  liveStoreConfig: ExportableConfig;
}) {
  const storedConfig = pathname.startsWith("/zb/client-source")
    ? readClientTemplateProductMarketConfig() || liveStoreConfig
    : pathname.startsWith("/zb/agency-source")
      ? readAgencyTemplateProductMarketConfig() || liveStoreConfig
      : pathname.startsWith("/zb")
        ? readHeadquartersProductMarketConfig() || liveStoreConfig
        : readClientPlanProductMarketConfig(currentSiteId) || liveStoreConfig;
  const preferLiveStoreConfig = pathname.startsWith("/kh/product-market") && !currentSiteId;
  const runtimeConfig = currentSiteId
    ? storedConfig
    : preferLiveStoreConfig
      ? liveStoreConfig
      : storedConfig;
  const avatarOverrides = currentSiteId
    ? mergeCustomerServiceAvatarOverrideMaps(runtimeConfig.csAvatarOverrides)
    : preferLiveStoreConfig
      ? mergeCustomerServiceAvatarOverrideMaps(runtimeConfig.csAvatarOverrides)
      : mergeCustomerServiceAvatarOverrideMaps(runtimeConfig.csAvatarOverrides, liveStoreConfig.csAvatarOverrides);

  return {
    contract: CUSTOMER_SERVICE_RUNTIME_CONFIG_CONTRACT,
    runtimeConfig,
    avatarOverrides,
  } as const;
}
