import { isKnownContentPluginId, type KnownContentPluginId } from "@/lib/content-plugin-registry";
import { isRouteCompletedPageHardLocked } from "@/lib/page-layout-lock";

export const VISUAL_CARD_LAYOUT_SCHEMA_VERSION = 2 as const;
const LEGACY_VISUAL_CARD_LAYOUT_SCHEMA_VERSION = 1 as const;

export const VISUAL_CARD_REGION_IDS = [
  "total-frame",
  "topbar",
  "workspace",
  "title",
  "table-shell",
  "table-header",
  "content",
  "large-card",
  "small-card",
  "footer",
] as const;

/**
 * The fixed page editor exposes the nine page regions below in one dropdown.
 * `total-frame` remains the single, always-on frame controller and therefore
 * is deliberately not duplicated in the region picker.
 */
export const VISUAL_CARD_EDITABLE_REGION_IDS = [
  "topbar",
  "workspace",
  "title",
  "table-shell",
  "table-header",
  "content",
  "large-card",
  "small-card",
  "footer",
] as const;

/**
 * A visual composition has two independent persistence boundaries.
 *
 * Global regions are source-template chrome and may flow down the approved
 * template chain. Page regions are a route-owned overlay and must never be
 * promoted into a source template merely because both are edited in the same
 * visual window.
 */
export const VISUAL_CARD_GLOBAL_REGION_IDS = [
  "total-frame",
  "topbar",
  "workspace",
  "title",
  "table-shell",
  "footer",
] as const;

export const VISUAL_CARD_PAGE_REGION_IDS = [
  "table-header",
  "content",
  "large-card",
  "small-card",
] as const;

export type VisualCardRegionId = (typeof VISUAL_CARD_REGION_IDS)[number];
export type VisualCardEditableRegionId = (typeof VISUAL_CARD_EDITABLE_REGION_IDS)[number];
export type VisualCardApplicationScope = "global" | "current-page";
/**
 * Editor-only scope used by the global development canary. It reads the same
 * shared-region family as `global`, but the page host must only record an
 * appearance profile and audit; it can never persist the global configuration.
 */
export type VisualCardEditorApplicationScope = VisualCardApplicationScope | "canary-profile";
export type VisualCardPlacement = "flow" | "sticky-start" | "sticky-end";
export type VisualCardLayoutSlot =
  | "root"
  | "frame-topbar"
  | "frame-workspace"
  | "frame-footer"
  | "workspace-title"
  | "workspace-table-shell"
  | "table-shell-header"
  | "table-shell-content"
  | "content-cards";

export type VisualCardRegionContract = {
  id: VisualCardRegionId;
  label: string;
  parentRegionId: VisualCardRegionId | null;
  slot: VisualCardLayoutSlot;
  defaultOrder: number;
  cardinality: { min: number; max: number };
  structureLocked: boolean;
  sortable: boolean;
  collapsible: boolean;
  allowedPlacements: readonly VisualCardPlacement[];
  defaultPlacement: VisualCardPlacement;
  allowedPlugins: readonly KnownContentPluginId[];
  defaultPlugins: readonly KnownContentPluginId[];
};

