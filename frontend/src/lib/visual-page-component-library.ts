import {
  getVisualCardRegionContract,
  type VisualCardApplicationScope,
  type VisualCardComponentInstance,
  type VisualCardRegionId,
  type VisualCardWorkspaceScope,
} from "@/lib/visual-card-layout-contract";

export const VISUAL_COMPONENT_CONTRACT_SCHEMA_VERSION = 1 as const;

export const VISUAL_COMPONENT_CONTRACT_INHERITANCE = [
  { id: "factory", label: "出厂契约", description: "代码内置且可恢复的安全默认值。" },
  { id: "hq", label: "总部共享", description: "总部审核发布的全局共享令牌与结构。" },
  { id: "source", label: "端模板", description: "总部、代理源码或客户端源码当前模板。" },
  { id: "page", label: "当前页面", description: "仅当前路由、租户、计划和站点范围的覆盖。" },
  { id: "instance", label: "单个组件", description: "组件实例的最窄范围展示覆盖。" },
] as const;

export const VISUAL_COMPONENT_RUNTIME_STATES = [
  "default",
  "hover",
  "focus",
  "active",
  "disabled",
  "loading",
  "empty",
] as const;

export type VisualComponentRuntimeState = (typeof VISUAL_COMPONENT_RUNTIME_STATES)[number];
export type VisualComponentInheritanceLayerId = (typeof VISUAL_COMPONENT_CONTRACT_INHERITANCE)[number]["id"];
export type VisualComponentInheritanceStatus = "active" | "inherited" | "available" | "read-only";

export const VISUAL_COMPONENT_INHERITANCE_STATUS_LABELS = {
  active: "当前生效",
  inherited: "向下继承",
  available: "可覆盖",
  "read-only": "只读继承",
} as const satisfies Record<VisualComponentInheritanceStatus, string>;

const VISUAL_COMPONENT_EDITABLE_WORKSPACE_SCOPES = ["hq", "agency_source", "client_source"] as const satisfies readonly VisualCardWorkspaceScope[];
const VISUAL_COMPONENT_RENDER_WORKSPACE_SCOPES = ["hq", "agency_source", "client_source", "agency", "client"] as const satisfies readonly VisualCardWorkspaceScope[];
const VISUAL_COMPONENT_TOKEN_IDS = ["surface", "typography", "spacing", "border", "annotation", "plugin-runtime"] as const;

export const VISUAL_PAGE_COMPONENT_DEFINITIONS = [
  { id: "title-standard", regionId: "title", label: "标题·共享标准", detail: "沿用版面风格与共享契约。", stylePresetId: "standard" },
  { id: "title-accent", regionId: "title", label: "标题·重点横条", detail: "使用主色边界突出页面标题。", stylePresetId: "accent" },
  { id: "title-soft", regionId: "title", label: "标题·柔和卡片", detail: "使用柔和底色与圆角层次。", stylePresetId: "soft" },
  { id: "table-header-standard", regionId: "table-header", label: "表头·共享标准", detail: "沿用共享表头契约。", stylePresetId: "standard" },
  { id: "table-header-contrast", regionId: "table-header", label: "表头·清晰对比", detail: "强化表头边界和文字对比。", stylePresetId: "contrast" },
  { id: "large-card-soft", regionId: "large-card", label: "大卡片·柔和", detail: "适合栏目和分组容器。", stylePresetId: "soft" },
  { id: "large-card-accent", regionId: "large-card", label: "大卡片·强调", detail: "使用主色强调大卡片。", stylePresetId: "accent" },
  { id: "small-card-standard", regionId: "small-card", label: "小卡片·共享标准", detail: "沿用共享卡片契约。", stylePresetId: "standard" },
  { id: "small-card-accent", regionId: "small-card", label: "小卡片·强调", detail: "突出具体模块或记录。", stylePresetId: "accent" },
] as const satisfies readonly {
  id: string;
  regionId: VisualCardRegionId;
  label: string;
  detail: string;
  stylePresetId: "standard" | "accent" | "soft" | "contrast";
}[];

export type VisualPageComponentDefinition = (typeof VISUAL_PAGE_COMPONENT_DEFINITIONS)[number];
export type VisualPageComponentDefinitionId = VisualPageComponentDefinition["id"];

export type VisualPageComponentContract = {
  schemaVersion: typeof VISUAL_COMPONENT_CONTRACT_SCHEMA_VERSION;
  id: string;
  definitionId: VisualPageComponentDefinitionId;
  regionId: VisualCardRegionId;
  label: string;
  annotation: string;
  owner: "shared-visual-contract";
  runtimeSource: "real-page-region";
  editableWorkspaceScopes: typeof VISUAL_COMPONENT_EDITABLE_WORKSPACE_SCOPES;
  renderWorkspaceScopes: typeof VISUAL_COMPONENT_RENDER_WORKSPACE_SCOPES;
  applicationScopes: readonly VisualCardApplicationScope[];
  inheritance: typeof VISUAL_COMPONENT_CONTRACT_INHERITANCE;
  states: readonly VisualComponentRuntimeState[];
  tokenIds: typeof VISUAL_COMPONENT_TOKEN_IDS;
  pluginIds: readonly string[];
};

export type VisualComponentInheritanceResolution = {
  layerId: VisualComponentInheritanceLayerId;
  label: string;
  status: VisualComponentInheritanceStatus;
  editable: boolean;
  source: string;
};

const VISUAL_PAGE_COMPONENT_DEFINITION_MAP = new Map<string, VisualPageComponentDefinition>(
  VISUAL_PAGE_COMPONENT_DEFINITIONS.map((definition) => [definition.id, definition]),
);

