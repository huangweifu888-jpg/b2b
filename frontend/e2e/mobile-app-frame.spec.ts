import { expect, test, type Page } from "@playwright/test";

const SITE_ID = process.env.B2B_E2E_SITE_ID || "site_56";

async function inspectMobileFrame(page: Page) {
  await page.waitForTimeout(800);
  return page.evaluate(() => {
    const visible = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const host = document.querySelector<HTMLElement>("[data-responsive-page-host]");
    const footer = document.querySelector<HTMLElement>("[data-page-layout-footer]");
    const collection = document.querySelector<HTMLElement>('[data-responsive-mobile-collection="function-grid"]');
    const primaryItems = Array.from(footer?.querySelectorAll<HTMLElement>(
      "[data-responsive-footer-lock-control], [data-responsive-compact-external-tools], [data-visual-card-developer-launcher], [data-source-project-action], [data-client-project-action]",
    ) || []).filter(visible);
    const collectionItems = Array.from(collection?.children || []).filter((item): item is HTMLElement => item instanceof HTMLElement && visible(item));
    const floatingService = Array.from(document.querySelectorAll<HTMLElement>("[data-shared-floating-service-window='true']")).find(visible) || null;
    const footerRect = footer?.getBoundingClientRect() || null;
    const floatingRect = floatingService?.getBoundingClientRect() || null;
    const floatingFooterOverlap = Boolean(footerRect && floatingRect
      && floatingRect.left < footerRect.right && floatingRect.right > footerRect.left
      && floatingRect.top < footerRect.bottom && floatingRect.bottom > footerRect.top);
    const compressedHeadings = Array.from(host?.querySelectorAll<HTMLElement>("h1, h2") || []).filter(visible).filter((heading) => {
      const textLength = (heading.textContent || "").replace(/\s+/g, "").length;
      const fontSize = Number.parseFloat(getComputedStyle(heading).fontSize) || 16;
      return textLength >= 4 && heading.getBoundingClientRect().width + 0.5 < Math.min(96, fontSize * 3);
    });
    const navigationLabel = Array.from(document.querySelectorAll<HTMLElement>("[data-responsive-toolbar-trigger='navigation']"))
      .find(visible)?.querySelector<HTMLElement>("[data-responsive-tool-label]")?.textContent?.trim() || "";
    return {
      issues: document.documentElement.dataset.responsiveLearningIssues || "",
      architecture: host?.dataset.responsiveMobileArchitecture || "",
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      collectionOverflow: collection ? collection.scrollWidth - collection.clientWidth : 0,
      collectionColumns: new Set(collectionItems.map((item) => Math.round(item.getBoundingClientRect().left))).size,
      footerDisplay: footer ? getComputedStyle(footer).display : "",
      footerBottom: footer ? Math.round(footer.getBoundingClientRect().bottom) : 0,
      footerOverflow: footer ? footer.scrollWidth - footer.clientWidth : 0,
      primaryItemCount: primaryItems.length,
      primaryMinimumHeight: primaryItems.length ? Math.min(...primaryItems.map((item) => item.getBoundingClientRect().height)) : 0,
      primaryMinimumWidth: primaryItems.length ? Math.min(...primaryItems.map((item) => item.getBoundingClientRect().width)) : 0,
      floatingFooterOverlap,
      floatingBottom: floatingService ? Number.parseFloat(getComputedStyle(floatingService).bottom) : null,
      generatedTitleBandCount: host?.querySelectorAll("[data-responsive-generated-title-band='true']").length || 0,
      compressedHeadingCount: compressedHeadings.length,
      pageContextTriggerVisible: Array.from(document.querySelectorAll<HTMLElement>("[data-responsive-toolbar-trigger='page-context']")).some(visible),
      overflowTriggerVisible: Array.from(document.querySelectorAll<HTMLElement>("[data-responsive-toolbar-trigger='overflow']")).some(visible),
      recommendationStatus: document.documentElement.dataset.responsiveAutoRecommendationStatus || "",
      navigationLabel,
    };
  });
}

for (const viewport of [
  { label: "emergency", width: 240, height: 544, expectedColumns: 1 },
  { label: "minimum", width: 320, height: 568, expectedColumns: 1 },
  { label: "mobile", width: 390, height: 844, expectedColumns: 1 },
  { label: "large-mobile", width: 480, height: 720, expectedColumns: 1 },
  { label: "compact-ceiling", width: 639, height: 720, expectedColumns: 1 },
] as const) {
  test(`module function grid and five-item footer ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`/zb/client-source/product-market?tab=modules&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-responsive-mobile-collection="function-grid"]').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-product-market-hydrated="true"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("[data-responsive-page-host]")).toHaveAttribute("data-responsive-content-ready", "true", { timeout: 60_000 });
    const result = await inspectMobileFrame(page);
    expect(result.issues).toBe("");
    expect(result.architecture).toBe("shared-mobile-app-frame-v1");
    expect(result.documentOverflow).toBeLessThanOrEqual(1);
    expect(result.collectionOverflow).toBeLessThanOrEqual(1);
    expect(result.collectionColumns).toBe(viewport.expectedColumns);
    expect(result.footerDisplay).toBe("grid");
    expect(result.footerBottom).toBe(viewport.height);
    expect(result.footerOverflow).toBeLessThanOrEqual(1);
    expect(result.primaryItemCount).toBe(5);
    expect(result.primaryMinimumHeight).toBeGreaterThanOrEqual(44);
    expect(result.primaryMinimumWidth).toBeGreaterThanOrEqual(44);
    expect(result.floatingFooterOverlap).toBe(false);
    if (result.floatingBottom !== null) expect(result.floatingBottom).toBeGreaterThanOrEqual(72);
    expect(result.recommendationStatus).toBe("optimized");
    expect(result.navigationLabel).toBe("栏目配置");
  });
}

test("agency source ordinary page inherits the shared mobile footer", async ({ page }) => {
  await page.setViewportSize({ width: 240, height: 544 });
  await page.goto("/zb/agency-source/customers", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-responsive-shell="agency-source"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-responsive-page-host]")).toHaveAttribute("data-responsive-content-ready", "true", { timeout: 60_000 });
  let result: Awaited<ReturnType<typeof inspectMobileFrame>> | null = null;
  await expect.poll(async () => {
    result = await inspectMobileFrame(page);
    return {
      issues: result.issues,
      pageToolsReachable: result.pageContextTriggerVisible || result.overflowTriggerVisible,
    };
  }, { timeout: 30_000 }).toEqual({ issues: "", pageToolsReachable: true });
  const stableResult = result as Awaited<ReturnType<typeof inspectMobileFrame>> | null;
  expect(stableResult).not.toBeNull();
  expect(stableResult?.issues).toBe("");
  expect(stableResult?.footerDisplay).toBe("grid");
  expect(stableResult?.footerBottom).toBe(544);
  expect(stableResult?.footerOverflow).toBeLessThanOrEqual(1);
  expect(stableResult?.primaryItemCount).toBe(3);
  expect(stableResult?.primaryMinimumHeight).toBeGreaterThanOrEqual(44);
  expect(stableResult?.compressedHeadingCount).toBe(0);
  expect(Boolean(stableResult?.pageContextTriggerVisible || stableResult?.overflowTriggerVisible)).toBe(true);
  expect(stableResult?.navigationLabel).not.toBe("左栏");
});