/** One legal tree and one plugin-compatibility source for every visual editor. */
export const VISUAL_CARD_REGION_CONTRACTS = [
  {
    id: "total-frame", label: "总框架", parentRegionId: null, slot: "root", defaultOrder: 0,
    cardinality: { min: 1, max: 1 }, structureLocked: true, sortable: false, collapsible: false,
    allowedPlacements: ["flow"], defaultPlacement: "flow",
    allowedPlugins: ["responsive", "lock", "version"], defaultPlugins: ["responsive"],
  },
  {
    id: "topbar", label: "顶部", parentRegionId: "total-frame", slot: "frame-topbar", defaultOrder: 0,
    cardinality: { min: 1, max: 1 }, structureLocked: true, sortable: false, collapsible: true,
    allowedPlacements: ["flow", "sticky-start"], defaultPlacement: "flow",
    allowedPlugins: ["search", "help", "status", "actions"], defaultPlugins: [],
  },
  {
    id: "workspace", label: "主体", parentRegionId: "total-frame", slot: "frame-workspace", defaultOrder: 1,
    cardinality: { min: 1, max: 1 }, structureLocked: true, sortable: false, collapsible: true,
    allowedPlacements: ["flow"], defaultPlacement: "flow",
    allowedPlugins: ["responsive", "status", "actions"], defaultPlugins: ["responsive"],
  },
  {
    id: "title", label: "标题", parentRegionId: "workspace", slot: "workspace-title", defaultOrder: 0,
    cardinality: { min: 1, max: 1 }, structureLocked: true, sortable: false, collapsible: true,
    allowedPlacements: ["flow", "sticky-start"], defaultPlacement: "flow",
    allowedPlugins: ["help", "status", "actions", "icon", "close"], defaultPlugins: [],
  },
  {
    id: "table-shell", label: "表内", parentRegionId: "workspace", slot: "workspace-table-shell", defaultOrder: 1,
    cardinality: { min: 1, max: 1 }, structureLocked: true, sortable: false, collapsible: true,
    allowedPlacements: ["flow"], defaultPlacement: "flow",
    allowedPlugins: ["responsive", "status", "lock", "scroll"], defaultPlugins: [],
  },
  {
    id: "table-header", label: "表头", parentRegionId: "table-shell", slot: "table-shell-header", defaultOrder: 0,
    cardinality: { min: 1, max: 1 }, structureLocked: true, sortable: false, collapsible: true,
    allowedPlacements: ["flow", "sticky-start"], defaultPlacement: "flow",
    allowedPlugins: ["search", "filter", "batch", "sort", "actions"], defaultPlugins: [],
  },
  {
    id: "content", label: "内容", parentRegionId: "table-shell", slot: "table-shell-content", defaultOrder: 1,
    cardinality: { min: 1, max: 1 }, structureLocked: true, sortable: false, collapsible: true,
    allowedPlacements: ["flow"], defaultPlacement: "flow",
    allowedPlugins: ["filter", "pagination", "empty", "loading", "drag", "order", "move", "scroll"], defaultPlugins: [],
  },
  {
    id: "large-card", label: "大卡片", parentRegionId: "content", slot: "content-cards", defaultOrder: 0,
    cardinality: { min: 0, max: 100 }, structureLocked: false, sortable: true, collapsible: true,
    allowedPlacements: ["flow", "sticky-start", "sticky-end"], defaultPlacement: "flow",
    allowedPlugins: ["hover", "compact", "drag", "order", "move", "icon", "statusActions", "status", "actions", "loading", "toggle", "pin", "copy", "edit", "delete", "levelBadge"],
    defaultPlugins: [],
  },
  {
    id: "small-card", label: "小卡片", parentRegionId: "content", slot: "content-cards", defaultOrder: 1,
    cardinality: { min: 0, max: 100 }, structureLocked: false, sortable: true, collapsible: true,
    allowedPlacements: ["flow", "sticky-start", "sticky-end"], defaultPlacement: "flow",
    allowedPlugins: ["hover", "compact", "drag", "order", "move", "icon", "statusActions", "status", "actions", "toggle", "pin", "copy", "edit", "delete", "levelBadge"],
    defaultPlugins: [],
  },
  {
    id: "footer", label: "尾栏", parentRegionId: "total-frame", slot: "frame-footer", defaultOrder: 2,
    cardinality: { min: 1, max: 1 }, structureLocked: true, sortable: false, collapsible: false,
    allowedPlacements: ["flow"], defaultPlacement: "flow",
    allowedPlugins: ["save", "sync", "lock", "version", "status", "actions"], defaultPlugins: [],
  },
] as const satisfies readonly VisualCardRegionContract[];

export type VisualCardFrameInsets = { top: number; right: number; bottom: number; left: number };

export type VisualCardComponentPadding = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export type VisualCardComponentStyleOverrides = {
  spacing?: {
    padding?: VisualCardComponentPadding;
    gapPx?: number;
  };
  annotation?: {
    visibility?: "hover" | "always" | "hidden";
    mode?: "inline" | "vertical";
  };
  surface?: {
    backgroundRole?: "surface" | "muted" | "primary" | "secondary" | "transparent";
    textRole?: "default" | "muted" | "on-primary" | "on-secondary";
  };
  typography?: {
    familyRole?: "body" | "heading" | "mono";
    sizePx?: number;
    weight?: 400 | 500 | 600 | 700;
    lineHeight?: number;
    letterSpacingEm?: number;
  };
  border?: {
    style?: "none" | "solid" | "dashed";
    widthPx?: number;
    colorRole?: "default" | "muted" | "primary" | "secondary";
    radiusPx?: number;
    shadow?: "none" | "sm" | "md" | "lg";
  };
};

export type VisualCardComponentStyles = Partial<Record<VisualCardRegionId, VisualCardComponentStyleOverrides>>;

/** Publishable node: intentionally excludes selected and editorCollapsed. */
export type VisualCardLayoutNode = {
  id: string;
  regionId: VisualCardRegionId;
  parentId: string | null;
  slot: VisualCardLayoutSlot;
  order: number;
  collapsed: boolean;
  placement: VisualCardPlacement;
  stylePresetId: string;
  pluginIds: KnownContentPluginId[];
};

/**
 * A presentation-only component added from the visual component library.
 * It deliberately contains no title copy, button callbacks or business data.
 */
export type VisualCardComponentInstance = {
  id: string;
  definitionId: string;
  regionId: VisualCardRegionId;
  applicationScope: VisualCardApplicationScope;
  order: number;
};

/** Layout-only release payload; it cannot carry business records or editor state. */
export type VisualCardLayoutConfig = {
  schemaVersion: typeof VISUAL_CARD_LAYOUT_SCHEMA_VERSION;
  frameInsets: VisualCardFrameInsets;
  nodes: VisualCardLayoutNode[];
  componentInstances?: VisualCardComponentInstance[];
  componentStyles?: VisualCardComponentStyles;
  updatedAt: string;
};

export type VisualCardWorkspaceScope = "hq" | "agency_source" | "client_source" | "agency" | "client";
export type VisualCardLayoutScope = {
  workspaceScope: VisualCardWorkspaceScope;
  pathname: string;
  search?: string;
  agentPath?: string;
  tenantId?: string;
  clientId?: string;
  planId?: string;
  siteId?: string;
};

