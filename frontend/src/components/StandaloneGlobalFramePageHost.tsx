import { Outlet, useLocation } from "react-router-dom";

import { DeveloperGlobalFrameRuntimeHost } from "@/components/developer-platform/DeveloperGlobalFrameRuntimeHost";
import ResponsivePageHost from "@/components/ResponsivePageHost";

/**
 * Read-only factory/runtime host for the five registered routes that must stay
 * outside the authenticated HQ/Agency/Client application shells.
 */
export default function StandaloneGlobalFramePageHost() {
  const location = useLocation();
  return (
    <div data-standalone-global-frame-shell data-responsive-shell="client-source" style={{ display: "contents" }}>
      <DeveloperGlobalFrameRuntimeHost
        pathname={location.pathname}
        search={location.search}
        sourceScope="client_source"
      />
      <ResponsivePageHost scope="client-source"><Outlet /></ResponsivePageHost>
    </div>
  );
}
