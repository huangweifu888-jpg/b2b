import { CONTENT_PLUGIN_DEFINITIONS, type ContentPluginGroup, type KnownContentPluginId } from "@/lib/content-plugin-registry";

export type ContentPluginSurface = "list" | "card" | "table" | "form";

export type NewContentPluginGuide = {
  id: KnownContentPluginId;
  group: ContentPluginGroup;
  previewAnchor: string;
  supports: readonly ContentPluginSurface[];
  requires: readonly string[];
  required: readonly ["registry", "shared-css", "preview-control", "aria-label"];
  protection: "draft-only-until-page-apply";
};

const PLUGIN_SURFACE_BOUNDARIES: Record<ContentPluginGroup, readonly ContentPluginSurface[]> = {
  visual: ["list", "card", "table", "form"],
  actions: ["list", "card", "table"],
  status: ["list", "card", "table", "form"],
};

function requirementsForPlugin(id: KnownContentPluginId): readonly string[] {
  if (id === "drag" || id === "order" || id === "move") return ["可排序记录", "页面排序回调"];
  if (id === "statusActions" || id === "toggle") return ["状态字段", "页面状态回调"];
  if (id === "delete" || id === "pin" || id === "copy" || id === "edit") return ["单条操作回调"];
  return ["页面预览锚点"];
}

/**
 * A read-only registration checklist for future plugins. A plugin is never
 * learned merely by being previewed: it remains a page draft until the user
 * confirms "应用到当前页面内容" and the normal build gates pass.
 */
export function buildNewContentPluginGuide(): readonly NewContentPluginGuide[] {
  return CONTENT_PLUGIN_DEFINITIONS.map(({ id, group }) => ({
    id,
    group,
    previewAnchor: `[data-preview-plugin-control="${id}"]`,
    supports: PLUGIN_SURFACE_BOUNDARIES[group],
    requires: requirementsForPlugin(id),
    required: ["registry", "shared-css", "preview-control", "aria-label"],
    protection: "draft-only-until-page-apply",
  }));
}