export const VISUAL_CARD_DIRECT_APPLY_EVENT = "tradepro:visual-card-layout-direct-apply" as const;

/** Synchronous page bridge used by the fixed editor; handlers set `accepted`. */
export type VisualCardDirectApplyDetail = {
  scopeKey: string;
  config: VisualCardLayoutConfig;
  /** Defaults to global for callers written before the two-column editor. */
  applicationScope?: VisualCardEditorApplicationScope;
  /** True when a canary confirms an already-matching baseline with no edits. */
  canaryBaselineOnly?: boolean;
  /** Effective global + current-page composition returned by the page. */
  appliedConfig?: VisualCardLayoutConfig;
  accepted: boolean;
  auditId?: string;
  recoveryPointId?: string;
  error?: string;
};

const DEFAULT_FRAME_INSETS: VisualCardFrameInsets = { top: 12, right: 12, bottom: 60, left: 12 };
/* The first total-frame editor briefly wrote an 8px bottom inset while the
   shared frame contract already reserved 60px. Migrate only that exact old
   default tuple; every other user-authored inset remains untouched. */
const LEGACY_COMPACT_FRAME_INSETS: VisualCardFrameInsets = { top: 12, right: 12, bottom: 8, left: 12 };
const DEFAULT_UPDATED_AT = "1970-01-01T00:00:00.000Z";
const SINGLETON_REGION_IDS = VISUAL_CARD_REGION_CONTRACTS.filter((item) => item.cardinality.max === 1).map((item) => item.id);
const SINGLETON_REGION_ID_SET = new Set<VisualCardRegionId>(SINGLETON_REGION_IDS);
const SAFE_IDENTIFIER = /^[a-zA-Z0-9][a-zA-Z0-9:._-]*$/u;
const ADDABLE_COMPONENT_REGION_IDS = new Set<VisualCardRegionId>(["title", "table-header", "large-card", "small-card"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isVisualCardRegionId(value: unknown): value is VisualCardRegionId {
  return typeof value === "string" && (VISUAL_CARD_REGION_IDS as readonly string[]).includes(value);
}

export function getVisualCardRegionContract(regionId: VisualCardRegionId): VisualCardRegionContract {
  const contract = VISUAL_CARD_REGION_CONTRACTS.find((item) => item.id === regionId);
  if (!contract) throw new Error(`Missing visual-card region contract: ${regionId}`);
  return contract;
}

export const getVisualCardSingletonNodeId = (regionId: VisualCardRegionId) => `visual:${regionId}`;
const parentIdFor = (contract: VisualCardRegionContract) => contract.parentRegionId ? getVisualCardSingletonNodeId(contract.parentRegionId) : null;
const normalizeInset = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(160, Math.round(value))) : fallback;

function normalizeFrameInsets(value: unknown): VisualCardFrameInsets {
  const input = isRecord(value) ? value : {};
  const normalized = {
    top: normalizeInset(input.top, DEFAULT_FRAME_INSETS.top),
    right: normalizeInset(input.right, DEFAULT_FRAME_INSETS.right),
    bottom: normalizeInset(input.bottom, DEFAULT_FRAME_INSETS.bottom),
    left: normalizeInset(input.left, DEFAULT_FRAME_INSETS.left),
  };
  const isLegacyCompactDefault = (Object.keys(LEGACY_COMPACT_FRAME_INSETS) as Array<keyof VisualCardFrameInsets>)
    .every((side) => normalized[side] === LEGACY_COMPACT_FRAME_INSETS[side]);
  return isLegacyCompactDefault ? { ...DEFAULT_FRAME_INSETS } : normalized;
}

const isSupportedVisualCardLayoutSchemaVersion = (value: unknown) =>
  value === LEGACY_VISUAL_CARD_LAYOUT_SCHEMA_VERSION || value === VISUAL_CARD_LAYOUT_SCHEMA_VERSION;

function normalizeOptionalNumber(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const clamped = Math.max(min, Math.min(max, value));
  return Math.round(clamped * 1000) / 1000;
}

function normalizeOptionalEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? value as T
    : undefined;
}

const hasOwnValues = (value: object) => Object.keys(value).length > 0;

function normalizeComponentPadding(value: unknown): VisualCardComponentPadding | undefined {
  if (!isRecord(value)) return undefined;
  const top = normalizeOptionalNumber(value.top, 0, 96);
  const right = normalizeOptionalNumber(value.right, 0, 96);
  const bottom = normalizeOptionalNumber(value.bottom, 0, 96);
  const left = normalizeOptionalNumber(value.left, 0, 96);
  const padding: VisualCardComponentPadding = {
    ...(top !== undefined ? { top } : {}),
    ...(right !== undefined ? { right } : {}),
    ...(bottom !== undefined ? { bottom } : {}),
    ...(left !== undefined ? { left } : {}),
  };
  return hasOwnValues(padding) ? padding : undefined;
}

