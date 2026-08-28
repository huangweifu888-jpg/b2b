import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

import {
  EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT,
  THREE_SOURCE_GLOBAL_FRAME_CONTRACT,
} from "../src/lib/layout-frame-contract";
import { buildPageFactoryRuntimeRoute, type PageFactoryRuntimeScope } from "../src/lib/page-factory-runtime-route";
import { VISUAL_CARD_DIRECT_APPLY_EVENT } from "../src/lib/visual-card-layout-contract";

const SITE_ID = process.env.B2B_E2E_SITE_ID || "verification-temp";
const FOOTER_SELECTOR =
  '[data-page-layout-footer][data-development-standard-frame-region="footer"]';

type OperationsReference = (typeof THREE_SOURCE_GLOBAL_FRAME_CONTRACT.operationsReferences)[number];

type RectSnapshot = {
  rendered: boolean;
  horizontalInsets: readonly [number, number];
};

type AbsoluteHorizontalRect = {
  x: number;
  right: number;
  width: number;
};

type FrameSnapshot = {
  sourceScope: string;
  pageId: string | null;
  boundaries: {
    rootInMain: RectSnapshot;
    titleInRoot: RectSnapshot;
    tableShellInRoot: RectSnapshot;
    tableHeaderInShell: RectSnapshot;
    contentInShell: RectSnapshot;
  };
  absolute: {
    shell: AbsoluteHorizontalRect;
    main: AbsoluteHorizontalRect;
    root: AbsoluteHorizontalRect;
    tableShell: AbsoluteHorizontalRect;
    content: AbsoluteHorizontalRect;
    footer: AbsoluteHorizontalRect;
  };
  tokens: {
    tableShellPadding: readonly [number, number, number, number];
    tableHeaderMinHeight: number;
    contentPadding: readonly [number, number, number, number];
    rootOverflowX: string;
    rootOverflowY: string;
    contentOverflowX: string;
    contentOverflowY: string;
    contentScrollbarGutter: string;
  };
  scroll: {
    ownerCount: number;
    contentClientHeight: number;
    contentScrollHeight: number;
  };
  horizontalOverflow: Record<string, number>;
};

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1024, height: 800 },
  { width: 640, height: 800 },
  { width: 390, height: 844 },
] as const;

type RuntimeRegistryPage = {
  id: string;
  route: string;
  sourceScope: PageFactoryRuntimeScope;
  template: string;
  status: string;
};

const pageFactoryRegistry = JSON.parse(
  readFileSync(new URL("../src/page-factory/page-registry.json", import.meta.url), "utf8"),
) as { pages: RuntimeRegistryPage[] };
const PAGE_FACTORY_PAGES = pageFactoryRegistry.pages;
const REGISTERED_LAYOUT_SCAN_TARGETS = PAGE_FACTORY_PAGES.map((entry) => ({
  pageId: entry.id,
  sourceScope: entry.sourceScope,
  template: entry.template,
  route: buildPageFactoryRuntimeRoute(entry),
}));
const DEVELOPER_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_IDS = [
  "auth-callback",
  "auth-error",
  "client-logout-callback",
  "client-preview-frame",
  "client-preview-site",
] as const;

const REGISTERED_RUNTIME_REPRESENTATIVE_PAGE_IDS = [
  "hq-product-market-operations",
  "hq-social-content-reviews",
  "hq-audit-release-logs",
  "hq-social-authorization",
  "hq-platform-config-live",
  "agency-source-product-market-operations",
  "agency-workspace",
  "agency-source-releases",
  "agency-oem",
  "agency-social-content-reviews",
  "agency-seo-tasks",
  "client-source-product-market-operations",
  "client-social-dashboard",
  "client-smart-ads-campaigns",
  "client-site-settings-general",
  "client-company-info",
  "client-social-schedule",
] as const;

const intentionalIsolationPageIds = new Set<string>(DEVELOPER_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_IDS);

function runtimeRepresentativeRoute(target: (typeof REGISTERED_LAYOUT_SCAN_TARGETS)[number]) {
  const url = new URL(target.route, "http://registered-page.local");
  if (target.sourceScope === "client_source") url.searchParams.set("siteId", SITE_ID);
  return `${url.pathname}${url.search}`;
}

