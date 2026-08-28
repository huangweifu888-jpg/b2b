import { useEffect, useState } from "react";

import { readLocalEnvStatus, type LocalEnvStatusResponse } from "@/lib/local-dev";

const DEFAULT_POLL_MS = 1800000;
const STARTUP_GRACE_MS = 15000;
const FAILURE_THRESHOLD = 2;
const RECOVERY_RECHECK_MS = 10000;

type Listener = () => void;

let sharedStatus: LocalEnvStatusResponse | null = null;
let sharedError = "";
let sharedLoading = false;
let activePollMs = DEFAULT_POLL_MS;
let pollTimer: number | null = null;
let recoveryTimer: number | null = null;
let inflightPromise: Promise<LocalEnvStatusResponse | null> | null = null;
let consecutiveFailures = 0;
let initialCheckStartedAt = 0;
let lastFetchCompletedAt = 0;
let visibilityListenerAttached = false;
const listeners = new Set<Listener>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function clearRecoveryRecheck() {
  if (recoveryTimer !== null) {
    window.clearTimeout(recoveryTimer);
    recoveryTimer = null;
  }
}

function isPollingVisible() {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

function scheduleRecoveryRecheck() {
  if (
    typeof window === "undefined"
    || recoveryTimer !== null
    || listeners.size === 0
    || !isPollingVisible()
  ) return;

  recoveryTimer = window.setTimeout(() => {
    recoveryTimer = null;
    if (listeners.size > 0 && isPollingVisible()) {
      void fetchSharedStatus(true);
    }
  }, RECOVERY_RECHECK_MS);
}

async function fetchSharedStatus(silent = false) {
  if (inflightPromise) return inflightPromise;

  if (!silent) {
    sharedLoading = true;
    emitChange();
  }

  inflightPromise = (async () => {
    try {
      const result = await readLocalEnvStatus();
      if (result.ok) {
        sharedStatus = result;
        sharedError = "";
        consecutiveFailures = 0;
        clearRecoveryRecheck();
        return result;
      }

      // One incomplete health sample is common while a local server is
      // rebinding its listening socket. Keep the previous healthy snapshot
      // until the same condition is confirmed, so the global reminder does
      // not flash during a controlled restart.
      consecutiveFailures += 1;
      if (consecutiveFailures >= FAILURE_THRESHOLD) {
        sharedStatus = result;
        sharedError = "本地环境未完全就绪，请手动启动或重启。";
      } else if (!sharedStatus?.ok) {
        sharedStatus = null;
        sharedError = "";
      }
      scheduleRecoveryRecheck();
      return result;
    } catch (err) {
      consecutiveFailures += 1;
      const message = err instanceof Error ? err.message : String(err);
      const withinStartupGrace =
        initialCheckStartedAt > 0 && Date.now() - initialCheckStartedAt < STARTUP_GRACE_MS;
      const canKeepPreviousHealthyState =
        Boolean(sharedStatus?.ok) && consecutiveFailures < FAILURE_THRESHOLD;

      if (withinStartupGrace || canKeepPreviousHealthyState) {
        sharedError = "";
      } else {
        sharedStatus = null;
        sharedError = message;
      }

      scheduleRecoveryRecheck();

      return null;
    } finally {
      sharedLoading = false;
      inflightPromise = null;
      lastFetchCompletedAt = Date.now();
      emitChange();
      schedulePoll();
    }
  })();

  return inflightPromise;
}

function clearPollTimer() {
  if (pollTimer !== null) {
    window.clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function isSharedStatusStale() {
  return lastFetchCompletedAt === 0 || Date.now() - lastFetchCompletedAt >= activePollMs;
}

function schedulePoll() {
  clearPollTimer();
  if (typeof window === "undefined" || listeners.size === 0 || !isPollingVisible()) return;

  const elapsed = lastFetchCompletedAt === 0 ? 0 : Date.now() - lastFetchCompletedAt;
  const delay = lastFetchCompletedAt === 0 ? activePollMs : Math.max(0, activePollMs - elapsed);
  pollTimer = window.setTimeout(() => {
    pollTimer = null;
    if (listeners.size > 0 && isPollingVisible()) {
      void fetchSharedStatus(true);
    }
  }, delay);
}

function handleVisibilityChange() {
  if (!isPollingVisible()) {
    clearPollTimer();
    clearRecoveryRecheck();
    return;
  }

  if (consecutiveFailures > 0 || isSharedStatusStale()) {
    void fetchSharedStatus(true);
  } else {
    schedulePoll();
  }
}

function stopPolling() {
  clearPollTimer();
  clearRecoveryRecheck();
  if (visibilityListenerAttached) {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    visibilityListenerAttached = false;
  }
}

function startPolling() {
  if (!visibilityListenerAttached) {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    visibilityListenerAttached = true;
  }
}

function ensurePolling(pollMs: number) {
  activePollMs = Math.min(pollMs, activePollMs);
  if (typeof window === "undefined") return;

  if (initialCheckStartedAt === 0) {
    initialCheckStartedAt = Date.now();
  }

  startPolling();
}

function refreshSharedStatusIfNeeded() {
  if (!isPollingVisible()) return;
  if (consecutiveFailures > 0) {
    scheduleRecoveryRecheck();
    return;
  }
  if (isSharedStatusStale()) {
    void fetchSharedStatus(true);
  } else {
    schedulePoll();
  }
}

function syncSnapshot() {
  return {
    status: sharedStatus,
    loading: sharedLoading,
    error: sharedError,
  };
}

export function useLocalEnvStatus(pollMs = DEFAULT_POLL_MS) {
  const [snapshot, setSnapshot] = useState(syncSnapshot);

  useEffect(() => {
    const listener = () => setSnapshot(syncSnapshot());
    listeners.add(listener);
    ensurePolling(pollMs);
    refreshSharedStatusIfNeeded();

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        stopPolling();
      }
    };
  }, [pollMs]);

  return {
    status: snapshot.status,
    loading: snapshot.loading,
    error: snapshot.error,
    refreshStatus: fetchSharedStatus,
  };
}
