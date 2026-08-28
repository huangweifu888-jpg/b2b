import { findPageLayoutContract } from "@/lib/page-layout-contract";

export type LayoutMigrationDiagnostic = {
  route: string;
  status: "registered" | "needs-contract";
  title: string;
  actions: readonly string[];
  protection: string;
};

export type LayoutMigrationPlan = {
  route: string;
  status: "ready" | "needs-contract";
  from: "legacy-page-frame-v0";
  to: "composition-manifest-v1";
  writes: readonly ["fixed-frame-contract-only"];
  excludes: readonly ["business-data", "downstream-custom-data", "downstream-new-data", "uploaded-assets"];
  restore: "remove-local-contract-only" | "source-contract-is-release-owned";
  steps: readonly string[];
};

/** Diagnoses contract readiness without writing a page style or contract; it never writes downstream data. */
export function diagnoseLayoutMigration(route: string): LayoutMigrationDiagnostic {
  const contract = findPageLayoutContract(route);
  if (contract) {
    return {
      route,
      status: "registered",
      title: "已登记页面合同",
      actions: ["读取共享固定框架", "保留表头和内容归属", "按页选择已登记插件"],
      protection: "页面已受合同保护；诊断 never writes 任何业务数据、上传素材或下游自定义。",
    };
  }
  return {
    route,
    status: "needs-contract",
    title: "待登记页面合同",
    actions: ["确认共享固定框架", "定义表头与内容归属", "登记插件位置", "建立基线后再确认迁移"],
    protection: "未登记前保持只读；never writes 全局、页面内容、业务数据或任何下游数据。",
  };
}

/** Prepares a reversible migration without copying old CSS or business state. */
export function buildLayoutMigrationPlan(route: string): LayoutMigrationPlan {
  const contract = findPageLayoutContract(route);
  const sourceOwned = contract?.registrationSource !== "local";
  return {
    route,
    status: contract ? "ready" : "needs-contract",
    from: "legacy-page-frame-v0",
    to: "composition-manifest-v1",
    writes: ["fixed-frame-contract-only"],
    excludes: ["business-data", "downstream-custom-data", "downstream-new-data", "uploaded-assets"],
    restore: sourceOwned ? "source-contract-is-release-owned" : "remove-local-contract-only",
    steps: contract
      ? ["读取已登记固定框架", "保留表头、内容与插件的页面归属", "创建发布前恢复记录后再进入来源端审核"]
      : ["先在新页面向导登记固定框架草案", "完成截图基线与影响地图检查", "通过来源端审核后再创建发布记录"],
  };
}
