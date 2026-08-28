import { getRuntimeFrameIssues, type RuntimePageFrameScan } from "@/lib/layout-screenshot-regressions";

const SCAN_HISTORY_KEY = "tradepro.layout-page-scan-history.v1";
const SCAN_HISTORY_LIMIT = 10;

export type LayoutPageScanHistoryEntry = {
  checkedAt: string;
  total: number;
  passed: number;
  failed: number;
  failures: readonly { route: string; issues: readonly string[] }[];
};

export function readLayoutPageScanHistory(): readonly LayoutPageScanHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = JSON.parse(window.localStorage.getItem(SCAN_HISTORY_KEY) || "[]") as unknown;
    if (!Array.isArray(saved)) return [];
    return saved.filter((item): item is LayoutPageScanHistoryEntry => Boolean(item && typeof item === "object" && "checkedAt" in item && "total" in item && "passed" in item && "failed" in item && "failures" in item)).slice(0, SCAN_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

/** Persist only compact health results. Page configuration, content, images,
 * business data, and downstream custom data are never recorded here. */
export function recordLayoutPageScanHistory(scan: RuntimePageFrameScan): readonly LayoutPageScanHistoryEntry[] {
  const entry: LayoutPageScanHistoryEntry = {
    checkedAt: scan.checkedAt,
    total: scan.items.length,
    passed: scan.passed,
    failed: scan.failed,
    failures: scan.items.filter((item) => !item.passed).map((item) => ({ route: item.route, issues: getRuntimeFrameIssues(item).map((issue) => issue.label) })),
  };
  const next = [entry, ...readLayoutPageScanHistory()].slice(0, SCAN_HISTORY_LIMIT);
  if (typeof window !== "undefined") window.localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(next));
  return next;
}

export { SCAN_HISTORY_LIMIT };
