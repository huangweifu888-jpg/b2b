import { getSiteById, getSitePublicUrl } from "@/lib/sites";
import { pickCleanText } from "@/lib/text-sanitizer";

export type SiteContextMeta = {
  agency: string;
  client: string;
  plan: string;
  url: string;
};

export function appendSiteIdToPath(path: string, siteId?: string | null) {
  const normalizedSiteId = siteId?.trim();
  const [pathname, rawSearch] = path.split("?");
  const params = new URLSearchParams(rawSearch || "");
  if (normalizedSiteId) params.set("siteId", normalizedSiteId);

  // When an agent enters a client from the customer list, retain that exact
  // tenant and plan while the client navigates between backend pages.
  if (typeof window !== "undefined" && pathname.startsWith("/kh")) {
    const current = new URLSearchParams(window.location.search);
    const clientCode = current.get("client")?.trim();
    const planCode = current.get("plan")?.trim();
    if (clientCode) params.set("client", clientCode);
    if (planCode) params.set("plan", planCode);
  }
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

export function buildSiteContextMeta(siteId?: string | null): SiteContextMeta | null {
  const normalizedSiteId = siteId?.trim();
  if (!normalizedSiteId) return null;

  const site = getSiteById(normalizedSiteId);
  if (!site) return null;

  return {
    agency: `${pickCleanText([site.agencyName], "-")} ${site.agencyCode ? `(${site.agencyCode})` : ""}`.trim(),
    client: `${pickCleanText([site.clientName], "-")} ${site.clientCode ? `(${site.clientCode})` : ""}`.trim(),
    plan: `${pickCleanText([site.planName, site.name], "-")} ${site.planCode ? `(${site.planCode})` : ""}`.trim(),
    url: getSitePublicUrl(site),
  };
}
