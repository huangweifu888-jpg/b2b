export type LayoutQualityDashboardInput = {
  completedSteps: number;
  totalSteps: number;
  activePhase: string;
  baselineCount: number;
  pluginCount: number;
  themeName: string;
  hasConfirmedLearning: boolean;
};

export type LayoutQualityDashboardMetric = {
  id: "roadmap" | "pages" | "plugins" | "theme";
  label: string;
  value: string;
  state: "healthy" | "pending";
  detail: string;
};

/** Presents quality signals without modifying the selected theme, page plan, or plugin list. */
export function buildLayoutQualityDashboard(input: LayoutQualityDashboardInput): readonly LayoutQualityDashboardMetric[] {
  return [
    { id: "roadmap", label: "路线阶段", value: `${input.completedSteps}/${input.totalSteps}`, state: input.completedSteps > 0 ? "healthy" : "pending", detail: `当前推进：${input.activePhase}` },
    { id: "pages", label: "页面基线", value: `${input.baselineCount} 页`, state: input.baselineCount >= 6 ? "healthy" : "pending", detail: "只统计已登记的回归页，不覆盖页面内容。" },
    { id: "plugins", label: "插件登记", value: `${input.pluginCount} 项`, state: input.pluginCount > 0 ? "healthy" : "pending", detail: "插件仍由内容设计按页选择与确认应用。" },
    { id: "theme", label: "当前主题", value: input.themeName, state: input.hasConfirmedLearning ? "healthy" : "pending", detail: input.hasConfirmedLearning ? "已存在确认学习记录。" : "尚未确认学习；主题不会被仪表盘自动写入。" },
  ];
}
