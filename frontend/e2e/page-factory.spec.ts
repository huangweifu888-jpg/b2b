import { expect, test } from "@playwright/test";
import pageFactoryStandard from "../src/page-factory/page-factory-standard.json" with { type: "json" };

const SITE_ID = process.env.B2B_E2E_SITE_ID || "verification-temp";
const PILOT_ROUTE = `/zb/client-source/product-analysis?tab=keyword-planner&siteId=${encodeURIComponent(SITE_ID)}`;
const FACTORY_VERSION = pageFactoryStandard.factoryVersion;

function factoryRegionSelector(region: string, visible = false) {
  const selectors = region === "scrollbar"
    ? ['[data-page-factory-region="scrollbar"]', "[data-page-list-scroll-owner]"]
    : [`[data-page-factory-region="${region}"]`];
  return selectors.map((selector) => `${selector}${visible ? ":visible" : ""}`).join(",");
}

const EMPTY_PLATFORM_OVERVIEW = {
  status: "ready",
  counts: { organizations: 0, projects: 0, roles: 0, memberships: 0, backups: 0, aiProviders: 0 },
  tech_stack: { primary_languages: [], supporting_languages: [] },
  deployment_strategy: [],
  implemented: [],
  next: [],
};

test.beforeEach(async ({ page }) => {
  // Page Factory E2E validates rendered contracts, not tenant data. Keep this
  // suite deterministic and database-free even when a local API is listening.
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() === "GET" && pathname === "/api/v1/platform/overview") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(EMPTY_PLATFORM_OVERVIEW) });
      return;
    }
    if (
      request.method() === "GET" &&
      /^\/api\/v1\/platform\/(tree|organizations|projects|roles|memberships|ai-providers|ai-assignments)$/.test(pathname)
    ) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
      return;
    }
    await route.abort("blockedbyclient");
  });
});

test("interest search is a registered page-factory pilot and passes the Developer inspection", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(PILOT_ROUTE, { waitUntil: "domcontentloaded" });

  const factoryPage = page.locator('[data-page-factory-page-id="product-analysis-interest-search"]');
  await expect(factoryPage).toBeVisible({ timeout: 60_000 });
  await expect(factoryPage).toHaveAttribute("data-page-factory-contract", FACTORY_VERSION);
  await expect(factoryPage).toHaveAttribute("data-page-factory-template", "workflow");
  await expect(factoryPage).toHaveAttribute("data-page-factory-source-scope", "client_source");

  for (const region of ["body", "title-2", "table-shell", "table-header", "content", "large-card", "small-card", "scrollbar"]) {
    await expect(page.locator(factoryRegionSelector(region, true)).first()).toBeVisible();
  }

  const developerLauncher = page.locator('[data-development-application-launcher]:visible').first();
  await expect(developerLauncher).toBeVisible();
  await developerLauncher.click();
  await expect(page.locator("[data-development-standard-apply-dialog]")).toBeVisible();
  await expect(page.locator("[data-global-frame-toggle-page-factory]")).toHaveCount(0);
  await page.locator('[data-development-standard-style-nav-item="page-factory"]').click();

  const workbench = page.locator("[data-page-factory-workbench]");
  await expect(workbench).toBeVisible();
  await expect(workbench).toHaveAttribute("data-page-factory-version", FACTORY_VERSION);
  await expect(workbench.locator('[data-page-factory-registry-item="product-analysis-interest-search"]')).toBeVisible();
  await workbench.locator("[data-page-factory-run-inspection]").click();
  await expect(workbench.locator('[data-page-factory-region-status="missing"]')).toHaveCount(0);
  await expect(workbench.locator('[data-page-factory-capability-status="missing"]')).toHaveCount(0);
  await expect(workbench.locator('[data-page-factory-region-status="passed"]')).toHaveCount(11);
  await expect(workbench.locator('[data-page-factory-capability-status="passed"]')).toHaveCount(6);

  const usageGuide = page.locator("[data-page-factory-usage-guide]");
  await expect(usageGuide).toBeVisible();
  expect(await usageGuide.locator(":scope > li").count()).toBeGreaterThanOrEqual(4);
  await expect(page.locator("[data-page-factory-protected-boundary]")).toContainText("固定保护边界");
  const dialog = page.locator("[data-development-standard-apply-dialog]");
  await expect(dialog.locator("[data-development-standard-apply-console]")).toHaveAttribute("data-development-standard-navigation-order-migration", "09:page-factory->07,07:page-lock->08");
  await expect(dialog.locator('[data-development-standard-style-nav-item="page-factory"]')).not.toHaveAttribute("title", /.+/);
  await expect(dialog.locator('[data-development-standard-style-nav-item="page-lock"]')).not.toHaveAttribute("title", /.+/);
  await expect(dialog.locator("[data-development-standard-application-record-projection]")).toHaveCount(0);
  const nextStep = dialog.locator('[data-development-standard-next-step="page-lock"]');
  await expect(nextStep).toHaveAttribute("data-development-standard-next-gate-status", "not-applicable");
  await expect(nextStep).toBeEnabled();
  await expect(nextStep).toContainText("08 页面锁定器");
  await nextStep.click();
  await expect(dialog.locator("[data-development-standard-page-lock-tree]")).toBeVisible();
});

