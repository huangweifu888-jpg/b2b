import { buildPageCompositionImpactMap } from "@/lib/page-composition-impact-map";
import { buildPageCompositionManifest } from "@/lib/page-composition-manifest";
import {
  fingerprintDeveloperDesignTargetManifest,
  type DeveloperPageDna,
} from "@/lib/developer-design-integration";
import { DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS } from "@/lib/developer-global-frame-adapter-resolution";
import { readRouteErrorDiagnostic } from "@/lib/lazy-module-recovery";
import { inspectSharedVisualParity, type SharedVisualParityIssue } from "@/lib/shared-visual-parity-contract";
import { MEDIA_OPTIMIZATION_CONTRACT } from "@/lib/media-optimization-contract";
import {
  listVisualPageComponentContracts,
  VISUAL_COMPONENT_CONTRACT_INHERITANCE,
} from "@/lib/visual-page-component-library";
import { VISUAL_CARD_REGION_IDS } from "@/lib/visual-card-layout-contract";
import { PAGE_FACTORY_PAGES } from "@/page-factory/page-factory";

export const SHARED_CONTRACT_OPERATING_RULES = [
  {
    id: "local-runtime-readiness",
    label: "本地运行环境",
    detail: "源开发器、可视化和项目页依赖同一套本地服务。访问异常时先确认 3003 前端、8000 API 与 3004 辅助服务均已启动，再判断路由或组件问题。",
    evidence: "源码与部署中心 → 本地运行时 → Start-LocalSandbox.ps1",
  },
  {
    id: "single-editor",
    label: "单一编辑入口",
    detail: "日常样式、组件拖拉、替换和插件开关只在可视化真实页面编辑；源开发器只负责治理。",
    evidence: "可视化真实页面投影",
  },
  {
    id: "component-ownership",
    label: "组件唯一 ID 与归属",
    detail: "组件由共享组件库登记 ID、区域、真实来源和允许插件；新增实例沿用登记契约。",
    evidence: "组件契约登记",
  },
  {
    id: "five-layer-inheritance",
    label: "五层继承可追踪",
    detail: "出厂契约 → 总部共享 → 端模板 → 当前页面 → 单个组件，最窄覆盖优先且可恢复继承。",
    evidence: "继承链解析",
  },
  {
    id: "impact-and-rollback",
    label: "影响范围与可回滚",
    detail: "改动先展示三端影响目标；保存前建立审计恢复点，不直接覆盖下游业务内容。",
    evidence: "影响图与审计恢复",
  },
  {
    id: "real-runtime-preview",
    label: "真实效果预览",
    detail: "预览复用实际页面组件、字体、状态与鼠标交互，不维护模拟副本。",
    evidence: "真实页面区域",
  },
] as const;

export type SharedContractHealthCheck = {
  id: string;
  label: string;
  detail: string;
  status: "passed" | "issue";
  remedy?: {
    summary: string;
    action: "visual-editor" | "development-flow" | "retry-local-runtime";
    actionLabel: string;
  };
};

export type SharedContractHealthReport = {
  checkedAt: string;
  route: string;
  passed: boolean;
  checks: readonly SharedContractHealthCheck[];
  parityIssues: readonly SharedVisualParityIssue[];
  targetCoverage?: SharedContractTargetCoverage;
};

export type SharedContractTargetCoverage = {
  targetManifestFingerprint: string;
  totalTargets: number;
  uniqueTargets: number;
  registeredTargets: number;
  resolvableTargets: number;
  sourceEntryTargets: number;
  issueTargetIds: readonly string[];
  complete: boolean;
};

function inspectMediaOptimizationContract(): SharedContractHealthCheck {
  const lifecycle = MEDIA_OPTIMIZATION_CONTRACT.storageLifecycle;
  const valid = MEDIA_OPTIMIZATION_CONTRACT.ownership === "shared-first"
    && MEDIA_OPTIMIZATION_CONTRACT.policy === "media-upload-and-delivery"
    && lifecycle.originalRetention === "temporary-until-verified"
    && lifecycle.removeOriginalAfterVerification
    && lifecycle.minimumSavingsRatio > 0
    && lifecycle.minimumSavingsRatio < 1
    && lifecycle.deduplicateBy === "sha256"
    && lifecycle.derivativeStorage === "regenerable-cache"
    && MEDIA_OPTIMIZATION_CONTRACT.optimization.image.mode === "automatic-on-upload"
    && MEDIA_OPTIMIZATION_CONTRACT.optimization.structuredMedia.mode === "preserve-structure"
    && MEDIA_OPTIMIZATION_CONTRACT.delivery.avatarFirstPaint.neverEmpty;
  return {
    id: "media-resource-contract",
    label: "媒体资源统一契约",
    detail: valid
      ? `媒体契约 v${MEDIA_OPTIMIZATION_CONTRACT.version} 已统一原件临时保留、WebP 优化、SHA-256 去重、可重建缓存和头像永不留空规则。`
      : "媒体资源生命周期、去重、转换或交付兜底规则不完整。",
    status: valid ? "passed" : "issue",
  };
}

