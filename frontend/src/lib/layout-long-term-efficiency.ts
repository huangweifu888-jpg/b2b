export type LayoutEfficiencyCheck = {
  id: "new-page" | "validate" | "safe-sync" | "recover";
  label: string;
  evidence: string;
};

/** The final read-only closure: all ongoing layout work must keep these four gates. */
export function buildLayoutLongTermEfficiencyChecks(): readonly LayoutEfficiencyCheck[] {
  return [
    { id: "new-page", label: "新增", evidence: "新增页面先登记页面合同、共享框架、内容归属和插件位置。" },
    { id: "validate", label: "验证", evidence: "进入回归样本队列，执行构建与首页大图可视核验。" },
    { id: "safe-sync", label: "同步", evidence: "先试运行与差异确认；全局只写固定框架，页面内容保持独立。" },
    { id: "recover", label: "恢复", evidence: "应用前记录恢复点，恢复后再次执行核心页回归检查。" },
  ];
}
