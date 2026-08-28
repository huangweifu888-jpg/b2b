import type { VisualCardEditableRegionId } from "@/lib/visual-card-layout-contract";
import { EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT } from "@/lib/layout-frame-contract";
import {
  collectSharedSmallCardCandidates,
  SHARED_LARGE_CARD_REGION_SELECTOR,
  SHARED_SMALL_CARD_MARKER_CANDIDATE_SELECTOR,
} from "@/lib/shared-window-contract";

export const VISUAL_LAYOUT_ROOT_SELECTOR = `${EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector}, [data-visual-layout-root], [data-product-market-layout]`;

export function findVisualPageLayoutRoot(documentRoot: Document = document) {
  return documentRoot.querySelector<HTMLElement>(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector)
    || documentRoot.querySelector<HTMLElement>("[data-product-market-layout]")
    || documentRoot.querySelector<HTMLElement>("[data-visual-layout-root]");
}

export const VISUAL_PAGE_REGION_LABELS: Record<VisualCardEditableRegionId, string> = {
  topbar: "顶部",
  workspace: "主体",
  title: "标题",
  "table-shell": "表内",
  "table-header": "表头",
  content: "内容",
  "large-card": "大卡片",
  "small-card": "小卡片",
  footer: "尾栏",
};

export const VISUAL_PAGE_REGION_SELECTORS: Record<VisualCardEditableRegionId, string> = {
  topbar: ".app-topbar",
  workspace: `:is(${EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector}, [data-product-market-workspace], [data-client-project-frame], [data-page-layout-surface], [data-company-info-navigation-workspace])`,
  // Title 2 is the independent Layout Style palette band. Treating it as the
  // primary Visual `title` made one global edit hit two differently-owned
  // surfaces and collapsed the intended dual-tone theme.
  title: ":is([data-visual-contract-region=\"title\"], [data-development-standard-frame-region=\"title\"], [data-page-title], [data-client-project-context], [data-company-info-navigation-workspace] > .nav-3d-header):not([data-responsive-shared-surface=\"title-2\"])",
  "table-shell": ":is([data-visual-contract-region=\"table-shell\"], [data-product-market-table-shell=\"true\"], [data-development-standard-frame-region=\"table-shell\"], [data-page-content-stack=\"table\"], [data-company-info-navigation-workspace])",
  "table-header": ":is([data-visual-contract-region=\"table-header\"], [data-product-market-table-header], [data-development-standard-frame-region=\"table-header\"], [data-page-table-header], .nav-table-header)",
  content: ":is([data-visual-contract-region=\"content\"], [data-product-market-scroll-list], [data-development-standard-frame-region=\"content\"], [data-page-list-scroll-owner], [data-page-list])",
  "large-card": `[data-visual-contract-region="large-card"], ${SHARED_LARGE_CARD_REGION_SELECTOR}`,
  "small-card": `[data-visual-contract-region="small-card"], ${SHARED_SMALL_CARD_MARKER_CANDIDATE_SELECTOR}`,
  footer: ":is([data-page-layout-footer], [data-development-standard-frame-region=\"footer\"])",
};

function uniqueElements(elements: readonly HTMLElement[]) {
  return Array.from(new Set(elements));
}

/**
 * Fast path used while the Visual editor is opening.  The full scanner is
 * intentionally deferred so the first selected region is usable before the
 * rest of a long business page receives runtime markers.
 */
export function collectVisualPageRegionTargetsForRegion(
  root: ParentNode,
  regionId: VisualCardEditableRegionId,
  documentRoot: Document = document,
) {
  const scope = regionId === "topbar" || regionId === "footer" ? documentRoot : root;
  const selector = VISUAL_PAGE_REGION_SELECTORS[regionId];
  const rootTarget = scope instanceof HTMLElement && scope.matches(selector) ? [scope] : [];
  const explicitTargets = uniqueElements([
    ...rootTarget,
    ...Array.from(scope.querySelectorAll<HTMLElement>(selector)),
  ]);
  if (regionId !== "small-card") return explicitTargets;
  return uniqueElements([
    ...explicitTargets,
    ...collectSharedSmallCardCandidates(root),
  ]);
}

/**
 * One semantic discovery path for every project page. Explicit contract roles
 * always win; the shared candidate collector owns adapters and the non-table
 * `data-page-list-item` convention so developer and marker discovery cannot drift.
 */
export function collectVisualPageRegionTargets(root: ParentNode, documentRoot: Document = document) {
  const result = new Map<VisualCardEditableRegionId, HTMLElement[]>();
  (Object.keys(VISUAL_PAGE_REGION_SELECTORS) as VisualCardEditableRegionId[]).forEach((regionId) => {
    result.set(regionId, collectVisualPageRegionTargetsForRegion(root, regionId, documentRoot));
  });
  return result;
}

export function formatVisualContractAnnotation(regionId: VisualCardEditableRegionId, index: number, count: number) {
  const label = VISUAL_PAGE_REGION_LABELS[regionId];
  if (count <= 1) return label;
  return `${label} ${String(index + 1).padStart(2, "0")}`;
}
