import { lazy, Suspense, useEffect, useState } from "react";

import { schedulePostPaintIdle } from "@/lib/post-paint-lazy";
import type { ShellRuntimeSourceScope } from "./ShellRuntimeHosts";
import VisualResponsiveBootstrap from "./VisualResponsiveBootstrap";

const ShellRuntimeHosts = lazy(() => import("./ShellRuntimeHosts"));

export default function DeferredShellRuntimeHosts({
  pathname,
  search,
  sourceScope,
}: {
  pathname: string;
  search: string;
  sourceScope: ShellRuntimeSourceScope;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => schedulePostPaintIdle(() => setReady(true)), []);
  const visualScope = sourceScope === "agency_source" ? "agency-source" : sourceScope === "client_source" ? "client-source" : "hq";
  return (
    <>
      <VisualResponsiveBootstrap scope={visualScope} />
      {ready ? (
        <Suspense fallback={null}>
          <ShellRuntimeHosts pathname={pathname} search={search} sourceScope={sourceScope} />
        </Suspense>
      ) : null}
    </>
  );
}
