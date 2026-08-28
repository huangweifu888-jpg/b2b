import { buildPageCompositionManifest, type CompositionWorkspaceScope } from "@/lib/page-composition-manifest";

export type CompositionImpactSurface = "global" | "header" | "content" | "plugins";

export type PageCompositionImpactTarget = {
  label: string;
  scope: "current-source" | "downstream-source" | "runtime" | "plan" | "read-only";
  effect: string;
};

export type PageCompositionImpactMap = {
  route: string;
  sourceScope: CompositionWorkspaceScope;
  surface: CompositionImpactSurface;
  direction: "template-downstream-only";
  targets: readonly PageCompositionImpactTarget[];
  exclusions: readonly ["business-data", "downstream-custom-data", "downstream-new-data", "uploaded-assets"];
  releaseRule: "preview-only-until-a-source-release-is-approved" | "runtime-pages-cannot-publish";
};

const SURFACE_EFFECTS: Record<CompositionImpactSurface, string> = {
  global: "读取统一主题、主体框架、字体、标注、间距与滚条令牌。",
  header: "读取统一表头高度、列说明、粘附滚动和表头边距。",
  content: "只读取已登记的内容布局类型；不改业务行、字段值或排序数据。",
  plugins: "只读取已登记插件能力、尺寸和交互状态；不覆盖页面插件选择。",
};

function targetsForScope(scope: CompositionWorkspaceScope, effect: string): readonly PageCompositionImpactTarget[] {
  switch (scope) {
    case "hq":
      return [
        { label: "总部端当前页", scope: "current-source", effect },
        { label: "代理源待接收模板", scope: "downstream-source", effect: `经发布审核后 ${effect}` },
        { label: "客户源待接收模板", scope: "downstream-source", effect: `经发布审核后 ${effect}` },
      ];
    case "agency_source":
      return [
        { label: "代理源当前页", scope: "current-source", effect },
        { label: "代理端对应页面", scope: "runtime", effect: `经代理源发布后 ${effect}` },
      ];
    case "client_source":
      return [
        { label: "客户源当前页", scope: "current-source", effect },
        { label: "客户源计划模板", scope: "plan", effect: `经客户源发布后 ${effect}` },
        { label: "客户端对应页面", scope: "runtime", effect: `经客户源发布后 ${effect}` },
      ];
    default:
      return [{ label: "当前运行端", scope: "read-only", effect: "运行端只读预览，不能发布或反向写入任何模板。" }];
  }
}

/**
 * A release-preview-only impact map. It makes the downstream scope visible
 * before publication, while explicitly keeping business and downstream data
 * outside the shared composition boundary.
 */
export function buildPageCompositionImpactMap(
  pathname: string,
  search = "",
  surface: CompositionImpactSurface = "global",
): PageCompositionImpactMap {
  const manifest = buildPageCompositionManifest(pathname, search);
  const editableSource = manifest.workspaceScope === "hq"
    || manifest.workspaceScope === "agency_source"
    || manifest.workspaceScope === "client_source";

  return {
    route: manifest.route,
    sourceScope: manifest.workspaceScope,
    surface,
    direction: "template-downstream-only",
    targets: targetsForScope(manifest.workspaceScope, SURFACE_EFFECTS[surface]),
    exclusions: ["business-data", "downstream-custom-data", "downstream-new-data", "uploaded-assets"],
    releaseRule: editableSource ? "preview-only-until-a-source-release-is-approved" : "runtime-pages-cannot-publish",
  };
}