function normalizeVisualCardComponentStyle(
  regionId: VisualCardRegionId,
  value: unknown,
): VisualCardComponentStyleOverrides | undefined {
  if (!isRecord(value)) return undefined;
  const result: VisualCardComponentStyleOverrides = {};

  if (isRecord(value.spacing)) {
    const padding = normalizeComponentPadding(value.spacing.padding);
    const gapPx = normalizeOptionalNumber(value.spacing.gapPx, 0, 64);
    const spacing: NonNullable<VisualCardComponentStyleOverrides["spacing"]> = {
      ...(padding ? { padding } : {}),
      ...(gapPx !== undefined ? { gapPx } : {}),
    };
    if (hasOwnValues(spacing)) result.spacing = spacing;
  }

  if (regionId !== "total-frame" && isRecord(value.annotation)) {
    const visibility = normalizeOptionalEnum(value.annotation.visibility, ["hover", "always", "hidden"] as const);
    const mode = normalizeOptionalEnum(value.annotation.mode, ["inline", "vertical"] as const);
    const annotation: NonNullable<VisualCardComponentStyleOverrides["annotation"]> = {
      ...(visibility ? { visibility } : {}),
      ...(mode ? { mode } : {}),
    };
    if (hasOwnValues(annotation)) result.annotation = annotation;
  }

  if (isRecord(value.surface)) {
    const backgroundRole = normalizeOptionalEnum(value.surface.backgroundRole, ["surface", "muted", "primary", "secondary", "transparent"] as const);
    const textRole = normalizeOptionalEnum(value.surface.textRole, ["default", "muted", "on-primary", "on-secondary"] as const);
    const surface: NonNullable<VisualCardComponentStyleOverrides["surface"]> = {
      ...(backgroundRole ? { backgroundRole } : {}),
      ...(textRole ? { textRole } : {}),
    };
    if (hasOwnValues(surface)) result.surface = surface;
  }

  if (isRecord(value.typography)) {
    const familyRole = normalizeOptionalEnum(value.typography.familyRole, ["body", "heading", "mono"] as const);
    const sizePx = normalizeOptionalNumber(value.typography.sizePx, 8, 64);
    const weightValue = value.typography.weight;
    const weight = typeof weightValue === "number" && ([400, 500, 600, 700] as const).includes(weightValue as 400 | 500 | 600 | 700)
      ? weightValue as 400 | 500 | 600 | 700
      : undefined;
    const lineHeight = normalizeOptionalNumber(value.typography.lineHeight, 1, 2);
    const letterSpacingEm = normalizeOptionalNumber(value.typography.letterSpacingEm, -0.05, 0.2);
    const typography: NonNullable<VisualCardComponentStyleOverrides["typography"]> = {
      ...(familyRole ? { familyRole } : {}),
      ...(sizePx !== undefined ? { sizePx } : {}),
      ...(weight !== undefined ? { weight } : {}),
      ...(lineHeight !== undefined ? { lineHeight } : {}),
      ...(letterSpacingEm !== undefined ? { letterSpacingEm } : {}),
    };
    if (hasOwnValues(typography)) result.typography = typography;
  }

  if (isRecord(value.border)) {
    const style = normalizeOptionalEnum(value.border.style, ["none", "solid", "dashed"] as const);
    const widthPx = normalizeOptionalNumber(value.border.widthPx, 0, 8);
    const colorRole = normalizeOptionalEnum(value.border.colorRole, ["default", "muted", "primary", "secondary"] as const);
    const radiusPx = normalizeOptionalNumber(value.border.radiusPx, 0, 64);
    const shadow = normalizeOptionalEnum(value.border.shadow, ["none", "sm", "md", "lg"] as const);
    const border: NonNullable<VisualCardComponentStyleOverrides["border"]> = {
      ...(style ? { style } : {}),
      ...(widthPx !== undefined ? { widthPx } : {}),
      ...(colorRole ? { colorRole } : {}),
      ...(radiusPx !== undefined ? { radiusPx } : {}),
      ...(shadow ? { shadow } : {}),
    };
    if (hasOwnValues(border)) result.border = border;
  }

  return hasOwnValues(result) ? result : undefined;
}

function normalizeVisualCardComponentStyles(value: unknown): VisualCardComponentStyles | undefined {
  if (!isRecord(value)) return undefined;
  const result: VisualCardComponentStyles = {};
  for (const regionId of VISUAL_CARD_REGION_IDS) {
    const style = normalizeVisualCardComponentStyle(regionId, value[regionId]);
    if (style) result[regionId] = style;
  }
  return hasOwnValues(result) ? result : undefined;
}

function normalizeStylePresetId(value: unknown) {
  if (typeof value !== "string") return "standard";
  const id = value.trim();
  return id && id.length <= 64 && SAFE_IDENTIFIER.test(id) ? id : "standard";
}

function normalizePlacement(value: unknown, legacyFixed: unknown, contract: VisualCardRegionContract): VisualCardPlacement {
  if (typeof value === "string" && (contract.allowedPlacements as readonly string[]).includes(value)) return value as VisualCardPlacement;
  if (legacyFixed === true) return contract.allowedPlacements.find((item) => item !== "flow") || contract.defaultPlacement;
  return contract.defaultPlacement;
}