function sourceTemplateKey(sourceScope: string, template: string) {
  return `${sourceScope}:${template}`;
}

test("registered source-template representatives consume one Developer and shared contract", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1280, height: 800 });

  const eligibleCombinations = new Set(PAGE_FACTORY_PAGES
    .filter((entry) => (entry.status === "complete" || entry.status === "pilot-complete")
      && !intentionalIsolationPageIds.has(entry.id))
    .map((entry) => sourceTemplateKey(entry.sourceScope, entry.template)));
  const representatives = REGISTERED_RUNTIME_REPRESENTATIVE_PAGE_IDS.map((pageId) => {
    const target = REGISTERED_LAYOUT_SCAN_TARGETS.find((entry) => entry.pageId === pageId);
    if (!target) throw new Error(`registered runtime representative is missing: ${pageId}`);
    return target;
  });
  const representedCombinations = new Set(representatives.map((entry) => sourceTemplateKey(entry.sourceScope, entry.template)));
  expect([...representedCombinations].sort(), "one real route for every populated source/template combination")
    .toEqual([...eligibleCombinations].sort());

  for (const target of representatives) {
    await test.step(`${target.sourceScope} ${target.template}: ${target.pageId}`, async () => {
      await page.goto(runtimeRepresentativeRoute(target), { waitUntil: "domcontentloaded" });
      await expect(page.locator(`[data-responsive-shell="${responsiveScope(target.sourceScope)}"]`)).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.locator("[data-page-route-error]"), `${target.pageId} route error`).toHaveCount(0);
      await expect(page.locator("[data-client-project-unavailable]"), `${target.pageId} must render a real workspace`).toHaveCount(0);

      const host = page.locator(
        `[data-responsive-page-host][data-developer-global-frame-resolved-page-id="${target.pageId}"]`,
      );
      await expect(host, `${target.pageId} shared responsive host`).toHaveCount(1);
      await expect(host).toBeVisible({ timeout: 60_000 });
      await expect(host).toHaveAttribute("data-responsive-content-ready", "true", { timeout: 60_000 });
      await expect(host).toHaveAttribute("data-developer-global-frame-resolved-adapter", /.+/u);
      await expect(host).toHaveAttribute("data-developer-global-frame-resolved-strategy", /^(?:explicit-exception|template-projection)$/u);
      await expect(host).toHaveAttribute("data-shared-window-contract", /.+/u);
      await expect(host).toHaveAttribute("data-shared-window-factory-default", /.+/u);

      const factoryRoot = page.locator(`[data-page-factory-page-id="${target.pageId}"]`);
      await expect(factoryRoot, `${target.pageId} unique Page Factory root`).toHaveCount(1);
      await expect(factoryRoot).toBeVisible({ timeout: 60_000 });
      await expect(factoryRoot).toHaveAttribute("data-page-factory-template", target.template);
    });
  }
});

function responsiveScope(sourceScope: OperationsReference["sourceScope"]) {
  if (sourceScope === "agency_source") return "agency-source";
  if (sourceScope === "client_source") return "client-source";
  return sourceScope;
}

function routeFor(reference: Pick<OperationsReference, "route" | "sourceScope">) {
  if (reference.sourceScope !== "client_source") return reference.route;
  return `${reference.route}&siteId=${encodeURIComponent(SITE_ID)}`;
}

function marketingRoute() {
  return `${THREE_SOURCE_GLOBAL_FRAME_CONTRACT.comparisonPilot.route}&siteId=${encodeURIComponent(SITE_ID)}`;
}

