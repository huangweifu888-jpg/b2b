import { expect, test, type Page } from "@playwright/test";

const SITE_ID = process.env.B2B_E2E_SITE_ID || "site_56";

async function waitForSharedPage(page: Page, scope = "client-source", semantic = false) {
  await expect(page.locator(`[data-responsive-shell="${scope}"]`)).toBeVisible({ timeout: 60_000 });
  const host = page.locator("[data-responsive-page-host]");
  await expect(host).toBeVisible({ timeout: 60_000 });
  await expect(host).toHaveAttribute("data-responsive-content-ready", "true", { timeout: 60_000 });
  await expect(page.locator("[data-page-route-error]")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-responsive-learning-issues", "", { timeout: 60_000 });
  if (semantic) {
    await expect(page.locator("[data-product-market-workspace]")).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-product-market-hydrated="true"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-responsive-semantic-tools][data-responsive-single-live-source="true"]')).toHaveCount(1, { timeout: 60_000 });
  }
  await page.addStyleTag({
    content: "[data-ai-service-drag-root], [data-visual-card-editor-dock] { display: none !important; }",
  });
}

async function openSurface(page: Page, id: "page-context" | "theme" | "table-header") {
  const direct = page.locator(`[data-responsive-toolbar-trigger="${id}"]:visible`).first();
  if (await direct.count()) {
    await direct.click();
  } else {
    await page.locator('[data-responsive-toolbar-trigger="overflow"]:visible').first().click();
    await page.locator(`[data-responsive-live-surface-overflow-target="${id}"]:visible`).first().click();
  }
  await expect(page.locator('[data-responsive-live-surface-open="true"]')).toBeVisible();
}

const screenshotOptions = {
  animations: "disabled" as const,
  caret: "hide" as const,
  maxDiffPixelRatio: 0.012,
};

test.describe("shared responsive visual baselines", () => {
  test("operations desktop remains the visual source", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/zb/client-source/product-market?tab=operations&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
    await waitForSharedPage(page, "client-source", true);
    await expect(page).toHaveScreenshot("operations-desktop-1440.png", screenshotOptions);
  });

  test("modules mobile uses a clean single-column editor", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/zb/client-source/product-market?tab=modules&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
    await waitForSharedPage(page, "client-source", true);
    await expect(page.locator('[data-responsive-mobile-collection="function-grid"]').first()).toBeVisible({ timeout: 60_000 });
    await expect(page).toHaveScreenshot("modules-mobile-390.png", screenshotOptions);
  });

  for (const surface of [
    { id: "page-context", name: "title-1" },
    { id: "theme", name: "title-2" },
    { id: "table-header", name: "table-header" },
  ] as const) {
    test(`operations mobile ${surface.name} reuses the desktop band`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/zb/client-source/product-market?tab=operations&siteId=${SITE_ID}`, { waitUntil: "domcontentloaded" });
      await waitForSharedPage(page, "client-source", true);
      await openSurface(page, surface.id);
      await expect(page).toHaveScreenshot(`operations-mobile-${surface.name}-390.png`, screenshotOptions);
    });
  }

  test("agency ordinary page inherits the same compact frame", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/zb/agency-source/customers", { waitUntil: "domcontentloaded" });
    await waitForSharedPage(page, "agency-source");
    await expect(page).toHaveScreenshot("agency-customers-mobile-390.png", screenshotOptions);
  });
});
