import { expect, test } from "@playwright/test";

import { SHARED_WINDOW_CONTRACT_VERSION, SHARED_WINDOW_FACTORY_DEFAULT, SHARED_WINDOW_TITLE_ACTION_RAIL_CONTRACT } from "../src/lib/shared-window-contract";

const assignment = {
  id: 901,
  org_id: null,
  org_code: "hq",
  org_name: "总部",
  org_type: "hq",
  app_key: "shared-alert-audit",
  app_name: "共享弹窗审计分配",
  category: "audit",
  scope: "总部 / 代理 / 客户 / 计划",
  primary_provider_id: null,
  primary_provider_key: "",
  primary_provider_name: "",
  primary_model: "audit-model",
  backup_provider_id: null,
  backup_provider_key: "",
  backup_provider_name: "",
  backup_model: "",
  enabled: true,
  sort_order: 1,
};

test("AlertDialog shared X closes with Cancel semantics and never confirms", async ({ page }) => {
  let deleteRequests = 0;
  await page.route("**/api/v1/platform/ai-providers", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ items: [] }),
  }));
  await page.route("**/api/v1/platform/organizations", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ items: [] }),
  }));
  await page.route("**/api/v1/platform/ai-assignments**", async (route) => {
    if (route.request().method() === "DELETE") deleteRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(route.request().method() === "GET" ? { items: [assignment] } : { deleted: true }),
    });
  });

  await page.goto("/zb/ai-models", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-responsive-shell="hq"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-page-factory-page-id="hq-ai-models-live"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(assignment.app_name, { exact: true })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "删除", exact: true }).first().click();

  const dialog = page.locator('[role="alertdialog"][data-shared-dialog-contract="save-confirmation"]');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(dialog).toHaveAttribute("data-shared-window-contract", SHARED_WINDOW_CONTRACT_VERSION);
  await expect(dialog).toHaveAttribute("data-shared-window-factory-default", SHARED_WINDOW_FACTORY_DEFAULT.id);
  await expect(dialog).toHaveAttribute("data-shared-window-kind", "confirm");
  await expect(dialog).toHaveAttribute("data-shared-window-theme-projection", "active-page");
  await expect(dialog).toHaveAttribute("data-shared-window-title-action-contract", SHARED_WINDOW_TITLE_ACTION_RAIL_CONTRACT);
  await expect(dialog.locator('[data-shared-window-region="title"]')).toHaveCount(1);
  await expect(dialog.locator('[data-shared-window-region="footer"]')).toHaveCount(1);

  const sharedClose = dialog.locator(
    '[data-dialog-close][data-development-standard-close][data-content-plugin-control="close"][data-shared-window-close="true"]',
  );
  await expect(sharedClose).toHaveCount(1);
  await expect(sharedClose).toHaveAttribute("aria-label", "关闭");
  await expect(sharedClose).toHaveAttribute("data-shared-window-title-action", "close");
  const titleCloseGeometry = await dialog.evaluate((element) => {
    const title = element.querySelector<HTMLElement>('[data-shared-window-region="title"]');
    const close = element.querySelector<HTMLElement>('[data-shared-window-close="true"]');
    if (!title || !close) throw new Error("共享确认弹窗缺少标题或关闭键");
    const titleRect = title.getBoundingClientRect();
    const closeRect = close.getBoundingClientRect();
    return {
      titleCenter: titleRect.top + titleRect.height / 2,
      closeCenter: closeRect.top + closeRect.height / 2,
      closeHeight: closeRect.height,
      closeLineHeight: getComputedStyle(close).lineHeight,
    };
  });
  expect(Math.abs(titleCloseGeometry.titleCenter - titleCloseGeometry.closeCenter)).toBeLessThanOrEqual(1);
  expect(titleCloseGeometry.closeHeight).toBeCloseTo(32, 1);
  expect(titleCloseGeometry.closeLineHeight).toBe("0px");
  await sharedClose.click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(assignment.app_name, { exact: true })).toBeVisible();
  expect(deleteRequests).toBe(0);
});
