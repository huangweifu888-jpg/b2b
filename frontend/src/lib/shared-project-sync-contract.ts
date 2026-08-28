export const SHARED_PROJECT_SYNC_CONTRACT_VERSION = "2026-08-26.1";
export const SHARED_PROJECT_SYNC_REQUEST_EVENT = "tradepro:client-project-sync-request";

export type SharedProjectSyncRequestDetail = {
  pathname: string;
  search: string;
  respondWith?: (completion: Promise<boolean>) => void;
};

/**
 * Dispatches the shared shell save request and, when the mounted page claims
 * it, waits for that page's persistence and read-back verification to finish.
 * Pages that do not own a save handler keep the legacy shell-only behavior.
 */
export async function dispatchSharedProjectSyncRequest(
  route: Pick<SharedProjectSyncRequestDetail, "pathname" | "search">,
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  let completion: Promise<boolean> | null = null;
  const detail: SharedProjectSyncRequestDetail = {
    ...route,
    respondWith: (candidate) => {
      if (!completion) completion = Promise.resolve(candidate);
    },
  };
  window.dispatchEvent(new CustomEvent(SHARED_PROJECT_SYNC_REQUEST_EVENT, { detail }));
  return completion ? await completion : true;
}
