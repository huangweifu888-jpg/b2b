import { DeveloperGlobalFrameRuntimeHost } from "@/components/developer-platform/DeveloperGlobalFrameRuntimeHost";
import VisualResponsiveContract from "./VisualResponsiveContract";

export type ShellRuntimeSourceScope = "hq" | "agency_source" | "client_source";

export default function ShellRuntimeHosts({
  pathname,
  search,
  sourceScope,
}: {
  pathname: string;
  search: string;
  sourceScope: ShellRuntimeSourceScope;
}) {
  const visualScope = sourceScope === "agency_source" ? "agency-source" : sourceScope === "client_source" ? "client-source" : "hq";
  return (
    <>
      <DeveloperGlobalFrameRuntimeHost pathname={pathname} search={search} sourceScope={sourceScope} />
      <VisualResponsiveContract scope={visualScope} />
    </>
  );
}
