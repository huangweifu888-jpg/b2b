const CHUNK_RELOAD_GUARD_KEY = "tradepro.chunkReloadGuard";
const ROUTE_RELOAD_GUARD_KEY = "tradepro.routeReloadGuard";
const ROUTE_ERROR_DIAGNOSTIC_KEY = "tradepro.routeErrorDiagnostic";
const ROUTE_ERROR_LEARNING_KEY = "tradepro.route-error-learning.v1";
const ROUTE_RECOVERY_COOLDOWN_MS = 30_000;
const ROUTE_ERROR_LEARNING_LIMIT = 200;

export const PAGE_LOAD_RECOVERY_EVENT_NAME = "tradepro:page-load-recovery";

export type RouteErrorDiagnostic = {
  target: string;
  message: string;
  at: number;
};

type RouteErrorLearningEntry = {
  target: string;
  signature: string;
  at: number;
};

export type RouteErrorLearningFactor = {
  signature: string;
  count: number;
  firstAt: number;
  lastAt: number;
  targets: string[];
};

function classifyRouteError(message: string) {
  if (/Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(message)) return "页面模块加载失败";
  if (/Cannot read (properties|property) of undefined|is not defined/i.test(message)) return "组件引用或数据为空";
  if (/plugin|插件/i.test(message)) return "页面插件运行异常";
  return "页面运行时异常";
}

function readRouteErrorLearning(): RouteErrorLearningEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(ROUTE_ERROR_LEARNING_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is RouteErrorLearningEntry => Boolean(
      entry && typeof entry === "object" && typeof (entry as RouteErrorLearningEntry).target === "string" && typeof (entry as RouteErrorLearningEntry).signature === "string" && typeof (entry as RouteErrorLearningEntry).at === "number",
    )).slice(-ROUTE_ERROR_LEARNING_LIMIT);
  } catch {
    return [];
  }
}

function recordRouteErrorLearning(target: string, message: string) {
  if (typeof window === "undefined") return;
  try {
    const next = [...readRouteErrorLearning(), { target, signature: classifyRouteError(message), at: Date.now() }].slice(-ROUTE_ERROR_LEARNING_LIMIT);
    window.localStorage.setItem(ROUTE_ERROR_LEARNING_KEY, JSON.stringify(next));
  } catch {
    // Learning is advisory and must never turn a page error into a second failure.
  }
}

export function getRouteErrorLearningNote(target: string) {
  const entries = readRouteErrorLearning().filter((entry) => entry.target === target);
  if (!entries.length) return "首次检测当前页面异常，后续同类错误会在本机累计。";
  const latest = entries[entries.length - 1];
  return `本机已记录 ${entries.length} 次；最近归类：${latest.signature}。`;
}

/** Returns actual page-error factors in first-seen order for compact capsules. */
export function listRouteErrorLearningFactors(target?: string): RouteErrorLearningFactor[] {
  const grouped = new Map<string, RouteErrorLearningEntry[]>();
  for (const entry of readRouteErrorLearning()) {
    if (target && entry.target !== target) continue;
    const group = grouped.get(entry.signature) || [];
    group.push(entry);
    grouped.set(entry.signature, group);
  }
  return [...grouped.entries()]
    .map(([signature, entries]) => ({
      signature,
      count: entries.length,
      firstAt: Math.min(...entries.map((entry) => entry.at)),
      lastAt: Math.max(...entries.map((entry) => entry.at)),
      targets: [...new Set(entries.map((entry) => entry.target))],
    }))
    .sort((left, right) => left.firstAt - right.firstAt);
}

/** Records the last isolated route error so Source Developer can explain it. */
export function recordRouteErrorDiagnostic(error: unknown, target: string) {
  if (typeof window === "undefined") return;
  const diagnostic: RouteErrorDiagnostic = {
    target,
    message: error instanceof Error ? error.message : String(error || "unknown route error"),
    at: Date.now(),
  };
  try {
    window.sessionStorage.setItem(ROUTE_ERROR_DIAGNOSTIC_KEY, JSON.stringify(diagnostic));
    recordRouteErrorLearning(target, diagnostic.message);
  } catch {
    // Diagnostics are advisory; an unavailable storage area must not create a second error.
  }
}

