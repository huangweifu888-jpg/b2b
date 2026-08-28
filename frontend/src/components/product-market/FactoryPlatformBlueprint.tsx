import { useMemo } from "react";
import { Download, GitBranch, Layers3, Route, ShieldCheck, Sparkles, Target } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { FactoryExecutionDesk } from "@/components/product-market/FactoryExecutionDesk";
import { FactoryObjectEventContractDesk } from "@/components/product-market/FactoryObjectEventContractDesk";
import { FactoryRevenueGoldenFlowDesk } from "@/components/product-market/FactoryRevenueGoldenFlowDesk";
import { FactoryImplementationCenter } from "@/components/product-market/FactoryImplementationCenter";
import { FactoryMachineryIndustryPackDesk } from "@/components/product-market/FactoryMachineryIndustryPackDesk";
import {
  FACTORY_PLATFORM_CATEGORIES,
  getFactoryPlatformApplication,
  getFactoryPlatformCategory,
  getFactoryPlatformSocialWorkspaceRuntimeSourceScope,
  type FactoryPlatformCategoryKey,
  type FactoryPlatformDeliveryStatus,
  type FactoryPlatformPhaseId,
} from "@/lib/factory-platform-blueprint";
import {
  FACTORY_PLATFORM_BUSINESS_BOUNDARIES,
  FACTORY_PLATFORM_APPLICATION_CONTRACT_FIELDS,
  FACTORY_PLATFORM_COMMERCIAL_PACKAGES,
  FACTORY_PLATFORM_CONTINUOUS_DEVELOPMENT_SEQUENCE,
  FACTORY_PLATFORM_CORE_EVENTS,
  FACTORY_PLATFORM_CORE_OBJECTS,
  FACTORY_PLATFORM_COUNTRY_PACKS,
  FACTORY_PLATFORM_DEVELOPMENT_GATES,
  FACTORY_PLATFORM_DEVELOPMENT_PHASES,
  FACTORY_PLATFORM_DIFFERENTIATORS,
  FACTORY_PLATFORM_ENDPOINT_RESPONSIBILITIES,
  FACTORY_PLATFORM_FOUNDATIONS,
  FACTORY_PLATFORM_GOLDEN_FLOWS,
  FACTORY_PLATFORM_IMPLEMENTATION_STAGES,
  FACTORY_PLATFORM_INDUSTRY_PACKS,
  FACTORY_PLATFORM_OPERATING_LOOP,
  FACTORY_PLATFORM_PORTABILITY_RULES,
  FACTORY_PLATFORM_PRIORITY_PROGRAMS,
  FACTORY_PLATFORM_SALES_VALUE_PROPOSITIONS,
} from "@/lib/factory-platform-blueprint-governance";
import type { PageFactoryScope } from "@/page-factory/page-factory";
import {
  buildFactoryPlatformSpecificationMarkdown,
  FACTORY_PLATFORM_SPECIFICATION_FILE_NAME,
} from "@/lib/factory-platform-specification";
import type {
  ProductItem,
  ProductModuleCategoryStyle,
  ProductStatus,
} from "@/lib/product-market-store";

type PhaseFilter = "all" | FactoryPlatformPhaseId;

const PHASE_META: Record<FactoryPlatformPhaseId, { short: string; label: string }> = {
  "revenue-loop": { short: "P0", label: "收入闭环" },
  "manufacturing-loop": { short: "P1", label: "制造履约" },
  "global-intelligence": { short: "P2", label: "全球智能" },
};

const DELIVERY_STATUS_META: Record<FactoryPlatformDeliveryStatus, { label: string; note: string }> = {
  available: { label: "已具备", note: "已通过当前版本与验收证据确认" },
  pilot: { label: "试点", note: "已有入口，需按客户版本和范围验证" },
  planned: { label: "规划", note: "蓝图能力，尚不可作为现成功能承诺" },
};

const PRODUCT_STATUS_META: Record<ProductStatus, { label: string; completeLabel: string }> = {
  active: { label: "开通", completeLabel: "已开通" },
  inactive: { label: "取消", completeLabel: "已取消" },
  hidden: { label: "隐藏", completeLabel: "已隐藏" },
};

