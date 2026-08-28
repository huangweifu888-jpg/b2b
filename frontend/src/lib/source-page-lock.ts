import { localDevFetch } from "./local-dev";
import type { CompletedLayoutLock } from "./page-layout-lock";

export function supportsSourcePageLock(lock: CompletedLayoutLock) {
  return lock.startsWith("tool:") || lock.startsWith("page:") || lock === "navigation-customization" || lock.startsWith("site-settings-");
}

/**
 * Keeps the local source-guard registry in sync with 08 页面锁定器.
 * The registry stores only reviewed file hashes, never source contents.
 */
export async function syncSourcePageLock(lock: CompletedLayoutLock, locked: boolean) {
  if (!supportsSourcePageLock(lock)) return;

  await localDevFetch("/api/v1/local-dev/source-page-locks", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lockId: lock, locked }),
  });
}
