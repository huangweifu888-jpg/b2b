import { LAYOUT_QUALITY_BASELINES, PRODUCT_MARKET_FRAME_ACCEPTANCE } from "@/lib/layout-quality-baselines";
import { inspectSharedVisualParity, type SharedVisualParityReport } from "@/lib/shared-visual-parity-contract";
import { buildPageFactoryRuntimeRoute } from "@/lib/page-factory-runtime-route";
import {
  PAGE_FACTORY_PAGES,
  type PageFactoryScope,
  type PageFactoryTemplate,
} from "@/page-factory/page-factory";

/** Visual regressions verify only the shared visible frame, never business data. */
export const LAYOUT_SCREENSHOT_REGRESSIONS = [...LAYOUT_QUALITY_BASELINES, ...PRODUCT_MARKET_FRAME_ACCEPTANCE].map((baseline) => ({
  ...baseline,
  source: baseline.id.includes("product-market-") ? "product-market" : "business",
  regions: ["主体", "标题", "表头", "内容", "右侧滚条", "尾栏"] as const,
}));

export const HOMEPAGE_BANNER_SCREENSHOT_BASELINE = LAYOUT_SCREENSHOT_REGRESSIONS.find(
  ({ id }) => id === "homepage-banner",
)!;

export type RegisteredLayoutScanTarget = {
  pageId: string;
  sourceScope: PageFactoryScope;
  template: PageFactoryTemplate;
  route: string;
};

/** Materializes one read-only local route for every registered Page Factory identity. */
export const buildRegisteredLayoutScanRoute = buildPageFactoryRuntimeRoute;

/** The Development Specification scans registry truth, never a hand-written sample list. */
export const REGISTERED_LAYOUT_SCAN_TARGETS = Object.freeze(PAGE_FACTORY_PAGES.map((page) => Object.freeze({
  pageId: page.id,
  sourceScope: page.sourceScope,
  template: page.template,
  route: buildRegisteredLayoutScanRoute(page),
} satisfies RegisteredLayoutScanTarget)));

export type RuntimeFrameCheck = {
  frame: boolean;
  title: boolean;
  footer: boolean;
  factoryIdentity: boolean;
  legacyDialogBridges: number;
  parity: SharedVisualParityReport;
  passed: boolean;
};

/** The Quality Center's immediate check mirrors the selectors used by screenshot validation. */
export function inspectRuntimeLayoutFrame(root: ParentNode = document, expectedPageId?: string): RuntimeFrameCheck {
  const frame = Boolean(root.querySelector("[data-page-layout-frame]"));
  const title = Boolean(root.querySelector("[data-page-title], [data-shared-layout-section='title']"));
  const footer = Boolean(root.querySelector("[data-page-layout-footer], [data-nav-tailbar]"));
  const factoryIdentity = !expectedPageId
    || root.querySelectorAll(`[data-page-factory-page-id="${CSS.escape(expectedPageId)}"]`).length === 1;
  const legacyDialogBridges = root.querySelectorAll("[data-legacy-dialog-bridge], [data-layout-dialog-bridge], .legacy-dialog-bridge").length;
  const parity = inspectSharedVisualParity(root);
  return {
    frame,
    title,
    footer,
    factoryIdentity,
    legacyDialogBridges,
    parity,
    passed: frame && title && footer && factoryIdentity && legacyDialogBridges === 0 && parity.passed,
  };
}

export type RuntimePageFrameCheck = RuntimeFrameCheck & {
  route: string;
  pageId?: string;
  sourceScope?: PageFactoryScope;
  template?: PageFactoryTemplate;
  error?: string;
  /** Business access gates are valid page states, not visual-contract failures. */
  unavailable?: boolean;
};

export type RuntimeFrameIssue = {
  id: "workspace" | "title" | "footer" | "factory-identity" | "legacy-dialog" | "shared-visual-parity" | "load";
  label: string;
  recovery: "开发规范";
};