test("Page Factory isolates current-page inspection state and incrementally reveals the registry", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(PILOT_ROUTE, { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-page-factory-page-id="product-analysis-interest-search"]')).toBeVisible({ timeout: 60_000 });

  const developerLauncher = page.locator('[data-development-application-launcher]:visible').first();
  await developerLauncher.click();
  const dialog = page.locator("[data-development-standard-apply-dialog]");
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-development-standard-style-nav-item="page-factory"]').click();

  const workbench = dialog.locator("[data-page-factory-workbench]");
  const registryItems = workbench.locator("[data-page-factory-registry-item]");
  const registryPagination = workbench.locator("[data-page-factory-registry-pagination]");
  await expect(workbench).toHaveAttribute("data-page-factory-selected-page", "product-analysis-interest-search");
  await expect(workbench).toHaveAttribute("data-page-factory-registered-page", "product-analysis-interest-search");
  await expect(registryItems).toHaveCount(20);
  await expect(registryPagination).toHaveAttribute("data-page-factory-registry-visible-count", "20");
  const registryTotal = Number(await registryPagination.getAttribute("data-page-factory-registry-total"));
  expect(registryTotal).toBeGreaterThan(40);

  await workbench.locator("[data-page-factory-registry-load-more]").click();
  await expect(registryItems).toHaveCount(40);
  await expect(registryPagination).toHaveAttribute("data-page-factory-registry-visible-count", "40");
  await workbench.locator("[data-page-factory-registry-show-all]").click();
  await expect(registryItems).toHaveCount(registryTotal);
  await expect(registryPagination).toHaveAttribute("data-page-factory-registry-visible-count", String(registryTotal));
  await expect(workbench.locator("[data-page-factory-registry-load-more]")).toHaveCount(0);
  await expect(workbench.locator("[data-page-factory-registry-show-all]")).toHaveCount(0);

  const inspection = workbench.locator("[data-page-factory-current-inspection]");
  await workbench.locator("[data-page-factory-run-inspection]").click();
  await expect(inspection).toHaveAttribute("data-page-factory-inspection-state", "checked");
  await expect(inspection).toHaveAttribute("data-page-factory-inspection-page", "product-analysis-interest-search");
  await expect(workbench.locator('[data-page-factory-region-status="passed"]')).toHaveCount(11);

  await workbench.locator('[data-page-factory-registry-item="client-dashboard"]').click();
  await expect(workbench).toHaveAttribute("data-page-factory-selected-page", "client-dashboard");
  await expect(inspection).toHaveAttribute("data-page-factory-inspection-state", "idle");
  await expect(inspection).toContainText("打开该页面后才能使用当前页检查结果");
  await expect(workbench.locator('[data-page-factory-region-status="passed"]')).toHaveCount(0);
  expect(await workbench.locator('[data-page-factory-region-status="missing"]').count()).toBeGreaterThan(0);
  await expect(workbench.locator("[data-page-factory-run-inspection]")).toBeDisabled();

  await page.evaluate((siteId) => {
    window.history.pushState({}, "", `/zb/client-source/product-analysis?tab=trends&siteId=${encodeURIComponent(siteId)}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, SITE_ID);
  await expect(page).toHaveURL(/tab=trends/u);
  await expect(workbench).toHaveAttribute("data-page-factory-registered-page", "product-analysis-trends");
  await expect(workbench).toHaveAttribute("data-page-factory-selected-page", "product-analysis-trends");
  await expect(workbench.locator('[data-page-factory-registry-item="product-analysis-trends"]')).toBeVisible();
  await expect(inspection).toHaveAttribute("data-page-factory-inspection-state", "idle");
  await expect(inspection).toContainText("等待运行");
  await expect(workbench.locator("[data-page-factory-run-inspection]")).toBeEnabled();
  await expect(registryPagination).toHaveAttribute("data-page-factory-registry-visible-count", "21");
  await expect(registryPagination).toContainText(`21/${registryTotal}`);
});

test("every Product Analysis title-2 marker uses the shared left frame start", async ({ page }) => {
  test.setTimeout(120_000);
  const routes = [
    { id: "product-analysis-interest-search", tab: "keyword-planner" },
    { id: "product-analysis-trends", tab: "trends" },
    { id: "product-analysis-data-studio", tab: "data-studio" },
    { id: "product-analysis-market-finder", tab: "market-finder" },
    { id: "product-analysis-global-market", tab: "global-market" },
  ] as const;

  await page.setViewportSize({ width: 1280, height: 800 });
  for (const item of routes) {
    await page.goto(`/zb/client-source/product-analysis?tab=${item.tab}&siteId=${encodeURIComponent(SITE_ID)}`, { waitUntil: "domcontentloaded" });
    const factoryPage = page.locator(`[data-page-factory-page-id="${item.id}"]`);
    await expect(factoryPage).toBeVisible({ timeout: 60_000 });
    const title2 = factoryPage.locator('[data-page-factory-region="title-2"][data-development-standard-frame-region="title-2"]');
    await expect(title2).toHaveCount(1);
    await expect(title2).toBeVisible();
    await title2.hover({ force: true });

    const marker = await title2.evaluate((element) => {
      const style = getComputedStyle(element, "::after");
      const content = style.content.replace(/^['"]|['"]$/gu, "");
      return {
        content,
        display: style.display,
        left: Number.parseFloat(style.left),
        writingMode: style.writingMode,
        insideCanonicalWorkspace: Boolean(element.closest('[data-page-factory-frame-owner="existing-workspace"][data-shared-page-workspace][data-development-standard-frame-region="body"]')),
      };
    });

    expect(marker.content, item.tab).toBe("标题2");
    expect(["flex", "inline-flex"], item.tab).toContain(marker.display);
    expect(marker.left, item.tab).toBeCloseTo(8, 0);
    expect(marker.writingMode, item.tab).toBe("horizontal-tb");
    expect(marker.insideCanonicalWorkspace, item.tab).toBe(true);
  }
});

test("interest search keeps the workflow readable at 390px without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(PILOT_ROUTE, { waitUntil: "domcontentloaded" });

  const factoryPage = page.locator('[data-page-factory-page-id="product-analysis-interest-search"]');
  await expect(factoryPage).toBeVisible({ timeout: 60_000 });
  await expect(factoryPage.locator('[data-page-factory-region="large-card"]')).toHaveCount(2);
  await expect(factoryPage.locator('[data-page-factory-region="small-card"]')).toHaveCount(5);

  const overflow = await page.evaluate(() => {
    const pageFactory = document.querySelector<HTMLElement>("[data-page-factory-contract]");
    return {
      document: document.documentElement.scrollWidth - window.innerWidth,
      pageFactory: pageFactory ? pageFactory.scrollWidth - pageFactory.clientWidth : 999,
    };
  });
  expect(overflow.document).toBeLessThanOrEqual(1);
  expect(overflow.pageFactory).toBeLessThanOrEqual(1);
});

test("capability subview keeps one shared frame, one scroll owner and one outer-gutter body marker", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/zb/client-source/icp-profiles?capability=1", { waitUntil: "domcontentloaded" });

  const factoryPage = page.locator('[data-page-factory-page-id="client-icp-profiles"]');
  await expect(factoryPage).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("html")).toHaveAttribute("data-tradepro-page-shared-variables-integrity", "complete");
  await expect(page.locator("[data-responsive-page-host]")).toHaveAttribute("data-responsive-page-template", "dashboard");
  await expect(factoryPage).toHaveAttribute("data-page-factory-scroll-contract", "content-only");
  await expect(factoryPage.locator("[data-page-list-scroll-owner]")).toHaveCount(1);

  const geometry = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>(".app-main");
    const boundary = document.querySelector<HTMLElement>('[data-responsive-factory-workspace-boundary="true"]');
    const owner = document.querySelector<HTMLElement>('[data-page-factory-page-id="client-icp-profiles"] [data-page-list-scroll-owner]');
    const marker = main ? getComputedStyle(main, "::after") : null;
    const boundaryMarker = boundary ? getComputedStyle(boundary, "::after") : null;
    return {
      mainOverflow: main ? getComputedStyle(main).overflowY : "missing",
      ownerOverflow: owner ? getComputedStyle(owner).overflowY : "missing",
      ownerScrollDelta: owner ? owner.scrollHeight - owner.clientHeight : -1,
      markerContent: marker?.content || "",
      markerWritingMode: marker?.writingMode || "",
      markerLeft: Number.parseFloat(marker?.left || "999"),
      boundaryMarkerContent: boundaryMarker?.content || "",
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      mainRect: main?.getBoundingClientRect().toJSON() || null,
      boundaryRect: boundary?.getBoundingClientRect().toJSON() || null,
      hitRect: document.querySelector<HTMLElement>('[data-responsive-factory-body-marker-hit-area="true"]')?.getBoundingClientRect().toJSON() || null,
    };
  });
  expect(geometry.mainOverflow).toBe("hidden");
  expect(geometry.ownerOverflow).toBe("auto");
  expect(geometry.ownerScrollDelta).toBeGreaterThan(0);
  expect(geometry.markerContent).toContain("主体");
  expect(geometry.markerWritingMode).toBe("vertical-rl");
  expect(geometry.markerLeft).toBeLessThanOrEqual(8);
  expect(["none", "normal", "\"\""]).toContain(geometry.boundaryMarkerContent);
  expect(geometry.documentOverflow).toBeLessThanOrEqual(1);

  if (!geometry.mainRect || !geometry.boundaryRect || !geometry.hitRect) throw new Error("Shared frame geometry is unavailable.");
  expect(Math.abs(geometry.hitRect.right - geometry.boundaryRect.x)).toBeLessThanOrEqual(3);
  await page.mouse.move(geometry.hitRect.x + geometry.hitRect.width / 2, geometry.hitRect.y + 24);
  await expect.poll(async () => page.evaluate(() => getComputedStyle(document.querySelector<HTMLElement>(".app-main")!, "::after").display)).toMatch(/flex/);
  await page.mouse.move(geometry.boundaryRect.x + 40, geometry.boundaryRect.y + 40);
  await expect.poll(async () => page.evaluate(() => getComputedStyle(document.querySelector<HTMLElement>(".app-main")!, "::after").display)).toBe("none");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(factoryPage).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-responsive-page-host]")).toHaveAttribute("data-responsive-page-template", "dashboard");
  await expect(factoryPage).toHaveAttribute("data-page-factory-scroll-contract", "content-only");
  await expect(factoryPage.locator("[data-page-list-scroll-owner]")).toHaveCount(1);
  const compactOverflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    mainOverflow: getComputedStyle(document.querySelector<HTMLElement>(".app-main")!).overflowY,
  }));
  expect(compactOverflow.document).toBeLessThanOrEqual(1);
  expect(compactOverflow.mainOverflow).toBe("hidden");
});

test("editor shell reuses its authored title/body boundary and projects every peer card", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/zb/client-source/news?tab=category&siteId=${encodeURIComponent(SITE_ID)}`, { waitUntil: "domcontentloaded" });

  const host = page.locator("[data-responsive-page-host]");
  const root = page.locator('[data-page-factory-page-id="client-news-center"][data-page-factory-frame-owner="factory-shell"]');
  const boundary = page.locator('[data-responsive-factory-workspace-boundary="true"]');
  await expect(root).toBeVisible({ timeout: 60_000 });
  await expect(host.locator("[data-responsive-factory-title-one-fallback]")).toHaveCount(0);
  await expect(host.locator(":scope > [data-client-project-frame] > [data-client-project-context]")).toHaveAttribute("data-responsive-shared-surface", "title-1");
  await expect(boundary).toHaveAttribute("data-client-project-frame", "true");
  await expect(boundary.locator('[data-page-factory-page-id="client-news-center"]')).toHaveCount(1);
  await expect(page.locator('[data-development-standard-frame-region="body"]')).toHaveCount(1);

  const geometry = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>(".app-main");
    const host = document.querySelector<HTMLElement>("[data-responsive-page-host]");
    const boundary = document.querySelector<HTMLElement>('[data-responsive-factory-workspace-boundary="true"]');
    const hit = document.querySelector<HTMLElement>('[data-responsive-factory-body-marker-hit-area="true"]');
    if (!main || !host || !boundary || !hit) throw new Error("News Center shared frame geometry is unavailable.");
    return {
      main: main.getBoundingClientRect().toJSON(),
      host: host.getBoundingClientRect().toJSON(),
      boundary: boundary.getBoundingClientRect().toJSON(),
      hitLeft: Number.parseFloat(hit.style.getPropertyValue("--responsive-factory-body-hit-left")),
      hitTop: Number.parseFloat(hit.style.getPropertyValue("--responsive-factory-body-hit-top")),
      hitHeight: Number.parseFloat(hit.style.getPropertyValue("--responsive-factory-body-hit-height")),
    };
  });
  expect(Math.abs(geometry.boundary.x - geometry.host.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.boundary.y - geometry.host.y)).toBeLessThanOrEqual(1);
  expect(geometry.hitLeft).toBeCloseTo(geometry.boundary.x - geometry.main.x - 10, 0);
  expect(geometry.hitTop).toBeCloseTo(geometry.boundary.y - geometry.main.y, 0);
  expect(geometry.hitHeight).toBeCloseTo(Math.min(geometry.main.bottom, geometry.boundary.bottom) - Math.max(geometry.main.y, geometry.boundary.y), 0);

  const cardProjection = await root.evaluate((element: HTMLElement) => {
    const cards = Array.from(element.querySelectorAll<HTMLElement>(".tradepro-surface-card, [data-slot='card']"));
    const canonicalLarge = element.querySelectorAll('[data-page-factory-region="large-card"]').length;
    const canonicalSmall = element.querySelectorAll('[data-page-factory-region="small-card"]').length;
    return {
      total: cards.length,
      sharedLarge: cards.filter((card) => card.dataset.sharedLargeCardSurface === "true").length,
      markedLarge: cards.filter((card) => card.dataset.developmentStandardFrameRegion === "large-card").length,
      canonicalLarge,
      canonicalSmall,
    };
  });
  expect(cardProjection.total).toBeGreaterThanOrEqual(3);
  expect(cardProjection.sharedLarge).toBe(cardProjection.total);
  expect(cardProjection.markedLarge).toBe(cardProjection.total);
  expect(cardProjection.canonicalLarge).toBe(1);
  expect(cardProjection.canonicalSmall).toBe(1);
});