type FactoryPlatformBlueprintProps = {
  workspaceLabel: string;
  sourceScope: PageFactoryScope;
  search: string;
  products: readonly ProductItem[];
  categoryStyles: Readonly<Record<string, ProductModuleCategoryStyle>>;
  onCategoryPlanningVisibilityChange: (category: FactoryPlatformCategoryKey, visible: boolean) => void;
  onCategoryStatusChange: (category: FactoryPlatformCategoryKey, status: ProductStatus) => void;
  onApplicationStatusChange: (path: string, status: ProductStatus) => void;
};

const PUBLISH_TARGET_LABELS: Record<string, string> = {
  agency_source: "代理源端",
  client_source: "客户源端",
  agency_instance: "所属代理端",
  client_plan: "所属客户计划/站点",
};

const MODE_LABELS = {
  domestic: "国内",
  overseas: "海外",
  b2b: "B2B",
  b2c: "B2C",
} as const;

const AUDIENCE_LABELS: Record<string, string> = {
  factory_owner: "工厂老板",
  executive: "经营管理层",
  marketing: "市场",
  sales: "销售",
  operations: "运营",
  finance: "财务",
  hr: "人力",
  engineering: "工程",
  procurement: "采购",
  production: "生产",
  quality: "质量",
  warehouse: "仓储",
  service: "客户服务",
  it: "IT",
  agency_operator: "代理运营",
};

