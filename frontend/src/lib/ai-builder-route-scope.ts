export type AIBuilderScope = "client" | "client_source" | "agency" | "agency_source" | "hq";

export function getAIBuilderScope(pathname: string): AIBuilderScope {
  if (pathname.startsWith("/zb/client-source")) return "client_source";
  if (pathname.startsWith("/zb/agency-source")) return "agency_source";
  if (pathname.startsWith("/dl/kh")) return "agency";
  if (pathname.startsWith("/zb/kh")) return "hq";
  if (pathname.startsWith("/dl")) return "agency";
  return "client";
}
