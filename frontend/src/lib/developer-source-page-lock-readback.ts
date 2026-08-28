import { localDevFetch } from "./local-dev";
import type { CompletedLayoutLock } from "./page-layout-lock";

export type SourcePageLockRegistryEntry = {
  locked?: boolean;
  paths?: readonly string[];
  registeredAt?: string;
};

export type SourcePageLockRegistryResponse = {
  version: number;
  locks: Record<string, SourcePageLockRegistryEntry>;
  updatedAt: string;
};

export async function readSourcePageLocks(): Promise<SourcePageLockRegistryResponse> {
  const response = await localDevFetch("/api/v1/local-dev/source-page-locks");
  return (await response.json()) as SourcePageLockRegistryResponse;
}

export function isSourcePageLockRegistered(response: SourcePageLockRegistryResponse, lock: CompletedLayoutLock) {
  return response.locks[lock]?.locked === true;
}

export async function syncSourcePageLockWithReadback(lock: CompletedLayoutLock, locked: boolean) {
  const response = await localDevFetch("/api/v1/local-dev/source-page-locks", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lockId: lock, locked }),
  });
  const written = (await response.json()) as SourcePageLockRegistryResponse;
  if (isSourcePageLockRegistered(written, lock) !== locked) {
    throw new Error("源码锁写入后状态不一致");
  }
  const registry = await readSourcePageLocks();
  if (isSourcePageLockRegistered(registry, lock) !== locked) {
    throw new Error("源码锁服务端回读不一致");
  }
  return registry;
}
