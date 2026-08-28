export const UNIFIED_PAGE_FRAME_CONTRACT_VERSION = "2026.08.23.1" as const;

export const UNIFIED_PAGE_FRAME_REGIONS = [
  "top",
  "body",
  "title-1",
  "title-2",
  "table-shell",
  "table-header",
  "content",
  "large-card",
  "small-card",
  "footer",
] as const;

export type UnifiedPageFrameRegion = typeof UNIFIED_PAGE_FRAME_REGIONS[number];
export type UnifiedPageFrameOwner = "factory-shell" | "existing-workspace";

export const UNIFIED_PAGE_FRAME_BASELINES = [
  { id: "operations", label: "运营市场", route: "/zb/client-source/product-market?tab=operations", role: "geometry-reference" },
  { id: "modules", label: "栏目配置", route: "/zb/client-source/product-market?tab=modules", role: "structured-editor" },
  { id: "layout", label: "版面风格", route: "/zb/client-source/product-market?tab=layout", role: "interactive-header" },
  { id: "service", label: "客服音效", route: "/zb/client-source/product-market?tab=service", role: "service-header" },
  { id: "marketing-playbook", label: "营销作战", route: "/zb/client-source/social?tab=marketing-playbook", role: "cross-template-canary" },
] as const;

export const UNIFIED_PAGE_FRAME_BATCHES = [
  { id: "contract-foundation", order: "01", label: "契约基础", scope: "共享区域、可视化入口、门禁和恢复边界" },
  { id: "baseline-pages", order: "02", label: "基准页面", scope: "五个基准页显式区域与真实页面验收" },
  { id: "low-risk-pages", order: "03", label: "低风险页面", scope: "12 个低风险源码入口" },
  { id: "review-pages", order: "04", label: "审查页面", scope: "57 个需要影响审查的源码入口" },
  { id: "high-risk-pages", order: "05", label: "高风险页面", scope: "55 个单页授权、单页验收入口" },
  { id: "shared-windows", order: "06", label: "共享窗口", scope: "弹窗、抽屉、读条和工作台外壳" },
  { id: "legacy-css-retirement", order: "07", label: "旧样式清退", scope: "按命中证据逐块删除旧 CSS" },
] as const;

export const UNIFIED_PAGE_FRAME_CONTRACT = {
  version: UNIFIED_PAGE_FRAME_CONTRACT_VERSION,
  source: "code-owned-unified-page-frame-contract",
  sourceScopes: ["hq", "agency_source", "client_source"],
  regionStrategy: "explicit",
  frameOwners: ["factory-shell", "existing-workspace"],
  regions: UNIFIED_PAGE_FRAME_REGIONS,
  scroll: {
    contract: "table-inner-60",
    pageVerticalOwners: 1,
    desktopSidebarIsIndependent: true,
    compactSidebarScrollOwners: 0,
    forbiddenVerticalOwners: ["html", "body", "app-shell", "workspace", "table-shell", "footer"],
  },
  annotations: {
    geometryToleranceCssPixels: 1,
    structuralRegionsUnique: ["body", "title-1", "table-shell", "content", "footer"],
    horizontalMarkerRegions: ["title-1", "title-2", "table-header"],
    horizontalMarkerPlacement: "left-frame-start",
    horizontalMarkerInsetCssPixels: 8,
    cardRegionPolicy: "nearest-real-card-only",
    layoutNeutral: true,
  },
  responsive: {
    boundaryPairs: [[639, 640], [767, 768], [1023, 1024], [1279, 1280]],
    oneLiveBusinessDom: true,
    compactContentIsOnlyPageScrollOwner: true,
  },
  publishing: {
    mode: "batch-gated",
    globalButton: false,
    baselineRequiredForEveryBatch: true,
    failedPagePolicy: "isolate-and-keep-current-adapter",
  },
  preservation: [
    "business-data",
    "business-actions",
    "page-content",
    "plugins",
    "uploaded-assets",
    "tenant-content",
    "downstream-customization",
    "database",
    "formal-backups",
  ],
} as const;