/**
 * This is intentionally separate from the structural health inspection: it
 * checks whether the browser can still reach the local frontend origin. The
 * page itself cannot restart a stopped local process, so the remedy stays
 * explicit and never attempts hidden machine-side changes.
 */
export async function inspectLocalRuntimeReadiness(): Promise<SharedContractHealthCheck> {
  if (typeof window === "undefined") {
    return {
      id: "local-runtime-readiness",
      label: "本地运行环境",
      detail: "当前不在浏览器中，跳过本地服务连通性探测。",
      status: "passed",
    };
  }

  try {
    const response = await fetch(`${window.location.origin}/`, {
      cache: "no-store",
      headers: { "x-shared-contract-health-check": "1" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return {
      id: "local-runtime-readiness",
      label: "本地运行环境",
      detail: "本地前端服务响应正常；可继续检查路由、组件和共享契约。",
      status: "passed",
    };
  } catch {
    return {
      id: "local-runtime-readiness",
      label: "本地运行环境",
      detail: "本地前端服务未响应。请从源码与部署中心运行当前工作区的 local-runtime/Start-LocalSandbox.ps1，确认 3003、8000、3004 均为 OK 后刷新页面。",
      status: "issue",
      remedy: {
        summary: "网页无法自行启动本机服务；完成启动后点击此处重新检查连接。",
        action: "retry-local-runtime",
        actionLabel: "重新检查连接",
      },
    };
  }
}

/**
 * Global scope is a registry/adapter contract audit. It deliberately does not
 * read the currently open route or DOM, because one visible page cannot stand
 * in for every target in the global manifest.
 */
export function inspectGlobalSharedContractHealth(pageDna: DeveloperPageDna): SharedContractHealthReport {
  const targets = pageDna.targetManifest.targets;
  const targetIds = targets.map((target) => target.identityKey);
  const uniqueTargetIds = new Set(targetIds);
  const registryById = new Map(PAGE_FACTORY_PAGES.map((page) => [page.id, page]));
  const resolvablePageIds = new Set(
    DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS.map((registration) => registration.pageFactoryId),
  );
  const registeredTargets = targets.filter((target) => {
    if (!target.pageFactoryId || target.lifecycle === "unregistered") return false;
    const page = registryById.get(target.pageFactoryId);
    return Boolean(page
      && page.sourceScope === target.sourceScope
      && page.route === target.normalizedRoute
      && target.identityKey === `${target.sourceScope}:${target.normalizedRoute}`);
  });
  const resolvableTargets = registeredTargets.filter((target) => (
    Boolean(target.pageFactoryId && resolvablePageIds.has(target.pageFactoryId))
  ));
  const sourceEntryTargets = registeredTargets.filter((target) => {
    const page = target.pageFactoryId ? registryById.get(target.pageFactoryId) : null;
    return Boolean(
      page
      && (target.component || target.entryComponent)
      && (page.component || page.entryComponent)
      && page.component === target.component
      && page.entryComponent === target.entryComponent,
    );
  });
  const registeredIds = new Set(registeredTargets.map((target) => target.identityKey));
  const resolvableIds = new Set(resolvableTargets.map((target) => target.identityKey));
  const sourceEntryIds = new Set(sourceEntryTargets.map((target) => target.identityKey));
  const issueTargetIds = [...new Set(targetIds.filter((identityKey, index) => (
    targetIds.indexOf(identityKey) !== index
    || !registeredIds.has(identityKey)
    || !resolvableIds.has(identityKey)
    || !sourceEntryIds.has(identityKey)
  )))].sort();
  const targetCoverage: SharedContractTargetCoverage = {
    targetManifestFingerprint: fingerprintDeveloperDesignTargetManifest(pageDna.targetManifest),
    totalTargets: targets.length,
    uniqueTargets: uniqueTargetIds.size,
    registeredTargets: registeredTargets.length,
    resolvableTargets: resolvableTargets.length,
    sourceEntryTargets: sourceEntryTargets.length,
    issueTargetIds,
    complete: targets.length > 0
      && uniqueTargetIds.size === targets.length
      && registeredTargets.length === targets.length
      && resolvableTargets.length === targets.length
      && sourceEntryTargets.length === targets.length,
  };
  const componentContracts = listVisualPageComponentContracts(VISUAL_CARD_REGION_IDS);
  const expectedInheritance = VISUAL_COMPONENT_CONTRACT_INHERITANCE.map((layer) => layer.id).join(",");
  const checks: SharedContractHealthCheck[] = [
    inspectMediaOptimizationContract(),
    {
      id: "global-target-manifest",
      label: "全局目标清单",
      detail: targets.length
        ? `已读取 ${targets.length} 个全局登记目标，清单指纹 ${targetCoverage.targetManifestFingerprint.slice(0, 16)}。`
        : "全局目标清单为空。",
      status: targets.length && pageDna.auditScope === "global" && pageDna.targetManifest.scope === "global" ? "passed" : "issue",
    },
    {
      id: "global-target-identity",
      label: "目标身份唯一",
      detail: uniqueTargetIds.size === targets.length
        ? `${uniqueTargetIds.size} 个 (sourceScope, normalizedRoute) 身份均唯一。`
        : `发现 ${targets.length - uniqueTargetIds.size} 个重复目标身份。`,
      status: uniqueTargetIds.size === targets.length ? "passed" : "issue",
    },
    {
      id: "global-target-registration",
      label: "页面工厂登记",
      detail: `${registeredTargets.length}/${targets.length} 个目标与页面工厂登记完全一致。`,
      status: targets.length > 0 && registeredTargets.length === targets.length ? "passed" : "issue",
    },
    {
      id: "global-target-resolution",
      label: "全局框架可解析",
      detail: `${resolvableTargets.length}/${targets.length} 个目标存在受控框架解析登记。`,
      status: targets.length > 0 && resolvableTargets.length === targets.length ? "passed" : "issue",
    },
    {
      id: "global-target-source-entry",
      label: "源码入口完整",
      detail: `${sourceEntryTargets.length}/${targets.length} 个目标拥有 component 或 entryComponent，且与登记一致。`,
      status: targets.length > 0 && sourceEntryTargets.length === targets.length ? "passed" : "issue",
    },
    {
      id: "component-ownership",
      label: "组件唯一 ID 与归属",
      detail: componentContracts.length > 0
        && componentContracts.every((contract) => contract.id && contract.definitionId && contract.regionId && contract.owner === "shared-visual-contract")
        ? `已登记 ${componentContracts.length} 个共享组件契约。`
        : "存在未登记、无 ID 或归属不一致的组件契约。",
      status: componentContracts.length > 0
        && componentContracts.every((contract) => contract.id && contract.definitionId && contract.regionId && contract.owner === "shared-visual-contract")
        ? "passed"
        : "issue",
    },
    {
      id: "five-layer-inheritance",
      label: "五层继承可追踪",
      detail: componentContracts.length > 0
        && componentContracts.every((contract) => contract.inheritance.map((layer) => layer.id).join(",") === expectedInheritance)
        ? "全部共享组件继承链完整。"
        : "至少一个组件缺少完整五层继承链。",
      status: componentContracts.length > 0
        && componentContracts.every((contract) => contract.inheritance.map((layer) => layer.id).join(",") === expectedInheritance)
        ? "passed"
        : "issue",
    },
  ];
  return {
    checkedAt: new Date().toISOString(),
    route: pageDna.identityKey,
    passed: checks.every((check) => check.status === "passed") && targetCoverage.complete,
    checks,
    parityIssues: [],
    targetCoverage,
  };
}

/**
 * Runs in the source developer only. It is deliberately read-only: every
 * result explains the shared-contract boundary but never changes page data,
 * assets, downstream customisations or component order.
 */
export function inspectSharedContractHealth({
  pathname,
  search = "",
  root = typeof document === "undefined" ? undefined : document,
}: {
  pathname: string;
  search?: string;
  root?: ParentNode;
}): SharedContractHealthReport {
  const manifest = buildPageCompositionManifest(pathname, search);
  const componentContracts = listVisualPageComponentContracts(VISUAL_CARD_REGION_IDS);
  const expectedInheritance = VISUAL_COMPONENT_CONTRACT_INHERITANCE.map((layer) => layer.id).join(",");
  const componentRegistryValid = componentContracts.length > 0
    && componentContracts.every((contract) => contract.id && contract.definitionId && contract.regionId && contract.owner === "shared-visual-contract");
  const inheritanceValid = componentContracts.length > 0
    && componentContracts.every((contract) => contract.inheritance.map((layer) => layer.id).join(",") === expectedInheritance);
  const realRuntimeValid = componentContracts.length > 0
    && componentContracts.every((contract) => contract.runtimeSource === "real-page-region" && contract.states.length > 0);
  const impact = buildPageCompositionImpactMap(pathname, search, "global");
  const impactAndRollbackValid = manifest.registration === "registered"
    && manifest.sync.direction === "template-downstream-only"
    && impact.targets.length > 0;
  const parity = root ? inspectSharedVisualParity(root) : { issues: [] as readonly SharedVisualParityIssue[] };
  const routeDiagnostic = readRouteErrorDiagnostic();
  const routeDiagnosticMatches = routeDiagnostic?.target === `${pathname}${search}`;

  const checks: SharedContractHealthCheck[] = [
    inspectMediaOptimizationContract(),
    ...(routeDiagnosticMatches ? [{
      id: "last-route-error",
      label: "最近页面加载异常",
      detail: `已隔离的运行时错误：${routeDiagnostic.message}。请修复未定义引用或对应模块后重试当前页。`,
      status: "issue" as const,
      remedy: {
        summary: "该错误已同步到源开发器；先处理运行时引用错误，再重新执行契约健康检查。",
        action: "development-flow" as const,
        actionLabel: "查看开发流程",
      },
    }] : []),
    {
      id: "single-editor",
      label: "单一编辑入口",
      detail: "源开发器只生成治理草案；真实样式、组件和插件由可视化编辑器承接。",
      status: "passed",
    },
    {
      id: "component-ownership",
      label: "组件唯一 ID 与归属",
      detail: componentRegistryValid
        ? `已登记 ${componentContracts.length} 个共享组件契约，均绑定真实页面区域。`
        : "存在未登记、无 ID 或归属不一致的组件契约。",
      status: componentRegistryValid ? "passed" : "issue",
      remedy: componentRegistryValid ? undefined : {
        summary: "在当前页面的可视化中检查组件标注、归属和实例契约，再保存当前页。",
        action: "visual-editor",
        actionLabel: "打开可视化修复",
      },
    },
    {
      id: "five-layer-inheritance",
      label: "五层继承可追踪",
      detail: inheritanceValid
        ? "出厂契约 → 总部共享 → 端模板 → 当前页面 → 单个组件，继承链完整。"
        : "至少一个组件缺少完整五层继承链。",
      status: inheritanceValid ? "passed" : "issue",
      remedy: inheritanceValid ? undefined : {
        summary: "在可视化中恢复组件继承，避免用当前页面私有样式覆盖五层共享契约。",
        action: "visual-editor",
        actionLabel: "打开可视化修复",
      },
    },
    {
      id: "impact-and-rollback",
      label: "影响范围与可回滚",
      detail: impactAndRollbackValid
        ? `当前草案可映射 ${impact.targets.length} 个影响目标，并沿模板向下发布。`
        : "当前页面尚未完成登记、影响映射或单向发布边界检查。",
      status: impactAndRollbackValid ? "passed" : "issue",
      remedy: impactAndRollbackValid ? undefined : {
        summary: "先在开发流程建立影响草案与恢复点；不满足单向发布边界时不会允许同步准备。",
        action: "development-flow",
        actionLabel: "进入开发流程",
      },
    },
    {
      id: "real-runtime-preview",
      label: "真实效果预览",
      detail: realRuntimeValid
        ? "所有共享组件均声明真实页面区域为运行时来源。"
        : "存在没有真实页面运行时来源或状态集的组件。",
      status: realRuntimeValid ? "passed" : "issue",
      remedy: realRuntimeValid ? undefined : {
        summary: "打开可视化，检查该组件是否直接读取真实页面区域、真实状态和鼠标交互。",
        action: "visual-editor",
        actionLabel: "打开可视化修复",
      },
    },
    ...parity.issues.map((issue) => ({
      id: `parity:${issue.factorId}`,
      label: `页面差异：${issue.label}`,
      detail: issue.detail,
      status: "issue" as const,
      remedy: {
        summary: `在当前真实页面可视化中按“${issue.label}”定位并修复；检查项：${issue.selector}。`,
        action: "visual-editor" as const,
        actionLabel: "定位到可视化修复",
      },
    })),
  ];

  return {
    checkedAt: new Date().toISOString(),
    route: `${pathname}${search}`,
    passed: checks.every((check) => check.status === "passed"),
    checks,
    parityIssues: parity.issues,
  };
}
