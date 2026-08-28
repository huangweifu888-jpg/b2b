import { useEffect, useState } from "react";
import { fetchAllSitesFromBackend, resolveCurrentClientPlanId } from "./sites";

function readCurrentClientPlanId() {
  if (typeof window === "undefined") return null;
  return resolveCurrentClientPlanId(window.location.search);
}

/**
 * Keeps client-source workspaces bound to the active plan selected in the
 * project card. It refreshes site assignments before the first governed API
 * request, avoiding the old hard-coded project ID fallback.
 */
export function useCurrentClientPlanId() {
  const [planId, setPlanId] = useState<number | null>(readCurrentClientPlanId);

  useEffect(() => {
    let active = true;
    const sync = () => {
      if (active) setPlanId(readCurrentClientPlanId());
    };
    const refresh = async () => {
      sync();
      await fetchAllSitesFromBackend();
      sync();
    };

    void refresh();
    window.addEventListener("sites-updated", sync);
    window.addEventListener("popstate", sync);
    return () => {
      active = false;
      window.removeEventListener("sites-updated", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  return planId;
}
