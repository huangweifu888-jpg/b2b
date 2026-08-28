export interface RouteLoadingObservation {
  route: string;
  visitKey: string;
  visitStartedAt: number;
  fallbackMs: number;
  scriptBytes: number;
  largestScriptBytes: number;
}

export const ROUTE_LOADING_OBSERVED_EVENT_NAME = "tradepro:route-loading-observed";

interface RouteVisit {
  route: string;
  visitKey: string;
  startedAt: number;
  hadFallback: boolean;
}

interface RouteFallbackToken {
  id: string;
  route: string;
  visitKey: string;
}

const routeVisits = new Map<string, RouteVisit>();
const routeFallbackTokens = new Map<string, RouteFallbackToken>();
const routeLoadingObservations = new Map<string, RouteLoadingObservation>();
let routeFallbackSequence = 0;

function normalizeRoute(route: string) {
  return route.split("#", 1)[0] || "/";
}

function now() {
  return typeof performance === "undefined" ? 0 : performance.now();
}

function trimOldRoutes<T>(records: Map<string, T>) {
  while (records.size > 80) {
    const oldestKey = records.keys().next().value as string | undefined;
    if (!oldestKey) return;
    records.delete(oldestKey);
  }
}

/** Begin one router visit without importing the full performance workbench into App.tsx. */
export function beginRouteLoadingObservation(routeTarget: string, visitKey: string) {
  const route = normalizeRoute(routeTarget);
  const current = routeVisits.get(route);
  if (current?.visitKey === visitKey) return;
  routeVisits.set(route, { route, visitKey, startedAt: now(), hadFallback: false });
  routeLoadingObservations.delete(route);
  trimOldRoutes(routeVisits);
}

/** Mark that Suspense displayed its real route fallback for this visit. */
export function startRouteFallbackObservation(routeTarget: string, visitKey: string) {
  const route = normalizeRoute(routeTarget);
  if (routeVisits.get(route)?.visitKey !== visitKey) beginRouteLoadingObservation(route, visitKey);
  const visit = routeVisits.get(route);
  if (visit) visit.hadFallback = true;
  const token = `${visitKey}:${++routeFallbackSequence}`;
  routeFallbackTokens.set(token, { id: token, route, visitKey });
  return token;
}

/**
 * Finish a fallback without retaining resource URLs. The largest completed
 * fallback wins, so nested layout/page Suspense boundaries describe the full
 * route wait rather than whichever boundary happened to clean up first.
 */
export function finishRouteFallbackObservation(token: string) {
  const fallback = routeFallbackTokens.get(token);
  routeFallbackTokens.delete(token);
  if (!fallback || typeof performance === "undefined") return;
  const visit = routeVisits.get(fallback.route);
  if (!visit || visit.visitKey !== fallback.visitKey || !visit.hadFallback) return;

  const endedAt = performance.now();
  const scripts = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter(
    (entry) => entry.initiatorType === "script"
      && entry.responseEnd >= visit.startedAt - 100
      && entry.responseEnd <= endedAt + 100,
  );
  const scriptSizes = scripts.map((entry) => Math.max(entry.transferSize, entry.encodedBodySize, entry.decodedBodySize));
  const next: RouteLoadingObservation = {
    route: fallback.route,
    visitKey: fallback.visitKey,
    visitStartedAt: visit.startedAt,
    fallbackMs: Math.max(0, Math.round(endedAt - visit.startedAt)),
    scriptBytes: scriptSizes.reduce((total, size) => total + size, 0),
    largestScriptBytes: scriptSizes.reduce((largest, size) => Math.max(largest, size), 0),
  };
  const current = routeLoadingObservations.get(fallback.route);
  if (!current || current.visitKey !== next.visitKey || next.fallbackMs >= current.fallbackMs) {
    routeLoadingObservations.set(fallback.route, next);
    trimOldRoutes(routeLoadingObservations);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(ROUTE_LOADING_OBSERVED_EVENT_NAME, { detail: { route: next.route } }));
    }
  }
}

export function readRouteLoadingObservation(routeTarget: string): RouteLoadingObservation {
  const route = normalizeRoute(routeTarget);
  const visit = routeVisits.get(route);
  const observation = routeLoadingObservations.get(route);
  if (visit && observation?.visitKey === visit.visitKey) return observation;
  return {
    route,
    visitKey: visit?.visitKey || "",
    visitStartedAt: visit?.startedAt || 0,
    fallbackMs: 0,
    scriptBytes: 0,
    largestScriptBytes: 0,
  };
}