test("factory pages use the Operations Market table-header frame with navigation fallback", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/zb/client-source/site-management?capability=1", { waitUntil: "domcontentloaded" });

  const root = page.locator('[data-page-factory-page-id="client-site-management"]');
  const fallback = root.locator('[data-page-factory-fallback-table-header]');
  await expect(root).toBeVisible({ timeout: 60_000 });
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveAttribute("data-page-factory-table-header-contract", "operations-market-navigation-fallback");
  await expect(root.locator('[data-page-table-header]')).toHaveCount(1);
  await expect(fallback.getByText("多站管理", { exact: true })).toHaveCount(1);
  await expect(fallback.getByText("多语言", { exact: true })).toHaveCount(1);
  await expect(fallback.getByText("版本发布", { exact: true })).toHaveCount(1);
  await expect(fallback.locator('[aria-current="page"]')).toHaveText("多站管理");
  const fallbackGeometry = await fallback.evaluate((element: HTMLElement) => ({
    height: element.getBoundingClientRect().height,
    overflow: element.scrollWidth - element.clientWidth,
  }));
  expect(fallbackGeometry.height).toBeGreaterThanOrEqual(61);
  expect(fallbackGeometry.height).toBeLessThanOrEqual(63);
  expect(fallbackGeometry.overflow).toBeLessThanOrEqual(1);
  await expect(root.locator("[data-page-list-scroll-owner]")).toHaveCount(1);

  await page.goto("/zb/client-source/product-market?tab=operations", { waitUntil: "domcontentloaded" });
  const operations = page.locator('[data-page-factory-page-id="client-source-product-market-operations"]');
  await expect(operations).toBeVisible({ timeout: 60_000 });
  await expect(operations.locator("[data-page-factory-fallback-table-header]")).toHaveCount(0);
  await expect(page.locator('[data-product-market-table-header]')).toHaveCount(1);
});