/** Gives Quality Center a precise, non-destructive recovery destination. */
export function getRuntimeFrameIssues(check: RuntimePageFrameCheck): readonly RuntimeFrameIssue[] {
  const issues: RuntimeFrameIssue[] = [];
  if (check.error) issues.push({ id: "load", label: check.error, recovery: "开发规范" });
  if (!check.frame) issues.push({ id: "workspace", label: "主体缺失", recovery: "开发规范" });
  if (!check.title) issues.push({ id: "title", label: "标题缺失", recovery: "开发规范" });
  if (!check.footer) issues.push({ id: "footer", label: "尾栏缺失", recovery: "开发规范" });
  if (!check.factoryIdentity) issues.push({ id: "factory-identity", label: "Page Factory 页面身份错位", recovery: "开发规范" });
  if (check.legacyDialogBridges > 0) issues.push({ id: "legacy-dialog", label: `旧弹窗桥接 ${check.legacyDialogBridges}`, recovery: "开发规范" });
  if (check.parity && !check.parity.passed) issues.push({ id: "shared-visual-parity", label: `共享契约差异 ${check.parity.issues.length}`, recovery: "开发规范" });
  return issues;
}

export type RuntimePageFrameScan = {
  checkedAt: string;
  items: readonly RuntimePageFrameCheck[];
  passed: number;
  failed: number;
  unavailable: number;
};

const waitForFrameInDocument = (frame: HTMLIFrameElement, timeoutMs: number, expectedPageId?: string) => new Promise<Document>((resolve, reject) => {
  const startedAt = Date.now();
  const check = () => {
    try {
      const documentRoot = frame.contentDocument;
      if (documentRoot?.querySelector("[data-page-route-error]")) return reject(new Error("页面路由加载异常"));
      if (documentRoot?.querySelector("[data-client-project-unavailable]")) return resolve(documentRoot);
      const expectedIdentity = !expectedPageId
        || Boolean(documentRoot?.querySelector(`[data-page-factory-page-id="${CSS.escape(expectedPageId)}"]`));
      const responsiveReady = Boolean(documentRoot?.querySelector('[data-responsive-page-host][data-responsive-content-ready="true"]'));
      if (documentRoot && expectedIdentity && responsiveReady) return resolve(documentRoot);
      // Once the route itself has settled, return the document so a missing
      // shared region is reported as a contract failure instead of a timeout.
      if (documentRoot?.readyState === "complete" && Date.now() - startedAt >= 3_000) return resolve(documentRoot);
    } catch {
      return reject(new Error("页面无法读取"));
    }
    if (Date.now() - startedAt >= timeoutMs) return reject(new Error("等待共享主体超时"));
    window.setTimeout(check, 120);
  };
  check();
});

/** Sequentially loads routes in a sandboxed iframe and checks their shared frame. */
export async function inspectRegisteredLayoutPages(
  targets: readonly (string | RegisteredLayoutScanTarget)[],
  timeoutMs = 8_000,
): Promise<RuntimePageFrameScan> {
  const items: RuntimePageFrameCheck[] = [];
  for (const target of targets) {
    const descriptor = typeof target === "string" ? { route: target } : target;
    const { route } = descriptor;
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.sandbox.add("allow-scripts", "allow-same-origin");
    frame.tabIndex = -1;
    frame.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:-9999px;border:0";
    document.body.appendChild(frame);
    try {
      frame.src = new URL(route, window.location.origin).toString();
      const frameDocument = await waitForFrameInDocument(frame, timeoutMs, descriptor.pageId);
      const unavailable = Boolean(frameDocument.querySelector("[data-client-project-unavailable]"));
      if (unavailable) {
        items.push({
          ...descriptor,
          route,
          frame: false,
          title: false,
          footer: false,
          factoryIdentity: false,
          legacyDialogBridges: 0,
          parity: { checkedAt: new Date().toISOString(), route, checkedFactors: 0, issues: [], passed: false },
          passed: false,
          unavailable: true,
        });
      } else {
        items.push({ ...descriptor, route, ...inspectRuntimeLayoutFrame(frameDocument, descriptor.pageId) });
      }
    } catch (error) {
      items.push({
        ...descriptor,
        route,
        frame: false,
        title: false,
        footer: false,
        factoryIdentity: false,
        legacyDialogBridges: 0,
        parity: { checkedAt: new Date().toISOString(), route, checkedFactors: 0, issues: [], passed: false },
        passed: false,
        error: error instanceof Error ? error.message : "检查失败",
      });
    } finally {
      frame.remove();
    }
  }
  const passed = items.filter((item) => item.passed).length;
  const unavailable = items.filter((item) => item.unavailable).length;
  const failed = items.filter((item) => !item.passed && !item.unavailable).length;
  return { checkedAt: new Date().toISOString(), items, passed, failed, unavailable };
}
