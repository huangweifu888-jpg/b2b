import { DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION } from "@/lib/developer-global-style-contract";
import {
  createDefaultVisualCardLayout,
  normalizeVisualCardLayout,
  type VisualCardComponentStyles,
  type VisualCardFrameInsets,
  type VisualCardLayoutConfig,
} from "@/lib/visual-card-layout-contract";
import type { VisualCardSharedStyleApplyPatch } from "@/lib/visual-card-shared-style-bridge";
import {
  validateMarketingPlaybookDeveloperMarkerProof,
  type MarketingPlaybookDeveloperMarkerProof,
} from "@/lib/marketing-playbook-pilot-inspector";

type SessionStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const GLOBAL_FRAME_VISUAL_DRAFT_PREFIX = "tradepro:developer-global-frame:visual-draft.v1";
const GLOBAL_FRAME_VISUAL_DRAFT_MAX_BYTES = 100_000;
const GLOBAL_FRAME_VISUAL_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
const GLOBAL_FRAME_VISUAL_DRAFT_FUTURE_SKEW_MS = 5_000;
const SAFE_GLOBAL_FRAME_DRAFT_ID = /^[A-Za-z0-9][A-Za-z0-9:._/?=&-]{0,199}$/u;

export type DeveloperGlobalStyleVisualConfirmation = {
  contractVersion: typeof DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION;
  scope: "canary-preview";
  workspaceScope: string;
  pathname: string;
  search: string;
  auditId: string;
  canaryProfileDraftId: string;
  appliedAt: string;
};

export type DeveloperGlobalStyleVisualIntent = {
  contractVersion: typeof DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION;
  mode: "canary-preview";
  workspaceScope: string;
  pathname: string;
  search: string;
  openedAt: string;
};

export type DeveloperGlobalStyleCanaryAppearance = {
  frameInsets: VisualCardFrameInsets;
  componentStyles: VisualCardComponentStyles;
  sharedStylePatch: VisualCardSharedStyleApplyPatch;
};

export type DeveloperGlobalFrameVisualDraft = {
  schemaVersion: 1;
  contractVersion: typeof DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION;
  id: string;
  mode: "global-frame-visual-draft";
  applicationScope: "global";
  workspaceScope: string;
  pathname: string;
  search: string;
  appearance: DeveloperGlobalStyleCanaryAppearance;
  visualAuditId: string;
  recoveryPointId: string;
  savedAt: string;
};

/**
 * Session-only canary evidence. It intentionally projects the visual layout to
 * appearance fields and excludes nodes, component instances, copy and data.
 */
export type DeveloperGlobalStyleCanaryProfileDraft = {
  contractVersion: typeof DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION;
  id: string;
  mode: "canary-profile";
  workspaceScope: string;
  pathname: string;
  search: string;
  appearance: DeveloperGlobalStyleCanaryAppearance;
  visualAuditId: string;
  recoveryPointId: string;
  baselineOnly: boolean;
  savedAt: string;
  developerMarkerProof: MarketingPlaybookDeveloperMarkerProof;
};

function normalizeSearch(search: string) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.sort();
  const normalized = params.toString();
  return normalized ? `?${normalized}` : "";
}

function buildScopedKey(kind: "wizard" | "visual-confirmation" | "visual-intent", scopeKey: string, pathname: string, search: string) {
  return [
    "tradepro:developer-global-style",
    kind,
    encodeURIComponent(scopeKey.trim()),
    encodeURIComponent(pathname),
    encodeURIComponent(normalizeSearch(search)),
  ].join(":");
}

export function buildDeveloperGlobalStyleCanaryProfileDraftKey(workspaceScope: string, draftId: string) {
  return [
    "tradepro:developer-global-style",
    "canary-profile",
    encodeURIComponent(workspaceScope.trim()),
    encodeURIComponent(draftId.trim()),
  ].join(":");
}

export function buildDeveloperGlobalStyleWizardStorageKey(sourceLabel: string, pathname: string, search: string) {
  return buildScopedKey("wizard", sourceLabel, pathname, search);
}

export function buildDeveloperGlobalStyleVisualConfirmationKey(workspaceScope: string, pathname: string, search: string) {
  return buildScopedKey("visual-confirmation", workspaceScope, pathname, search);
}

export function buildDeveloperGlobalStyleVisualIntentKey(workspaceScope: string, pathname: string, search: string) {
  return buildScopedKey("visual-intent", workspaceScope, pathname, search);
}

