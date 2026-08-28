export type LayoutPerformanceKind = "workspace-open" | "preview-ready" | "page-switch";

export type LayoutPerformanceSample = {
  kind: LayoutPerformanceKind;
  route: string;
  durationMs: number;
  recordedAt: string;
};

export type LayoutPerformanceTrend = {
  kind: LayoutPerformanceKind;
  label: string;
  count: number;
  latestMs: number;
  averageMs: number;
};

const STORAGE_KEY = "tradepro.layout-performance-trends.v1";
const PENDING_NAVIGATION_KEY = "tradepro.layout-performance-navigation.v1";
const MAX_SAMPLES = 30;

const LABELS: Record<LayoutPerformanceKind, string> = {
  "workspace-open": "工作台打开",
  "preview-ready": "预览就绪",
  "page-switch": "页面切换",
};

function browserStorage() {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

function now() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function normalizeDuration(durationMs: number) {
  return Math.max(0, Math.round(Number.isFinite(durationMs) ? durationMs : 0));
}

export function readLayoutPerformanceSamples(): readonly LayoutPerformanceSample[] {
  try {
    const raw = browserStorage()?.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((sample): sample is LayoutPerformanceSample =>
      sample && typeof sample.route === "string" && typeof sample.durationMs === "number" && sample.kind in LABELS,
    ).slice(0, MAX_SAMPLES);
  } catch {
    return [];
  }
}

/** Stores only local UX timing samples. It never records layout values, content, or user data. */
export function recordLayoutPerformanceSample(kind: LayoutPerformanceKind, route: string, durationMs: number) {
  const sample: LayoutPerformanceSample = {
    kind,
    route,
    durationMs: normalizeDuration(durationMs),
    recordedAt: new Date().toLocaleString("zh-CN"),
  };
  try {
    browserStorage()?.setItem(STORAGE_KEY, JSON.stringify([sample, ...readLayoutPerformanceSamples()].slice(0, MAX_SAMPLES)));
  } catch {
    // Storage can be disabled. The workbench and page navigation must remain usable.
  }
  return sample;
}

export function beginLayoutPageNavigation(route: string) {
  try {
    window.sessionStorage.setItem(PENDING_NAVIGATION_KEY, JSON.stringify({ route, startedAt: now() }));
  } catch {
    // Timing is an optional quality signal.
  }
}

export function completeLayoutPageNavigation(route: string) {
  try {
    const raw = window.sessionStorage.getItem(PENDING_NAVIGATION_KEY);
    const pending = raw ? JSON.parse(raw) : undefined;
    if (!pending || pending.route !== route || typeof pending.startedAt !== "number") return undefined;
    window.sessionStorage.removeItem(PENDING_NAVIGATION_KEY);
    return recordLayoutPerformanceSample("page-switch", route, now() - pending.startedAt);
  } catch {
    return undefined;
  }
}

export function summarizeLayoutPerformance(samples = readLayoutPerformanceSamples()): readonly LayoutPerformanceTrend[] {
  return (Object.keys(LABELS) as LayoutPerformanceKind[]).flatMap((kind) => {
    const entries = samples.filter((sample) => sample.kind === kind);
    if (!entries.length) return [];
    const total = entries.reduce((sum, sample) => sum + sample.durationMs, 0);
    return [{ kind, label: LABELS[kind], count: entries.length, latestMs: entries[0].durationMs, averageMs: Math.round(total / entries.length) }];
  });
}
