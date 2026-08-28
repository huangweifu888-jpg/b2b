import { findPageLayoutContract, isSourcePageLayoutContract, type PageLayoutContract } from "@/lib/page-layout-contract";
import { resolvePageCompositionStructuralRoute } from "@/lib/page-composition-identity";

export type CompositionWorkspaceScope = "hq" | "agency_source" | "client_source" | "agency" | "client";
export type CompositionHeaderProfile = "table" | "card";
export type CompositionContentProfile = "list" | "form" | "dashboard" | "guide";

export type PageCompositionManifest = {
  schemaVersion: 1;
  id: string;
  route: string;
  workspaceScope: CompositionWorkspaceScope;
  registration: "registered" | "needs-registration";
  global: { profile: "shared-frame-v1"; owner: "shared-variables" };
  header: { profile: CompositionHeaderProfile; scrollOwner: "header-workspace" };
  content: { profile: CompositionContentProfile; owner: "page" };
  plugins: readonly ["visual", "actions", "status"];
  dataBoundary: "business-data-and-downstream-custom-data-stay-page-owned";
  sync: {
    direction: "template-downstream-only";
    eligible: boolean;
    excluded: readonly ["business-data", "downstream-custom-data", "downstream-new-data"];
  };
};

function resolveWorkspaceScope(pathname: string): CompositionWorkspaceScope {
  if (pathname.startsWith("/zb/agency-source")) return "agency_source";
  if (pathname.startsWith("/zb/client-source")) return "client_source";
  if (pathname.startsWith("/zb")) return "hq";
  if (pathname.startsWith("/dl")) return "agency";
  return "client";
}

function resolveContentProfile(route: string): CompositionContentProfile {
  const normalized = route.toLowerCase();
  if (normalized.includes("tab=development")) return "guide";
  if (/domain|site-settings|form|setting/.test(normalized)) return "form";
  if (/summary|dashboard|report/.test(normalized)) return "dashboard";
  return "list";
}

function manifestId(route: string) {
  return `manifest-${route.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "") || "page"}`;
}

/**
 * The manifest references registered building blocks only. It never contains
 * table rows, form values, uploaded assets or downstream changes, so its
 * publication cannot overwrite business data.
 */
export function buildPageCompositionManifest(pathname: string, search = ""): PageCompositionManifest {
  const route = resolvePageCompositionStructuralRoute(pathname, search);
  const contract = findPageLayoutContract(route);
  const content = resolveContentProfile(route);
  const scope = resolveWorkspaceScope(pathname);
  const sourceScope = scope === "hq" || scope === "agency_source" || scope === "client_source";

  return {
    schemaVersion: 1,
    id: manifestId(route),
    route,
    workspaceScope: scope,
    registration: contract ? "registered" : "needs-registration",
    global: { profile: "shared-frame-v1", owner: "shared-variables" },
    header: { profile: content === "form" ? "card" : "table", scrollOwner: "header-workspace" },
    content: { profile: content, owner: "page" },
    plugins: (contract?.pluginGroups ?? ["visual", "actions", "status"]) as PageCompositionManifest["plugins"],
    dataBoundary: "business-data-and-downstream-custom-data-stay-page-owned",
    sync: {
      direction: "template-downstream-only",
      eligible: sourceScope && isSourcePageLayoutContract(route),
      excluded: ["business-data", "downstream-custom-data", "downstream-new-data"],
    },
  };
}

/** A composition can publish only from a registered template source. */
export function canPublishPageComposition(manifest: PageCompositionManifest) {
  return manifest.registration === "registered" && manifest.sync.eligible;
}

/** Typed helper for the forthcoming new-page wizard. */
export function getRegisteredCompositionContract(route: string): PageLayoutContract | undefined {
  return findPageLayoutContract(route);
}