export function writeDeveloperGlobalStyleVisualIntent(
  storage: SessionStorageLike,
  intent: Omit<DeveloperGlobalStyleVisualIntent, "contractVersion" | "search"> & { search: string },
) {
  if (intent.mode !== "canary-preview" || !intent.workspaceScope || !Number.isFinite(Date.parse(intent.openedAt))) return false;
  const normalized: DeveloperGlobalStyleVisualIntent = {
    ...intent,
    contractVersion: DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION,
    search: normalizeSearch(intent.search),
  };
  try {
    storage.setItem(
      buildDeveloperGlobalStyleVisualIntentKey(normalized.workspaceScope, normalized.pathname, normalized.search),
      JSON.stringify(normalized),
    );
    return true;
  } catch {
    return false;
  }
}

export function readDeveloperGlobalStyleVisualIntent(
  storage: SessionStorageLike,
  request: { workspaceScope: string; pathname: string; search: string },
): DeveloperGlobalStyleVisualIntent | null {
  const key = buildDeveloperGlobalStyleVisualIntentKey(request.workspaceScope, request.pathname, request.search);
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const candidate = JSON.parse(raw) as Partial<DeveloperGlobalStyleVisualIntent>;
    const valid = candidate.contractVersion === DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION
      && candidate.mode === "canary-preview"
      && candidate.workspaceScope === request.workspaceScope
      && candidate.pathname === request.pathname
      && candidate.search === normalizeSearch(request.search)
      && typeof candidate.openedAt === "string"
      && Number.isFinite(Date.parse(candidate.openedAt))
      && Date.now() - Date.parse(candidate.openedAt) <= 4 * 60 * 60 * 1000;
    if (!valid) storage.removeItem(key);
    return valid ? candidate as DeveloperGlobalStyleVisualIntent : null;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function clearDeveloperGlobalStyleVisualIntent(
  storage: SessionStorageLike,
  request: { workspaceScope: string; pathname: string; search: string },
) {
  storage.removeItem(buildDeveloperGlobalStyleVisualIntentKey(request.workspaceScope, request.pathname, request.search));
}

export function writeDeveloperGlobalStyleVisualConfirmation(
  storage: SessionStorageLike,
  confirmation: Omit<DeveloperGlobalStyleVisualConfirmation, "contractVersion" | "search"> & { search: string },
) {
  if (confirmation.scope !== "canary-preview"
    || !confirmation.workspaceScope
    || !confirmation.auditId
    || !confirmation.canaryProfileDraftId
    || !Number.isFinite(Date.parse(confirmation.appliedAt))) return false;
  const normalized: DeveloperGlobalStyleVisualConfirmation = {
    ...confirmation,
    contractVersion: DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION,
    search: normalizeSearch(confirmation.search),
  };
  try {
    storage.setItem(
      buildDeveloperGlobalStyleVisualConfirmationKey(normalized.workspaceScope, normalized.pathname, normalized.search),
      JSON.stringify(normalized),
    );
    return true;
  } catch {
    return false;
  }
}

export function consumeDeveloperGlobalStyleVisualConfirmation(
  storage: SessionStorageLike,
  request: { workspaceScope: string; pathname: string; search: string; visualOpenedAt: string },
): DeveloperGlobalStyleVisualConfirmation | null {
  const key = buildDeveloperGlobalStyleVisualConfirmationKey(request.workspaceScope, request.pathname, request.search);
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const candidate = JSON.parse(raw) as Partial<DeveloperGlobalStyleVisualConfirmation>;
    const valid = candidate.contractVersion === DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION
      && candidate.scope === "canary-preview"
      && candidate.workspaceScope === request.workspaceScope
      && candidate.pathname === request.pathname
      && candidate.search === normalizeSearch(request.search)
      && typeof candidate.auditId === "string"
      && candidate.auditId.length > 0
      && typeof candidate.canaryProfileDraftId === "string"
      && candidate.canaryProfileDraftId.length > 0
      && typeof candidate.appliedAt === "string"
      && Number.isFinite(Date.parse(candidate.appliedAt))
      && Date.parse(candidate.appliedAt) >= Date.parse(request.visualOpenedAt);
    storage.removeItem(key);
    return valid ? candidate as DeveloperGlobalStyleVisualConfirmation : null;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeScalarRecord(value: unknown, maxKeys: number): Record<string, string | number | boolean | null> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > maxKeys) return null;
  const sanitized: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of entries) {
    if (item === null) {
      sanitized[key] = null;
      continue;
    }
    if (typeof item === "number") {
      sanitized[key] = item;
      continue;
    }
    if (typeof item === "boolean") {
      sanitized[key] = item;
      continue;
    }
    if (typeof item === "string" && item.length <= 500) {
      sanitized[key] = item;
      continue;
    }
    return null;
  }
  return sanitized;
}

