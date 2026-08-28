import {
  validateDeveloperGlobalFrameAdapterRegistry,
} from "@/lib/developer-global-frame-adapter-registry";
import {
  DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS,
  isDeveloperGlobalFrameIntentionalIsolationPageId,
} from "@/lib/developer-global-frame-adapter-resolution";
import {
  validateDeveloperGlobalFrameSection,
  type DeveloperGlobalFrameSection,
} from "@/lib/developer-global-frame-draft";
import { PAGE_FACTORY_PAGES, type PageFactoryScope } from "@/page-factory/page-factory";
import { SHARED_WINDOW_FACTORY_DEFAULT } from "@/lib/shared-window-contract";

export const DEVELOPER_GLOBAL_BATCH_RELEASE_STORAGE_KEY = "tradepro:developer-global-frame:local-batch.v1" as const;
export const DEVELOPER_GLOBAL_BATCH_RELEASE_EVENT = "tradepro:developer-global-frame:local-batch-applied" as const;
const MAX_BATCH_RELEASE_BYTES = 160_000;

export type DeveloperGlobalBatchTargetStatus = "ready" | "waiting-adapter" | "blocked";

export type DeveloperGlobalBatchTarget = {
  pageId: string;
  label: string;
  route: string;
  sourceScope: PageFactoryScope;
  status: DeveloperGlobalBatchTargetStatus;
  detail: string;
};

export type DeveloperGlobalBatchPreflight = {
  passed: boolean;
  checkedAt: string;
  readyCount: number;
  waitingAdapterCount: number;
  blockedCount: number;
  rootContractScopes: readonly PageFactoryScope[];
  issues: string[];
  targets: DeveloperGlobalBatchTarget[];
};

export type DeveloperGlobalLocalBatchRelease = {
  schemaVersion: 1;
  id: string;
  appliedAt: string;
  sourceScopes: readonly ["hq", "agency_source", "client_source"];
  sharedWindowContractVersion: string;
  section: DeveloperGlobalFrameSection;
  compatibleTargetPageIds: string[];
  recoveryPointId: string;
};