function downloadMarkdown() {
  let url: string | undefined;
  let anchor: HTMLAnchorElement | undefined;
  try {
    const blob = new Blob([buildFactoryPlatformSpecificationMarkdown()], { type: "text/markdown;charset=utf-8" });
    url = URL.createObjectURL(blob);
    anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = FACTORY_PLATFORM_SPECIFICATION_FILE_NAME;
    document.body.appendChild(anchor);
    anchor.click();
    toast.success("规范说明已生成，并已提交浏览器下载。");
  } catch {
    toast.error("规范说明生成失败，请刷新页面后重试。");
  } finally {
    anchor?.remove();
    if (url) {
      // Keep the object URL alive until the browser has accepted the download.
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }
}

export function FactoryPlatformBlueprint({
  workspaceLabel,
  sourceScope,
  search,
  products,
  categoryStyles,
  onCategoryPlanningVisibilityChange,
  onCategoryStatusChange,
  onApplicationStatusChange,
}: FactoryPlatformBlueprintProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const productByPath = useMemo(() => new Map(products.map((product) => [product.path, product] as const)), [products]);
  const isCategoryPlanningVisible = (category: FactoryPlatformCategoryKey) => categoryStyles[category]?.blueprintVisible !== false;
  const requestedCategory = getFactoryPlatformCategory(params.get("category"));
  const requestedApp = params.get("app");
  const selectedApplication = requestedCategory && requestedApp
    ? getFactoryPlatformApplication(`${requestedCategory.key}.${requestedApp}`)
    : undefined;
  const requestedPhase = params.get("phase");
  const phaseFilter: PhaseFilter = requestedPhase && Object.prototype.hasOwnProperty.call(PHASE_META, requestedPhase)
    ? requestedPhase as FactoryPlatformPhaseId
    : "all";
  const visibleSelectedApplication = selectedApplication
    && isCategoryPlanningVisible(selectedApplication.category)
    && (phaseFilter === "all" || selectedApplication.phase === phaseFilter)
    ? selectedApplication
    : undefined;
  const selectedRuntimeSourceScope = visibleSelectedApplication
    ? getFactoryPlatformSocialWorkspaceRuntimeSourceScope(visibleSelectedApplication.route)
    : undefined;

  const visibleCategories = useMemo(() => {
    const categories = requestedCategory ? [requestedCategory] : FACTORY_PLATFORM_CATEGORIES;
    return categories.map((category) => ({
      ...category,
      applications: category.applications.filter((application) => phaseFilter === "all" || application.phase === phaseFilter),
    })).filter((category) => category.applications.length > 0);
  }, [phaseFilter, requestedCategory]);

  const applicationCount = FACTORY_PLATFORM_CATEGORIES.reduce((total, category) => total + category.applications.length, 0);
  const visibleApplicationCount = visibleCategories.reduce((total, category) => total + category.applications.length, 0);
  const isCatalogueFiltered = Boolean(requestedCategory) || phaseFilter !== "all";
  const deliveryStatusCounts = FACTORY_PLATFORM_CATEGORIES
    .flatMap((category) => category.applications)
    .reduce<Record<FactoryPlatformDeliveryStatus, number>>((counts, application) => {
      counts[application.deliveryStatus] += 1;
      return counts;
    }, { available: 0, pilot: 0, planned: 0 });

  const getApplicationStatus = (path: string): ProductStatus => productByPath.get(path)?.status || "inactive";
  const getCategoryStatus = (category: (typeof FACTORY_PLATFORM_CATEGORIES)[number]): ProductStatus | "mixed" => {
    const statuses = category.applications.map((application) => getApplicationStatus(application.route));
    return statuses.every((status) => status === statuses[0]) ? statuses[0] : "mixed";
  };

  const selectCategory = (category?: FactoryPlatformCategoryKey) => {
    const next = new URLSearchParams(location.search);
    next.set("tab", "blueprint");
    if (category) next.set("category", category);
    else next.delete("category");
    next.delete("app");
    navigate(`${location.pathname}?${next.toString()}`);
  };

  const selectApplication = (category: FactoryPlatformCategoryKey, applicationId: string) => {
    const next = new URLSearchParams(location.search);
    next.set("tab", "blueprint");
    next.set("category", category);
    next.set("app", applicationId.split(".").slice(1).join("."));
    navigate(`${location.pathname}?${next.toString()}`);
  };

  const openApplication = (route: string) => {
    const marker = "/product-market";
    const markerIndex = location.pathname.indexOf(marker);
    const sourcePrefix = markerIndex >= 0 ? location.pathname.slice(0, markerIndex) : "";
    const runtimeUrl = new URL(route, "https://factory.local");
    const siteId = new URLSearchParams(location.search).get("siteId");
    if (siteId) runtimeUrl.searchParams.set("siteId", siteId);
    navigate(`${sourcePrefix}${runtimeUrl.pathname}${runtimeUrl.search}${runtimeUrl.hash}`);
  };

  const selectPhase = (phase: PhaseFilter) => {
    const next = new URLSearchParams(location.search);
    next.set("tab", "blueprint");
    if (phase === "all") next.delete("phase");
    else next.set("phase", phase);
    if (selectedApplication && phase !== "all" && selectedApplication.phase !== phase) {
      next.delete("app");
    }
    navigate(`${location.pathname}?${next.toString()}`);
  };

  return (
    <>
      <header
        data-product-market-header
        data-factory-platform-blueprint-header
        data-shared-layout-section="title"
        data-development-standard-frame-region="title"
        data-development-standard-frame-label="标题"
        className="flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Layers3 className="h-6 w-6 shrink-0" aria-hidden="true" />
              <span>{workspaceLabel} → 平台蓝图</span>
            </h1>
            <p data-shared-title-description className="mt-1 text-sm opacity-75">
              以同一份契约组织十二大类、{applicationCount} 个应用、开发阶段、业务边界、三端治理和客户购买证据。
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant="outline">
              {isCatalogueFiltered
                ? `当前 ${visibleCategories.length} 类 · ${visibleApplicationCount} 应用 / 总计 12 类 · ${applicationCount} 应用`
                : `12 类 · ${applicationCount} 应用`}
            </Badge>
            <Badge variant="outline">国内 / 海外 · B2B / B2C</Badge>
            <Badge data-product-market-maturity-badge="summary" variant="outline">
              已具备 {deliveryStatusCounts.available} · 试点 {deliveryStatusCounts.pilot} · 规划 {deliveryStatusCounts.planned}
            </Badge>
            <Button data-factory-platform-specification-generator type="button" size="sm" onClick={downloadMarkdown}>
              <Download className="mr-1 h-4 w-4" />生成规范说明
            </Button>
          </div>
        </div>
      </header>

      <section
        data-factory-platform-blueprint
        data-development-standard-frame-region="table-shell"
        data-development-standard-frame-label="表内"
        className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-current/15"
      >
        <div
          data-development-standard-frame-region="table-header"
          data-development-standard-frame-label="表头"
          className="space-y-3 border-b border-current/15 p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant={!requestedCategory ? "default" : "outline"} onClick={() => selectCategory()}>
                全部 12 类
              </Button>
              {FACTORY_PLATFORM_CATEGORIES.map((category) => (
                <Button
                  key={category.key}
                  type="button"
                  size="sm"
                  variant={requestedCategory?.key === category.key ? "default" : "outline"}
                  onClick={() => selectCategory(category.key)}
                >
                  {category.order}.{category.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(["all", ...Object.keys(PHASE_META)] as PhaseFilter[]).map((phase) => (
                <Button key={phase} type="button" size="sm" variant={phaseFilter === phase ? "default" : "outline"} onClick={() => selectPhase(phase)}>
                  {phase === "all" ? "全部阶段" : `${PHASE_META[phase].short} ${PHASE_META[phase].label}`}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs opacity-80">
            <Route className="h-4 w-4" aria-hidden="true" />
            {FACTORY_PLATFORM_OPERATING_LOOP.map((stage, index) => {
              const category = getFactoryPlatformCategory(stage.category);
              return <span key={stage.sequence}>{index > 0 ? "→ " : ""}{category?.order}.{category?.label}</span>;
            })}
          </div>
          <p data-factory-platform-delivery-status-contract className="text-xs opacity-80">
            状态口径：蓝图入口默认为“规划”；已有独立入口也只默认为“试点”；只有绑定当前版本、范围和验收证据后，才能显式登记为“已具备”。
          </p>
        </div>

        <div
          data-page-list
          data-page-list-scroll-owner
          data-development-standard-frame-region="content"
          data-development-standard-frame-label="内容"
          className="product-market-scroll-list min-h-0 flex-1 space-y-5 overflow-y-auto p-3"
        >
          {visibleSelectedApplication ? (
            <Card
              data-factory-platform-selected-application={visibleSelectedApplication.id}
              data-factory-platform-runtime-source-scope={selectedRuntimeSourceScope}
              data-factory-platform-runtime-available-here={!selectedRuntimeSourceScope || selectedRuntimeSourceScope === sourceScope ? "true" : "false"}
              className="border-current/25 bg-current/[0.04] shadow-none"
            >
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {visibleSelectedApplication.navigationLabel}
                    <span className="ml-2 text-xs font-normal opacity-70">{visibleSelectedApplication.label}</span>
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{PHASE_META[visibleSelectedApplication.phase].short} · {PHASE_META[visibleSelectedApplication.phase].label}</Badge>
                    <Badge variant="outline" title={DELIVERY_STATUS_META[visibleSelectedApplication.deliveryStatus].note}>
                      {DELIVERY_STATUS_META[visibleSelectedApplication.deliveryStatus].label}
                    </Badge>
                    {selectedRuntimeSourceScope ? (
                      <Badge data-factory-platform-runtime-boundary variant="outline">
                        {selectedRuntimeSourceScope === sourceScope ? "当前端运行" : "治理投影 · 客户源运行"}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                <div><b>客户价值</b><p className="mt-1 opacity-75">{visibleSelectedApplication.value}</p></div>
                <div><b>核心能力</b><p className="mt-1 opacity-75">{visibleSelectedApplication.capabilities.join("、")}</p></div>
                <div><b>二级规划</b><p className="mt-1 opacity-75">{visibleSelectedApplication.navigationChildren.map((child) => child.label).join("、")}</p></div>
                <div><b>验收指标</b><p className="mt-1 opacity-75">{visibleSelectedApplication.metrics.join("、")}</p></div>
                <div><b>适用角色</b><p className="mt-1 opacity-75">{visibleSelectedApplication.audience.map((item) => AUDIENCE_LABELS[item] || item).join("、")}</p></div>
              </CardContent>
            </Card>
          ) : null}

          <section data-factory-platform-categories>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Layers3 className="h-4 w-4" />十二大类应用目录</div>
            <div className="grid gap-3 xl:grid-cols-2">
              {visibleCategories.map((category) => {
                const planningVisible = isCategoryPlanningVisible(category.key);
                const categoryStatus = getCategoryStatus(category);
                return (
                  <Card
                    key={category.key}
                    data-factory-platform-category={category.key}
                    data-blueprint-planning-visible={planningVisible ? "true" : "false"}
                    className="border-current/20 bg-transparent shadow-none"
                  >
                    <CardHeader className="space-y-2 pb-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle className="text-base">{category.order}.{category.label} · {category.title}</CardTitle>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            {phaseFilter === "all"
                              ? `${category.applications.length} 项`
                              : `${category.applications.length}/${getFactoryPlatformCategory(category.key)?.applications.length ?? category.applications.length} 项`}
                          </Badge>
                          <label
                            data-factory-platform-category-planning-switch={category.key}
                            className="flex h-8 items-center gap-2 rounded-md border border-current/20 px-2 text-xs"
                            title="共享开关只控制平台蓝图规划说明；不会改动应用的开通、取消或隐藏状态。"
                          >
                            <Switch
                              checked={planningVisible}
                              onCheckedChange={(checked) => onCategoryPlanningVisibilityChange(category.key, checked)}
                              aria-label={`${category.order}.${category.label} 显示规划`}
                            />
                            <span>显示规划</span>
                            <Badge variant={planningVisible ? "default" : "outline"}>{planningVisible ? "开启" : "关闭"}</Badge>
                          </label>
                        </div>
                      </div>
                      <div data-factory-platform-category-status-controls={category.key} className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs opacity-75">
                          本类应用：{categoryStatus === "mixed" ? "混合状态" : PRODUCT_STATUS_META[categoryStatus].completeLabel}
                        </p>
                        <div className="flex flex-wrap gap-1" role="group" aria-label={`${category.order}.${category.label} 批量状态`}>
                          {(Object.keys(PRODUCT_STATUS_META) as ProductStatus[]).map((status) => (
                            <Button
                              key={status}
                              type="button"
                              size="sm"
                              variant={categoryStatus === status ? "default" : "outline"}
                              className="h-7 px-2 text-[11px]"
                              onClick={() => onCategoryStatusChange(category.key, status)}
                              title={`将本类全部应用设为${PRODUCT_STATUS_META[status].label}`}
                            >
                              {PRODUCT_STATUS_META[status].label}
                            </Button>
                          ))}
                        </div>
                      </div>
                      {planningVisible
                        ? <p className="text-xs leading-5 opacity-75">{category.value}</p>
                        : <p data-factory-platform-category-planning-collapsed className="text-xs leading-5 opacity-60">规划说明已关闭；应用状态仍可继续设置和同步。</p>}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {category.applications.map((application) => {
                        const applicationStatus = getApplicationStatus(application.route);
                        const runtimeSourceScope = getFactoryPlatformSocialWorkspaceRuntimeSourceScope(application.route);
                        const runtimeAvailableHere = !runtimeSourceScope || runtimeSourceScope === sourceScope;
                        return (
                          <div
                            key={application.id}
                            data-factory-platform-application={application.id}
                            data-delivery-status={application.deliveryStatus}
                            data-product-status={applicationStatus}
                            data-factory-platform-runtime-source-scope={runtimeSourceScope}
                            data-factory-platform-runtime-available-here={runtimeAvailableHere ? "true" : "false"}
                            data-selected={selectedApplication?.id === application.id ? "true" : "false"}
                            className="grid w-full gap-2 rounded-lg border border-current/15 px-3 py-2 text-left text-xs md:grid-cols-[minmax(8rem,0.8fr)_minmax(12rem,1.8fr)_minmax(0,1fr)]"
                          >
                            <button
                              type="button"
                              onClick={() => planningVisible && (application.deliveryStatus === "planned" || !runtimeAvailableHere
                                ? selectApplication(category.key, application.id)
                                : openApplication(application.route))}
                              disabled={!planningVisible}
                              className="text-left font-semibold enabled:hover:underline disabled:cursor-default"
                              title={planningVisible
                                ? !runtimeAvailableHere
                                  ? `${application.label}；治理投影，真实运行页位于客户源`
                                  : `${application.label}${application.deliveryStatus === "planned" ? "" : "；打开应用"}`
                                : "规划说明已关闭"}
                            >
                              {application.navigationLabel}
                            </button>
                            {planningVisible ? (
                              <span className="min-w-0 opacity-75">
                                <span className="block">{application.value}</span>
                                <span data-factory-platform-navigation-children className="mt-1 flex flex-wrap gap-1">
                                  {application.navigationChildren.map((child) => (
                                    <span key={child.id} title={child.fullLabel} className="rounded border border-current/15 px-1.5 py-0.5">
                                      {child.label}
                                    </span>
                                  ))}
                                </span>
                              </span>
                            ) : <span className="opacity-60">规划内容已收起</span>}
                            <div className="min-w-0 flex flex-wrap items-center justify-end gap-1">
                              {planningVisible ? (
                                <span data-product-market-maturity-badge={application.deliveryStatus} className="mr-1 whitespace-nowrap font-medium" title={DELIVERY_STATUS_META[application.deliveryStatus].note}>
                                  {PHASE_META[application.phase].short} · {DELIVERY_STATUS_META[application.deliveryStatus].label}
                                </span>
                              ) : null}
                              {runtimeSourceScope && !runtimeAvailableHere ? (
                                <span data-factory-platform-runtime-boundary="governance-projection" className="mr-1 whitespace-nowrap font-medium">
                                  治理投影 · 客户源运行
                                </span>
                              ) : null}
                              <span className="mr-1 whitespace-nowrap font-semibold">{PRODUCT_STATUS_META[applicationStatus].completeLabel}</span>
                              <span data-factory-platform-application-status-controls={application.id} className="flex gap-1" role="group" aria-label={`${application.navigationLabel} 状态`}>
                                {(Object.keys(PRODUCT_STATUS_META) as ProductStatus[]).map((status) => (
                                  <Button
                                    key={status}
                                    type="button"
                                    size="sm"
                                    variant={applicationStatus === status ? "default" : "outline"}
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => onApplicationStatusChange(application.route, status)}
                                  >
                                    {PRODUCT_STATUS_META[status].label}
                                  </Button>
                                ))}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {planningVisible ? (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {category.modes.map((mode) => <Badge key={mode} variant="outline" className="text-[10px]">{MODE_LABELS[mode]}</Badge>)}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          <section data-factory-platform-foundations>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Layers3 className="h-4 w-4" />六大横向平台底座</div>
            <p className="mb-3 text-xs opacity-75">底座由十二类共同调用，不增加第13类，也不成为新的业务事实源。</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {FACTORY_PLATFORM_FOUNDATIONS.map((foundation) => (
                <Card key={foundation.id} className="border-current/20 bg-transparent shadow-none">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{foundation.sequence}. {foundation.label}</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-xs leading-5">
                    <p>{foundation.mission}</p>
                    <p className="opacity-75"><b>公共能力：</b>{foundation.capabilities.join("、")}</p>
                    <ul className="list-disc space-y-1 pl-4">{foundation.exitCriteria.map((item) => <li key={item}>{item}</li>)}</ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section data-factory-platform-priority-programs>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Target className="h-4 w-4" />五个优先专项</div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {FACTORY_PLATFORM_PRIORITY_PROGRAMS.map((program) => (
                <Card key={program.id} className="border-current/20 bg-transparent shadow-none">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{program.sequence}. {program.label}</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-xs leading-5">
                    <p>{program.objective}</p>
                    <p className="opacity-75"><b>能力：</b>{program.capabilities.join("、")}</p>
                    <p><b>客户价值：</b>{program.customerValue}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section data-factory-platform-commercial-packages>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4" />四档商业装配</div>
            <p className="mb-3 text-xs opacity-75">套餐只装配能力、权限和交付范围；客户、订单、财务等事实仍归对应业务系统所有。</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {FACTORY_PLATFORM_COMMERCIAL_PACKAGES.map((packageItem) => (
                <Card key={packageItem.id} className="border-current/20 bg-transparent shadow-none">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{packageItem.sequence}. {packageItem.label}</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-xs leading-5">
                    <p>{packageItem.promise}</p>
                    <p className="opacity-75"><b>覆盖：</b>{packageItem.categoryKeys.map((key) => getFactoryPlatformCategory(key)?.label).filter(Boolean).join("、")}</p>
                    <p><b>证明：</b>{packageItem.evidenceRequired.join("、")}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section data-factory-platform-application-contract>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" />应用立项十五字段与七道门禁</div>
            <div className="grid gap-3 xl:grid-cols-[0.9fr_1.6fr]">
              <Card className="border-current/20 bg-transparent shadow-none">
                <CardHeader className="pb-2"><CardTitle className="text-sm">十五个必填契约字段</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {FACTORY_PLATFORM_APPLICATION_CONTRACT_FIELDS.map((field) => (
                    <Badge key={field.id} variant="outline" title={field.description}>{field.label}</Badge>
                  ))}
                </CardContent>
              </Card>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {FACTORY_PLATFORM_DEVELOPMENT_GATES.map((gate) => (
                  <Card key={gate.id} className="border-current/20 bg-transparent shadow-none">
                    <CardContent className="space-y-1 p-3 text-xs leading-5">
                      <p className="font-semibold">{gate.sequence}. {gate.label}</p>
                      <p>{gate.purpose}</p>
                      <p className="opacity-75">产物：{gate.requiredArtifacts.join("、")}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          <section data-factory-platform-continuous-development>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><GitBranch className="h-4 w-4" />持续开发七步顺序</div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {FACTORY_PLATFORM_CONTINUOUS_DEVELOPMENT_SEQUENCE.map((stage) => (
                <Card key={stage.id} className="border-current/20 bg-transparent shadow-none">
                  <CardContent className="space-y-2 p-3 text-xs leading-5">
                    <p className="font-semibold">{stage.sequence}. {stage.label}</p>
                    <p>{stage.deliverables.join("、")}</p>
                    <p className="opacity-75">放行门禁：{FACTORY_PLATFORM_DEVELOPMENT_GATES.find((gate) => gate.id === stage.exitGate)?.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <FactoryExecutionDesk />
          <FactoryObjectEventContractDesk />
          <FactoryRevenueGoldenFlowDesk />
          <FactoryImplementationCenter />
          <FactoryMachineryIndustryPackDesk />

          <section data-factory-platform-golden-flows>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><GitBranch className="h-4 w-4" />五条黄金业务链</div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {FACTORY_PLATFORM_GOLDEN_FLOWS.map((flow) => (
                <Card key={flow.id} className="border-current/20 bg-transparent shadow-none">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{flow.sequence}. {flow.label}</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-xs leading-5">
                    <p>{flow.objective}</p>
                    <p className="opacity-75">{flow.steps.join(" → ")}</p>
                    <p><b>验收：</b>{flow.exitCriteria.join("；")}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section data-factory-platform-domain-dictionary>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Layers3 className="h-4 w-4" />核心对象与事件字典</div>
            <div className="grid gap-3 xl:grid-cols-2">
              <Card className="border-current/20 bg-transparent shadow-none">
                <CardHeader className="pb-2"><CardTitle className="text-sm">{FACTORY_PLATFORM_CORE_OBJECTS.length}个核心对象</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {FACTORY_PLATFORM_CORE_OBJECTS.map((object) => (
                    <Badge key={object.id} variant="outline" title={`${getFactoryPlatformCategory(object.systemOfRecord)?.label}：${object.identityRule}`}>{object.label}</Badge>
                  ))}
                </CardContent>
              </Card>
              <Card className="border-current/20 bg-transparent shadow-none">
                <CardHeader className="pb-2"><CardTitle className="text-sm">{FACTORY_PLATFORM_CORE_EVENTS.length}个关键事件</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {FACTORY_PLATFORM_CORE_EVENTS.map((event) => (
                    <Badge key={event.id} variant="outline" title={`生产者：${getFactoryPlatformCategory(event.producer)?.label}`}>{event.label}</Badge>
                  ))}
                </CardContent>
              </Card>
            </div>
          </section>

          <section data-factory-platform-configuration-packs>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4" />行业包与国家区域包</div>
            <p className="mb-3 text-xs opacity-75">配置包复用同一内核和对象契约，不复制客户应用或建立行业代码分支。</p>
            <div className="grid gap-3 xl:grid-cols-2">
              {([["行业包", FACTORY_PLATFORM_INDUSTRY_PACKS], ["国家区域包", FACTORY_PLATFORM_COUNTRY_PACKS]] as const).map(([title, packs]) => (
                <Card key={title} className="border-current/20 bg-transparent shadow-none">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
                  <CardContent className="grid gap-2 sm:grid-cols-2">
                    {packs.map((pack) => (
                      <div key={pack.id} className="rounded-lg border border-current/15 p-2 text-xs leading-5">
                        <p className="font-semibold">{pack.label}</p>
                        <p className="opacity-75">{pack.scope}</p>
                        <p>{pack.capabilities.join("、")}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section data-factory-platform-implementation-center>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Target className="h-4 w-4" />客户实施中心与可迁移退出</div>
            <div className="grid gap-3 lg:grid-cols-3">
              {FACTORY_PLATFORM_IMPLEMENTATION_STAGES.map((stage) => (
                <Card key={stage.id} className="border-current/20 bg-transparent shadow-none">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{stage.label}</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-xs leading-5">
                    <p>{stage.objective}</p>
                    <p className="opacity-75">交付：{stage.deliverables.join("、")}</p>
                    <p>验收：{stage.exitCriteria.join("；")}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {FACTORY_PLATFORM_PORTABILITY_RULES.map((rule) => (
                <div key={rule.id} className="rounded-lg border border-current/20 p-3 text-xs leading-5">
                  <p className="font-semibold">{rule.label}</p>
                  <p>{rule.rule}</p>
                </div>
              ))}
            </div>
          </section>

          <section data-factory-platform-development-phases>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><GitBranch className="h-4 w-4" />开发顺序与出阶段门槛</div>
            <div className="grid gap-3 lg:grid-cols-3">
              {FACTORY_PLATFORM_DEVELOPMENT_PHASES.map((phase) => (
                <Card key={phase.id} className="border-current/20 bg-transparent shadow-none">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">P{phase.sequence - 1} · {phase.title}</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-xs leading-5">
                    <p>{phase.objective}</p>
                    <p className="opacity-75"><b>覆盖类别：</b>{phase.categoryKeys.map((key) => getFactoryPlatformCategory(key)?.label).filter(Boolean).join("、")}</p>
                    <p className="opacity-75"><b>交付：</b>{phase.deliverables.join("、")}</p>
                    <ul className="list-disc space-y-1 pl-4">{phase.exitCriteria.map((item) => <li key={item}>{item}</li>)}</ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section data-factory-platform-sales-values>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Target className="h-4 w-4" />客户为什么购买</div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {FACTORY_PLATFORM_SALES_VALUE_PROPOSITIONS.map((item) => (
                <Card key={item.id} className="border-current/20 bg-transparent shadow-none">
                  <CardContent className="space-y-2 p-3 text-xs leading-5">
                    <p className="font-semibold">{item.value}</p>
                    <p className="opacity-75">购买角色：{item.buyer.map((audience) => AUDIENCE_LABELS[audience] || audience).join("、")}</p>
                    <p className="opacity-75">问题：{item.pain}</p>
                    <p>结果：{item.outcome}</p>
                    <p className="font-medium">需验证：{item.proof.join("、")}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section data-factory-platform-differentiators>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4" />与常见平台的可验证差异</div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {FACTORY_PLATFORM_DIFFERENTIATORS.map((item) => (
                <Card key={item.id} className="border-current/20 bg-transparent shadow-none">
                  <CardContent className="space-y-2 p-3 text-xs leading-5">
                    <p className="font-semibold">{item.title}</p>
                    <p>{item.claim}</p>
                    <p className="opacity-75">对比：{item.contrast}</p>
                    <p className="font-medium">必须证明：{item.evidenceRequired.join("、")}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section data-factory-platform-boundaries>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" />业务边界与唯一事实源</div>
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {FACTORY_PLATFORM_BUSINESS_BOUNDARIES.map((boundary) => (
                <Card key={boundary.id} className="border-current/20 bg-transparent shadow-none">
                  <CardContent className="space-y-2 p-3 text-xs leading-5">
                    <p className="font-semibold">{boundary.title}</p>
                    <p>唯一事实源：{getFactoryPlatformCategory(boundary.systemOfRecord)?.label}</p>
                    <p className="opacity-75">拥有：{boundary.owns.join("、")}</p>
                    <p className="opacity-75">消费/协作：{boundary.consumes.map((key) => getFactoryPlatformCategory(key)?.label).filter(Boolean).join("、")}</p>
                    <ul className="list-disc space-y-1 pl-4">{boundary.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section data-factory-platform-endpoints>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><GitBranch className="h-4 w-4" />总部端 → 代理源端／客户源端 → 对应运行端</div>
            <div className="grid gap-3 lg:grid-cols-3">
              {FACTORY_PLATFORM_ENDPOINT_RESPONSIBILITIES.map((endpoint) => (
                <Card key={endpoint.endpoint} className="border-current/20 bg-transparent shadow-none">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{endpoint.label}</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-xs leading-5">
                    <p>{endpoint.mission}</p>
                    <p className="opacity-75"><b>负责：</b>{endpoint.owns.join("、")}</p>
                    <p className="opacity-75"><b>发布到：</b>{endpoint.publishesTo.map((target) => PUBLISH_TARGET_LABELS[target] || target).join("、")}</p>
                    <p><b>客户价值：</b>{endpoint.customerValue}</p>
                    <ul className="list-disc space-y-1 pl-4">{endpoint.mustNot.map((rule) => <li key={rule}>禁止：{rule}</li>)}</ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </section>
    </>
  );
}
