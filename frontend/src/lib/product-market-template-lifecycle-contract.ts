import type { ExportableConfig } from "@/lib/product-market-store";

export const PRODUCT_MARKET_TEMPLATE_LIFECYCLE_CONTRACT_VERSION = "2026-08-27.1";

/**
 * A successful save is authoritative only after the normalized local and
 * remote snapshot has been read back. The editor must then replace both its
 * live draft and exit baseline with that verified snapshot, so navigation is
 * blocked exclusively by edits made after the successful save.
 */
export const PRODUCT_MARKET_VERIFIED_DRAFT_BASELINE_CONTRACT = Object.freeze({
  version: PRODUCT_MARKET_TEMPLATE_LIFECYCLE_CONTRACT_VERSION,
  saveBaseline: "verified-normalized-readback",
  liveHydration: "replace-live-store-from-verified-snapshot",
  canonicalHydration: "import-then-export-editor-shape",
  draftHydration: "replace-editor-draft-from-canonical-hydrated-snapshot",
  transportMetadata: "preserved-in-draft-signature",
  optionalTextNormalization: "empty-to-undefined-before-signature",
  draftIsolation: "preserve-user-edited-products-during-live-refresh",
  remoteCommit: "single-awaited-write-after-local-stage",
  passiveSourcePersistence: "transient-store-only-until-awaited-save-readback",
  sourceMountHydration: "local-first-paint>reset-plan-baseline>remote-verified-refresh>sync-editor-draft>timeout-to-local>protect-live-edits",
  shellSaveCompletion: "await-readback-before-dialog-close",
  baselineMutation: "clean-product-live-refresh-only",
  exitComparison: "verified-canonical-signature",
  exitPrompt: "only-unpersisted-differences",
});

export type ProductMarketLifecycleRole = "factory" | "source" | "runtime";
export type ProductMarketRestoreTarget = "all" | "modules" | "layout" | "service";

export const PRODUCT_MARKET_TEMPLATE_LIFECYCLE = Object.freeze({
  factory: Object.freeze({
    label: "工厂默认",
    writable: false,
    promotion: "verified-published-version-after-completed-all-client-plan-rollout",
    description: "不能直接编辑；客户源四区草稿发布为不可变版本且全部客户端计划下发成功后，才提升为新的工厂默认。",
  }),
  source: Object.freeze({
    label: "源体草稿",
    restoreFrom: "factory",
    saveTo: "source-draft",
    publishTo: "source-published",
    description: "保存只更新源体草稿；客户源发布新版会自动安全下发全部客户端计划，全部成功后才推进工厂默认。",
  }),
  runtime: Object.freeze({
    label: "运行端快照",
    restoreFrom: "source-published",
    saveTo: "runtime-snapshot",
    protectedData: "客户已添加、已填写、已编制的业务内容与素材",
    description: "自动发布、恢复和同步只读取已发布源体，并保护运行端业务内容、上传素材、新增内容与下游覆盖。",
  }),
  unsaved: Object.freeze({
    exitChoices: ["保存并退出", "放弃修改", "继续编辑"],
    verifyAfterSave: true,
    saveBaseline: PRODUCT_MARKET_VERIFIED_DRAFT_BASELINE_CONTRACT.saveBaseline,
    exitPrompt: PRODUCT_MARKET_VERIFIED_DRAFT_BASELINE_CONTRACT.exitPrompt,
    description: "离开前展示差异；保存必须完成本地与服务端回读校验。",
  }),
  release: Object.freeze({
    coveredAreas: ["运营市场", "栏目配置", "版面风格", "客服音效"],
    order: ["保存并回读草稿", "发布并回读不可变版本", "自动下发全部客户端计划", "全量成功后提升工厂默认"],
    targetSelection: "all-eligible-client-plans",
    terminalSuccess: "completed-and-all-targets-succeeded",
    partialFailure: "keep-previous-factory-default-and-retry-failed-targets",
  }),
});

export function resolveProductMarketLifecycleRole(
  scope: "hq" | "agency_source" | "client_source" | "agency" | "client",
  runtimePlanPage: boolean,
): Exclude<ProductMarketLifecycleRole, "factory"> {
  if (runtimePlanPage || scope === "agency" || scope === "client") return "runtime";
  return "source";
}