function sanitizeAppearance(value: unknown): DeveloperGlobalStyleCanaryAppearance | null {
  if (!isRecord(value) || !isRecord(value.frameInsets) || !isRecord(value.sharedStylePatch)) return null;
  const layoutStyle = sanitizeScalarRecord(value.sharedStylePatch.layoutStyle, 128);
  const globalTypography = sanitizeScalarRecord(value.sharedStylePatch.globalTypography, 16);
  if (!layoutStyle || !globalTypography) return null;
  const normalized = normalizeVisualCardLayout({
    ...createDefaultVisualCardLayout(),
    frameInsets: value.frameInsets,
    componentStyles: value.componentStyles,
  });
  return {
    frameInsets: normalized.frameInsets,
    componentStyles: normalized.componentStyles || {},
    sharedStylePatch: {
      layoutStyle: layoutStyle as VisualCardSharedStyleApplyPatch["layoutStyle"],
      globalTypography: globalTypography as VisualCardSharedStyleApplyPatch["globalTypography"],
    },
  };
}

export function createDeveloperGlobalStyleCanaryAppearance(
  config: VisualCardLayoutConfig,
  sharedStylePatch: VisualCardSharedStyleApplyPatch,
): DeveloperGlobalStyleCanaryAppearance {
  const appearance = sanitizeAppearance({
    frameInsets: config.frameInsets,
    componentStyles: config.componentStyles || {},
    sharedStylePatch,
  });
  if (!appearance) throw new Error("Canary appearance contains unsupported values");
  return appearance;
}

function buildDeveloperGlobalFrameVisualDraftKey(workspaceScope: string, draftId: string) {
  return `${GLOBAL_FRAME_VISUAL_DRAFT_PREFIX}:${encodeURIComponent(workspaceScope)}:${encodeURIComponent(draftId)}`;
}

export function writeDeveloperGlobalFrameVisualDraft(
  storage: SessionStorageLike,
  draft: Omit<DeveloperGlobalFrameVisualDraft, "schemaVersion" | "contractVersion" | "mode" | "applicationScope" | "search"> & { search: string },
) {
  const appearance = sanitizeAppearance(draft.appearance);
  const savedAt = Date.parse(draft.savedAt);
  if (!SAFE_GLOBAL_FRAME_DRAFT_ID.test(draft.id)
    || draft.visualAuditId !== draft.id
    || !SAFE_GLOBAL_FRAME_DRAFT_ID.test(draft.recoveryPointId)
    || !draft.workspaceScope.trim()
    || !draft.pathname.startsWith("/")
    || !appearance
    || !Number.isFinite(savedAt)) return false;
  const normalized: DeveloperGlobalFrameVisualDraft = {
    ...draft,
    schemaVersion: 1,
    contractVersion: DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION,
    mode: "global-frame-visual-draft",
    applicationScope: "global",
    search: normalizeSearch(draft.search),
    appearance,
  };
  const serialized = JSON.stringify(normalized);
  if (serialized.length > GLOBAL_FRAME_VISUAL_DRAFT_MAX_BYTES) return false;
  try {
    storage.setItem(buildDeveloperGlobalFrameVisualDraftKey(normalized.workspaceScope, normalized.id), serialized);
    return true;
  } catch {
    return false;
  }
}

export function readDeveloperGlobalFrameVisualDraft(
  storage: SessionStorageLike,
  request: { workspaceScope: string; pathname: string; search: string; draftId: string },
  now = Date.now(),
): DeveloperGlobalFrameVisualDraft | null {
  if (!SAFE_GLOBAL_FRAME_DRAFT_ID.test(request.draftId) || !Number.isFinite(now)) return null;
  const key = buildDeveloperGlobalFrameVisualDraftKey(request.workspaceScope, request.draftId);
  const raw = storage.getItem(key);
  if (!raw || raw.length > GLOBAL_FRAME_VISUAL_DRAFT_MAX_BYTES) return null;
  try {
    const candidate = JSON.parse(raw) as Partial<DeveloperGlobalFrameVisualDraft>;
    const appearance = sanitizeAppearance(candidate.appearance);
    const savedAt = typeof candidate.savedAt === "string" ? Date.parse(candidate.savedAt) : Number.NaN;
    if (candidate.schemaVersion !== 1
      || candidate.contractVersion !== DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION
      || candidate.mode !== "global-frame-visual-draft"
      || candidate.applicationScope !== "global"
      || candidate.id !== request.draftId
      || candidate.visualAuditId !== request.draftId
      || candidate.workspaceScope !== request.workspaceScope
      || candidate.pathname !== request.pathname
      || candidate.search !== normalizeSearch(request.search)
      || typeof candidate.recoveryPointId !== "string"
      || !SAFE_GLOBAL_FRAME_DRAFT_ID.test(candidate.recoveryPointId)
      || !appearance
      || !Number.isFinite(savedAt)
      || savedAt > now + GLOBAL_FRAME_VISUAL_DRAFT_FUTURE_SKEW_MS
      || now - savedAt > GLOBAL_FRAME_VISUAL_DRAFT_MAX_AGE_MS) return null;
    return { ...(candidate as DeveloperGlobalFrameVisualDraft), appearance };
  } catch {
    return null;
  }
}