function statesForDefinition(definition: VisualPageComponentDefinition): readonly VisualComponentRuntimeState[] {
  const pluginIds = getVisualCardRegionContract(definition.regionId).allowedPlugins;
  return VISUAL_COMPONENT_RUNTIME_STATES.filter((state) => {
    if (state === "loading") return pluginIds.includes("loading");
    if (state === "empty") return pluginIds.includes("empty");
    return true;
  });
}

function buildVisualPageComponentContract(definition: VisualPageComponentDefinition): VisualPageComponentContract {
  const region = getVisualCardRegionContract(definition.regionId);
  return {
    schemaVersion: VISUAL_COMPONENT_CONTRACT_SCHEMA_VERSION,
    id: `visual-component-contract:${definition.id}`,
    definitionId: definition.id,
    regionId: definition.regionId,
    label: definition.label,
    annotation: region.label,
    owner: "shared-visual-contract",
    runtimeSource: "real-page-region",
    editableWorkspaceScopes: VISUAL_COMPONENT_EDITABLE_WORKSPACE_SCOPES,
    renderWorkspaceScopes: VISUAL_COMPONENT_RENDER_WORKSPACE_SCOPES,
    applicationScopes: ["global", "current-page"],
    inheritance: VISUAL_COMPONENT_CONTRACT_INHERITANCE,
    states: statesForDefinition(definition),
    tokenIds: VISUAL_COMPONENT_TOKEN_IDS,
    pluginIds: region.allowedPlugins,
  };
}

export const VISUAL_PAGE_COMPONENT_CONTRACTS = VISUAL_PAGE_COMPONENT_DEFINITIONS.map(buildVisualPageComponentContract);
const VISUAL_PAGE_COMPONENT_CONTRACT_MAP = new Map<string, VisualPageComponentContract>(
  VISUAL_PAGE_COMPONENT_CONTRACTS.map((contract) => [contract.definitionId, contract]),
);

export function getVisualPageComponentDefinition(id: string) {
  return VISUAL_PAGE_COMPONENT_DEFINITION_MAP.get(id);
}

export function listVisualPageComponentDefinitions(regionIds: readonly VisualCardRegionId[]) {
  const allowed = new Set<VisualCardRegionId>(regionIds);
  return VISUAL_PAGE_COMPONENT_DEFINITIONS.filter((definition) => allowed.has(definition.regionId));
}

export function getVisualPageComponentContract(definitionId: string) {
  return VISUAL_PAGE_COMPONENT_CONTRACT_MAP.get(definitionId);
}

export function listVisualPageComponentContracts(regionIds: readonly VisualCardRegionId[]) {
  const allowed = new Set<VisualCardRegionId>(regionIds);
  return VISUAL_PAGE_COMPONENT_CONTRACTS.filter((contract) => allowed.has(contract.regionId));
}

/**
 * Resolves the five documented layers against the actual workspace and stored
 * override state. This is the same boundary used by the editor: source scopes
 * may author, while agency/client runtime scopes can only inherit and inspect.
 */
export function resolveVisualComponentInheritance(
  contract: VisualPageComponentContract,
  context: {
    workspaceScope: VisualCardWorkspaceScope;
    hasGlobalContract: boolean;
    hasPageOverride: boolean;
    hasInstanceOverride: boolean;
  },
): readonly VisualComponentInheritanceResolution[] {
  const sourceEditable = contract.editableWorkspaceScopes.includes(
    context.workspaceScope as (typeof contract.editableWorkspaceScopes)[number],
  );
  const runtimeReadOnly = !sourceEditable;
  const sourceLabel = context.workspaceScope === "hq"
    ? "总部当前模板"
    : context.workspaceScope === "agency_source" || context.workspaceScope === "agency"
      ? "代理来源模板"
      : "客户来源模板";
  return [
    { layerId: "factory", label: "出厂契约", status: "active", editable: false, source: "代码安全默认" },
    {
      layerId: "hq",
      label: "总部共享",
      status: context.workspaceScope === "hq" && context.hasGlobalContract ? "active" : "inherited",
      editable: context.workspaceScope === "hq",
      source: context.hasGlobalContract ? "已登记全局视觉契约" : "继续使用出厂契约",
    },
    {
      layerId: "source",
      label: "端模板",
      status: runtimeReadOnly ? "inherited" : context.hasGlobalContract ? "active" : "available",
      editable: sourceEditable,
      source: sourceLabel,
    },
    {
      layerId: "page",
      label: "当前页面",
      status: context.hasPageOverride ? "active" : runtimeReadOnly ? "read-only" : "available",
      editable: sourceEditable,
      source: context.hasPageOverride ? "当前路由/租户覆盖" : "无覆盖，继续继承端模板",
    },
    {
      layerId: "instance",
      label: "单个组件",
      status: context.hasInstanceOverride ? "active" : runtimeReadOnly ? "read-only" : "available",
      editable: sourceEditable,
      source: context.hasInstanceOverride ? "当前组件实例覆盖" : "无覆盖，继续继承页面",
    },
  ];
}

export function createVisualPageComponentInstance(
  definition: VisualPageComponentDefinition,
  existing: readonly VisualCardComponentInstance[],
  applicationScope: VisualCardApplicationScope,
): VisualCardComponentInstance {
  const idBase = `component:${definition.id}:${Date.now().toString(36)}`;
  let id = idBase;
  let suffix = 2;
  const ids = new Set(existing.map((instance) => instance.id));
  while (ids.has(id)) id = `${idBase}-${suffix++}`;
  const regionCount = existing.filter((instance) => instance.regionId === definition.regionId).length;
  return {
    id,
    definitionId: definition.id,
    regionId: definition.regionId,
    applicationScope,
    order: regionCount,
  };
}