function normalizePlugins(value: unknown, contract: VisualCardRegionContract) {
  const input = Array.isArray(value) ? value : contract.defaultPlugins;
  const result: KnownContentPluginId[] = [];
  for (const plugin of input) {
    if (typeof plugin !== "string" || !isKnownContentPluginId(plugin)) continue;
    if (!(contract.allowedPlugins as readonly KnownContentPluginId[]).includes(plugin) || result.includes(plugin)) continue;
    result.push(plugin);
    if (result.length === 32) break;
  }
  return result;
}

function defaultNode(regionId: VisualCardRegionId, suffix = "default"): VisualCardLayoutNode {
  const contract = getVisualCardRegionContract(regionId);
  return {
    id: contract.structureLocked ? getVisualCardSingletonNodeId(regionId) : `visual:${regionId}:${suffix}`,
    regionId,
    parentId: parentIdFor(contract),
    slot: contract.slot,
    order: contract.defaultOrder,
    collapsed: false,
    placement: contract.defaultPlacement,
    stylePresetId: "standard",
    pluginIds: [...contract.defaultPlugins],
  };
}

function defaultConfig(updatedAt = DEFAULT_UPDATED_AT): VisualCardLayoutConfig {
  return {
    schemaVersion: VISUAL_CARD_LAYOUT_SCHEMA_VERSION,
    frameInsets: { ...DEFAULT_FRAME_INSETS },
    nodes: [...SINGLETON_REGION_IDS.map((id) => defaultNode(id)), defaultNode("large-card"), defaultNode("small-card")],
    updatedAt,
  };
}

export const DEFAULT_VISUAL_CARD_LAYOUT_CONFIG = defaultConfig();
export const createDefaultVisualCardLayout = () => defaultConfig(new Date().toISOString());

function normalizeSingleton(raw: unknown, contract: VisualCardRegionContract): VisualCardLayoutNode {
  const input = isRecord(raw) ? raw : {};
  return {
    id: getVisualCardSingletonNodeId(contract.id),
    regionId: contract.id,
    parentId: parentIdFor(contract),
    slot: contract.slot,
    order: contract.defaultOrder,
    collapsed: contract.collapsible && input.collapsed === true,
    placement: normalizePlacement(input.placement, input.fixed, contract),
    stylePresetId: normalizeStylePresetId(input.stylePresetId ?? input.styleId),
    pluginIds: normalizePlugins(input.pluginIds ?? input.plugins, contract),
  };
}

function normalizeCards(rawNodes: readonly unknown[]) {
  const seen = new Set(SINGLETON_REGION_IDS.map(getVisualCardSingletonNodeId));
  const counts = new Map<VisualCardRegionId, number>();
  const cards: Array<{ node: VisualCardLayoutNode; sourceIndex: number; requestedOrder: number }> = [];
  rawNodes.forEach((raw, sourceIndex) => {
    if (!isRecord(raw) || !isVisualCardRegionId(raw.regionId) || SINGLETON_REGION_ID_SET.has(raw.regionId)) return;
    const contract = getVisualCardRegionContract(raw.regionId);
    const count = counts.get(contract.id) || 0;
    if (!contract.sortable || count >= contract.cardinality.max || cards.length >= 200) return;
    counts.set(contract.id, count + 1);
    const requestedId = typeof raw.id === "string" ? raw.id : typeof raw.instanceId === "string" ? raw.instanceId : "";
    let id = requestedId.trim();
    if (!id || id.length > 128 || !SAFE_IDENTIFIER.test(id) || seen.has(id)) {
      const base = `visual:${contract.id}:${sourceIndex + 1}`;
      id = base;
      let suffix = 2;
      while (seen.has(id)) id = `${base}-${suffix++}`;
    }
    seen.add(id);
    cards.push({
      sourceIndex,
      requestedOrder: typeof raw.order === "number" && Number.isFinite(raw.order) ? Math.max(0, Math.round(raw.order)) : sourceIndex,
      node: {
        id,
        regionId: contract.id,
        parentId: parentIdFor(contract),
        slot: contract.slot,
        order: 0,
        collapsed: raw.collapsed === true,
        placement: normalizePlacement(raw.placement, raw.fixed, contract),
        stylePresetId: normalizeStylePresetId(raw.stylePresetId ?? raw.styleId),
        pluginIds: normalizePlugins(raw.pluginIds ?? raw.plugins, contract),
      },
    });
  });
  return cards.sort((a, b) => a.requestedOrder - b.requestedOrder || a.sourceIndex - b.sourceIndex).map(({ node }, order) => ({ ...node, order }));
}

function normalizeComponentInstances(value: unknown): VisualCardComponentInstance[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const instances: VisualCardComponentInstance[] = [];
  for (const raw of value) {
    if (!isRecord(raw)
      || typeof raw.id !== "string"
      || typeof raw.definitionId !== "string"
      || !isVisualCardRegionId(raw.regionId)
      || !ADDABLE_COMPONENT_REGION_IDS.has(raw.regionId)) continue;
    const id = raw.id.trim();
    const definitionId = raw.definitionId.trim();
    if (!id || id.length > 128 || !SAFE_IDENTIFIER.test(id) || seen.has(id)
      || !definitionId || definitionId.length > 64 || !SAFE_IDENTIFIER.test(definitionId)) continue;
    seen.add(id);
    instances.push({
      id,
      definitionId,
      regionId: raw.regionId,
      applicationScope: raw.applicationScope === "global" ? "global" : "current-page",
      order: typeof raw.order === "number" && Number.isFinite(raw.order)
        ? Math.max(0, Math.min(99, Math.round(raw.order)))
        : instances.length,
    });
    if (instances.length === 40) break;
  }
  return instances
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map((instance, order) => ({ ...instance, order }));
}