export function readRouteErrorDiagnostic(): RouteErrorDiagnostic | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(ROUTE_ERROR_DIAGNOSTIC_KEY) || "null") as RouteErrorDiagnostic | null;
    return parsed && typeof parsed.target === "string" && typeof parsed.message === "string" && typeof parsed.at === "number" ? parsed : null;
  } catch {
    return null;
  }
}

export function clearRouteErrorDiagnostic(target?: string) {
  if (typeof window === "undefined") return;
  const current = readRouteErrorDiagnostic();
  if (target && current?.target !== target) return;
  try {
    window.sessionStorage.removeItem(ROUTE_ERROR_DIAGNOSTIC_KEY);
  } catch {
    // No-op: this only removes a past advisory diagnostic.
  }
}

export type PageLoadRecoveryPhase = "retrying" | "recovered" | "failed";

export type PageLoadRecoveryDetail = {
  phase: PageLoadRecoveryPhase;
  target: string;
  message: string;
  at: number;
};

function shouldAttemptRecovery(storageKey: string, target: string) {
  if (typeof window === "undefined") return false;

  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as { at?: number; target?: string };
    if (!parsed?.target || parsed.target !== target) return true;
    return Date.now() - (parsed.at || 0) > ROUTE_RECOVERY_COOLDOWN_MS;
  } catch {
    return true;
  }
}

function markRecovery(storageKey: string, target: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify({ target, at: Date.now() }));
  } catch {
    // Storage is only a cooldown guard; recovery must still work when it is unavailable.
  }
}

function reportRecovery(phase: PageLoadRecoveryPhase, target: string, error: unknown) {
  if (typeof window === "undefined") return;

  const detail = {
    phase,
    target,
    message: error instanceof Error ? error.message : String(error || ""),
    at: Date.now(),
  };

  try {
    window.dispatchEvent(new CustomEvent(PAGE_LOAD_RECOVERY_EVENT_NAME, { detail }));
  } catch {
    // Diagnostics must never become a second source of route failures.
  }
}

export function isRecoverableLazyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();
  return [
    "failed to fetch dynamically imported module",
    "failed to fetch",
    "importing a module script failed",
    "chunkloaderror",
    "loading chunk",
    "dynamically imported module",
    "has already been declared",
  ].some((fragment) => normalized.includes(fragment));
}

/**
 * A rejected dynamic-import promise remains rejected in the browser module
 * cache, so remounting the React boundary cannot recover it. Reload the route
 * once for stale chunks/HMR parse failures, then leave a persistent diagnostic
 * instead of entering a reload loop when the source itself is invalid.
 */
export function reloadRecoverableRoute(error: unknown, routeTarget: string) {
  if (typeof window === "undefined" || !isRecoverableLazyError(error)) return false;
  const target = `${routeTarget}::route-reload`;
  if (!shouldAttemptRecovery(ROUTE_RELOAD_GUARD_KEY, target)) {
    reportRecovery("failed", target, error);
    return false;
  }

  markRecovery(ROUTE_RELOAD_GUARD_KEY, target);
  reportRecovery("retrying", target, error);
  window.setTimeout(() => window.location.reload(), 0);
  return true;
}

/**
 * Keeps route-level and page-internal lazy imports on the same one-retry
 * recovery path. A cold/updated dev module can fail once without exposing the
 * route isolation surface; non-recoverable render errors still reach it.
 */
export async function loadLazyModule<T>(loader: () => Promise<T>, loaderKey: string) {
  try {
    return await loader();
  } catch (error) {
    const target = typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}::${loaderKey}`
      : loaderKey;

    if (!isRecoverableLazyError(error) || !shouldAttemptRecovery(CHUNK_RELOAD_GUARD_KEY, target)) {
      reportRecovery("failed", target, error);
      throw error;
    }

    markRecovery(CHUNK_RELOAD_GUARD_KEY, target);
    reportRecovery("retrying", target, error);
    await new Promise((resolve) => window.setTimeout(resolve, 180));

    try {
      const module = await loader();
      reportRecovery("recovered", target, error);
      return module;
    } catch (retryError) {
      reportRecovery("failed", target, retryError);
      throw retryError;
    }
  }
}