test("client dashboard is a real dashboard-template page at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/zb/client-source/?siteId=${encodeURIComponent(SITE_ID)}`, { waitUntil: "domcontentloaded" });
  const dashboard = page.locator('[data-page-factory-page-id="client-dashboard"]');
  await expect(dashboard).toBeVisible({ timeout: 60_000 });
  await expect(dashboard).toHaveAttribute("data-page-factory-contract", FACTORY_VERSION);
  await expect(dashboard).toHaveAttribute("data-page-factory-template", "dashboard");
  await expect(dashboard).toHaveAttribute("data-page-factory-source-scope", "client_source");
  const titleTwo = dashboard.locator('[data-page-factory-region="title-2"]').first();
  await expect(titleTwo).toHaveCount(1);
  await expect(titleTwo).toBeHidden();
  const titleTwoTrigger = page.locator('[data-responsive-toolbar-trigger="theme"]');
  await expect(titleTwoTrigger).toBeVisible();
  await titleTwoTrigger.click();
  await expect(titleTwo).toHaveAttribute("data-responsive-live-surface-open", "true");
  await expect(titleTwo).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(titleTwo).toBeHidden();
  for (const region of ["content", "large-card", "small-card", "table-shell"]) {
    await expect(dashboard.locator(`[data-page-factory-region="${region}"]`).first()).toBeVisible();
  }
  await expect(dashboard.locator('[data-page-factory-region="table-header"]')).toHaveCount(1);
  await expect(dashboard.locator('[data-page-factory-region="scrollbar"]')).toHaveCount(1);
  const overflow = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-page-factory-page-id="client-dashboard"]');
    return {
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      dashboard: root ? root.scrollWidth - root.clientWidth : 999,
    };
  });
  expect(overflow.document).toBeLessThanOrEqual(1);
  expect(overflow.dashboard).toBeLessThanOrEqual(1);
});

test("first agency review wave keeps real factory regions at 390px", async ({ page }) => {
  const pages = [
    { id: "agency-dashboard", route: "/dl", template: "dashboard", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "agency-orders", route: "/dl/orders", template: "list", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "agency-business-data", route: "/dl/business-data", template: "dashboard", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "agency-invite-links", route: "/dl/invite-links", template: "dashboard", regions: ["title-2", "content", "large-card", "small-card"] },
  ] as const;
  await page.setViewportSize({ width: 390, height: 844 });
  for (const item of pages) {
    await page.goto(item.route, { waitUntil: "domcontentloaded" });
    const root = page.locator(`[data-page-factory-page-id="${item.id}"]`);
    await expect(root).toBeVisible({ timeout: 60_000 });
    await expect(root).toHaveAttribute("data-page-factory-contract", FACTORY_VERSION);
    await expect(root).toHaveAttribute("data-page-factory-template", item.template);
    await expect(root).toHaveAttribute("data-page-factory-source-scope", "agency_source");
    for (const region of item.regions) await expect(root.locator(factoryRegionSelector(region)).first()).toHaveCount(1);
    const overflow = await root.evaluate((element: HTMLElement) => element.scrollWidth - element.clientWidth);
    expect(overflow, item.id).toBeLessThanOrEqual(1);
  }
});