/**
 * Projects unknown and legacy input onto the strict publication schema.
 * Invalid parents/slots, duplicate singletons/ids, incompatible plugins and
 * editor-only fields are discarded.
 */
export function normalizeVisualCardLayout(value: unknown): VisualCardLayoutConfig {
  if (!isRecord(value) || !isSupportedVisualCardLayoutSchemaVersion(value.schemaVersion)) return createDefaultVisualCardLayout();
  const rawNodes = Array.isArray(value.nodes) ? value.nodes : Array.isArray(value.cards) ? value.cards : [];
  const singletonInputs = new Map<VisualCardRegionId, unknown>();
  rawNodes.forEach((raw) => {
    if (!isRecord(raw) || !isVisualCardRegionId(raw.regionId) || !SINGLETON_REGION_ID_SET.has(raw.regionId) || singletonInputs.has(raw.regionId)) return;
    singletonInputs.set(raw.regionId, raw);
  });
  const updatedAt = typeof value.updatedAt === "string" && Number.isFinite(Date.parse(value.updatedAt))
    ? new Date(value.updatedAt).toISOString()
    : new Date().toISOString();
  const componentStyles = normalizeVisualCardComponentStyles(value.componentStyles);
  const componentInstances = normalizeComponentInstances(value.componentInstances);
  return {
    schemaVersion: VISUAL_CARD_LAYOUT_SCHEMA_VERSION,
    frameInsets: normalizeFrameInsets(value.frameInsets),
    nodes: [
      ...SINGLETON_REGION_IDS.map((id) => normalizeSingleton(singletonInputs.get(id), getVisualCardRegionContract(id))),
      ...normalizeCards(rawNodes),
    ],
    ...(componentInstances.length ? { componentInstances } : {}),
    ...(componentStyles ? { componentStyles } : {}),
    updatedAt,
  };
}

export function cloneVisualCardLayout(value: unknown): VisualCardLayoutConfig {
  return normalizeVisualCardLayout(value);
}

const VISUAL_CARD_GLOBAL_REGION_ID_SET = new Set<VisualCardRegionId>(VISUAL_CARD_GLOBAL_REGION_IDS);
const VISUAL_CARD_PAGE_REGION_ID_SET = new Set<VisualCardRegionId>(VISUAL_CARD_PAGE_REGION_IDS);

/**
 * Replace only the region family authorized by an explicit application
 * action. `frameInsets` belongs to the global frame and is consequently
 * ignored by a current-page apply.
 */
export function mergeVisualCardLayoutForApplicationScope(
  base: unknown,
  incoming: unknown,
  scope: VisualCardEditorApplicationScope,
): VisualCardLayoutConfig {
  const normalizedBase = normalizeVisualCardLayout(base);
  const normalizedIncoming = normalizeVisualCardLayout(incoming);
  const persistedScope: VisualCardApplicationScope = scope === "canary-profile" ? "global" : scope;
  const selectedRegionIds = persistedScope === "global"
    ? VISUAL_CARD_GLOBAL_REGION_ID_SET
    : VISUAL_CARD_PAGE_REGION_ID_SET;
  const nodes = [
    ...normalizedBase.nodes.filter((node) => !selectedRegionIds.has(node.regionId)),
    ...normalizedIncoming.nodes.filter((node) => selectedRegionIds.has(node.regionId)),
  ];
  const componentInstances = [
    ...(normalizedBase.componentInstances || []).filter((instance) => instance.applicationScope !== persistedScope),
    ...(normalizedIncoming.componentInstances || []).filter((instance) => instance.applicationScope === persistedScope),
  ];
  const componentStyles: VisualCardComponentStyles = {};
  for (const regionId of VISUAL_CARD_REGION_IDS) {
    const source = selectedRegionIds.has(regionId) ? normalizedIncoming : normalizedBase;
    const style = source.componentStyles?.[regionId];
    if (style) componentStyles[regionId] = style;
  }
  return normalizeVisualCardLayout({
    schemaVersion: VISUAL_CARD_LAYOUT_SCHEMA_VERSION,
    frameInsets: persistedScope === "global" ? normalizedIncoming.frameInsets : normalizedBase.frameInsets,
    nodes,
    ...(componentInstances.length ? { componentInstances } : {}),
    ...(hasOwnValues(componentStyles) ? { componentStyles } : {}),
    updatedAt: normalizedIncoming.updatedAt,
  });
}

/** Compose a publishable global frame with one route-owned page overlay. */
export function composeVisualCardLayout(
  globalConfig: unknown,
  pageOverride?: unknown,
): VisualCardLayoutConfig {
  const normalizedGlobal = normalizeVisualCardLayout(globalConfig);
  return pageOverride == null
    ? normalizedGlobal
    : mergeVisualCardLayoutForApplicationScope(normalizedGlobal, pageOverride, "current-page");
}

