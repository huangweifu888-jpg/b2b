export type LayoutMaintainabilityRule = {
  id: "shared-token" | "page-boundary" | "no-global-content-write" | "selector-scope";
  label: string;
  check: string;
};

/** Source-level guardrails that prevent fixed-frame maintenance rules from leaking into page-owned content. */
export const LAYOUT_MAINTAINABILITY_RULES: readonly LayoutMaintainabilityRule[] = [
  { id: "shared-token", label: "固定框架令牌", check: "顶部、主体、标题、尾栏和滚条必须通过 --tradepro-shared-* 令牌读取。" },
  { id: "page-boundary", label: "页面归属边界", check: "表头、内容、表单与业务数据保持页面归属，不进入全局同步。" },
  { id: "no-global-content-write", label: "禁止内容全局写入", check: "同步全局只保存固定框架令牌，不能写入卡片、列表或插件选择。" },
  { id: "selector-scope", label: "选择器范围", check: "跨页面选择器只用于共享框架；页面特例必须有页面合同和构建校验。" },
];