export type DeveloperGlobalLocalBatchReleaseOptions = {
  /**
   * A preflight-approved subset of page-factory targets. Omit this only for
   * legacy local previews that intentionally consume every ready target.
   */
  compatibleTargetPageIds?: readonly string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function inspectDeveloperGlobalBatchPreflight(section: unknown): DeveloperGlobalBatchPreflight {
  const registry = validateDeveloperGlobalFrameAdapterRegistry();
  const sectionValidation = validateDeveloperGlobalFrameSection(section);
  const registeredByFactoryId = new Map(DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS.map((entry) => [entry.pageFactoryId, entry]));
  const issues = [
    ...registry.issues.map((issue) => `适配器登记：${issue}`),
    ...sectionValidation.issues.map((issue) => `来源草案：${issue}`),
  ];
  const targets = PAGE_FACTORY_PAGES.map((page): DeveloperGlobalBatchTarget => {
    const adapter = registeredByFactoryId.get(page.id);
    if (isDeveloperGlobalFrameIntentionalIsolationPageId(page.id)) {
      return {
        pageId: page.id,
        label: page.label,
        route: page.route,
        sourceScope: page.sourceScope,
        status: "blocked",
        detail: "认证控制流、嵌入预览或公开站点属于技术页面；保留原功能并记录证据，但不套用三端业务工作区框架。",
      };
    }
    if ((page.status === "complete" || page.status === "pilot-complete") && adapter) {
      return {
        pageId: page.id,
        label: page.label,
        route: page.route,
        sourceScope: page.sourceScope,
        status: "ready",
        detail: adapter.strategy === "explicit-exception"
          ? `模板契约已就绪，且已登记真实 DOM 适配器（${adapter.role}）；会读取精确区域配置。`
          : `模板契约已就绪；会通过 ${adapter.adapterId} 读取标题、表壳、表头、内容、尾栏与响应式共享配置。`,
      };
    }
    if (page.status === "complete" || page.status === "pilot-complete") {
      return {
        pageId: page.id,
        label: page.label,
        route: page.route,
        sourceScope: page.sourceScope,
        status: "waiting-adapter",
        detail: "页面已完成但缺少可解析适配器；保留原页面，待适配器补齐后自动进入下一批。",
      };
    }
    return {
      pageId: page.id,
      label: page.label,
      route: page.route,
      sourceScope: page.sourceScope,
      status: "blocked",
      detail: "页面工厂生命周期尚未完成；保持页面原状，不参与批量外观应用。",
    };
  });
  const readyCount = targets.filter((target) => target.status === "ready").length;
  const waitingAdapterCount = targets.filter((target) => target.status === "waiting-adapter").length;
  const blockedCount = targets.filter((target) => target.status === "blocked").length;
  return {
    passed: registry.valid && sectionValidation.valid && readyCount > 0,
    checkedAt: new Date().toISOString(),
    readyCount,
    waitingAdapterCount,
    blockedCount,
    rootContractScopes: ["hq", "agency_source", "client_source"],
    issues,
    targets,
  };
}

function parseDeveloperGlobalLocalBatchRelease(value: unknown): DeveloperGlobalLocalBatchRelease | null {
  if (!isRecord(value)
    || value.schemaVersion !== 1
    || typeof value.id !== "string"
    || !value.id
    || typeof value.appliedAt !== "string"
    || !Number.isFinite(Date.parse(value.appliedAt))
    || value.sharedWindowContractVersion !== SHARED_WINDOW_FACTORY_DEFAULT.version
    || !Array.isArray(value.sourceScopes)
    || JSON.stringify(value.sourceScopes) !== JSON.stringify(["hq", "agency_source", "client_source"])
    || !Array.isArray(value.compatibleTargetPageIds)
    || value.compatibleTargetPageIds.some((item) => typeof item !== "string")
    || typeof value.recoveryPointId !== "string"
    || !value.recoveryPointId) return null;
  const preflight = inspectDeveloperGlobalBatchPreflight(value.section);
  const readyIds = new Set(preflight.targets.filter((target) => target.status === "ready").map((target) => target.pageId));
  const actualIds = value.compatibleTargetPageIds as string[];
  if (!preflight.passed
    || actualIds.length === 0
    || new Set(actualIds).size !== actualIds.length
    || actualIds.some((pageId) => !readyIds.has(pageId))) return null;
  return value as unknown as DeveloperGlobalLocalBatchRelease;
}

export function readDeveloperGlobalLocalBatchRelease(storage: Pick<Storage, "getItem" | "removeItem">): DeveloperGlobalLocalBatchRelease | null {
  const raw = storage.getItem(DEVELOPER_GLOBAL_BATCH_RELEASE_STORAGE_KEY);
  if (!raw) return null;
  if (raw.length > MAX_BATCH_RELEASE_BYTES) {
    storage.removeItem(DEVELOPER_GLOBAL_BATCH_RELEASE_STORAGE_KEY);
    return null;
  }
  try {
    const release = parseDeveloperGlobalLocalBatchRelease(JSON.parse(raw));
    if (!release) storage.removeItem(DEVELOPER_GLOBAL_BATCH_RELEASE_STORAGE_KEY);
    return release;
  } catch {
    storage.removeItem(DEVELOPER_GLOBAL_BATCH_RELEASE_STORAGE_KEY);
    return null;
  }
}

export function writeDeveloperGlobalLocalBatchRelease(
  storage: Pick<Storage, "setItem">,
  section: DeveloperGlobalFrameSection,
  options: DeveloperGlobalLocalBatchReleaseOptions = {},
): { release: DeveloperGlobalLocalBatchRelease; preflight: DeveloperGlobalBatchPreflight } | null {
  const preflight = inspectDeveloperGlobalBatchPreflight(section);
  if (!preflight.passed) return null;
  const readyIds = preflight.targets.filter((target) => target.status === "ready").map((target) => target.pageId);
  const readyIdSet = new Set(readyIds);
  const compatibleTargetPageIds = options.compatibleTargetPageIds
    ? [...options.compatibleTargetPageIds]
    : readyIds;
  if (!compatibleTargetPageIds.length
    || new Set(compatibleTargetPageIds).size !== compatibleTargetPageIds.length
    || compatibleTargetPageIds.some((pageId) => !readyIdSet.has(pageId))) return null;
  const appliedAt = new Date().toISOString();
  const release: DeveloperGlobalLocalBatchRelease = {
    schemaVersion: 1,
    id: `local-batch-${Date.parse(appliedAt)}-${section.profile_version}`,
    appliedAt,
    sourceScopes: ["hq", "agency_source", "client_source"],
    sharedWindowContractVersion: SHARED_WINDOW_FACTORY_DEFAULT.version,
    section,
    compatibleTargetPageIds,
    recoveryPointId: section.recovery.recovery_point_id,
  };
  try {
    storage.setItem(DEVELOPER_GLOBAL_BATCH_RELEASE_STORAGE_KEY, JSON.stringify(release));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(DEVELOPER_GLOBAL_BATCH_RELEASE_EVENT, { detail: { id: release.id, appliedAt } }));
    }
    return { release, preflight };
  } catch {
    return null;
  }
}

export function clearDeveloperGlobalLocalBatchRelease(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(DEVELOPER_GLOBAL_BATCH_RELEASE_STORAGE_KEY);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(DEVELOPER_GLOBAL_BATCH_RELEASE_EVENT, { detail: null }));
}

export function isDeveloperGlobalLocalBatchTarget(release: DeveloperGlobalLocalBatchRelease | null, pageFactoryId: string) {
  return Boolean(release?.compatibleTargetPageIds.includes(pageFactoryId));
}