export const normalizeVisualCardLayoutConfig = normalizeVisualCardLayout;
export const cloneVisualCardLayoutConfig = cloneVisualCardLayout;

const TRANSIENT_QUERY_KEYS = ["developmentApply", "developmentDraft", "visualCardLayout", "projectPageName", "verify"] as const;
const cleanValue = (value: unknown, max = 256) => typeof value === "string" ? value.trim().slice(0, max) : "";

export function resolveVisualCardWorkspaceScope(pathname: string): VisualCardWorkspaceScope {
  if (pathname.startsWith("/zb/agency-source")) return "agency_source";
  if (pathname.startsWith("/zb/client-source")) return "client_source";
  if (pathname.startsWith("/zb")) return "hq";
  if (pathname.startsWith("/dl")) return "agency";
  return "client";
}

function scopeSearch(search = "") {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  TRANSIENT_QUERY_KEYS.forEach((key) => params.delete(key));
  params.sort();
  return params.toString();
}

function queryIdentity(params: URLSearchParams, names: readonly string[]) {
  for (const name of names) {
    const value = cleanValue(params.get(name));
    if (value) return value;
  }
  return "";
}

/** Tenant-chain identity is part of every editor and handoff storage boundary. */
export function buildVisualCardLayoutScopeKey(scope: VisualCardLayoutScope) {
  const pathname = cleanValue(scope.pathname, 512) || "/";
  const search = scopeSearch(scope.search);
  const params = new URLSearchParams(search);
  const values: Array<[string, string]> = [
    ["workspace", scope.workspaceScope || resolveVisualCardWorkspaceScope(pathname)],
    ["path", pathname],
    ["search", search],
    ["agentPath", cleanValue(scope.agentPath) || queryIdentity(params, ["agentPath", "agent_path"]) || "-"],
    ["tenant", cleanValue(scope.tenantId) || queryIdentity(params, ["tenantId", "tenant_id", "tenant"]) || "-"],
    ["client", cleanValue(scope.clientId) || queryIdentity(params, ["clientId", "client_id", "client"]) || "-"],
    ["plan", cleanValue(scope.planId) || queryIdentity(params, ["planId", "plan_id", "plan"]) || "-"],
    ["site", cleanValue(scope.siteId) || queryIdentity(params, ["siteId", "site_id"]) || "-"],
  ];
  return values.map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("&");
}

const EDITOR_PREFIX = "tradepro.visual-card-layout.editor.v1:";
const PAGE_OVERRIDE_PREFIX = "tradepro.visual-card-layout.page-override.v1:";
const HANDOFF_PREFIX = "tradepro.visual-card-layout.handoff.v1:";
const HANDOFF_TTL_MS = 30 * 60 * 1000;

export const buildVisualCardEditorStorageKey = (scope: VisualCardLayoutScope) => `${EDITOR_PREFIX}${encodeURIComponent(buildVisualCardLayoutScopeKey(scope))}`;
const buildVisualCardPageOverrideStorageKey = (scope: VisualCardLayoutScope) => `${PAGE_OVERRIDE_PREFIX}${encodeURIComponent(buildVisualCardLayoutScopeKey(scope))}`;

function safeStorage(kind: "local" | "session") {
  if (typeof window === "undefined") return null;
  try { return kind === "local" ? window.localStorage : window.sessionStorage; } catch { return null; }
}

function isSupportedVisualCardLayoutPayload(value: unknown) {
  return isRecord(value)
    && isSupportedVisualCardLayoutSchemaVersion(value.schemaVersion)
    && (Array.isArray(value.nodes) || Array.isArray(value.cards));
}

export function writeVisualCardEditorLayout(scope: VisualCardLayoutScope, value: unknown) {
  if (isRouteCompletedPageHardLocked(scope.pathname, scope.search)) return false;
  const storage = safeStorage("local");
  if (!storage) return false;
  try { storage.setItem(buildVisualCardEditorStorageKey(scope), JSON.stringify(normalizeVisualCardLayout(value))); return true; } catch { return false; }
}

export function readVisualCardEditorLayout(scope: VisualCardLayoutScope) {
  const storage = safeStorage("local");
  if (!storage) return null;
  try {
    const value = JSON.parse(storage.getItem(buildVisualCardEditorStorageKey(scope)) || "null") as unknown;
    return isSupportedVisualCardLayoutPayload(value)
      ? normalizeVisualCardLayout(value)
      : null;
  } catch { return null; }
}

export function deleteVisualCardEditorLayout(scope: VisualCardLayoutScope) {
  const storage = safeStorage("local");
  if (!storage) return false;
  try { storage.removeItem(buildVisualCardEditorStorageKey(scope)); return true; } catch { return false; }
}

type StoredVisualCardPageOverride = {
  /** Storage wrapper stays v1; its nested config is migrated independently. */
  schemaVersion: 1;
  scopeKey: string;
  config: VisualCardLayoutConfig;
};