export function getProductMarketRestoreCopy(
  role: Exclude<ProductMarketLifecycleRole, "factory">,
  target: ProductMarketRestoreTarget,
) {
  const targetLabel = target === "modules"
    ? "栏目"
    : target === "layout"
      ? "版面"
      : target === "service"
        ? "客音"
        : "全部设置";
  const baselineLabel = role === "runtime" ? "已发布源体" : "工厂设置";
  return {
    label: target === "all" ? `恢复${baselineLabel}` : `恢复${baselineLabel}${targetLabel}`,
    targetLabel,
    baselineLabel,
    description: role === "runtime"
      ? `将${targetLabel}恢复到已发布源体；保留客户已添加、已填写、已编制的业务内容与素材。`
      : `将${targetLabel}恢复到最近一次全计划发布成功的工厂默认；恢复结果需再次保存为草稿，并在新版全量下发成功后才推进工厂默认。`,
  };
}

const CHANGE_GROUPS = [
  {
    key: "modules",
    label: "栏目与运营市场",
    fields: ["products", "customDefaultPaths", "productOrder", "customProducts", "moduleCategoryOrder", "moduleCategoryAssignments", "moduleCategoryStyles"],
  },
  {
    key: "layout",
    label: "版面与可视化共享契约",
    fields: ["layoutStyle", "visualCardLayout", "layoutSections", "activeTheme", "customThemes", "builtinThemeOverrides", "sidebarStyle", "globalFontFamily", "globalFontWeight", "globalLetterSpacing"],
  },
  {
    key: "service",
    label: "客服与音效",
    fields: ["soundEnabled", "soundVolume", "soundStyle", "csAvatarId", "csEnabled", "csVoiceEnabled", "csVoiceGender", "csVoiceRate", "customerServiceSections", "csAvatarOverrides"],
  },
] as const;

function stableValue(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// Draft baselines are immutable snapshots: ProductMarket replaces the whole
// snapshot after open, save, restore or publish. Cache only the baseline side
// by object identity so a live draft still receives an exact fresh signature
// on every relevant edit, while the same 37 baseline fields are not serialized
// again for each keystroke or save confirmation.
const immutableBaselineFieldSignatures = new WeakMap<ExportableConfig, Map<string, string | undefined>>();

function baselineFieldSignature(config: ExportableConfig, field: string) {
  let signatures = immutableBaselineFieldSignatures.get(config);
  if (!signatures) {
    signatures = new Map<string, string | undefined>();
    immutableBaselineFieldSignatures.set(config, signatures);
  }
  if (signatures.has(field)) return signatures.get(field);
  const signature = stableValue(config[field as keyof ExportableConfig]);
  signatures.set(field, signature);
  return signature;
}

export type ProductMarketChangeSummary = {
  changed: boolean;
  groups: Array<{ key: string; label: string; fields: string[] }>;
  labels: string[];
};

export function summarizeProductMarketConfigChanges(
  before: ExportableConfig | null | undefined,
  after: ExportableConfig | null | undefined,
): ProductMarketChangeSummary {
  if (!before || !after) return { changed: Boolean(before || after), groups: [], labels: [] };
  const groups = CHANGE_GROUPS.flatMap((group) => {
    const fields = group.fields.filter((field) => (
      baselineFieldSignature(before, field) !== stableValue(after[field as keyof ExportableConfig])
    ));
    return fields.length ? [{ key: group.key, label: group.label, fields: [...fields] }] : [];
  });
  const coveredFields = new Set(CHANGE_GROUPS.flatMap((group) => [...group.fields]));
  const otherFields = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    .filter((field) => !coveredFields.has(field as never))
    .filter((field) => baselineFieldSignature(before, field) !== stableValue(after[field as keyof ExportableConfig]));
  if (otherFields.length) groups.push({ key: "other", label: "其他模板设置", fields: otherFields });
  return { changed: groups.length > 0, groups, labels: groups.map((group) => group.label) };
}