test("remaining low-risk wave and HQ dashboard keep real factory regions at 390px", async ({ page }) => {
  const pages = [
    { id: "agency-quotas", route: "/dl/quotas", template: "dashboard", scope: "agency_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "agency-public-pool", route: "/dl/public-pool", template: "list", scope: "agency_source", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "agency-workspace", route: "/dl/workspace", template: "dashboard", scope: "agency_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-dashboard", route: "/zb", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
  ] as const;
  await page.setViewportSize({ width: 390, height: 844 });
  for (const item of pages) {
    await page.goto(item.route, { waitUntil: "domcontentloaded" });
    const root = page.locator(`[data-page-factory-page-id="${item.id}"]`);
    await expect(root).toBeVisible({ timeout: 60_000 });
    await expect(root).toHaveAttribute("data-page-factory-contract", FACTORY_VERSION);
    await expect(root).toHaveAttribute("data-page-factory-template", item.template);
    await expect(root).toHaveAttribute("data-page-factory-source-scope", item.scope);
    for (const region of item.regions) await expect(root.locator(factoryRegionSelector(region)).first()).toHaveCount(1);
    expect(await root.evaluate((element: HTMLElement) => element.scrollWidth - element.clientWidth), item.id).toBeLessThanOrEqual(1);
  }
});

test("first review wave keeps real factory regions at 390px", async ({ page }) => {
  test.setTimeout(360_000);
  const pages = [
    { id: "client-account", route: `/zb/client-source/account?siteId=${encodeURIComponent(SITE_ID)}`, template: "workflow", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card", "table-shell", "table-header", "scrollbar"] },
    { id: "agency-customers", route: "/dl/customers", template: "list", scope: "agency_source", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "agency-sites", route: "/dl/sites", template: "dashboard", scope: "agency_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "agency-social-content-reviews", route: "/zb/agency-source/social-content-reviews", template: "detail", scope: "agency_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "agency-members", route: "/dl/members", template: "list", scope: "agency_source", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "agency-oem-settings", route: "/dl/oem-settings", template: "form", scope: "agency_source", regions: ["title-2", "content"] },
    { id: "agency-performance", route: "/dl/performance", template: "dashboard", scope: "agency_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "agency-reports", route: "/dl/reports", template: "list", scope: "agency_source", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "agency-roles", route: "/dl/roles", template: "dashboard", scope: "agency_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "agency-seo-blogs", route: "/dl/seo-blogs", template: "dashboard", scope: "agency_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "agency-seo-tasks", route: "/dl/seo-tasks", template: "workflow", scope: "agency_source", regions: ["title-2", "content", "large-card", "small-card", "table-shell", "table-header", "scrollbar"] },
    { id: "agency-wallet", route: "/dl/wallet", template: "workflow", scope: "agency_source", regions: ["title-2", "content", "large-card", "small-card", "table-shell", "table-header", "scrollbar"] },
    { id: "client-news-center", route: `/zb/client-source/news?siteId=${encodeURIComponent(SITE_ID)}`, template: "editor", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card", "scrollbar"] },
    { id: "client-cases", route: `/zb/client-source/cases?siteId=${encodeURIComponent(SITE_ID)}`, template: "editor", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card", "scrollbar"] },
    { id: "client-ai-command", route: `/zb/client-source/ai-command?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-approval-center", route: `/zb/client-source/approval-center?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-cpq-quotes", route: `/zb/client-source/cpq-quotes?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-customer-assets", route: `/zb/client-source/customer-assets?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-data-warehouse", route: `/zb/client-source/data-warehouse?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-digital-assets", route: `/zb/client-source/digital-assets?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-erp", route: `/zb/client-source/erp?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-finance", route: `/zb/client-source/finance?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-forecast", route: `/zb/client-source/forecast?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-fulfillment-orders", route: `/zb/client-source/fulfillment-orders?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-health-cockpit", route: `/zb/client-source/health-cockpit?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-icp-profiles", route: `/zb/client-source/icp-profiles?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-legal-contracts", route: `/zb/client-source/contract-legal?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-manufacturing-execution", route: `/zb/client-source/manufacturing-execution?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-metric-center", route: `/zb/client-source/metric-center?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-partner-voice", route: `/zb/client-source/partner-voice?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-people", route: `/zb/client-source/people?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-procurement", route: `/zb/client-source/procurement?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-production-planning", route: `/zb/client-source/production-plans?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-product-passports", route: `/zb/client-source/product-passports?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-quality-inspections", route: `/zb/client-source/quality-inspections?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-recruiting", route: `/zb/client-source/recruiting?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-renewal-growth", route: `/zb/client-source/renewal-growth?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-revenue-profit", route: `/zb/client-source/revenue-profit?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-cdp", route: `/zb/client-source/customer-data-platform?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-field-service", route: `/zb/client-source/field-service?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-rfq-samples", route: `/zb/client-source/rfq-samples?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-site-management", route: `/zb/client-source/site-management?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-warranty-rma", route: `/zb/client-source/warranty-rma?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-projects", route: `/zb/client-source/projects?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-products", route: `/zb/client-source/products?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-social-content-reviews", route: "/zb/social-content-reviews", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-platform-architecture", route: "/zb/platform-architecture", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-template-snapshot-migrations", route: "/zb/template-migrations", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "agency-live-pages", route: "/dl/enterprises", template: "dashboard", scope: "agency_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "agency-plans-live", route: "/dl/plans", template: "dashboard", scope: "agency_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "agency-version-center", route: "/dl/version?agency=AGENCY-DEMO", template: "dashboard", scope: "agency_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-ai-chat", route: `/zb/client-source/ai-chat?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "small-card"] },
    { id: "client-ai-customer-service", route: `/zb/client-source/ai-customer-service?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "auth-callback", route: "/auth/callback", template: "form", scope: "client_source", regions: ["title-2", "content"] },
    { id: "auth-error", route: "/auth/error?msg=page-factory-review", template: "form", scope: "client_source", regions: ["title-2", "content"] },
    { id: "client-company-info", route: `/zb/client-source/company-info?tab=navigation&siteId=${encodeURIComponent(SITE_ID)}`, template: "editor", scope: "client_source", regions: ["title-2", "content"] },
    { id: "client-abm", route: `/zb/client-source/abm?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-account-graph", route: `/zb/client-source/account-graph?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-ai-sdr", route: `/zb/client-source/ai-sdr?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-brand-studio", route: `/zb/client-source/brand-studio?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-buying-committee", route: `/zb/client-source/buying-committee?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-channel-feed", route: `/zb/client-source/channel-feed?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-commerce", route: `/zb/client-source/commerce?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-creative-center", route: `/zb/client-source/creative-center?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-customer-timeline", route: `/zb/client-source/customer-timeline?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-dam-localization", route: `/zb/client-source/dam-localization?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-identity-resolution", route: `/zb/client-source/identity-resolution?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-knowledge-graph", route: `/zb/client-source/knowledge-graph?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-segments-consent", route: `/zb/client-source/segments-consent?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-structured-data", route: `/zb/client-source/structured-data?siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "agency-source-releases", route: "/zb/agency-source/releases", template: "list", scope: "agency_source", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-audit-release-logs", route: "/zb/audit-logs", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-backup-restore-drills", route: "/zb/backup-restore-drills", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "client-source-releases", route: `/zb/client-source/releases?siteId=${encodeURIComponent(SITE_ID)}`, template: "form", scope: "client_source", regions: ["title-2", "content"] },
    { id: "hq-ai-model-square", route: "/zb/ai-square", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-ai-logs", route: "/zb/ai-logs", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-ai-cost", route: "/zb/ai-cost", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-code-editor", route: "/zb/code-editor", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-members-live", route: "/zb/members", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-roles-live", route: "/zb/roles", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-depts-live", route: "/zb/depts", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-ai-models-live", route: "/zb/ai-models", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-ai-vendors-live", route: "/zb/ai-vendors", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-ai-keys-live", route: "/zb/ai-keys", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-templates-live", route: "/zb/templates", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-gallery-live", route: "/zb/gallery", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-recharge-audit-live", route: "/zb/recharge-audit", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "agency-source-recharge-audit-live", route: "/zb/agency-source/recharge-audit", template: "list", scope: "agency_source", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-oem-audit-live", route: "/zb/oem-audit", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-platform-config-live", route: "/zb/platform-config", template: "workflow", scope: "hq", regions: ["title-2", "content", "large-card", "small-card", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-email-config-live", route: "/zb/email-config", template: "workflow", scope: "hq", regions: ["title-2", "content", "large-card", "small-card", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-wallet-live", route: "/zb/wallet", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-orders-live", route: "/zb/orders", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-order-audit-live", route: "/zb/order-audit", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-auto-renew-live", route: "/zb/auto-renew", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-refunds-live", route: "/zb/refunds", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-invoices-live", route: "/zb/invoices", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-expiring-live", route: "/zb/expiring", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-payment-channels-live", route: "/zb/payment-channels", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-alerts-live", route: "/zb/alerts", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-announcements-live", route: "/zb/announcements", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-promotions-live", route: "/zb/promotions", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-groups-live", route: "/zb/groups", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-csat-live", route: "/zb/csat", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-inquiry-auto-live", route: "/zb/inquiry-auto", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-notify-config-live", route: "/zb/notify-config", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-boosters-live", route: "/zb/boosters", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-coupons-live", route: "/zb/coupons", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-points-live", route: "/zb/points", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-agencies-live", route: "/zb/agencies", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "agency-source-partners-live", route: "/zb/agency-source/partners", template: "list", scope: "agency_source", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-enterprises-live", route: "/zb/enterprises", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-plans-live", route: "/zb/plans", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-sites-live", route: "/zb/sites", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-domains-live", route: "/zb/domains", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-qa-plans-live", route: "/zb/qa-plans", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-qa-tasks-live", route: "/zb/qa-tasks", template: "list", scope: "hq", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "hq-tdk-rules-live", route: "/zb/tdk-rules", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-seo-blogs-live", route: "/zb/seo-blogs", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-social-authorization", route: "/zb/social-authorization", template: "form", scope: "hq", regions: ["title-2", "content"] },
    { id: "hq-social-publish-delivery", route: "/zb/social-publish-delivery", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-release-rollouts", route: "/zb/release-rollouts", template: "dashboard", scope: "hq", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "hq-tenant-governance", route: "/zb/tenant-governance", template: "workflow", scope: "hq", regions: ["title-2", "content", "large-card", "small-card", "table-shell", "table-header", "scrollbar"] },
    { id: "client-inquiries", route: "/inquiries", template: "dashboard", scope: "client_source", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-logout-callback", route: "/logout-callback", template: "form", scope: "client_source", regions: ["title-2", "content"] },
  ] as const;
  const technicalIsolationIds = new Set<string>(["auth-callback", "auth-error", "client-logout-callback"]);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const item of pages) {
    if (technicalIsolationIds.has(item.id)) continue;
    await page.goto(item.route, { waitUntil: "domcontentloaded" });
    const root = page.locator(`[data-page-factory-page-id="${item.id}"]`);
    await expect(root).toBeVisible({ timeout: 60_000 });
    await expect(root).toHaveAttribute("data-page-factory-contract", FACTORY_VERSION);
    await expect(root).toHaveAttribute("data-page-factory-template", item.template);
    await expect(root).toHaveAttribute("data-page-factory-source-scope", item.scope);
    await expect(root.locator(factoryRegionSelector("content")).first()).toHaveCount(1, { timeout: 5_000 });
    const regionCounts = await Promise.all(
      item.regions.map((region) => root.locator(factoryRegionSelector(region)).count())
    );
    const missingRegions = item.regions.filter((_, index) => regionCounts[index] === 0);
    expect.soft(missingRegions, `${item.id} should expose every registered region`).toEqual([]);
    expect(await root.evaluate((element: HTMLElement) => element.scrollWidth - element.clientWidth), item.id).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), item.id).toBeLessThanOrEqual(1);
  }
});

test("preview frame keeps its standalone fallback safe at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/preview-frame", { waitUntil: "domcontentloaded" });
  const fallback = page.locator('[data-trade-preview-fallback="true"]').first();
  await expect(fallback).toBeVisible({ timeout: 60_000 });
  await expect(fallback).toContainText("站点预览");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("shared multi-route pages keep every source-scoped factory identity", async ({ page }) => {
  test.setTimeout(300_000);
  const siteSettingTabs = ["general", "redirect", "domains", "domain-register", "domain-binding", "domain-transfer"] as const;
  const productTabs = ["operations", "modules", "layout", "service", "development", "blueprint"] as const;
  const productScopes = [
    { id: "hq", route: "/zb/product-market", scope: "hq" },
    { id: "agency-source", route: "/zb/agency-source/product-market", scope: "agency_source" },
    { id: "client-source", route: "/zb/client-source/product-market", scope: "client_source" },
  ] as const;
  const pages: Array<{ id: string; route: string; template: string; scope: string; regions: readonly string[] }> = [
    { id: "client-preview-site", route: "/sites/page-factory-missing-site", template: "reference", scope: "client_source", regions: [] },
    { id: "client-site-settings", route: `/zb/client-source/site-settings?siteId=${encodeURIComponent(SITE_ID)}`, template: "form", scope: "client_source", regions: ["title-2", "content"] },
    ...siteSettingTabs.map((tab) => ({ id: `client-site-settings-${tab}`, route: `/zb/client-source/site-settings?tab=${tab}&siteId=${encodeURIComponent(SITE_ID)}`, template: "form", scope: "client_source", regions: ["title-2", "content"] })),
  ];
  for (const productScope of productScopes) {
    pages.push({ id: `${productScope.id}-product-market`, route: productScope.route, template: "reference", scope: productScope.scope, regions: [] });
    for (const tab of productTabs) pages.push({ id: `${productScope.id}-product-market-${tab}`, route: `${productScope.route}?tab=${tab}`, template: "reference", scope: productScope.scope, regions: [] });
  }
  pages.push(
    { id: "hq-client-style-settings", route: "/zb/kh-style-settings", template: "reference", scope: "hq", regions: [] },
    { id: "hq-material-assets", route: "/zb/material-assets", template: "reference", scope: "hq", regions: [] },
    { id: "hq-client-source-style-settings", route: "/zb/client-style-settings", template: "reference", scope: "hq", regions: [] },
    { id: "hq-agency-style-settings", route: "/zb/dl-style-settings", template: "reference", scope: "hq", regions: [] },
    { id: "hq-agency-source-style-settings", route: "/zb/agency-style-settings", template: "reference", scope: "hq", regions: [] },
  );

  await page.setViewportSize({ width: 390, height: 844 });
  for (const item of pages) {
    await page.goto(item.route, { waitUntil: "domcontentloaded" });
    const root = page.locator(`[data-page-factory-page-id="${item.id}"]`);
    await expect(root).toBeVisible({ timeout: 60_000 });
    await expect(root).toHaveAttribute("data-page-factory-template", item.template);
    await expect(root).toHaveAttribute("data-page-factory-source-scope", item.scope);
    for (const region of item.regions) await expect(root.locator(factoryRegionSelector(region)).first()).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), item.id).toBeLessThanOrEqual(1);
  }
});

test("smart ads and social media keep every tab factory identity", async ({ page }) => {
  test.setTimeout(180_000);
  const pages = [
    { id: "client-smart-ads", route: "/smart-ads", template: "dashboard", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-smart-ads-overview", route: "/smart-ads?tab=overview", template: "dashboard", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-smart-ads-platforms", route: "/smart-ads?tab=platforms", template: "dashboard", regions: ["title-2", "content", "small-card"] },
    { id: "client-smart-ads-campaigns", route: "/smart-ads?tab=campaigns", template: "list", regions: ["title-2", "content", "table-shell", "table-header", "scrollbar"] },
    { id: "client-smart-ads-compare", route: "/smart-ads?tab=compare", template: "dashboard", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-social", route: "/social", template: "dashboard", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-social-customer-roadmap", route: "/social?tab=customer-roadmap", template: "dashboard", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-social-marketing-playbook", route: "/social?tab=marketing-playbook", template: "dashboard", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-social-dashboard", route: "/social?tab=dashboard", template: "dashboard", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-social-accounts", route: "/social?tab=accounts", template: "dashboard", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-social-create", route: "/social?tab=create", template: "form", regions: ["title-2", "content"] },
    { id: "client-social-digital-human", route: "/social?tab=digital-human", template: "editor", regions: ["title-2", "content", "large-card", "small-card", "scrollbar"] },
    { id: "client-social-schedule", route: "/social?tab=schedule&createTask=1", template: "workflow", regions: ["title-2", "content", "large-card", "small-card", "table-shell", "table-header", "scrollbar"] },
    { id: "client-social-automation", route: "/social?tab=automation", template: "dashboard", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-social-analytics", route: "/social?tab=analytics", template: "dashboard", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-social-settings", route: "/social?tab=settings", template: "form", regions: ["title-2", "content"] },
  ] as const;
  await page.setViewportSize({ width: 390, height: 844 });
  for (const item of pages) {
    const separator = item.route.includes("?") ? "&" : "?";
    await page.goto(`/zb/client-source${item.route}${separator}siteId=${encodeURIComponent(SITE_ID)}`, { waitUntil: "domcontentloaded" });
    const root = page.locator(`[data-page-factory-page-id="${item.id}"]`);
    await expect(root).toBeAttached({ timeout: 60_000 });
    await expect(root.locator(":scope > :visible").first()).toBeVisible();
    await expect(root).toHaveAttribute("data-page-factory-template", item.template);
    for (const region of item.regions) await expect(root.locator(factoryRegionSelector(region)).first()).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), item.id).toBeLessThanOrEqual(1);
  }
});

test("inactive client implementations keep their factory contract without activating business routes", async ({ page }) => {
  test.setTimeout(300_000);
  const routes = [
    { id: "client-blog-optimize", route: "blog", template: "editor", regions: ["title-2", "content", "large-card", "small-card", "scrollbar"] },
    { id: "client-customers", route: "customers", template: "workflow", regions: ["title-2", "content", "large-card", "small-card", "table-shell", "table-header", "scrollbar"] },
    { id: "client-geo-center", route: "geo-center", template: "workflow", regions: ["title-2", "content", "large-card", "small-card", "table-shell", "table-header", "scrollbar"] },
    { id: "client-reports", route: "reports", template: "dashboard", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-seo", route: "seo", template: "workflow", regions: ["title-2", "content", "large-card", "small-card", "table-shell", "table-header", "scrollbar"] },
    { id: "client-templates", route: "templates", template: "dashboard", regions: ["title-2", "content", "large-card", "small-card"] },
    { id: "client-videos", route: "videos", template: "editor", regions: ["title-2", "content", "large-card", "small-card", "scrollbar"] },
  ] as const;
  await page.setViewportSize({ width: 390, height: 844 });
  for (const item of routes) {
    await page.goto(`/zb/client-source/${item.route}?siteId=${encodeURIComponent(SITE_ID)}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-responsive-page-host]")).toHaveAttribute(
      "data-responsive-content-ready",
      "true",
      { timeout: 60_000 },
    );
    const root = page.locator(`[data-page-factory-page-id="${item.id}"]`);
    const unavailable = page.locator("[data-client-project-unavailable]");
    await expect(root.or(unavailable).first()).toBeVisible({ timeout: 60_000 });
    if (await root.count()) {
      await expect(root).toHaveAttribute("data-page-factory-template", item.template);
      await expect(root).toHaveAttribute("data-page-factory-source-scope", "client_source");
      for (const region of item.regions) {
        await expect(root.locator(factoryRegionSelector(region)).first()).toHaveCount(1, { timeout: 60_000 });
      }
      expect(await root.evaluate((element: HTMLElement) => element.scrollWidth - element.clientWidth), item.id).toBeLessThanOrEqual(1);
    } else {
      await expect(unavailable).toHaveAttribute("data-product-route-status", /^(inactive|hidden)$/);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), item.route).toBeLessThanOrEqual(1);
  }
});

test("07 Page Factory keeps progress, filters and usage inside a 390px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.goto("/zb/client-source/product-market?tab=modules", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-product-market-hydrated="true"]')).toBeVisible({ timeout: 60_000 });
  const launcher = page.locator('[data-development-application-launcher]:visible').first();
  await expect(launcher).toBeVisible({ timeout: 60_000 });
  await launcher.click();
  await expect(page.locator("[data-development-standard-apply-dialog]")).toBeVisible();
  await page.locator('[data-development-standard-style-nav-item="page-factory"]').click();

  const workbench = page.locator("[data-page-factory-workbench]");
  await expect(workbench).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(workbench.locator('[data-page-factory-phase-progress="100"]')).toBeVisible();
  await expect(workbench.locator('[data-page-factory-baseline-status="unchanged"]')).toBeVisible();
  const coverageSummary = workbench.locator('[data-page-factory-coverage-summary]');
  await expect(coverageSummary).toHaveAttribute("data-page-factory-coverage-percentage", "100");
  const routeAudit = workbench.locator('[data-page-factory-route-audit="complete"]');
  await expect(routeAudit).toHaveAttribute("data-page-factory-route-identity-coverage", "100");
  await expect(routeAudit).toContainText("158 / 158");
  await expect(coverageSummary).toContainText("118 / 118 · 100%");
  await expect(coverageSummary).toContainText("已登记 118");
  const inventory = workbench.locator("[data-page-factory-inventory-browser]");
  await expect(inventory.locator('[data-page-factory-inventory-empty="complete"]')).toContainText("100%");
  await expect(inventory.locator("[data-page-factory-inventory-item]")).toHaveCount(0);

  const overflow = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("[data-page-factory-workbench]");
    const inventoryBrowser = document.querySelector<HTMLElement>("[data-page-factory-inventory-browser]");
    return {
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      root: root ? root.scrollWidth - root.clientWidth : 999,
      inventory: inventoryBrowser ? inventoryBrowser.scrollWidth - inventoryBrowser.clientWidth : 999,
    };
  });
  expect(overflow.document).toBeLessThanOrEqual(1);
  expect(overflow.root).toBeLessThanOrEqual(1);
  expect(overflow.inventory).toBeLessThanOrEqual(1);
});

test("route-identity closeout covers aliases, dynamic scope and every Product Analysis tab", async ({ page }) => {
  test.setTimeout(180_000);
  const pages = [
    { id: "agency-invites", route: "/dl/invites", template: "dashboard", scope: "agency_source" },
    { id: "agency-oem", route: "/dl/oem", template: "form", scope: "agency_source" },
    { id: "agency-plans-live", route: "/dl/plans", template: "dashboard", scope: "agency_source" },
    { id: "hq-code-editor-scope", route: "/zb/code-editor/deployment", template: "dashboard", scope: "hq" },
    { id: "client-product-analysis", route: `/zb/client-source/product-analysis?siteId=${encodeURIComponent(SITE_ID)}`, template: "workflow", scope: "client_source" },
    { id: "product-analysis-trends", route: `/zb/client-source/product-analysis?tab=trends&siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source" },
    { id: "product-analysis-data-studio", route: `/zb/client-source/product-analysis?tab=data-studio&siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source" },
    { id: "product-analysis-market-finder", route: `/zb/client-source/product-analysis?tab=market-finder&siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source" },
    { id: "product-analysis-global-market", route: `/zb/client-source/product-analysis?tab=global-market&siteId=${encodeURIComponent(SITE_ID)}`, template: "dashboard", scope: "client_source" },
  ] as const;
  await page.setViewportSize({ width: 390, height: 844 });
  for (const item of pages) {
    await page.goto(item.route, { waitUntil: "domcontentloaded" });
    const root = page.locator(`[data-page-factory-page-id="${item.id}"]`);
    await expect(root).toBeAttached({ timeout: 60_000 });
    await expect(root.locator(":scope > :visible").first()).toBeVisible();
    await expect(root).toHaveAttribute("data-page-factory-contract", FACTORY_VERSION);
    await expect(root).toHaveAttribute("data-page-factory-template", item.template);
    await expect(root).toHaveAttribute("data-page-factory-source-scope", item.scope);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), item.id).toBeLessThanOrEqual(1);
  }
});

test("headquarters, agency source and client source expose the same Page Factory", async ({ page }) => {
  const routes = [
    "/zb/product-market?tab=modules",
    "/zb/agency-source/product-market?tab=modules",
    "/zb/client-source/product-market?tab=modules",
  ];

  for (const route of routes) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-product-market-hydrated="true"]')).toBeVisible({ timeout: 60_000 });
    const launcher = page.locator('[data-development-application-launcher]:visible').first();
    await expect(launcher).toBeVisible({ timeout: 60_000 });
    await launcher.click();
    await expect(page.locator("[data-development-standard-apply-dialog]")).toBeVisible();
    await page.locator('[data-development-standard-style-nav-item="page-factory"]').click();
    const workbench = page.locator("[data-page-factory-workbench]");
    await expect(workbench).toBeVisible();
    await expect(workbench).toHaveAttribute("data-page-factory-version", FACTORY_VERSION);
    await expect(workbench.locator('[data-page-factory-registry-item="product-analysis-interest-search"]')).toBeVisible();
    const coverageCenter = workbench.locator("[data-page-factory-coverage-center]");
    await expect(coverageCenter).toBeVisible();
    await expect(coverageCenter).toHaveAttribute("data-page-factory-census-mode", "read-only-census");
    await expect(workbench.locator('[data-page-factory-coverage-scope="route-entry"]')).toBeVisible();
    await expect(workbench.locator('[data-page-factory-route-audit="complete"]')).toBeVisible();
    await expect(workbench.locator('[data-page-factory-route-identity-coverage="100"]')).toContainText("158 / 158");
    await expect(workbench.locator('[data-page-factory-plan-status="complete"]')).toBeVisible();
    await expect(workbench.locator('[data-page-factory-phase-progress="100"]')).toHaveAttribute("data-page-factory-progress-version", FACTORY_VERSION);
    const verification = coverageCenter.locator('[data-page-factory-verification-record]');
    await expect(verification).toHaveAttribute("data-page-factory-verification-status", "passed");
    await expect(verification).toHaveAttribute("data-page-factory-verification-version", FACTORY_VERSION);
    await expect(verification.locator('[data-page-factory-verification-result="passed"]')).toHaveCount(8);
    const productMarketEvidence = coverageCenter.locator('[data-page-factory-product-market-evidence]');
    await expect(productMarketEvidence).toBeVisible();
    await expect(productMarketEvidence).toHaveAttribute('data-page-factory-product-market-evidence-version', FACTORY_VERSION);
    await expect(productMarketEvidence).toHaveAttribute('data-page-factory-product-market-evidence-h-version', /^H\d+$/);
    await expect(productMarketEvidence).toHaveAttribute('data-page-factory-product-market-evidence-completion', '100');
    await expect(productMarketEvidence).toContainText('产品市场最新一致性证据');
    await expect(coverageCenter.locator('[data-page-factory-baseline-status="unchanged"]')).toBeVisible();
    await expect(coverageCenter.locator("[data-page-factory-batch]")).toHaveCount(3);
    await expect(coverageCenter.locator("[data-page-factory-wave-count]")).toHaveCount(3);
    await expect(coverageCenter.locator('[data-page-factory-risk-count="low"]')).toBeVisible();
    await expect(coverageCenter).toContainText("不会批量接入或改写页面");
    const inventoryBrowser = workbench.locator("[data-page-factory-inventory-browser]");
    await expect(inventoryBrowser).toBeVisible();
    await expect(inventoryBrowser.locator("[data-page-factory-inventory-item]")).toHaveCount(0);
    await expect(inventoryBrowser.locator("[data-page-factory-adoption-preview]")).not.toContainText("--apply");
    await expect(inventoryBrowser.locator("[data-page-factory-usage-steps]")).toContainText("单页改造授权");
    await page.locator("[data-development-standard-close]").evaluate((element) => (element as HTMLButtonElement).click());
    await expect(page.locator("[data-page-factory-workbench]")).toHaveCount(0);
  }
});
