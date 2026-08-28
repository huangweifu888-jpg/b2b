import { LAYOUT_FRAME_CONTRACT } from "@/lib/layout-frame-contract";
import { PAGE_LAYOUT_CONTRACTS } from "@/lib/page-layout-contract";
import { CONTENT_PLUGIN_IDS } from "@/lib/content-plugin-registry";

export type LayoutRuleRecommendation = {
  id: "shared-frame" | "page-content" | "plugin-style" | "page-contract";
  owner: "共享变量" | "内容设计" | "插件中心" | "页面合同";
  signal: string;
  action: string;
  protection: string;
};

/**
 * Read-only ownership suggestions.  They are derived from the same contracts
 * used by the build gates and never mutate a page, a template source, or a
 * downstream customization.
 */
export function buildLayoutRuleRecommendations(): readonly LayoutRuleRecommendation[] {
  const sharedCount = LAYOUT_FRAME_CONTRACT.filter((item) => item.owner === "shared").length;
  const pageCount = LAYOUT_FRAME_CONTRACT.filter((item) => item.owner === "page").length;
  return [
    {
      id: "shared-frame",
      owner: "共享变量",
      signal: `发现 ${sharedCount} 个全局框架段使用统一令牌`,
      action: "顶部、主体、标题、滚条、尾栏或框架间距出现重复差异时，优先收敛到共享变量。",
      protection: "不覆盖表头、内容、业务数据或下游自定义。",
    },
    {
      id: "page-content",
      owner: "内容设计",
      signal: `发现 ${pageCount} 个页面归属段需要按当前页组合`,
      action: "表头、列表、卡片或表单排版差异只在内容设计中调整，再用到当页内容。",
      protection: "只保存当前页表现组合，不同步业务记录。",
    },
    {
      id: "plugin-style",
      owner: "插件中心",
      signal: `已登记 ${CONTENT_PLUGIN_IDS.length} 个可复用插件`,
      action: "控件大小、间距、圆角、悬停和提示不一致时，优先修正插件中心的共享 CSS。",
      protection: "是否出现仍由当前页内容组合决定。",
    },
    {
      id: "page-contract",
      owner: "页面合同",
      signal: `已登记 ${PAGE_LAYOUT_CONTRACTS.length} 个页面合同`,
      action: "新页面或未登记页面先补页面合同，再选择共享框架、内容形态和插件位置。",
      protection: "合同只描述结构归属，不写入页面内容。",
    },
  ];
}