/**
 * Persist only a route-owned projection. The enclosing scope key contains the
 * workspace, path, query identity and tenant chain, so one page cannot leak a
 * card/content plan into a sibling route or tenant.
 */
export function writeVisualCardPageOverride(scope: VisualCardLayoutScope, value: unknown) {
  if (isRouteCompletedPageHardLocked(scope.pathname, scope.search)) return false;
  const storage = safeStorage("local");
  if (!storage) return false;
  const scopeKey = buildVisualCardLayoutScopeKey(scope);
  const config = mergeVisualCardLayoutForApplicationScope(
    createDefaultVisualCardLayout(),
    value,
    "current-page",
  );
  const record: StoredVisualCardPageOverride = {
    schemaVersion: 1,
    scopeKey,
    config,
  };
  try {
    storage.setItem(buildVisualCardPageOverrideStorageKey(scope), JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function readVisualCardPageOverride(scope: VisualCardLayoutScope) {
  const storage = safeStorage("local");
  if (!storage) return null;
  try {
    const value = JSON.parse(storage.getItem(buildVisualCardPageOverrideStorageKey(scope)) || "null") as unknown;
    const scopeKey = buildVisualCardLayoutScopeKey(scope);
    if (!isRecord(value)
      || (value.schemaVersion !== 1 && value.schemaVersion !== 2)
      || value.scopeKey !== scopeKey
      || !isSupportedVisualCardLayoutPayload(value.config)) {
      return null;
    }
    return mergeVisualCardLayoutForApplicationScope(
      createDefaultVisualCardLayout(),
      value.config,
      "current-page",
    );
  } catch {
    return null;
  }
}

export function deleteVisualCardPageOverride(scope: VisualCardLayoutScope) {
  const storage = safeStorage("local");
  if (!storage) return false;
  try {
    storage.removeItem(buildVisualCardPageOverrideStorageKey(scope));
    return true;
  } catch {
    return false;
  }
}

export type VisualCardLayoutDraftHandoff = {
  schemaVersion: 1;
  id: string;
  scopeKey: string;
  createdAt: string;
  expiresAt: string;
  config: VisualCardLayoutConfig;
};

const safeHandoffId = (value: unknown): value is string => typeof value === "string" && value.length <= 128 && SAFE_IDENTIFIER.test(value);
const handoffKey = (id: string) => `${HANDOFF_PREFIX}${id}`;

function createHandoffId() {
  try { if (typeof globalThis.crypto?.randomUUID === "function") return `visual-${globalThis.crypto.randomUUID()}`; } catch { /* use fallback */ }
  return `visual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Session handoffs expire and can only be read/deleted by the exact tenant scope. */
export function writeVisualCardLayoutDraftHandoff(scope: VisualCardLayoutScope, value: unknown, options: { id?: string; ttlMs?: number } = {}) {
  const storage = safeStorage("session");
  if (!storage) return null;
  const id = safeHandoffId(options.id) ? options.id : createHandoffId();
  const ttl = typeof options.ttlMs === "number" && Number.isFinite(options.ttlMs) ? Math.max(60_000, Math.min(86_400_000, Math.round(options.ttlMs))) : HANDOFF_TTL_MS;
  const now = Date.now();
  const record: VisualCardLayoutDraftHandoff = {
    schemaVersion: 1,
    id,
    scopeKey: buildVisualCardLayoutScopeKey(scope),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttl).toISOString(),
    config: normalizeVisualCardLayout(value),
  };
  try { storage.setItem(handoffKey(id), JSON.stringify(record)); return id; } catch { return null; }
}

export function readVisualCardLayoutDraftHandoff(scope: VisualCardLayoutScope, id: string, options: { consume?: boolean } = {}) {
  if (!safeHandoffId(id)) return null;
  const storage = safeStorage("session");
  if (!storage) return null;
  try {
    const key = handoffKey(id);
    const value = JSON.parse(storage.getItem(key) || "null") as unknown;
    const expectedScope = buildVisualCardLayoutScopeKey(scope);
    if (!isRecord(value) || (value.schemaVersion !== 1 && value.schemaVersion !== 2) || value.id !== id || value.scopeKey !== expectedScope
      || typeof value.expiresAt !== "string" || !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= Date.now()
      || !isSupportedVisualCardLayoutPayload(value.config)) {
      if (isRecord(value) && value.scopeKey === expectedScope) storage.removeItem(key);
      return null;
    }
    const config = normalizeVisualCardLayout(value.config);
    if (options.consume) storage.removeItem(key);
    return config;
  } catch { return null; }
}

export const takeVisualCardLayoutDraftHandoff = (scope: VisualCardLayoutScope, id: string) => readVisualCardLayoutDraftHandoff(scope, id, { consume: true });

export function deleteVisualCardLayoutDraftHandoff(scope: VisualCardLayoutScope, id: string) {
  if (!safeHandoffId(id)) return false;
  const storage = safeStorage("session");
  if (!storage) return false;
  try {
    const key = handoffKey(id);
    const value = JSON.parse(storage.getItem(key) || "null") as unknown;
    if (!isRecord(value) || value.scopeKey !== buildVisualCardLayoutScopeKey(scope)) return false;
    storage.removeItem(key);
    return true;
  } catch { return false; }
}