async function settleLayout(page: Page) {
  await page.evaluate(async () => {
    await Promise.race([
      document.fonts?.ready,
      new Promise<void>((resolve) => window.setTimeout(resolve, 2_000)),
    ]);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

async function loadOperations(page: Page, reference: OperationsReference) {
  await page.goto(routeFor(reference), { waitUntil: "domcontentloaded" });
  await expect(page.locator(`[data-responsive-shell="${responsiveScope(reference.sourceScope)}"]`)).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-page-route-error]")).toHaveCount(0);
  const hydration = page.locator("[data-product-market-hydrated]");
  if (await hydration.count()) {
    await expect(hydration).toHaveAttribute("data-product-market-hydrated", "true", { timeout: 60_000 });
  }
  await expect(page.locator(reference.shellSelector)).toHaveCount(1);
  await expect(page.locator(reference.shellSelector).locator(reference.mainSelector)).toHaveCount(1);
  await expect(page.locator(THREE_SOURCE_GLOBAL_FRAME_CONTRACT.canonicalRootSelector)).toHaveCount(1);
  await expect(page.locator(THREE_SOURCE_GLOBAL_FRAME_CONTRACT.canonicalRootSelector)).toBeVisible({ timeout: 60_000 });
  await settleLayout(page);
}

async function loadMarketing(page: Page) {
  await page.goto(marketingRoute(), { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-responsive-shell="client-source"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-page-route-error]")).toHaveCount(0);
  await expect(page.locator("[data-social-marketing-playbook]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(THREE_SOURCE_GLOBAL_FRAME_CONTRACT.canonicalRootSelector)).toHaveCount(1);
  await expect(page.locator(THREE_SOURCE_GLOBAL_FRAME_CONTRACT.canonicalRootSelector)).toBeVisible();
  await settleLayout(page);
}

async function expectCanonicalRegions(page: Page, expectedPageId: string, shellSelector: string) {
  const root = page.locator(THREE_SOURCE_GLOBAL_FRAME_CONTRACT.canonicalRootSelector);
  await expect(root).toHaveCount(1);
  await expect(root).toHaveAttribute("data-page-factory-page-id", expectedPageId);
  const regionCounts = await root.evaluate((element, selectors) => ({
    title: element.querySelectorAll(selectors.title).length,
    tableShell: element.querySelectorAll(selectors.tableShell).length,
    tableHeader: element.querySelectorAll(selectors.tableHeader).length,
    content: element.querySelectorAll(selectors.content).length,
  }), EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.regionSelectors);
  expect(regionCounts, `${expectedPageId} unique canonical frame regions`).toEqual({
    title: 1,
    tableShell: 1,
    tableHeader: 1,
    content: 1,
  });
  await expect(page.locator(THREE_SOURCE_GLOBAL_FRAME_CONTRACT.scrollOwnerSelector)).toHaveCount(1);
  await expect(page.locator(shellSelector).locator(FOOTER_SELECTOR)).toHaveCount(1);
}

async function captureFrame(
  page: Page,
  sourceScope: string,
  shellSelector: string,
  mainSelector: string,
): Promise<FrameSnapshot> {
  return page.evaluate(
    ({ canonicalRootSelector, contentSelector, footerSelector, regionSelectors, shellSelector, mainSelector, sourceScope }) => {
      const shell = document.querySelector<HTMLElement>(shellSelector);
      const main = shell?.querySelector<HTMLElement>(mainSelector) ?? null;
      const root = document.querySelector<HTMLElement>(canonicalRootSelector);
      const title = root?.querySelector<HTMLElement>(regionSelectors.title) ?? null;
      const tableShell = root?.querySelector<HTMLElement>(regionSelectors.tableShell) ?? null;
      const tableHeader = root?.querySelector<HTMLElement>(regionSelectors.tableHeader) ?? null;
      const content = root?.querySelector<HTMLElement>(regionSelectors.content) ?? null;
      const footer = shell?.querySelector<HTMLElement>(footerSelector) ?? null;
      if (!shell || !main || !root || !title || !tableShell || !tableHeader || !content || !footer) {
        throw new Error(`incomplete canonical frame for ${sourceScope}`);
      }

      const numeric = (value: string) => Number.parseFloat(value) || 0;
      const padding = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        return [
          numeric(style.paddingTop),
          numeric(style.paddingRight),
          numeric(style.paddingBottom),
          numeric(style.paddingLeft),
        ] as const;
      };
      const relative = (inner: HTMLElement, outer: HTMLElement): RectSnapshot => {
        const innerRect = inner.getBoundingClientRect();
        const outerRect = outer.getBoundingClientRect();
        const style = getComputedStyle(inner);
        const rendered =
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          innerRect.width > 0 &&
          innerRect.height > 0;
        return {
          rendered,
          horizontalInsets: [innerRect.left - outerRect.left, outerRect.right - innerRect.right] as const,
        };
      };
      const absolute = (element: HTMLElement): AbsoluteHorizontalRect => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, right: rect.right, width: rect.width };
      };
      const overflow = (element: HTMLElement) => Math.max(0, element.scrollWidth - element.clientWidth);
      const rootStyle = getComputedStyle(root);
      const headerStyle = getComputedStyle(tableHeader);
      const contentStyle = getComputedStyle(content);

      return {
        sourceScope,
        pageId: root.getAttribute("data-page-factory-page-id"),
        boundaries: {
          rootInMain: relative(root, main),
          titleInRoot: relative(title, root),
          tableShellInRoot: relative(tableShell, root),
          tableHeaderInShell: relative(tableHeader, tableShell),
          contentInShell: relative(content, tableShell),
        },
        absolute: {
          shell: absolute(shell),
          main: absolute(main),
          root: absolute(root),
          tableShell: absolute(tableShell),
          content: absolute(content),
          footer: absolute(footer),
        },
        tokens: {
          tableShellPadding: padding(tableShell),
          tableHeaderMinHeight: numeric(headerStyle.minHeight),
          contentPadding: padding(content),
          rootOverflowX: rootStyle.overflowX,
          rootOverflowY: rootStyle.overflowY,
          contentOverflowX: contentStyle.overflowX,
          contentOverflowY: contentStyle.overflowY,
          contentScrollbarGutter: contentStyle.scrollbarGutter,
        },
        scroll: {
          ownerCount: document.querySelectorAll(contentSelector).length,
          contentClientHeight: content.clientHeight,
          contentScrollHeight: content.scrollHeight,
        },
        horizontalOverflow: {
          document: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
          body: Math.max(0, document.body.scrollWidth - document.body.clientWidth),
          shell: overflow(shell),
          main: overflow(main),
          root: overflow(root),
          tableShell: overflow(tableShell),
          content: overflow(content),
          footer: overflow(footer),
        },
      };
    },
    {
      canonicalRootSelector: THREE_SOURCE_GLOBAL_FRAME_CONTRACT.canonicalRootSelector,
      contentSelector: THREE_SOURCE_GLOBAL_FRAME_CONTRACT.scrollOwnerSelector,
      footerSelector: FOOTER_SELECTOR,
      regionSelectors: EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.regionSelectors,
      shellSelector,
      mainSelector,
      sourceScope,
    },
  );
}

function expectNoHorizontalOverflow(snapshot: FrameSnapshot, label: string) {
  for (const [surface, overflow] of Object.entries(snapshot.horizontalOverflow)) {
    expect(overflow, `${label} ${surface} horizontal overflow`).toBeLessThanOrEqual(1);
  }
  expect(snapshot.scroll.ownerCount, `${label} unique content scroll owner`).toBe(1);
  expect(snapshot.scroll.contentClientHeight, `${label} content has a real viewport`).toBeGreaterThan(0);
  expect(snapshot.scroll.contentScrollHeight, `${label} content owns the vertical scroll range`).toBeGreaterThan(
    snapshot.scroll.contentClientHeight,
  );
  expect(snapshot.tokens.contentOverflowX, `${label} content x overflow`).toMatch(/^(clip|hidden)$/u);
  expect(snapshot.tokens.contentOverflowY, `${label} content y overflow`).toMatch(/^(auto|scroll)$/u);
  expect(snapshot.tokens.contentScrollbarGutter, `${label} stable content scrollbar`).toContain("stable");
}

function expectTupleNear(actual: readonly number[], expected: readonly number[], label: string) {
  expect(actual, `${label} tuple length`).toHaveLength(expected.length);
  actual.forEach((value, index) => {
    expect(value, `${label}[${index}]`).toBeCloseTo(expected[index], 0);
  });
}

function expectFrameParity(actual: FrameSnapshot, reference: FrameSnapshot, label: string) {
  for (const key of Object.keys(reference.boundaries) as Array<keyof FrameSnapshot["boundaries"]>) {
    const actualBoundary = actual.boundaries[key];
    const referenceBoundary = reference.boundaries[key];
    expect(actualBoundary.rendered, `${label} ${key} visibility`).toBe(referenceBoundary.rendered);
    if (actualBoundary.rendered && referenceBoundary.rendered) {
      expectTupleNear(actualBoundary.horizontalInsets, referenceBoundary.horizontalInsets, `${label} ${key}`);
    }
  }
  for (const surface of Object.keys(reference.absolute) as Array<keyof FrameSnapshot["absolute"]>) {
    for (const dimension of ["x", "right", "width"] as const) {
      expect(
        Math.abs(actual.absolute[surface][dimension] - reference.absolute[surface][dimension]),
        `${label} ${surface}.${dimension} absolute parity`,
      ).toBeLessThanOrEqual(1);
    }
  }
  expectTupleNear(actual.tokens.tableShellPadding, reference.tokens.tableShellPadding, `${label} table-shell padding`);
  expect(actual.tokens.tableHeaderMinHeight, `${label} table-header min-height`).toBeCloseTo(
    reference.tokens.tableHeaderMinHeight,
    0,
  );
  expectTupleNear(actual.tokens.contentPadding, reference.tokens.contentPadding, `${label} content padding`);
  expect(actual.tokens.rootOverflowX, `${label} root overflow-x`).toBe(reference.tokens.rootOverflowX);
  expect(actual.tokens.rootOverflowY, `${label} root overflow-y`).toBe(reference.tokens.rootOverflowY);
  expect(actual.tokens.contentOverflowX, `${label} content overflow-x`).toBe(reference.tokens.contentOverflowX);
  expect(actual.tokens.contentOverflowY, `${label} content overflow-y`).toBe(reference.tokens.contentOverflowY);
  expect(actual.tokens.contentScrollbarGutter, `${label} scrollbar gutter`).toBe(reference.tokens.contentScrollbarGutter);
}

for (const viewport of VIEWPORTS) {
  test(`three-source Operations frames and client Marketing outer frame stay shared at ${viewport.width}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize(viewport);

    const operationSnapshots: FrameSnapshot[] = [];
    for (const reference of THREE_SOURCE_GLOBAL_FRAME_CONTRACT.operationsReferences) {
      await test.step(`${reference.sourceScope} Operations`, async () => {
        await loadOperations(page, reference);
        await expectCanonicalRegions(page, reference.pageId, reference.shellSelector);
        const snapshot = await captureFrame(page, reference.sourceScope, reference.shellSelector, reference.mainSelector);
        expect(snapshot.pageId).toBe(reference.pageId);
        expectNoHorizontalOverflow(snapshot, `${reference.sourceScope} Operations @${viewport.width}`);
        operationSnapshots.push(snapshot);
      });
    }

    const hqReference = operationSnapshots[0];
    for (const snapshot of operationSnapshots.slice(1)) {
      expectFrameParity(snapshot, hqReference, `${snapshot.sourceScope} versus hq @${viewport.width}`);
    }

    const clientReference = THREE_SOURCE_GLOBAL_FRAME_CONTRACT.operationsReferences.find(
      (reference) => reference.sourceScope === "client_source",
    );
    if (!clientReference) throw new Error("missing client-source Operations reference");
    const clientOperations = operationSnapshots.find((snapshot) => snapshot.sourceScope === "client_source");
    if (!clientOperations) throw new Error("missing client-source Operations snapshot");

    await test.step("client-source Marketing comparison pilot", async () => {
      await loadMarketing(page);
      await expectCanonicalRegions(
        page,
        THREE_SOURCE_GLOBAL_FRAME_CONTRACT.comparisonPilot.pageId,
        clientReference.shellSelector,
      );
      const marketing = await captureFrame(
        page,
        THREE_SOURCE_GLOBAL_FRAME_CONTRACT.comparisonPilot.sourceScope,
        clientReference.shellSelector,
        clientReference.mainSelector,
      );
      expectNoHorizontalOverflow(marketing, `client-source Marketing @${viewport.width}`);
      expectFrameParity(marketing, clientOperations, `Marketing versus Operations @${viewport.width}`);
    });
  });
}

for (const reference of THREE_SOURCE_GLOBAL_FRAME_CONTRACT.operationsReferences) {
  test(`${reference.sourceScope} Operations global Visual targets the shared frame exactly once`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await loadOperations(page, reference);
    await expectCanonicalRegions(page, reference.pageId, reference.shellSelector);

    await page.evaluate((eventName) => {
      document.documentElement.dataset.e2eVisualDirectApplyCount = "0";
      window.addEventListener(eventName, () => {
        const root = document.documentElement;
        root.dataset.e2eVisualDirectApplyCount = String(Number(root.dataset.e2eVisualDirectApplyCount || "0") + 1);
      });
    }, VISUAL_CARD_DIRECT_APPLY_EVENT);

    const launcher = page.locator("[data-visual-card-developer-launcher]");
    await expect(launcher).toHaveCount(1);
    await expect(launcher).toBeVisible({ timeout: 60_000 });
    await expect(launcher).toBeEnabled();
    await launcher.click({ timeout: 10_000 });
    await expect(page.locator("html")).toHaveAttribute("data-visual-card-editor-open", "", { timeout: 10_000 });
    await expect(page.locator("[data-visual-card-editor-dock]")).toBeVisible({ timeout: 10_000 });

    const currentPageScope = page.locator('[data-visual-card-application-scope="current-page"]');
    await expect(currentPageScope).toHaveCount(1);
    await currentPageScope.click({ timeout: 10_000 });
    await expect(currentPageScope).toHaveAttribute("aria-pressed", "true");

    for (const regionId of ["table-header", "content"] as const) {
      const selector = page.locator(`[data-visual-card-region-item-select="${regionId}"]`);
      await expect(selector, `${reference.sourceScope} current-page ${regionId} selector`).toHaveCount(1);
      await selector.click({ timeout: 10_000 });
      await expect(selector).toHaveAttribute("aria-pressed", "true");
      await expect(
        page.locator(`[data-visual-card-runtime-region="${regionId}"]`),
        `${reference.sourceScope} current-page ${regionId} runtime targetCount`,
      ).toHaveCount(1);
      await expect(
        page.locator(`[data-visual-contract-region="${regionId}"]`),
        `${reference.sourceScope} current-page ${regionId} contract targetCount`,
      ).toHaveCount(1);
    }

    const globalScope = page.locator(
      `[data-visual-card-application-scope="${THREE_SOURCE_GLOBAL_FRAME_CONTRACT.visualApplicationScope}"]`,
    );
    await expect(globalScope).toHaveCount(1);
    await globalScope.click({ timeout: 10_000 });
    await expect(globalScope).toHaveAttribute("aria-pressed", "true");

    for (const regionId of ["workspace", "title", "table-shell", "footer"] as const) {
      const selector = page.locator(`[data-visual-card-region-item-select="${regionId}"]`);
      await expect(selector, `${reference.sourceScope} ${regionId} selector`).toHaveCount(1);
      await selector.click({ timeout: 10_000 });
      await expect(selector).toHaveAttribute("aria-pressed", "true");
      await expect(
        page.locator(`[data-visual-card-runtime-region="${regionId}"]`),
        `${reference.sourceScope} ${regionId} runtime targetCount`,
      ).toHaveCount(1);
      await expect(
        page.locator(`[data-visual-contract-region="${regionId}"]`),
        `${reference.sourceScope} ${regionId} contract targetCount`,
      ).toHaveCount(1);
    }

    await expect(page.locator("html")).toHaveAttribute("data-e2e-visual-direct-apply-count", "0");
    await page.locator("[data-visual-card-editor-close]").click({ timeout: 10_000 });
    await expect(page.locator("[data-visual-card-editor-dock]")).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveAttribute("data-visual-card-editor-open", /.+/u);
    await expect(page.locator('[data-visual-card-runtime-region]')).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("data-e2e-visual-direct-apply-count", "0");
  });
}