export function writeDeveloperGlobalStyleCanaryProfileDraft(
  storage: SessionStorageLike,
  draft: Omit<DeveloperGlobalStyleCanaryProfileDraft, "contractVersion" | "search"> & { search: string },
) {
  const appearance = sanitizeAppearance(draft.appearance);
  const developerMarkerProof = validateMarketingPlaybookDeveloperMarkerProof(draft.developerMarkerProof, {
    workspaceScope: draft.workspaceScope,
    canaryProfileDraftId: draft.id,
    visualAuditId: draft.visualAuditId,
    sourcePathname: draft.pathname,
    sourceSearch: draft.search,
    savedAt: draft.savedAt,
  });
  if (draft.mode !== "canary-profile"
    || !draft.id
    || !draft.workspaceScope
    || !draft.visualAuditId
    || !draft.recoveryPointId
    || !appearance
    || !developerMarkerProof
    || !Number.isFinite(Date.parse(draft.savedAt))) return false;
  const normalized: DeveloperGlobalStyleCanaryProfileDraft = {
    ...draft,
    contractVersion: DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION,
    search: normalizeSearch(draft.search),
    appearance,
    developerMarkerProof,
  };
  const serialized = JSON.stringify(normalized);
  if (serialized.length > 100_000) return false;
  try {
    storage.setItem(buildDeveloperGlobalStyleCanaryProfileDraftKey(normalized.workspaceScope, normalized.id), serialized);
    return true;
  } catch {
    return false;
  }
}

export function readDeveloperGlobalStyleCanaryProfileDraft(
  storage: SessionStorageLike,
  request: { workspaceScope: string; draftId: string; visualAuditId: string },
): DeveloperGlobalStyleCanaryProfileDraft | null {
  const key = buildDeveloperGlobalStyleCanaryProfileDraftKey(request.workspaceScope, request.draftId);
  const raw = storage.getItem(key);
  if (!raw || raw.length > 100_000) return null;
  try {
    const candidate = JSON.parse(raw) as Partial<DeveloperGlobalStyleCanaryProfileDraft>;
    const appearance = sanitizeAppearance(candidate.appearance);
    const developerMarkerProof = validateMarketingPlaybookDeveloperMarkerProof(candidate.developerMarkerProof, {
      workspaceScope: request.workspaceScope,
      canaryProfileDraftId: request.draftId,
      visualAuditId: request.visualAuditId,
      sourcePathname: typeof candidate.pathname === "string" ? candidate.pathname : "",
      sourceSearch: typeof candidate.search === "string" ? candidate.search : "",
      savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : undefined,
    });
    const valid = candidate.contractVersion === DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION
      && candidate.mode === "canary-profile"
      && candidate.id === request.draftId
      && candidate.workspaceScope === request.workspaceScope
      && candidate.visualAuditId === request.visualAuditId
      && typeof candidate.pathname === "string"
      && typeof candidate.search === "string"
      && typeof candidate.visualAuditId === "string"
      && candidate.visualAuditId.length > 0
      && typeof candidate.recoveryPointId === "string"
      && candidate.recoveryPointId.length > 0
      && typeof candidate.baselineOnly === "boolean"
      && typeof candidate.savedAt === "string"
      && Number.isFinite(Date.parse(candidate.savedAt))
      && Date.now() - Date.parse(candidate.savedAt) <= 4 * 60 * 60 * 1000
      && Boolean(appearance)
      && Boolean(developerMarkerProof);
    if (!valid) {
      storage.removeItem(key);
      return null;
    }
    return { ...candidate, appearance, developerMarkerProof } as DeveloperGlobalStyleCanaryProfileDraft;
  } catch {
    storage.removeItem(key);
    return null;
  }
}
