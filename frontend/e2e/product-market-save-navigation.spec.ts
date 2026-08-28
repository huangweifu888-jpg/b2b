import { expect, test, type Page } from "@playwright/test";

const MODULES_URL = "/zb/client-source/product-market?tab=modules";
const TEMPLATE_URL = "**/api/template-snapshot/templates/client-source-global";

async function installSaveReadbackApi(page: Page) {
  let savedConfig: Record<string, unknown> | null = null;
  let putCount = 0;

  await page.route("**/api/**", (route) => route.abort("blockedbyclient"));
  await page.route("**/api/config", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ API_BASE_URL: "" }),
  }));
  await page.route(TEMPLATE_URL, async (route) => {
    const method = route.request().method();
    if (method === "PUT") {
      const payload = route.request().postDataJSON() as { config_json?: Record<string, unknown> };
      savedConfig = structuredClone(payload.config_json || {});
      putCount += 1;
    } else if (method !== "GET") {
      await route.abort("blockedbyclient");
      return;
    }

    if (!savedConfig) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: "template not seeded" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        template_id: "client-source-global",
        owner_scope: "client_source",
        draft_config_json: savedConfig,
        config_json: savedConfig,
        is_published: false,
      }),
    });
  });

  return {
    putCount: () => putCount,
    injectDuplicateProductOrder: () => {
      const productOrder = savedConfig?.productOrder;
      if (!Array.isArray(productOrder) || typeof productOrder[0] !== "string") return null;
      const firstPath = productOrder[0];
      savedConfig = {
        ...savedConfig,
        productOrder: [firstPath, ...productOrder, firstPath],
      };
      return firstPath;
    },
  };
}

async function openCleanModulesDraft(page: Page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(MODULES_URL, { waitUntil: "domcontentloaded" });
  const workspace = page.locator('[data-product-market-settings-workspace="true"]');
  await expect(workspace).toBeVisible({ timeout: 60_000 });
  await expect(workspace).toHaveAttribute("data-template-draft-state", "clean", { timeout: 60_000 });
  return workspace;
}

async function editMarketRadar(page: Page) {
  const input = page.getByPlaceholder("市场雷达", { exact: true });
  await expect(input).toBeVisible();
  const original = await input.inputValue();
  await input.fill(`${original}【保存换页回归】`);
  await expect(page.locator('[data-product-market-settings-workspace="true"]'))
    .toHaveAttribute("data-template-draft-state", "dirty");
}

async function confirmDialog(page: Page, title: string) {
  const dialog = page.getByRole("dialog").filter({ hasText: title });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.locator("[data-unified-action-confirm]").click();
  await expect(dialog).toBeHidden({ timeout: 60_000 });
}

async function expectLayoutNavigationWithoutUnsavedPrompt(page: Page) {
  await page.getByRole("link", { name: "版面风格", exact: true }).click();
  await expect(page).toHaveURL(/\/product-market\?tab=layout(?:&|$)/u, { timeout: 15_000 });
  await expect(page.getByText("离开前处理未保存修改", { exact: true })).toHaveCount(0);
}

test("标题保存设置回读后换页不再提示重复保存", async ({ page }) => {
  const api = await installSaveReadbackApi(page);
  const workspace = await openCleanModulesDraft(page);
  await editMarketRadar(page);

  await page.getByRole("button", { name: "保存设置", exact: true }).click();
  await confirmDialog(page, "保存客户源模板配置");
  await expect(workspace).toHaveAttribute("data-template-draft-state", "clean", { timeout: 60_000 });
  expect(api.putCount()).toBe(1);
  await expectLayoutNavigationWithoutUnsavedPrompt(page);
});

test("尾栏保存回读后换页不再提示重复保存", async ({ page }) => {
  const api = await installSaveReadbackApi(page);
  const workspace = await openCleanModulesDraft(page);
  await editMarketRadar(page);

  await page.getByRole("button", { name: "保存并同步", exact: true }).click();
  await confirmDialog(page, "保存并同步页面设置");
  await expect(workspace).toHaveAttribute("data-template-draft-state", "clean", { timeout: 60_000 });
  expect(api.putCount()).toBe(1);
  await expectLayoutNavigationWithoutUnsavedPrompt(page);
});

test("仅在真实未保存修改时阻止换页", async ({ page }) => {
  await installSaveReadbackApi(page);
  await openCleanModulesDraft(page);
  await editMarketRadar(page);

  await page.getByRole("link", { name: "版面风格", exact: true }).click();
  await expect(page).toHaveURL(/\/product-market\?tab=modules(?:&|$)/u);
  const dialog = page.getByRole("dialog").filter({ hasText: "离开前处理未保存修改" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("保存并离开");
  await expect(dialog).toContainText("放弃并离开");
});

test("脏历史顺序由共享契约保序去重且栏目不重复渲染", async ({ page }) => {
  const api = await installSaveReadbackApi(page);
  const workspace = await openCleanModulesDraft(page);
  await editMarketRadar(page);
  await page.getByRole("button", { name: "保存设置", exact: true }).click();
  await confirmDialog(page, "保存客户源模板配置");
  await expect(workspace).toHaveAttribute("data-template-draft-state", "clean", { timeout: 60_000 });
  const duplicatedPath = api.injectDuplicateProductOrder();
  expect(duplicatedPath).not.toBeNull();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-product-market-settings-workspace="true"]')).toBeVisible({ timeout: 60_000 });
  const showAll = page.getByRole("button", { name: "显示全部栏目", exact: true });
  if (await showAll.isVisible()) await showAll.click();

  const ownershipKeys = await page.locator('.product-module-root-card[data-shared-ownership-key]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-shared-ownership-key")).filter(Boolean));
  expect(new Set(ownershipKeys).size).toBe(ownershipKeys.length);

  const persistedCount = await page.evaluate((firstPath) => {
    const key = Object.keys(window.localStorage)
      .find((candidate) => candidate.startsWith("product-market-config:") && candidate.endsWith(":current"));
    if (!key) return 0;
    const config = JSON.parse(window.localStorage.getItem(key) || "{}") as { productOrder?: string[] };
    return (config.productOrder || []).filter((path) => path === firstPath).length;
  }, duplicatedPath!);
  expect(persistedCount).toBe(1);
});
